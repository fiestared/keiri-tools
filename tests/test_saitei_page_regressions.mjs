// 本番の入力・fetch・イベント・描画をJSDOMで実行し、coreだけの検査の穴を塞ぐ。
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as core from '../docs/assets/saitei_core.js';
const html=readFileSync(new URL('../docs/saitei-chingin/index.html',import.meta.url),'utf8');
const D=JSON.parse(readFileSync(new URL('../docs/assets/saitei_chingin_r08.json',import.meta.url),'utf8'));
const script=[...new JSDOM(html).window.document.querySelectorAll('script[type=module]')].find(s=>s.textContent.includes('saiteiReady')).textContent.replace(/^import .*;$/gm,'');
async function page(data){
 const dom=new JSDOM(html,{url:'https://keiri-tools.com/saitei-chingin/',runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{...core,attachCopyButton:()=>{},fetch:async()=>({ok:true,json:async()=>data})});
 const Real=w.Date;w.Date=class extends Real{constructor(...args){super(...(args.length?args:["2026-10-01T12:00:00+09:00"]));}};
 w.eval(script);await new Promise(r=>setTimeout(r,0));
 return {dom,w,doc:w.document};
}
test('画面: 厳密等額と不適切な時間の失敗表示',async()=>{
 const {dom,w,doc}=await page(D);
 try{
  const set=(id,value)=>{doc.getElementById(id).value=value;};
  set('pref','東京');doc.querySelector('input[value=monthly]').click();set('amount','155904');set('days','203');set('hpd','7.2');
  doc.getElementById('run').click();await new Promise(r=>setTimeout(r,0));
  assert.match(doc.getElementById('out').textContent,/最低賃金以上です/);
  set('amount','155903.99');doc.getElementById('run').click();await new Promise(r=>setTimeout(r,0));
  const shortage=doc.getElementById('out').textContent;assert.match(shortage,/下回っています/);assert.doesNotMatch(shortage,/1時間あたり0円|¥0/);
  assert.match(shortage,/0.01円未満/);
  for(const h of ['25','1e308','1e-323']){
   set('hpd',h);doc.getElementById('run').click();await new Promise(r=>setTimeout(r,0));
   const text=doc.getElementById('out').textContent;assert.match(text,/入力|計算できません/);assert.doesNotMatch(text,/最低賃金以上|下回っています|Infinity|NaN|∞/);
  }
 }finally{w.close();}
});
test('画面: HTTP成功でも空・欠損データは初期表示とクリックで読み込み失敗',async()=>{
 const missing=structuredClone(D);delete missing.prefectures.find(p=>p.pref==='東京').wage;
 for(const data of [{},{prefectures:[]},missing]){
  const {w,doc}=await page(data);
  try{
   assert.match(doc.getElementById('out').textContent,/データを読み込めません/);
   doc.getElementById('run').click();await new Promise(r=>setTimeout(r,0));
   const text=doc.getElementById('out').textContent;assert.match(text,/データを読み込めません/);assert.doesNotMatch(text,/以上です|下回っています|NaN|undefined/);
  }finally{w.close();}
 }
});
test('47県: 冒頭の同額反復なし、8項目は箇条書き、印刷ボタンはサイト共通',()=>{
 const routes=JSON.parse(readFileSync(new URL('../tools/saitei_pref_pages.json',import.meta.url),'utf8')).prefectures;
 for(const route of Object.values(routes)){
  const dom=new JSDOM(readFileSync(new URL(`../docs/saitei-chingin/${route.slug}/index.html`,import.meta.url),'utf8')),doc=dom.window.document;
  try{
   const lead=doc.getElementById('pref-lead');assert.equal((lead.textContent.match(/時間額/g)||[]).length,1);const p=D.prefectures.find(p=>routes[p.pref].slug===route.slug);if(D._meta.checked>=p.effective)assert.ok(!doc.getElementById('pref-current'));
   assert.equal(doc.querySelectorAll('#pref-exclusions > li').length,8);assert.ok(doc.getElementById('pref-print').classList.contains('primary'));
  }finally{dom.window.close();}
 }
});
