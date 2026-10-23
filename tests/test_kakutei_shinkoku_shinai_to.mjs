// 国税庁No.2024の税額帯と、No.9205の暦年による延滞税を取り違えないための照合。
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{JSDOM}from'jsdom';
const ledger=JSON.parse(readFileSync(new URL('../claims/column/kakutei-shinkoku-shinai-to.json',import.meta.url)));
const doc=new JSDOM(readFileSync(new URL('../docs/column/kakutei-shinkoku-shinai-to/index.html',import.meta.url),'utf8')).window.document;
const text=e=>e.textContent.replace(/\s+/g,'').normalize('NFKC');
const table=doc.querySelector('#mushinkoku-rates');
const actual=[...table.rows].map(r=>[...r.cells].map(text));
assert.deepEqual(actual,[ledger.reference_table.headers,...ledger.reference_table.rows].map(r=>r.map(x=>x.replace(/\s+/g,'').normalize('NFKC'))));
// 独立に転記した国税庁の公表率。基礎税額の全体へ最高率を掛ける誤りも防ぐ。
assert.deepEqual(actual.slice(1).map(r=>r.slice(1)),[['5%','5%','5%'],['10%','15%','25%'],['15%','20%','30%']]);
assert.match(table.parentElement.previousElementSibling.textContent,/令和5年分以降/);
assert.match(table.parentElement.previousElementSibling.textContent,/不適用.*重加算税.*上乗せ/);
const late=[...doc.querySelectorAll('table')].find(t=>t.caption?.textContent.includes('延滞税'));
assert.match(late.parentElement.previousElementSibling.textContent,/令和8年中の期間/);
assert.match(late.parentElement.previousElementSibling.textContent,/期限後申告.*納期限.*提出日/);
assert.match(text(late),/2\.8%/);assert.match(text(late),/9\.1%/);
assert.doesNotMatch(doc.querySelector('article').textContent,/令和8年分の延滞税|納付税額.*一律.*30%/);
console.log('PASS: 無申告加算税の各税額帯・申告時点、延滞税の暦年と納期限');
