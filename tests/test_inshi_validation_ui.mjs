// Actual browser input validity, error recovery and empty reference-data responses.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
import {spawnChrome,killChrome} from '../tools/chrome_proc.mjs';
const profile=await mkdtemp(join(tmpdir(),'inshi-validation-'));
const {chromium}=await browserTools();const server=await serve();
const chrome=spawnChrome('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`]);
let browser,passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;}catch(e){failed++;console.error('FAIL',name,e.message);}}
try{
 let port;
 for(let i=0;i<100;i++){const active=await readFile(join(profile,'DevToolsActivePort'),'utf8').catch(()=>null);if(active){port=active.split('\n')[0];break;}await new Promise(r=>setTimeout(r,100));}
 assert(port);browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 const context=await contextFor(browser,server.origin);const page=await context.newPage();await ready(page,server.origin+'/inshi/');
 async function calculate(amount,tax){await page.locator('#amount').fill(amount);await page.locator('#taxpart').fill(tax);await page.locator('#calc').click();await page.waitForFunction(()=>['success','error'].includes(document.getElementById('result').dataset.resultState));return page.locator('#result').evaluate(el=>({state:el.dataset.resultState,text:el.textContent,hasAmount:!!el.querySelector('.big')}));}
 await test('No.6925 normal control',async()=>{const r=await calculate('54800','4981');assert.equal(r.state,'success');assert.match(r.text,/49,819/);});
 for(const tax of ['-4981','1e309','0.5','54800'])await test(`tax field ${tax}`,async()=>{const r=await calculate('54800',tax);assert.equal(r.state,'error');assert.equal(r.hasAmount,false);assert.match(r.text,/入力/);});
 for(const amount of ['1e309','49999.5','-1',''])await test(`amount field ${amount}`,async()=>{const r=await calculate(amount,'0');assert.equal(r.state,'error');assert.equal(r.hasAmount,false);});
 await test('blank tax is allowed and recovery works',async()=>{const r=await calculate('50000','');assert.equal(r.state,'success');assert.match(r.text,/¥200/);});
 await test('short option retains relief explanation after selection',async()=>{await page.locator('#doc').selectOption('k1_fudosan');const option=await page.locator('#doc option:checked').textContent();assert(!/平成|令和|軽減/.test(option));assert.match(await page.locator('#doc-note').textContent(),/平成26年4月1日.*令和9年3月31日.*10万円超/);});
 await context.close();
 for(const data of [{},{docs:{}},{docs:{k17_uriage:{type:'bracket',go:'17号',name:'領収書'}}}]){
  const c=await contextFor(browser,server.origin);await c.route('**/assets/inshi_r07.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
  const p=await c.newPage();await ready(p,server.origin+'/inshi/');await p.locator('#amount').fill('54800');await p.locator('#calc').click();await p.waitForFunction(()=>['success','error'].includes(document.getElementById('result').dataset.resultState));
  await test(`empty/incomplete JSON ${JSON.stringify(data)}`,async()=>{assert.equal(await p.locator('#result').getAttribute('data-result-state'),'error');assert.match(await p.locator('#result').textContent(),/データを読み込めませんでした/);assert.equal(await p.locator('#result .big').count(),0);assert.match(await p.locator('#zeigaku-table tbody').textContent(),/読み込めませんでした/);});await c.close();
 }
 for(const path of ['/inshi/','/column/koyou-hokenryo-ritsu/','/column/rosai-hokenryoritsu/']){
  const c=await contextFor(browser,server.origin);const p=await c.newPage();await ready(p,server.origin+path);
  await test(`site button style ${path}`,async()=>{const s=await p.locator('[data-print-table]').evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,color:c.color,weight:c.fontWeight,radius:c.borderRadius};});assert.equal(s.bg,'rgb(31, 111, 92)');assert.equal(s.color,'rgb(255, 255, 255)');assert.equal(s.weight,'700');assert.equal(s.radius,'8px');});await c.close();
 }
}finally{if(browser)await browser.close();await killChrome(chrome);server.close();await rm(profile,{recursive:true,force:true});}
console.log(`inshi browser validation: ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
