/** Visual emptiness: inspect painted containers, including offscreen content.
 * Inputs are meaningful even before typing. Decorative primitives (hr/svg paths)
 * and individual table cells are not content containers. Never exempt a page.
 */
export function measureEmpty(){
 const visible=e=>{if(![...e.getClientRects()].some(r=>r.width>0&&r.height>0))return false;for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;if(n!==e&&n.tagName==='DETAILS'&&!n.open&&!n.querySelector(':scope > summary')?.contains(e))return false;if(n!==e&&s.contentVisibility==='hidden')return false;}return true;};
 const meaningful=e=>{
  if([...e.querySelectorAll('input:not([type=hidden]),textarea,select,img,svg,canvas,video,iframe')].some(visible))return true;
  const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
  while(n=w.nextNode()){if(!n.textContent.trim()||getComputedStyle(n.parentElement).contentVisibility==='hidden'||!visible(n.parentElement)||n.parentElement.closest('script,style,template')||(e.matches('.result,[role=status]')&&(n.parentElement.closest('button')||/^(?:(?:計算|試算|判定|変換|算出)結果|結果)$/.test(n.parentElement.closest('h1,h2,h3,h4,h5,h6')?.textContent.trim()||''))))continue;const r=document.createRange();r.selectNodeContents(n);if([...r.getClientRects()].some(r=>r.width&&r.height))return true;}
  return false;
 };
 const opaque=c=>c!=='transparent'&&!/rgba\([^)]*,\s*0\)$/.test(c);
 const issues=[];
 for(const e of document.querySelectorAll('div,section,aside,article,nav,header,footer,main,form,fieldset,legend,details,summary,dl,dt,dd,p,ul,ol,li,table,thead,tbody,tfoot,tr,output,button,[role=alert],[role=status]')){
  if(!visible(e)||meaningful(e))continue;
  const s=getComputedStyle(e),r=e.getBoundingClientRect();if(r.width<2||r.height<2)continue;
  const painted=opaque(s.backgroundColor)||['Top','Right','Bottom','Left'].some(k=>parseFloat(s['border'+k+'Width'])>0&&!['none','hidden'].includes(s['border'+k+'Style'])&&opaque(s['border'+k+'Color']));
  if(!painted)continue;
  const selector=e.id?'#'+e.id:e.tagName.toLowerCase()+[...e.classList].map(c=>'.'+c).join('');
  issues.push({kind:'empty-painted-container',text:selector,width:r.width,height:r.height});
 }
 for(const e of document.querySelectorAll('.note,.warn,.result,section.related,.rel-block,.next-read'))if(visible(e)&&/^(?:TODO|TBD|placeholder|ダミー|[-—…]+)$/i.test(e.innerText.trim()))issues.push({kind:'placeholder-only-surface',text:e.className});
 for(const e of document.querySelectorAll('section.related,.rel-block,.next-read')){
  if(visible(e)&&e.querySelector('h2,h3')&&![...e.querySelectorAll('a[href]')].some(visible))issues.push({kind:'empty-related-heading',text:e.className});
 }
 return issues;
}
