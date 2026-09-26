import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {start,shot} from '../tools/uiux-0926/browser.mjs';
const mutation=process.env.RETENTION_MUTATION;
const mutations={
 month:['/assets/monthly_checklist.js','months[selected] = [...done];','months[pair[0]] = [...done];'],
 favorite:['/assets/favorite_tools.js','writeJSON(FAVORITES_KEY,next)','true'],
 restore:['/shiharai-site/index.html',"trackRetention('retention_restore','conditions','shiharai-site','restore')","trackRetention('retention_open','conditions','shiharai-site','restore')"],
 stale:['/assets/calculation_state.js',"if (['success', 'pending', 'stale'].includes(box.dataset.resultState)) stale();",'if (false) stale();'],
 ics:['/assets/payday_core.js','"URL:https://keiri-tools.com/shiharai-site/"','"URL:https://keiri-tools.com/"'],
};
let mutated=false;
const app=await start((path,body)=>{if(!mutation)return body;const[target,from,to]=mutations[mutation];if(path!==target)return body;const s=body.toString();assert(s.includes(from),'mutation target');mutated=true;return s.replace(from,to);}), artifacts=process.env.RETENTION_ARTIFACTS, log=[];
const check=(x,msg)=>assert(x,'RETENTION: '+msg);
async function record(p,name){const m=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,focus:document.activeElement.id||document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineWidth}));check(m.sw<=m.cw,name+' overflow');log.push({name,...m});await shot(p,artifacts,name);}
async function events(p){return p.evaluate(()=>(window.dataLayer||[]).filter(e=>e[0]==='event').map(e=>({name:e[1],params:e[2]})));}
async function success(p,id){await p.waitForFunction(id=>document.getElementById(id).dataset.resultState==='success',id);}
try{
for(const width of [1280,390]){
 const p=await app.context.newPage();await p.setViewportSize({width,height:900});check(await p.evaluate(()=>innerWidth)===width,'requested viewport');p.setDefaultTimeout(7000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(app.base+'/');await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await p.reload();
 await p.locator('[data-p=keiri]').click();check(await p.locator('#favorite-tools').isVisible(),'persona reveals toolbox');
 await p.locator('#favorite-tools summary').click();await p.locator('[data-favorite=yukyu]').focus();await p.keyboard.press('Enter');
 check(await p.evaluate(()=>localStorage.getItem('keiri_favorites_v1'))==='["yukyu"]','only tool ID saved');
 check((await events(p)).some(e=>e.name==='retention_favorite_add'),'favorite add event');
 await p.reload();check(await p.locator('[data-favorite-link=yukyu]').isVisible(),'favorite reload');await p.locator('#favorite-tools').evaluate(el=>el.scrollIntoView({block:'start'}));await record(p,`favorites-saved-${width}`);
 await p.locator('[data-p=kojin]').click();check(await p.locator('#favorite-tools').isHidden(),'not mixed with individual persona');await p.locator('[data-p=keiri]').click();
 await p.evaluate(()=>localStorage.setItem('keiri_retention_usage_v1',JSON.stringify({'favorites:yukyu':'2026-01-01'})));
 await p.locator('[data-favorite-link=yukyu]').click();await p.locator('#calc').click();await success(p,'result');await p.waitForTimeout(50);
 check((await events(p)).some(e=>e.name==='retention_use'&&e.params.feature==='favorites'),'favorite leads to successful calculation');
 check((await events(p)).some(e=>e.name==='retention_reuse'&&e.params.feature==='favorites'),'different-day favorite use');
 for(const slug of ['shiharai-site','yukyu']){
  await p.goto(app.base+'/'+slug+'/');
  if(slug==='shiharai-site') {await p.locator('#closing').selectOption('20');await p.locator('#label').fill('検査用の条件');}
  else await p.locator('#hire').fill('2023-04-01');
  await p.locator('#calc').click();const out=slug==='yukyu'?'result':'out';await success(p,out);
  const save=slug==='yukyu'?'memo-save':'save';await p.locator('#'+save).click();
  check((await events(p)).some(e=>e.name==='retention_save'&&e.params.tool===slug),'save success event');
  await p.evaluate(slug=>localStorage.setItem('keiri_retention_usage_v1',JSON.stringify({['conditions:'+slug]:'2026-01-01'})),slug);
  await p.reload();await p.locator(slug==='yukyu'?'#memo-return a':'#saved-return a').click();
  await p.locator('[data-load]').first().focus();await p.keyboard.press('Enter');await success(p,out);
  check((await events(p)).some(e=>e.name==='retention_restore'&&e.params.tool===slug),'actual restore event');
  check((await events(p)).some(e=>e.name==='retention_reuse'&&e.params.tool===slug),'different-day restore event');
  await record(p,`${slug}-restored-${width}`);
  await p.locator('#'+save).scrollIntoViewIfNeeded();await record(p,`${slug}-save-controls-${width}`);
  if(slug==='shiharai-site'){
   const downloadPromise=p.waitForEvent('download');await p.locator('#ics').click();const download=await downloadPromise;
   const stream=await download.createReadStream();let txt='';for await(const c of stream)txt+=c.toString();check(txt.includes('URL:https://keiri-tools.com/shiharai-site/'),'download return URL');
   check((await events(p)).some(e=>e.name==='retention_ics_export'),'ICS export event');
   await p.locator('#closing').selectOption('10');check(await p.locator('#ics').isDisabled(),'stale ICS disabled');check(await p.locator('#csv').isDisabled(),'stale CSV disabled');
  }else{await p.locator('#hire').fill('2025-04-01');check(await p.locator('#memo-save').isDisabled(),'stale memo disabled');}
  check(await p.locator('#copy-result').isDisabled(),'stale copy disabled');await p.locator('#'+out).scrollIntoViewIfNeeded();await record(p,`${slug}-stale-${width}`);
  await p.locator('#calc').click();await success(p,out);await p.locator('.bookmark-hint summary').click();await p.waitForFunction(()=>(window.dataLayer||[]).some(e=>e[1]==='retention_bookmark_hint'));check((await events(p)).some(e=>e.name==='retention_bookmark_hint'),'bookmark hint, not registration');
  await record(p,`${slug}-bookmark-${width}`);
  await p.locator(slug==='yukyu'?'#memo-clear':'#saved-clear').click();await p.reload();check(await p.locator('[data-load]').count()===0,'clear persists');
 }
 await p.goto(app.base+'/');await p.locator('[data-p=keiri]').click();await p.locator('#favorite-tools summary').click();await p.locator('#favorite-clear').click();await p.reload();check(await p.locator('[data-favorite-link]').count()===0,'bulk favorite clear');
 await p.goto(app.base+'/column/keiri-nenkan-schedule/');await p.locator('#monthly-checklist').waitFor({state:'visible'});
 check(await p.locator('#monthly-checklist input:not([type=checkbox])').count()===0,'no names or amounts');
 await p.locator('[data-task=records]').check();check(await p.evaluate(()=>localStorage.getItem('keiri_monthly_checks_v1'))===null,'checks are temporary until opt-in');
 await p.locator('#monthly-save').check();await p.reload();check(await p.locator('[data-task=records]').isChecked(),'saved check restored');
 const buttons=p.locator('[data-month]');await buttons.nth(1).click();check(!await p.locator('[data-task=records]').isChecked(),'next month starts unchecked');await p.locator('[data-task=payments]').check();await buttons.first().click();check(!await p.locator('[data-task=payments]').isChecked(),'months stay separate');
 await p.evaluate(()=>localStorage.setItem('keiri_retention_usage_v1',JSON.stringify({'monthly:keiri-nenkan-schedule':'2026-01-01'})));
 await p.locator('[data-task=social]').check();check((await events(p)).some(e=>e.name==='retention_reuse'),'different-day checklist use');
 check((await events(p)).some(e=>e.name==='retention_check'),'check event');check(!(await events(p)).some(e=>e.name==='tool_input'),'check is not calculator input');
 await p.locator('[data-month]').first().focus();await p.keyboard.press('Tab');await record(p,`monthly-saved-${width}`);
 await p.locator('#monthly-items').evaluate(el=>el.scrollIntoView({block:'start'}));await record(p,`monthly-tasks-${width}`);
 await p.locator('#monthly-clear').click();await p.reload();check(!await p.locator('[data-task=records]').isChecked(),'all months cleared');
 check(errors.length===0,errors.join(';'));
 // Only the enumerated vocabulary may be sent by the new events.
 for(const e of await events(p))if(e.name.startsWith('retention_'))check(Object.keys(e.params).sort().join(',')==='action,feature,retention_version,tool','no input in event payload');
 await p.close();
}
// Corrupt/blocked storage must not interrupt calculation, or report save success.
for(const mode of ['corrupt','denied']){
 const p=await app.context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(mode=>{if(mode==='denied')Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}});else localStorage.setItem('shiharai_conditions_v1','{bad');},mode);
 await p.goto(app.base+'/shiharai-site/');await p.locator('#calc').click();await success(p,'out');await p.locator('#save').click();
 check((await p.locator('#save-status').innerText()).includes(mode==='corrupt'?'読み取れません':'読み取れません'),'failure communicated');
 check(!(await events(p)).some(e=>e.name==='retention_save'),'failed save not counted');check(!errors.length,'storage failure no JS error');await record(p,`storage-${mode}`);await p.close();
}
// A browser crossing midnight JST and New Year must not inherit last month's checks.
{
 const p=await app.context.newPage();await p.clock.install({time:new Date('2026-12-31T14:59:00Z')});
 await p.goto(app.base+'/column/keiri-nenkan-schedule/');await p.evaluate(()=>localStorage.removeItem('keiri_monthly_checks_v1'));await p.reload();
 await p.locator('[data-task=records]').check();await p.locator('#monthly-save').check();
 await p.clock.setFixedTime(new Date('2026-12-31T15:01:00Z'));await p.reload();
 check(await p.locator('[data-month]').first().getAttribute('data-month')==='2027-01','JST New Year month');check(!await p.locator('[data-task=records]').isChecked(),'New Year starts incomplete');await p.close();
}
// Blocked storage on both new entry points stays usable, without a false successful save.
{
 const p=await app.context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}}));
 await p.goto(app.base+'/');await p.locator('[data-p=keiri]').click();await p.locator('#favorite-tools summary').click();await p.locator('[data-favorite=yukyu]').click();check(await p.locator('#favorite-tools [role=status]').innerText().then(t=>t.includes('保存できません')),'favorite failure explained');
 await p.goto(app.base+'/column/keiri-nenkan-schedule/');await p.locator('[data-task=records]').check();await p.locator('#monthly-save').click();check(!await p.locator('#monthly-save').isChecked(),'failed opt-in reset');check(await p.locator('[data-task=records]').isChecked(),'temporary check retained');check(!(await events(p)).some(e=>e.name==='retention_save'),'failed monthly save not counted');check(!errors.length,'new controls storage denied no JS error');await p.close();
}
// A late holiday response cannot re-enable exports after an edit.
{
 const p=await app.context.newPage();let release;const wait=new Promise(r=>release=r);await p.route('**/holidays_jp.json',async r=>{await wait;await r.continue();});
 await p.goto(app.base+'/shiharai-site/',{waitUntil:'domcontentloaded'});await p.locator('#calc').click();await p.locator('#closing').selectOption('10');release();await p.locator('#out table').waitFor();check(await p.locator('#ics').isDisabled(),'pending edit stays stale');await p.close();
}
if(mutation)check(mutated,'mutation applied');
console.log('Retention pages: save/reload/restore/erase, month isolation, favorites, events, blocked storage and slow fetch passed');
}finally{if(artifacts)await writeFile(artifacts+'/operations.json',JSON.stringify(log,null,2));await app.close();}
