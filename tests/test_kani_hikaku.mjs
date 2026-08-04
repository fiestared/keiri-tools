import assert from "node:assert";
import {
  compareMethods, kaniIsBetter, taxFromIncluded, MINASHI, TOKUREI,
} from "../docs/assets/kani_hikaku_core.js";

const amountOf = (r, key) => r.methods.find((m) => m.key === key).amount;

// ── コラム column/kani-kazei の実数と一致すること ───────────────────────
// 前提: 課税売上1,100万円(税込・10%)=売上税額100万円 / 経費550万円 / 第5種(50%)
const base = { salesIncTax: 11_000_000, purchaseIncTax: 5_500_000, kubun: 5, isIndividual: true };
let r = compareMethods(base);
assert.equal(r.salesTax, 1_000_000, "売上税額100万円");
assert.equal(amountOf(r, "honsoku"), 500_000, "本則 100万 − 50万 = 50万");
assert.equal(amountOf(r, "kani"), 500_000, "簡易 第5種 100万×(1−50%) = 50万");
assert.equal(amountOf(r, "niwari"), 200_000, "2割特例 100万×20% = 20万");
assert.equal(amountOf(r, "sanwari"), 300_000, "3割特例 100万×30% = 30万");
assert.equal(r.best.key, "niwari", "この条件では2割特例が最小");

// ── みなし仕入率6段階（施行令57条5項）と「納税額は売上税額の何%か」 ─────────
// 売上税額100万円のとき、第1種10万〜第6種60万（コラムの図と同じ）
const expected = { 1: 100_000, 2: 200_000, 3: 300_000, 4: 400_000, 5: 500_000, 6: 600_000 };
for (const k of [1, 2, 3, 4, 5, 6]) {
  const x = compareMethods({ salesIncTax: 11_000_000, purchaseIncTax: 0, kubun: k });
  assert.equal(amountOf(x, "kani"), expected[k], `第${k}種の簡易課税`);
}
assert.equal(MINASHI[1].rate, 0.9);
assert.equal(MINASHI[6].rate, 0.4);

// ── ★分岐点は「経費率 = みなし仕入率」のちょうど1点 ────────────────────
// 第5種(50%)なら経費550万円で本則と簡易が一致し、そこを境に有利が入れ替わる
assert.equal(compareMethods(base).breakEvenPurchaseIncTax, 5_500_000);
assert.equal(kaniIsBetter({ ...base, purchaseIncTax: 5_500_000 }).kaniIsBetter, false, "一致点では簡易が「有利」ではない");
assert.equal(kaniIsBetter({ ...base, purchaseIncTax: 5_499_000 }).kaniIsBetter, true, "経費が少ない側は簡易有利");
assert.equal(kaniIsBetter({ ...base, purchaseIncTax: 5_501_000 }).kaniIsBetter, false, "経費が多い側は本則有利");

// 第1種(90%)は分岐点が990万円まで上がる（経費が多くても簡易が勝ちやすい）
assert.equal(compareMethods({ ...base, kubun: 1 }).breakEvenPurchaseIncTax, 9_900_000);

// ── 経費を動かしても簡易・2割・3割は動かない（本則だけが動く） ────────────
for (const p of [2_200_000, 5_500_000, 9_900_000]) {
  const x = compareMethods({ ...base, purchaseIncTax: p });
  assert.equal(amountOf(x, "kani"), 500_000, "簡易は経費に依存しない");
  assert.equal(amountOf(x, "niwari"), 200_000, "2割は経費に依存しない");
  assert.equal(amountOf(x, "sanwari"), 300_000, "3割は経費に依存しない");
}
assert.equal(amountOf(compareMethods({ ...base, purchaseIncTax: 9_900_000 }), "honsoku"), 100_000);

// ── ★3割特例は個人事業者だけ。法人で「有利」と出してはいけない ────────────
const houjin = compareMethods({ salesIncTax: 11_000_000, purchaseIncTax: 9_900_000, kubun: 5, isIndividual: false });
assert.equal(houjin.methods.find((m) => m.key === "sanwari").available, false);
assert.notEqual(houjin.best.key, "sanwari", "法人に3割特例を勧めない");
assert.equal(TOKUREI.sanwari.individualOnly, true);

// ── 端と異常系 ──────────────────────────────────────────────────
assert.equal(compareMethods({ salesIncTax: 0, kubun: 5 }).best.amount, 0);
// 仕入税額が売上税額を超えても納付額は負にしない（還付は別の話なので0で止める）
assert.equal(amountOf(compareMethods({ salesIncTax: 1_100_000, purchaseIncTax: 3_300_000, kubun: 5 }), "honsoku"), 0);
assert.throws(() => compareMethods({ salesIncTax: 1000, kubun: 7 }), /事業区分/);
assert.throws(() => compareMethods({ salesIncTax: -1, kubun: 5 }), /0以上/);

// 税率8%（軽減）でも売上税額の取り出しが合う
assert.equal(Math.round(taxFromIncluded(10_800_000, 8)), 800_000);

console.log("✓ 消費税の方式比較 OK");
