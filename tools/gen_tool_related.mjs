/**
 * 各ツールページに「関連する解説」ブロックを焼き込む（コラム→ツールの一方通行を双方向にする）。
 *
 * なぜ要るか（2026-07-29に実測）:
 *   コラム→ツール のリンクは102本あるのに、ツール→コラム は36本しかなく、
 *   **89組が一方通行**だった。とくに /shakai-hoken/ は27本、/gensen-choshu/ は18本の
 *   コラムから貼られているのに、1本も返していない。
 *   結果、GSCで9〜11位まで来ている解説記事（源泉徴収票の見方）は、
 *   **サイト内の被リンク元が6ページ・ホームからの深度2**という薄い状態に置かれていた。
 *   ツール側は入口として強いので、そこから解説へ返す導線を作る。
 *
 *   node tools/gen_tool_related.mjs          生成(冪等)
 *   node tools/gen_tool_related.mjs --check  差分があれば失敗(テスト用)
 *   node tools/gen_tool_related.mjs --dry    書かずに対象だけ出す
 *
 * 設計:
 *   - **リンク元はコラム側の実リンク**。「そのツールを参照している解説」だけを返すので、
 *     機械的に全部つなぐ相互リンク（無関係でも貼る）にはならない。
 *   - 1ツールあたり最大 MAX 本。多すぎるとリンクの価値が薄まり、ページも読みにくい。
 *   - 並びは **gen_index_sitemap.mjs の ORDER（検索需要順）** に合わせる。需要の高い解説を先に出す。
 *   - `.nopublish` のコラムは出さない（noindex にしてあるので、そこへ送っても評価は戻らない）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const COLUMN = join(DOCS, "column");
const CHECK = process.argv.includes("--check");
const DRY = process.argv.includes("--dry");
const MAX = 5;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const SKIP = new Set(["column", "assets", "embed", "ext", "about", "privacy", "contact"]);
const tools = readdirSync(DOCS).filter((d) => {
  const p = join(DOCS, d);
  return statSync(p).isDirectory() && !SKIP.has(d) && existsSync(join(p, "index.html"));
});

// 検索需要順（gen_index_sitemap.mjs の ORDER を正本にする。二重管理しない）
const orderSrc = readFileSync(join(ROOT, "tools/gen_index_sitemap.mjs"), "utf8");
const orderBlock = orderSrc.match(/const ORDER = \[([\s\S]*?)\];/);
const ORDER = orderBlock ? [...orderBlock[1].matchAll(/"([\w-]+)"/g)].map((m) => m[1]) : [];
if (!ORDER.length) { console.error("✗ gen_index_sitemap.mjs から ORDER を読めない"); process.exit(1); }

// コラムの情報（タイトル・カード用の惹句・公開可否・参照しているツール）
const columns = new Map();
for (const slug of readdirSync(COLUMN)) {
  const dir = join(COLUMN, slug);
  const file = join(dir, "index.html");
  if (!statSync(dir).isDirectory() || !existsSync(file)) continue;
  if (existsSync(join(dir, ".nopublish"))) continue;      // 非公開へは送らない
  const html = readFileSync(file, "utf8");
  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, "").trim() ?? slug;
  const card = html.match(/<meta name="card-desc" content="([^"]*)"/)?.[1]
            ?? html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  // ★★<main> の中だけを見る（2026-08-14 修正）。
  //   以前は html 全体を走査しており、**共通ヘッダのグローバルナビ**
  //   （../../hojokin/ ../../toushi/ ../../column/）を「本文がそのツールを参照している」と
  //   誤認していた。全コラムがヘッダを持つので、結果として
  //   **/hojokin/ と /toushi/ の「関連する解説」が、主題と無関係な記事で埋まっていた**
  //   （実測: /hojokin/ の関連5本が年末調整・高額療養費・育児休業給付金…で、
  //    補助金の記事7本は1本も入っていなかった）。
  //   この生成器の設計は「リンク元はコラム側の実リンク」なので、
  //   ヘッダ・フッタの定型リンクを数えた時点で前提が壊れている。
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? html;
  const refs = new Set();
  for (const m of main.matchAll(/href="\.\.\/\.\.\/([\w-]+)\//g)) refs.add(m[1]);
  columns.set(slug, { h1, card, refs });
}

const rank = (slug) => { const i = ORDER.indexOf(slug); return i === -1 ? 9999 : i; };

let changed = 0, touched = [];
for (const tool of tools) {
  const file = join(DOCS, tool, "index.html");
  let html = readFileSync(file, "utf8");

  // このツールを参照しているコラム（需要順・上限MAX）
  const rel = [...columns.entries()]
    .filter(([, c]) => c.refs.has(tool))
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .slice(0, MAX);

  const inner = rel.length
    ? `<ul class="rel-list">` + rel.map(([slug, c]) =>
        `<li><a href="../column/${esc(slug)}/">${esc(c.h1)}</a>` +
        (c.card ? `<span class="rel-desc">${esc(c.card.slice(0, 70))}</span>` : "") + `</li>`).join("") +
      `</ul>`
    : "";

  const block = inner
    ? `<section class="faq rel-block">\n<h2>関連する解説</h2>\n<!--rel:S-->${inner}<!--rel:E-->\n</section>\n`
    : "";

  const has = /<section class="faq rel-block">[\s\S]*?<\/section>\n?/.test(html);
  let next;
  if (has) {
    next = html.replace(/<section class="faq rel-block">[\s\S]*?<\/section>\n?/, block);
  } else if (block) {
    // </main> の直前に置く（本文のいちばん後ろ＝読み終えた人が次に行く場所）
    if (!html.includes("</main>")) { console.error(`✗ ${tool}: </main> が無い`); process.exit(1); }
    next = html.replace("</main>", block + "</main>");
  } else {
    next = html;
  }

  if (next !== html) { changed++; touched.push(`${tool} (${rel.length}本)`); if (!CHECK && !DRY) writeFileSync(file, next); }
}

if (CHECK) {
  if (changed) {
    console.error(`✗ ツールの「関連する解説」が最新でない(${changed}ページ)。node tools/gen_tool_related.mjs を実行してコミット`);
    process.exit(1);
  }
  console.log("✓ ツールの「関連する解説」は最新"); process.exit(0);
}
if (DRY) { console.log(`[--dry] ${changed}ページが対象:`); touched.forEach((t) => console.log("   " + t)); process.exit(0); }
console.log(changed ? `✓ 「関連する解説」を更新: ${changed}ページ` : "変更なし（既に最新）");
