import assert from "node:assert";
import { readFileSync } from "node:fs";

// 記事「銀行別 振込手数料 一覧」の表は fee_table.json から生成した。
// 手数料を改定したとき、記事の数字だけが取り残される(=読者に古い額を見せる)のを防ぐ。
// 記事の一覧は「ツールのプリセットと同じ数字である」ことがこのページの売りなので、ここは崩せない。

const FEES = JSON.parse(readFileSync(new URL("../docs/assets/fee_table.json", import.meta.url)));
const HTML = readFileSync(new URL("../docs/column/furikomi-tesuryo-hikaku/index.html", import.meta.url), "utf8");

// 表から <tr><td>銀行名</td><td>N円</td><td>M円</td>... を拾う
const rows = new Map();
for (const m of HTML.matchAll(/<tr><td>([^<]+)<\/td><td>(\d+)円<\/td><td>(\d+)円<\/td>/g)) {
  rows.set(m[1], { under30k: Number(m[2]), over30k: Number(m[3]) });
}

// 1. 掲載漏れ・数字ズレが無いこと
for (const bank of FEES.banks) {
  const row = rows.get(bank.name);
  assert.ok(row, `記事に未掲載の銀行: ${bank.name}`);
  assert.equal(row.under30k, bank.under30k, `${bank.name} の3万円未満が不一致`);
  assert.equal(row.over30k, bank.over30k, `${bank.name} の3万円以上が不一致`);
}

// 2. fee_table.json に無い銀行を記事が載せていないこと(出典の無い数字を書かない)
const known = new Set(FEES.banks.map((b) => b.name));
for (const name of rows.keys()) {
  assert.ok(known.has(name), `fee_table.json に無い銀行が記事にある: ${name}`);
}
assert.equal(rows.size, FEES.banks.length, "記事の行数と fee_table.json の件数が違う");

// 3. リード・まとめに書いた「結論の数字」がデータと合っていること
//    (表だけ直して本文の断定が古いまま、という壊れ方を防ぐ)
const corp = FEES.banks.filter((b) => b.name.includes("法人"));
const pers = FEES.banks.filter((b) => !b.name.includes("法人"));
const cMin = Math.min(...corp.map((b) => b.over30k));
const cMax = Math.max(...corp.map((b) => b.over30k));
const pMin = Math.min(...pers.map((b) => b.over30k));
const pMax = Math.max(...pers.map((b) => b.over30k));
const step = FEES.banks.filter((b) => b.under30k !== b.over30k).length;

assert.ok(HTML.includes(`${cMin}円〜${cMax}円`), `法人のレンジ ${cMin}円〜${cMax}円 が本文に無い`);
assert.ok(HTML.includes(`${pMin}円〜${pMax}円`), `個人のレンジ ${pMin}円〜${pMax}円 が本文に無い`);
assert.equal(cMax / cMin >= 5 && cMax / cMin < 5.2, true, "法人の倍率が5.1倍から外れた(本文の記述を要更新)");
assert.ok(HTML.includes(`${FEES.banks.length}区分`), "本文の区分数が件数と不一致");
assert.ok(HTML.includes(`${step}区分だけ`) || HTML.includes(`中${step}区分`), `3万円境界の件数(${step})が本文と不一致`);

// 年120件の差額試算(本文の 63,600円)
const annual = (cMax - cMin) * 120;
assert.ok(
  HTML.includes(annual.toLocaleString("en-US")),
  `年120件の差額 ${annual.toLocaleString("en-US")}円 が本文に無い`,
);

console.log(`all fee article tests passed (${rows.size} banks, ${step} with 30k step)`);
