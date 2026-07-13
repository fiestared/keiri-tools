// 記事「源泉徴収税額表の見方（令和8年分）」の数字・引用・規則を機械照合する。
//
// 規律（CLAUDE.md）:
//  - 存在確認(includes)ではなく「集合の一致」で見る。過不足の両方を落とす
//  - 表記の系統ごとに別の網を張る（カンマ金額 / % / 人 / 万円）。網の外に何が残るかを数える
//  - ★網は「値の過不足」には強いが、**同じ値が複数箇所に出る主張の位置ずれ**には無力。
//    この記事で網が守れない主張は3つ:
//      (a) 1,610円を **税額から** 引くのか給与から引くのか（どちらでも集合には1,610が残る）
//      (b) 甲欄は105,000円未満が0円 / 乙欄は0円にならない（入れ替えても集合は同じ）
//      (c) 特定親族は「123万円以下」のうち **100万円以下** だけが毎月の数に入る（数の入れ替え）
//    → いずれも **その主張が1回しか現れない最小の要素** を名指しして見る（名指しの粒度）
//  - ★外部オラクル: 記事の目玉である「表と電算機計算の特例は一致しない」という統計
//    （5,080通り・一致23.1%・差 −310〜+120円）を、**国税庁の月額表JSONと財務省告示の式から
//    この場で計算し直して**照合する。記事が自分の算数を根拠にしないための独立実装。
import fs from 'node:fs';

const FILE = process.env.ARTICLE_FILE || 'docs/column/gensen-zeigakuhyo-mikata/index.html';
const TBL = JSON.parse(fs.readFileSync('docs/assets/gensen_getsugaku_r08.json', 'utf8'));
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

// ───────── 前提（一次情報。ここだけが手打ちを許される） ─────────
// 財務省告示「電子計算機等を使用して源泉徴収税額を計算する方法」（令和8年分）
// 平成24年3月31日財務省告示第116号（令和7年4月30日財務省告示第123号改正）
const KOJI = {
  // 別表第一 給与所得控除の額（1円未満切上）
  kyuyo: A => A <= 158333 ? 54167
    : A <= 299999 ? Math.ceil(A * 0.30 + 6667)
    : A <= 549999 ? Math.ceil(A * 0.20 + 36667)
    : A <= 708330 ? Math.ceil(A * 0.10 + 91667)
    : 162500,
  // 別表第三 基礎控除の額
  kiso: A => A <= 2120833 ? 48334 : A <= 2162499 ? 40000 : A <= 2204166 ? 26667 : A <= 2245833 ? 13334 : 0,
  // 別表第二 配偶者(特別)控除・扶養控除／特定親族特別控除の額（1人あたり）
  perDep: 31667,
  // 別表第四 税額の算式（10円未満四捨五入）
  zei: B => {
    const t = B <= 162500 ? B * 0.05105
      : B <= 275000 ? B * 0.10210 - 8296
      : B <= 579166 ? B * 0.20420 - 36374
      : B <= 750000 ? B * 0.23483 - 54113
      : B <= 1500000 ? B * 0.33693 - 130688
      : B <= 3333333 ? B * 0.40840 - 237893
      : B * 0.45945 - 408061;
    return Math.round(Math.max(t, 0) / 10) * 10;
  },
};
const tokurei = (A, n) => {
  const B = A - KOJI.kyuyo(A) - KOJI.kiso(A) - KOJI.perDep * n;
  return KOJI.zei(Math.max(B, 0));
};
// 国税庁 月額表（甲欄）を引く
const hyou = (A, n) => {
  const r = TBL.rows.find(r => r.min <= A && A < r.max);
  return r ? r.kou[n] : null;
};

// ───────── 外部オラクル: 記事の目玉の統計を、表と告示から計算し直す ─────────
// 記事は「表と特例は4回に3回一致しない」と断定している。その根拠を独立に再現する。
const STEP = 1000, LO = 105000, HI = 740000;
let cells = 0, same = 0, dmin = Infinity, dmax = -Infinity;
for (let A = LO; A < HI; A += STEP) {
  for (let n = 0; n <= 7; n++) {
    const h = hyou(A, n); if (h === null) continue;
    const d = tokurei(A, n) - h;
    cells++; if (d === 0) same++;
    if (d < dmin) dmin = d;
    if (d > dmax) dmax = d;
  }
}
const pct = (100 * same / cells);
const CLAIM = { cells: 5080, same: 1171, pct: '23.1', dmin: -310, dmax: 120 };
if (cells === CLAIM.cells) ok(`オラクル: 比較セル数 ${cells} が記事の主張と一致`);
else fail(`オラクル: 比較セル数 ${cells} ≠ 記事の ${CLAIM.cells}`);
if (same === CLAIM.same) ok(`オラクル: 完全一致 ${same} 通りが記事の主張と一致`);
else fail(`オラクル: 完全一致 ${same} ≠ 記事の ${CLAIM.same}`);
if (pct.toFixed(1) === CLAIM.pct) ok(`オラクル: 一致率 ${pct.toFixed(1)}% が記事の主張と一致`);
else fail(`オラクル: 一致率 ${pct.toFixed(1)}% ≠ 記事の ${CLAIM.pct}%`);
if (dmin === CLAIM.dmin && dmax === CLAIM.dmax) ok(`オラクル: 差の範囲 ${dmin}〜+${dmax}円 が記事の主張と一致`);
else fail(`オラクル: 差の範囲 ${dmin}〜${dmax} ≠ 記事の ${CLAIM.dmin}〜${CLAIM.dmax}`);

// ───────── 記事のテキスト（title・meta descriptionも含める） ─────────
const pick = re => (html.match(re) || [])[1] || '';
const strip = s => s.replace(/<[^>]+>/g, ' ');
const bodyText = strip(html.split('<article>')[1] || '');
const text = [pick(/<title>([^<]*)<\/title>/), pick(/<meta name="description" content="([^"]*)"/), bodyText].join(' ');

// ───────── 網1: カンマ区切りの金額・個数 ─────────
// 期待値は「表・告示から導いた数」∪「一次情報の前提」だけ。手打ちの誤りは過不足で落ちる。
const EX = new Set();
const add = (...xs) => xs.forEach(x => EX.add(Number(x)));
// 表から引いた実例（記事が本文・FAQで挙げているもの）
add(hyou(300000, 0), hyou(300000, 1), hyou(300000, 2));      // 7,930 / 6,320 / 4,700
add(hyou(500000, 0), hyou(500000, 1));                        // 28,190 / 21,730
add(tokurei(300000, 1), tokurei(500000, 1));                  // 6,300 / 21,480
add(TBL.rows.find(r => r.min <= 300000 && 300000 < r.max).min); // 299,000
add(TBL.rows.find(r => r.min <= 300000 && 300000 < r.max).max); // 302,000
// 1人あたりの減額（表の実測）
add(hyou(200000, 0) - hyou(200000, 1));                       // 1,610
add(hyou(500000, 0) - hyou(500000, 1));                       // 6,460
// 表の構造
add(TBL.over7Deduction, TBL.otsuLowMax);                      // 1,610 / 105,000
add(200000, 300000, 500000);                                  // 記事が使う給与水準
add(TBL.over7Deduction * 2);                                  // 3,220（9人のとき）
// 告示の前提
add(KOJI.perDep, KOJI.kiso(0), 2120833, 162500);              // 31,667 / 48,334 / 2,120,833 / 162,500
add(Math.round(KOJI.perDep * 0.05105), Math.round(KOJI.perDep * 0.2042)); // 約1,617 / 約6,466
// 表の刻み幅（2,000円〜3,000円）
add(2000, 3000);
// オラクルの統計
add(cells, same);                                             // 5,080 / 1,171
add(Math.abs(dmin), dmax);                                    // 310 は3桁なのでカンマ網に入らない/120も同様
// 記事が明記する「検証の条件」もオラクルの前提から導く（手打ちを許さない）
add(LO, HI - STEP, STEP);                                     // 105,000円〜739,000円を1,000円刻み
const got = new Set((text.match(/\d{1,3}(?:,\d{3})+/g) || []).map(s => Number(s.replace(/,/g, ''))));
const expComma = new Set([...EX].filter(n => n >= 1000));     // カンマが付くのは4桁以上
const missing = [...expComma].filter(n => !got.has(n));
const extra = [...got].filter(n => !expComma.has(n));
if (!missing.length && !extra.length) ok(`金額の集合が一致 (${got.size}種)`);
else {
  if (missing.length) fail(`記事に無い期待値: ${missing.map(n => n.toLocaleString()).join(' / ')}`);
  if (extra.length) fail(`根拠のない数が記事にある: ${extra.map(n => n.toLocaleString()).join(' / ')}`);
}

// ───────── 網2: パーセント ─────────
const EXP_PCT = new Set([
  (TBL.otsuLowRate * 100).toFixed(3),  // 3.063 乙欄の低額帯
  '5.105', '10.210', '20.420', '20.42', '23.483', '33.693', '40.840', '45.945', // 別表第四
  pct.toFixed(1),                       // 23.1 オラクルの一致率
]);
const gotPct = new Set((text.match(/(\d+\.\d+)\s*%/g) || []).map(s => s.replace(/\s*%/, '')));
const pctExtra = [...gotPct].filter(p => !EXP_PCT.has(p));
if (!pctExtra.length) ok(`パーセントの集合に根拠のない値なし (${gotPct.size}種)`);
else fail(`根拠のない%が記事にある: ${pctExtra.join(' / ')}`);

// ───────── 網3: 「N万円」（所得要件）— カンマの網に構造上入らない ─────────
// 令和7年度改正で 配偶者は85万円→95万円 に上がっている。旧値に戻しても
// カンマの網は緑のまま（85万円にカンマは無い）なので、万円は別の網で数える。
// 出所: 国税庁「給与所得の源泉徴収税額の求め方」（令和8年分）注2〜注6
const EXP_MAN = new Set([
  900, // 源泉控除対象配偶者: 本人の所得の見積額
  95,  // 源泉控除対象配偶者: 配偶者の所得の見積額
  58,  // 控除対象扶養親族／同一生計配偶者／特定親族の下限
  123, // 特定親族の上限
  100, // 源泉控除対象親族になる特定親族の上限
]);
const gotMan = new Set((text.match(/(\d+)万円/g) || []).map(s => Number(s.replace('万円', ''))));
const manMissing = [...EXP_MAN].filter(n => !gotMan.has(n));
const manExtra = [...gotMan].filter(n => !EXP_MAN.has(n));
if (!manMissing.length && !manExtra.length) ok(`「N万円」の集合が一致 (${gotMan.size}種)`);
else {
  if (manMissing.length) fail(`記事に無い万円の期待値: ${manMissing.join('万円 / ')}万円`);
  if (manExtra.length) fail(`根拠のない万円が記事にある: ${manExtra.join('万円 / ')}万円`);
}

// ───────── 網4: 年齢 ─────────
// 22 は「19歳以上23歳未満」を日常語に開いた「19〜22歳」（見出し）。23未満＝満22歳までなので正しい。
const EXP_AGE = new Set([16, 19, 22, 23, 3]); // 3歳は16歳未満の具体例（callout）
const gotAge = new Set((text.match(/(\d+)歳/g) || []).map(s => Number(s.replace('歳', ''))));
const ageExtra = [...gotAge].filter(n => !EXP_AGE.has(n));
const ageMissing = [...EXP_AGE].filter(n => !gotAge.has(n));
if (!ageExtra.length && !ageMissing.length) ok(`年齢の集合が一致 (${[...gotAge].sort((a, b) => a - b).join('/')}歳)`);
else fail(`年齢の集合が不一致: 不足=${ageMissing} 過剰=${ageExtra}`);

// ───────── 名指し(a): 1,610円は「税額から」引く ─────────
// 網では守れない（給与から引くと書き換えても 1,610 は集合に残る）。引用のblockquoteだけを見る。
const bqs = [...html.matchAll(/<blockquote>([\s\S]*?)<\/blockquote>/g)].map(m => strip(m[1]));
const bq1610 = bqs.find(b => b.includes('1,610円'));
if (!bq1610) fail('1,610円の根拠となる国税庁の引用(blockquote)が無い');
else if (/扶養親族等の数が7人の場合の税額から/.test(bq1610) && /1人ごとに1,610円を控除した金額/.test(bq1610))
  ok('引用: 1,610円は「7人の場合の税額から」控除すると明記されている');
else fail('引用が「税額から控除」になっていない（給与から引くと誤読させる）');

// 本文の断定を名指しする。
// ★名指しは一意でなければ効かない: 「引くのは」と「1,610」を含む<p>で探すと、
//   **FAQの答えが当たる**（FAQは本文の主張を再掲するので両方の語を含み、しかも本文側の
//   <p>には1,610が無い＝blockquoteにある）。本文を壊してもFAQが無傷なら素通しする。
//   → **h2#over7 の節の中に限定してから**探す（節が名前を一意にする）。
const overSec = (html.split('<h2 id="over7">')[1] || '').split('<h2 ')[0];
const overPs = [...overSec.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]));
const pHiku = overPs.find(p => p.includes('引くのは'));
if (pHiku && /給与の額からではなく[、,]?\s*税額から/.test(pHiku.replace(/\s+/g, ''))) ok('本文(over7の節): 「給与の額からではなく税額から」と明記');
else fail('本文に「給与からではなく税額から引く」の断定が無い（向きが逆でも網は緑になる）');
// タグ剥がしは <b>50円</b> を「 50円 」にする（前後に空白が入る）ので空白を除いてから見る
if (pHiku && /日額表の場合は1人ごとに50円です/.test(pHiku.replace(/\s+/g, '')))
  ok('本文(over7の節): 日額表は1人ごとに50円');
else fail('日額表の50円が本文に無い/改変されている');

// ───────── 名指し(a2): 表の実例（6,320円 等）は「その主張が載っている段落」で見る ─────────
// ★網では守れない: 6,320 も 6,300 も比較表にも出るので、本文の実例を入れ替えても集合は不変。
const shahoSec = (html.split('<h2 id="shaho">')[1] || '').split('<h2 ')[0];
const pRei = [...shahoSec.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => strip(m[1])).find(p => p.includes('実例で見ます'));
if (!pRei) fail('「実例で見ます」の段落が無い');
else {
  const want = [
    [`<b>${hyou(300000, 1).toLocaleString()}円</b>が源泉徴収税額`, hyou(300000, 1), '扶養1人'],
    [null, hyou(300000, 0), '扶養0人'],
    [null, hyou(300000, 2), '扶養2人'],
  ];
  const bad = want.filter(([, v]) => !pRei.includes(v.toLocaleString()));
  if (!bad.length) ok(`実例の段落: 300,000円で 0人=${hyou(300000, 0).toLocaleString()} / 1人=${hyou(300000, 1).toLocaleString()} / 2人=${hyou(300000, 2).toLocaleString()}円（表と一致）`);
  else fail(`実例の段落の税額が月額表と食い違う: ${bad.map(b => b[2]).join('・')}`);
  // 行の範囲（299,000〜302,000）も表から
  const row = TBL.rows.find(r => r.min <= 300000 && 300000 < r.max);
  if (pRei.includes(row.min.toLocaleString()) && pRei.includes(row.max.toLocaleString())) ok('実例の段落: 該当行の範囲が表と一致');
  else fail('実例の段落の「該当行」が月額表と食い違う');
}

// ───────── 名指し(a3): 比較表の各行を「主語セル」で特定する ─────────
// ★差の範囲(−310/+120)は**3桁なのでカンマの網に構造上入らない**（CLAUDE.md）。行を名指しする。
const densankiSec = (html.split('<h2 id="densanki">')[1] || '').split('<h2 ')[0];
const trs = [...densankiSec.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => strip(m[1]));
const rowBy = k => trs.find(r => r.includes(k));
const rIchi = rowBy('完全に一致した割合');
if (rIchi && rIchi.includes(pct.toFixed(1)) && rIchi.includes(cells.toLocaleString()) && rIchi.includes(same.toLocaleString()))
  ok(`比較表の行「完全に一致した割合」= ${pct.toFixed(1)}% (${same.toLocaleString()}/${cells.toLocaleString()}) がオラクルと一致`);
else fail('比較表の「完全に一致した割合」の行が、オラクルの再計算と食い違う');
const rHaba = rowBy('差の範囲');
if (rHaba && rHaba.includes(String(Math.abs(dmin))) && rHaba.includes(String(dmax)))
  ok(`比較表の行「差の範囲」= ${dmin}〜+${dmax}円 がオラクルと一致（3桁なので網に入らない＝名指しが要る）`);
else fail('比較表の「差の範囲」の行が、オラクルの再計算と食い違う');
for (const [A, n] of [[300000, 1], [500000, 1]]) {
  const r = rowBy(`${A.toLocaleString()}円・扶養${n}人`);
  if (r && r.includes(hyou(A, n).toLocaleString()) && r.includes(tokurei(A, n).toLocaleString()))
    ok(`比較表の行「${A.toLocaleString()}円・扶養${n}人」: 表=${hyou(A, n).toLocaleString()} / 式=${tokurei(A, n).toLocaleString()} が再計算と一致`);
  else fail(`比較表の行「${A.toLocaleString()}円・扶養${n}人」が再計算と食い違う`);
}

// ───────── 名指し(b): 甲欄は0円 / 乙欄は0円にならない（入れ替え検出） ─────────
// 乙欄の節の<p>だけを見る。甲欄と乙欄を入れ替えても、記事全体の集合は変わらない。
const otsuSec = (html.split('<h3>乙欄')[1] || '').split('<h3>')[0];
const otsuText = strip(otsuSec);
const otsuOK = /105,000円未満の場合は、その金額の3\.063%/.test(otsuText)
  && /甲欄なら105,000円未満は税額0円ですが、\s*<?b?>?乙欄は0円になりません/.test(otsuSec.replace(/<[^>]+>/g, ''))
  || (/甲欄なら105,000円未満は税額0円/.test(otsuText) && /乙欄は0円になりません/.test(otsuText));
if (otsuOK) ok('乙欄の節: 「乙欄は105,000円未満でも3.063%（甲欄と違い0円にならない）」');
else fail('乙欄の節で、甲欄0円 / 乙欄3.063% の対比が崩れている');
// データとの一致（乙欄の下限帯は表の正本から）
if (otsuText.includes(String(TBL.otsuLowMax.toLocaleString())) && otsuText.includes((TBL.otsuLowRate * 100).toFixed(3)))
  ok(`乙欄の節の数値が税額表データと一致 (${TBL.otsuLowMax.toLocaleString()}円未満 / ${(TBL.otsuLowRate * 100).toFixed(3)}%)`);
else fail('乙欄の節の数値が税額表データ(otsuLowMax/otsuLowRate)と食い違う');

// ───────── 名指し(c): 特定親族は「123万円以下」のうち「100万円以下」だけ毎月の数に入る ─────────
// 100 と 123 を入れ替えても、万円の集合は変わらない。callout の中だけを見る。
const callouts = [...html.matchAll(/<div class="callout">([\s\S]*?)<\/div>/g)].map(m => m[1]);
const coTokutei = callouts.find(c => c.includes('特定親族') || c.includes('大学生'));
if (!coTokutei) fail('特定親族(100万円/123万円)のcalloutが無い');
else {
  const t = strip(coTokutei);
  // 「毎月1人と数えるのは 100万円以下だけ」「100万超123万以下は列に入らないが年末調整で精算」
  const a = /毎月の源泉徴収で1人と数えるのは、そのうち所得100万円以下の人だけ/.test(t);
  const b = /所得が100万円超123万円以下の子は、毎月の税額表の列には反映されない/.test(t);
  if (a && b) ok('callout: 100万円以下だけが毎月の数に入り、100万超123万以下は年末調整で精算');
  else fail('特定親族のcalloutで100万円/123万円の役割が入れ替わっている（網では検出できない）');
}
// 表の行（源泉控除対象親族の要件）も主語セルで名指しする
const rowTokutei = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]).find(r => r.includes('特定親族'));
if (rowTokutei && /19歳以上23歳未満/.test(strip(rowTokutei)) && /100万円以下/.test(strip(rowTokutei)))
  ok('表の行: 特定親族は19歳以上23歳未満・かつ100万円以下');
else fail('特定親族の表の行に「19歳以上23歳未満」「100万円以下」が揃っていない');

// ───────── 名指し(d): 16歳未満は数に入らない。ただし障害者なら入る ─────────
const co16 = callouts.find(c => strip(c).includes('3歳の子') || strip(c).includes('16歳未満'));
const h3_16 = (html.split('<h3>② 16歳未満の子は数に入らない')[1] || '').split('<h2')[0];
if (!h3_16) fail('「16歳未満は数に入らない。ただし障害者なら入る」の節が無い');
else {
  // ★名指しの粒度: 節ごと見ると、例外の段落を消しても **calloutが同じ主張を再掲している**ので緑になる。
  //   原則の<p>と例外の<p>を **別々に** 名指しする。
  const p16 = [...h3_16.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]));
  const pGensoku = p16.find(p => p.includes('控除対象扶養親族に当たらない'));
  const pReigai = p16.find(p => p.includes('ところが、加算の規定のほうは'));
  if (pGensoku && /加算しません/.test(pGensoku)) ok('本文: 16歳未満は原則として加算しない');
  else fail('16歳未満の「原則（加算しない）」の段落が無い');
  if (pReigai && /年齢16歳未満の人を含みます/.test(pReigai) && /障害者なら1人として加算される/.test(pReigai))
    ok('本文: 例外（16歳未満でも障害者なら加算）が、原則とは別の段落で明記されている');
  else fail('16歳未満の「例外（障害者なら加算）」の段落が無い/改変されている');
}
if (co16) ok('16歳未満のcalloutあり'); else fail('16歳未満のcalloutが無い');

// ───────── 名指し(e): 表に当てはめるのは社会保険料等控除後（総支給ではない） ─────────
const bqShaho = bqs.find(b => b.includes('社会保険料等を控除した後の金額'));
if (bqShaho && /その月（日）分の給与等の金額から厚生年金保険料、健康保険料及び雇用保険料などの社会保険料等を控除した後の金額によります/.test(bqShaho))
  ok('引用: 税額表に当てはめるのは社会保険料等控除後の金額（国税庁の原文）');
else fail('国税庁「社会保険料等を控除した後の金額」の引用が本文に無い/改変されている');

// ───────── 名指し(f): 賞与でも月額表を使う2つの場合 ─────────
const coShoyo = callouts.find(c => strip(c).includes('賞与'));
if (coShoyo) {
  const t = strip(coShoyo);
  if (/前月中に普通給与の支払がない/.test(t) && /前月中の普通給与の額の10倍を超える/.test(t) && /月額表を使います/.test(t))
    ok('callout: 賞与でも月額表を使う2つの場合（前月給与なし／前月給与の10倍超）');
  else fail('賞与の例外2つ（前月給与なし・10倍超）が揃っていない');
} else fail('賞与の例外のcalloutが無い');

// ───────── 名指し(g): 丙欄は2か月を超えたら使えない ─────────
const coHei = callouts.find(c => strip(c).includes('日雇賃金には含まれません'));
// ★「2か月」は同じcallout内に3回出る。1文だけ見ると、別の文を3か月に壊しても緑になる
//   （実際に壊しテストで素通しした）。→ 引用文と地の文の**両方**を名指しする。
const heiQuote = coHei && /一の給与等の支払者から継続して2か月を超えて給与等が支払われた場合には、その2か月を超える部分の期間につき支払われるものは、ここでいう日雇賃金には含まれません/.test(strip(coHei));
const heiJi = coHei && /2か月を超えて働き続けたら/.test(strip(coHei));
if (heiQuote && heiJi) ok('callout: 継続2か月超の部分は日雇賃金でない（引用・地の文とも2か月）');
else fail('丙欄の「2か月を超えたら使えない」が引用・地の文のどちらかで崩れている');

// ───────── 電算機計算の特例が「月額表の甲欄だけ」であること ─────────
const coRange = callouts.find(c => strip(c).includes('特例が使えるのは'));
if (coRange && /乙欄・丙欄・日額表・賞与/.test(strip(coRange)) && /適用されません/.test(strip(coRange)))
  ok('callout: 特例は月額表の甲欄だけ（乙欄・丙欄・日額表・賞与には使えない）');
else fail('特例の適用範囲（月額表の甲欄限定）の注意が無い');

// ───────── 出典 ─────────
const src = (html.split('<h2 id="source">')[1] || '').split('</ul>')[0];
for (const k of ['月額表', '給与所得の源泉徴収税額の求め方', '財務省告示', '令和7年分以前'])
  if (src.includes(k)) ok(`出典に「${k}」あり`); else fail(`出典に「${k}」が無い`);

console.log(ng ? `\n✗ 記事「源泉徴収税額表」 ${ng}件の違反` : '\n✓ 記事「源泉徴収税額表」 OK');
process.exit(ng ? 1 : 0);
