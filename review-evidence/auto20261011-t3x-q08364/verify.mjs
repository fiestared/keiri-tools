import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261011/t3x-q08364';
const page='docs/column/hyojun-hoshu-gakuhyo/index.html';
const original=JSON.parse(readFileSync(run+'/segments.json'));const reviewed=JSON.parse(readFileSync(run+'/segment-adjudication.json')).segments;
const html=readFileSync(page,'utf8'), units=segmentClaims(html,page), current=new Map(units.map(u=>[u.id,u]));
const ledger=JSON.parse(readFileSync('claims/column/hyojun-hoshu-gakuhyo.json'));
const premium=units.filter(u=>u.kind==='td'&&u.text.includes('本人負担月額'));assert.equal(premium.length,250);for(const u of premium)assert.match(u.context,/産前産後休業・育児休業等による保険料免除のない/);
for(const u of reviewed.filter(u=>u.decision==='out_of_corpus')){assert.equal(current.get(u.id).text,original.find(o=>o.id===u.id).text);assert(ledger.out_of_corpus.find(o=>o.id===u.id)?.needed_source);assert(!ledger.verified.some(v=>v.id===u.id));}
for(const u of reviewed.filter(u=>u.decision==='unresolved'))assert(!ledger.verified.some(v=>v.id===u.id));
const fixes=JSON.parse(readFileSync(run+'/fix-kinds.json')).fixes;
for(const u of reviewed.filter(u=>u.decision==='unresolved'))assert(fixes.some(f=>f.old_id===u.id),'Unaddressed review ID: '+u.id);
for(const f of fixes){assert(current.has(f.new_id));if(f.old_id)assert(original.some(u=>u.id===f.old_id));}
assert(!html.includes('給与が65万円を超えても'));assert(!html.includes('給与が8.8万円未満でも'));
const report=validateSegments(units,ledger);assert.equal(report.unprocessed,7);assert(report.unprocessed_ids.every(id=>ledger.out_of_corpus.some(u=>u.id===id)));assert(report.errors.every(e=>e.startsWith('unprocessed segment: ')));
writeFileSync('review-evidence/auto20261011-t3x-q08364/after-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log('✓ 250保険料セルの共通条件・210修正対象の全対応・正本外7件の文面維持・台帳整合');
