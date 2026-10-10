import {contentHTML} from './layout/content-html.mjs';
// JSを実行しないHTMLに税額があり、正本改定時に静的表の更新漏れを検出する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = contentHTML(readFileSync(new URL('../docs/inshi/index.html', import.meta.url), 'utf8'));
const data = JSON.parse(readFileSync(new URL('../docs/assets/inshi_r07.json', import.meta.url), 'utf8'));
const table = html.match(/<table[^>]*id="receipt-tax-table"[^>]*>([\s\S]*?)<\/table>/)?.[1];
assert.ok(table, '静的HTMLに第17号の表が必要');
const tbody = table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
const rows = [...tbody.matchAll(/<tr><th scope="row">([^<]+)<\/th><td class="num">([^<]+)<\/td><\/tr>/g)];
// 行見出しは「記載金額が」を前置して表の上の決め方と結び付ける（2026-10-07 照合の指摘）。比べるのは前置を除いた階級名。
rows.slice(0,-1).forEach(r => { assert.ok(r[1].startsWith('記載金額が'), `行見出しに「記載金額が」: ${r[1]}`); r[1] = r[1].slice('記載金額が'.length); });
const doc = data.docs.k17_uriage;
assert.equal(rows.length, doc.brackets.length + 2, '非課税・全階級・金額記載なしを含める');
assert.equal(Number(rows[0][1].replace(/円未満|,/g, '')), doc.hikazei_under);
assert.equal(rows[0][2], '非課税（印紙不要）');
doc.brackets.forEach((b,i) => {
  assert.equal(rows[i+1][1], b.label, `境界表記の不一致: ${i}`);
  assert.equal(Number(rows[i+1][2].replace(/円|,/g, '')), b.tax, `税額の不一致: ${b.label}`);
});
assert.equal(Number(rows.at(-1)[2].replace(/円|,/g, '')), doc.noamount);
// ★2026-10-08 に配置を逆にした（gbrain audits/keiri-uiux-review-pc-2026-10-08 中4）: 早見表を判定機より前に置いていたため、
//   PC でも判定フォームが y=1,929（2画面下）にあった。早見表の答え（5万円未満は非課税・100万円以下は200円）は
//   h1 直下のリードが既に言っているので、フォームを h1・リードの直後に上げ、早見表はその下に置く。
assert.ok(html.indexOf('id="doc"') < html.indexOf('id="receipt-tax-table"'), '判定機を早見表より前に配置（PC で判定フォームを最初の画面に入れる）');
assert.ok(/<th scope="col">/.test(table), '列見出しを明示');
// No.7141を2026-09-12に生HTMLで再読した外部オラクル。JSON側の誤更新も見逃さない。
assert.deepEqual(rows.slice(1,-1).map(r=>Number(r[2].replace(/円|,/g,''))),
  [200,400,600,1000,2000,4000,6000,10000,20000,40000,60000,100000,150000,200000]);
assert.equal(rows[1][1], '5万円以上100万円以下');
assert.equal(rows[2][1], '100万円を超え200万円以下');
console.log('第17号の静的表：全16行・正本JSON・国税庁税額・位置・見出し一致');
