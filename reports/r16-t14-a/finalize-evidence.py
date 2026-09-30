import json
from pathlib import Path
p=Path('reports/r16-t14-a')
initial=json.loads((p/'full-test-initial-summary.json').read_text())
rechecks={'tests/break_enumeration.mjs':'enumeration-final','tests/test_boundary_cases.mjs':'boundaries-final','tests/test_layout_markup.mjs':'layout-markup-final','tests/test_layout_render.mjs':'layout-render-final','tests/test_qa.mjs':'qa-final','tests/test_tool_related.mjs':'tool-related-final'}
for test,name in rechecks.items():assert (p/(name+'.exit')).read_text().strip()=='0',test
for name in ['claims-final','conditions-final','generators-last']:assert (p/(name+'.exit')).read_text().strip()=='0',name
remaining=[x for x in initial['red'] if x not in rechecks]
assert remaining==['tests/test_hojokin_sources.mjs','tests/test_layout_visual.mjs'],remaining
render=json.loads((p/'layout-final/render.json').read_text());assert len(render)==3084 and not any(x.get('error') or x.get('issues') for x in render)
summary={'pages':len(set(x['url'] for x in render)),'viewports':len(render),'failed_viewports':0,'full_measurements':'reports/r16-t14-a/layout-final/render.json (local artifact; excluded from git)'}
(p/'layout-final-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
pages={x['page'].removeprefix('docs').removesuffix('index.html') for x in json.loads((p/'coverage-after.json').read_text())}
(p/'layout-targets-final.json').write_text(json.dumps([x for x in render if x['url'] in pages],ensure_ascii=False,indent=2)+'\n')
status={'baseline_red_supplied_by_user':remaining,'baseline_measured':'partial run only; test_hojokin_sources failure observed; stopped during test_input_wiring','full_initial':initial,'rechecks':{t:{'exit':0,'log':str(p/(n+'.log'))} for t,n in rechecks.items()},'final_aggregate':{'green':initial['total']-len(remaining),'red':remaining,'note':'Full 294-file run plus successful reruns of all six new failures; not a claim that one final full run was entirely green.'}}
(p/'test-status-final.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(status['final_aggregate'],ensure_ascii=False));print(summary)
