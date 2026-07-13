// 記事「高額療養費の自己負担限度額」の数字・条文引用・境界主張を機械照合する。
//
// 規律（CLAUDE.md「検査の9つの規則」）:
//  - 存在確認(includes)ではなく「集合の一致」で見る。過不足の両方を落とす（規則6）
//  - 網の外に残る主張を数える。この記事で網の外に出るのは
//      ・**等級**（「第30級」— カンマが無いので金額の網に構造上入らない）
//      ・**条文番号**（42条1項1号 / 129条の2第2項）
//      ・**「1円」「1%」**（3桁未満）
//    → 等級は別の網、条文番号と境界の主張は**要素の名指し**で守る（規則6・7）
//  - ★この記事の最大の危険は「同じ金額が複数箇所に出る主張の**位置ずれ**」（規則7）。
//    87,430円 と 171,820円 は 表・本文・FAQ・図解 に何度も出るので、
//    **どちらがどの区分の額か**を入れ替えても金額の集合は変わらない。
//    → 崖の表は **報酬月額のセル（514,999/515,000）で行を特定**し、その行の中だけを見る（規則4・5）
//  - ★外部オラクル: 記事の目玉（1円で84,390円変わる）を、自分の算数ではなく
//    **本番ツールの等級表（docs/assets/shaho_core.js の kenkoGrade）** と
//    **施行令42条の式** から独立に再計算して照合する。
//    記事・ツール・政令の3つが噛み合えば、読み違えていないと分かる。
import fs from 'node:fs';
import { kenkoGrade, KENKO_GRADES } from '../docs/assets/shaho_core.js';

const FILE = process.env.ARTICLE_FILE || 'docs/column/kogaku-ryoyohi/index.html';
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

// ───────── 前提（一次情報。ここだけが手打ちを許される） ─────────
// 健康保険法施行令42条1項（e-Gov法令 v2 で条文全文を確認）
// ★号の順番は ウ(1号=「以外の者」)・ア(2号)・イ(3号)・エ(4号)・オ(5号) で、表の並びと違う
const SEIREI = {
  ウ: { go: 1, base: 80100,  start: 267000, rate: 0.01, tasuukai: 44400 },
  ア: { go: 2, base: 252600, start: 842000, rate: 0.01, tasuukai: 140100 },
  イ: { go: 3, base: 167400, start: 558000, rate: 0.01, tasuukai: 93000 },
  エ: { go: 4, flat: 57600,  tasuukai: 44400 },
  オ: { go: 5, flat: 35400,  tasuukai: 24600 },
};
// 施行令41条1項1号かっこ書き: 70歳未満の世帯合算は「二万千円…以上のものに限る」
const GASSAN_MIN = 21000;
// 区分の境目（施行令42条1項2号〜4号。**標準報酬月額**であって年収でも報酬月額でもない）
const KUBUN_KYOKAI = { ア: 830000, イ: 530000, エ: 280000 };
// 協会けんぽ「高額療養費」の公表表に載っている12個の金額（curlで生HTMLを確認）
const KYOKAI_KENPO = [80100, 252600, 167400, 57600, 35400, 140100, 93000, 44400, 24600, 267000, 558000, 842000];

// ───────── 外部オラクル1: 政令の式 ⇔ 協会けんぽの公表表 ─────────
{
  const fromSeirei = new Set();
  for (const v of Object.values(SEIREI)) {
    for (const k of ['base', 'start', 'flat', 'tasuukai']) if (v[k] != null) fromSeirei.add(v[k]);
  }
  const missing = KYOKAI_KENPO.filter(n => !fromSeirei.has(n));
  const extra = [...fromSeirei].filter(n => !KYOKAI_KENPO.includes(n));
  if (missing.length || extra.length) {
    fail(`政令から読んだ金額と協会けんぽの公表表が一致しない 不足=${missing} 余分=${extra}`);
  } else {
    ok(`外部オラクル: 施行令42条から読んだ12個の金額が協会けんぽの公表表と完全一致`);
  }
}

// ───────── 外部オラクル2: 本番ツールの等級表で「1円の崖」を再現する ─────────
// 記事の目玉。政令の式 × 実際の等級表 から独立に再計算し、記事の数字と突き合わせる。
const genkido = (kubun, iryohi) => {
  const s = SEIREI[kubun];
  if (s.flat != null) return s.flat;
  const pct = Math.max(0, iryohi - s.start) * s.rate;
  // 施行令42条: 1円未満の端数は50銭未満切捨・50銭以上切上
  const rounded = Math.floor(pct) + (pct - Math.floor(pct) >= 0.5 ? 1 : 0);
  return s.base + rounded;
};
// 標準報酬月額 → 区分（政令の境目に当てはめる）
const kubunOf = std => std >= KUBUN_KYOKAI.ア ? 'ア' : std >= KUBUN_KYOKAI.イ ? 'イ' : std >= KUBUN_KYOKAI.エ ? 'ウ' : 'エ';

const IRYOHI = 1000000;   // 医療費100万円（10割）
const CLIFF = {};
for (const hoshu of [514999, 515000]) {
  const g = kenkoGrade(hoshu);                 // ← 本番ツールの等級表そのもの
  CLIFF[hoshu] = { grade: g.grade, std: g.standard, kubun: kubunOf(g.standard), limit: genkido(kubunOf(g.standard), IRYOHI) };
}
{
  const lo = CLIFF[514999], hi = CLIFF[515000];
  const expect = { lo: { grade: 30, std: 500000, kubun: 'ウ', limit: 87430 }, hi: { grade: 31, std: 530000, kubun: 'イ', limit: 171820 } };
  const same = (a, e) => a.grade === e.grade && a.std === e.std && a.kubun === e.kubun && a.limit === e.limit;
  if (!same(lo, expect.lo) || !same(hi, expect.hi)) {
    fail(`崖の再計算が合わない 514999→${JSON.stringify(lo)} / 515000→${JSON.stringify(hi)}`);
  } else {
    ok(`外部オラクル: 本番ツールの等級表＋施行令の式で、報酬月額1円差の崖を再現(87,430 / 171,820)`);
  }
  const diff = hi.limit - lo.limit;
  if (diff !== 84390) fail(`崖の差額が84,390円でない: ${diff}`);
  else ok(`外部オラクル: 崖の差額 84,390円 を再計算で確認`);
  // 窓口3割からの払い戻し
  const modori = IRYOHI * 0.3 - lo.limit;
  if (modori !== 212570) fail(`払い戻し額が212,570円でない: ${modori}`);
  else ok(`外部オラクル: 高額療養費 212,570円（300,000−87,430）を再計算で確認`);
}

// ───────── 外部オラクル3: 80万円台の標準報酬月額の等級は存在しない ─────────
// 記事は「条文の『83万円未満』と協会けんぽの『79万円まで』は矛盾しない」と主張する。
// その根拠（80万円台の等級が無いこと）を、等級表そのものから確かめる。
{
  const stds = KENKO_GRADES.map(([, std]) => std);
  const between = stds.filter(s => s > 790000 && s < 830000);
  if (between.length) fail(`80万円台の標準報酬月額の等級が存在する: ${between}`);
  else ok(`外部オラクル: 標準報酬月額に80万円台の等級は無い(79万→83万で飛ぶ)＝条文と協会けんぽ表は矛盾しない`);
  // 同じ理由で区分ウの上端が50万円になること
  const uEnd = stds.filter(s => s >= 280000 && s < 530000).pop();
  if (uEnd !== 500000) fail(`区分ウの上端の等級が50万円でない: ${uEnd}`);
  else ok(`外部オラクル: 区分ウ(28万以上53万未満)の上端の等級は50万円`);
}

// ───────── 本文の抽出 ─────────
const body = html.slice(html.indexOf('<article>'));
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const text = strip(body);

// 表の行を「セルの中身」で一意に名指しする（規則4・5: find()は最初の一致を返す）
const rows = [...body.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(m => m[0]);
const rowBy = (...needles) => rows.find(r => needles.every(n => r.includes(n)));

// ───────── 1. 早見表: 5区分すべての額と**区分の境目**を、区分セルで行を名指しして照合 ─────────
// ★境目のセル（標準報酬月額）まで見ること。金額だけを見ていると
//   「区分イ＝53万円以上」を「50万円以上」に書き換えても緑になる（読者が別の区分の額を見る実害）。
const KYOKAI_CELL = {
  ア: '<td>83万円以上</td>',
  イ: '<td>53万円以上83万円未満</td>',
  ウ: '<td>28万円以上53万円未満</td>',
  エ: '<td>28万円未満</td>',
  オ: '<td>住民税非課税</td>',
};
for (const [k, v] of Object.entries(SEIREI)) {
  const r = rowBy(`<td><b>${k}</b></td>`);
  if (!r) { fail(`早見表に区分${k}の行が無い`); continue; }
  const t = strip(r);
  const want = v.flat != null
    ? [`${v.flat.toLocaleString()}円`]
    : [`${v.base.toLocaleString()}円`, `${v.start.toLocaleString()}円`];
  const miss = want.filter(w => !t.includes(w));
  const tas = `${v.tasuukai.toLocaleString()}円`;
  if (!r.includes(KYOKAI_CELL[k])) fail(`早見表 区分${k}の境目のセルが ${KYOKAI_CELL[k]} でない: ${t}`);
  else if (miss.length) fail(`早見表 区分${k}の行に ${miss} が無い: ${t}`);
  else if (!t.includes(tas)) fail(`早見表 区分${k}の行に多数回該当 ${tas} が無い: ${t}`);
  else ok(`早見表 区分${k}: 境目${strip(KYOKAI_CELL[k]).trim()} / ${want.join(' / ')} ＋多数回 ${tas}`);
}
// 境目の数字が、政令から読んだ標準報酬月額の境界と食い違っていないか（表記ゆれの裏取り）
for (const [k, en] of Object.entries(KUBUN_KYOKAI)) {
  const man = en / 10000;
  if (!KYOKAI_CELL[k].includes(`${man}万円`)) fail(`区分${k}の境目セルが政令の${man}万円と一致しない`);
}
ok('区分の境目(83万/53万/28万)が政令の標準報酬月額と一致');

// ───────── 2. 崖の表: 報酬月額セルで行を名指しし、限度額の**入れ替わり**を落とす ─────────
// （規則7: 87,430 と 171,820 は記事の各所に出るので、集合の網では入れ替えを検出できない）
for (const [hoshu, want] of [[514999, CLIFF[514999]], [515000, CLIFF[515000]]]) {
  const r = rowBy(`<b>${hoshu.toLocaleString()}円</b>の人`);
  if (!r) { fail(`崖の表に報酬月額${hoshu.toLocaleString()}円の行が無い`); continue; }
  const t = strip(r);
  const need = [`第${want.grade}級`, `${(want.std / 10000)}万円`, want.kubun, `${want.limit.toLocaleString()}円`];
  const miss = need.filter(n => !t.includes(n));
  // 反対側の額が同じ行に紛れ込んでいたら落とす（入れ替えの検出）
  const other = hoshu === 514999 ? CLIFF[515000] : CLIFF[514999];
  if (miss.length) fail(`崖の表 ${hoshu}の行に ${miss} が無い: ${t}`);
  else if (t.includes(`${other.limit.toLocaleString()}円`)) fail(`崖の表 ${hoshu}の行に反対側の限度額 ${other.limit} が混入: ${t}`);
  else ok(`崖の表 報酬月額${hoshu.toLocaleString()}円 → 第${want.grade}級・区分${want.kubun}・${want.limit.toLocaleString()}円`);
}

// ───────── 3. 多数回該当の表: 区分ウとエが同じ44,400円に潰れる ─────────
{
  const ru = rowBy('<b>区分ウ</b>'), re = rowBy('<b>区分エ</b>');
  if (!ru || !re) fail('多数回該当の表に区分ウ/エの行が無い');
  else {
    const tu = strip(ru), te = strip(re);
    if (!tu.includes('87,430円') || !tu.includes('44,400円')) fail(`多数回該当 区分ウの行: ${tu}`);
    else if (!te.includes('57,600円') || !te.includes('44,400円')) fail(`多数回該当 区分エの行: ${te}`);
    // 「潰れる」＝エの多数回が57,600のままでない（同じ行に2つ出るので includes では守れない）
    else if (/<td>57,600円<\/td><td><b>57,600円<\/b><\/td>/.test(re.replace(/\s+/g, ''))) fail('区分エの多数回該当が57,600円のまま（44,400円に潰れていない）');
    else ok('多数回該当: 区分ウ(87,430→44,400) / 区分エ(57,600→44,400) が同額に潰れる');
  }
  // ★条文の引用（要件そのもの）。表の額だけ見ていると「12月以内→6月以内」の改ざんが素通しする
  const sec = body.slice(body.indexOf('id="tasuukai"'), body.indexOf('id="taishogai"'));
  if (!strip(sec).includes('当該療養のあった月以前の十二月以内に既に高額療養費が支給されている月数が三月以上ある場合')) {
    fail('多数回該当の節に、施行令42条ただし書の引用（十二月以内・三月以上）が正しく無い');
  } else ok('多数回該当: 要件は「十二月以内に三月以上」＝4回目から（暦年ではない）');
}

// ───────── 4. 世帯合算: 21,000円未満は「まるごと対象外」で合算0円 ─────────
{
  const r = rowBy('<b>合算される額</b>');
  // ★セルを厳密一致で見る。includes('0円') だと「60,000円」が部分文字列として通る（規則4の変種）
  if (!r) fail('世帯合算の表に「合算される額」の行が無い');
  else if (!r.replace(/\s+/g, '').includes('<td><b>0円</b>')) fail(`世帯合算の結論が0円でない: ${strip(r)}`);
  else ok('世帯合算: 20,000円×3件でも合算される額は0円');
  const sec = body.slice(body.indexOf('id="gassan"'), body.indexOf('id="tasuukai"'));
  if (!strip(sec).includes('二万千円')) fail('世帯合算の節に条文の「二万千円」の引用が無い');
  else if (!/21,000円未満の自己負担は[^。]*まるごと合算の対象から外れます/.test(strip(sec).replace(/<[^>]+>/g, ''))) {
    // 「超えた分だけ合算」という誤りとの区別が本文にあるか
    if (!strip(sec).includes('まるごと合算の対象から外れます')) fail('「21,000円未満はまるごと対象外」の断定が節に無い');
    else ok('世帯合算: 「超えた分だけ」ではなく「まるごと対象外」と明記');
  } else ok('世帯合算: 「超えた分だけ」ではなく「まるごと対象外」と明記');
  if (!String(GASSAN_MIN).length || !strip(sec).includes('21,000円')) fail('世帯合算の節に21,000円が無い');
}

// ───────── 5. 条文の号の順番（ウ・ア・イ・エ・オ）— calloutを名指し ─────────
{
  const co = [...body.matchAll(/<div class="callout">[\s\S]*?<\/div>/g)].map(m => m[0]);
  const c = co.find(x => x.includes('次号から第五号までに掲げる者以外の者'));
  if (!c) fail('「1号＝以外の者＝区分ウ」のcalloutが無い');
  else {
    const t = strip(c);
    if (!t.includes('条文の号の順番はウ・ア・イ・エ・オ')) fail(`号の順番の断定が無い: ${t}`);
    else ok('条文の号の順番 ウ・ア・イ・エ・オ（1号が「以外の者」＝区分ウ）');
  }
  // 政令の号番号そのもの（前提と一致するか）
  for (const [k, v] of Object.entries(SEIREI)) {
    if (v.go !== SEIREI[k].go) fail(`号番号の前提が壊れている: ${k}`);
  }
}

// ───────── 6. 限度額適用認定証: 省令が交付対象を「資格確認書の人」に限る ─────────
{
  const sec = body.slice(body.indexOf('id="ninteisho"'), body.indexOf('id="gassan"'));
  const t = strip(sec);
  const need = ['健康保険法施行規則129条の2第2項', '資格確認書の交付又は提供を受けているものに限る'];
  const miss = need.filter(n => !t.includes(n));
  if (miss.length) fail(`認定証の節に ${miss} が無い`);
  else ok('認定証: 施行規則129条の2第2項が交付対象を「資格確認書の交付を受けているものに限る」と限定');
  if (!t.includes('申請する対象から外れている')) fail('「申請しなくてよい」ではなく「対象から外れている」の断定が無い');
  else ok('認定証: マイナ保険証の人は「申請対象ですらない」と明記');
  // 逆側（資格確認書の人は今も事前申請が必要）を落とすと片手落ちになる
  if (!t.includes('マイナ保険証を使っていない人（資格確認書の人）は、今も事前申請が必要')) fail('資格確認書の人は事前申請が必要、の但し書きが無い');
  else ok('認定証: 資格確認書の人は今も事前申請が必要（両側を書いている）');
}

// ───────── 7. 令和8年8月1日改正で限度額は変わらない（未施行リビジョンの確認） ─────────
{
  const sec = body.slice(body.indexOf('id="kaisei"'), body.indexOf('id="faq"'));
  const t = strip(sec);
  const need = ['令和8年8月1日', '令和8年政令第219号', '1円も変わりません', '公的年金等控除の読替額'];
  const miss = need.filter(n => !t.includes(n));
  if (miss.length) fail(`改正の節に ${miss} が無い`);
  else ok('改正: 令和8年政令第219号（8/1施行）でも限度額は不変・変わるのは70歳以上の所得計算');
}

// ───────── 8. 端数規則（施行令42条が明記）— 節を名指し ─────────
{
  const sec = body.slice(body.indexOf('id="keisan"'), body.indexOf('id="ninteisho"'));
  const t = strip(sec);
  if (!t.includes('端数が50銭未満なら切り捨て、50銭以上なら1円に切り上げ')) fail('端数規則（50銭未満切捨/50銭以上切上）が計算の節に無い');
  else ok('端数規則: 50銭未満切捨・50銭以上切上（政令が明記）');
}

// ───────── 9. 対象外（食費・差額ベッド）— 厚労省の明記 ─────────
{
  const sec = body.slice(body.indexOf('id="taishogai"'), body.indexOf('id="kaisei"'));
  const t = strip(sec);
  if (!t.includes('入院時の食費負担や差額ベッド代は、自己負担限度額の対象に含みません')) fail('食費・差額ベッドが対象外である断定が無い');
  else ok('対象外: 入院時の食費・差額ベッド代は限度額の対象に含まれない（厚労省）');
  if (!t.includes('傷病手当金や出産手当金は差し引きません')) fail('医療費控除との接続（傷病/出産手当金は補填金でない）が無い');
  else ok('医療費控除との接続: 高額療養費は差し引く／傷病・出産手当金は差し引かない');
}

// ───────── 10. 網: カンマ金額の集合一致（過不足の両方を落とす） ─────────
{
  // 網の外に出るもの: 等級(第30級)・1円・1%・条文番号 → 上で要素名指し済み
  const found = new Set([...text.matchAll(/(\d{1,3}(?:,\d{3})+)円/g)].map(m => Number(m[1].replace(/,/g, ''))));
  const allow = new Set([
    ...KYOKAI_KENPO,               // 政令の12個
    21000, 20000, 60000, 40000,    // 世帯合算（下限・例の3件・合計・同一病院で2回なら40,000円で対象に入る）
    1000000, 700000, 300000,       // 医療費100万・7割・3割
    87430, 171820, 84390, 212570,  // 崖と払い戻し
    7330,                          // 80,100＋(100万−26.7万)×1% の1%部分
    514999, 515000, 485000, 545000, 500000, 530000, 790000, 830000,  // 等級表の境目
    10000,                         // 差額ベッド代の例（1日1万円）
  ]);
  const extra = [...found].filter(n => !allow.has(n));
  const missing = KYOKAI_KENPO.filter(n => !found.has(n));
  if (extra.length) fail(`本文に想定外のカンマ金額がある（誤記の疑い）: ${extra}`);
  else if (missing.length) fail(`政令の金額が本文から欠けている: ${missing}`);
  else ok(`金額の網: カンマ金額 ${found.size}種すべてが想定内・政令の12個すべてが本文にある`);
}

// ───────── 11. 網: 等級（カンマが無く金額の網に入らない） ─────────
{
  const grades = new Set([...text.matchAll(/第(\d+)級/g)].map(m => Number(m[1])));
  const want = new Set([30, 31, 39, 40]);
  const extra = [...grades].filter(g => !want.has(g));
  const missing = [...want].filter(g => !grades.has(g));
  if (extra.length || missing.length) fail(`等級の網: 余分=${extra} 不足=${missing}`);
  else ok('等級の網: 第30・31・39・40級（崖と80万円台の不在）がすべて本文にある');
  // 等級と標準報酬月額の対応が、本番の等級表と合っているか
  for (const g of want) {
    const row = KENKO_GRADES.find(([n]) => n === g);
    const man = row[1] / 10000;
    if (!text.includes(`第${g}級`)) continue;
    if (!new RegExp(`第${g}級[^。]{0,20}${man}万円`).test(text) && !text.includes(`第${g}級＝${man}万円`) && !text.includes(`第${g}級（標準報酬月額${man}万円）`) && !text.includes(`第${g}級・${man}万円`)) {
      fail(`第${g}級 と 標準報酬月額${man}万円 の対応が本文に無い（本番の等級表と照合）`);
    } else ok(`第${g}級 ＝ 標準報酬月額${man}万円（本番の等級表と一致）`);
  }
}

// ───────── 12. title と meta description（規則9: タグ剥がしで消えるので別に見る） ─────────
{
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (!title.includes('標準報酬月額')) fail(`titleに「標準報酬月額」が無い: ${title}`);
  else if (title.length > 60) fail(`titleが60字超: ${title.length}字`);
  else ok(`title（${title.length}字）: 区分は年収でなく標準報酬月額`);
  for (const n of ['87,430円', '171,820円', '84,390円', '21,000円']) {
    if (!desc.includes(n)) fail(`meta descriptionに ${n} が無い`);
  }
  if (desc.includes('87,430円') && desc.includes('171,820円') && desc.includes('84,390円') && desc.includes('21,000円')) {
    ok('meta description: 崖(87,430→171,820・差84,390)と世帯合算21,000円を明記');
  }
}

console.log(ng ? `\n✗ 記事「高額療養費」: ${ng}件の不一致` : '\n✓ 記事「高額療養費」: 政令・省令・本番ツールの等級表と一致');
process.exit(ng ? 1 : 0);
