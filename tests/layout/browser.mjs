import {createRequire} from 'node:module';
import {existsSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const DOCS=join(ROOT,'docs');
export const OUTPUT=process.env.LAYOUT_OUTPUT||join(ROOT,'.layout-artifacts');
export async function browserTools(){
 const require=createRequire(import.meta.url);
 let entry;try{entry=require.resolve('playwright');}catch{}
 entry=process.env.PLAYWRIGHT_PATH||entry||join(homedir(),'Scripts/accounting/node_modules/playwright/index.js');
 if(!existsSync(entry))throw Error('Playwright is required. Set PLAYWRIGHT_PATH; layout checks cannot be skipped.');
 const module=await import(entry);const {chromium}=module.default||module;
 const req=createRequire(entry);const core=dirname(req.resolve('playwright-core/package.json'));
 const {PNG}=req(join(core,'lib/utilsBundle.js'));
 return {chromium,PNG,version:req(join(core,'package.json')).version};
}
export async function serve(){
 const child=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',DOCS],{stdio:['ignore','pipe','pipe']});
 const origin=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>{child.kill();reject(Error('http.server did not start'));},15000);
 child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('exit',code=>{clearTimeout(timer);reject(Error('http.server exited '+code))});
 child.stdout.on('data',chunk=>{text+=chunk;const m=text.match(/port (\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});child.stderr.on('data',()=>{});
 });
 return {origin,close:()=>child.kill()};
}
export async function contextFor(browser,origin,width=1280){
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce',locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 return context;
}
export async function ready(page,url){
 const res=await page.goto(url,{waitUntil:'networkidle',timeout:30000});if(!res?.ok())throw Error('Page response '+res?.status()+': '+url);
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
export function outputDir(){mkdirSync(OUTPUT,{recursive:true});return OUTPUT;}
