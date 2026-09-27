import {writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
const server=await serve();const {chromium}=await browserTools();const b=await chromium.launch();const rows=[];
try {const c=await contextFor(b,server.origin);const p=await c.newPage();
for(const [width,height]of [[1280,900],[1536,864],[1920,1080],[1200,800],[390,844],[768,1024]])for(const [name,path]of [['pr','/column/furikomi-tesuryo-hikaku/'],['no-pr','/column/shakai-hoken-kanyu-joken/'],['long','/column/hoteichosho-goukeihyo/'],['short','/ikuji/'],['short-article','/column/orcan-vs-emaxis-sp/'],['tool','/iryohi/']]){
await p.setViewportSize({width,height});await ready(p,server.origin+path);
for(const state of ['default','open','closed']){
const toggle=p.locator('.toc-toggle');if(state!=='default'&&await toggle.isVisible())await toggle.click();
if(width<1200)await p.locator('.side-rail').scrollIntoViewIfNeeded();
const metrics=await p.evaluate(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect().toJSON();return{viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth,rail:rect('.side-rail'),toc:rect('.toc'),pr:rect('.side-rail .pr-block'),related:rect('.rail-next'),count:document.querySelectorAll('.toc a').length,expanded:document.querySelector('.toc-toggle').getAttribute('aria-expanded'),buttonHidden:document.querySelector('.toc-toggle').hidden,listHeight:document.querySelector('.toc ol').clientHeight,listFull:document.querySelector('.toc ol').scrollHeight};});
const shot=`reports/rail-toc/shots/${name}-${width}-${state}.png`;await p.screenshot({path:shot});rows.push({name,path,width,height,state,shot,...metrics});
}
}
}finally{await b.close();server.close();writeFileSync('reports/rail-toc/measurements.json',JSON.stringify(rows,null,2));}
