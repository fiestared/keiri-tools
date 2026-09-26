import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {join, extname} from 'node:path';
import playwright from '/Users/masahiroyasu/Scripts/accounting/node_modules/playwright/index.js';
const {chromium}=playwright;
export async function start(mutate = (p, body) => body) {
 const docs = new URL('../../docs/', import.meta.url).pathname;
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
 const server=createServer(async(req,res)=>{try{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',mime[extname(p)]||'application/octet-stream');const body=await readFile(join(docs,p));res.end(mutate(p,body));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch();
 const context=await browser.newContext({locale:'ja-JP',permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 return {base,context,close:async()=>{await browser.close();await new Promise(r=>server.close(r));}};
}
export async function shot(page,dir,name){if(!dir)return;await mkdir(dir,{recursive:true});await page.screenshot({path:join(dir,name+'.png')});}
