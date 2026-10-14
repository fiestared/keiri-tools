import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ageTable, ageOnDate, seirekiToWareki, warekiToSeireki, isLeapYear } from '../docs/assets/nenrei_core.js';
const transitions = [
  ['1912-07-29', '明治45年7月29日', '1912-07-30', '大正元年7月30日'],
  ['1926-12-24', '大正15年12月24日', '1926-12-25', '昭和元年12月25日'],
  ['1989-01-07', '昭和64年1月7日', '1989-01-08', '平成元年1月8日'],
  ['2019-04-30', '平成31年4月30日', '2019-05-01', '令和元年5月1日'],
];
for (const row of transitions) for (let i = 0; i < 4; i += 2) {
  assert.equal(seirekiToWareki(...row[i].split('-')), row[i + 1]);
  const [, era, eraYear, m, d] = row[i + 1].match(/(明治|大正|昭和|平成|令和)(元|\d+)年(\d+)月(\d+)日/);
  assert.equal(warekiToSeireki(era, eraYear, m, d), row[i].split('-').map(Number).join('年').replace(/年(\d+)年(\d+)$/, '年$1月$2日'));
}
assert.equal(seirekiToWareki(1868), '明治元年');
assert.equal(warekiToSeireki('明治', '元'), '1868年');
assert.equal(seirekiToWareki(1873,1,1), '明治6年1月1日');
assert.equal(seirekiToWareki(1912), '明治45年／大正元年');
assert.equal(seirekiToWareki(1989), '昭和64年／平成元年');
assert.equal(seirekiToWareki(2019), '平成31年／令和元年');
assert.equal(warekiToSeireki('令和', '元年', 5, 1), '2019年5月1日');
for (const args of [['令和',1,4,30],['平成',31,5,1],['昭和',64,1,8],['大正',1,7,29],['明治',45,7,30]]) assert.throws(() => warekiToSeireki(...args), /期間外/);
for (const args of [[2026,2,29],[1900,2,29],[2026,4,31],[2026,2,''],['',2,1],[2026.5],[1867],[10000],[1872,12,2]]) assert.throws(() => seirekiToWareki(...args));
for (const args of [['平成',0],['昭和',65],['大正',16],['明治',46],['令和','1e1'],['令和','']]) assert.throws(() => warekiToSeireki(...args));
assert.equal(isLeapYear(1900), false); assert.equal(isLeapYear(2000), true); assert.equal(isLeapYear(2100), false);
for (const [date, age] of [['2026-02-27',25],['2026-02-28',25],['2026-03-01',26],['2024-02-28',23],['2024-02-29',24],['2024-03-01',24]]) assert.equal(ageOnDate('2000-02-29',date),age);
assert.equal(ageOnDate('2000-01-01','2026-01-01'),26);
assert.equal(ageOnDate('2000-12-31','2026-12-30'),25);
assert.equal(ageOnDate('2000-12-31','2026-12-31'),26);
assert.equal(ageOnDate('2026-10-14','2026-10-14'),0);
assert.throws(() => ageOnDate('2027-01-01','2026-12-31'));
assert.throws(() => ageOnDate('2000-02-30','2026-01-01'));
const html=readFileSync(new URL('../docs/nenrei-hayami/index.html',import.meta.url),'utf8');
// Independently inspect every static age cell, including the oldest and birth-year rows.
for (const year of [2026,2027]) {
  const dom=new JSDOM(html), section=dom.window.document.querySelector(`.nenrei-year[data-year="${year}"]`);
  const rows=[...section.querySelectorAll('tbody tr')];
  assert.equal(rows.length,121);
  for(const row of rows){
    const birth=Number(row.dataset.birthYear), [displayBirth,wareki,before,after]=[...row.children].map(el=>el.textContent);
    assert.equal(displayBirth,`${birth}年`);assert.equal(before,birth===year?'出生前':`${year-birth-1}歳`);assert.equal(after,`${year-birth}歳`);
    const eras=[['明治',1868,1912],['大正',1912,1926],['昭和',1926,1989],['平成',1989,2019],['令和',2019,9999]];
    const expected=eras.filter(([,first,last])=>birth>=first&&birth<=last).map(([name,first])=>`${name}${birth===first?'元':birth-first+1}年`).join('／');
    assert.equal(wareki,expected);
  }
  dom.window.close();
  assert.equal(ageTable(year).length,121);
}
assert.ok(!html.includes('干支') && !html.includes('学年'));
execFileSync(process.execPath,['tools/gen_nenrei_hayami.mjs','--check']);
console.log('✓ 年齢・閏日・改元境界・入力検証・静的早見表242行');
