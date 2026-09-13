/** 全公開コラムに「次に読む」3件をカテゴリ・需要順で生成する。 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const DOCS = join(ROOT, "docs");
const COLUMN = join(DOCS, "column");
const CHECK = process.argv.includes("--check");
const MARK = /<!--next-read:S-->[\s\S]*?<!--next-read:E-->/;
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const source = readFileSync(join(ROOT, "tools/gen_index_sitemap.mjs"), "utf8");
const order = [...source.matchAll(/^\s+"([a-z0-9-]+)",/gm)].map((m) => m[1]);
const catBlock = source.slice(source.indexOf("const CATEGORIES"), source.indexOf("const STATIC_PAGES"));
const categories = [];
for (const m of catBlock.matchAll(/id:\s*"([^"]+)"[\s\S]*?slugs:\s*\[([\s\S]*?)\]/g)) {
  categories.push({ id: m[1], slugs: [...m[2].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]) });
}
const rank = (s) => { const i = order.indexOf(s); return i < 0 ? 99999 : i; };
const files = readdirSync(COLUMN, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  .filter((s) => !s.startsWith("_") && !s.endsWith(".nopublish"));
const articles = new Map();
for (const slug of files) {
  const file = join(COLUMN, slug, "index.html");
  const html = readFileSync(file, "utf8");
  if (/noindex/i.test(html)) continue;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || slug;
  const desc = html.match(/<meta name="card-desc" content="([^"]*)"/i)?.[1] || html.match(/<meta name="description" content="([^"]*)"/i)?.[1] || "";
  const category = categories.find((c) => c.slugs.includes(slug))?.id || "";
  articles.set(slug, { file, html, h1, desc, category });
}

const byCategory = new Map(categories.map((c) => [c.id, c.slugs.filter((s) => articles.has(s)).sort((a, b) => rank(a) - rank(b))]));
let changed = 0;
for (const [slug, a] of articles) {
  const primary = byCategory.get(a.category) || [];
  const picks = primary.filter((s) => s !== slug).slice(0, 3);
  if (picks.length < 3) {
    for (const c of categories) for (const s of byCategory.get(c.id) || []) {
      if (s !== slug && !picks.includes(s)) picks.push(s);
      if (picks.length === 3) break;
    }
  }
  const block = `<!--next-read:S--><section class="next-read"><h2>次に読む</h2><div class="tool-grid">${picks.map((s) => {
    const p = articles.get(s); const d = p.desc.replace(/\s+/g, " ").slice(0, 90);
    return `<a class="tool-card" href="../${esc(s)}/"><b>${esc(p.h1)}</b><span>${esc(d)}</span></a>`;
  }).join("")}</div></section><!--next-read:E-->`;
  let html = a.html;
  if (MARK.test(html)) html = html.replace(MARK, block);
  else {
    const pos = html.indexOf('<section class="related"');
    const sourcePos = html.search(/<h2[^>]*id="source"/i);
    const at = pos >= 0 ? pos : (sourcePos >= 0 ? sourcePos : html.indexOf("</article>"));
    if (at < 0) continue;
    html = html.slice(0, at) + block + "\n" + html.slice(at);
  }
  if (html !== a.html) { changed++; if (!CHECK) writeFileSync(a.file, html); }
}
if (CHECK && changed) { console.error(`✗ 次に読むが古い: ${changed}本`); process.exit(1); }
console.log(`✓ 次に読む ${articles.size}本 (${CHECK ? "最新" : `${changed}本更新`})`);
