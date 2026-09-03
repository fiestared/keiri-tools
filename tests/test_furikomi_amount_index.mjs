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

const html = readFileSync(ARTICLE, 'utf-8');

// --- 1. ブロックが存在すること ---------------------------------------------
const start = html.indexOf(AMT_START);
const end = html.indexOf(AMT_END);
assert.ok(start >= 0 && end > start,
  '逆引き表が記事にありません。node tools/gen_bank_sections.mjs を実行してください');
const block = html.slice(start, end);

// --- 2. 正本の金額が、過不足なく行になっていること --------------------------
// ★「在ること」だけでは足りない。**表にしか無い金額**＝改定で消えたのに残った行を落とす。
const want = amountMap(loadBanks());
const rowRe = /<tr><td><b>(\d+)円<\/b><\/td><td>(.*?)<\/td><\/tr>/g;
const got = new Map();
for (const m of block.matchAll(rowRe)) got.set(Number(m[1]), m[2]);

assert.deepStrictEqual([...got.keys()].sort((a, b) => a - b), [...want.keys()],
  `逆引き表の金額が正本(fee_table.json)と一致しません。\n  表: ${[...got.keys()]}\n  正本: ${[...want.keys()]}`);

// --- 3. 各金額の中身（銀行名と区分）が正本どおりであること -------------------
// ★規則3の「要素を名指し」: 記事のどこかに銀行名が在る、では素通しする。
//   **その金額の行のセル**に、その区分が載っていることを見る。
for (const [amount, list] of want) {
  const cell = got.get(amount);
  for (const { name, range } of list) {
    assert.ok(cell.includes(`${name}（${range}）`),
      `${amount}円 の行に「${name}（${range}）」がありません。実際: ${cell}`);
  }
  const n = (cell.match(/（(金額不問|3万円未満|3万円以上)）/g) || []).length;
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
