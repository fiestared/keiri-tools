/**
 * PC の目次レール: 1024〜1199px でも本文の右に出る／見出しは「目次」／いま読んでいる節を示す／長い目次の続きの合図。
 *   node tests/test_toc_rail_pc.mjs
 *
 * ★なぜ要るか（2026-10-08 PC主の UI/UX レビュー 中3・中7。gbrain audits/keiri-uiux-review-pc-2026-10-08）:
 *   - 1024〜1199px（1280画面の110%拡大・最大化していない窓）で目次が本文の下に落ち、右に約490pxの空白があった。
 *   - レールに「いまどの節か」が出ず、14〜15項目の目次は後半が枠の下に隠れているのに合図が無かった。
 *   - PC でもレールの見出しが「目次を閉じる」（操作の名前）だった。
 *   セッションの96%が PC（GA4 28日）なので、PC の幅（1100/1280/1440・高さ700/900）で見る。
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
 return errors;
}
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
 // 規則2: 壊すと赤
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
console.log(`✓ PCの目次レール: ${n}件（1100/1280/1440px・高さ700/900）で本文の右・見出し「目次」・現在の節・左線なし、続きの合図、壊しテスト4種も赤`);
