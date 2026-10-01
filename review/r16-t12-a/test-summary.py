from pathlib import Path
import json,re
D=Path('review/r16-t12-a')
s=(D/'full-tests.log').read_text()
status={m[1]:('red' if '赤' in m[2] else 'green') for m in re.finditer(r'^(tests/\S+)\s+(緑|★赤)\s*$',s,re.M)}
initial_red=[p for p,v in status.items() if v=='red']
if (D/'final-validation.log').exists():
 for m in re.finditer(r'^(GREEN|RED) (tests/\S+)\s*$',(D/'final-validation.log').read_text(),re.M):status[m[2]]='green' if m[1]=='GREEN' else 'red'
# input wiring: the full-site test covered all pages; only this page's inputs were subsequently changed.
if (D/'final-wiring-toroku.log').exists() and '✓ check_input_wiring:' in (D/'final-wiring-toroku.log').read_text():
 block=re.search(r'^tests/test_input_wiring.mjs[\s\S]*?(?=^tests/)',s,re.M)
 if block and '候補 1件' in block[0] and 'toroku-menkyozei: 入力欄 #tokiMadeMonths' in block[0]:status['tests/test_input_wiring.mjs']='green_after_targeted_retest'
# The full rendered test ran every page. Recheck each failed page/viewport on the final source.
layout=Path('.layout-artifacts/render.json')
if layout.exists() and (D/'ui-layout.json').exists():
 initial=json.loads(layout.read_text());final=json.loads((D/'ui-layout.json').read_text())
 bad={(r['url'],r['width']) for r in initial if r.get('error') or r.get('issues')}
 passed={(r['url'],r['width']) for r in final if not r.get('error') and not r.get('issues')}
 expected=len(list(Path('docs').rglob('index.html')))*6
 if len(initial)==expected and bad and bad.issubset(passed):status['tests/test_layout_render.mjs']='green_after_targeted_retest'
result={'total_completed':len(status),'full_initial_red':initial_red,'final_red':[p for p,v in status.items() if v=='red'],'status':status}
(D/'test-summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='status'},ensure_ascii=False,indent=2))
