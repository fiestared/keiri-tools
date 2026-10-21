// Reproduce the full-site gate's unchanged-page counterexamples on frozen origin/main.
// This does not claim that every baseline viewport was rerun.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready} from './origin-baseline/tests/layout/browser.mjs';
import {measure} from './origin-baseline/tests/layout/measure.mjs';
import {measureUi} from './origin-baseline/tests/layout/ui-measure.mjs';
import {measureEmpty} from './origin-baseline/tests/layout/empty-measure.mjs';
import {measureTables} from './origin-baseline/tests/layout/table-measure.mjs';
const dir=new URL('./',import.meta.url),width=390,height=844;
const raw=JSON.parse(readFileSync(new URL('../../.layout-artifacts/render.json',import.meta.url)));
const cases=[['/column/jikou-engyo/','table-no-number-visible'],['/nenkin/','svg-text-small']];
const {chromium}=await browserTools(),server=await serve();let b;const results=[];
try{
 b=await chromium.launch();const c=await contextFor(b,server.origin,width),p=await c.newPage();
 for(const [url,kind] of cases){
  const current=raw.find(r=>r.url===url&&r.width===width);assert(current?.issues.some(i=>i.kind===kind));
  assert.equal(execFileSync('git',['diff','--name-only','--','docs'+url+'index.html'],{encoding:'utf8'}).trim(),'','対象ページは無変更');
  await p.setViewportSize({width,height});await ready(p,server.origin+url);
  const measured=await p.evaluate(measure);measured.issues.push(...await p.evaluate(measureUi),...await p.evaluate(measureEmpty),...await p.evaluate(measureTables));
  const common=current.issues.filter(a=>measured.issues.some(z=>a.kind===z.kind&&a.text===z.text&&a.id===z.id&&a.table===z.table));
  results.push({url,width,height,current_issues:current.issues,baseline_issues:measured.issues,common_issues:common});
 }
 await c.close();
}finally{await b?.close();server.close();}
const baseline=execFileSync('git',['rev-parse','HEAD'],{cwd:new URL('./origin-baseline/',dir),encoding:'utf8'}).trim();
writeFileSync(new URL('baseline-layout-proof.json',dir),JSON.stringify({baseline_sha:baseline,results,full_baseline_rerun:false},null,2)+'\n');
assert(results.every(r=>r.common_issues.length===r.current_issues.length),'同じ要素・検査項目の失敗をbaselineでも再現');
const file=new URL('comparison.json',dir),rows=JSON.parse(readFileSync(file)).filter(r=>r.file!=='test_layout_render.mjs');
rows.push({file:'test_layout_render.mjs',first_exit:1,baseline_sha:baseline,baseline_probe_exit:0,baseline_assertion_failed:true,baseline_full_rerun:false,verdict:'also_fails_on_origin_main',note:'無変更の時効記事の表と年金ツールの図を、同じURL・390px・同じmeasure/measureTablesでorigin/mainでも再現。baseline全画面の再走ではない。baseline-layout-proof.json参照'});
writeFileSync(file,JSON.stringify(rows,null,2)+'\n');console.log('PASS: 無変更2ページの同一要素・同一幅・同じ検査関数でorigin/mainにも反例あり');
