/**
 * 損益分岐点の計算（DOM非依存・テスト対象）。/soneki-bunkiten/ が使う。
 *
 * 一次ソース（2026-10-14 に curl で確認）:
 * - 中小機構 J-Net21「損益分岐点の計算方法と経営改善に向けた活用方法を教えてください。」
 *   https://j-net21.smrj.go.jp/solution/qa/accounting/Q0240.html
 *     ・売価1,000円・仕入800円（変動費）・固定費30万円 → 損益分岐点販売量 300,000円÷200円＝1,500個、
 *       損益分岐点売上高 1,000円×1,500個＝1,500,000円
 *     ・損益分岐点売上高＝固定費÷（1－変動費÷売上高）＝固定費÷（1－変動費率）
 *     ・安全余裕率＝（売上高－損益分岐点売上高）÷売上高×100％
 *     ・目標販売数量＝（固定費＋目標利益）÷1個当たり限界利益 → (300,000＋150,000)÷200＝2,250個
 * - 日本政策金融公庫「ベテラン中小企業診断士が、分かりやすく解説」（2022年9月）
 *   https://www.jfc.go.jp/n/service/pdf/shindanshi_20220921.pdf
 *     ・損益分岐点＝固定費÷（1－（変動費÷売上高））。売上高120・変動費48・固定費60（万円）→ 100
 *
 * 計算の作り:
 * - 金額は円の整数で受け取り、割り算は BigInt で1回だけ行う（浮動小数点の誤差で1円ずれないように）。
 * - 割り切れないときは**1円（1個）未満を切り上げる**。切り上げた売上高（数量）なら利益は0以上になる。
 *   切り捨てると、表示した損益分岐点でわずかに赤字が残る。
 * - 限界利益（売上高－変動費、または単価－単位変動費）が0以下のときは、売上を増やしても固定費を回収できない。
 *   式に入れると負の数や無限大が出るので、答えを出さずに reason: "no_margin" を返す。
 * - どの費用を固定費・変動費にするかは利用者が決める（このファイルは分類の判断をしない）。
 */

export const MAX_YEN = 1e12; // 1兆円。これを超える入力は桁の打ち間違いとして断る

const isAmount = (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= MAX_YEN;

/** a÷b の1未満を切り上げる（a≥0, b>0 の整数）。BigInt で正確に。 */
export function ceilDiv(a, b) {
  const A = BigInt(a), B = BigInt(b);
  return Number((A + B - 1n) / B);
}

/** 結果がどれも安全な整数に収まるか（桁の大きすぎる入力で丸め誤差が出ないように） */
const safe = (o) => Object.values(o).every((v) => typeof v !== "number" || !Number.isInteger(v) || Number.isSafeInteger(v));

/** a÷b を百分率の小数で返す（表示用。計算の判定には使わない）。 */
const ratio = (a, b) => (b === 0 ? null : a / b);

/**
 * 方式1: 売上高・変動費・固定費（いずれも同じ期間の総額）から求める。
 * @param {{sales:number, variable:number, fixed:number, target?:number|null}} p
 *   target: 目標利益（円）。null・未指定なら目標の計算をしない
 */
export function calcByTotals({ sales, variable, fixed, target = null }) {
  if (![sales, variable, fixed].every(isAmount) || (target !== null && !isAmount(target))) {
    return { ok: false, reason: "invalid" };
  }
  if (sales === 0) return { ok: false, reason: "no_sales" };
  const marginal = sales - variable;
  if (marginal <= 0) return { ok: false, reason: "no_margin", marginal, variableRatio: variable / sales };
  // 損益分岐点売上高 = 固定費 ÷ (1 − 変動費/売上高) = 固定費 × 売上高 ÷ (売上高 − 変動費)
  const bepSales = ceilDiv(BigInt(fixed) * BigInt(sales), marginal);
  const bepExact = (BigInt(fixed) * BigInt(sales)) % BigInt(marginal) === 0n;
  const out = {
    ok: true,
    mode: "totals",
    sales, variable, fixed,
    marginal,                                   // 限界利益
    marginalRatio: ratio(marginal, sales),      // 限界利益率
    variableRatio: ratio(variable, sales),      // 変動費率
    currentProfit: sales - variable - fixed,    // 現状の利益（営業利益に当たる）
    bepSales, bepExact,
    gap: sales - bepSales,                      // 現状の売上高 − 損益分岐点売上高（負なら不足）
    // 安全余裕率 = (売上高 − 損益分岐点売上高) ÷ 売上高。切り上げ前の損益分岐点で出す = 1 − 固定費÷限界利益
    safetyRatio: 1 - fixed / marginal,
    bepRatio: fixed / marginal,                 // 損益分岐点比率 = 損益分岐点売上高 ÷ 売上高
  };
  if (target !== null) {
    out.target = target;
    out.targetSales = ceilDiv((BigInt(fixed) + BigInt(target)) * BigInt(sales), marginal);
    out.targetGap = out.targetSales - sales;    // 目標まであと何円の売上が要るか（0以下なら達成済み）
  }
  return safe(out) ? out : { ok: false, reason: "invalid" };
}

/**
 * 方式2: 販売単価・1個当たり変動費・固定費から、損益分岐点の販売数量を求める。
 * @param {{price:number, unitVar:number, fixed:number, target?:number|null, qty?:number|null}} p
 *   qty: 現状（または見込み）の販売数量。null なら現状との比較をしない
 */
export function calcByUnits({ price, unitVar, fixed, target = null, qty = null }) {
  if (![price, unitVar, fixed].every(isAmount) || (target !== null && !isAmount(target)) || (qty !== null && !isAmount(qty))) {
    return { ok: false, reason: "invalid" };
  }
  if (price === 0) return { ok: false, reason: "no_sales" };
  const unitMargin = price - unitVar;
  if (unitMargin <= 0) return { ok: false, reason: "no_margin", unitMargin };
  const bepQty = ceilDiv(fixed, unitMargin);
  const out = {
    ok: true,
    mode: "units",
    price, unitVar, fixed,
    unitMargin,                                  // 1個当たり限界利益
    marginalRatio: ratio(unitMargin, price),
    variableRatio: ratio(unitVar, price),
    bepQty, bepExact: fixed % unitMargin === 0,
    bepSales: price * bepQty,                    // 損益分岐点の数量を売ったときの売上高
  };
  if (target !== null) {
    out.target = target;
    out.targetQty = ceilDiv(BigInt(fixed) + BigInt(target), unitMargin);
    out.targetSales = price * out.targetQty;
    out.targetQtyOverBep = out.targetQty - bepQty;
  }
  if (qty !== null) {
    out.qty = qty;
    out.currentSales = price * qty;
    out.currentProfit = unitMargin * qty - fixed;
    out.qtyGap = qty - bepQty;                   // 負なら損益分岐点まで足りない個数
    if (target !== null) out.targetQtyGap = out.targetQty - qty;
  }
  return safe(out) ? out : { ok: false, reason: "invalid" };
}
