import json,subprocess,datetime
from pathlib import Path
lock=Path('.run_tests.lock/pid')
if not lock.exists():lock=Path('reports/r16-t14-a/recheck.pid')
if not lock.exists():
 print('suite finished');raise SystemExit
root=int(lock.read_text());rows=[]
for line in subprocess.check_output(['ps','-axo','pid=,ppid=,etime=,time=,command='],text=True).splitlines():
 p=line.strip().split(None,4)
 if len(p)==5:rows.append((int(p[0]),int(p[1]),p[2],p[3],p[4]))
ids={root}
for _ in range(20):ids|={p for p,q,*_ in rows if q in ids}
own=[r for r in rows if r[0] in ids]
browsers=[r for r in own if ('--remote-debugging-pipe' in r[4] or '/Contents/MacOS/Google Chrome ' in r[4]) and '--type=' not in r[4]]
record={'at':datetime.datetime.now().astimezone().isoformat(),'suite_pid':root,'browser_roots':len(browsers),'tests':[{'pid':p,'elapsed':e,'cpu_time':t,'command':c} for p,q,e,t,c in own if p!=root and ('node tests/' in c or 'tools/check_input_wiring.mjs' in c)],'browser_cpu':[r[3] for r in browsers]}
Path('reports/r16-t14-a/monitor.jsonl').open('a').write(json.dumps(record,ensure_ascii=False)+'\n');print(json.dumps(record,ensure_ascii=False))
assert len(browsers)<=1,'multiple Chromium roots within this task'
