import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {segmentClaims,normalize,validateSegments} from '../../tools/segment_claims.mjs';
import {findNumbers,claimText,findAbsolutes,ledgerPath} from '../../tools/check_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r15/t7-a';
const original=JSON.parse(readFileSync(run+'/segments.json'));
const adj=JSON.parse(readFileSync(run+'/segment-adjudication.json')).segments;
const decisions=new Map(adj.map(x=>[x.page+'|'+x.id,x]));
const sol=new Map(readdirSync(run+'/out').filter(f=>/^s.*json$/.test(f)).flatMap(f=>JSON.parse(readFileSync(run+'/out/'+f)).segments).map(x=>[x.page+'|'+x.id,x]));
const changes=JSON.parse(readFileSync('reports/r15-t7-a/changes.json'));
const all=[],summaries=[];
function source(reason){
 const refs=[...reason.matchAll(/corpus\/([^:; ]+\.txt):(\d+)(?:-(\d+))?/g)];
 if(!refs.length)throw Error('missing source '+reason);
 const quotes=refs.map(([,f,lo,hi])=>readFileSync(run+'/corpus/'+f,'utf8').split('\n').slice(Number(lo)-1,Number(hi||lo)).join('\n'));
 const first=refs[0][1],body=readFileSync(run+'/corpus/'+first,'utf8');
 let url=body.match(/https:\/\/[^\s]+/)?.[0];
 if(!url&&first.includes('hellowork'))url='https://www.hellowork.mhlw.go.jp/insurance/'+first.match(/insurance_(.+)_html/)[1]+'.html';
 if(!url&&first.includes('001728499'))url='https://www.mhlw.go.jp/content/001728499.pdf';
 if(!url)throw Error(first);
 return {source_url:url,source_quote:quotes.join('\n\n'),corpus_ref:refs.map(m=>m[0]).join(';')};
}
for(const page of [...new Set(original.map(x=>x.page))]){
 const html=readFileSync(page,'utf8'),units=segmentClaims(html,page),lp=ledgerPath(page),l=JSON.parse(readFileSync(lp));
 // Existing historical claims remain, but old unit mappings must not masquerade as current verification.
 l.claims=l.claims.filter(c=>!c.id.startsWith('r15-'));for(const c of l.claims){c.covers=[];c.review_status='legacy_not_revalidated';c.review_note='既存台帳の歴史記録。今回の確認単位の採否はr15のcovers・verified・unconfirmedを参照。';}
 l.nonclaims=[];l.verified=[];l.unconfirmed=[];l.checked='2026-09-30';
 const originalPage=original.filter(x=>x.page===page);
 for(const u of units){
  let old=originalPage.find(x=>x.id===u.id&&x.text_hash===u.text_hash)||originalPage.find(x=>x.kind===u.kind&&x.text_hash===u.text_hash);
  let a=old&&decisions.get(page+'|'+old.id);let reason=a?.reason;let result=a?.decision;
  if(!old){
   const ch=changes.find(c=>c.page===page&&(normalize(c.new).includes(normalize(u.text))||normalize(u.text).includes(normalize(c.new))));
   if(ch){reason=decisions.get(page+'|'+ch.old_id).reason;result='corrected';}
  }
  if(!old && result!== 'corrected') {
   let ref;
   if(['60歳到達日等の判定日はいつか','加入5年未満なら5年到達日で区分'].includes(u.text)) ref='corpus/www_hellowork_mhlw_go_jp_insurance_insurance_continue_html.txt:32-41';
   if(u.text.startsWith('計算の土台は、原則として同一の子'))ref='corpus/www_mhlw_go_jp_content_11600000_001461102_pdf.txt:1327-1337';
   if(u.text.startsWith('実子を出産した配偶者'))ref='corpus/www_mhlw_go_jp_content_11600000_001461102_pdf.txt:203-212';
   if(ref){result='corrected';reason=ref+'。修正文を正本と局所照合。新snapshotの独立審査は未実施。';}
  }
  if(result==='nonclaim'){l.nonclaims.push({id:u.id,why:reason});}
  else if(result==='ok'||result==='corrected'){
   const src=source(reason);const id='r15-'+u.id;
   l.claims.push({id,text:u.text,where:[u.kind+' / '+u.zone],numbers:[...findNumbers(u.text)],applies:'固定正本により2026-09-30確認。改定額は本文に明示した期間。',...src,exceptions:reason,covers:[u.id],topic:['雇用保険'],review_status:result});
   if(result==='ok')l.verified.push({id:u.id,text_hash:u.text_hash,result:'ok',review_ref:'r15/t7-a/segment-adjudication.json#'+old.id});
  }else{
   result=result==='out_of_corpus'?'out_of_corpus':'unconfirmed';
   l.unconfirmed.push({id:u.id,text_hash:u.text_hash,result,needed_source:a?.needed_source||(u.text.startsWith('12か月に足りないとき')?'このsnapshotの受給資格判定範囲を示す仕様・実行記録。半月算入等の子単位は別途元のneeded_sourceを保持。':u.text.startsWith('この計算機で正しく出ない方')?'このsnapshotで休業中賃金を計算対象外とする仕様・実行記録。給付減額の法令部分はr15-work-income-reductionに別記。':'修正後の複合単位全体を裏付ける追加正本。'),reason:reason||'修正後に新たに列挙された単位。独立照合は未実施。'});
  }
  all.push({...u,decision:result,reason:reason||'',needed_source:l.unconfirmed.find(x=>x.id===u.id)?.needed_source||''});
 }
 l.review_history={run:'r15/t7-a',out_of_corpus:adj.filter(x=>x.page===page&&x.decision==='out_of_corpus'),note:'元の正本外判定を保持。修正後の同定不能な単位も未確認に残す。coversは正確性又は独立審査通過の保証ではない。'};
 // Absolutes are reviewed in the corrected local context; unresolved source claims remain unconfirmed above.
 l.absolutes=findAbsolutes(claimText(html)).map(a=>({...a,context:a.context.slice(a.context.indexOf(a.phrase)),reviewed:'r15: 本文の限定条件を照合。正本外の単位はunconfirmed/review_historyに保留。'}));
 if(page==='docs/ikuji/index.html')l.claims.push({id:'r15-work-income-reduction',text:'賃金13%超（181日目以降30%超）では給付減額により賃金と給付の合計80%が一定となる区間がある。',numbers:['13%','181日','30%','80%'],applies:'固定正本2026-09-30',...source('corpus/ko_61_7.txt:3'),exceptions:'休業中賃金80%以上は不支給。給付率・支給日数による。機能を含む複合単位全体は未確認に保持。',covers:[],review_status:'corrected'});
 writeFileSync(lp,JSON.stringify(l,null,2)+'\n');
 summaries.push({page,...validateSegments(units,l)});
}
writeFileSync('reports/r15-t7-a/current-adjudication.json',JSON.stringify(all,null,2)+'\n');
writeFileSync('reports/r15-t7-a/coverage-after.json',JSON.stringify(summaries,null,2)+'\n');
console.log(summaries.map(({page,total,covered,verified,nonclaims,unprocessed})=>({page,total,covered,verified,nonclaims,unprocessed})));
