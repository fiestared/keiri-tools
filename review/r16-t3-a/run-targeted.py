from pathlib import Path
import subprocess,json,os
root=Path.cwd();d=root/'review/r16-t3-a'
assert (d/'tests-full.rc').exists(), 'full suite still running'
assert not (root/'.run_tests.lock').exists(), 'test runner still owns worktree'
env=dict(os.environ,PLAYWRIGHT_PATH='/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js')
commands=[['node','tests/'+n+'.mjs'] for n in ['test_year_staleness','break_izoku_page','test_kabe','test_nenshu_kabe','test_stale_values_rules','test_stale_values','test_generators_fresh','test_faq_visible','test_qa','test_layout_mutations']]
commands += [['node','tools/check_claims.mjs','--changed','origin/main']]
commands += [['node','tools/check_claims.mjs','--segments','docs/'+p+'/index.html'] for p in ['column/nenshu-no-kabe','column/shakai-hoken-kanyu-joken','embed/kabe','kabe']]
commands += [['node','review/r16-t3-a/check-final-layout.mjs'],['node','review/r16-t3-a/audit-final.mjs']]
results=[]
for i,cmd in enumerate(commands):
 name=' '.join(cmd);log=d/f'final-{i+1:02}-{Path(cmd[1]).stem}.log'
 print('RUN',name,flush=True)
 with log.open('w') as f:r=subprocess.run(cmd,env=env,stdout=f,stderr=subprocess.STDOUT)
 results.append({'name':name,'rc':r.returncode,'log':str(log.relative_to(root))})
 (d/'targeted-tests.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
 print('RESULT',r.returncode,name,flush=True)
 if r.returncode:print(log.read_text()[-6000:],flush=True)
raise SystemExit(int(any(r['rc'] for r in results)))
