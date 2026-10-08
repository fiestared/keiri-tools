/**
 * PC の目次レール: 1024〜1199px でも本文の右に出る／見出しは「目次」／いま読んでいる節を示す／長い目次の続きの合図。
 *   node tests/test_toc_rail_pc.mjs
 *
 * ★なぜ要るか（2026-10-08 PC主の UI/UX レビュー 中3・中7。gbrain audits/keiri-uiux-review-pc-2026-10-08）:
 *   - 1024〜1199px（1280画面の110%拡大・最大化していない窓）で目次が本文の下に落ち、右に約490pxの空白があった。
 *   - レールに「いまどの節か」が出ず、14〜15項目の目次は後半が枠の下に隠れているのに合図が無かった。
 *   - PC でもレールの見出しが「目次を閉じる」（操作の名前）だった。
 *   セッションの96%が PC（GA4 28日）なので、PC の幅（1100/1280/1440・高さ700/900）で見る。
 * 2026-10-08 第4便（第3周の低 L7・L8）で足したこと:
 *   - 「あわせて読む」の見出しに ▶ を付けない（開閉しない見出しが、閉じた開閉部品に見えていた）
 *   - 画面の下端に固定の帯（高さ100px。アンカー広告を模したダミーの枠）が入っても、レールが帯の下に隠れず、
 *     目次の最後の項目まで枠の中で送れる。★実際の広告では未確認（配信が始まったら本番で見ること）。
 * ★規則2: 各検査について、壊した状態（CSS注入・強調を消す）で赤になることも毎回確かめる。
 */
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready} from './layout/browser.mjs';
import {measureLeftAccent} from './layout/accent-measure.mjs';

function inspect(){
 const errors=[];const main=document.querySelector('main').getBoundingClientRect();
 const rail=document.querySelector('.side-rail');const r=rail.getBoundingClientRect();
 if(r.left<main.left+16+672+32-1)errors.push('rail-not-beside-body');
 if(r.top<0||r.top>innerHeight)errors.push('rail-not-in-view');
 if(r.right>innerWidth)errors.push('rail-overflow');
 const title=document.querySelector('.toc .toc-title');const btn=document.querySelector('.toc .toc-toggle');
 if(!title||title.hidden||title.textContent.trim()!=='目次')errors.push('title-not-toc');
 if(btn&&!btn.hidden&&/目次を閉じる/.test(btn.textContent))errors.push('title-is-action');
 const cur=document.querySelectorAll('.toc a[aria-current="location"]');
 const want=[...document.querySelectorAll('.toc a[href^="#"]')].filter(a=>{const t=document.getElementById(decodeURIComponent(a.hash.slice(1)));return t&&t.getBoundingClientRect().top<=100;}).pop();
 if(cur.length!==1||cur[0]!==want)errors.push('current-section');
 else{const l=document.querySelector('.toc > ol').getBoundingClientRect(),a=cur[0].getBoundingClientRect();if(a.top<l.top-1||a.bottom>l.bottom+1)errors.push('current-out-of-rail');
  const cs=getComputedStyle(cur[0]);if(cs.fontWeight<600&&cs.backgroundColor==='rgba(0, 0, 0, 0)')errors.push('current-not-emphasized');}
 const nt=document.querySelector('.rail-next-title');
 if(nt&&nt.getClientRects().length){const c=getComputedStyle(nt,'::before').content;if(c!=='none'&&c!=='normal'&&c!=='""')errors.push('next-title-marker');}
 return errors;
}
// 下端に固定の帯を入れて、レールと目次の最後の項目が帯の上に収まるかを測る
const BAND=100;
const addBand=()=>{const a=document.createElement('div');a.id='fake-anchor';a.style.cssText='position:fixed;left:0;right:0;bottom:0;height:100px;background:#fcc;z-index:2147483646';document.body.appendChild(a);};
const bandState=()=>{const top=innerHeight-100;const r=document.querySelector('.side-rail').getBoundingClientRect();
 const l=document.querySelector('.side-rail .toc > ol');l.scrollTop=l.scrollHeight;const last=[...l.querySelectorAll('a')].pop().getBoundingClientRect();
 return {railBottom:Math.round(r.bottom),lastBottom:Math.round(last.bottom),top,railTop:Math.round(r.top)};};
const scrollTo60=()=>{const hs=[...document.querySelectorAll('main h2[id]')];const h=hs[Math.floor(hs.length*.6)];scrollTo(0,h.getBoundingClientRect().top+scrollY-90);};
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));

const {chromium}=await browserTools();const server=await serve();let b;let n=0;
try{
 b=await chromium.launch();const c=await contextFor(b,server.origin);const p=await c.newPage();
 for(const [w,h] of [[1100,900],[1280,900],[1440,900],[1280,700]])for(const u of ['/column/furikomi-tesuryo-hikaku/','/column/zengin-format-guide/','/column/kyuyo-meisai-mikata/']){
  await p.setViewportSize({width:w,height:h});await ready(p,server.origin+u);
  await p.evaluate(scrollTo60);await settle(p);
  assert.deepEqual(await p.evaluate(inspect),[],`${u} @${w}x${h}`);
  assert.deepEqual((await p.evaluate(measureLeftAccent)).map(x=>x.cls),[],`${u} @${w}: 左アクセント線`);
  n++;
 }
 // 長い目次（低い窓）: 後半が隠れている間は合図があり、枠の下端まで送ると消える
 await p.setViewportSize({width:1280,height:700});await ready(p,server.origin+'/column/zengin-format-guide/');
 const sc=await p.evaluate(()=>{const l=document.querySelector('.toc > ol');return l.scrollHeight>l.clientHeight+4;});
 assert(sc,'1280x700 で全銀の目次が枠に収まってしまい、合図の検査が成立しない（前提が崩れた）');
 await p.evaluate(()=>{document.querySelector('.toc > ol').scrollTop=0;document.querySelector('.toc > ol').dispatchEvent(new Event('scroll'));});await settle(p);
 assert(await p.evaluate(()=>document.querySelector('nav.toc').classList.contains('toc-more-below')&&getComputedStyle(document.querySelector('nav.toc'),'::after').content.includes('続き')),'後半が隠れているのに続きの合図が無い');
 await p.evaluate(()=>{const l=document.querySelector('.toc > ol');l.scrollTop=l.scrollHeight;l.dispatchEvent(new Event('scroll'));});await settle(p);
 assert(!await p.evaluate(()=>document.querySelector('nav.toc').classList.contains('toc-more-below')),'下端まで送っても合図が消えない');
 // 下端の帯（ダミー）: 1280×800。記事（目次＋あわせて読む）と、計算済みのツール（結果の要約＋目次）
 let withNext=0;
 for(const [u,fill] of [['/column/furikomi-tesuryo-hikaku/',null],['/shakai-hoken/',{monthly:'300000'}],['/column/zengin-format-guide/',null]]){
  for(const broken of [true,false]){   // 先に「帯を数えない形」で隠れることを確かめる（前提。隠れないなら検査が空振り）
   await p.setViewportSize({width:1280,height:800});await ready(p,server.origin+u);
   if(await p.evaluate(()=>{const t=document.querySelector('.rail-next-title');return !!t&&t.getClientRects().length>0;}))withNext++;
   if(fill){for(const [id,v] of Object.entries(fill))await p.fill('#'+id,v);await p.click('#calc');await p.waitForSelector('#result-rail:not([hidden])');}
   if(broken)await p.evaluate(()=>{document.elementsFromPoint=()=>[];});
   await p.evaluate(addBand);await settle(p);await p.waitForTimeout(150);
   const st=await p.evaluate(bandState);
   const hidden=st.railBottom>st.top||st.lastBottom>st.top;
   if(broken)assert(hidden,`${u}: 帯を数えない形でもレールが隠れない（前提が崩れた。検査が空振りになる） ${JSON.stringify(st)}`);
   else{assert(!hidden,`${u} @1280x800: 下端${BAND}pxの帯にレールが隠れる ${JSON.stringify(st)}`);assert.equal(st.railTop,84,`${u}: 帯を入れたらレールが追従しなくなった`);}
  }
  n++;
 }
 assert(withNext>0,'「あわせて読む」が見えているページが検査対象に無い（▶ の検査が空振り）');
 // 規則2: 壊すと赤
 await ready(p,server.origin+'/column/furikomi-tesuryo-hikaku/');
 assert(!(await p.evaluate(inspect)).includes('next-title-marker'),'無傷で ▶ が検出される');
 await p.addStyleTag({content:'.rail-next-title::before{content:"▶"}'});
 assert((await p.evaluate(inspect)).includes('next-title-marker'),'「あわせて読む」に ▶ を戻しても赤にならない');
 await p.setViewportSize({width:1100,height:900});await ready(p,server.origin+'/column/furikomi-tesuryo-hikaku/');await p.evaluate(scrollTo60);await settle(p);
 assert.deepEqual(await p.evaluate(inspect),[],'壊す前の無傷が緑でない');
 await p.addStyleTag({content:'.toc-rail-track{position:static!important;width:auto!important}'});await settle(p);
 assert((await p.evaluate(inspect)).includes('rail-not-beside-body'),'レールを本文の下へ落としても赤にならない');
 await ready(p,server.origin+'/column/furikomi-tesuryo-hikaku/');await p.evaluate(scrollTo60);await settle(p);
 await p.evaluate(()=>document.querySelectorAll('.toc a[aria-current]').forEach(a=>a.removeAttribute('aria-current')));
 assert((await p.evaluate(inspect)).includes('current-section'),'現在の節の強調を消しても赤にならない');
 await ready(p,server.origin+'/column/furikomi-tesuryo-hikaku/');await p.evaluate(scrollTo60);await settle(p);
 await p.evaluate(()=>{document.querySelector('.toc-title').hidden=true;document.querySelector('.toc-toggle').textContent='目次を閉じる';});
 const e=await p.evaluate(inspect);assert(e.includes('title-not-toc')&&e.includes('title-is-action'),'見出しを操作名に戻しても赤にならない');
 await ready(p,server.origin+'/column/furikomi-tesuryo-hikaku/');await p.evaluate(scrollTo60);await settle(p);
 await p.addStyleTag({content:'.toc a[aria-current]{border-left:4px solid #1f6f5c}'});
 assert((await p.evaluate(measureLeftAccent)).length>0,'現在の節の強調に左線を足しても赤にならない');
}finally{await b?.close();server.close();}
console.log(`✓ PCの目次レール: ${n}件（1100/1280/1440px・高さ700/900）で本文の右・見出し「目次」・現在の節・左線なし、続きの合図、下端の帯（ダミー100px）に隠れない、「あわせて読む」に ▶ なし、壊しテスト6種も赤`);
