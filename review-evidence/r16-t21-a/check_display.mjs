import fs from 'node:fs';import {chromium} from '/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.mjs';
import {serve,contextFor,ready} from '../../tests/layout/browser.mjs';
const server=await serve();const browser=await chromium.launch();const results=[];
try{const ctx=await contextFor(browser,server.origin);const p=await ctx.newPage();
for(const name of ['jigyoshozei','kaisha-seisan','naiyo-shomei'])for(const width of [1280,390]){
 await p.setViewportSize({width,height:900});await ready(p,server.origin+'/column/'+name+'/');
 const issues=await p.evaluate(()=>[...document.querySelectorAll('svg text')].flatMap(el=>{const b=el.getBBox(),s=el.closest('svg').viewBox.baseVal;return b.x< -1||b.x+b.width>s.width+1||b.y+b.height>s.height+1?[{text:el.textContent,b:{x:b.x,y:b.y,width:b.width,height:b.height},view:{width:s.width,height:s.height}}]:[]}));
 results.push({name,width,issues});if(width===1280){let i=0;for(const fig of await p.locator('figure').all())await fig.screenshot({path:`review-evidence/r16-t21-a/${name}-figure-${i++}.png`});}
}await ctx.close();}finally{await browser.close();server.close();}fs.writeFileSync('review-evidence/r16-t21-a/display.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
