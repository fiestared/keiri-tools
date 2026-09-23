/**
 * 記事の数字の網から「次に読む」（tools/gen_article_next_read.mjs が生成する導線）を外すための共通部品。
 *
 * ★なぜ要るか（2026-09-23）:
 *   12a5b3b2（2026-09-13）で全コラムに「次に読む」3件が入った。カードの説明文は
 *   **リンク先の記事の card-desc（無ければ description）の先頭90字の写し**なので、
 *   高額療養費の「87,430円から171,820円」や育休給付の「67%・181日目」が、
 *   出産手当金・傷病手当金などの記事の網（集合一致）に「記事にあるが期待に無い」として掛かった。
 *   それらはこの記事の主張ではなく、リンク先の記事の主張（そちらの検査が照合する）。
 *
 * ★除外を盲点にしないため、外す前に中身を検査する（緩めるのではなく、検査の場所を移す）:
 *   - ブロックは0個か1個。開始と終了の目印が対になっている
 *   - 形が生成器の出力どおり（section.next-read > h2「次に読む」> div.tool-grid > a.tool-card × 1〜3）。
 *     カード以外のもの（手書きの文・表・数字）が紛れていたら落とす
 *   - 各カードの見出しがリンク先の h1 と一致し、説明文がリンク先の card-desc/description の
 *     **先頭の写し**になっている。1文字でも手で変えたら落ちる（＝数字はリンク先の検査が守っている値だけ）
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = join(dirname(fileURLToPath(import.meta.url)), "../../docs");
const unesc = (s) => s.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const norm = (s) => unesc(s).replace(/\s+/g, " ").trim();

const BLOCK = /<!--next-read:S-->([\s\S]*?)<!--next-read:E-->/g;
const SHAPE = /^<section class="next-read"(?: data-nav-exp="t")?><h2>次に読む<\/h2><div class="tool-grid">((?:<a class="tool-card" href="[^"]+"><b>[^<]*<\/b><span>[^<]*<\/span><\/a>){1,3})<\/div><\/section>$/;
const CARD = /<a class="tool-card" href="([^"]+)"><b>([^<]*)<\/b><span>([^<]*)<\/span><\/a>/g;

/** コラム記事（docs/column/<slug>/）から見た href をリンク先の index.html に直す */
function targetFile(href) {
  let m = href.match(/^\.\.\/([a-z0-9-]+)\/$/);
  if (m) return join(DOCS, "column", m[1], "index.html");
  m = href.match(/^\.\.\/\.\.\/([a-z0-9-]+)\/$/);
  if (m) return join(DOCS, m[1], "index.html");
  return null;
}

/**
 * @param {string} html 記事の HTML
 * @returns {{ html: string, errors: string[], cards: number }} 「次に読む」を空白に置き換えた HTML と、検査で見つけた問題
 */
export function stripNextRead(html) {
  const errors = [];
  const blocks = [...html.matchAll(BLOCK)];
  const opens = (html.match(/<!--next-read:S-->/g) || []).length;
  const closes = (html.match(/<!--next-read:E-->/g) || []).length;
  if (opens !== closes || opens !== blocks.length) errors.push(`次に読む: 目印が対になっていない（開始${opens}・終了${closes}）`);
  if (blocks.length > 1) errors.push(`次に読む: ブロックが${blocks.length}個ある（1個まで）`);
  let cards = 0;
  for (const b of blocks) {
    const shape = b[1].match(SHAPE);
    if (!shape) { errors.push("次に読む: 生成器の形と違う（カード以外のものが紛れている）"); continue; }
    for (const [, href, title, desc] of shape[1].matchAll(CARD)) {
      cards++;
      const f = targetFile(href);
      if (!f || !existsSync(f)) { errors.push(`次に読む: リンク先が無い ${href}`); continue; }
      const t = readFileSync(f, "utf8");
      const h1 = norm((t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, ""));
      const src = norm(t.match(/<meta name="card-desc" content="([^"]*)"/i)?.[1] || t.match(/<meta name="description" content="([^"]*)"/i)?.[1] || "");
      if (norm(title) !== h1) errors.push(`次に読む: ${href} の見出しがリンク先の h1 と違う（${norm(title)}）`);
      const d = norm(desc);
      if (!d || !src.startsWith(d)) errors.push(`次に読む: ${href} の説明文がリンク先の説明文の写しではない（${d.slice(0, 40)}…）`);
    }
  }
  return { html: html.replace(BLOCK, " "), errors, cards };
}
