import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';import{writeFileSync}from'node:fs';
const {chromium}=await browserTools();const server=await serve();const browser=await chromium.launch();const results=[];
try{const ctx=await contextFor(browser,server.origin);const page=await ctx.newPage();
for(const url of ['/column/einen-kinzoku-hyosho/','/column/kyuyo-shiharai-jimusho-kaisetsu/','/column/seimei-hokenryo-kojo/','/embed/haigusha-kojo/','/haigusha-kojo/','/hitorioya-kojo/'])for(const width of [390,1280]){
 await page.setViewportSize({width,height:900});await ready(page,server.origin+url);
 const checks=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,hiddenAnswers:[...document.querySelectorAll('.faq-existing-marker[aria-hidden="true"]')].filter(x=>x.textContent.trim().length>3).map(x=>x.textContent),svgOutside:[...document.querySelectorAll('svg text')].filter(x=>{const b=x.getBBox(),v=x.ownerSVGElement.viewBox.baseVal;return b.x<v.x-2||b.x+b.width>v.x+v.width+2}).map(x=>x.textContent)}));
 results.push({url,width,...checks});
 if(width===1280&&url!='/embed/haigusha-kojo/'&&await page.locator('figure').count())await page.locator('figure').first().screenshot({path:'reports/r16-t1-z/evidence/figure-'+url.split('/').filter(Boolean).at(-1)+'.png'});
 if(width===390&&['/haigusha-kojo/','/hitorioya-kojo/','/embed/haigusha-kojo/'].includes(url))await page.locator(url.startsWith('/embed/')?'body':'.card').first().screenshot({path:'reports/r16-t1-z/evidence/input-'+url.replaceAll('/','-')+'.png'});
}
await ctx.close();}finally{await browser.close();server.close();}
writeFileSync('reports/r16-t1-z/visual-check.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
if(results.some(x=>x.overflow||x.hiddenAnswers.length||x.svgOutside.length))process.exitCode=1;
