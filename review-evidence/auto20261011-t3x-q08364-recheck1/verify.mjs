import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const page='docs/column/hyojun-hoshu-gakuhyo/index.html';
const units=segmentClaims(readFileSync(page,'utf8'),page), ledger=JSON.parse(readFileSync('claims/column/hyojun-hoshu-gakuhyo.json'));
const c=validateSegments(units,ledger);
assert.equal(c.total,541);assert.equal(c.verified,346);assert.equal(c.unprocessed,6);
const table=units.filter(u=>u.kind==='td'&& /【列】健康保険・支援金の/.test(u.text));assert.equal(table.length,100);
assert(units.some(u=>u.kind==='th'&&u.text.includes('健保1〜4級の行は厚年88,000円、健保35〜50級の行は厚年650,000円')));
const prose=units.filter(u=>u.text.startsWith('定時決定では') || u.text.startsWith('算定期間中に区分変更がない特定・任意特定適用事業所'));
assert.equal(prose.length,3);
for(const u of prose){assert.match(u.text,/一時帰休/);assert.match(u.text,/低額休職給/);assert.match(u.text,/遅配/);assert.match(u.text,/7月/);}
for(const o of ledger.out_of_corpus){assert(o.needed_source);assert(!ledger.verified.some(v=>v.id===o.id));}
assert(c.unprocessed_ids.every(id=>ledger.out_of_corpus.some(o=>o.id===id)));
console.log('✓ 健保100セル・厚年上下限・本文FAQ3単位の除外条件・正本外の未確認保持');
