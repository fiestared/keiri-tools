// t7: 正本の境界値を入力欄から通す。ブラウザは1つだけ起動する。
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
const {chromium}=await browserTools();const server=await serve();const browser=await chromium.launch();
try {
 const context=await contextFor(browser,server.origin);const page=await context.newPage();
 async function result(){await page.click('#calc');await page.waitForTimeout(80);return page.locator('#result').innerText();}
 for(const url of ['/ikuji/','/embed/ikuji/']){
  await ready(page,server.origin+url);
  await page.fill('#monthly','500000');await page.fill('#startDate','2026-04-01');await page.fill('#leaveDays','30');await page.fill('#shienOwnDays','0');
  assert.match(await result(),/323,811/,url+' 改定前上限（厚労省001728499）');
  await page.fill('#startDate','2026-08-01');assert.match(await result(),/332,454/,url+' 改定後上限');
  await page.fill('#monthly','300000');await page.fill('#startDate','2026-04-01');await page.fill('#leaveDays','180');await page.fill('#priorShusshojiDays','28');
  assert.match(await result(),/1,145,000/,url+' 先行28日通算（厚労省001461102）');
  await page.fill('#leaveDays','30');await page.fill('#shienOwnDays','28');await page.fill('#shienPaidDays','14');await page.check('#spouseExempt');
  assert.match(await result(),/18,200/,url+' 既支給控除');
  await page.fill('#leaveDays','14');assert.match(await result(),/計算できません/,url+' 実休業より多い対象日数を拒否');
 }
 for(const url of ['/papa-ikukyu/','/embed/papa-ikukyu/']){
  await ready(page,server.origin+url);await page.fill('#leaveDays','28');await page.fill('#workDays','14');await page.fill('#workHours','112');
  assert.match(await result(),/就業日数・時間が給付の上限を超える/,url+' 公表例14日112時間は不支給');
  await page.fill('#workDays','11');await page.fill('#workHours','80');assert.match(await result(),/224,000/,url+' 80時間境界');
  await page.fill('#workDays','0');await page.fill('#workHours','0');await page.fill('#leaveDays','13');await page.selectOption('#spouse','employed');await page.fill('#spouseDays','0');
  const no=await result();assert.doesNotMatch(no,/まるごと乗ります/,url+' 配偶者0日では延長だけで受給できない');
  await page.fill('#spouseDays','14');assert.match(await result(),/18,200/,url+' 配偶者14日なら延長案内');
 }
 console.log('✓ t7 育児給付の4画面: 改定・通算・既支給・就業・延長案内を確認');
} finally {await browser.close();server.close();}
