import fs from 'node:fs';import assert from 'node:assert/strict';import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';import {ledgerPath} from '../../tools/check_claims.mjs';
const E='review-evidence/r17-t9-a/',R='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r17/t9-a/';
const before=JSON.parse(fs.readFileSync(R+'segments.json')),a=JSON.parse(fs.readFileSync(R+'segment-adjudication.json')).segments,o=JSON.parse(fs.readFileSync(R+'oc-opinion.json')).units;
const summary=[],all=[];
for(const page of [...new Set(before.map(x=>x.page))]){
 const units=segmentClaims(fs.readFileSync(page,'utf8'),page),ledger=JSON.parse(fs.readFileSync(ledgerPath(page))),cov=validateSegments(units,ledger);all.push(...units);
 const pending=new Set(ledger.out_of_corpus.map(x=>x.id));assert.equal(pending.size,ledger.out_of_corpus.length);assert.ok(ledger.out_of_corpus.every(x=>x.needed_source?.trim()));
 assert.deepEqual(new Set(cov.unprocessed_ids),pending);assert.equal(cov.errors.filter(x=>!x.startsWith('unprocessed segment:')).length,0);
 for(const r of a.filter(x=>x.page===page)){
  const old=before.find(x=>x.page===page&&x.id===r.id);const fresh=units.find(x=>x.id===r.id);const opinion=o.find(x=>x.page===page&&x.id===r.id);
  if(r.decision==='unresolved'||opinion?.verdict==='wrong'){assert.equal(fresh,undefined);continue;}
  assert.equal(fresh.text_hash,old.text_hash);
  if(r.decision==='ok')assert.ok(cov.links[r.id]&&ledger.verified.some(x=>x.id===r.id));
  if(r.decision==='nonclaim')assert.ok(ledger.nonclaims.some(x=>x.id===r.id));
  if(r.decision==='out_of_corpus')assert.ok(pending.has(r.id)&&!cov.links[r.id]&&!ledger.verified.some(x=>x.id===r.id));
 }
 summary.push({page,total:cov.total,covered:cov.covered,verified:cov.verified,nonclaims:cov.nonclaims,unprocessed:cov.unprocessed,out_of_corpus:pending.size,unclassified:cov.unprocessed_ids.filter(id=>!pending.has(id)).length});
}
fs.writeFileSync(E+'coverage-after.json',JSON.stringify(summary,null,2)+'\n');fs.writeFileSync(E+'segments-after.json',JSON.stringify(all,null,2)+'\n');console.log(summary);console.log('全ok/nonclaim対応、全unresolved旧ID消滅、not_wrong/unsure79単位不変、未分類0を確認。');
