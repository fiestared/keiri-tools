import {JSDOM} from 'jsdom';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {segmentClaims,normalize} from '../../tools/segment_claims.mjs';
const edits=JSON.parse(readFileSync('review-evidence/r16-t6-a/edits.json'));
const selector='div,section,article,main,title,meta[name="description"],meta[property^="og:"],h1,h2,h3,h4,h5,h6,p,li,td,th,text,label,option,input,textarea,button,figcaption,dt,dd,summary,.hint';
const excluded='script,style,nav,header,footer,aside,.breadcrumb,.article-meta,.related,.rel-block,.next-read,.article-next-read,.rail-next,.tool-related';
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
for(const page of [...new Set(edits.map(x=>x.page))]){
 const html=readFileSync(page,'utf8'),dom=new JSDOM(html,{includeNodeLocations:true}),d=dom.window.document,seen=new Map(),found=new Map();
 for(const el of d.querySelectorAll(selector)){
  if(el.closest(excluded))continue;
  const tag=el.localName;if(tag==='input'&&['hidden','submit','reset','button'].includes(el.type))continue;
  if(tag==='meta'&&!/description|og:(title|description)/.test(el.name||el.getAttribute('property')))continue;
  const nodes=[]; const walk=n=>{for(const c of n.childNodes){if(c.nodeType===3)nodes.push(c);else if(c.nodeType===1&&!c.matches(selector+',script,style'))walk(c)}};walk(el);
  let text=tag==='meta'?el.content:nodes.map(n=>n.data).join('');
  if(tag==='input')text=`${el.id||el.name||el.type}: ${['checkbox','radio'].includes(el.type)?el.checked:el.value}; placeholder=${el.getAttribute('placeholder')||''}; min=${el.min}; max=${el.max}; step=${el.step}`;
  if(tag==='option')text+=` [value=${el.value};default=${el.selected}]`;
  if(!normalize(text||''))continue;const kind=tag==='meta'?(el.name||el.getAttribute('property')):tag;
  const parts=['p','li','td','th','dd','figcaption'].includes(tag)?text.match(/[^。！？!?]+[。！？!?]*|[。！？!?]+/gu)||[]:[text];let cursor=0;
  for(const part of parts){const pos=text.indexOf(part,cursor);cursor=pos+part.length;const norm=normalize(part);if(!norm)continue;const key=kind+':'+hash(norm),occ=(seen.get(key)||0)+1;seen.set(key,occ); const id=`s-${hash(key)}-${occ}`;found.set(id,{el,nodes,start:pos,end:cursor,text:part});}
 }
 const changes=new Map(),attrs=[];
 for(const e of edits.filter(x=>x.page===page)){
  const f=found.get(e.id);if(!f)throw Error('missing '+e.id);
  if(normalize(f.text)!==normalize(e.before))throw Error('mismatch '+e.id);
  if(f.el.localName==='meta'){const loc=dom.nodeLocation(f.el).attrs.content;attrs.push({start:loc.startOffset,end:loc.endOffset,value:'content="'+e.after.replaceAll('&','&amp;').replaceAll('"','&quot;')+'"'});continue;}
  let start=f.start,end=Math.min(f.end,f.nodes.reduce((s,n)=>s+n.data.length,0)),offset=0,inserted=false;
  for(const n of f.nodes){const next=offset+n.data.length;if(next>start&&offset<end){const a=Math.max(0,start-offset),b=Math.min(n.data.length,end-offset);if(!changes.has(n))changes.set(n,[]);changes.get(n).push({start:a,end:b,value:inserted?'':e.after});inserted=true;}offset=next;}
  if(!inserted)throw Error('no node '+e.id);
 }
 const patches=[...attrs];
 for(const [node,ops] of changes){let t=node.data;for(const o of ops.sort((a,b)=>b.start-a.start))t=t.slice(0,o.start)+o.value+t.slice(o.end); const l=dom.nodeLocation(node);patches.push({start:l.startOffset,end:l.endOffset,value:t.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')});}
 let output=html;for(const p of patches.sort((a,b)=>b.start-a.start))output=output.slice(0,p.start)+p.value+output.slice(p.end);
 writeFileSync(page,output);console.log(page,edits.filter(x=>x.page===page).length,'edits',segmentClaims(output,page).length,'units');dom.window.close();
}
