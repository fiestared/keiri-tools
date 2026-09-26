/** Real Chromium fixtures: each broken layout must independently trip its named gate. */
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
import {measure} from './layout/measure.mjs';
const {chromium}=await browserTools();const server=await serve();let browser;
const base=`<main>
<div class="hero"><h1>表示検査の正常なページ</h1></div>
<div class="fee-pair field-pair" id="pair"><div><label for="one">金額</label><input id="one" aria-describedby="one-hint"><span class="hint" id="one-hint">補足</span></div><div><label for="two">年齢</label><input id="two"></div></div>
<div class="scroll-wrap"><table><thead><tr><th>区分</th><th class="num">額</th></tr></thead><tbody><tr><td>通常</td><td class="num"><span class="numeric-token">123,456円</span></td></tr></tbody></table></div>
<section><h2>よくある質問</h2><h3 class="faq-question">質問ですか？</h3><p class="faq-answer">回答です。</p></section>
<p id="clip">一行目<br>二行目<br>三行目</p><p id="next">次の段落です。</p>
<svg id="figure" viewBox="0 0 400 120" width="400" style="max-width:100%"><rect x="10" y="10" width="180" height="90" fill="none" stroke="black"/><text x="20" y="40" font-size="16">正しい図の文字</text><text x="220" y="40" font-size="16">別の文字</text></svg>
</main><footer class="site">フッター</footer>`;
const cases=[
 ['duplicate-id',()=>{document.querySelector('#two').id='one';}],
 ['page-overflow',()=>{document.querySelector('main').style.minWidth='2000px';}],
 ['empty-heading',()=>{document.querySelector('h1').textContent='';}],
 ['hint-in-label',()=>{document.querySelector('label').append(document.querySelector('.hint'));}],
 ['help-position',()=>{document.querySelector('.hint').style.transform='translateY(-80px)';}],
 ['field-alignment',()=>{document.querySelector('#pair').style.cssText='display:grid;grid-template-columns:1fr 1fr';document.querySelector('#two').style.transform='translateY(20px)';}],
 ['choice-caption-wrap',()=>{const label=document.createElement('label');label.style.cssText='display:flex;width:90px;font-size:16px';label.innerHTML='<input type=checkbox style=\"width:65px;flex:none\">両端を含めます';document.querySelector('main').append(label);}],
 ['table-prose-width',()=>{const t=document.querySelector('table');t.style.cssText='table-layout:fixed;width:40px';for(const c of t.querySelectorAll('td,th'))c.style.cssText='min-width:0;padding:0;width:20px';t.querySelector('td').textContent='説明文が一文字ずつ縦に折り返される';}],
 ['table-border',()=>{for(const e of document.querySelectorAll('td'))e.style.border='none';}],
 ['table-background',()=>{document.querySelector('td').style.background='transparent';}],
 ['number-wrap',()=>{const e=document.querySelector('td.num');e.innerHTML='<span style="display:block;width:12px;word-break:break-all">123,456円 160万円</span>';}],
 ['numeric-alignment',()=>{document.querySelector('td.num').style.textAlign='left';}],
 ['svg-viewbox',()=>{document.querySelector('svg text').setAttribute('x','390');}],
 ['svg-rect',()=>{document.querySelector('svg rect').setAttribute('width','80');}],
 ['svg-overlap',()=>{document.querySelectorAll('svg text')[1].setAttribute('x','25');}],
 ['svg-bar-metadata',()=>{document.querySelector('svg rect').setAttribute('data-layout-role','bar');}],
 ['footer-alignment',()=>{document.querySelector('footer').style.paddingLeft='48px';}],
 ['faq-marker',()=>{document.querySelector('h3').className='';}],
 ['faq-weight',()=>{document.querySelector('.faq-answer').style.fontWeight='700';}],
 ['missing-toc',()=>{for(let i=0;i<2;i++){const h=document.createElement('h2');h.textContent='項目'+i;document.querySelector('main').append(h);}const script=document.createElement('script');script.type='text/plain';script.textContent='example_core.js';document.body.append(script);}],
 ['text-clipped',()=>{const e=document.querySelector('#clip');e.style.cssText='height:20px;overflow:hidden';}],
 ['text-overlap',()=>{document.querySelector('#next').style.transform='translateY(-35px)';}],
 ['broken-image',()=>{const e=new Image();e.src='/layout-fixture-missing.png';document.querySelector('main').append(e);}],
 ['image-clipped',()=>{const div=document.createElement('div');div.style.cssText='width:40px;height:40px;overflow:hidden';const img=new Image();img.width=100;img.height=100;img.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';div.append(img);document.querySelector('main').append(div);}]
];
try{
 browser=await chromium.launch();const context=await contextFor(browser,server.origin);const page=await context.newPage();const scriptErrors=[];page.on('pageerror',e=>scriptErrors.push(String(e)));await ready(page,server.origin+'/');
 async function reset(){await page.setContent('<!doctype html><html lang="ja"><head><meta charset="utf-8"><link rel="stylesheet" href="'+server.origin+'/assets/style.css"></head><body>'+base+'</body></html>');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(50);}
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await reset();let measured=await page.evaluate(measure);assert.deepEqual(measured.issues,[],`Healthy fixture @${width}`);
  for(const [kind,mutate]of cases){await reset();await page.evaluate(mutate);await page.waitForTimeout(80);measured=await page.evaluate(measure);assert(measured.issues.some(i=>i.kind===kind),`Mutation not caught: ${kind} @${width}: ${JSON.stringify(measured.issues)}`);}
  await reset();scriptErrors.length=0;await page.evaluate(()=>{const script=document.createElement('script');script.textContent='const repeated = 1; const repeated = 2;';document.body.append(script);});await page.waitForTimeout(80);assert(scriptErrors.some(e=>e.includes('repeated')),'Duplicate declaration must be a browser page error');
  // Local table scrolling and a quantitative bar are legitimate, not page overflow/text boxes.
  await reset();await page.evaluate(()=>{document.querySelector('table').style.minWidth='900px';const rect=document.querySelector('svg rect');rect.setAttribute('width','80');rect.setAttribute('data-layout-role','bar');rect.setAttribute('data-layout-note','Amount encoded by width; label intentionally extends past bar');});
  assert.deepEqual((await page.evaluate(measure)).issues,[],`Legitimate scroll/bar @${width}`);
 }
}finally{await browser?.close();server.close();}
console.log(`✓ ${cases.length} independent broken HTML cases × 2 widths rejected; healthy/scroll/bar controls accepted`);
