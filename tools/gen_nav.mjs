#!/usr/bin/env node
/**
 * グローバルナビを全ページに揃える。
 *
 *   node tools/gen_nav.mjs          # 書き換える
 *   node tools/gen_nav.mjs --check  # 差分があれば非0で終わる（テストから呼ぶ）
 *
 * ★なぜ生成器にするか（2026-08-12）:
 *   ナビは**182ページの静的HTMLに直書き**されていて、ページの深さで相対パスが
 *   4パターンに分かれている（`#tools` / `../#tools` / `../../#tools`）。
 *   手で足すと必ず取り残しが出る。実際、今日の時点で「資産形成」は
 *   **5ページにしか入っていなかった**（残り177ページのナビには無い）。
 *   → 深さから相対パスを計算して機械で揃える。以後この関数だけを直す。
 *
 * ★現在地は aria-current="page" で示す。自分のセクションにいるのにリンクが
 *   ただ並んでいるだけだと、どこに居るのか分からない。
 *
 * ★/embed/ は他サイトへの埋め込み用でヘッダを持たない。触らない。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const DOCS = join(ROOT, 'docs');

// ★ナビの項目。ここだけを直せば全ページに反映される。
//   href はサイトルートからのパス。相対パスは深さから計算する。
const ITEMS = [
  { href: 'hojokin/', label: '補助金' },
  { href: '#tools', label: 'ツール', rootOnly: true },   // トップの #tools アンカー
  { href: 'column/', label: 'コラム' },
  { href: 'toushi/', label: '資産形成' },
];

const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n === 'index.html') out.push(p);
  }
  return out;
};

/** そのページから見た相対パス。深さ0（docs直下）なら "column/"、深さ2なら "../../column/" */
function rel(depth, href) {
  const up = depth === 0 ? '' : '../'.repeat(depth);
  if (href.startsWith('#')) return depth === 0 ? href : `${up}${href}`;
  return `${up}${href}`;
}

/**
 * いま居る場所がその項目の中か（現在地の印をつけるため）。
 * ★ディレクトリが分かれていても同じ話題なら同じ項目に含める。
 *   /hojokin-zeimu/ は補助金の話なので「補助金」を現在地にする
 *   （URLの階層だけで判定すると、利用者の感覚とズレる）。
 */
const ALSO = {
  'hojokin': ['hojokin-zeimu'],
};

function isCurrent(pageDir, href) {
  if (href.startsWith('#')) return pageDir === '';           // トップだけ
  const sec = href.replace(/\/$/, '');
  if (pageDir === sec || pageDir.startsWith(`${sec}/`)) return true;
  for (const extra of ALSO[sec] || []) {
    if (pageDir === extra || pageDir.startsWith(`${extra}/`)) return true;
  }
  return false;
}

export function buildHeader(pageDir) {
  const depth = pageDir === '' ? 0 : pageDir.split('/').length;
  const up = depth === 0 ? './' : '../'.repeat(depth);
  const links = ITEMS.map((it) => {
    const href = it.rootOnly && depth > 0 ? rel(depth, '#tools') : rel(depth, it.href);
    const cur = isCurrent(pageDir, it.href) ? ' aria-current="page"' : '';
    return `    <a href="${href}"${cur}>${it.label}</a>`;
  }).join('\n');
  return `<header class="site">\n  <a class="brand" href="${up}">経理ミニツールズ</a>\n  <nav>\n${links}\n  </nav>\n</header>`;
}

const HEADER_RE = /<header class="site">[\s\S]*?<\/header>/;

function main() {
  const check = process.argv.includes('--check');
  let changed = 0, skipped = 0;
  const stale = [];
  for (const fp of walk(DOCS)) {
    const relPath = relative(DOCS, fp);
    // ★/embed/ はヘッダを持たない配信面。触らない
    if (relPath.startsWith('embed/')) { skipped++; continue; }
    const html = readFileSync(fp, 'utf8');
    if (!HEADER_RE.test(html)) { skipped++; continue; }
    // ★about/privacy/contact は独自のナビ（運営者情報など）を持つ。上書きしない
    const cur = html.match(HEADER_RE)[0];
    if (/運営者情報|プライバシーポリシー/.test(cur)) { skipped++; continue; }

    const pageDir = dirname(relPath) === '.' ? '' : dirname(relPath);
    const want = buildHeader(pageDir);
    if (cur === want) continue;
    stale.push(relPath);
    if (!check) writeFileSync(fp, html.replace(HEADER_RE, want));
    changed++;
  }

  if (check) {
    if (changed) {
      console.error(`✗ グローバルナビが揃っていないページ ${changed}件:`);
      for (const p of stale.slice(0, 12)) console.error(`  - ${p}`);
      if (stale.length > 12) console.error(`  … 他${stale.length - 12}件`);
      console.error('\n  node tools/gen_nav.mjs を実行してコミットすること。');
      process.exit(1);
    }
    console.log(`✓ gen_nav --check: 全ページのナビが揃っている（${skipped}件は対象外）`);
    return;
  }
  console.log(`✓ ナビを揃えた: ${changed}ページを更新 / ${skipped}件は対象外`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
