import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
import {ledgerPath} from '../../tools/check_claims.mjs';
const dir='review/r16-t3-a/';const read=p=>JSON.parse(readFileSync(p));
const stats=read(dir+'coverage-stats.json');const final=[];
for(const row of stats){const units=segmentClaims(readFileSync(row.page,'utf8'),row.page);const ledger=read(ledgerPath(row.page));const c=validateSegments(units,ledger);assert.deepEqual(c.errors.filter(e=>!e.startsWith('unprocessed')),[]);for(const key of ['total','covered','verified','nonclaims','unprocessed'])assert.equal(c[key],row.after[key],row.page+' '+key);for(const item of ledger.out_of_corpus)assert.ok(item.needed_source,item.id);final.push({page:row.page,total:c.total,covered:c.covered,verified:c.verified,nonclaims:c.nonclaims,unprocessed:c.unprocessed,structural_errors:0});}
const expected=read(dir+'input-sha256.json');for(const [file,hash]of Object.entries(expected))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,'read-only input changed: '+file);
const units=read(dir+'segments-after.json');const dispositions=read(dir+'dispositions.json');assert.equal(dispositions.length,73);for(const d of dispositions)for(const id of d.replacement_block_ids)assert.ok(units.some(u=>u.page===d.page&&u.id===id),'missing replacement '+d.index);
writeFileSync(dir+'audit-final.json',JSON.stringify({coverage:final,read_only_inputs_checked:Object.keys(expected).length,dispositions:dispositions.length},null,2)+'\n');console.log('Four ledgers structurally valid, coverage counts reproduced, 73 disposition links and '+Object.keys(expected).length+' read-only inputs verified');
