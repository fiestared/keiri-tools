import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {segmentClaims,normalize,validateSegments} from '../../tools/segment_claims.mjs';
import {findNumbers,ledgerPath} from '../../tools/check_claims.mjs';
import {readdirSync} from 'node:fs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t6-a';
const evidence='review-evidence/r16-t6-a';
const old=JSON.parse(readFileSync(run+'/segments.json'));const adjud=JSON.parse(readFileSync(run+'/segment-adjudication.json')).segments;
const sol=readdirSync(run+'/out').filter(x=>/^s.*\.json$/.test(x)).flatMap(x=>JSON.parse(readFileSync(run+'/out/'+x)).segments);
const edits=JSON.parse(readFileSync(evidence+'/edits.json'));
const amap=new Map(adjud.map(x=>[x.page+':'+x.id,x]));const smap=new Map(sol.map(x=>[x.page+':'+x.id,x]));
mkdirSync(evidence+'/corpus',{recursive:true});for(const f of readdirSync(run+'/corpus'))copyFileSync(run+'/corpus/'+f,evidence+'/corpus/'+f);
for(const f of ['segments.json','segment-adjudication.json','oc-opinion.json','corpus_desc.md'])copyFileSync(run+'/'+f,evidence+'/'+f);
const srcCache=new Map();
function source(ref){
 const m=ref?.match(/(?:corpus\/)?([^/:]+\.txt):(\d+)-(\d+)/);if(!m)throw Error('bad ref '+ref);
 const text=readFileSync(evidence+'/corpus/'+m[1],'utf8'),lines=text.split('\n');
 const quote=lines.slice(+m[2]-1,+m[3]).join('\n');const url=text.match(/https:\/\/\S+/)[0];return {source_url:url,source_quote:quote,corpus_ref:evidence+'/corpus/'+m[1]+':'+m[2]+'-'+m[3]};
}
function editedSource(e){
 const i=e.index;
 if(i==='oc'){
  if(e.before.includes('1割'))return {source_url:'https://laws.e-gov.go.jp/law/357AC0000000080',source_quote:readFileSync(evidence+'/elder-67.txt','utf8'),corpus_ref:evidence+'/elder-67.txt'};
  if(e.before.includes('給与明細'))return {source_url:'https://laws.e-gov.go.jp/law/211AC0000000070',source_quote:[41,42,43].map(n=>readFileSync(evidence+'/hk-'+n+'.txt','utf8')).join('\n'),corpus_ref:evidence+'/hk-41.txt, hk-42.txt, hk-43.txt'};
  return source('hkr_42.txt:3-3');
 }
 if([29,30].includes(i))return {source_url:'https://www.kyoukaikenpo.or.jp/benefit/high_cost_medical_expenses/002/',source_quote:'低所得者Ⅱ※3 / rowspan="2" / 8,000円 / 24,600円 / 低所得者Ⅰ※4 / 15,000円',corpus_ref:evidence+'/kk.html',source_note:'旧表のHTMLセル結合を確認。引用欄はセル位置の抜粋記録。'};
 if(i>=63||[40,41,42,43,46].includes(i))return source('kk_benefit_injury_and_sickness_allowance.txt:15-57');
 if([44,45].includes(i))return source('hk_108.txt:3-3');
 if([11,12,13,14,34].includes(i))return source('kk_benefit_high_cost_medical_expenses_001.txt:4-83');
 return source('kk_benefit_high_cost_medical_expenses_002.txt:19-212');
}
const unchanged=JSON.parse(readFileSync(evidence+'/unchanged-map.json'));
const report=[];const snapshots=[];
for(const page of [...new Set(old.map(x=>x.page))]){
 const path=ledgerPath(page);let ledger;try{ledger=JSON.parse(readFileSync(path))}catch{ledger={page,claims:[],absolutes:[],tool_cases:[]}};
 const units=segmentClaims(readFileSync(page,'utf8'),page); snapshots.push(...units);
 const current=new Set(units.map(x=>x.id));ledger.claims=ledger.claims.filter(c=>!c.id.startsWith('r16-'));
 for(const c of ledger.claims){if(c.covers)c.covers=c.covers.filter(id=>current.has(id));}
 ledger.nonclaims=[];ledger.verified=[];ledger.unverified=[];ledger.checked='2026-10-01';
 for(const u of units){
  const oldId=unchanged[page+':'+u.id];
  let a=oldId?amap.get(page+':'+oldId):null,s=oldId?smap.get(page+':'+oldId):null;
  let edit=!oldId && edits.find(e=>e.page===page&&normalize(e.after).includes(normalize(u.text).replace(/\[value=.*$/,'')));
  if(edit){const src=editedSource(edit);ledger.claims.push({id:'r16-fixed-'+u.id,text:u.text,where:[u.kind+' '+u.id],numbers:[...findNumbers(u.text)],applies:'本文の診療月・支給開始日・年齢・所得条件に限る。2026-10-01修正照合。',...src,exceptions:'年齢・期間・非課税除外・支給開始月などを修正文に明記。固定正本外の追加資料はcorpus_refで区別。',covers:[u.id],topic:[page.includes('shobyo')?'傷病手当金':'高額療養費'],review_ref:evidence+'/edits.json',verification:'author_rechecked'});continue;}
  if(a?.decision==='ok'){
   let ref=s?.corpus_ref; const m=a.reason.match(/corpus\/[^\s。]+\.txt:\d+-\d+/);if(m)ref=m[0];
   const src=source(ref);ledger.claims.push({id:'r16-ok-'+u.id,text:u.text,where:[u.kind+' '+u.id],numbers:[...findNumbers(u.text)],applies:'審査対象文の期間・年齢・前後の設例条件の範囲。',...src,exceptions:a.reason,covers:[u.id],topic:[page.includes('shobyo')?'傷病手当金':'高額療養費']});
   ledger.verified.push({id:u.id,text_hash:u.text_hash,result:'ok',review_ref:evidence+'/segment-adjudication.json#'+a.id});
  }else if(a?.decision==='nonclaim'){ledger.nonclaims.push({id:u.id,why:a.reason});}
  else {ledger.unverified.push({id:u.id,text_hash:u.text_hash,result:a?.decision==='out_of_corpus'?'out_of_corpus':'unprocessed',needed_source:a?.needed_source||a?.reason||'修正文の追加照合が必要',review_ref:evidence+'/segment-adjudication.json'});}
 }
 mkdirSync(path.split('/').slice(0,-1).join('/'),{recursive:true});writeFileSync(path,JSON.stringify(ledger,null,2)+'\n');const c=validateSegments(units,ledger);report.push({page,...c});
}
writeFileSync(evidence+'/segments-after.json',JSON.stringify(snapshots,null,2)+'\n');writeFileSync(evidence+'/coverage-after.json',JSON.stringify(report,null,2)+'\n');
console.log(report.map(({page,total,covered,verified,nonclaims,unprocessed})=>({page,total,covered,verified,nonclaims,unprocessed})));
