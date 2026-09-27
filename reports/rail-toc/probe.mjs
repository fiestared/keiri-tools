import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
const server=await serve();const {chromium}=await browserTools();const b=await chromium.launch();
try {const c=await contextFor(b,server.origin);const p=await c.newPage();
for(const path of ['/column/furikomi-tesuryo-hikaku/','/column/shakai-hoken-kanyu-joken/','/iryohi/','/ikuji/']){
await ready(p,server.origin+path);console.log(path,await p.evaluate(()=>({width:innerWidth,rail:document.querySelector('.side-rail')?.getBoundingClientRect().toJSON(),related:document.querySelector('.rail-next')?.getBoundingClientRect().toJSON(),toggle:document.querySelector('.toc-toggle')?.outerHTML,overflow:document.documentElement.scrollWidth,script:[...document.scripts].filter(s=>s.src.includes('toc-rail')).map(s=>s.src)})));
await p.screenshot({path:'reports/rail-toc/shots/'+path.replaceAll('/','_')+'.png'});
}
}finally{await b.close();server.close();}
