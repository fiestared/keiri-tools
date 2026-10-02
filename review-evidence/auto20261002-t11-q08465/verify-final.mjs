import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const e=new URL('./',import.meta.url),p='docs/column/shogaku-genka-shokyaku/index.html';
const before=JSON.parse(readFileSync(new URL('segments.json',e))), ledger=JSON.parse(readFileSync('claims/column/shogaku-genka-shokyaku.json'));
const units=segmentClaims(readFileSync(p,'utf8'),p),c=validateSegments(units,ledger);
const oc=new Set(ledger.out_of_corpus.map(x=>x.id));
assert.equal(oc.size,8);assert.deepEqual(new Set(c.unprocessed_ids),oc);
assert.equal(c.errors.length,8);assert.ok(c.errors.every(x=>x.startsWith('unprocessed segment:')));
for(const id of oc){assert.equal(units.find(u=>u.id===id).text_hash,before.find(u=>u.id===id).text_hash);assert.ok(ledger.out_of_corpus.find(u=>u.id===id).needed_source);assert.ok(!ledger.verified.some(u=>u.id===id));}
for(const [file,hash] of Object.entries(JSON.parse(readFileSync(new URL('final-content-hashes.json',e))))) assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,file);
writeFileSync(new URL('coverage-ledger-after.json',e),JSON.stringify(c,null,2)+'\n');
writeFileSync(new URL('segments-after.json',e),JSON.stringify(units,null,2)+'\n');
console.log(JSON.stringify({total:c.total,covered:c.covered,verified:c.verified,nonclaims:c.nonclaims,unprocessed:c.unprocessed,oc_unchanged:true,content_hashes_unchanged:true}));
