import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const dir='review-evidence/auto20261001-t8-q1/';
const target=JSON.parse(readFileSync(dir+'original-fix-targets.json'));
const resolutions=[];const coverage={};
for(const slug of ['furikomi-tesuryo-hikaku','zengin-format-guide']) {
 const page=`docs/column/${slug}/index.html`;
 const old=JSON.parse(readFileSync(dir+slug+'-located-before.json'));
 const updated=JSON.parse(readFileSync(dir+slug+'-located-after.json'));
 const units=segmentClaims(readFileSync(page,'utf8'),page);
 assert.deepEqual(units.map(u=>[u.id,u.text_hash]),updated.map(u=>[u.id,u.text_hash]));
 const ledger=JSON.parse(readFileSync(`claims/column/${slug}.json`));
 const c=validateSegments(units,ledger);
 assert.deepEqual(c.errors.filter(e=>!e.startsWith('unprocessed segment:')),[]);
 assert.deepEqual([...c.unprocessed_ids].sort(),ledger.out_of_corpus.map(u=>u.id).sort());
 const originalOC=JSON.parse(readFileSync(dir+'preserved-out-of-corpus.json')).filter(u=>u.page===page);
 assert.equal(originalOC.length,ledger.out_of_corpus.length);
 for(const p of originalOC){assert.equal(units.find(u=>u.id===p.new_id).text_hash,p.text_hash);assert.ok(!ledger.verified.some(v=>v.id===p.new_id));assert.ok(ledger.out_of_corpus.find(v=>v.id===p.new_id)?.needed_source);}
 for(const t of target.filter(t=>t.page===page)) {
  const original=old.find(u=>u.id===t.id), revised=updated.filter(u=>u.locator===original.locator && ledger.repairer_verified.some(v=>v.id===u.id));
  assert(revised.length,t.id);
  assert(revised.every(u=>c.links[u.id]),'uncovered repaired unit '+t.id);
  resolutions.push({...t,new_units:revised.map(u=>({id:u.id,text:u.text})),resolution:'fixed_source_checked_by_repairer'});
 }
 coverage[page]={total:c.total,covered:c.covered,verified:c.verified,repairer_verified:ledger.repairer_verified.length,nonclaims:c.nonclaims,out_of_corpus:ledger.out_of_corpus.length,unprocessed:c.unprocessed};
}
assert.equal(resolutions.length,24);
writeFileSync(dir+'coverage-after.json',JSON.stringify(coverage,null,2)+'\n');
writeFileSync(dir+'resolutions.json',JSON.stringify(resolutions,null,2)+'\n');
console.log(coverage);console.log('24 original fix targets mapped; 230 OC units preserved; invalid mappings 0');
