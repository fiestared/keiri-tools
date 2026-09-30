import csv,datetime,statistics,json,hashlib
from pathlib import Path
D=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t16-a/corpus')
used={}
def load(pattern):
 p=next(D.glob(pattern));used[p.name]=hashlib.sha256(p.read_bytes()).hexdigest();return {r[0]:float(r[2]) for r in csv.reader(p.read_text().splitlines()) if r and r[0][:4].isdigit()}
e=load('nav_mufg_253425*');r=load('nav_rakuten_100086*');t=load('nav_amone_313161*');s=load('nav_mufg_253266*');end='2026/09/11';out={'formula':'100*((end/start)**(365.25/calendar_days)-1); sample daily-return-difference stdev * sqrt(252)','start_points':[]}
for start in ['2023/10/27','2024/01/04','2024/07/16','2025/01/06','2025/07/15']:
 years=(datetime.date.fromisoformat(end.replace('/','-'))-datetime.date.fromisoformat(start.replace('/','-'))).days/365.25
 rates=[100*((v[end]/v[start])**(1/years)-1) for v in [e,r,t]]
 out['start_points'].append({'start':start,'end':end,'nav_start':[v[start] for v in [e,r,t]],'nav_end':[v[end] for v in [e,r,t]],'emaxis_minus_tawara_pt':rates[0]-rates[2],'rakuten_minus_tawara_pt':rates[1]-rates[2]})
days=sorted(k for k in e.keys()&r.keys()&t.keys() if '2023/10/27'<=k<=end);diff=[100*((r[b]/r[a]-1)-(t[b]/t[a]-1)) for a,b in zip(days,days[1:])];out['common_days']=len(days);out['annualized_stdev_percent']=statistics.stdev(diff)*252**.5;out['ratio']=out['annualized_stdev_percent']/abs(out['start_points'][0]['rakuten_minus_tawara_pt'])
out['recovery']={name:{'peak':'2022/04/20','peak_nav':v['2022/04/20'],'first_recovery':next(d for d in sorted(v) if d>'2022/04/20' and v[d]>=v['2022/04/20'])} for name,v in [('orcan',e),('sp500',s)]}
out['sources_sha256']=used
Path('review/r16-t16-a/recalculation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False,indent=2))
