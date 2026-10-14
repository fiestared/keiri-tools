/**
 * 利益率・原価率・上乗せ率と、目標の率からの売価逆算（DOM非依存・テスト対象）。/riekiritsu/ が使う。
 *
 * 一次ソース（2026-10-14 に curl で確認）:
 * - 日本政策金融公庫「経営改善計画書策定の手引」
 *   https://www.jfc.go.jp/n/service/pdf/keieikaizentebiki_230403n.pdf
 *     ・（注２）「売上総利益率（粗利益率）＝売上総利益／売上高」
 *     ・記入例「直近実績32,400千円／直近実績の売上高90,000千円＝36％」（売上原価の率）
 * - 中小機構 J-Net21 Q0240「売上高と変動費の差額は、1,000円-800円＝200円です。」
 *   https://j-net21.smrj.go.jp/solution/qa/accounting/Q0240.html
 *
 * 用語（分母がちがうので混ぜない）:
 *   利益額   = 売価 − 原価
 *   粗利率   = 利益額 ÷ 売価   （売上総利益率。分母は売価）
 *   原価率   = 原価 ÷ 売価     （粗利率 + 原価率 = 100%）
 *   上乗せ率 = 利益額 ÷ 原価   （マークアップ率。分母は原価）
 *
 * 税込・税抜がまざった入力は、消費税の計算（shohizei_core.js の convert）で同じ基準へそろえてから計算する。
 * 税込→税抜は「税込 × 10/110（8%なら 8/108）の1円未満を端数処理した税額」を税込から引く。
 * そろえ方は利用者が選ぶ（税抜でそろえる／税込でそろえる）。
 *
 * 逆算は「利用者が指定した率以上になる、1円単位で最も安い売価」を返す。売価そのものを勧めるものではない。
 * 答えの売価が1兆円（MAX_YEN）を超えるときは reason: "too_large" で断る（入力の上限と同じ線）。
 * 率の判定は整数どうしの掛け算で行い、浮動小数点の丸めで境目の1円を取り違えないようにする。
 */
import { convert, RATES } from "./shohizei_core.js";

export const MAX_YEN = 1e12;
export const TAX_TYPES = ["excluded", "included"]; // 税抜・税込
export { RATES };

const isAmount = (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= MAX_YEN;
const isTax = (t) => TAX_TYPES.includes(t);
const isRate = (r) => Object.prototype.hasOwnProperty.call(RATES, r);

/**
 * 金額を基準（税抜 or 税込）へそろえる。
 * @returns {{value:number, converted:boolean, tax:number|null}}
 */
export function toBasis(amount, taxType, rateKey, basis, rounding = "floor") {
  if (taxType === basis) return { value: amount, converted: false, tax: null };
  const r = convert(amount, rateKey, rounding, taxType);
  return { value: basis === "excluded" ? r.excluded : r.included, converted: true, tax: r.tax };
}

/** 百分率の入力（小数第2位まで）を 1/10000 単位の整数にする。範囲外・桁超過は null */
export function percentToBp(percent) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return null;
  const bp = Math.round(percent * 100);
  if (Math.abs(bp - percent * 100) > 1e-6) return null; // 小数第3位以下は受けない
  return bp;
}

function checkSide(side) {
  return side && isAmount(side.amount) && isTax(side.tax) && isRate(side.rate);
}

/**
 * 原価と売価から、利益額・粗利率・原価率・上乗せ率を出す。
 * @param {{cost:{amount:number,tax:string,rate:string}, price:{amount:number,tax:string,rate:string},
 *          basis?:"excluded"|"included", rounding?:string}} p
 */
export function calcMargin({ cost, price, basis = "excluded", rounding = "floor" }) {
  if (!checkSide(cost) || !checkSide(price) || !isTax(basis)) return { ok: false, reason: "invalid" };
  if (price.amount === 0) return { ok: false, reason: "no_price" };
  const c = toBasis(cost.amount, cost.tax, cost.rate, basis, rounding);
  const p = toBasis(price.amount, price.tax, price.rate, basis, rounding);
  if (p.value === 0) return { ok: false, reason: "no_price" };
  const profit = p.value - c.value;
  return {
    ok: true,
    basis,
    cost: c.value, price: p.value,
    costConverted: c, priceConverted: p,
    profit,
    grossMargin: profit / p.value,                     // 粗利率（売価が分母）
    costRatio: c.value / p.value,                      // 原価率
    markup: c.value === 0 ? null : profit / c.value,   // 上乗せ率（原価が分母）。原価0は定義できない
    belowCost: profit < 0,
  };
}

/** 売価（基準の金額）が目標を満たすか。整数だけで判定する。 */
function meets(priceB, costB, kind, bp) {
  const lhs = BigInt(priceB - costB) * 10000n;
  return kind === "margin" ? lhs >= BigInt(bp) * BigInt(priceB) : lhs >= BigInt(bp) * BigInt(costB);
}

/**
 * 目標の粗利率（または上乗せ率）以上になる、最も安い1円単位の売価を求める。
 * @param {{cost:{amount:number,tax:string,rate:string}, basis?:string,
 *          target:{kind:"margin"|"markup", percent:number}, out:{tax:string, rate:string}, rounding?:string}} p
 *   out: 答える売価の税区分と税率（例: 店頭の税込価格で知りたい → {tax:"included", rate:"standard"}）
 */
export function reversePrice({ cost, basis = "excluded", target, out, rounding = "floor" }) {
  if (!checkSide(cost) || !isTax(basis) || !out || !isTax(out.tax) || !isRate(out.rate)) return { ok: false, reason: "invalid" };
  if (!target || !["margin", "markup"].includes(target.kind)) return { ok: false, reason: "invalid" };
  const bp = percentToBp(target.percent);
  if (bp === null || bp < 0) return { ok: false, reason: "invalid_percent" };
  if (target.kind === "margin" && bp >= 10000) return { ok: false, reason: "margin_100" }; // 粗利率100%以上は売価をいくら上げても届かない
  const C = toBasis(cost.amount, cost.tax, cost.rate, basis, rounding).value;
  if (C === 0) return { ok: false, reason: "no_cost" };
  const priceB = (P) => toBasis(P, out.tax, out.rate, basis, rounding).value;
  const ok = (P) => meets(priceB(P), C, target.kind, bp);
  // 上限を倍々で探してから二分探索（基準の金額は売価に対して単調に増えるので、最小の P が1つに決まる）
  let hi = Math.max(1, C);
  while (!ok(hi)) {
    hi *= 2;
    if (hi > MAX_YEN * 4) return { ok: false, reason: "too_large" };
  }
  let lo = 0; // ok(lo) は偽（売価0円で率を満たすことはない: C>0）
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid; else lo = mid;
  }
  const P = hi;
  // 答えの売価にも入力と同じ上限（1兆円）を当てる。超えたら calcMargin が invalid を返すので、成功扱いにせず断る
  if (P > MAX_YEN) return { ok: false, reason: "too_large" };
  const atP = calcMargin({ cost, price: { amount: P, tax: out.tax, rate: out.rate }, basis, rounding });
  if (!atP.ok) return { ok: false, reason: atP.reason };
  const below = P > 1 ? calcMargin({ cost, price: { amount: P - 1, tax: out.tax, rate: out.rate }, basis, rounding }) : null;
  return {
    ok: true,
    kind: target.kind, percent: bp / 100, basis,
    cost: C,
    price: P,                                   // 答え（out の税区分での売価）
    priceBasis: atP.price,                      // 基準にそろえた売価
    other: convert(P, out.rate, rounding, out.tax), // 税抜・税込の両方
    result: atP,                                // その売価での利益額・各率
    oneYenLess: below,                          // 1円安いと目標に届かないことの確認用。税抜0円なら {ok:false, reason:"no_price"}
  };
}
