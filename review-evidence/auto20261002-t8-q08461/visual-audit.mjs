import {writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
import assert from 'node:assert/strict';
const E='review-evidence/auto20261002-t8-q08461/';
const {chromium}=await browserTools();const server=await serve();let browser;
try{
 browser=await chromium.launch();const context=await contextFor(browser,server.origin);const page=await context.newPage();const rows=[];
 for(const [width,height] of [[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await ready(page,server.origin+'/column/furikomi-tesuryo-hikaku/');
  const measured=await page.evaluate(measure);measured.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));
  if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))measured.issues.push({kind,text:'TOC related rail'});
  if(width===1280){await page.emulateMedia({media:'print'});measured.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:'screen'});}
  assert.equal(measured.issues.length,0,JSON.stringify({width,issues:measured.issues}));
  rows.push({...measured,...await page.evaluate(()=>({width:innerWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,svg:[...document.querySelectorAll('article figure svg text')].map(t=>({text:t.textContent,bounds:t.getBBox().toJSON?.()||{x:t.getBBox().x,y:t.getBBox().y,width:t.getBBox().width,height:t.getBBox().height}}))}))});
  if([1280,390].includes(width))await page.locator('article figure').screenshot({path:E+'figure-'+width+'.png',style:'header.site{visibility:hidden!important}'});
 }
 writeFileSync(E+'visual-audit.json',JSON.stringify(rows,null,2)+'\n');console.log(rows.map(x=>({width:x.width,pageOverflow:x.pageOverflow})));
}finally{if(browser)await browser.close();server.close();}
