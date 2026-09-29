import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {browserTools,serve,contextFor,ready,DOCS} from './layout/browser.mjs';
import {measureToc} from './layout/toc-measure.mjs';
const {chromium}=await browserTools();const server=await serve();let b;
try{
 b=await chromium.launch();const c=await contextFor(b,server.origin);const p=await c.newPage();
 await c.addInitScript(()=>Object.defineProperty(window,'__events',{get:()=>Array.from(window.dataLayer||[],e=>Array.from(e))}));
 for(const width of [1280,390])for(const path of ['/column/furikomi-tesuryo-hikaku/','/column/shakai-hoken-kanyu-joken/','/column/hoteichosho-goukeihyo/','/ikuji/','/iryohi/','/izoku/','/column/orcan-vs-emaxis-sp/']){
  await p.setViewportSize({width,height:900});await ready(p,server.origin+path);
  assert.deepEqual(await p.evaluate(measureToc),[],path+' '+width);
  const btn=p.locator('.toc-toggle'),list=p.locator('.toc > ol');
  if(await btn.isVisible()){
   // PC（1200px以上）は最初から開く・スマホは最初は閉じる（2026-09-29）
   const initOpen=width>=1200;assert.equal(await btn.getAttribute('aria-expanded'),String(initOpen));assert.equal(await list.isVisible(),initOpen);
   if(initOpen){await btn.click();assert.equal(await btn.getAttribute('aria-expanded'),'false');}
   await btn.click();assert.equal(await btn.getAttribute('aria-expanded'),'true');assert(await list.isVisible());
   await btn.click();assert.equal(await btn.getAttribute('aria-expanded'),'false');assert(!await list.isVisible());
   await btn.focus();await p.keyboard.press('Enter');assert(await list.isVisible());
   assert.notEqual(await btn.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
   await p.keyboard.press('Space');assert(!await list.isVisible());
   const events=await p.evaluate(()=>window.__events.filter(e=>e[1]==='toc_toggle'));
   assert.equal(events.length,initOpen?5:4);assert(!await p.evaluate(()=>window.__events.some(e=>e[1]==='tool_input')));
   await btn.click();const link=p.locator('.toc a').first();const hash=await link.getAttribute('href');await link.click();assert.equal(new URL(p.url()).hash,hash);
   await btn.click();
  }else assert(await list.isVisible(),'short TOC stays open');
  await p.locator('.rail-next').scrollIntoViewIfNeeded();await p.waitForFunction(()=>window.__events.some(e=>e[1]==='workflow_view'),{},{timeout:5000});
  assert.equal(await p.evaluate(()=>window.__events.filter(e=>e[1]==='workflow_view').length),1,JSON.stringify({path,width,info:await p.evaluate(()=>({rect:document.querySelector('.rail-next').getBoundingClientRect().toJSON(),hidden:document.hidden,events:window.__events}))}));
  await p.evaluate(()=>document.querySelector('.rail-next a').addEventListener('click',e=>e.preventDefault()));await p.locator('.rail-next a').first().click();
  if(path.startsWith('/column/'))assert(await p.evaluate(()=>window.__events.some(e=>['internal_link_click','tool_link_click'].includes(e[1]))),'legacy article referral preserved');
  const click=await p.evaluate(()=>window.__events.find(e=>e[1]==='workflow_click'));
  assert.equal(click[2].slot,'toc_related_v1');assert(!/[?#]/.test(click[2].link_url));
  await p.emulateMedia({media:'print'});assert(await list.isVisible());assert(!await p.locator('.rail-next').isVisible());await p.emulateMedia({media:'screen'});
  await p.evaluate(()=>scrollTo(0,document.body.scrollHeight));
  const overlap=await p.evaluate(()=>document.querySelector('.side-rail').getBoundingClientRect().bottom>document.querySelector('footer.site').getBoundingClientRect().top);assert(!overlap,'rail overlaps footer');
 }
 // Every PR rail must fit the smallest requested desktop, both closed and expanded.
 const prPages=readdirSync(DOCS,{recursive:true}).filter(f=>f.endsWith('/index.html')&&readFileSync(join(DOCS,f),'utf8').includes('data-pr-slot="rail-before-toc:'));
 assert(prPages.length>0);
 for(const file of prPages){
  await p.setViewportSize({width:1200,height:800});await ready(p,server.origin+'/'+file.replace(/index.html$/,''));
  if(!await p.locator('.rail-next').count())continue;
  assert.deepEqual(await p.evaluate(measureToc),[],file);
  const btn=p.locator('.toc-toggle');
  for(const step of [0,1]){
   if(step===1){if(!await btn.isVisible())break;await btn.click();}
   const fit=await p.locator('.side-rail').evaluate(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,scroll:e.scrollHeight,height:e.clientHeight}));
   assert(fit.top>=60&&fit.bottom<=781&&fit.scroll<=fit.height+1,JSON.stringify({file,step,fit}));
  }
 }
 // Real-browser mutations reuse the same geometry assertions.
 for(const width of [1280,390]){
  await p.setViewportSize({width,height:900});
  for(const [css,kind]of [['.rail-next {display:none!important}','related-hidden'],['.rail-next {margin-left:17px!important}','related-alignment'],['.toc-toggle {min-height:0!important;height:12px!important}','toggle-target']]){
   await ready(p,server.origin+'/column/shakai-hoken-kanyu-joken/');await p.addStyleTag({content:css});assert((await p.evaluate(measureToc)).includes(kind),'mutation missed '+kind);
  }
  await ready(p,server.origin+'/column/shakai-hoken-kanyu-joken/');await p.locator('.toc-toggle').evaluate(e=>e.setAttribute('aria-expanded',String(e.getAttribute('aria-expanded')!=='true')));assert((await p.evaluate(measureToc)).includes('toggle-state'));
 }
 const nojs=await b.newContext({javaScriptEnabled:false,viewport:{width:1280,height:900}});await nojs.route('**/*',r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());const n=await nojs.newPage();await n.goto(server.origin+'/column/furikomi-tesuryo-hikaku/');assert(await n.locator('.toc > ol').isVisible());assert(await n.locator('.rail-next').isVisible());assert.equal(await n.locator('.toc-toggle').count(),0);
 console.log('✓ TOC: both widths, repeated mouse/Enter/Space, focus, jump, telemetry, print, no-JS, footer and 8 mutations');
}finally{await b?.close();server.close();}
