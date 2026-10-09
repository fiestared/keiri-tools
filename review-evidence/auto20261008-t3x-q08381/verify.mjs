import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const html=readFileSync('docs/column/hyojun-hoshu-gakuhyo/index.html','utf8');const d=new JSDOM(html).window.document;
const round=n=>Math.ceil(n-0.5);const rows=[...d.querySelector('#grade-table').rows].slice(1);assert.equal(rows.length,50);
const values=[];for(const row of rows){const cells=[...row.cells].map(c=>c.textContent);const nums=cells.map(t=>Number(t.match(/^[\d,]+/)[0].replaceAll(',','')));const [grade,std,,health,care,child,pension,total]=nums;const ep=round(Math.min(650000,Math.max(88000,std))*0.183/2);assert.deepEqual([health,care,child,pension,total],[round(std*.0985/2),round(std*.1147/2),round(std*.0023/2),ep,round(std*.0985/2)+round(std*.0023/2)+ep],`grade ${grade}`);values.push({grade,standard:std,health,care,child,pension,total});}
assert.equal(values[21].total,42570);assert.equal(42570*3,127710);assert.equal(42570*6,255420);assert.equal(42570+1080,43650);assert.equal(42570+43650,86220);assert.equal(14775+27450,42225);assert.equal(16320+42225,58545);assert.equal(16320+42225+18000,76545);
console.log(JSON.stringify({rows:values,calculations:{month:42570,three_months:42570*3,six_months:42570*6,employer:42570+1080,payment:42570+43650,march:14775+27450,march_balance:16320+42225,march_with_employment:16320+42225+18000}},null,2));
