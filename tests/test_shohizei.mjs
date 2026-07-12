import assert from "node:assert";
import {
  RATES, applyRounding, taxFromExcluded, taxFromIncluded, convert, calcInvoice,
} from "../docs/assets/shohizei_core.js";

/* ------------------------------------------------------------------
 * 独立オラクル: BigInt の厳密な整数演算で端数処理を再現する。
 * 被検体は double で割り算しているので、同じ式で照合したら
 * 「両方とも同じようにズレる」。ここは意図的に別実装にする。
 * ------------------------------------------------------------------ */
function oracle(amount, num, den, mode) {
  const a = BigInt(amount), n = BigInt(num), d = BigInt(den);
  const q = (a * n) / d;          // BigInt除算 = 切捨て
  const r = (a * n) % d;          // 余り
  if (r === 0n) return Number(q); // 割り切れる: どの方法でも同じ
  if (mode === "floor") return Number(q);
  if (mode === "ceil") return Number(q + 1n);
  // 四捨五入: 余り×2 と 除数を比べる（0.5以上なら切上げ）
  return Number(r * 2n >= d ? q + 1n : q);
}

/* ==================================================================
 * 1. 国税庁 インボイスQ&A 問57 の記載例（これが本丸のオラクル）
 *    税込100,000円 / 10%対象60,000円 → 5,454円 / 8%対象40,000円 → 2,962円
 *    消費税の合計 8,416円
 * ================================================================== */
{
  assert.equal(taxFromIncluded(60000, "standard", "floor"), 5454, "60,000 × 10/110 = 5,454");
  assert.equal(taxFromIncluded(40000, "reduced", "floor"), 2962, "40,000 × 8/108 = 2,962");

  // 明細を入れて、請求書全体として同じ答えになること
  const r = calcInvoice([
    { name: "小麦粉", amount: 5000, rate: "reduced" },
    { name: "牛肉", amount: 8000, rate: "reduced" },
    { name: "キッチンペーパー", amount: 2000, rate: "standard" },
    { name: "その他(10%)", amount: 58000, rate: "standard" },
    { name: "その他(8%)", amount: 27000, rate: "reduced" },
  ], "floor", "included");

  const std = r.groups.find((g) => g.rate === "standard");
  const red = r.groups.find((g) => g.rate === "reduced");
  assert.equal(std.subtotal, 60000);
  assert.equal(red.subtotal, 40000);
  assert.equal(std.tax, 5454, "10%対象 60,000円 → 消費税 5,454円（問57の記載例）");
  assert.equal(red.tax, 2962, "8%対象 40,000円 → 消費税 2,962円（問57の記載例）");
  assert.equal(r.totalTax, 8416, "消費税の合計 8,416円（問57の記載例）");
  assert.equal(r.totalIncluded, 100000);
  assert.ok(r.mixed, "8%と10%が混在していると判定されること");
}

/* ==================================================================
 * 2. 「税率ごとに1回」と「明細ごと」で答えが変わることを固定する。
 *    ここが変わらないなら、このツールは存在意義がない。
 *    消令70の10 / Q&A問57(注): 明細ごとの端数処理は認められない。
 * ================================================================== */
{
  // 端数が出る明細を10行。切捨てなら明細ごとの方が必ず小さく(または同じ)なる
  const lines = Array.from({ length: 10 }, () => ({ amount: 105, rate: "standard" }));
  const r = calcInvoice(lines, "floor", "excluded");

  // 正: 1,050円 × 10% = 105円
  assert.equal(r.groups[0].subtotal, 1050);
  assert.equal(r.totalTax, 105);
  // 誤: 105円 × 10% = 10.5 → 切捨て10円 を10行 = 100円
  assert.equal(r.totalPerLineTax, 100);
  assert.equal(r.diff, -5, "明細ごとに切り捨てると5円少なくなる（この差が誤り）");

  // 切上げなら逆に多くなる
  const up = calcInvoice(lines, "ceil", "excluded");
  assert.equal(up.totalTax, 105);
  assert.equal(up.totalPerLineTax, 110, "105 × 10% = 10.5 → 切上げ11円 × 10行");
  assert.equal(up.diff, 5);
}

/* ==================================================================
 * 3. 端数処理3方式 × 両税率 × 税抜/税込 を独立オラクルと総当たり照合
 *    （浮動小数点で1円ずれる入力が1つでもあれば落ちる）
 * ================================================================== */
{
  let checked = 0;
  for (const mode of ["floor", "ceil", "round"]) {
    for (const key of ["standard", "reduced"]) {
      const R = RATES[key];
      for (let amount = 1; amount <= 30000; amount++) {
        // 税抜 → 税額
        assert.equal(
          taxFromExcluded(amount, key, mode),
          oracle(amount, R.num, R.den, mode),
          `税抜 ${amount} / ${key} / ${mode} で1円ズレ`
        );
        // 税込 → 税額
        assert.equal(
          taxFromIncluded(amount, key, mode),
          oracle(amount, R.inNum, R.inDen, mode),
          `税込 ${amount} / ${key} / ${mode} で1円ズレ`
        );
        checked += 2;
      }
      // 大きい金額でも（1億円前後は実務で普通に出る）
      for (const amount of [1000000, 9999999, 12345678, 100000000, 999999999]) {
        assert.equal(taxFromExcluded(amount, key, mode), oracle(amount, R.num, R.den, mode));
        assert.equal(taxFromIncluded(amount, key, mode), oracle(amount, R.inNum, R.inDen, mode));
        checked += 2;
      }
    }
  }
  assert.ok(checked >= 360000, "総当たりの件数");
  console.log(`  端数処理 総当たり照合: ${checked.toLocaleString()}件 OK`);
}

/* ==================================================================
 * 4. 画面の3つの数字（税抜・税額・税込）が必ず足し算で閉じること
 *    税抜を「税額から逆算」すると 税抜+税額≠税込 になる（利用者は必ず気付く）
 * ================================================================== */
{
  for (const mode of ["floor", "ceil", "round"]) {
    for (const key of ["standard", "reduced"]) {
      for (const input of ["excluded", "included"]) {
        for (let a = 1; a <= 5000; a++) {
          const c = convert(a, key, mode, input);
          assert.equal(c.excluded + c.tax, c.included,
            `税抜+税額≠税込 (${a}/${key}/${mode}/${input})`);
          if (input === "included") assert.equal(c.included, a);
          else assert.equal(c.excluded, a);
        }
      }
    }
  }
}

/* ==================================================================
 * 5. 端数処理の方法は「税率ごとの合計」に効く。片方の税率しかない請求書でも
 *    グループが正しく1つだけできること／0円・空の扱い
 * ================================================================== */
{
  const only10 = calcInvoice([{ amount: 1000, rate: "standard" }], "floor", "excluded");
  assert.equal(only10.groups.length, 1);
  assert.equal(only10.mixed, false);
  assert.equal(only10.totalTax, 100);
  assert.equal(only10.diff, 0, "1行なら明細ごとでも差は出ない");

  const empty = calcInvoice([], "floor", "excluded");
  assert.equal(empty.groups.length, 0);
  assert.equal(empty.totalTax, 0);
  assert.equal(empty.diff, 0);

  // 金額0や負の行は無視される（入力途中の空行）
  const withBlank = calcInvoice([
    { amount: 1000, rate: "standard" }, { amount: 0, rate: "standard" }, { amount: NaN, rate: "reduced" },
  ], "floor", "excluded");
  assert.equal(withBlank.groups.length, 1);
  assert.equal(withBlank.totalTax, 100);
}

/* ==================================================================
 * 6. applyRounding 単体（四捨五入の .5 は切上げ）
 * ================================================================== */
{
  assert.equal(applyRounding(10.5, "floor"), 10);
  assert.equal(applyRounding(10.5, "ceil"), 11);
  assert.equal(applyRounding(10.5, "round"), 11);
  assert.equal(applyRounding(10.4, "round"), 10);
  assert.equal(applyRounding(10, "ceil"), 10, "割り切れるときは動かさない");
  assert.equal(applyRounding(10, "floor"), 10);
}

console.log("test_shohizei: all passed");
