from pathlib import Path
import json,subprocess,os
root=Path(__file__).resolve().parents[2];os.chdir(root);out=root/'review/r17-t5-a'
assert (out/'resumed-tests.rc').exists(),'full run must finish before retry'
initial=json.loads((out/'test-results.json').read_text());baseline={'tests/test_hojokin_sources.mjs','tests/test_layout_visual.mjs'}
results=[]
for x in initial:
 if not x['rc'] or x['file'] in baseline:continue
 f=x['file'];p=out/('retry-'+Path(f).name+'.log');print('START',f,flush=True)
 with p.open('w') as log:r=subprocess.run(['python3' if f.endswith('.py') else 'node',f],stdout=log,stderr=subprocess.STDOUT)
 results.append({'file':f,'initial_rc':x['rc'],'retry_rc':r.returncode,'log':str(p.relative_to(root))})
 (out/'retry-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
 print('END',f,r.returncode,flush=True)
 if r.returncode:print('\n'.join(p.read_text().splitlines()[-15:]),flush=True)
(out/'retry-tests.rc').write_text('1\n' if any(x['retry_rc'] for x in results) else '0\n')
print('DONE',json.dumps(results,ensure_ascii=False),flush=True)
