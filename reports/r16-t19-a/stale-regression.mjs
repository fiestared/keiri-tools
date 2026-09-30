import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {staleHits} from '../../tests/test_stale_values.mjs';
import {claimText} from '../../tools/check_claims.mjs';
const entries=JSON.parse(fs.readFileSync('tests/stale_values.json')).entries.filter(e=>e.id.startsWith('r16-t19-'));
const pages=['sanzen-sango-kyugyo','sango-papa-ikukyu','sango-papa-ikukyu','roudousha-shishobyo-houkoku'];
const results=entries.map((e,i)=>{const p=`docs/column/${pages[i]}/index.html`,before=staleHits(claimText(execFileSync('git',['show','origin/main:'+p],{encoding:'utf8'})),e,p,'2026-10-01'),after=staleHits(claimText(fs.readFileSync(p,'utf8')),e,p,'2026-10-01');assert(before.length>0,e.id+' old detected');assert.equal(after.length,0,e.id+' corrected clean');return {id:e.id,before:before.length,after:after.length};});
fs.writeFileSync('reports/r16-t19-a/stale-regression.json',JSON.stringify(results,null,2)+'\n');console.log(results);
