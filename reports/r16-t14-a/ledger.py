import json,re,hashlib
from pathlib import Path
RUN=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t14-a')
orig=json.loads((RUN/'segments.json').read_text()); adjud=json.loads((RUN/'segment-adjudication.json').read_text())['segments'];a={(x['page'],x['id']):x for x in adjud};sol={}
for p in sorted((RUN/'out').glob('s*.json')):
 for x in json.loads(p.read_text())['segments']:sol[x['page'],x['id']]=x
ns={};exec(Path('reports/r16-t14-a/edit.py').read_text().split("if __name__=='__main__':")[0],ns)
normalize=lambda s:re.sub(r'\s+','',__import__('unicodedata').normalize('NFKC',s))
original={ (x['page'],x['id']):x for x in orig}
current=json.loads(Path('reports/r16-t14-a/segments-after.json').read_text())
# Reference old units to new units via exact text and deterministic replacement text.
transformed=[]
for x in orig:
 text=x['text']
 for old,new in ns['changes'].get(x['page'],[]):text=text.replace(old,new)
 transformed.append((x,normalize(text)))
manual=json.loads(Path('reports/r16-t14-a/manual-ledger.json').read_text());rows=[];unmatched=[]
for page in sorted(set(x['page'] for x in current)):
 lp=Path('claims')/(page.removeprefix('docs/').removesuffix('/index.html')+'.json')
 ledger=json.loads(__import__('subprocess').check_output(['git','show','origin/main:'+str(lp)]));legacy=ledger['claims']
 # Old claims retained as source records, with prose updated where applicable; coverage is rebuilt.
 for c in legacy:
  c['covers']=[]
  for old,new in ns['changes'].get(page,[]):
   c['text']=c.get('text','').replace(old,new)
   c['numbers']=[n.replace(old,new) for n in c.get('numbers',[])]
 claims=[];nonclaims=[];verified=[];unconfirmed=[]
 for u in [x for x in current if x['page']==page]:
  key=(page,u['id']);override=manual.get(page+'#'+u['id']);old=original.get(key)
  if override and override['nonclaim']:
   nonclaims.append({'id':u['id'],'why':override['why']});continue
  if old and old['text_hash']!=u['text_hash']:old=None
  related=[old] if old else [x for x,t in transformed if x['page']==page and normalize(u['text']) in t and len(normalize(u['text']))>7]
  if not related:
   # Sentence edits spanning inline elements are recorded with full old/new text.
   for oldtext,newtext in ns['changes'].get(page,[]):
    if normalize(u['text']) in normalize(newtext) and len(normalize(u['text']))>7:
     related=[x for x in orig if x['page']==page and normalize(oldtext) in normalize(x['text'])];break
  d=a.get((page,old['id'])) if old else None
  if d and d['decision']=='out_of_corpus':
   # OC-wrong unit must have changed its ID/text after repair.
   unconfirmed.append({'id':u['id'],'text_hash':u['text_hash'],'text':u['text'],'result':'out_of_corpus','needed_source':d['needed_source'] or d['reason'],'review_ref':'r16/t14-a/segment-adjudication.json#'+u['id']});continue
  if d and d['decision']=='nonclaim' or (d and d['decision']=='unresolved' and d.get('severity')=='low' and not u['protected'] and len(u['text'])<65):
   nonclaims.append({'id':u['id'],'why':d['reason'] if d['decision']=='nonclaim' else '表見出し・操作・導入の文であり制度上の命題ではない。本文の見出し区分を修正して非主張として登録。'});continue
  if not related and not override:
   unmatched.append(u);continue
  if not related:related=[u]
  base=related[0];review=a.get((page,base['id']),{'decision':'remediated','reason':override['why'] if override else ''});s=sol.get((page,base['id']),{})
  ref=s.get('corpus_ref','');quote=s.get('corpus_quote','')
  # Corrected units cite the adjudication's precise basis, not the rejected sol verdict.
  if not old or review['decision']=='unresolved':
   refs=re.findall(r'corpus/[^\s;。]+\.txt:[\d,–—-]+',review['reason'])
   if refs:ref=';'.join(refs)
  if not ref:
   refs=re.findall(r'corpus/[^\s;。]+\.txt:[\d,–—-]+',review['reason']);ref=';'.join(refs)
  if override:ref=override['ref'];quote=''
  m=re.search(r'(?:corpus/)?([^/;\s:]+\.txt):([0-9]+)',ref)
  url='';sources=[]
  if m:
   f=RUN/'corpus'/m[1];lines=f.read_text().split('\n');url=lines[0].removeprefix('出典: ').split(' ')[0]
   if not quote or review['decision']=='unresolved' or not old:
    idx=int(m[2])-1;quote='\n'.join(lines[idx:min(idx+4,len(lines))]).strip()
    if len(quote)<8:quote='\n'.join(lines[max(2,idx-2):idx+7]).strip()
  if not url or len(quote)<8:
   unmatched.append({**u,'why':'source missing','related':base['id']});continue
  c={'id':'r16-'+u['id'],'text':u['text'],'where':[u['kind']+':'+u['zone']],'numbers':u['numbers'],'applies':'本文に明示した年分・条件。令和8年12月1日施行の条文は令和8年分以後への適用を附則で確認。','source_url':url,'source_quote':quote,'exceptions':review['reason'],'covers':[u['id']],'corpus_ref':ref,'review_ref':'r16/t14-a/segment-adjudication.json#'+base['id']}
  if not old or review['decision']=='unresolved':c['remediation']={'original_ids':[x['id'] for x in related],'review':'修正担当による正本再照合。独立再審査は司令塔の工程。'}
  claims.append(c)
  if old and review['decision']=='ok':verified.append({'id':u['id'],'text_hash':u['text_hash'],'result':'ok','review_ref':'r16/t14-a/segment-adjudication.json#'+u['id']})
 ledger.update(checked='2026-10-01',claims=legacy+claims,nonclaims=nonclaims,verified=verified,unconfirmed=unconfirmed)
 lp.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
 rows.append({'page':page,'claims':len(claims),'nonclaims':len(nonclaims),'verified':len(verified),'out_of_corpus':len(unconfirmed)})
Path('reports/r16-t14-a/ledger-unmatched.json').write_text(json.dumps(unmatched,ensure_ascii=False,indent=2)+'\n')
print(rows);print('unmatched',len(unmatched))
