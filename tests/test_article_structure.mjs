/**
 * 記事の「型」を機械で強制する。
 *
 * なぜ必要か: CLAUDE.md に「記事の必須要素」を散文で書いてあるが、
 * このリポジトリでは**散文の約束は繰り返し破られてきた**(FAQ可視性は31件、
 * 祝日の待ち合わせは3回)。記事を量産するなら、型の逸脱は人ではなく機械が落とす。
 *
 * 検査対象: docs/column/<slug>/index.html すべて (column/index.html 自体は除く)
 *   node tests/test_article_structure.mjs
 *
 * 「置いただけで誰にも届かない記事」を作らないため、
 * **sitemap.xml と コラム一覧への掲載も型の一部**として検査する。
 * (記事を書いたのに sitemap に足し忘れる、が最も起きやすい)
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const COLUMN = join(DOCS, "column");

const GA_ID = "G-E742DSDHPD";
const ADSENSE = "ca-pub-2635067516563578";

const fails = [];
const fail = (slug, msg) => fails.push(`${slug}: ${msg}`);

const sitemap = readFileSync(join(DOCS, "sitemap.xml"), "utf8");
const columnIndex = readFileSync(join(COLUMN, "index.html"), "utf8");

const slugs = readdirSync(COLUMN).filter(
  (n) => existsSync(join(COLUMN, n, "index.html"))
);

if (slugs.length === 0) fails.push("記事が1本も無い(検査対象の取り違え)");

for (const slug of slugs) {
  const html = readFileSync(join(COLUMN, slug, "index.html"), "utf8");
  const body = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
  if (body.length < 100) { fail(slug, "<article> が無い"); continue; }

  // --- 計測・収益の土台(1ページでも欠けると、そのページだけ収益ゼロ・計測不能になる) ---
  if (!html.includes(GA_ID)) fail(slug, `GA4タグ(${GA_ID})が無い`);
  if (!html.includes(ADSENSE)) fail(slug, `AdSenseスニペット(${ADSENSE})が無い`);
  if (!html.includes(`rel="canonical"`)) fail(slug, "canonical が無い");
  const canon = html.match(/rel="canonical"\s+href="([^"]+)"/)?.[1];
  const want = `https://keiri-tools.com/column/${slug}/`;
  if (canon && canon !== want) fail(slug, `canonical が違う: ${canon} (正: ${want})`);

  // --- 検索エンジンに見つけてもらう土台 ---
  if (!sitemap.includes(want)) fail(slug, "sitemap.xml に載っていない(誰にも届かない)");
  if (!columnIndex.includes(`href="${slug}/"`)) fail(slug, "コラム一覧(column/index.html)に載っていない");

  // --- 構造化データ ---
  if (!html.includes(`"@type": "Article"`)) fail(slug, "Article 構造化データが無い");
  if (!html.includes(`"@type": "BreadcrumbList"`)) fail(slug, "BreadcrumbList 構造化データが無い");
  if (!/"datePublished":\s*"\d{4}-\d{2}-\d{2}"/.test(html)) fail(slug, "datePublished が無い");
  if (!/<nav class="breadcrumb">/.test(html)) fail(slug, "パンくずナビが無い");

  // --- 読み物としての型 ---
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  if (!title) fail(slug, "<title> が空");
  else if (title.length > 60) fail(slug, `<title> が長すぎる(${title.length}字。検索結果で切れる)`);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  if (!desc) fail(slug, "meta description が無い");
  else if (desc.length < 60) fail(slug, `meta description が短すぎる(${desc.length}字)`);

  if (!/<h1>/.test(body)) fail(slug, "<h1> が無い");
  if (!/class="article-meta"/.test(body)) fail(slug, "公開日(article-meta)が無い");
  if (!/<nav class="toc">/.test(body)) fail(slug, "目次(nav.toc)が無い");

  // 目次は全 h2 を指していること(見出しを足して目次に入れ忘れる、を落とす)
  const h2s = [...body.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
  const toc = body.slice(body.indexOf(`<nav class="toc">`),
                         body.indexOf("</nav>", body.indexOf(`<nav class="toc">`)));
  for (const id of h2s) {
    if (!toc.includes(`#${id}`)) fail(slug, `目次に #${id} が無い`);
  }
  // id の無い h2 は「出典」「関連記事・ツール」だけ許す(目次に載せない見出し)
  const bareH2 = [...body.matchAll(/<h2(?![^>]*\bid=)[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1].trim());
  for (const t of bareH2) {
    if (!["出典", "関連記事・ツール"].includes(t)) fail(slug, `h2「${t}」に id が無い(目次に載らない)`);
  }
  if (h2s.length < 3) fail(slug, `h2 が ${h2s.length} 個しかない(内容が薄い)`);

  // --- 図解(インラインSVG)。外部画像は使わない ---
  // tool-card のアイコンSVGは「図解」ではないので、figure の中にあるSVGだけ数える
  if (!/<figure[\s>]/.test(body)) fail(slug, "図解(<figure>内のインラインSVG)が無い");
  else {
    const figs = [...body.matchAll(/<figure[\s\S]*?<\/figure>/g)];
    if (!figs.some((f) => f[0].includes("<svg"))) fail(slug, "<figure> はあるが中にインラインSVGが無い");
    if (!figs.some((f) => /<figcaption/.test(f[0]))) fail(slug, "<figure> に figcaption が無い");
  }
  if (/<img\s[^>]*src="https?:/.test(body)) fail(slug, "外部画像を使っている(インラインSVGにする)");

  // --- FAQ(構造化データは本文から生成される。本文側の型を守らせる) ---
  if (!/<h2[^>]*\bid="faq"|<h2[^>]*data-faq/.test(body)) fail(slug, "FAQブロック(h2#faq)が無い");
  if (!/<section class="related">/.test(body)) fail(slug, "関連記事・ツールが無い");
  if (!body.includes("出典")) fail(slug, "出典が無い");

  // --- 導線: 記事から必ずツールへ送る(記事は入口、ツールが商品) ---
  if (!/class="tool-cta"|class="tool-card"/.test(body)) fail(slug, "ツールへの導線が無い");

  // --- CSSは style.css に集約(記事内 <style> は書かない) ---
  if (/<style[\s>]/.test(html)) fail(slug, "記事内に <style> がある(assets/style.css に集約する)");
}

if (fails.length) {
  console.error(`✗ 記事の型 違反 ${fails.length}件 (対象 ${slugs.length}記事)`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ 記事の型 OK (${slugs.length}記事)`);
