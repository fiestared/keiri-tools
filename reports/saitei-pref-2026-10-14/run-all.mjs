import {readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const root=resolve(process.argv[2]), out=resolve(process.argv[3]); mkdirSync(out,{recursive:true});
const results=[];
for(const f of readdirSync(join(root,'tests')).filter(f=>f.endsWith('.mjs')).sort()){
 const r=spawnSync(process.execPath,[join(root,'tests',f)],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
 const log=(r.stdout||'')+(r.stderr||''); writeFileSync(join(out,f+'.log'),log);
 const dep=log.match(/Cannot find package '([^']+)'/);
 const row={file:f,exit:r.status,status:r.status===0?'pass':dep?'unmeasurable':'fail',dependency:dep?.[1]};results.push(row);
 writeFileSync(join(out,'results.json'),JSON.stringify(results,null,2));
 if(row.status!=='pass') console.log(row.status,f, r.status);
}
console.log(JSON.stringify({total:results.length,pass:results.filter(x=>x.status==='pass').length,fail:results.filter(x=>x.status==='fail').length,unmeasurable:results.filter(x=>x.status==='unmeasurable').length}));
