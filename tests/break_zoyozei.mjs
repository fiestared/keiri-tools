/**
 * 壊しテスト: 贈与税コア（zoyozei_core.js）に「ありそうな間違い」を注入し、
 * test_zoyozei.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷のコアで検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す（新規ファイルは git に無いので
 *   `git checkout --` では戻せない）。zoyozei_core は外部importが無いのでコピーだけでよい。
 *
 * 注入する間違いは、すべて「このツールで実際に黙って誤答しうる」もの:
 *   - 基礎控除110万を引かない／額を誤る
 *   - 速算表の帯の境界・控除額を誤る
 *   - 一般税率と特例税率を取り違える（単一・混在とも）
 *   - 混在の按分を落とす／割合を取り違える
 *   - 110万以下の非課税判定を誤る／fail closed を外す
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CORE = new URL("../docs/assets/zoyozei_core.js", import.meta.url);
const TEST = new URL("./test_zoyozei.mjs", import.meta.url);
const ASSETS_ABS = JSON.stringify(new URL("../docs/assets/", import.meta.url).href);
const orig = readFileSync(CORE, "utf8");
const testSrc = readFileSync(TEST, "utf8");

/** [名前, 置換前, 置換後] */
const BREAKS = [
  ["★基礎控除110万を引かない（贈与全額に課税＝税額を過大に）",
   "const baseAfter = Math.floor(Math.max(0, total - kiso) / 1000) * 1000;",
   "const baseAfter = Math.floor(Math.max(0, total) / 1000) * 1000;"],

  ["★基礎控除額を110万→60万に誤る（課税価格を過大に）",
   "const kiso = yen(D.kiso_kojo?.amount);",
   "const kiso = 600000;"],

  ["★速算表の帯の境界を『未満』にずらす（200万ちょうどの人を15%にする）",
   "if (b.upto === null || b.upto === undefined || v <= b.upto) {",
   "if (b.upto === null || b.upto === undefined || v < b.upto) {"],

  ["★速算表の控除額を引かない（税額を過大に）",
   "return { zei: Math.max(0, v * b.rate_pct / 100 - b.deduction), rate_pct: b.rate_pct, deduction: b.deduction, label: b.label };",
   "return { zei: Math.max(0, v * b.rate_pct / 100 - 0), rate_pct: b.rate_pct, deduction: b.deduction, label: b.label };"],

  ["★単一の特例贈与を一般表で計算する（税率の取り違え＝税額を過大に）",
   "const s = sokusanZoyo(baseAfter, D.tokurei);\n      zeiRaw = s.zei;",
   "const s = sokusanZoyo(baseAfter, D.ippan);\n      zeiRaw = s.zei;"],

  ["★混在の按分を落とす（合計を全額一般として計算＝過大／過少に）",
   "zeiRaw = gPart + sPart;",
   "zeiRaw = g.zei;"],

  ["★混在の按分の割合を取り違える（一般側に特例の割合を掛ける）",
   "const gPart = g.zei * ippan / total;",
   "const gPart = g.zei * tokurei / total;"],

  ["★混在で特例側を一般表で計算する（税率の取り違え）",
   "const s = sokusanZoyo(baseAfter, D.tokurei);\n      const gPart",
   "const s = sokusanZoyo(baseAfter, D.ippan);\n      const gPart"],

  ["★110万以下の非課税判定を『未満』に誤る（110万ちょうどを課税扱いにする）",
   "const below = total <= kiso;",
   "const below = total < kiso;"],

  ["fail closed を外す（贈与額0でも黙って計算する）",
   "if (total <= 0) throw new Error('その年に受けた贈与財産の合計額を入力してください');",
   "if (false) throw new Error('その年に受けた贈与財産の合計額を入力してください');"],
];

const dir = mkdtempSync(join(tmpdir(), "breakzoyo-"));

// ★規則2: 壊す前に、ベースラインが緑であることを確かめる
try {
  execFileSync(process.execPath, [TEST.pathname], { stdio: "pipe" });
} catch {
  console.error("✗ ベースラインが既に赤い。壊しテスト以前の問題なので中止する。");
  process.exit(1);
}
console.log("✓ ベースライン: 無傷のコアで検査は緑\n");

let caught = 0, missed = 0;
for (const [name, from, to] of BREAKS) {
  if (!orig.includes(from)) {
    console.log(`  ✗ 壊し方が外れた（対象の行が無い）: ${name}`);
    console.log("     → 検査が弱いのではなく壊し方が古い。実装の変更に追随させること（規則8）");
    missed++;
    continue;
  }
  const brokenCore = join(dir, "zoyozei_core.js");
  const brokenTest = join(dir, "test.mjs");
  writeFileSync(brokenCore, orig.replace(from, to));
  // テストは temp のコアを見て、参照データは本物を読むよう書き換える。
  writeFileSync(brokenTest, testSrc
    .replace("'../docs/assets/zoyozei_core.js'", "'./zoyozei_core.js'")
    .replace("new URL('../docs/assets/', import.meta.url)", ASSETS_ABS));

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
if (missed) {
  console.error("\n※ 素通しを見たら「検査が弱いのか、壊し方が外れたのか」を区別すること（規則8）");
  process.exit(1);
}
console.log("✓ 全ての壊しを捕捉した");
