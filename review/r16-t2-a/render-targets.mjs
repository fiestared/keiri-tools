import fs from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
const dir='review/r16-t2-a/rendered';fs.mkdirSync(dir,{recursive:true});
const {chromium}=await browserTools(),server=await serve();let browser;const results=[];
try{
 browser=await chromium.launch();const context=await contextFor(browser,server.origin),page=await context.newPage();
 for(const slug of ['gensen-choshuhyo-mikata','kyuyo-shiharai-hokokusho','shiharai-chosho']){
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await ready(page,server.origin+'/column/'+slug+'/');
   const result=await page.evaluate(measure);results.push({slug,width,...result});
   if(width===1280){const figures=page.locator('figure:has(svg)');for(let i=0;i<await figures.count();i++)await figures.nth(i).screenshot({path:`${dir}/${slug}-${i}.png`});}
  }
 }
 await context.close();
}finally{await browser?.close();server.close();}
fs.writeFileSync(dir+'/measurements.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({slug:x.slug,width:x.width,issues:x.issues})),null,2));
if(results.some(x=>x.issues.length))process.exitCode=1;
