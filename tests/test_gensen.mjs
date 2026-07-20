import assert from "node:assert";
import {
  calcWithholding, withholdingTarget, RATE_LOW, THRESHOLD, FIXED_ADD,
} from "../docs/assets/gensen_core.js";

// 国税庁 No.2795/2798 の具体例: 150万円の原稿料 → 204,200円
{
  const r = calcWithholding(1500000, "general");
  // (150万 - 100万) x 20.42% + 102,100 = 102,100 + 102,100 = 204,200
  assert.equal(r.tax, 204200);
  assert.equal(r.net, 1500000 - 204200);
}

// 100万円ちょうどは10.21%(境界)
assert.equal(calcWithholding(1000000, "general").tax, Math.floor(1000000 * RATE_LOW)); // 102,100
assert.equal(calcWithholding(1000000, "general").tax, 102100);
// 100万円を1円超えると高い方の式へ。ただし連続している(段差がない)
{
  const a = calcWithholding(1000000, "general").tax;
  const b = calcWithholding(1000001, "general").tax;
  assert.equal(b, Math.floor(1 * 0.2042 + FIXED_ADD)); // 102,100
  assert.ok(b >= a, "境界で税額が下がってはいけない");
}

// 一般: 10万円 → 10,210円
assert.equal(calcWithholding(100000, "general").tax, 10210);
// 端数は切り捨て: 33,333円 x 10.21% = 3,403.29... → 3,403
assert.equal(calcWithholding(33333, "general").tax, 3403);

// 国税庁 No.2801 の具体例: 司法書士に5万円 → 4,084円
{
  const r = calcWithholding(50000, "shiho");
  assert.equal(r.tax, 4084);
  assert.equal(r.base, 40000);
}
// 司法書士: 1万円以下なら税額0
assert.equal(calcWithholding(10000, "shiho").tax, 0);
assert.equal(calcWithholding(8000, "shiho").tax, 0);

// 診療報酬: 月20万円までは源泉徴収なし
assert.equal(calcWithholding(200000, "diagnosis").tax, 0);
assert.equal(calcWithholding(300000, "diagnosis").tax, Math.floor(100000 * RATE_LOW)); // 10,210

// 消費税の扱い(実務で最も間違えるところ)
{
  // 区分あり → 税抜の報酬額のみが対象
  const sep = withholdingTarget(100000, 0.1, true);
  assert.equal(sep.target, 100000);
  assert.equal(sep.total, 110000);
  assert.equal(calcWithholding(sep.target, "general").tax, 10210);

  // 区分なし → 税込全体が対象
  const inc = withholdingTarget(100000, 0.1, false);
  assert.equal(inc.target, 110000);
  assert.equal(calcWithholding(inc.target, "general").tax, 11231); // 110,000 x 10.21%

  // ★消費税なし(不課税・免税) → 報酬額そのもの。説明文が「区分されていないため税込全体が対象」
  //   と名乗ってはいけない(消費税が存在しないのだから「区分」の話ではない。2026-07-19レビュー)
  const none = withholdingTarget(100000, 0, false);
  assert.equal(none.target, 100000);
  assert.equal(none.total, 100000);
  assert.ok(none.explain.includes("不課税・免税"), "消費税なしの説明文を名乗る");
  assert.ok(!none.explain.includes("区分されていない"), "「区分されていない」と言わない");
}

// 0円・負の入力で壊れない
assert.equal(calcWithholding(0, "general").tax, 0);
assert.equal(calcWithholding(-100, "general").tax, 0);

console.log("all gensen_core tests passed");
