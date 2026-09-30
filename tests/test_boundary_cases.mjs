// test_boundary_cases.mjs — 計算機ごとに「境目の値」で一次資料の正解と照らす（誤りの型 D の予防。2026-09-28）。
// ★なぜ: 記事レビューで重さ（high）が一番多かったのは計算機の誤り（D 型・high 34件）。
//   70歳の厚生年金、17歳の住民税、月8.8万円×12 の境界など、**境目の1つ上と1つ下**で誤答していた。
//   正常な条件のE2E（e2e.mjs）は通るので、境目は誰も踏まない。gbrain keiri-tools/article-error-patterns の D。
// 規則:
//   1. docs/assets/*_core.js は、tests/boundaries/<名前>.mjs（境界値ケース）か、_status.json の
//      not_applicable（理由つき）か、pending_since_2026_09_28（2026-09-28 時点の既存分。減らすだけ）のどれかに必ず入る
//   2. ケースは { name, run, expected, source, quote }。source は一次資料、quote はその逐語（core の出力をなぞって書かない）
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("./boundaries/", import.meta.url);
const status = JSON.parse(readFileSync(new URL("_status.json", dir)));
const cores = readdirSync(new URL("../docs/assets/", import.meta.url)).filter((f) => f.endsWith("_core.js")).map((f) => f.slice(0, -3));
const files = new Set(readdirSync(dir).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)));
const pending = new Set(status.pending_since_2026_09_28);
const na = status.not_applicable ?? {};

const errors = [];
for (const c of cores) {
  if (files.has(c)) { if (pending.has(c)) errors.push(`${c}: 境界表ができたので _status.json の pending から外す`); continue; }
  if (na[c]) { if (!String(na[c]).trim()) errors.push(`${c}: not_applicable の理由が空`); continue; }
  if (!pending.has(c)) errors.push(`${c}: 境界値ケースがありません。tests/boundaries/${c}.mjs を作る（年齢・金額・日付の境目の1つ上と1つ下を、一次資料の正解で）`);
}
for (const p of pending) if (!cores.includes(p)) errors.push(`${p}: pending にあるが core が存在しない（一覧から外す）`);

// SMBC公式の法人略語表も振込名義の位置規則の一次資料（r14/t8-b）。
let n = 0;
for (const c of [...files].sort()) {
  const { cases } = await import(new URL(`${c}.mjs`, dir));
  assert.ok(Array.isArray(cases) && cases.length >= 2, `${c}: ケースが2件未満`);
  for (const k of cases) {
    // 一次資料: 官公庁・協会けんぽ・全銀協等と、銀行自身が公表する手数料・操作の公式ページ（r14: auじぶん・三井住友）。
    if (!k.source || !/^https:\/\/([a-z0-9-]+\.)*(go\.jp|lg\.jp|kyoukaikenpo\.or\.jp|zenginkyo\.or\.jp|kenpo\.or\.jp|smbc\.co\.jp|jibunbank\.co\.jp)\//.test(k.source)) errors.push(`${c} / ${k.name}: source が一次資料でない: ${k.source}`);
    if (!k.quote || k.quote.length < 6) errors.push(`${c} / ${k.name}: quote（一次資料の逐語）が無い`);
    let got; try { got = k.run(); } catch (e) { errors.push(`${c} / ${k.name}: 例外 ${e.message}`); continue; }
    try { assert.deepEqual(got, k.expected); n++; } catch { errors.push(`${c} / ${k.name}: 期待 ${JSON.stringify(k.expected)} ／ 実際 ${JSON.stringify(got)}（${k.source}）`); }
  }
}
if (errors.length) { console.error(errors.map((e) => "✗ " + e).join("\n")); process.exit(1); }
console.log(`✓ test_boundary_cases: 境界値 ${n}ケース緑（${files.size} core）／ 未作成 ${pending.size} core（減らすだけ）／ 対象外 ${Object.keys(na).length}`);
