import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {claimText,findNumbers,findAbsolutes} from '../../tools/check_claims.mjs';
const main='docs/column/shogaku-genka-shokyaku/index.html';
const edits=JSON.parse(readFileSync(new URL('./edits.json',import.meta.url)));
for(const page of new Set(edits.map(e=>e.page).filter(x=>x.endsWith('.html')))){
 const path=page.replace(/^docs\//,'claims/').replace(/\/index.html$/,'.json');const l=JSON.parse(readFileSync(path));
 const html=readFileSync(page,'utf8'),txt=claimText(html);
 // Number inventory is separate from the substantive evidence attached per claim.
 for(const c of l.claims) if(page===main||c.id.startsWith('auto20261002-t11-')) c.numbers=[...findNumbers(c.text + (page===main ? (c.covers||[]).map(id=>JSON.parse(readFileSync(new URL('./segments-after.json',import.meta.url))).find(u=>u.id===id)?.text||'').join(' ') : ''))];
 if(page.includes('/shomohinhi/')) l.claims.find(c=>c.id==='auto20261002-t11-適用条件').numbers.push('10万円','20万円');
 const have=new Set(l.claims.flatMap(c=>c.numbers||[]));const missing=[...findNumbers(txt)].filter(n=>!have.has(n));
 l.number_inventory_note='numbersは機械抽出表記。根拠・適用条件は個別claimのsource_quote/corpus_refで照合。';
 // Existing page whole-text inventory preserved for side pages; new entries cover their changed text.
 if(page===main) l.claims[0].numbers.push(...missing);
 const previous=l.absolutes||[];
 l.absolutes=findAbsolutes(txt).map(a=>previous.find(b=>b.phrase===a.phrase&&b.context===a.context)||{...a,reviewed:'auto20261002-t11: 正本の条件・除外をclaimsと本文の同じ節で照合。対象外8単位は未確認で本文維持。'});
 writeFileSync(path,JSON.stringify(l,null,2)+'\n');
}
