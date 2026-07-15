/**
 * 壊しテスト: 年収の壁コア（kabe_core.js）に「ありそうな間違い」を注入し、
 * test_kabe.mjs が **必ず落ちる** ことを確かめる。
 *
 * なぜ要るか（規則2）: 検査は緑しか出力しないので、**素通しは緑と区別がつかない**。
 * 「落ちるべきものが落ちる」を見るまで、その検査が効いているかは分からない。壊す前に
 * ベースラインが緑であることを必ず確かめる（常に赤なら何を壊しても赤で嘘の満点が出る）。
 *
 * ★kabe_core は shaho_core.js を import しているので、temp ディレクトリにコピーすると
 *   相対 import が壊れる。so 実ファイルをその場で壊し、**元の中身をメモリに持って finally で戻す**
 *   （新規ファイルは git に無いので git checkout では戻せない・第25便の教訓）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CORE = new URL("../docs/assets/kabe_core.js", import.meta.url);
const TEST = new URL("./test_kabe.mjs", import.meta.url);
const orig = readFileSync(CORE, "utf8");

const runTest = () => {
  try { execFileSync(process.execPath, [TEST.pathname], { stdio: "pipe" }); return true; }
  catch { return false; }
};

/** [名前, 置換前, 置換後] — すべて「実際にやりがちな取り違え」 */
const BREAKS = [
  ["★壁を『超える』で加入にする（130万ちょうどを扶養内にしてしまう。130万「未満」が扶養）",
   "const joins = annual >= wall;",
   "const joins = annual > wall;"],

  ["手取りに社会保険料を足してしまう（引くのではなく）",
   "const tedori = annual - shahoAnnual;",
   "const tedori = annual + shahoAnnual;"],

  ["★60歳以上でも被扶養者の壁を130万のままにする（180万に上げない）",
   "return (Number(age) >= 60) ? h.age60plus : h.amount;",
   "return h.amount;"],

  ["★適用拡大の壁(約106万)と被扶養者の壁(130万)を取り違える",
   "if (wallType === 'tekiyoKakudai') return K.shakaiHoken.tekiyoKakudai.amount;",
   "if (wallType === 'tekiyoKakudai') return K.shakaiHoken.hifuyousha.amount;"],

  ["社会保険料の年額を ×11 で出す（12か月ぶん引かない）",
   "annual: m.selfTotal * 12,",
   "annual: m.selfTotal * 11,"],

  ["★壁の底の手取りを 年収＋社保 で出す（引くのではなく足す）",
   "const bottomTedori = wall - bottomShaho.annual;",
   "const bottomTedori = wall + bottomShaho.annual;"],

  ["回復判定の向きを逆にする（手取りが基準「以下」で回復とみなす）",
   "if (t >= reference) { recovery = a; break; }",
   "if (t <= reference) { recovery = a; break; }"],

  ["★fail closed を外す（健康保険料率が無くても計算してしまう）",
   "  if (!(kenkoRate > 0)) throw new Error('健康保険料率が特定できません（都道府県を確認してください）');\n  const m = calcMonthly",
   "  const m = calcMonthly"],
];

// ★規則2: 壊す前に、ベースラインが緑であることを確かめる
if (!runTest()) {
  console.error("✗ ベースラインが既に赤い。壊しテスト以前の問題なので中止する。");
  process.exit(1);
}
console.log("✓ ベースライン: 無傷のコアで test_kabe は緑\n");

let caught = 0, missed = 0;
try {
  for (const [name, from, to] of BREAKS) {
    if (!orig.includes(from)) {
      console.log(`  ✗ 壊し方が外れた（対象の行が無い）: ${name}`);
      console.log("     → 検査が弱いのではなく壊し方が古い。実装の変更に追随させること（規則8）");
      missed++;
      continue;
    }
    writeFileSync(CORE, orig.replace(from, to));
    const green = runTest();
    if (green) { console.log(`  ✗ ★素通し: ${name}  ← 検査が効いていない`); missed++; }
    else { console.log(`  ✓ 捕捉: ${name}`); caught++; }
  }
} finally {
  writeFileSync(CORE, orig);   // どこで転んでも必ず元に戻す
}

console.log(`\n捕捉 ${caught} / ${BREAKS.length}　素通し ${missed}`);
if (missed) { console.error("\n※ 素通しを見たら「検査が弱いのか、壊し方が外れたのか」を区別すること（規則8）"); process.exit(1); }
console.log("✓ 全ての壊しを捕捉した");
