/**
 * 全ページに OGP / Twitter Card のメタタグを入れる。
 *
 * なぜ生成にするか:
 * X やチャットにURLを貼ったとき、OGPが無いと**リンクカードが出ない**。
 * 実測（2026-08-05）: @keiri_tools の固定ポストはURLがテキストのまま切れて表示され、
 * カードが出ていなかった。カードが出れば占有面積が数倍になる。
 * 記事を書くたびに手で足すと必ず忘れるので、sitemap と同じく生成方式にする。
 *
 *   node tools/gen_ogp.mjs           付与・更新
 *   node tools/gen_ogp.mjs --check   差分があれば失敗（CI/テスト用）
 *
 * 各ページの正本:
 *   og:title       … <title> から（サイト名の接尾辞は落とす）
 *   og:description … <meta name="description">
 *   og:url         … <link rel="canonical">
 *   og:image       … サイト共通の /ogp.png（1200x630）
 * ★canonical が無いページは対象外（URLを推測して間違えるより出さない）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");
const IMAGE = "https://keiri-tools.com/ogp.png";
const SITE = "税金・経理・補助金ツールズ";

/** docs 配下の index.html を集める（embed は SNS 共有の対象外なので除く） */
function pages(dir = DOCS, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "embed" || name === "assets" || name === "ext") continue;
      pages(p, out);
    } else if (name === "index.html") {
      out.push(p);
    }
  }
  return out;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let changed = 0;
const skipped = [];
for (const file of pages()) {
  const html = readFileSync(file, "utf8");
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical) { skipped.push(file.replace(DOCS, "")); continue; }

  const rawTitle = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
  // 「〜｜税金・経理・補助金ツールズ」の接尾辞は og:title では冗長（og:site_name で出す）
  const title = rawTitle.replace(new RegExp(`[｜|]\\s*${SITE}\\s*$`), "").trim();
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  if (!title || !desc) { skipped.push(file.replace(DOCS, "") + "（title/descriptionが無い）"); continue; }

  const block = [
    `<meta property="og:type" content="${canonical.includes("/column/") ? "article" : "website"}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${IMAGE}">`,
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:locale" content="ja_JP">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("\n");

  const marked = `<!-- ogp:auto -->\n${block}\n<!-- /ogp:auto -->`;
  let next;
  if (html.includes("<!-- ogp:auto -->")) {
    next = html.replace(/<!-- ogp:auto -->[\s\S]*?<!-- \/ogp:auto -->/, marked);
  } else {
    // canonical の直後に入れる（head の中であることが保証される位置）
    next = html.replace(/(<link rel="canonical" href="[^"]+">)/, `$1\n${marked}`);
  }
  if (next !== html) {
    if (CHECK) {
      console.error(`✗ OGPが最新ではない: ${file.replace(DOCS, "")}`);
      process.exit(1);
    }
    writeFileSync(file, next);
    changed++;
  }
}

if (skipped.length) {
  console.log(`  ⚠️ 対象外 ${skipped.length}件（canonical か title/description が無い）`);
  for (const s of skipped.slice(0, 5)) console.log(`     ${s}`);
}
console.log(CHECK ? "✓ OGP は最新" : `✓ OGP を付与/更新: ${changed}ページ`);
