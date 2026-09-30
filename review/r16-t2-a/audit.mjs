import fs from 'node:fs';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {segmentClaims} from '../../tools/segment_claims.mjs';
const base='review/r16-t2-a/',old=JSON.parse(fs.readFileSync(base+'segments.json')),adj=JSON.parse(fs.readFileSync(base+'segment-adjudication.json')).segments,edits=JSON.parse(fs.readFileSync(base+'edits.json')),mapping=JSON.parse(fs.readFileSync(base+'fix-mapping.json'));
let retained=0;
for(const e of edits)assert(mapping.some(m=>m.ordinal===e.ordinal),'edit absent '+e.ordinal);
for(const page of new Set(old.map(x=>x.page))){const slug=page.split('/')[2],units=segmentClaims(fs.readFileSync(base+'candidate-'+slug+'.html','utf8'),page);
const pool=new Map();for(const u of units){const k=u.kind+':'+u.text_hash;pool.set(k,(pool.get(k)||0)+1);}
for(const[u,i]of old.map((u,i)=>[u,i]).filter(([u,i])=>u.page===page&&adj[i].decision==='out_of_corpus'&&!edits.some(e=>e.page===page&&e.id===u.id))){const k=u.kind+':'+u.text_hash;assert(pool.get(k)>0,'OC altered '+(i+1));pool.set(k,pool.get(k)-1);retained++;}
const doc=new JSDOM(fs.readFileSync(base+'candidate-'+slug+'.html','utf8')).window.document;
for(const el of doc.querySelectorAll('.faq-answer [aria-hidden="true"].faq-existing-marker'))assert.equal(el.textContent,'A. ');
for(const script of doc.querySelectorAll('script[type="application/ld+json"]')){const data=JSON.parse(script.textContent),faq=data['@type']==='FAQPage'?data:(data['@graph']||[]).find(x=>x['@type']==='FAQPage');if(faq)assert.deepEqual(faq.mainEntity.map(x=>x.acceptedAnswer.text),[...doc.querySelectorAll('.faq-answer')].map(x=>x.textContent.trim()));}
}
assert.equal(retained,479);const result={edits_mapped:edits.length,retained_out_of_corpus:retained,faq_jsonld_matches:true};fs.writeFileSync(base+'invariants.json',JSON.stringify(result,null,2)+'\n');console.log(result);
