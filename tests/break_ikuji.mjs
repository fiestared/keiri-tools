/**
 * 壊しテスト: 育児休業給付の実装に「ありそうな間違い」を注入し、
 * test_ikuji.mjs が **必ず落ちる** ことを確かめる。
 *
 * なぜ要るか: 検査は緑しか出力しないので、**素通しは緑と区別がつかない**。
 * 「落ちるべきものが落ちる」を見るまで、その検査が効いているかは分からない。
 *
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 *   （新規ファイルは git に無いので `git checkout --` では戻せない。第25便の教訓）
 *
 * 注入する間違いは、すべて「私が実際にやりかけた／世の解説が実際に間違えている」もの。
 * 筆頭は **上限額を本人の年齢で選んでしまう** こと（条文は年齢に関係なくハに固定している）。
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CORE = new URL("../docs/assets/ikuji_core.js", import.meta.url);
const TEST = new URL("./test_ikuji.mjs", import.meta.url);
const orig = readFileSync(CORE, "utf8");
const testSrc = readFileSync(TEST, "utf8");

/** [名前, 置換前, 置換後] */
const BREAKS = [
  ["★上限額を本人の年齢で選ぶ（45〜60歳の17,740円を使う）— 条文は年齢に関係なくハに固定",
   "const max = D?.chingin_nichigaku_max?.age30_44;",
   "const max = D?.chingin_nichigaku_max?.age45_59;"],

  ["★上限額に「30歳未満」の額(14,510円)を使う（若い人を不当に低く出す）",
   "const max = D?.chingin_nichigaku_max?.age30_44;",
   "const max = D?.chingin_nichigaku_max?.under30;"],

  ["給付率を 2/3 にする（傷病手当金の作法を流用。67%とは別物）",
   "export const RATE_HIGH = 0.67;",
   "export const RATE_HIGH = 2 / 3;"],

  ["端数を四捨五入にする（下限13%の10,970.96が10,971になる）",
   "return Math.floor(x + 1e-9);",
   "return Math.round(x);"],

  ["端数を切り上げにする",
   "return Math.floor(x + 1e-9);",
   "return Math.ceil(x);"],

  ["★180日目のまたぎを無視し、期間まるごとを50%/67%のどちらかにする",
   "  if (straddle) {\n    highDays = HIGH_DAYS - startDay + 1; // 応当日 → 180日目",
   "  if (false) {\n    highDays = HIGH_DAYS - startDay + 1; // 応当日 → 180日目"],

  // ───── ここから、第3便で実際に本番に出ていたバグの型（支給日数と休業日数の混同）─────

  ["★★支給単位期間を「30日ずつ」で区切る（＝開始日を無視する。本番で1年25,100円 過大に答えていたバグ）",
   "export function unitPeriods(startMs, leaveDays) {",
   "export function unitPeriods(startMs, leaveDays) {\n  { const n0 = Math.floor(Number(leaveDays)); const us = []; let e = 0, k = 0;\n    while (e < n0) { const d = Math.min(UNIT_DAYS, n0 - e);\n      us.push({ index: ++k, fromMs: startMs, toMs: startMs, from: fmtYmd(startMs), to: fmtYmd(startMs),\n                startDay: e + 1, endDay: e + d, calDays: d, isFinal: e + d >= n0 }); e += d; }\n    return us; }"],

  ["★★支給日数を「暦の日数」にする（31日の月に31日分払う。1号の『三十日』を読み落とす）",
   "    highDays = isFinal ? calDays : UNIT_DAYS;\n    lowDays = 0;",
   "    highDays = calDays;\n    lowDays = 0;"],

  ["★★終了月も30日で切る（2号の『終了した日までの日数』を読み落とす）",
   "    lowDays = isFinal ? calDays : UNIT_DAYS;",
   "    lowDays = UNIT_DAYS;"],

  ["★応当日のクランプを外す（1/31の1か月後を「2/31」＝3/3にしてしまう。5項の『その月の末日』を落とす）",
   "  return Date.UTC(y, mo + k, Math.min(day, lastOfTarget));",
   "  return Date.UTC(y, mo + k, day);"],

  ["★応当日のクランプを毎回“前月の丸めた日”から当てる（1/31→2/28→3/28。条文は3/31）",
   "  const day = s.getUTCDate();",
   "  const day = k > 1 ? new Date(addMonthsClamped(startMs, k - 1)).getUTCDate() : s.getUTCDate();"],

  // ⚠️この壊しは一度**素通し**した。原因は「検査が弱い」ではなく**壊し方が外れていた**（規則8）:
  //   ガード節（if）を消しただけでは parseYmd(undefined) が例外を投げるので、挙動は変わらない
  //   （＝錠前が**二重**にかかっている。これ自体は良いこと）。
  //   本当に危ないのは「省略されたら**黙って既定日にフォールバックする**」ほう。そこを壊す。
  ["★★開始日の必須（錠前）を外し、省略されたら黙って既定日で計算する",
   "  if (i.startDate === undefined || i.startDate === null || i.startDate === '') {\n    throw new Error(\n      '育児休業を開始した日（startDate）が渡されていません。支給単位期間は開始日からの応当日で' +\n        '区切られる（61条の7第5項）ため、開始日なしに「毎月いくら」は計算できません',\n    );\n  }\n  const startMs = parseYmd(i.startDate);",
   "  const startMs = i.startDate ? parseYmd(i.startDate) : Date.UTC(2026, 3, 1);"],

  ["67%が続く日数を183日（＝6か月と誤読）にする",
   "export const HIGH_DAYS = 180;",
   "export const HIGH_DAYS = 183;"],

  ["★就業した場合の頭打ちを100%にする（80%ではない、と取り違える）",
   "export const WORK_CAP = 0.8;",
   "export const WORK_CAP = 1.0;"],

  ["★出生後休業支援給付金の「配偶者も14日以上」要件を見ない（61条の10第1項3号を落とす）",
   "  if (!spouseExempt && sp < SHIEN_MIN_DAYS) {",
   "  if (false) {"],

  ["出生後休業支援給付金の28日の頭打ちを外す（40日休めば40日分出してしまう）",
   "const days = Math.min(own, SHIEN_MAX_DAYS);",
   "const days = own;"],

  ["産後パパ育休の28日の頭打ちを外す",
   "const d = Math.min(Math.max(0, Math.floor(Number(leaveDays) || 0)), SHUSSHOJI_MAX_DAYS);",
   "const d = Math.max(0, Math.floor(Number(leaveDays) || 0));"],

  ["賃金日額を ÷180 でなく ÷6÷31 で出す（月を31日で割る）",
   "return t / 180;",
   "return t / 6 / 31;"],

  ["★fail closed を外す（参照データが無くても既定値で計算してしまう）",
   "  if (!D) throw new Error('参照データ（kihonteate_r07.json）が渡されていません'); // fail closed\n  const i = input || {};",
   "  D = D || { chingin_nichigaku_max: { age30_44: 16110 }, chingin_nichigaku_min: 3014 };\n  const i = input || {};"],

  ["下限額を当てない（低賃金の人の給付が下限を割る）",
   "const floored = w < min;",
   "const floored = false;"],
];

const dir = mkdtempSync(join(tmpdir(), "breakikuji-"));
let caught = 0, missed = 0;

// ★規則2: 壊す前に、ベースラインが緑であることを確かめる
try {
  execFileSync(process.execPath, [TEST.pathname], { stdio: "pipe" });
} catch {
  console.error("✗ ベースラインが既に赤い。壊しテスト以前の問題なので中止する。");
  process.exit(1);
}

for (const [name, from, to] of BREAKS) {
  if (!orig.includes(from)) {
    console.log(`  ✗ 壊し方が外れた（対象の行が無い）: ${name}`);
    console.log("     → 検査が弱いのではなく壊し方が古い。実装の変更に追随させること");
    missed++;
    continue;
  }
  const brokenCore = join(dir, "ikuji_core.js");
  const brokenTest = join(dir, "test.mjs");
  writeFileSync(brokenCore, orig.replace(from, to));
  writeFileSync(brokenTest, testSrc
    .replace("'../docs/assets/ikuji_core.js'", "'./ikuji_core.js'")
    .replace("new URL('../docs/assets/kihonteate_r07.json', import.meta.url)",
             JSON.stringify(new URL("../docs/assets/kihonteate_r07.json", import.meta.url).pathname)));

  let failed = false;
  try {
    execFileSync(process.execPath, [brokenTest], { stdio: "pipe" });
  } catch {
    failed = true; // 検査が落ちた＝効いている
  }
  if (failed) { caught++; console.log(`  ✓ 捕捉: ${name}`); }
  else { missed++; console.log(`  ✗ ★素通し: ${name}  ← 検査が効いていない`); }
}

console.log(`\n捕捉 ${caught} / ${BREAKS.length}　素通し ${missed}`);
if (missed) process.exit(1);
