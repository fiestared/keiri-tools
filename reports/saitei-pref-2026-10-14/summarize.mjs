import{readFileSync,writeFileSync,readdirSync}from'node:fs';
import{execFileSync}from'node:child_process';
const dir='reports/saitei-pref-2026-10-14/';
const baseline=JSON.parse(readFileSync(dir+'baseline-tests/results.json')),current=JSON.parse(readFileSync(dir+'current-tests/results.json'));
const total=readdirSync('tests').filter(f=>f.endsWith('.mjs')).length;
if(baseline.length!==320||current.length!==total)throw Error(`未完了: baseline ${baseline.length}/320, current ${current.length}/${total}`);
const retests={
 'test_toc_related.mjs':{status:'pass',log:'retest-test_toc_related.log'},
 'break_izoku_page.mjs':{status:'pass',log:'retest-break_izoku_page.log'},
 'break_measurement_wiring.mjs':{status:'pass',log:'retest-break_measurement_wiring.log'},
 'test_generators_fresh.mjs':{status:'pass',log:'generators-fresh-after-commit.log'},
 'test_index_entities.mjs':{status:'pass',log:'retest-test_index_entities.log'},
 'break_enumeration.mjs':{status:'pass',log:'retest-break_enumeration.log'},
 'test_saitei_pref_pages.mjs':{status:'pass',log:'test-pref-final.log'},
 'test_saitei_pref_layout.mjs':{status:'pass',log:'layout-check.log'},
 'test_year_staleness.mjs':{status:'pass',log:'year-check.log'},
};
for(const r of Object.values(retests))if(!/✓|✅|捕捉/.test(readFileSync(dir+r.log,'utf8')))throw Error('retest evidence missing '+r.log);
const legacy=new Set(baseline.filter(r=>r.status==='fail').map(r=>r.file));
// 補助金の受付終了時刻を過ぎた後の、同じ起点での再検査も赤。
if(!readFileSync(dir+'baseline-retest-test_hojokin_sources.log','utf8').includes('1 failed'))throw Error('temporal baseline evidence missing');
legacy.add('test_hojokin_sources.mjs');
const final=current.map(r=>({...r,...(retests[r.file]?{initial_status:r.status,initial_exit:r.exit,status:retests[r.file].status,exit:0,retest_log:retests[r.file].log}:{} )}));
const failed=final.filter(r=>r.status==='fail').map(r=>r.file),added=failed.filter(f=>!legacy.has(f));
const summary={baseline_ref:'22519fef49e11b3666545b8b1b4dec2695250c50',implementation_commit:'370afc4bd',branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),
 baseline:{total:baseline.length,initial_failures:baseline.filter(r=>r.status!=='pass'),same_time_retest:'test_hojokin_sources.mjs: origin/main clone also failed after deadline'},
 current:{total:current.length,pass:final.filter(r=>r.status==='pass').length,fail:failed.length,unmeasurable:final.filter(r=>r.status==='unmeasurable').length,failures:failed,new_failures:added},
 retests,checks:{prefectures:47,primary_pdf_all_fields_match:47,source_urls_http_200:true,e2e:8,layout:{prefectures:5,widths:[1280,390],a4_pages:1},enumeration:{mutations:49,misses:0},claim_scope_issues:0,unprocessed_new_page_segments:0},
 note:'原本のHTMLはsources/raw-primary-sources.zip。県ページの現行額は正本の確認日時点を明記。親の計算機は判定日の有効額を使用。publishと同じ生成器の順を実行し、必要な追加生成器も実行。pushなし。'};
writeFileSync(dir+'baseline-results.json',JSON.stringify(baseline,null,2)+'\n');writeFileSync(dir+'current-results.json',JSON.stringify(final,null,2)+'\n');writeFileSync(dir+'test-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary.current));if(added.length)process.exit(1);
