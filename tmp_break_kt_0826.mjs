/**
 * 壊しテスト（規則2: 壊す前に「無傷が緑」を確かめる）。
 * 本物のコアを一切書き換えず、**旧実装に戻した写し**を別ファイルに作って当てる。
 */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert";

const SRC = "./docs/assets/kihonteate_core.js";
const D = JSON.parse(readFileSync("./docs/assets/kihonteate_r07.json", "utf8"));
const src = readFileSync(SRC, "utf8");

// --- ① ベースライン: 無傷のコアで、検査したい主張が通ることを確かめる ---
const live = await import("./docs/assets/kihonteate_core.js");
const base = live.calcKihonteate({ age: 0, monthly: 300000, period: "y20", reason: "kaisha" }, D);
assert.strictEqual(base.outOfRange, "age_under", "ベースライン: 無傷なら age_under");
assert.ok(!base.message.includes("65歳以上で離職"), "ベースライン: 無傷なら誤った理由を言わない");
console.log("① ベースライン緑（無傷のコアは正しく分類する）");

// --- ② 旧実装（1本の枝）に戻した写しを作る ---
const start = src.indexOf("  if (age >= 65) {");
const end = src.indexOf("\n\n  const total6m");
assert.ok(start > 0 && end > start, "差し替え範囲を特定できた（外れたら壊し方の側の問題＝規則8）");
const OLD = `  if (!(age >= 15) || age >= 65) {
    return {
      supported: false,
      message:
        "65歳以上で離職した方は、基本手当ではなく「高年齢求職者給付金」（一時金）の対象です（雇用保険法37条の4）。この計算機の対象外です。",
    };
  }`;
const broken = src.slice(0, start) + OLD + src.slice(end);
assert.notStrictEqual(broken, src, "写しは本物と違う（＝壊し方が当たった）");
writeFileSync("./tmp_kt_core_old_0826.mjs", broken);

// --- ③ 旧実装だと、足した主張が全部落ちることを確かめる ---
const old = await import("./tmp_kt_core_old_0826.mjs");
let red = 0;
for (const age of [0, 10, NaN]) {
  const r = old.calcKihonteate({ age, monthly: 300000, period: "y20", reason: "kaisha" }, D);
  if (r.outOfRange !== "age_under") red++;
  if (r.message.includes("65歳以上で離職")) red++;
  if (!r.message.includes("15歳以上65歳未満")) red++;
}
// 通るべきものは旧実装でも通る（＝この壊しは範囲外の分類だけを壊している）
const r64 = old.calcKihonteate({ age: 64, monthly: 300000, period: "y20", reason: "kaisha" }, D);
assert.strictEqual(r64.supported, true, "64歳は旧実装でも対象内（壊し方が広すぎない）");

assert.strictEqual(red, 9, `旧挙動に戻すと 9 件赤になるはず（実測 ${red}）`);
console.log(`③ 旧挙動に戻すと ${red} 件赤。壊しテスト成立。`);
