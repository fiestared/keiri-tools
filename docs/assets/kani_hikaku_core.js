/**
 * 消費税の納税額を「本則 / 簡易 / 2割特例 / 3割特例」で比較する純ロジック（DOM非依存）。
 *
 * 一次ソース:
 *  - みなし仕入率: 消費税法施行令57条5項（第1種90%〜第6種40%）
 *  - 2割特例: 平成28年改正法附則51条の2（適格請求書発行事業者となった免税事業者の負担軽減措置）
 *  - 3割特例: 令和8年度税制改正（個人事業者の令和9年分・令和10年分）
 *
 * ★どの方式も納税額は「売上税額」を起点にする。本則だけが仕入税額に依存し、
 *   簡易・2割・3割は**売上だけで決まる**（経費がいくらでも動かない）。
 *   その帰結として「経費率 ＜ みなし仕入率 なら簡易が有利」が必ず成り立つ。
 *   分岐点は経費率＝みなし仕入率のちょうど1点で、これは偶然ではなく式の形から出る:
 *     本則 = 売上税額 ×（1 − 経費率）/ 簡易 = 売上税額 ×（1 − みなし仕入率）
 *
 * 🚫 このファイルに税率や率をベタ書きした説明文を書かない。数値は下の表が唯一の出所。
 */

/** みなし仕入率（消費税法施行令57条5項）。key は事業区分の番号 */
export const MINASHI = {
  1: { rate: 0.9, label: "第1種（卸売業）", note: "他から購入した商品を、性質・形状を変えずに他の事業者に販売する事業" },
  2: { rate: 0.8, label: "第2種（小売業・飲食料品の農林水産業）", note: "性質・形状を変えずに販売する事業で第1種以外" },
  3: { rate: 0.7, label: "第3種（製造業・建設業など）", note: "農林水産業（飲食料品の譲渡を除く）、鉱業、建設業、製造業、電気・ガス・熱供給・水道業" },
  4: { rate: 0.6, label: "第4種（飲食店業など）", note: "第1・2・3・5・6種以外。加工賃その他これに類する料金を対価とする役務提供もここ" },
  5: { rate: 0.5, label: "第5種（サービス業・運輸通信・金融保険）", note: "サービス業（飲食店業に該当するものを除く）" },
  6: { rate: 0.4, label: "第6種（不動産業）", note: "不動産業" },
};

/** 特例の率と適用の条件 */
export const TOKUREI = {
  niwari: { rate: 0.2, label: "2割特例", until: "令和8年9月30日を含む課税期間まで", individualOnly: false },
  sanwari: { rate: 0.3, label: "3割特例", until: "令和9年分・令和10年分", individualOnly: true },
};

/** 税込額から消費税額を取り出す（税率10%なら 10/110） */
export function taxFromIncluded(included, ratePercent = 10) {
  return (included * ratePercent) / (100 + ratePercent);
}

const round = (n) => Math.round(n);

/**
 * 4方式を並べて計算する。
 * @param {object} input
 *   salesIncTax     課税売上（税込）
 *   purchaseIncTax  課税仕入れ（税込）★本則だけが使う
 *   kubun           事業区分 1〜6
 *   ratePercent     税率（既定10）
 *   isIndividual    個人事業者か（3割特例の可否）
 * @returns {{methods: Array, best: object, breakEvenPurchaseIncTax: number, purchaseRatio: number}}
 */
export function compareMethods(input) {
  const {
    salesIncTax, purchaseIncTax = 0, kubun = 5, ratePercent = 10, isIndividual = false,
  } = input;
  if (!(salesIncTax >= 0)) throw new Error("salesIncTax は0以上の数値で指定してください");
  if (!MINASHI[kubun]) throw new Error(`事業区分は1〜6で指定してください（受け取った値: ${kubun}）`);

  const salesTax = taxFromIncluded(salesIncTax, ratePercent);
  const purchaseTax = taxFromIncluded(purchaseIncTax, ratePercent);
  const minashi = MINASHI[kubun].rate;

  const methods = [
    {
      key: "honsoku",
      label: "本則課税",
      // ★0で潰さない。仕入税額が売上税額を超える年（設備投資・輸出免税など）は還付になる。
      //   簡易課税・2割特例では還付が生じないので、この非対称こそ比較の核心になる。
      amount: round(salesTax - purchaseTax),
      refund: salesTax - purchaseTax < 0,
      formula: "売上税額 − 仕入税額",
      dependsOnPurchase: true,
    },
    {
      key: "kani",
      label: `簡易課税（${MINASHI[kubun].label}）`,
      amount: round(salesTax * (1 - minashi)),
      formula: `売上税額 ×（1 − ${minashi * 100}%）`,
      dependsOnPurchase: false,
    },
    {
      key: "niwari",
      label: TOKUREI.niwari.label,
      amount: round(salesTax * TOKUREI.niwari.rate),
      formula: `売上税額 × ${TOKUREI.niwari.rate * 100}%`,
      dependsOnPurchase: false,
      note: TOKUREI.niwari.until,
    },
    {
      key: "sanwari",
      label: TOKUREI.sanwari.label,
      amount: round(salesTax * TOKUREI.sanwari.rate),
      formula: `売上税額 × ${TOKUREI.sanwari.rate * 100}%`,
      dependsOnPurchase: false,
      note: TOKUREI.sanwari.until,
      // ★法人は使えない。使えない方式を「有利」と出さないため、比較から外せるようにする
      available: isIndividual,
    },
  ];

  const selectable = methods.filter((m) => m.available !== false);
  const best = selectable.reduce((a, b) => (b.amount < a.amount ? b : a));

  return {
    salesTax: round(salesTax),
    purchaseTax: round(purchaseTax),
    methods,
    best,
    // 本則と簡易が一致する経費（税込）。ここより経費が少なければ簡易が有利
    breakEvenPurchaseIncTax: round(salesIncTax * minashi),
    purchaseRatio: salesIncTax > 0 ? purchaseIncTax / salesIncTax : 0,
    minashiRate: minashi,
  };
}

/** 「経費率 ＜ みなし仕入率 なら簡易が有利」を判定する（本則 vs 簡易のみ） */
export function kaniIsBetter(input) {
  const r = compareMethods(input);
  const honsoku = r.methods.find((m) => m.key === "honsoku").amount;
  const kani = r.methods.find((m) => m.key === "kani").amount;
  return { kaniIsBetter: kani < honsoku, diff: honsoku - kani, ...r };
}
