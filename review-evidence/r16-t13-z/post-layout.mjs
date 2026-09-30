// Recheck all changed HTML at the same six viewport sizes after the final source/derived updates.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready,ROOT} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
const files=execFileSync('git',['diff','--name-only','origin/main','--','docs'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(x=>x.endsWith('/index.html'));
const sizes=[[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]],rows=[];
const {chromium}=await browserTools(),server=await serve();let browser;
try{
 browser=await chromium.launch();const context=await contextFor(browser,server.origin);const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(String(e)));
 for(const file of files){const url='/'+file.replace(/^docs\//,'').replace(/index\.html$/,'');
  for(const [width,height] of sizes){errors=[];await page.setViewportSize({width,height});await ready(page,server.origin+url);const m=await page.evaluate(measure);m.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));
   if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))m.issues.push({kind,text:'TOC related rail'});
   if(width===1280){await page.emulateMedia({media:'print'});m.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:'screen'});}
   rows.push({file,url,width,height,...m,errors});
  }console.log(file+' 6 sizes');
 }await context.close();
}finally{await browser?.close();server.close();}
fs.writeFileSync(new URL('./post-layout.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');const bad=rows.filter(x=>x.errors.length||x.issues.length);assert.equal(bad.length,0,JSON.stringify(bad));console.log(`PASS ${files.length} pages / ${rows.length} viewports`);
