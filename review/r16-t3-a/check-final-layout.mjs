/** Full-site rendered geometry gate. See tests/layout/README.md. */
import {readdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready,DOCS,outputDir} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
const pages=['/column/nenshu-no-kabe/','/column/shakai-hoken-kanyu-joken/','/embed/kabe/','/kabe/'];
assert(pages.length>0,'No pages discovered');
const sizes=[[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]];
const jobs=pages.flatMap(url=>sizes.map(([width,height])=>({url,width,height})));const results=[];
const progress='review/r16-t3-a/layout-final-progress.ndjson';writeFileSync(progress,'');
const {chromium}=await browserTools();const server=await serve();let browser;
try{
 browser=await chromium.launch();
 const context=await contextFor(browser,server.origin);const page=await context.newPage();let errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 for(const job of jobs){
  errors=[];
  try{
   await page.setViewportSize({width:job.width,height:job.height});
   // Fresh desktop and mobile loads; the other four sizes additionally test
   // responsive transitions without loading the same article six times.
   if(job.width===1280||job.width===390||page.url()!==server.origin+job.url)await ready(page,server.origin+job.url);
   else {await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
   const measured=await page.evaluate(measure);
   measured.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));
   if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))measured.issues.push({kind,text:'TOC related rail'});
   if(job.width===1280){await page.emulateMedia({media:'print'});measured.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:'screen'});}
   for(const error of errors)measured.issues.push({kind:'page-error',text:error});
   results.push({...job,...measured});
  }catch(error){results.push({...job,error:String(error)});}
  appendFileSync(progress,JSON.stringify(results.at(-1))+'\n');
 }
 await context.close();
}finally{await browser?.close();server.close();}
const out='review/r16-t3-a/layout-final.json';writeFileSync(out,JSON.stringify(results,null,2));
assert.equal(results.length,jobs.length,'Every page must be measured at all six sizes');
assert.equal(new Set(results.map(r=>r.url+'|'+r.width)).size,jobs.length,'Duplicate/missing measurements');
const bad=results.filter(r=>r.error||r.issues.length);
if(bad.length){console.error(bad.slice(0,30).map(r=>`${r.url} @${r.width}: ${r.error||r.issues.map(x=>x.kind+': '+x.text).join('; ')}`).join('\n'));throw Error(`${bad.length}/${jobs.length} page/viewports failed. Full measurements: ${out}`);}
console.log(`✓ Layout: ${pages.length} pages × 6 sizes = ${results.length}; no skipped pages. ${out}`);
