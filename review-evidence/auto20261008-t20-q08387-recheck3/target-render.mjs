import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
const names=['gasolindai-kanjo-kamoku','shukkin-denpyo','invoice-2wari-tokurei','invoice-wakariyasuku','kani-kazei','gyomuitaku-kakutei-shinkoku','kakutei-shinkoku-zeirishi-hiyo','chushajodai-kanjo-kamoku','furikomi-tesuryo-kanjo-kamoku','denchoho-wakariyasuku','denchoho-kensaku-yoken','../denchoho-index','hojin-nari'];
const {chromium}=await browserTools(),server=await serve();let browser;const results=[];
try {
 browser=await chromium.launch();const context=await contextFor(browser,server.origin);const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(String(e)));
 for (const name of names) for (const [width,height] of [[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]]) {
  errors=[];await page.setViewportSize({width,height});const url=name==='../denchoho-index'?'/denchoho-index/':'/column/'+name+'/';await ready(page,server.origin+url);const measured=await page.evaluate(measure);
  measured.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))measured.issues.push({kind,text:'TOC related rail'});
  if(width===1280){await page.emulateMedia({media:'print'});measured.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:'screen'});}
  for(const error of errors)measured.issues.push({kind:'page-error',text:error});results.push({url,width,height,...measured});
 }
 await context.close();
}finally{await browser?.close();server.close();}
writeFileSync(new URL('./target-layout-final.json',import.meta.url),JSON.stringify(results,null,2)+'\n');assert.equal(results.filter(r=>r.issues.length).length,0,'Changed page layout defects');console.log('✓ Changed pages: 13 × 6 sizes = 78, print and geometry checked');
