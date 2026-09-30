import fs from 'node:fs';
import path from 'node:path';
import {segmentClaims,validateSegments,normalize} from '../../tools/segment_claims.mjs';
import {findNumbers,findAbsolutes,claimText} from '../../tools/check_claims.mjs';
const RUN='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t7-a';
const base='review-evidence/r16-t7-a/';
const read=f=>JSON.parse(fs.readFileSync(f));
const old=read(RUN+'/segments.json'), adjud=read(RUN+'/segment-adjudication.json').segments, oc=read(RUN+'/oc-opinion.json').units;
const sol=fs.readdirSync(RUN+'/out').filter(f=>/^s.*\.json$/.test(f)).flatMap(f=>read(RUN+'/out/'+f).segments);
const edits=read(base+'edits.json');
const basic='www_hellowork_mhlw_go_jp_insurance_insurance_basicbenefit_html.txt',ikuji='www_mhlw_go_jp_content_11600000_001461102_pdf.txt',manual='kunitsuite_bunya_koyou_roudou_koyou_koyouhoken_data_dl_toriatsukai_youryou_d_pdf.txt';
function source(file,from,to=from){
 const local=file.startsWith('extra:')?base+'sources/'+file.slice(6):RUN+'/corpus/'+file;
 const lines=fs.readFileSync(local,'utf8').split('\n');
 let url=file.startsWith('extra:')?'https://laws.e-gov.go.jp/law/'+file.slice(6).split('.')[0]:(lines.slice(0,5).join('\n').match(/https:\/\/[^\s]+/)||[])[0];
 if(file===basic)url='https://www.hellowork.mhlw.go.jp/insurance/insurance_basicbenefit.html';
 if(file===ikuji)url='https://www.mhlw.go.jp/content/11600000/001461102.pdf';
 if(file===manual)url='https://www.mhlw.go.jp/seisakunitsuite/bunya/koyou_roudou/koyou/koyouhoken/data/dl/toriatsukai_youryou_d.pdf';
 return {source_url:url,source_quote:lines.slice(from-1,to).join('\n'),corpus_ref:(file.startsWith('extra:')?local:'corpus/'+file)+':'+from+'-'+to};
}
const srcByN={};function sources(ns,file,from,to){for(const n of ns)srcByN[n]=source(file,from,to);}
sources([9,12,15,16,21,26,80,518,580],'extra:349AC0000000116.txt',1,3);
sources([19],'extra:349AC0000000116.txt',7,7);
sources([134,135],'extra:350CO0000000025.txt',2,2);
sources([209],'extra:211AC0000000070.txt',1,1);
sources([23,73,256,257,264,360,419],basic,156,163);
sources([262,263,265,266,286],'extra:350M50002000003.txt',2,3);
sources([415],basic,156,163);
sources([192],'ko_22.txt',3,3);sources([223],basic,114,134);
sources([834,835,942,943],manual,1048,1077);
sources([905,1147,1149],'ko_13.txt',3,3);sources([913],'ko_22.txt',3,3);
sources([962],'ko_33.txt',3,3);sources([975,995,998,999,1000],basic,35,38);
sources([978,979,980],manual,590,619);sources([984],'ko_17.txt',3,3);
sources([991,1130],'ko_22.txt',3,3);sources([1004],manual,425,439);sources([1009,1011,1032],'ko_16.txt',3,3);
sources([1077],'ko_33.txt',3,3);sources([1100],basic,40,43);sources([1105,1145],basic,59,61);
sources([1108,1113],basic,23,24);sources([1117],basic,95,99);sources([1118,1119],basic,104,110);
sources([858,862,863,869,887,1152,1154,1158,1159,1160,1167,1186,1194,1195,1199,1271,1280,1289],ikuji,191,212);
sources([861,1157],ikuji,148,154);sources([882,885,1178,1181,1184],ikuji,1115,1129);
sources([888],ikuji,1082,1098);sources([1175],ikuji,155,181);
sources([1222,1223,1225,1286,1288],ikuji,1368,1372);sources([1226],ikuji,376,400);
// Additional source acquired for OC wrong #1134 (not part of frozen corpus).
const extra1134={source_url:'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000160564_00045.html',source_quote:'退職日から遡って５年間のうちに２回以上正当な理由なく自己都合退職し受給資格決定を受けた場合、給付制限は３か月となります。',corpus_ref:base+'sources/restriction.html'};srcByN[1134]=extra1134;
const low=new Set([144,350,472,473,474,475,476,1150]);
const reports=[],unmapped=[];
for(const page of [...new Set(old.map(x=>x.page))]){
 const file='claims/'+page.replace(/^docs\//,'').replace(/\/index.html$/,'.json');const l=read(file),html=fs.readFileSync(page,'utf8'),units=segmentClaims(html,page);
 // Retain legacy claim IDs and legal evidence; replace coverage mappings with the current snapshot.
 l.checked='2026-10-01';l.claims=l.claims.filter(c=>!c.id.startsWith('r16-'));for(const c of l.claims)c.covers=[];
 l.nonclaims=[];l.verified=[];l.out_of_corpus=[];l.unreviewed=[];
 const prior=old.map((u,i)=>({...u,n:i+1,a:adjud[i]})).filter(x=>x.page===page);
 const used=new Set();
 for(const u of units){
  const same=prior.find(x=>!used.has(x.n)&&x.kind===u.kind&&x.text_hash===u.text_hash);
  if(same)used.add(same.n);
  const a=same?.a;
  if(a?.decision==='nonclaim'||low.has(same?.n)){
   if(u.protected)throw Error('nonclaim still protected '+same.n);
   l.nonclaims.push({id:u.id,why:a.reason});continue;
  }
  if(a?.decision==='out_of_corpus'){
   l.out_of_corpus.push({id:u.id,text_hash:u.text_hash,result:'unconfirmed',needed_source:a.needed_source,review_ref:'r16/t7-a/segment-adjudication.json#'+same.id});continue;
  }
  if(a?.decision==='ok'){
   const original=sol.find(s=>s.page===page&&s.id===same.id);
   const ref=original?.corpus_ref;
   if(!ref)throw Error('missing source '+same.n);
   const m=ref.match(/(?:corpus\/)?([^:;]+):(\d+)-(\d+)/);
   const src=source(m[1],+m[2],+m[3]);
   l.claims.push({id:'r16-ok-'+same.n,text:u.text,where:[u.kind,u.zone],numbers:[...findNumbers(u.text)],applies:'固定正本により2026-10-01審査。改定額は令和8年8月1日以後。',...src,source_quote:original.corpus_quote,exceptions:a.reason,covers:[u.id],topic:['雇用保険']});
   l.verified.push({id:u.id,text_hash:u.text_hash,result:'ok',review_ref:'r16/t7-a/segment-adjudication.json#'+same.id});continue;
  }
  const candidates=edits.filter(e=>e.page===page && (normalize(u.text).includes(normalize(e.new)) || (normalize(u.text).length>10&&normalize(e.new).includes(normalize(u.text)))));
  const e=candidates.find(e=>srcByN[e.n]);
  if(e){
   const id='r16-fix-'+e.n;let c=l.claims.find(x=>x.id===id);
   if(!c){c={id,text:e.new,where:[],numbers:[],applies:'2026-10-01。令和8年8月改定後。',...srcByN[e.n],exceptions:'r16審査の条件・例外を修正文に明示。'+adjud[e.n-1].reason,covers:[],topic:['雇用保険'],review_ref:'r16/t7-a 修正者による再照合（独立再審査は未実施）'};l.claims.push(c);}
   c.covers.push(u.id);c.where.push(u.kind+':'+u.id);c.numbers=[...new Set([...c.numbers,...findNumbers(u.text)])];continue;
  }
  // New controls are product behaviour and are verified by core/UI cases, never promote OC legal claims.
  if(['otherEligibleDays','shienPaidDays','wageBasis','workDays6m'].includes(u.element_id)||/同じ対象期間の通常の育休の給付対象日数|今回の産後パパ育休とは重複|同じ子の出生後休業支援給付金|13%の上限28日から|賃金の決め方|月給制 \[|日給・時間給・出来高払等 \[|混在（対象外）|算定する6か月の実労働日数|実労働日数×70%/.test(u.text)){
   const src=page.includes('papa-ikukyu')?source(ikuji,191,212):source('ko_17.txt',3,3);
   l.claims.push({id:'r16-ui-'+u.id,text:u.text,where:[u.kind],numbers:[...findNumbers(u.text)],applies:'2026-10-01',...src,exceptions:'今回の入力機能。tests/boundaries と tests/test_papa_ikukyu.mjs、test_kihonteate.mjsで検証。通算は資格判定用、金額は今回分のみ。',covers:[u.id],topic:['雇用保険']});continue;
  }
  unmapped.push({...u,old_n:same?.n});l.unreviewed.push({id:u.id,needed_source:'修正後の構造変化・追記を再照合する'});
 }
 l.absolutes=[...l.absolutes,...findAbsolutes(claimText(html)).filter(a=>!l.absolutes.some(x=>x.context===a.context)).map(a=>({phrase:a.phrase,context:a.context,reviewed:'r16: 変更した主張の例外は該当r16-fix主張と本文に記載。既存正本外の未確認判定はout_of_corpusに維持。'}))];
 fs.writeFileSync(file,JSON.stringify(l,null,2)+'\n');reports.push({page,...validateSegments(units,l),out_of_corpus:l.out_of_corpus.length});
}
fs.writeFileSync(base+'coverage-after.json',JSON.stringify(reports,null,2));fs.writeFileSync(base+'unmapped.json',JSON.stringify(unmapped,null,2));
console.log(reports.map(({page,total,covered,verified,nonclaims,unprocessed,out_of_corpus})=>({page,total,covered,verified,nonclaims,unprocessed,out_of_corpus})));console.log('unmapped',unmapped.length);
