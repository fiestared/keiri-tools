import assert from "node:assert";
import {
  salesTaxByDivide, salesTaxByPileUp,
  purchaseTaxByPileUp, purchaseTaxByDivide,
  isAllowedCombination, calcDeclaration, compareDeclarationMethods,
  floorToUnit,
} from "../docs/assets/shohizei_core.js";

/* ==================================================================
 * 申告(納付税額)の計算 — 割戻し計算 / 積上げ計算
 *
 * 一次ソース(2026-07-13 国税庁で実読):
 *  - No.6383 売上税額: 原則=割戻し(税込×100/110 → 課税標準額 → ×7.8%)
 *                      特例=積上げ(適格請求書の消費税額等の合計 × 78/100)
 *  - No.6391 仕入税額: 原則=積上げ(消費税額等の合計 × 78/100)
 *                      特例=割戻し(税込 × 7.8/110)
 *            制約: 「割戻し計算により仕入税額を計算できるのは、
 *                   売上税額を割戻し計算している場合に限られます」
 *  - No.6371 端数: 課税標準額=千円未満切捨て / 差引税額=百円未満切捨て
 *  - 課税標準額の千円未満切捨ては税率ごと(付表1-3が税率別の欄を持つ)
 * ================================================================== */

/* ------------------------------------------------------------------
 * 独立オラクル: BigInt の厳密整数演算。
 * 被検体は double で割るので、同じ式で照合したら両方が同じようにズレる。
 * ここは分数を約分せずに定義どおり書く(被検体は 100/110 を 10/11 に約分している
 * ので、約分しないこと自体が独立性になる)。
 * ------------------------------------------------------------------ */
const bfloor = (a, b) => (BigInt(a) * 1n) / BigInt(b); // BigInt除算=切捨て
const floorUnitB = (v, unit) => (v / BigInt(unit)) * BigInt(unit);

function oracleSalesDivide(incl10, incl8) {
  // 税率ごと: 税込 × 100/110 → 千円未満切捨て → × 7.8%(6.24%)
  let tax = 0n;
  if (incl10 > 0) {
    const base = floorUnitB((BigInt(incl10) * 100n) / 110n, 1000);
    tax += (base * 78n) / 1000n;
  }
  if (incl8 > 0) {
    const base = floorUnitB((BigInt(incl8) * 100n) / 108n, 1000);
    tax += (base * 624n) / 10000n;
  }
  return Number(tax);
}
function oraclePileUp(invoiceTax) {
  return Number((BigInt(invoiceTax) * 78n) / 100n);
}
function oraclePurchaseDivide(incl10, incl8) {
  let tax = 0n;
  if (incl10 > 0) tax += (BigInt(incl10) * 78n) / 1100n;   // 7.8/110
  if (incl8 > 0) tax += (BigInt(incl8) * 624n) / 10800n;   // 6.24/108
  return Number(tax);
}
function oracleTotal(salesTax, purchaseTax) {
  const raw = BigInt(salesTax) - BigInt(purchaseTax);
  const national = raw >= 0n ? floorUnitB(raw, 100) : raw;
  const rawLocal = (national * 22n) / 78n; // BigInt除算は0方向切捨て
  const local = national >= 0n ? floorUnitB(rawLocal, 100) : -floorUnitB(-rawLocal, 100);
  return { national: Number(national), local: Number(local), total: Number(national + local) };
}

/* ==================================================================
 * 1. 教科書どおりの基本例(手計算で検算できる値)
 * ================================================================== */
{
  // 税込11,000,000円(10%) → 課税標準額10,000,000円 → ×7.8% = 780,000円
  const s = salesTaxByDivide({ standard: 11_000_000 });
  assert.equal(s.rows[0].base, 10_000_000, "課税標準額 = 税込×100/110");
  assert.equal(s.tax, 780_000, "売上税額(国税) = 課税標準額×7.8%");

  // 軽減: 税込10,800,000円(8%) → 課税標準額10,000,000円 → ×6.24% = 624,000円
  const r = salesTaxByDivide({ reduced: 10_800_000 });
  assert.equal(r.rows[0].base, 10_000_000);
  assert.equal(r.tax, 624_000);

  // 積上げ: 適格請求書に記載した消費税額等の合計1,000,000円 → ×78/100 = 780,000円
  assert.equal(salesTaxByPileUp(1_000_000).tax, 780_000);
  assert.equal(purchaseTaxByPileUp(1_000_000).tax, 780_000);

  // 仕入の割戻し: 税込5,500,000円(10%) → ×7.8/110 = 390,000円
  assert.equal(purchaseTaxByDivide({ standard: 5_500_000 }).tax, 390_000);
}

/* ==================================================================
 * 2. 課税標準額の千円未満切捨ては「税率ごと」に効く
 *    (合計してから切り捨てると答えが変わる = 付表1-3の構造と違う)
 * ================================================================== */
{
  // 10%: 税込11,001円 → ×100/110 = 10,000.9… → 千円未満切捨て → 10,000円 → ×7.8% = 780円
  const s = salesTaxByDivide({ standard: 11_001 });
  assert.equal(s.rows[0].base, 10_000, "端数は課税標準額の段階で千円未満切捨て");
  assert.equal(s.tax, 780);

  // 税率ごとに切り捨てるので、それぞれの端数が別々に落ちる
  const both = salesTaxByDivide({ standard: 11_999, reduced: 10_799 });
  assert.equal(both.rows.find((r) => r.rate === "standard").base, 10_000); // 10,908→10,000
  assert.equal(both.rows.find((r) => r.rate === "reduced").base, 9_000);   // 9,999→9,000
  assert.equal(both.tax, Math.floor(10_000 * 0.078) + Math.floor(9_000 * 0.0624));
}

/* ==================================================================
 * 3. 制約: 売上=積上げ のとき 仕入=割戻し は認められない (No.6391)
 * ================================================================== */
{
  assert.equal(isAllowedCombination("divide", "pileup"), true);
  assert.equal(isAllowedCombination("divide", "divide"), true);
  assert.equal(isAllowedCombination("pileup", "pileup"), true);
  assert.equal(isAllowedCombination("pileup", "divide"), false, "これだけが不可");

  const bad = calcDeclaration({
    salesIncluded: { standard: 11_000_000 },
    salesInvoiceTax: 1_000_000,
    purchasesIncluded: { standard: 5_500_000 },
    purchaseInvoiceTax: 500_000,
    salesMethod: "pileup",
    purchaseMethod: "divide",
  });
  assert.equal(bad.allowed, false, "認められない組み合わせは計算せず理由を返す");
  assert.match(bad.reason, /6391/);
  assert.equal(bad.total, undefined, "不可の組み合わせで納付税額を出してはいけない");

  // 比較関数が返すのは「認められる3通り」だけ(4通り目を出さない)
  const cmp = compareDeclarationMethods({
    salesIncluded: { standard: 11_000_000 },
    salesInvoiceTax: 1_000_000,
    purchasesIncluded: { standard: 5_500_000 },
    purchaseInvoiceTax: 500_000,
  });
  assert.equal(cmp.results.length, 3);
  assert.ok(cmp.results.every((r) => r.allowed), "比較に不可の組み合わせを混ぜない");
  assert.ok(
    !cmp.results.some((r) => r.salesMethod === "pileup" && r.purchaseMethod === "divide"),
    "売上=積上げ×仕入=割戻し は選択肢に出さない"
  );
}

/* ==================================================================
 * 4. 差引税額は百円未満切捨て / 地方消費税 = 国税 × 22/78
 * ================================================================== */
{
  assert.equal(floorToUnit(12_345, 100), 12_300);
  assert.equal(floorToUnit(12_345, 1000), 12_000);

  const d = calcDeclaration({
    salesIncluded: { standard: 11_000_000 },   // 売上税額 780,000
    purchasesIncluded: { standard: 5_500_000 },
    purchaseInvoiceTax: 500_000,               // 仕入(積上げ) 390,000
    salesMethod: "divide",
    purchaseMethod: "pileup",
  });
  assert.equal(d.sales.tax, 780_000);
  assert.equal(d.purchase.tax, 390_000);
  assert.equal(d.national, 390_000, "差引税額(百円未満切捨て)");
  assert.equal(d.local, 110_000, "地方消費税 = 390,000 × 22/78 = 110,000");
  assert.equal(d.total, 500_000, "納付税額 = 国税 + 地方");

  // 消費税額の合計が10%分ちょうどになること(検算: 税抜1,000万 - 仕入税抜500万 = 500万 × 10%)
  assert.equal(d.total, 500_000);
}

/* ==================================================================
 * 5. 還付(仕入税額 > 売上税額)のとき、百円未満切捨てで額を増やさない
 * ================================================================== */
{
  const d = calcDeclaration({
    salesIncluded: { standard: 1_100_000 },     // 売上税額 78,000
    purchaseInvoiceTax: 500_000,                // 仕入税額 390,000
    salesMethod: "divide",
    purchaseMethod: "pileup",
  });
  assert.ok(d.refund, "控除不足=還付");
  assert.equal(d.national, 78_000 - 390_000, "還付額は切り捨てない(切り捨てると納税者不利)");
  assert.ok(d.total < 0, "還付は負の納付税額として返す");
}

/* ==================================================================
 * 6. BigInt厳密整数を独立オラクルに、広い範囲で全数照合
 *    (浮動小数点で1円ずれないこと。第8便で税込99円が8円になった型のバグ)
 * ================================================================== */
{
  let checked = 0;
  // 1円単位の刻みで、端数が最も出やすい小さい額を密に
  for (let incl = 1; incl <= 20_000; incl++) {
    assert.equal(
      salesTaxByDivide({ standard: incl }).tax,
      oracleSalesDivide(incl, 0),
      `売上割戻し(10%) 税込${incl}`
    );
    assert.equal(
      salesTaxByDivide({ reduced: incl }).tax,
      oracleSalesDivide(0, incl),
      `売上割戻し(8%) 税込${incl}`
    );
    assert.equal(
      purchaseTaxByDivide({ standard: incl }).tax,
      oraclePurchaseDivide(incl, 0),
      `仕入割戻し(10%) 税込${incl}`
    );
    assert.equal(
      purchaseTaxByDivide({ reduced: incl }).tax,
      oraclePurchaseDivide(0, incl),
      `仕入割戻し(8%) 税込${incl}`
    );
    assert.equal(salesTaxByPileUp(incl).tax, oraclePileUp(incl), `積上げ ${incl}`);
    checked += 5;
  }
  // 大きい額(実際の年商レンジ)を粗い刻みで
  for (let incl = 1_000_000; incl <= 2_000_000_000; incl += 999_983) {
    assert.equal(salesTaxByDivide({ standard: incl }).tax, oracleSalesDivide(incl, 0));
    assert.equal(salesTaxByDivide({ reduced: incl }).tax, oracleSalesDivide(0, incl));
    assert.equal(purchaseTaxByDivide({ standard: incl }).tax, oraclePurchaseDivide(incl, 0));
    assert.equal(salesTaxByPileUp(incl).tax, oraclePileUp(incl));
    checked += 4;
  }
  console.log(`  BigIntオラクルと照合: ${checked.toLocaleString()}件 ズレ0`);
}

/* ==================================================================
 * 7. 納付税額まで通しでオラクル照合(組み合わせ3通り × 複数の事業者像)
 * ================================================================== */
{
  const cases = [
    { s10: 11_000_000, s8: 0, p10: 5_500_000, p8: 0, sInv: 1_000_000, pInv: 500_000 },
    { s10: 33_333_333, s8: 4_444_444, p10: 12_345_678, p8: 2_222_222, sInv: 3_333_333, pInv: 1_234_567 },
    { s10: 999_999, s8: 1, p10: 1, p8: 999_999, sInv: 90_909, pInv: 74_074 },
    { s10: 5_000_000, s8: 0, p10: 4_999_999, p8: 0, sInv: 454_545, pInv: 454_545 },
  ];
  for (const c of cases) {
    const input = {
      salesIncluded: { standard: c.s10, reduced: c.s8 },
      salesInvoiceTax: c.sInv,
      purchasesIncluded: { standard: c.p10, reduced: c.p8 },
      purchaseInvoiceTax: c.pInv,
    };
    const combos = [
      ["divide", "pileup", oracleSalesDivide(c.s10, c.s8), oraclePileUp(c.pInv)],
      ["divide", "divide", oracleSalesDivide(c.s10, c.s8), oraclePurchaseDivide(c.p10, c.p8)],
      ["pileup", "pileup", oraclePileUp(c.sInv), oraclePileUp(c.pInv)],
    ];
    for (const [sm, pm, expSales, expPurchase] of combos) {
      const got = calcDeclaration({ ...input, salesMethod: sm, purchaseMethod: pm });
      const want = oracleTotal(expSales, expPurchase);
      assert.equal(got.sales.tax, expSales, `売上税額 ${sm}`);
      assert.equal(got.purchase.tax, expPurchase, `仕入税額 ${pm}`);
      assert.equal(got.national, want.national, `差引税額 ${sm}×${pm}`);
      assert.equal(got.local, want.local, `地方消費税 ${sm}×${pm}`);
      assert.equal(got.total, want.total, `納付税額 ${sm}×${pm}`);
    }

    // compare は納付税額が最も少ない組み合わせを best にする
    const cmp = compareDeclarationMethods(input);
    const min = Math.min(...cmp.results.map((r) => r.total));
    assert.equal(cmp.best.total, min, "bestは納付税額が最小の組み合わせ");
    assert.equal(cmp.spread, Math.max(...cmp.results.map((r) => r.total)) - min);
  }
}

/* ==================================================================
 * 8. 積上げが有利になりうることを、実際に差が出る例で確認
 *    (「どちらでも同じ」なら、このパネルを作る意味がない)
 * ================================================================== */
{
  // 端数が毎回切り捨てられる小口取引が多いと、積上げ(請求書の記載額の合計)の方が
  // 売上税額が小さくなりうる。差が0でないことを固定する。
  const cmp = compareDeclarationMethods({
    salesIncluded: { standard: 10_000_000 },
    salesInvoiceTax: 890_000,   // 実際に交付した請求書の消費税額等の合計が割戻しより小さい
    purchasesIncluded: { standard: 5_000_000 },
    purchaseInvoiceTax: 460_000,
  });
  assert.ok(cmp.spread > 0, "組み合わせによって納付税額が変わる(=選ぶ意味がある)");
  assert.equal(cmp.results.length, 3);
}

console.log("test_shohizei_shinkoku: all passed");
