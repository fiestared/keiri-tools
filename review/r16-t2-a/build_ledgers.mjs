import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {segmentClaims,normalize,validateSegments} from '../../tools/segment_claims.mjs';
import {findNumbers,findAbsolutes,addedClaimText} from '../../tools/check_claims.mjs';
const base='review/r16-t2-a/',read=f=>JSON.parse(fs.readFileSync(base+f));
const old=read('segments.json'),adj=read('segment-adjudication.json').segments,sol=read('sol-units.json'),edits=read('edits.json');
const custom={61:"corpus/02.txt:211-214",62:"corpus/02.txt:211-214",208:'corpus/02.txt:462-476',219:'t1-corpus/nencho/nencho_all.txt:6790-6823',220:'t1-corpus/nencho/nencho_all.txt:701-717',221:'t1-corpus/nencho/nencho_all.txt:6790-6823',222:'t1-corpus/nencho/nencho_all.txt:701-717',223:'t1-corpus/nencho/nencho_all.txt:6790-6823',224:'corpus/02.txt:178-183',225:'t1-corpus/nencho/nencho_all.txt:6790-6823',228:'t1-corpus/nencho/nencho_all.txt:6790-6823',229:'corpus/02.txt:203-208',230:'t1-corpus/nencho/nencho_all.txt:6790-6823',231:'corpus/02.txt:203-208',232:'t1-corpus/nencho/nencho_all.txt:6790-6823',235:'t1-corpus/nencho/nencho_all.txt:6818-6823',238:'t1-corpus/nencho/nencho_all.txt:6818-6823',241:'t1-corpus/nencho/nencho_all.txt:6818-6823',242:'t1-corpus/nencho/nencho_all.txt:6790-6823; corpus/02.txt:203-208',975:'corpus/01.txt:12-13'};
const taxurl=n=>'https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/'+n+'.pdf';
function source(ref){
 let current='',parts=[];
 for(const part of ref.split(/[;,]/)){
  const file=part.match(/(?:t1-corpus\/nencho\/|corpus\/)([\w]+)\.txt/);if(file)current=file[1];
  const range=part.match(file?/:([0-9]+)(?:-([0-9]+))?/:/([0-9]+)(?:-([0-9]+))?/);if(!range||!current)continue;
  const lines=fs.readFileSync(base+'sources/'+current+'.txt','utf8').split('\n');
  parts.push({source_url:current==='nencho_all'?'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf':taxurl(current),source_quote:lines.slice(+range[1]-1,+(range[2]||range[1])).join('\n'),corpus_ref:base+'sources/'+current+'.txt:'+range[0].replace(':','')});
 }
 if(!parts.length)throw Error('ref '+ref);return {...parts[0],corpus_ref:ref,supporting_sources:parts.slice(1)};
}
function correctedSource(e){
 const n=e.ordinal;
 if([549,1078,1079,1080].includes(n)){const f={549:'1180',1078:'7431',1079:'7441',1080:'7455'}[n],d=new JSDOM(fs.readFileSync(base+'sources/'+f+'.html','utf8')).window.document;return{source_url:`https://www.nta.go.jp/taxes/shiraberu/taxanswer/${f==='1180'?'shotoku':'hotei'}/${f}.htm`,source_quote:d.querySelector('h1').textContent+' [令和8年4月1日現在法令等]',corpus_ref:base+'sources/'+f+'.html'};}
 if([341,494].includes(n))return{source_url:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm',source_quote:'年間の合計所得金額が58万円以下',corpus_ref:base+'sources/1180.html',exceptions:'扶養判定には合計所得金額と他の要件を用いる。令和8年12月1日施行の金額は62万円以下。修正文は閾値を提示しない。'};
 if([15,93,94].includes(n))return source('t1-corpus/nencho/nencho_all.txt:2835-2876');
 if([2,4,25,367,374,389,396,408,463,524,550].includes(n))return source('corpus/02.txt:577-580');
 if([9,10,17,30,78].includes(n))return source('corpus/02.txt:117-150;198-208;233-237');
 if([18,82,127,295,418,497].includes(n))return source('corpus/02.txt:117-124;221-228');
 if([20,85,343].includes(n))return source('corpus/02.txt:125-131');
 if([14,23,90,307,503,519,520,521,522].includes(n))return source('corpus/02.txt:136-147');
 if(n===483)return source('t1-corpus/nencho/nencho_all.txt:149-156;2835-2876; corpus/02.txt:136-147');
 if([364,517,334].includes(n))return source('corpus/02.txt:535-540;487-498');
 if([248,423].includes(n))return source('corpus/02.txt:233-241;125-131');
 if(n===309)return source('corpus/02.txt:158-166');
 if(n===323)return source('corpus/02.txt:245-257');
 if(n===430)return source('corpus/02.txt:130-135;233-237');
 if(n===353)return source('corpus/02.txt:221-230');
 if(n===459)return source('corpus/02.txt:567-568');
 if(n===493)return source('corpus/02.txt:117-124');
 if(n<556)return source('corpus/02.txt:174-208;130-135; t1-corpus/nencho/nencho_all.txt:6790-6823');
 if(n<896)return source('corpus/02.txt:17-60');
 if([994,995].includes(n))return source('corpus/02.txt:573-580');
 if([969,1032,1034].includes(n))return source('corpus/12.txt:3-6');
 if(n===1073)return source('corpus/09.txt:38-73;109-116');
 if(n===1042)return source('corpus/04.txt:44-47');
 return source('corpus/04.txt:9-26; corpus/05.txt:3-16; corpus/01.txt:12-13');
}
const stats=[],mapping=[];
for(const page of new Set(old.map(x=>x.page))){
 const slug=page.split('/')[2],html=fs.readFileSync(base+'candidate-'+slug+'.html','utf8'),units=segmentClaims(html,page),ledger=JSON.parse(execFileSync('git',['show','2d0c0862:claims/column/'+slug+'.json'],{encoding:'utf8'}));
 ledger.checked='2026-10-01';ledger.nonclaims=[];ledger.verified=[];ledger.out_of_corpus=[];
 for(const c of ledger.claims){c.covers=[];c.review_status='legacy_unmapped_not_unit_verification';}
 const superseded={
 'sol-e439778435c2a179':[82,'corpus/02.txt:117-124'],
 'sol-cf15baef1d1871e7':[307,'corpus/02.txt:136-147'],
 'r10-retained-p5-c01':[564,'corpus/02.txt:31-35'],
 'sol-9462b6cd3f70acb5':[995,'corpus/02.txt:573-580'],
 'sol-a0d1bd64889da0b4':[524,'corpus/02.txt:573-580'],
 'r10-80':[903,'corpus/01.txt:12-13']};
 for(const c of ledger.claims){const replacement=superseded[c.id];if(replacement){const e=edits.find(e=>e.ordinal===replacement[0]);c.prior_text=c.text;c.text=e.replacement;Object.assign(c,source(replacement[1]));c.review_status='legacy_claim_corrected_no_unit_verification';c.superseded_by_ordinal=replacement[0];}}

 const unknown=[],used=new Set();
 for(const u of units){
  let idx=old.findIndex((x,i)=>x.page===page&&x.kind===u.kind&&x.text_hash===u.text_hash&&!used.has(i)&&!edits.some(e=>e.page===page&&e.id===x.id)),e=edits.find(x=>x.page===page&&x.kind===u.kind&&normalize(x.replacement)===normalize(u.text))||edits.find(x=>x.page===page&&x.kind===u.kind&&normalize(x.replacement).includes(normalize(u.text)));
  if(idx>=0)used.add(idx);
  const a=idx>=0?adj[idx]:null;
  if(a?.decision==='nonclaim'){ledger.nonclaims.push({id:u.id,why:a.reason});continue;}
  if(a?.decision==='out_of_corpus'){ledger.out_of_corpus.push({id:u.id,text_hash:u.text_hash,text:u.text,needed_source:a.needed_source,review_ref:base+'segment-adjudication.json#'+(idx+1),status:'unverified'});continue;}
  if(a?.decision==='ok'){
   const result=sol.find(x=>x.page===page&&x.id===old[idx].id),ref=custom[idx+1]||result.corpus_ref;
   const src=source(ref); if(!custom[idx+1]&&result.corpus_quote)src.source_quote=result.corpus_quote;
   ledger.claims.push({id:'r16-unit-'+(idx+1),text:u.text,where:[u.kind+' '+u.id],numbers:[...findNumbers(u.text)],applies:'審査で示した年分・制度に限定。令和8年分手引と年末調整のしかた。',...src,exceptions:a.reason,covers:[u.id],topic:['法定調書'],review_ref:base+'segment-adjudication.json#'+(idx+1)});
   ledger.verified.push({id:u.id,text_hash:u.text_hash,result:'ok',review_ref:base+'segment-adjudication.json#'+(idx+1)});continue;
  }
  if(!e&&page.includes('shiharai-chosho/')&&/^(※令和9年1月1日以後|税務署提出用は作成不要)/.test(u.text))e={ordinal:994,replacement:u.text};
  if(!e){unknown.push(u);continue;}
  const src=correctedSource(e);
  ledger.claims.push({id:'r16-fix-'+e.ordinal+'-'+u.id,text:u.text,where:[u.kind+' '+u.id],numbers:[...findNumbers(u.text)],applies:'本文で指定した対象年分。期限・みなし提出は令和8年分／令和9年1月以後。',exceptions:'修正文を正本に再照合。正本外の併記内容は未確認のまま保持し、全面確認とはしない。',...src,covers:[u.id],topic:['法定調書'],review_ref:base+'edits.json#'+e.ordinal,review_status:'author_corrected_pending_independent_review'});
  mapping.push({ordinal:e.ordinal,id:u.id,text_hash:u.text_hash,page});
 }
 // Numeric strings in unchanged out-of-corpus prose share changed HTML lines.
 // Add source-backed numeric context without covering or verifying those units.
 const contextClaim=(id,text,numbers,src)=>ledger.claims.push({id,text,numbers,applies:'出典の対象時点に限定。原単位の全文確認とはしない。',exceptions:'変更行に残る数値への補助参照。元のout_of_corpusはneeded_source付き未確認のまま維持する。',covers:[],review_status:'supplemental_context_not_unit_verification',...src});
 if(slug==='gensen-choshuhyo-mikata'){
  contextClaim('r16-context-commute','通勤手当の限度額に関する追加参照。元の正本外単位は未確認のまま。',['15万円'],{source_url:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2582.htm',source_quote:'最も経済的かつ合理的な経路および方法による通勤手当や通勤定期券などの金額が、1か月当たり15万円を超える場合には、15万円が非課税となる限度額となります。',corpus_ref:base+'sources/2582.html'});
  contextClaim('r16-context-tokushin','特定親族特別控除の追加参照表の最高額。原単位の令和7年分適用は未確認のまま。',['63万円'],source('corpus/02.txt:415-427'));
 }
 if(slug==='kyuyo-shiharai-hokokusho'){
  contextClaim('r16-context-collection','一括徴収の期間の追加条文参照。原単位の全文確認とはしない。',['6月1日','12月31日','4月30日'],{source_url:'https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml',source_quote:fs.readFileSync(base+'sources/chihouzei-321-5.txt','utf8'),corpus_ref:base+'sources/chihouzei-321-5.txt'});
  contextClaim('r16-context-source-record','既存記事の出典名・取得版の表示（今回の再取得・全面検証の宣言ではない）。',['令和8年4月','2026年7月31日'],{kind:'own_site',source_url:'https://keiri-tools.com/column/'+slug+'/',source_quote:'本記事執筆時点の現行版は施行日2026年7月31日',supporting_sources:[{source_url:'https://www.nta.go.jp/publication/pamph/gensen/aramashi2026/index.htm',source_quote:'源泉所得税の改正のあらまし（令和8年4月）'}],needed_source:'既存の取得時点の出典・法令改正履歴。元単位のneeded_sourceを維持。'});
 }
 if(slug==='shiharai-chosho')contextClaim('r16-context-source-date','既存記事の確認日表記。今回の確認日は2026年10月1日として別記。',['2026年8月13日'],{kind:'own_site',source_url:'https://keiri-tools.com/column/'+slug+'/',source_quote:'令和7年4月1日現在法令等・2026年8月13日確認',needed_source:'当時の確認記録。原単位は未確認のまま保持。'});
 let diff;try{diff=execFileSync('git',['diff','--no-index','-U0','--',base+'baseline-'+slug+'.html',base+'candidate-'+slug+'.html'],{encoding:'utf8'});}catch(error){diff=error.stdout;}
 for(const hit of findAbsolutes(addedClaimText(html,diff)))ledger.absolutes.push({...hit,reviewed:hit.phrase==='全員'?'全員分を出すわけではない、という否定。提出範囲の年額・1回の例外は本文表で確認。':'前職分の確認を促す手順。通算の条件は年末調整を行った場合と本文に明示しており、提出だけで通算するとはしていない。'});
 const coverage=validateSegments(units,ledger);
 stats.push({page,...coverage,out_of_corpus:ledger.out_of_corpus.length,unclassified:unknown});
 fs.writeFileSync(base+'ledger-'+slug+'.json',JSON.stringify(ledger,null,2)+'\n');
 console.log(slug,{total:units.length,covered:coverage.covered,verified:coverage.verified,nonclaims:coverage.nonclaims,oc:ledger.out_of_corpus.length,unprocessed:coverage.unprocessed,unknown:unknown.length});
 for(const u of unknown)console.log('UNKNOWN',u.kind,u.text);
}
fs.writeFileSync(base+'coverage-after.json',JSON.stringify(stats,null,2)+'\n');fs.writeFileSync(base+'fix-mapping.json',JSON.stringify(mapping,null,2)+'\n');
