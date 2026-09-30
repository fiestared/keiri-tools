import fs from 'node:fs';
import {segmentClaims,normalize,validateSegments} from '../../tools/segment_claims.mjs';
import {findNumbers,ledgerPath} from '../../tools/check_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t1-a/';
const old=JSON.parse(fs.readFileSync(run+'segments.json'));
const adjud=JSON.parse(fs.readFileSync(run+'segment-adjudication.json')).segments;
const replacements=JSON.parse(fs.readFileSync('reports/r16-t1-a/replacements.json'));
const urls=Object.fromEntries(fs.readFileSync(run+'corpus_desc.md','utf8').trim().split('\n').map(l=>l.match(/corpus\/(.*?): (https:.*)/).slice(1)));
const review='review-loop/r16/t1-a/segment-adjudication.json';
const counts=[],unmatched=[];
for(const page of new Set(old.map(s=>s.page))){
 const units=segmentClaims(fs.readFileSync(page,'utf8'),page);
 const file=ledgerPath(page);const ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {page,claims:[],absolutes:[],tool_cases:[]};
 ledger.claims=ledger.claims.filter(c=>!c.id.startsWith('r16-'));for(const c of ledger.claims)c.covers=[];
 ledger.nonclaims=[];ledger.verified=[];ledger.unverified=[];ledger.checked='2026-09-30';
 ledger.scope='r16-t1-a。元審査okはverified、修正文は修正担当による照合としてcoversに登録。正本外はunverifiedに残し、独立再審査済みとはしない。';
 const claimed=new Set();
 function addClaim(u,a,id,verified){
  const refs=[...a.reason.matchAll(/corpus\/([\w/]+\.txt):(\d+)(?:-(\d+))?/g)];
  if(!refs.length)throw Error('no source '+a.id);
  const sources=refs.map(m=>({file:m[1],start:+m[2],end:+(m[3]||m[2])}));
  const r=sources[0],lines=fs.readFileSync(run+'corpus/'+r.file,'utf8').split('\n');
  const quote=lines.slice(r.start-1,Math.min(r.end,r.start+12)).join('\n');
  ledger.claims.push({id,text:u.text,where:[u.kind,u.zone],numbers:[...findNumbers(u.text)],applies:'令和8年分を基本とし、本文の令和8年11月以前・12月以後・令和9年月次の区別に従う。',source_url:urls[r.file],source_quote:quote,exceptions:a.reason,covers:[u.id],corpus_ref:sources.map(r=>'corpus/'+r.file+':'+r.start+'-'+r.end).join('; '),review_status:verified?'independently_reviewed':'corrected_self_review',original_segment:a.id});
  if(verified)ledger.verified.push({id:u.id,text_hash:u.text_hash,result:'ok',review_ref:review+'#'+a.id});
  claimed.add(u.id);
 }
 for(let i=0;i<old.length;i++){
  const s=old[i],a=adjud[i];if(s.page!==page||a.decision==='unresolved')continue;
  // Preserve duplicate occurrence order, including IDs shifted by the removal of another identical token.
  const renamed={'s-eddc367778209becda3e-1':'年末調整で確認・計算','s-a59e653983d2b03c68b4-1':'するもの'};
  const u=units.find(u=>u.kind===s.kind&&(u.text_hash===s.text_hash||u.text===renamed[s.id])&&!claimed.has(u.id));
  if(!u){unmatched.push({index:i+1,...s,decision:a.decision});continue;}
  if(a.decision==='ok')addClaim(u,a,'r16-ok-'+(i+1),true);
  else if(a.decision==='nonclaim'){ledger.nonclaims.push({id:u.id,why:a.reason});claimed.add(u.id);}
  else {ledger.unverified.push({id:u.id,text_hash:u.text_hash,result:'out_of_corpus',needed_source:a.needed_source,reason:a.reason,review_ref:review+'#'+s.id});claimed.add(u.id);}
 }
 for(let i=0;i<old.length;i++){
  const s=old[i],a=adjud[i];if(s.page!==page||a.decision!=='unresolved')continue;
  const text=normalize(replacements[i+1]);
  for(const u of units){if(claimed.has(u.id)||u.kind!==s.kind||!text.includes(normalize(u.text)))continue;addClaim(u,a,'r16-fixed-'+(i+1)+'-'+units.indexOf(u),false);}
 }
 const remaining=units.filter(u=>!claimed.has(u.id));
 fs.mkdirSync(file.slice(0,file.lastIndexOf('/')),{recursive:true});fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
 const v=validateSegments(units,ledger);counts.push({page,...v,unverified:ledger.unverified.length,remaining});
}
fs.writeFileSync('reports/r16-t1-a/coverage-after.json',JSON.stringify(counts,null,2)+'\n');
fs.writeFileSync('reports/r16-t1-a/unmatched.json',JSON.stringify(unmatched,null,2)+'\n');
console.log(counts.map(({page,total,covered,verified,nonclaims,unprocessed,unverified,remaining})=>({page,total,covered,verified,nonclaims,unprocessed,unverified,remaining:remaining.length})));console.log('unmatched unchanged',unmatched.length);
