// t5: 埋込HTMLの実際の入力・呼出し・表示を、固定正本の期待値で検査する。
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor} from './layout/browser.mjs';
const {chromium}=await browserTools();
const server=await serve();
const browser=await chromium.launch();
const errors=[];
try {
  const context=await contextFor(browser,server.origin,390);
  const page=await context.newPage();
  const check=(ok,message)=>{if(!ok)errors.push(message);};
  for(const [salary,expected] of [[1150000,0],[2000000,85500],[5000000,315500]]) {
    // 東京都正本: 令和9年度は給与所得控除最低74万円。基礎控除43万円、税率10%、調整控除。
    await page.goto(server.origin+'/embed/juminzei/');
    await page.locator('#shunyu').fill(String(salary));
    await page.locator('#shakai').fill('0');
    await page.locator('#jichitai').selectOption('hyojun');
    await page.locator('#calc').click();
    await page.waitForFunction(()=>document.querySelector('#result .big'));
    const got=await page.locator('#result .big').innerText();
    check(got==='¥'+expected.toLocaleString('ja-JP'),`${salary}: expected ${expected}, got ${got}`);
    console.log(`給与${salary}: ${got} / expected ${expected}`);
  }
  // 314条の6・東京都の調整控除: 父(5万+1万)×5%=3000、母(5万+5万)×5%=5000。
  // 給与300万→所得202万−基礎43万−ひとり親30万=課税129万。均等割等5000円。
  for(const [sex,expected] of [['haha',129000],['chichi',131000]]) {
    await page.goto(server.origin+'/embed/juminzei/');
    await page.locator('#shunyu').fill('3000000');
    await page.locator('#shakai').fill('0');
    await page.locator('#jichitai').selectOption('hyojun');
    await page.locator('details').first().evaluate(e=>e.open=true);
    await page.locator('#fuyoNensho').fill('1');
    await page.locator('#hitorioya').check();
    if(await page.locator('#hitorioyaSei').count())await page.locator('#hitorioyaSei').selectOption(sex);
    else check(false,'ひとり親の父母を選択できない');
    await page.locator('#calc').click();
    await page.waitForFunction(()=>document.querySelector('#result .big'));
    const got=await page.locator('#result .big').innerText();
    check(got==='¥'+expected.toLocaleString('ja-JP'),`${sex}: expected ${expected}, got ${got}`);
    console.log(`${sex}: ${got} / expected ${expected}`);
  }
  for(const path of ['/juminzei/','/embed/juminzei/']) {
    await page.goto(server.origin+path);
    await page.locator('#shunyu').fill('5000000');
    await page.locator('#shakai').fill('0');
    await page.locator('#calc').click();
    await page.waitForFunction(()=>document.querySelector('#result .big'));
    check((await page.locator('#result').innerText()).includes('調整控除以外の税額控除'),path+' 結果内に未反映の税額控除を明示');
  }
  await context.close();
} finally {await browser.close();server.close();}
assert.deepEqual(errors,[]);
console.log('✓ t5 住民税埋込: 年度・父母の実計算と対象範囲表示');
