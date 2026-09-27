/** Presentation metadata only. Source edits preserve text, JSON-LD and ad blocks byte-for-byte.
 * node tools/gen_layout_markup.mjs [--check]
 */
import {JSDOM} from 'jsdom';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../docs/',import.meta.url));
const check=process.argv.includes('--check');let changed=[];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
for(const file of readdirSync(root,{recursive:true}).filter(f=>f==='index.html'||f.endsWith('/index.html')).sort()){
 let source=readFileSync(root+file,'utf8'); const dom=new JSDOM(source,{includeNodeLocations:true});const d=dom.window.document;const edits=[];const attrs=new Map();
 const set=(e,k,v)=>{if(e.getAttribute(k)===v)return;if(!attrs.has(e))attrs.set(e,{});attrs.get(e)[k]=v;e.setAttribute(k,v);};
 const cls=(e,c)=>{if(!e.classList.contains(c))set(e,'class',[e.className,c].filter(Boolean).join(' '));};
 // The existing FAQ contract is h2 followed by h3+p. Do not touch following sections.
 for(const h of d.querySelectorAll('h2'))if(h.hasAttribute('data-faq')||/^(よくある質問|FAQ)$/.test(h.textContent.trim())){
  for(let e=h.nextElementSibling;e&&e.tagName!=='H2'&&e.tagName!=='SECTION';e=e.nextElementSibling){
   if(e.tagName==='H3'&&e.nextElementSibling?.tagName==='P'){cls(e,'faq-question');cls(e.nextElementSibling,'faq-answer');}
  }
 }
 // Keep an existing literal Q./A. in the source, but show one common marker only.
 for(const e of d.querySelectorAll('.faq-question,.faq-answer')){
  const n=e.firstChild;if(n?.nodeType!==3)continue;
  const m=/^(\s*[QAＱＡ][.．：:]\s*)/.exec(n.textContent);if(!m)continue;
  const l=dom.nodeLocation(n);if(!l)continue;
  const raw=source.slice(l.startOffset,l.endOffset);const hit=/^(\s*[QAＱＡ][.．：:]\s*)/.exec(raw);if(!hit)continue;
  edits.push({start:l.startOffset,end:l.startOffset+hit[0].length,text:'<span class="faq-existing-marker" aria-hidden="true">'+hit[0]+'</span>'});
 }
 // A help sentence follows its control. Keep the accessible description association.
 for(const hint of d.querySelectorAll('label > .hint')){
  const label=hint.parentElement;const id=label.getAttribute('for');const input=id&&d.getElementById(id);
  if(!input||!['INPUT','SELECT','TEXTAREA'].includes(input.tagName)||label.contains(input))continue;
  const hl=dom.nodeLocation(hint),il=dom.nodeLocation(input);if(!hl||!il)continue;
  let hintId=hint.id||id+'-hint';if(!hint.id)while(d.getElementById(hintId))hintId+='-detail';let html=source.slice(hl.startOffset,hl.endOffset);
  if(!hint.id)html=html.replace(/^<span\b/,'<span id="'+escape(hintId)+'"');
  edits.push({start:hl.startOffset,end:hl.endOffset,text:''},{start:il.endOffset,end:il.endOffset,text:'\n      '+html});
  set(input,'aria-describedby',[...new Set([...(input.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean),hintId])].join(' '));
 }
 // Existing standalone help paragraphs follow the same rule; shared group guidance stays put.
 for(const input of d.querySelectorAll('input[aria-describedby],select[aria-describedby],textarea[aria-describedby]')){
  for(const id of input.getAttribute('aria-describedby').split(/\s+/)){
   const hint=d.getElementById(id);
   const refs=[...d.querySelectorAll('[aria-describedby]')].filter(e=>e.getAttribute('aria-describedby').split(/\s+/).includes(id));
   if(!hint?.classList.contains('hint')||refs.length!==1||hint.nextElementSibling!==input)continue;
   const hl=dom.nodeLocation(hint),il=dom.nodeLocation(input);if(!hl||!il)continue;
   edits.push({start:hl.startOffset,end:hl.endOffset,text:''},{start:il.endOffset,end:il.endOffset,text:'\n    '+source.slice(hl.startOffset,hl.endOffset)});
  }
 }
 // Align simple sibling fields with a shared label/control/help grid.
 for(const row of d.querySelectorAll('.fee-pair,.fee-pair--short,.grid')){
  const children=[...row.children];
  if(children.length>1&&children.every(e=>e.tagName==='DIV'&&e.querySelector(':scope > label')&&e.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea').length===1))cls(row,'field-pair');
 }
 // Keep number+unit tokens intact without forcing an entire table onto one line.
 for(const table of d.querySelectorAll('main table')){
  if(table.closest('.pr-block,.result'))continue;
  const rows=[...table.rows]; const header=table.tHead?.rows[0];
  if(header && [...header.cells].every(c=>c.colSpan===1)) for(let col=0;col<header.cells.length;col++){
   const cells=rows.filter(r=>r!==header).map(r=>r.cells[col]).filter(Boolean);
   if(cells.length&&cells.every(c=>c.colSpan===1&&c.classList.contains('num')))cls(header.cells[col],'num');
  }
  for(const cell of table.querySelectorAll('td,th')){
   if(!/^[\d,.％%円万億千年月日人倍歳〜～–—+−\s]+$/.test(cell.textContent.trim())||!/\d/.test(cell.textContent))continue;
   const walker=d.createTreeWalker(cell,dom.window.NodeFilter.SHOW_TEXT);let n;
   while(n=walker.nextNode()){
    if(n.parentElement.closest('.numeric-token'))continue;
    const l=dom.nodeLocation(n);if(!l)continue;
    const raw=source.slice(l.startOffset,l.endOffset);
    const next=raw.replace(/[0-9][0-9,.]*[億万千]?[％%円年月日人倍歳]/g,token=>'<span class="numeric-token">'+token+'</span>');
    if(next!==raw)edits.push({start:l.startOffset,end:l.endOffset,text:next});
   }
  }
  if(table.parentElement?.classList.contains('scroll-wrap')&&table.parentElement.parentElement?.classList.contains('retention-table')){
   const wrap=dom.nodeLocation(table.parentElement);if(wrap?.startTag&&wrap?.endTag)edits.push({start:wrap.startTag.startOffset,end:wrap.startTag.endOffset,text:''},{start:wrap.endTag.startOffset,end:wrap.endTag.endOffset,text:''});
  }
  if(!table.closest('.scroll-wrap,.fee-scroll,.retention-table')){
   const l=dom.nodeLocation(table);if(l)edits.push({start:l.startOffset,end:l.startOffset,text:'<div class="scroll-wrap">'},{start:l.endOffset,end:l.endOffset,text:'</div>'});
  }
 }
 // Multi-section calculators need the same navigation as the long articles.
 // Hubs and embeds intentionally do not receive a reading TOC.
 const tool=[...d.scripts].some(s=>/_core\.js/.test(s.textContent));
 const eligible=tool&&!file.startsWith('embed/')&&!file.startsWith('hojokin/')&&d.querySelectorAll('main h2').length>=3;
 // Short tool/reference pages (2026-09-27 Masahiro: /shiharai-site/ had no TOC): every non-hub page gets the same
 // TOC + related rail. With fewer than three sections the TOC lists the calculator/table and the FAQ questions.
 const HUB=/^(index\.html|column\/index\.html|about\/|contact\/|privacy\/|policy\/|toushi\/index\.html)/;
 const contentH2=[...d.querySelectorAll('main h2')].filter(h=>!h.closest('.rel-block,.domain-bridge,.side-rail')&&!/^関連/.test(h.textContent.trim()));
 const shortEligible=!eligible&&!HUB.test(file)&&!file.startsWith('embed/')&&!file.startsWith('hojokin/')&&!file.startsWith('column/')&&contentH2.length>=1;
 if(shortEligible&&(!d.querySelector('nav.toc')||source.includes('<!--layout-toc:start-->'))){
  const items=[];
  const first=d.querySelector('main .card')||d.querySelector('main table');
  if(first&&!first.closest('.rel-block,.side-rail')){
   if(!first.id){let id=first.tagName==='TABLE'?'tool-table':'tool-calc';while(d.getElementById(id))id+='-nav';set(first,'id',id);}
   items.push('<li><a href="#'+escape(first.id)+'">'+(first.tagName==='TABLE'?'早見表':'計算ツール')+'</a></li>');
  }
  contentH2.forEach((h,i)=>{
   if(!h.id){let id='tool-section-'+(i+1);while(d.getElementById(id))id+='-nav';set(h,'id',id);}
   const subs=[];
   for(let e=h.nextElementSibling;e&&e.tagName!=='H2';e=e.nextElementSibling){
    if(e.tagName==='H3'){let j=subs.length+1;if(!e.id){let id=h.id+'-q'+j;while(d.getElementById(id))id+='-nav';set(e,'id',id);}subs.push('<li><a href="#'+escape(e.id)+'">'+escape(e.textContent.trim())+'</a></li>');}
   }
   items.push('<li><a href="#'+escape(h.id)+'">'+escape(h.textContent.trim())+'</a>'+(subs.length?'<ol>'+subs.join('')+'</ol>':'')+'</li>');
  });
  const block='<!--layout-toc:start--><nav class="toc" aria-label="このページの目次"><div class="toc-title">目次</div><ol>'+items.join('')+'</ol></nav><!--layout-toc:end-->';
  const match=/<!--layout-toc:start-->[\s\S]*?<!--layout-toc:end-->/.exec(source);
  if(match){if(match[0]!==block)edits.push({start:match.index,end:match.index+match[0].length,text:block});}
  else {const hero=d.querySelector('main > .hero, main > .lead, main > article > .article-meta') || d.querySelector('main h1');const l=hero&&dom.nodeLocation(hero);if(!l)throw Error(file+': no hero for TOC');edits.push({start:l.endOffset,end:l.endOffset,text:'\n'+block});}
 }
 if(eligible&&(!d.querySelector('nav.toc')||source.includes('<!--layout-toc:start-->'))){
  const hs=[...d.querySelectorAll('main h2')].filter(h=>!h.closest('.rel-block,.domain-bridge,.side-rail')&&!/^関連/.test(h.textContent.trim()));
  hs.forEach((h,i)=>{if(!h.id){let id='tool-section-'+(i+1);while(d.getElementById(id))id+='-nav';set(h,'id',id);}});
  const block='<!--layout-toc:start--><nav class="toc" aria-label="このページの目次"><div class="toc-title">目次</div><ol>'+hs.map(h=>'<li><a href="#'+escape(h.id)+'">'+escape(h.textContent.trim())+'</a></li>').join('')+'</ol></nav><!--layout-toc:end-->';
  const match=/<!--layout-toc:start-->[\s\S]*?<!--layout-toc:end-->/.exec(source);
  if(match){if(match[0]!==block)edits.push({start:match.index,end:match.index+match[0].length,text:block});}
  else {const hero=d.querySelector('main > .hero, main > .lead') || d.querySelector('main > h1');const l=hero&&dom.nodeLocation(hero);if(!l)throw Error(file+': no hero for TOC');edits.push({start:l.endOffset,end:l.endOffset,text:'\n'+block});}
 }
 for(const [e,changes] of attrs){const l=dom.nodeLocation(e);if(!l?.startTag)continue;let tag=source.slice(l.startTag.startOffset,l.startTag.endOffset);for(const [k,v]of Object.entries(changes)){const re=new RegExp('\\s'+k+'="[^"]*"');if(re.test(tag))tag=tag.replace(re,' '+k+'="'+escape(v)+'"');else tag=tag.replace(/>$/,' '+k+'="'+escape(v)+'">');}edits.push({start:l.startTag.startOffset,end:l.startTag.endOffset,text:tag});}
 let result=source;for(const e of edits.sort((a,b)=>b.start-a.start||b.end-a.end))result=result.slice(0,e.start)+e.text+result.slice(e.end);
 result=result.replace(/^[ \t]+$/gm,'');
 if(result!==source){changed.push(file);if(!check)writeFileSync(root+file,result);}
 dom.window.close();
}
console.log(`${check?'stale':'updated'} layout markup: ${changed.length} pages`);if(check&&changed.length){console.error(changed.join('\n'));process.exitCode=1;}
