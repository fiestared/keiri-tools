// JSを実行しないHTMLに税額があり、正本改定時に静的表の更新漏れを検出する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../docs/inshi/index.html', import.meta.url), 'utf8');
const data = JSON.parse(readFileSync(new URL('../docs/assets/inshi_r07.json', import.meta.url), 'utf8'));
const table = html.match(/<table[^>]*id="receipt-tax-table"[^>]*>([\s\S]*?)<\/table>/)?.[1];
assert.ok(table, '静的HTMLに第17号の表が必要');
const tbody = table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
const rows = [...tbody.matchAll(/<tr><th scope="row">([^<]+)<\/th><td class="num">([^<]+)<\/td><\/tr>/g)];
const doc = data.docs.k17_uriage;
assert.equal(rows.length, doc.brackets.length + 2, '非課税・全階級・金額記載なしを含める');
assert.equal(Number(rows[0][1].replace(/円未満|,/g, '')), doc.hikazei_under);
assert.equal(rows[0][2], '非課税（印紙不要）');
doc.brackets.forEach((b,i) => {
  assert.equal(rows[i+1][1], b.label, `境界表記の不一致: ${i}`);
  assert.equal(Number(rows[i+1][2].replace(/円|,/g, '')), b.tax, `税額の不一致: ${b.label}`);
});
assert.equal(Number(rows.at(-1)[2].replace(/円|,/g, '')), doc.noamount);
assert.ok(html.indexOf('id="receipt-tax-table"') < html.indexOf('id="doc"'), '判定機より前に配置');
assert.ok(/<th scope="col">/.test(table), '列見出しを明示');
// No.7141を2026-09-12に生HTMLで再読した外部オラクル。JSON側の誤更新も見逃さない。
assert.deepEqual(rows.slice(1,-1).map(r=>Number(r[2].replace(/円|,/g,''))),
  [200,400,600,1000,2000,4000,6000,10000,20000,40000,60000,100000,150000,200000]);
assert.equal(rows[1][1], '5万円以上100万円以下');
assert.equal(rows[2][1], '100万円を超え200万円以下');
console.log('第17号の静的表：全16行・正本JSON・国税庁税額・位置・見出し一致');
