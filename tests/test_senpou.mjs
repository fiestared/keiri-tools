import assert from "node:assert";
import { calcMae, calcGo, calcFlat, explainShortfall, COMMON_FEES } from "../docs/assets/senpou_core.js";

const FEE = { under30k: 220, over30k: 440 }; // テスト用の代表値

// 差引前基準
let r = calcMae(100000, FEE);
assert.equal(r.fee, 440);
assert.equal(r.transfer, 99560);
r = calcMae(25000, FEE);
assert.equal(r.fee, 220);
assert.equal(r.transfer, 24780);
// 差引前基準: 請求3万ちょうどは「3万円以上」区分
r = calcMae(30000, FEE);
assert.equal(r.fee, 440);

// 差引後基準: 通常帯
r = calcGo(100000, FEE);
assert.equal(r.candidates.length, 1);
assert.deepEqual(r.candidates[0], { fee: 440, transfer: 99560 });
r = calcGo(25000, FEE);
assert.deepEqual(r.candidates[0], { fee: 220, transfer: 24780 });

// 差引後基準: 境界の二重解帯 (30000 <= invoice < 30000+440 かつ invoice-220 < 30000)
r = calcGo(30100, FEE);
// tOver = 29660 (<30000 なので不成立), tUnder = 29880 (<30000 成立)
assert.equal(r.candidates.length, 1);
assert.deepEqual(r.candidates[0], { fee: 220, transfer: 29880 });

// 二重解: invoice=30300 -> tOver=29860(不成立), tUnder=30080(>=30000で不成立) -> 不定帯
r = calcGo(30300, FEE);
assert.equal(r.notes.length, 1);
assert.equal(r.candidates[0].fee, 440); // 無難側の提案

// 両立するケース: invoice=30500 -> tOver=30060(成立), tUnder=30280(>=30000 不成立)
r = calcGo(30500, FEE);
assert.equal(r.candidates.length, 1);
assert.deepEqual(r.candidates[0], { fee: 440, transfer: 30060 });

// 真の二重解ケース: fee差が大きいテーブルで確認
const FEE2 = { under30k: 110, over30k: 880 };
// invoice=30500: tOver=29620<30000不成立 / tUnder=30390>=30000不成立 -> 不定
r = calcGo(30500, FEE2);
assert.ok(r.notes.length >= 1);
// invoice=30100: tOver=29220不成立 / tUnder=29990<30000成立
r = calcGo(30100, FEE2);
assert.deepEqual(r.candidates[0], { fee: 110, transfer: 29990 });

// 一律差引
r = calcFlat(50000, 550);
assert.equal(r.transfer, 49450);

// 入金差額判定
let e = explainShortfall(110000, 109560, COMMON_FEES);
assert.equal(e.verdict, "likely_fee");
assert.deepEqual(e.hits, [440]);
e = explainShortfall(110000, 110000, COMMON_FEES);
assert.equal(e.verdict, "match");
e = explainShortfall(110000, 110500, COMMON_FEES);
assert.equal(e.verdict, "overpaid");
e = explainShortfall(110000, 108000, COMMON_FEES);
assert.equal(e.verdict, "unknown");

console.log("all senpou_core tests passed");
