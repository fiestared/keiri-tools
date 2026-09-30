// Reproducible verification, not an independent legal oracle. Amounts below are
// derived manually from the saved Tokyo official table and its payroll rounding.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {calcKabe,shakaiHokenAnnual} from '../../docs/assets/kabe_core.js';
const load=f=>JSON.parse(readFileSync('docs/assets/'+f));
const refs={thresholds:load('kabe_thresholds_r08.json'),shahoRates:load('shaho_rates_r08.json')};
const expected=[[1070000,149844,920156],[1230000,177096,1052904],[1310000,187296,1122704],[1400000,200928,1199072],[1500000,214548,1285452],[1504547,214548,1289999],[1504548,214548,1290000],[1505000,214548,1290452],[1600000,228168,1371832]];
const results=[];
for(const age of [30,39]) for(const [annual,premium,net] of expected){const s=shakaiHokenAnnual(annual,age,refs.shahoRates.kenko_rates['東京都'],refs.shahoRates);assert.equal(s.annual,premium);assert.equal(annual-s.annual,net);results.push({annual,age,...s,net});}
const input={annual:1290000,age:39,prefecture:'東京都',wallType:'hifuyousha',asOf:'2026-09-30'};
const r=calcKabe(input,refs);assert.equal(r.tedori,1290000);assert.equal(r.recovery,1505000);
const small=shakaiHokenAnnual(1200000,30,refs.shahoRates.kenko_rates['東京都'],refs.shahoRates);assert.equal(small.monthly,13906);
const dom=new JSDOM(readFileSync('docs/kabe/index.html','utf8'));
const shares=[...dom.window.document.querySelectorAll('a')].filter(a=>a.textContent.trim()==='この内容をXで共有');assert.equal(shares.length,1);const url=new URL(shares[0].href);assert.equal(url.origin,'https://x.com');assert.equal(url.pathname,'/intent/tweet');assert.equal(url.searchParams.get('url'),'https://keiri-tools.com/kabe/');assert.ok(url.searchParams.get('text'));
writeFileSync('review/r16-t3-a/reproduction.json',JSON.stringify({scope:'東京・30/39歳、一定月給、賞与なし、給与控除丸め、4月以後の料率×12。扶養内は被扶養配偶者・第3号。税・雇用保険は除外。',input,result:r,results,monthly100000:small,share:{href:shares[0].href,verified:'静的リンクの宛先・共有本文・対象URLを確認。外部送信なし。Xでの投稿完了を確認したものではない。'}},null,2)+'\n');
dom.window.close();console.log('18 annual amount cases, recovery, monthly premium and static share destination verified');
