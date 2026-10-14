// Regression cases from independent fact checking (No.6925); expectations do not use the core.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calcInshi} from '../docs/assets/inshi_core.js';
const D=JSON.parse(readFileSync(new URL('../docs/assets/inshi_r07.json',import.meta.url)));
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;}catch(e){failed++;console.error('FAIL',name,e.message);}}
const receipt={doc:'k17_uriage',amount:54800};
for(const taxPart of [-4981,NaN,Infinity,-Infinity,'1e309',0.5,Number.MAX_SAFE_INTEGER+1,null,false,'invalid']){
 test(`invalid taxPart ${String(taxPart)}`,()=>{const r=calcInshi({...receipt,taxPart},D);assert.equal(r.ok,false);assert.equal(r.errorType,'input');assert.equal(r.tax,undefined);});
}
for(const amount of [0,-1,NaN,Infinity,'1e309',49999.9,Number.MAX_SAFE_INTEGER+1,null,false,'']){
 test(`invalid amount ${String(amount)}`,()=>{const r=calcInshi({...receipt,amount},D);assert.equal(r.ok,false);assert.equal(r.tax,undefined);});
}
for(const taxPart of [undefined,'',0,'0'])test(`blank or zero tax ${String(taxPart)}`,()=>{const r=calcInshi({...receipt,taxPart},D);assert.equal(r.ok,true);assert.equal(r.tax,200);});
for(const [amount,taxPart,tax] of [[54800,4801,0],[54800,4800,200],[54800,4799,200],[54800,4981,0],[49999,0,0],[50000,0,200],[50001,0,200]]){
 test(`integer boundary ${amount}-${taxPart}`,()=>{const r=calcInshi({...receipt,amount,taxPart},D);assert.equal(r.ok,true);assert.equal(r.tax,tax);assert.equal(r.judgeAmount,amount-taxPart);});
}
for(const menzei of [false,true])test(`tax >= amount, menzei=${menzei}`,()=>{assert.equal(calcInshi({...receipt,taxPart:54800,menzei},D).ok,false);});
test('No.6925 exempt business still includes valid tax',()=>{assert.equal(calcInshi({...receipt,taxPart:4981,menzei:true},D).tax,200);});
const badData=[null,{}, {...D,docs:{}}, {...D,docs:{...D.docs,k17_uriage:undefined}}, {...D,kubun_shohizei:undefined}, {...D,_meta:undefined}];
for(const mutate of [d=>delete d.docs.k17_uriage.brackets,d=>d.docs.k17_uriage.brackets=[],d=>delete d.docs.k17_uriage.brackets[0].tax,d=>d.docs.k17_uriage.brackets[0].tax=NaN,d=>d.docs.k17_uriage.brackets[0].upto=0.5,d=>d.docs.k5.tax=-1]){
 const d=structuredClone(D);mutate(d);badData.push(d);
}
for(const [index,d] of badData.entries())test(`missing/invalid data ${index}`,()=>{const r=calcInshi(receipt,d);assert.equal(r.ok,false);assert.equal(r.errorType,'data');assert.equal(r.tax,undefined);});
console.log(`inchi validation: ${passed} passed, ${failed} failed`);
process.exitCode=failed?1:0;
