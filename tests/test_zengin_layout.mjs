/**
 * `/column/zengin-format-guide/` のレコードレイアウト表を守る。
 *
 * ★この記事が扱うのは**法令ではなく業界規定**（全国銀行協会）で、e-Gov のような一次情報APIが無い。
 *   だからこの検査は「条文と合っているか」ではなく、次の3つを見る:
 *     ① 出荷されたHTMLが、出典データ（zengin_format_r08.json）と1項目もずれていないこと
 *     ② **各レコードの桁数合計が120であること**（＝位置が導出可能で、静かにずれていないこと）
 *     ③ **出典・確認日・銀行差の但し書きがページ上に実在すること**
 *
 *   ③を検査に入れているのは、この表が「全銀共通の唯一の正解」に見えてしまうと危険だから。
 *   出典と但し書きは装飾ではなく、この表が成立するための前提条件そのもの。
 *   （銀行ごとに必須/省略可・改行・固定値が違うことは、出典PDF自身と記事本文が断っている）
 *
 * 落ちたら: node tools/gen_zengin_layout.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { withPositions, ARTICLE, DATA } from '../tools/gen_zengin_layout.mjs';

const html = readFileSync(ARTICLE, 'utf-8');
const D = JSON.parse(readFileSync(DATA, 'utf8'));
const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();

// --- 1. 表があり、目次から辿れること ---------------------------------------
const a = html.indexOf('<!-- ZENGIN_LAYOUT:START');
const b = html.indexOf('<!-- ZENGIN_LAYOUT:END -->');
assert.ok(a >= 0 && b > a,
  'レコードレイアウトがありません。node tools/gen_zengin_layout.mjs を実行してください');
const section = html.slice(a, b);
assert.ok(html.includes('href="#layout"'),
  '目次にレコードレイアウト（#layout）へのリンクがありません');

// --- 2. 桁数合計が120であること（fail closed の要）---------------------------
const L = D._meta.record_length;
assert.strictEqual(L, 120, `record_length が ${L}（全銀の総合振込は120バイト）`);
for (const rec of D.records) {
  // withPositions は合計が合わなければ throw する。ここで呼ぶこと自体が検査。
  const fields = withPositions(rec, L);
  const last = fields[fields.length - 1];
  assert.strictEqual(last.to, L,
    `${rec.name} の最終項目が ${last.to} バイト目で終わっています（${L} であるべき）`);
}

// --- 3. 出荷HTMLが出典データと一致すること ------------------------------------
const cells = (tr) => (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g) || []).map(strip);
const allRows = (section.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(cells);
let checked = 0;
for (const rec of D.records) {
  const h3 = section.indexOf(`id="layout-${rec.kubun}"`);
  assert.ok(h3 >= 0, `${rec.name}（データ区分${rec.kubun}）の見出しがありません`);
  const nextH3 = section.indexOf('<h3 ', h3);
  const block = section.slice(h3, nextH3 < 0 ? undefined : nextH3);
  const rows = (block.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(cells);

  for (const f of withPositions(rec, L)) {
    const row = rows.find((c) => c.length >= 6 && c[0] === String(f.no) && c[1] === f.name);
    assert.ok(row, `${rec.name} の項番${f.no}「${f.name}」の行がHTMLにありません`);
    const pos = f.from === f.to ? `${f.from}` : `${f.from}〜${f.to}`;
    assert.strictEqual(row[2], pos,
      `${rec.name} 項番${f.no}「${f.name}」の位置が HTML「${row[2]}」/ 導出「${pos}」で食い違っています`);
    assert.strictEqual(row[3], `${f.type}(${f.len})`,
      `${rec.name} 項番${f.no}「${f.name}」の桁数・型が HTML「${row[3]}」/ データ「${f.type}(${f.len})」で食い違っています`);
    assert.strictEqual(row[4], f.scope === 'bank' ? '要確認' : '共通',
      `${rec.name} 項番${f.no}「${f.name}」の区分が食い違っています`);
    checked++;
  }
}
const total = D.records.reduce((s, r) => s + r.fields.length, 0);
assert.strictEqual(checked, total, `照合できたのは ${checked}/${total} 項目です`);

// --- 4. 出典・確認日・但し書きがページ上に実在すること ------------------------
// ★これが無いと、この表は「全銀共通の唯一の正解」に見えてしまう。装飾ではなく前提条件。
for (const [what, needle] of [
  ['出典の銀行名', D._meta.source_name],
  ['出典PDFのURL', D._meta.source_url],
  ['確認日', D._meta.verified_at],
  ['銀行差の但し書き', '銀行ごとに差があります'],
  ['取引銀行の仕様を優先する旨', '取引銀行の最新の仕様書を優先'],
]) {
  assert.ok(section.includes(needle),
    `レコードレイアウトに${what}がありません（「${needle}」が見つからない）。` +
    'この表は出典と但し書きがあって初めて成立する。省いてはいけない');
}

// --- 5. 「共通」と「要確認」が両方あること -------------------------------------
// 全部を「共通」にすると銀行差を隠すことになり、全部を「要確認」にすると情報価値が消える。
const scopes = allRows.filter((c) => c.length >= 6).map((c) => c[4]);
assert.ok(scopes.includes('共通') && scopes.includes('要確認'),
  '区分列に「共通」と「要確認」の両方が必要です（銀行差を隠さない／全部を要確認にしない）');

console.log(`✓ test_zengin_layout: ${D.records.length}レコード / ${checked}項目が出典データと一致・各120バイト・出典と但し書きあり`);
