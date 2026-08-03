/**
 * 全ページの <head> に favicon の link を入れる（冪等）。
 *
 * ★なぜ要るのか（2026-08-03）:
 *   このサイトには **favicon が1つも無かった**。ブラウザのタブ・ブックマーク・
 *   検索結果（Bingは検索結果にファビコンを出す）で無地のまま表示されていた。
 *   116種のツールを持つサイトとしては、識別子が無いのは単純に損。
 *
 * ★パスは必ずルート絶対（/favicon.ico）にする:
 *   このサイトの stylesheet は `assets/` `../assets/` `../../assets/` `../../../assets/` と
 *   ページの深さで4通りある。相対で書くと深さごとに分岐が要り、1つ間違えると
 *   そのページだけ静かに404になる。ルート絶対なら深さに依存しない。
 *
 * ★挿入位置は <meta charset> の直後:
 *   全153ページが charset 行を持つ（実測）。stylesheet 行は121ページにしか無いので使わない。
 *
 * usage:
 *   node tools/gen_favicon_links.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS = join(root, 'docs');

export const MARK = '<!-- favicon:auto -->';
export const LINKS = [
  MARK,
  '<link rel="icon" href="/favicon.ico" sizes="any">',
  '<link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
].join('\n');

/** favicon の実体ファイル（欠けていたら生成を止める＝404を撒かない） */
export const ASSETS = ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png'];

export function pages(dir = DOCS, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) pages(p, acc);
    else if (f === 'index.html') acc.push(p);
  }
  return acc;
}

export function withLinks(html) {
  if (html.includes(MARK)) {
    // 既にある場合は中身を差し替える（冪等・タグを増やさない）
    const a = html.indexOf(MARK);
    const end = html.indexOf('\n', html.lastIndexOf('apple-touch-icon.png">', a + 400));
    return html.slice(0, a) + LINKS + html.slice(end < 0 ? a + MARK.length : end);
  }
  const m = html.match(/<meta charset="[^"]*">/i);
  if (!m) throw new Error('<meta charset> が見つかりません（挿入位置が決められない）');
  const at = html.indexOf(m[0]) + m[0].length;
  return html.slice(0, at) + '\n' + LINKS + html.slice(at);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  // fail closed: 実体が無いのに link だけ撒くと、全ページから404を叩くことになる
  for (const f of ASSETS) {
    try { statSync(join(DOCS, f)); }
    catch { throw new Error(`docs/${f} がありません。実体を置いてから実行してください`); }
  }
  const list = pages();
  let changed = 0;
  for (const p of list) {
    const before = readFileSync(p, 'utf-8');
    const after = withLinks(before);
    if (after !== before) {
      changed++;
      if (!process.argv.includes('--dry')) writeFileSync(p, after);
    }
  }
  const verb = process.argv.includes('--dry') ? '（--dry）変更が要るページ' : 'favicon リンクを入れました';
  console.log(`${verb}: ${changed} / 全 ${list.length} ページ`);
}
