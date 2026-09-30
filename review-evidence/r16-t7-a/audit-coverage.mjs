import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t7-a';const base='review-evidence/r16-t7-a/';
const read=f=>JSON.parse(fs.readFileSync(f));const old=read(run+'/segments.json'),a=read(run+'/segment-adjudication.json').segments,o=read(run+'/oc-opinion.json').units;
const retained=[],reports=[],all=[];
for(const page of [...new Set(old.map(x=>x.page))]){
 const u=segmentClaims(fs.readFileSync(page,'utf8'),page);all.push(...u);
 const ledger=read('claims/'+page.replace(/^docs\//,'').replace(/\/index.html$/,'.json'));
 const v=validateSegments(u,ledger);assert.deepEqual(v.errors.filter(x=>!x.startsWith('unprocessed segment:')),[]);
 const needed=new Set(ledger.out_of_corpus.map(x=>{assert(x.needed_source);return x.id;}));
 assert.deepEqual(new Set(v.unprocessed_ids),needed,'unprocessed units must all have needed_source');
 const pool=[...u];for(let i=0;i<old.length;i++){
  const original=old[i];if(original.page!==page)continue;
  const keep=a[i].decision==='ok'||a[i].decision==='nonclaim'||(a[i].decision==='out_of_corpus'&&o.find(x=>x.page===page&&x.id===original.id)?.verdict!=='wrong');
  if(!keep)continue;
  const idx=pool.findIndex(x=>x.kind===original.kind&&x.text_hash===original.text_hash);assert(idx>=0,'unchanged unit lost '+(i+1));const matched=pool.splice(idx,1)[0];
  if(a[i].decision==='out_of_corpus')assert(needed.has(matched.id),'OC promoted '+(i+1));
  if(a[i].decision==='ok')assert(ledger.verified.some(x=>x.id===matched.id),'ok not linked '+(i+1));
  retained.push({n:i+1,old_id:original.id,new_id:matched.id,decision:a[i].decision});
 }
 fs.writeFileSync(base+'coverage-after-'+page.replaceAll('/','_')+'.log',execFileSync('node',['tools/check_claims.mjs','--segments',page]));
 reports.push({page,...v,out_of_corpus:needed.size,unclassified:v.unprocessed-needed.size});
}
fs.writeFileSync(base+'segments-after.json',JSON.stringify(all,null,2));fs.writeFileSync(base+'retained-units.json',JSON.stringify(retained,null,2));fs.writeFileSync(base+'coverage-after.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify({total:all.length,covered:reports.reduce((s,x)=>s+x.covered,0),verified:reports.reduce((s,x)=>s+x.verified,0),nonclaims:reports.reduce((s,x)=>s+x.nonclaims,0),out_of_corpus:reports.reduce((s,x)=>s+x.out_of_corpus,0),unprocessed:reports.reduce((s,x)=>s+x.unprocessed,0),retained:retained.length},null,2));
