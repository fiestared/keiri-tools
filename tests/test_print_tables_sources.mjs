// Name the source list and the SVG attribute; prose elsewhere cannot satisfy these checks.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;}catch(e){failed++;console.error('FAIL',name,e.message);}}
for(const page of ['inshi','column/koyou-hokenryo-ritsu','column/rosai-hokenryoritsu']){
 const html=readFileSync(new URL(`../docs/${page}/index.html`,import.meta.url),'utf8');
 const list=html.match(/<h2[^>]*>出典<\/h2>[\s\S]*?<ul>([\s\S]*?)<\/ul>/)[1];
 for(const [i,item] of [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].entries())test(`${page} source ${i}`,()=>assert.match(item[1],/<a href="https:\/\//));
}
const rosai=readFileSync(new URL('../docs/column/rosai-hokenryoritsu/index.html',import.meta.url),'utf8');
test('R8 leaflet links to the exact MHLW document, not a different annual-renewal guide',()=>{
 assert.equal(rosai.match(/<a href="([^"]+)">事業主向けリーフレット/)[1],'https://www.mhlw.go.jp/content/roumuhiritu_r05.pdf');
});
test('merit SVG alt describes limited base and logging exception',()=>{
 const label=rosai.match(/<svg[^>]+aria-label="(メリット制。[^"]+)"/)[1];
 assert.match(label,/非業務災害率を除く部分/);assert.match(label,/立木伐採以外.*40%/);assert.match(label,/立木伐採.*35%/);
});
test('Excel has current-year authority and actual hyperlink',()=>execFileSync('python3',['-c',String.raw`
from zipfile import ZipFile
from pathlib import Path
import xml.etree.ElementTree as E
import json
m=json.loads(Path('docs/assets/rosai_rates_r08.json').read_text())['_meta']
with ZipFile('docs/column/rosai-hokenryoritsu/rosai-table.xlsx') as z:
 s=z.read('xl/worksheets/sheet1.xml').decode();r=z.read('xl/worksheets/_rels/sheet1.xml.rels').decode()
 assert m['current_url'] in s and m['current_url'] in r
 assert '令和8年度の据え置きの案内' in s
`],{cwd:new URL('../',import.meta.url),stdio:'pipe'}));
console.log(`print-table sources: ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
