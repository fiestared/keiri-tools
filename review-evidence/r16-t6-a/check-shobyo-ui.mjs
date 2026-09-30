import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
const {chromium}=await browserTools();const server=await serve();let browser;
try{
 browser=await chromium.launch();const context=await contextFor(browser,server.origin,390);const page=await context.newPage();
 for(const path of ['/shobyo/','/embed/shobyo/']){
  await ready(page,server.origin+path);await page.locator('#startDate').fill('2026-09-01');await page.locator('#monthly').fill('500000');await page.locator('#months').fill('3');await page.locator('#restDays').fill('30');await page.locator('#taikiDone').check();await page.locator('#taishokugo').check();
  await page.locator('#calc').click();let result=await page.locator('#result').innerText();assert.match(result,/加入期間を確認/);assert.doesNotMatch(result,/¥0|支給されません/);
  await page.locator('#continuationMonths').fill('11');await page.locator('#calc').click();result=await page.locator('#result').innerText();assert.match(result,/支給されません/);
  await page.locator('#continuationMonths').fill('12');await page.locator('#calc').click();result=await page.locator('#result').innerText();assert.match(result,/7,113/);assert.match(result,/継続給付/);assert.doesNotMatch(result,/支給されません/);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,path+' horizontal overflow');
  await page.locator('#continuationMonths').scrollIntoViewIfNeeded();await page.screenshot({path:'review-evidence/r16-t6-a/'+(path.includes('embed')?'embed-':'')+'shobyo-input.png'});console.log(path+' blank → unconfirmed; 11 → ineligible; 12 → 7,113/day; width390 OK');
 }
 const navigation=[];
 for(const path of ['/column/shussan-ikuji-ichijikin/','/column/kounenrei-koyou-keizoku/'])for(const width of [1280,1536,1920,1200,768,390]){
  await page.setViewportSize({width,height:900});await ready(page,server.origin+path);
  const r=await page.evaluate(measure);r.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));
  if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))r.issues.push({kind});
  if(width===1280){await page.emulateMedia({media:"print"});r.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:"screen"});}
  assert.equal(r.issues.length,0,JSON.stringify({path,width,issues:r.issues}));navigation.push({path,width,...r});
 }
 writeFileSync('review-evidence/r16-t6-a/navigation-layout-final.json',JSON.stringify(navigation,null,2)+'\n');console.log('Updated navigation: 2 pages × 6 widths green');
}finally{if(browser)await browser.close();server.close();}
