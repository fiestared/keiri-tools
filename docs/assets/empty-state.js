/* Empty status/result surfaces must not look like unexplained warnings.
 * Only manage our own attribute: never reveal a result intentionally hidden by
 * its calculator. Keep live-region nodes so later messages retain their role.
 */
(() => {
 const selector='.note,.warn,.result,section.related,.rel-block,.next-read,[role="alert"],[role="status"]';
 function hasContent(root){
  if(getComputedStyle(root).contentVisibility==='hidden')return false;
  const visibleWithin=n=>{for(let e=n;e&&e!==root;e=e.parentElement){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||s.contentVisibility==='hidden')return false;if(e.tagName==='DETAILS'&&!e.open&&!e.querySelector(':scope > summary')?.contains(n))return false;}return true;};
  if([...root.querySelectorAll('input:not([type="hidden"]),textarea,select,img,svg,canvas,video,iframe')].some(visibleWithin))return true;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let text;
  while(text=walker.nextNode())if(text.textContent.trim()&&!text.parentElement.closest('script,style,template')&&!(root.matches('.result,[role=status]')&&(text.parentElement.closest('button')||/^(?:(?:計算|試算|判定|変換|算出)結果|結果)$/.test(text.parentElement.closest('h1,h2,h3,h4,h5,h6')?.textContent.trim()||'')))&&!(root.matches('section.related,.rel-block,.next-read')&&text.parentElement.closest('h2,h3'))&&visibleWithin(text.parentElement))return true;
  return false;
 }
 // Static and dynamically built tables share the same display treatment. Keep each amount
 // or date unit intact without changing its text, formatting or descendants.
 const dirtyTables=new Set(document.querySelectorAll('main table,.wrap table'));
 function keepTableTokens(table){
  if(table.closest('.result,[role=status],#out')&&!table.closest('.scroll-wrap,.fee-scroll,.retention-table')){const wrap=document.createElement('div');wrap.className='scroll-wrap';table.before(wrap);wrap.append(table);}
  for(const cell of table.querySelectorAll('td,th')){
   // Existing generated tokens predate signed amounts and month counters.
   for(const span of cell.querySelectorAll('.numeric-token')){
    const previous=span.previousSibling,next=span.nextSibling;
    if(previous?.nodeType===3&&/[＋+−-]$/.test(previous.textContent)){span.prepend(previous.textContent.slice(-1));previous.textContent=previous.textContent.slice(0,-1);}
    if(next?.nodeType===3&&/^[0-9][0-9,.]*[億万千]$/.test(span.textContent)&&/^円/.test(next.textContent)){span.append('円');next.textContent=next.textContent.slice(1);}
   }
   const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);const nodes=[];let n;
   while(n=walker.nextNode())if(!n.parentElement.closest('.numeric-token,svg,script,style'))nodes.push(n);
   for(const text of nodes){
    const matches=[...text.textContent.matchAll(/(?:[＋+−-]?[¥￥]\s*[0-9][0-9,.]*|[＋+−-]?[0-9][0-9,.]*(?:[億万千]?(?:[％%円年日人倍歳]|[かヶカ]?月)|[億万千]))/g)];if(!matches.length)continue;
    const fragment=document.createDocumentFragment();let at=0;
    for(const m of matches){fragment.append(text.textContent.slice(at,m.index));const span=document.createElement('span');span.className='numeric-token';span.textContent=m[0];fragment.append(span);at=m.index+m[0].length;}
    fragment.append(text.textContent.slice(at));text.replaceWith(fragment);
   }
  }
 }
 // Horizontal scrollers show a visible cue only while their content actually overflows (style.css).
 const scrollers='.scroll-wrap,.fee-scroll,.retention-table,.gensen-monthly-table,.figure.fig-wide';
 function markEnd(e){const end=e.scrollLeft+e.clientWidth>=e.scrollWidth-2;if(end!==e.hasAttribute('data-scroll-end'))e.toggleAttribute('data-scroll-end',end);}
 function markOverflow(){for(const e of document.querySelectorAll(scrollers)){const over=e.scrollWidth>e.clientWidth+2;if(over!==e.hasAttribute('data-overflow-x'))e.toggleAttribute('data-overflow-x',over);markEnd(e);}}
 addEventListener('scroll',event=>{const e=event.target;if(e.nodeType===1&&e.matches(scrollers))markEnd(e);},{capture:true,passive:true});
 function sync(){for(const table of dirtyTables)if(table.isConnected)keepTableTokens(table);dirtyTables.clear();for(const e of document.querySelectorAll(selector)){const empty=e.childNodes.length>0&&!hasContent(e);if(empty!==e.hasAttribute('data-empty-surface'))e.toggleAttribute('data-empty-surface',empty);}markOverflow();}
 matchMedia('print').addEventListener('change',sync);
 for(const event of ['resize','beforeprint','afterprint'])addEventListener(event,sync);
 let queued=false;
 const observer=new MutationObserver(records=>{if(records.every(r=>r.type==='attributes'&&r.attributeName==='data-empty-surface'))return;
  for(const r of records)if(r.type!=='attributes'){
   const e=r.target.nodeType===1?r.target:r.target.parentElement;const table=e?.closest('main table,.wrap table');if(table)dirtyTables.add(table);
   for(const n of r.addedNodes||[])if(n.nodeType===1){if(n.matches('main table,.wrap table'))dirtyTables.add(n);for(const t of n.querySelectorAll('main table,.wrap table'))dirtyTables.add(t);}
  }
  if(!queued){queued=true;queueMicrotask(()=>{queued=false;sync();});}});
 document.fonts?.ready.then(markOverflow);addEventListener('load',markOverflow);
 sync();observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class','hidden','open','data-empty-surface']});
})();
