import json,re,subprocess,difflib
from pathlib import Path
RUN=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t5-q08464'); R=Path('reports/auto20261002-t5-q08464')
old=json.load(open(RUN/'segments.json'));adj=json.load(open(RUN/'segment-adjudication.json'))['segments'];new=json.load(open(R/'segments-after.json'))
oldmap={(x['page'],x['id']):x for x in old};amap={(x['page'],x['id']):x for x in adj}
topics=json.load(open(R/'topics.json'));tm={x['id']:x for x in topics};groups=[]
for a in adj:
 if a['decision']=='unresolved':
  r=a['reason'].split(' 審査独自')[0]
  if r not in groups:groups.append(r)
for a in adj:
 if a['decision']=='unresolved':a['topic']=next(t['id'] for t in topics if groups.index(a['reason'].split(' 審査独自')[0]) in t['groups'])
(R/'issue-units.json').write_text(json.dumps([a for a in adj if a['decision']=='unresolved'],ensure_ascii=False,indent=2)+'\n')

def source(ref):
 m=re.match(r'(.+?):(\d+)(?:-(\d+))?',ref)
 if not m:return '', ''
 name,start,end=m.groups();p=RUN/name if name.startswith('corpus/') else Path(name)
 lines=p.read_text().splitlines();quote='\n'.join(lines[int(start)-1:int(end or start)]).strip()
 urls=re.findall(r'https://[^\s）]+','\n'.join(lines[:3]));url=urls[0] if urls else 'https://laws.e-gov.go.jp/law/325AC0000000226'
 return quote,url

def claim(t,idx=None):
 refs=t['refs'];quotes=[source(r)[0] for r in refs]
 return {'id':'auto-t5-'+(idx or t['id']),'text':t['name'],'where':[],'numbers':[],'applies':'2026年寄附・令和9年度住民税。別の年分や個別金額は主張の明示範囲に限る。','scope':t['scope'],'exceptions':t['exceptions'],'source_url':source(refs[0])[1],'source_quote':'\n\n'.join(q for q in quotes if q),'corpus_ref':'; '.join(refs),'covers':[],'topic':[t['id']],'review_ref':str(RUN/'fixes.md')}

def choose(text):
 if any(x in text for x in ['法定の人的控除差','母5万円','父1万円']):return 'single-parent'
 if any(x in text for x in ['135万円','翌年度の住民税は非課税']):return 'exempt-year'
 if any(x in text for x in ['所得等の扶養','寄附年末','family-','合計所得62万円','合計所得金額62万円','扶養要件','生計を一にする親族','青色事業専従者','白色事業専従者','非居住者','同居の兄姉','死亡時','老人扶養','控除対象扶養親族']):return 'family'
 if any(x in text for x in ['max（','所得割非課税','課税所得（0円']):return 'floor'
 if any(x in text for x in ['変更届','賦課期日','ワンストップ','所轄税務署','住民税申告']):return 'procedures'
 if any(x in text for x in ['特例分用','1.021','山林','本則の表','5,717.6','19,482.4','69.58','復興特別']):return 'rates'
 if any(x in text for x in ['総所得金額等','20％','20%','調整控除後']):return 'denominators'
 return 'eligibility'

numbers=json.load(open(R/'segment-numbers.json'))
for page in sorted(set(x['page'] for x in new)):
 lp=Path('claims')/(page.removeprefix('docs/').removesuffix('/index.html')+'.json')
 ledger=json.loads(subprocess.check_output(['git','show','34be072a:'+str(lp)],text=True)); original_ledger=json.loads(json.dumps(ledger))
 # Rebuild links from the review. Keep historical source and number records.
 for c in ledger['claims']:c['covers']=[]
 ledger['nonclaims']=[];ledger['verified']=[];ledger['out_of_corpus']=[];ledger['checked']='2026-10-02'
 claims={};olds=[x for x in old if x['page']==page]
 baseunits=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{segmentClaims}from'./tools/segment_claims.mjs';import{execFileSync}from'node:child_process';let p=process.argv[1];console.log(JSON.stringify(segmentClaims(execFileSync('git',['show','34be072a:'+p],{encoding:'utf8'}),p)));",page],text=True))
 baseids={x['id'] for x in baseunits}
 for u in [x for x in new if x['page']==page]:
  key=(page,u['id']);a=amap.get(key)
  if a and a['decision']=='out_of_corpus':
   ledger['out_of_corpus'].append({'id':u['id'],'text_hash':u['text_hash'],'result':'out_of_corpus','needed_source':a['needed_source'],'reason':a['reason'],'review_ref':str(RUN/'segment-adjudication.json')});continue
  if a and a['decision']=='nonclaim':
   assert not u['protected'],u
   ledger['nonclaims'].append({'id':u['id'],'why':a['reason']});continue
  if a and a['decision']=='ok':
   refs=list(dict.fromkeys(c['corpus_ref'] for c in a['conditions'] if c.get('corpus_ref')))
   if not refs:refs=re.findall(r'corpus/[\w_]+\.txt:\d+(?:-\d+)?',a['reason'])
   if not refs:raise ValueError(('no refs',u,a))
   # One claim per distinct supported unit, preserving the review's limited scope.
   cid='review-'+u['id'];t={'id':'reviewed','name':u['text'],'refs':refs,'scope':'審査okの命題に限定: '+a['reason'],'exceptions':[c['condition'] for c in a['conditions']] or ['無し: '+a['reason']]}
   c=claim(t,cid);c['covers']=[u['id']];c['numbers']=numbers[page+'|'+u['id']];c['where']=[u['kind']+': '+u['text'][:120]];claims[cid]=c
   ledger['verified'].append({'id':u['id'],'text_hash':u['text_hash'],'result':'ok','review_ref':str(RUN/'segment-adjudication.json')});continue
  if 'column/' in page and u['id'] in baseids:
   # The extra page is a horizontal correction, not a new complete review.
   for c in ledger['claims']:
    basec=next((q for q in original_ledger['claims'] if q['id']==c['id']),{})
    if u['id'] in basec.get('covers',[]):c['covers'].append(u['id'])
   continue
  # Modified/new units: writer-checked against topic sources, independent re-review pending.
  topic=choose(u['text'])
  if a and a.get('topic'):topic=a['topic']
  c=claims.setdefault(topic,claim(tm[topic]));c['covers'].append(u['id']);c['where'].append(u['kind']+': '+u['text']);c['numbers']+=numbers[page+'|'+u['id']]
 for c in claims.values():c['numbers']=sorted(set(c['numbers']))
 ledger['claims']+=list(claims.values())
 ledger['review_status']='既存okは独立審査記録。修正文は執筆者による正本照合済み・別モデル再照合待ち。正本外は未確認でcovers/verifiedへ算入しない。'
 # Unchanged extra-page nonclaims survive where no fresh review exists.
 if 'column/' in page:
  orig=json.loads(subprocess.check_output(['git','show','34be072a:'+str(lp)],text=True))
  ids={u['id'] for u in new if u['page']==page}
  ledger['nonclaims']=[n for n in orig.get('nonclaims',[]) if n['id'] in ids]
 lp.parent.mkdir(parents=True,exist_ok=True);lp.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
 print(page,'new claims',len(claims),'verified',len(ledger['verified']),'nonclaims',len(ledger['nonclaims']),'oc',len(ledger['out_of_corpus']))
