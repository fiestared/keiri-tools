/**
 * 回遊の局所改修（2026-09-16）の約束を検査する。名簿は tools/nav_experiment.json。
 *
 *   - 対象15本: 手作り関連 → 次に読む（3件）の順。右レールに関連3本。どちらも保護対象・対照群・自分へリンクしない
 *   - 対象外: 実験の印（data-nav-exp / rail-next）を持たない
 *   - 導線の行は必ず目印（NAV_LINE）を同じ行に持つ（更新日・lastmod の判定がこれに依存する）
 *   - 「導線だけの差分」判定: 目次を包み直す差分は導線だけ、本文を1文字変えたら導線だけではない
 *   - 表の施策: 標準報酬に続きの合図と全行表示、全銀の略語表の直下に変換ツール
 *   - 見た目は assets/style.css（記事内に <style> を置かない）。印の無いページには当たらない書き方
 *
 * ★対照・保護対象のページが基点とバイト一致することは、ここでは見ない（ワーカーの正当な改稿で赤くなるため）。
 *   公開時の一回きりの確認で見る。
 *
 * node tests/test_nav_experiment.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadNavExperiment, NAV_LINE, isNavOnlyDiff } from "../tools/nav_experiment.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const COLUMN = join(ROOT, "docs/column");

const hrefsIn = (html) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]);
const toPath = (href) => {
  const c = href.split("#")[0];
  let m = c.match(/^\.\.\/([a-z0-9-]+)\/$/); if (m) return `/column/${m[1]}/`;
  m = c.match(/^\.\.\/\.\.\/([a-z0-9-]+)\/$/); if (m) return `/${m[1]}/`;
  return null;
};

/** pages: Map<slug, html>。失敗の一覧を返す（break テストから同じ関数を呼ぶ） */
export function checkPages(pages, exp = loadNavExperiment()) {
  const errs = [];
  for (const [slug, html] of pages) {
    const self = `/column/${slug}/`;
    for (const line of html.split("\n")) {
      if (/<!--(?:next-read|rail-next|nav-exp)/.test(line) && !NAV_LINE.test(line)) errs.push(`${slug}: 目印の形が崩れた導線の行`);
    }
    const isT = exp.T.has(self);
    const hasExp = /data-nav-exp=|<!--rail-next:/.test(html);
    if (!isT) {
      if (hasExp && !exp.F.has(self)) errs.push(`${slug}: 対象外なのに回遊実験の印がある`);
      if (exp.F.has(self) && /data-nav-exp=|<!--rail-next:/.test(html)) errs.push(`${slug}: 表の施策のページに次に読む・レールの実験が入った`);
      continue;
    }
    const banned = (p) => p === self || exp.P.has(p) || exp.C.has(p);
    const nr = html.match(/<!--next-read:S-->([\s\S]*?)<!--next-read:E-->/g) || [];
    if (nr.length !== 1) { errs.push(`${slug}: 次に読むが ${nr.length} 個`); continue; }
    const relStart = html.indexOf('<section class="related"');
    const relEnd = html.indexOf("</section>", relStart);
    const nrAt = html.indexOf("<!--next-read:S-->");
    if (relStart < 0 || nrAt < relEnd) errs.push(`${slug}: 次に読むが手作り関連の後ろに無い`);
    const nrLinks = hrefsIn(nr[0]).map(toPath);
    if (nrLinks.length !== 3 || nrLinks.some((p) => !p)) errs.push(`${slug}: 次に読むが記事・ツール3件でない`);
    for (const p of nrLinks) if (p && banned(p)) errs.push(`${slug}: 次に読むが禁止先 ${p} へリンク`);
    if (new Set(nrLinks).size !== nrLinks.length) errs.push(`${slug}: 次に読むに重複`);
    const pin = exp.pins?.[slug];
    if (pin && nrLinks.join() !== pin.map((s) => `/column/${s}/`).join()) errs.push(`${slug}: 固定した次に読む（nextReadPins）と違う`);
    const rail = html.match(/<!--rail-next:S-->([\s\S]*?)<!--rail-next:E-->/g) || [];
    if (rail.length !== 1) { errs.push(`${slug}: 右レールの関連が ${rail.length} 個`); continue; }
    const railLinks = hrefsIn(rail[0]).map(toPath);
    if (railLinks.length !== 3 || railLinks.some((p) => !p)) errs.push(`${slug}: 右レールの関連が3件でない`);
    for (const p of railLinks) if (p && banned(p)) errs.push(`${slug}: 右レールが禁止先 ${p} へリンク`);
    // レールは目次と同じ .side-rail の中（1200px以上で追従する面）
    const railAt = html.indexOf("<!--rail-next:S-->");
    const tocEnd = html.indexOf("</nav>", html.indexOf('<nav class="toc">'));
    if (tocEnd < 0 || railAt !== tocEnd + "</nav>".length) errs.push(`${slug}: 右レールの関連が目次の直後に無い`);
    const railOpen = html.lastIndexOf('<div class="side-rail"', railAt);
    if (railOpen < 0 || html.slice(railOpen, railAt).includes("</article>")) errs.push(`${slug}: 右レールの関連が .side-rail の中に無い`);
    if (!/data-nav-exp="t"/.test(nr[0])) errs.push(`${slug}: 次に読むに対象の印が無い`);
    if (/<style[\s>]/.test(html.slice(html.indexOf("<article")))) errs.push(`${slug}: 記事内に <style> がある`);
  }
  return errs;
}

export function checkTableFix(read, css) {
  const errs = [];
  const hy = read("hyojun-hoshu-gakuhyo");
  const cue = hy.indexOf('id="hyou-expand"');
  const wrap = hy.indexOf('<div class="scroll-wrap">', cue);
  if (cue < 0) errs.push("標準報酬: 全行表示の操作が無い");
  else if (wrap < 0 || hy.slice(cue, wrap).includes("<table")) errs.push("標準報酬: 全行表示の操作が表の直前に無い");
  if (!/@media print \{\s*\.table-cue ~ \.scroll-wrap \{ max-height: none !important;/.test(css)) errs.push("標準報酬: 印刷で表が枠の高さに切れる");
  if (!/\.table-cue ~ \.scroll-wrap\.is-expanded \{ max-height: none; \}/.test(css)) errs.push("標準報酬: 全行表示の CSS が無い");
  const zg = read("zengin-format-guide");
  const list = zg.indexOf('<h3 id="list">');
  const tEnd = zg.indexOf("</table>", list);
  const next = zg.indexOf("<!--nav-exp:table-link S-->", list);
  if (list < 0 || next < 0 || zg.slice(tEnd, next).replace(/\s/g, "") !== "</table>") errs.push("全銀: 略語表の直下に変換ツールへのリンクが無い");
  else if (!zg.slice(next, zg.indexOf("<!--nav-exp:table-link E-->")).includes('href="../../zengin-kana/"')) errs.push("全銀: 表の直下のリンク先が変換ツールでない");
  return errs;
}

/** 右レール・関連の見た目が共通CSSにあるか（記事内に <style> を置かない型） */
export function checkCss(css) {
  const errs = [];
  if (!/\.rail-next \{ background: #fff;/.test(css)) errs.push("style.css: 右レールの関連の見た目が無い");
  if (!/@media \(max-width: 1199\.98px\) \{ \.rail-next \{ display: none; \} \}/.test(css)) errs.push("style.css: 1200px未満で右レールの関連を隠していない（記事冒頭に出る）");
  return errs;
}

export function checkDiffRule() {
  const errs = [];
  const toc = ['  <nav class="toc">'];
  const wrapped = ['  <!--rail-next:wrap--><div class="side-rail" data-nav-exp="wrap"><nav class="toc">'];
  if (!isNavOnlyDiff(toc, wrapped)) errs.push("判定: 目次を包み直しただけの差分を本文の変更と数えた");
  if (isNavOnlyDiff(['  <p>30万円</p>'], ['  <p>31万円</p><!--next-read:S--><!--next-read:E-->'])) errs.push("判定: 本文の数字を変えた差分を導線だけと数えた");
  if (isNavOnlyDiff(['<p>a</p>'], ['<p>b</p>'])) errs.push("判定: 導線に触れない差分を導線だけと数えた");
  if (!isNavOnlyDiff([], ['<!--nav-exp:style S--><style>.x{}</style><!--nav-exp:style E-->'])) errs.push("判定: ページ内CSSの追加を本文の変更と数えた");
  return errs;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const exp = loadNavExperiment();
  const pages = new Map();
  for (const d of readdirSync(COLUMN, { withFileTypes: true })) {
    const f = join(COLUMN, d.name, "index.html");
    if (d.isDirectory() && existsSync(f)) pages.set(d.name, readFileSync(f, "utf8"));
  }
  const read = (s) => pages.get(s) || "";
  const css = readFileSync(join(ROOT, "docs/assets/style.css"), "utf8");
  const errs = [...checkPages(pages, exp), ...checkTableFix(read, css), ...checkCss(css), ...checkDiffRule()];
  if (errs.length) { console.error(`✗ 回遊実験の約束違反 ${errs.length}件\n  ${errs.join("\n  ")}`); process.exit(1); }
  console.log(`✓ 回遊実験: 対象${exp.T.size}本・対照${exp.C.size}本・保護${exp.P.size}件・表の施策${exp.F.size}本の約束を満たす`);
}
