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
   "const highDays = Math.min(d, Math.max(0, HIGH_DAYS - e));",
   "const highDays = e < HIGH_DAYS ? d : 0;"],

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
