import fs from 'node:fs';
import assert from 'node:assert/strict';
import {segmentClaims,validateSegments,normalize} from '../../tools/segment_claims.mjs';
import {ledgerPath} from '../../tools/check_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t1-a/';
const old=JSON.parse(fs.readFileSync(run+'segments.json')),a=JSON.parse(fs.readFileSync(run+'segment-adjudication.json')).segments;
const rows=[],all=[];
for(const page of new Set(old.map(s=>s.page))){
 const units=segmentClaims(fs.readFileSync(page,'utf8'),page),ledger=JSON.parse(fs.readFileSync(ledgerPath(page)));all.push(...units);
 const result=validateSegments(units,ledger);assert.equal(result.errors.filter(e=>!e.startsWith('unprocessed segment:')).length,0);
 const oc=a.filter(s=>s.page===page&&s.decision==='out_of_corpus');
 assert.equal(ledger.unverified.length,oc.length);assert.equal(result.unprocessed,oc.length);
 for(const x of ledger.unverified){assert(x.needed_source);assert(!ledger.verified.some(v=>v.id===x.id));assert(!ledger.claims.some(c=>c.covers?.includes(x.id)));}
 for(const x of oc){const s=old.find(s=>s.id===x.id&&s.page===page);assert(units.some(u=>u.kind===s.kind&&u.text_hash===s.text_hash),'OC changed: '+s.id);}
 rows.push({page,total:units.length,covered:result.covered,verified:result.verified,nonclaims:result.nonclaims,out_of_corpus:oc.length,unprocessed:result.unprocessed,unknown:result.unprocessed-oc.length});
}
assert.equal(rows.reduce((n,r)=>n+r.verified,0),452);assert.equal(rows.reduce((n,r)=>n+r.out_of_corpus,0),376);
fs.writeFileSync('reports/r16-t1-a/final-segments.json',JSON.stringify(all,null,2)+'\n');fs.writeFileSync('reports/r16-t1-a/final-audit.json',JSON.stringify(rows,null,2)+'\n');console.log(rows);
