/** Reuse real inputs from the existing integration scenarios, never guessed
 * placeholders. Automatically discovered core tools must have a scenario. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {browserTools,serve,contextFor,ready,DOCS,ROOT,outputDir} from './layout/browser.mjs';
import {measureEmpty} from './layout/empty-measure.mjs';
const tools=readdirSync(DOCS,{recursive:true}).filter(f=>f.endsWith('/index.html')&&!f.startsWith('column/')).filter(f=>/assets\/[a-z_]+_core\.js/.test(readFileSync(join(DOCS,f),'utf8'))).map(f=>'/'+f.replace(/index.html$/,''));
let harness=readFileSync(new URL('../tools/e2e/harness.html',import.meta.url),'utf8');
harness=harness.slice(0,harness.lastIndexOf('let state;'))+'window.__scenes=SCENES;window.__ready=true;</script>';
const {chromium}=await browserTools(),server=await serve(),browser=await chromium.launch();const results=[];
try{for(const width of [1280,390]){
 const c=await contextFor(browser,server.origin,width);
 await c.route(server.origin+'/**',async route=>{const u=new URL(route.request().url());if(/^\/tests\/fixtures\/[a-zA-Z0-9_.-]+\.json$/.test(u.pathname))return route.fulfill({contentType:'application/json',body:readFileSync(join(ROOT,u.pathname))});if(u.pathname==='/__harness')return route.fulfill({contentType:'text/html',body:harness});if(u.pathname.startsWith('/docs/'))return route.continue({url:server.origin+u.pathname.slice(5)+u.search});return route.continue();});
 const p=await c.newPage();let runtimeErrors=[];p.on('pageerror',e=>runtimeErrors.push(String(e)));await p.goto(server.origin+'/__harness');await p.waitForFunction(()=>window.__ready);
 await p.locator('iframe').evaluate((e,w)=>e.style.width=w+'px',width);
 const scenes=await p.evaluate(()=>Object.entries(window.__scenes).map(([name,fn])=>({name,source:String(fn)})));
 const plan=tools.map(url=>{
  if(url.startsWith('/embed/'))return {url,scene:'embed_'+url.split('/')[2]};
  const candidates=scenes.filter(s=>!/(nodata|slow|stale|bad|invalid|error|empty|missing|_ng|beyond|track_)/.test(s.name)&&s.source.includes('"/docs'+url+'"'));
  return {url,scene:candidates[0]?.name};
 });
 assert(plan.every(j=>j.scene&&scenes.some(s=>s.name===j.scene)),'Missing normal scenario: '+JSON.stringify(plan.filter(j=>!j.scene)));
 for(const job of plan){
  runtimeErrors=[];const row={...job,width,states:[]};results.push(row);console.log(width,job.url,job.scene);
  try{
   row.normalEvidence=await p.evaluate(async name=>JSON.stringify(await window.__scenes[name]()).slice(0,600),job.scene);
   const frame=p.frames().find(f=>f!==p.mainFrame());assert(frame,'Tool iframe');
   if(job.url.startsWith('/hojokin/')&&new URL(frame.url()).pathname.replace(/^\/docs/,'')!==job.url)await ready(frame,server.origin+job.url);
   assert.equal(new URL(frame.url()).pathname.replace(/^\/docs/,''),job.url,'Scenario must leave requested tool visible');
   const scan=async state=>{await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const issues=await frame.evaluate(measureEmpty);const overflow=await frame.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));if(overflow.scrollWidth>overflow.width+1)issues.push({kind:'page-overflow-after-action',...overflow});row.states.push({state,issues});};
   const normalOutputs=await frame.locator('.result,#out').evaluateAll(es=>es.map(e=>({id:e.id,visible:!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden',text:e.innerText.trim().slice(0,300)})));
   row.outputs=normalOutputs;if(normalOutputs.length)assert(normalOutputs.some(e=>e.visible&&e.text&&!/読み込めませんでした|計算中|判定中/.test(e.text)),'Normal input must produce visible content, not merely a hidden empty box');
   await scan('calculated');
   // Existing scenes supplied valid values. Record the actual action control;
   // negative/out-of-range values and then empty input exercise state cleanup.
   const inputCount=await frame.locator('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]),textarea').count();
   row.inputs=inputCount;
   const initialValues=await frame.evaluate(()=>[...document.querySelectorAll('input,textarea')].map(e=>e.value));
   for(const state of ['error-input','cleared','recalculated']){
    await frame.evaluate(({state,initialValues})=>{
     let index=0;for(const e of document.querySelectorAll('input,textarea')){
      const original=initialValues[index++];
      if(['hidden','radio','checkbox','button','submit','range','color','file'].includes(e.type)||e.disabled||e.readOnly)continue;
      e.value=state==='recalculated'?original:state==='cleared'?'':e.type==='date'?'1900-01-01':e.type==='number'?'-1':'!';
      e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
     }
     const button=[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&(e.matches('#calc,#run')||/(計算する|試算する|変換する|判定する)/.test(e.textContent.trim())));button?.click();
    },{state,initialValues});
    await frame.waitForTimeout(100);await scan(state);
   }
   if(!inputCount)row.reason='選択肢のみ。自由入力によるエラー・クリアはないため現在の選択状態で再描画を検査。';
  }catch(e){row.error=String(e);}
  row.pageErrors=runtimeErrors;
 }
 await c.close();
}}finally{await browser.close();server.close();}
writeFileSync(join(outputDir(),'empty-tool-states.json'),JSON.stringify(results,null,2));
const bad=results.filter(r=>r.error||r.pageErrors.length||r.states.some(s=>s.issues.length));
assert.deepEqual(bad,[],'All tool state surfaces must contain visible content');
console.log(`✓ Empty tool states: ${tools.length} tools × 2 widths × calculated/error/cleared/recalculated; no page exclusions`);
