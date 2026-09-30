import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
// r16/t3-z: fixed MHLW rate table; Kyokai R8 rates; pension guide p.43;
// e-Gov 雇用保険法6条・37条の5・63条 (additional-sources.json).
const d=new JSDOM(readFileSync(process.env.KOYOU_ARTICLE_PATH || 'docs/column/koyou-hokenryo-ritsu/index.html','utf8')).window.document;
const failures=[];
const compact=e=>e.textContent.replace(/\s+/g,'');
const faq=[...d.querySelectorAll('.faq-answer')];
function check(name,fn){try{fn();console.log('PASS '+name)}catch(e){failures.push(name);console.log('FAIL '+name+': '+e.message)}}
check('title/OG/h1 distinguish general total from worker rate',()=>{
 for(const t of [d.title,d.querySelector('[property="og:title"]').content,d.querySelector('h1').textContent]){
  assert.match(t,/一般の事業.*合計13\.5\/1,000.*労働者5\/1,000/);
 }
});
check('same grade requires matching health/pension conditions in callout and FAQ',()=>{
 const b=[...d.querySelectorAll('.callout')].find(e=>e.textContent.includes('同じ等級'));
 const f=faq.find(e=>e.textContent.includes('第19級'));
 for(const el of [b,f]){
  const t=compact(el);
  for(const re of [/同じ月/,/保険者/,/都道府県/,/介護保険/,/負担割合/,/端数処理/,/保険料免除がなく/,/厚生年金基金の加入員でもない/])assert.match(t,re);
  assert.doesNotMatch(t,/1円まで同額/);
 }
});
check('FAQ employer excess includes construction 4.5 permille',()=>{
 const t=compact(faq.find(e=>e.textContent.includes('雇用保険二事業とは')));
 assert.match(t,/一般の事業と農林水産・清酒製造.*3\.5\/1,000.*建設.*4\.5\/1,000/);
 assert.match(t,/公共職業能力開発施設.*求職者.*労働者への交付金/);
});
check('under 20h and under 31d exceptions appear in body and FAQ',()=>{
 const h=[...d.querySelectorAll('h3')].find(e=>e.textContent.includes('週20時間未満'));
 assert.match(h.textContent,/例外/);
 const f=faq.find(e=>e.textContent.includes('雇用保険法6条'));
 for(const e of [h.nextElementSibling,f]){
  const t=compact(e);
  for(const re of [/37条の5第1項の申出/,/高年齢被保険者/,/日雇労働被保険者/,/前2か月の各月に18日以上/,/一定の日雇労働者/])assert.match(t,re);
 }
});
check('same earnings can have same employment premium',()=>{
 const f=faq.find(e=>e.textContent.includes('第19級'));
 assert.match(compact(f),/^A\.同じとは限らず、賃金総額が違えば/);
});
check('Kyokai voluntary and day-labor switch in April',()=>{
 const t=compact([...d.querySelectorAll('p')].find(e=>e.textContent.includes('健康保険料率は')&&e.textContent.includes('切り替わります')));
 assert.match(t,/一般の被保険者は3月分.*任意継続被保険者と日雇特例被保険者は4月分/);
});
d.defaultView.close();
assert.deepEqual(failures,[]);
