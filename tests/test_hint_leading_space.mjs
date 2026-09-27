// 入力欄の補足（.hint）の先頭に全角スペースを置かない（2026-09-27）。
// 補足がラベルの横にあった頃の区切りの名残で、入力欄の下へ移すと1字ぶん字下げされ、
// 折り返した2行目だけ左にずれる（/iryohi/ など53ページ191か所）。
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {ROOT} from './layout/browser.mjs';

const RE = /<(?:span|p|small|div)\b[^>]*\bclass="hint"[^>]*>[ \t]*　/g;
function* pages(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* pages(p);
    else if (name === 'index.html') yield p;
  }
}
function offenders(html) { return html.match(RE) || []; }

// 壊して試す: 検査が実際に拾うことを先に確かめる
assert.equal(offenders('<span id="a-hint" class="hint">　補足</span>').length, 1);
assert.equal(offenders('<span id="a-hint" class="hint">補足　です</span>').length, 0);

const bad = [];
for (const f of pages(join(ROOT, 'docs'))) {
  const n = offenders(readFileSync(f, 'utf8')).length;
  if (n) bad.push(`${relative(ROOT, f)} (${n})`);
}
assert.equal(bad.length, 0, `補足の先頭に全角スペース: ${bad.join(', ')}`);
console.log('ok: .hint の先頭に全角スペースなし');
