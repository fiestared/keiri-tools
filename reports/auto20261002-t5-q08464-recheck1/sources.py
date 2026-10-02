import json,gzip
from pathlib import Path
p=Path('reports/auto20261002-t5-q08464-recheck1');(p/'corpus').mkdir(exist_ok=True)
def txt(n):return n if isinstance(n,str) else ''.join(txt(c) for c in n.get('children',[]))
def walk(n,kind,nums):
 if not isinstance(n,dict):return
 if n.get('tag')==kind and n.get('attr',{}).get('Num') in nums:yield n
 for c in n.get('children',[]):yield from walk(c,kind,nums)
a=json.loads(gzip.open(p/'law-2027.json.gz','rt').read());b=a;out=['出典: https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226_20270101_508AC0000000002','取得日: 2026-10-02']
for ar in walk(a['law_full_text'],'Article',['23','292']):
 for it in walk(ar,'Item',['7','9']):
  if '六十二万円' in txt(it):out.append(txt(it))
out.append('同施行版の附則（令和八年法律第二号）')
for ar in walk(b['law_full_text'],'Article',['3','11']):
 for para in walk(ar,'Paragraph',['2']):
  if '令和九年度' in txt(para):out.append(txt(para))
(p/'corpus/fuyo-2027.txt').write_text('\n'.join(out)+'\n')
print('\n'.join(out))
