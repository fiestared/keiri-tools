import fs from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
const {chromium}=await browserTools(),server=await serve();let browser;const results=[];
try{browser=await chromium.launch();const context=await contextFor(browser,server.origin),page=await context.newPage();
 for(const url of ['/column/kani-kazei/','/column/reverse-charge/','/senpou-futan/'])for(const [width,height] of [[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await ready(page,server.origin+url);
  const r=await page.evaluate(measure);r.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));
  if(await page.locator('.rail-next').count())r.issues.push(...(await page.evaluate(measureToc)).map(kind=>({kind,text:'TOC related rail'})));
  if(width===1280){await page.emulateMedia({media:'print'});r.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:'screen'});}
  results.push({url,width,height,...r});
 }
}finally{await browser?.close();server.close();}
fs.writeFileSync('review-evidence/r16-t10-a/related-layout.json',JSON.stringify(results,null,2)+'\n');
const bad=results.filter(x=>x.issues.length);console.log('related output layout:',results.length,'measurements;',bad.length,'failed');if(bad.length){console.error(bad);process.exitCode=1;}
