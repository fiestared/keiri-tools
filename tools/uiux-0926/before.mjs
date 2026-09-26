import {start,shot} from './browser.mjs';
import {writeFile} from 'node:fs/promises';
const dir=process.argv[2];const app=await start();const log=[];
try {for(const width of [1280,390]) {
 const page=await app.context.newPage({viewport:{width,height:900}});
 for(const [slug,input,calc,result,copy] of [['gensen-choshu','amount','calcK','resultK','copy-k'],['shakai-hoken','monthly','calc','result','copy-result'],['tedori','gross','calc','result','copy-result']]) {
  await page.goto(app.base+'/'+slug+'/');await page.locator('#'+input).fill('300000');await page.locator('#'+calc).click();await page.locator('#'+result+' .big').first().waitFor();
  const before=await page.locator('#'+result).innerText();await page.locator('#'+input).fill('400000');await page.locator('#'+result).scrollIntoViewIfNeeded();
  await shot(page,dir,`${slug}-stale-${width}`);await page.locator('#'+copy).click();log.push({slug,width,action:'300000 → calculate → 400000 → copy',before,copied:await page.evaluate(()=>navigator.clipboard.readText())});
  if(slug!=='gensen-choshu'){await page.locator('#age').fill('-1');await page.locator('#'+calc).click();await shot(page,dir,`${slug}-age-${width}`);log.push({slug,width,action:'age -1 → calculate',result:await page.locator('#'+result).innerText()});}
 }
 for(const slug of ['hyojun-hoshu-gakuhyo','gensen-zeigakuhyo-mikata']){
  await page.goto(app.base+'/column/'+slug+'/');const wrap=page.locator('.scroll-wrap').nth(slug.startsWith('hyojun')?0:2);await wrap.scrollIntoViewIfNeeded();await wrap.evaluate(el=>el.scrollTop=900);await shot(page,dir,`${slug}-${width}`);
  log.push({slug,width,action:'table scrollTop=900',metrics:await wrap.evaluate(el=>({top:el.scrollTop,client:el.clientWidth,scroll:el.scrollWidth,header:getComputedStyle(el.querySelector('th')).position}))});
 }
 await page.close();
}
for(const width of [1280,390,320]){const page=await app.context.newPage({viewport:{width,height:900}});await page.goto(app.base+'/column/furikomi-tesuryo-hikaku/');await shot(page,dir,`fee-entry-${width}`);await page.locator('#hojin').scrollIntoViewIfNeeded();await shot(page,dir,`fee-table-${width}`);log.push({slug:'fee',width,metrics:await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}))});await page.close();}
await writeFile(dir+'/operations.json',JSON.stringify(log,null,2));}finally{await app.close();}
