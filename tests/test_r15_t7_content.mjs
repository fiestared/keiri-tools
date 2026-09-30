// Fixed-corpus regressions: HW continuation 32-41; MHLW guide 1097-1115; Act 61-7(7).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const errors=[];
function check(name,fn){try{fn();}catch(e){errors.push(name+': '+e.message);}}
for(const page of ['docs/ikuji/index.html','docs/embed/ikuji/index.html']){
 const d=new JSDOM(readFileSync(page,'utf8')).window.document;
 const hints=[...d.querySelectorAll('.hint')].map(x=>x.textContent.replace(/\s/g,'')).join('\n');
 check(page+' 配偶者免除の限定',()=>assert.match(hints,/行方不明.{0,30}3か月以上無断欠勤/));
 check(page+' 災害行方不明',()=>assert.match(hints,/災害/));
 check(page+' 申告書の理由限定',()=>assert.match(hints,/申告書/));
 check(page+' 配偶者期間',()=>assert.match(hints,/配偶者.{0,40}免除に該当しない場合.{0,90}8週間/));
 if(!page.includes('/embed/')){
  check('就業賃金が増えても合計一定の区間',()=>assert.match(d.body.textContent,/賃金が13%（181日目以降30%）を超えると給付が減額/));
  check('metaに配偶者免除',()=>assert.match(d.querySelector('meta[name="description"]').content,/免除/));
 }
 d.defaultView.close();
}
const d=new JSDOM(readFileSync('docs/column/kounenrei-koyou-keizoku/index.html','utf8')).window.document;
for(const sel of ['meta[name="description"]','meta[property="og:description"]'])check(sel,()=>assert.match(d.querySelector(sel).content,/5年未満なら5年以上となった日/));
check('最大率',()=>assert.match(d.querySelector('meta[name="description"]').content,/最大15%.*最大10%.*逓減/));
d.defaultView.close();
assert.deepEqual(errors,[]);console.log('r15 t7: 要約・本文・埋込の条件回帰が緑');
