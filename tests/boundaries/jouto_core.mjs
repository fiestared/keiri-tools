import {calcJouto} from '../../docs/assets/jouto_core.js';
import {readFileSync} from 'node:fs';
const D=JSON.parse(readFileSync(new URL('../../docs/assets/jouto_r08.json',import.meta.url)));
const input={joutoKagaku:50000000,joutoHiyo:0,tochiShutokuhi:10000000,tatemonoShutokuKagaku:0,shutokuBi:'2000-01-01'};
const source='https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3306.htm';
const quote='令和6年1月1日以後に行う譲渡で被相続人居住用家屋および被相続人居住用家屋の敷地等を相続または遺贈により取得した相続人の数が3人以上である場合は2,000万円までとなります。';
export const cases=[
 ...[['2023-12-31',30000000],['2024-01-01',20000000]].map(([date,expected])=>({name:`空き家3人 ${date}`,run:()=>calcJouto({...input,joutoBi:date,tokureiKey:'akiya',sozokuninSu:3},D).kojoGaku,expected,source,quote})),
 ...[[2026,126000,0],[2027,66000,60000],[2037,66000,60000],[2038,66000,60000],[2047,66000,60000],[2048,0,60000]].map(([y,f,b])=>({name:`譲渡付加税 ${y}`,run:()=>{const r=calcJouto({...input,joutoBi:`${y}-12-31`},D);return [r.fukkoZei,r.boeiZei,r.goukei]},expected:[f,b,8000000+f+b],source:'https://laws.e-gov.go.jp/law/505AC0000000069/20270101',quote:'令和九年分以後の各年分の所得税に係る基準所得税額には、この法律により、当分の間、防衛特別所得税を課する。百分の一（復興財源確保法9条・13条の2027年施行版は2047年まで1.1%）'})),
 {name:'翌年比較2047から2048',run:()=>calcJouto({...input,shutokuBi:'2042-12-30',joutoBi:'2047-12-31'},D).kurikoshi.goukei,expected:8060000,source:'https://laws.e-gov.go.jp/law/423AC0000000117/20270101',quote:'平成二十五年から令和二十九年までの各年分の所得税に係る基準所得税額には、この法律により、復興特別所得税を課する。'},
];
