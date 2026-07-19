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
import { calc, resolveGendo, juminzeiKoujo } from "../docs/assets/jutaku_core.js";

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

// ===== 6. 中古（既存住宅・No.1211-3）— 新築と別レジーム。外部オラクル＝公表控除限度額21万/14万 =====
// ★No.1211-3 が公表する控除限度額：認定住宅等（認定/ZEH/省エネ）21万円・その他14万円、控除期間は一律10年。
//   JSON には借入限度額（3,000万/2,000万）だけを持たせ、0.7％を掛けてこの2値を再現する。
{
  const r = calc({ type: "chuko", kubun: "nintei", year: 2024, nenmatsuZandaka: BIG }, D);
  eq(r.beyondData, false, "★中古は計算する（beyondDataにしない）");
  eq(r.eligible, true, "中古・認定住宅等は対象");
  eq(r.nenkanKoujo, 210000, "★中古・認定住宅等：控除限度額21万円（借入3,000万×0.7％）");
  eq(r.kikan, 10, "★中古の控除期間は一律10年（新築13年より短い）");
  eq(r.shakunyuGendoEn, 30000000, "中古・認定住宅等の借入限度額3,000万円");
  eq(r.soKoujoGaisan, 2100000, "総控除額の上限概算＝21万×10年＝210万円");
  eq(r.isChuko, true, "isChukoフラグが立つ");
}
// ZEH・省エネも中古では「認定住宅等」に一本化＝どれも3,000万・21万円
eq(calc({ type: "chuko", kubun: "zeh", year: 2025, nenmatsuZandaka: BIG }, D).nenkanKoujo, 210000,
  "★中古・ZEHも認定住宅等＝21万円（新築のように区分ごとに分かれない）");
eq(calc({ type: "chuko", kubun: "shoene", year: 2022, nenmatsuZandaka: BIG }, D).nenkanKoujo, 210000,
  "★中古・省エネも認定住宅等＝21万円");
// ★★中古の「その他の住宅」は令和6・7年入居でも0円にならない（新築との決定的な違い）
{
  const r6 = calc({ type: "chuko", kubun: "sonota", year: 2024, nenmatsuZandaka: BIG }, D);
  eq(r6.nenkanKoujo, 140000, "★★中古・その他・令和6年：14万円（新築と違い0円にならない！）");
  eq(r6.sonotaZero, false, "中古のその他は sonotaZero が立たない");
  eq(r6.eligible, true, "中古・その他・令和6年は対象");
  eq(r6.kikan, 10, "中古・その他も控除期間10年");
  eq(r6.shakunyuGendoEn, 20000000, "中古・その他の借入限度額2,000万円");
}
eq(calc({ type: "chuko", kubun: "sonota", year: 2022, nenmatsuZandaka: BIG }, D).nenkanKoujo, 140000,
  "中古・その他・令和4年も14万円（令和4〜7年で一律）");
// 年末残高が限度額未満なら残高で決まる（中古も同じ）
eq(calc({ type: "chuko", kubun: "nintei", year: 2024, nenmatsuZandaka: 20000000 }, D).nenkanKoujo, 140000,
  "中古・認定・年末残高2,000万→14万円（借入限度3,000万に届かない）");
// ★中古には子育て特例の上乗せが無い（フラグを立てても素通し）
{
  const r = calc({ type: "chuko", kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, kosodateTokurei: true }, D);
  eq(r.tokureiApplied, false, "★中古に子育て特例の上乗せは無い（フラグ素通し）");
  eq(r.nenkanKoujo, 210000, "上乗せされず21万円のまま（新築なら35万円に上がるが中古は上がらない）");
}
// ★中古には経過措置が無い（そもそも0円にならないので不要。フラグ素通し）
eq(calc({ type: "chuko", kubun: "sonota", year: 2024, nenmatsuZandaka: BIG, keikaSochi: true }, D).keikaApplied, false,
  "★中古に経過措置の概念は無い（フラグ素通し）");
// ★中古の床面積要件は50㎡以上（新築の40〜50㎡＝小規模居住用家屋の特例は中古に無い）
{
  const r = calc({ type: "chuko", kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, menseki: 45 }, D);
  eq(r.mensekiStatus, "too_small", "★中古・45㎡は対象外（新築なら小規模で対象になるが中古は50㎡未満で不可）");
  eq(r.eligible, false, "中古・45㎡は控除を受けられない");
  eq(r.mensekiFloor, 50, "中古の床面積の下限は50㎡");
}
{
  const r = calc({ type: "chuko", kubun: "shoene", year: 2024, nenmatsuZandaka: BIG, menseki: 55, goukeiShotoku: 18000000 }, D);
  eq(r.mensekiStatus, "ok", "中古・55㎡は要件を満たす");
  eq(r.shotokuLimit, 20000000, "中古の所得要件は2,000万円（小規模の1,000万円枠は無い）");
  eq(r.eligible, true, "中古・55㎡・所得1,800万は対象");
}
eq(calc({ type: "chuko", kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, goukeiShotoku: 25000000 }, D).eligible, false,
  "中古・合計所得2,000万円超は対象外");
// 中古の収録外の入居年・区分は beyondData
eq(calc({ type: "chuko", kubun: "nintei", year: 2021, nenmatsuZandaka: BIG }, D).beyondData, true,
  "★中古・令和3年入居は収録外");
eq(calc({ type: "chuko", kubun: "nintei", year: 2028, nenmatsuZandaka: BIG }, D).beyondData, true,
  "★中古・令和10年入居は収録外（法定済みだが41条25項の段差があり1年ずつ収録する方針）");
eq(calc({ type: "chuko", kubun: "unknown", year: 2024, nenmatsuZandaka: BIG }, D).beyondData, true,
  "中古・不明な区分は beyondData");

// ===== 6b. 増改築・想定外typeは「黙って答えない」（fail closed）=====
{
  const r = calc({ type: "zokaichiku", kubun: "shoene", year: 2024, nenmatsuZandaka: BIG }, D);
  eq(r.beyondData, true, "★増改築はbeyondData（No.1211-4＝別の計算方法）");
  ok(r.nenkanKoujo === undefined, "増改築は控除額を計算しない");
  ok(/増改築/.test(r.reason), "理由に増改築が入る");
}
eq(calc({ type: "foobar", kubun: "nintei", year: 2024, nenmatsuZandaka: BIG }, D).beyondData, true,
  "★想定外のtypeは beyondData（新築の数字を誤って当てない）");
{
  // 収録外の入居年（令和3年＝2021、令和10年＝2028）— 新築
  eq(calc({ kubun: "nintei", year: 2021, nenmatsuZandaka: BIG }, D).beyondData, true,
    "★令和3年入居は収録外（別の表・控除率1％）");
  eq(calc({ kubun: "nintei", year: 2028, nenmatsuZandaka: BIG }, D).beyondData, true,
    "★令和10年入居は収録外（法定済みだが41条25項の段差があり1年ずつ収録する方針）");
}

// ===== 7. 特例上乗せは令和6年以降に効く（令和4・5年にフラグを立てても素通し）=====
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
// 中古（type='chuko'）… 認定住宅等3,000万・その他2,000万、控除期間10年、特例・経過措置は素通し
eq(resolveGendo("nintei", 2024, false, false, D, "chuko").gendoMan, 3000, "中古・認定住宅等は3,000万");
eq(resolveGendo("nintei", 2024, false, false, D, "chuko").kikan, 10, "中古の控除期間は10年");
eq(resolveGendo("sonota", 2024, false, false, D, "chuko").gendoMan, 2000, "中古・その他は2,000万（0円にならない）");
eq(resolveGendo("nintei", 2024, true, true, D, "chuko").tokureiApplied, false, "中古は子育て特例が素通し");
eq(resolveGendo("nintei", 2021, false, false, D, "chuko"), null, "中古・収録外の年は null");

// ===== 8b. ★令和8年（2026）入居 — 令和8年度税制改正（措法41条・令和8年法律第12号）=====
// ★外部オラクル＝改正後の条文の借入限度額（41条3・7・9項）× 0.7％（100円未満切捨）を再現する。
//   新築: 認定4,500万→31.5万円／ZEH 3,500万→24.5万円／省エネ2,000万→14万円（13年）。
//   上乗せ: 認定5,000万→35万円／ZEH 4,500万→31.5万円／省エネ3,000万→21万円。
//   中古: 認定・ZEH 3,500万→24.5万円・13年／省エネ2,000万→14万円・13年／その他2,000万→14万円・10年。
// 新築（借入限度額と控除期間）
{
  const r = calc({ kubun: "nintei", year: 2026, nenmatsuZandaka: BIG }, D);
  eq(r.beyondData, false, "★令和8年入居は収録済み（beyondDataにしない）");
  eq(r.nenkanKoujo, 315000, "★新築・認定・令和8年：4,500万×0.7％＝31.5万円");
  eq(r.kikan, 13, "新築・認定・令和8年は13年");
}
eq(calc({ kubun: "nintei", year: 2026, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).nenkanKoujo, 350000,
  "★新築・認定・令和8年（子育て特例）：5,000万→35万円");
eq(calc({ kubun: "zeh", year: 2026, nenmatsuZandaka: BIG }, D).nenkanKoujo, 245000,
  "★新築・ZEH・令和8年：3,500万→24.5万円");
eq(calc({ kubun: "zeh", year: 2026, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).nenkanKoujo, 315000,
  "★新築・ZEH・令和8年（子育て特例）：4,500万→31.5万円");
{
  // ★新築・省エネは令和8年で3,000万→2,000万に下がる（期間13年は変わらず）
  const r = calc({ kubun: "shoene", year: 2026, nenmatsuZandaka: BIG }, D);
  eq(r.nenkanKoujo, 140000, "★★新築・省エネ・令和8年：2,000万→14万円（令和7年の21万円から下がった）");
  eq(r.kikan, 13, "新築・省エネ・令和8年も控除期間は13年（10年に混同しない）");
}
eq(calc({ kubun: "shoene", year: 2026, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).nenkanKoujo, 210000,
  "★新築・省エネ・令和8年（子育て特例）：3,000万→21万円（令和6・7年の4,000万と混同しない）");
// ★その他の住宅は令和8年入居も原則0円。経過措置（建築日で決まる＝居住年の限定なし）は令和8年にも生きる
{
  const r = calc({ kubun: "sonota", year: 2026, nenmatsuZandaka: BIG }, D);
  eq(r.nenkanKoujo, 0, "★★その他・令和8年（一般）：新築は0円のまま");
  eq(r.sonotaZero, true, "その他・令和8年は sonotaZero が立つ");
}
{
  const r = calc({ kubun: "sonota", year: 2026, nenmatsuZandaka: BIG, keikaSochi: true }, D);
  eq(r.nenkanKoujo, 140000, "★その他・令和8年＋経過措置：2,000万・14万円（措令26条43項＝居住年の限定なし）");
  eq(r.kikan, 10, "経過措置は10年のまま");
}
// ★★中古（既存住宅）— 令和8年の再編: 認定・ZEHは3,500万・13年へ、省エネは2,000万・13年へ、その他は2,000万・10年のまま
{
  const r = calc({ type: "chuko", kubun: "nintei", year: 2026, nenmatsuZandaka: BIG }, D);
  eq(r.nenkanKoujo, 245000, "★★中古・認定・令和8年：3,500万×0.7％＝24.5万円（令和7年の21万円から上がった）");
  eq(r.kikan, 13, "★★中古・認定・令和8年は控除期間13年（令和7年以前の10年から延長）");
  eq(r.soKoujoGaisan, 3185000, "総控除額の上限概算＝24.5万×13年＝318.5万円");
}
eq(calc({ type: "chuko", kubun: "zeh", year: 2026, nenmatsuZandaka: BIG }, D).nenkanKoujo, 245000,
  "★中古・ZEH・令和8年も3,500万＝24.5万円");
{
  const r = calc({ type: "chuko", kubun: "shoene", year: 2026, nenmatsuZandaka: BIG }, D);
  eq(r.nenkanKoujo, 140000, "★★中古・省エネ・令和8年：2,000万＝14万円（令和7年の21万円から下がる！）");
  eq(r.kikan, 13, "中古・省エネ・令和8年も13年（認定住宅等なので）");
}
{
  const r = calc({ type: "chuko", kubun: "sonota", year: 2026, nenmatsuZandaka: BIG }, D);
  eq(r.nenkanKoujo, 140000, "中古・その他・令和8年：2,000万＝14万円のまま");
  eq(r.kikan, 10, "★中古・その他・令和8年は10年のまま（認定住宅等の13年と混同しない）");
}
// ★★令和8年から子育て特例の上乗せが中古にも効く（令和7年以前は素通し＝退行検査も）
{
  const r = calc({ type: "chuko", kubun: "nintei", year: 2026, nenmatsuZandaka: BIG, kosodateTokurei: true }, D);
  eq(r.tokureiApplied, true, "★★中古・令和8年は子育て特例の上乗せが効く（改正の目玉）");
  eq(r.nenkanKoujo, 315000, "中古・認定・令和8年（子育て特例）：4,500万→31.5万円");
}
eq(calc({ type: "chuko", kubun: "shoene", year: 2026, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).nenkanKoujo, 210000,
  "★中古・省エネ・令和8年（子育て特例）：3,000万→21万円");
eq(calc({ type: "chuko", kubun: "sonota", year: 2026, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).tokureiApplied, false,
  "中古・その他には令和8年も上乗せが無い（フラグ素通し）");
eq(calc({ type: "chuko", kubun: "nintei", year: 2025, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).tokureiApplied, false,
  "★退行検査：中古・令和7年入居に上乗せは無いまま（素通し）");
// ★中古の床面積: 令和8年から40㎡以上で対象（40〜50㎡は所得1,000万円以下の年のみ）。令和7年以前は50㎡のまま
{
  const r = calc({ type: "chuko", kubun: "nintei", year: 2026, nenmatsuZandaka: BIG, menseki: 45 }, D);
  eq(r.mensekiStatus, "shokibo", "★中古・45㎡・令和8年は小規模として対象になる（令和7年以前は対象外）");
  eq(r.eligible, true, "中古・45㎡・令和8年は対象");
  eq(r.mensekiFloor, 40, "中古・令和8年の床面積下限は40㎡");
  eq(r.shotokuLimit, 10000000, "40〜50㎡は合計所得1,000万円以下の年のみ");
}
eq(calc({ type: "chuko", kubun: "nintei", year: 2025, nenmatsuZandaka: BIG, menseki: 45 }, D).mensekiStatus, "too_small",
  "★退行検査：中古・45㎡・令和7年は対象外のまま（50㎡未満）");
eq(calc({ type: "chuko", kubun: "nintei", year: 2026, nenmatsuZandaka: BIG, menseki: 38 }, D).mensekiStatus, "too_small",
  "中古・38㎡は令和8年でも対象外（40㎡未満）");
// ★★令和8年以降、40〜50㎡（小規模）には子育て特例の上乗せが無い（41条9項かっこ書き「特例認定住宅等を除く」）
{
  const r = calc({ kubun: "nintei", year: 2026, nenmatsuZandaka: BIG, menseki: 45, goukeiShotoku: 9000000, kosodateTokurei: true }, D);
  eq(r.tokureiApplied, false, "★★新築・認定・令和8年・45㎡：上乗せは適用されない");
  eq(r.tokureiDeniedShokibo, true, "tokureiDeniedShokibo が立つ（ページが理由を出す）");
  eq(r.nenkanKoujo, 315000, "上乗せ無しの4,500万→31.5万円（5,000万→35万円にしない）");
}
{
  // 退行検査：令和6年入居は40〜50㎡でも上乗せが効く（条文が「含む」）
  const r = calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG, menseki: 45, goukeiShotoku: 9000000, kosodateTokurei: true }, D);
  eq(r.tokureiApplied, true, "★退行検査：令和6年・45㎡は上乗せが効くまま（41条9項は令和6・7年『含む』）");
  eq(r.tokureiDeniedShokibo, false, "令和6年は tokureiDeniedShokibo が立たない");
  eq(r.nenkanKoujo, 350000, "5,000万→35万円");
}
// resolveGendo 直接（令和8年の表の引き方）
eq(resolveGendo("nintei", 2026, false, false, D, "chuko").gendoMan, 3500, "中古・認定・令和8年は3,500万");
eq(resolveGendo("nintei", 2026, false, false, D, "chuko").kikan, 13, "中古・認定・令和8年は13年");
eq(resolveGendo("nintei", 2026, true, false, D, "chuko").gendoMan, 4500, "中古・認定・令和8年（特例）は4,500万");
eq(resolveGendo("sonota", 2026, false, true, D).gendoMan, 2000, "その他・令和8年＋経過措置は2,000万");
eq(resolveGendo("nintei", 2028, false, false, D), null, "令和10年は収録外（null）");
eq(resolveGendo("nintei", 2028, false, false, D, "chuko"), null, "中古・令和10年も収録外（null）");

// ===== 8c. ★令和9年（2027）入居 — 令和8年と同値（2026-07-20 条文で確認）=====
// ★外部オラクル＝措法41条の居住年レンジ（3項3号・6項・7項2号/4号/6号・9項＝いずれも「令和8年から
//   令和12年までの各年」または「令和6年から令和12年までの各年」）× 0.7％を再現する。
//   41条25項（新築・省エネの建築確認限定）は「令和10年1月1日以後の居住」にのみ効くので令和9年は無関係。
{
  const r = calc({ kubun: "nintei", year: 2027, nenmatsuZandaka: BIG }, D);
  eq(r.beyondData, false, "★令和9年入居は収録済み（beyondDataにしない）");
  eq(r.nenkanKoujo, 315000, "★新築・認定・令和9年：4,500万×0.7％＝31.5万円（41条7項2号ロ＝令和6〜12年）");
  eq(r.kikan, 13, "新築・認定・令和9年は13年");
}
eq(calc({ kubun: "nintei", year: 2027, nenmatsuZandaka: BIG, kosodateTokurei: true }, D).nenkanKoujo, 350000,
  "★新築・認定・令和9年（子育て特例）：5,000万→35万円（41条9項1号＝令和6〜12年）");
eq(calc({ kubun: "zeh", year: 2027, nenmatsuZandaka: BIG }, D).nenkanKoujo, 245000,
  "★新築・ZEH・令和9年：3,500万→24.5万円（41条7項4号ロ(1)＝令和8〜12年）");
{
  const r = calc({ kubun: "shoene", year: 2027, nenmatsuZandaka: BIG, kosodateTokurei: true }, D);
  eq(r.nenkanKoujo, 210000, "★新築・省エネ・令和9年（子育て特例）：3,000万→21万円（41条9項4号。令和6・7年の4,000万に戻さない）");
  eq(r.kikan, 13, "新築・省エネ・令和9年も13年");
}
// ★その他の住宅は令和9年入居も原則0円（41条24項に終期が無い）。経過措置は建築日基準（措令26条43項）で令和9年にも生きる
{
  const r = calc({ kubun: "sonota", year: 2027, nenmatsuZandaka: BIG }, D);
  eq(r.nenkanKoujo, 0, "★★その他・令和9年（一般）：新築は0円のまま");
  eq(r.sonotaZero, true, "その他・令和9年は sonotaZero が立つ");
}
eq(calc({ kubun: "sonota", year: 2027, nenmatsuZandaka: BIG, keikaSochi: true }, D).nenkanKoujo, 140000,
  "★その他・令和9年＋経過措置：2,000万・14万円（措令26条43項は建築日基準＝居住年の限定なし）");
// 中古（既存住宅）も令和8年と同値
{
  const r = calc({ type: "chuko", kubun: "nintei", year: 2027, nenmatsuZandaka: BIG, kosodateTokurei: true }, D);
  eq(r.nenkanKoujo, 315000, "★中古・認定・令和9年（子育て特例）：4,500万→31.5万円（41条9項2号ロ(2)）");
  eq(r.kikan, 13, "中古・認定・令和9年は13年");
}
eq(calc({ type: "chuko", kubun: "shoene", year: 2027, nenmatsuZandaka: BIG }, D).nenkanKoujo, 140000,
  "★中古・省エネ・令和9年：2,000万→14万円（41条7項6号）");
{
  const r = calc({ type: "chuko", kubun: "sonota", year: 2027, nenmatsuZandaka: BIG }, D);
  eq(r.nenkanKoujo, 140000, "中古・その他・令和9年：2,000万＝14万円（41条3項3号＝令和12年まで）");
  eq(r.kikan, 10, "★中古・その他・令和9年は10年のまま");
}
// ★令和9年×40〜50㎡（小規模）にも上乗せは無い（41条9項かっこ書き「特例認定住宅等を除く」＝令和8〜12年入居）
{
  const r = calc({ kubun: "nintei", year: 2027, nenmatsuZandaka: BIG, menseki: 45, goukeiShotoku: 9000000, kosodateTokurei: true }, D);
  eq(r.tokureiApplied, false, "★新築・認定・令和9年・45㎡：上乗せは適用されない");
  eq(r.tokureiDeniedShokibo, true, "令和9年も tokureiDeniedShokibo が立つ");
  eq(r.nenkanKoujo, 315000, "上乗せ無しの4,500万→31.5万円");
}
// 中古の40㎡下限・上乗せも令和9年に引き継がれる
eq(calc({ type: "chuko", kubun: "nintei", year: 2027, nenmatsuZandaka: BIG, menseki: 45 }, D).eligible, true,
  "中古・45㎡・令和9年も対象（特例既存住宅・41条17項）");

// ===== 9. fail closed：参照データを渡さないと例外 =====
assert.throws(() => calc({ kubun: "nintei", year: 2024, nenmatsuZandaka: BIG }, undefined),
  /参照データ/, "Dを渡さないと例外（黙って0を返さない）");
n++;

// ===== 10. 住民税からの控除（所得税で引ききれなかった分）— juminzeiKoujo =====
// ★外部オラクル＝総務省「所得税から住宅ローン控除額を引ききれなかった方」の算出例：
//   住宅ローン控除可能額225,000円 − 適用前所得税額190,000円 ＝ 35,000円（97,500円以下なので住民税から35,000円控除）。
{
  const j = juminzeiKoujo(225000, 190000, null, D);
  eq(j.hikikirenai, 35000, "★外部オラクル：225,000−190,000＝35,000（引ききれなかった額A）");
  eq(j.shotokuzeiKoujo, 190000, "所得税からは190,000円（所得税額まで）控除された");
  eq(j.juminzeiKoujoGaku, 35000, "★住民税から35,000円控除（97,500円以下なのでそのまま）");
  eq(j.kirisute, 0, "切り捨ては0（住民税上限内）");
  eq(j.jitsuGenzei, 225000, "実際の軽減＝190,000＋35,000＝225,000円（枠を満額使えた）");
  eq(j.juminzeiCapUnknown, true, "課税総所得未入力なので5％判定は省略（上限97,500円で概算）");
}
// 所得税で全額引ける人 → 住民税へは繰り越さない
{
  const j = juminzeiKoujo(100000, 150000, null, D);
  eq(j.shotokuzeiKoujo, 100000, "控除可能額100,000＜所得税額150,000→全額所得税から");
  eq(j.hikikirenai, 0, "引ききれなかった額は0");
  eq(j.juminzeiKoujoGaku, 0, "住民税からの控除は0");
  eq(j.jitsuGenzei, 100000, "実際の軽減＝100,000円");
}
// ★上限(B)は97,500円で頭打ち（高所得・大きな控除枠で引ききれない額が大きいとき）
{
  const j = juminzeiKoujo(300000, 100000, 3000000, D); // 課税総所得300万×5％＝15万＞9.75万→97,500で頭打ち
  eq(j.hikikirenai, 200000, "引ききれなかった額A＝300,000−100,000＝200,000");
  eq(j.juminzeiCapB, 97500, "★住民税の控除限度額は97,500円（課税総所得×5％＝15万だが上限が効く）");
  eq(j.juminzeiKoujoGaku, 97500, "住民税から97,500円まで");
  eq(j.kirisute, 102500, "★残り102,500円は切り捨て（還付されない）＝満額戻らない");
  eq(j.jitsuGenzei, 197500, "実際の軽減＝100,000＋97,500＝197,500円");
  eq(j.juminzeiCapUnknown, false, "課税総所得を入力したので5％判定した");
}
// ★低所得者は「課税総所得×5％」の側が上限になる（97,500円まで使えない）
{
  const j = juminzeiKoujo(200000, 100000, 1500000, D); // 150万×5％＝75,000＜97,500
  eq(j.juminzeiCapB, 75000, "★課税総所得150万×5％＝75,000円が上限（97,500円まで使えない）");
  eq(j.juminzeiKoujoGaku, 75000, "住民税から75,000円まで");
  eq(j.kirisute, 25000, "引ききれない100,000のうち25,000円は切り捨て");
}
// 5％と97,500円の境目：課税総所得1,950,000円でちょうど97,500円
eq(juminzeiKoujo(300000, 0, 1950000, D).juminzeiCapB, 97500, "課税総所得195万×5％＝97,500（境目・上限と一致）");
eq(juminzeiKoujo(300000, 0, 1940000, D).juminzeiCapB, 97000, "課税総所得194万×5％＝97,000（境目直下は5％側）");
// 所得税0円（無税の人）は全額が住民税繰越の対象（上限まで）
{
  const j = juminzeiKoujo(140000, 0, null, D);
  eq(j.shotokuzeiKoujo, 0, "所得税額0→所得税からの控除は0");
  eq(j.hikikirenai, 140000, "枠140,000がまるごと引ききれない");
  eq(j.juminzeiKoujoGaku, 97500, "住民税から97,500円まで（上限）");
  eq(j.kirisute, 42500, "残り42,500円は切り捨て");
}
// fail closed：juminzei データが無いと例外
assert.throws(() => juminzeiKoujo(140000, 0, null, {}), /juminzei/, "juminzeiデータが無いと例外");
n++;

// ===== 10b. calc への統合（所得税額を渡したときだけ juminzei が非null）=====
{
  // 認定・令和4年・年末残高2,000万 → 年間控除14万円。所得税10万なら差4万が住民税へ
  const r = calc({ kubun: "nintei", year: 2022, nenmatsuZandaka: 20000000, shotokuzeiGaku: 100000 }, D);
  ok(r.juminzei !== null, "★所得税額を渡すと juminzei が付く");
  eq(r.juminzei.hikikirenai, 40000, "140,000−100,000＝40,000が引ききれない");
  eq(r.juminzei.juminzeiKoujoGaku, 40000, "住民税から40,000円（97,500円以下）");
  eq(r.juminzei.jitsuGenzei, 140000, "実還付＝100,000＋40,000＝140,000（枠を満額使えた）");
}
{
  // 所得税額を渡さなければ juminzei は null（黙って満額戻ると言わない＝上限概算のまま）
  const r = calc({ kubun: "nintei", year: 2022, nenmatsuZandaka: 20000000 }, D);
  eq(r.juminzei, null, "★所得税額未入力なら juminzei は null（実還付額を断定しない）");
}
{
  // 対象外（その他・令和6年＝控除0）に所得税額を渡しても juminzei は付かない
  const r = calc({ kubun: "sonota", year: 2024, nenmatsuZandaka: BIG, shotokuzeiGaku: 100000 }, D);
  eq(r.eligible, false, "その他・令和6年は対象外");
  eq(r.juminzei, null, "★対象外なら所得税額を渡しても juminzei は付かない");
}
{
  // 中古でも住民税繰越は同じく効く
  const r = calc({ type: "chuko", kubun: "sonota", year: 2024, nenmatsuZandaka: BIG, shotokuzeiGaku: 50000, kazeiSotokugaku: 3000000 }, D);
  eq(r.nenkanKoujo, 140000, "中古・その他は14万円");
  eq(r.juminzei.hikikirenai, 90000, "140,000−50,000＝90,000が引ききれない");
  eq(r.juminzei.juminzeiKoujoGaku, 90000, "★中古でも住民税から控除（90,000＜97,500）");
  eq(r.juminzei.jitsuGenzei, 140000, "実還付＝50,000＋90,000＝140,000");
}

console.log(`test_jutaku: ${n} checks OK`);
