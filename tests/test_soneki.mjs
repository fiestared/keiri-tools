// 損益分岐点（docs/assets/soneki_core.js）の単体テスト。2026-10-14 新規（/soneki-bunkiten/）。
// ★期待値は一次資料の公表値そのもの（core の出力をなぞって書かない）:
//   J-Net21 Q0240 https://j-net21.smrj.go.jp/solution/qa/accounting/Q0240.html
//   日本政策金融公庫 https://www.jfc.go.jp/n/service/pdf/shindanshi_20220921.pdf
import assert from "node:assert/strict";
import { calcByTotals, calcByUnits, ceilDiv } from "../docs/assets/soneki_core.js";

// ── J-Net21 の例題: 売価1,000円・仕入800円・固定費（店舗20万＋人件費10万）30万円 ──
let r = calcByUnits({ price: 1000, unitVar: 800, fixed: 200000 + 100000 });
assert.equal(r.ok, true);
assert.equal(r.unitMargin, 200);          // 「1,000円-800円＝200円です。この差額を限界利益と言います」
assert.equal(r.bepQty, 1500);             // 「300,000円÷200円＝1,500個」
assert.equal(r.bepSales, 1500000);        // 「1,000円×1,500個＝1,500,000円」
assert.equal(r.marginalRatio, 0.2);       // 図の説明「限界利益率（20％）」
assert.equal(r.bepExact, true);

// 同じ例を総額の方式で: 1,500個売ったときの売上高150万円・変動費120万円・固定費30万円 → 損益分岐点売上高150万円
r = calcByTotals({ sales: 1500000, variable: 1200000, fixed: 300000 });
assert.equal(r.bepSales, 1500000);        // 「＝（1－0,8）分の300,000　＝　1,500,000円」
assert.equal(r.currentProfit, 0);
assert.equal(r.gap, 0);

// 目標利益15万円 → 目標販売数量 (300,000＋150,000)÷200＝2,250個。損益分岐点を750個上回る
r = calcByUnits({ price: 1000, unitVar: 800, fixed: 300000, target: 150000 });
assert.equal(r.targetQty, 2250);          // 「200分の300,000＋150,000　＝　2,250（個）」
assert.equal(r.targetQtyOverBep, 750);    // 「2,250-1,500＝750」
assert.equal(r.targetSales, 2250000);

// J-Net21 の改善策の試算（それぞれ単独で行う）
assert.equal(calcByUnits({ price: 1100, unitVar: 800, fixed: 300000 }).bepQty, 1000);  // a. 販売価格を100円上げる → 1,000個
assert.equal(calcByUnits({ price: 1000, unitVar: 700, fixed: 300000 }).bepQty, 1000);  // b. 変動費を100円下げる → 1,000個
assert.equal(calcByUnits({ price: 1000, unitVar: 800, fixed: 150000 }).bepQty, 750);   // c. 固定費を15万円削減 → 750個
// a・b・c は 1,500個 売ったときに目標利益15万円を達成する（＝販売量1,500個で利益150,000円）
assert.equal(calcByUnits({ price: 1100, unitVar: 800, fixed: 300000, qty: 1500 }).currentProfit, 150000);
assert.equal(calcByUnits({ price: 1000, unitVar: 700, fixed: 300000, qty: 1500 }).currentProfit, 150000);
assert.equal(calcByUnits({ price: 1000, unitVar: 800, fixed: 150000, qty: 1500 }).currentProfit, 150000);

// ── 日本政策金融公庫の例: 売上高120・変動費18＋18＋12＝48・固定費60（万円）→ 損益分岐点100（万円）──
r = calcByTotals({ sales: 1200000, variable: 180000 + 180000 + 120000, fixed: 600000 });
assert.equal(r.bepSales, 1000000);        // 「損益分岐点＝60 ÷（１－（48÷120））＝100」
assert.equal(r.currentProfit, 120000);    // 図の「利益が 10%となっている」売上高120のケース
assert.equal(r.currentProfit / r.sales, 0.1);
assert.equal(r.gap, 200000);
// 安全余裕率＝（売上高－損益分岐点売上高）÷売上高 = (120−100)÷120
assert.ok(Math.abs(r.safetyRatio - 20 / 120) < 1e-12);
assert.ok(Math.abs(r.bepRatio - 100 / 120) < 1e-12);
assert.ok(Math.abs(r.safetyRatio + r.bepRatio - 1) < 1e-12);

// ── 割り切れないときは1円（1個）未満を切り上げる。切り上げた値で利益は0以上、1つ下では赤字 ──
r = calcByUnits({ price: 1000, unitVar: 700, fixed: 100000 });   // 100000/300 = 333.33… → 334個
assert.equal(r.bepQty, 334);
assert.equal(r.bepExact, false);
assert.ok(334 * 300 - 100000 >= 0 && 333 * 300 - 100000 < 0);
r = calcByTotals({ sales: 1000000, variable: 700000, fixed: 100000 }); // 100000×1000000/300000 = 333,333.33… → 333,334円
assert.equal(r.bepSales, 333334);
assert.ok(333334 * 0.3 - 100000 >= 0 && 333333 * 3 - 1000000 < 0);

// ── 限界利益が0以下なら答えを出さない（負の損益分岐点・無限大を出さない）──
assert.deepEqual(calcByTotals({ sales: 1000000, variable: 1000000, fixed: 1 }).reason, "no_margin");
assert.deepEqual(calcByTotals({ sales: 1000000, variable: 1200000, fixed: 1 }).reason, "no_margin");
assert.equal(calcByUnits({ price: 800, unitVar: 800, fixed: 1 }).reason, "no_margin");
assert.equal(calcByUnits({ price: 700, unitVar: 800, fixed: 1 }).reason, "no_margin");
assert.equal(calcByTotals({ sales: 1000000, variable: 999999, fixed: 0 }).ok, true);   // 限界利益1円なら計算できる
assert.equal(calcByTotals({ sales: 1000000, variable: 999999, fixed: 0 }).bepSales, 0); // 固定費0なら損益分岐点0

// ── 入力の検査 ──
assert.equal(calcByTotals({ sales: 0, variable: 0, fixed: 100 }).reason, "no_sales");
assert.equal(calcByTotals({ sales: -1, variable: 0, fixed: 100 }).reason, "invalid");
assert.equal(calcByTotals({ sales: 1.5, variable: 0, fixed: 100 }).reason, "invalid");
assert.equal(calcByTotals({ sales: NaN, variable: 0, fixed: 100 }).reason, "invalid");
assert.equal(calcByUnits({ price: 1000, unitVar: 800, fixed: 1e12 + 1 }).reason, "invalid");
// 桁が大きくても安全な整数に収まらない答えは出さない
assert.equal(calcByTotals({ sales: 1e12, variable: 1e12 - 1, fixed: 1e12 }).reason, "invalid");
assert.equal(ceilDiv(7, 2), 4);
assert.equal(ceilDiv(6, 2), 3);
assert.equal(ceilDiv(0, 5), 0);

// 目標利益（総額の方式）: 例の固定費60万＋目標利益12万 → 120万円（公庫の図の売上高120のケースと一致）
r = calcByTotals({ sales: 1000000, variable: 400000, fixed: 600000, target: 120000 });
assert.equal(r.bepSales, 1000000);
assert.equal(r.targetSales, 1200000);
assert.equal(r.targetGap, 200000);

// 現状の数量との比較
r = calcByUnits({ price: 1000, unitVar: 800, fixed: 300000, qty: 1200, target: 150000 });
assert.equal(r.qtyGap, -300);             // 損益分岐点まで300個足りない
assert.equal(r.currentProfit, -60000);
assert.equal(r.currentSales, 1200000);
assert.equal(r.targetQtyGap, 1050);

console.log("✓ test_soneki: J-Net21（1,500個・150万円・2,250個・改善策3つ）と公庫（100万円）に一致、切上げ・前提不成立・入力検査も緑");
