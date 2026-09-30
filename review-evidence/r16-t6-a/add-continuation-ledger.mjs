import {readFileSync,writeFileSync} from 'node:fs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
import {findNumbers} from '../../tools/check_claims.mjs';
const E='review-evidence/r16-t6-a', before=JSON.parse(readFileSync(E+'/segments-after.json'));
const reports=[],all=[];
for(const f of ['claims/column/kogaku-ryoyohi.json','claims/kogaku-ryoyohi.json','claims/shobyo.json','claims/embed/shobyo.json']){
 const d=JSON.parse(readFileSync(f));const units=segmentClaims(readFileSync(d.page,'utf8'),d.page);all.push(...units);
 const old=new Set(before.filter(x=>x.page===d.page).map(x=>x.id));
 for(const u of units.filter(x=>!old.has(x.id))){
  if(u.text.startsWith('continuationMonths:')){d.nonclaims.push({id:u.id,why:'継続加入月数の入力欄の空初期値・操作属性。法定額や支給要件の断定ではない。未入力時はコアが確認を促す。'});continue;}
  if(!/継続給付の確認|任意継続・共済組合・国保の期間を除き|日額計算に使う現保険者の月数とは別/.test(u.text))throw Error('unexpected new unit '+u.text);
  d.claims.push({id:'r16-continuation-'+u.id,text:u.text,numbers:[...findNumbers(u.text)],where:[u.kind],applies:'資格喪失後の傷病手当金の継続給付を選択した場合。日額計算用の現保険者の月数とは別入力。',source_url:'https://laws.e-gov.go.jp/law/211AC0000000070',source_quote:readFileSync(E+'/corpus/hk_104.txt','utf8'),exceptions:'任意継続・共済組合・国保の期間を除く。受給可能状態等の条件は既存説明を併せて確認。',covers:[u.id],verification:'author_rechecked',corpus_ref:E+'/corpus/hk_104.txt',review_ref:E+'/shobyo-core-red.log'});
 }
 writeFileSync(f,JSON.stringify(d,null,2)+'\n');reports.push({page:d.page,...validateSegments(units,d)});
}
writeFileSync(E+'/segments-after.json',JSON.stringify(all,null,2)+'\n');writeFileSync(E+'/coverage-after.json',JSON.stringify(reports,null,2)+'\n');console.log(reports.map(({page,total,covered,verified,nonclaims,unprocessed})=>({page,total,covered,verified,nonclaims,unprocessed})));
