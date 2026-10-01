import {readFileSync} from 'node:fs';
import {calcTorokuJutaku} from '../../docs/assets/toroku_jutaku_core.js';
const data=JSON.parse(readFileSync(new URL('../../docs/assets/toroku_jutaku_r08.json',import.meta.url)));
const base={tokiShurui:'iten',kojinKyoju:true,yukamenseki:100,genin:'売買',tokiMadeMonths:3,chuko:false,nintei:'none',tatemonoKagaku:10000000,saikenGaku:20000000,tochiKagaku:0};
const source='https://laws.e-gov.go.jp/law/332AC0000000026';
const quote='これらの住宅用家屋の取得後一年以内';
const values=(tokiBi,shutokuBi)=>{const r=calcTorokuJutaku({...base,tokiBi,shutokuBi},data);return {ok:r.ok, taxes:(r.meisai||[]).map(x=>x.zeigaku)};};
export const cases=[
{name:'住宅取得期限当日・翌日登記',run:()=>values('2027-04-01','2027-03-31'),expected:{ok:true,taxes:[30000,20000]},source,quote},
{name:'住宅取得から1年当日',run:()=>values('2028-03-31','2027-03-31'),expected:{ok:true,taxes:[30000,20000]},source,quote},
{name:'住宅取得から1年翌日・通常期限外',run:()=>values('2028-04-01','2027-03-31'),expected:{ok:true,taxes:[200000,80000]},source,quote},
{name:'新築取得期限翌日・未収録期間',run:()=>values('2027-04-02','2027-04-01'),expected:{ok:false,taxes:[]},source,quote:'令和九年三月三十一日までの間に'},
];
cases.push({name:'住宅登記HTML初期日付',run:d=>{
  // HTMLを渡さない境界表ランナーでも同じ実ページの初期値を読む。
  const html=readFileSync(new URL('../../docs/toroku-menkyozei/index.html',import.meta.url),'utf8');
  const v=id=>d?d.getElementById(id).value:html.match(new RegExp('id="'+id+'"[^>]*value="([^"]*)"'))?.[1];
  const r=calcTorokuJutaku({...base,tokiBi:v('tokiBi'),shutokuBi:v('shutokuBi')},data);
  return {ok:r.ok,taxes:(r.meisai||[]).map(x=>x.zeigaku)};
},expected:{ok:true,taxes:[30000,20000]},source,quote});
