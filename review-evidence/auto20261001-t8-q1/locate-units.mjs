import {readFileSync,writeFileSync} from 'node:fs';
const dir='review-evidence/auto20261001-t8-q1/';
const source=readFileSync('tools/segment_claims.mjs','utf8').replace('for (const part of parts) {','for (const [partIndex,part] of parts.entries()) {').replace('units.push({id:',`units.push({ locator: (()=>{let p=el,s=[];while(p?.localName){const n=[...p.parentNode.children].filter(x=>x.localName===p.localName).indexOf(p);s.unshift(p.localName+':'+(p.localName==='tr'?p.children[0]?.textContent.trim():n));p=p.parentElement;}return s.join('/');})(), partIndex, id:`);
writeFileSync(dir+'segment-located.mjs',source);
const {segmentClaims}=await import('./segment-located.mjs');
for(const slug of ['furikomi-tesuryo-hikaku','zengin-format-guide']){
 const page=`docs/column/${slug}/index.html`;
 const before=segmentClaims(readFileSync(dir+slug+'-before.html','utf8'),page);
 writeFileSync(dir+slug+'-located-before.json',JSON.stringify(before,null,2));
}
