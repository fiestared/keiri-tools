import {writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureTables} from '../../tests/layout/table-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
import {measureLeftAccent} from '../../tests/layout/accent-measure.mjs';
import {incomes} from '../../tools/gen_tedori_income_pages.mjs';
const dir=new URL('./',import.meta.url),{chromium}=await browserTools(),server=await serve();let browser;const rows=[];
try{
 browser=await chromium.launch();const c=await contextFor(browser,server.origin),p=await c.newPage();
 for(const url of ['/tedori/nenshu/',...incomes.map(n=>`/tedori/nenshu/${n}/`)])for(const [width,height] of [[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]]){
  await p.setViewportSize({width,height});await ready(p,server.origin+url);
  const result=await p.evaluate(measure);result.issues.push(...await p.evaluate(measureUi),...await p.evaluate(measureEmpty),...await p.evaluate(measureTables));
  if(width===1280||width===390)result.issues.push(...await p.evaluate(measureLeftAccent));
  if(await p.locator('.rail-next').count())for(const kind of await p.evaluate(measureToc))result.issues.push({kind,text:'TOC related rail'});
  const size=await p.evaluate(()=>({inner:window.innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  if(size.inner!==width||size.scroll>size.client)result.issues.push({kind:'width',...size});
  if(url==='/tedori/nenshu/500/'&&[1280,390].includes(width)){
   await p.screenshot({path:new URL(`final-income-${width}.png`,dir).pathname});
   if(width===390)await p.locator('figure').screenshot({path:new URL('final-figure-390.png',dir).pathname});
  }
  if(width===1280){await p.emulateMedia({media:'print'});result.issues.push(...await p.evaluate(measureUi),...await p.evaluate(measureEmpty));await p.emulateMedia({media:'screen'});}
  rows.push({url,width,issues:result.issues});writeFileSync(new URL('final-visual.json',dir),JSON.stringify(rows,null,2)+'\n');
 }
 await c.close();
}finally{await browser?.close();server.close();}
if(rows.some(r=>r.issues.length))throw Error(JSON.stringify(rows.filter(r=>r.issues.length)));
console.log('PASS: 新規14ページ×6幅（1280/390を含む）、画面と印刷の組版');
