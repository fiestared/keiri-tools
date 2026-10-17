#!/usr/bin/env node
// Generated maintenance index, not a claims ledger or a publication gate.
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const readJSON = f => JSON.parse(readFileSync(f, 'utf8'));
const digest = s => createHash('sha256').update(s).digest('hex');
// Do not NFKC-normalize circled enumeration numbers into spurious制度値.
const half = s => s.replace(/[０-９％，．]/g, c => ({'％':'%','，':',','．':'.'}[c] || String.fromCharCode(c.charCodeAt(0)-0xfee0)));
const clean = s => s.replace(/\s+/gu, ' ').trim();
const norm = s => half(s).replace(/\s+/gu, '');
const COUNTED = new Set(['amount', 'percent']);
const NUM = String.raw`(?:\d[\d,]*(?:\.\d+)?|[一二三四五六七八九十百千]+)`;
const RANGE_NUM = `${NUM}(?:[ \t]*[〜～~–－-][ \t]*${NUM})?`;
const DATE = /(?:令和|平成|昭和)\s*[0-9一二三四五六七八九十元]+(?:\s*[・〜～]\s*[0-9一二三四五六七八九十]+)*\s*年(?:度|分)?(?:\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?)?|(?:19|20)\d{2}(?:\s*[・〜～]\s*(?:19|20)\d{2})*\s*年(?:度|分)?(?:\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?)?|(?:19|20)\d{2}-\d{2}(?:-\d{2})?|\d{1,2}\s*月\s*\d{1,2}\s*日/g;
const NETS = [
  ['amount', new RegExp(String.raw`(?:[¥￥]\s*${RANGE_NUM}(?:\s*[億万千]\s*(?:${NUM})?)?(?:円)?|${RANGE_NUM}(?:\s*[億万千]\s*(?:${NUM})?)*\s*円)`, 'g')],
  ['percent', new RegExp(String.raw`${RANGE_NUM}\s*%`, 'g')],
  ['permille', new RegExp(String.raw`${NUM}\s*‰|${NUM}\s*\/\s*1000`, 'g')],
  ['duration', new RegExp(String.raw`${RANGE_NUM}\s*(?:か月|ヶ月|カ月|ケ月|箇月|日間|日|月間|週間|時間|年間|年以内|年以上|年未満)`, 'g')],
  ['grade', /(?:第\s*)?\d+(?:[〜～]\d+)?\s*等級/g],
  ['age', /\d+(?:[〜～]\d+)?\s*歳/g],
  ['ratio', new RegExp(String.raw`${NUM}\s*(?:割|倍)`, 'g')],
  ['transition', /改正後|改定後|施行予定|予定|見込み|新設|廃止|撤廃|適用開始|施行|(?:年(?:度|分)?|月(?:分)?|日)(?:以後|以降|から)/g]
];
export function extractValues(text) {
  const normalized = half(text), out = [], occupied = new Uint8Array(normalized.length);
  const collect = (kind, re) => { re.lastIndex = 0; for (const m of normalized.matchAll(re)) {
    if (occupied.slice(m.index, m.index+m[0].length).some(Boolean)) continue;
    occupied.fill(1,m.index,m.index+m[0].length);
    out.push({kind, value:text.slice(m.index,m.index+m[0].length), normalized:m[0], offset:m.index});
  }};
  collect('date',DATE); for (const [kind,re] of NETS) collect(kind,re);
  return out.sort((a,b)=>a.offset-b.offset);
}
export function loadTopics(root = ROOT) {
  const config = readJSON(join(root,'tools/update_map_topics.json'));
  const years = readJSON(join(root,'tools/source_year_registry.json'));
  const sources = readJSON(join(root,'tools/source_registry.json'));
  return config.topics.map(t => {
    const watches = years.entries.filter(e=>t.source_year_slugs.includes(e.slug));
    const urls = new Set(t.primary_urls);
    for (const w of watches) if (w.url) urls.add(w.url.replace('{y}',w.covers).replace(/\{r(?::02d)?\}/g, x=>x.includes('02d')?String(w.covers-2018).padStart(2,'0'):String(w.covers-2018)));
    const assets = t.reference_json.filter(f=>existsSync(join(root,f))).map(file => {
      const d=readJSON(join(root,file));
      for (const u of JSON.stringify({meta:d._meta||{},source:d._source,bank_sources:d.banks?.map(b=>b.source)}).matchAll(/https:\/\/[^\s"\\<>]+/g)) urls.add(u[0].replace(/[／。）、]+$/u,''));
      return {file,year:d.year??d._meta?.year??null,next_review:d._meta?.next_review??null};
    });
    return {...t,primary_urls:[...urls].sort(),source_year_watches:watches,reference_data:assets,
      source_registry_refs:sources.sources.filter(s=>[...urls].some(u=>u.replace(/\/$/,'')===(s.url||'').replace(/\/$/,''))).map(s=>({id:s.id,url:s.url,local_text:s.local_text})), regex:new RegExp(t.pattern,'iu')};
  });
}
export function classify(text, context, topics) {
  const scopes = [['local',text],['table',context.column||''],['table',context.row||context.table||''],['h3',context.h3||''],['h2',context.h2||''],['page_title',context.title||'']];
  const specific = hits => hits.filter(t=>!hits.some(child=>child.refines?.includes(t.name)));
  for (let i=0;i<scopes.length;i++) {
    const [basis,scope]=scopes[i];
    if (!scope) continue;
    let hits=topics.filter(t=>t.regex.test(half(scope)));
    // A general fallback mention may be narrowed by its own child in a heading,
    // never by an unrelated制度 in the rest of the page.
    if (hits.length && hits.every(t=>t.fallback)) {
      for (const [childBasis,childScope] of scopes.slice(i+1)) {
        const children=topics.filter(t=>t.refines?.some(name=>hits.some(h=>h.name===name))&&t.regex.test(half(childScope)));
        if(children.length)return {topics:specific(children).map(t=>t.name),basis:childBasis};
      }
    }
    hits=specific(hits);
    if (hits.some(t=>!t.fallback)) hits=hits.filter(t=>!t.fallback);
    if (hits.length) return {topics:hits.map(t=>t.name),basis};
  }
  return {topics:['未分類'],basis:'unclassified'};
}
function cssPath(el) {
  const parts=[]; for(let e=el; e?.localName; e=e.parentElement) {
    let n=1; for(let p=e.previousElementSibling;p;p=p.previousElementSibling) if(p.localName===e.localName)n++;
    parts.unshift(`${e.localName}:nth-of-type(${n})`);
  } return parts.join(' > ');
}
const UNIT = 'title,desc,h1,h2,h3,h4,h5,h6,p,li,td,th,caption,text,figcaption,label,option,button,dt,dd,summary,pre,blockquote,div,section,article,main,body,a.tool-card';
const BLOCK = new Set('text title desc h1 h2 h3 h4 h5 h6 p li td th caption figcaption dt dd summary pre div section article main table tr ul ol header footer nav aside'.split(' '));
function ownText(el) {
  if (el.localName==='meta') return el.content;
  const copy=el.cloneNode(true);
  for(const e of copy.querySelectorAll(UNIT+',script,style')) e.remove();
  for(const br of copy.querySelectorAll('br')) br.replaceWith(' ');
  return clean(copy.textContent);
}
// Table grid honors rowspan and colspan; column labels are not just the first row.
function tableLocations(d) {
  const map=new Map();
  for(const table of d.querySelectorAll('table')) {
    const rows=[...table.rows].filter(r=>r.closest('table')===table), grid=[];
    for(let r=0;r<rows.length;r++) {
      grid[r] ||= []; let col=0;
      for(const cell of rows[r].cells) {
        while(grid[r][col])col++;
        for(let y=r;y<r+cell.rowSpan;y++) for(let x=col;x<col+cell.colSpan;x++) {(grid[y]||=[])[x]=cell;}
        map.set(cell,{table_selector:cssPath(table),row_index:r+1,column_index:col+1,row_subject:clean((grid[r][0]||cell).textContent),column_heading:''});
        col+=cell.colSpan;
      }
    }
    for(let r=0;r<rows.length;r++) for(const cell of rows[r].cells) {
      const loc=map.get(cell), labels=[];
      for(let y=0;y<r;y++) {const h=grid[y]?.[loc.column_index-1]; if(h?.localName==='th'&&h!==grid[r][0]&&!labels.includes(clean(h.textContent)))labels.push(clean(h.textContent));}
      loc.column_heading=labels.join(' / ');
      // Some tables start with a circled row number, then the制度 name. Keep
      // row_subject as the positional key and use only that label, not sibling
      // amount/rate cells, as extra classification context.
      const rowCells=[...rows[r].cells], first=rowCells[0];
      let label=first;
      if(/^[①-⑳\d０-９\s.．、()（）]+$/u.test(clean(first?.textContent||''))) {
        const next=rowCells[1];
        label=next&&/制度|種類|調書|区分|名称/.test(map.get(next)?.column_heading||'')?next:null;
      }
      loc.row_heading=label&&rowCells.indexOf(label)<rowCells.indexOf(cell)?clean(label.textContent):'';
    }
  } return map;
}
// Lexical candidates only; no script execution. Comments and URL strings are not display text.
const JS_TOKENS=/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;
export function scriptStrings(code) {
  const out=[];
  for(const m of code.matchAll(JS_TOKENS)) {
    if(m[0].startsWith('/'))continue;
    const value=m[0].slice(1,-1).replace(/\\n/g,' ').replace(/\\(['"`\\])/g,'$1');
    out.push({value,index:m.index,dynamic:value.includes('${')});
  } return out;
}
function snippet(text, values) {
  const ranges=[];
  for(const v of values) {
    const start=Math.max(0,v.offset-40),end=Math.min(text.length,v.offset+v.value.length+40),prev=ranges.at(-1);
    if(prev&&start<=prev.end){prev.end=Math.max(prev.end,end);prev.values.push(v.value);}
    else ranges.push({start,end,values:[v.value]});
  }
  return ranges.map(r=>({values:r.values,text:text.slice(r.start,r.end)}));
}
export function extractPage(html, page, topics, file='docs'+page+'index.html') {
  const dom=new JSDOM(html,{includeNodeLocations:true}), d=dom.window.document;
  const title=clean(d.title), tables=tableLocations(d), occurrences=[], scripts=[];
  let h2=null,h3=null;
  const heading = el => ({id:el.id||null,text:clean(el.textContent),selector:cssPath(el)});
  const add = (el,text,field='text',extra={}) => {
    const values=extractValues(text);
    const table=tables.get(el.closest('td,th'))||null;
    const card=el.closest('a.tool-card');
    const cardTitle=card?clean(card.querySelector('b,strong')?.textContent||''):null;
    if(table && el.localName==='td' && /^[0-9０-９]/.test(text)) {
      for(const m of half(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
        if(values.some(v=>m.index<v.offset+v.value.length&&m.index+m[0].length>v.offset))continue;
        values.push({kind:/等級/.test(table.column_heading)?'inferred_grade':'table_number',value:text.slice(m.index,m.index+m[0].length),normalized:m[0],offset:m.index,inferred:true,unit_hint:table.column_heading});
      }
      values.sort((a,b)=>a.offset-b.offset);
    }
    if(!values.length)return;
    // Table unitless integers are separately inferred; the %/円 denominator uses explicit units only.
    const location={file,line:dom.nodeLocation(el)?.startLine??null,selector:cssPath(el),field,element:el.localName,
      element_id:el.id||null,h2,h3,container:el.closest('.callout,.note,blockquote')?.className||el.closest('blockquote')?.localName||null,table,...extra};
    for(const v of values) {
      const before=text.slice(0,v.offset), after=text.slice(v.offset);
      const left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'))+1;
      const end=after.indexOf('。');
      const local=text.slice(left,end<0?text.length:v.offset+end+1);
      Object.assign(v,classify(local,{column:table?.column_heading,row:table?`${table.row_heading} ${table.row_subject}`:'',h3:card?null:h3?.text,h2:card?null:h2?.text,title:card?cardTitle:title},topics));
    }
    const id='u-'+digest(file+'|'+location.selector+'|'+field).slice(0,16);
    occurrences.push({id,location,topics:[...new Set(values.flatMap(v=>v.topics))],values,excerpts:snippet(text,values),text});
  };
  for(const el of d.querySelectorAll(UNIT+',meta[name="description"],meta[name="card-desc"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"],script,[aria-label],[placeholder]')) {
    if(el.closest('style,template'))continue;
    if(el.localName==='h2'){h2=heading(el);h3=null;}
    if(el.localName==='h3')h3=heading(el);
    if(el.localName==='script') {
      if(el.type==='application/ld+json') {
        try {const visit=(x,path='')=>{
          if(typeof x==='string' && !/^(?:https?:|\/)/.test(x))add(el,x,'jsonld:'+path,{generated_copy:true});
          else if(Array.isArray(x))x.forEach((v,i)=>visit(v,path+'/'+i));
          else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x))if(!k.startsWith('@'))visit(v,path+'/'+k);
        };visit(JSON.parse(el.textContent));}catch(e){scripts.push({kind:'invalid_jsonld',file,line:dom.nodeLocation(el)?.startLine,message:e.message});}
      } else {
        scripts.push({kind:'script',src:el.getAttribute('src'),code:el.textContent,selector:cssPath(el),line:dom.nodeLocation(el)?.startLine});
        let i=0;for(const s of scriptStrings(el.textContent)) {
          i++; if(/^(?:https?:|\/|\.\.\/|\.\/)[^\s<>]+$/.test(s.value))continue;
          // Static strings could be used in results. Preserve them as candidates, including templates.
          if(/[円%％年日月等級予定]/.test(s.value)) add(el,clean(s.value.replace(/<[^>]*>/g,'')),`js_string:${i}`,{candidate:true,dynamic:s.dynamic});
        }
      }
      continue;
    }
    if(el.closest('script'))continue;
    if(el.matches(UNIT)||el.localName==='meta') add(el,ownText(el),el.localName==='meta'?'content':'text');
    for(const attr of ['aria-label','placeholder'])if(el.hasAttribute(attr))add(el,clean(el.getAttribute(attr)),attr);
  }
  // Independent whole-DOM count (no unit selector). Compare multisets to expose structural extraction loss.
  const visible=(node)=> {
    if(node.nodeType===3)return node.textContent;
    if(node.nodeType!==1&&node.nodeType!==9)return '';
    if(['script','style','template'].includes(node.localName))return '';
    const txt=[...node.childNodes].map(visible).join('');return BLOCK.has(node.localName)||node.matches?.('a.tool-card')?'\u0000'+txt+'\u0000':txt;
  };
  const audit=extractValues(visible(d.body)).filter(v=>COUNTED.has(v.kind));
  for(const el of d.querySelectorAll('head > title,meta[name="description"],meta[name="card-desc"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"],[aria-label],[placeholder]')) {
    const texts=el.localName==='meta'?[el.content]:el.localName==='title'?[el.textContent]:[];
    for(const a of ['aria-label','placeholder'])if(el.hasAttribute(a))texts.push(el.getAttribute(a));
    for(const text of texts)audit.push(...extractValues(clean(text)).filter(v=>COUNTED.has(v.kind)));
  }
  const captured=occurrences.filter(o=>!o.location.generated_copy&&!o.location.candidate).flatMap(o=>o.values.filter(v=>COUNTED.has(v.kind)));
  const counts=vs=>{const m=new Map();for(const v of vs){const k=norm(v.value);m.set(k,(m.get(k)||0)+1);}return m;};
  const auditCounts=counts(audit), capturedCounts=counts(captured), missed=[];
  for(const[value,n]of auditCounts)if(n>(capturedCounts.get(value)||0))missed.push({value,count:n-(capturedCounts.get(value)||0)});
  const noindex=[...d.querySelectorAll('meta[name="robots"],meta[name="googlebot"]')].some(e=>/\bnoindex\b|\bnone\b/i.test(e.content));
  dom.window.close();
  return {page,file,title,noindex,occurrences,scripts,audit:{total:audit.length,captured:captured.length,missed},source_sha256:digest(html)};
}
function walk(dir,ext) {
  return readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.name.startsWith('.')?[]:e.isDirectory()?walk(join(dir,e.name),ext):e.name.endsWith(ext)?[join(dir,e.name)]:[]);
}
function assetInfo(root,file) {
  const d=readJSON(join(root,file)),m=d._meta||{};
  const keys=Object.keys(d).filter(k=>!k.startsWith('_'));
  const dateKeys=keys.filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  return {file,year:d.year??m.year??null,year_origin:d.year!==undefined?'year':m.year!==undefined?'_meta.year':'unspecified',meta:m,
    data_keys:dateKeys.length===keys.length?[]:keys,coverage:dateKeys.length?{from:dateKeys[0],through:dateKeys.at(-1)}:null,sha256:digest(readFileSync(join(root,file)))};
}
function localFile(root,from,url) {
  if(!url||/^(?:https?:|data:|#)/.test(url))return null;
  const target=resolve(url.startsWith('/')?join(root,'docs'):dirname(join(root,from)),url.replace(/^\//,'').split(/[?#]/)[0]);
  return target.startsWith(join(root,'docs')+sep)?relative(root,target).split(sep).join('/'):null;
}
function dependencies(root,p,assets,topics) {
  const found=new Map(),unresolved=[],visited=new Set();
  const visit=(file,code,via,inlineBase=0)=> {
    if(visited.has(file))return; visited.add(file);
    code=code.replace(JS_TOKENS,m=>m.startsWith('/')?m.replace(/[^\n]/g,' '):m);
    const literals=scriptStrings(code);
    for(const s of literals) {
      if(!/\.json(?:[?#].*)?$/.test(s.value))continue;
      const target=localFile(root,file,s.value);
      if(s.dynamic||!target||!assets[target]) {unresolved.push({file,expression:s.value,reason:s.dynamic?'dynamic_json_url':'json_not_in_assets'});continue;}
      const dep=found.get(target)||{...assets[target],via:[],topics:topics.filter(t=>t.reference_json.includes(target)).map(t=>t.name)};
      dep.via.push({file,line:inlineBase+code.slice(0,s.index).split('\n').length,expression:s.value,chain:via});found.set(target,dep);
    }
    // Variable/computed fetches need review; do not silently infer their target.
    for(const m of code.matchAll(/\bfetch\s*\(\s*([^\n;)]+)/g))if((/\.json\s*\(/.test(code)||literals.some(s=>/\.json/.test(s.value)))&&!/^new URL\s*\(\s*["'][^"']+\.json["']\s*,\s*import\.meta\.url/.test(m[1])&&(!/^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)\s*(?:,|$)/.test(m[1])||m[1].includes('${')))unresolved.push({file,expression:m[1].slice(0,120),reason:'computed_fetch_argument'});
    for(const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+\.m?js(?:[?#][^"']*)?)["']/g)) {
      const f=localFile(root,file,m[1]);if(f&&existsSync(join(root,f)))visit(f,readFileSync(join(root,f),'utf8'),[...via,file]);
    }
  };
  let n=0;for(const script of p.scripts.filter(s=>s.kind==='script')) {
    n++; visit(p.file+`#inline-${n}`,script.code,[],(script.line||1)-1); // use real page path for relative URL resolution
    if(script.src){const f=localFile(root,p.file,script.src);if(f&&existsSync(join(root,f)))visit(f,readFileSync(join(root,f),'utf8'),[p.file]);}
  }
  // Resolve inline pseudo-file paths above to the page path in emitted evidence.
  for(const dep of found.values())for(const v of dep.via){v.file=v.file.replace(/#inline-\d+$/,'');v.chain=v.chain.map(f=>f.replace(/#inline-\d+$/,''));}
  return {data:[...found.values()],unresolved};
}
export function nextRevision(topic,today) {
  const currentMonth=Number(today.slice(5,7)),year=Number(today.slice(0,4));
  const candidates=topic.next_revision.months.map(m=>m===currentMonth?today:`${m>currentMonth?year:year+1}-${String(m).padStart(2,'0')}-01`);
  const reviews=topic.reference_data.filter(d=>d.next_review).map(d=>({date:d.next_review,file:d.file}));
  candidates.push(...reviews.map(r=>r.date<today?today:r.date));
  return {date:candidates.sort()[0]||null,note:topic.next_revision.note,status:topic.next_revision.status,data_reviews:reviews};
}
export function buildUpdateMap({root=ROOT,onlyPage=null,today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date())}={}) {
  const topics=loadTopics(root),pages={},assets={},citations=readJSON(join(root,'tools/citation_date_registry.json'));
  for(const f of walk(join(root,'docs/assets'),'.json')){const file=relative(root,f);assets[file]=assetInfo(root,file);}
  for(const f of walk(join(root,'docs'),'.html')) {
    const file=relative(root,f),page='/'+relative(join(root,'docs'),f).replace(/index\.html$/,'');
    if(onlyPage&&page!==onlyPage)continue;
    const p=extractPage(readFileSync(f,'utf8'),page,topics,file);
    const markers=[];for(let dir=dirname(f);dir.startsWith(join(root,'docs'));dir=dirname(dir))if(existsSync(join(dir,'.nopublish')))markers.push(relative(root,join(dir,'.nopublish')));
    p.nopublish=markers;p.visibility=p.noindex||markers.length?'excluded':'public';
    p.dependencies=dependencies(root,p,assets,topics);
    const ledgerFile='claims/'+relative(join(root,'docs'),f).replace(/\/index\.html$/,'').replace(/^index\.html$/,'index').replace(/\.html$/,'')+'.json';
    const ledger=existsSync(join(root,ledgerFile))?readJSON(join(root,ledgerFile)):null;
    p.claims_ledger=ledger?{file:ledgerFile,claim_count:ledger.claims?.length||0,sha256:digest(readFileSync(join(root,ledgerFile)))}:null;
    // Match claim text, never a common number alone. This is a candidate link, not a validity verdict.
    for(const o of p.occurrences)o.claim_refs=(ledger?.claims||[]).filter(c=>{
      const a=norm(c.text||''),b=norm(o.text);return a.length>=16&&b.length>=16&&(a.includes(b)||b.includes(a));
    }).map(c=>c.id);
    p.citation_date_refs=citations.citations.filter(c=>c.page===page).map(c=>({...c,url:citations.sources.find(s=>s.source_id===c.source_id)?.url??null}));
    for(const dep of p.dependencies.data) {
      const names=dep.topics.length?dep.topics:['未分類'];
      const o={id:'d-'+digest(file+'|'+dep.file).slice(0,16),location:{file:dep.via[0]?.file||file,line:dep.via[0]?.line||null,selector:null,field:'reference_json',element:'dependency',h2:null,h3:null,table:null},
        topics:names,values:[{kind:'dependency',value:dep.file+'（'+(dep.year||'年版未指定')+'）',topics:names,basis:'reference_json'}],excerpts:[{values:[dep.file+'（'+(dep.year||'年版未指定')+'）'],text:dep.via.map(v=>v.expression).join(' / ')}],text:dep.file,claim_refs:[]};
      p.occurrences.push(o);
    }
    p.locations={};
    for(const o of p.occurrences){const key='l-'+digest(JSON.stringify(o.location)).slice(0,16);p.locations[key]=o.location;o.location_ref=key;}
    for(const u of p.dependencies.unresolved)u.file=u.file.replace(/#inline-\d+$/,'');
    p.invalid_jsonld=p.scripts.filter(s=>s.kind==='invalid_jsonld');delete p.scripts;
    pages[page]=p;
  }
  const byTopic={};for(const t of [...topics,{name:'未分類'}]) {
    const {regex,...config}=t;
    byTopic[t.name]={...config,next:t.name==='未分類'?{date:null,note:'辞書・文脈を追加して再生成',status:'unknown',data_reviews:[]}:nextRevision(t,today),pages:{},counts:{public_pages:0,public_occurrences:0,excluded_pages:0,excluded_occurrences:0}};
  }
  for(const p of Object.values(pages))for(const o of p.occurrences)for(const t of o.topics) {
    const entry=byTopic[t]; (entry.pages[p.page]||=[]).push(o.id);
    entry.counts[p.visibility+'_occurrences']++;
  }
  for(const t of Object.values(byTopic))for(const page of Object.keys(t.pages))t.counts[pages[page].visibility+'_pages']++;
  const coverage = subset => {
    let total=0,classified=0,unclassified=0,jsCandidates=0;const missed=[],freq=new Map();
    for(const p of subset) {
      total+=p.audit.total;
      for(const m of p.audit.missed)missed.push({page:p.page,...m});
      for(const o of p.occurrences)if(!o.location.generated_copy)for(const v of o.values.filter(v=>COUNTED.has(v.kind))) {
        if(o.location.candidate){jsCandidates++;continue;}
        if(v.topics.includes('未分類')){unclassified++;const key=norm(v.value);const row=freq.get(key)||{value:key,count:0,pages:new Set()};row.count++;row.pages.add(p.page);freq.set(key,row);}else classified++;
      }
    }
    return {total,classified,unclassified,classification_rate:total?Number((100*classified/total).toFixed(2)):0,missed,missed_count:missed.reduce((s,m)=>s+m.count,0),script_numeric_candidates:jsCandidates,
      unclassified_top:[...freq.values()].sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value,'ja')).slice(0,30).map(r=>({...r,pages:[...r.pages]}))};
  };
  return {schema_version:1,generated_on_jst:today,input_sha256:digest(JSON.stringify(Object.values(pages).map(p=>[p.file,p.source_sha256]))+JSON.stringify(assets)+JSON.stringify(topics.map(({regex,...t})=>t))+JSON.stringify(citations)+JSON.stringify(Object.values(pages).map(p=>p.claims_ledger?.sha256))+digest(readFileSync(join(ROOT,'tools/gen_update_map.mjs')))),
    scope:'docs/**/*.html; excluded (.nopublish/noindex) displayed separately; no value correctness verdict',
    summary:{pages:Object.keys(pages).length,public_pages:Object.values(pages).filter(p=>p.visibility==='public').length,excluded_pages:Object.values(pages).filter(p=>p.visibility==='excluded').length,topics:topics.length,
      occurrences:Object.values(pages).reduce((n,p)=>n+p.occurrences.length,0),coverage:coverage(Object.values(pages)),public_coverage:coverage(Object.values(pages).filter(p=>p.visibility==='public'))},pages,topics:byTopic};
}
const md=s=>String(s??'').replace(/\|/g,'\\|').replace(/[\r\n]/g,' ').replace(/</g,'&lt;').replace(/>/g,'&gt;').trim();
function locationText(o) {
  const l=o.location;
  return [l.h2?`h2 ${l.h2.id?'#'+l.h2.id:'(idなし)「'+l.h2.text+'」'}`:null,l.h3?`h3 ${l.h3.id?'#'+l.h3.id:'(idなし)「'+l.h3.text+'」'}`:null,
    `${l.element} / ${l.field}`,l.table?`行${l.table.row_index}「${l.table.row_subject}${l.table.row_heading&&l.table.row_heading!==l.table.row_subject?' / '+l.table.row_heading:''}」列${l.table.column_index}「${l.table.column_heading}」`:null,`${l.element==='dependency'?l.file+':':'行'}${l.line??'?'}`,l.element_id?'要素 #'+l.element_id:null].filter(Boolean).join(' · ');
}
function occurrenceLine(o,topic=null) {
  const values=o.values.filter(v=>!topic||v.topics.includes(topic));
  if(topic)return `- \`${o.id}\` ${md(locationText(o))} — ${md([...new Set(values.map(v=>v.value))].join(' / '))}\n`;
  const wanted=new Set(values.map(v=>v.value));
  const excerpts=o.excerpts.filter(e=>e.values.some(v=>wanted.has(v)));
  return `- \`${o.id}\` ${md(locationText(o))}\n  - 値: ${md(values.map(v=>v.value).join(' / '))}\n  - 抜粋: ${md(excerpts.map(e=>e.text).filter((s,i,a)=>a.indexOf(s)===i).join(' / '))}\n`;
}
function topicSection(map,topic) {
  const t=map.topics[topic],c=t.counts;
  let out=`### ${topic}\n\n公開 ${c.public_pages}ページ・${c.public_occurrences}箇所 / 別枠 ${c.excluded_pages}ページ・${c.excluded_occurrences}箇所。次の確認目安: ${t.next.date||'随時・未特定'}（${t.next.status}）— ${t.next.note}\n\n`;
  if(t.primary_urls?.length)out+=`正本: ${t.primary_urls.map(u=>`[一次資料](${u})`).join(' / ')}\n\n`;
  if(t.reference_data?.length)out+=`参照JSON: ${t.reference_data.map(d=>`\`${d.file}\` (${d.year||'年版未指定'}${d.next_review?', next_review='+d.next_review:''})`).join(' / ')}\n\n`;
  for(const visibility of ['public','excluded']) {
    const entries=Object.entries(t.pages).filter(([page])=>map.pages[page].visibility===visibility);
    if(!entries.length)continue;
    out+=visibility==='public'?'#### 公開ページ\n\n':'#### 別枠（.nopublish / noindex、配信自体は続く）\n\n';
    for(const[page,ids]of entries) {
      const p=map.pages[page];out+=`**[${md(page)}](https://keiri-tools.com${page}) — ${md(p.title)} (${ids.length}箇所)**\n\n`;
      for(const id of ids)out+=occurrenceLine(p.occurrences.find(o=>o.id===id),topic);
      out+='\n';
    }
  }return out;
}
function pageSection(map,page) {
  const p=map.pages[page];let out=`### ${page}\n\n${md(p.title)} — ${p.visibility==='public'?'公開':'別枠'}${p.noindex?' / noindex':''}${p.nopublish.length?' / .nopublish':''} (${p.occurrences.length}箇所)\n\n`;
  out+=`テーマ: ${[...new Set(p.occurrences.flatMap(o=>o.topics))].join(' / ')||'なし'}\n\n`;
  if(p.claims_ledger)out+=`既存claims: \`${p.claims_ledger.file}\` (${p.claims_ledger.claim_count}主張)。引用基準日登録: ${p.citation_date_refs.length}件。\n\n`;
  for(const dep of p.dependencies.data)out+=`- 依存: \`${dep.file}\` / **${dep.year||'年版未指定'}** (${dep.year_origin})${dep.coverage?' / 収録範囲 '+dep.coverage.from+'〜'+dep.coverage.through:''}\n`;
  if(p.dependencies.data.length)out+='\n';
  for(const u of p.dependencies.unresolved)out+=`- **未解決依存**: ${md(u.file)} — ${md(u.expression)} (${u.reason})\n`;
  if(p.dependencies.unresolved.length)out+='\n';
  for(const o of p.occurrences)out+=occurrenceLine(o);return out+'\n';
}
export function renderMarkdown(map,{topic=null,page=null}={}) {
  if(topic){if(!map.topics[topic])throw Error('未知のテーマ: '+topic);return `# 更新マップ: ${topic}\n\n生成基準日 ${map.generated_on_jst} JST。抽出・分類の候補であり、数値の正誤・修正要否は判定しません。\n\n`+topicSection(map,topic);}
  if(page){if(!map.pages[page])throw Error('未知のページ: '+page);return '# 更新マップ: '+page+'\n\n'+pageSection(map,page);}
  const order=Object.keys(map.topics).sort((a,b)=>(map.topics[a].next.date||'9999').localeCompare(map.topics[b].next.date||'9999')||a.localeCompare(b,'ja'));
  const s=map.summary,c=s.coverage;
  let out=`# 更新マップ（非公開の生成物）\n\n生成基準日: ${map.generated_on_jst} JST。${s.public_pages}公開ページ + ${s.excluded_pages}別枠、${s.topics}テーマ + 未分類、${s.occurrences}箇所。本文の正誤・新旧・修正要否は判定しません。\n\n`;
  out+='## テーマ別の逆引き（次の確認・改定目安が近い順）\n\n| テーマ | 公開ページ | 公開箇所 | 別枠ページ / 箇所 | 次の確認目安 |\n|---|---:|---:|---:|---|\n';
  for(const name of order){const t=map.topics[name];out+=`| ${name} | ${t.counts.public_pages} | ${t.counts.public_occurrences} | ${t.counts.excluded_pages} / ${t.counts.excluded_occurrences} | ${t.next.date||'随時・未特定'}: ${md(t.next.note)} |\n`;}
  out+='\n## 使い方・読み方\n\n```sh\nnode tools/gen_update_map.mjs\nnode tools/gen_update_map.mjs --topic 協会けんぽ料率\nnode tools/gen_update_map.mjs --page /column/hyojun-hoshu-gakuhyo/\nnode tests/test_update_map.mjs\n```\n\n';
  out+='通常はJSONとこのMarkdownを再生成します。絞り込みは**現在の本文から再抽出して標準出力だけ**に出し、保存済み台帳を書き換えません。司令塔が毎朝再生成してください。新しいJSONは既存テーマのreference_jsonを足し、制度の語はpatternへ追加します。\n\n';
  out+='箇所数は要素×フィールド単位。同じ値が本文・FAQ・metaにあれば別箇所です。複数テーマに属する箇所は逆引きに重複するためテーマ合計は全箇所数になりません。JSONのpagesは詳細箇所、occurrences[].location_refは同ページのlocationsへ、locationsのh2_ref/h3_refは同ページのheadingsへ、topics[name].pagesはpage→箇所IDの参照（pagesで解決）です。location.selectorは一意なCSSパス、表には主語セル・列見出し・行列番号を付けます。見出しにidが無ければ捏造せずnullとselectorを残します。JS文字列は実行せず候補として記録、JSON-LDはgenerated_copyとして別箇所です。\n\n';
  out+='正本URL・年版監視は既存source_year_registry、source_registry、引用日はcitation_date_registry、主張の根拠はclaims、データ年版はJSONの宣言を再利用しています。テーマ辞書の季節は重点確認の**提案目安**で、確定公表日ではありません。元のcoversや適用期間を更新しません。next_reviewが過ぎた参照データは本日要確認として先頭側に置きます。\n\n';
  out+='このテストをpublish_article.sh・pub.shに追加しません。保存済み台帳の鮮度・分類率で公開を止めません。全件テストのglobで実行されても、このテストが見るのは抽出器のfixtureと現本文であり、生成物の鮮度は検査しません。\n\n';
  for(const name of order)out+=topicSection(map,name);
  out+='## ページ別\n\n';for(const visibility of ['public','excluded']) {out+=visibility==='public'?'### 公開ページ\n\n':'### 別枠（.nopublish / noindex）\n\n';for(const p of Object.values(map.pages).filter(p=>p.visibility===visibility))out+=pageSection(map,p.page);}
  out+='## 抽出の取りこぼし・未分類（分母を残す）\n\n';
  out+=`全HTML（別枠含む）の明示的な%・円・万円等: **${c.classified}/${c.total} = ${c.classification_rate}%分類**、未分類 ${c.unclassified}出現、構造抽出で不足 ${c.missed_count}出現。公開ページのみ: ${s.public_coverage.classified}/${s.public_coverage.total} = ${s.public_coverage.classification_rate}%。JS内の金額・率候補 ${c.script_numeric_candidates}出現は静的可視本文の分母に加えません。\n\n`;
  out+='分母は要素抽出とは別にDOM全体のテキストを走査し、title・description・OG/Twitter・aria-label・placeholderも数えます。同じ値の反復を集合にしません。JSON-LDの写し・JS候補・参照JSON内部の全数値・単位のない表セルはこの分母に含めません。CSS座標・URL・コメントは対象外です。**分類率は抽出の意味的な網羅性や分類の正しさの保証ではありません。**\n\n| 未分類の値 | 頻度 | ページ例（最大3件） |\n|---|---:|---|\n';
  for(const r of c.unclassified_top)out+=`| ${md(r.value)} | ${r.count} | ${r.pages.slice(0,3).join(' / ')} |\n`;
  out+='\n### 構造抽出の不足\n\n';out+=c.missed.length?c.missed.map(m=>`- ${m.page}: ${m.value} × ${m.count}\n`).join(''):'独立DOM走査の値別出現数と要素抽出の間に不足はありません。\n';
  const unresolved=Object.values(map.pages).flatMap(p=>p.dependencies.unresolved.map(u=>({page:p.page,...u})));
  out+=`\n### 既知の限界\n\n- 時期に依存しない設例・沿革・ゼロ円も候補に残ります。更新するかは正本を読んで決めます。\n- 語・表見出し・近隣見出し・ページタイトルによる分類は推定です。局所に複数制度があれば複数テーマに入り、語のない別制度の値がタイトルのテーマに寄ることがあります。\n- 表の単位なし数字は列見出しつきの推定候補（table_number / inferred_grade）です。JSの計算式・裸の定数、漢数字だけの年齢・日数、画像の文字、実行後だけ出る数字は完全には拾えません。\n- JSは文字列候補と静的importの追跡で、コードを実行しません。複雑なテンプレート・文字列連結・正規表現中の引用符は解釈できない場合があります。未解決依存 ${unresolved.length}件は下に残します。\n- selectorと行番号は本文の編集で変わります。保存済み箇所IDを恒久的な主張IDとして使わず、作業前に再生成します。\n- .nopublish/noindexは検索・一覧の別枠で、アクセス制限ではありません。\n\n`;
  for(const u of unresolved)out+=`- ${u.page} · ${md(u.file)}: ${md(u.expression)} (${u.reason})\n`;
  return out;
}
// Intern repeated headings and discard the duplicate full element text; excerpts retain every value.
export function serializeUpdateMap(map) {
  const pages={};
  for(const [page,p] of Object.entries(map.pages)) {
    const headings={},locations={};
    for(const [key,l] of Object.entries(p.locations)) {
      const {h2,h3,...rest}=l;
      const ref=h=>{if(!h)return null;const id='h-'+digest(h.selector).slice(0,16);headings[id]=h;return id;};
      locations[key]={...rest,h2_ref:ref(h2),h3_ref:ref(h3)};
    }
    pages[page]={...p,locations,headings,occurrences:p.occurrences.map(({location,text,...o})=>o)};
  }
  return {...map,pages};
}
export function main(args=process.argv.slice(2)) {
  let topic=null,page=null,out=join(ROOT,'maintenance');for(let i=0;i<args.length;i++) {
    if(args[i]==='--out')out=resolve(args[++i]);else if(args[i]==='--topic')topic=args[++i];else if(args[i]==='--page')page=args[++i];else if(args[i]==='--help'){console.log('node tools/gen_update_map.mjs [--out 出力先(既定 maintenance/・git管理外)] [--topic テーマ | --page /column/xxx/]');return;}else throw Error('未知のオプション: '+args[i]);
    if((args[i-1]==='--topic'&&!topic)||(args[i-1]==='--page'&&!page))throw Error('オプションの値が必要です');
  }
  if(topic&&page)throw Error('--topic と --page は同時に指定できません');
  const map=buildUpdateMap({onlyPage:page});const markdown=renderMarkdown(map,{topic,page});
  if(topic||page){process.stdout.write(markdown);return;}
  mkdirSync(out,{recursive:true});
  writeFileSync(join(out,'update_map.json'),JSON.stringify(serializeUpdateMap(map))+'\n');
  writeFileSync(join(out,'UPDATE_MAP.md'),markdown);
  console.log(`更新マップ: ${map.summary.pages}ページ / ${map.summary.topics}テーマ / ${map.summary.occurrences}箇所 / 分類率 ${map.summary.coverage.classification_rate}% (${map.summary.coverage.classified}/${map.summary.coverage.total})`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {try{main();}catch(e){console.error(e.stack);process.exitCode=1;}}
