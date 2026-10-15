import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { browserTools, serve, contextFor, ready, outputDir } from './layout/browser.mjs';
import { measure } from './layout/measure.mjs';
import { measureEmpty } from './layout/empty-measure.mjs';
import { measureUi } from './layout/ui-measure.mjs';
import { measureTables } from './layout/table-measure.mjs';
const {chromium}=await browserTools(), server=await serve(), browser=await chromium.launch();
const out=outputDir()+'/nenrei';mkdirSync(out,{recursive:true});
try {
 for (const width of [1280,390]) {
  const context=await contextFor(browser,server.origin,width), page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await ready(page,server.origin+'/nenrei-hayami/');
  assert.equal(await page.locator('.nenrei-year:visible').count(),1);
  assert.equal(await page.locator('.nenrei-year:visible tbody tr').count(),121);
  await page.screenshot({path:`${out}/screen-${width}.png`});
  await page.locator('#convert-year').fill('2019');await page.locator('#convert-month').fill('5');await page.locator('#convert-day').fill('1');
  await page.locator('#convert-submit').click();assert.equal(await page.locator('#convert-result').isVisible(),true);assert.equal(await page.locator('#convert-result').innerText(),'令和元年5月1日');
  await page.locator('#convert').screenshot({path:`${out}/convert-${width}.png`});
  await page.locator('#direction').selectOption('wareki');assert.equal(await page.locator('#convert-year').inputValue(),'');await page.locator('#convert-year').fill('元');
  await page.locator('#convert-month').fill('4');await page.locator('#convert-day').fill('30');await page.locator('#convert-submit').click();
  assert.match(await page.locator('#convert-result').innerText(),/期間外/);
  await page.locator('#convert-year').fill('');assert.equal(await page.locator('#convert-result').isVisible(),false);
  await page.locator('#convert-year').fill('元');await page.locator('#convert-month').fill('5');await page.locator('#convert-day').fill('1');await page.locator('#convert-submit').click();
  assert.equal(await page.locator('#convert-result').innerText(),'2019年5月1日');
  await page.locator('#birth').fill('2000-02-29');await page.locator('#reference').fill('2026-02-28');await page.locator('#age-submit').click();
  assert.match(await page.locator('#age-result').innerText(),/25歳/);
  await page.locator('#reference').fill('2026-03-01');await page.locator('#age-submit').click();assert.match(await page.locator('#age-result').innerText(),/26歳/);
  const geometry=await page.evaluate(measure);
  const issues=[...geometry.issues,...await page.evaluate(measureEmpty),...await page.evaluate(measureUi),...await page.evaluate(measureTables)];
  assert.deepEqual(issues,[],`${width}px layout issues: ${JSON.stringify(issues)}`);assert.deepEqual(errors,[]);
  await page.locator('#table-year').selectOption('2027');
  assert.equal(await page.locator('.nenrei-year:visible caption').innerText(),'2027年版 年齢早見表');
  await page.evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=true;};});await page.locator('#print-table').click();assert.equal(await page.evaluate(()=>window.__printed),true);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.nenrei-year:visible').count(),1);
  assert.equal(await page.locator('#convert').isVisible(),false);assert.equal(await page.locator('#sources').isVisible(),true);
  assert.match(await page.locator('#sources').innerText(),/確認日: 2026年10月14日/);
  await page.screenshot({path:`${out}/print-${width}.png`});
  if(width===1280)await page.pdf({path:`${out}/2027.pdf`,preferCSSPageSize:true});
  await context.close();
 }
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}), page=await context.newPage();
 await page.goto(server.origin+'/nenrei-hayami/',{waitUntil:'load'});assert.equal(await page.locator('.nenrei-year:visible').count(),2);assert.equal(await page.locator('.nenrei-year tbody tr').count(),242);
 await context.close();
 console.log('✓ 年齢ツール: 1280/390px、変換・不正→クリア→再計算・閏日・印刷・JS無効');
} finally {await browser.close();server.close();}
