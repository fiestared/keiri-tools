/**
 * ページの「本文」を取り出す（sitemap の lastmod を「本文が変わったときだけ」動かすための正本）。
 *
 * ★なぜ要るか（2026-10-19 Masahiro「サイトマップの更新日を本文が変わったときだけ動かす」）:
 *   lastmod はそれまで「20ファイル以上のコミットを除く」「導線の行だけの差分を除く」という
 *   **行の差分の例外の積み重ね**で決めていた。例外の外側で生成器が動くたびに lastmod が動き、
 *   2026-10-19 の origin/main では 630 URL のうち 10-12 に100・10-13 に100・10-14 に223、
 *   以降も毎日30前後が「今日更新」を名乗っていた。Google は lastmod を
 *   "consistently and verifiably accurate" なときだけ使う
 *   （https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap）。
 *   → 「どのコミットを例外にするか」ではなく、**ページの本文そのものを比べる**形にする。
 *
 * ★本文の定義（ここを変えたら BODY_VERSION を上げる。上げないと古いキャッシュの値が混ざる）:
 *   入れるもの:
 *     - <title> の文字列、<meta name="description"> の content（検索結果に出る＝公開された主張）
 *     - <main>…</main> の**画面に見える文字**（タグを剥がし、空白を1つに潰したもの）
 *       ※ データから生成した表・一覧（最低賃金の県別表・補助金カード・銀行の手数料・トップの新着・
 *         コラム一覧・datasrc の出典注記・retention-updates の改正のお知らせ）は**本文に入れる**。
 *         それはそのページの中身そのもので、データが変われば読者が見るものが変わるから。
 *   除くもの（＝ここだけ変わっても lastmod は動かない）:
 *     - <head> 全体（FAQ JSON-LD・dateModified・OGP・favicon・AdSense・GA4）… title/description 以外
 *     - <main> の外（共通ヘッダ・ナビ gen_nav、フッタ gen_site_footer / gen_x_link）
 *     - <script> / <style> / <noscript> / <template> とコメント
 *     - 生成器の導線の区画:
 *         <!--next-read:S-->…<!--next-read:E-->      gen_article_next_read（次に読む）
 *         <!--rail-next:S-->…<!--rail-next:E-->      gen_article_next_read / gen_toc_related（右レール）
 *         <!--rel:S-->…<!--rel:E-->                  gen_tool_related（ツール末尾の関連する解説）
 *         <!--nav-exp:X S-->…<!--nav-exp:X E-->      nav_experiment（導線の実験の部品）
 *         <!--domain-bridge:S-->…<!--domain-bridge:E-->  gen_domain_bridge（別領域への橋渡しカード）
 *         <!-- x-share:auto -->…<!-- /x-share:auto -->  gen_x_share（Xで共有）
 *         <!-- trust:auto -->…<!-- /trust:auto -->      gen_trust_footer（免責・運営者の定型ブロック）
 *         <!-- pr-block:auto -->…<!-- /pr-block:auto -->  gen_pr_blocks（PR枠）
 *         <!--layout-toc:start-->…<!--layout-toc:end-->  gen_layout_markup（目次）
 *     - 目次 <nav class="toc">（見出しから作る写し。見出しそのものは本文に残る）
 *     - パンくず <nav class="breadcrumb">（ページの題の写し）
 *     - <section class="related">（関連記事・ツールのカード。中身は**他のページ**の題と説明で、
 *       その説明文の同期 6ba912f99 などで動く）
 *     - 公開日・更新日の行 <p class="article-meta">（gen_datemodified が書く。日付は本文の結果であって原因ではない）
 *     - 文責の行 <p class="byline">（全ページ共通の定型。一括で文言を変えるたびに全ページが動く）
 *   タグの属性（class・style・href・リンク先の付け替え・nofollow の除去）も本文に数えない。
 *   空白（改行・字下げ）も数えない（タグを外した後に全部消す）。
 *   出典リンクの URL 訂正・表の装飾（gen_presentation_markup / gen_layout_markup）で lastmod が動かないように。
 *
 * 🚫 このファイルは生成器・検査の両方から使う。検査（tests/test_sitemap_lastmod_body.mjs）は
 *    「区画だけ変えたら動かない／本文を変えたら動く」を実際の git 履歴を作って確かめる。
 */
import { createHash } from "node:crypto";

export const BODY_VERSION = 3;

// 生成器の区画（開き・閉じの目印）。中身ごと消す。
const REGIONS = [
  /<!--next-read:S-->[\s\S]*?<!--next-read:E-->/g,
  /<!--rail-next:S-->[\s\S]*?<!--rail-next:E-->/g,
  /<!--rel:S-->[\s\S]*?<!--rel:E-->/g,
  /<!--nav-exp:([a-z0-9-]+) S-->[\s\S]*?<!--nav-exp:\1 E-->/g,
  /<!--domain-bridge:S-->[\s\S]*?<!--domain-bridge:E-->/g,
  /<!-- x-share:auto -->[\s\S]*?<!-- \/x-share:auto -->/g,
  /<!-- trust:auto -->[\s\S]*?<!-- \/trust:auto -->/g,
  /<!-- pr-block:auto -->[\s\S]*?<!-- \/pr-block:auto -->/g,
  /<!--layout-toc:start-->[\s\S]*?<!--layout-toc:end-->/g,
];
// 本文でない要素（中身ごと消す）。入れ子にならない要素だけをここに置く。
const ELEMENTS = [
  /<script\b[\s\S]*?<\/script>/gi,
  /<style\b[\s\S]*?<\/style>/gi,
  /<noscript\b[\s\S]*?<\/noscript>/gi,
  /<template\b[\s\S]*?<\/template>/gi,
  /<nav\b[^>]*class="[^"]*\b(?:toc|breadcrumb)\b[^"]*"[\s\S]*?<\/nav>/gi,
  /<section\b[^>]*class="related"[\s\S]*?<\/section>/gi,
  /<p\b[^>]*class="[^"]*\b(?:article-meta|byline)\b[^"]*"[\s\S]*?<\/p>/gi,
];

const squash = (s) => s.replace(/\s+/g, " ").trim();

/** HTML 全体 → 本文の文字列（比較用。人が読む形ではない） */
export function pageBody(html) {
  const title = squash(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const desc = squash(html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? "");
  const open = html.search(/<main\b/i);
  const close = html.lastIndexOf("</main>");
  // <main> が無いページ（embed/ など）は <body> から共通ヘッダ・フッタを除いたものを本文とみなす
  let body = open !== -1 && close > open
    ? html.slice(open, close)
    : (html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html)
      .replace(/<header\b[\s\S]*?<\/header>/gi, " ").replace(/<footer\b[\s\S]*?<\/footer>/gi, " ");
  for (const re of REGIONS) body = body.replace(re, " ");
  body = body.replace(/<!--[\s\S]*?-->/g, " ");
  for (const re of ELEMENTS) body = body.replace(re, " ");
  // ★タグは空文字に、空白は全部消す。タグを空白に置き換えると、出典の語に <a> を巻いただけで
  //   「所得税法 2条1項30号 」のように空白が増え、文字は1つも変わっていないのに本文の変更に見える
  //   （2026-10-15 の出典リンク付与のコミット群で実測）。日本語の本文は空白に意味が無いので、比較では捨てる。
  body = body.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  return `${title}\n${desc}\n${body}`;
}

/** 本文のハッシュ（キャッシュ・比較用） */
export const bodyHash = (html) => createHash("sha1").update(pageBody(html)).digest("hex");
