import fs from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
const dir='review-evidence/r16-t10-a/',pages=JSON.parse(fs.readFileSync(dir+'coverage-before.json')).map(r=>'/'+r.page.replace(/^docs\//,'').replace(/index.html$/,''));
const {chromium}=await browserTools(),server=await serve();let browser;const result=[];
try {browser=await chromium.launch();const ctx=await contextFor(browser,server.origin);const page=await ctx.newPage();
 for(const url of pages)for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await ready(page,server.origin+url);const r=await page.evaluate(measure);result.push({url,width,...r});
  if(r.issues.length)console.log(url,width,JSON.stringify(r.issues));
 }
}finally{await browser?.close();server.close();}
fs.writeFileSync(dir+'target-layout.json',JSON.stringify(result,null,2)+'\n');console.log('bad',result.filter(x=>x.issues.length).length,'/',result.length);
