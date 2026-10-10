import json,subprocess
from pathlib import Path
RUN=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261005/t2-q08502')
E=Path('review/auto20261005-t2-q08502')
a=json.loads((RUN/'segment-adjudication.json').read_text())['segments']
before=json.loads((RUN/'segments.json').read_text())
after=json.loads((E/'segments-after.json').read_text());ids={u['id'] for u in after}
issues=json.loads((E/'issues.json').read_text());covered={i for issue in issues for i in issue['unit_ids']};unresolved={x['id'] for x in a if x['decision']=='unresolved'}
assert unresolved==covered
assert not (unresolved & ids)
assert all(x['id'] in ids for x in a if x['decision']=='out_of_corpus')
ledger=json.loads(Path('claims/column/gensen-choshuhyo-mikata.json').read_text())
assert all(x['needed_source'] and x['status']=='unverified' for x in ledger['out_of_corpus'])
assert len(ledger['out_of_corpus'])==117
assert all(x['id'] not in unresolved for x in ledger['verified'])
# New explanatory quotes use the exact numbered source lines (form-feed is not a newline).
for c in ledger['claims']:
 if not c['id'].startswith('auto20261005-') or not c.get('corpus_ref'):continue
 for item in [c]+c.get('supporting_sources',[]):
  ref=item['corpus_ref'];f,span=ref.rsplit(':',1);ab=span.split('-');lo=int(ab[0]);hi=int(ab[-1]);quote='\n'.join((RUN/f).read_text().split('\n')[lo-1:hi]);assert item['source_quote']==quote,ref
result={'old_total':len(before),'new_total':len(after),'unresolved_units_repaired':len(unresolved),'issue_count':len(issues),'out_of_corpus_unchanged':117,'independent_ok_unchanged':len(ledger['verified']),'nonclaims':len(ledger['nonclaims']),'changed_or_added_units':len(after)-sum(u['id'] in {v['id'] for v in before} for u in after),'source_quotes_exact':True}
(E/'self-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
