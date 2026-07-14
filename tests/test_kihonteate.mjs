/**
 * 失業保険（基本手当）計算機の単体テスト。
 * 所定給付日数・受給資格・給付制限・受給期間は、雇用保険法の条文の表そのものを固定する。
 * （給付率と金額の裏取りは test_kihonteate_oracle.mjs が厚労省の公表値でやっている）
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  calcKihonteate, prescribedDays, restrictionMonths, eligibility,
  receivePeriodDays, wageAgeBand, daysAgeBand, applyWageCaps, wageDaily,
} from "../docs/assets/kihonteate_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/kihonteate_r07.json", import.meta.url)));
let n = 0;
const eq = (a, b, msg) => { assert.strictEqual(a, b, `${msg}: ${a} ≠ ${b}`); n++; };

// --- 1. 年齢の区切りが2種類ある（賃金日額の上限は30/45/60、所定給付日数は30/35/45/60） ---
eq(wageAgeBand(34), "age30_44", "34歳の賃金日額区分");
eq(wageAgeBand(35), "age30_44", "35歳の賃金日額区分（35歳の境目は無い）");
eq(daysAgeBand(34), "age30_34", "34歳の日数区分");
eq(daysAgeBand(35), "age35_44", "★35歳の境目は所定給付日数にだけ在る");
// 同じ人（35歳・会社都合・10年）が、34歳なら210日・35歳なら240日になる
eq(prescribedDays(34, "y10_20", "kaisha", false), 210, "34歳・会社都合・10〜20年");
eq(prescribedDays(35, "y10_20", "kaisha", false), 240, "35歳・会社都合・10〜20年");

// --- 2. 22条1項: 一般（自己都合）の所定給付日数は年齢に関係なく3段階しかない ---
for (const age of [25, 35, 50, 62]) {
  eq(prescribedDays(age, "y1_5", "jiko", false), 90, `${age}歳・自己都合・1〜5年`);
  eq(prescribedDays(age, "y10_20", "jiko", false), 120, `${age}歳・自己都合・10〜20年`);
  eq(prescribedDays(age, "y20", "jiko", false), 150, `${age}歳・自己都合・20年以上`);
}

// --- 3. 23条1項: 特定受給資格者の表（年齢 × 算定基礎期間）---
eq(prescribedDays(47, "y20", "kaisha", false), 330, "45〜59歳・20年以上＝最長330日");
eq(prescribedDays(62, "y20", "kaisha", false), 240, "60〜64歳・20年以上（45〜59歳より短い）");
eq(prescribedDays(28, "y10_20", "kaisha", false), 180, "30歳未満・10年以上");
// ★ 23条1項の柱書は「算定基礎期間1年（30歳未満は5年）以上のものに限る」と自分を絞る
//    → そこから外れた人は22条1項に戻って90日（表の左下が90日で埋まる理由）
eq(prescribedDays(28, "y1_5", "kaisha", false), 90, "★30歳未満・1〜5年は23条の対象外＝90日");
eq(prescribedDays(50, "under1", "kaisha", false), 90, "★1年未満は23条の対象外＝90日");

// --- 4. 附則4条: 契約更新なし（特定理由離職者①）は特定受給資格者と同じ日数 ---
eq(prescribedDays(47, "y20", "keiyaku", false), 330, "契約更新なしは会社都合と同じ日数（附則4条）");
// 一方、正当な理由のある自己都合（特定理由離職者②）は日数が増えない（附則4条の対象外）
eq(prescribedDays(47, "y20", "seito", false), 150, "★正当な理由のある自己都合は日数が増えない");
eq(prescribedDays(47, "y20", "teinen", false), 150, "定年退職も日数は一般と同じ");

// --- 5. 22条2項: 就職困難者は離職理由より優先される ---
eq(prescribedDays(30, "y1_5", "jiko", true), 300, "就職困難・45歳未満");
eq(prescribedDays(50, "y1_5", "jiko", true), 360, "就職困難・45歳以上");
eq(prescribedDays(50, "under1", "kaisha", true), 150, "就職困難・1年未満は150日");

// --- 6. 33条: 給付制限。法律は「1〜3か月の幅」しか定めていない ---
eq(restrictionMonths("jiko", false, false), 1, "自己都合＝原則1か月（令和7年4月〜・通達）");
eq(restrictionMonths("jiko", true, false), 3, "5年で3回以上の自己都合＝3か月");
eq(restrictionMonths("jiko", false, true), 0, "★教育訓練を受けたら給付制限は解除（33条1項ただし書）");
eq(restrictionMonths("jiko", true, true), 0, "3回目でも教育訓練を受ければ解除");
eq(restrictionMonths("kaisha", false, false), 0, "会社都合に給付制限は無い");
eq(restrictionMonths("keiyaku", false, false), 0, "契約更新なしに給付制限は無い");
eq(restrictionMonths("seito", false, false), 0, "正当な理由のある自己都合に給付制限は無い");
eq(restrictionMonths("teinen", false, false), 0, "定年退職に給付制限は無い");

// --- 7. 20条: 受給期間（原則1年。延びるのは2類型だけ）---
eq(receivePeriodDays(35, "y20", "jiko", false), 365, "原則は1年");
eq(receivePeriodDays(47, "y20", "kaisha", false), 365 + 30, "330日の人だけ1年＋30日（20条1項3号）");
eq(receivePeriodDays(47, "y20", "keiyaku", false), 365 + 30, "契約更新なし・330日も同じ");
eq(receivePeriodDays(50, "y1_5", "jiko", true), 365 + 60, "就職困難・360日は1年＋60日（20条1項2号）");
eq(receivePeriodDays(40, "y1_5", "jiko", true), 365, "就職困難でも300日なら1年のまま");
eq(receivePeriodDays(62, "y20", "kaisha", false), 365, "60〜64歳・20年以上は240日なので1年のまま");

// --- 8. 13条: 受給資格。★自己都合で1年未満なら1円も出ない ---
eq(eligibility("under1", "jiko").ok, false, "★自己都合・1年未満は受給資格なし（12か月要る）");
eq(eligibility("under1", "teinen").ok, false, "定年も12か月要る");
eq(eligibility("under1", "kaisha").ok, true, "会社都合は6か月でよい（13条2項）");
eq(eligibility("under1", "keiyaku").ok, true, "契約更新なしも6か月");
eq(eligibility("under1", "seito").ok, true, "正当な理由のある自己都合も6か月");
eq(eligibility("y1_5", "jiko").ok, true, "1年以上あれば自己都合でも資格あり");

// --- 9. 17条: 賃金日額は「6か月の総額 ÷ 180」。上限・下限を当てる ---
eq(wageDaily(1800000), 10000, "月30万円×6か月＝賃金日額10,000円");
eq(applyWageCaps(20000, 25, D).value, 14510, "29歳以下は14,510円で頭打ち");
eq(applyWageCaps(20000, 25, D).capped, "max", "上限に当たったことを申告する");
eq(applyWageCaps(20000, 50, D).value, 17740, "45〜59歳の上限は17,740円");
eq(applyWageCaps(1000, 30, D).value, 3014, "下限は全年齢3,014円");
eq(applyWageCaps(1000, 30, D).capped, "min", "下限に当たったことを申告する");

// --- 10. 総合計算 ---
// 月30万円・35歳・勤続12年・自己都合 → 賃金日額10,000円（逓減帯）
const r1 = calcKihonteate({ age: 35, monthly: 300000, period: "y10_20", reason: "jiko" }, D);
eq(r1.wageDaily, 10000, "賃金日額");
eq(r1.days, 120, "所定給付日数");
eq(r1.restrictionMonths, 1, "給付制限1か月");
eq(r1.daily, Math.floor(10000 * (0.8 - 0.3 * ((10000 - 5340) / (13140 - 5340)))), "基本手当日額");
eq(r1.total, r1.daily * 120, "総額＝日額×日数");
eq(r1.receivePeriodDays, 365, "受給期間1年");

// 同じ人が会社都合で辞めた場合 → 日数240日・給付制限なし（日額は同じ）
const r2 = calcKihonteate({ age: 35, monthly: 300000, period: "y10_20", reason: "kaisha" }, D);
eq(r2.daily, r1.daily, "★離職理由が変わっても日額は変わらない（変わるのは日数と制限）");
eq(r2.days, 240, "会社都合なら240日");
eq(r2.restrictionMonths, 0, "会社都合に給付制限なし");
assert.ok(r2.total === r1.daily * 240 && r2.total > r1.total, "会社都合のほうが総額は多い");
n++;

// 自己都合・1年未満 → 受給資格なし。総額は0（黙って金額を出さない）
const r3 = calcKihonteate({ age: 28, monthly: 250000, period: "under1", reason: "jiko" }, D);
eq(r3.eligible, false, "自己都合・1年未満は受給資格なし");
eq(r3.total, 0, "★資格が無いのに総額を答えない");
assert.ok(r3.eligibilityMessage.includes("12か月"), "理由を利用者に伝える");
n++;

// 65歳以上は対象外（高年齢求職者給付金）
const r4 = calcKihonteate({ age: 65, monthly: 300000, period: "y20", reason: "teinen" }, D);
eq(r4.supported, false, "★65歳以上は基本手当の対象外。黙って計算しない");
assert.ok(r4.message.includes("高年齢求職者給付金"), "正しい制度名を案内する");
n++;

// 上限に当たる人（45〜59歳・月80万円）
const r5 = calcKihonteate({ age: 50, monthly: 800000, period: "y20", reason: "kaisha" }, D);
eq(r5.capped, "max", "賃金日額が上限に当たる");
eq(r5.daily, 8870, "45〜59歳の基本手当日額の上限＝8,870円");
eq(r5.days, 330, "45〜59歳・20年以上・会社都合＝330日");
eq(r5.total, 8870 * 330, "総額（最長ケース）");
eq(r5.receivePeriodDays, 395, "330日の人は受給期間が1年＋30日");

console.log(`✅ test_kihonteate: ${n} checks`);
