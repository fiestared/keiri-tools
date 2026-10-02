import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const pages=['docs/furusato/index.html','docs/embed/furusato/index.html','docs/column/furusato-nozei-keisan/index.html'];
for(const page of pages){const key=page.replaceAll('/','_'); const ledger=JSON.parse(readFileSync(page.replace('docs/','claims/').replace('/index.html','.json')));for(const stage of ['before','after']){let html=stage==='before'?execFileSync('git',['show',`3d771650:${page}`],{encoding:'utf8'}):readFileSync(page,'utf8');let u=segmentClaims(html,page);writeFileSync(`reports/auto20261002-t5-q08464-recheck1/${stage}-${key}.json`,JSON.stringify({units:u,coverage:validateSegments(u,ledger)},null,2));}}
