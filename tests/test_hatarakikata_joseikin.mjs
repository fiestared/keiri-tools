import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const root=new URL('../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('tools/article_data/hatarakikata-kaikaku-joseikin-2026.json',root)));
const doc=new JSDOM(readFileSync(new URL('docs/column/hatarakikata-kaikaku-joseikin/index.html',root),'utf8')).window.document;
for(const t of data.tables){
 const table=doc.querySelector('table[data-joseikin-table="'+t.id+'"]');assert.ok(table,t.id);
 const rows=[...table.rows].map(r=>[...r.cells].map(c=>c.textContent.trim()));
 assert.deepEqual(rows,[t.columns,...t.rows],t.id+': public course/boundary/amount rows');
 assert.match(table.closest('.scroll-wrap').previousElementSibling.textContent,/令和8年度/);
}
// These two different end dates are easy to accidentally collapse into one.
const heading=doc.querySelector('#schedule');
const context=heading.nextElementSibling.nextElementSibling;
const schedule=context.nextElementSibling;
for(const date of ['令和9年1月31日','令和9年2月5日','令和9年2月14日','令和9年2月26日','令和9年3月14日','令和9年3月19日'])assert.ok(schedule.textContent.includes(date),date);
assert.match(schedule.textContent,/砂糖製造業を除く/);
assert.match(context.textContent,/終期から30日後/);assert.match(context.textContent,/いずれか早い日/);
console.log('✓ 助成金: 5つの公表値表・砂糖製造業を含む日程・支給申請の早い方を照合');
