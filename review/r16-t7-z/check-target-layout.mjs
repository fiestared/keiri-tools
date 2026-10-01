import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
const {chromium,version}=await browserTools();const server=await serve();let browser;const rows=[];
try {
 browser=await chromium.launch();writeFileSync('review/r16-t7-z/browser-environment.json',JSON.stringify({platform:process.platform,arch:process.arch,playwright:version,browser:browser.version(),deviceScaleFactor:1},null,2));const context=await contextFor(browser,server.origin);const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(String(e)));
 for(const url of ['/column/kounenrei-kyushokusha-kyufukin/','/saishushoku/'])for(const [width,height] of [[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]]){
  errors=[];await page.setViewportSize({width,height});await ready(page,server.origin+url);
  const m=await page.evaluate(measure);m.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));
  if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))m.issues.push({kind,text:'TOC rail'});
  if(width===1280){await page.emulateMedia({media:'print'});m.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:'screen'});}
  for(const error of errors)m.issues.push({kind:'page-error',text:error});rows.push({url,width,height,...m});
  if(url.includes('/column/') && [1280,390].includes(width))await page.locator('figure:has(svg[aria-label^="離職日から1年"])').screenshot({path:`review/r16-t7-z/timeline-${width}.png`});
  if(url.includes('/column/') && [1280,390].includes(width))await page.locator('figure:has(svg[aria-label^="65歳以上か"])').screenshot({path:`review/r16-t7-z/qualification-${width}.png`});
 }
 await context.close();
} finally {await browser?.close();server.close();}
writeFileSync('review/r16-t7-z/target-layout-final.json',JSON.stringify(rows,null,2));
assert.equal(rows.length,12);const bad=rows.filter(r=>r.issues.length);assert.equal(bad.length,0,JSON.stringify(bad,null,2));console.log('12/12 target page/viewports green, including print, UI and SVG geometry.');
