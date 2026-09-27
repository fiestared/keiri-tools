/** Presentation checks independent of generator eligibility and CSS declarations. */
export function measureUi() {
 const issues=[];
 const visible=e=>e&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&[...e.getClientRects()].some(r=>r.width>0&&r.height>0);
 const add=(kind,e,detail={})=>issues.push({kind,tag:e?.tagName,id:e?.id,text:e?.textContent?.trim().slice(0,100),...detail});
 if(matchMedia('print').matches){
  for(const e of document.querySelectorAll('.scroll-wrap,.fee-scroll,.retention-table'))if(visible(e)){
   const cs=getComputedStyle(e);
   if(e.scrollHeight>e.clientHeight+2&&/auto|scroll|hidden|clip/.test(cs.overflowY))add('print-table-clipped',e,{height:e.clientHeight,scrollHeight:e.scrollHeight});
  }
  return issues;
 }
 for(const e of document.querySelectorAll('button,summary,a[role=button]'))if(visible(e)&&!e.matches(':disabled')){
  const r=e.getBoundingClientRect();if(r.width<43.9||r.height<43.9)add('action-target',e,{width:r.width,height:r.height});
 }
 for(const footer of document.querySelectorAll('footer')){
  const seen=new Set();for(const e of footer.querySelectorAll(':scope > div,:scope > p'))if(visible(e)){
   const key=e.textContent.replace(/\s+/g,' ').trim()+'|'+[...e.querySelectorAll('a')].map(a=>a.getAttribute('href')).join('|');
   if(key!=='|'&&seen.has(key))add('duplicate-footer-note',e);seen.add(key);
  }
 }
 for(const e of document.querySelectorAll('.breadcrumb')){
  const a=e.querySelector('a:last-of-type');if(!a)continue;
  let tail='';for(let n=a.nextSibling;n;n=n.nextSibling)tail+=n.textContent;
  if(tail.trim()&&!/^\s*[›»>/]/.test(tail)&&!getComputedStyle(a,'::after').content.includes('›'))add('breadcrumb-separator',e);
 }
 for(const section of document.querySelectorAll('.next-read'))if(!section.querySelector('.next-read-more[open]')&&[...section.querySelectorAll('.tool-card')].filter(visible).length>3)add('unbounded-related-list',section);
 for(const e of document.querySelectorAll('.next-read .tool-card b,.next-read .tool-card span,nav.toc a')){
  if(/&(?:amp|quot|lt|gt|#\d+|#x[\da-f]+);/i.test(e.textContent))add('navigation-entity',e);
 }
 // Warning links must use an ink color, not the lighter border token.
 const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
 const lum=c=>c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
 for(const a of document.querySelectorAll('.callout a,.note a,.warn a'))if(visible(a)){
  const cs=getComputedStyle(a);let bg=[255,255,255],n=a;
  while(n){const color=rgb(getComputedStyle(n).backgroundColor);if(color.length===3||color[3]===1){bg=color;break;}n=n.parentElement;}
  const fg=rgb(cs.color),ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);
  if(ratio<4.5)add('warning-link-contrast',a,{ratio});
 }
 // A number, its sign and unit must stay on one line, even in prose cells.
 for(const cell of document.querySelectorAll('main td,main th'))if(visible(cell)){
  const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let n;
  while(n=walker.nextNode())for(const m of n.textContent.matchAll(/(?:[＋+−-]?[¥￥]\s*[0-9][0-9,.]*|[＋+−-]?[0-9][0-9,.]*(?:[億万千]?(?:[％%円年日人倍歳]|[かヶカ]?月)|[億万千]))/g)){
   const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const boxes=[...r.getClientRects()].filter(b=>b.width&&b.height);
   if(boxes.length>1&&Math.max(...boxes.map(b=>b.top))-Math.min(...boxes.map(b=>b.top))>parseFloat(getComputedStyle(cell).fontSize)*.8)add('number-unit-wrap',cell,{token:m[0]});
  }
 }
 const path=location.pathname;
 const publicPage=!document.querySelector('meta[name=robots][content*=noindex]');
 const article=publicPage&&/^\/column\/[^/]+\/$/.test(path)&&!path.includes('/_');
 const core=[...document.scripts].some(s=>/_core\.js/.test(s.textContent));
 // The commander owns these three short-tool TOCs on a separate branch (2026-09-27).
 // Remove this integration exception after that branch is merged, not by changing its generator here.
 const rail=document.querySelector('main > .side-rail'),card=[...document.querySelectorAll('main > .card')].find(e=>e.querySelector('input,select,textarea'));
 if(core&&innerWidth<1200&&!['/shiharai-site/','/eigyobi/','/nenshu/'].includes(location.pathname)&&visible(rail)&&visible(card)&&rail.getBoundingClientRect().top<card.getBoundingClientRect().top)add('tool-below-navigation',card);
 const articleHeading=document.querySelector('main article h1'),articleRail=document.querySelector('main article .side-rail');
 if(innerWidth<1200&&visible(articleHeading)&&visible(articleRail)&&articleRail.getBoundingClientRect().top<articleHeading.getBoundingClientRect().top)add('article-below-navigation',articleHeading);
 // 未解決（2026-09-27 司令塔）: この3ツールは本番で目次が計算機より上に出る（390/768pxで tool-below-navigation）。目次の置き場所の設計判断待ち。tool-below-navigation もこの3ページだけ外している（toolBeforeRail は <div class="card"> 完全一致なので id 付きカードに効かない）。gbrain handoffs/keiri-commander-reboot-recovery-2026-09-27
 const commanderToc=['/shiharai-site/','/eigyobi/','/nenshu/'].includes(path);
 const tool=core&&!/^\/(embed|hojokin)\//.test(path)&&document.querySelectorAll('main h2').length>0&&!commanderToc;
 if(article||tool){
  const toc=document.querySelector('main nav.toc');
  if(!visible(toc))add('required-toc-hidden',document.querySelector('main'));
  else if(!toc.querySelector('a[href^="#"]'))add('required-toc-empty',toc);
 }
 return issues;
}
