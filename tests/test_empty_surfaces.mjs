import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
import {measureEmpty} from './layout/empty-measure.mjs';
import {presentationMarkup} from '../tools/gen_presentation_markup.mjs';
assert.equal(presentationMarkup('<section class="related"> \n </section>'),'');
const {chromium}=await browserTools(),server=await serve(),browser=await chromium.launch();
try{const c=await contextFor(browser,server.origin),p=await c.newPage();
 for(const width of [1280,390]){
  await p.setViewportSize({width,height:900});await ready(p,server.origin+'/');
  for(const markup of ['<div class="note"></div>','<section class="related"></section>','<div class="result"></div>','<div class="note"> \n </div>','<div class="note"><span hidden>隠れた文章</span></div>','<section class="related"><h2>関連記事</h2></section>','<div class="result"><button>コピー</button></div>','<div class="result"><h2>計算結果</h2></div>','<div class="note"><details><summary hidden>見出し</summary><p>閉じた内容</p></details></div>','<div class="note" style="content-visibility:hidden">不可視の内容</div>']){
   await p.setContent('<link rel="stylesheet" href="/assets/style.css"><main>'+markup+'</main>');
   // Override the safeguard to reproduce the original painted-but-empty bug.
   const broken=await p.addStyleTag({content:'.note.note.note,.result.result.result,section.related.related.related {display:block!important; background:#fff7e6;border:1px solid #ccc;padding:12px}'});
   assert((await p.evaluate(measureEmpty)).length>0,'Must reject '+markup);
   await broken.evaluate(e=>e.remove());
   await p.addScriptTag({content:readFileSync(new URL('../docs/assets/empty-state.js',import.meta.url),'utf8')});
   assert.deepEqual(await p.evaluate(measureEmpty),[]);
   await p.evaluate(()=>{const e=document.querySelector('main').firstElementChild;e.textContent='入力内容を確認してください';e.style.display='block';e.style.contentVisibility='visible';});
   assert(await p.locator('main > *').isVisible(),'Real message must reappear: '+markup);
   await p.evaluate(()=>document.querySelector('main').firstElementChild.textContent='');
   assert(!(await p.locator('main > *').isVisible()),'Cleared message must disappear');
  }
  for(const answer of ['35,000円','対象外']){
   await p.setContent('<link rel="stylesheet" href="/assets/style.css"><div class="result" style="display:block"><h2>'+answer+'</h2></div>');
   await p.addScriptTag({content:readFileSync(new URL('../docs/assets/empty-state.js',import.meta.url),'utf8')});
   assert(await p.locator('.result').isVisible(),'A heading containing an actual answer must remain visible');assert.deepEqual(await p.evaluate(measureEmpty),[]);
  }
  for(const tag of ['fieldset','details','form','nav','dl','table']){
   await p.setContent('<'+tag+' style="display:block;background:#fff7e6;border:1px solid #ccc;width:100px;min-height:30px"></'+tag+'>');
   assert((await p.evaluate(measureEmpty)).some(i=>i.kind==='empty-painted-container'),'Must reject empty '+tag);
  }
  for(const label of ['TODO','—']){await p.setContent('<link rel="stylesheet" href="/assets/style.css"><div class="note">'+label+'</div>');assert((await p.evaluate(measureEmpty)).some(i=>i.kind==='placeholder-only-surface'));}
  for(const url of ['/zengin-kana/','/yakuin-shataku/','/column/shisanhyo-mikata/','/column/shukkin-denpyo/']){await ready(p,server.origin+url);assert.deepEqual(await p.evaluate(measureEmpty),[],url);}
  await ready(p,server.origin+'/zengin-kana/');assert(!(await p.locator('#copyErr').isVisible()));
  await p.locator('#names').fill('株式会社ヤマダ');await p.locator('#run').click();assert(await p.locator('#copyAll').isVisible());
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));
  await p.locator('#copyAll').click();assert.match(await p.locator('#copyErr').innerText(),/コピーできませんでした/);assert.deepEqual(await p.evaluate(measureEmpty),[]);
  await p.locator('#names').fill('');await p.locator('#run').click();assert(!(await p.locator('#copyErr').isVisible()));assert(!(await p.locator('#copyAll').isVisible()));assert.deepEqual(await p.evaluate(measureEmpty),[]);
  await ready(p,server.origin+'/shiharai-site/');await p.locator('#label').fill('表示検査');await p.locator('#save').click();assert((await p.locator('#saved').innerText()).includes('表示検査'));assert.deepEqual(await p.evaluate(measureEmpty),[]);
  await ready(p,server.origin+'/embed/tedori/');await p.locator('summary').click();assert.deepEqual(await p.evaluate(measureEmpty),[]);await p.locator('summary').click();assert.deepEqual(await p.evaluate(measureEmpty),[]);
 }
 // Initial empty live regions must be absent even if no application JS executes.
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:1280,height:900}});await noJs.route('**/*',r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());const n=await noJs.newPage();for(const [url,id]of [['/zengin-kana/','#copyErr'],['/yakuin-shataku/','#menseki-note']]){await n.goto(server.origin+url);assert(!(await n.locator(id).isVisible()));}await noJs.close();
 await c.close();
}finally{await browser.close();server.close();}
console.log('✓ Empty surfaces: 10 empty mutations + 6 container mutations + 2 placeholder mutations × 2 widths; messages appear/clear; four regressions; denied clipboard → clear');
