#!/usr/bin/env node
// DOM-derived review units. Coverage is a mapping, never a legal correctness verdict.
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const normalize = s => s.normalize('NFKC').replace(/\s+/gu, '').trim();
const hash = s => createHash('sha256').update(s).digest('hex').slice(0,20);
const selector = 'div,section,article,main,title,meta[name="description"],meta[property^="og:"],h1,h2,h3,h4,h5,h6,p,li,td,th,text,label,option,input,textarea,button,figcaption,dt,dd,summary,.hint';
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
    const clone = el.cloneNode(true);
    // Nested review elements are separate units; retain the parent's own text exactly once.
    for (const child of clone.querySelectorAll(selector + ',script,style')) child.remove();
    let text = tag === 'meta' ? el.content : clone.textContent;
    if (tag === 'input') text = `${el.id || el.name || el.type}: ${['checkbox','radio'].includes(el.type) ? el.checked : el.value}; placeholder=${el.getAttribute('placeholder') || ''}; min=${el.min}; max=${el.max}; step=${el.step}`;
    if (tag === 'option') text += ` [value=${el.value};default=${el.selected}]`;
    if (!normalize(text || '')) continue;
    const kind = tag === 'meta' ? (el.name || el.getAttribute('property')) : tag;
    const zone = summarySection || tag === 'title' || tag === 'meta' || tag === 'h1' || (tag === 'p' && afterH1) || el.closest('.lead,.summary,.callout') ? 'summary' : faq ? 'faq' : el.closest('table') ? 'table' : el.closest('label,select,form') || ['input','option','label','button'].includes(tag) ? 'ui' : 'body';
    // Pure organizational labels carry no assertion. Keep substantive headings/cells protected.
    const organizationalLabel = ((/^(?:h[2-6]|div)$/.test(tag)) && /^(?:この記事のまとめ|実務の注意点まとめ)$/.test(text.trim()))
      || (tag === 'th' && /^(?:支出の例|よく使う科目|消費税|ここを間違える)$/.test(text.trim()));
    const protectedUnit = !organizationalLabel && (zone === 'summary' || (zone === 'faq' && !/^h/.test(tag))); 
    // Split prose, but leave labels/options and input values intact.
    const parts = ['p','li','td','th','dd','figcaption'].includes(tag) ? text.match(/[^。！？!?]+[。！？!?]*|[。！？!?]+/gu) || [] : [text];
    for (const part of parts) {
      const normalized = normalize(part); if (!normalized) continue;
      const text_hash = hash(normalized), key = `${kind}:${text_hash}`;
      const occurrence = (seen.get(key) || 0) + 1; seen.set(key, occurrence);
      units.push({id:`s-${hash(key)}-${occurrence}`,page,kind,zone,protected:protectedUnit && !structuralNonclaim(tag, normalized),text:part.trim(),text_hash,element_id:el.id || null});
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
