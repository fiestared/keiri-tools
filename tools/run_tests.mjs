/**
 * tests/test_*.mjs を全部走らせて、落ちたものだけ出す。
 * （シェルの for ループが使えない環境向け。node tools/run_tests.mjs）
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(join(root, "tests"))
  .filter((f) => f.startsWith("test_") && f.endsWith(".mjs"))
  .sort();

const only = process.argv[2];
let fails = 0;
for (const f of files) {
  if (only && !f.includes(only)) continue;
  const r = spawnSync(process.execPath, [join("tests", f)], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) {
    fails++;
    console.log(`\n=== FAIL ${f} ===`);
    console.log(((r.stdout || "") + (r.stderr || "")).split("\n").slice(-25).join("\n"));
  }
}
console.log(fails ? `\n❌ ${fails}ファイル失敗 / ${files.length}` : `\n✅ 全${files.length}ファイル緑`);
process.exit(fails ? 1 : 0);
