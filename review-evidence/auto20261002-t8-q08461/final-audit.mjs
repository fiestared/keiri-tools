import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
import {attachBankPresets} from '../../docs/assets/bank_presets.js';
import {JSDOM} from 'jsdom';
const E='review-evidence/auto20261002-t8-q08461/';
const read=f=>JSON.parse(readFileSync(f,'utf8'));
const ledger=read('claims/column/furikomi-tesuryo-hikaku.json');
const units=segmentClaims(readFileSync(ledger.page,'utf8'),ledger.page);
const cov=validateSegments(units,ledger);
assert.equal(cov.errors.filter(e=>!e.startsWith('unprocessed segment:')).length,0);
assert.deepEqual(new Set(cov.unprocessed_ids),new Set(ledger.out_of_corpus.map(x=>x.id)));
const before=read(E+'segments.json');const adjud=read(E+'segment-adjudication.json').segments;
const origOC=adjud.filter(s=>s.decision==='out_of_corpus').map(s=>before.find(u=>u.id===s.id));
const available=new Map();for(const u of units)available.set(u.text_hash,(available.get(u.text_hash)||0)+1);
for(const u of origOC){assert((available.get(u.text_hash)||0)>0,'OC deleted/rewritten: '+u.id);available.set(u.text_hash,available.get(u.text_hash)-1);}
let quotes=0;
for(const c of ledger.claims.filter(c=>c.id.startsWith('t8q08461-s-')))for(const s of c.sources){
 const ref=s.snapshot_ref||s.corpus_ref;const m=/^(.+):(\d+)-(\d+)$/.exec(ref||'');if(!m)continue;
 const f=m[1].startsWith('corpus/')?E+m[1]:m[1];const text=readFileSync(f,'utf8').split(/\r?\n/).slice(Number(m[2])-1,Number(m[3])).join('\n');assert.equal(s.source_quote,text,ref);quotes++;
}
const data=read('docs/assets/fee_table.json');
const dom=new JSDOM('<select><option value="">手入力</option></select><input id="under"><input id="over"><p></p>',{url:'https://keiri-tools.com/senpou-futan/'});
const d=dom.window.document;const select=d.querySelector('select'),under=d.querySelector('#under'),over=d.querySelector('#over'),note=d.querySelector('p');
await attachBankPresets({select,under,over,note,fetcher:async()=>({ok:true,json:async()=>data}),win:dom.window});
let presets=0;for(const [i,b] of data.banks.entries()){select.value=String(i);select.dispatchEvent(new dom.window.Event('change'));assert.equal(Number(under.value),b.under30k);assert.equal(Number(over.value),b.over30k);if(b.scope_note){assert(note.textContent.includes(b.scope_note),b.name);presets++;}if(b.public_note)assert(note.textContent.includes(b.public_note),b.name);}dom.window.close();
const metrics={...Object.fromEntries(['total','covered','verified','nonclaims','unprocessed'].map(k=>[k,cov[k]])),out_of_corpus:ledger.out_of_corpus.length,repairer_verified:ledger.repairer_verified.length,original_oc_preserved:origOC.length,exact_source_ranges:quotes,presets_checked:data.banks.length,condition_notes_checked:presets};
writeFileSync(E+'final-audit.json',JSON.stringify(metrics,null,2)+'\n');console.log(metrics);
