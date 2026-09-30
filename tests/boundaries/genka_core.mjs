import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {calcGenka} from '../../docs/assets/genka_core.js';
const D=JSON.parse(readFileSync(new URL('../../docs/assets/genka_rates.json',import.meta.url)));
const source='https://laws.e-gov.go.jp/law/340CO0000000096';
const quote='当該業務の用に供された日からその年十二月三十一日';
const base={method:'teiritsu',cost:1000000,life:10};
export const cases=[
 {name:'取得3月・供用4月は250%で9か月',run:()=>{const r=calcGenka({...base,acqYm:'2012-03',serviceYm:'2012-04'},D);return [r.rate,r.usedMonths,r.firstYearDep];},expected:[0.25,9,187500],source,quote},
 {name:'取得4月・供用4月は200%で9か月',run:()=>{const r=calcGenka({...base,acqYm:'2012-04',serviceYm:'2012-04'},D);return [r.rate,r.usedMonths,r.firstYearDep];},expected:[0.2,9,150000],source,quote},
 {name:'12月取得・翌年1月供用は通年',run:()=>calcGenka({...base,acqYm:'2025-12',serviceYm:'2026-01'},D).firstYearDep,expected:200000,source,quote},
 {name:'取得前供用を拒否',run:()=>{try{calcGenka({...base,acqYm:'2026-04',serviceYm:'2026-03'},D);return false;}catch{return true;}},expected:true,source,quote},
 {name:'供用月13を拒否',run:()=>{try{calcGenka({...base,acqYm:'2026-04',serviceYm:'2026-13'},D);return false;}catch{return true;}},expected:true,source,quote},
 {name:'genka HTML初期値の供用同月',run:d=>{d ||= new JSDOM(readFileSync(new URL('../../docs/genka/index.html',import.meta.url),'utf8')).window.document;const acqYm='2026-'+d.querySelector('#acqmonth').value.padStart(2,'0');return calcGenka({method:d.querySelector('#method').value,cost:Number(d.querySelector('#cost').value),life:Number(d.querySelector('#life').value),assetType:d.querySelector('#assettype').value,acqYm,serviceYm:d.querySelector('#serviceym').value||acqYm},D).firstYearDep;},expected:56250,source,quote},
];
