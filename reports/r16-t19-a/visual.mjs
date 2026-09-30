import playwright from '/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js';
import {serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import fs from 'node:fs';
const {chromium}=playwright;
const server=await serve(),browser=await chromium.launch();let results=[];
try{const context=await contextFor(browser,server.origin),page=await context.newPage();
for(const name of ['chutaikyo','roudousha-shishobyo-houkoku','sango-papa-ikukyu','sanzen-sango-kyugyo']){
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});await ready(page,server.origin+'/column/'+name+'/');results.push({name,width,...await page.evaluate(measure)});
 if(width===1280)for(let i=0;i<await page.locator('figure').count();i++)await page.locator('figure').nth(i).screenshot({path:`reports/r16-t19-a/${name}-${i}.png`});}
}await context.close();}finally{await browser.close();server.close();}
fs.writeFileSync('reports/r16-t19-a/visual.json',JSON.stringify(results,null,2));console.log(results.map(r=>({name:r.name,width:r.width,issues:r.issues})));
