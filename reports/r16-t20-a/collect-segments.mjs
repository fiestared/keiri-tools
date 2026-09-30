import fs from 'node:fs';
import {segmentClaims} from '../../tools/segment_claims.mjs';
import {claimText,findNumbers,findAbsolutes} from '../../tools/check_claims.mjs';
const edits=JSON.parse(fs.readFileSync('reports/r16-t20-a/edits.json'));
const units=[],meta={units:{},pages:{}};
for(const page of new Set(edits.map(e=>e.page))){const html=fs.readFileSync(page,'utf8'),s=segmentClaims(html,page);units.push(...s);for(const u of s)meta.units[page+'#'+u.id]=[...findNumbers(u.text)];meta.pages[page]={numbers:[...findNumbers(claimText(html))],absolutes:findAbsolutes(claimText(html))};}
fs.writeFileSync('reports/r16-t20-a/segments-after.json',JSON.stringify(units,null,2)+'\n');fs.writeFileSync('reports/r16-t20-a/number-meta.json',JSON.stringify(meta,null,2)+'\n');
