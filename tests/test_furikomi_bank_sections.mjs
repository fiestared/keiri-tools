/**
 * `/column/furikomi-tesuryo-hikaku/` の「銀行別」セクションが、
 * **同じ記事の比較表と1円もずれていない**ことを機械で守る。
 *
 * ★なぜ要るのか:
 *   この記事の価値は「各行の公式ページを実測した28区分」で、**比較表が唯一の正本**。
 *   銀行別セクションはそこから生成しているが、生成物は本文に埋め込まれるので
 *   **人が手で直せてしまう**（直したくなる。読みながら気づくから）。
 *   片方だけ直ると、同じページの上と下で違う金額を出す記事になる。それは資産の毀損。
 *
 *   だから「生成した」ことを信用せず、**出荷されたHTMLを読み直して**照合する。
 *   料金改定で表を直したら、このテストが落ちて再生成を促す（＝落ちるのが正しい動作）。
 *
 * 落ちたら: node tools/gen_bank_sections.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { parseTables, baseName, bankId, ARTICLE } from '../tools/gen_bank_sections.mjs';

const html = readFileSync(ARTICLE, 'utf-8');
const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();

// --- 1. セクションが存在すること -------------------------------------------
const start = html.indexOf('<!-- BANK_SECTIONS:START');
const end = html.indexOf('<!-- BANK_SECTIONS:END -->');
assert.ok(start >= 0 && end > start,
  '銀行別セクションが記事にありません。node tools/gen_bank_sections.mjs を実行してください');
const section = html.slice(start, end);

// --- 2. 表の全28区分が、銀行別セクションに同じ金額で現れること ---------------
const rows = parseTables(html);
assert.strictEqual(rows.length, 28, '比較表が28区分ではありません');

const banks = new Map();
for (const r of rows) {
  const b = baseName(r.name);
  if (!banks.has(b)) banks.set(b, []);
  banks.get(b).push(r);
}

let checked = 0;
for (const [base, list] of banks) {
  const id = bankId(base);
  const h3 = section.indexOf(`id="${id}"`);
  assert.ok(h3 >= 0, `銀行「${base}」の見出し（id="${id}"）が銀行別セクションにありません`);

  // この銀行の h3 から次の h3（か末尾）までを、その銀行のブロックとする
  const nextH3 = section.indexOf('<h3 ', h3);
  const block = section.slice(h3, nextH3 < 0 ? undefined : nextH3);

  for (const r of list) {
    const tr = (block.match(/<tr>[\s\S]*?<\/tr>/g) || [])
      .map((t) => (t.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(strip))
      .find((c) => c[0] === r.name);
    assert.ok(tr, `「${r.name}」の行が ${base} のブロックにありません`);
    assert.strictEqual(tr[1], r.under, `${r.name} の3万円未満が表(${r.under})と銀行別(${tr[1]})で食い違っています`);
    assert.strictEqual(tr[2], r.over, `${r.name} の3万円以上が表(${r.over})と銀行別(${tr[2]})で食い違っています`);
    checked++;
  }
}
assert.strictEqual(checked, 28, `照合できたのは ${checked}/28 区分です`);

// --- 3. 銀行別セクションに、表に無い金額が紛れていないこと -------------------
// 「1.7倍」等の比率や年額は本文にもあるので、円の金額だけを見る。
const known = new Set(rows.flatMap((r) => [r.under, r.over]));
for (const m of section.matchAll(/(\d{2,6})円/g)) {
  const yen = `${m[1]}円`;
  assert.ok(known.has(yen),
    `銀行別セクションに、比較表のどこにも無い金額「${yen}」があります（手書きが混ざった疑い）`);
}

// --- 4. 目次から辿れること（孤児の見出しを作らない） -------------------------
assert.ok(html.includes('href="#ginkobetsu"'),
  '目次に銀行別セクション（#ginkobetsu）へのリンクがありません');

console.log(`✓ test_furikomi_bank_sections: ${banks.size}銀行 / ${checked}区分が比較表と一致`);
