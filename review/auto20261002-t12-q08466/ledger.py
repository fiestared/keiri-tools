from pathlib import Path
import json,re,subprocess
R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t12-q08466'); E=Path('review/auto20261002-t12-q08466')
old=json.loads((R/'segments.json').read_text()); adjud=json.loads((R/'segment-adjudication.json').read_text())['segments']; new=json.loads((E/'segments-after.json').read_text()); topics=json.loads((E/'topics.json').read_text()); T={t['key']:t for t in topics}
A={(a['page'],a['id']):a for a in adjud}; O={(s['page'],s['id']):s for s in old}; issues={i:t['key'] for t in topics for i in t['indices']}; assert set(issues)=={i for i,a in enumerate(adjud) if a['decision']=='unresolved'}
index={(s['page'],s['id']):i for i,s in enumerate(old)}
def topic(s):
 text=s['text']; k=(s['page'],s['id'])
 if index.get(k) in issues:return issues[index[k]]
 if '4.00' in text or 'ロータリー' in text or 'L表記' in text: return 'cc'
 if '抹消登録日' in text or '還付' in text or '業者への' in text or '未納' in text or '通常の売却' in text:return 'refund'
 if '5月' in text or '納税通知書で確認' in text:return 'notice'
 if '所有者が法令' in text or '所有権留保' in text or '名義変更' in text or '年度末扱い' in text or '4月1日現在の所有者' in text:return 'owner'
 if '翌年度4月1日' in text or '年度途中に買った' in text or '3月に登録' in text:return 'nextyear'
 if any(x in text for x in ['軽減','軽課','免除','6,500','ZEV','水素燃料','軽自動車税は市区町村に確認']):
  if any(x in text for x in ['10,800','7,200','12,900','3,900']):return 'kei'
  if '標準年額' in text and ('25,000' in text or s['kind']=='figure'):return 'standard'
  return 'scope'
 if any(x in text for x in ['重課','13年','11年','粒子状','対象外の例']):return 'heavy'
 if any(x in text for x in ['三輪','四輪','軽自動車税との違い','初回検査・用途','10,800','7,200','12,900']):return 'kei'
 if '月割' in text or '納税' in text:return 'owner'
 return 'standard'
def source(ref):
 f,start,end=ref; lines=(R/'corpus'/f).read_text().splitlines();url=re.search(r'https://\S+',lines[0])[0]
 return dict(corpus_ref=f'corpus/{f}:{start}-{end}',source_url=url,source_quote='\n'.join(lines[start-1:end]))
def refs_from(a):
 out=[]
 for c in a.get('conditions',[]):
  for f,x,y in re.findall(r'corpus/([\w]+\.txt):(\d+)(?:[-–](\d+))?',c.get('corpus_ref','')):out.append([f,int(x),int(y or x)])
 for f,x,y in re.findall(r'corpus/([\w]+\.txt):(\d+)(?:[-–](\d+))?',a.get('reason','')):out.append([f,int(x),int(y or x)])
 return [list(t) for t in dict.fromkeys(tuple(x) for x in out)]
for page in dict.fromkeys(x['page'] for x in new):
 path=Path('claims')/(page.removeprefix('docs/').removesuffix('/index.html')+'.json'); before=json.loads(path.read_text())
 ledger=dict(page=page,checked='2026-10-02',scope='auto20261002-t12-q08466。審査okの不変単位のみverified。修正担当照合はcorrected_recheckedとして独立審査と分離。正本外は未確認。',claims=[],nonclaims=[],verified=[],out_of_corpus=[],absolutes=before.get('absolutes',[]),tool_cases=before.get('tool_cases',[]),review_history=[{'run':'auto20261001-t12-q3','ledger_git_ref':'caf6137d:'+str(path)},{'run':'auto20261002-t12-q08466','review_ref':str(R/'segment-adjudication.json')}])
 for s in [x for x in new if x['page']==page]:
  k=(page,s['id']); a=A.get(k); tp=T[topic(s)]
  if a and a['decision']=='out_of_corpus':
   ledger['out_of_corpus'].append({**s,'result':'out_of_corpus','needed_source':a['needed_source'],'reason':a['reason'],'review_ref':str(R/'segment-adjudication.json')+'#'+s['id']});continue
  if a and a['decision']=='nonclaim':
   ledger['nonclaims'].append({'id':s['id'],'why':a['reason']});continue
  if not a and s['text'].startswith('以下では、'):
   ledger['nonclaims'].append({'id':s['id'],'why':'記事の構成の案内で、独立した税額・適用条件の主張ではない。'});continue
  if not a and s['text'] in ['課税免除・申請減免も試算対象外です。','その他の軽課・課税免除・申請減免は試算対象外です。','四輪以上の自家用乗用軽自動車にも対応します。']:
   ledger['out_of_corpus'].append({**s,'result':'out_of_corpus','needed_source':'計算機の機能仕様と実装検証記録。税務正本による機能認証はしない。','reason':'修正で明示した実装対応範囲。税法とは別の検証を要する。'});continue
  refs=tp['refs'][:]
  if a: refs+=refs_from(a)
  refs=[list(t) for t in dict.fromkeys(tuple(x) for x in refs)]
  src=[source(ref) for ref in refs]
  # Keep tax-name source for unchanged adjudicated units; the exact adjudication refs above include it.
  c={'id':'auto-q08466-'+s['id'],'text':s['text'],'where':[s['kind']+' / '+s['zone']],'numbers':[], 'applies':'令和8年度（2026年度）。各主張の初回登録・検査日・基準日による区分。','scope':tp['scope'],'exceptions':tp['exceptions'],'sources':src,**src[0],'covers':[s['id']],'topic':['jidoshazei',tp['key']],'review_status':'adjudicated_ok' if a and a['decision']=='ok' else 'corrected_rechecked','review_ref':str(R/'segment-adjudication.json')+'#'+s['id'] if a else 'review/auto20261002-t12-q08466/topics.json#'+tp['key']}
  if a:c['conditions']=a.get('conditions',[]);c['adjudication_reason']=a['reason']
  ledger['claims'].append(c)
  if a and a['decision']=='ok': ledger['verified'].append({'id':s['id'],'text_hash':s['text_hash'],'result':'ok','review_ref':c['review_ref']})
 path.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
# No not_wrong/unsure original OC unit was rewritten, removed or promoted.
keys={(s['page'],s['id']) for s in new};ocs=[a for a in adjud if a['decision']=='out_of_corpus'];assert all((a['page'],a['id']) in keys for a in ocs)
print('all',len(ocs),'original OC units preserved')
