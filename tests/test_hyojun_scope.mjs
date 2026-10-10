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
assert.equal(units.filter(u=>u.text.includes('【値】83,000 〜 93,000（厚年は93,000円未満）')).length,1);
assert.equal(units.filter(u=>u.text.includes('【値】635,000 〜 665,000（厚年は635,000円以上）')).length,1);
execFileSync('node',['review-evidence/auto20261008-t3x-q08381/verify.mjs'],{stdio:'pipe'});
// 預り金の記事の3月分の設例（42,225円・58,545円・76,545円）は統合で見送った: main が 10-08 の書き直し（rg24）で設例を令和8年6月支給・9月決算に替えており、3月分の設例そのものが無い。
console.log('✓ 全50等級の公表料率との独立照合・250セルの対象条件');
