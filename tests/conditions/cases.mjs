import { normalizeBatch } from '../../docs/assets/zengin_core.js';
import {readFileSync} from 'node:fs';
import {calc} from '../../docs/assets/jutaku_core.js';
import {kojoGoNoGaku,shotokuKojoGokei} from '../../docs/assets/gensen_hyo_core.js';
import {kyuyoShotokuR8} from '../../docs/assets/juminzei_core.js';
import {teijiKettei,taishogai,zuijiNissuOK} from '../../docs/assets/santei_core.js';
import {extraDependentCount,kouTax,otsuTax} from '../../docs/assets/gensen_kyuyo_core.js';
const load=f=>JSON.parse(readFileSync(new URL('../../docs/assets/'+f,import.meta.url)));
const J=load('jutaku_r07.json'),S=load('santei_r08.json'),G=load('juminzei_r08.json'),K=load('gensen_getsugaku_r08.json');
const num=(d,id)=>Number(d.getElementById(id).value),checked=(d,id)=>d.getElementById(id).checked;
const hs='https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-2.htm';
const ss='https://laws.e-gov.go.jp/api/2/law_data/211AC0000000070?response_format=xml&elm=Article_41';
const gs='https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf';
export const extra={
 zengin_core:[{name:'カナ変換HTML初期入力は空',run:d=>normalizeBatch(d.getElementById('names').value),expected:[],source:'https://www.smbc.co.jp/direct/sousa/help_furikomi/15.html',quote:'【法人へのお振込の場合の法人略語の入力例の一覧】',note:'初期入力は空なので変換対象なし。位置境界は境界表で別途確認。'}],
 jutaku_core:[
  {name:'HTML初期残高・新築省エネ・年選択の初期値',run:d=>{
    const script=[...d.scripts].map(s=>s.textContent).join('\n');
    const year=Number(script.match(/const DEFAULT_YEAR\s*=\s*(\d+)/)?.[1]);
    if(!year)throw Error('dynamic default year not found');
    return calc({type:d.getElementById('type').value,kubun:d.getElementById('kubun').value,year,nenmatsuZandaka:num(d,'zandaka'),kosodateTokurei:checked(d,'tokurei'),keikaSochi:checked(d,'keika'),menseki:d.getElementById('menseki').value,goukeiShotoku:d.getElementById('shotoku').value},J).nenkanKoujo;
  },expected:140000,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-1.htm',quote:'省エネ基準適合住宅 \n令和4年・令和5年\n13年\n年末残高等×0.7％（28万円）\n令和6年・令和7年\n13年\n年末残高等×0.7％（21万円）（注3）\n令和8年・令和9年\n13年\n年末残高等×0.7％（14万円）（注4）'},
  {name:'控除100円未満切捨の位置',kind:'rounding',run:()=>calc({type:'shinchiku',kubun:'nintei',year:2026,nenmatsuZandaka:30014285},J).nenkanKoujo,expected:210000,source:hs,quote:'100円未満の端数金額は切り捨てます。'},
  {name:'増改築は計算対象外',run:()=>calc({type:'zokaichiku',year:2026},J).beyondData,expected:true,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-4.htm',quote:'住宅の増改築等をし、令和4年以降に居住の用に供した場合'},
 ],
 gensen_hyo_core:[
  {name:'HTML初期値②③欄',run:d=>[kojoGoNoGaku(num(d,'shiharai'),checked(d,'nencho'),G,kyuyoShotokuR8).value,shotokuKojoGokei(Object.fromEntries(['shakai','seimei','jishin','jinteki','kiso'].map(id=>[id,num(d,id)])),checked(d,'nencho')).value],expected:[960000,1290000],source:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',quote:'132 万円超 336 万円以下'},
  {name:'年調なし②空欄',run:()=>kojoGoNoGaku(1700000,false,G,kyuyoShotokuR8).value,expected:null,source:'https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/02.pdf',quote:'年末調整をした受給者のみ'},
  {name:'年調あり②金額',run:()=>kojoGoNoGaku(1700000,true,G,kyuyoShotokuR8).value,expected:960000,source:'https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/02.pdf',quote:'年末調整をした受給者のみ'},
 ],
 santei_core:[
  {name:'HTML初期値の算定平均',run:d=>teijiKettei([4,5,6].map(m=>({name:m+'月',hoshu:num(d,'h'+m),nissu:num(d,'n'+m)})),checked(d,'tanjikan'),S).hoshuGetsugaku,expected:300000,source:ss,quote:'その期間の月数で除して得た額'},
  {name:'7〜9月随時改定は定時対象外',run:()=>taishogai('',true,2026,S).taishogai,expected:true,source:ss,quote:'その年に限り適用しない。'},
  {name:'随時改定予定なしは除外しない',run:()=>taishogai('',false,2026,S).taishogai,expected:false,source:ss,quote:'その年に限り適用しない。'},
  {name:'算定平均の1円未満切捨',kind:'rounding',run:()=>teijiKettei([{hoshu:300000,nissu:20},{hoshu:300001,nissu:20}],false,S).hoshuGetsugaku,expected:300000,source:ss,quote:'その期間の月数で除して得た額'},
 ],
 gensen_kyuyo_core:[
  {name:'HTML初期の人的加算なし',run:d=>extraDependentCount({shogaisha:checked(d,'shogaisha'),kafu:checked(d,'kafu'),hitorioya:checked(d,'hitorioya'),kinroGakusei:checked(d,'kinro')}),expected:0,source:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',quote:'これらの一に該当するごとに扶養親族等の数に１人を加算し、'},
  {name:'寡婦とひとり親の排他',kind:'exclusive',run:()=>extraDependentCount({kafu:true,hitorioya:true}),expected:1,source:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',quote:'ひとり親に該当する人を除きま\n す。\n  ）。'},
  {name:'寡婦もひとり親もなし',run:()=>extraDependentCount({kafu:false,hitorioya:false}),expected:0,source:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',quote:'ひとり親に該当する人を除きま\n す。\n  ）。'},
  {name:'乙欄低額の端数切捨',kind:'rounding',run:()=>otsuTax(K,104999),expected:3216,source:gs,quote:'3.063％に相当する金額'},
  {name:'同額の甲欄はゼロ',run:()=>kouTax(K,104999,0),expected:0,source:gs,quote:'105,000 円未満'},
 ]
};
