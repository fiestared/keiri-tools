/**
 * `/embed/` のウィジェット一覧カードを **静的HTMLとして焼き込む**。
 *
 * ★なぜ必要か（2026-08-03 に本番で実測）:
 *   `curl https://keiri-tools.com/embed/` して個別ウィジェットへのリンクを数えたら **0本**だった。
 *   一覧は丸ごと JavaScript で描画していて、**JSを実行しないクローラからは31種が存在しない**。
 *   これは同じリポジトリが `/saitei-chingin/` で既に潰した failure mode と同型
 *   （tools/gen_saitei_table.mjs の冒頭: 「GPTBot/ClaudeBot/PerplexityBot/bingbot は
 *   いずれもJSを実行しない」）。**同じバグが別ページに残っていた。**
 *
 *   埋め込みウィジェットは「他サイトが埋め込む → 自然な被リンクになる」という、
 *   このサイトで唯一の follow 被リンク経路（npm/GitHub はどちらも nofollow）。
 *   その入口が検索から見えないのでは、採用のしようがない。
 *
 * ★正本は index.html 内の `var TOOLS = {...}`:
 *   コピー用スニペットの生成にも同じ配列を使っているので、ここを二重に持たない。
 *   この生成器は TOOLS をパースして、同じ内容の静的カードを器に流し込む。
 *   JS 側は「器が空のときだけ描画する」に変えてあるので二重描画しない（段階的強化）。
 *
 * usage:
 *   node tools/gen_embed_cards.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE = join(root, 'docs/embed/index.html');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** index.html の `var TOOLS = {...}` を読む。★ここが唯一の正本 */
export function parseTools(html) {
  const start = html.indexOf('var TOOLS = {');
  if (start < 0) throw new Error('var TOOLS = { が見つかりません（ページの構造が変わった可能性）');
  const end = html.indexOf('\n};', start);
  if (end < 0) throw new Error('TOOLS の終端が見つかりません');
  const src = html.slice(start + 'var TOOLS = '.length, end + 2);
  const groups = {};
  for (const m of src.matchAll(/(g\d)\s*:\s*\[([\s\S]*?)\]\s*(?=,\s*g\d\s*:|\}\s*$)/g)) {
    const items = [...m[2].matchAll(/\["([^"]+)"\s*,\s*"([^"]+)"\]/g)].map((x) => [x[1], x[2]]);
    if (!items.length) throw new Error(`${m[1]} からウィジェットを1つも読めません`);
    groups[m[1]] = items;
  }
  const n = Object.keys(groups).length;
  if (n !== 4) throw new Error(`グループが ${n} 個です（g1〜g4 の4つのはず）`);
  return groups;
}

export function cardsFor(items) {
  return items.map(([slug, name]) =>
    `      <div class="card"><div class="cn">${esc(name)}</div>` +
    `<div class="cs">/embed/${esc(slug)}/</div>` +
    `<div class="cb"><a class="prev" href="/embed/${esc(slug)}/" target="_blank" rel="noopener">プレビュー ↗</a>` +
    `<button class="copy" data-slug="${esc(slug)}" data-name="${esc(name)}">コピー</button></div></div>`
  ).join('\n');
}

export function buildAll(html) {
  const groups = parseTools(html);
  let out = html;
  for (const [gid, items] of Object.entries(groups)) {
    const open = `<div class="grid" id="${gid}">`;
    const i = out.indexOf(open);
    if (i < 0) throw new Error(`器 ${open} が見つかりません`);
    const j = out.indexOf('</div>\n', i + open.length);
    // 器の中身を丸ごと差し替える（開始タグ直後 〜 対応する閉じタグの直前）
    const closeIdx = findClose(out, i + open.length);
    out = out.slice(0, i + open.length) + '\n' + cardsFor(items) + '\n    ' + out.slice(closeIdx);
  }
  return out;
}

/** ネストを数えて `<div class="grid">` の閉じ位置を返す */
function findClose(s, from) {
  let depth = 1, i = from;
  while (depth > 0) {
    const open = s.indexOf('<div', i);
    const close = s.indexOf('</div>', i);
    if (close < 0) throw new Error('器の閉じタグが見つかりません');
    if (open >= 0 && open < close) { depth++; i = open + 4; }
    else { depth--; i = close + 6; if (depth === 0) return close; }
  }
  throw new Error('器の閉じタグが見つかりません');
}

export function totalCount(html) {
  return Object.values(parseTools(html)).reduce((s, v) => s + v.length, 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const html = readFileSync(PAGE, 'utf-8');
  const n = totalCount(html);
  let next = buildAll(html);
  // 見出しの「◯種」を実数に合わせる（27種のまま止まっていた）
  next = next.replace(/使えるウィジェット一覧（\d+種）/g, `使えるウィジェット一覧（${n}種）`);
  next = next.replace(/計算ウィジェット\d+種/g, `計算ウィジェット${n}種`);
  if (process.argv.includes('--dry')) {
    const links = (next.match(/href="\/embed\/[a-z0-9-]+\/"/g) || []).length;
    console.log(`（--dry）静的カード ${n}件 / 個別ウィジェットへのリンク ${links}本`);
  } else {
    writeFileSync(PAGE, next);
    const links = (next.match(/href="\/embed\/[a-z0-9-]+\/"/g) || []).length;
    console.log(`ウィジェット一覧を静的化しました（${n}種 / リンク ${links}本）`);
  }
}
