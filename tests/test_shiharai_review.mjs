import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {segmentClaims} from '../tools/segment_claims.mjs';
const page='docs/shiharai-site/index.html';
const html=fs.readFileSync(page,'utf8');const doc=new JSDOM(html).window.document;
const answers=[...doc.querySelectorAll('.faq-answer')].map(x=>x.textContent);
const schema=[...doc.querySelectorAll('script[type="application/ld+json"]')].map(x=>JSON.parse(x.textContent)).find(x=>x['@type']==='FAQPage');
const checks=[
 ['可視FAQとJSON-LDの同一性',()=>assert.deepEqual(schema.mainEntity.map(x=>x.acceptedAnswer.text),answers)],
 ['30暦日と翌月末を区別',()=>{assert(!answers[0].includes('翌月末払い相当'));assert(answers[0].includes('締め日の翌日から30暦日'));}],
 ['発注者と受注者の適用要件・再委託例外',()=>{for(const text of ['特定業務委託事業者','従業員を使用する個人','役員が2人以上','特定受託事業者','代表者1人のみ','再委託である旨','元委託者の氏名または名称','元委託の支払期日から30日以内'])assert(answers[3].includes(text),text);}],
 ['非主張だけを保護対象から外す',()=>{const us=segmentClaims('<h2>FAQ</h2><p>契約と適用法令を確認してください。支払期日は必ず翌営業日です。</p><div>この内容をXで共有</div>');assert.equal(us.find(x=>x.text==='契約と適用法令を確認してください。').protected,false);assert.equal(us.find(x=>x.text==='この内容をXで共有').protected,false);assert.equal(us.find(x=>x.text==='支払期日は必ず翌営業日です。').protected,true);}],
];
let bad=0;for(const [name,run]of checks){try{run();console.log('PASS '+name);}catch(e){bad++;console.log('FAIL '+name+': '+e.message);}}
assert.equal(bad,0,'r16 t8-z FAQ / classification regressions');

// The review explicitly preserves all not_wrong/unsure out-of-corpus text.
const evidence='review-evidence/r16-t8-z';
const original=JSON.parse(fs.readFileSync(evidence+'/segments.json'));
const opinions=JSON.parse(fs.readFileSync(evidence+'/oc-opinion.json')).units;
let preserved=0;
for(const page of [...new Set(original.map(x=>x.page))]){
 const now=segmentClaims(fs.readFileSync(page,'utf8'),page);
 const ledger=JSON.parse(fs.readFileSync('claims/'+page.slice(5).replace('/index.html','.json')));
 for(const op of opinions.filter(x=>x.page===page&&x.verdict!=='wrong')){
  const old=original.find(x=>x.page===page&&x.id===op.id);const unit=now.find(x=>x.id===op.id);
  assert(unit,'missing '+op.id);assert.equal(unit.text_hash,old.text_hash);
  assert(ledger.out_of_corpus.some(x=>x.id===op.id&&x.needed_source&&x.result==='out_of_corpus'));
  assert(!ledger.verified.some(x=>x.id===op.id));
  assert(!ledger.claims.some(x=>x.covers?.includes(op.id)));
  preserved++;
 }
}
assert.equal(preserved,32);
console.log('正本外32件: 本文維持・必要正本記録・確認済みにしない');
