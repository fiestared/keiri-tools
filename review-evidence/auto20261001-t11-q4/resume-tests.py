from pathlib import Path
import subprocess,os,json,re,time
root=Path(__file__).resolve().parents[2];os.chdir(root);e=Path('review-evidence/auto20261001-t11-q4');log=(e/'tests-all.log').read_text();done=set(re.findall(r'^(tests/\S+)\s+緑$',log,re.M));files=sorted(Path('tests').glob('*.mjs'))+sorted(Path('tests').glob('test_*.py'));pending=[p for p in files if str(p) not in done];(e/'test-results').mkdir(exist_ok=True);env=dict(os.environ,PLAYWRIGHT_PATH='/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js');results=[]
for p in pending:
 (e/'test-current.json').write_text(json.dumps({'file':str(p),'started':time.time(),'runner_pid':os.getpid()}))
 with (e/'test-results'/f'{p.name}.log').open('w') as f:r=subprocess.run(['python3' if p.suffix=='.py' else 'node',str(p)],stdout=f,stderr=subprocess.STDOUT,env=env)
 results.append({'file':str(p),'rc':r.returncode});(e/'test-results.json').write_text(json.dumps(results,indent=2)+'\n');print(str(p),r.returncode,flush=True)
(e/'test-complete.json').write_text(json.dumps({'completed_before_interrupt':len(done),'resumed':len(results),'total':len(files),'red':[r for r in results if r['rc']]},indent=2)+'\n')
