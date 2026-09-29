// Condition inventory validation, with executable source-backed cases.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
export function validatePending(status, cores, registered, previous) {
  const errors=[],pending=status.pending || [],na=status.not_applicable || {};
  if (new Set(pending).size!==pending.length) errors.push('duplicate pending');
  for (const p of pending) if (!cores.includes(p) || registered.includes(p) || !previous.includes(p)) errors.push(`pending may only decrease: ${p}`);
  for (const c of cores) if (!registered.includes(c) && !pending.includes(c) && !na[c]?.trim()) errors.push(`condition table missing: ${c}`);
  for (const c of Object.keys(na)) if (!cores.includes(c) || registered.includes(c) || pending.includes(c)) errors.push(`invalid not_applicable: ${c}`);
  return errors;
}
export function validateTable(table, html, cases) {
  const errors=[],dom=new JSDOM(html),d=dom.window.document;
  const names=new Map(cases.map(c=>[c.name,c])),ids=new Set();
  if (!Array.isArray(table.conditions) || !table.conditions.length) errors.push('empty condition table');
  for (const c of table.conditions || []) {
    if (!c.id || ids.has(c.id)) errors.push('missing/duplicate condition ID');ids.add(c.id);
    if (!c.statute || !['input','fixed','out_of_scope'].includes(c.disposition)) errors.push(`${c.id}: statute/disposition missing`);
    if (!Array.isArray(c.cases) || c.cases.length<(c.disposition==='input'?2:1)) errors.push(`${c.id}: insufficient cases`);
    for (const name of c.cases || []) if (!names.has(name)) errors.push(`${c.id}: unknown case ${name}`);
    if (c.disposition==='input') {
      if (!c.input_ids?.length) errors.push(`${c.id}: input missing`);
      for (const id of c.input_ids || []) if (d.querySelectorAll(`[id="${id}"]`).length!==1 || !d.getElementById(id).matches('input,select,textarea')) errors.push(`${c.id}: input not unique ${id}`);
    } else {
      const els=d.querySelectorAll(c.scope_selector || `[data-scope-note="${c.id}"]`);
      const e=els[0];const norm=s=>s.normalize('NFKC').replace(/\s+/g,'');
      if (els.length!==1 || !c.scope_text || !e?.textContent.trim() || norm(e.textContent)!==norm(c.scope_text) || e.closest('[hidden],[aria-hidden="true"]') || [...(function*(){for(let p=e;p;p=p.parentElement)yield p;})()].some(p=>/display\s*:\s*none|visibility\s*:\s*hidden/.test(p.getAttribute('style') || ''))) errors.push(`${c.id}: visible, unique exact scope note required`);
    }
    if (c.exclusive_with && !(c.cases || []).some(n=>names.get(n)?.kind==='exclusive')) errors.push(`${c.id}: exclusive normalization case missing`);
    if (c.rounding && !(c.cases || []).some(n=>names.get(n)?.kind==='rounding')) errors.push(`${c.id}: rounding case missing`);
  }
  for (const name of new Set((table.conditions || []).flatMap(c=>c.cases || []).concat(table.default_cases || []))) {
    const c=names.get(name);if (!c) { errors.push(`unknown case ${name}`);continue; }
    if (!/^https:\/\//.test(c.source || '') || !c.quote?.trim()) errors.push(`${name}: source/quote missing`);
    try {assert.deepEqual(c.run(d),c.expected);} catch(e) {errors.push(`${name}: ${e.message}`);}
  }
  if (!table.default_cases?.length) errors.push('HTML default case required');
  dom.window.close();return errors;
}
