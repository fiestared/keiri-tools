import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import fs from 'node:fs';
const server=await serve();const {chromium}=await browserTools();const browser=await chromium.launch();
try {const context=await contextFor(browser,server.origin);const page=await context.newPage();const results=[];
for (const slug of ['shunyu-shotoku-chigai','teigaku-genzei-reiwa8']) {await ready(page,server.origin+'/column/'+slug+'/'); for(let i=0;i<await page.locator('svg[viewBox]').count();i++){const svg=page.locator('svg[viewBox]').nth(i);await svg.screenshot({path:`reports/r16-t14-a/${slug}-${i}.png`}); results.push({slug,i,overflow:await svg.evaluate(s=>[...s.querySelectorAll('text')].filter(t=>{const b=t.getBBox();return b.x<0||b.x+b.width>s.viewBox.baseVal.width}).map(t=>t.textContent))});}}
fs.writeFileSync('reports/r16-t14-a/visual.json',JSON.stringify(results,null,2));console.log(results);
} finally {await browser.close();server.close();}
