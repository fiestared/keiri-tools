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
// 2026-10-12 読みやすさの作り直し: 条件は話題の節に1回だけ書き、FAQ はその節へのリンクで案内する。
//   条件の文言はそのまま本文側で固定し、FAQ には「リンクがあること」と「条件を外した言い切りが無いこと」を課す。
const section=h=>{const out=[];for(let e=h.nextElementSibling;e&&!/^H[23]$/.test(e.tagName);e=e.nextElementSibling)out.push(e);return out.map(compact).join('');};
check('same grade requires matching health/pension conditions in callout; FAQ links to it',()=>{
 const b=[...d.querySelectorAll('.callout')].find(e=>e.textContent.includes('同じ等級'));
 const t=compact(b);
 for(const re of [/同じ月/,/保険者/,/都道府県/,/介護保険/,/負担割合/,/端数処理/,/保険料免除がなく/,/厚生年金基金の加入員でもない/])assert.match(t,re);
 assert.doesNotMatch(t,/1円まで同額/);
 const f=faq.find(e=>e.textContent.includes('1,525円'));
 const bid=b.querySelector('[id]')?.id;
 assert.ok(bid&&f.querySelector(`a[href="#${bid}"]`),'FAQ links to the same-grade callout');
 assert.doesNotMatch(compact(f),/1円まで同額|同額です/);
});
check('employer excess includes construction 4.5 permille (FAQ) and 2-business uses (body)',()=>{
 const f=faq.find(e=>e.textContent.includes('雇用保険二事業'));
 assert.match(compact(f),/一般の事業と農林水産・清酒製造.*3\.5\/1,000.*建設.*4\.5\/1,000/);
 assert.ok(f.querySelector('a[href="#why"]'),'FAQ links to #why');
 const w=section(d.getElementById('why'));
 assert.match(w,/建設の事業は4\.5\/1,000/);
 assert.match(w,/公共職業能力開発施設.*求職者.*労働者への交付金/);
});
check('under 20h and under 31d exceptions appear in body; FAQ links to them',()=>{
 const h=[...d.querySelectorAll('h3')].find(e=>e.textContent.includes('週20時間未満'));
 assert.match(h.textContent,/例外/);
 const t=section(h);
 for(const re of [/37条の5第1項の申出/,/高年齢被保険者/,/日雇労働被保険者/,/前2か月の各月に18日以上/,/一定の日雇労働者/])assert.match(t,re);
 const f=faq.find(e=>e.textContent.includes('20時間未満'));
 assert.ok(h.id&&f.querySelector(`a[href="#${h.id}"]`),'FAQ links to the exceptions');
 assert.match(compact(f),/原則として/);
});
check('same earnings can have same employment premium',()=>{
 const f=faq.find(e=>e.textContent.includes('1,525円'));
 assert.match(compact(f),/^A\.同じとは限らず、賃金総額が違えば/);
});
check('Kyokai voluntary and day-labor switch in April',()=>{
 const t=compact([...d.querySelectorAll('p')].find(e=>e.textContent.includes('健康保険料率は')&&e.textContent.includes('切り替わります')));
 assert.match(t,/一般の被保険者は3月分.*任意継続被保険者と日雇特例被保険者は4月分/);
});
d.defaultView.close();
assert.deepEqual(failures,[]);
