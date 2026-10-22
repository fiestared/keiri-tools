import json,subprocess
from pathlib import Path
b=Path('reports/tedori-series-2026-10-21'); rows=json.loads((b/'tests/results.json').read_text());expected=sorted(p.name for p in Path('tests').glob('*.mjs'))
assert sorted(r['file'] for r in rows)==expected, '全件完走が必要'
comparison=json.loads((b/'comparison.json').read_text());classified={r['file']:r for r in comparison}
failed=[r for r in rows if r['code']!=0]
assert all(r['file'] in classified for r in failed), '未分類の失敗あり'
assert all(classified[r['file']]['verdict'] in ['fixed_in_branch','also_fails_on_origin_main','transient_resolved','runtime_timeout_resolved','measurement_failed_both','environment_mismatch_on_both'] for r in failed), '未解決の差分起因あり'
checks=json.loads((b/'final-checks.json').read_text());assert all(r['exit']==0 for r in checks)
assert {'tests/test_favicon.mjs','tests/test_tedori_income.mjs','tests/test_generators_fresh.mjs','tools/check_claims.mjs'}.issubset({r['args'][1] for r in checks}), '最終検査が未完了'
assert '数字を含む単位 0 ' not in (b/'final-scope.log').read_text(); assert '条件の抜け 0' in (b/'final-scope.log').read_text()
assert '✅ tedori_income' in (b/'final-e2e.log').read_text() and 'all e2e scenes passed' in (b/'final-e2e.log').read_text()
visual=json.loads((b/'final-visual.json').read_text());assert all(not r.get('issues') and not r.get('error') for r in visual)
visual_pages=json.loads(Path('tools/static_pages.d/tedori_income.json').read_text())['pages']
expected_visual={('/'+page,width) for page in visual_pages for width in [1280,1536,1920,1200,768,390]}
assert len(visual)==len(expected_visual) and {(r['url'],r['width']) for r in visual}==expected_visual, '新14ページの全84画面の記録が必要'
counts={key:sum(c['verdict']==key for c in comparison) for key in set(c['verdict'] for c in comparison)}
summary={'total':len(rows),'first_pass':len(rows)-len(failed),'first_failed':len(failed),'classifications':counts,'baseline_sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=b/'origin-baseline',text=True).strip()}
(b/'final-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False))
