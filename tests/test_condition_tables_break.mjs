import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePending,validateTable} from '../tools/condition_tables.mjs';
import {extra} from './conditions/cases.mjs';
import {cases} from './boundaries/gensen_kyuyo_core.mjs';
const table=JSON.parse(readFileSync(new URL('./conditions/gensen_kyuyo_core.json',import.meta.url)));
const html=readFileSync(new URL('../docs/gensen-choshu/index.html',import.meta.url),'utf8');
const all=[...cases,...extra.gensen_kyuyo_core];
assert.deepEqual(validateTable(table,html,all),[]); // real page pristine first
const originalCore=readFileSync(new URL('../docs/assets/gensen_kyuyo_core.js',import.meta.url),'utf8');
const target='if (opts.kafu || opts.hitorioya) n += 1;';
assert.equal(originalCore.split(target).length,2);
const brokenCore=await import('data:text/javascript;base64,'+Buffer.from(originalCore.replace(target,'if (opts.kafu) n += 1; if (opts.hitorioya) n += 1;')).toString('base64'));
const faulty=all.map(c=>c.kind==='exclusive'?{...c,run:()=>brokenCore.extraDependentCount({kafu:true,hitorioya:true})}:c);
assert.ok(validateTable(table,html,faulty).some(e=>e.includes('寡婦とひとり親')));
const small={conditions:[{id:'scope',statute:'fixture reference',disposition:'out_of_scope',scope_text:'この条件は対象外です。',cases:['scope-case']}],default_cases:['scope-case']};
const sc=[{name:'scope-case',run:()=>false,expected:false,source:'https://www.nta.go.jp/',quote:'fixture only'}];
const intact='<p data-scope-note="scope">この条件は対象外です。</p>';
assert.deepEqual(validateTable(small,intact,sc),[]);
assert.ok(validateTable(small,intact.replace('data-scope-note','data-removed'),sc).length);
assert.ok(validateTable(small,intact.replace('<p ','<p hidden '),sc).length);
assert.deepEqual(validatePending({pending:['old']},['old','done'],['done'],['old']),[]);
assert.ok(validatePending({pending:['old','done']},['old','done'],[],['old']).length);
assert.ok(validatePending({pending:['old','new']},['old','new'],[],['old']).length);
console.log('conditions: pristine real page and fixture green; scope removal/hidden/exclusive/pending regressions red');

const hyoTable=JSON.parse(readFileSync(new URL('./conditions/gensen_hyo_core.json',import.meta.url)));
const hyoHtml=readFileSync(new URL('../docs/gensen-hyo/index.html',import.meta.url),'utf8');
const hyoCases=[...(await import('./boundaries/gensen_hyo_core.mjs')).cases,...extra.gensen_hyo_core];
assert.deepEqual(validateTable(hyoTable,hyoHtml,hyoCases),[]);
const changed=hyoHtml.replace(/(<input[^>]*id="kiso"[^>]*value=")1040000"/,'$1580000"');
assert.notEqual(changed,hyoHtml);assert.ok(validateTable(hyoTable,changed,hyoCases).some(e=>e.includes('HTML初期値')));

const hyoDOM=new (await import('jsdom')).JSDOM(hyoHtml);
const targetNote=hyoDOM.window.document.querySelector('#dekinai-note li:nth-child(2)');
assert.ok(targetNote);targetNote.remove();
assert.ok(validateTable(hyoTable,hyoDOM.serialize(),hyoCases).some(e=>e.includes('scope note')));
hyoDOM.window.close();
