/** 年収系列の表示単位と既存coreの計算記録を主張台帳へ反映。一次資料の逐語は個別に確認する。 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {segmentClaims} from './segment_claims.mjs';
import {claimText,findNumbers} from './check_claims.mjs';
import {calculate,boundaries,incomes,sources} from './gen_tedori_income_pages.mjs';
const quote={employment:'一般の事業 5/1,000 8.5/1,000 5/1,000 3.5/1,000 13.5/1,000',fukko:'平成25年から令和29年までの各年分の確定申告においては、所得税と復興特別所得税（原則としてその年分の基準所得税額の2.1パーセント）を併せて申告・納付することとなります。',social:'介護保険第２号被保険者 に該当しない場合 9.85%\n介護保険第２号被保険者 に該当する場合 11.47%\n子ども・子育て支援金 0.23%\n厚生年金保険料 18.300%',tax:'給与所得の金額は、その年中の給与等の収入金額から給与所得控除額を控除した残額とする。',amend:'これらの改正は、原則として、令和８年分以後の所得税について適用されます。',local:'所得割の課税標準は、前年の所得について算定した総所得金額、退職所得金額及び山林所得金額とする。'};
for(const n of [null,...incomes]){
 const page=`docs/tedori/nenshu/${n===null?'':n+'/'}index.html`,html=readFileSync(page,'utf8'),units=segmentClaims(html,page);
 const calculations=(n===null?incomes:[n]).flatMap(man=>[[35,false],[45,false],[35,true],[45,true]].map(([age,spouse])=>{const r=calculate(man,age,spouse),i=incomes.indexOf(man),other=incomes[i?i-1:i+1],low=calculate(Math.min(man,other)),high=calculate(Math.max(man,other));return {comparison:{from:Math.min(man,other),to:Math.max(man,other),grossIncrease:high.gross-low.gross,netIncrease:high.net-low.net},man,age,spouse,boundaries:boundaries(man),gross:r.gross,social:r.annual,standard:r.social.standard,koseiStandard:r.social.koseiStandard,taxable:r.tax.kazei,residentTaxable:r.local.kazeiSoShotoku,residentAdjustment:r.local.choseiKojo,parts:r.parts,net:r.net,monthly:Math.round(r.net/12)};}));
 const ledger={page,checked:'2026-10-22',calculation_results:calculations,claims:units.flatMap((u,i)=>{
  const kind=/雇用保険/.test(u.text)?'employment':/復興/.test(u.text)?'fukko':/住民税|森林/.test(u.text)?'local':/社会保険|健康保険|介護|厚生|標準報酬|支援金|保険料/.test(u.text)?'social':/令和|改正|年分/.test(u.text)?'amend':'tax';
  const found=[...findNumbers(u.text)];
  return (found.length?found.map(n=>[n]):[[]]).map((numbers,k)=>{
  const num=numbers[0]||'';
  const must=!num?[]:/万円/.test(num)?['年収|給与|控除|上限|健保']:/円/.test(num)?['年収|料率固定モデル|報酬月額|給与|控除|所得|上端|上限|あと|手取り差']:/歳/.test(num)?['扶養なし|配偶者|介護保険|年齢']:/年|月|日/.test(num)?['所得税|保険料|住民税|申告|年末調整|料率|施行版|確認日']:/%/.test(num)?['税率|収入|増加率']:null;
  if(must===null)throw Error('条件の型が未定義: '+num);
  const derived=/円|%/.test(num);
  return {id:'c'+String(i+1).padStart(3,'0')+'-'+(k+1),text:u.text,where:[u.element_id||u.kind],numbers,applies:'令和8年分所得税・令和8年度4月以後料率固定・令和9年度住民税',scope:'所得税上の居住者・厚生年金基金未加入・給与のみ・35歳または45歳・協会けんぽ東京・賞与なし・扶養なしまたは無所得の配偶者あり',source_url:sources[kind==='employment'?1:kind==='fukko'?2:kind==='social'?0:kind==='local'?6:kind==='amend'?3:4][1],source_urls:[...sources.map(s=>s[1]),'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm','https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm','https://www.city.kunitachi.tokyo.jp/kurashi/zeikin/6/2/5792.html'],source_quote:/調整控除|200万円/.test(u.text)?'200万円以下の場合 (1)(2)のいずれか少ない額の5％。200万円超の場合 ｛人的控除額の差の合計額-(合計課税所得金額-200万円)｝の5％ この金額が2,500円未満の場合は、2,500円とします。':/基礎控除/.test(u.text)?'令和８・９年分 104 万円 67 万円 62 万円。489 万円超 655 万円以下 (665 万 5,556 円超 850 万円以下)':/配偶者/.test(u.text)?'900 万円以下 (1,095 万円以下) 900 万円超 950 万円以下 (1,095 万円超 1,145 万円以下) 950 万円超 1,000 万円以下 (1,145 万円超 1,195 万円以下)':quote[kind],exceptions:'賞与配分、定時決定・随時改定、他所得、自治体超過課税、年途中の就職退職・死亡出国・保険料免除は対象外。年税額は納付時100円未満切捨て前。配偶者控除の本人所得制限は計算に含む。',must_with:must,...(derived?{derived:true,calc:{formula:'tools/gen_tedori_income_pages.mjs calculate: shakaiHokenMonthly ×12 → calcShotokuzei / juminzei calc(zeisei:r8) → net=gross-annualSocial-tax.zeigakuGokei-local.juminzeiTotal; monthly=round(net/12); comparison.grossIncrease=high.gross-low.gross; comparison.netIncrease=high.net-low.net; boundaries: salaryDeduction=gross-tax.shotoku.kyuyoShotoku; kiso=brackets(gokei); salaryLimitはkyuyoShotokuR8の円単位逆算; rate=shotokuzei_brackets(kazei).rate*100; pensionStart=635000*12; spouseLimits=salaryLimit(honnin_tiers.upto); spouseGain=spouse.net-base.net; nextTax: 各KENKO_GRADESの報酬区間内で課税所得>=現在の税率表上端+1000となる最初の給与円を二分探索し、区間を低い順に走査; nextTax.distance=nextTax.gross-base.gross; 住民税課税所得と調整控除はresidentの出力; 表示内訳の合計も控除額と照合',executed:{calculation_results_indices:calculations.map((_,index)=>index)}}}:{}),covers:[u.id]};
  });
 }),absolutes:[],tool_cases:[{input:{monthly:300000,age:35},expected:{kenko:14775,kosei:27450,kosodate:345},source_url:sources[0][1],note:'公表額表22等級の折半額'},{input:{monthly:300000,age:45},expected:{kenkoKaigo:17205,kosei:27450,kosodate:345},source_url:sources[0][1],note:'公表額表22等級・介護該当'}],nonclaims:[],verified:[]};
 // ヘッダ・出典の年度など本文以外も含む数字の漏れは、対応する既存主張へ寄せる。
 const have=new Set(ledger.claims.flatMap(c=>c.numbers));for(const num of findNumbers(claimText(html)))if(!have.has(num))throw Error(page+' unmapped '+num);
 const out=page.replace(/^docs\//,'claims/').replace(/\/index.html$/,'.json');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(ledger,null,2)+'\n');
}
