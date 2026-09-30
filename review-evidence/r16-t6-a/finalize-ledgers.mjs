import {readFileSync,writeFileSync} from 'node:fs';
import {claimText,findNumbers,findAbsolutes} from '../../tools/check_claims.mjs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const ev='review-evidence/r16-t6-a';const reports=[],units=[];
for(const file of ['claims/column/kogaku-ryoyohi.json','claims/kogaku-ryoyohi.json','claims/shobyo.json','claims/embed/shobyo.json']){
 const d=JSON.parse(readFileSync(file));const html=readFileSync(d.page,'utf8');const us=segmentClaims(html,d.page);units.push(...us);
 d.absolutes.push(...findAbsolutes(claimText(html)).filter(x=>['全員','丸ごと'].includes(x.phrase)).map(x=>({phrase:x.phrase,context:x.context,reviewed:'全員は設例の家族3人の年齢条件。丸ごとは旧表の読み落としの説明。70歳以上の外来上限と70歳未満の合算条件を区別した。'})));
 if(d.page.includes('kogaku')){
  const ids=d.unverified.map(x=>x.id);const texts=us.filter(x=>ids.includes(x.id));
  const numbers=[...new Set(texts.flatMap(x=>[...findNumbers(x.text)]))];
  d.claims.push({id:'r16-retained-out-of-corpus-numbers',text:'変更行に同居する正本外の既存記述の数値索引。確認済み主張ではない。',numbers,where:['unverifiedに列挙した未変更の単位'],applies:'既存記述の時点。正本外のため未確認。',source_url:'https://www.kyoukaikenpo.or.jp/benefit/high_cost_medical_expenses/002/',source_quote:'被保険者、被扶養者ともに同一月内の医療費の自己負担限度額は、年齢及び所得に応じて次の計算式により算出されます。',exceptions:'この引用だけでは年収換算・等級表・窓口負担割合等を確認できない。各単位はunverifiedのneeded_sourceを参照。covers及びverifiedには登録しない。',covers:[],verification:'out_of_corpus',needed_source:'各unverified単位のneeded_source。数値索引は被覆・正確性の確認ではない。'});
 }
 writeFileSync(file,JSON.stringify(d,null,2)+'\n');const r=validateSegments(us,d);reports.push({page:d.page,...r});
}
writeFileSync(ev+'/segments-after.json',JSON.stringify(units,null,2)+'\n');writeFileSync(ev+'/coverage-after.json',JSON.stringify(reports,null,2)+'\n');console.log(reports.map(({page,total,covered,verified,nonclaims,unprocessed})=>({page,total,covered,verified,nonclaims,unprocessed})));
