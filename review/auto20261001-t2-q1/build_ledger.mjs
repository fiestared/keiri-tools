import fs from 'node:fs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
import {findNumbers,findAbsolutes,claimText} from '../../tools/check_claims.mjs';
const dir='review/auto20261001-t2-q1/';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261001/t2-q1/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const old=read(dir+'segments.json'), adjud=read(dir+'segment-adjudication.json').segments;
const oldMap=new Map(old.map((u,i)=>[u.page+':'+u.id,{...u,...adjud[i]}]));
const reports={};
function source(reason){
 const refs=[...reason.matchAll(/(?:(t1-corpus\/gensen\/|corpus\/))?(\d\d)\.txt:(\d+)(?:[-–](\d+))?/g)];
 if(!refs.length)return {source_url:'https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/03.pdf',source_quote:'退職所得控除額 万円 ／ 所得税法第201条第1項第1号及び地方税法第50条の6第1項第1号及び第328条の6第1項第1号適用分',corpus_ref:'corpus/03.pdf:p.19（様式の印字。独立審査の目視照合を継承）'};
 const chunks=refs.map(m=>{const path=(m[1]||'corpus/')+m[2]+'.txt';const lines=fs.readFileSync(run+path,'utf8').split('\n');return {path,quote:lines.slice(+m[3]-1,+(m[4]||m[3])).join('\n'),ref:`${path}:${m[3]}-${m[4]||m[3]}`};});
 return {source_url:chunks[0].path.startsWith('t1-')?'https://www.nta.go.jp/publication/pamph/gensen/aramashi2026/pdf/05.pdf':`https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/${refs[0][2]}.pdf`,source_quote:chunks.map(x=>x.quote).join('\n'),corpus_ref:chunks.map(x=>x.ref).join('; ')};
}
function repairSource(u){
 let reason;
 if(u.page.includes('hoteichosho-')){
 if(/12月31日|1月1日以後の提出/.test(u.text))reason='corpus/01.txt:80-90';
 else if(/年間支払額/.test(u.text))reason='corpus/05.txt:3-16';
 else if(/最新の様式/.test(u.text))reason='corpus/01.txt:114-120';
 else reason='corpus/08.txt:80-110';
 }else{
 if(/住民税|特定役員|2分の1|短期退職/.test(u.text))return {source_url:'https://www.city.okayama.jp/kurashi/0000005624.html',source_quote:'「退職所得の受給に関する申告書」（退職所得申告書）の提出の有無にかかわらず、上でご説明した手順で特別徴収する市民税及び県民税の税額を計算することとなります。',corpus_ref:dir+'okayama.txt（退職所得金額のA/B/C区分及び「所得税等での扱いについて」）'};
 reason=/番号|無効区分|書面様式/.test(u.text)?'corpus/01.txt:104-120; corpus/03.txt:24-28':'corpus/03.txt:45-54';
 }
 return source(reason);
}
for(const name of ['hoteichosho-goukeihyo','taishoku-gensen-choshuhyo']){
 const page=`docs/column/${name}/index.html`,path=`claims/column/${name}.json`,html=fs.readFileSync(page,'utf8'),units=segmentClaims(html,page),ledger=read(path);
 ledger.claims=ledger.claims.filter(c=>!c.id.startsWith("auto20261001-t2-q1-"));
 for(const c of ledger.claims)c.covers=[];
 ledger.nonclaims=[];ledger.verified=[];ledger.out_of_corpus=[];ledger.checked='2026-10-01';
 for(const u of units){
  const a=oldMap.get(page+':'+u.id);
  if(a?.decision==='out_of_corpus'){ledger.out_of_corpus.push({id:u.id,text_hash:u.text_hash,result:'out_of_corpus',needed_source:a.needed_source,review_ref:dir+'segment-adjudication.json',reason:a.reason});continue;}
  if(a?.decision==='nonclaim'||u.text==='ここでは、法定調書の提出範囲を確認します。'){
   if(u.protected)throw Error('protected nonclaim '+u.id);
   ledger.nonclaims.push({id:u.id,why:a?.reason||'この記事でこれから確認する範囲の案内。頻度・制度の主張ではない。'});continue;
  }
  if(a?.decision==='unresolved')throw Error('Unchanged unresolved '+u.id);
  const src=a?source(a.reason):repairSource(u);
  ledger.claims.push({id:'auto20261001-t2-q1-'+u.id,text:u.text,where:[`${u.kind}/${u.zone}`],numbers:[...findNumbers(u.text)],applies:'令和8年分の手引。電子提出基準は提出日で判断。住民税の補足は令和4年1月1日以降の制度。設例は記載された条件に限る。',...src,exceptions:a?.reason||'今回の修正後再照合。一般退職手当等、短期退職手当等、特定役員退職手当等を区別し、設例は他社分なしに限定。様式の存在と新設時期を混同しない。',covers:[u.id],topic:[name],review_ref:a?dir+'segment-adjudication.json':dir+'applied-edits.json'});
  ledger.verified.push({id:u.id,text_hash:u.text_hash,result:'ok',review_ref:a?dir+'segment-adjudication.json':dir+'applied-edits.json',review_type:a?'independent-adjudication':'fixer-source-recheck'});
 }
 // Preserve legacy numeric evidence, but coverage and verified are exclusively this adjudication.
 ledger.review_note='auto20261001 t2-q1。既存主張は過去の根拠記録として保持しcoversを更新。正本外115単位は本文を維持しcovers/verifiedに含めない。修正後の新単位は修正担当による一次資料再照合であり、独立再審査ではない。';
 for(const a of findAbsolutes(claimText(html)))if(!ledger.absolutes?.some(x=>x.phrase===a.phrase&&x.context===a.context))(ledger.absolutes??=[]).push({...a,reviewed:'今回の16単位の修正では、原則総額と提出分限定方式、一般退職手当等と短期・特定役員の例外を併記。正本外の既存文は未確認として維持（out_of_corpus参照）。'});
 fs.writeFileSync(path,JSON.stringify(ledger,null,2)+'\n');
 reports[page]=validateSegments(units,ledger);
}
fs.writeFileSync(dir+'coverage-after.json',JSON.stringify(reports,null,2)+'\n');
const after=Object.keys(reports).flatMap(page=>segmentClaims(fs.readFileSync(page,'utf8'),page));
fs.writeFileSync(dir+'segments-after.json',JSON.stringify(after,null,2)+'\n');
for(const a of adjud.filter(a=>a.decision==='out_of_corpus')){const before=oldMap.get(a.page+':'+a.id);if(!after.some(u=>u.page===a.page&&u.id===a.id&&u.text_hash===before.text_hash))throw Error('out_of_corpus changed '+a.id);}
console.log('All 115 out_of_corpus preserved.');
for(const [page,r] of Object.entries(reports))console.log(page,{total:r.total,covered:r.covered,verified:r.verified,nonclaims:r.nonclaims,unprocessed:r.unprocessed});
