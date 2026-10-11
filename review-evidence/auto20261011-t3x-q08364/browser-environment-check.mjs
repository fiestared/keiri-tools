import {writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
import {measureToc} from '../../tests/layout/toc-measure.mjs';
import {measureLeftAccent} from '../../tests/layout/accent-measure.mjs';
import {measureTables} from '../../tests/layout/table-measure.mjs';
const {chromium,version}=await browserTools(),server=await serve();let browser;const results=[];
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await contextFor(browser,server.origin),page=await context.newPage();
 for(const slug of ['azukarikin','emaxis-nikkei-vs-tawara-nikkei','juminzei-hayamihyo','sbi-spyd-vs-rakuten-vym','sbi-vym-vs-rakuten-vym','hyojun-hoshu-gakuhyo'])for(const [width,height] of [[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]]){
  const url='/column/'+slug+'/';await page.setViewportSize({width,height});await ready(page,server.origin+url);let x=await page.evaluate(measure);x.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty),...await page.evaluate(measureTables));if(width===1280||width===390)x.issues.push(...await page.evaluate(measureLeftAccent));if(await page.locator('.rail-next').count())for(const kind of await page.evaluate(measureToc))x.issues.push({kind,text:'TOC related rail'});if(width===1280){await page.emulateMedia({media:'print'});x.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));await page.emulateMedia({media:'screen'});}results.push({url,width,...x});
 }
 writeFileSync('review-evidence/auto20261011-t3x-q08364/browser-environment-check.json',JSON.stringify({playwright:version,browser:browser.version(),executable:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',results},null,2)+'\n');
 console.log('System Chrome:',browser.version(),'bad',results.filter(x=>x.issues.length).map(x=>({url:x.url,width:x.width,issues:x.issues}))); 
}finally{await browser?.close();server.close();}
