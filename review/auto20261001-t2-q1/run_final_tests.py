import os,subprocess,pathlib,json,datetime
root=pathlib.Path(__file__).resolve().parents[2]
p=root/'review/auto20261001-t2-q1'
os.chdir(root)
env=dict(os.environ,PLAYWRIGHT_PATH='/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js')
(p/'final-tests.started').write_text(datetime.datetime.now().isoformat()+'\n')
with (p/'final-tests.log').open('w') as out:
 r=subprocess.run(['bash','run_tests.sh'],env=env,stdout=out,stderr=subprocess.STDOUT)
(p/'final-tests.exit').write_text(str(r.returncode)+'\n')
(p/'final-tests.finished').write_text(datetime.datetime.now().isoformat()+'\n')
