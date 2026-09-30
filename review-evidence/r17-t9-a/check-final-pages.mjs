import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
const pages=['/column/part-yukyu/','/yukyu/'];
const {chromium}=await browserTools(),server=await serve();let browser;const results=[];
try{
 browser=await chromium.launch();const context=await contextFor(browser,server.origin),page=await context.newPage();
 for(const url of pages)for(const width of [1280,1536,1920,1200,768,390]){
  await page.setViewportSize({width,height:900});await ready(page,server.origin+url);
  const result=await page.evaluate(measure);result.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));
  const updated=await page.locator('.article-meta time').last().getAttribute('datetime');
  const expected=readFileSync('docs'+url+'index.html','utf8').match(/"dateModified"\s*:\s*"([0-9-]+)"/)[1];
  assert.equal(updated,expected);assert.deepEqual(result.issues,[]);results.push({url,width,updated,issues:result.issues});
 }
 await context.close();
}finally{await browser?.close();server.close();}
writeFileSync('review-evidence/r17-t9-a/final-pages.json',JSON.stringify(results,null,2)+'\n');console.log('更新日補正後の対象2ページ×6サイズ: 12画面緑。可視更新日とJSON-LD一致。');
