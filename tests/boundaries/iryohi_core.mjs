// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { iryohiKojo, selfmedKojo, rateFromKazei, calcIryohi } from "../../docs/assets/iryohi_core.js";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const iryohiData = load("iryohi_r08.json");
export const cases = [
  { name: "補填後医療費10万円ちょうどでは控除0円", run: () => (iryohiKojo(100000, 0, null, 2000000, iryohiData).kojo), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm", quote: "（実際に支払った医療費の合計額-（1）の金額）-（2）の金額" },
  { name: "補填後医療費100,001円で控除1円", run: () => (iryohiKojo(100001, 0, null, 2000000, iryohiData).kojo), expected: 1, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "十万円）を超えるときは、その超える部分の金額" },
  { name: "セルフメディ購入12,000円では控除0円", run: () => (selfmedKojo(12000, iryohiData).kojo), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1129.htm", quote: "特定一般用医薬品等購入費の合計額（保険金などで補填される部分を除きます。）から12,000円を差し引いた金額（最高88,000円）" },
  { name: "セルフメディ購入12,001円で控除1円", run: () => (selfmedKojo(12001, iryohiData).kojo), expected: 1, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1129.htm", quote: "特定一般用医薬品等購入費の合計額（保険金などで補填される部分を除きます。）から12,000円を差し引いた金額（最高88,000円）" },
];

// r16: 法89条は「以下／超える」。境界の両側と補填対象未入力を検証。
for (const [n,lo,hi] of [[1950000,5,10],[3300000,10,20],[6950000,20,23],[9000000,23,33],[18000000,33,40],[40000000,40,45]]) {
 for (const [delta,expected] of [[-1,lo],[0,lo],[1,hi]]) cases.push({name:`r16税率${n}${delta}`,run:()=>rateFromKazei(n+delta,iryohiData),expected,source:'https://laws.e-gov.go.jp/law/340AC0000000033',quote:'百九十五万円以下の金額'});
}
cases.push(
 {name:'r16補填対象未入力',run:()=>{try{iryohiKojo(300000,200000,null,3000000,iryohiData);return '計算続行';}catch(e){return /対象医療費/.test(e.message);}},expected:true,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',quote:'その給付の目的となった医療費の金額を限度として差し引きます'},
 {name:'r16補填超過を他の医療費から引かない',run:()=>iryohiKojo(300000,200000,100000,3000000,iryohiData).kojo,expected:100000,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',quote:'他の医療費からは差し引きません'},
 {name:'r16給与2971999円の足切り',run:()=>calcIryohi({iryohi:100000,kyuyoShunyu:2971999,zeisei:'r8'},{iryohiData,juminzeiData:load('juminzei_r08.json')}).ashikiri,expected:99880,source:'https://laws.e-gov.go.jp/law/340AC0000000033',quote:'２，９６８，０００'},
 {name:'r16給与2972000円の足切り',run:()=>calcIryohi({iryohi:100000,kyuyoShunyu:2972000,zeisei:'r8'},{iryohiData,juminzeiData:load('juminzei_r08.json')}).ashikiri,expected:100000,source:'https://laws.e-gov.go.jp/law/340AC0000000033',quote:'２，９７２，０００'},
 {name:'r16HTML初期値は計算不能',run:d=>{const dom=d?null:new JSDOM(readFileSync(new URL('../../docs/iryohi/index.html',import.meta.url),'utf8'));d??=dom.window.document;try{calcIryohi({iryohi:d.getElementById('iryohi').value,hoten:d.getElementById('hoten').value,kyuyoShunyu:d.getElementById('shunyu').value},{iryohiData});return '計算続行';}catch(e){return /総所得金額等/.test(e.message);}finally{dom?.window.close();}},expected:true,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',quote:'総所得金額等の5パーセントの金額'}
);

cases.push({name:'r16給与160万円は所得税0',run:()=>calcIryohi({iryohi:100000,kyuyoShunyu:1600000,zeisei:'r8',shotokuzeiRate:5},{iryohiData,juminzeiData:load('juminzei_r08.json')}).normal.keigen.total,expected:5700,source:'https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?elm=Article_41_16_2',quote:'合計所得金額が四百八十九万円以下である場合四十二万円'});
