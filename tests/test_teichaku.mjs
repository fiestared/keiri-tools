// 就業促進定着手当（/teichaku/）の純ロジック検査。 node tests/test_teichaku.mjs
//
// ★期待値は一次資料の公表値・式から手で出した値。core の出力をなぞらない。
//   公表例: 和歌山労働局「受給資格者のしおり」
//     https://jsite.mhlw.go.jp/wakayama-roudoukyoku/content/contents/001277222.pdf
//     （10,000 − 9,500）× 183日 ＝ 91,500円、上限 6,307 × 90日 × 20% ＝ 113,526円 → 支給 91,500円
//   式: ハローワーク LL080801保03 https://www.hellowork.mhlw.go.jp/doc/syuugyousokushin.pdf
//   端数: 雇用保険業務取扱要領 50615（第3位四捨五入→最後に切捨て） https://www.mhlw.go.jp/content/001689749.pdf
//   期間: 同 57263（就職後最初の締切日の翌日から6か月） https://www.mhlw.go.jp/content/001730830.pdf
//   上限額・下限額の年度値: LL060730保01 https://www.mhlw.go.jp/content/001281480.pdf
//                         LL080731保01 https://www.mhlw.go.jp/content/001726934.pdf
import { readFileSync } from "node:fs";
import { calcTeichaku, wagePeriod, minashiRaw, limitsFor } from "../docs/assets/teichaku_core.js";

const load = (f) => JSON.parse(readFileSync(new URL(`../docs/assets/${f}`, import.meta.url)));
const D = load("kihonteate_r07.json");
const H = load("teichaku_history.json");

let fails = 0, n = 0;
const eq = (name, got, want) => {
  n++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`❌ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`✓ ${name}`);
};

// ── 1. 公表例の1円照合（和歌山労働局しおり） ──────────────────────────
//   月給30万→離職前の賃金日額10,000円、月給28.5万→9,500円、暦日数183日（4/1〜9/30）。
//   基本手当日額6,307円は**この例の人の日額**（上限額ではない）。就職日はどの適用期間でも
//   上限（6,395／6,570／6,745円）に当たらないので、3つの期間すべてで同じ額になるはず。
for (const shushoku of ["2025-04-01", "2025-10-01", "2026-09-01"]) {
  const r = calcTeichaku({ age: 35, shushoku, closing: 31, zenNichigaku: 10000, kihonDaily: 6307,
    remaining: 90, type: "getsukyu", wages: Array(6).fill(285000) }, D, H);
  eq(`公表例 ${shushoku} 就職: 再就職後の賃金日額 9,500円`, r.minashi.clamped, 9500);
  eq(`公表例 ${shushoku} 就職: 上限 113,526円`, r.cap, 113526);
  // 暦日数は期間で変わる。4/1〜9/30 は183日（公表例の日数）
  if (shushoku === "2025-04-01") {
    eq("公表例: 4/1就職・末日締めの暦日数は183日", r.baseDays, 183);
    eq("公表例: 計算額 (10,000−9,500)×183 ＝ 91,500円", r.gross, 91500);
    eq("公表例: 支給額 91,500円（上限113,526円より少ない）", r.amount, 91500);
  }
}

// ── 2. 対象の6か月（要領57263） ───────────────────────────────────────
eq("末日締め・1日就職は就職日から（締切日の翌日）", wagePeriod("2026-04-01", 31).start, "2026-04-01");
eq("末日締め・10日就職は翌月1日から", wagePeriod("2026-04-10", 31).start, "2026-05-01");
eq("末日締め・10日就職の終わりは10月31日", wagePeriod("2026-04-10", 31).end, "2026-10-31");
eq("末日締め・月末日に就職（その日が締切日）は翌日から", wagePeriod("2026-04-30", 31).start, "2026-05-01");
eq("15日締め・16日就職は就職日から", wagePeriod("2026-04-16", 15).start, "2026-04-16");
eq("15日締め・16日就職の終わりは10月15日", wagePeriod("2026-04-16", 15).end, "2026-10-15");
eq("15日締め・15日就職（締切日当日）は16日から", wagePeriod("2026-04-15", 15).start, "2026-04-16");
eq("20日締め・1日就職は21日から", wagePeriod("2026-04-01", 20).start, "2026-04-21");
// 暦日数: 7/1〜12/31 が最大184日、9/1〜2/28（平年）が最小181日、うるう年2月を含むと182日
eq("7/1〜12/31 は184日", wagePeriod("2026-07-01", 31).calendarDays, 184);
eq("9/1〜翌2/28（平年）は181日", wagePeriod("2026-09-01", 31).calendarDays, 181);
eq("9/1〜翌2/29（うるう年）は182日", wagePeriod("2027-09-01", 31).calendarDays, 182);
eq("月ごとの日数の合計＝暦日数", wagePeriod("2026-04-10", 25).months.reduce((a, m) => a + m.days, 0),
   wagePeriod("2026-04-10", 25).calendarDays);

// ── 3. 日給・時給の最低保障と端数（要領50603・50615） ─────────────────
//   合計1,000,000円・労働日数100日: (a) 1,000,000÷180 = 5,555.555… → 5,555.56
//                                   (b) 1,000,000÷100 = 10,000.00 × 0.7 = 7,000.00 → 高い方 7,000円
eq("日給: 最低保障(b)が高いと(b)を使う", minashiRaw("nikkyu", 1000000, 100).raw, 7000);
eq("日給: (a)は第3位四捨五入で5,555.56円", minashiRaw("nikkyu", 1000000, 100).w1Cents, 555556);
//   労働日数126日ちょうど: (b) 1,000,000÷126 = 7,936.507… → 7,936.51 × 0.7 = 5,555.557 → 5,555.56
//   (a)と(b)が同額 → 5,555円（180×70%＝126日以上なら原則どおりと要領50603が言う境目）
eq("日給: 126日は(a)(b)同額で5,555円", minashiRaw("nikkyu", 1000000, 126).raw, 5555);
//   125日: (b) 8,000.00 × 0.7 = 5,600.00 → (b)
eq("日給: 125日は(b)の5,600円", minashiRaw("nikkyu", 1000000, 125).raw, 5600);
//   月給は最低保障なし（同じ数字でも(a)だけ）
eq("月給: 最低保障は使わない", minashiRaw("getsukyu", 1000000, 100).raw, 5555);
eq("日給月給: 最低保障は使わない", minashiRaw("nikkyu_gekkyu", 1000000, 100).raw, 5555);
//   (b)の途中丸め: 合計 1,000,001・3日 → 333,333.666… → 333,333.67 × 0.7 = 233,333.569 → 233,333.57
eq("日給: (b)は1日あたりを第3位で丸めてから70%", minashiRaw("nikkyu", 1000001, 3).w2Cents, 23333357);

// ── 4. 上限で頭打ち／上限の境目 ─────────────────────────────────────
//   上限 = 日額 × 残日数 × 2/10。6,000円×50日 → 60,000円。計算額が60,000円ちょうどなら頭打ちでない。
const base = { age: 35, shushoku: "2026-09-01", closing: 31, kihonDaily: 6000, remaining: 50, type: "getsukyu" };
// 9/1〜2/28 は181日。差額 x × 181 が 60,000 を超えるか。331円×181=59,911 / 332円×181=60,092
const wagesFor = (daily) => Array(6).fill(daily * 30); // 合計 daily×180 → ÷180 でちょうど daily
const r331 = calcTeichaku({ ...base, zenNichigaku: 9331, wages: wagesFor(9000) }, D, H);
eq("差331円×181日＝59,911円は上限60,000円未満", [r331.amount, r331.capApplied], [59911, false]);
const r332 = calcTeichaku({ ...base, zenNichigaku: 9332, wages: wagesFor(9000) }, D, H);
eq("差332円×181日＝60,092円は上限60,000円で頭打ち", [r332.amount, r332.capApplied], [60000, true]);
//   基本手当日額の上限（就職日の期間）: 2026-09 就職は6,745円、2026-07 就職は6,570円、2025-07 就職は6,395円
const hi = { age: 45, closing: 31, zenNichigaku: 18000, kihonDaily: 9000, remaining: 100, type: "getsukyu", wages: wagesFor(9000) };
eq("2026-08-01就職の上限は6,745×100×20%", calcTeichaku({ ...hi, shushoku: "2026-08-01" }, D, H).cap, 134900);
eq("2026-07-31就職の上限は6,570×100×20%", calcTeichaku({ ...hi, shushoku: "2026-07-31" }, D, H).cap, 131400);
eq("2025-07-31就職の上限は6,395×100×20%", calcTeichaku({ ...hi, shushoku: "2025-07-31" }, D, H).cap, 127900);
eq("60歳・2026-08就職の上限は5,454×100×20%", calcTeichaku({ ...hi, age: 60, shushoku: "2026-08-01" }, D, H).cap, 109080);
eq("59歳・2026-08就職の上限は6,745×100×20%", calcTeichaku({ ...hi, age: 59, shushoku: "2026-08-01" }, D, H).cap, 134900);

// ── 5. 賃金日額の上限・下限（LL080801保03 ＊1・注） ─────────────────
//   2026-08 就職・45歳: 上限18,220円。離職前20,000円は18,220円で頭打ち。
const cl = calcTeichaku({ ...hi, shushoku: "2026-08-01", zenNichigaku: 20000 }, D, H);
eq("離職前の賃金日額は上限18,220円で頭打ち", cl.zen.clamped, 18220);
//   再就職後の賃金日額が下限3,203円未満なら3,203円に引き上げ（差が縮む）
const lo = calcTeichaku({ ...base, shushoku: "2026-08-01", zenNichigaku: 5000, wages: wagesFor(3000) }, D, H);
eq("再就職後の賃金日額3,000円は下限3,203円に引き上げ", lo.minashi.clamped, 3203);
//   離職前の賃金日額が下限額なら支給しない（要領57262ハ）
const atMin = calcTeichaku({ ...base, shushoku: "2026-08-01", zenNichigaku: 3203, wages: wagesFor(2000) }, D, H);
eq("離職前の賃金日額が下限3,203円なら0円", [atMin.zenAtMin, atMin.amount], [true, 0]);
const below = calcTeichaku({ ...base, shushoku: "2026-08-01", zenNichigaku: 3000, wages: wagesFor(2000) }, D, H);
eq("離職前3,000円（下限未満）も下限扱いで0円", [below.zenAtMin, below.amount], [true, 0]);
//   2025-08〜2026-07 就職の下限は3,014円
eq("2026-07就職の下限は3,014円", limitsFor("2026-07-01", 35, D, H).min, 3014);
eq("2025-07就職の下限は2,869円", limitsFor("2025-07-01", 35, D, H).min, 2869);

// ── 6. 下がっていなければ0円 ───────────────────────────────────────
const same = calcTeichaku({ ...base, zenNichigaku: 9000, wages: wagesFor(9000) }, D, H);
eq("同額なら0円", [same.notLower, same.amount], [true, 0]);
const up = calcTeichaku({ ...base, zenNichigaku: 8999, wages: wagesFor(9000) }, D, H);
eq("上がっていれば0円", [up.notLower, up.amount], [true, 0]);
const down1 = calcTeichaku({ ...base, zenNichigaku: 9001, wages: wagesFor(9000) }, D, H);
eq("1円下がれば1円×181日", down1.amount, 181);

// ── 7. 適用期間の外は計算しない（fail closed） ───────────────────────
eq("2025-03-31 就職は対象外（旧率40%/30%）", calcTeichaku({ ...base, shushoku: "2025-03-31", zenNichigaku: 10000, wages: wagesFor(9000) }, D, H).reason, "before_start");
eq("2025-04-01 就職は対象", calcTeichaku({ ...base, shushoku: "2025-04-01", zenNichigaku: 10000, wages: wagesFor(9000) }, D, H).ok, true);
const next = D._meta.next_revision; // 2027-08-01
eq(`次回改定日 ${next} 以後の就職は未収録`, calcTeichaku({ ...base, shushoku: next, zenNichigaku: 10000, wages: wagesFor(9000) }, D, H).reason, "beyond_data");
eq("存在しない日付は計算しない", calcTeichaku({ ...base, shushoku: "2026-02-30", zenNichigaku: 10000, wages: wagesFor(9000) }, D, H).ok, false);

// ── 8. データの整合（毎年の差し替えで穴が空かないこと） ───────────────
//   過去期間の最後の日の翌日 ＝ 現在の適用開始日。穴が空くとその間の就職を黙って断る。
const lastTo = H.periods[H.periods.length - 1].to;
const dayAfter = new Date(Date.parse(lastTo + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
eq("過去期間の終わりの翌日＝kihonteate_r07.json の適用開始日", dayAfter, D._meta.applies_from);
eq("過去期間は START（2025-04-01）を覆う", H.periods.some((p) => p.from <= H.start && H.start <= p.to), true);
//   過去期間どうしにも穴が無い
for (let i = 1; i < H.periods.length; i++) {
  const prev = new Date(Date.parse(H.periods[i - 1].to + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  eq(`期間${i - 1}→${i} が連続`, prev, H.periods[i].from);
}

console.log(fails ? `\n❌ ${fails}/${n} 件 失敗` : `\nall ${n} teichaku checks passed`);
process.exit(fails ? 1 : 0);
