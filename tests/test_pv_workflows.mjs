import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {attachBankPresets} from '../docs/assets/bank_presets.js';
import {attachResultNext} from '../docs/assets/workflow_next.js';
import {buildSections, loadBanks} from '../tools/gen_bank_sections.mjs';
const data=JSON.parse(readFileSync(new URL('../docs/assets/fee_table.json',import.meta.url)));
const ids=['mizuho-eb','mufg-bizstation','smbc-web21-standard'];
assert.equal(new Set(data.banks.filter(b=>b.id).map(b=>b.id)).size,3);
function fixture(id,fetcher=async()=>({ok:true,json:async()=>data})) {
 const dom=new JSDOM('<select><option value="">手入力</option></select><input id="under"><input id="over"><p></p>',{url:'https://keiri-tools.com/senpou-futan/#bank='+id});
 const doc=dom.window.document;
 const args={select:doc.querySelector('select'),under:doc.querySelector('#under'),over:doc.querySelector('#over'),note:doc.querySelector('p'),fetcher,win:dom.window};
 return {dom,...args,ready:attachBankPresets(args)};
}
for(const id of ids){
 const f=fixture(id,async()=>({ok:true,json:async()=>({banks:[...data.banks].reverse()})}));await f.ready;
 const bank=data.banks.find(b=>b.id===id);
 assert.equal(f.under.value,String(bank.under30k));assert.equal(f.over.value,String(bank.over30k));assert.match(f.note.textContent,/選択済み/);
 f.under.value='123';f.under.dispatchEvent(new f.dom.window.Event('input'));
 f.dom.window.location.hash='#bank=mizuho-eb';f.dom.window.dispatchEvent(new f.dom.window.Event('hashchange'));assert.equal(f.under.value,'123');f.dom.window.close();
}
const unknown=fixture('1');await unknown.ready;assert.equal(unknown.select.value,'');assert.equal(unknown.under.value,'');assert.match(unknown.note.textContent,/手入力/);unknown.dom.window.close();
const failed=fixture('mizuho-eb',async()=>({ok:false}));assert.equal(await failed.ready,false);assert.equal(failed.under.disabled,false);failed.dom.window.close();
let resolve;const delayed=fixture('mizuho-eb',()=>new Promise(r=>resolve=r));delayed.under.value='456';delayed.under.dispatchEvent(new delayed.dom.window.Event('input'));resolve({ok:true,json:async()=>data});await delayed.ready;assert.equal(delayed.under.value,'456');delayed.dom.window.close();
const dom=new JSDOM('<div id="result"></div><button id="copy">copy</button><button id="save">save</button><p id="next" hidden></p>');globalThis.MutationObserver=dom.window.MutationObserver;
const d=dom.window.document,r=d.querySelector('#result'),next=d.querySelector('#next'),copy=d.querySelector('#copy'),save=d.querySelector('#save');attachResultNext(r,next);
const tick=()=>new Promise(r=>setTimeout(r,0));
for(const state of ['initial','pending','error','stale','success']){r.dataset.resultState=state;await tick();assert.equal(next.hidden,state!=='success');}
r.dataset.workflowEligible='false';await tick();assert(next.hidden);r.dataset.workflowEligible='true';await tick();assert(!next.hidden);
for(let i=0;i<3;i++){r.innerHTML='new result';r.dataset.resultState='success';await tick();assert.equal(d.querySelector('#copy'),copy);assert.equal(d.querySelector('#save'),save);}
dom.window.close();
const generated=buildSections(loadBanks());for(const id of ids)assert(generated.includes('/senpou-futan/#bank='+id));
console.log('✓ PV workflows: stable IDs/reordering, unknown, failure, delayed edits, conditional results, stable controls, generator');
