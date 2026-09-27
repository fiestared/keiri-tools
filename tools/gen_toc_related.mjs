/** Shared static related links for every public TOC. No body reserialization. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import {posix} from 'node:path';
const ROOT=fileURLToPath(new URL('../docs/',import.meta.url));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export const clean=html=>html.replace(/<!--rail-next:S-->[\s\S]*?<!--rail-next:E-->/g,'').replace('<!--rail-next:wrap--><div class="side-rail" data-nav-exp="wrap">','').replace('</div><!--rail-next:wrapE-->','').replace(/<!--nav-exp:toc-script S-->[\s\S]*?<!--nav-exp:toc-script E-->\n?/g,'');
const grams=s=>{const a=s.replace(/シミュレーター|シミュレーション|計算ツール|計算機|わかりやすく|計算方法|とは|令和/g,'').replace(/[\s\p{P}\p{S}0-9０-９]/gu,'');return new Set(Array.from({length:Math.max(0,a.length-1)},(_,i)=>a.slice(i,i+2)));};
export function catalog(root=ROOT){
 const pages=new Map();
 for(const f of readdirSync(root,{recursive:true}).filter(f=>f.endsWith('/index.html')).sort()){
  if(f.split('/').some(p=>p.startsWith('_')||p.endsWith('.nopublish'))||f.startsWith('embed/'))continue;
  const html=readFileSync(root+f,'utf8');
  if(/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html))continue;
  const dom=new JSDOM(clean(html),{includeNodeLocations:true});const d=dom.window.document;
  if(/noindex/i.test(d.querySelector('meta[name=robots]')?.content||'')){dom.window.close();continue;}
  const title=d.querySelector('h1')?.textContent.trim();
  if(!title){dom.window.close();continue;}
  const path='/'+f.replace(/index.html$/,'');
  const desc=d.querySelector('meta[name="description"]')?.content||'';
  const toc=d.querySelector('nav.toc');
  const handmade=[...d.querySelectorAll('section.related a[href],.rel-block a[href]')].map(l=>l.getAttribute('href'));
  const body=[...d.querySelectorAll('article a[href],main a[href]')].filter(l=>!l.closest('nav,.related,.rel-block,.next-read,.pr-block,footer,.domain-bridge,.domain-nav,.toolbox-panel')).map(l=>l.getAttribute('href'));
  pages.set(path,{file:root+f,html,title,desc,toc:!!toc,tool:[...d.scripts].some(s=>/_core\.js/.test(s.textContent)),titleGrams:grams(title),grams:grams(title+' '+desc),handmade,body,loc:toc&&dom.nodeLocation(toc),inRail:toc?.parentElement.classList.contains('side-rail'),pr:!!toc?.parentElement.querySelector('.pr-block')});
  dom.window.close();
 }
 return pages;
}
export function generate(pages){
 const hubs=new Set(['/column/','/hojokin/','/hojokin/koyou/','/hojokin/schedule/','/toushi/']);
 const candidates=[...pages].filter(([p,a])=>!hubs.has(p)&&(a.toc||a.tool||p.startsWith('/column/')));
 const pins=JSON.parse(readFileSync(new URL('./toc_related_pins.json',import.meta.url),'utf8'));
 for(const [path,pin]of Object.entries(pins)){
  if(!pages.has(path)||!pin.reason||pin.paths.length<2||pin.paths.length>3||new Set(pin.paths).size!==pin.paths.length||pin.paths.some(p=>p===path||!candidates.some(([key])=>key===p)))throw Error('Invalid editorial related paths: '+path);
 }
 const df=new Map();for(const [,a]of candidates)for(const g of a.grams)df.set(g,(df.get(g)||0)+1);
 const weight=g=>(Math.log((candidates.length+1)/((df.get(g)||0)+1)))**2;
 const norm=g=>Math.sqrt([...g].reduce((s,g)=>s+weight(g),0))||1;
 const norms=new Map(candidates.map(([,a])=>[a,norm(a.grams)]));
 const cosine=(a,b)=>[...a].reduce((s,g)=>s+(b.has(g)?weight(g):0),0)/(norm(a)*norm(b));
 const score=(a,b)=>0.75*cosine(a.titleGrams,b.titleGrams)+0.25*[...a.grams].reduce((s,g)=>s+(b.grams.has(g)?weight(g):0),0)/((norms.get(a)||norm(a.grams))*norms.get(b));
 const output=[];
 for(const [path,a]of pages){
  if(!a.toc)continue;

  const resolve=href=>{try{const u=new URL(href,'https://keiri-tools.com'+path);return u.origin==='https://keiri-tools.com'&&u.pathname!==path&&pages.has(u.pathname)&&candidates.some(([p])=>p===u.pathname)?u.pathname:null;}catch{return null;}};
  const picks=[];const sources=[];
  const add=(p,source)=>{if(p&&!picks.includes(p)&&picks.length<3){picks.push(p);sources.push(source);}};
  for(const href of a.handmade)add(resolve(href),'handmade');
  for(const href of a.body)add(resolve(href),'body');
  if(picks.length<2)for(const p of pins[path]?.paths||[])add(p,'editorial');
  // Two contextual links are sufficient: never force a weak third recommendation.
  if(picks.length<2)for(const [p]of candidates.filter(([p])=>p!==path).sort((x,y)=>score(a,y[1])-score(a,x[1])||x[0].localeCompare(y[0]))){add(p,'weighted-2gram');if(picks.length>=2)break;}
  if(a.pr){picks.splice(2);sources.splice(2);}
  if(picks.length<2)throw Error(path+': fewer than two related links');
  const title=p=>pages.get(p).title.split(/\s+[—–―]\s+|｜|【/)[0].trim();
  const href=p=>{const r=posix.relative(path,p);return (r||'.')+'/';};
  const block='<!--rail-next:S--><section class="rail-next" data-workflow-slot="toc_related_v1" aria-labelledby="rail-next-h"><div class="rail-next-title" id="rail-next-h">あわせて読む</div><ul>'+picks.map(p=>'<li><a href="'+esc(href(p))+'">'+esc(title(p))+'</a></li>').join('')+'</ul></section><!--rail-next:E-->';
  let html=clean(a.html);const loc=a.loc;let start=loc.startOffset,end=loc.endOffset;
  if(html.slice(0,start).endsWith('<!--layout-toc:start-->'))start-='<!--layout-toc:start-->'.length;
  if(html.slice(end).startsWith('<!--layout-toc:end-->'))end+='<!--layout-toc:end-->'.length;
  if(a.inRail)html=html.slice(0,end)+block+html.slice(end);
  else html=html.slice(0,start)+'<!--rail-next:wrap--><div class="side-rail" data-nav-exp="wrap">'+html.slice(start,end)+block+'</div><!--rail-next:wrapE-->'+html.slice(end);
  const script='<!--nav-exp:toc-script S--><script src="'+esc(href('/assets').replace(/\/$/,'')+'/toc-rail.js')+'" defer></script><!--nav-exp:toc-script E-->'; 
  html=html.replace('</head>',script+'</head>');
  output.push({path,file:a.file,html,changed:html!==a.html,picks,sources,title:a.title});
 }
 return output;
}
export function run({check=false}={}){
 const pages=catalog();{const rows=generate(pages);const changed=rows.filter(r=>r.changed);if(!check)for(const r of changed)writeFileSync(r.file,r.html);console.log(`TOC related: ${rows.length} public pages; ${changed.length} ${check?'stale':'updated'}`);if(check&&changed.length)throw Error('Run node tools/gen_toc_related.mjs');return rows;}
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Unknown argument');run({check:process.argv.includes('--check')});}
