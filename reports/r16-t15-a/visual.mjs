import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
const pages=['aoiro-kojo','shokibo-kyosai','column/gyomuitaku-kakutei-shinkoku','column/hojokin-kojin-jigyonushi','column/jigyonushi-kashi-kari','embed/shokibo-kyosai','gensen-choshu','kokuho','shohizei'];
const {chromium}=await browserTools();const server=await serve();const browser=await chromium.launch();const results=[];
try{const context=await contextFor(browser,server.origin);const page=await context.newPage();for(const slug of pages)for(const width of [1280,1536,1920,1200,768,390]){await page.setViewportSize({width,height:900});await ready(page,server.origin+'/'+slug+'/');const m=await page.evaluate(measure);m.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))m.issues.push({kind});const svg=await page.locator('svg').evaluateAll(svgs=>svgs.flatMap(s=>[...s.querySelectorAll('text')].map(t=>({text:t.textContent,x:t.getBBox().x,right:t.getBBox().x+t.getBBox().width,max:s.viewBox.baseVal.width})).filter(t=>t.x<0||t.right>t.max)));results.push({slug,width,issues:m.issues,svg});if(!['gensen-choshu','kokuho','shohizei'].includes(slug)&&(width===1280||width===390))for(let i=0;i<await page.locator('figure').count();i++){await page.locator('figure').nth(i).screenshot({path:`reports/r16-t15-a/${slug.replaceAll('/','-')}-fig${i}${width===390?'-mobile':''}.png`});}}
await context.close();}finally{await browser.close();server.close();}fs.writeFileSync('reports/r16-t15-a/visual.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));

assert.equal(results.filter(r=>r.issues.length||r.svg.length).length,0,'target page geometry/SVG regression');
