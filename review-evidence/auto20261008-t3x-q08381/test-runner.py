from pathlib import Path
import subprocess,os,json,datetime,re
root=Path('/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261008-t3x-q08381')
dir=root/'review-evidence/auto20261008-t3x-q08381'
status=dir/'test-run-status.json'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(data):
 p=status.with_suffix('.tmp');p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');p.replace(status)
env=dict(os.environ);env['PLAYWRIGHT_PATH']='/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js'
data={'runner_pid':os.getpid(),'started':now(),'completed':False,'exit_code':None}
with (dir/'tests-after.log').open('w') as log:
 p=subprocess.Popen(['bash','./run_tests.sh'],cwd=root,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT)
 data['tests_pid']=p.pid;save(data);data['exit_code']=p.wait()
text=(dir/'tests-after.log').read_text();data['finished']=now();data['completed']=bool(re.search(r'全309ファイル緑|★赤 \d+/309 件:',text));save(data)
