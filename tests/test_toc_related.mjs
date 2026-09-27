import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalog,generate,clean} from '../tools/gen_toc_related.mjs';
import {isNavOnlyDiff} from '../tools/nav_experiment.mjs';
const pages=catalog();const rows=generate(pages);
assert(rows.length>400);
for(const r of rows){
 assert(!r.changed,`${r.path}: generator --check stale`);
 const old=clean(pages.get(r.path).html);
 assert.equal(clean(r.html),clean(old),r.path+': body / dates / handmade / next-read / PR changed');
 assert(isNavOnlyDiff(old.split('\n'),r.html.split('\n')),r.path+': navigation must not refresh modification date');
 assert(r.picks.length>=2&&r.picks.length<=3);
 assert.equal(new Set(r.picks).size,r.picks.length);
 assert(!r.picks.includes(r.path));
}
// An unregistered future page is discovered by TOC, never an experiment allowlist.
const sample=pages.get('/column/shakai-hoken-kanyu-joken/');
const fresh={...sample,html:clean(sample.html)};pages.set('/column/new-page-fixture/',fresh);
const next=generate(pages).find(r=>r.path==='/column/new-page-fixture/');
assert(next.changed&&next.html.includes('toc_related_v1'));
const broken=rows[0].html.replace(/<!--rail-next:S-->[\s\S]*?<!--rail-next:E-->/,'');
pages.set(rows[0].path,{...pages.get(rows[0].path),html:broken});
assert(generate(pages).find(r=>r.path===rows[0].path).changed,'missing rail must fail --check');
console.log(`✓ ${rows.length} public TOCs; byte-preserved body, dates, PR and next-read; new-page and missing-rail checks`);
