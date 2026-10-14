// Verify actual 1280/390 layouts and A4 pagination/content, including after a calculation.
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {browserTools, serve, contextFor, ready, ROOT} from './layout/browser.mjs';
import {spawnChrome, killChrome} from '../tools/chrome_proc.mjs';
import {measure} from './layout/measure.mjs';
import {measureUi} from './layout/ui-measure.mjs';
import {measureEmpty} from './layout/empty-measure.mjs';
import {measureTables} from './layout/table-measure.mjs';
const out=join(ROOT,'reports/print-tables-20261014');
await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'print-tables-chrome-'));
const {chromium}=await browserTools();
const server=await serve();
const chrome=spawnChrome('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
 '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
 '--remote-debugging-port=0',`--user-data-dir=${profile}`,
]);
let browser;
const results=[];
try {
 let port;
 for(let i=0;i<100;i++){
  const active=await readFile(join(profile,'DevToolsActivePort'),'utf8').catch(()=>null);
  if(active){port=active.split('\n')[0];break;}
  await new Promise(r=>setTimeout(r,100));
 }
 assert(port,'Chrome debugging port must start');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 const cases=[['inshi','/inshi/','receipt-tax-table',16,1],['koyou','/column/koyou-hokenryo-ritsu/','koyou-rate-table',3,1],['rosai','/column/rosai-hokenryoritsu/','rosai-rate-table',53,2]];
 for(const [name,path,id,count,maxPages] of cases){
  const context=await contextFor(browser,server.origin);
  const page=await context.newPage();
  for(const width of [1280,1536,1920,1200,768,390]){
   await page.setViewportSize({width,height:900});await ready(page,server.origin+path);
   const measured=await page.evaluate(measure);
   measured.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty),...await page.evaluate(measureTables));
   assert.deepEqual(measured.issues,[],`${name} @${width}: full page geometry`);
   if(name==='koyou'){
    await page.locator('.rate-history summary').click();
    assert.deepEqual(await page.evaluate(measureTables),[],`expanded history @${width}`);
    await page.locator('.rate-history summary').click();
   }
   await page.locator(`[data-print-tables="${name}"]`).scrollIntoViewIfNeeded();
   await page.evaluate(name=>document.querySelector('[data-print-tables="'+name+'"]').scrollIntoView({block:'start'}),name);
   const geometry=await page.evaluate(id=>({viewport:innerWidth,width:document.documentElement.scrollWidth,rows:document.getElementById(id).tBodies[0].rows.length}),id);
   assert.equal(geometry.viewport,width);assert(geometry.width<=width,`${name}: viewport overflow`);assert.equal(geometry.rows,count);
   if(width===1280||width===390)await page.screenshot({path:join(out,`${name}-${width}.png`)});
  }
  await page.emulateMedia({media:'print'});
  const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
  const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)||[]).length;
  const pdfPath=join(out,`${name}-print.pdf`);await writeFile(pdfPath,pdf);
  assert(pages>=1&&pages<=maxPages,`${name}: ${pages} pages`);
  const text=execFileSync('pdftotext',['-raw',pdfPath,'-'],{encoding:'utf8'});
  assert(text.includes('確認日')&&text.includes('2026-10-14')&&text.includes('一次資料'));
  assert(!text.includes('ホーム')&&!text.includes('この表を印刷する'), 'navigation/actions must not print');
  const rowNames=await page.locator('#'+id+' tbody tr').evaluateAll(rows=>rows.map(r=>r.cells[r.cells.length===4?1:0].textContent));
  const normalize=s=>s.replace(/\s/g,'');
  for(const label of rowNames)assert(normalize(text).includes(normalize(label)),`${name}: PDF missing ${label}`);
  results.push({name,pages,rows:count,widths:[1280,1536,1920,1200,768,390]});
  if(name==='inshi'){
   await page.emulateMedia({media:'screen'});await page.setViewportSize({width:1280,height:900});
   await page.fill('#amount','54800');await page.click('#calc');
   await page.waitForSelector('html[data-calculated]');
   // A table print action after calculation must choose the table, while ordinary result printing remains available.
   await page.evaluate(()=>window.print=()=>{});await page.click('[data-print-table]');
   assert(await page.locator('html[data-print-table]').count());
   await page.emulateMedia({media:'print'});
   assert(await page.locator('#receipt-tax-table').isVisible());
   const afterPdf=await page.pdf({format:'A4',preferCSSPageSize:true});
   assert.equal((afterPdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)||[]).length,1);
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.locator('html[data-print-table]').count(),0);
  }
  await context.close();
 }
 await writeFile(join(out,'render-results.json'),JSON.stringify(results,null,2)+'\n');
 console.log('PASS screen and print:',JSON.stringify(results));
} finally {
 await browser?.close();await killChrome(chrome);server.close();
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
