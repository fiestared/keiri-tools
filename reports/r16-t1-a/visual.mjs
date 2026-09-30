import fs from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
const {chromium}=await browserTools();const server=await serve();const browser=await chromium.launch();const results=[];
try{const ctx=await contextFor(browser,server.origin);const page=await ctx.newPage();
for(const path of ['/column/gensen-choshubo/','/column/nenmatsu-chosei-kanpukin/','/column/tokutei-shinzoku-tokubetsu-kojo/','/fuyo-kojo/','/embed/fuyo-kojo/'])for(const width of [390,1280]){
 await page.setViewportSize({width,height:900});await ready(page,server.origin+path);
 const r=await page.evaluate(measure);r.issues.push(...await page.evaluate(measureEmpty),...await page.evaluate(measureUi));results.push({path,width,...r});
 if(path.includes('tokutei-shinzoku')||path.includes('kanpukin')){
  const figures=page.locator('figure');for(let i=0;i<await figures.count();i++)await figures.nth(i).screenshot({path:'reports/r16-t1-a/'+path.split('/').filter(Boolean).at(-1)+'-'+width+'-'+i+'.png'});
 }
}
await ctx.close();}finally{await browser.close();server.close();}
fs.writeFileSync('reports/r16-t1-a/visual.json',JSON.stringify(results,null,2));console.log(results.map(r=>({path:r.path,width:r.width,issues:r.issues})));if(results.some(r=>r.issues.length))process.exitCode=1;
