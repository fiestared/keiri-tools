import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
const phase=process.argv[2]||'before',out=`reports/uiux-0927/${phase}/candidates`;mkdirSync(out,{recursive:true});
let plan=[];if(phase==='before'){
 const rows=JSON.parse(readFileSync('reports/uiux-0927/sweep-before.json'));const seen=new Set();for(const r of rows.filter(r=>r.small?.length)){if(seen.has(r.url))continue;seen.add(r.url);plan.push({url:r.url,width:r.width,kind:'target',name:r.url.replaceAll('/','_')+'-target'});}
 plan.push({url:'/column/emaxis-sp-vs-sbi-sp/',width:390,selector:'.next-read',name:'entity'},{url:'/column/emaxis-sp-vs-sbi-sp/',width:390,selector:'.breadcrumb',name:'breadcrumb'},{url:'/column/nenmatsu-chosei-kanpukin/',width:390,selector:'.callout:has(a[href="../nenmatsu-chosei-kakikata/"])',name:'contrast'});
}else plan=JSON.parse(readFileSync('reports/uiux-0927/candidate-plan.json'));
const {chromium}=await browserTools(),server=await serve(),browser=await chromium.launch();let index=0,results=[];
try{await Promise.all(Array.from({length:1},async()=>{const c=await contextFor(browser,server.origin),p=await c.newPage();while(index<plan.length){let j=plan[index++];await p.setViewportSize({width:j.width,height:900});await ready(p,server.origin+j.url);
 if(j.kind==='target'&&!j.selector){const n=await p.locator('button,summary,a[role=button]').evaluateAll(es=>es.findIndex(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9)}));j.index=n;}
 const target=j.kind==='target'?p.locator('button,summary,a[role=button]').nth(j.index):p.locator(j.selector).first();await target.scrollIntoViewIfNeeded();
 await p.screenshot({path:out+'/'+j.name+'.png'});results.push({...j,box:await target.boundingBox()});console.log(j.name);
}await c.close();}));}finally{await browser.close();server.close();writeFileSync(out+'/manifest.json',JSON.stringify(results,null,2));if(phase==='before')writeFileSync('reports/uiux-0927/candidate-plan.json',JSON.stringify(plan,null,2));}
