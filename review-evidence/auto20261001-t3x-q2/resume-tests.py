import os,subprocess,pathlib,json,time
root=pathlib.Path(__file__).resolve().parents[2];os.chdir(root);e=root/'review-evidence/auto20261001-t3x-q2'
files=sorted(str(p) for p in pathlib.Path('tests').glob('*.mjs'))+sorted(str(p) for p in pathlib.Path('tests').glob('test_*.py'))
initial=(e/'final-tests.log').read_text();done={line.split()[0] for line in initial.splitlines() if line.startswith('tests/') and line.rstrip().endswith('緑')};assert len(done)==54
results=[dict(test=f,rc=0,phase='first-pass-before-143') for f in files if f in done];env=os.environ.copy();env['PLAYWRIGHT_PATH']='/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js';logs=e/'test-logs';logs.mkdir(exist_ok=True)
with (e/'final-tests-resumed.log').open('a',buffering=1) as out:
 for f in files:
  if f in done:continue
  (e/'test-progress.json').write_text(json.dumps(dict(pid=os.getpid(),current=f,completed=len(results),total=len(files)),indent=2)+'\n')
  t=time.time()
  with (logs/(pathlib.Path(f).name+'.log')).open('w') as log:
   p=subprocess.run(['python3' if f.endswith('.py') else 'node',f],env=env,stdout=log,stderr=subprocess.STDOUT)
  results.append(dict(test=f,rc=p.returncode,seconds=round(time.time()-t,2),phase='resumed'))
  (e/'test-results.json').write_text(json.dumps(results,indent=2)+'\n');out.write(f'{f}: '+('緑' if p.returncode==0 else '★赤')+'\n')
  if p.returncode:out.write('\n'.join((logs/(pathlib.Path(f).name+'.log')).read_text().splitlines()[-12:])+'\n')
 bad=[r for r in results if r['rc']];out.write(f'完了 {len(results)}/{len(files)} 赤 {len(bad)}\n');out.write('\n'.join(x['test'] for x in bad)+'\n')
 (e/'final-tests.exit').write_text(str(int(bool(bad)))+'\n');(e/'test-progress.json').write_text(json.dumps(dict(pid=os.getpid(),current=None,completed=len(results),total=len(files),red=len(bad)),indent=2)+'\n')
