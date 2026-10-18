import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const doc = new JSDOM(fs.readFileSync('docs/gensen-choshu/index.html', 'utf8')).window.document;
const data = JSON.parse(fs.readFileSync('docs/assets/gensen_getsugaku_r08.json'));
const table = doc.querySelector('#monthly-sample-table');
assert.ok(table);
assert.deepEqual([...table.querySelectorAll('thead th')].map(c=>c.textContent), ['その月の社会保険料等控除後の給与等の金額','甲欄・0人','甲欄・1人','乙欄']);
const rows = [...table.querySelectorAll('tbody tr')];
assert.equal(rows.length, 3);
for (const [i,min] of [105000,107000,119000].entries()) {
  const r=data.rows.find(r=>r.min===min), fmt=n=>n.toLocaleString('ja-JP');
  assert.deepEqual([...rows[i].children].map(c=>c.textContent), [`${fmt(r.min)}円以上${fmt(r.max)}円未満`,`${fmt(r.kou[0])}円`,`${fmt(r.kou[1])}円`,`${fmt(r.otsu)}円`]);
}
assert.match(table.parentElement.previousElementSibling.textContent,/令和8年分.*居住者.*月払給与/);
assert.match(table.parentElement.previousElementSibling.textContent,/加算を含む表参照人数/);
assert.deepEqual([...doc.querySelectorAll('#official-pdf-table a[href^="https:"]')].map(a=>a.href.split('/').pop()),['01-07.pdf','08-14.pdf','15-16.pdf']);
console.log('✓ 代表3行の行・列・税額が正本JSONと一致、PDF入口3種を確認');
