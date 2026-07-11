import assert from "node:assert";
import {
  calc, calcFlat, basisAmount, methodsDisagree, explainShortfall, COMMON_FEES,
} from "../docs/assets/senpou_core.js";

const FEE = { under30k: 220, over30k: 440 }; // 代表値(福岡銀行 個人IB と同じ)

// 基準額
assert.equal(basisAmount("sueoki", FEE), 30000);
assert.equal(basisAmount("mikan_kasan", FEE), 30220);
assert.equal(basisAmount("ijo_kasan", FEE), 30440);

// 据置型: 請求10万 -> 440円差引
let r = calc("sueoki", 100000, FEE);
assert.equal(r.fee, 440);
assert.equal(r.transfer, 99560);
// 据置型: 3万ちょうどは「以上」区分
assert.equal(calc("sueoki", 30000, FEE).fee, 440);
assert.equal(calc("sueoki", 29999, FEE).fee, 220);

// 北陸銀行PDFの例: 据置型では請求30,000〜30,439円の帯で差引後が3万円を割る
r = calc("sueoki", 30300, FEE);
assert.equal(r.fee, 440);
assert.equal(r.transfer, 29860); // 3万円未満に落ちる(=据置型の特徴)

// 未満手数料加算型: 基準30,220
assert.equal(calc("mikan_kasan", 30219, FEE).fee, 220);
assert.equal(calc("mikan_kasan", 30220, FEE).fee, 440);

// 以上手数料加算型(差引後基準): 基準30,440
assert.equal(calc("ijo_kasan", 30439, FEE).fee, 220);
assert.equal(calc("ijo_kasan", 30440, FEE).fee, 440);
r = calc("ijo_kasan", 30440, FEE);
assert.equal(r.transfer, 30000); // 差引後がちょうど3万円=区分と整合

// 方式間で結果が分かれる帯の検出
assert.equal(methodsDisagree(100000, FEE), false);
assert.equal(methodsDisagree(25000, FEE), false);
assert.equal(methodsDisagree(30300, FEE), true); // 据置=440, 加算型=220
assert.equal(methodsDisagree(30439, FEE), true); // 以上加算のみ220...据置440
assert.equal(methodsDisagree(30440, FEE), false);

// 金額区分なしの銀行(under==over)ではどの方式でも同額
const FLAT_BANK = { under30k: 165, over30k: 165 };
assert.equal(methodsDisagree(30100, FLAT_BANK), false);
assert.equal(calc("sueoki", 30100, FLAT_BANK).fee, 165);

// 一律差引
r = calcFlat(50000, 550);
assert.equal(r.transfer, 49450);

// 入金差額判定
let e = explainShortfall(110000, 109560);
assert.equal(e.verdict, "likely_fee");
assert.deepEqual(e.hits, [440]);
assert.equal(explainShortfall(110000, 110000).verdict, "match");
assert.equal(explainShortfall(110000, 110500).verdict, "overpaid");
assert.equal(explainShortfall(110000, 108000).verdict, "unknown");
assert.equal(explainShortfall(110000, 109450).verdict, "likely_fee"); // 一律550円

console.log("all senpou_core tests passed");
