import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const root=new URL('../',import.meta.url),d=JSON.parse(readFileSync(new URL('tools/data/teiki_yokin_rates.json',root),'utf8'));
const dom=new JSDOM(readFileSync(new URL('docs/column/teiki-yokin-kinri-table/index.html',root),'utf8')).window.document;
const parse=s=>Date.parse(s+'T00:00:00Z'),days=m=>(parse(m)-parse(d.start))/86400000;
const number=t=>Number(t.replace(/[^0-9.]/g,''));
assert.equal(days(d.maturity),d.days);
const rows=[...dom.querySelectorAll('#rate-table tbody tr')];assert.equal(rows.length,d.banks.length);
for(let i=0;i<rows.length;i++){
 const b=d.banks[i],cells=rows[i].cells;
 assert(cells[0].textContent.includes(b.name));assert.equal(cells[0].querySelector('a').href,b.source_url);
 assert.equal(number(cells[1].textContent),Number(b.rate_percent));
 const gross=Math.floor(d.principal*Number(b.rate_percent)/100*d.days/365);
 const net=Math.floor(gross*79685/100000);
 assert.equal(number(cells[3].textContent),gross);assert.equal(number(cells[2].textContent),net);
 assert(cells[4].textContent.includes(b.source_as_of.replace(/^(\d+)-(\d+)-(\d+)$/,(_,y,m,day)=>`${y}年${+m}月${+day}日`)));
 assert.equal(b.effective_from,null,'未確認の開始日を基準日で埋めない');
}
const periodRows=[...dom.querySelectorAll('#period-table tbody tr')];assert.equal(periodRows.length,3);
// 固定した日付から独立に計算し、短期を年利のまま扱う回帰を捕捉する。
for(let i=0;i<periodRows.length;i++){
 const p=d.period_examples[i],c=periodRows[i].cells;assert.equal(days(p.maturity),p.days);assert.equal(number(c[2].textContent),days(p.maturity));
 const g=Math.floor(1000000*0.005*days(p.maturity)/365);assert.equal(number(c[3].textContent),g);assert.equal(number(c[4].textContent),Math.floor(g*79685/100000));
}
assert.equal(number(periodRows[0].cells[3].textContent),1260);
assert.match(dom.querySelector('#rate-table').parentElement.previousElementSibling.textContent,/銀行の支払額を再現したものではありません/);
console.log('✓ 定期預金: 公表金利・基準日・3銀行の利息・期間境界と比較用端数処理を照合');
