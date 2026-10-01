import {JSDOM} from 'jsdom';
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
cases.push({name:'住宅登記HTML初期値',run:d=>{
  const dom=d?null:new JSDOM(readFileSync(new URL('../../docs/toroku-menkyozei/index.html',import.meta.url),'utf8'));
  const doc=d||dom.window.document, v=id=>doc.getElementById(id).value, n=id=>Number(v(id));
  try {
    const r=calcTorokuJutaku({
      tokiBi:v('tokiBi'),shutokuBi:v('shutokuBi'),tokiShurui:v('tokiShurui'),genin:v('in-genin'),tochiGenin:v('in-genin'),
      tochiKagaku:n('tochiKagaku'),tochiMochibun:n('tochiMochibun'),tatemonoKagaku:n('tatemonoKagaku'),tatemonoMochibun:n('tatemonoMochibun'),
      kojinKyoju:v('kojinKyoju')==='1',yukamenseki:n('yukamenseki'),
      chuko:v('in-chuko')==='1',kenchikuBi:v('kenchikuBi'),taishinTekigo:v('taishinTekigo')==='1',
      nintei:v('in-nintei'),kodate:v('kodate')==='1',kaitoriHanbai:v('kaitoriHanbai')==='1',saikenGaku:n('saikenGaku'),
    },data);
    return {ok:r.ok,taxes:(r.meisai||[]).map(x=>x.zeigaku)};
  } finally {dom?.window.close();}
},expected:{ok:true,taxes:[225000,30000,35000]},source,quote:'千分の十五とする。千分の三とする。千分の一とする。'});
cases.push({name:'土地のみ・住宅取得日未入力',run:()=>{
  const r=calcTorokuJutaku({tochiKagaku:15000000,tochiGenin:'売買',tatemonoKagaku:0,saikenGaku:0,tokiBi:'2026-07-01',shutokuBi:''},data);
  return {ok:r.ok,taxes:(r.meisai||[]).map(x=>x.zeigaku)};
},expected:{ok:true,taxes:[225000]},source,quote:'売買による所有権の移転の登記 千分の十五'});
