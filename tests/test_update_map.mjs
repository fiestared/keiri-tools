#!/usr/bin/env node
// Extraction regressions only. Deliberately never compare maintenance outputs or their freshness.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, extractValues, extractPage, loadTopics, buildUpdateMap, renderMarkdown, nextRevision, serializeUpdateMap } from '../tools/gen_update_map.mjs';
import { JSDOM } from 'jsdom';
const topics=loadTopics();
const extract=html=>extractPage(html,'/fixture/',topics,'docs/fixture/index.html');
const byValue=(p,v)=>p.occurrences.filter(o=>o.values.some(n=>n.value===v));
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('✓ '+name);};

// Baseline: actual maintained page first. Never mutate the worktree's docs/.
const known=readFileSync(join(ROOT,'docs/shakai-hoken/index.html'),'utf8');
const baseline=extractPage(known,'/shakai-hoken/',topics,'docs/shakai-hoken/index.html');
test('無傷の公開ページで協会けんぽ料率と見出し位置を抽出（率・見出し名を固定しない）',()=>{
  assert(baseline.occurrences.some(o=>o.values.some(v=>v.kind==='percent'&&v.topics.includes('協会けんぽ料率'))&&o.location.h2&&!o.location.generated_copy));
});
const fixture=`<!doctype html><html><head><title>協会けんぽ料率 令和8年度</title>
<meta name="description" content="協会けんぽの料率9.85%。"><style>.x{width:100px}</style>
<script type="application/ld+json">{"@type":"FAQPage","description":"協会けんぽの料率9.85%。"}</script></head>
<body><h2 id="rates">協会けんぽ料率</h2><div class="callout"><b>協会けんぽ9.85%</b><p id="body-rate">料率は9.85%です。</p></div>
<p id="dates">2026年<span>8月</span><span>1日</span>から、前年9月30日まで。支払基礎日数17日、6か月。</p>
<table><thead><tr><th rowspan="2">区分</th><th colspan="2">保険</th></tr><tr><th>健康保険料率</th><th>介護保険料率</th></tr></thead>
<tbody><tr><td>母親が受け取る場合</td><td>9.85%</td><td>1.62%</td></tr><tr><td>父親（配偶者欄に母親）</td><td>9.85%</td><td>1.62%</td></tr></tbody></table>
<h2 id="faq">よくある質問</h2><h3 id="q1">協会けんぽ料率は？</h3><p id="faq-rate">料率は9.85%です。</p>
<svg aria-label="協会けんぽ9.85%"><title>料率9.85%</title><text>9.85%</text><text>10万円</text></svg>
<p id="unknown">未知制度の上限123円。１億２千万円、3万5,000円、550円、0円、９．８５％。</p>
<script>// コメントの古い9.99%は抽出しない
const width=100; const result='介護保険料率1.62%です'; const url='https://example.test/20万円';</script>
</body></html>`;
const good=extract(fixture);
test('fixtureのベースライン・同じ値の本文FAQを別箇所にする',()=>{
  const occurrences=byValue(good,'9.85%');
  assert(occurrences.some(o=>o.location.element_id==='body-rate'));
  assert(occurrences.some(o=>o.location.element_id==='faq-rate'));
  assert.equal(new Set(good.occurrences.map(o=>o.id)).size,good.occurrences.length);
});
test('年のない日付を含め1日・30日を日数と誤認しない',()=>{
  const values=byValue(good,'17日')[0].values;
  assert(values.some(v=>v.kind==='date'&&v.value==='2026年8月1日'));
  assert(values.some(v=>v.kind==='date'&&v.value==='9月30日'));
  assert(!values.some(v=>v.kind==='duration'&&['1日','30日'].includes(v.value)));
  assert(values.some(v=>v.kind==='duration'&&v.value==='17日'));
  assert(values.some(v=>v.kind==='duration'&&v.value==='6か月'));
});
test('title/meta・図・aria・JSON-LD・JS表示候補は拾いCSS・コメント・URLは拾わない',()=>{
  for(const field of ['content','aria-label','jsonld:/description','js_string:1'])assert(good.occurrences.some(o=>o.location.field===field));
  assert(!byValue(good,'9.99%').length);
  assert(!byValue(good,'20万円').length);
  assert(!byValue(good,'100px').length);
  assert.equal(good.audit.missed.length,0);
});
test('表の主語セル・複段見出し・列と要素が一意',()=>{
  const rates=byValue(good,'1.62%').filter(o=>o.location.table);
  assert.equal(rates.length,2);
  assert.equal(rates[0].location.table.row_subject,'母親が受け取る場合');
  assert.equal(rates[1].location.table.row_subject,'父親（配偶者欄に母親）');
  assert.equal(rates[0].location.table.column_heading,'保険 / 介護保険料率');
  assert(rates.every(o=>o.topics.includes('介護保険料率')&&!o.topics.includes('協会けんぽ料率')));
  const dom=new JSDOM(fixture);for(const o of good.occurrences)assert.equal(dom.window.document.querySelectorAll(o.location.selector).length,1);dom.window.close();
});
test('金額の表記系統・未分類値を捨てない',()=>{
  const vs=extractValues('１億２千万円 3万5,000円 550円 0円 ９．８５％ 5/1000 25等級 改正後 予定');
  for(const value of ['１億２千万円','3万5,000円','550円','0円','９．８５％','5/1000','25等級','改正後','予定'])assert(vs.some(v=>v.value===value),value);
  const unknown=extract('<p>未知の制度は123円、料率7.777%。</p>');
  assert(byValue(unknown,'123円')[0].topics.includes('未分類'));
  assert(byValue(unknown,'7.777%')[0].topics.includes('未分類'));
});
test('複数年分・金額範囲の下端・単位なし等級セルを落とさない',()=>{
  for(const value of ['令和8・9年分','2026〜2027年','136〜159万円','1.5〜2%','19〜22歳','1〜50等級'])assert(extractValues(value).some(v=>v.value===value),value);
  const p=extract('<h2 id="s">標準報酬月額表</h2><table><thead><tr><th>健康保険の等級</th><th>標準報酬月額</th></tr></thead><tr><td>1</td><td>58,000</td></tr></table>');
  assert(byValue(p,'1').some(o=>o.values.some(v=>v.kind==='inferred_grade')));
  assert(byValue(p,'58,000').some(o=>o.values.some(v=>v.kind==='table_number')));
  assert.equal(p.audit.total,0); // inferred units must not inflate explicit円/% denominator
});
test('別要素の単位なし数字を金額へ結合しない（独立分母も）',()=>{
  const p=extract('<svg><text>200万</text><text>400万</text><text>11万円</text></svg><table><tr><td>百分の三十三</td><td>千八百万円</td></tr></table>');
  assert.equal(p.audit.missed.length,0);
  assert.equal(p.audit.total,2);
  assert(!byValue(p,'200万400万11万円').length);
});
test('同値のFAQを残して本文だけ変更すると本文の位置だけ変わる',()=>{
  const broken=extract(fixture.replace('<p id="body-rate">料率は9.85%です。</p>','<p id="body-rate">料率は8.88%です。</p>'));
  assert.equal(byValue(broken,'8.88%')[0].location.element_id,'body-rate');
  assert(!byValue(broken,'9.85%').some(o=>o.location.element_id==='body-rate'));
  assert(byValue(broken,'9.85%').some(o=>o.location.element_id==='faq-rate'));
  const removed=extract(fixture.replace('<p id="body-rate">料率は9.85%です。</p>','<p id="body-rate">料率の説明です。</p>'));
  assert(!byValue(removed,'9.85%').some(o=>o.location.element_id==='body-rate'));
  assert(byValue(removed,'9.85%').some(o=>o.location.element==='div')); // callout headline still present
});
test('確認目安は現在の窓→翌月、過ぎたdata.next_reviewは本日',()=>{
  const t=topics.find(t=>t.name==='最低賃金');assert.equal(nextRevision(t,'2026-10-14').date,'2026-10-14');
  assert.equal(nextRevision({...t,reference_data:[]},'2026-12-31').date,'2026-12-31');
  assert.equal(nextRevision({...t,reference_data:[]},'2027-01-01').date,'2027-08-01');
  assert.equal(nextRevision({...t,reference_data:[{file:'x',next_review:'2026-10-01'}]},'2026-10-14').date,'2026-10-14');
});
const temp=mkdtempSync(join(tmpdir(),'keiri-update-map-'));
try {
  for(const dir of ['tools','docs/fixture','docs/noindex','docs/hidden','docs/assets'])mkdirSync(join(temp,dir),{recursive:true});
  for(const file of ['update_map_topics.json','source_year_registry.json','citation_date_registry.json','source_registry.json'])cpSync(join(ROOT,'tools',file),join(temp,'tools',file));
  writeFileSync(join(temp,'docs/fixture/index.html'),fixture.replace('</body>','<script src="../assets/loader.js"></script></body>'));
  writeFileSync(join(temp,'docs/noindex/index.html'),'<meta name="robots" content="noindex,follow"><p>123円</p>');
  writeFileSync(join(temp,'docs/hidden/index.html'),'<p>令和8年、123円</p>');writeFileSync(join(temp,'docs/hidden/.nopublish'),'');
  writeFileSync(join(temp,'docs/assets/loader.js'),"// import './ghost.js';\nimport './data.js'; fetch('./rates_'+year+'.json');");
  writeFileSync(join(temp,'docs/assets/ghost.js'),"fetch('./unused.json');");
  writeFileSync(join(temp,'docs/assets/unused.json'),JSON.stringify({year:'令和0年'}));
  writeFileSync(join(temp,'docs/assets/data.js'),"fetch('/assets/shaho_rates_r08.json');");
  writeFileSync(join(temp,'docs/assets/shaho_rates_r08.json'),JSON.stringify({_meta:{year:'令和99年度'},rate:0.1}));
  const map=buildUpdateMap({root:temp,today:'2026-10-14'});
  test('全ページ探索・noindexと.nopublish別枠・間接依存の宣言年版・動的依存の未解決',()=>{
    assert.equal(map.summary.pages,3);assert.equal(map.summary.public_pages,1);assert.equal(map.summary.excluded_pages,2);
    const packed=JSON.parse(JSON.stringify(serializeUpdateMap(map)));
    for(const page of Object.values(packed.pages))for(const o of page.occurrences){
      const location=page.locations[o.location_ref];assert(location);if(location.h2_ref)assert(page.headings[location.h2_ref]);if(location.h3_ref)assert(page.headings[location.h3_ref]);
    }
    const p=map.pages['/fixture/'],dep=p.dependencies.data.find(d=>d.file==='docs/assets/shaho_rates_r08.json');
    assert(!p.dependencies.data.some(d=>d.file.endsWith('/unused.json')));
    assert.equal(dep.year,'令和99年度');assert.equal(dep.year_origin,'_meta.year');
    assert(dep.via.some(v=>v.chain.includes('docs/assets/loader.js')));
    assert(p.dependencies.unresolved.some(u=>u.expression.includes('rates_')));
    assert.equal(map.summary.coverage.missed_count,0);
    assert.equal(map.summary.coverage.total,map.summary.coverage.classified+map.summary.coverage.unclassified);
    for(const p of Object.values(map.pages))for(const o of p.occurrences)for(const name of o.topics)assert(map.topics[name].pages[p.page].includes(o.id));
  });
  test('絞り込みMarkdown・未知名はエラー・保存済み台帳の鮮度を検査しない',()=>{
    const filtered=renderMarkdown(map,{topic:'介護保険料率'});assert(filtered.includes('1.62%'));
    assert(renderMarkdown(map,{page:'/fixture/'}).includes('令和99年度'));
    assert.throws(()=>renderMarkdown(map,{topic:'存在しない'}));
    assert.throws(()=>renderMarkdown(map,{page:'/none/'}));
    const full=renderMarkdown(map);assert(full.includes('未分類の値'));assert(full.includes('別枠'));
  });
} finally {rmSync(temp,{recursive:true,force:true});}
test('CLI不正引数で生成を始めない',()=>{
  const p=spawnSync(process.execPath,['tools/gen_update_map.mjs','--topic'],{cwd:ROOT,encoding:'utf8'});assert.notEqual(p.status,0);assert(p.stderr.includes('値が必要'));
});
console.log(`更新マップ ${checks}件緑（本文・公開検査・保存済み台帳は変更しない）`);
