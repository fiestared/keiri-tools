// 利益率・原価率・売価逆算（docs/assets/rieki_core.js）の単体テスト。2026-10-14 新規（/riekiritsu/）。
// ★期待値は一次資料の公表値:
//   J-Net21 Q0240「1,000円-800円＝200円」 https://j-net21.smrj.go.jp/solution/qa/accounting/Q0240.html
//   日本政策金融公庫『経営改善計画書策定の手引』（注２）売上総利益率＝売上総利益／売上高、
//     記入例「32,400千円／90,000千円＝36％」 https://www.jfc.go.jp/n/service/pdf/keieikaizentebiki_230403n.pdf
//   国税庁 インボイスQ&A 問57 の記載例（税込60,000円×10/110≒5,454円・40,000円×8/108≒2,962円）
//     — shohizei_core.js と同じ公表例で、税込→税抜のそろえ方を統合検査する
import assert from "node:assert/strict";
import { calcMargin, reversePrice, toBasis, percentToBp } from "../docs/assets/rieki_core.js";
import { taxFromIncluded } from "../docs/assets/shohizei_core.js";

const ex = (amount, rate = "standard") => ({ amount, tax: "excluded", rate });
const inc = (amount, rate = "standard") => ({ amount, tax: "included", rate });
const close = (a, b) => Math.abs(a - b) < 1e-12;

// ── J-Net21: 売価1,000円・仕入800円 → 差額200円 ──
let r = calcMargin({ cost: ex(800), price: ex(1000) });
assert.equal(r.profit, 200);
assert.ok(close(r.grossMargin, 0.2));   // 200/1,000（算術値）
assert.ok(close(r.costRatio, 0.8));     // 800/1,000（算術値）
assert.ok(close(r.markup, 0.25));       // 200/800 — 分母が原価なので粗利率20%とは別の数
assert.ok(close(r.grossMargin + r.costRatio, 1));

// ── 公庫の手引: 売上高90,000千円・売上原価32,400千円 → 原価率36%、売上総利益57,600千円 ──
r = calcMargin({ cost: ex(32400000), price: ex(90000000) });
assert.equal(r.profit, 57600000);       // 損益計算書の記入例「売上総利益 57,600」
assert.ok(close(r.costRatio, 0.36));    // 「32,400千円／直近実績の売上高90,000千円＝36％」
assert.ok(close(r.grossMargin, 0.64));  // 売上総利益／売上高

// ── 税込・税抜の混在（国税庁 問57 の記載例と同じ数字。shohizei_core と統合検査）──
assert.equal(taxFromIncluded(60000, "standard"), 5454);
assert.equal(taxFromIncluded(40000, "reduced"), 2962);
r = calcMargin({ cost: inc(40000, "reduced"), price: inc(60000, "standard"), basis: "excluded" });
assert.equal(r.cost, 40000 - 2962);     // 37,038
assert.equal(r.price, 60000 - 5454);    // 54,546
assert.equal(r.profit, 54546 - 37038);
// 仕入は税込・売価は税抜のまま引き算すると利益を少なく見誤る（そろえるとこう違う）
const naive = 60000 - 40000;
assert.notEqual(r.profit, naive);
// 税込でそろえる: 税抜の原価1,000円（10%）→ 1,100円
r = calcMargin({ cost: ex(1000), price: inc(1650), basis: "included" });
assert.equal(r.cost, 1100);
assert.equal(r.price, 1650);
assert.equal(r.profit, 550);
assert.ok(close(r.grossMargin, 550 / 1650));
// 同じ基準なら変換しない
assert.deepEqual(toBasis(1234, "excluded", "standard", "excluded"), { value: 1234, converted: false, tax: null });
// 端数処理の選択が効く: 税込1,000円(10%) → 税額 90.90… → 切捨て90／切上げ91／四捨五入91
assert.equal(toBasis(1000, "included", "standard", "excluded", "floor").value, 910);
assert.equal(toBasis(1000, "included", "standard", "excluded", "ceil").value, 909);
assert.equal(toBasis(1000, "included", "standard", "excluded", "round").value, 909);

// ── 原価割れ・原価0 ──
r = calcMargin({ cost: ex(1200), price: ex(1000) });
assert.equal(r.profit, -200);
assert.equal(r.belowCost, true);
assert.ok(close(r.grossMargin, -0.2));
r = calcMargin({ cost: ex(0), price: ex(1000) });
assert.equal(r.markup, null);           // 原価0の上乗せ率は定義できない
assert.equal(calcMargin({ cost: ex(800), price: ex(0) }).reason, "no_price");
assert.equal(calcMargin({ cost: ex(-1), price: ex(10) }).reason, "invalid");
assert.equal(calcMargin({ cost: { amount: 1, tax: "x", rate: "standard" }, price: ex(10) }).reason, "invalid");

// ── 逆算: 粗利率20%以上になる最も安い売価（原価800円）→ 1,000円。999円では届かない ──
r = reversePrice({ cost: ex(800), target: { kind: "margin", percent: 20 }, out: { tax: "excluded", rate: "standard" } });
assert.equal(r.price, 1000);
assert.equal(r.result.profit, 200);
assert.ok(r.oneYenLess.grossMargin < 0.2);
// 上乗せ率25%以上 → 1,000円（800×1.25）
r = reversePrice({ cost: ex(800), target: { kind: "markup", percent: 25 }, out: { tax: "excluded", rate: "standard" } });
assert.equal(r.price, 1000);
// 公庫の手引の率: 原価率36%＝粗利率64% → 原価32,400千円なら売上高90,000千円
r = reversePrice({ cost: ex(32400000), target: { kind: "margin", percent: 64 }, out: { tax: "excluded", rate: "standard" } });
assert.equal(r.price, 90000000);
// 割り切れない: 原価700円・粗利率30% → 700/0.7=1,000 ちょうど／原価701円 → 1,001.43… → 1,002円
assert.equal(reversePrice({ cost: ex(700), target: { kind: "margin", percent: 30 }, out: { tax: "excluded", rate: "standard" } }).price, 1000);
r = reversePrice({ cost: ex(701), target: { kind: "margin", percent: 30 }, out: { tax: "excluded", rate: "standard" } });
assert.equal(r.price, 1002);
assert.ok(r.result.grossMargin >= 0.3 && r.oneYenLess.grossMargin < 0.3);
// 小数第2位の率: 原価1,000円・粗利率33.33% → 1,000/0.6667 = 1,499.92… → 1,500円
assert.equal(reversePrice({ cost: ex(1000), target: { kind: "margin", percent: 33.33 }, out: { tax: "excluded", rate: "standard" } }).price, 1500);
// 税込の売価で答える（税抜でそろえて判定）: 原価800円(税抜)・粗利率20% → 税抜1,000円以上になる最安の税込価格
r = reversePrice({ cost: ex(800), target: { kind: "margin", percent: 20 }, out: { tax: "included", rate: "standard" }, rounding: "floor" });
// 税込1,099円 → 税額 1,099×10/110＝99.9… を切捨て99円 → 税抜1,000円。1,098円は税抜999円で届かない
assert.equal(r.price, 1099);
assert.equal(r.priceBasis, 1000);
assert.equal(r.oneYenLess.price, 999);
// 四捨五入なら 1,099円 は税額100円・税抜999円で届かず、1,100円になる
assert.equal(reversePrice({ cost: ex(800), target: { kind: "margin", percent: 20 }, out: { tax: "included", rate: "standard" }, rounding: "round" }).price, 1100);
// 粗利率100%以上は売価をいくら上げても届かない／率の桁・範囲
assert.equal(reversePrice({ cost: ex(800), target: { kind: "margin", percent: 100 }, out: { tax: "excluded", rate: "standard" } }).reason, "margin_100");
assert.equal(reversePrice({ cost: ex(800), target: { kind: "margin", percent: -1 }, out: { tax: "excluded", rate: "standard" } }).reason, "invalid_percent");
assert.equal(reversePrice({ cost: ex(800), target: { kind: "margin", percent: 12.345 }, out: { tax: "excluded", rate: "standard" } }).reason, "invalid_percent");
assert.equal(reversePrice({ cost: ex(0), target: { kind: "margin", percent: 20 }, out: { tax: "excluded", rate: "standard" } }).reason, "no_cost");
// 上乗せ率は100%を超えてよい（原価の2倍＝上乗せ率100%）
assert.equal(reversePrice({ cost: ex(800), target: { kind: "markup", percent: 150 }, out: { tax: "excluded", rate: "standard" } }).price, 2000);
// 粗利率99.99%（原価1円）→ 1/0.0001 = 10,000円
assert.equal(reversePrice({ cost: ex(1), target: { kind: "margin", percent: 99.99 }, out: { tax: "excluded", rate: "standard" } }).price, 10000);
assert.equal(percentToBp(20), 2000);
assert.equal(percentToBp(33.33), 3333);
assert.equal(percentToBp(0.1), 10);
assert.equal(percentToBp(1.005), null);

console.log("✓ test_rieki: J-Net21（差額200円）・公庫の手引（原価率36%・売上総利益57,600千円）・国税庁問57（5,454円/2,962円）に一致、逆算の最小1円も緑");
