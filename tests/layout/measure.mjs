export function measure() {
 const issues=[]; const add=(kind,e,detail={})=>issues.push({kind,tag:e?.tagName,id:e?.id,text:e?.textContent?.trim().slice(0,110),...detail});
 const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const ids=new Set();for(const e of document.querySelectorAll('[id]')){if(ids.has(e.id))add('duplicate-id',e);ids.add(e.id);}
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height}};
 scrollTo(100000,0);if(scrollX>1)add('page-overflow',document.documentElement,{overflow:scrollX});scrollTo(0,0);
 for(const e of document.querySelectorAll('h1,h2,h3,h4')) if(visible(e)&&!e.textContent.trim()&&!e.querySelector('img'))add('empty-heading',e);
 // A group legend and checkbox caption are not an individual field's help text.
 for(const e of document.querySelectorAll('label > .hint')){
  const control=e.parentElement.control;
  if(control&&visible(e)&&visible(control)&&!['checkbox','radio','hidden'].includes(control.type)&&e.getBoundingClientRect().top<control.getBoundingClientRect().bottom-2)add('hint-in-label',e);
 }
 for(const input of document.querySelectorAll('input[aria-describedby],select[aria-describedby],textarea[aria-describedby]'))if(visible(input)){
  for(const id of input.getAttribute('aria-describedby').split(/\s+/)){const hint=document.getElementById(id);if(hint?.classList.contains('hint')&&hint.parentElement===input.parentElement&&document.querySelectorAll('[aria-describedby~=\"'+CSS.escape(id)+'\"]').length===1&&visible(hint)&&hint.getBoundingClientRect().top<input.getBoundingClientRect().bottom-2)add('help-position',hint,{control:input.id});}
 }
 for(const h of document.querySelectorAll('main h2'))if(h.hasAttribute('data-faq')||/^(よくある質問|FAQ)$/.test(h.textContent.trim())){
  for(let q=h.nextElementSibling;q&&q.tagName!=='H2'&&q.tagName!=='SECTION';q=q.nextElementSibling)if(q.tagName==='H3'&&q.nextElementSibling?.tagName==='P'&&visible(q)){
   const a=q.nextElementSibling;
   if(getComputedStyle(q,'::before').content!=='"Q"'||getComputedStyle(a,'::before').content!=='"A"')add('faq-marker',q);
   if(+getComputedStyle(q).fontWeight<600||+getComputedStyle(a).fontWeight>400||[...a.querySelectorAll('b,strong')].some(e=>+getComputedStyle(e).fontWeight>400))add('faq-weight',a);
  }
 }
 const coreTool=[...document.scripts].some(s=>/_core\.js/.test(s.textContent));
 const requiresToc=coreTool&&!location.pathname.startsWith('/embed/')&&!location.pathname.startsWith('/hojokin/')&&document.querySelectorAll('main h2').length>=3;
 if(requiresToc&&!document.querySelector('main nav.toc'))add('missing-toc',document.querySelector('main'));
 for(const e of document.querySelectorAll('main td.num,main th.num'))if(visible(e)&&getComputedStyle(e).textAlign!=='right')add('numeric-alignment',e);
 for(const e of document.querySelectorAll('main p,main h1,main h2,main h3,main h4,main figcaption,main .hint'))if(visible(e)){
  const cs=getComputedStyle(e);if(cs.textOverflow!=='ellipsis'&&!(parseInt(cs.webkitLineClamp)>0)&&((['hidden','clip'].includes(cs.overflowX)&&e.scrollWidth>e.clientWidth+2)||(['hidden','clip'].includes(cs.overflowY)&&e.scrollHeight>e.clientHeight+2)))add('text-clipped',e);
  const next=e.nextElementSibling;if(next&&/^(P|H[1-4])$/.test(e.tagName)&&/^(P|H[1-4])$/.test(next.tagName)&&visible(next)){
   const a=e.getBoundingClientRect(),b=next.getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4)add('text-overlap',e,{other:next.textContent.trim().slice(0,80)});
  }
 }

 for(const label of document.querySelectorAll('label'))if(visible(label)&&label.querySelector('input[type=radio],input[type=checkbox]')){
  for(const n of label.childNodes)if(n.nodeType===Node.TEXT_NODE&&n.textContent.trim().length>=4){const range=document.createRange();range.selectNodeContents(n);const rs=[...range.getClientRects()].filter(r=>r.width>1);const em=parseFloat(getComputedStyle(label).fontSize);if(rs.length>=3&&Math.max(...rs.map(r=>r.width))<em*2.5)add('choice-caption-wrap',label);}
 }
 for(const row of document.querySelectorAll('.fee-pair,.fee-pair--short,.form-row,.grid-2,.grid,.radio-row')) {
 const fields=[...row.children].map(e=>({e,r:e.getBoundingClientRect(),i:e.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea')})).filter(x=>x.i&&visible(x.i));
 for(let i=1;i<fields.length;i++){let a=fields[i-1],b=fields[i];if(Math.abs(a.r.top-b.r.top)<2&&Math.abs(a.i.getBoundingClientRect().top-b.i.getBoundingClientRect().top)>3)add('field-alignment',b.i,{other:a.i.id,delta:b.i.getBoundingClientRect().top-a.i.getBoundingClientRect().top});}
 }
 for(const e of document.querySelectorAll('main td,main th'))if(visible(e)&&/^[\d,.％%円万億千年月日人倍歳〜～–—+−\s]+$/.test(e.textContent.trim())&&/\d/.test(e.textContent)){
 const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){for(const m of n.textContent.matchAll(/[0-9][0-9,.]*[億万千]?[％%円年月日人倍歳]/g)){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const rs=[...r.getClientRects()].filter(x=>x.width);if(rs.length>1&&Math.max(...rs.map(x=>x.top))-Math.min(...rs.map(x=>x.top))>2)add('number-wrap',e,{token:m[0]});}}
 }
 // Reject vertically squeezed prose, but allow short codes and numeric-only cells.
 for(const e of document.querySelectorAll('main td,main th'))if(visible(e)&&e.textContent.trim().length>=6&&/[一-龯ぁ-んァ-ヶ]/.test(e.textContent)){
  const cs=getComputedStyle(e),em=parseFloat(cs.fontSize),content=e.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  if(content<em*2.5&&e.clientHeight>em*3.5)add('table-prose-width',e,{content,em});
 }
 for(const t of document.querySelectorAll('main table'))if(visible(t)){
 let cells=[...t.querySelectorAll('td')].filter(visible);if(cells.some(e=>['Top','Bottom','Left','Right'].every(side=>getComputedStyle(e)['border'+side+'Style']==='none')))add('table-border',t);
 if(cells.some(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'))add('table-background',t);
 }
 for(const svg of document.querySelectorAll('svg'))if(visible(svg)&&svg.viewBox.baseVal.width){
 const vb=svg.viewBox.baseVal;const inv=svg.getScreenCTM().inverse();
 const bounds=e=>{const b=e.getBBox(),m=inv.multiply(e.getScreenCTM());const ps=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));return {x:Math.min(...ps.map(p=>p.x)),y:Math.min(...ps.map(p=>p.y)),right:Math.max(...ps.map(p=>p.x)),bottom:Math.max(...ps.map(p=>p.y))};};
 const texts=[...svg.querySelectorAll('text')].filter(e=>visible(e)&&e.textContent.trim());
 for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
  const a=bounds(texts[i]),b=bounds(texts[j]);
  if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>3)add('svg-overlap',texts[i],{other:texts[j].textContent.trim(),svg:[...document.querySelectorAll('svg')].indexOf(svg)});
 }
 for(const bar of svg.querySelectorAll('rect[data-layout-role=bar]'))if(!bar.getAttribute('data-layout-note')?.trim())add('svg-bar-metadata',bar);
 const rects=[...svg.querySelectorAll('rect:not([data-layout-role=bar])')].map(e=>({e,b:bounds(e)})).filter(x=>x.b.right-x.b.x>40&&x.b.bottom-x.b.y>24);
 for(const e of svg.querySelectorAll('text'))if(visible(e)&&e.textContent.trim()){
 const b=bounds(e);const over=(r)=>b.x<r.x-1||b.y<r.y-1||b.right>r.right+1||b.bottom>r.bottom+1;
 if(over({x:vb.x,y:vb.y,right:vb.x+vb.width,bottom:vb.y+vb.height}))add('svg-viewbox',e,{bounds:b,viewBox:svg.getAttribute('viewBox'),svg:[...document.querySelectorAll('svg')].indexOf(svg)});
 const cx=(b.x+b.right)/2,cy=(b.y+b.bottom)/2;
 const containers=rects.filter(r=>cx>r.b.x&&cx<r.b.right&&cy>r.b.y&&cy<r.b.bottom).sort((a,b)=>(a.b.right-a.b.x)*(a.b.bottom-a.b.y)-(b.b.right-b.b.x)*(b.b.bottom-b.b.y));
 if(containers.length&&over(containers[0].b))add('svg-rect',e,{bounds:b,rect:containers[0].b,svg:[...document.querySelectorAll('svg')].indexOf(svg)});
 }
 }
 for(const img of document.images)if(visible(img)&&img.complete&&!img.naturalWidth&&new URL(img.src,location.href).origin===location.origin)add('broken-image',img,{src:img.getAttribute('src')});
 for(const img of document.querySelectorAll('main img'))if(visible(img)&&getComputedStyle(img).objectFit!=='cover'){
  const r=img.getBoundingClientRect();let e=img.parentElement;
  while(e&&e!==document.querySelector('main')){const cs=getComputedStyle(e),b=e.getBoundingClientRect();if((['hidden','clip'].includes(cs.overflowX)&&(r.left<b.left-2||r.right>b.right+2))||(['hidden','clip'].includes(cs.overflowY)&&(r.top<b.top-2||r.bottom>b.bottom+2))){add('image-clipped',img);break;}e=e.parentElement;}
 }
 const footer=document.querySelector('footer.site');if(footer){const f=footer.getBoundingClientRect(),main=document.querySelector('main'),m=main?.getBoundingClientRect(),left=m?m.left+parseFloat(getComputedStyle(main).paddingLeft):0;if(m&&Math.abs(f.left+parseFloat(getComputedStyle(footer).paddingLeft)-left)>2)add('footer-alignment',footer,{delta:f.left+parseFloat(getComputedStyle(footer).paddingLeft)-left});}
 return {issues,headings:[...document.querySelectorAll('main h2')].map(e=>({text:e.textContent,id:e.id})),toc:!!document.querySelector('nav.toc'),tables:document.querySelectorAll('main table').length,svgs:document.querySelectorAll('svg').length,footer:footer?box(footer):null};
}
