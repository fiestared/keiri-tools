/**
 * 壊しテスト: 相続税コア（sozokuzei_core.js）に「ありそうな間違い」を注入し、
 * test_sozokuzei.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷のコアで検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す（新規ファイルは git に無いので
 *   `git checkout --` では戻せない）。sozokuzei_core は外部importが無いのでコピーだけでよい。
 *
 * 注入する間違いは、すべて「このツールで実際に黙って誤答しうる」もの:
 *   - 基礎控除の額を旧法（5,000万＋1,000万×人数）にする／基礎控除を引かない
 *   - 養子の算入制限を外す（基礎控除が過大＝税額を過少に）
 *   - 速算表の帯の境界・控除額を誤る
 *   - 2割加算を落とす／全員に掛ける／配偶者の税額軽減を外す
 *   - 相続の順位（子を最優先）を壊す
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CORE = new URL("../docs/assets/sozokuzei_core.js", import.meta.url);
const TEST = new URL("./test_sozokuzei.mjs", import.meta.url);
const ASSETS_ABS = JSON.stringify(new URL("../docs/assets/", import.meta.url).href);
const orig = readFileSync(CORE, "utf8");
const testSrc = readFileSync(TEST, "utf8");

/** [名前, 置換前, 置換後] */
const BREAKS = [
  ["基礎控除の1人あたりを旧法1,000万円にする（600万×人数を誤る）",
   "K.teigaku + K.per_houtei_sozokunin * cnt(houteiCount)",
   "K.teigaku + 10000000 * cnt(houteiCount)"],

  ["基礎控除の定額を旧法5,000万円にする（3,000万を誤る）",
   "K.teigaku + K.per_houtei_sozokunin * cnt(houteiCount)",
   "50000000 + K.per_houtei_sozokunin * cnt(houteiCount)"],

  ["★課税遺産総額で基礎控除を引かない（遺産全額に課税＝税額を過大に）",
   "const kazeiIsan = Math.max(0, isanTotal - kiso);",
   "const kazeiIsan = isanTotal;"],

  ["★養子の算入制限を外す（実子ありでも養子を全員数える＝基礎控除が過大・税額を過少に）",
   "const youshi = Math.min(youshiRaw, youshiCap);",
   "const youshi = youshiRaw;"],

  ["★速算表の帯の境界を『未満』にずらす（1,000万ちょうどの人を15%にする）",
   "if (b.upto === null || b.upto === undefined || v <= b.upto) {",
   "if (b.upto === null || b.upto === undefined || v < b.upto) {"],

  ["★速算表の控除額を引かない（税額を過大に）",
   "Math.round(v * b.rate_pct / 100) - b.deduction",
   "Math.round(v * b.rate_pct / 100) - 0"],

  ["★法定相続分の1,000円未満切り捨てを外す（按分金額の端数処理を誤る）",
   "Math.floor(kazeiIsan * num / den / 1000) * 1000",
   "kazeiIsan * num / den"],

  ["★兄弟姉妹の2割加算を落とす（相法18条を無視＝税額を過少に）",
   "if (kasan) each = each + Math.round(each * kasanRate / 100);",
   "if (false) each = each + Math.round(each * kasanRate / 100);"],

  ["★2割加算を全員に掛ける（子・配偶者にも加算＝税額を過大に）",
   "return bloodKind === 'sibling';",
   "return true;"],

  ["★配偶者の税額軽減を外す（配偶者にも課税＝実際の納税額を過大に）",
   "perHeir.push({ who: 'spouse', label: '配偶者', count: 1, eachTax: 0, groupTax: 0, kasan: false, keigen: true });",
   "{ const st = Math.floor(Math.round(sogaku * frac.spouse[0] / frac.spouse[1]) / 100) * 100; perHeir.push({ who: 'spouse', label: '配偶者', count: 1, eachTax: st, groupTax: st, kasan: false, keigen: false }); jishitsu += st; }"],

  ["★相続の順位を壊す（子がいても第1順位にしない＝別の相続人構成で計算）",
   "if (effChildren > 0) {",
   "if (false) {"],

  ["fail closed を外す（法定相続人が0でも黙って計算する）",
   "if (sozokunin.count === 0) {",
   "if (false) {"],
];

const dir = mkdtempSync(join(tmpdir(), "breaksozoku-"));

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
  const brokenCore = join(dir, "sozokuzei_core.js");
  const brokenTest = join(dir, "test.mjs");
  writeFileSync(brokenCore, orig.replace(from, to));
  // テストは temp のコアを見て、参照データは本物を読むよう書き換える。
  writeFileSync(brokenTest, testSrc
    .replace("'../docs/assets/sozokuzei_core.js'", "'./sozokuzei_core.js'")
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
