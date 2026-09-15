/**
 * 公開コラムに「次に読む」3件を生成する。
 *
 * ★2026-09-16 から、名簿（tools/nav_experiment.json）で3通りに分けて扱う:
 *   - 対象15本（treatment）… 新しい選定。手作りの「関連記事・ツール」を先に置き、その後ろに
 *     「本文が参照している記事・ツール」→ 同カテゴリ需要順で3件。右レールにも関連3本を置く。
 *   - 対照15本・保護対象・表の施策のページ … **一切書き換えない**（入力バイトのまま）。
 *     記事が増えると旧選定は並びが変わるので、対照や進行中の検定のページを動かさないため。
 *   - それ以外 … 従来どおり（カテゴリ・需要順の上から3件を、関連記事の前に置く）。
 *
 * ★なぜ変えたか（2026-09-15 GA4・本番ソース）:
 *   旧選定は主題を見ない。振込手数料一覧の「次に読む」は領収書・見積書・下請法だった。
 *   しかも手作りの関連（主題に合う）がその下にあり、記事→記事の遷移は28日で24件しかなかった。
 *
 * ★対象ページで守ること（Astra の計画 §3・§4）:
 *   - 保護対象と対照群へは、新しい導線（次に読む・右レール）から**リンクしない**。
 *   - 手作り関連は触らない（リンクの所属・順序・文言・見た目をそのまま残す）。
 *     ★対象15本の関連は元から「次に読む」と同じ罫線行（.tool-card）だった（2026-09-16 実測。枠カードの .tool-list はサイト全体で3本）。
 *   - 見た目は assets/style.css（記事内に <style> を置かない）。
 *   - 生成するブロックは必ず1行で、導線の目印（NAV_LINE）を同じ行に持つ。
 *     更新日・lastmod はこの目印の行しか変わっていないファイルを「本文の更新」に数えない。
 *
 * usage: node tools/gen_article_next_read.mjs [--check]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadNavExperiment, NAV_LINE } from "./nav_experiment.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const DOCS = join(ROOT, "docs");
const COLUMN = join(DOCS, "column");
const KNOWN_ARGS = new Set(["--check"]);
for (const a of process.argv.slice(2)) if (!KNOWN_ARGS.has(a)) { console.error(`✗ 未知の引数: ${a}`); process.exit(2); }
const CHECK = process.argv.includes("--check");
const MARK = /<!--next-read:S-->[\s\S]*?<!--next-read:E-->/;
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const unesc = (s) => s.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");

const exp = loadNavExperiment();

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

// 名簿の実在を先に確かめる（存在しない公開ページを黙って飛ばさない）
const missing = [...exp.treatment, ...exp.control, ...exp.tableFix].filter((s) => !articles.has(s));
if (missing.length) { console.error(`✗ 名簿にあるが公開コラムに無い: ${missing.join(", ")}`); process.exit(1); }

const byCategory = new Map(categories.map((c) => [c.id, c.slugs.filter((s) => articles.has(s)).sort((a, b) => rank(a) - rank(b))]));

/** 旧来の3件（カテゴリ需要順）。対象以外で使う。 */
function legacyPicks(slug, a) {
  const primary = byCategory.get(a.category) || [];
  const picks = primary.filter((s) => s !== slug).slice(0, 3);
  if (picks.length < 3) {
    for (const c of categories) for (const s of byCategory.get(c.id) || []) {
      if (s !== slug && !picks.includes(s)) picks.push(s);
      if (picks.length === 3) break;
    }
  }
  return picks;
}

/** 対象ページのカード。meta・h1 の文字参照を一度戻してから包む（旧来は二重に包んで「S&amp;amp;P500」になる） */
const card = (it) => {
  const d = unesc(it.desc).replace(/\s+/g, " ").slice(0, 90);
  return `<a class="tool-card" href="${esc(rel(it.path))}"><b>${esc(unesc(it.title))}</b><span>${esc(d)}</span></a>`;
};
/** 旧来のカード。対象外のページを1バイトも変えないため、旧実装の書き方のまま残す */
const legacyCard = (s) => {
  const p = articles.get(s); const d = p.desc.replace(/\s+/g, " ").slice(0, 90);
  return `<a class="tool-card" href="../${esc(s)}/"><b>${esc(p.h1)}</b><span>${esc(d)}</span></a>`;
};
/** 記事（/column/<slug>/）から見た相対パス */
const rel = (path) => (path.startsWith("/column/") ? `..${path.slice(7)}` : `../..${path}`);

// ---- 対象ページ用 ----
const HUBS = new Set(["column", "about", "policy", "privacy", "contact", "embed", "toushi", "ext", "assets"]);
const toolInfo = new Map();
/** 記事内の相対リンクをサイト内パスに直す。記事・ツール以外（ハブ・アンカー・外部）は null */
function resolveLink(href) {
  if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return null;
  const clean = href.split("#")[0].split("?")[0];
  let m = clean.match(/^\.\.\/([a-z0-9-]+)\/?$/);
  if (m) return articles.has(m[1]) ? `/column/${m[1]}/` : null;
  m = clean.match(/^\.\.\/\.\.\/([a-z0-9-]+)\/?$/);
  if (m && !HUBS.has(m[1])) {
    const f = join(DOCS, m[1], "index.html");
    if (!existsSync(f)) return null;
    if (!toolInfo.has(m[1])) {
      const h = readFileSync(f, "utf8");
      if (/noindex/i.test(h)) { toolInfo.set(m[1], null); return null; }
      toolInfo.set(m[1], {
        title: h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || m[1],
        desc: h.match(/<meta name="description" content="([^"]*)"/i)?.[1] || "",
      });
    }
    return toolInfo.get(m[1]) ? `/${m[1]}/` : null;
  }
  return null;
}
const infoOf = (path) => {
  if (path.startsWith("/column/")) { const a = articles.get(path.slice(8, -1)); return { path, title: a.h1, desc: a.desc }; }
  const t = toolInfo.get(path.slice(1, -1)); return { path, title: t.title, desc: t.desc };
};
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]);
/** 右レールに出す短い名前（h1 の「 — 」「｜」「【」より前） */
const shortTitle = (t) => unesc(t).split(/\s+[—–―]\s+|｜|【/)[0].trim();

/** 手作り関連の逆引き: 記事パス → その記事を関連に挙げている記事slug（需要順） */
const backlinks = new Map();
for (const [s, art] of [...articles].sort((x, y) => rank(x[0]) - rank(y[0]))) {
  const st = art.html.indexOf('<section class="related"');
  if (st < 0) continue;
  const block = art.html.slice(st, art.html.indexOf("</section>", st));
  for (const h of hrefs(block)) {
    const m = h.split("#")[0].match(/^\.\.\/([a-z0-9-]+)\/?$/);
    if (!m || m[1] === s) continue;
    const key = `/column/${m[1]}/`;
    if (!backlinks.has(key)) backlinks.set(key, []);
    if (!backlinks.get(key).includes(s)) backlinks.get(key).push(s);
  }
}
/** 文字2-gram（記号・空白を除く）。主題の近さの粗い代理 */
const grams = (t) => {
  const x = unesc(t).replace(/[\s\p{P}\p{S}0-9０-９]/gu, "");
  const g = new Set();
  for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2));
  return g;
};
const gramCache = new Map();
const gramsOf = (s) => { if (!gramCache.has(s)) { const p = articles.get(s); gramCache.set(s, grams(`${p.h1} ${p.desc}`)); } return gramCache.get(s); };
const sim = (A, B) => { let n = 0; for (const g of A) if (B.has(g)) n++; return n / Math.sqrt((A.size || 1) * (B.size || 1)); };

/** 対象ページの導線を取り外した素の HTML（何度流しても同じ出力にするため） */
function stripNav(html) {
  return html
    .replace(/[ \t]*<!--next-read:S-->[\s\S]*?<!--next-read:E-->\n?/, "")
    .replace(/<!--rail-next:S-->[\s\S]*?<!--rail-next:E-->/g, "")
    .replace('<!--rail-next:wrap--><div class="side-rail" data-nav-exp="wrap">', "")
    .replace("</div><!--rail-next:wrapE-->", "")
    .replace(/<!--nav-exp:style S-->[\s\S]*?<!--nav-exp:style E-->\n?/, "");
}

function buildTreatment(slug, a) {
  const self = `/column/${slug}/`;
  let html = stripNav(a.html);
  const banned = (p) => p === self || exp.P.has(p) || exp.C.has(p);

  const relStart = html.indexOf('<section class="related"');
  if (relStart < 0) throw new Error(`${slug}: 手作りの関連（section.related）が無い`);
  const relEnd = html.indexOf("</section>", relStart);
  const relHtml = html.slice(relStart, relEnd);
  if ((relHtml.match(/<section\b/g) || []).length !== 1) throw new Error(`${slug}: section.related の中に section がある（終端を特定できない）`);
  const related = hrefs(relHtml).map(resolveLink).filter(Boolean);

  // 本文 = article の先頭から関連の手前まで。目次・レールは除く
  const artStart = html.indexOf("<article");
  const body = html.slice(artStart, relStart)
    .replace(/<nav class="toc">[\s\S]*?<\/nav>/, "")
    .replace(/<!-- pr-block:auto -->[\s\S]*?<!-- \/pr-block:auto -->/, "");
  const seen = new Set(related);
  const picks = [];
  const push = (p) => { if (p && !banned(p) && !seen.has(p) && picks.length < 3) { seen.add(p); picks.push(p); } };
  for (const p of hrefs(body).map(resolveLink)) push(p);
  // 本文のリンクで足りなければ、この記事を手作り関連に挙げている記事（人が主題が近いと判断したもの）
  for (const s of backlinks.get(self) || []) push(`/column/${s}/`);
  // それでも足りなければ、タイトル・説明文の近さ（文字2-gram の重なり）。同カテゴリを先に
  const mine = grams(`${a.h1} ${a.desc}`);
  const bySim = (pool) => pool.filter((s) => s !== slug)
    .map((s) => [s, sim(mine, gramsOf(s))]).sort((x, y) => y[1] - x[1] || rank(x[0]) - rank(y[0])).map((x) => x[0]);
  for (const s of bySim(byCategory.get(a.category) || [])) push(`/column/${s}/`);
  for (const s of bySim([...articles.keys()])) push(`/column/${s}/`);
  if (picks.length < 3) throw new Error(`${slug}: 次に読むが3件そろわない`);

  const railItems = [];
  for (const p of [...related, ...picks]) if (!banned(p) && !railItems.includes(p) && railItems.length < 3) railItems.push(p);

  const nextBlock = `<!--next-read:S--><section class="next-read" data-nav-exp="t"><h2>次に読む</h2><div class="tool-grid">${picks.map((p) => card(infoOf(p))).join("")}</div></section><!--next-read:E-->`;
  const railBlock = `<!--rail-next:S--><section class="rail-next" aria-labelledby="rail-next-h"><div class="rail-next-title" id="rail-next-h">あわせて読む</div><ul>${railItems.map((p) => `<li><a href="${esc(rel(p))}">${esc(shortTitle(infoOf(p).title))}</a></li>`).join("")}</ul></section><!--rail-next:E-->`;


  // 1) 次に読む: 手作り関連の直後（同じ行の末尾に足す＝変更行が目印を持つ）
  const rEnd = html.indexOf("</section>", html.indexOf('<section class="related"')) + "</section>".length;
  html = html.slice(0, rEnd) + "\n  " + nextBlock + html.slice(rEnd);
  // 2) 右レール: 目次の直後。レールが無いページは目次を .side-rail で包む
  const tocStart = html.indexOf('<nav class="toc">');
  if (tocStart < 0) throw new Error(`${slug}: 目次（nav.toc）が無い`);
  const tocEnd = html.indexOf("</nav>", tocStart) + "</nav>".length;
  // PR枠のあるページは gen_pr_blocks.mjs が「<div class="side-rail">PR…<nav class="toc">…</nav></div>」を書いている
  const inRail = html.lastIndexOf('<div class="side-rail">', tocStart) >= 0 && html.startsWith("</div>", tocEnd);
  if (inRail) {
    html = html.slice(0, tocEnd) + railBlock + html.slice(tocEnd);
  } else {
    html = html.slice(0, tocStart) + '<!--rail-next:wrap--><div class="side-rail" data-nav-exp="wrap">'
      + html.slice(tocStart, tocEnd) + railBlock + "</div><!--rail-next:wrapE-->" + html.slice(tocEnd);
  }

  // 取り外すと元に戻ること（目印の外を1バイトも変えていない証拠）
  if (stripNav(html) !== stripNav(a.html)) throw new Error(`${slug}: 導線を外しても元に戻らない`);
  for (const line of html.split("\n")) {
    if (/next-read|rail-next|nav-exp/.test(line) && !NAV_LINE.test(line)) throw new Error(`${slug}: 目印の無い導線の行がある`);
  }
  return html;
}

let changed = 0, frozen = 0, treated = 0;
const failures = [];
for (const [slug, a] of articles) {
  const path = `/column/${slug}/`;
  if (exp.C.has(path) || exp.P.has(path) || exp.F.has(path)) { frozen++; continue; } // 入力バイトのまま
  let html;
  if (exp.T.has(path)) {
    try { html = buildTreatment(slug, a); treated++; } catch (e) { failures.push(e.message); continue; }
  } else {
    const block = `<!--next-read:S--><section class="next-read"><h2>次に読む</h2><div class="tool-grid">${legacyPicks(slug, a).map(legacyCard).join("")}</div></section><!--next-read:E-->`;
    html = a.html;
    if (MARK.test(html)) html = html.replace(MARK, block);
    else {
      const pos = html.indexOf('<section class="related"');
      const sourcePos = html.search(/<h2[^>]*id="source"/i);
      const at = pos >= 0 ? pos : (sourcePos >= 0 ? sourcePos : html.indexOf("</article>"));
      if (at < 0) continue;
      html = html.slice(0, at) + block + "\n" + html.slice(at);
    }
  }
  if (html !== a.html) { changed++; if (!CHECK) writeFileSync(a.file, html); }
}
if (failures.length) { console.error(`✗ 対象ページの生成に失敗:\n  ${failures.join("\n  ")}`); process.exit(1); }
if (treated !== exp.treatment.length) { console.error(`✗ 対象 ${exp.treatment.length}本のうち ${treated}本しか生成していない`); process.exit(1); }
if (CHECK && changed) { console.error(`✗ 次に読むが古い: ${changed}本`); process.exit(1); }
console.log(`✓ 次に読む ${articles.size}本（対象${treated}・据え置き${frozen}） (${CHECK ? "最新" : `${changed}本更新`})`);
