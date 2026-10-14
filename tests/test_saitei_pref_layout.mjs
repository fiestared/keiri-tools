import assert from 'node:assert/strict';
import {join} from 'node:path';
import {browserTools,serve,contextFor,ready,outputDir} from './layout/browser.mjs';
const {chromium}=await browserTools(),server=await serve(),browser=await chromium.launch();
const out=outputDir();
try{
 const context=await contextFor(browser,server.origin),page=await context.newPage();
 for(const slug of ['tokyo','akita','kyoto','iwate','okinawa']){
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await ready(page,server.origin+'/saitei-chingin/'+slug+'/');
   const measurements=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,
    lead:document.querySelector('#pref-lead').getBoundingClientRect().width,
    boundary:document.querySelector('#pref-boundary').getBoundingClientRect().width,
    empty:[...document.querySelectorAll('.callout,.note,.summary-box,.result')].filter(e=>getComputedStyle(e).display!=='none'&&!e.innerText.trim()).length}));
   assert.ok(measurements.overflow<=1,slug+' @'+width+' has page overflow');assert.ok(measurements.lead>200);assert.ok(measurements.boundary>200);assert.equal(measurements.empty,0);
   await page.screenshot({path:join(out,`saitei-${slug}-${width}.png`),fullPage:true});
  }
  await page.emulateMedia({media:'print'});
  for(const selector of ['#pref-lead','#pref-current','#pref-boundary','#pref-monthly','#pref-sources'])assert.ok(await page.locator(selector).isVisible(),slug+' print '+selector);
  assert.ok(!(await page.locator('#pref-print').isVisible()));
  const pdf=await page.pdf({path:join(out,`saitei-${slug}.pdf`),format:'A4',printBackground:true});
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,1,slug+' must print on one A4 page');
  await page.emulateMedia({media:'screen'});
 }
 await context.close();
}finally{await browser.close();server.close();}
console.log('✓ 最低賃金5県 × 1280/390: 横はみ出し・空枠なし。印刷に金額・発効境界・月給例・出典が残る');
