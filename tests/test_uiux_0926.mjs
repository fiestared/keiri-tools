import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {start,shot} from '../tools/uiux-0926/browser.mjs';
const only=process.env.UIUX_CASE, mutation=process.env.UIUX_MUTATION;
const dir=process.env.UIUX_ARTIFACTS;
const log=[];
const mutations={
 stale:['/assets/calculation_state.js',"scope.addEventListener('input', changed);",'// disabled input listener'],
 age:['/assets/calculation_state.js',"const valid = input.value.trim() !== ''",'const valid = true || input.value.trim() !== \'\''],
 grade:['/assets/hyojun_row_lookup.js','amount >= numbers[0] && amount < numbers[1]','amount >= numbers[0] && amount <= numbers[1]'],
 table:['/column/gensen-zeigakuhyo-mikata/index.html','position: sticky; top: 0; z-index: 2;','position: static; top: 0; z-index: 2;'],
 fee:['/column/furikomi-tesuryo-hikaku/index.html','max-width: 100%; overflow: auto; max-height: 640px;','max-width: 100%; overflow: visible; max-height: 640px;'],
};
let mutated=false;
const app=await start((path,body)=>{if(!mutation)return body;const [target,from,to]=mutations[mutation];if(path!==target)return body;const text=body.toString();assert(text.includes(from),'mutation target exists');mutated=true;return text.replace(from,to);});
const check=(condition,message)=>assert(condition,`UIUX:${message}`);
async function record(page,name,extra={}){const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,focus:document.activeElement.id||document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineWidth}));log.push({name,...metrics,...extra});await shot(page,dir,name);check(metrics.scrollWidth<=metrics.clientWidth,name+' page overflow');}
async function calculate(page,button,result){await page.locator(button).click();await page.waitForFunction(s=>document.querySelector(s).dataset.resultState==='success',result);}
const specs=[['gensen-choshu','amount','calcK','resultK','copy-k'],['shakai-hoken','monthly','calc','result','copy-result'],['tedori','gross','calc','result','copy-result']];
try{
for(const width of only==='fee'?[320]:[1280,390]){
 const page=await app.context.newPage();await page.setViewportSize({width,height:900});check(await page.evaluate(()=>innerWidth)===width,'requested viewport');page.setDefaultTimeout(5000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(!only||only==='stale'){
  for(const [slug,input,button,result,copy] of specs){
   await page.goto(app.base+'/'+slug+'/');await page.locator('#'+input).fill('300000');await calculate(page,'#'+button,'#'+result);
   const before=await page.locator('#'+result+' .big').first().innerText();
   await page.locator('#'+input).fill('400000');
   check(await page.locator('#'+result).getAttribute('data-result-state')==='stale','stale input invalidates result');
   check(await page.locator('#'+copy).isDisabled(),'stale copy disabled');
   check(await page.locator('#'+result).innerText().then(t=>t.includes('再計算してください')),'stale notice');
   check(await page.locator('#'+input).evaluate(el=>el===document.activeElement),'edit keeps focus');
   await page.locator('#'+result).scrollIntoViewIfNeeded();await record(page,`${slug}-stale-${width}`,{before,action:'300000 → calculate → 400000; copy disabled'});
   await page.evaluate(()=>navigator.clipboard.writeText('sentinel'));await page.locator('#'+copy).evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
   check(await page.evaluate(()=>navigator.clipboard.readText())==='sentinel','stale copy handler rejects synthetic click');
   await calculate(page,'#'+button,'#'+result);await page.locator('#'+copy).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());check(copied.includes('400,000')&&!copied.includes('変更前'),'new conditions copied');
   await record(page,`${slug}-recalculated-${width}`,{copied});
   // The same starting condition must reproduce the same number, with optional inputs still blank.
   await page.locator('#'+input).fill('300000');await calculate(page,'#'+button,'#'+result);check(await page.locator('#'+result+' .big').first().innerText()===before,'numeric regression');
   const select=slug==='gensen-choshu'?'fuyo':'pref';await page.locator('#'+select).selectOption({index:1});check(await page.locator('#'+copy).isDisabled(),'select invalidates copy');await calculate(page,'#'+button,'#'+result);
   if(slug==='tedori'){await page.locator('#dependents').fill('1');check(await page.locator('#'+copy).isDisabled(),'dependents invalidates copy');await calculate(page,'#'+button,'#'+result);}
   await page.locator('#'+input).fill('');await page.locator('#'+button).click();check(await page.locator('#'+copy).isDisabled(),'error copy disabled');await page.locator('#'+input).fill('300000');await calculate(page,'#'+button,'#'+result);
   await page.locator('#'+button).focus();await page.keyboard.press('Tab');
   if (!(await page.locator('#'+copy).evaluate(el=>el===document.activeElement))) {
    check(await page.evaluate(result=>{const el=document.activeElement;return document.getElementById(result).contains(el)&&el.scrollWidth>el.clientWidth&&getComputedStyle(el).overflowX==='auto';},result),'Tab reaches scrollable result at narrow width');
    await page.keyboard.press('Tab');
   }
   check(await page.locator('#'+copy).evaluate(el=>el===document.activeElement),'Tab reaches copy '+slug+' '+width);await page.keyboard.press('Enter');await page.waitForTimeout(50);await record(page,`${slug}-keyboard-${width}`);
  }
  // Each withholding tab owns its result, including the two bonus methods.
  await page.goto(app.base+'/gensen-choshu/');await page.locator('#amount').fill('300000');await calculate(page,'#calcK','#resultK');
  await page.locator('#tab-shoyo').click();for(const [id,value] of [['shoyoAmt','600000'],['shoyoIns','90000'],['zenAmt','300000'],['zenIns','45000']])await page.locator('#'+id).fill(value);
  await calculate(page,'#calcS','#resultS');await page.locator('#shoyoAmt').fill('700000');check(await page.locator('#copy-s').isDisabled(),'bonus stale');
  await page.locator('#tab-kyuyo').click();check(await page.locator('#resultK').getAttribute('data-result-state')==='success','tab isolation');await page.locator('#tab-shoyo').click();check(await page.locator('#copy-s').isDisabled(),'tab return remains stale');await calculate(page,'#calcS','#resultS');
  await page.locator('#zenPaid').uncheck();check(await page.locator('#copy-s').isDisabled(),'bonus previous salary changed');await calculate(page,'#calcS','#resultS');await record(page,`gensen-bonus-${width}`);
  await page.locator('#tab-hoshu').click();await page.locator('#fee').fill('100000');await calculate(page,'#calc','#result');await page.locator('#fee').fill('200000');check(await page.locator('#copy-result').isDisabled(),'fee stale');await calculate(page,'#calc','#result');await record(page,`gensen-fee-${width}`);
 }
 if(!only||only==='age'){
  for(const slug of ['shakai-hoken','tedori']){
   await page.goto(app.base+'/'+slug+'/');await page.locator(slug==='tedori'?'#gross':'#monthly').fill('300000');
   for(const value of ['-1','35.5','','14','75']){
    await page.locator('#age').fill(value);await page.locator('#calc').focus();await page.keyboard.press('Enter');await page.waitForTimeout(30);
    check(await page.locator('#age').getAttribute('aria-invalid')==='true','age invalid blocked');check(await page.locator('#copy-result').isDisabled(),'age error cannot copy');check(await page.locator('#age').inputValue()===value,'age value retained');check(await page.locator('#result > .warn a').getAttribute('href')==='#age','age correction link');
    check(await page.locator('#result > .warn').evaluate(el=>el===document.activeElement),'age error focus');
    log.push({slug,width,action:'invalid age → Enter',value});
   }
   await record(page,`${slug}-age-error-${width}`);await page.locator('#result .warn a').click();check(await page.locator('#age').evaluate(el=>el===document.activeElement),'error link focuses age');
   for(const value of ['15','35','39','40','45','64','65','74']){await page.locator('#age').fill(value);await calculate(page,'#calc','#result');check(await page.locator('#age-error').isHidden(),'age recovered');log.push({slug,width,age:value,result:await page.locator('#result').innerText()});}
   await record(page,`${slug}-age-recovered-${width}`);
  }
 }
 if(!only||only==='grade'){
  await page.goto(app.base+'/column/hyojun-hoshu-gakuhyo/');
  for(const [value,grade] of [['300000','22'],['289999','21'],['290000','22'],['310000','23'],['0','1'],['62999','1'],['63000','2'],['1355000','50'],['9999999','50'],['３００，０００','22']]){
   await page.locator('#grade-amount').fill(value);await page.keyboard.press('Enter');const matched=await page.locator('#grade-table .is-matched td').first().innerText();check(matched===grade,'grade boundary '+value);
   check(await page.locator('#grade-table tr').count()===51,'all 50 grades retained');log.push({width,value,grade:matched,summary:await page.locator('#grade-summary').innerText()});
  }
  await page.locator('#grade-amount').fill('300000');await page.keyboard.press('Tab');check(await page.locator('#grade-lookup button').evaluate(el=>el===document.activeElement),'grade Tab');await page.keyboard.press('Enter');await record(page,`grade-summary-${width}`);
  const row=await page.locator('#grade-table .is-matched').boundingBox();const wrap=await page.locator('#hyou-wrap').boundingBox();check(row.y>=wrap.y&&row.y+row.height<=wrap.y+wrap.height,'grade row scrolled into frame');
  await page.locator('#hyou-wrap').scrollIntoViewIfNeeded();await record(page,`grade-table-${width}`);await page.locator('#hyou-expand').click();check(await page.locator('#hyou-wrap').evaluate(el=>el.clientHeight>=el.scrollHeight-2),'grade expand preserved');await record(page,`grade-expanded-${width}`);
  for(const value of ['','-1','3.5']){await page.locator('#grade-amount').fill(value);await page.keyboard.press('Enter');check(await page.locator('#grade-amount').getAttribute('aria-invalid')==='true','grade invalid');check(await page.locator('#grade-table .is-matched').count()===0,'no outdated grade selection');}
 }
 if(!only||only==='table'){
  await page.goto(app.base+'/column/gensen-zeigakuhyo-mikata/');const wrap=page.locator('.gensen-monthly-table');await wrap.scrollIntoViewIfNeeded();await wrap.focus();await page.keyboard.press('PageDown');await page.waitForTimeout(100);check(await wrap.evaluate(el=>el.scrollTop)>0,'tax table keyboard scroll');
  await wrap.hover();await page.mouse.wheel(0,1800);await page.waitForTimeout(150);
  await wrap.evaluate(el=>{el.scrollTop=2500;el.scrollLeft=el.scrollWidth;});
  const pos=await wrap.evaluate(el=>{const rect=el.getBoundingClientRect(),head=el.querySelector('thead th').getBoundingClientRect();const rows=[...el.querySelectorAll('tbody tr')];const row=rows.find(r=>r.getBoundingClientRect().top>head.bottom);return{wrap:rect.toJSON(),head:head.toJSON(),first:row.cells[0].getBoundingClientRect().toJSON(),background:getComputedStyle(row.cells[0]).backgroundColor,scrollLeft:el.scrollLeft,rows:rows.length};});
  check(Math.abs(pos.head.y-pos.wrap.y)<=2,'table header sticks');check(Math.abs(pos.first.x-pos.wrap.x)<=2,'table first column sticks');check(pos.background!=='rgba(0, 0, 0, 0)','table opaque first column');check(pos.rows===231,'231 tax rows retained');await record(page,`tax-table-scrolled-${width}`,pos);
  await page.keyboard.press('Tab');check(!(await wrap.evaluate(el=>el===document.activeElement)),'table no keyboard trap');
  await page.emulateMedia({media:'print'});check(await wrap.evaluate(el=>getComputedStyle(el).maxHeight)==='none','tax print full table');check(await page.locator('.gensen-monthly-table th').first().evaluate(el=>getComputedStyle(el).position)==='static','tax print unstick');await page.emulateMedia({media:'screen'});
 }
 if(!only||only==='fee'){
  const widths=only?[width]:width===390?[390,320]:[1280];
  for(const w of widths){await page.setViewportSize({width:w,height:900});await page.goto(app.base+'/column/furikomi-tesuryo-hikaku/');
   const entry=page.locator('.fee-entry');check(await entry.locator('a').allTextContents().then(t=>t[0]==='法人の一覧'&&t[1]==='個人の一覧'),'fee entry order');await entry.locator('a').first().focus();await record(page,`fee-entry-${w}`);await page.keyboard.press('Enter');await page.waitForTimeout(50);check(new URL(page.url()).hash==='#hojin','corporate one action');
   const table=page.locator('.fee-scroll').nth(1);await table.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);await table.evaluate(el=>el.scrollLeft=el.scrollWidth);await record(page,`fee-table-${w}`,await table.evaluate(el=>({tableClient:el.clientWidth,tableScroll:el.scrollWidth,left:el.scrollLeft})));
   check(await page.locator('.fee-table tr').count()===32,'30 fee rows retained');await entry.locator('a[href="#gyakubiki"]').focus();await page.keyboard.press('Enter');check(new URL(page.url()).hash==='#gyakubiki','amount one action');await record(page,`fee-amount-${w}`);
   await page.emulateMedia({media:'print'});check(await table.evaluate(el=>getComputedStyle(el).overflow)==='visible','fee print full table');await page.emulateMedia({media:'screen'});
  }
 }
 check(errors.length===0,'no JS errors '+errors.join(';'));await page.close();
}
// Guard against a response arriving after the user edits the salary while loading.
if(!only||only==='stale'){
 const p=await app.context.newPage();let release;const held=new Promise(r=>release=r);
 await p.route('**/gensen_getsugaku_r08.json',async r=>{await held;await r.continue();});await p.goto(app.base+'/gensen-choshu/',{waitUntil:'domcontentloaded'});await p.locator('#amount').fill('300000');await p.locator('#calcK').click();await p.locator('#amount').fill('400000');release();await p.locator('#resultK .big').waitFor();check(await p.locator('#copy-k').isDisabled(),'slow result stays stale');await p.close();
}
if(mutation)check(mutated,'mutation applied');
console.log('UIUX 1–5: browser interactions passed');
}finally{if(dir)await writeFile(dir+'/operations.json',JSON.stringify(log,null,2));await app.close();}
