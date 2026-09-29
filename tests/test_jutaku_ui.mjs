// 入居年追加・経過措置の日付・小規模資格が本体とembedからcoreへ届くことを確認する。
import assert from 'node:assert/strict';
import {measure} from './layout/measure.mjs';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
const {chromium}=await browserTools();
const server=await serve(); let browser;
let count=0;
try {
 browser=await chromium.launch();
 const context=await contextFor(browser,server.origin,390);
 const page=await context.newPage();
 for (const path of ['/jutaku/','/embed/jutaku/']) {
  await ready(page,server.origin+path);
  for (const width of [375,390,1280]) {
   await page.setViewportSize({width,height:900});
   const measured=await page.evaluate(measure);
   assert.deepEqual(measured.issues,[],path+' width='+width+' geometry');
  }
  await page.setViewportSize({width:390,height:900});
  await page.locator('details').first().evaluate(el=>el.open=true);
  assert.deepEqual(await page.locator('#year option').evaluateAll(els=>els.map(e=>Number(e.value))),[2022,2023,2024,2025,2026,2027,2028,2029,2030]);
  await page.locator('#zandaka').fill('60000000');
  await page.locator('#menseki').fill('50');
  await page.locator('#shotoku').fill('10000000');
  await page.locator('#redzone').selectOption('no');
  async function result() {await page.locator('#calc').click();await page.waitForFunction(()=>!document.querySelector('#result').textContent.includes('計算中')); count++;return page.locator('#result').innerText();}
  async function amount(value) {const text=await result(); assert(text.includes('¥'+value.toLocaleString('ja-JP')),path+' '+text);return text;}
  await page.locator('#year').selectOption('2027');
  await amount(140000);
  await page.locator('#year').selectOption('2028');
  await amount(0);
  await page.locator('#confirmation').fill('2027-12-31');
  assert((await amount(140000)).includes('10年'));
  await page.locator('#confirmation').fill('2028-01-01');
  await amount(0);
  await page.locator('#completion').fill('2028-06-30');
  await amount(140000);
  await page.locator('#completion').fill('2028-07-01');
  await amount(0);
  await page.locator('#type').selectOption('kaitori');
  await page.locator('#year').selectOption('2030');
  await page.locator('#tokurei').check();
  assert((await amount(210000)).includes('13年'));
  await page.locator('#menseki').fill('49.9');
  await amount(140000);
  await page.locator('#type').selectOption('shinchiku');
  await page.locator('#kubun').selectOption('sonota');
  await page.locator('#confirmation').fill('');
  await page.locator('#completion').fill('2024-06-30');
  await page.locator('#keika').check();
  assert((await result()).includes('未確認'));
  await page.locator('#confirmation').fill('2023-12-31');
  await amount(140000);
  await page.locator('#confirmation').fill('2024-01-01');
  assert((await amount(0)).includes('建築日だけ') || (await page.locator('#result').innerText()).includes('建築日のみ'));
  await page.locator('#kubun').selectOption('nintei');
  await page.locator('#menseki').fill('50');
  await page.locator('#redzone').selectOption('yes');
  await amount(0);
  await page.locator('#redzone').selectOption('no');
  await amount(350000);
  await page.locator('#redzone').selectOption('');
  assert((await result()).includes('未確認'));
  if (path==='/jutaku/') {
   await page.locator('#shotokuzei').fill('100000');
   await page.locator('#kazei').fill('1000000');
   assert((await result()).includes('¥50,000'));
  }
 }
 await context.close();
} finally {if(browser)await browser.close();server.close();}
console.log(`✓ jutaku UI: 本体・embed ${count}シナリオ、375/390/1280px形状検査、Chromium直列`);
