import{browserTools,serve,contextFor,ready}from'../../tests/layout/browser.mjs';
import{measure}from'../../tests/layout/measure.mjs';
import{measureEmpty}from'../../tests/layout/empty-measure.mjs';
import{measureUi}from'../../tests/layout/ui-measure.mjs';
import{writeFileSync}from'node:fs';
const{chromium}=await browserTools(),server=await serve(),browser=await chromium.launch(),results=[];
try{const context=await contextFor(browser,server.origin),page=await context.newPage();for(const url of ['/column/','/column/seimei-hokenryo-kojo/','/jishin-hoken-kojo/','/seimei-hoken-kojo/'])for(const width of[390,1280]){await page.setViewportSize({width,height:900});await ready(page,server.origin+url);const r=await page.evaluate(measure);r.issues.push(...await page.evaluate(measureEmpty),...await page.evaluate(measureUi));results.push({url,width,...r});}await context.close();}finally{await browser.close();server.close();}
writeFileSync('reports/r16-t1-z/generated-pages-check.json',JSON.stringify(results,null,2)+'\n');console.log('Generated pages:',results.length,'checks;',results.filter(r=>r.issues.length).length,'failures');if(results.some(r=>r.issues.length))process.exitCode=1;
