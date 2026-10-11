import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root='/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261011-t8-q08362/';
const {browserTools,serve,contextFor,ready}=await import(root+'tests/layout/browser.mjs');
const {measure}=await import(root+'tests/layout/measure.mjs');
const {measureTables}=await import(root+'tests/layout/table-measure.mjs');
const rows=JSON.parse(readFileSync(root+'.layout-artifacts/render.json')).filter(r=>r.error||r.issues.length);
const base=execFileSync('git',['rev-parse','f37bc1e22'],{cwd:root,encoding:'utf8'}).trim();
const html=new Map();for(const r of rows)if(!html.has(r.url))html.set(r.url,execFileSync('git',['show',base+':docs'+r.url+'index.html'],{cwd:root,encoding:'utf8'}));
const fee=execFileSync('git',['show',base+':docs/assets/fee_table.json'],{cwd:root,encoding:'utf8'});
const {chromium,version}=await browserTools();const server=await serve();const browser=await chromium.launch();const results=[];
try{const context=await contextFor(browser,server.origin);await context.route(server.origin+'/**',route=>{const path=new URL(route.request().url()).pathname;if(html.has(path))return route.fulfill({contentType:'text/html',body:html.get(path)});if(path==='/assets/fee_table.json')return route.fulfill({contentType:'application/json',body:fee});return route.fallback();});const page=await context.newPage();
for(const r of rows){await page.setViewportSize({width:r.width,height:r.height});await ready(page,server.origin+r.url);const m=await page.evaluate(measure);const t=await page.evaluate(measureTables);results.push({url:r.url,width:r.width,issues:[...m.issues,...t],original:r.issues,baseline_html_equals_head:html.get(r.url)===readFileSync(root+'docs'+r.url+'index.html','utf8')});}
await context.close();writeFileSync('/tmp/t8-q08362-baseline-layout.json',JSON.stringify({base,playwright:version,browser:browser.version(),results},null,2));console.log(JSON.stringify({base,cases:results.length,reproduced:results.filter(r=>r.issues.length).length,unchanged_html:results.every(r=>r.baseline_html_equals_head)}));
}finally{await browser.close();server.close();}
