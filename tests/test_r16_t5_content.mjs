import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const prefix=process.env.R16_HTML_ROOT||'.';
for(const slug of ['juminzei','embed/juminzei']){
 const d=new JSDOM(fs.readFileSync(`${prefix}/docs/${slug}/index.html`,'utf8')).window.document;
 assert.doesNotMatch(d.querySelector('#haigusha option[value="none"]').textContent,/共働き/,'共働きだけを理由に配偶者控除なしへ誘導しない');
 assert.match(d.querySelector('label[for="fuyoDokyoRooya"]').textContent,/直系尊属/,'同居老親等は直系尊属が要件');
 assert.match(d.querySelector('label[for="fuyoRojin"]').textContent,/同居老親等以外/,'同居する兄姉も通常の老人扶養へ');
 assert.match(d.querySelector('label[for="fuyoIppan"]').parentElement.textContent,/非居住者.*38万円/s,'非居住者30〜69歳の追加要件を入力前に確認できる');
}
const h=new JSDOM(fs.readFileSync(`${prefix}/docs/hikazei-setai/index.html`,'utf8')).window.document;
for(let n=1;n<=6;n++) assert.match(h.querySelector(`label[for="m${n}_age"]`).textContent,/前年12月31日/,'年齢は課税年度の前年末');
assert.match(h.querySelector('#kodomo-hanten').parentElement.textContent,/令和8年度.*115万円.*令和9年度.*41万円/s,'同じ給与115万円でも年度で判定が変わる説明');
assert.match(h.querySelector('#hero-155').parentElement.textContent,/公的年金以外の所得なし.*特例なし/s,'年金上限は他所得・特例を限定');
assert.doesNotMatch(h.body.textContent,/参酌基準/,'295条3項は従う基準');
assert.doesNotMatch(h.querySelector('.callout').textContent,/高額療養費の区分.*この定義/,'医療保険の判定対象を世帯全員と一律にしない');
const j=new JSDOM(fs.readFileSync(`${prefix}/docs/juminzei/index.html`,'utf8')).window.document;
assert.match(j.body.textContent,/給与所得控除\s*−\s*基礎控除/,'概算式は基礎控除を差し引く');
assert.doesNotMatch(j.body.textContent,/配当所得がある人（分離課税なので/,'配当を一律の分離課税にしない');
console.log('✓ r16: 入力条件・年度・説明式の回帰検査');
