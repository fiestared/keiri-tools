/** 2026-10-08 UI/UX review (high 1/2): on a phone the "number"/"answer" columns of a table were scrolled out of
 * sight at first paint even though the scroll cue was shown (/inshi/ 第17号: the amounts sat in the hidden 53px, so
 * the table looked empty or read as 「1」「2」; 住民税の早見表: 「独身・月額」 254px off-screen). A cue is not visibility.
 * Runs in the page (page.evaluate) at every width (PC is 96% of sessions; on PC the desktop gate already keeps tables
 * inside the column, so this mainly guards data-wide="ok" tables there and every scrolling table on phones).
 *  - table-no-number-visible: a table whose value columns (any column after the first in which most body cells hold
 *    a digit) exist, but not one of them shows its first number inside the visible part of its horizontal clip box.
 *  - answer-column-hidden: a column marked <th data-answer> (the column the reader came for) is displayed but its
 *    header or first value is not fully inside the visible part of the clip box at first paint.
 *  - answer-column-missing: a table that marks answer columns shows none of them at this width.
 */
export function measureTables() {
 const issues=[];
 const vis=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const add=(kind,t,detail={})=>issues.push({kind,tag:'TABLE',id:t.id,text:(t.caption?.textContent||t.rows[0]?.textContent||'').trim().replace(/\s+/g,' ').slice(0,110),table:[...document.querySelectorAll('table')].indexOf(t),...detail});
 const clipBox=t=>{let w=t.parentElement;while(w&&w!==document.body&&getComputedStyle(w).overflowX==='visible')w=w.parentElement;
  if(!w||w===document.body)return {left:0,right:document.documentElement.clientWidth};const r=w.getBoundingClientRect(),cs=getComputedStyle(w);
  return {left:r.left+parseFloat(cs.borderLeftWidth),right:r.left+parseFloat(cs.borderLeftWidth)+w.clientWidth};};
 const inside=(rects,b)=>rects.length>0&&rects.every(x=>x.left>=b.left-1&&x.right<=b.right+1);
 const textRects=e=>{const r=document.createRange();r.selectNodeContents(e);return [...r.getClientRects()].filter(x=>x.width>1&&x.height>1);};
 const firstNumber=cell=>{const w=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const m=n.textContent.match(/[¥￥]?\d[\d,.]*/);if(m&&vis(n.parentElement)){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);return [...r.getClientRects()].filter(x=>x.width>0);}}return null;};
 // Logical column index with colspan, per row.
 const grid=t=>{const rows=[];const carry=[];for(const tr of t.rows){const row=[];let c=0;for(const cell of tr.cells){while(carry[c]>0){carry[c]--;c++;}row.push({cell,c});const span=cell.colSpan||1;if(cell.rowSpan>1)for(let k=0;k<span;k++)carry[c+k]=cell.rowSpan-1;c+=span;}rows.push(row);}return rows;};
 for(const t of document.querySelectorAll('main table'))if(vis(t)&&t.rows.length>1){
  const box=clipBox(t),rows=grid(t);
  const body=rows.filter((r,i)=>!(t.rows[i].parentElement.tagName==='THEAD'||[...t.rows[i].cells].every(c=>c.tagName==='TH')));
  const cols=Math.max(0,...rows.map(r=>r.length?r.at(-1).c+1:0));if(cols<2||!body.length)continue;
  let numericCols=0,shown=0;
  for(let c=1;c<cols;c++){const cells=body.map(r=>r.find(x=>x.c===c&&x.cell.tagName==='TD')?.cell).filter(e=>e&&vis(e));
   if(cells.length<1||cells.filter(e=>/\d/.test(e.textContent)).length*2<cells.length)continue;numericCols++;
   const first=cells.find(e=>/\d/.test(e.textContent));const rs=firstNumber(first);if(rs&&inside(rs,box))shown++;}
  if(numericCols&&!shown)add('table-no-number-visible',t,{numericCols,clip:[Math.round(box.left),Math.round(box.right)]});
  const marked=[...t.querySelectorAll('th[data-answer]')];if(!marked.length)continue;
  const shownMarks=marked.filter(vis);if(!shownMarks.length){add('answer-column-missing',t);continue;}
  for(const th of shownMarks){const head=rows.flat().find(x=>x.cell===th);const cellBelow=body.map(r=>r.find(x=>x.c===head.c)?.cell).find(e=>e&&vis(e)&&/\S/.test(e.textContent));
   const ok=inside(textRects(th),box)&&(!cellBelow||inside(textRects(cellBelow),box));
   if(!ok)add('answer-column-hidden',t,{answer:th.textContent.trim().slice(0,40),hidden:Math.round(Math.max(th.getBoundingClientRect().right,cellBelow?.getBoundingClientRect().right||0)-box.right)});}
 }
 return issues;
}
