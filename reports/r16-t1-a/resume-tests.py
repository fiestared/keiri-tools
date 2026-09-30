import os,json,re,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parents[2];os.chdir(root)
out=root/'reports/r16-t1-a';state=out/'test-results.json'
files=sorted(str(p) for p in Path('tests').glob('*.mjs'))+sorted(str(p) for p in Path('tests').glob('test_*.py'))
if state.exists():results=json.loads(state.read_text())
else:
 text=(out/'full-tests.log').read_text();results=[{'file':m[1],'exit_code':0 if m[2]=='緑' else 1,'run':'initial-interrupted'} for m in re.finditer(r'^(tests/\S+)\s+(緑|★赤)$',text,re.M)]
completed={r['file'] for r in results};logs=out/'test-logs';logs.mkdir(exist_ok=True)
lock=Path('.run_tests.lock');lock.mkdir();(lock/'pid').write_text(str(os.getpid()))
try:
 for file in files:
  if file in completed:continue
  stamp=time.strftime('%Y-%m-%d %H:%M:%S %Z');print(stamp,'START',file,flush=True)
  (out/'test-current.json').write_text(json.dumps({'file':file,'started':stamp,'pid':os.getpid()}))
  start=time.time();log=logs/(Path(file).name+'.log')
  with log.open('w') as f:
   r=subprocess.run([sys.executable if file.endswith('.py') else 'node',file],stdout=f,stderr=subprocess.STDOUT,env={**os.environ,'PLAYWRIGHT_PATH':'/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js'})
  item={'file':file,'exit_code':r.returncode,'run':'resumed','seconds':round(time.time()-start,2),'log':str(log.relative_to(root))};results.append(item);state.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print('END',file,r.returncode,flush=True)
 (out/'test-current.json').write_text(json.dumps({'status':'complete','total':len(files),'completed':len(results),'failed':[r['file'] for r in results if r['exit_code']]}))
 print('COMPLETE',len(results),'failed',sum(r['exit_code']!=0 for r in results),flush=True)
finally:
 (lock/'pid').unlink(missing_ok=True);lock.rmdir()
