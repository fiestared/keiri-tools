// Reproduce the word/character counts from the archived e-Gov API responses.
import fs from 'node:fs';
import assert from 'node:assert/strict';
function* nodes(n){if(typeof n==='string')return;yield n;for(const c of n.children||[])yield* nodes(c);}
function text(n){return typeof n==='string'?n:(n.children||[]).map(text).join('');}
const expected=JSON.parse(fs.readFileSync(new URL('./law-counts.json',import.meta.url)));
for(const e of expected){
 const id=e.url.split('/').at(-1),d=JSON.parse(fs.readFileSync(new URL(`./${id}.json`,import.meta.url)));
 const main=[...nodes(d.law_full_text)].find(n=>n.tag==='MainProvision'),s=text(main);
 assert.equal([...s.replace(/\s+/gu,'')].length,e.characters_without_whitespace);
 for(const [word,n] of Object.entries(e.counts))assert.equal(s.split(word).length-1,n);
 const articles=Object.fromEntries([...nodes(main)].filter(n=>n.tag==='Article'&&text(n).includes('休暇')).map(n=>[n.attr.Num,text(n).split('休暇').length-1]));
 assert.deepEqual(articles,e.articles);
 console.log(`${id}: ${e.characters_without_whitespace} characters; 休暇=${e.counts['休暇']}; articles=${Object.values(articles).reduce((a,b)=>a+b,0)}`);
}
