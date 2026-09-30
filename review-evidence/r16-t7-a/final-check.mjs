import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const jobs=[
 ['generators',['tests/test_generators_fresh.mjs'],0],
 ['qa',['tests/test_qa.mjs'],0],
 ['stale-values',['tests/test_stale_values.mjs'],0],
 ['claims',['tools/check_claims.mjs','--changed','origin/main'],0],
 ['coverage',['review-evidence/r16-t7-a/audit-coverage.mjs'],0],
 ['target-layout',['review-evidence/r16-t7-a/target-layout.mjs'],0],
 ['baseline-hojokin',['tests/test_hojokin_sources.mjs'],1],
 ['baseline-visual',['tests/test_layout_visual.mjs'],1],
];
const results=[];for(const [name,args,expected] of jobs){console.log('START '+name);const r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:30*1024*1024,env:process.env});fs.writeFileSync('review-evidence/r16-t7-a/final-'+name+'.log',(r.stdout||'')+(r.stderr||''));results.push({name,args,status:r.status,expected});console.log(name+' '+r.status+' expected '+expected);}
fs.writeFileSync('review-evidence/r16-t7-a/final-results.json',JSON.stringify(results,null,2)+'\n');process.exit(results.some(x=>x.status!==x.expected)?1:0);
