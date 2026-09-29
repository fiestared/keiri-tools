// t6: 実画面でも計算前提・早産・残日数・公布済みの表示がcoreと一致すること。
import assert from 'node:assert/strict';
import { browserTools, serve, contextFor, ready } from './layout/browser.mjs';
const { chromium } = await browserTools();
const server = await serve();
let browser;
try {
  browser = await chromium.launch(); // このテスト内のChromiumは1つ。各ページを順に検査する。
  const context = await contextFor(browser, server.origin);
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function result() {
    await page.locator('#calc').click();
    await page.waitForFunction(() => {
      const x=document.querySelector('#result');
      return x && x.innerText.trim() && !x.innerText.includes('計算中');
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390px画面で結果が横にはみ出さない');
    return page.locator('#result').innerText();
  }
  for (const route of ['shobyo','embed/shobyo']) {
    await ready(page, `${server.origin}/${route}/`);
    await page.locator('#startDate').fill('2022-03-04');
    await page.locator('#restDays').fill('30');
    await page.locator('#taikiDone').check();
    await page.locator('#usedDays').fill('548');
    let text=await result();
    assert(text.includes('6,667'), route+' 残1日の日額');
    assert(text.includes('549日'), route+' 通算上限549日');
    assert(text.includes('実際の受給終了日は固定できません'), route+' 固定終了日を提示しない');
    assert(!text.includes('2023年9月3日'), route+' 中断しても同じ日で終了とは答えない');
    await page.locator('#usedDays').fill('549');
    text=await result();assert(/(?:¥|￥)0/.test(text),route+' 上限到達後の給付0円');
  }
  for (const route of ['shussan','embed/shussan']) {
    await ready(page, `${server.origin}/${route}/`);
    await page.locator('#yoteibi').fill('2026-10-10');
    await page.locator('#shussanbi').fill('2026-09-30');
    const text=await result();
    assert(text.includes('653,366'),route+' 早産・全日休業98日');
    assert(text.includes('最大見込額') && text.includes('全日休'),route+' 支給額の前提を表示');
    assert(!text.includes('短くなっています'),route+' 早産の一律減額をしない');
  }
  await ready(page,`${server.origin}/kogaku-ryoyohi/`);
  // 金額入力の初期値を使い、将来月の適用根拠を確認する。
  await page.locator('#shinryo').fill('2027-08');
  const text=await result();
  assert(text.includes('公布済み・令和9年8月1日施行'), '公布済みの将来施行を表示');
  assert(!text.includes('まだ確定できていません'), '年間集計範囲の未確定表示を除去');
  assert.deepEqual(errors,[], '画面JavaScriptエラー');
  console.log('t6: 本体・埋め込みの早産、残日数、将来施行表示が一致');
} finally {
  if(browser) await browser.close();
  server.close();
}
