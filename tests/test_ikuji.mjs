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
  yen, wageDaily, applyIkujiCaps, adjustForWage,
  addMonthsClamped, parseYmd, fmtYmd, unitPeriods, unitPayment, UNIT_DAYS,
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
// ★★オラクルは **calcIkuji に端から端まで通して** 取る。
//   前便の教訓: 「オラクルが緑」と「その経路が検査されている」は別物。
//   オラクルは値（賃金日額・日数）を補助関数に**直接**渡しがちで、**変換の経路を跨いでしまう**。
//   ここでは「6か月の賃金総額」と「休業開始日」という**利用者が実際に打つ入力**から限度額を再現する。
//   ⚠️これが公表値を再現すること自体が「支給日数＝30日」（61条の7第6項1号）の証拠でもある。
const APR = '2026-04-01'; // 4月は30日。1期間目＝暦30日ちょうど（過去の固定日。「今日」に依存させない）

// 上限に張りついた人（月給が高い人）: 賃金日額が上限16,110円まで切られる
const capRun = calcIkuji({ total6m: 16110 * 180 * 2, startDate: APR, leaveDays: 365, shien: null }, D);
eq(capRun.daily, MAX, '賃金日額が上限16,110円に張りつく');
eq(capRun.units[0].amount, 323811, '【オラクル】育休67%の支給限度額 = 323,811円（1期間目・30日）');
eq(capRun.units[6].amount, 241650, '【オラクル】育休50%の支給限度額 = 241,650円（7期間目・181日目以降）');

// 下限に張りついた人: 6か月の賃金総額30万円 → 賃金日額1,666.67 → 下限3,014円まで引き上げ
const floorRun = calcIkuji({ total6m: 300000, startDate: APR, leaveDays: 365, shien: null }, D);
eq(floorRun.daily, MIN, '賃金日額が下限3,014円まで引き上げられる');
eq(floorRun.units[0].amount, 60581, '【オラクル】育休67%の支給下限額 = 60,581円（切り捨て）');
eq(floorRun.units[6].amount, 45210, '【オラクル】育休50%の支給下限額 = 45,210円');

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
const poorRun = calcIkuji({ total6m: 300000, startDate: APR, leaveDays: 30, shien: null }, D);
eq(poorRun.floored, true, '★calcIkuji でも下限が当たる（端から端まで）');
eq(poorRun.ikujiTotal, 60581, '★低賃金の人の1か月分は下限額60,581円（賃金日額のままなら33,500円で赤）');

// ── 3. 賃金日額（17条1項）。賞与は総額に入らない ───────────────────
eq(wageDaily(300000 * 6), 10000, '月給30万・賞与なし → 賃金日額10,000円');
// 賞与を足してしまうと賃金日額が上がる（＝入れてはいけないことの確認）
eq(wageDaily(300000 * 6 + 1200000), 16666.666666666668, '（誤り例）賞与120万を入れると賃金日額が跳ね上がる');

// ── 4. 記事の早見表（月給30万＝賃金日額10,000円）──────────────────
const w = 10000;
const run = calcIkuji({ total6m: 300000 * 6, startDate: APR, leaveDays: 365, shien: null }, D);
eq(run.daily, w, '月給30万・賞与なし → 賃金日額10,000円');
eq(run.units[0].amount, 201000, '月給30万 → 育休67%は月201,000円');
eq(run.units[6].amount, 150000, '月給30万 → 181日目以降は月150,000円');
eq(shienKyufu(w, 28, 28, false).amount, 36400, '月給30万 → 出生後休業支援13%（28日）は36,400円');
// 67% + 13% = 80%
eq(yen(w * 28 * RATE_HIGH) + shienKyufu(w, 28, 28, false).amount,
   yen(w * 28 * 0.8), '★67%＋13%＝80%（「手取り10割」の正体）');

// ── 5. ★★支給単位期間は「暦の応当日」で区切る（61条の7第5項）───────────
// 条文: 「その日に応当する日がない月においては、**その月の末日**」
const J31 = parseYmd('2026-01-31');
eq(fmtYmd(addMonthsClamped(J31, 1)), '2026-02-28', '★1/31の1か月後の応当日は2/28（2月に31日は無い→末日）');
eq(fmtYmd(addMonthsClamped(J31, 2)), '2026-03-31', '★★2か月後は3/31（3/28ではない＝クランプは毎回もとの開始日から当てる）');
eq(fmtYmd(addMonthsClamped(J31, 3)), '2026-04-30', '3か月後は4/30（4月に31日は無い→末日）');
eq(fmtYmd(addMonthsClamped(parseYmd('2028-01-31'), 1)), '2028-02-29', 'うるう年は2/29が末日');
throws(() => parseYmd('2026-02-31'), '★暦に存在しない日は弾く（Date.UTCは黙って3/3に繰り上げる）');
throws(() => parseYmd('2026/04/01'), '形式違いは弾く');

// ── 6. ★★「支給日数」と「休業日数」は別物（61条の7第6項1号 vs 本文）──────
// 1号: 終了月**以外**の支給単位期間の支給日数は **一律30日**（暦が31日でも28日でも30日）。
// 本文: 67%→50% の境目は **暦の通算180日目**。
// → 暦31日の月でも支給日数は30日しか進まないのに、休業日数は31日進む。**両者はずれていく**。
const u = run.units;
eq(u.length, 12, '2026-04-01から365日 → 応当日で12期間（30日区切りなら13期間になる）');
eq(u[1].from + '〜' + u[1].to, '2026-05-01〜2026-05-31', '2期間目は暦31日（5月）');
eq(u[1].calDays, 31, '暦の日数は31日');
eq(u[1].payDays, UNIT_DAYS, '★★それでも支給日数は30日（1号）。31日ではない');
eq(u[10].from + '〜' + u[10].to, '2027-02-01〜2027-02-28', '11期間目は暦28日（2月）');
eq(u[10].payDays, UNIT_DAYS, '★★2月（暦28日）でも支給日数は30日。暦より多い');
eq(u[11].isFinal, true, '12期間目が終了月');
eq(u[11].calDays, 31, '終了月は2027-03-01〜03-31の31日');
eq(u[11].payDays, 31, '★終了月だけは実日数（2号）。30日で切らない');

// ── 7. ★180日目をまたぐ支給単位期間は日割り（同項かっこ書き）──────────
const straddle = u.find((x) => x.straddle);
eq(straddle.index, 6, '180日目は6期間目（2026-09-01〜09-30）に落ちる');
eq(straddle.startDay, 154, 'その期間の初日は通算154日目（4/1から数えて）');
eq(straddle.highDays, 27, '★応当日(9/1)から180日目(9/27)までの27日が67%');
eq(straddle.lowDays, 3, '★181日目(9/28)から期間の終わり(9/30)までの3日が50%');
eq(straddle.amount, yen(w * 27 * RATE_HIGH) + yen(w * 3 * RATE_LOW), '★67%部分と50%部分を分けて計算して足す');
eq(straddle.amount, 195900, '★日割りの実額（27日×6,700 + 3日×5,000）');

// ★67%で払われた日数の合計は 180日ではなく **177日**。
//   （支給日数は30日ずつしか進まないのに、180日目は暦で来るため）
eq(run.payDays67, 177, '★★67%で払われた日数は177日（180日ではない）');
eq(run.payDays50, 184, '50%で払われた日数は184日');
eq(run.payDaysTotal, 361, '★支給日数の合計は361日。暦の休業日数365日と一致しない');
eq(run.ikujiTotal, 2105900, '★1年（365日）・月給30万の育休給付の合計 = 2,105,900円');

// ★★【回帰の錠前】かつて公開していた「30日ずつ区切る」モデルの答えを、ここに焼き付けておく。
//   あれは 67%を180日・50%を185日 払っていた（＝暦を無視して支給日数だけで180日を数えた）。
const OLD_WRONG = yen(w * 180 * RATE_HIGH) + yen(w * (365 - 180) * RATE_LOW);
eq(OLD_WRONG, 2131000, '（誤り例）30日区切りモデルの合計は2,131,000円');
eq(OLD_WRONG - run.ikujiTotal, 25100, '★★30日区切りモデルは1年で25,100円**過大**に答えていた（実測・第3便で修正）');
// ⚠️公開ページに「合計額は区切り方によらず同じ」と書いていた。**それは誤りだった**（撤回済み）。

// ★到達可能性: この日割りは「利用者の入力から本当に起きるのか」を数える（前便の教訓）。
//   30日区切りモデルでは、elapsed が常に30の倍数・180=6×30 なので **一度も起きなかった**（全数試して0回）。
{
  let hit = 0;
  let both = 0;
  for (let k = 0; k < 366; k++) {
    const st = fmtYmd(parseYmd('2026-01-01') + k * 86400000);
    const units = unitPeriods(parseYmd(st), 365).map((x) => unitPayment(w, x));
    const s = units.filter((x) => x.straddle);
    if (s.length) hit++;
    if (s.length && s[0].highDays > 0 && s[0].lowDays > 0) both++;
  }
  eq(hit, 366, '★★365日の育休では、開始日が1年のどの日でも必ず日割りの回が発生する（366/366）');
  eq(both, 366, '★★しかも67%部分と50%部分が**両方**立つ（＝画面に出る分岐が本当に到達可能）');
}

// ── 8. 就業して賃金が出たとき（61条の7第7項）。基準は80% ──────────────
const gross = w * 30; // 300,000
const base = run.units[0].amount; // 201,000
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
const r = calcIkuji(
  { total6m: 300000 * 6, startDate: APR, leaveDays: 365, shien: { ownDays: 28, spouseDays: 28 } },
  D,
);
eq(r.daily, 10000, '賃金日額10,000円');
eq(r.startDate, '2026-04-01', '開始日を画面に出せる');
eq(r.endDate, '2027-03-31', '★終了日は開始日＋364日（開始日を1日目と数える）');
eq(r.units.length, 12, '365日 → 応当日で12期間（30日区切りなら13期間だった）');
eq(r.units[0].from, '2026-04-01', '1期間目は開始日から');
eq(r.ikujiTotal, 2105900, '育休給付の合計');
eq(r.shien.amount, 36400, '出生後休業支援13%が乗る');
eq(r.total, r.ikujiTotal + r.shien.amount, '合計＝育休給付＋支援給付');
eq(r.year, D._meta.label, '★年度はデータから採る（ページに手書きしない）');

// ★開始日が違えば合計も変わる（2月開始＝暦28日の月から始まる人）
const feb = calcIkuji({ total6m: 300000 * 6, startDate: '2026-02-01', leaveDays: 365, shien: null }, D);
eq(feb.units[0].calDays, 28, '2026-02-01開始 → 1期間目は暦28日（2月）');
eq(feb.units[0].payDays, 30, '★暦28日でも支給日数は30日（1号）。暦より多くもらえる');
// ★★ここは規則1に助けられた: 「2月開始なら179日」と書いて赤くなったが、**間違っていたのは検査のほう**。
//   ずれの正体は「180日目までの各満了期間の“暦日数の合計” − 30日×その期間数」。
//   2月開始は 28+31+30+31+30 = **150日** ＝ 30×5 とぴたり一致するので **ずれない**（67%は180日フル）。
//   4月開始は 30+31+30+31+31 = **153日** で3日ぶんずれる（67%は177日）。
//   → **2月をまたぐ人だけ帳尻が合う**。「必ず177日」と覚えると間違える。
eq(feb.payDays67, 180, '★2月開始なら67%は180日フル（短い2月が31日の月を相殺する）');
eq(feb.ikujiTotal, 2116000, '★同じ365日・同じ月給でも、開始日が違えば合計が10,100円違う');
checks++;
if (feb.ikujiTotal === r.ikujiTotal) {
  failed++;
  console.error('  ✗ ★開始日が違えば合計も変わるはず（開始日を無視した実装なら同額になり赤くなる）');
}

// 上限に張りつく人（月給60万）。180日**ちょうど**休んでも67%は180日分もらえない
const rich2 = calcIkuji(
  { total6m: 600000 * 6, startDate: APR, leaveDays: 180, shien: { ownDays: 0, spouseDays: 0 } },
  D,
);
eq(rich2.capped, true, '月給60万は上限に張りつく');
eq(rich2.payDays67, 177, '★★暦で180日休んでも、67%で払われるのは177日（5月・7月・8月が31日あるため）');
eq(rich2.ikujiTotal, 323811 * 5 + yen(16110 * 27 * RATE_HIGH), '★上限額×5か月＋終了月27日分');
eq(rich2.ikujiTotal, 1910484, '★実額。「323,811×6か月＝1,942,866」は32,382円の過大');
eq(rich2.shien.eligible, false, '出生後休業をしていなければ13%は乗らない');

// ── 10. fail closed（参照データが無ければ計算しない）──────────────
throws(() => calcIkuji({ total6m: 1800000, startDate: APR, leaveDays: 180, shien: null }, null), '★参照データなしでは計算しない（fail closed）');
throws(() => applyIkujiCaps(10000, null), '★上下限データなしでは丸めない（fail closed）');
throws(() => applyIkujiCaps(10000, { chingin_nichigaku_min: 3014 }), '上限が欠けたデータで計算しない');
throws(() => calcIkuji({ total6m: 0, startDate: APR, leaveDays: 180, shien: null }, D), '賃金総額が0なら計算しない');
throws(() => calcIkuji({ total6m: 1800000, startDate: APR, leaveDays: 0, shien: null }, D), '休業日数が0なら計算しない');

// ── 11. ★★「渡し忘れ」を構造的に殺す（3便連続で踏んだ事故の型）─────────
// /furusato/ の fuyoNensho（第23便）・/shobyo/ の startDate（第25便）と同じ型:
// **コアは正しいのに、ページが省略可能な引数を渡し忘れて、給付が黙って消える**。
// 対策は「もっとテストする」ではなく **引数を必須にすること**。以下はその錠前。
throws(
  () => calcIkuji({ total6m: 1800000, startDate: APR, leaveDays: 180 }, D),
  '★★shien を省略したら計算しない（省略を「対象外」と読むと13%が黙って消える）',
);
// ★★startDate も同じ錠前をかける（第3便）。開始日を渡し忘れたら計算させない。
//   省略を許して「30日ずつ区切る」に落ちる道を残すと、**ページが渡し忘れても単体は永久に緑**のまま、
//   本番だけが 1年で25,100円 過大に答え続ける（＝まさに今回直したバグの再発経路）。
throws(
  () => calcIkuji({ total6m: 1800000, leaveDays: 180, shien: null }, D),
  '★★休業開始日を省略したら計算しない（支給単位期間は開始日の応当日で決まる・61条の7第5項）',
);
throws(
  () => calcIkuji({ total6m: 1800000, startDate: '', leaveDays: 180, shien: null }, D),
  '★空文字の開始日も弾く（未入力のフォームがそのまま流れてくる形）',
);
throws(
  () => shienKyufu(w, undefined, 28, false),
  '★自分の休業日数を知らないまま13%を判定しない',
);
throws(
  () => shienKyufu(w, 28, undefined, false),
  '★★配偶者の日数を知らないまま「配偶者要件を満たさない」と決めつけない（渡し忘れ＝不支給、は事故）',
);
// 免除される人（ひとり親等）だけは、配偶者の日数を知らなくてよい（61条の10第2項）
eq(shienKyufu(w, 28, undefined, true).eligible, true, 'ひとり親等は配偶者の日数なしで判定できる（2項）');
// 「対象外」は呼び出し側が言明する。黙って0円にする道は残さない
eq(calcIkuji({ total6m: 1800000, startDate: APR, leaveDays: 180, shien: null }, D).shien.reason, 'not_applicable',
   '対象外は shien: null で**明示的に**言明された状態だけ');

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
