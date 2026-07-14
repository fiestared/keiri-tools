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

  // ── 第7便: 「12か月足りない人は支給されません」の救済（61条の7①かっこ書き等）──
  // ★いちばん大事なのは「出産」を消す壊し。産前産後休業＝必ず30日以上の無給なので、
  //   これが消えると **第1子の産休・育休明けの人が全員「自分は対象外だ」と読んで諦める**。
  [IK, "★①の理由から「出産」を消す（第2子の人を救う救済）", (h) => h.replace("<b>出産</b>・<b>事業所の休業</b>", "<b>事業所の休業</b>")],
  [IK, "★「産前産後休業は出産に当たる」の一文を消す", (h) => h.replace(/★<b>産前産後休業は「出産」に当たります<\/b>[^<]*/, "")],
  [IK, "①2年→4年の救済をまるごと消す", (h) => h.replace(/<li><b>① 「2年間」を最大4年間まで延ばせます<\/b>[\s\S]*?<\/li>/, "")],
  [IK, "②特例基準日（母親の救済）を消す", (h) => h.replace(/<li><b>② 母親は「産前休業を開始した日」で数え直せます<\/b>[\s\S]*?<\/li>/, "")],
  [IK, "③80時間ルールを消す", (h) => h.replace(/<li><b>③ 11日以上の月が12か月に足りないときは[\s\S]*?<\/li>/, "")],
  [IK, "救済ブロックごとidを外す", (h) => h.replace('id="ikuji-shikaku-list"', 'id="gone-ikuji"')],
  [PP, "★①の理由から「出産」を消す", (h) => h.replace("<b>出産</b>・<b>事業所の休業</b>", "<b>事業所の休業</b>")],
  [PP, "①2年→4年の救済をまるごと消す", (h) => h.replace(/<li><b>① 「2年間」を最大4年間まで延ばせます<\/b>[\s\S]*?<\/li>/, "")],
  [PP, "②80時間ルールを消す", (h) => h.replace(/<li><b>② 11日以上の月が12か月に足りないときは[\s\S]*?<\/li>/, "")],
  // ★父母の非対称を消す壊し: 「特例基準日は産後パパ育休には無い」を消すと、
  //   父親が「自分にも②がある」と誤解する（＝逆向きの嘘）。列挙は"無いこと"も守る。
  [PP, "★「特例基準日は産後パパ育休には無い」を消す", (h) => h.replace(/産後パパ育休にはありません。/, "")],
  [PP, "救済ブロックごとidを外す", (h) => h.replace('id="papa-shikaku-list"', 'id="gone-papa"')],
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
