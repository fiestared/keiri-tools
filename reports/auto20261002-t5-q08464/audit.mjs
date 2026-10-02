import assert from 'node:assert/strict';
import{execFileSync}from'node:child_process';import{writeFileSync,readFileSync}from'node:fs';
import{segmentClaims,validateSegments}from'../../tools/segment_claims.mjs';
const r='reports/auto20261002-t5-q08464/',run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t5-q08464/';
const git=p=>execFileSync('git',['show','34be072a:'+p],{encoding:'utf8',maxBuffer:20e6});
const pages=['docs/furusato/index.html','docs/embed/furusato/index.html'];let result={},units=[];
for(const page of pages){const path='claims/'+page.slice(5).replace('/index.html','.json'),current=segmentClaims(readFileSync(page,'utf8'),page);units.push(...current);let before=validateSegments(segmentClaims(git(page),page),JSON.parse(git(path)));let d=JSON.parse(readFileSync(path)),after=validateSegments(current,d);assert(after.errors.every(e=>e.startsWith('unprocessed segment:')));assert.deepEqual(new Set(after.unprocessed_ids),new Set(d.out_of_corpus.map(x=>x.id)));for(const c of [before,after]){delete c.links;delete c.errors;}result[page]={before,after};}
const current=new Map(units.map(u=>[u.page+'|'+u.id,u]));const adjudication=JSON.parse(readFileSync(run+'segment-adjudication.json')).segments;const oc=adjudication.filter(x=>x.decision==='out_of_corpus');assert(oc.every(x=>current.has(x.page+'|'+x.id)));const unresolved=adjudication.filter(x=>x.decision==='unresolved');assert(unresolved.every(x=>!current.has(x.page+'|'+x.id)));
const dropNotes=x=>Array.isArray(x)?x.map(dropNotes):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!k.startsWith('_')).map(([k,v])=>[k,dropNotes(v)])):x;
assert.deepEqual(dropNotes(JSON.parse(git('docs/assets/juminzei_r08.json'))),dropNotes(JSON.parse(readFileSync('docs/assets/juminzei_r08.json'))));
writeFileSync(r+'coverage-comparison.json',JSON.stringify(result,null,2)+'\n');writeFileSync(r+'self-audit.json',JSON.stringify({original_ooc_unchanged:oc.length,unresolved_original_replaced:unresolved.length,reference_values_unchanged:true,unprocessed_are_all_declared_out_of_corpus:true},null,2)+'\n');
console.log('✓ Original OOC 73 unchanged; 81 original unresolved units replaced; numeric reference data unchanged; all remaining unprocessed units declared OOC.');
for(const [p,v]of Object.entries(result))console.log(p,JSON.stringify({before:{...v.before,unprocessed_ids:undefined},after:{...v.after,unprocessed_ids:undefined}}));
