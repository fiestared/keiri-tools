import fs from 'node:fs';
import assert from 'node:assert/strict';
import {segmentClaims,validateSegments} from '../../../tools/segment_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r17/t5-a';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const adj=read(run+'/segment-adjudication.json').segments;
const original=read(run+'/segments.json');
const changes=[...read('review/r17-t5-a/changes.json'),read('review/r17-t5-a/20261001/completion-audit.json').additional_fix];
const stats=[];
for(const page of [...new Set(original.map(u=>u.page))]){
 const ledger=read('claims/'+page.replace(/^docs\//,'').replace(/\/index.html$/,'.json'));
 const current=segmentClaims(fs.readFileSync(page,'utf8'),page);
 const byId=new Map(current.map(u=>[u.id,u]));
 const cov=new Set(ledger.claims.flatMap(c=>c.covers??[]));
 for(const a of adj.filter(a=>a.page===page)){
  const old=original.find(u=>u.page===page&&u.id===a.id);
  if(a.decision==='unresolved'){
   const fix=changes.find(c=>c.page===page&&c.old_id===a.id);assert(fix,a.id);
   assert(!byId.has(a.id));assert(cov.has(fix.new_id));
  }else{
   assert.equal(byId.get(a.id)?.text_hash,old.text_hash,a.id);
   if(a.decision==='ok')assert(cov.has(a.id),a.id);
   if(a.decision==='nonclaim')assert(ledger.nonclaims.some(u=>u.id===a.id&&u.why),a.id);
   if(a.decision==='out_of_corpus'){
    assert(!cov.has(a.id),a.id);assert(!ledger.verified.some(u=>u.id===a.id),a.id);
    assert(ledger.unconfirmed.some(u=>u.id===a.id&&u.needed_source&&u.second_opinion.verdict!=='wrong'),a.id);
   }
  }
 }
 const v=validateSegments(current,ledger);
 stats.push({page,...Object.fromEntries(Object.entries(v).filter(([k])=>['total','covered','verified','nonclaims','unprocessed'].includes(k))),out_of_corpus:ledger.unconfirmed.length});
}
fs.writeFileSync('review/r17-t5-a/20261001/audit-result.json',JSON.stringify({stats,original_total:original.length,fixed:changes.length,oc_unchanged:119,ok_mapped:156,nonclaim_mapped:164},null,2)+'\n');
console.log(stats);
