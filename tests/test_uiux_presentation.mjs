import {withLink,LINE} from '../tools/gen_x_link.mjs';
import {hasBreadcrumb,hasRelatedLinks} from './layout/article-structure.mjs';
import assert from 'node:assert/strict';
import {presentationMarkup,foldLongRelated,toolBeforeRail,articleBeforeRail,hideDuplicateFooterNotes} from '../tools/gen_presentation_markup.mjs';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
import {measureUi} from './layout/ui-measure.mjs';
assert(hasBreadcrumb('<nav class="breadcrumb breadcrumb-needs-separator">'));
assert(!hasBreadcrumb('<nav class="not-breadcrumb">'));
assert(!hasRelatedLinks('<section class="related"><h2>関連記事</h2></section>'));
assert(!hasRelatedLinks('<section class="next-read"><a href="/x/"></a></section>'));
assert(hasRelatedLinks('<section class="next-read"><a href="/x/">次の記事</a></section>'));
const articleFixture='<main><article><!--rail-next:wrap--><div class="side-rail">目次</div><!--rail-next:wrapE--><h1>表題</h1><p>最初に読む答え</p><h2>説明</h2></article></main>';
const articleMoved=articleBeforeRail(articleFixture);assert.equal(articleBeforeRail(articleMoved),articleMoved);assert(articleMoved.indexOf('<h1>')<articleMoved.indexOf('side-rail'));
const footerFixture='<footer>'+LINE.replace('<!-- x-link:auto -->','')+LINE+'</footer>';
const footerFixed=hideDuplicateFooterNotes(footerFixture);assert.equal(hideDuplicateFooterNotes(footerFixed),footerFixed);assert.equal(withLink(footerFixed),footerFixed);assert.equal(footerFixed.replace(' data-duplicate-note hidden',''),footerFixture);
const joined='<nav class="breadcrumb"><a href="/">ホーム</a> › <a href="/column/">コラム</a>S&amp;P500の比較</nav>';
const repaired=presentationMarkup(joined);
assert(repaired.includes('breadcrumb-needs-separator'));
assert.equal(presentationMarkup(repaired),repaired);
assert.equal(repaired.replace(' breadcrumb-needs-separator',''),joined,'Only a presentation class may change');
const separated=joined.replace('</a>S','</a> › S');assert.equal(presentationMarkup(separated),separated);
const longRelated='<section class="next-read"><h2>次に読む</h2><div class="tool-grid">'+Array.from({length:8},(_,i)=>'<a class="tool-card" href="/'+i+'/"><b>記事'+i+'</b></a>').join('')+'</div></section>';
const folded=foldLongRelated(longRelated);assert.equal(foldLongRelated(folded),folded);assert.deepEqual([...folded.matchAll(/href="([^"]*)"/g)].map(m=>m[1]),[...longRelated.matchAll(/href="([^"]*)"/g)].map(m=>m[1]));
const tokenFixture='<main><table><tr><td>第22級・300,000円</td><td>＋20,000円</td><td>16.4万〜40.5万円・6か月</td></tr></table></main>';
const railFixture='<main><script type="text/plain">test_core.js</script><!--rail-next:wrap--><div class="side-rail">目次</div><!--rail-next:wrapE--><div class="card"><label>入力</label><div><input></div></div></main>';
const railMoved=toolBeforeRail(railFixture);assert(railMoved.indexOf('class="card"')<railMoved.indexOf('side-rail'));assert.equal(toolBeforeRail(railMoved),railMoved);
const {chromium}=await browserTools(),server=await serve();let browser;
try{
 browser=await chromium.launch();const c=await contextFor(browser,server.origin),p=await c.newPage();await ready(p,server.origin+'/');
 const content='<!doctype html><link rel="stylesheet" href="'+server.origin+'/assets/style.css"><main>'+repaired+'<button>計算する</button><div class="callout"><a href="#">説明</a></div><details><summary>条件を見る</summary><p>条件</p></details><section class="next-read"><a class="tool-card"><b>S&amp;P500</b><span>比較を読む</span></a></section><div class="scroll-wrap"><table>'+Array.from({length:40},(_,i)=>'<tr><td>項目'+i+'</td><td>100円</td></tr>').join('')+'</table></div></main>';
 const reset=async()=>{await p.emulateMedia({media:'screen'});await p.setContent(content);await p.evaluate(()=>document.fonts.ready);};
 for(const width of [1280,1536,1920,1200,768,390]){
  await p.setViewportSize({width,height:900});await reset();assert.deepEqual(await p.evaluate(measureUi),[],`Healthy presentation @${width}`);
  const cases=[
   ['action-target',()=>{document.querySelector('button').style.cssText='min-height:0;height:20px;padding:0';}],
   ['breadcrumb-separator',()=>{document.querySelector('.breadcrumb').className='breadcrumb';}],
   ['navigation-entity',()=>{document.querySelector('.next-read b').textContent='S&amp;P500';}],
   ['required-toc-hidden',()=>{const s=document.createElement('script');s.type='text/plain';s.textContent='fixture_core.js';document.body.append(s);const h=document.createElement('h2');h.textContent='説明';document.querySelector('main').append(h);}],
   ['warning-link-contrast',()=>{document.querySelector('.callout a').style.color='#a8641b';}],
   ['required-toc-empty',()=>{const s=document.createElement('script');s.type='text/plain';s.textContent='fixture_core.js';document.body.append(s);document.querySelector('main').insertAdjacentHTML('beforeend','<h2>説明</h2><nav class="toc">目次</nav>');}],
  ];
  for(const [kind,mutation]of cases){await reset();await p.evaluate(mutation);assert((await p.evaluate(measureUi)).some(i=>i.kind===kind),`Must reject ${kind} @${width}`);}
  await reset();await p.emulateMedia({media:'print'});assert.deepEqual(await p.evaluate(measureUi),[],`Full printed table @${width}`);
  await p.evaluate(()=>document.querySelector('.scroll-wrap').style.cssText='max-height:100px!important;overflow:auto!important');assert((await p.evaluate(measureUi)).some(i=>i.kind==='print-table-clipped'),`Must reject print clipping @${width}`);
 }
 await p.emulateMedia({media:'screen'});await p.setContent('<link rel="stylesheet" href="'+server.origin+'/assets/style.css">'+folded);
 assert.equal(await p.locator('.tool-card:visible').count(),3);await p.locator('summary').click();assert.equal(await p.locator('.tool-card:visible').count(),8);assert(!(await p.evaluate(measureUi)).some(i=>i.kind==='unbounded-related-list'));await p.setContent('<link rel="stylesheet" href="'+server.origin+'/assets/style.css">'+longRelated);assert((await p.evaluate(measureUi)).some(i=>i.kind==='unbounded-related-list'));
 await p.setContent('<link rel="stylesheet" href="'+server.origin+'/assets/style.css">'+'<main><table style="width:65px;table-layout:fixed"><tr><td><span class="numeric-token">＋20,000円</span></td></tr></table></main>');
 assert(!(await p.evaluate(measureUi)).some(i=>i.kind==='number-unit-wrap'));await p.locator('.numeric-token').evaluate(e=>e.replaceWith(e.textContent));assert((await p.evaluate(measureUi)).some(i=>i.kind==='number-unit-wrap'));
 await p.setViewportSize({width:390,height:844});await p.setContent('<link rel="stylesheet" href="'+server.origin+'/assets/style.css">'+railMoved);assert(!(await p.evaluate(measureUi)).some(i=>i.kind==='tool-below-navigation'));await p.locator('.side-rail').evaluate(e=>e.parentElement.prepend(e));assert((await p.evaluate(measureUi)).some(i=>i.kind==='tool-below-navigation'));
 await p.setContent(tokenFixture);const originalText=await p.locator('main').textContent();await p.addScriptTag({url:server.origin+'/assets/empty-state.js'});
 assert.equal(await p.locator('main').textContent(),originalText);for(const token of ['＋20,000円','16.4万','6か月'])assert(await p.locator('.numeric-token').allTextContents().then(ts=>ts.includes(token)));
 const initialMarkup=await p.locator('main').innerHTML();await p.evaluate(()=>dispatchEvent(new Event('resize')));assert.equal(await p.locator('main').innerHTML(),initialMarkup,'Runtime token wrapping is idempotent');
 await p.setViewportSize({width:390,height:844});await p.setContent(articleFixture);assert((await p.evaluate(measureUi)).some(i=>i.kind==='article-below-navigation'));await p.setContent(articleMoved);assert(!(await p.evaluate(measureUi)).some(i=>i.kind==='article-below-navigation'));
 for(const width of [1280,390])for(const slug of ['orcan-vs-emaxis-sp','orcan-sp500-holding-period','orcan-sp500-recovery-days']){await p.setViewportSize({width,height:900});await ready(p,server.origin+'/column/'+slug+'/');assert.deepEqual(await p.evaluate(measureUi),[]);}
 await p.setContent(footerFixture);assert((await p.evaluate(measureUi)).some(i=>i.kind==='duplicate-footer-note'));await p.setContent(footerFixed);assert(!(await p.evaluate(measureUi)).some(i=>i.kind==='duplicate-footer-note'));
 // Keyboard focus, activation, and an actual computed result. No production requests.
 for(const width of [1280,390]){
  await p.emulateMedia({media:'screen'});await p.setViewportSize({width,height:900});await ready(p,server.origin+'/');
  const control=p.locator('.persona-bar button').first();await control.focus();await p.keyboard.press('Tab');
  const ring=await p.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,style:s.outlineStyle,width:parseFloat(s.outlineWidth)};});assert.equal(ring.tag,'BUTTON');assert.notEqual(ring.style,'none');assert(ring.width>=2);
  await ready(p,server.origin+'/shobyo/');await p.locator('#startDate').fill('2026-09-01');await p.locator('#calc').click();assert.match(await p.locator('#result').innerText(),/6,667/);assert.deepEqual(await p.evaluate(measureUi),[]);
  await ready(p,server.origin+'/embed/tedori/');const summary=p.locator('summary');await summary.focus();await p.keyboard.press('Enter');assert(await summary.evaluate(e=>e.parentElement.open));await p.locator('#gross').fill('300000');await p.locator('#calc').click();assert.match(await p.locator('#result').innerText(),/237,068/);assert.deepEqual(await p.evaluate(measureUi),[]);
 }
 await c.close();
}finally{await browser?.close();server.close();}
console.log('✓ Breadcrumb text preservation; 7 broken presentations × 6 widths; unit/rail/list mutations; print completeness; keyboard and calculation states');
