import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const data=JSON.parse(readFileSync('tools/data/nenkan_kyujitsu_reference.json','utf8'));
// 厚生労働省2025年調査・第4表の公表値。企業/労働者の列の取り違えも検出する。
assert.deepEqual(data.rows.map(r=>r.slice(1)),[['112.4','116.6'],['117.7','118.9'],['116.2','118.1'],['114.5','115.8'],['111.2','112.4']]);
assert.equal(data.survey_year,2025);assert.equal(data.actual_year,2024);
execFileSync('node',['tools/gen_nenkan_kyujitsu.mjs','--check'],{stdio:'inherit'});
console.log('✓ 年間休日の企業平均・労働者平均と年の対応');
