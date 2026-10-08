import{readFileSync}from'node:fs';
import{JSDOM}from'jsdom';
import{bunki,shiwake}from'../../docs/assets/hojokin_zeimu_core.js';
const D=JSON.parse(readFileSync(new URL('../../docs/assets/hojokin_zeimu_r08.json',import.meta.url)));
const source='https://laws.e-gov.go.jp/law/340AC0000000034';
const quote='その国庫補助金等の返還を要しないことが当該事業年度終了の時までに確定していない場合に限る。';
export const cases=[];
for(const kakuteiZumi of [false,true])for(const shutokuZumi of [false,true])for(const tokubetsuArii of [false,true]){
 const expected=!kakuteiZumi?'mikakutei':!shutokuZumi?'taishogai':tokubetsuArii?'ato_de_kakutei':'kakutei_zumi';
 cases.push({name:`確定${kakuteiZumi}・取得${shutokuZumi}・既存勘定${tokubetsuArii}`,run:()=>bunki({kakuteiZumi,shutokuZumi,tokubetsuArii},D).key,expected,source,quote,corpus_ref:'corpus/egov_hojinzeiho_42.txt:6; corpus/egov_hojinzeiho_43.txt:6; corpus/egov_hojinzeiho_44.txt:6'});
}
cases.push({name:'確定済み未取得は特別勘定仕訳を出さない',run:()=>shiwake({bunkiKey:bunki({kakuteiZumi:true,shutokuZumi:false},D).key,hojokin:5000000,gendo:0,houshiki:'chokusetsu'}).length,expected:0,source,quote});
cases.push({name:'hojokin_zeimu HTML初期値の取得・確定',run:d=>{d ||=new JSDOM(readFileSync(new URL('../../docs/hojokin-zeimu/index.html',import.meta.url),'utf8')).window.document;return bunki({kakuteiZumi:d.querySelector('#kakutei').checked,shutokuZumi:d.querySelector('#shutoku').checked,tokubetsuArii:d.querySelector('#tokubetsu').checked},D).key;},expected:'kakutei_zumi',source,quote});
