/** 出典の各 li・p を検査。公開日 2026-10-15 以降＋リンク整備済みの登録簿。
 * リンクの一次資料性・到達先の内容は執筆/レビュー時に curl で確認する。
 * この検査はネットワークに依存せず、項目単位のリンク欠落を止める。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CUTOFF = '2026-10-15';
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const decode = s => s.replace(/&(?:#(x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi, (m, n) => {
  if (n) return String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n));
  return ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[m.toLowerCase()];
});
const text = s => decode(s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '')).trim();

/** 依存パッケージ不要。タグを積み、入れ子の li を別項目として保持する。
 * コメントと script/style はタグとして解釈しない。位置は壊しテストにも使う。
 */
function elements(html) {
  const nodes = [], stack = [];
  const tags = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[a-z][^>]*>/gi;
  for (const m of html.matchAll(tags)) {
    if (m[0].startsWith('<!--')) continue;
    const tag = m[0].match(/^<\/?([\w-]+)/)[1].toLowerCase();
    if (tag === 'script' || tag === 'style') continue;
    const end = m.index + m[0].length;
    if (m[0].startsWith('</')) {
      const i = stack.findLastIndex(n => n.tag === tag);
      if (i < 0) continue;
      for (const n of stack.splice(i)) { n.contentEnd = m.index; n.end = end; }
      continue;
    }
    // HTML の省略可能な </li> / </p> も次の同列項目で閉じる。
    const last = stack.at(-1);
    if (last && (tag === 'li' && last.tag === 'li' || tag === 'p' && last.tag === 'p')) {
      last.contentEnd = m.index; last.end = m.index; stack.pop();
    }
    const attrs = {};
    const attrText = m[0].slice(tag.length + 1, -1);
    for (const a of attrText.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const key = a[1].toLowerCase();
      if (!(key in attrs)) attrs[key] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    }
    const node = { tag, attrs, start: m.index, contentStart: end, contentEnd: end, end, parent: stack.at(-1) };
    nodes.push(node);
    if (!VOID.has(tag) && !/\/\s*>$/.test(m[0])) stack.push(node);
  }
  for (const n of stack) { n.contentEnd = html.length; n.end = html.length; }
  return nodes;
}

export function publicationDates(html) {
  const dates = [...html.matchAll(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})(?:T[^"\s]*)?"/g)].map(m => m[1]);
  for (const n of elements(html).filter(n => (n.attrs.class ?? '').split(/\s+/).includes('article-meta'))) {
    const meta = text(html.slice(n.contentStart, n.contentEnd));
    const date = meta.match(/公開日\s*[:：]\s*(\d{4})(?:年|-|\/)(\d{1,2})(?:月|-|\/)(\d{1,2})/);
    if (date) dates.push(`${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`);
    // 可視テキストが「公開日: 本日」等でも time の datetime を読む（更新日は拾わない）。
    const raw = html.slice(n.contentStart, n.contentEnd).match(/公開日\s*[:：]\s*<time\b[^>]*\bdatetime=["'](\d{4}-\d{2}-\d{2})/);
    if (raw) dates.push(raw[1]);
  }
  return [...new Set(dates)];
}

export function checkSourceLinks(html) {
  const nodes = elements(html);
  const headings = nodes.filter(n => /^h[1-6]$/.test(n.tag));
  const sources = headings.filter(n => /^h[23]$/.test(n.tag) && text(html.slice(n.contentStart, n.contentEnd)) === '出典');
  const errors = [], items = [];
  if (!sources.length) errors.push('h2/h3「出典」見出しが無い');
  for (const [sectionIndex, heading] of sources.entries()) {
    let container = heading.parent;
    while (container && !['article', 'section', 'main', 'body'].includes(container.tag)) container = container.parent;
    const next = headings.find(n => n.start >= heading.end && n.tag <= heading.tag);
    const end = Math.min(next?.start ?? html.length, container?.contentEnd ?? html.length);
    const sectionItems = nodes.filter(n => ['li', 'p'].includes(n.tag) && n.start >= heading.end && n.start < end);
    if (!sectionItems.length) errors.push(`出典節${sectionIndex + 1}: li・p が無い`);
    for (const [index, item] of sectionItems.entries()) {
      const label = `出典節${sectionIndex + 1} ${item.tag}項目${index + 1}`;
      const reason = item.attrs['data-source-nolink'];
      const links = nodes.filter(n => {
        if (n.tag !== 'a' || n.start < item.contentStart || n.end > item.contentEnd) return false;
        // 子 li のリンクで親や兄弟の欠落を隠さない（規則3・5）。
        for (let p = n.parent; p && p !== item; p = p.parent) if (p.tag === 'li') return false;
        try { const u = new URL(n.attrs.href); return /^https?:$/.test(u.protocol) && !!u.hostname; }
        catch { return false; }
      });
      const preview = text(html.slice(item.contentStart, item.contentEnd)).replace(/\s+/g, ' ').slice(0, 100);
      items.push({ ...item, label, links, reason, preview });
      if (reason !== undefined) {
        if (!reason.trim()) errors.push(`${label}: data-source-nolink の理由が空 — ${preview}`);
      } else if (!links.length) errors.push(`${label}: http(s) の出典リンクが無い — ${preview}`);
    }
  }
  return { errors, items, sections: sources.length };
}

function pageFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory()) return ['assets', 'ext', 'embed'].includes(e.name) ? [] : pageFiles(join(dir, e.name));
    return e.name === 'index.html' ? [join(dir, e.name)] : [];
  });
}

export function runSourceLinks({ docs = join(ROOT, 'docs'), registry = join(ROOT, 'tools/source_link_pages.json') } = {}) {
  const registered = JSON.parse(readFileSync(registry, 'utf8'));
  if (!Array.isArray(registered) || registered.some(p => typeof p !== 'string' || !/^\/(?:[a-z0-9_-]+\/)+$/.test(p))) {
    throw new Error('登録簿は /column/slug/ または /tool/ 形式のパスの配列にする');
  }
  if (new Set(registered).size !== registered.length) throw new Error('登録簿に重複がある');
  const errors = [], seen = new Set();
  let checked = 0, skipped = 0, itemCount = 0, exemptions = 0;
  for (const file of pageFiles(docs)) {
    const page = '/' + relative(docs, dirname(file)).split('\\').join('/') + '/';
    const html = readFileSync(file, 'utf8');
    const isPage = page.startsWith('/column/') && page !== '/column/'
      || /"@type"\s*:\s*(?:"WebApplication"|\[[^\]]*"WebApplication")/.test(html)
      || /\b(?:src|from)\s*=?\s*["'][^"']*_core\.js/.test(html);
    const listed = registered.includes(page);
    if (listed) seen.add(page);
    if (!isPage) { if (listed) errors.push(`${page}: 登録先がコラム・ツールではない`); continue; }
    // .nopublish も配信されるため、日付または明示登録で対象なら検査する。
    if (!listed && !publicationDates(html).some(d => d >= CUTOFF)) { skipped++; continue; }
    checked++;
    const result = checkSourceLinks(html);
    itemCount += result.items.length;
    exemptions += result.items.filter(i => i.reason?.trim()).length;
    errors.push(...result.errors.map(e => `${page}: ${e}`));
  }
  for (const page of registered) if (!seen.has(page)) errors.push(`${page}: 登録先の index.html が存在しない`);
  if (!checked) errors.push('検査対象が0ページ（登録簿・公開日の取り違え）');
  return { errors, checked, skipped, itemCount, exemptions, registered: registered.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      const key = ({ '--docs': 'docs', '--registry': 'registry' })[process.argv[i]];
      if (!key || !process.argv[i + 1]) throw new Error('使い方: node tests/test_source_links.mjs [--docs DIR] [--registry FILE]');
      options[key] = resolve(process.argv[i + 1]);
    }
    const r = runSourceLinks(options);
    for (const e of r.errors) console.error('  - ' + e);
    console.log(`${r.errors.length ? '✗' : '✓'} 出典リンク: ${r.checked}ページ / ${r.itemCount}項目 / 理由付き除外 ${r.exemptions}項目 / 登録簿 ${r.registered}件 / 既存対象外 ${r.skipped}ページ`);
    process.exitCode = r.errors.length ? 1 : 0;
  } catch (e) { console.error('✗ 出典リンク: ' + e.message); process.exitCode = 1; }
}
