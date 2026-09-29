import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validatePending,validateTable} from '../tools/condition_tables.mjs';
import {extra} from './conditions/cases.mjs';
const root=new URL('../',import.meta.url),dir=new URL('./conditions/',import.meta.url);
const status=JSON.parse(readFileSync(new URL('_status.json',dir)));
const registered=readdirSync(dir).filter(f=>f.endsWith('_core.json')).map(f=>f.slice(0,-5));
const cores=readdirSync(new URL('docs/assets/',root)).filter(f=>f.endsWith('_core.js')).map(f=>f.slice(0,-3));
// Fixed rollout cohort is history-backed; a new core cannot be added to pending.
const baseline=execFileSync('git',['ls-tree','--name-only','6c1885fb:docs/assets'],{cwd:root,encoding:'utf8'}).split('\n').filter(f=>f.endsWith('_core.js')).map(f=>f.slice(0,-3));
let previous=baseline.filter(c=>!['jutaku_core','gensen_hyo_core','santei_core','gensen_kyuyo_core'].includes(c));
for (const sha of execFileSync('git',['log','--format=%H','--','tests/conditions/_status.json'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean)) {
 const old=JSON.parse(execFileSync('git',['show',`${sha}:tests/conditions/_status.json`],{cwd:root,encoding:'utf8'}));
 previous=previous.filter(c=>old.pending.includes(c));
}
assert.deepEqual(validatePending(status,cores,registered,previous),[]);
let count=0;
for(const core of registered){
 const table=JSON.parse(readFileSync(new URL(core+'.json',dir)));
 assert.equal(table.core,core);
 const {cases}=await import('./boundaries/'+core+'.mjs');
 const errors=validateTable(table,readFileSync(new URL(table.page,root),'utf8'),[...cases,...(extra[core]||[])]);
 assert.deepEqual(errors,[],core);count+=table.conditions.length;
}
console.log(`condition tables: ${registered.length} cores, ${count} conditions, ${status.pending.length} pending`);
