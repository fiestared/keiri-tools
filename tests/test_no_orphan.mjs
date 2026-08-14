/**
 * 公開している記事が、**どこからもリンクされていない状態**になっていないかを見る。
 *
 *   node tests/test_no_orphan.mjs
 *
 * ★なぜ要るか（2026-08-14）:
 *   記事を足すたびに「一覧には載るが、本文からは誰も指していない」ページが増える。
 *   Google は「重要なページは他のページから辿れるようにする」ことを公式に勧めている
 *   （links-crawlable）。sitemap に在れば発見はされるが、
 *   **どこからも参照されないページは、サイト内での位置づけが無い**。
 *
 * ★数え方をここで固定する（2026-08-14 に実測で確定）:
 *   - リンク元は「公開されている**全ページ**」＝記事＋ツール＋補助金。
 *     ★記事どうしだけで数えると**大幅に過大評価**になる。
 *       実測: 記事→記事だけだと孤立34本だが、ツールページからのリンクを入れると**6本**だった。
 *       （IAレビューでは fable が27本・codex が28本としていたが、どちらも記事間だけの集計）
 *   - `<main>` の中だけを見る。ヘッダ・フッタの定型リンクは「参照」ではない
 *     （gen_tool_related が同じ誤りで壊れていた。2026-08-14 修正）
 *   - noindex のページはリンク元に数えない（評価が流れない）
 *   - `.nopublish` の記事は対象外（そもそも公開していない）
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const DOCS = join(ROOT, 'docs');

/** docs 配下の index.html を集める（embed は他サイト用なので除く） */
function pages(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'embed' || e.name === 'assets') continue;
      pages(p, out);
    } else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const all = pages(DOCS);
const published = new Set();
for (const d of readdirSync(join(DOCS, 'column'), { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const dir = join(DOCS, 'column', d.name);
  if (existsSync(join(dir, '.nopublish'))) continue;
  if (existsSync(join(dir, 'index.html'))) published.add(d.name);
}

const inbound = new Map([...published].map((s) => [s, new Set()]));
for (const file of all) {
  if (existsSync(join(dirname(file), '.nopublish'))) continue;
  const html = readFileSync(file, 'utf8');
  if (/content="noindex/.test(html)) continue;      // ★noindex からのリンクは数えない
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
  const self = basename(dirname(file));
  const hits = [
    ...main.matchAll(/href="[./]*column\/([a-z0-9-]+)\//g),
    ...main.matchAll(/href="\.\.\/([a-z0-9-]+)\//g),
  ].map((m) => m[1]);
  for (const dst of hits) {
    if (published.has(dst) && dst !== self) inbound.get(dst).add(self);
  }
}

const orphans = [...inbound].filter(([, v]) => v.size === 0).map(([k]) => k).sort();
if (orphans.length) {
  console.error(`✗ どこからもリンクされていない公開記事 ${orphans.length}本（公開${published.size}本中）:`);
  for (const o of orphans) console.error(`  - /column/${o}/`);
  console.error('\n  主題が近い記事・ツールの本文から、文脈のある1本を張ること。');
  console.error('  ★一覧の羅列を足して数だけ satisfies しない（周辺の文脈ごと書く）。');
  process.exit(1);
}
console.log(`✓ 孤立した公開記事なし（公開${published.size}本／リンク元${all.length}ページ）`);
