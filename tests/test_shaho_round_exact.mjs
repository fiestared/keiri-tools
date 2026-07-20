/**
 * 端数処理（50銭以下切捨・50銭超切上）の**厳密**全数照合。
 *
 * なぜ test_shaho_oracle.mjs（東京の公式額表と照合）だけでは足りないか:
 *   あちらは全額・折半額（端数処理**前**）を照合しており、被保険者負担（端数処理**後**）は
 *   東京の代表ケースしか見ていなかった。旧実装 `frac > 0.5` は浮動小数のまま比べていたため、
 *   50銭**ちょうど**の組合せ（例: 新潟9.21%×標準報酬110,000円 → 折半5,065.50円）が
 *   二進小数の誤差で 5,065.500000000001 になり、「50銭以下切捨」のはずが5,066円（+1円・
 *   本人負担が過大）になっていた。50等級×47都道府県×介護有無の全組合せ中304件が+1円
 *   （2026-07-19レビューで実測）。東京だけ照合していたのでは見えない。
 *
 * ここでは BigInt（0.1銭単位の整数）で「真の折半額」と「正しい端数処理」を独立に計算し、
 * 実装（calcMonthly / calcBonus / calcKoyou）の被保険者負担額と**全数**照合する。
 *   標準報酬月額は1,000円の倍数・料率は小数2桁% なので、0.1銭単位では厳密な整数になる。
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  calcMonthly, calcBonus, calcKoyou, roundHalf, KENKO_GRADES,
} from "../docs/assets/shaho_core.js";

const RATES = JSON.parse(readFileSync(new URL("../docs/assets/shaho_rates_r08.json", import.meta.url)));
const KOSEI = RATES.kosei_nenkin_rate;      // 18.3
const KOSODATE = RATES.kosodate_rate;       // 0.23
const KAIGO = RATES.kaigo_rate;             // 1.62

/** 料率(%)→ベーシスポイント(百分率×100)の整数。9.21% → 921 */
const bp = (pct) => {
  const v = Math.round(pct * 100);
  assert.ok(Math.abs(pct * 100 - v) < 1e-6, `料率 ${pct}% が小数2桁でない`);
  return v;
};

/**
 * 厳密オラクル: 標準報酬(1,000円の倍数)×料率bp → 被保険者負担（円）。
 * 折半額を0.1銭単位の BigInt で持ち、50銭以下切捨・50銭超切上。
 */
const selfExact = (std, rateBp) => {
  assert.equal(std % 1000, 0, `標準報酬 ${std} が1,000円の倍数でない`);
  const half10sen = (BigInt(std) * BigInt(rateBp)) / 20n; // std×(bp/10000)円÷2 ×1000(0.1銭)
  assert.equal((BigInt(std) * BigInt(rateBp)) % 20n, 0n, "0.1銭単位で割り切れない");
  const int = half10sen / 1000n;
  const frac = half10sen % 1000n;
  return Number(frac > 500n ? int + 1n : int);
};

// --- 1. 全50等級 × 47都道府県 × 介護有無 × {健保, 支援金, 厚年} を厳密照合 ------
const prefs = Object.keys(RATES.kenko_rates);
assert.equal(prefs.length, 47, "都道府県が47ない");

let checked = 0;
let exactHalfSen = 0; // 50銭ちょうどの組合せ数（旧実装が+1円にし得た形）
for (const pref of prefs) {
  const kenkoRate = RATES.kenko_rates[pref];
  for (const [, std] of KENKO_GRADES) {
    for (const age of [30, 45]) { // 介護なし / あり
      const r = calcMonthly(std, kenkoRate, KAIGO, age, KOSEI, KOSODATE);
      const kkBp = bp(kenkoRate) + (age === 45 ? bp(KAIGO) : 0);
      const wantKK = selfExact(std, kkBp);
      const wantKosodate = selfExact(std, bp(KOSODATE));
      const wantKosei = selfExact(r.koseiStandard, bp(KOSEI));
      assert.equal(r.kenkoKaigo.self, wantKK,
        `${pref} 標準報酬${std} 健保${age === 45 ? "+介護" : ""} 本人負担`);
      assert.equal(r.kosodate.self, wantKosodate, `${pref} 標準報酬${std} 支援金 本人負担`);
      assert.equal(r.kosei.self, wantKosei, `${pref} 標準報酬${std} 厚年 本人負担`);
      assert.equal(r.selfTotal, wantKK + wantKosodate + wantKosei,
        `${pref} 標準報酬${std} 本人負担合計`);
      if ((BigInt(std) * BigInt(kkBp) / 20n) % 1000n === 500n) exactHalfSen++;
      checked++;
    }
  }
}
assert.equal(checked, 50 * 47 * 2, "全数照合の件数");
// 50銭ちょうどの組合せが実在すること（この形が1件も無ければ、このテストは何も守っていない）
assert.ok(exactHalfSen > 0, "50銭ちょうどの組合せが1件もない（オラクルの前提を確認せよ）");

// --- 2. 旧実装が+1円にしていた代表ケースを実額で固定（回帰防止の名指し） ----------
// 新潟県 9.21% × 標準報酬110,000円: 折半 5,065.50円 → 50銭「以下」は切捨 → 5,065円。
// 旧実装は浮動小数の誤差（5,065.500000000001 > 0.5）で 5,066円 と答えていた。
{
  assert.equal(RATES.kenko_rates["新潟県"], 9.21, "新潟県の健保料率(前提)");
  const r = calcMonthly(110000, 9.21, KAIGO, 30, KOSEI, KOSODATE);
  // half は公式額表との照合用に浮動小数のまま持つ設計（表示は銭単位）なので、銭未満の誤差だけ許す
  assert.ok(Math.abs(r.kenkoKaigo.half - 5065.5) < 0.005, `折半額は5,065.50円（実際 ${r.kenkoKaigo.half}）`);
  assert.equal(r.kenkoKaigo.self, 5065, "50銭ちょうどは切捨（5,066円ではない）");
}
// roundHalf 単体の境界: 50銭ちょうど=切捨 / 50銭超=切上
assert.equal(roundHalf(5065.5), 5065, "50銭ちょうどは切捨");
assert.equal(roundHalf(5065.51), 5066, "50銭超は切上");
assert.equal(roundHalf(5065.4999), 5065, "50銭未満は切捨");

// --- 3. 賞与too: 同じ端数処理が calcBonus でも成り立つこと ----------------------
{
  // 標準賞与額110,000円（1,000円未満切捨後）× 新潟9.21% → 同じ50銭ちょうど
  const b = calcBonus(110999, 9.21, KAIGO, 30, KOSEI, 0, KOSODATE);
  assert.equal(b.standardBonus, 110000, "標準賞与額は1,000円未満切捨");
  assert.equal(b.kenkoKaigo.self, 5065, "賞与でも50銭ちょうどは切捨");
}

// --- 4. 雇用保険: 賃金は1,000円の倍数とは限らない。50.5銭（>50銭）は切上のまま ----
// 旧実装が偶然正しく扱えていた領域を、整数化で壊していないことの確認。
// 賃金101円 × 5/1000 = 0.505円 = 50.5銭 → 50銭「超」なので切上 → 1円。
{
  const k = calcKoyou(101, 13.5, 3.5); // 一般の事業: 本人5/1000
  assert.equal(k.selfRaw * 1000, 505, "0.1銭単位で505（=50.5銭）");
  assert.equal(k.self, 1, "50.5銭は50銭超 → 切上で1円");
  const k2 = calcKoyou(100, 13.5, 3.5); // 0.5円 = 50銭ちょうど → 切捨
  assert.equal(k2.self, 0, "50銭ちょうどは切捨で0円");
}

console.log(`all shaho round-exact tests passed (${checked}組合せ全数照合 / 50銭ちょうど${exactHalfSen}件)`);
