import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {addedClaimText,findAbsolutes} from '../../tools/check_claims.mjs';
const base='review-evidence/r16-t7-a/';
const read=f=>JSON.parse(fs.readFileSync(f));
const edits=read(base+'edits.json');
for(const page of [...new Set(edits.map(e=>e.page))]){
 const file='claims/'+page.replace(/^docs\//,'').replace(/\/index.html$/,'.json'),l=read(file);
 const add=(id,text,numbers,url,quote,ref,status)=>l.claims.push({id:'r16-evidence-'+id,text,numbers,where:['既存段落内の表記（正本外単位はout_of_corpusに残す）'],applies:'2026-10-01。額は令和8年8月以後、条文の原型額は現在額ではない。',source_url:url,source_quote:quote,corpus_ref:ref,exceptions:'固定正本外の既存単位は未確認のまま。追加一次資料の記録だけで独立審査okにはしない。',verification_status:status||'supplementary_source_only',covers:[]});
 if(page==='docs/column/koyou-hoken-kanyu-joken/index.html')add('deadline-examples','4月1日・4月28日の取得は翌月5月10日。期限の算数例。',['4月1日','4月28日','5月10日'],'https://laws.e-gov.go.jp/law/350M50002000003','当該事実のあつた日の属する月の翌月十日までに',base+'sources/350M50002000003.txt:2');
 if(page==='docs/kihonteate/index.html'){
  add('current-table','既存の逓減帯・下限表記の追加資料。固定正本外の単位判定は変更しない。',['令和8年8月1日','3,203円','5,480円'],'https://www.mhlw.go.jp/content/001726936.pdf',fs.readFileSync(base+'sources/001726936.txt','utf8').slice(0,550),base+'sources/001726936.txt','out_of_corpus');
  add('restriction-date','自己都合の給付制限原則1か月の適用日。',['2025年4月1日'],'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000160564_00045.html','退職日が令和７年４月１日以降である場合は原則１か月',base+'sources/restriction.html','out_of_corpus');
  add('law19','法19条の原型控除額1282円は現在の実額ではない。',['1,282円'],'https://laws.e-gov.go.jp/law/349AC0000000116',fs.readFileSync(base+'sources/ko_19.txt','utf8'),base+'sources/ko_19.txt','out_of_corpus');
  add('law15','失業認定の4週間・28日。',['4週間','28日'],'https://laws.e-gov.go.jp/law/349AC0000000116',fs.readFileSync(base+'sources/ko_15.txt','utf8'),base+'sources/ko_15.txt','out_of_corpus');
 }
 const diff=execFileSync('git',['diff','-U0','origin/main','--',page],{encoding:'utf8'});
 const required=addedClaimText(fs.readFileSync(page,'utf8'),diff);
 for(const a of findAbsolutes(required))if(!l.absolutes.some(x=>x.context===a.context))l.absolutes.push({phrase:a.phrase,context:a.context,reviewed:a.phrase==='必ず'?'収入申告は法19条3項で確認。元の正本外判定とneeded_sourceは維持。':'修正した原則の例外はr16-fixのsource_quoteと本文に明示。差分行だけの文脈にも対応付ける。'});
 const frozenRun='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t7-a';
 const originalSegments=read(frozenRun+'/segments.json');
 const originalSol=fs.readdirSync(frozenRun+'/out').filter(f=>/^s.*\.json$/.test(f)).flatMap(f=>read(frozenRun+'/out/'+f).segments);
 for(const c of l.claims.filter(c=>c.id.startsWith('r16-ok-'))){const n=Number(c.id.slice(7));const old=originalSegments[n-1];const result=originalSol.find(x=>x.page===page&&x.id===old.id);c.corpus_ref=result.corpus_ref;}
 // Legacy summaries must not continue to describe the corrected text as unconditional.
 for(const c of l.claims.filter(c=>!c.id.startsWith('r16-')))for(const e of edits.filter(e=>e.page===page&&e.n!==73)){if(typeof c.text==='string')c.text=c.text.split(e.old).join(e.new);}
 // Supplement each correction with the exact sources needed for the compound assertions.
 const supplement={
  'r16-fix-1194':['www_mhlw_go_jp_content_11600000_001461102_pdf.txt',360,408],
  'r16-fix-1271':['www_mhlw_go_jp_content_11600000_001461102_pdf.txt',130,138],
  'r16-fix-991':['ko_23.txt',3,3], 'r16-fix-1130':['ko_23.txt',3,3],
  'r16-fix-1225':['www_mhlw_go_jp_content_11600000_001461102_pdf.txt',376,400]
 };
 for(const c of l.claims)if(supplement[c.id]){const [f,a,b]=supplement[c.id];const quote=fs.readFileSync('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t7-a/corpus/'+f,'utf8').split('\n').slice(a-1,b).join('\n');c.supporting_sources=[{corpus_ref:'corpus/'+f+':'+a+'-'+b,quote}];}
 fs.writeFileSync(file,JSON.stringify(l,null,2)+'\n');
}
