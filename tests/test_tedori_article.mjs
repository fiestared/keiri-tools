// 記事「手取りの計算方法」の数字・条文引用を機械照合する。
//
// 規律（CLAUDE.md「検査の9つの規則」）:
//  - 規則3/5/7: 存在確認をやめ、**主張が載っている要素を名指し**する。この記事は同じ数字が
//    リード・表・図・FAQ・出典に何度も出る（249,610 は5箇所、2,837 は4箇所）ので、
//    **網だけでは位置ずれを絶対に守れない**。→ 表の行は**先頭セルで一意に特定**し、
//    行を特定したら**判定に効く全てのセル**を見る（第10便の素通し(a)＝行の一部しか見ていなかった）
//  - 規則(b)（第10便）: **数値を部分文字列で照合するな**。'0円'.includes は「60,000円」を通す。
//    → セルは**完全一致**で見る
//  - 規則6: 網の外に何が残るかを数える。この記事は「N円」「N%」「第N級」「N条」の4系統。
//    等級（22/23/20/31/32/50）はカンマを含まないので**金額の網に構造上入らない** → 専用の網
//  - 規則9: title と meta description も検査対象（タグ剥がしで消えるので別に見る）
//  - ★外部オラクル: 記事の数字を手打ちで照合するのではなく、**本番ツールの core（shaho_core /
//    gensen_kyuyo_core）と料率JSON・税額表JSONから再計算**して突き合わせる。
//    記事・ツール・一次情報の3つが噛み合わなければ落ちる。
import fs from 'node:fs';
import { calcMonthly, calcKoyou, kenkoGrade, koseiStandard, KOSEI_MAX, KENKO_GRADES } from '../docs/assets/shaho_core.js';
import { kouTax } from '../docs/assets/gensen_kyuyo_core.js';

const FILE = process.env.ARTICLE_FILE || 'docs/column/tedori-keisan/index.html';
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

const rates = JSON.parse(fs.readFileSync('docs/assets/shaho_rates_r08.json', 'utf8'));
const taxTable = JSON.parse(fs.readFileSync('docs/assets/gensen_getsugaku_r08.json', 'utf8'));

const KENKO_TOKYO = rates.kenko_rates['東京都'];
const KAIGO = rates.kaigo_rate, KOSODATE = rates.kosodate_rate, KOSEI = rates.kosei_nenkin_rate;
const GENERAL = rates.koyou.types.general;

const yen = n => n.toLocaleString('en-US');   // 12345 → "12,345"

// ───────── 外部オラクル: 本番の core で記事の数字を再計算する ─────────
function tedori(gross, age = 30, deps = 0) {
  const s = calcMonthly(gross, KENKO_TOKYO, KAIGO, age, KOSEI, KOSODATE);
  const k = calcKoyou(gross, GENERAL.total_permille, GENERAL.jigyo2_permille);
  const shaho = s.selfTotal + k.self;
  const base = gross - shaho;
  const tax = kouTax(taxTable, base, deps);
  return { grade: s.grade, std: s.standard, koseiStd: s.koseiStandard,
           kenko: s.kenkoKaigo.self, kosodate: s.kosodate.self, kosei: s.kosei.self,
           koyou: k.self, shaho, base, tax, net: gross - shaho - tax };
}

// ───────── HTML から要素を名指しで取り出す ─────────
const article = html.slice(html.indexOf('<article>'));
const strip = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** h2#id の節だけを切り出す。**節で絞ってから行を名指しする**（規則4: 名指しは一意であれ）。
 *  「所得税」「手取り」という先頭セルは記事中に2つの表に出るので、節で絞らないと一意にならない。 */
function section(id) {
  const i = article.indexOf(`<h2 id="${id}"`);
  if (i < 0) { fail(`節 #${id} が無い`); return ''; }
  const rest = article.slice(i + 1);
  const j = rest.indexOf('<h2 ');
  return j < 0 ? rest : rest.slice(0, j);
}

/** 節の中で、先頭セルが exactly `head` の <tr> を返す（一意でなければ落とす＝規則4） */
function row(scopeId, head) {
  const scope = section(scopeId);
  const trs = scope.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  const hit = trs.filter(tr => {
    const cs = tr.match(/<t[dh]>([\s\S]*?)<\/t[dh]>/g) || [];
    return cs.length && strip(cs[0]) === head;
  });
  if (hit.length === 0) { fail(`行が見つからない（#${scopeId} の先頭セル "${head}"）`); return null; }
  if (hit.length > 1) { fail(`行の名指しが一意でない（#${scopeId} の先頭セル "${head}" が${hit.length}行）`); return null; }
  return (hit[0].match(/<t[dh]>([\s\S]*?)<\/t[dh]>/g) || []).map(strip);
}

/** 行のセルが期待どおりか。**完全一致**で見る（部分文字列で見ない＝第10便の素通し(b)） */
function cells(scopeId, head, expected) {
  const got = row(scopeId, head);
  if (!got) return;
  if (got.length !== expected.length) {
    fail(`「${head}」の列数が違う: 期待${expected.length} / 実際${got.length} → ${JSON.stringify(got)}`);
    return;
  }
  const bad = expected.map((e, i) => (got[i] === e ? null : `[${i}] 期待"${e}" ≠ 実際"${got[i]}"`)).filter(Boolean);
  if (bad.length) fail(`「${head}」の行: ${bad.join(' / ')}`);
  else ok(`行「${head}」の全セルが一致（${got.length}列）`);
}

/** 指定の要素（callout内の<p>など）に文字列が含まれるか。要素を一意に名指しする */
function inElement(label, elementRe, must) {
  const m = article.match(elementRe);
  if (!m) { fail(`要素が見つからない: ${label}`); return; }
  if (m.length > 1) { fail(`要素の名指しが一意でない: ${label}（${m.length}件）`); return; }
  const text = strip(m[0]);
  const miss = must.filter(s => !text.includes(s));
  if (miss.length) fail(`${label}: ${miss.map(s => `"${s}"`).join(' / ')} が無い → ${text.slice(0, 90)}…`);
  else ok(`${label}（${must.length}点）`);
}

console.log('■ 外部オラクル（本番ツールの core で再計算し、記事の数字と突き合わせる）');

const A = tedori(309999);   // 第22級の上端
const B = tedori(310000);   // 第23級の下端
const M30 = tedori(300000);
const M30_40 = tedori(300000, 40);

// coreが記事の前提（等級）どおりに動いているか
if (A.grade !== 22 || A.std !== 300000) fail(`309,999円が第22級・標報300,000にならない → 第${A.grade}級・${A.std}`);
else ok('core: 報酬月額309,999円 → 第22級・標準報酬月額300,000円');
if (B.grade !== 23 || B.std !== 320000) fail(`310,000円が第23級・標報320,000にならない → 第${B.grade}級・${B.std}`);
else ok('core: 報酬月額310,000円 → 第23級・標準報酬月額320,000円');

// 崖の大きさ（記事の目玉）
const DIFF_SHAHO = B.shaho - A.shaho;      // +2,838
const DIFF_TAX = B.tax - A.tax;            // 0
const DIFF_NET = B.net - A.net;            // -2,837
const DIFF_YEAR = DIFF_NET * 12;           // -34,044
if (DIFF_SHAHO !== 2838) fail(`社会保険料の差が2,838円でない → ${DIFF_SHAHO}`);
else ok(`オラクル: 社会保険料の差 +${yen(DIFF_SHAHO)}円`);
if (DIFF_TAX !== 0) fail(`所得税の差が0円でない → ${DIFF_TAX}（記事の「同じ行に収まる」が崩れる）`);
else ok('オラクル: 所得税の差 0円（社会保険料控除後がどちらも同じ税額表の行に収まる）');
if (DIFF_NET !== -2837) fail(`手取りの差が−2,837円でない → ${DIFF_NET}`);
else ok(`オラクル: 手取りの差 ${yen(DIFF_NET)}円 ／ 年 ${yen(DIFF_YEAR)}円`);
// 崖の向き（額面が増えて手取りが減る）が成り立っているか。符号を明示的に見る
if (!(310000 > 309999 && B.net < A.net)) fail('「額面が増えて手取りが減る」が成り立っていない');
else ok('オラクル: 額面が1円多い側のほうが手取りが少ない（逆転が実在する）');

// 税額表の同じ行に入ること（記事が「同じ行（263,000円以上266,000円未満＝6,650円）」と書く根拠）
const rowA = taxTable.rows.find(r => r.min <= A.base && A.base < r.max);
const rowB = taxTable.rows.find(r => r.min <= B.base && B.base < r.max);
if (!rowA || !rowB || rowA.min !== rowB.min) fail(`税額表の行が違う → A:${rowA?.min} B:${rowB?.min}`);
else if (rowA.min !== 263000 || rowA.max !== 266000 || rowA.kou[0] !== 6650)
  fail(`税額表の行が記事と違う → ${rowA.min}〜${rowA.max} 税額${rowA.kou[0]}`);
else ok(`オラクル: 課税対象 ${yen(A.base)}円 と ${yen(B.base)}円 は同じ行 263,000〜266,000未満（6,650円）`);

// 厚生年金の頭打ち（第32級 650,000）。政令が足した等級
if (KOSEI_MAX !== 650000) fail(`KOSEI_MAX が650,000でない → ${KOSEI_MAX}`);
else ok('core: 厚生年金の標準報酬月額の上限 650,000円（第32級）');
const HIGH = [700000, 1000000].map(g => tedori(g).kosei);
if (new Set(HIGH).size !== 1) fail(`額面70万と100万で厚年保険料が違う → ${HIGH}`);
else ok(`オラクル: 額面70万円と100万円で厚生年金保険料は同額（${yen(HIGH[0])}円）＝頭打ち`);
// 健康保険の上限（第50級 1,390,000）は等級表の最終行
const lastKenko = KENKO_GRADES[KENKO_GRADES.length - 1];
if (lastKenko[0] !== 50 || lastKenko[1] !== 1390000) fail(`健保の最高等級が第50級1,390,000でない → ${lastKenko}`);
else ok('core: 健康保険の最高等級 第50級・1,390,000円');

// 同じ等級の中では保険料が変わらない（第20級 250,000以上270,000未満）
const LO = tedori(250000), HI = tedori(269999);
if (LO.std !== 260000 || HI.std !== 260000) fail(`第20級の標報が260,000にならない → ${LO.std}/${HI.std}`);
else if (LO.kenko !== HI.kenko || LO.kosei !== HI.kosei)
  fail('同じ等級なのに健保・厚年の保険料が違う');
else ok(`オラクル: 額面250,000円と269,999円は同じ標報260,000円 → 健保${yen(LO.kenko)}円・厚年${yen(LO.kosei)}円が同額`);

// 手取り率の非単調（記事のcalloutの主張）: 25万 < 30万
const R25 = LO.net / 250000, R30 = M30.net / 300000;
if (!(R30 > R25)) fail(`手取り率が 30万 > 25万 になっていない → 25万${(R25*100).toFixed(1)}% / 30万${(R30*100).toFixed(1)}%`);
else ok(`オラクル: 手取り率は単調でない（25万 ${(R25*100).toFixed(1)}% < 30万 ${(R30*100).toFixed(1)}%）`);

// 40歳で介護保険料が加わる分の減り（記事: 2,330円）
const KAIGO_SA = M30.net - M30_40.net;
if (KAIGO_SA !== 2330) fail(`40歳で手取りが2,330円減らない → ${KAIGO_SA}`);
else ok(`オラクル: 40歳（介護保険料）で手取りが ${yen(KAIGO_SA)}円 減る`);

console.log('\n■ 記事の表（行を先頭セルで名指しし、全セルを完全一致で照合）');

// 等級表（第22級・第23級）— 行を名指ししたら**境目のセルも**見る（第10便の素通し(a)）
cells('cliff', '第22級', ['第22級', '300,000円', '290,000円以上 310,000円未満']);
cells('cliff', '第23級', ['第23級', '320,000円', '310,000円以上 330,000円未満']);

// 崖の比較表（4列）。社保・所得税・手取りの3行が記事の核心
cells('cliff', '等級・標準報酬月額', ['等級・標準報酬月額', '第22級・300,000円', '第23級・320,000円', '＋20,000円']);
cells('cliff', '社会保険料 合計', ['社会保険料 合計', `${yen(A.shaho)}円`, `${yen(B.shaho)}円`, `＋${yen(DIFF_SHAHO)}円`]);
cells('cliff', '所得税', ['所得税', `${yen(A.tax)}円`, `${yen(B.tax)}円`, '0円']);
cells('cliff', '手取り', ['手取り', `${yen(A.net)}円`, `${yen(B.net)}円`, `−${yen(Math.abs(DIFF_NET))}円`]);

// 「引かれるもの」の表（#kekka）。土台（標準報酬月額 vs 賃金総額）の取り違えは崖の説明を壊す
cells('kekka', '雇用保険料', ['雇用保険料', '賃金総額（実際の支給額）', '1,500円（1,000分の5）']);
cells('kekka', '住民税', ['住民税', '前年の所得', '人により異なる（後述）']);

// 早見表（額面ごと）。オラクルの再計算値と一致すること
for (const g of [200000, 250000, 300000, 350000, 400000, 500000]) {
  const r = tedori(g);
  const rate = `${(r.net / g * 100).toFixed(1)}%`;
  cells('hayami', `${yen(g)}円`, [`${yen(g)}円`, `${yen(r.std)}円`, `${yen(r.shaho)}円`, `${yen(r.tax)}円`, `${yen(r.net)}円`, rate]);
}

// 同じ等級の中では保険料が同額（#naka）。**同額であること**が主張なので両列を見る
cells('naka', '健康保険料', ['健康保険料', `${yen(LO.kenko)}円`, `${yen(HI.kenko)}円（同額）`]);
cells('naka', '厚生年金保険料', ['厚生年金保険料', `${yen(LO.kosei)}円`, `${yen(HI.kosei)}円（同額）`]);
cells('naka', '手取り', ['手取り', `${yen(LO.net)}円`, `${yen(HI.net)}円`]);

// 住民税の税率表 — 税率だけでなく**根拠の条文セル**も見る（取り違えが実害）
cells('juminzei', '所得割（道府県民税）', ['所得割（道府県民税）', '4%', '地方税法35条1項']);
cells('juminzei', '所得割（市町村民税）', ['所得割（市町村民税）', '6%', '地方税法314条の3第1項']);
cells('juminzei', '均等割（道府県民税）', ['均等割（道府県民税）', '1,000円／年', '地方税法38条']);
cells('juminzei', '均等割（市町村民税）', ['均等割（市町村民税）', '3,000円／年', '地方税法310条']);
cells('juminzei', '森林環境税', ['森林環境税', '1,000円／年', '森林環境税及び森林環境譲与税に関する法律5条']);

// 厚年の頭打ちの表
cells('jougen', '700,000円', ['700,000円', '710,000円', '650,000円（頭打ち）', `${yen(tedori(700000).kosei)}円`]);
cells('jougen', '1,000,000円', ['1,000,000円', '980,000円', '650,000円（頭打ち）', `${yen(tedori(1000000).kosei)}円`]);

// 「同じ額面でも手取りが変わる4つの軸」の表（#chigai）
// ★ここの 9.85% / 9.21% / 2,330円 は、率の網では守れない（出典や他の表に同じ値が残るので
//   壊しても集合には現れ続ける＝規則7）。**行を名指しして全セルを見る**
const SA_PREF = Math.round((KENKO_TOKYO - rates.kenko_rates['新潟県']) / 2 / 100 * 300000);  // 960円
const SA_GYOSHU = Math.round((6 - 5) / 1000 * 300000);                                       // 300円
cells('chigai', '年齢', ['年齢', `40歳から介護保険料（${KAIGO}%の半分）が加わる`,
                          `額面30万円なら手取りが${yen(KAIGO_SA)}円減る`]);
cells('chigai', '都道府県', ['都道府県', `健康保険料率が違う（令和8年度：東京都${KENKO_TOKYO}%、新潟県${rates.kenko_rates['新潟県']}%）`,
                              `額面30万円で月${SA_PREF}円ほど`]);
cells('chigai', '業種', ['業種', '雇用保険料率が違う（一般5/1000、建設・農林水産6/1000）',
                          `額面30万円で月${SA_GYOSHU}円`]);
cells('chigai', '扶養親族の数', ['扶養親族の数', '所得税の源泉徴収税額が下がる', '1人につき月数千円']);
ok(`オラクル: 都道府県差 ${SA_PREF}円 ＝ (${KENKO_TOKYO}−${rates.kenko_rates['新潟県']})%÷2×300,000（記事の記載と一致）`);

console.log('\n■ 本文の主張（要素を名指し。同じ数字が他所にもあるので網では守れない）');

// 崖のcallout（この記事の目玉）。**その主張が1回しか現れない最小の要素**まで下ろす（規則5）
inElement('崖のcallout', /<p><b>額面が1円多い人のほうが、手取りが2,837円少ない<\/b><\/p>\s*<p>[\s\S]*?<\/p>/g,
  ['34,044円', '1円']);

// 「所得税が相殺してくれない」段落。263,042 / 265,879 / 6,650 / 3,000円刻み
inElement('所得税が0円になる理由の段落', /<p>ここで注目してほしいのは[\s\S]*?<\/p>/g,
  ['265,879円', '263,042円', '263,000円以上266,000円未満', '6,650円', '3,000円刻み']);

// 定時決定（4〜6月 → 9月〜翌8月）。条文の引用が正しいか
inElement('定時決定の段落', /<p><b>ではこの「1円」はいつ測られるのか。<\/b>[\s\S]*?<\/p>/g,
  ['健康保険法41条1項', '毎年7月1日', '同日前3月間', '4月・5月・6月', '41条2項', 'その年の9月から翌年の8月まで']);

// 17日未満の除外（定時決定のcallout）
// ★このcalloutは「17日」を2回書く（条文の引用と、本文の言い換え）。**引用そのもの**を見ないと、
//   片方を壊しても素通しする（規則5: 名指しした要素が自分の中で主張を再掲する）
inElement('支払基礎日数17日のcallout', /<p><b>ただし「支払基礎日数17日未満の月」は平均から外れる<\/b><\/p>\s*<p>[\s\S]*?<\/p>/g,
  ['報酬支払の基礎となった日数が17日…未満である月があるときは、その月を除く', '5月と6月の2か月平均']);

// 厚年の上限が政令で足されている（この記事の踏み込んだ一段）
inElement('政令のcallout', /<p><b>踏み込んだ一段：厚生年金保険法を読んでも、上限の65万円は出てこない<\/b><\/p>[\s\S]*?<\/div>/g,
  ['第31級・620,000円', '20条2項', '200%', '令和2年政令第246号', '第32級・650,000円（635,000円以上）', '令和2年9月1日', '150万円']);

// 住民税は前年の所得（1年目は引かれない）
// ★この段落も「前年の所得」を2回書く（言い換えと条文の引用）。**引用そのもの**を見る（規則5）
inElement('住民税＝前年の所得の段落', /<p>ここまでの早見表には[\s\S]*?<\/p>/g,
  ['地方税法32条1項', '所得割の課税標準は、前年の所得について算定した総所得金額…とする']);

// 指定都市の内わけ（合計10%は変わらない、を落とさない）
inElement('指定都市のcallout', /<p><b>政令指定都市に住んでいる人は、内わけだけが違う（合計は同じ10%）<\/b><\/p>\s*<p>[\s\S]*?<\/p>/g,
  ['百分の二', '百分の八', '道府県民税2%＋市民税8%', '合計10%は変わらない']);

// 等級の下端は損（手取り率が非単調な理由）
// ★このcalloutは「260,000円」を2回書く（250,000円の人と269,999円の人の両方）。
//   数字の存在だけを見ると片方を壊しても素通しする → **主張の文そのもの**を名指しする（規則5）
inElement('等級の下端のcallout', /<p><b>等級の下端の人は「実際の給料より高い額」で保険料を払っている<\/b><\/p>\s*<p>[\s\S]*?<\/p>/g,
  ['額面250,000円の人の標準報酬月額は260,000円', 'もらっていない1万円',
   '額面269,999円の人は、標準報酬月額260,000円']);

// 雇用保険だけ土台が違う（崖が生まれる理由）
inElement('雇用保険の土台のcallout', /<p><b>健康保険・厚生年金・支援金と、雇用保険は「かかる土台」が違う<\/b><\/p>\s*<p>[\s\S]*?<\/p>/g,
  ['賃金総額', '労働保険徴収法11条1項', 'その月には1円も動きません']);

console.log('\n■ 網（表記の系統ごと。網の外に残るものは上で名指し済み）');

const text = strip(article);

// (1) 等級の網: 「第N級」はカンマを含まず、金額の網に構造上入らない
const grades = [...new Set((text.match(/第(\d+)級/g) || []))].sort();
// 第1級は出典（健保は第1級58,000円から / 厚年は第1級88,000円から）に出る。落とすと出典が痩せる
const expectGrades = ['第1級', '第20級', '第22級', '第23級', '第31級', '第32級', '第50級'].sort();
if (JSON.stringify(grades) !== JSON.stringify(expectGrades))
  fail(`等級の集合が違う: 期待${JSON.stringify(expectGrades)} / 実際${JSON.stringify(grades)}`);
else ok(`等級の集合が一致（${grades.join(' ')}）`);

// (2) 料率の網: %表記
const pcts = [...new Set((text.match(/\d+(?:\.\d+)?%/g) || []))];
for (const need of ['9.85%', '18.3%', '0.23%', '1.62%', '9.21%', '83.2%', '82.8%', '81.7%', '83.7%'])
  if (!pcts.includes(need)) fail(`料率・率の網に "${need}" が無い`);
ok(`率の網 ${pcts.length}種を確認（9.85 / 18.3 / 0.23 / 1.62 / 9.21 …）`);

// (3) 料率が料率JSONと一致するか（記事に手打ちした率が本番とずれていないか）
if (KENKO_TOKYO !== 9.85) fail(`料率JSONの東京都が9.85%でない → ${KENKO_TOKYO}（記事を直すこと）`);
else ok('料率JSON: 東京都の健康保険料率 9.85%（記事の記載と一致）');
if (rates.kenko_rates['新潟県'] !== 9.21) fail(`料率JSONの新潟県が9.21%でない → ${rates.kenko_rates['新潟県']}`);
else ok('料率JSON: 新潟県 9.21%（記事が「最も低い」と書く根拠）');
const minPref = Object.entries(rates.kenko_rates).sort((a, b) => a[1] - b[1])[0];
if (minPref[0] !== '新潟県') fail(`最も料率が低いのが新潟県でない → ${minPref[0]} ${minPref[1]}%`);
else ok('料率JSO: 全都道府県で最も低いのは新潟県（記事の断定を裏取り）');

// (4) 条文番号の網（取り違えが出典の嘘になる）
for (const need of ['健康保険法40条', '健康保険法41条1項', '厚生年金保険法20条', '地方税法32条1項',
                    '地方税法35条1項', '地方税法314条の3第1項', '地方税法321条の5第1項', '令和2年政令第246号'])
  if (!text.includes(need)) fail(`条文の引用 "${need}" が本文に無い`);
ok('条文番号8件を確認（健保40/41・厚年20・地税32/35/314の3/321の5・令和2年政令246号）');

console.log('\n■ title / meta description（規則9: タグ剥がしで消えるので別に見る）');

const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
if (title.length > 60) fail(`titleが60字超（${title.length}字）`);
else ok(`title ${title.length}字`);
if (!title.includes('手取り')) fail('titleに「手取り」が無い');

const desc = (html.match(/<meta name="description" content="([\s\S]*?)">/) || [])[1] || '';
if (desc.length < 60) fail(`meta descriptionが60字未満（${desc.length}字）`);
else ok(`meta description ${desc.length}字`);
// meta descriptionは検索結果に出る＝公開された主張。数字が本文とずれたら嘘になる
for (const need of ['2,837円', '34,044円'])
  if (!desc.includes(need)) fail(`meta descriptionに "${need}" が無い（本文と食い違う）`);
ok('meta descriptionの数字が本文と一致（2,837円 / 34,044円）');

console.log(ng === 0 ? '\n✓ 記事「手取りの計算方法」OK' : `\n✗ ${ng}件の不一致`);
process.exit(ng === 0 ? 0 : 1);
