/** Full-site rendered geometry gate. See tests/layout/README.md. */
import {readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready,DOCS,outputDir} from './layout/browser.mjs';
import {measure} from './layout/measure.mjs';
const pages=readdirSync(DOCS,{recursive:true}).filter(f=>f==='index.html'||f.endsWith('/index.html')).sort().map(f=>'/'+f.replace(/index.html$/,''));
assert(pages.length>0,'No pages discovered');
const jobs=[1280,390].flatMap(width=>pages.map(url=>({url,width})));const results=[];let next=0;
const {chromium}=await browserTools();const server=await serve();let browser;
try{
 browser=await chromium.launch();
 await Promise.all(Array.from({length:4},async()=>{const context=await contextFor(browser,server.origin);const page=await context.newPage();let errors=[];page.on('pageerror',error=>errors.push(String(error)));
  while(next<jobs.length){const job=jobs[next++];errors=[];try{await page.setViewportSize({width:job.width,height:900});await ready(page,server.origin+job.url);const measured=await page.evaluate(measure);for(const error of errors)measured.issues.push({kind:'page-error',text:error});results.push({...job,...measured});}catch(error){results.push({...job,error:String(error)});}}
  await context.close();
 }));
}finally{await browser?.close();server.close();}
const out=join(outputDir(),'render.json');writeFileSync(out,JSON.stringify(results,null,2));
assert.equal(results.length,jobs.length,'Every page must be measured at both widths');
assert.equal(new Set(results.map(r=>r.url+'|'+r.width)).size,jobs.length,'Duplicate/missing measurements');
const bad=results.filter(r=>r.error||r.issues.length);
if(bad.length){console.error(bad.slice(0,30).map(r=>`${r.url} @${r.width}: ${r.error||r.issues.map(x=>x.kind+': '+x.text).join('; ')}`).join('\n'));throw Error(`${bad.length}/${jobs.length} page/viewports failed. Full measurements: ${out}`);}
console.log(`✓ Layout: ${pages.length} pages × 2 widths = ${results.length}; no skipped pages. ${out}`);
