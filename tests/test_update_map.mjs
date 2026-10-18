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
// Weekly maintenance regressions: context must carry the制度, never the number.
test('同じ100万円・10%を文脈で分類し、未知制度や設例だけなら未分類のまま',()=>{
  for(const [label,expected] of [
    ['青色申告特別控除','青色申告・必要経費の特例'],
    ['電子帳簿保存法','電子帳簿保存法'],
    ['償却資産税','登録免許税・不動産税'],
    ['通勤手当','給与の非課税・現物給与'],
    ['障害基礎年金の金額','年金額'],
    ['修繕費と資本的支出','減価償却・少額資産・修繕費'],
    ['雇用保険の加入条件','雇用保険の加入条件']
  ]) {
    for(const body of [`<p>${label}の基準は100万円、率は10%。</p>`,`<h2>${label}</h2><p>100万円、10%。</p>`,`<h2>案内</h2><h3>${label}</h3><p>100万円、10%。</p>`]) {
      const p=extract(body);
      for(const value of ['100万円','10%'])assert(byValue(p,value).at(-1).values.filter(v=>v.value===value).every(v=>v.topics.includes(expected)),label);
    }
  }
  for(const label of ['未知制度','設例','投資の想定収益','商品の割引']) {
    const p=extract(`<h2>${label}</h2><p>100万円、10%。</p>`);
    for(const value of ['100万円','10%'])assert.deepEqual(byValue(p,value)[0].values.find(v=>v.value===value).topics,['未分類']);
  }
  const separate=extract('<p>青色申告特別控除は65万円。未知制度の上限100万円、率10%。</p>');
  assert.deepEqual(byValue(separate,'100万円')[0].values.find(v=>v.value==='100万円').topics,['未分類']);
  assert.deepEqual(byValue(separate,'10%')[0].values.find(v=>v.value==='10%').topics,['未分類']);
  assert(!byValue(extract('<p>NISAの非課税限度額は100万円。</p>'),'100万円')[0].topics.includes('給与の非課税・現物給与'));
  assert(!byValue(extract('<p>給与所得及び退職所得以外の所得金額が20万円以下。</p>'),'20万円')[0].topics.includes('退職所得・退職所得控除'));
  assert(!byValue(extract('<p>障害基礎年金の受給権者は27万円・40万円の計算に入れません。</p>'),'27万円')[0].topics.includes('年金額'));
});
test('隣接する関連記事カードは別箇所・別文脈。掲載先の制度にも寄せない',()=>{
  const p=extract(`<title>年末調整</title><h2>次に読む</h2><div class="tool-grid">
    <a class="tool-card" id="card-income"><b>所得税の税率</b><span>10%</span></a><a class="tool-card" id="card-bank"><b>振込の反映時間</b><span>接続率74%</span></a><a class="tool-card" id="card-penalty"><b>延滞税</b><span>10%</span></a><a class="tool-card" id="card-unknown"><b>未知制度</b><span>100万円</span></a>
    </div><p id="inline">青色申告特別控除は<a href="#x">65万円</a>です。</p>`);
  const at=id=>p.occurrences.find(o=>o.location.element_id===id);
  assert.deepEqual(at('card-income').topics,['所得税の税率表・付加税']);
  assert.deepEqual(at('card-bank').topics,['振込の反映・全銀システム']);
  assert.deepEqual(at('card-penalty').topics,['延滞税・加算税・還付加算金']);
  assert.deepEqual(at('card-unknown').topics,['未分類']);
  assert.deepEqual(at('inline').topics,['青色申告・必要経費の特例']);
  assert.equal(p.audit.total,5);assert.equal(p.audit.missed.length,0);
  assert.equal(byValue(p,'10%').length,2);
  assert(!p.occurrences.some(o=>o.location.element==='div'));
});
test('表の列を優先し、番号の次の制度名を使い、隣のデータセルへは漏らさない',()=>{
  const p=extract(`<h2>比較</h2><table><thead><tr><th>番号</th><th>制度</th><th>上限</th></tr></thead><tbody>
    <tr><td>①</td><td>青色申告特別控除</td><td id="blue">100万円</td></tr>
    <tr><td>②</td><td>未知制度</td><td id="other">100万円</td></tr></tbody></table>
    <table><tr><th>区分</th><th>所得税の税率</th><th>法人税率</th><th>不明な率</th></tr>
    <tr><td>比較</td><td id="income">10%</td><td id="corp">10%</td><td id="unknown-rate">10%</td></tr></table>`);
  const at=id=>p.occurrences.find(o=>o.location.element_id===id);
  assert.deepEqual(at('blue').topics,['青色申告・必要経費の特例']);
  assert.equal(at('blue').location.table.row_subject,'①');
  assert.equal(at('blue').location.table.row_heading,'青色申告特別控除');
  assert.deepEqual(at('other').topics,['未分類']);
  assert.deepEqual(at('income').topics,['所得税の税率表・付加税']);
  assert.deepEqual(at('corp').topics,['法人税・減価償却']);
  assert.deepEqual(at('unknown-rate').topics,['未分類']);
  const isolated=extract('<table><tr><td>比較</td><td>通勤手当100万円</td><td id="isolated">10%</td></tr></table>');
  assert.deepEqual(isolated.occurrences.find(o=>o.location.element_id==='isolated').topics,['未分類']);
  const numbered=extract('<table><tr><th>番号</th><th>金額の説明</th><th>率</th></tr><tr><td>①</td><td>通勤手当100万円</td><td id="numbered-rate">10%</td></tr></table>');
  assert.deepEqual(numbered.occurrences.find(o=>o.location.element_id==='numbered-rate').topics,['未分類']);
});
test('改定単位の子テーマへ分け、無関係な見出しで明示制度を上書きしない',()=>{
  for(const [label,expected,parent] of [
    ['年末調整','年末調整の様式・計算','所得税・年末調整'],
    ['所得税の速算表','所得税の税率表・付加税','所得税・年末調整'],
    ['源泉徴収税額表','源泉徴収税額表','所得税・年末調整'],
    ['法定調書','源泉徴収票・法定調書','所得税・年末調整'],
    ['予定納税','予定納税','所得税・年末調整'],
    ['インボイスの仕入税額控除','インボイス・仕入税額控除の経過措置','消費税・インボイス'],
    ['減価償却の償却率','減価償却・少額資産・修繕費','法人税・減価償却'],
    ['時間外の割増賃金','労働時間・割増賃金','労働時間・休暇・労務制度'],
    ['年次有給休暇','年次有給休暇','労働時間・休暇・労務制度']
  ]) {
    const o=byValue(extract(`<h2>${label}</h2><p>100万円、10%。</p>`),'10%')[0];
    assert(o.topics.includes(expected),label);assert(!o.topics.includes(parent),label);
  }
  const refined=byValue(extract('<h2>年末調整</h2><p>所得税は100万円。</p>'),'100万円')[0];
  assert.deepEqual(refined.topics,['年末調整の様式・計算']);
  const explicit=byValue(extract('<h2>年末調整</h2><p>住民税は100万円。</p>'),'100万円')[0];
  assert.deepEqual(explicit.topics,['住民税']);
  const unrelated=byValue(extract('<h2>高額療養費</h2><p>所得税は100万円。</p>'),'100万円')[0];
  assert.deepEqual(unrelated.topics,['所得税・年末調整']);
});
test('正本監視の未接続11スラッグと既存スラッグを改定テーマへ結ぶ',()=>{
  const expected={
    'furikomi-hanei-jikan':'振込の反映・全銀システム',
    'koyou-hoken-kanyu-joken':'雇用保険の加入条件',
    'nenmatsu-chosei-gakushi-hoken':'保険料・医療費控除',
    'nenmatsu-chosei-teisei':'年末調整の様式・計算',
    'nisa-kinyu-kikan-henko':'NISA・iDeCo','ideco-jogen-kaisei':'NISA・iDeCo',
    'tokutei-kyushokusha-joseikin':'補助金・助成金','kodomo-nisa-2027-tetsuzuki':'NISA・iDeCo',
    'kyu-nisa-kazei-ikou':'NISA・iDeCo','kyoiku-shikin-zoyo-shuryo':'相続・贈与税',
    'kinyu-shotoku-kazei-2027':'所得税の税率表・付加税'
  };
  for(const [slug,name] of Object.entries(expected))assert(topics.find(t=>t.name===name).source_year_watches.some(w=>w.slug===slug),slug);
  // Freeze the previously connected slugs, too. A future, unconnected watch is
  // still a health-report warning, not a new publication gate via this test.
  const prior=[
    'hyojun-hoshu-gakuhyo','koyou-hokenryo-ritsu','rosai-hokenryoritsu','shataku-chintairyo',
    'gensen-zeigakuhyo-mikata','gensen-zeigakuhyo-r09','gensen-choshu','nenshu-no-kabe',
    'tokutei-shinzoku-tokubetsu-kojo','saitei-chingin','kogaku-ryoyohi','kounenrei-koyou-keizoku',
    'invoice-2wari-tokurei','invoice-wakariyasuku','shohizei-kanpu','taishokukin-zeikin',
    'taishoku-gensen-choshuhyo','hoteichosho-goukeihyo','gensen-shotokuzei-nofusho',
    'nenmatsu-chosei-kanpukin','shiharai-chosho','nenmatsu-chosei-kakikata','gensen-choshuhyo-mikata',
    'gensen-choshubo','kanai-rodosha-tokurei','kyuyo-shiharai-hokokusho','tsukin-teate-hikazei',
    'seimei-hokenryo-kojo','shokyaku-shisanzei','jidoshazei','furikomi-tesuryo-hikaku'
  ];
  for(const slug of prior)assert(topics.some(t=>t.source_year_watches.some(w=>w.slug===slug)),slug);
  for(const t of topics)for(const parent of t.refines||[])assert(topics.some(p=>p.name===parent),parent);
});
test('実ページの本文・表・metaにも接続し、名簿への登録だけで満足しない',()=>{
  for(const [slug,name] of [
    ['nenmatsu-chosei-teisei','年末調整の様式・計算'],
    ['nenmatsu-chosei-gakushi-hoken','保険料・医療費控除'],
    ['kinyu-shotoku-kazei-2027','所得税の税率表・付加税'],
    ['koyou-hoken-kanyu-joken','雇用保険の加入条件'],
    ['hoteichosho-goukeihyo','源泉徴収票・法定調書'],
    ['aoiro-tokubetsu-kojo','青色申告・必要経費の特例'],
    ['tsukin-teate-hikazei','給与の非課税・現物給与']
  ]) {
    const file=`docs/column/${slug}/index.html`;
    const p=extractPage(readFileSync(join(ROOT,file),'utf8'),`/column/${slug}/`,topics,file);
    assert(p.occurrences.some(o=>!o.location.generated_copy&&!o.location.candidate&&o.location.element!=='a'&&o.location.field==='text'&&o.values.some(v=>['amount','percent','date'].includes(v.kind)&&v.topics.includes(name))),slug);
    if(['hoteichosho-goukeihyo','aoiro-tokubetsu-kojo','tsukin-teate-hikazei'].includes(slug)) {
      assert(p.occurrences.some(o=>o.location.table&&o.values.some(v=>v.kind==='amount'&&v.topics.includes(name))),slug+' table');
      assert(p.occurrences.some(o=>o.location.element==='meta'&&o.values.some(v=>['amount','date'].includes(v.kind)&&v.topics.includes(name))),slug+' meta');
    }
  }
});
test('確認窓を年末調整・所得税率表・源泉表・法定調書・納付で分け、参照JSONの期日を継承',()=>{
  const get=name=>topics.find(t=>t.name===name);
  for(const [name,month] of [['年末調整の様式・計算',9],['所得税の税率表・付加税',1],['源泉徴収税額表',8],['源泉徴収票・法定調書',9],['源泉徴収の手続・納付',12]]) {
    const t=get(name);assert(t.next_revision.months.includes(month),name);
    for(const d of t.reference_data.filter(d=>d.next_review))assert(nextRevision(t,'2026-10-18').date<=d.next_review);
  }
  assert.deepEqual(get('所得税の税率表・付加税').reference_json,['docs/assets/shotokuzei_r08.json']);
  assert.deepEqual(get('年末調整の様式・計算').reference_json,['docs/assets/nencho_r08.json']);
  assert(!get('源泉徴収票・法定調書').reference_json.includes('docs/assets/nencho_r08.json'));
  assert.equal(nextRevision({...get('所得税の税率表・付加税'),reference_data:[]},'2026-10-18').date,'2026-12-01');
  assert.equal(nextRevision({...get('源泉徴収税額表'),reference_data:[]},'2026-10-18').date,'2027-01-01');
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
