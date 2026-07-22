/**
 * 壊しテスト: test_denchoho_aoiro.mjs が **必ず落ちる** ことを確かめる。
 *
 * なぜ要るか(規則2): 検査は緑しか出力しないので、素通しは緑と区別がつかない。
 * 壊す前にベースラインが緑であることを必ず確かめる(常に赤なら何を壊しても赤で嘘の満点が出る)。
 *
 * ★この検査は「記事 × 本番参照データ」の照合なので、**両方向**を壊す:
 *   A. 記事の側に、2026-07-23に取り除いた誤り(65万円)を戻す
 *   B. 参照データの側の金額を動かす → 記事が**データに結び付いている**ことの証明
 *      (Bが素通しするなら、記事は「75万円という文字列」に固定されているだけで、
 *       データが改定されたときに黙って古くなる)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ART = new URL("../docs/column/denchoho-wakariyasuku/index.html", import.meta.url);
const DATA = new URL("../docs/assets/setsuzei_r08.json", import.meta.url);
const TEST = new URL("./test_denchoho_aoiro.mjs", import.meta.url);

const origArt = readFileSync(ART, "utf8");
const origData = readFileSync(DATA, "utf8");

const runTest = () => {
  try { execFileSync(process.execPath, [TEST.pathname], { stdio: "pipe" }); return true; }
  catch { return false; }
};

/** [名前, 対象, 置換前, 置換後] */
const BREAKS = [
  ["A1 ★取り除いた誤りを戻す（デジタルシームレスの効果を「65万円」と名乗る）",
   ART, "青色申告特別控除が75万円</b>になります", "青色申告特別控除65万円</b>の適用も受けられます"],

  ["A2 金額だけ 65万円 に書き換える（データとの不一致）",
   ART, "<b>青色申告特別控除が75万円</b>", "<b>青色申告特別控除が65万円</b>"],

  ["A3 前提要件（デジタルシームレス単独では不可）の一文を消す",
   ART, "<b>ただしデジタルシームレスだけでは75万円になりません。</b>", ""],

  ["A4 適用年分を「令和8年分以後」に前倒しする（第1便の事故の型）",
   ART, "<b>青色申告特別控除は令和9年分以後の所得税から</b>", "<b>青色申告特別控除は令和8年分以後の所得税から</b>"],

  ["A5 5項一号（優良な電子帳簿）の名指しを消す",
   ART, "一号＝優良な電子帳簿、", ""],

  ["A6 シミュレーターへの導線を外す",
   ART, 'href="/aoiro-kojo/"', 'href="/column/"'],

  ["B1 ★参照データの最高額を 65万円 に変える（記事がデータに結び付いている証明）",
   DATA, '"top": 750000', '"top": 650000'],

  ["B2 参照データの適用開始年分を令和8年分に変える",
   DATA, '"first_year": "令和9年分"', '"first_year": "令和8年分"'],
];

let caught = 0;
console.log("ベースライン確認（無傷の状態で緑であること）");
if (!runTest()) {
  console.error("  ❌ 無傷の状態で既に赤。壊しテストは意味を持たないので中止する（規則2）");
  process.exit(1);
}
console.log("  ✅ ベースライン緑\n");

for (const [name, target, from, to] of BREAKS) {
  const orig = target === ART ? origArt : origData;
  if (!orig.includes(from)) {
    console.error(`  ⚠️  壊し方が外れた（対象文字列が無い）: ${name}`);
    console.error(`      → 検査の弱さではなく壊し方の問題（規則8）。壊し方を直すこと`);
    caught = -1000;
    continue;
  }
  const n = orig.split(from).length - 1;
  if (n !== 1) {
    console.error(`  ⚠️  壊し方が一意でない（${n}箇所に一致）: ${name}（規則4/8）`);
    caught = -1000;
    continue;
  }
  writeFileSync(target, orig.replace(from, to));
  try {
    const green = runTest();
    if (green) console.error(`  ❌ 素通し: ${name}`);
    else { console.log(`  ✅ 捕捉: ${name}`); caught++; }
  } finally {
    writeFileSync(ART, origArt);
    writeFileSync(DATA, origData);
  }
}

console.log(`\n${caught === BREAKS.length ? "✅" : "❌"} ${caught}/${BREAKS.length} 捕捉`);
process.exit(caught === BREAKS.length ? 0 : 1);
