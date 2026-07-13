/**
 * 壊しテスト: 雇用保険の実装に「ありそうな間違い」を注入し、
 * test_koyou_oracle.mjs が**必ず落ちる**ことを確かめる。
 *
 * なぜ要るか: 検査は緑しか出力しないので、**素通しは緑と区別がつかない**。
 * 「落ちるべきものが落ちる」を見るまで、その検査が効いているかは分からない（第4便の自戒）。
 *
 * 注入する間違いは、すべて私が実際にやりかけたもの:
 *   雇用保険は健保・厚年と作りが違う（賃金総額・非折半・上限なし）ので、
 *   隣の3つの作法をそのまま流用すると全部バグになる。
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CORE = new URL("../docs/assets/shaho_core.js", import.meta.url);
const ORACLE = new URL("./test_koyou_oracle.mjs", import.meta.url);
const orig = readFileSync(CORE, "utf8");
const oracleSrc = readFileSync(ORACLE, "utf8");

/** [名前, 置換前, 置換後] — 実装の1行を「もっともらしい誤り」に差し替える */
const BREAKS = [
  ["労使折半にしてしまう（二事業を折半に含める）",
   "const worker = (totalPermille - jigyo2Permille) / 2;",
   "const worker = totalPermille / 2;"],

  ["÷2 を忘れる（雇用保険率から二事業を引いただけ）",
   "const worker = (totalPermille - jigyo2Permille) / 2;",
   "const worker = totalPermille - jigyo2Permille;"],

  ["二事業を足してしまう（符号ミス）",
   "const worker = (totalPermille - jigyo2Permille) / 2;",
   "const worker = (totalPermille + jigyo2Permille) / 2;"],

  ["事業主も労働者と同額にしてしまう（＝折半だと思い込む）",
   "const employer = totalPermille - worker;",
   "const employer = worker;"],

  ["本人負担をもう一度1/2する（component()の作法を流用）",
   "const self = roundHalf(selfRaw);",
   "const self = roundHalf(selfRaw / 2);"],

  ["賃金を1,000円未満切捨する（標準賞与額の作法を流用）",
   "const total = wage * (totalPermille / 1000);",
   "wage = Math.floor(wage / 1000) * 1000; const total = wage * (totalPermille / 1000);"],

  ["賞与に150万円の上限をかける（厚年の作法を流用）",
   "const total = wage * (totalPermille / 1000);",
   "wage = Math.min(wage, 1500000); const total = wage * (totalPermille / 1000);"],

  ["端数を常に切上（50銭ちょうども切上げてしまう）",
   "const self = roundHalf(selfRaw);",
   "const self = Math.ceil(selfRaw);"],

  ["料率を1/1000でなく1/100で割る（％と1000分率の取り違え）",
   "const selfRaw = wage * (r.workerPermille / 1000);",
   "const selfRaw = wage * (r.workerPermille / 100);"],
];

const dir = mkdtempSync(join(tmpdir(), "breakkoyou-"));
let caught = 0, missed = 0;

for (const [name, from, to] of BREAKS) {
  if (!orig.includes(from)) {
    console.log(`  ✗ 壊し方が外れた（対象の行が無い）: ${name}`);
    console.log(`     → 検査が弱いのではなく壊し方が古い。実装の変更に追随させること`);
    missed++;
    continue;
  }
  // 壊した core と、それを参照するオラクルを一時ディレクトリに置いて実行する
  const brokenCore = join(dir, "shaho_core.js");
  const brokenOracle = join(dir, "oracle.mjs");
  writeFileSync(brokenCore, orig.replace(from, to));
  writeFileSync(brokenOracle, oracleSrc
    .replace('"../docs/assets/shaho_core.js"', '"./shaho_core.js"')
    .replace('new URL("../docs/assets/shaho_rates_r08.json", import.meta.url)',
             JSON.stringify(new URL("../docs/assets/shaho_rates_r08.json", import.meta.url).pathname)));

  let failed = false;
  try {
    execFileSync(process.execPath, [brokenOracle], { stdio: "pipe" });
  } catch {
    failed = true;  // オラクルが落ちた＝検査が効いている
  }
  if (failed) { caught++; console.log(`  ✓ 捕捉: ${name}`); }
  else { missed++; console.log(`  ✗ ★素通し: ${name}  ← 検査が効いていない`); }
}

console.log(`\n捕捉 ${caught} / ${BREAKS.length}　素通し ${missed}`);
if (missed > 0) {
  console.error("\n❌ 素通しがある。オラクルを強化すること（検査が弱いのか、壊し方が外れたのかを区別する）");
  process.exit(1);
}
console.log("✅ break_koyou: すべての壊し方で落ちる（オラクルは効いている）");
