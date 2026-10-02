from pathlib import Path
import json,re
run=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t5-q08464')
count=0;refs=0;bad=[]
for p in [Path('claims/furusato.json'),Path('claims/embed/furusato.json'),Path('claims/column/furusato-nozei-keisan.json'),Path('claims/column/furusato-nozei-kakutei-shinkoku.json')]:
 for c in json.loads(p.read_text())['claims']:
  if not c['id'].startswith('auto-t5-'):continue
  count+=1
  if not c.get('scope') or not c.get('exceptions'):bad.append(str(p)+':'+c['id']+' missing scope/exception')
  for m in re.finditer(r'((?:reports/auto20261002-t5-q08464/)?corpus/[^:;\s]+):(\d+)(?:[-–](\d+))?',c.get('corpus_ref','')):
   f=Path(m[1]);f=f if str(f).startswith('reports/') else run/f
   refs+=1
   if not f.exists() or int(m[3] or m[2])>len(f.read_text().splitlines()):bad.append(str(f))
assert not bad,bad
print(f'Checked {count} new ledger records: scope/exceptions present, {refs} corpus line references exist.')
