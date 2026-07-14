// test_sitemap.mjs — sitemap.xml の不変条件を守る。
//
// なぜ要るか（2026-07-14 第23便に実際にやった事故）:
//   第19便で「sitemap の全URLに lastmod を付ける」ようにした。ところが `gen_index_sitemap.mjs` は
//   `git status --porcelain` の出力から「作業中のファイル」を拾っており、**既定の git status は
//   未追跡ディレクトリを1行に畳む**（`?? docs/juminzei/`）。畳まれると集合に入るのは
//   **ディレクトリ**なので `docs/juminzei/index.html` の照合が外れ、git log にも履歴が無い
//   （まだコミット前）ため、**lastmod が丸ごと落ちた**。
//
//   ★落ちるのは「新しく作ったページ」だけ ＝ **lastmod がいちばん要るページだけが黙って落ちる**。
//     しかもエラーにならないので、**本番に出るまで誰も気づかない**（実際に /juminzei/ を
//     lastmod 無しで本番へ出した）。生成器は「何も言わずに正しくないものを作る」ことがある。
//
//   → 生成器の**出力そのもの**に不変条件を張る（生成器の実装を信用しない）。
//     生成器を直しても、次に別の理由で lastmod が落ちればここで落ちる。

import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const xml = await readFile(join(ROOT, "docs", "sitemap.xml"), "utf8");

let checks = 0;
const problems = [];
const ok = (cond, msg) => { checks++; if (!cond) problems.push(msg); };

// <url> ブロックを1件ずつ取り出す（loc と lastmod の**対応**を見る。
// 「どこかに lastmod がN個ある」では、どのURLに付いているか分からない = 規則7）
const blocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
ok(blocks.length > 0, "sitemap に <url> が1件も無い");

for (const b of blocks) {
  const loc = b.match(/<loc>(.*?)<\/loc>/)?.[1];
  ok(!!loc, `<loc> の無い <url> がある: ${b}`);
  if (!loc) continue;

  // ★本体: **全URLが lastmod を持つ**。新規ページだけが黙って落ちるのを防ぐ
  const lastmod = b.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
  ok(!!lastmod, `lastmod が無い: ${loc}（新しく作ったページは git status の畳み込みで落ちやすい）`);
  if (!lastmod) continue;

  ok(/^\d{4}-\d{2}-\d{2}$/.test(lastmod),
     `lastmod が YYYY-MM-DD でない: ${loc} → "${lastmod}"`);

  // 未来の日付は嘘（Googleに「この値は当てにならない」と学習させる）
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  ok(lastmod <= today, `lastmod が未来: ${loc} → ${lastmod}（今日は ${today}）`);

  ok(loc.startsWith("https://keiri-tools.com/"),
     `loc のホストが違う: ${loc}`);
}

// 公開中の全ツールが sitemap に載っていること（作ったのに載せ忘れる = 誰にも見つからない）
const { readdir } = await import("node:fs/promises");
for (const d of await readdir(join(ROOT, "docs"), { withFileTypes: true })) {
  if (!d.isDirectory() || ["assets", "ext", "column", "e2e"].includes(d.name)) continue;
  let html;
  try { html = await readFile(join(ROOT, "docs", d.name, "index.html"), "utf8"); } catch { continue; }
  if (!/assets\/[a-z_]+_core\.js/.test(html)) continue; // 計算ツールだけ
  ok(xml.includes(`https://keiri-tools.com/${d.name}/</loc>`),
     `計算ツール /${d.name}/ が sitemap に載っていない（gen_index_sitemap.mjs の STATIC_PAGES に足す）`);
}

if (problems.length) {
  console.error(`❌ test_sitemap: ${problems.length}件`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`✅ test_sitemap: ${checks} checks（全${blocks.length}URLに lastmod あり）`);
