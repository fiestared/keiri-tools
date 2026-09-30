from pathlib import Path
import subprocess,re,json,os,time
root=Path(__file__).resolve().parents[2];os.chdir(root)
out=root/'review/r17-t5-a';initial=(out/'full-tests.log').read_text()
results=[{'file':m[1],'rc':0 if m[2]=='緑' else 1,'attempt':'initial'} for m in re.finditer(r'^(tests/\S+)\s+(緑|★赤)$',initial,re.M)]
files=sorted(str(p) for p in Path('tests').glob('*.mjs'))+sorted(str(p) for p in Path('tests').glob('test_*.py'))
completed={x['file'] for x in results}
(out/'resumed-tests.pid').write_text(str(os.getpid()))
for f in files:
 if f in completed:continue
 print('START',f,flush=True)
 runner='python3' if f.endswith('.py') else 'node'
 log=out/('test-'+Path(f).name+'.log')
 with log.open('w') as stream:r=subprocess.run([runner,f],stdout=stream,stderr=subprocess.STDOUT)
 results.append({'file':f,'rc':r.returncode,'attempt':'resumed','log':str(log.relative_to(root))})
 (out/'test-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
 print('END',f,r.returncode,flush=True)
 if r.returncode:print('\n'.join(log.read_text().splitlines()[-12:]),flush=True)
assert len(results)==len(files),(len(results),len(files))
red=[r for r in results if r['rc']]
print('TOTAL',len(files),'GREEN',len(files)-len(red),'RED',len(red),flush=True)
print(json.dumps(red,ensure_ascii=False),flush=True)
(out/'resumed-tests.rc').write_text('1\n' if red else '0\n')
