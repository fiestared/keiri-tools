import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261008/t20-q08387-recheck3/';const dir=new URL('./',import.meta.url),fixes=JSON.parse(readFileSync(run+'fix-kinds.json','utf8')).fixes,oldids=new Set(JSON.parse(readFileSync(run+'segments.json','utf8')).map(s=>s.id)),results=[];
for(const page of [...new Set(fixes.map(x=>x.page))]){
 const current=segmentClaims(readFileSync(page,'utf8'),page),ids=new Set(current.map(s=>s.id));for(const f of fixes.filter(x=>x.page===page)){if(f.old_id!==null)assert(oldids.has(f.old_id),f.old_id);if(f.new_id!==null)assert(ids.has(f.new_id),f.new_id);}
 const lp=page.replace('docs/','claims/').replace('/index.html','.json'),ledger=JSON.parse(readFileSync(lp,'utf8')),coverage=validateSegments(current,ledger);
 writeFileSync(new URL('segments-delivery-'+page.split('/').at(-2)+'.json',dir),JSON.stringify(current,null,2)+'\n');results.push({page,...coverage,out_of_corpus:new Set((ledger.out_of_corpus||[]).filter(x=>ids.has(x.id)).map(x=>x.id)).size});
}
writeFileSync(new URL('delivery-coverage.json',dir),JSON.stringify(results,null,2)+'\n');console.log('✓ fix-kinds '+fixes.length+' records: every old/new ID exists; '+results.length+' pages measured');
