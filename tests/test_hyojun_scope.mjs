// Protect independent grade/amount reconciliation and the context each published cell carries.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {segmentClaims} from '../tools/segment_claims.mjs';
const path='docs/column/hyojun-hoshu-gakuhyo/index.html';
const units=segmentClaims(readFileSync(path,'utf8'),path);
const money=units.filter(u=>u.kind==='td'&&u.text.includes('本人負担月額'));
assert.equal(money.length,250);
for(const u of money){assert.match(u.text,/東京支部の一般被保険者/);assert.match(u.text,/給与控除・特約なし：50銭以下切捨、50銭超切上/);if(u.text.includes('健保＋介護'))assert.match(u.text,/区域内.*40歳以上65歳未満.*医療保険加入者/);if(u.text.includes('厚生年金（条件）')||u.text.includes('合計（39歳以下）'))assert.match(u.text,/厚生年金基金未加入/);if(u.text.includes('子ども支援金')||u.text.includes('合計（39歳以下）'))assert.match(u.text,/2026年4月分から/);}
assert.equal(units.filter(u=>u.text.includes('【値】635,000 〜 665,000（厚年は635,000円以上）')).length,1);
execFileSync('node',['review-evidence/auto20261008-t3x-q08381/verify.mjs'],{stdio:'pipe'});
const deposit=readFileSync('docs/column/azukarikin/index.html','utf8');assert.match(deposit,/2026年3月分[^。]*42,225円/);assert.match(deposit,/58,545円/);assert.match(deposit,/76,545円/);
console.log('✓ 全50等級の公表料率との独立照合・250セルの対象条件・3月支援金開始前の設例');
