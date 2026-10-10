import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const dir='review-evidence/auto20261008-t3x-q08381';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261008/t3x-q08381';
const adjudication=JSON.parse(readFileSync(run+'/segment-adjudication.json')).segments;
const pages=[...new Set(adjudication.map(x=>x.page))];
let units=[],stats=[];
for(const page of pages){const current=segmentClaims(readFileSync(page,'utf8'),page);units.push(...current);const ledger=JSON.parse(readFileSync('claims/'+page.replace(/^docs\//,'').replace(/\/index.html$/,'')+'.json'));const c=validateSegments(current,ledger);const oc=new Set(adjudication.filter(x=>x.page===page&&x.decision==='out_of_corpus').map(x=>x.id));const nonOcErrors=c.errors.filter(e=>!e.startsWith('unprocessed segment: ')||!oc.has(e.replace('unprocessed segment: ','')));assert.deepEqual(nonOcErrors,[]);assert(c.unprocessed_ids.every(id=>oc.has(id)));stats.push({page,coverage:c,nonOcErrors});}
const unresolvedUnchanged=adjudication.filter(x=>x.decision==='unresolved'&&units.some(u=>u.page===x.page&&u.id===x.id));const ocChanged=adjudication.filter(x=>x.decision==='out_of_corpus'&&!units.some(u=>u.page===x.page&&u.id===x.id));assert.deepEqual(unresolvedUnchanged,[]);assert.deepEqual(ocChanged,[]);
writeFileSync(dir+'/final-unit-audit.json',JSON.stringify({stats,unresolvedUnchanged,ocChanged},null,2)+'\n');writeFileSync(dir+'/segments-after.json',JSON.stringify(units,null,2)+'\n');
const coverage=JSON.parse(readFileSync(dir+'/coverage-before-after.json'));for(const x of stats){const c=coverage.find(y=>y.page===x.page);c.after=Object.fromEntries(['total','covered','verified','nonclaims','unprocessed'].map(k=>[k,x.coverage[k]]));c.errors=x.nonOcErrors;}
writeFileSync(dir+'/coverage-before-after.json',JSON.stringify(coverage,null,2)+'\n');console.log(stats.map(x=>({page:x.page,...Object.fromEntries(['total','covered','verified','nonclaims','unprocessed'].map(k=>[k,x.coverage[k]]))})));console.log('元unresolved未変更0 / 正本外変更0 / 正本外以外の台帳エラー0');
