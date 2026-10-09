import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
const server=await serve();const {chromium}=await browserTools();let browser;const results=[];
try {
 browser=await chromium.launch();const context=await contextFor(browser,server.origin);const page=await context.newPage();
 for (const url of ['/column/hyojun-hoshu-gakuhyo/','/column/kyushoku-shakai-hokenryo/']) for(const [width,height] of [[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]]) {
  await page.setViewportSize({width,height});await ready(page,server.origin+url);const x=await page.evaluate(measure);x.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));results.push({url,width,height,...x});
 }
 await context.close();
}finally{await browser?.close();server.close();}
writeFileSync(new URL('./layout-target.json',import.meta.url),JSON.stringify(results,null,2)+'\n');assert.equal(results.filter(x=>x.issues.length).length,0);console.log('対象2ページ × 6サイズ: 全12ケース緑');
