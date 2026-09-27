/** Presentation-only source patches: do not reserialize article text or URLs.
 * Run after content/related generators; --check is part of run_tests.sh.
 */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function foldLongRelated(source){
 return source.replace(/(<section class="next-read"[^>]*><h2>次に読む<\/h2><div class="tool-grid">)([\s\S]*?)(<\/div><\/section>)/g,(all,start,body,end)=>{
  if(body.includes('next-read-more'))return all;
  const cards=body.match(/<a\b[^>]*class="tool-card"[^>]*>[\s\S]*?<\/a>/g)||[];
  if(cards.length<=3||cards.join('')!==body)return all;
  return start+cards.slice(0,3).join('')+'</div><details class="next-read-more"><summary>ほかの関連記事（'+(cards.length-3)+'件）</summary><div class="tool-grid">'+cards.slice(3).join('')+'</div></details></section>';
 });
}
export function hideDuplicateFooterNotes(source){
 return source.replace(/<footer\b[\s\S]*?<\/footer>/g,footer=>{
  const blocks=[...footer.matchAll(/<div\b([^>]*)>((?:(?!<\/?div\b)[\s\S])*?)<\/div>/g)],seen=new Set();
  // Keep the last copy, including the canonical x-link:auto generated block.
  for(const m of blocks.reverse()){
   const key=m[2].replace(/\s+/g,' ').trim();if(!key)continue;
   if(seen.has(key)&&!m[1].includes('data-duplicate-note'))footer=footer.slice(0,m.index)+m[0].replace('<div','<div data-duplicate-note hidden')+footer.slice(m.index+m[0].length);
   seen.add(key);
  }
  return footer;
 });
}
export function articleBeforeRail(source){
 // Only the flat article introduction is moved before an existing leading rail.
 // Do not reparent a rail into a nested section or change any text/link.
 return source.replace(/(<article\b[^>]*>\s*)(<!--rail-next:wrap-->[\s\S]*?<!--rail-next:wrapE-->)([\s\S]*?)(?=<h2\b)/g,(all,start,rail,intro)=>{
  if(!/^\s*<h1\b/.test(intro)||/<(?:section|div|nav|aside)\b/.test(intro))return all;
  return start+intro+rail+'\n';
 });
}
export function toolBeforeRail(source){
 if(!/_core\.js/.test(source))return source;
 const main=source.indexOf('<main'),rail=source.indexOf('<!--rail-next:wrap-->'),endMarker='<!--rail-next:wrapE-->';
 if(main<0||rail<main)return source;
 const marker=source.indexOf(endMarker,rail);if(marker<0)return source;const end=marker+endMarker.length;
 const card=source.indexOf('<div class="card">',main);if(card<end||card>source.indexOf('</main>',main))return source;
 const tags=/<div\b[^>]*>|<\/div>/g;tags.lastIndex=card;let depth=0,match;
 while(match=tags.exec(source)){depth+=match[0].startsWith('</')?-1:1;if(depth===0){const finish=tags.lastIndex;return source.slice(0,rail)+source.slice(end,finish)+'\n'+source.slice(rail,end)+source.slice(finish);}}
 return source;
}
export function withPresentationScript(source){
 const stylesheet=source.match(/<link\b[^>]*href="([^"]*)assets\/(?:style|embed-layout)\.css[^>]*>/);
 return stylesheet&&!/src="[^"]*assets\/empty-state\.js"/.test(source)?source.replace('</body>','<script src="'+stylesheet[1]+'assets/empty-state.js" defer></script>\n</body>'):source;
}
export function presentationMarkup(source,{skipScript=false}={}){
 let result=source.replace(/<section\b[^>]*class="related"[^>]*>\s*(?:<h[23]\b[^>]*>[^<]*<\/h[23]>\s*)?<\/section>/g,'');
 result=result.replace(/(<(?:div|p|section)\b[^>]*(?:class="[^"]*\b(?:note|warn|result)\b[^"]*"|role="(?:alert|status)")[^>]*>)\s+(<\/(?:div|p|section)>)/g,'$1$2');
 result=result.replace(/(<nav\b[^>]*class=")([^"]*\bbreadcrumb\b[^"]*)("[^>]*>)([\s\S]*?)(<\/nav>)/g,(all,start,classes,end,body,close)=>{
  if(classes.includes('breadcrumb-needs-separator'))return all;
  const pos=body.lastIndexOf('</a>');if(pos<0)return all;
  const tail=body.slice(pos+4).replace(/<[^>]+>/g,'');
  if(!tail.trim()||/^\s*[›»>/]/.test(tail))return all;
  return start+classes+' breadcrumb-needs-separator'+end+body+close;
 });
 result=result.replace(/<button\b(?=[^>]*\bid="calc")(?=[^>]*>)([^>]*)>/g,(all,attrs)=>/\bclass=/.test(attrs)?all:'<button'+attrs+' class="primary">');
 result=result.replace(/<a\b[^>]*style="color:#a8641b;font-weight:700"[^>]*>/g,tag=>{
  tag=tag.replace(/ style="color:#a8641b;font-weight:700"/,'');
  return /\bclass="/.test(tag)?tag.replace(/class="([^"]*)"/,'class="$1 warning-link"'):tag.replace(/>$/,' class="warning-link">');
 });
 if(!skipScript)result=withPresentationScript(result);
 result=result.replace(/<!--next-read:S-->[\s\S]*?<!--next-read:E-->/g,block=>block.replace(/(<(?:b|span)\b[^>]*>)([^<]*)(<\/(?:b|span)>)/g,(all,start,text,end)=>start+text.replace(/&amp;(amp|quot|lt|gt|#\d+|#x[\da-f]+);/gi,'&$1;')+end));
 return hideDuplicateFooterNotes(articleBeforeRail(toolBeforeRail(foldLongRelated(result))));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../docs/',import.meta.url)),check=process.argv.includes('--check');const changed=[];
 for(const f of readdirSync(root,{recursive:true}).filter(f=>f==='index.html'||f.endsWith('/index.html'))){
  // The commander owns these TOCs: only wire the shared display controller;
  // never change their existing layout or navigation markup here.
  const scriptOnly=/^(shiharai-site|eigyobi|nenshu)\/index.html$/.test(f);
  const s=readFileSync(root+f,'utf8'),r=scriptOnly?withPresentationScript(s):presentationMarkup(s);if(s!==r){changed.push(f);if(!check)writeFileSync(root+f,r);}
 }
 console.log(`${check?'stale':'updated'} presentation markup: ${changed.length}`);if(check&&changed.length){console.error(changed.join('\n'));process.exitCode=1;}
}
