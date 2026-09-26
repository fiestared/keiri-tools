import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {start,shot} from '../tools/uiux-0926/browser.mjs';
const mutation=process.env.RETENTION_MUTATION, dir=process.env.RETENTION_ARTIFACTS, log=[];
const mutations={
 enter:['/assets/calculator_keyboard.js','button.click();','void 0;'],
 search:['/assets/qa_search.js',"const direct = directTools[normalize(query).replace(/ /g, '')];",'const direct = null;'],
 kana:['/zengin-kana/index.html','var(--line-strong)','var(--line)'],
 it:['/hojokin/index.html','$("keyword").value = \'\';\n    purposeInputs.find',"/* keyword not cleared */\n    purposeInputs.find"],
};
let changed=false;
const app=await start((path,body)=>{if(!mutation)return body;const [target,from,to]=mutations[mutation];if(path!==target)return body;const s=body.toString();assert(s.includes(from));changed=true;return s.replace(from,to);});
const check=(v,m)=>assert(v,'RETENTION-UI: '+m);
async function record(p,name){const m=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,focus:document.activeElement.id||document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineWidth}));check(m.sw<=m.cw,name+' overflow');log.push({name,...m});await shot(p,dir,name);}
try{
for(const width of[1280,390]){
 const p=await app.context.newPage();await p.setViewportSize({width,height:900});check(await p.evaluate(()=>innerWidth)===width,'requested viewport');p.setDefaultTimeout(6000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(!mutation||mutation==='enter'){
  for(const[slug,input]of[['gensen-choshu','amount'],['shakai-hoken','monthly'],['tedori','gross'],['kihonteate','monthly']]){
   await p.goto(app.base+'/'+slug+'/');
   const field=p.locator('#'+input);await field.fill('300000');
   await p.evaluate(()=>{window.calcClicks=0;document.querySelector('#calcK,#calc').addEventListener('click',()=>window.calcClicks++);});
   await field.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229});check(await p.evaluate(()=>window.calcClicks)===0,'IME confirmation does not calculate');
   await field.press('Enter');await p.waitForFunction(()=>document.querySelector('.result .big'));check(await p.evaluate(()=>window.calcClicks)===1,'one Enter calculates once');
   if(slug==='gensen-choshu'){
    check(!await p.locator('#additional').getAttribute('open'),'addition starts folded');await p.locator('#additional summary').click();await p.locator('#shogaisha').check();await p.locator('#additional summary').click();check(await p.locator('#additional summary').innerText().then(t=>t.includes('設定あり')),'hidden setting visible in summary');
    await field.press('Enter');await p.waitForFunction(()=>document.querySelector('#resultK').dataset.resultState==='success');check(await p.locator('#shogaisha').isChecked(),'fold retains condition');
    await p.locator('#tab-hoshu').click();await p.locator('#fee').fill('100000');await p.locator('#fee').press('Enter');await p.waitForFunction(()=>document.querySelector('#result').dataset.resultState==='success');check(await p.locator('#resultK').getAttribute('data-result-state')==='success','Enter current tab only');
    await p.locator('#tab-kyuyo').click();await p.locator('#additional summary').scrollIntoViewIfNeeded();await record(p,`gensen-optional-${width}`);
   }
   if(slug==='shakai-hoken'){
    await p.locator('#bonus-fields summary').click();await p.locator('#bonus').fill('500000');await p.locator('#bonus-fields summary').click();check(await p.locator('#bonus-fields summary').innerText().then(t=>t.includes('設定あり')),'bonus setting visible');await field.press('Enter');await p.waitForFunction(()=>document.querySelector('#result').dataset.resultState==='success');check(await p.locator('#result').innerText().then(t=>t.includes('賞与')),'folded bonus included');await p.locator('#bonus-fields summary').scrollIntoViewIfNeeded();await record(p,`shakai-optional-${width}`);
   }
   await field.focus();await p.keyboard.press('Tab');await record(p,`${slug}-enter-${width}`);
  }
 }
 if(!mutation||mutation==='search'){
  await p.goto(app.base+'/');await p.locator('#qa-q').fill('源泉徴収');await p.locator('#qa-q').press('Enter');await p.locator('.qa-card-title').first().waitFor();check(await p.locator('.qa-card-title').first().getAttribute('href')==='/gensen-choshu/','direct calculator first');
  check((await p.locator('.qa-card-ans').allTextContents()).every(t=>t.length<90),'short summaries');await p.locator('#qa-results').scrollIntoViewIfNeeded();await record(p,`search-gensen-${width}`);
  await p.locator('#qa-q').fill('源泉徴収票 書き方');await p.locator('#qa-q').press('Enter');await p.waitForFunction(()=>document.querySelector('.qa-card-title')?.getAttribute('href')==='/gensen-hyo/');
 }
 if(!mutation||mutation==='kana'){
  await p.goto(app.base+'/zengin-kana/');const border=await p.locator('#names').evaluate(e=>getComputedStyle(e).borderColor);check(border==='rgb(130, 149, 164)'||border===await p.evaluate(()=>{const e=document.createElement('div');e.style.color='var(--line-strong)';document.body.append(e);const c=getComputedStyle(e).color;e.remove();return c;}),'strong input border');
  await p.locator('#names').fill('カブシキガイシャ');await p.locator('#names').press('Enter');await p.keyboard.type('ヤマダ');check(await p.locator('#names').inputValue().then(t=>t.includes('\n')),'textarea keeps Enter newline');await record(p,`kana-border-${width}`);
 }
 if(!mutation||mutation==='it'){
  await p.goto(app.base+'/hojokin/');if(!await p.locator('#keyword').isVisible())await p.locator('#hj-filter-fold > summary').click();await p.locator('#keyword').fill('IT');await p.locator('#hj-it-hint').waitFor();check(await p.locator('.hj-item mark').count()>0,'keyword match explained');await p.locator('#hj-it-hint').scrollIntoViewIfNeeded();await record(p,`hojokin-it-match-${width}`);
  await p.locator('[data-it-purpose]').click();await p.waitForFunction(()=>document.activeElement.id==='hj-status');check(await p.locator('#keyword').inputValue()==='','purpose shortcut clears literal IT');check(await p.locator('input[name=purpose]:checked').inputValue()==='設備整備・IT導入をしたい','purpose shortcut selects IT');await record(p,`hojokin-it-purpose-${width}`);
  await p.locator('[data-reset]').first().click();if(!await p.locator('#keyword').isVisible())await p.locator('#hj-filter-fold > summary').click();await p.locator('#keyword').fill('INPIT');await p.waitForFunction(()=>document.querySelector('#count')?.textContent!=='0');check(await p.locator('.hj-item').first().innerText().then(t=>t.includes('INPIT')),'INPIT still found');
  await p.locator('#keyword').fill('zzzzzzxxxxx');await p.locator('#hj-empty').waitFor();await p.locator('#hj-empty [data-reset]').click();await p.locator('.hj-item').first().waitFor();
 }
 if(!mutation){
  await p.goto(app.base+'/yukyu/');await p.setViewportSize({width:320,height:900});const table=p.locator('.retention-table').first();await table.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(100);check(await table.evaluate(e=>e.scrollLeft)>0,'leave table keyboard scroll');await record(p,'yukyu-table-320-'+width);
  await p.setViewportSize({width,height:900});for(const slug of ['gensen-choshu','shakai-hoken','column/keiri-nenkan-schedule']){await p.goto(app.base+'/'+slug+'/');await p.locator('.retention-updates').scrollIntoViewIfNeeded();check(await p.locator('.retention-updates time').count()>0,'dated change notice');await record(p,slug.replaceAll('/','_')+'-changes-'+width);}
 }
 check(!errors.length,errors.join(';'));await p.close();
}
if(mutation)check(changed,'mutation applied');console.log('UI 6–9 and leave tables: interactions, IME, focus, search and changes passed');
}finally{if(dir)await writeFile(dir+'/ui-operations.json',JSON.stringify(log,null,2));await app.close();}
