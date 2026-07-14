// break_shobyo_104.mjs — 「任意継続でも104条の継続給付は受けられる」の錠前が、
// 本当に効いているかを確かめる壊しテスト（第6便の実バグの再発防止）。
//
// 何が起きていたか:
//   calcShobyo は ninnikeizoku を見た瞬間に ¥0 を返し、taishokugo（104条）を**一度も見なかった**。
//   コアの keizokuKyufu() は**実装も単体テストもあったのに、どのページからも呼ばれていなかった**
//   （§37の到達不能コード）。だから**単体テストは永久に緑**のまま、本番は
//   「傷病手当金 ¥0（支給されません）」と答えていた。月給30万・546日で **3,620,181円**。
//   ★病気で辞めた人はほぼ全員が任意継続を選ぶ（病気なのだから保険が要る）ので、
//     **いちばん重い病気の人**を直撃していた。
//
// 規則2: 壊す前に「無傷が緑」を確かめる（常に赤なら何を壊しても赤＝嘘の満点になる）。
// 復元は git に頼らない（未追跡ファイルは checkout で戻らない）。
//   → 壊す前の中身をメモリに持ち、finally で必ず書き戻す。

import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const P = (p) => join(ROOT, p);

const CORE = "docs/assets/shobyo_core.js";
const PAGE = "docs/shobyo/index.html";

// 守り手は2つ。**どちらが捕まえてもよい**が、両方素通しなら錠前は無い。
const GUARDS = ["tests/test_shobyo.mjs", "tests/test_enumeration_completeness.mjs"];
const run = () => {
  for (const g of GUARDS) {
    try {
      execSync(`node ${g}`, { cwd: ROOT, stdio: "pipe" });
    } catch {
      return false; // どれかが赤 = 捕まえた
    }
  }
  return true; // 全部緑
};

const originals = new Map();
for (const p of [CORE, PAGE]) originals.set(p, await readFile(P(p), "utf8"));

const BREAKS = [
  // ── コア: 104条の継続給付を殺す（＝本番で起きていたバグそのもの） ──
  [CORE, "★旧バグの再来: ninnikeizoku を見た瞬間に ¥0 を返す", (s) =>
    s.replace(
      "  if (i.ninnikeizoku) {\n    const k = keizokuKyufu({",
      "  if (i.ninnikeizoku) {\n    return { eligible: false, reason: 'ninnikeizoku', message: '99条1項 104条', total: 0 };\n    const k = keizokuKyufu({",
    )],
  [CORE, "taishokugo を読まない（受給中かどうかを無視して常に false）", (s) =>
    s.replace("receivingAtLoss: !!i.taishokugo,", "receivingAtLoss: false,")],
  [CORE, "104条の「1年以上」を無視する（誰でも継続給付が出る）", (s) =>
    s.replace("const oneYear = months >= 12;", "const oneYear = true;")],
  [CORE, "被保険者期間を読み損なう（months を常に0にする）", (s) =>
    s.replace("const m = Math.floor(Number(i.months) || 0);\n  if (m > 0) return m;", "const m = 0;\n  if (m > 0) return m;")],
  [CORE, "via104 を名乗らない（画面が理由を出せなくなる）", (s) =>
    s.replace("via104: !!i.ninnikeizoku,", "via104: false,")],
  [CORE, "1年未満を 99条1項の不支給と混同する（理由を区別しない）", (s) =>
    s.replace("reason: k.receiving ? 'keizoku_under1y' : 'ninnikeizoku',", "reason: 'ninnikeizoku',")],

  // ── 画面: 104条という逃げ道を隠す（＝利用者が自分を見つけられなくなる） ──
  [PAGE, "★104条の案内ブロックを丸ごと消す", (h) =>
    h.replace(/<div class="note" id="keizoku-note">[\s\S]*?<\/div>/, "")],
  [PAGE, "案内ブロックの id を外す（列挙検査の目を潰す）", (h) =>
    h.replace('id="keizoku-note"', 'id="gone"')],
  [PAGE, "「任意継続でも受け続けられます」を消す", (h) =>
    h.replace("<b>退職する前から傷病手当金を受けていた方は、任意継続でも受け続けられます</b>", "")],
  [PAGE, "「退職日には出社しないでください」を消す", (h) =>
    h.replace(/★<b>②のために、退職日には出社しないでください<\/b>/, "")],
  [PAGE, "「任意継続の期間は1年に入りません」を消す", (h) =>
    h.replace("（<b>任意継続の期間はこの1年に入りません</b>）", "")],
  [PAGE, "「通算1年6か月」を消す", (h) =>
    h.replace("受け取れるのは<b>支給開始から通算1年6か月</b>までです。", "")],
];

let caught = 0, missed = 0, misfired = 0;

try {
  // ── 規則2: ベースラインが緑であることを先に確かめる ──
  if (!run()) {
    console.error("✗ ベースラインが赤。壊しテストは意味を持たない（何を壊しても赤になる）。");
    process.exit(1);
  }
  console.log("✓ ベースライン緑（無傷の状態で守り手が全て通る）\n");

  for (const [file, name, mutate] of BREAKS) {
    const before = originals.get(file);
    const after = mutate(before);
    if (after === before) {
      console.error(`⚠️  壊し方が外れた（置換が1件も当たっていない）: ${name}`);
      misfired++;
      continue;
    }
    await writeFile(P(file), after);
    const green = run();
    await writeFile(P(file), before); // すぐ戻す

    if (green) {
      console.error(`❌ 素通し: ${name}`);
      missed++;
    } else {
      console.log(`✓ 捕捉: ${name}`);
      caught++;
    }
  }
} finally {
  for (const [p, s] of originals) await writeFile(P(p), s);
}

console.log(`\n捕捉 ${caught} / 素通し ${missed} / 壊し方が外れた ${misfired}`);
if (missed > 0 || misfired > 0) {
  console.error("✗ 素通し or 壊し方の誤りがある。錠前を強くするか、壊し方を直すこと（規則8）。");
  process.exit(1);
}
console.log(`✓ break_shobyo_104: ${caught}/${caught} 捕捉・素通し0`);
