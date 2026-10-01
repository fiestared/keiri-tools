from pathlib import Path
import json,re,difflib,shutil
R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t4b-z'); E=Path('review-evidence/r16-t4b-z')
old=json.load(open(R/'segments.json')); new=json.load(open(E/'segments-after.json')); adj={(x['page'],x['id']):x for x in json.load(open(R/'segment-adjudication.json'))['segments']}
for f in ['segments.json','segment-adjudication.json','oc-opinion.json','fixes.md','coverage.json','corpus_desc.md']: shutil.copyfile(R/f,E/f)
(E/'corpus').mkdir(exist_ok=True)
for f in (R/'corpus').glob('*.txt'): shutil.copyfile(f,E/'corpus'/f.name)
shutil.copyfile('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/t5/corpus/egov_chihozei_fusoku_5_4.txt',E/'corpus/egov_chihozei_fusoku_5_4.txt')
maplog=[]
for page in sorted(set(s['page'] for s in old)):
 a=[s for s in old if s['page']==page]; b=[s for s in new if s['page']==page]; path=Path('claims')/(page.removeprefix('docs/').removesuffix('/index.html')+'.json'); ledger=json.load(open(path))
 mapping={}
 for tag,i,j,k,l in difflib.SequenceMatcher(None,[s['id'] for s in a],[s['id'] for s in b],autojunk=False).get_opcodes():
  for pos in range(k,l): mapping[pos]=a[i:j] if tag!='equal' else [a[i+pos-k]]
 ledger['checked']='2026-10-01'; ledger['nonclaims']=[]; ledger['verified']=[]; ledger['unverified']=[]
 for c in ledger['claims']: c.pop('covers',None)
 for n,s in enumerate(b):
  olds=mapping[n]; decisions=[adj[page,x['id']] for x in olds]; same=next((x for x in decisions if x['id']==s['id']),None)
  if same and same['decision']=='out_of_corpus':
   ledger['unverified'].append({**s,'result':'out_of_corpus','needed_source':same['needed_source'],'reason':same['reason'],'review_ref':str(E/'segment-adjudication.json')}); continue
  if same and same['decision']=='nonclaim':
   ledger['nonclaims'].append({'id':s['id'],'why':same['reason']}); continue
  reasons='\n'.join(x['reason'] for x in decisions)
  refs=[]
  for fn,start,end in re.findall(r'(nta_\d+(?:-\d+)?\.txt):(\d+)(?:-(\d+))?',reasons):
   ref=f'{E}/corpus/{fn}:{start}-{end or start}'
   if ref not in refs: refs.append(ref)
  sources=[]
  for ref in refs:
   f,rr=ref.rsplit(':',1); lo,hi=map(int,rr.split('-')); lines=Path(f).read_text().splitlines(); quote='\n'.join(lines[lo-1:hi]); no=Path(f).stem.removeprefix('nta_'); sources.append({'source_url':f'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/{no}.htm','source_quote':quote,'corpus_ref':ref})
  if '住民税' in s['text'] or not sources:
   for fn,lo,hi in [('chihozei-amendment',1088,1118),('chihozei-amendment',2844,2867),('chihozei-amendment',3036,3052)]:
    lines=(E/(fn+'.txt')).read_text().splitlines();sources.append({'source_url':'https://www.sangiin.go.jp/japanese/joho1/kousei/gian/221/pdf/s0802210042210.pdf','source_quote':'\n'.join(lines[lo-1:hi]),'corpus_ref':f'{E}/{fn}.txt:{lo}-{hi}'})
   lines=(E/'corpus/egov_chihozei_fusoku_5_4.txt').read_text().splitlines();sources.append({'source_url':'https://laws.e-gov.go.jp/law/325AC0000000226','source_quote':'\n'.join(lines[8:24]+lines[45:47]),'corpus_ref':f'{E}/corpus/egov_chihozei_fusoku_5_4.txt:9-24,46-47'})
  if any(w in s['text'] for w in ['40㎡','50㎡','2025年','2026年']):
   lines=(E/'shotoku-amendment.txt').read_text().splitlines();sources.append({'source_url':'https://www.sangiin.go.jp/japanese/joho1/kousei/gian/221/pdf/s0802210032210.pdf','source_quote':'\n'.join(lines[11972:11994]),'corpus_ref':f'{E}/shotoku-amendment.txt:11973-11994'})
  assert sources,(page,s)
  # Keep each reviewed unit connected to its own substantive claim and evidence.
  c={'id':f'r16-t4b-z-{n+1:03}','text':s['text'],'where':[s['kind'],s['id']],'numbers':[],'applies':'本文の対象年・取得区分に限る。0.7％制度の計算機。','exceptions':reasons or '改正本文・附則の適用日を確認。','covers':[s['id']],'topic':['住宅ローン控除'],**sources[0],'sources':sources,'review_ref':str(E/'segment-adjudication.json')}
  ledger['claims'].append(c)
  if same and same['decision']=='ok': ledger['verified'].append({'id':s['id'],'text_hash':s['text_hash'],'result':'ok','review_ref':str(E/'segment-adjudication.json')})
  maplog.append({'page':page,'id':s['id'],'original_ids':[x['id'] for x in olds],'status':'retained_ok' if same and same['decision']=='ok' else 'corrected_or_evidence_resolved','reason':reasons})
 ledger['scope']='r16/t4b-zの確認単位を対応。正本外はunverifiedでneeded_sourceを保存しcovers/verifiedには含めない。修正後の自己照合はcoversのみ、独立審査済みの元okだけverified。'
 path.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
(E/'unit-mapping.json').write_text(json.dumps(maplog,ensure_ascii=False,indent=2)+'\n')
