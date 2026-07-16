/**
 * 壊しテスト: 医療費控除コア（iryohi_core.js）に「ありそうな間違い」を注入し、
 * test_iryohi.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷のコアで検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す（新規ファイルは git に無いので
 *   `git checkout --` では戻せない。第25便の教訓）。
 *
 * 注入する間違いは、すべて「このツールで実際に黙って誤答しうる」もの:
 *   - 足切りを一律10万円にする（5%側を無視＝低所得の人が控除を失う。記事の目玉の逆）
 *   - 補填金を医療費全体から引く（ひも付きルールを無視＝控除額を過小に出す）
 *   - 復興特別所得税・住民税を落とす／税率で住民税を出す（軽減額を誤る）
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CORE = new URL("../docs/assets/iryohi_core.js", import.meta.url);
const TEST = new URL("./test_iryohi.mjs", import.meta.url);
const JUMINZEI_CORE = JSON.stringify(new URL("../docs/assets/juminzei_core.js", import.meta.url).href);
const ASSETS_ABS = JSON.stringify(new URL("../docs/assets/", import.meta.url).href);
const orig = readFileSync(CORE, "utf8");
const testSrc = readFileSync(TEST, "utf8");

/** [名前, 置換前, 置換後] */
const BREAKS = [
  ["★足切りを一律10万円にする（5%側を無視＝低所得の人が控除を失う。記事の目玉の逆）",
   "const gopct = Math.floor(yen(sotoShotoku) * K.ashikiri_rate_pct / 100);\n  return Math.min(gopct, K.ashikiri_cap);",
   "return K.ashikiri_cap;"],

  ["足切りを「5%と10万の高いほう」にする（min→max）",
   "return Math.min(gopct, K.ashikiri_cap);",
   "return Math.max(gopct, K.ashikiri_cap);"],

  ["足切りの率を10%にする（5%を読み違える）",
   "const gopct = Math.floor(yen(sotoShotoku) * K.ashikiri_rate_pct / 100);",
   "const gopct = Math.floor(yen(sotoShotoku) * 10 / 100);"],

  ["★控除額の上限200万円を外す（高額医療の人に過大な控除を出す）",
   "const kojo = Math.min(Math.max(0, netIryohi - ashikiri), K.kojo_cap);",
   "const kojo = Math.max(0, netIryohi - ashikiri);"],

  ["★補填金をひも付き医療費でなく総額から引く（No.1125を無視＝控除額を過小に）",
   "const netHoten = Math.min(yen(hoten), taisho);",
   "const netHoten = yen(hoten);"],

  ["補填金を引かない（補填を無視して控除額を過大に）",
   "const netIryohi = Math.max(0, hi - netHoten);",
   "const netIryohi = hi;"],

  ["セルフメディの下限12,000円を無視（購入額全額を控除に）",
   "const kojo = Math.min(Math.max(0, p - S.floor), S.cap);",
   "const kojo = Math.min(p, S.cap);"],

  ["セルフメディの上限88,000円を外す",
   "const kojo = Math.min(Math.max(0, p - S.floor), S.cap);",
   "const kojo = Math.max(0, p - S.floor);"],

  ["★復興特別所得税(2.1%)を落とす（軽減額を過小に）",
   "const fukko = Math.round(shotokuzei * K.fukko_pct / 100);",
   "const fukko = 0;"],

  ["★住民税の軽減を『所得税率』で出す（一律10%でない＝高所得者に過大な住民税還付）",
   "const jumin = Math.round(k * K.juminzei_pct / 100);",
   "const jumin = Math.round(k * r / 100);"],

  ["住民税の軽減を落とす",
   "const jumin = Math.round(k * K.juminzei_pct / 100);",
   "const jumin = 0;"],

  ["★税率の妥当性チェックを外す（未選択でも0円などで軽減額を出す＝黙って嘘の額）",
   "if (!isValidRate(rate, I)) return null;",
   "if (false) return null;"],

  ["速算表の帯の境界を『未満』にずらす（195万ちょうどの人を10%にする）",
   "if (b.kazei_upto === null || b.kazei_upto === undefined || v <= b.kazei_upto) return b.rate_pct;",
   "if (b.kazei_upto === null || b.kazei_upto === undefined || v < b.kazei_upto) return b.rate_pct;"],

  ["★渡し忘れガードを外す（年収も総所得も無いと足切り0で控除額を過大に）",
   "if (!hasSoto && !hasShunyu) {",
   "if (false) {"],

  ["fail closed を外す（iryohiデータが無くても計算しようとする）",
   "if (!I) throw new Error('参照データ（iryohi_r08.json）が渡されていません');\n  const i = input || {};",
   "const i = input || {};"],
];

const dir = mkdtempSync(join(tmpdir(), "breakiryohi-"));

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
  const brokenCore = join(dir, "iryohi_core.js");
  const brokenTest = join(dir, "test.mjs");
  // 壊したコアを temp に置く。juminzei_core への相対import は本物を指すよう絶対URLに書き換える。
  writeFileSync(brokenCore, orig.replace(from, to).replace("'./juminzei_core.js'", JUMINZEI_CORE));
  // テストは temp のコアを見て、参照データは本物を読むよう書き換える。
  writeFileSync(brokenTest, testSrc
    .replace("'../docs/assets/iryohi_core.js'", "'./iryohi_core.js'")
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
