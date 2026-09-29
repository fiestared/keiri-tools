import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {segmentClaims,validateSegments} from '../tools/segment_claims.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/high_quotes.json',import.meta.url)));
let n=0;
for(const f of fixtures){
 const units=segmentClaims(f.html,f.page);assert.ok(units.length,`${f.id}: historical HTML must have a review unit`);
 const ledger={claims:[{id:'review-fixture',covers:units.map(u=>u.id)}]};
 assert.deepEqual(validateSegments(units,ledger).errors,[]); // baseline is a mapping fixture, not a correctness claim
 ledger.claims[0].covers.shift();assert.ok(validateSegments(units,ledger).errors.length);n++;
}
console.log(`historical r11 HTML: ${n}/${fixtures.length} enumerated; missing mapping rejected (not semantic redetection)`);
