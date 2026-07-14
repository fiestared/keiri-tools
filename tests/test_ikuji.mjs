/**
 * 育児休業給付の単体テスト。
 *
 * ★ここでいちばん効いている検査は「外部オラクル」＝**厚労省が実額で公表している支給限度額**。
 *   自分の期待値どうしを突き合わせても、実装と期待値が同じ勘違いをしていれば緑になる（gbrain §26）。
 *
 *   使うオラクル（令和7年8月1日〜令和8年7月31日に適用される額）:
 *     育児休業給付金 67% … 上限 **323,811円** ／ 下限 **60,581円**
 *     育児休業給付金 50% … 上限 **241,650円** ／ 下限 **45,210円**
 *     出生時育児休業給付金（産後パパ育休・28日） 67% … 上限 **302,223円**
 *     出生後休業支援給付金（28日） 13% … 上限 **58,640円** ／ 下限 **10,970円**
 *
 *   これらは **公表された結果** であって、実装が使う入力ではない。
 *   実装が使うのは 賃金日額の上限 16,110円 / 下限 3,014円（kihonteate_r07.json）と、
 *   条文の給付率（67/50/13%）だけ。**そこから公表値がぴたりと再現されることが検査**になる。
 *
 * ★この検査が同時に証明していること（どれか1つでも間違えると赤くなる）:
 *   (a) 上限額に **17条4項2号ハ（30歳以上45歳未満）** を使っていること
 *       → もし「45〜60歳」の額（17,740円）を使えば 356,574円 になり、公表値と合わない
 *   (b) 端数が **円未満切り捨て** であること
 *       → 下限13%の 10,970.96 → 10,970 が切り捨ての証拠（四捨五入なら10,971）
 *   (c) 支給日数が 30日（61条の7第6項1号）・支援給付が28日で頭打ち（61条の10第3項3号）であること
 */
import { readFileSync } from 'node:fs';
import {
  yen, wageDaily, applyIkujiCaps, unitAmount, adjustForWage,
  shienKyufu, shusshojiKyufu, calcIkuji,
  RATE_HIGH, RATE_LOW, RATE_SHIEN, HIGH_DAYS, SHIEN_MAX_DAYS, WORK_CAP,
} from '../docs/assets/ikuji_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/kihonteate_r07.json', import.meta.url), 'utf8'));

let checks = 0, failed = 0;
function eq(actual, expected, label) {
  checks++;
  if (actual !== expected) {
    failed++;
    console.error(`  ✗ ${label}\n      期待: ${expected}\n      実際: ${actual}`);
  }
}
function throws(fn, label) {
  checks++;
  try {
    fn();
    failed++;
    console.error(`  ✗ ${label}\n      期待: 例外を投げる\n      実際: 投げなかった`);
  } catch { /* 期待どおり */ }
}

// ── 前提: 参照データが期待どおりの構造で入っていること ───────────────
const MAX = D.chingin_nichigaku_max.age30_44; // 17条4項2号ハ
const MIN = D.chingin_nichigaku_min;
eq(MAX, 16110, '賃金日額の上限（ハ＝30歳以上45歳未満）');
eq(MIN, 3014, '賃金日額の下限');

// ── 1. 外部オラクル: 厚労省の公表する支給限度額を再現する ─────────────
// 上限に張りついた人（月給が高い人）
const capUnit = unitAmount(MAX, 30, 0);
eq(capUnit.amount, 323811, '【オラクル】育休67%の支給限度額 = 323,811円');
const capUnitLow = unitAmount(MAX, 30, HIGH_DAYS); // 180日経過後 → 50%
eq(capUnitLow.amount, 241650, '【オラクル】育休50%の支給限度額 = 241,650円');

// 下限に張りついた人
const floorUnit = unitAmount(MIN, 30, 0);
eq(floorUnit.amount, 60581, '【オラクル】育休67%の支給下限額 = 60,581円（切り捨て）');
eq(unitAmount(MIN, 30, HIGH_DAYS).amount, 45210, '【オラクル】育休50%の支給下限額 = 45,210円');

// 産後パパ育休（出生時育児休業給付金）28日
eq(shusshojiKyufu(MAX, 28, 0).amount, 302223, '【オラクル】産後パパ育休28日の上限 = 302,223円');

// 出生後休業支援給付金 13%・28日
eq(shienKyufu(MAX, 28, 28, false).amount, 58640, '【オラクル】出生後休業支援13%の上限 = 58,640円');
eq(shienKyufu(MIN, 28, 28, false).amount, 10970,
   '【オラクル】出生後休業支援13%の下限 = 10,970円（10,970.96の切り捨て＝四捨五入なら10,971で赤）');

// ── 2. ★上限は本人の年齢で選ばない（61条の7第6項の読替え＝17条4項2号ハ固定）──
// 賃金日額20,000円（月給60万円相当）の人は、何歳でも 16,110円に頭打ちされる。
const rich = applyIkujiCaps(20000, D);
eq(rich.daily, 16110, '★年齢に関係なく上限は16,110円（ハ）。45〜60歳の17,740円を使ってはいけない');
eq(rich.capped, true, '上限に張りついたことを画面に出せる');
// もし「45〜60歳」の上限を使ってしまうと、この額になる（＝公表値と矛盾する額）
eq(yen(D.chingin_nichigaku_max.age45_59 * 30 * RATE_HIGH), 356574,
   '（参考）45〜60歳の上限を誤用すると356,574円になり、公表値323,811円と食い違う');
// 若い人には有利に働く: 30歳未満の上限(14,510円)ではなく16,110円が使われる
eq(applyIkujiCaps(15000, D).daily, 15000, '★25歳でも「30歳未満の上限14,510円」で切られない（ハが適用される）');

// ★下限（17条4項1号）。**上の【オラクル】は下限額を直接 unitAmount に渡しているので、
//   「低賃金の人を calcIkuji に通すと下限まで引き上げられるか」は検査できていない**
//   （壊しテストが実際にこの穴を素通しして見つけた）。ここで端から端まで通す。
const poor = applyIkujiCaps(1666.67, D); // 6か月で30万円しか賃金がない人
eq(poor.daily, MIN, '★賃金日額が下限を割る人は3,014円まで引き上げられる');
eq(poor.floored, true, '下限に張りついたことを画面に出せる');
const poorRun = calcIkuji({ total6m: 300000, leaveDays: 30 }, D); // 賃金日額1,666.67 → 下限へ
eq(poorRun.floored, true, '★calcIkuji でも下限が当たる（端から端まで）');
eq(poorRun.ikujiTotal, 60581, '★低賃金の人の1か月分は下限額60,581円（賃金日額のままなら33,500円で赤）');

// ── 3. 賃金日額（17条1項）。賞与は総額に入らない ───────────────────
eq(wageDaily(300000 * 6), 10000, '月給30万・賞与なし → 賃金日額10,000円');
// 賞与を足してしまうと賃金日額が上がる（＝入れてはいけないことの確認）
eq(wageDaily(300000 * 6 + 1200000), 16666.666666666668, '（誤り例）賞与120万を入れると賃金日額が跳ね上がる');

// ── 4. 記事の早見表（月給30万＝賃金日額10,000円）──────────────────
const w = 10000;
eq(unitAmount(w, 30, 0).amount, 201000, '月給30万 → 育休67%は月201,000円');
eq(unitAmount(w, 30, HIGH_DAYS).amount, 150000, '月給30万 → 181日目以降は月150,000円');
eq(shienKyufu(w, 28, 28, false).amount, 36400, '月給30万 → 出生後休業支援13%（28日）は36,400円');
// 67% + 13% = 80%
eq(unitAmount(w, 28, 0).amount + shienKyufu(w, 28, 28, false).amount,
   yen(w * 28 * 0.8), '★67%＋13%＝80%（「手取り10割」の正体）');

// ── 5. ★180日目をまたぐ支給単位期間は日割り（61条の7第6項かっこ書き）────
// 通算170日の時点から30日間 → 10日が67%、20日が50%
const straddle = unitAmount(w, 30, 170);
eq(straddle.highDays, 10, '180日目までの10日は67%');
eq(straddle.lowDays, 20, '181日目からの20日は50%');
eq(straddle.amount, yen(w * 10 * RATE_HIGH) + yen(w * 20 * RATE_LOW), '★67%部分と50%部分を分けて計算して足す');
eq(straddle.amount, 167000, '★日割りの実額（10日×6,700 + 20日×5,000）');
// 「7か月目からまるごと50%」と実装すると150,000円になる（＝17,000円少ない）
eq(unitAmount(w, 30, 180).amount, 150000, '（誤り例）またぎを無視して全部50%にすると150,000円');

// ── 6. 就業して賃金が出たとき（61条の7第7項）。基準は80% ──────────────
const gross = w * 30; // 300,000
const base = unitAmount(w, 30, 0).amount; // 201,000
eq(adjustForWage(base, 0, gross).amount, 201000, '賃金0 → 満額');
eq(adjustForWage(base, 30000, gross).amount, 201000, '賃金3万 → 合計231,000 < 80%(240,000) なので減らない');
eq(adjustForWage(base, 50000, gross).amount, 190000, '★賃金5万 → 80%の240,000から賃金を引いた額に減る');
eq(adjustForWage(base, 240000, gross).unpaid, true, '★賃金が80%以上 → 不支給');
eq(adjustForWage(base, 240000, gross).amount, 0, '不支給の額は0円');
// 「少し働くと損」ではない: 賃金3万のとき、手取り合計は増えている
checks++;
if (!(30000 + adjustForWage(base, 30000, gross).amount > base)) {
  failed++; console.error('  ✗ 80%までは働いた分だけ増える');
}

// ── 7. 出生後休業支援給付金の要件（61条の10第1項2号・3号、2項）────────
eq(shienKyufu(w, 13, 28, false).eligible, false, '自分が14日未満 → 不支給（1項2号）');
eq(shienKyufu(w, 13, 28, false).reason, 'own_days', '理由を画面に出せる');
eq(shienKyufu(w, 28, 13, false).eligible, false, '★配偶者が14日未満 → 不支給（1項3号）');
eq(shienKyufu(w, 28, 13, false).reason, 'spouse_days', '★母親だけが損をしうる非対称の正体');
eq(shienKyufu(w, 28, 0, true).eligible, true, '★ひとり親等は配偶者要件が免除される（2項）');
eq(shienKyufu(w, 14, 14, false).eligible, true, 'ちょうど14日 → 要件を満たす（境界）');
eq(shienKyufu(w, 40, 28, false).days, SHIEN_MAX_DAYS, '★28日で頭打ち（3項3号）。40日休んでも28日分');

// ── 8. 産後パパ育休は28日で頭打ち（61条の8第2項2号）───────────────
eq(shusshojiKyufu(w, 40, 0).days, 28, '産後パパ育休は28日を超えない');
eq(shusshojiKyufu(w, 28, 0).amount, 187600, '28日分 = 10,000×28×67%');
eq(shusshojiKyufu(w, 28, 250000).unpaid, true, '賃金が80%以上なら不支給（5項）');

// ── 9. 通し計算（calcIkuji）────────────────────────────────
const r = calcIkuji({ total6m: 300000 * 6, leaveDays: 365, shienOwnDays: 28, shienSpouseDays: 28 }, D);
eq(r.daily, 10000, '賃金日額10,000円');
eq(r.units.length, 13, '365日 → 30日×12 + 5日 = 13期間');
eq(r.units[0].amount, 201000, '1期間目は67%');
eq(r.units[6].amount, 150000, '7期間目（181〜210日）は50%');
eq(r.units[12].days, 5, '最後の期間は残り5日（61条の7第6項2号）');
eq(r.units[12].amount, 25000, '最後の5日は50%で25,000円');
eq(r.ikujiTotal, 201000 * 6 + 150000 * 6 + 25000, '育休給付の合計');
eq(r.shien.amount, 36400, '出生後休業支援13%が乗る');
eq(r.total, r.ikujiTotal + r.shien.amount, '合計＝育休給付＋支援給付');
eq(r.year, D._meta.label, '★年度はデータから採る（ページに手書きしない）');

// 上限に張りつく人（月給60万）
const rich2 = calcIkuji({ total6m: 600000 * 6, leaveDays: 180, shienOwnDays: 0, shienSpouseDays: 0 }, D);
eq(rich2.capped, true, '月給60万は上限に張りつく');
eq(rich2.ikujiTotal, 323811 * 6, '180日すべて67%の上限額');
eq(rich2.shien.eligible, false, '出生後休業をしていなければ13%は乗らない');

// ── 10. fail closed（参照データが無ければ計算しない）──────────────
throws(() => calcIkuji({ total6m: 1800000, leaveDays: 180 }, null), '★参照データなしでは計算しない（fail closed）');
throws(() => applyIkujiCaps(10000, null), '★上下限データなしでは丸めない（fail closed）');
throws(() => applyIkujiCaps(10000, { chingin_nichigaku_min: 3014 }), '上限が欠けたデータで計算しない');
throws(() => calcIkuji({ total6m: 0, leaveDays: 180 }, D), '賃金総額が0なら計算しない');
throws(() => calcIkuji({ total6m: 1800000, leaveDays: 0 }, D), '休業日数が0なら計算しない');

// ── 11. 定数が条文どおりであること ────────────────────────────
eq(RATE_HIGH, 0.67, '67%（61条の7第6項）');
eq(RATE_LOW, 0.5, '50%（同項）');
eq(RATE_SHIEN, 0.13, '13%（61条の10第6項）');
eq(WORK_CAP, 0.8, '80%（61条の7第7項）');
eq(HIGH_DAYS, 180, '180日（61条の7第6項）');

// ───────────────────────────────────────────────────────────────
if (failed) {
  console.error(`\n✗ ${failed} 件失敗 / ${checks} checks`);
  process.exit(1);
}
console.log(`\n✓ 全て通過（${checks} checks）`);
