import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import {normalize,segmentClaims} from '../../tools/segment_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t1-a/';
const seg=JSON.parse(fs.readFileSync(run+'segments.json'));
const repl=JSON.parse(fs.readFileSync('reports/r16-t1-a/replacements.json'));
const adjud=JSON.parse(fs.readFileSync(run+'segment-adjudication.json')).segments;
for(let i=0;i<seg.length;i++) if(adjud[i].decision==='unresolved' && !repl[i+1]) throw Error('missing '+(i+1));
const selector='div,section,article,main,title,meta[name="description"],meta[property^="og:"],h1,h2,h3,h4,h5,h6,p,li,td,th,text,label,option,input,textarea,button,figcaption,dt,dd,summary,.hint';
const log=[];
for(const page of new Set(seg.map(s=>s.page))){
 let html=(await import('node:child_process')).execFileSync('git',['show','HEAD:'+page],{encoding:'utf8',maxBuffer:10000000}); const current=segmentClaims(html,page);const dom=new JSDOM(html,{includeNodeLocations:true});const doc=dom.window.document;const edits=[];
 for(const [index,replacement] of Object.entries(repl)){
  const unit=seg[Number(index)-1];if(unit.page!==page)continue;
  if(!current.some(u=>u.id===unit.id)){log.push({index,id:unit.id,status:'missing-current'});continue;}
  let matches=[];
  for(const el of doc.querySelectorAll(selector)){
   if(el.closest('script,style,nav,header,footer,aside,.breadcrumb,.article-meta,.related,.rel-block,.next-read,.article-next-read,.rail-next,.tool-related'))continue;
   const kind=el.localName==='meta'?(el.name||el.getAttribute('property')):el.localName;
   if(kind!==unit.kind)continue;
   if(kind==='description'||kind.startsWith('og:')){if(normalize(el.content)===normalize(unit.text))matches.push({el,meta:true});continue;}
   const nodes=[];const walker=doc.createTreeWalker(el,4);let n;
   while(n=walker.nextNode()){
    let p=n.parentElement,skip=false;while(p&&p!==el){if(p.matches(selector+',script,style')){skip=true;break;}p=p.parentElement;}
    if(!skip)nodes.push(n);
   }
   let txt='',map=[];
   for(const n of nodes)for(let i=0;i<n.textContent.length;i++){const c=normalize(n.textContent[i]);txt+=c;for(let j=0;j<c.length;j++)map.push({n,i});}
   const needle=normalize(unit.text);
   const own=nodes.map(n=>n.textContent).join('');
   const parts=['p','li','td','th','dd','figcaption'].includes(kind)?(own.match(/[^。！？!?]+[。！？!?]*|[。！？!?]+/gu)||[]):[own];
   let offset=0;
   for(const part of parts){const partNorm=normalize(part);if(partNorm===needle)matches.push({el,map,start:offset,end:offset+partNorm.length});offset+=partNorm.length;}

  }
  const occurrence=Number(unit.id.split('-').at(-1))-1;const m=matches[occurrence];if(!m)throw Error('cannot locate '+index);
  if(m.meta){const loc=dom.nodeLocation(m.el).attrs.content;const raw=html.slice(loc.startOffset,loc.endOffset);edits.push({start:loc.startOffset,end:loc.endOffset,text:'content="'+replacement.replaceAll('&','&amp;').replaceAll('"','&quot;')+'"'});}
  else{
   const groups=new Map();for(const x of m.map.slice(m.start,m.end)){if(!groups.has(x.n))groups.set(x.n,[]);groups.get(x.n).push(x.i);}
   let first=true;
   for(const [n,positions] of groups){const loc=dom.nodeLocation(n);const a=Math.min(...positions),b=Math.max(...positions)+1;
    // Text locations need entity-aware offset mapping; these affected nodes contain no entities before the selected span.
    const raw=html.slice(loc.startOffset,loc.endOffset);if(raw!==n.textContent)throw Error('entity offset requires handling '+index+' '+raw);
    edits.push({start:loc.startOffset+a,end:loc.startOffset+b,text:first?replacement.replaceAll('&','&amp;').replaceAll('<','&lt;'):''});first=false;
   }
  }
  log.push({index:Number(index),id:unit.id,page,old:unit.text,new:replacement,status:'changed'});
 }
 edits.sort((a,b)=>b.start-a.start);for(let i=1;i<edits.length;i++)if(edits[i].end>edits[i-1].start)throw Error('overlap');
 for(const e of edits)html=html.slice(0,e.start)+e.text+html.slice(e.end);
 html=html.replace(/<span class="faq-existing-marker" aria-hidden="true">A\. ([^<]+)<\/span>/g,(_,t)=>'<span class="faq-existing-marker" aria-hidden="true">A. </span>'+t.trim()).replace(/<(b|strong|a)\b[^>]*>\s*<\/\1>/g,'');
 fs.writeFileSync(page,html);dom.window.close();
}
fs.writeFileSync('reports/r16-t1-a/edits.json',JSON.stringify(log,null,2)+'\n');console.log(log.reduce((r,x)=>(r[x.status]=(r[x.status]||0)+1,r),{}));
