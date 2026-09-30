import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
const out=process.env.PV_SHOTS;
if(out)mkdirSync(out,{recursive:true});
const server=await serve(),{chromium}=await browserTools(),browser=await chromium.launch();
const records=[];
try {
 const context=await contextFor(browser,server.origin);
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await context.addInitScript(()=>{window.__copy='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copy=text;}}});});
 const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+09:00'));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function shot(name,selector,width){
  const target=page.locator(selector).first();await target.scrollIntoViewIfNeeded();
  // 2026-09-30: 以前は「必要なら画面内へ→上へ160px」で、要素が既に画面の下端近くにあると（計算後に結果へ自動スクロールする
  //   ようになった源泉の結果など）160px ずらした分だけ画面外へ出ていた。どの要素も「上から180px」に置く（位置に依存しない）
  await target.evaluate(el=>scrollTo(0,scrollY+el.getBoundingClientRect().top-180));
  await page.waitForTimeout(1100);
  const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.equal(dimensions.width,width);assert(dimensions.scrollWidth<=width,`${name} overflow: ${dimensions.scrollWidth}`);
  const rec={name,width,...dimensions};
  if(out){rec.file=`${name}-${width}.png`;await page.screenshot({path:out+'/'+rec.file});}
  records.push(rec);
 }
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  for(const [id,fee] of [['mizuho-eb','490'],['mufg-bizstation','484'],['smbc-web21-standard','495']]){
   await page.goto('about:blank');await ready(page,server.origin+'/senpou-futan/#bank='+id);
   assert.equal(await page.inputValue('#feeUnder'),fee);assert.equal(await page.inputValue('#invoice'),'');
   await shot('senpou-'+id,'#bankPreset',width);
   await page.fill('#invoice','30200');
   for(const method of ['sueoki','mikan_kasan','ijo_kasan']){await page.check(`input[name="method"][value="${method}"]`);await page.click('#calc');assert.match(await page.locator('#result').innerText(),/振込額/);}
   await page.fill('#feeUnder','123');await page.evaluate(()=>{location.hash='bank=mizuho-eb';});await page.waitForTimeout(50);assert.equal(await page.inputValue('#feeUnder'),'123');
  }
  for(const slug of ['yukyu','shakai-hoken','gensen-choshu','bonus-tedori']){
   await ready(page,server.origin+'/'+slug+'/');assert(await page.locator('#result-next').isHidden());
   const button=slug==='gensen-choshu'?'#calcK':'#calc',copy=slug==='gensen-choshu'?'#copy-k':'#copy-result';
   await page.fill(slug==='yukyu'?'#hire':slug==='shakai-hoken'?'#monthly':slug==='gensen-choshu'?'#amount':'#bonus','');
   await page.click(button);assert(await page.locator('#result-next').isHidden());
   if(slug==='yukyu')await page.fill('#hire','2026-01-01');
   if(slug==='shakai-hoken')await page.fill('#monthly','300000');
   if(slug==='gensen-choshu')await page.fill('#amount','250000');
   if(slug==='bonus-tedori'){await page.fill('#bonus','500000');await page.fill('#zengetsu','300000');}
   await page.click(button);await page.locator('#result-next').waitFor({state:'visible'});
   await page.evaluate(sel=>{window.__button=document.querySelector(sel);window.__save=document.querySelector('#memo-save');},copy);
   await page.click(button);await page.locator('#result-next').waitFor({state:'visible'});
   assert(await page.evaluate(sel=>window.__button===document.querySelector(sel)&&window.__save===document.querySelector('#memo-save'),copy));
   await page.click(copy);assert((await page.evaluate(()=>window.__copy)).length>30);
   await page.locator(copy).focus();await page.keyboard.press('Tab');
   // Bookmark hint controls can occur between the copy button and the workflow link.
   for(let i=0;i<6&&!await page.locator('#result-next a').evaluate(el=>el===document.activeElement);i++)await page.keyboard.press('Tab');
   assert(await page.locator('#result-next a').evaluate(el=>el===document.activeElement),'next link reachable by keyboard');
   await shot(slug+'-result','#result-next',width);
   const views=await page.evaluate(()=>dataLayer.filter(x=>x[1]==='workflow_view'&&x[2].slot==='result_next_v1').map(x=>x[2]));
   assert.equal(views.length,1);assert.deepEqual(Object.keys(views[0]).sort(),['from','link_url','slot']);
   await page.locator('#result-next a').evaluate(el=>el.addEventListener('click',e=>e.preventDefault()));await page.locator('#result-next a').click();
   assert.equal(await page.evaluate(()=>dataLayer.filter(x=>x[1]==='workflow_click'&&x[2].slot==='result_next_v1').length),1);
   if(slug==='yukyu'){
    await page.click('#memo-save');assert(await page.evaluate(()=>!!localStorage.getItem('yukyu_memo_v1')));
    await page.selectOption('#wdays','4');await page.fill('#whours','20');await page.fill('#hire','2024-01-01');await page.click(button);
    assert.match(await page.locator('#result .big').innerText(),/9日/);assert(await page.locator('#result-next').isHidden());
    await page.selectOption('#wdays','5');await page.fill('#hire','2026-01-01');await page.click(button);assert.match(await page.locator('#result .big').innerText(),/10日/);assert(await page.locator('#result-next').isVisible());
   }
   if(slug==='gensen-choshu'){
    await page.click('#tab-shoyo');await page.fill('#shoyoAmt','500000');await page.fill('#zenAmt','300000');await page.click('#calcS');
    await page.locator('#resultS[data-result-state="success"]').waitFor();assert(await page.locator('#result-next').isHidden());
    await page.click('#tab-hoshu');await page.fill('#fee','100000');await page.click('#calc');
    await page.locator('#result[data-result-state="success"]').waitFor();assert(await page.locator('#result-next').isHidden());
   }
   else {const field=slug==='yukyu'?'#hire':slug==='shakai-hoken'?'#monthly':'#bonus';await page.fill(field,'');assert(await page.locator('#result-next').isHidden());await page.click(button);assert(await page.locator('#result-next').isHidden());}
  }
  for(const slug of ['furikomi-tesuryo-hikaku','nenshu-no-kabe','shakai-hoken-kanyu-joken','kaigo-hokenryo-itsukara','gensen-shotokuzei-nofusho','hoteichosho-goukeihyo','kyuyo-shiharai-hokokusho','orcan-hikaku','invesco-sekai-vs-emaxis-orcan']){
   await ready(page,server.origin+'/column/'+slug+'/');
   const links=page.locator('.workflow-next');
   for(let i=0;i<await links.count();i++){
    await shot(slug+(i?'-'+(i+1):''),`.workflow-next >> nth=${i}`,width);
    const href=await links.nth(i).locator('a').getAttribute('href');const res=await context.request.get(server.origin+href.split('#')[0]);assert.equal(res.status(),200);
   }
   const views=await page.evaluate(()=>dataLayer.filter(x=>x[1]==='workflow_view'&&x[2].slot!=='toc_related_v1'));
   assert.equal(views.length,1,slug+' view once per slot');
  }
 }
 // Back navigation retains manual changes; hash navigation never writes history itself.
 await page.goto('about:blank');await ready(page,server.origin+'/senpou-futan/#bank=mizuho-eb');
 await page.fill('#feeUnder','321');await page.fill('#invoice','54321');
 await ready(page,server.origin+'/column/furikomi-tesuryo-hikaku/');await page.goBack({waitUntil:'networkidle'});
 assert.equal(await page.inputValue('#feeUnder'),'321');assert.equal(await page.inputValue('#invoice'),'54321');
 // Failure and unknown IDs still support manual calculations, and back restores an edited form.
 await page.goto('about:blank');await ready(page,server.origin+'/senpou-futan/#bank=unknown');assert.equal(await page.inputValue('#bankPreset'),'');
 await page.route('**/fee_table.json',r=>r.abort());await page.goto('about:blank');await ready(page,server.origin+'/senpou-futan/#bank=mizuho-eb');assert.match(await page.locator('#preset-note').innerText(),/手入力/);
 await page.fill('#invoice','50000');await page.fill('#feeUnder','100');await page.fill('#feeOver','200');await page.click('#calc');assert.match(await page.locator('#result').innerText(),/49,800/);
 await page.unroute('**/fee_table.json');
 assert.deepEqual(errors,[]);
 if(out)writeFileSync(out+'/manifest.json',JSON.stringify(records,null,2));
 console.log(`✓ PV browser: ${records.length} views, input/results, copy/save, keyboard, conditions, telemetry, links and overflow`);
}finally{await browser.close();server.close();}
