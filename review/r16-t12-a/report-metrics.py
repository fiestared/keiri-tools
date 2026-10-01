import json
from pathlib import Path
from collections import Counter
R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t12-a')
D=Path('review/r16-t12-a')
segs=json.loads((R/'segments.json').read_text());a=json.loads((R/'segment-adjudication.json').read_text())['segments']
counts=Counter(x['decision'] for x in a);severity=Counter(x['severity'] for x in a if x['decision']=='unresolved')
before=json.loads((D/'coverage-before.json').read_text());after=json.loads((D/'coverage-after.json').read_text())
totals=lambda d:{k:sum(x[k] for x in d.values()) for k in ['total','covered','verified','nonclaims','unprocessed']}
print('審査:',dict(counts),'誤り率:',counts['unresolved']/(counts['unresolved']+counts['ok'])*100,'重大度:',dict(severity))
print('BEFORE:',totals(before));print('AFTER:',totals(after))
print('|ページ|単位 前→後|被覆 前→後|独立確認 前→後|非主張 前→後|未処理 前→後|')
print('|---|---:|---:|---:|---:|---:|')
for p,b in before.items():
 c=after[p]
 print('|'+p+'|'+ '|'.join(str(b[k])+'→'+str(c[k]) for k in ['total','covered','verified','nonclaims','unprocessed'])+'|')
print('severity per page')
for p in before:print(p,dict(Counter(x['severity'] for x in a if x['decision']=='unresolved' and x['page']==p)))
