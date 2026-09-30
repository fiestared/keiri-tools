import playwright from '/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js';
import {serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import fs from 'node:fs';
const {chromium}=playwright;
const server=await serve(),browser=await chromium.launch();let results=[];
try{const context=await contextFor(browser,server.origin),page=await context.newPage();
for(const name of ['papa-ikukyu','shokibo-kyosai','shussan','taishokukin','tosan-boshi-kyosai']){
 for(const width of [1280,1536,1920,1200,768,390]){await page.setViewportSize({width,height:900});await ready(page,server.origin+'/'+name+'/');results.push({name,width,...await page.evaluate(measure)});
 }
}await context.close();}finally{await browser.close();server.close();}
fs.writeFileSync('reports/r16-t19-a/related-visual.json',JSON.stringify(results,null,2));console.log(results.map(r=>({name:r.name,width:r.width,issues:r.issues})));

if(results.some(r=>r.issues.length))process.exitCode=1;
