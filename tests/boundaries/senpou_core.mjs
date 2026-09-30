// r14: auじぶん銀行の通常料金。正本取得2026-09-30、表示適用日2021/10/1。
import {readFileSync} from 'node:fs';
import {calc, explainShortfall} from '../../docs/assets/senpou_core.js';
const fee = JSON.parse(readFileSync(new URL('../../docs/assets/fee_table.json', import.meta.url))).banks.find(b => b.name === 'auじぶん銀行（個人）');
const source = 'https://www.jibunbank.co.jp/interest_and_commission/commission/';
const quote = '他の銀行あて\n（三菱ＵＦＪ銀行を除く）\n204円／回（税込）';
export const cases = [
 ...[29999,30000,30001].map(invoice => ({name:`auじぶん通常料金・${invoice}円`,source,quote,
 run:()=> ['sueoki','mikan_kasan','ijo_kasan'].map(m=>calc(m,invoice,fee).transfer),
 expected:Array(3).fill(invoice-204)})),
 {name:'204円差は通常料金の候補',source,quote,run:()=>explainShortfall(30000,29796).hits,expected:[204]},
 {name:'203円差は204円と一致しない',source,quote,run:()=>explainShortfall(30000,29797).hits,expected:[]},
 {name:'205円差は204円と一致しない',source,quote,run:()=>explainShortfall(30000,29795).hits,expected:[]},
];
