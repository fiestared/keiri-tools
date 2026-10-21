import {contentHTML} from './layout/content-html.mjs';
/**
 * `/column/furikomi-tesuryo-hikaku/` の「金額から逆引き」表が、正本(fee_table.json)と
 * **1円もずれていない**ことを、出荷されたHTMLを読み直して照合する。
 *
 * ★なぜ要るのか:
 *   逆引き表は「同じ金額」を銀行別セクションとは**違う並び**でもう一度出す。
 *   つまり同じ数字が記事の中に3箇所（比較表・銀行別・逆引き）になった。
 *   料金改定で1箇所だけ直ると、同じページが自分と矛盾する。それは資産の毀損。
 *   生成したことを信用せず、**出荷物を読み直す**（tests/test_furikomi_bank_sections.mjs と同じ規律）。
 *
 * ★検査は「在ること」だけでなく「余計なものが無いこと」も見る:
 *   正本から消えた金額が表に残るのが、いちばん危ない壊れ方（存在しない銀行を案内する）。
 *
 * 落ちたら: node tools/gen_bank_sections.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { loadBanks, amountMap, ARTICLE, AMT_START, AMT_END } from '../tools/gen_bank_sections.mjs';

const html = contentHTML(readFileSync(ARTICLE, 'utf-8'));

// --- 1. ブロックが存在すること ---------------------------------------------
const start = html.indexOf(AMT_START);
const end = html.indexOf(AMT_END);
assert.ok(start >= 0 && end > start,
  '逆引き表が記事にありません。node tools/gen_bank_sections.mjs を実行してください');
const block = html.slice(start, end);

// --- 2. 正本の金額が、過不足なく行になっていること --------------------------
// ★「在ること」だけでは足りない。**表にしか無い金額**＝改定で消えたのに残った行を落とす。
const want = amountMap(loadBanks());
const rowRe = /<tr><th scope="row"(?: data-review-context="row")?><b>(\d+)円<\/b><\/th><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/g;
const got = new Map();
for (const m of block.matchAll(rowRe)) {
  const amount = Number(m[1]);
  const range = m[2].match(/（(金額不問|3万円未満|3万円以上|金額区分も未確認)）$/);
  assert.ok(range, `${amount}円の行に金額区分がありません`);
  const name = m[2].slice(0, -range[0].length);
  const entry = `${name}${m[3] === '—' ? '' : `【${m[3]}】`}${range[0]}`;
  got.set(amount, [...(got.has(amount) ? got.get(amount).split('<br>') : []), entry].join('<br>'));
}

assert.deepStrictEqual([...got.keys()].sort((a, b) => a - b), [...want.keys()],
  `逆引き表の金額が正本(fee_table.json)と一致しません。\n  表: ${[...got.keys()]}\n  正本: ${[...want.keys()]}`);

// --- 3. 各金額の中身（銀行名と区分）が正本どおりであること -------------------
// ★規則3の「要素を名指し」: 記事のどこかに銀行名が在る、では素通しする。
//   **その金額の行のセル**に、その区分が載っていることを見る。
for (const [amount, list] of want) {
  const cell = got.get(amount);
  for (const { name, range, fullLabel } of list) {
    assert.ok(cell.includes(fullLabel ? name : `${name}（${range}）`),
      `${amount}円 の行に「${name}（${range}）」がありません。実際: ${cell}`);
  }
  const n = (cell.match(/(?:（|、)(金額不問|3万円未満|3万円以上|金額区分も未確認)）/g) || []).length;
  assert.strictEqual(n, list.length,
    `${amount}円 の行の区分数が合いません（表 ${n} / 正本 ${list.length}）。実際: ${cell}`);
}

// --- 4. 目次に載っていること -------------------------------------------------
// ★載せ忘れると、記事の中に読者が辿り着けない節が生える（銀行別セクションで実際に検査した項目）。
const toc = html.slice(html.indexOf('<nav class="toc">'), html.indexOf('</nav>', html.indexOf('<nav class="toc">')));
assert.ok(toc.includes('href="#gyakubiki"'),
  '目次に逆引き表（#gyakubiki）への項目がありません');

// --- 5. 収録範囲の申告が消えていないこと -------------------------------------
// ★これは飾りではなく fail-closed の本体。実測された9金額のうち 995円・395円 はこの表に無く、
//   注意書きが無いと「載っていない＝存在しない」と読ませてしまう。
const note = block.slice(block.indexOf('<p class="note">'), block.indexOf('</p>', block.indexOf('<p class="note">')));
assert.ok(note.includes('他行宛') && note.includes('30区分'),
  '逆引き表の収録範囲の申告（他行宛・30区分だけを扱う旨）が消えています');
assert.ok(note.includes('この表に当てはめず') && note.includes('銀行の料金ページでご確認ください'),
  '未収録の金額を表に当てはめず、公式料金を確認する案内が消えています');

console.log(`✓ 逆引き表 ${got.size}金額 が fee_table.json と一致（目次・収録範囲の申告も確認）`);

// 2026-10-15: 横浜個人IBは公式表の結合セルで3万円以上も154円（金額不問）。
const yokohamaBands = [...want.entries()].flatMap(([amount, entries]) => entries.filter(e => e.name.startsWith('横浜銀行（個人IB）')).map(e => ({amount, range:e.range})));
assert.deepStrictEqual(yokohamaBands, [{amount:154, range:'金額不問'}]);
// 三井住友 Web21＜ライト＞（30区分の外）は 165円・330円の行から引けること（3モデルレビュー #3）
for (const [amount, range] of [[165, '3万円未満'], [330, '3万円以上']]) {
  assert.ok(got.get(amount)?.includes(`三井住友銀行（法人・Web21＜ライト＞）【1日300万円まで。30区分の外】（${range}）`), `${amount}円の行に Web21＜ライト＞がありません`);
}
// 未確認の額は逆引きでも未確認と分かること（3モデルレビュー #7）
assert.ok(got.get(110)?.includes('イオン銀行（個人）【掲載額は公式資料で未確認】（金額区分も未確認）'), '110円の行でイオン個人が未確認と分からない（金額不問と断定しない）');
