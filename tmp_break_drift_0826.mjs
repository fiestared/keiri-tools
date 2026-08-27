/** 壊しテスト（規則2）: 旧値 0.4 に戻すと、この検査が本当に赤くなるか。
 *  本物の qa_search.js は書き換えず、写しを作って test 側に読ませる。 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";

// ① ベースライン: 無傷なら緑
execSync("node tests/test_qa_stopword_drift.mjs", { stdio: "pipe" });
console.log("① ベースライン緑（現行 0.25 では跨がれていない）");

// ② 旧値 0.4 に戻した写しの木を /tmp ではなくリポ内の使い捨てに作る
const root = "tmp_drift_break_0826";
mkdirSync(root + "/docs/assets", { recursive: true });
mkdirSync(root + "/tests", { recursive: true });
const src = readFileSync("docs/assets/qa_search.js", "utf8");
const broken = src.replace("const COVERAGE_STOPWORD_DF_RATIO = 0.25;", "const COVERAGE_STOPWORD_DF_RATIO = 0.4;");
if (broken === src) throw new Error("壊し方が外れた（規則8: 検査が弱いのか壊し方が外れたのかを区別する）");
writeFileSync(root + "/docs/assets/qa_search.js", broken);
copyFileSync("docs/assets/qa_index.json", root + "/docs/assets/qa_index.json");
copyFileSync("tests/test_qa_stopword_drift.mjs", root + "/tests/test_qa_stopword_drift.mjs");

let red = false, out = "";
try {
  execSync(`node ${root}/tests/test_qa_stopword_drift.mjs`, { stdio: "pipe" });
} catch (e) {
  red = true;
  out = (e.stdout || "").toString() + (e.stderr || "").toString();
}
if (!red) throw new Error("★旧値に戻しても緑だった＝この検査は門のドリフトを守っていない");
const line = out.split("\n").find((l) => l.includes("門を跨がれた")) || "";
console.log("③ 旧値 0.4 に戻すと赤。捕まえた文言:");
console.log("   " + line.trim().slice(0, 120));
