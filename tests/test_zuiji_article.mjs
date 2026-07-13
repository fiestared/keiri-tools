/**
 * 随時改定の記事（column/zuiji-kaitei/）の数字を、商品側の shaho_core.js に計算させて照合する。
 *
 * 「本文のどこかにその数字がある」で見ない（第19/23便の再発防止）。
 * 記事に現れるカンマ区切りの数はすべて、
 *   前提として置いた数 ∪ shaho_core から計算で導けた数
 * と一致しなければならない（過不足の両方を落とす）。
 * これなら本文・図解・表・FAQ のどこで手打ちを誤っても落ちる。
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as C from '../docs/assets/shaho_core.js';

const RATES = JSON.parse(fs.readFileSync(new URL('../docs/assets/shaho_rates_r08.json', import.meta.url), 'utf8'));
const HTML = fs.readFileSync(new URL('../docs/column/zuiji-kaitei/index.html', import.meta.url), 'utf8');

// ---- 記事が置いている前提（これ自体は記事の主張ではなく、入力） ----
const PREF = '東京都';
const AGE = 35;              // 介護保険第2号に該当しない
const BEFORE = 300000;       // 従前の報酬月額
const AFTER = 350000;        // 昇給後3か月の平均
const NOT_ELIGIBLE = 320000; // 1等級差にとどまり改定されない反例

const kenkoRate = RATES.kenko_rates[PREF];
assert.ok(kenkoRate, `${PREF} の健保料率が rates JSON にない`);

// ---- shaho_core に計算させる（記事の数字を手打ちで持ち込まない） ----
const calc = (m) => C.calcMonthly(m, kenkoRate, RATES.kaigo_rate, AGE,
                                  RATES.kosei_nenkin_rate, RATES.kosodate_rate);
const a = calc(BEFORE);
const b = calc(AFTER);
const c = calc(NOT_ELIGIBLE);

const diffMonth = b.selfTotal - a.selfTotal;
const diffYear = diffMonth * 12;

// 記事の骨子（等級差）が本当に成り立つか＝記事の主張そのものを検算する
assert.equal(b.grade - a.grade, 3, '30万→35万は3等級差のはず（2等級以上＝随時改定に該当）');
assert.equal(c.grade - a.grade, 1, '30万→32万は1等級差のはず（改定されない反例）');
assert.ok(!C.kaigoApplies(AGE), '35歳は介護保険第2号に該当しないはず');

// ---- 記事に現れるカンマ区切りの数を集める ----
// タグを落として「利用者に見えるテキスト」だけにする。属性値（SVGのpoints="376,112 …" など）は
// 座標であって金額ではないので、タグごと消えて対象から外れる。
// SVG図解の <text> の中身は残るので、図解の数字の食い違いはここで落ちる。
const visible = HTML
  .replace(/<script[\s\S]*?<\/script>/g, '')   // JSON-LD は本文から生成されるので二重に見ない
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ');
const found = new Set((visible.match(/\d{1,3}(?:,\d{3})+/g) || []));

// ---- 期待する集合 ----
const derived = [
  a.standard, b.standard,          // 標準報酬月額 300,000 / 360,000
  a.selfTotal, b.selfTotal,        // 本人負担 42,570 / 51,084
  diffMonth, diffYear,             // 差 8,514 / 102,168
  c.standard,                      // 反例 320,000
].map(n => n.toLocaleString('ja-JP'));

const premise = [
  BEFORE, AFTER,                   // 前提として置いた報酬月額
].map(n => n.toLocaleString('ja-JP'));

// 日本年金機構「随時改定（月額変更届）」の1等級差の例（健保の上限。千円単位で引用）
const quoted = ['1,390'];

const expected = new Set([...derived, ...premise, ...quoted]);

const missing = [...expected].filter(n => !found.has(n));
const extra = [...found].filter(n => !expected.has(n));

if (missing.length || extra.length) {
  console.error('記事のカンマ区切りの数が、導出した集合と一致しません');
  if (missing.length) console.error('  記事に無い（導出できたのに書かれていない）:', missing);
  if (extra.length) console.error('  記事にしか無い（導出できない＝手打ちの疑い）:', extra);
  console.error('  導出:', derived, '前提:', premise, '引用:', quoted);
  process.exit(1);
}

// カバレッジを自己申告させる（第18便: 検査が対象の一部しか見ていない状態を落とす）
assert.ok(found.size >= 8, `照合したカンマ区切りの数が少なすぎる（${found.size}件）。抽出が壊れている疑い`);

// ---- 等級は「カンマ区切りの数」ではないので、上の集合一致では見えない ----
// （実際、25等級→26等級 に壊しても緑のままだった。両方向確認で発覚。第24便）
// 等級は「2等級以上」など記事中に何度も出るため集合一致にできない。→ 載っている要素を名指しする。
const gradeRow = HTML.match(/<tr><td>標準報酬月額<\/td>([\s\S]*?)<\/tr>/);
assert.ok(gradeRow, '具体例の「標準報酬月額」の行が見つからない');
for (const [amount, grade, label] of [[a.standard, a.grade, '従前'], [b.standard, b.grade, '改定後']]) {
  const cell = `${amount.toLocaleString('ja-JP')}円（<b>${grade}等級</b>）`;
  assert.ok(gradeRow[1].includes(cell),
    `具体例の表の${label}のセルが core と合わない。期待: ${cell}`);
}

// 反例（1等級差にとどまり改定されない）の callout も名指しで見る
const ctr = HTML.match(/<div class="callout">\s*<b>昇給しても、1等級しか動かなければ改定されない<\/b>([\s\S]*?)<\/div>/);
assert.ok(ctr, '1等級差の反例の callout が見つからない');
assert.ok(ctr[1].includes(`${c.standard.toLocaleString('ja-JP')}円（${c.grade}等級）`),
  `反例の標準報酬月額・等級が core と合わない（期待 ${c.standard.toLocaleString('ja-JP')}円（${c.grade}等級））`);
assert.ok(ctr[1].includes(`従前の${a.grade}等級`), `反例の「従前の${a.grade}等級」が core と合わない`);

// 「等級の差は3等級」という断定も core から導く
assert.ok(HTML.includes(`等級の差は<b>${b.grade - a.grade}等級</b>`),
  `本文の等級差の断定が core と合わない（期待 ${b.grade - a.grade}等級）`);
// 本人負担の増加も、載っている文を名指しで
assert.ok(HTML.includes(`<b>月${diffMonth.toLocaleString('ja-JP')}円・年${diffYear.toLocaleString('ja-JP')}円</b>`),
  '本人負担の増加額の文が core と合わない');

// ---- 条文の引用は「その主張が載っている要素」を名指しして見る（第19便） ----
// 記事の背骨は「条文に2等級・固定的賃金は書かれていない」。引用が改変されたら落とす。
const calloutRe = /<div class="callout">\s*<b>健康保険法 第43条第1項（改定）<\/b>([\s\S]*?)<\/div>/;
const m = HTML.match(calloutRe);
assert.ok(m, '健保法43条1項の引用callout が見つからない（記事の背骨）');
const quote = m[1];
for (const phrase of ['著しく高低を生じた場合', '必要があると認めるとき', '十七日以上でなければならない',
                      '改定することができる']) {
  assert.ok(quote.includes(phrase), `43条1項の引用から「${phrase}」が失われている`);
}
// 条文に無いはずの語が引用の中に紛れ込んでいないか（引用の捏造を落とす）
for (const forbidden of ['二等級', '2等級', '固定的賃金']) {
  assert.ok(!quote.includes(forbidden),
    `43条1項の引用に「${forbidden}」が入っている。条文にこの語は無い（記事の主張と矛盾する）`);
}

console.log(`✓ test_zuiji_article: カンマ区切りの数 ${found.size}件が導出と一致 ` +
            `(30万→35万: ${a.grade}→${b.grade}等級・本人負担 ${a.selfTotal.toLocaleString('ja-JP')}→` +
            `${b.selfTotal.toLocaleString('ja-JP')}円・年${diffYear.toLocaleString('ja-JP')}円増) / 43条1項の引用も一致`);
