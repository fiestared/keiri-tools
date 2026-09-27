import {mkdirSync,writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
const phase=process.argv[2]||'before';
const paths=['/','/column/','/column/furikomi-tesuryo-hikaku/','/column/shakai-hoken-kanyu-joken/','/column/hoteichosho-goukeihyo/','/column/orcan-sp500-holding-period/','/column/emaxis-sp-vs-sbi-sp/','/column/shunyu-shotoku-chigai/','/tedori/','/iryohi/','/kihonteate/','/shobyo/','/gensen-hyo/','/shiharai-site/','/hojokin/','/hojokin/koyou/','/hojokin/schedule/','/toushi/','/about/','/privacy/','/policy/disclosure/','/policy/editorial/','/embed/','/embed/tedori/','/embed/iryohi/'];
const sizes=[[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]];
const out=`reports/uiux-0927/${phase}`;mkdirSync(out,{recursive:true});
const {chromium}=await browserTools(),server=await serve(),browser=await chromium.launch();let results=[],next=0;
const jobs=paths.filter(p=>!process.env.PAGES||process.env.PAGES.split(',').includes(p)).flatMap(url=>sizes.map(([width,height])=>({url,width,height})));
try{await Promise.all(Array.from({length:1},async()=>{const c=await contextFor(browser,server.origin),p=await c.newPage();while(next<jobs.length){const j=jobs[next++];try{
 await p.setViewportSize({width:j.width,height:j.height});await ready(p,server.origin+j.url);
 const metrics=await p.evaluate(()=>{const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};return {height:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button,summary,[role=button]')].filter(visible).map(e=>({text:e.textContent.trim().slice(0,80),class:e.className,id:e.id,...rect(e)})),inputs:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(e=>({id:e.id,type:e.type,value:e.value,...rect(e)})),firstAnswer:[...document.querySelectorAll('.card,.summary-box,.callout,.result')].filter(visible).slice(0,3).map(e=>({class:e.className,...rect(e)}))}});
 const measured=await p.evaluate(measure);
 // Scroll every viewport through the entire page before capturing it.
 for(let y=0;y<metrics.height;y+=j.height-120){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(15);}await p.evaluate(()=>scrollTo(0,0));
 const name=(j.url==='/'?'home':j.url.replaceAll('/','_'))+'-'+j.width;
 await p.screenshot({path:out+'/'+name+'.png',fullPage:true});
 results.push({...j,...metrics,...measured,image:out+'/'+name+'.png'});
 console.log(name,metrics.height,measured.issues.length);
 }catch(e){results.push({...j,error:String(e)});console.log('ERROR',j.url,String(e));}}
 await c.close();}));}finally{await browser.close();server.close();writeFileSync(out+'/measurements.json',JSON.stringify(results,null,2));}
