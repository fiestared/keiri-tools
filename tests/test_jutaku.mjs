/**
 * 住宅ローン控除（住宅借入金等特別控除・新築／買取再販）の単体テスト。
 *
 * ★いちばん効いている検査は「外部オラクル」。
 *   国税庁 No.1211-1 は表の中に、住宅区分×入居年ごとの**控除限度額**（各年の控除額の天井）を
 *   カッコ書きで公表している：35万円 / 31.5万円 / 28万円 / 24.5万円 / 21万円 / 14万円。
 *   このコアは JSON に**借入限度額**（5,000万・4,500万…）だけを持ち、控除限度額は 0.7％ を掛けて出す。
 *   → 借入限度額を超える残高を入れたときの年間控除額が、公表された6つの控除限度額に一致すれば、
 *     「控除率0.7％・100円未満切捨・借入限度額の天井」が全部正しく噛み合っている証拠になる。
 *   （控除限度額を JSON に直接持たせず“再現”させることで、率や丸めのバグが必ず表に出る）
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { calc, resolveGendo } from "../docs/assets/jutaku_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/jutaku_r07.json", import.meta.url)));
let n = 0;
const eq = (a, b, msg) => { assert.strictEqual(a, b, `${msg}: ${a} ≠ ${b}`); n++; };
const ok = (c, msg) => { assert.ok(c, msg); n++; };

// 借入限度額を必ず超える残高（＝控除額が天井＝控除限度額に張り付く）
const BIG = 60000000;

// ===== 1. 外部オラクル：国税庁 No.1211-1 が公表する控除限度額（6つ）を再現する =====
// 認定住宅
eq(calc({ kubun: "nintei", year: 2022, nenmatsuZandaka: BIG }, D).nenkanKoujo, 350000,
  "★認定・令和4年：控除限度額35万円（借入5,000万×0.7％）");
eq(calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG }, D).nenkanKoujo, 315000,
  "★認定・令和6年（一般）：控除限度額31.5万円（借入4,500万×0.7％）");
eq(calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).nenkanKoujo, 350000,
  "★★認定・令和6年（子育て特例）：借入5,000万に上乗せ→35万円");
// ZEH水準省エネ住宅
eq(calc({ kubun: "zeh", year: 2022, nenmatsuZandaka: BIG }, D).nenkanKoujo, 315000,
  "★ZEH・令和4年：控除限度額31.5万円（借入4,500万）");
eq(calc({ kubun: "zeh", year: 2025, nenmatsuZandaka: BIG }, D).nenkanKoujo, 245000,
  "★ZEH・令和7年（一般）：控除限度額24.5万円（借入3,500万）");
eq(calc({ kubun: "zeh", year: 2025, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).nenkanKoujo, 315000,
  "★★ZEH・令和7年（子育て特例）：借入4,500万→31.5万円");
// 省エネ基準適合住宅
eq(calc({ kubun: "shoene", year: 2023, nenmatsuZandaka: BIG }, D).nenkanKoujo, 280000,
  "★省エネ・令和5年：控除限度額28万円（借入4,000万）");
eq(calc({ kubun: "shoene", year: 2024, nenmatsuZandaka: BIG }, D).nenkanKoujo, 210000,
  "★省エネ・令和6年（一般）：控除限度額21万円（借入3,000万）");
eq(calc({ kubun: "shoene", year: 2024, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).nenkanKoujo, 280000,
  "★★省エネ・令和6年（子育て特例）：借入4,000万→28万円");
// その他の住宅
eq(calc({ kubun: "sonota", year: 2022, nenmatsuZandaka: BIG }, D).nenkanKoujo, 210000,
  "★その他・令和4年：控除限度額21万円（借入3,000万・控除期間13年）");

// ===== 2. ★★「その他の住宅」令和6・7年入居は原則0円（黙って21万をもらえると言わない）=====
{
  const r = calc({ kubun: "sonota", year: 2024, nenmatsuZandaka: BIG }, D);
  eq(r.nenkanKoujo, 0, "★★その他・令和6年（一般）：控除なし＝0円");
  eq(r.sonotaZero, true, "その他・令和6年は sonotaZero フラグが立つ");
  eq(r.eligible, false, "その他・令和6年（経過措置なし）は対象外");
  eq(r.kikan, 0, "控除期間0年");
}
{
  // 経過措置（令和5年末までに建築確認 等）に該当 → 2,000万・10年・14万円で復活
  const r = calc({ kubun: "sonota", year: 2024, nenmatsuZandaka: BIG, keikaSochi: true }, D);
  eq(r.nenkanKoujo, 140000, "★その他・令和6年＋経過措置：控除限度額14万円（借入2,000万×0.7％）");
  eq(r.kikan, 10, "経過措置は控除期間10年");
  eq(r.keikaApplied, true, "keikaApplied フラグが立つ");
  eq(r.soKoujoGaisan, 1400000, "総控除額の上限概算＝14万×10年＝140万円");
}

// ===== 3. 各年の控除額は年末残高で決まる（天井に達しない普通のケース）=====
{
  // 認定・令和4年（借入限度5,000万）、年末残高2,000万 → 2,000万×0.7％＝14万円
  const r = calc({ kubun: "nintei", year: 2022, nenmatsuZandaka: 20000000 }, D);
  eq(r.koujoTaisho, 20000000, "控除対象額＝年末残高（限度額未満）");
  eq(r.nenkanKoujo, 140000, "年末残高2,000万×0.7％＝14万円");
  eq(r.soKoujoGaisan, 1820000, "総控除額の上限概算＝14万×13年（残高一定と仮定した上限）");
}
{
  // 100円未満切り捨て：残高33,333,333円 → ×0.7％＝233,333.331 → 233,300円
  const r = calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: 33333333 }, D);
  eq(r.nenkanKoujo, 233300, "★100円未満切り捨て（233,333.331→233,300）");
}
{
  // 取得対価が年末残高より少なければ、取得対価が控除対象（＝ローンが家より大きい人）
  const r = calc({ kubun: "shoene", year: 2023, nenmatsuZandaka: 30000000, shutokuTaika: 25000000 }, D);
  eq(r.koujoTaisho, 25000000, "控除対象＝min(年末残高, 取得対価)＝取得対価2,500万");
  eq(r.nenkanKoujo, 175000, "2,500万×0.7％＝175,000円");
}

// ===== 4. 所得要件・床面積要件（入力があるときだけ判定）=====
{
  // 合計所得2,000万円超は対象外
  const r = calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, goukeiShotoku: 25000000 }, D);
  eq(r.incomeOver, true, "合計所得2,000万円超→incomeOver");
  eq(r.eligible, false, "所得オーバーは対象外");
  eq(r.nenkanKoujo, 0, "対象外なので控除額0");
}
{
  // 特例居住用家屋（床面積40〜50㎡未満）は所得要件が1,000万円以下と厳しい
  const r = calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, menseki: 45, goukeiShotoku: 15000000 }, D);
  eq(r.mensekiStatus, "shokibo", "床面積45㎡は特例居住用家屋（小規模）");
  eq(r.shotokuLimit, 10000000, "特例居住用家屋の所得要件は1,000万円以下");
  eq(r.incomeOver, true, "所得1,500万>1,000万→対象外");
}
{
  // 同じ45㎡でも所得900万なら対象
  const r = calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, menseki: 45, goukeiShotoku: 9000000 }, D);
  eq(r.eligible, true, "床面積45㎡・所得900万は対象");
  eq(r.nenkanKoujo, 315000, "控除額は通常どおり31.5万円");
}
{
  // 床面積40㎡未満は対象外
  const r = calc({ kubun: "shoene", year: 2024, nenmatsuZandaka: BIG, menseki: 35 }, D);
  eq(r.mensekiStatus, "too_small", "35㎡は床面積不足");
  eq(r.eligible, false, "40㎡未満は対象外");
}
{
  // 50㎡以上・所得1,800万なら通常の2,000万要件で対象
  const r = calc({ kubun: "shoene", year: 2024, nenmatsuZandaka: BIG, menseki: 70, goukeiShotoku: 18000000 }, D);
  eq(r.mensekiStatus, "ok", "70㎡は通常");
  eq(r.shotokuLimit, 20000000, "通常の所得要件2,000万円");
  eq(r.eligible, true, "所得1,800万<2,000万→対象");
}

// ===== 5. 控除率は0.7％であって1％ではない（令和4年以降）=====
{
  const r = calc({ kubun: "nintei", year: 2022, nenmatsuZandaka: BIG }, D);
  eq(r.koujoRitsuPct, 0.7, "控除率は0.7％");
  ok(r.nenkanKoujo === 350000 && r.nenkanKoujo !== 500000,
    "★借入5,000万でも35万円（1％なら50万になる＝過大表示のバグ）");
}

// ===== 6. 中古・増改築・収録範囲外は「黙って答えない」（fail closed）=====
{
  const r = calc({ type: "chuko", kubun: "nintei", year: 2024, nenmatsuZandaka: BIG }, D);
  eq(r.beyondData, true, "★中古はbeyondData（この regime の数字で答えない）");
  eq(r.eligible, false, "中古は対象外扱い");
  ok(r.nenkanKoujo === undefined, "中古は控除額を計算しない");
  ok(/中古|既存/.test(r.reason), "理由に中古/既存が入る");
}
{
  const r = calc({ type: "zokaichiku", kubun: "shoene", year: 2024, nenmatsuZandaka: BIG }, D);
  eq(r.beyondData, true, "★増改築はbeyondData");
}
{
  // 収録外の入居年（令和3年＝2021、令和8年＝2026）
  eq(calc({ kubun: "nintei", year: 2021, nenmatsuZandaka: BIG }, D).beyondData, true,
    "★令和3年入居は収録外（別の表・控除率1％）");
  eq(calc({ kubun: "nintei", year: 2026, nenmatsuZandaka: BIG }, D).beyondData, true,
    "★令和8年入居は収録外（税制改正で未確定）");
}

// ===== 7. 特例上乗せは令和6・7年にだけ効く（令和4・5年にフラグを立てても素通し）=====
eq(calc({ kubun: "nintei", year: 2022, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).tokureiApplied, false,
  "令和4年入居に子育て特例の上乗せは無い（フラグは素通し）");
eq(calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).tokureiApplied, true,
  "令和6年入居は子育て特例の上乗せが効く");

// ===== 8. resolveGendo 単体（表の引き方）=====
eq(resolveGendo("nintei", 2024, false, false, D).gendoMan, 4500, "認定・令和6年（一般）借入限度4,500万");
eq(resolveGendo("nintei", 2024, true, false, D).gendoMan, 5000, "認定・令和6年（特例）借入限度5,000万");
eq(resolveGendo("sonota", 2024, false, false, D).zero, true, "その他・令和6年は0");
eq(resolveGendo("sonota", 2024, false, true, D).gendoMan, 2000, "その他・令和6年＋経過措置は2,000万");
eq(resolveGendo("nintei", 2020, false, false, D), null, "収録外の年は null");
eq(resolveGendo("unknown", 2024, false, false, D), null, "不明な区分は null");

// ===== 9. fail closed：参照データを渡さないと例外 =====
assert.throws(() => calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG }, undefined),
  /参照データ/, "Dを渡さないと例外（黙って0を返さない）");
n++;

console.log(`test_jutaku: ${n} checks OK`);
