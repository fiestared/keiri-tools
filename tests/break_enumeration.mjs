// break_enumeration.mjs — 列挙の網羅検査（test_enumeration_completeness.mjs）が、
// 実際に「画面から事由が消えたこと」を捕まえられるかを確かめる壊しテスト。
//
// 規則2: 壊す前に「無傷が緑」を確かめる（常に赤なら何を壊しても赤＝嘘の満点になる）。
// 復元は git に頼らない（規則: 未追跡ファイルは checkout で戻らない）。
//   → 壊す前の中身をメモリに持ち、finally で必ず書き戻す。

import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const P = (p) => join(ROOT, p);

const GUARD = "tests/test_enumeration_completeness.mjs";
const run = () => {
  try {
    execSync(`node ${GUARD}`, { cwd: ROOT, stdio: "pipe" });
    return true; // 緑
  } catch {
    return false; // 赤
  }
};

const KH = "docs/kihonteate/index.html";
const IK = "docs/ikuji/index.html";
const PP = "docs/papa-ikukyu/index.html";

const originals = new Map();
for (const p of [KH, IK, PP]) originals.set(p, await readFile(P(p), "utf8"));

/** 壊し方の一覧。「法が列挙する事由を画面から消す」＝利用者が自分を見つけられなくなる事故そのもの */
const BREAKS = [
  [KH, "パワハラ・セクハラを消す", (h) => h.replace(/<li><b>事業主や同僚から、就業環境が著しく害されるような言動を受けた<\/b>（パワハラ・セクハラ）<\/li>/, "")],
  [KH, "退職勧奨を消す", (h) => h.replace(/<li>会社から退職するよう勧奨された（退職勧奨）<\/li>/, "")],
  [KH, "月100時間以上を消す", (h) => h.replace(/<li>1か月に100時間以上[^<]*<\/li>/, "")],
  [KH, "賃金85%未満を消す", (h) => h.replace(/<li><b>賃金が、以前の85%未満に下がった<\/b>（予期できなかった場合）<\/li>/, "")],
  [KH, "16事由のブロックごと消す", (h) => h.replace(/id="tokutei-list"/, 'id="gone"')],
  [IK, "⑥配偶者が産後休業中を消す", (h) => h.replace("<b>⑥配偶者が産後休業中</b>／", "")],
  [IK, "③暴力を受け別居中を消す", (h) => h.replace("③配偶者から暴力を受け別居中／", "")],
  [IK, "列挙のidを外す", (h) => h.replace('id="ikuji-menjo-list"', "")],
  [PP, "⑥産後休業中の選択肢を消す", (h) => h.replace(/<option value="postpartum"[^>]*>[^<]*<\/option>/, "")],
  [PP, "②法律上の親子関係がないを消す", (h) => h.replace(/<option value="noparent">[^<]*<\/option>/, "")],
  [PP, "③暴力を受け別居の選択肢を消す", (h) => h.replace(/<option value="dv">[^<]*<\/option>/, "")],
];

let caught = 0;
let missed = 0;
let misfired = 0;

try {
  // 規則2: ベースライン
  if (!run()) {
    console.error("✗ ベースラインが赤。壊しテストは意味を持たない（即座に降りる）");
    process.exit(1);
  }
  console.log("✓ ベースライン(無傷) = 緑");

  for (const [page, name, f] of BREAKS) {
    const orig = originals.get(page);
    const broken = f(orig);
    if (broken === orig) {
      misfired++;
      console.log(`  ⚠️ 壊し方が外れた: ${name}（置換が当たっていない）`);
      continue;
    }
    await writeFile(P(page), broken);
    const green = run();
    await writeFile(P(page), orig); // すぐ戻す
    if (green) {
      missed++;
      console.log(`  ✗ 素通し: ${name}`);
    } else {
      caught++;
      console.log(`  ✓ 捕捉: ${name}`);
    }
  }
} finally {
  for (const [p, orig] of originals) await writeFile(P(p), orig);
  for (const [p, orig] of originals) {
    const now = await readFile(P(p), "utf8");
    if (now !== orig) {
      console.error(`!!! 復元に失敗: ${p}`);
      process.exit(1);
    }
  }
}

console.log(`\n捕捉 ${caught} / 素通し ${missed} / 壊し方が外れた ${misfired}（復元OK）`);
if (missed > 0 || misfired > 0) process.exit(1);
console.log("✓ break_enumeration: 列挙の網羅検査は、事由が画面から消えたら必ず赤くなる");
