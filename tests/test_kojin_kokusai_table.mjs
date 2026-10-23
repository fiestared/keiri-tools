import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const d=JSON.parse(readFileSync('tools/data/kojin_kokusai_rates.json','utf8'));
assert.equal(d.rows.length,3);
assert.equal(d.offering_month,'2026-10');
assert.equal(d.issue,'2026-11-16');assert.equal(d.first_end,'2027-05-15');
// 公表表・回号ごとの独立した期待値。表示行と正本を取り違えない。
const oracle=[[199,'2.05','1.6335425',10194,8123],[187,'2.39','1.9044715',11885,9470],[197,'2.07','1.6494795',10293,8202]];
for(let i=0;i<3;i++){
 const r=d.rows[i],e=oracle[i];
 assert.deepEqual([r.issue_no,r.rate,r.after,r.gross,r.net],e);
 const pre=d.principal*Number(r.rate)/100*(0.5-1/365);
 assert.equal(Math.round(pre),r.gross);assert.equal(Math.round(pre*(1-.15315-.05)),r.net);
 assert.ok(Math.abs(Number(r.after)-Number(r.rate)*.79685)<1e-9);
}
execFileSync(process.execPath,['tools/gen_kojin_kokusai_table.mjs','--check'],{stdio:'inherit'});
const h=readFileSync('docs/column/kojin-kokusai-kinri-table/index.html','utf8');
assert.match(h,/未発行期間は1日/);assert.match(h,/表示時に円未満を四捨五入/);assert.match(h,/支払時の端数処理を再現した入金予定額ではありません/);
console.log('公表年率・初回調整・税引後計算 OK');
