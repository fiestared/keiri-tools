/**
 * `/column/yukyu-kaitori/` の「月給別の買取単価 早見表（3方式）」を守る。
 *
 * ★この表は他の早見表と性質が違う。計算コアが無く、**労基法39条9項の3方式を
 *   生成器の中で実装している**。だから検査の要は次の2つ:
 *     ① 記事に前からある手書きの設例（月給30万円）を、生成器が**そのまま再現できること**
 *        ＝ 生成器の実装が、人が一次情報から書いた数字と一致する外部オラクル
 *     ② 前提（暦日数91日・所定労働日数20日・標準報酬月額＝月給の概算）が
 *        **ページ上に明記されていること**
 *
 *   ②を検査に入れているのは、①②の方式が前提に強く依存するから。
 *   前提を書かずに「買取価格の早見表」を出すと、正確そうに見えて誰にも当たらない表になる。
 *   （平均賃金は退職月で暦日数が89〜92日と動き、通常の賃金は会社の所定日数で割る）
 *
 * 落ちたら: node tools/gen_kaitori_table.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { WAGES, rowFor, fmtSen, TOTAL_DAYS, WORK_DAYS, ARTICLE } from '../tools/gen_kaitori_table.mjs';

const html = readFileSync(ARTICLE, 'utf-8');
const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
const num = (s) => Number(String(s).replace(/[^0-9]/g, ''));

// --- 1. 表があり、目次から辿れること ---------------------------------------
const a = html.indexOf('<!-- KAITORI_TABLE:START');
const b = html.indexOf('<!-- KAITORI_TABLE:END -->');
assert.ok(a >= 0 && b > a,
  '買取単価の早見表がありません。node tools/gen_kaitori_table.mjs を実行してください');
const section = html.slice(a, b);
// ★HTML全体で見ると、記事のどこか(リード等)に同じアンカーへの導線を1行足しただけで
//   **目次から外しても緑**になる(2026-08-13 に furikomi で実際に起きた)。名指しを目次まで下ろす。
const toc = html.slice(html.indexOf('<nav class="toc">'), html.indexOf('</nav>', html.indexOf('<nav class="toc">')));
assert.ok(toc, '目次(nav.toc)が見つかりません');
assert.ok(toc.includes('href="#hayamihyo"'),
  '目次に早見表（#hayamihyo）へのリンクがありません');

// --- 2. ★外部オラクル: 記事に前からある手書きの設例を再現できること ------------
// 記事の「実数で見る（月給30万円・月の所定労働日数20日・残20日の場合）」の表:
//   ① 平均賃金 9,890円10銭 / ③ 標準報酬日額 10,000円 / ② 通常の賃金 15,000円
// これは人が労基法12条・39条9項から書いた数字。生成器がここを再現できなければ、
// 生成器の式が間違っている（他の行も全部間違っている）。
const e = rowFor(300000);
assert.strictEqual(fmtSen(e.heikin), '9,890円10銭',
  `① 平均賃金の設例が再現できません: ${fmtSen(e.heikin)}（記事の手書きは 9,890円10銭）`);
assert.strictEqual(Math.round(e.hyojun), 10000,
  `③ 標準報酬日額の設例が再現できません: ${e.hyojun}（記事の手書きは 10,000円）`);
assert.strictEqual(Math.round(e.tsujo), 15000,
  `② 通常の賃金の設例が再現できません: ${e.tsujo}（記事の手書きは 15,000円）`);
// 記事側にその手書きの数字が今も載っていること（記事だけ書き換わったら落とす）
const beforeTable = html.slice(0, a);
for (const needle of ['9,890円10銭', '15,000円']) {
  assert.ok(beforeTable.includes(needle),
    `記事の設例から「${needle}」が消えています。早見表と設例のどちらかだけが直された疑い`);
}

// --- 3. 全行が生成器の計算と一致すること ---------------------------------------
const cells = (tr) => (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(strip);
const rows = (section.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(cells).filter((c) => c.length === 4);
assert.strictEqual(rows.length, WAGES.length, `早見表の行数が ${rows.length}（想定は ${WAGES.length}）`);

for (const wage of WAGES) {
  const want = rowFor(wage);
  const got = rows.find((c) => num(c[0]) === wage);
  assert.ok(got, `月給${wage.toLocaleString('ja-JP')}円の行がありません`);
  assert.strictEqual(got[1], fmtSen(want.heikin),
    `月給${wage}円の①平均賃金が 記事「${got[1]}」/ 生成「${fmtSen(want.heikin)}」で食い違っています`);
  assert.strictEqual(num(got[2]), Math.round(want.hyojun),
    `月給${wage}円の③標準報酬日額が 記事${num(got[2])} / 生成${Math.round(want.hyojun)} で食い違っています`);
  assert.strictEqual(num(got[3]), Math.round(want.tsujo),
    `月給${wage}円の②通常の賃金が 記事${num(got[3])} / 生成${Math.round(want.tsujo)} で食い違っています`);
  // 3方式の大小関係（②通常 > ③標準報酬 > ①平均）が崩れたら、列の取り違えの疑い
  assert.ok(want.tsujo > want.heikin,
    `月給${wage}円で ②通常の賃金 が ①平均賃金 を上回っていません（列の取り違えの疑い）`);
}

// --- 4. ★前提がページ上に明記されていること -----------------------------------
// この表は前提が変われば金額が変わる。前提の記載は装飾ではなく表の成立条件。
for (const [what, needle] of [
  ['暦日数の前提', `直前3か月の暦日数を${TOTAL_DAYS}日`],
  ['所定労働日数の前提', `月の所定労働日数を${WORK_DAYS}日`],
  ['前提が変われば金額も変わる旨', 'この表の前提が変われば金額も変わります'],
  ['標準報酬月額が概算である旨', '標準報酬月額＝月給'],
  ['買取に義務が無い旨', '会社に買取の義務はありません'],
]) {
  assert.ok(section.includes(needle),
    `早見表に${what}の記載がありません（「${needle}」が見つからない）。` +
    'この表は前提の明示があって初めて成立する');
}

console.log(`✓ test_kaitori_hayamihyo: ${WAGES.length}行 / 記事の手書き設例(月給30万)を3方式とも再現 / 前提の明示あり`);
