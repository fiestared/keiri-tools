import json,re,shutil
from pathlib import Path
run=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261001/t1x-q4'); ev=Path('review/auto20261001-t1x-q4')
old=json.loads((run/'segments.json').read_text()); new=json.loads((ev/'segments-after.json').read_text()); adj=json.loads((run/'segment-adjudication.json').read_text())['segments']; ak={(x['page'],x['id']):x for x in adj}; sk={(x['page'],x['id']):x for x in old}; sol={}
for p in sorted((run/'out').glob('s*.json')):
 for x in json.loads(p.read_text())['segments']:sol[x['page'],x['id']]=x
for f in ['segment-adjudication.json','segments.json','oc-opinion.json','fixes.md']:shutil.copyfile(run/f,ev/('input-'+f))
# 独立審査が参照した固定正本の該当行を、そのまま台帳の引用にする。
def source(ref):
 if ',' in ref and ';' not in ref:
  f,rs=ref.split(':');return source(';'.join(f+':'+r for r in rs.split(',')))
 if ';' in ref:
  parts=[source(x.strip()) for x in ref.split(';')];d=parts[0];d['supporting_sources']=parts[1:];return d
 m=re.fullmatch(r'(corpus/[^:]+):(\d+)(?:-(\d+))?',ref);assert m,ref
 f,a,b=m.groups(); lines=(run/f).read_text().split('\n');quote='\n'.join(lines[int(a)-1:int(b or a)])
 if '/gensen/' in f:url='https://www.nta.go.jp/publication/pamph/gensen/aramashi2026/pdf/'+Path(f).stem+'.pdf'
 elif '/nenmatsu/' in f:url='https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/'+Path(f).stem+'.pdf'
 elif '_data_' in f:url='https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/'+Path(f).stem.split('_data_')[1].replace('_pdf','').replace('_','-')+'.pdf'
 elif '_gensen_' in f:url='https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/'+Path(f).stem.split('_gensen_')[-1].replace('_htm','')+'.htm'
 else:raise ValueError(ref)
 return dict(source_url=url,source_quote=quote,corpus_ref=str(run/f)+':'+a+'-'+(b or a))
z=lambda code: 'corpus/zeigakuhyo/www_nta_go_jp_publication_pamph_gensen_zeigakuhyo2026_data_'+code+'_pdf.txt'
tax='corpus/zeigakuhyo/www_nta_go_jp_taxes_shiraberu_taxanswer_gensen_2523_htm.txt'
fixrefs={
 'age':z('19_22')+':41-95','bonus':z('15_16')+':103-130','round':tax+':25-71','holiday':'corpus/gensen/03.txt:370-372','disability':'corpus/gensen/04.txt:3080-3102','fees':'corpus/gensen/07.txt:273-324','future':tax+':49-49','diff':'corpus/gensen/16.txt:101-118'}
for page in sorted({x['page'] for x in old}):
 path=Path('claims')/(page.removeprefix('docs/').removesuffix('/index.html')+'.json');d=json.loads(path.read_text()) if path.exists() else dict(page=page,claims=[],absolutes=[],tool_cases=[])
 for c in d['claims']:c.pop('covers',None)
 d['claims']=[c for c in d['claims'] if not c['id'].startswith('auto20261001-q4-')]
 d.update(checked='2026-10-01',scope='auto20261001-t1x-q4: 審査okはcoversとverified。修正単位は作業者再照合（独立再審査待ち）。正本外はunconfirmed、needed_sourceを保持。',nonclaims=[],verified=[],unconfirmed=[])
 for u in [x for x in new if x['page']==page]:
  k=(page,u['id']);a=ak.get(k);ident='auto20261001-q4-'+u['id'];ref=None
  if a and a['decision']=='nonclaim':d['nonclaims'].append(dict(id=u['id'],why=a['reason']));continue
  if a and a['decision']=='out_of_corpus':d['unconfirmed'].append(dict(id=u['id'],text_hash=u['text_hash'],result='out_of_corpus',needed_source=a['needed_source'],reason=a['reason']));continue
  if a and a['decision']=='ok':
   ref=sol[k].get('corpus_ref');assert ref,k
   c=source(ref);c['review_result']='ok';d['verified'].append(dict(id=u['id'],text_hash=u['text_hash'],result='ok',review_ref='review/auto20261001-t1x-q4/input-segment-adjudication.json#'+u['id']))
  else:
   t=u['text'];kind='fees'
   if '休日' in t:kind='holiday'
   elif '特定親族' in t:kind='disability' if '58万円超100万円' in t else 'age'
   elif '16歳未満の子' in t:kind='disability'
   elif '設例' in t and ('÷6' in t or '769,300' in t):kind='round'
   elif '月額表は申告書' in t:kind='round'
   elif '2027年分の給与' in t:kind='future'
   elif '電算機特例210円' in t:kind='diff'
   elif '前月' in t:kind='bonus'
   if '求めた税額' in t and '切り捨て' in t:
    c=dict(source_url='https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2795.htm',source_quote='（注）求めた税額に1円未満の端数があるときは、これを切り捨てます。',corpus_ref='review/auto20261001-t1x-q4/nta2795.html:112',supporting_sources=[dict(source_url='https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2798.htm',source_quote='（注）求めた税額に1円未満の端数があるときは、これを切り捨てます。',corpus_ref='review/auto20261001-t1x-q4/nta2798.html:112')])
   else:c=source(fixrefs[kind])
   c['review_result']='corrected_author_checked_pending_independent_review'
  c.update(id=ident,text=u['text'],where=[u['kind']+': '+u['id']],numbers=[],applies='令和8年分（令和9年分の表の改正に関する注意は令和9年分）',exceptions=(a['reason'] if a and a['decision']=='ok' else '修正根拠は該当正本の条件・例外と照合。審査前の正本外421単位は変更せず未確認のまま保持。'),covers=[u['id']],topic=['gensen'],review_ref='review/auto20261001-t1x-q4/input-segment-adjudication.json')
  d['claims'].append(c)
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
