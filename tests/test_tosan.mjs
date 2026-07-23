// 倒産防止共済(経営セーフティ共済) tosanBoshiKyosai のテスト。
//
// オラクルは実装の式ではなく**条文・公表資料を素直に書き下した独立実装**:
//  - 支給率: 中小企業倒産防止共済法施行令4条の各号を号ごとに転記(2026-07-23にe-Gov逐語取得。
//    SMRJ公式の表と完全一致を機械照合済み)。12か月未満不支給は法11条1項。
//  - 所得税: 国税庁 No.2260 の速算表。復興特別所得税2.1%・住民税所得割10%概算。
//  - 掛金の範囲: 法4条2項(5,000円以上・5,000円の整数倍・上限は掛金納付制限額800万円の1/40=20万円)。
//    掛金総額の限度800万円は法14条3項(800万円=貸付限度額8,000万円[施行令2条]の1/10)。
// さらにシナリオA/B/Cは速算表から**手計算した定数**でも固定する(オラクル自身の誤りに対する第三の網)。
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { tosanBoshiKyosai } from "../docs/assets/setsuzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/setsuzei_r08.json", import.meta.url)));

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  try { assert.deepEqual(got, want); pass++; }
  catch { fail++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

// ---- オラクル(独立実装) ----------------------------------------------------

// 所得税の速算表(No.2260)。実装のbracketsを参照せず、表をそのまま書く。
function oracleShotokuzei(kazei) {
  const x = Math.floor(Math.max(0, kazei) / 1000) * 1000;
  if (x <= 0) return 0;
  if (x <= 1949000) return Math.floor(x * 0.05);
  if (x <= 3299000) return Math.floor(x * 0.10 - 97500);
  if (x <= 6949000) return Math.floor(x * 0.20 - 427500);
  if (x <= 8999000) return Math.floor(x * 0.23 - 636000);
  if (x <= 17999000) return Math.floor(x * 0.33 - 1536000);
  if (x <= 39999000) return Math.floor(x * 0.40 - 2796000);
  return Math.floor(x * 0.45 - 4796000);
}

// 入口: 経費yで課税所得kazeiが下がる分の減税。住民税(10%概算)は**実際に下がった課税所得**
// にしか掛からない(課税所得0の人は経費を積んでも住民税は減らない)。
function oracleSetsuzei(kazei, y) {
  const dec = oracleShotokuzei(kazei) - oracleShotokuzei(Math.max(0, kazei - y));
  return dec + Math.floor(dec * 0.021) + Math.floor(Math.min(y, Math.max(0, kazei)) * 0.10);
}

// 出口: 収入teateが課税所得baseに上乗せされる分の増税。teateは全額が新たな所得なので住民税は全額に掛かる。
function oracleZouzei(base, teate) {
  const inc = oracleShotokuzei(base + teate) - oracleShotokuzei(base);
  return inc + Math.floor(inc * 0.021) + Math.floor(teate * 0.10);
}

// 施行令4条の支給率。号ごとに条文の月数帯をそのまま書く(JSONを参照しない)。
function oracleRate(months, type) {
  if (months < 12) return 0; // 法11条1項
  if (type === "kiko") { // 一号(法7条2項の解除)
    if (months <= 23) return 0.75;
    if (months <= 29) return 0.80;
    if (months <= 35) return 0.85;
    if (months <= 39) return 0.90;
    return 0.95;
  }
  if (type === "nini") { // 二号(法7条3項の解除)
    if (months <= 23) return 0.80;
    if (months <= 29) return 0.85;
    if (months <= 35) return 0.90;
    if (months <= 39) return 0.95;
    return 1.00;
  }
  if (type === "minashi") { // 三号(法7条4項のみなし解除) — 36か月以上で100%
    if (months <= 23) return 0.85;
    if (months <= 29) return 0.90;
    if (months <= 35) return 0.95;
    return 1.00;
  }
  throw new Error("unknown type");
}

// 入口〜出口をオラクルだけで組み立てる(コアと同じ前提: 各年の課税所得一定・年は月額×12区切り)。
function oracleAll(kazei, monthly, months, kaiyakuBase, type) {
  const LIMIT = 8000000;
  const capMonths = Math.ceil(LIMIT / monthly);
  const monthsPaid = Math.min(months, capMonths);
  const paidTotal = Math.min(monthly * monthsPaid, LIMIT);
  let setsuzei = 0, remaining = paidTotal;
  while (remaining > 0) {
    const y = Math.min(monthly * 12, remaining);
    setsuzei += oracleSetsuzei(kazei, y);
    remaining -= y;
  }
  const rate = oracleRate(monthsPaid, type);
  const teate = Math.floor(paidTotal * rate);
  const zouzei = oracleZouzei(kaiyakuBase, teate);
  return { monthsPaid, paidTotal, rate, teate, kakesute: paidTotal - teate,
           setsuzei, zouzei, net: setsuzei - zouzei - (paidTotal - teate) };
}

// ---- 1. 参照データの支給率表 = 施行令4条(オラクル表)の全帯一致 -------------------
console.log("1. setsuzei_r08.json の支給率表が施行令4条と一致");
for (const t of D.tosan.shikyu_ritsu.types) {
  for (let m = 1; m <= 60; m++) {
    const b = m >= 12 ? t.bands.find((x) => m >= x.from && (x.upto == null || m <= x.upto)) : null;
    eq(`${t.key} ${m}か月`, b ? b.rate : 0, oracleRate(m, t.key));
  }
}
eq("12か月未満不支給の月数(法11条1項)", D.tosan.min_months_for_teate, 12);
eq("掛金月額の下限(法4条2項)", D.tosan.monthly_min, 5000);
eq("掛金月額の上限(=800万円の1/40)", D.tosan.monthly_max, 200000);
eq("掛金月額の刻み", D.tosan.monthly_step, 5000);
eq("掛金総額の限度(法14条3項)", D.tosan.total_limit, 8000000);

// ---- 2. 掛金月額の検証(法4条2項) — 黙って丸めない ------------------------------
console.log("2. 掛金月額の範囲外を申告する");
for (const [monthly, valid] of [[4999, false], [5000, true], [5001, false], [7500, false],
                                [100000, true], [200000, true], [205000, false], [0, false]]) {
  const r = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly, months: 40 }, D);
  eq(`monthly=${monthly}`, r.monthlyValid, valid);
}

// ---- 3. 800万円の上限(法14条3項) ----------------------------------------------
console.log("3. 掛金総額の限度");
{
  const r = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 200000, months: 40 }, D);
  eq("20万×40か月=ちょうど800万", [r.paidTotal, r.capReached], [8000000, false]);
  const r2 = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 200000, months: 41 }, D);
  eq("41か月目は納付できない", [r2.monthsPaid, r2.paidTotal, r2.capReached], [40, 8000000, true]);
  const r3 = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 150000, months: 60 }, D);
  eq("15万×60か月→54か月目の残額納付で打ち止め", [r3.monthsPaid, r3.paidTotal, r3.capReached], [54, 8000000, true]);
}

// ---- 4. シナリオの固定(手計算の定数 = オラクルの外側の網) ------------------------
console.log("4. シナリオA/B/C/D(手計算定数)");
{
  // A: 課税所得500万・月10万・40か月・任意・解約年も500万 → 100%戻っても差引マイナス
  const a = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 100000, months: 40 }, D);
  eq("A 掛金総額", a.paidTotal, 4000000);
  eq("A 年数", a.years, 4);
  eq("A 満額の年の節税", a.setsuzeiPerYearFirst, 365040);
  eq("A 累計節税", a.setsuzeiTotal, 1216800);
  eq("A 支給率と手当金", [a.rate, a.teate, a.kakesute], [1.00, 4000000, 0]);
  eq("A 解約年の増税", a.zouzei.total, 1279591);
  eq("A 差引(逆ざや)", a.net, -62791);
  // B: 同条件で解約年の課税所得0 → プラスに転じる
  const b = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 100000, months: 40, kaiyakuKazeiShotoku: 0 }, D);
  eq("B 解約年の増税", b.zouzei.total, 780322);
  eq("B 差引(出口を作れば得)", b.net, 436478);
  // C: 24か月(85%)で解約 → 掛け捨て36万+増税で大きなマイナス
  const c = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 100000, months: 24 }, D);
  eq("C 手当金(85%)", [c.teate, c.kakesute], [2040000, 360000]);
  eq("C 差引", c.net, -253244);
  // D: 11か月 → 1円も支給されない(法11条1項)
  const d = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 100000, months: 11 }, D);
  eq("D 手当金0", [d.rate, d.teate, d.kakesute], [0, 0, 1100000]);
}

// ---- 5. 全域照合(コア = オラクル) -----------------------------------------------
console.log("5. 月数×種類×所得の全域でコアがオラクルと一致");
for (const type of ["nini", "minashi", "kiko"]) {
  for (const months of [1, 11, 12, 23, 24, 29, 30, 35, 36, 39, 40, 54, 120]) {
    for (const kazei of [0, 1949000, 3000000, 5000000, 9000000, 20000000]) {
      const got = tosanBoshiKyosai({ kazeiShotoku: kazei, monthly: 100000, months, kaiyakuType: type }, D);
      const want = oracleAll(kazei, 100000, months, kazei, type);
      eq(`${type}/${months}m/kazei${kazei}`,
         [got.monthsPaid, got.paidTotal, got.rate, got.teate, got.kakesute, got.setsuzeiTotal, got.zouzei.total, got.net],
         [want.monthsPaid, want.paidTotal, want.rate, want.teate, want.kakesute, want.setsuzei, want.zouzei, want.net]);
    }
  }
}

// ---- 6. 解約年の課税所得を別に渡す(出口の設計) -----------------------------------
console.log("6. 解約年の課税所得");
for (const kaiyaku of [0, 1000000, 5000000]) {
  const got = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 100000, months: 40, kaiyakuKazeiShotoku: kaiyaku }, D);
  const want = oracleAll(5000000, 100000, 40, kaiyaku, "nini");
  eq(`解約年${kaiyaku}`, [got.kaiyakuBase, got.zouzei.total, got.net], [kaiyaku, want.zouzei, want.net]);
}
{
  // 空文字は「同じ」の意味(ページの空欄がそのまま渡ってくる)
  const r = tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 100000, months: 40, kaiyakuKazeiShotoku: "" }, D);
  eq("空欄=拠出時と同じ", r.kaiyakuBase, 5000000);
}

// ---- 7. データ欠落は例外(fail closed) --------------------------------------------
console.log("7. fail closed");
{
  let threw = false;
  try { tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 100000, months: 40 }, {}); } catch { threw = true; }
  eq("tosanデータ無しで例外", threw, true);
  let threw2 = false;
  try { tosanBoshiKyosai({ kazeiShotoku: 5000000, monthly: 100000, months: 40, kaiyakuType: "sonzai_shinai" }, D); } catch { threw2 = true; }
  eq("不正な解約種類で例外", threw2, true);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
