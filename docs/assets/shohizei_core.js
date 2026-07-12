/**
 * 消費税・端数処理の計算（DOM非依存・テスト対象）。
 *
 * 一次ソース（2026-07-13に国税庁で確認）:
 * - タックスアンサー No.6371「端数計算」（消法28〜30、通法118〜120、消令70の10、消基通1-8-15）
 *     ・適格請求書に記載する消費税額等の端数処理は「切上げ、切捨て、四捨五入など任意の方法」
 * - インボイス制度に関するQ&A 問57（令和6年4月改訂）
 *     ・適格請求書の消費税額等に1円未満の端数が生じる場合は、
 *       **一の適格請求書につき、税率ごとに1回** の端数処理を行う（消令70の10、基通1-8-15）
 *     ・(注) 一の適格請求書に記載されている **個々の商品ごとに** 消費税額等を計算し、
 *       1円未満の端数処理を行い、その合計額を消費税額等として記載することは **認められない**
 *     ・記載例: 税込100,000円 → 10%対象60,000円 × 10/110 ≒ 5,454円 /
 *                              8%対象 40,000円 ×  8/108 ≒ 2,962円（消費税 計8,416円）
 *
 * 実装上の注意（浮動小数点）:
 * 税率を 0.1 / 0.08 のような二進で表せない小数で持つと、端数処理の境界で1円ずれうる。
 * ここでは **整数の分子・分母** で持ち、割り算を1回だけ行う（整数どうしの除算は、
 * 真の商が整数なら IEEE754 でも正確に整数が返る）。
 */

/** 税率の定義。tax = 税抜 × num/den、税込からは incl × inNum/inDen で税額を直接出す。 */
export const RATES = {
  standard: { key: "standard", label: "10%（標準税率）", percent: 10, num: 10, den: 100, inNum: 10, inDen: 110 },
  reduced: { key: "reduced", label: "8%（軽減税率）", percent: 8, num: 8, den: 100, inNum: 8, inDen: 108 },
};

/** 端数処理の方法。適格請求書では3つとも認められる（No.6371）。 */
export const ROUNDINGS = {
  floor: { key: "floor", label: "切捨て", note: "最も多い。国税庁の記載例もこの方法" },
  ceil: { key: "ceil", label: "切上げ", note: "認められる" },
  round: { key: "round", label: "四捨五入", note: "認められる" },
};

/** 1円未満の端数を処理する。 */
export function applyRounding(value, mode = "floor") {
  if (mode === "ceil") return Math.ceil(value);
  if (mode === "round") return Math.round(value); // 正の金額なので .5 は切上げ＝四捨五入
  return Math.floor(value);
}

/** 税抜金額から消費税額を求める。 */
export function taxFromExcluded(excluded, rateKey = "standard", mode = "floor") {
  const r = RATES[rateKey];
  return applyRounding((excluded * r.num) / r.den, mode);
}

/** 税込金額から消費税額を求める（10%なら ×10/110、8%なら ×8/108）。 */
export function taxFromIncluded(included, rateKey = "standard", mode = "floor") {
  const r = RATES[rateKey];
  return applyRounding((included * r.inNum) / r.inDen, mode);
}

/**
 * 税抜⇔税込の相互変換。
 * 税抜は「税込 − 税額」で戻す（税額から逆算しないと、画面の3つの数字が合わなくなる）。
 */
export function convert(amount, rateKey = "standard", mode = "floor", input = "excluded") {
  if (!(amount > 0)) return { excluded: 0, tax: 0, included: 0 };
  if (input === "included") {
    const tax = taxFromIncluded(amount, rateKey, mode);
    return { excluded: amount - tax, tax, included: amount };
  }
  const tax = taxFromExcluded(amount, rateKey, mode);
  return { excluded: amount, tax, included: amount + tax };
}

/**
 * 適格請求書（インボイス）の消費税額を計算する。
 *
 * 正しい方法 = 税率ごとに金額を合計し、**その合計に対して1回だけ** 端数処理する。
 * 比較のため、認められていない「明細ごとに端数処理して合計する方法」も計算して返す
 * （両者の差が、そのまま請求書の消費税額の誤りになる）。
 *
 * @param {Array<{name?:string, amount:number, rate:string}>} lines 明細（amountは input が示す税抜/税込）
 * @param {string} mode 端数処理の方法
 * @param {string} input "excluded"（税抜で入力）または "included"（税込で入力）
 */
export function calcInvoice(lines, mode = "floor", input = "excluded") {
  const groups = [];
  for (const key of ["standard", "reduced"]) {
    const rows = lines.filter((l) => l.rate === key && l.amount > 0);
    if (rows.length === 0) continue;

    const subtotal = rows.reduce((s, l) => s + l.amount, 0);

    // 正: 税率ごとの合計に1回だけ端数処理（消令70の10）
    const tax = input === "included"
      ? taxFromIncluded(subtotal, key, mode)
      : taxFromExcluded(subtotal, key, mode);

    // 誤: 明細ごとに端数処理してから合計（Q&A 問57(注)で「認められません」）
    const perLineTax = rows.reduce(
      (s, l) => s + (input === "included"
        ? taxFromIncluded(l.amount, key, mode)
        : taxFromExcluded(l.amount, key, mode)),
      0
    );

    groups.push({
      rate: key,
      label: RATES[key].label,
      percent: RATES[key].percent,
      count: rows.length,
      subtotal,
      tax,
      perLineTax,
      excluded: input === "included" ? subtotal - tax : subtotal,
      included: input === "included" ? subtotal : subtotal + tax,
    });
  }

  const totalTax = groups.reduce((s, g) => s + g.tax, 0);
  const totalPerLineTax = groups.reduce((s, g) => s + g.perLineTax, 0);
  const totalExcluded = groups.reduce((s, g) => s + g.excluded, 0);
  const totalIncluded = groups.reduce((s, g) => s + g.included, 0);

  return {
    groups,
    totalTax,
    totalPerLineTax,
    // 明細ごとに端数処理した場合とのズレ（0でなければ、その請求書は端数処理の方法が誤り）
    diff: totalPerLineTax - totalTax,
    totalExcluded,
    totalIncluded,
    mixed: groups.length > 1,
  };
}

/** 表示用（テストでは使わない）。 */
export function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}
