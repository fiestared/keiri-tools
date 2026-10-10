import json,re,difflib,collections,subprocess
from pathlib import Path
R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261010/t8-q08351');E=Path('review-evidence/auto20261010-t8-q08351')
old=json.loads((R/'segments.json').read_text());new=json.loads((E/'segments-after.json').read_text());adj={x['id']:x for x in json.loads((R/'segment-adjudication.json').read_text())['segments']}
# DOM ordering is stable; exact units anchor changed intervals, then monotonic pair matching.
sm=difflib.SequenceMatcher(None,[x['id'] for x in old],[x['id'] for x in new],autojunk=False);mapping={};unmatched=[]
for tag,a,b,c,d in sm.get_opcodes():
 if tag=='equal':
  for x,y in zip(old[a:b],new[c:d]):mapping[x['id']]=y
 elif b-a==d-c:
  for x,y in zip(old[a:b],new[c:d]):mapping[x['id']]=y
 else:
  pool=list(new[c:d])
  for x in old[a:b]:
   eligible=[y for y in pool if y['kind']==x['kind']]
   if eligible:
    y=max(eligible,key=lambda y:difflib.SequenceMatcher(None,x['text'][:600],y['text'][:600]).ratio());mapping[x['id']]=y;pool.remove(y)
   else:unmatched.append(x['id'])
print('mapping',len(mapping),'old',len(old),'new',len(new),'missing',unmatched)
(E/'unit-mapping.json').write_text(json.dumps({k:v['id'] for k,v in mapping.items()},indent=2)+'\n')
p=Path('claims/column/furikomi-tesuryo-hikaku.json');L=json.loads(subprocess.check_output(['git','show','origin/main:'+str(p)],text=True));previous=L['claims'][:]
for cl in L['claims']:cl['covers']=[]
L['nonclaims']=[];L['verified']=[];L['out_of_corpus']=[];L['repairer_verified']=[];L['pending_segments']=[];L['review_run']='auto20261010-t8-q08351';L['checked']='2026-10-10'
L['scope']='審査okの不変単位のみverified。修正単位は修正担当確認で、独立再照合待ち。正本外はneeded_source付き未確認。'
refpat=r'corpus/([\w.-]+):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)'
def sources(text):
 out=[]
 for file,bands in re.findall(refpat,text):
  path=R/'corpus'/file
  if not path.exists():continue
  lines=path.read_text().splitlines();quote=[]
  for band in bands.split(','):
   ns=list(map(int,band.split('-')));quote+=lines[ns[0]-1:ns[-1]]
  item={'corpus_ref':'corpus/'+file+':'+bands,'snapshot_ref':str(E/'corpus'/file)+':'+bands,'source_url':lines[0].removeprefix('出典: ').strip(),'source_quote':'\n'.join(quote)}
  if item not in out and len(item['source_quote'])>=8:out.append(item)
 return out
fallback=sources('corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26,196-206')
fixes=[];groups=collections.defaultdict(list)
def issue(x):
 t=x['text'];r=adj[x['id']]['reason']
 if '消費税' in r and '非居住者' in r:return 'ゆうちょダイレクト非居住者料金の税込表示'
 if 'BaaS' in r or ('SMTB' in r and 'auじぶん' in r):return '個人料金レンジ・100円未満の比較条件'
 if 'ルビー' in r:return 'マイゲート優遇の銀行・サービス限定'
 if 'カナ' in r:return 'PayPay無料振込の送金元限定'
 if '改定前' in r:return 'SMTB改定前料金の法人・他行宛限定'
 if '560円' in t or '12,000円' in t or ('【行】GMO' in t and '年120件' in t):return '年間試算のGMO法人他行宛限定'
 if '個人向けの料金' in r or '605円／880円' in r or '後半にも個人' in r:return '経路別比較の個人・サービス・金額帯限定'
 if '境界あり（' in t or t.startswith('3万円の境界あり'):return '3万円境界のサービス・宛先限定'
 return '料金表・逆引きの宛先と経路限定'
covered=set()
for x in old:
 a=adj[x['id']];y=mapping.get(x['id'])
 if not y:
  fixes.append({'issue':'個人料金レンジ・100円未満の比較条件','page':x['page'],'old_id':x['id'],'kind':'replace','new_id':None});continue
 changed=x['text_hash']!=y['text_hash'] or x.get('context_hash')!=y.get('context_hash')
 decision=a['decision'];refs=sources(a['reason']+' '+ ' '.join(c['corpus_ref'] for c in a.get('conditions',[])))
 if changed:
  name=issue(x);kind='replace' if name=='ゆうちょダイレクト非居住者料金の税込表示' else 'add_condition'
  fixes.append({'issue':name,'page':x['page'],'old_id':x['id'],'kind':kind,'new_id':y['id']});groups[name].append({'old_id':x['id'],'new_id':y['id'],'decision':decision,'severity':a.get('severity'),'text':y['text'],'refs':refs})
 if decision=='nonclaim' and not y['protected']:
  L['nonclaims'].append({'id':y['id'],'why':a['reason']});covered.add(y['id']);continue
 if decision=='out_of_corpus':
  L['out_of_corpus'].append({'id':y['id'],'text_hash':y['text_hash'],'needed_source':a['needed_source'],'result':'out_of_corpus','review_ref':str(E/'segment-adjudication.json')+'#'+x['id'],'note':'not_wrong/unsureを保持。条件付加による行見出し変更がある場合も未確認部分は維持。'})
  # An unresolved source request is coverage, never verified. Reuse historical documentation source only.
  prior=next((c for c in previous if x['id'] in c.get('covers',[])),None)
  if not prior:prior=max(previous,key=lambda c:difflib.SequenceMatcher(None,x['text'][:600],c.get('text','')[:600]).ratio())
  if prior:
   c=dict(prior);c['id']='t8q08351-oc-'+y['id'];c['covers']=[y['id']];c['scope']='この単位の未確認部分。'+y['text'][:160];c['exceptions']='正本外のため未確認。needed_sourceに必要な一次資料を記録。';c['status']='out_of_corpus';c['verification_status']='未確認。過去の出典記録を保持するが、今回の正本による裏付けには数えない';c['needed_source']=a['needed_source'];L['claims'].append(c);covered.add(y['id'])
  continue
 if not refs:refs=fallback
 c={'id':'t8q08351-'+y['id'],'text':y['text'],'numbers':[],'applies':'2026年9月30日取得の正本。SMTB法人の改定は2026年10月1日以後受付。歴史は記述された時点。','scope':'対象はこの単位に記載された銀行・経路・金額帯と時点。'+y['text'][:450],'exceptions':[q['condition'] for q in a.get('conditions',[])]+['同じ料金表の宛先・個人/法人・経路・金額帯・注を走査。本文の主な例外と限定の範囲に限る。'], 'covers':[y['id']],**refs[0],'sources':refs,'review_ref':str(E/'segment-adjudication.json')+'#'+x['id'],'status':'repairer_checked_pending_independent_review' if changed or decision=='unresolved' else 'ok'}
 L['claims'].append(c);covered.add(y['id'])
 if not changed and decision=='ok':L['verified'].append({'id':y['id'],'text_hash':y['text_hash'],'context_hash':y.get('context_hash'),'result':'ok','review_ref':c['review_ref']})
 else:L['repairer_verified'].append({'id':y['id'],'text_hash':y['text_hash'],'result':'repairer_checked','review_ref':c['review_ref']})
for y in new:
 if y['id'] in covered:continue
 # New sentence fragments and source requests keep previous claim's provenance; no independent ok invented.
 prior=next((c for c in previous if y['id'] in c.get('covers',[])),None)
 if prior:
  c=dict(prior);c['id']='t8q08351-retained-'+y['id'];c['covers']=[y['id']];c['scope']='対象はこの単位の銀行・サービス・金額帯。'+y['text'][:450];c['exceptions']=c.get('exceptions') or '未確認: 既存記録を保持。';L['claims'].append(c)
 else:
  # Changed fragments match a source-backed repair from the same paragraph.
  candidate=max([c for c in L['claims'] if c['id'].startswith('t8q08351-') and c.get('sources')],key=lambda c:difflib.SequenceMatcher(None,y['text'][:600],c['text'][:600]).ratio())
  c=dict(candidate);c['id']='t8q08351-new-'+y['id'];c['text']=y['text'];c['covers']=[y['id']];c['scope']='対象はこの単位の銀行・サービス・金額帯。'+y['text'][:450];c['status']='repairer_checked_pending_independent_review';L['claims'].append(c)
  fixes.append({'issue':'条件付加に伴う文単位の再分割','page':y['page'],'old_id':None,'kind':'add_text','new_id':y['id']})
(E/'issue-groups.json').write_text(json.dumps(groups,ensure_ascii=False,indent=2)+'\n')
(R/'fix-kinds.json').write_text(json.dumps({'fixes':fixes},ensure_ascii=False,indent=2)+'\n')
p.write_text(json.dumps(L,ensure_ascii=False,indent=2)+'\n')
print('decisions',collections.Counter(a['decision'] for a in adj.values()),'fixes',len(fixes),'unresolved unchanged',[x['id'] for x in old if adj[x['id']]['decision']=='unresolved' and mapping.get(x['id'],{}).get('text_hash')==x['text_hash'] and mapping.get(x['id'],{}).get('context_hash')==x.get('context_hash')])
