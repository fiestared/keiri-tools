import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();await page.route(/^https?:/,r=>r.abort());
const results=[];
try{for(const slug of ['column/gasolindai-kanjo-kamoku','column/kanjo-kamoku-ichiran','column/zatsushunyu','denchoho-index']){
 for(const width of [375,1280]){await page.setViewportSize({width,height:900});await page.goto('file://'+process.cwd()+'/docs/'+slug+'/index.html');await page.evaluate(()=>document.fonts.ready);
 const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,svg:[...document.querySelectorAll('figure svg text')].flatMap(t=>{const b=t.getBBox(),vb=t.ownerSVGElement.viewBox.baseVal;return b.x<0||b.x+b.width>vb.width+1||b.y<0||b.y+b.height>vb.height+1?[{text:t.textContent,b:{x:b.x,y:b.y,width:b.width,height:b.height},viewBox:vb.width}]:[]})}));results.push({slug,width,...check});
 if(width===1280){let i=0;for(const fig of await page.locator('figure').all()){if(slug.includes('kanjo')||slug.includes('zatsushunyu'))await fig.screenshot({path:`reports/r16-t20-a/${slug.split('/').pop()}-${i++}.png`});}}
 }}fs.writeFileSync('reports/r16-t20-a/visual-check.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
