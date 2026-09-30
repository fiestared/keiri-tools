import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {createHash} from 'node:crypto';
import {normalize,segmentClaims} from '../../tools/segment_claims.mjs';
const base='review/r16-t2-a/';
const edits=JSON.parse(fs.readFileSync(base+'edits.json'));
const selector='div,section,article,main,title,meta[name="description"],meta[property^="og:"],h1,h2,h3,h4,h5,h6,p,li,td,th,text,label,option,input,textarea,button,figcaption,dt,dd,summary,.hint';
const excluded='script,style,nav,header,footer,aside,.breadcrumb,.article-meta,.source-method,.related,.rel-block,.next-read,.article-next-read,.rail-next,.tool-related';
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for(const page of new Set(edits.map(e=>e.page))){
 const html=execFileSync('git',['show','2d0c0862:'+page],{encoding:'utf8'}),dom=new JSDOM(html,{includeNodeLocations:true}),d=dom.window.document;
 const seen=new Map(),changes=new Map(),patches=[],unbold=new Set(); let count=0;
 for(const el of d.querySelectorAll(selector)){
  if(el.closest(excluded)) continue;
  const tag=el.localName;
  if(tag==='input'&&['hidden','submit','reset','button'].includes(el.type))continue;
  if(tag==='meta'&&!/description|og:(title|description)/.test(el.name||el.getAttribute('property')))continue;
  const nodes=[];
  function walk(n){for(const c of n.childNodes){if(c.nodeType===3)nodes.push(c);else if(c.nodeType===1&&!c.matches(selector+',script,style'))walk(c);}}
  walk(el);
  let text=tag==='meta'?el.content:nodes.map(n=>n.data).join('');
  if(tag==='input')text=`${el.id||el.name||el.type}: ${['checkbox','radio'].includes(el.type)?el.checked:el.value}; placeholder=${el.getAttribute('placeholder')||''}; min=${el.min}; max=${el.max}; step=${el.step}`;
  if(tag==='option')text+=` [value=${el.value};default=${el.selected}]`;
  const kind=tag==='meta'?(el.name||el.getAttribute('property')):tag;
  const parts=['p','li','td','th','dd','figcaption'].includes(tag)?text.match(/[^。！？!?]+[。！？!?]*|[。！？!?]+/gu)||[]:[text];
  let offset=0;
  for(const part of parts){const norm=normalize(part);if(!norm){offset+=part.length;continue;}
   const key=`${kind}:${hash(norm)}`,occ=(seen.get(key)||0)+1;seen.set(key,occ);
   const id=`s-${hash(key)}-${occ}`,edit=edits.find(e=>e.page===page&&e.id===id);
   if(edit){count++;for(const b of el.querySelectorAll("b,strong"))unbold.add(b);
    if(tag==='meta'){const loc=dom.nodeLocation(el).attrs.content;patches.push({start:loc.startOffset,end:loc.endOffset,value:`content="${escape(edit.replacement).replaceAll('"','&quot;')}"`});}
    else{
     for(const op of edit.ops){
     const start=offset+part.indexOf(part.trim())+op.start,end=offset+part.indexOf(part.trim())+op.end;
     let pos=0,inserted=false;
     for(const node of nodes){const nodeEnd=pos+node.data.length;if((nodeEnd>start&&pos<end)||(start===end&&!inserted&&(nodeEnd>start||node===nodes.at(-1))&&pos<=start)){let arr=changes.get(node)||[];arr.push({start:Math.max(0,start-pos),end:Math.min(node.data.length,end-pos),value:inserted?'':op.value});changes.set(node,arr);inserted=true;}pos=nodeEnd;}
     if(!inserted)throw Error('no nodes '+edit.ordinal);
     }
    }
   }
   offset+=part.length;
  }
 }
 for(const b of unbold){const l=dom.nodeLocation(b);if(l?.startTag)patches.push({start:l.startTag.startOffset,end:l.startTag.endOffset,value:""});if(l?.endTag)patches.push({start:l.endTag.startOffset,end:l.endTag.endOffset,value:""});}
 for(const[node,arr]of changes){let value=node.data;for(const c of arr.sort((a,b)=>b.start-a.start))value=value.slice(0,c.start)+c.value+value.slice(c.end);const loc=dom.nodeLocation(node);patches.push({start:loc.startOffset,end:loc.endOffset,value:escape(value)});}
 if(count!==edits.filter(e=>e.page===page).length)throw Error('missing '+page+' '+count);
 let output=html;for(const p of patches.sort((a,b)=>b.start-a.start))output=output.slice(0,p.start)+p.value+output.slice(p.end);
 // Keep FAQ structured answers identical to the visible answers.
 const updated=new JSDOM(output).window.document;
 const faq=[...updated.querySelectorAll('.faq-answer')].map(el=>el.textContent.trim());
 output=output.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)<\/script>/g,(all,opening,body)=>{let data;try{data=JSON.parse(body);}catch{return all;}const f=data['@type']==='FAQPage'?data:(data['@graph']||[]).find(x=>x['@type']==='FAQPage');if(!f)return all;if(f.mainEntity.length!==faq.length)throw Error('FAQ mismatch');f.mainEntity.forEach((x,i)=>x.acceptedAnswer.text=faq[i]);return opening+'\n'+JSON.stringify(data,null,2)+'\n</script>';});
 if(page.includes('shiharai-chosho/'))output=output.replace('<p>注意したいのは、', '<p>※令和9年1月1日以後、給与支払報告書を市区町村に提出した場合、給与所得の源泉徴収票は税務署へ提出したものとみなされます。税務署提出用は作成不要ですが、受給者交付用の源泉徴収票1枚と市区町村提出用の給与支払報告書1枚を作成します。</p>\n<p>注意したいのは、');
 if(page.includes('gensen-choshuhyo-mikata/'))output=output.replace('翌年1月31日が法定期限。中途退職者は', '令和8年分の交付期限は令和9年2月1日。中途退職者は').replace('<text x="580" y="44" text-anchor="middle" class="fg-warn">', '<text x="640" y="44" text-anchor="end" class="fg-warn">');
 output=output.replace('差額 ${yenF(r.remainder)} は、票に金額が出ない控除で説明できます。','差額 ${yenF(r.remainder)} と金額が一致する控除の候補です。').replace('次のどれかに当てはまりませんか。','適用の確定ではありません。本人の区分欄などと照合してください。');
 const navdoc=new JSDOM(output).window.document;
 for(const link of navdoc.querySelectorAll('nav.toc a[href^="#"]')){const heading=navdoc.getElementById(link.getAttribute('href').slice(1));if(heading&&/^H[1-6]$/.test(heading.tagName))output=output.replace(link.outerHTML,link.outerHTML.replace(link.innerHTML,escape(heading.textContent)));}
 fs.writeFileSync(base+'baseline-'+page.split('/')[2]+'.html',html);
 const dest=base+'candidate-'+page.split('/')[2]+'.html';fs.writeFileSync(dest,output);console.log(dest,count,segmentClaims(output,page).length);
 dom.window.close();
}
