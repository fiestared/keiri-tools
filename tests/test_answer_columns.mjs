/**
 * 主要なツール・早見表の「答えの列」を、初期表示で見せる（2026-10-08 UI/UX レビュー 高1・高2）。
 *
 * 前回（09-30 #10）は「→ 横にスクロールできます」の合図だけ付けて、答えの列は画面外のままだった。
 * 合図がある ≠ 見える。ここでは、利用者が来た目的の列（<th data-answer>）を登録簿で名指しし、
 * 実ブラウザで PC 3幅（1280/1440/1920。セッションの96%）と 390px で、計算の前後とも
 *   - 登録した数の data-answer 付きの表が在る（生成器の再実行や書き直しで印が消えたら落ちる）
 *   - tests/layout/table-measure.mjs の検査（数値の列が1つも見えない表／答えの列が隠れる表）が0件
 * を確かめる。PC 幅ではさらに（PC主レビュー 中4〜中6）
 *   - 見出し行が 160px 以下（/tedori/ の早見表は条件文の繰り返しで 256px あった）
 *   - 本文の1行が 600px 以下（/inshi/ 全20号の一覧は税額の列が狭く 947px あった）
 *   - 15行以上の表は内側に縦スクロール枠を持たず、表の中ほどまで送っても見出し行がヘッダーの直下に見えている
 *     （標準報酬月額表の640px枠・住民税の早見表で見出しの無い数字が続いた）
 * 全ページ×6幅の一般検査は test_layout_render が同じ measureTables を流す
 * （計算後にしか出ない結果表はそちらでは見えないので、ここで計算してから測る）。
 *
 * 新しい早見表・ツールに答えの列を作ったら、th に data-answer を付けてここへ登録する。
 */
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
import {measureTables} from './layout/table-measure.mjs';

export const REGISTRY = [
  {url:'/inshi/', answers:1, why:'第17号の早見表（印紙税額）'},
  {url:'/column/juminzei-hayamihyo/', answers:1, why:'年収別の住民税（独身・配偶者ありの年額・月額）'},
  {url:'/column/kyokai-kenpo-ryoritsu-ichiran/', answers:1, why:'都道府県別の健康保険料率と本人負担'},
  {url:'/column/hyojun-hoshu-gakuhyo/', answers:1, why:'標準報酬月額表（PV2位。PCは枠を外してページのスクロール1本）'},
  {url:'/column/furikomi-tesuryo-hikaku/', answers:0, why:'振込手数料の比較（PV1位。答えの列の印は付けず、PC の見出し sticky・見出し行・1行の高さだけを見る）'},
  {url:'/tedori/', answers:1, why:'額面→手取りの早見表'},
  {url:'/furusato/', answers:2, why:'上限額の早見表／自己負担の算術例'},
  {url:'/jidoshazei/', answers:1, why:'排気量別の年額（新税率）'},
  {url:'/shakai-hoken/', answers:1, fill:{monthly:'300000',age:'35'}, why:'計算結果の内訳（本人負担）'},
];
const WIDTHS=[1280,1440,1920,390];

const {chromium}=await browserTools();const server=await serve();let browser;const failures=[];
try{
 browser=await chromium.launch();const context=await contextFor(browser,server.origin);const page=await context.newPage();
 for(const width of WIDTHS){
  await page.setViewportSize({width,height:width<700?844:900});
  for(const r of REGISTRY){
   await ready(page,server.origin+r.url);
   if(r.fill){for(const [id,v] of Object.entries(r.fill))await page.locator('#'+id).fill(v);await page.click('#calc');await page.waitForFunction(()=>document.querySelector('.result table'),null,{timeout:15000});await page.waitForTimeout(150);}
   const n=await page.evaluate(()=>[...document.querySelectorAll('main table')].filter(t=>t.querySelector('th[data-answer]')).length);
   if(n!==r.answers)failures.push(`${r.url} @${width}: data-answer の表が ${n}（登録は ${r.answers}。${r.why}）`);
   if(width>=1024)for(const p of await page.evaluate(()=>{const out=[];const hb=document.querySelector('header.site').getBoundingClientRect().bottom;
     for(const [ti,t] of [...document.querySelectorAll('main table')].entries()){if(!t.getClientRects().length)continue;
      const head=t.tHead?.rows[0]||([...t.rows[0].cells].every(c=>c.tagName==='TH')?t.rows[0]:null);
      if(head&&head.getBoundingClientRect().height>160)out.push(`表#${ti} 見出し行が ${Math.round(head.getBoundingClientRect().height)}px`);
      for(const tr of t.tBodies[0]?.rows||[])if(tr!==head&&tr.getBoundingClientRect().height>600){out.push(`表#${ti} 1行が ${Math.round(tr.getBoundingClientRect().height)}px`);break;}
      const body=[...t.rows].filter(r=>r!==head);if(!head||body.length<15)continue;
      for(let e=t.parentElement;e&&e.tagName!=='MAIN';e=e.parentElement){const cs=getComputedStyle(e);if(/(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+2)out.push(`表#${ti} が縦 ${e.clientHeight}px の枠の中でスクロールする`);}
      const mid=body[Math.floor(body.length/2)];scrollTo(0,scrollY+mid.getBoundingClientRect().top-300);
      const top=head.cells[0].getBoundingClientRect().top;if(Math.abs(top-hb)>2)out.push(`表#${ti} の中ほどで見出し行が見えない（top ${Math.round(top)} / ヘッダー下端 ${Math.round(hb)}）`);
      scrollTo(0,0);}
     return out;}))failures.push(`${r.url} @${width}: ${p}`);
   for(const i of await page.evaluate(measureTables))failures.push(`${r.url} @${width}: ${i.kind} 表#${i.table}${i.answer?' 「'+i.answer+'」':''}${i.hidden!=null?' '+i.hidden+'px':''}: ${i.text}`);
  }
 }
}finally{await browser?.close();server.close();}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`✓ answer columns: ${REGISTRY.length} pages × ${WIDTHS.length} widths (${WIDTHS.join('/')}); 計算後の結果表を含め、答えの列と数値の列が初期表示で見える`);
