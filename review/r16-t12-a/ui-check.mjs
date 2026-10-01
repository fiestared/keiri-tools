import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
const {chromium}=await browserTools();const server=await serve();let browser;
try {
 browser=await chromium.launch();const context=await contextFor(browser,server.origin);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await ready(page,server.origin+'/toroku-menkyozei/');
 const taxes=()=>page.locator('#result tbody tr').evaluateAll(rs=>rs.map(r=>Number(r.lastElementChild.textContent.replace(/[^0-9]/g,''))));
 async function expectTaxes(expected){await page.click('#calc');await page.waitForFunction(e=>JSON.stringify([...document.querySelectorAll('#result tbody tr')].map(r=>Number(r.lastElementChild.textContent.replace(/[^0-9]/g,''))))===JSON.stringify(e),expected);assert.deepEqual(await taxes(),expected);}
 await expectTaxes([225000,30000,35000]);console.log('GREEN 実UI初期値 土地225000・建物30000・抵当権35000');
 await page.fill('#tochiKagaku','0');await page.fill('#saikenGaku','20000000');await page.fill('#shutokuBi','2027-03-31');
 for(const [date,expected] of [['2027-04-01',[30000,20000]],['2028-03-31',[30000,20000]],['2028-04-01',[200000,80000]]]){await page.fill('#tokiBi',date);await expectTaxes(expected);console.log('GREEN 実UI取得期限当日・登記'+date,expected);}
 await page.fill('#shutokuBi','2027-04-01');await page.fill('#tokiBi','2027-04-02');await page.click('#calc');await page.locator('#out-of-scope').waitFor();console.log('GREEN 実UI取得期限翌日は未収録');
 await page.fill('#shutokuBi','');await page.fill('#tokiBi','2026-07-01');await page.fill('#tochiKagaku','15000000');await page.fill('#tatemonoKagaku','0');await page.fill('#saikenGaku','0');await expectTaxes([225000]);console.log('GREEN 実UI土地のみなら住宅取得日は不要');
 await ready(page,server.origin+'/jidoshazei/');const kei=await page.locator('#kei-line').innerText();for(const term of ['四輪以上','ガソリン電力併用','対象外','グリーン化特例の軽課'])assert(kei.includes(term),term);console.log('GREEN 実UI軽自動車の描画後も適用範囲・除外が残る');
 const measurements=[];
 for(const url of execFileSync('git',['diff','--name-only','e7391b66','--','docs/**/index.html','docs/index.html'],{encoding:'utf8'}).trim().split('\n').map(p=>'/'+p.replace(/^docs\//,'').replace(/index.html$/,'')))for(const [width,height] of [[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await ready(page,server.origin+url);const m=await page.evaluate(measure);m.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));
  if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))m.issues.push({kind});
  if(width===1280){await page.emulateMedia({media:'print'});m.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:'screen'});}
  if(width===1280 && url==='/column/fudosan-shutokuzei-shiwake/')await page.locator('svg[aria-label="不動産取得税の時系列と事業年度の関係"]').screenshot({path:'review/r16-t12-a/shiwake-timeline.png'});
  if(width===1280 && url==='/column/shunyu-inshi-warihan/')await page.locator('svg[aria-label="印紙を貼ったか・消したかで過怠税が分かれる流れ図"]').screenshot({path:'review/r16-t12-a/warihan-flow.png'});
  if(width===1280 && url==='/column/toroku-menkyozei-nofu/')await page.locator('svg[aria-label="登録免許税の納付3ルートと還付の経路を示した図"]').screenshot({path:'review/r16-t12-a/nofu-flow.png'});
  if(width===1280 && url==='/fudosan-shutoku/')await page.locator('svg[aria-label^="令和8年度改正で住宅の床面積"]').screenshot({path:'review/r16-t12-a/fudosan-floor.png'});
  measurements.push({url,width,...m});
 }
 writeFileSync('review/r16-t12-a/ui-layout.json',JSON.stringify(measurements,null,2)+'\n');
 assert.deepEqual(measurements.filter(m=>m.issues.length),[]);console.log('GREEN 変更'+new Set(measurements.map(m=>m.url)).size+'ページ × 6画面幅・印刷');
 assert.deepEqual(errors,[]);console.log('GREEN pageerror 0');
} finally {await browser?.close();server.close();}
