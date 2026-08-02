/**
 * tests/test_*.mjs を全部走らせて、落ちたものだけ出す。
 * （シェルの for ループが使えない環境向け。node tools/run_tests.mjs）
 *
 * ★2026-08-02: 「赤」と「実行できていない」を分けた。
 *   `tests/test_extension_*.mjs` の3本は冒頭に `(要 npm i --no-save jsdom)` と書いてある
 *   **オプトインのテスト**で、jsdom が入っていない環境では ERR_MODULE_NOT_FOUND で終わる。
 *   それを「失敗3件」と数えていたので、このリポジトリの検査は**常時赤**だった。
 *
 *   常に赤い検査は「何を壊しても赤」で、緑/赤の情報量がゼロになる（CLAUDE.md 規則1・2）。
 *   かといって黙って除外すると「通った」と誤解される。だから**第3の状態として明示する**:
 *     緑 / 赤 / ★測定不能（依存が無くて実行できていない・入れ方も併記）
 *   これは revenue_check.py が「0円」と「測定不能」を混ぜないのと同じ規律。
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(join(root, "tests"))
  .filter((f) => f.startsWith("test_") && f.endsWith(".mjs"))
  .sort();

/** 外部パッケージが無くて起動すらできなかった場合に、そのパッケージ名を返す */
function missingDependency(out) {
  if (!out.includes("ERR_MODULE_NOT_FOUND")) return null;
  const m = out.match(/Cannot find package '([^']+)'/);
  if (!m) return null;
  // 自リポジトリ内の相対 import の取り違えは「依存が無い」ではなく本物の赤なので除外する
  return m[1].startsWith(".") || m[1].startsWith("/") ? null : m[1];
}

const only = process.argv[2];
let fails = 0;
let ran = 0;
const skipped = [];

for (const f of files) {
  if (only && !f.includes(only)) continue;
  const r = spawnSync(process.execPath, [join("tests", f)], { cwd: root, encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  if (r.status === 0) { ran++; continue; }

  const dep = missingDependency(out);
  if (dep) { skipped.push({ f, dep }); continue; }

  ran++;
  fails++;
  console.log(`\n=== FAIL ${f} ===`);
  console.log(out.split("\n").slice(-25).join("\n"));
}

if (skipped.length) {
  const deps = [...new Set(skipped.map((s) => s.dep))];
  console.log(`\n★測定不能 ${skipped.length}ファイル（依存が無くて実行できていない。緑ではない）:`);
  for (const s of skipped) console.log(`   ${s.f}  ← ${s.dep} が無い`);
  console.log(`   入れて回すなら: npm i --no-save ${deps.join(" ")}`);
}

console.log(fails
  ? `\n❌ ${fails}ファイル失敗 / 実行 ${ran}${skipped.length ? ` / ★測定不能 ${skipped.length}` : ""}`
  : `\n✅ 実行した${ran}ファイルは全て緑${skipped.length ? ` / ★測定不能 ${skipped.length}（上記）` : ""}`);
process.exit(fails ? 1 : 0);
