// r15: input-to-core integration on both public and embedded calculators.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_PATH || '/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js');
const {chromium}=pw.default || pw;
const root=new URL('../docs/',import.meta.url);
const server=createServer(async(req,res)=>{try{
 let path=req.url.split('?')[0];if(path.endsWith('/'))path+='index.html';
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');
 res.end(await readFile(new URL('.'+path,root)));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:900}});
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 for(const path of ['/furusato/','/embed/furusato/']){
  await page.goto(base+path);
  await page.locator('#shunyu').fill('9000000');await page.locator('#shakai').fill('0');
  await page.locator('#calc').click();await page.locator('#result').waitFor({state:'visible'});
  const before=await page.locator('#result').innerText();
  await page.locator('#shotokuChoseiEligible').check();await page.locator('#calc').click();
  await page.waitForFunction(old=>document.getElementById('result').innerText!==old,before);
  const manual=await page.locator('#result').innerText();
  await page.locator('#shotokuChoseiEligible').uncheck();await page.locator('#fuyoNensho').fill('1');await page.locator('#calc').click();
  await page.waitForFunction(expected=>document.getElementById('result').innerText===expected,manual);
  assert.equal(await page.locator('#result').innerText(),manual,'age-under-16 auto adjustment matches explicit eligibility');
  await page.locator('label[for=fuyoRojin]').evaluate(el=>{const d=el.closest('details');if(d)d.open=true;});
  assert.match(await page.locator('label[for=fuyoRojin]').innerText(),/同居老親等以外/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 if(process.env.R15_SCREENSHOTS){
  await page.goto(base+'/column/juminzei-tokubetsu-choshu/');await page.setViewportSize({width:1000,height:900});
  await page.locator('figure').last().screenshot({path:process.env.R15_SCREENSHOTS+'/retirement.png'});
 }
 console.log('furusato adjustment: main/embed checkbox and under-16 inputs agree; mobile overflow absent');
} finally {await browser?.close();await new Promise(r=>server.close(r));}
