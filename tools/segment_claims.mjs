#!/usr/bin/env node
// DOM-derived review units. Coverage is a mapping, never a legal correctness verdict.
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const normalize = s => s.normalize('NFKC').replace(/\s+/gu, '').trim();
const hash = s => createHash('sha256').update(s).digest('hex').slice(0,20);
const selector = 'div,section,article,main,title,meta[name="description"],meta[property^="og:"],h1,h2,h3,h4,h5,h6,p,li,td,th,svg,label,option,input,textarea,button,figcaption,dt,dd,summary,.hint';
// 2026-10-01 対策5（gbrain audits/keiri-why-not-one-pass-2026-10-01 の D）: 単独では非主張に見える断片が主張の一部だった。
//  - 図: SVG の text 断片・aria-label・title・figcaption を図ごとに1単位（kind "figure"）に束ねる
//  - 表: データのセルは「行見出し＋列見出し＋セル」で1単位（「超えるとどうなる」を結論のセルと一緒に照合させる）
//  - 見出し・ラベル・表・図のうち、金額・数字・日付・境界語（超・以上・未満・以下 等）を含むものは非主張にできない（protected）
export const BOUNDARY = /[0-9０-９]|[一二三四五六七八九十百千万億]+(?:円|年|月|日|割|歳|か月|ヶ月|カ月)|以上|以下|未満|超|以内|まで|以後|以降|以前|満了|期限/u;
const LABEL_TAGS = new Set(['h1','h2','h3','h4','h5','h6','th','td','label','option','button','dt','summary','figcaption','figure']);
const cellText = c => { const k = c.cloneNode(true); for (const x of k.querySelectorAll('script,style')) x.remove(); return k.textContent.replace(/\s+/gu, ' ').trim(); };
// 表のセルの位置（colspan を数える。rowspan は数えない）
function cellColumn(cell) { let col = 0; for (let c = cell.previousElementSibling; c; c = c.previousElementSibling) if (/^t[dh]$/.test(c.localName)) col += Number(c.getAttribute('colspan')) || 1; return col; }
function headerRow(table) {
  const head = table.querySelector(':scope > thead > tr');
  if (head) return head;
  const first = table.querySelector(':scope > tbody > tr, :scope > tr');
  const cells = first ? [...first.children].filter(c => /^t[dh]$/.test(c.localName)) : [];
  return cells.length && cells.every(c => c.localName === 'th') ? first : null;
}
// データのセルなら {row, col} の見出しを返す。見出しのセル（列見出しの行・行の先頭のセル）は null
function tableContext(cell) {
  const tr = cell.closest('tr'), table = cell.closest('table'); if (!tr || !table) return null;
  const hr = headerRow(table); if (hr === tr) return null;
  const cells = [...tr.children].filter(c => /^t[dh]$/.test(c.localName));
  if (cells.length < 2 || cells[0] === cell) return null;
  const col = cellColumn(cell);
  let colHead = '';
  if (hr) for (const h of [...hr.children].filter(c => /^t[dh]$/.test(c.localName))) { const a = cellColumn(h), b = a + (Number(h.getAttribute('colspan')) || 1); if (col >= a && col < b) { colHead = cellText(h); break; } }
  return { row: cellText(cells[0]), col: colHead };
}
function figureText(svg) {
  const fig = svg.closest('figure');
  const parts = [svg.getAttribute('aria-label') || '', ...[...svg.querySelectorAll(':scope > title, :scope > desc')].map(x => x.textContent), ...[...svg.querySelectorAll('text')].filter(t => !t.parentElement.closest('text')).map(t => t.textContent)];
  const cap = fig && fig.querySelector('figcaption'); if (cap) parts.push(cap.textContent);
  return parts.map(x => x.replace(/\s+/gu, ' ').trim()).filter(Boolean).join(' / ');
}
// Opt-in context for labels that cannot be adjudicated independently. Keep the
// visible answer/data units too; a change to either also invalidates this unit.
function reviewContextText(el) {
  const mode = el.getAttribute('data-review-context');
  if (!mode) return null;
  if (mode === 'next' && /^h[2-6]$/.test(el.localName)) {
    const answer = el.nextElementSibling;
    if (!answer?.matches('p.faq-answer')) throw Error('data-review-context=next requires an adjacent FAQ answer');
    return `【質問】${cellText(el)} 【回答】${cellText(answer)}`;
  }
  if (mode === 'row' && /^t[dh]$/.test(el.localName)) {
    const cells = [...el.parentElement.children].filter(c => /^t[dh]$/.test(c.localName));
    if (cells[0] !== el || cells.length < 2) throw Error('data-review-context=row requires a row label and data cells');
    return `【行】${cellText(el)} / ` + cells.slice(1).map(c => {
      const context = tableContext(c);
      return `【列】${context.col} 【値】${cellText(c)}`;
    }).join(' / ');
  }
  throw Error('Invalid data-review-context: ' + mode);
}
const excluded = 'script,style,nav,header,footer,aside,.breadcrumb,.article-meta,.source-method,.related,.rel-block,.next-read,.article-next-read,.rail-next,.tool-related';
function structuralNonclaim(tag, text) {
  if (/^[)）]+$/.test(text)) return true;
  if (/^h[1-6]$/.test(tag) && ['まとめ','実務上の意味'].includes(text)) return true;
  if (tag === 'th' && ['区分','原則','入る方法','根拠'].includes(text)) return true;
  // Exact advisory/operation labels assert no deadline or legal requirement; adjacent FAQ assertions stay protected.
  return (tag === 'p' && ['先に全体を表にします。', '契約と適用法令を確認してください。'].includes(text)) || text === 'この内容をXで共有';
}
export function segmentClaims(html, page = '') {
  const dom = new JSDOM(html); const d = dom.window.document;
  const seen = new Map(), units = [];
  let faq = false, afterH1 = false, summarySection = false;
  for (const el of d.querySelectorAll(selector)) {
    if (el.closest(excluded)) continue;
    const tag = el.localName;
    if (/^h[12]$/.test(tag)) { faq = /FAQ|よくある質問/i.test(el.textContent); summarySection = /まとめ|結論|要点/.test(el.textContent); }
    if (tag === 'h1') afterH1 = true;
    if (tag === 'h2') afterH1 = false;
    if (tag === 'input' && ['hidden','submit','reset','button'].includes(el.type)) continue;
    if (tag === 'meta' && !/description|og:(title|description)/.test(el.name || el.getAttribute('property'))) continue;
    // 図に入っている figcaption は図の単位に束ねる（別の単位にしない）
    if (tag === 'figcaption' && el.closest('figure')?.querySelector('svg')) continue;
    if (tag === 'svg' && el.parentElement?.closest('svg')) continue;
    const clone = el.cloneNode(true);
    // Nested review elements are separate units; retain the parent's own text exactly once.
    for (const child of clone.querySelectorAll(selector + ',script,style')) child.remove();
    let text = tag === 'meta' ? el.content : tag === 'svg' ? figureText(el) : clone.textContent;
    const context = /^t[dh]$/.test(tag) ? tableContext(el) : null;
    if (context && normalize(text || '')) text = `${context.row ? `【行】${context.row} ` : ''}${context.col ? `【列】${context.col} ` : ''}【値】${text.replace(/\s+/gu, ' ').trim()}`;
    if (tag === 'input') text = `${el.id || el.name || el.type}: ${['checkbox','radio'].includes(el.type) ? el.checked : el.value}; placeholder=${el.getAttribute('placeholder') || ''}; min=${el.min}; max=${el.max}; step=${el.step}`;
    if (tag === 'option') text += ` [value=${el.value};default=${el.selected}]`;
    if (!normalize(text || '')) continue;
    const reviewContext = reviewContextText(el);
    if (reviewContext) text = reviewContext;
    const kind = tag === 'meta' ? (el.name || el.getAttribute('property')) : tag === 'svg' ? 'figure' : tag;
    const zone = summarySection || tag === 'title' || tag === 'meta' || tag === 'h1' || (tag === 'p' && afterH1) || el.closest('.lead,.summary,.callout') ? 'summary' : faq ? 'faq' : el.closest('table') ? 'table' : el.closest('label,select,form') || ['input','option','label','button'].includes(tag) ? 'ui' : 'body';
    // Pure organizational labels carry no assertion. Keep substantive headings/cells protected.
    const organizationalLabel = ((/^(?:h[2-6]|div)$/.test(tag)) && /^(?:この記事のまとめ|実務の注意点まとめ)$/.test(text.trim()))
      || (tag === 'th' && /^(?:支出の例|よく使う科目|消費税|ここを間違える)$/.test(text.trim()));
    const protectedUnit = !organizationalLabel && (!!reviewContext || zone === 'summary' || (zone === 'faq' && !/^h/.test(tag))); 
    // Split prose, but leave labels/options and input values intact. 表のデータのセルは見出しつきの1単位（分けない）。
    const parts = ['p','li','td','th','dd','figcaption'].includes(tag) && !context && !reviewContext ? text.match(/[^。！？!?]+[。！？!?]*|[。！？!?]+/gu) || [] : [text];
    for (const part of parts) {
      const normalized = normalize(part); if (!normalized) continue;
      const text_hash = hash(normalized), key = `${kind}:${text_hash}`;
      const occurrence = (seen.get(key) || 0) + 1; seen.set(key, occurrence);
      const boundaryLabel = LABEL_TAGS.has(kind) && BOUNDARY.test(normalized);
      units.push({id:`s-${hash(key)}-${occurrence}`,page,kind,zone,protected:(protectedUnit || boundaryLabel) && !structuralNonclaim(tag, normalized),text:part.trim(),text_hash,element_id:el.id || null});
    }
    if (tag === 'p') afterH1 = false;
  }
  dom.window.close(); return units;
}
export function validateSegments(units, ledger) {
  const errors = [], map = new Map(units.map(u=>[u.id,u])), links = {}, nonclaims = new Set(), verified = new Set();
  const claimIds = new Set();
  for (const c of ledger?.claims || []) {
    if (!c.id || claimIds.has(c.id)) errors.push(`missing/duplicate claim ID: ${c.id}`);
    claimIds.add(c.id);
    if (c.covers !== undefined && !Array.isArray(c.covers)) { errors.push(`invalid covers: ${c.id}`); continue; }
    for (const id of c.covers || []) {
      if (!map.has(id)) errors.push(`unknown/stale segment: ${id}`);
      else (links[id] ||= []).push(c.id);
    }
  }
  for (const n of ledger?.nonclaims || []) {
    const u = map.get(n.id);
    if (!u || u.protected || !n.why?.trim() || nonclaims.has(n.id) || links[n.id]) errors.push(`invalid nonclaim: ${n.id}`);
    else nonclaims.add(n.id);
  }
  // Exact text plus an independent review reference, not the claim's self-declared checked date.
  for (const v of ledger?.verified || []) {
    if (map.get(v.id)?.text_hash === v.text_hash && links[v.id] && v.result === 'ok' && v.review_ref?.trim()) verified.add(v.id);
  }
  const unprocessed = units.filter(u=>!links[u.id] && !nonclaims.has(u.id)).map(u=>u.id);
  errors.push(...unprocessed.map(id=>`unprocessed segment: ${id}`));
  return {total:units.length,covered:Object.keys(links).length,verified:verified.size,nonclaims:nonclaims.size,unprocessed:unprocessed.length,unprocessed_ids:unprocessed,links,errors};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pages=process.argv.slice(2); if (!pages.length) throw Error('usage: segment_claims.mjs docs/.../index.html [...]');
  console.log(JSON.stringify(pages.flatMap(page=>segmentClaims(readFileSync(page,'utf8'),page)),null,2));
}
