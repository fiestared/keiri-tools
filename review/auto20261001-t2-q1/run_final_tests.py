# Execute exactly run_tests.sh's file set, one process at a time, with durable per-file results.
import os,subprocess,pathlib,json,datetime,time
root=pathlib.Path(__file__).resolve().parents[2]
p=root/'review/auto20261001-t2-q1';os.chdir(root)
env=dict(os.environ,PLAYWRIGHT_PATH='/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js')
files=sorted(root.glob('tests/*.mjs'))+sorted(root.glob('tests/test_*.py'))
results=[];(p/'all-test-logs').mkdir(exist_ok=True)
(p/'all-tests.started').write_text(datetime.datetime.now().isoformat()+'\n')
for f in files:
 start=time.time()
 with (p/'all-test-logs'/f'{f.name}.log').open('w') as out:
  r=subprocess.run(['python3' if f.suffix=='.py' else 'node',str(f.relative_to(root))],env=env,stdout=out,stderr=subprocess.STDOUT)
 results.append({'test':str(f.relative_to(root)),'returncode':r.returncode,'seconds':round(time.time()-start,2)})
 (p/'all-tests.results.json').write_text(json.dumps(results,indent=2)+'\n')
 print(f'{len(results)}/{len(files)} {f.name}: {r.returncode}',flush=True)
(p/'all-tests.exit').write_text('1\n' if any(x['returncode'] for x in results) else '0\n')
(p/'all-tests.finished').write_text(datetime.datetime.now().isoformat()+'\n')
