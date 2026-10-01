import json,re,collections,difflib,os
from pathlib import Path
D=Path('review-evidence/auto20261001-t8-q1'); key=lambda x:(x['page'],x['id'])
a={key(x):x for x in json.loads((D/'segment-adjudication.json').read_text())['segments']}
sol={key(x):x for p in sorted((D/'out').glob('s*.json')) for x in json.loads(p.read_text())['segments']}
oc={key(x):x for x in json.loads((D/'oc-opinion.json').read_text())['units']}
press='corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27'
mufg='corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-23,196-206'
gmo='corpus/gmo_aozora_com_business_contents_fee_html.txt:10-18'
gunma='corpus/www_gunmabank_co_jp_hojin_biznb_service_pdf_z_format1_pdf.txt:6-13,77-79'
smbc='corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-61'
jba='jba_protocol_pc.txt:418-451';jbaabbr='jba_protocol_pc.txt:7930-7955'
countrefs=';'.join(dict.fromkeys(ref for row in json.loads((D/'fee-count-inventory.json').read_text()) if row['status']=='confirmed' for ref in row['sources']))
def sources(ref):
 out=[]
 for part in ref.split(';'):
  m=re.fullmatch(r'(.+\.txt):([\d,\-]+)',part.strip());assert m,part
  f,r=m.groups();lines=(D/f).read_text().split('\n');q=[]
  for ran in r.split(','):
   vals=list(map(int,ran.split('-')));lo=vals[0];hi=vals[-1];q+=lines[lo-1:hi]
  quote='\n'.join(q)
  if len(quote.strip())<8:
   lo=max(1,lo-4);hi=min(len(lines),hi+4);quote='\n'.join(lines[lo-1:hi]);r=f'{lo}-{hi}'
  urls=re.findall(r'https?://\S+', '\n'.join(lines[:8]))
  url='https://www.zenginkyo.or.jp/fileadmin/res/abstract/efforts/system/jba_protocol_pc.pdf' if f=='jba_protocol_pc.txt' else (urls[0] if urls else '')
  assert url,(f,lines[:5])
  out.append(dict(corpus_ref=str(D/f)+':'+r,source_url=url,source_quote=quote))
 return out

def repair_ref(u,old):
 t=u['text']
 if 'zengin' in u['page']:
  if '財団法人' in t or '社団法人' in t:return jbaabbr
  if 'ヘッダー' in t or 'トレーラ' in t or 'データの集まり' in t:return jba
  return gunma
 if any(x in t for x in ['25区分','10区分','15区分','5区分','みずほ個人','境界を確認できた','境界」を確認できた']):return countrefs
 if '67,200' in t:return gmo+';'+mufg
 if 'Web21' in t:return smbc+';'+mufg
 if '1.3倍' in t:return press+';corpus/www_netbk_co_jp_contents_charge_furikomi.txt:41-46'
 if 'PayPay' in t or t=='145円':
  # This row retains only PayPay personal/corporate and Rakuten personal.
  refs=[s.get('corpus_ref') for k,s in sol.items() if s.get('corpus_ref') and any(x in s['corpus_ref'] for x in ['paypay','rakuten_bank_co_jp_fee'])]
  return ';'.join(dict.fromkeys(refs))
 return press+';'+gmo

mapping=[];preserved=[];afterstats={};unmatched=[]
for slug in ['furikomi-tesuryo-hikaku','zengin-format-guide']:
 old=json.loads((D/(slug+'-located-before.json')).read_text());new=json.loads((D/(slug+'-located-after.json')).read_text());page=new[0]['page']
 oldgroups=collections.defaultdict(list);newgroups=collections.defaultdict(list)
 for u in old:oldgroups[u['locator']].append(u)
 for u in new:newgroups[u['locator']].append(u)
 pairs={}
 for loc,news in newgroups.items():
  olds=oldgroups[loc]
  matcher=difflib.SequenceMatcher(a=[u['text_hash'] for u in olds],b=[u['text_hash'] for u in news],autojunk=False)
  for tag,i,j,k,l in matcher.get_opcodes():
   if tag=='equal':
    for x,y in zip(olds[i:j],news[k:l]):pairs[y['id']]=(x,True)
   else:
    for y in news[k:l]:pairs[y['id']]=(olds[i] if i<j else None,False)
 ledgerold=json.loads((D/(slug+'-ledger-before.json')).read_text())
 ledger={'page':page,'checked':'2026-10-01','scope':'auto20261001/t8-q1。既存okは固定単位の独立審査。修正文は修正担当者の一次資料照合であり独立再審査ではない。正本外not_wrong/unsureは保持し未確認。','claims':[],'absolutes':ledgerold.get('absolutes',[]),'nonclaims':[],'verified':[],'out_of_corpus':[],'review_run':'auto20261001/t8-q1'}
 for u in new:
  o,same=pairs.get(u['id'],(None,False)); verdict=a.get(key(o)) if o else None
  ocwrong=bool(o and oc.get(key(o),{}).get('verdict')=='wrong')
  status=verdict['decision'] if verdict and same else 'repaired'
  if status=='unresolved' or ocwrong:status='repaired'
  if o and same and verdict['decision']=='out_of_corpus' and not ocwrong:
   preserved.append({'page':page,'old_id':o['id'],'new_id':u['id'],'text_hash':u['text_hash']})
  if status=='nonclaim':
   ledger['nonclaims'].append({'id':u['id'],'why':verdict['reason']});continue
  if status=='out_of_corpus':
   ledger['out_of_corpus'].append({'id':u['id'],'text_hash':u['text_hash'],'text':u['text'],'result':'out_of_corpus','needed_source':verdict['needed_source'],'review_ref':str(D/'segment-adjudication.json')+'#'+o['id']});continue
  if status=='ok':
   ref=sol[key(o)].get('corpus_ref')
   if not ref:ref=';'.join(['corpus/gmo_aozora_com_contents_fee_html.txt:42-50',gmo,mufg,'corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:40-46'])
   review=str(D/'segment-adjudication.json')+'#'+o['id']
   reason=verdict['reason']
  else:
   if not o:unmatched.append(u)
   ref=repair_ref(u,o);review=str(D/'repair-map.json')+'#'+u['id'];reason='修正担当者照合。'+(verdict['reason'] if verdict else '同じ修正箇所に追加した条件説明。')
   mapping.append({'page':page,'id':u['id'],'text':u['text'],'old_id':o['id'] if o else None,'old_text':o['text'] if o else None,'result':'ok','review_type':'repairer_source_check','corpus_ref':ref,'reason':reason})
  ss=sources(ref)
  ledger['claims'].append({'id':'t8q1-'+u['id'],'text':u['text'],'where':[u['locator']],'numbers':u['numbers'],'applies':'2026年10月1日。振込は他行宛の掲載サービス・通常料金（無料回数以降）。歴史の記述は本文の時点に限る。','exceptions':reason,'covers':[u['id']],'topic':['振込手数料' if 'furikomi' in page else '全銀フォーマット'],**ss[0],'sources':ss,'review_ref':review})
  if status=='ok':ledger['verified'].append({'id':u['id'],'text_hash':u['text_hash'],'result':'ok','review_ref':review})
  else: ledger.setdefault('repairer_verified',[]).append({'id':u['id'],'text_hash':u['text_hash'],'result':'ok','review_ref':review})
 if slug=='furikomi-tesuryo-hikaku':
  # Date-only context required by the changed-line numeric guard. These have NO covers,
  # do not promote any original out_of_corpus unit, and are not independent review counts.
  acquired=next(c.copy() for c in ledgerold['claims'] if c['id']=='r14-source-acquisition')
  acquired.update(covers=[],verification_scope='取得日の編集記録のみ。元の正本外単位は未確認のまま保持。')
  ledger['claims'].append(acquired)
  date_source=sources('corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:9-15')[0]
  ledger['claims'].append(dict(id='t8q1-release-date',text='法人通常振込料金の発表日は2026年9月2日',numbers=['2026年9月2日'],where=['調査方法と出典'],covers=[],applies='発表日のみ。適用開始日とは区別する。',exceptions='日付のみを原本の発表日欄で確認。元の正本外単位の判定は変更しない。',**date_source))
  lines=(D/'zengin-fee-20251016.txt').read_text().split('\n')
  ledger['claims'].append(dict(id='t8q1-operating-cost-start-date',text='内国為替制度運営費の適用開始年月は2021年10月',numbers=['2021年10月'],where=['FAQの既存日付'],covers=[],applies='適用開始年月という日付だけの照合。',exceptions='追加一次資料の過去の適用開始日を確認。元の正本外単位は本文を保持し、needed_source付き未確認のまま（単位全体のokへの昇格はしない）。',source_url='https://www.zengin-net.jp/announcement/pdf/announcement_20251016.pdf',source_quote='\n'.join(lines[12:16]),corpus_ref=str(D/'zengin-fee-20251016.txt')+':13-16'))
  ledger['absolutes'].append(dict(phrase='一律',context='の費用は2021年10月に金額不問の原則一律',reviewed='元の正本外単位は未確認として保持。追加確認した全銀ネット2021年3月18日資料では給与・賞与は無料、公金・国庫金は適用開始が別時期。本文の主張全体をokと扱わない。'))
 ledger['pending_segments']=ledger['out_of_corpus']
 (Path(os.environ.get('LEDGER_OUTPUT_ROOT','.'))/('claims/column/'+slug+'.json')).write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
 afterstats[page]={k:len(ledger[k]) for k in ['claims','nonclaims','verified','out_of_corpus','repairer_verified']};afterstats[page]['covered']=sum(bool(c.get('covers')) for c in ledger['claims'])
expected=[x for x in a.values() if x['decision']=='out_of_corpus' and oc[key(x)]['verdict']!='wrong']
assert len(preserved)==len(expected),(len(preserved),len(expected),[x for x in expected if not any(y['page']==x['page'] and y['old_id']==x['id'] for y in preserved)])
(D/'repair-map.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
(D/'preserved-out-of-corpus.json').write_text(json.dumps(preserved,ensure_ascii=False,indent=2)+'\n')
(D/'ledger-counts-after.json').write_text(json.dumps(afterstats,ensure_ascii=False,indent=2)+'\n')
print(afterstats);print('new units without old sentence',[(u['id'],u['text']) for u in unmatched]);print('preserved OC',len(preserved))
