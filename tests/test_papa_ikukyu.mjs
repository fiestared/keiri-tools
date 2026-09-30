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
  // 2026-09-30: 月給欄は空欄で始まる（入力例は説明文）。以前の初期値 300000 を明示して入れる
  await ready(page,server.origin+url);await page.fill('#monthly','300000');await page.fill('#leaveDays','28');await page.fill('#workDays','14');await page.fill('#workHours','112');
  assert.match(await result(),/就業日数・時間が給付の上限を超える/,url+' 公表例14日112時間は不支給');
  await page.fill('#workDays','11');await page.fill('#workHours','80');assert.match(await result(),/224,000/,url+' 80時間境界');
  await page.fill('#workDays','0');await page.fill('#workHours','0');await page.fill('#leaveDays','13');await page.selectOption('#spouse','employed');await page.fill('#spouseDays','0');
  const no=await result();assert.doesNotMatch(no,/まるごと乗ります/,url+' 配偶者0日では延長だけで受給できない');
  await page.fill('#spouseDays','14');assert.match(await result(),/18,200/,url+' 配偶者14日なら延長案内');
  await page.fill('#leaveDays','10');await page.fill('#otherEligibleDays','3');const extension=await result();assert.match(extension,/あと1日/,url+' 通算13日から延長1日');assert.match(extension,/14,300/,url+' 延長後は今回11日分');
  await page.fill('#leaveDays','13');await page.fill('#otherEligibleDays','1');assert.match(await result(),/16,900/,url+' パパ13日＋通常育休1日なら今回13日分の支援');
  await page.fill('#otherEligibleDays','0');assert.doesNotMatch(await result(),/16,900/,url+' 通算13日は不支給');
  await page.fill('#otherEligibleDays','1');await page.fill('#shienPaidDays','27');assert.match(await result(),/1,300/,url+' 既支給27日なら残り1日分');
  await page.fill('#shienPaidDays','28');assert.match(await result(),/87,100/,url+' 既支給28日は67%だけ');

 }
 await ready(page,server.origin+'/kihonteate/');
 await page.fill('#monthly','300000');await page.selectOption('#wageBasis','daily');await page.fill('#workDays6m','100');
 assert.match(await result(),/12,600/, '日給制100日の70%最低保障を画面まで接続');
 assert.match(await page.locator('#result').innerText(),/70%を比較/, '日給制の計算説明');
 await page.fill('#workDays6m','0');assert.match(await result(),/実労働日数/, '実労働日数0を拒否');
 await page.selectOption('#wageBasis','mixed');assert.match(await result(),/対象外/, '月給と日給等の混在は個別算定');
 console.log('✓ t7 育児給付の4画面: 改定・通算・既支給・就業・延長案内を確認');
} finally {await browser.close();server.close();}
