import json,re
from pathlib import Path
E=Path('review-evidence/auto20261002-t8-q08461-recheck1');C=Path('review-evidence/auto20261002-t8-q08461/corpus');P=Path('claims/column/furikomi-tesuryo-hikaku.json')
l=json.loads(P.read_text());a=json.loads((E/'segments-after.json').read_text());before={x['id']:x for x in json.loads((E/'segments-before.json').read_text())};ad={x['id']:x for x in json.loads((E/'segment-adjudication.json').read_text())['segments']};now={x['id']:x for x in a}
sections=json.loads(Path('review-evidence/auto20261002-t8-q08461/source-sections.json').read_text())
sections.update({
'paypay-biz':['www_paypay_bank_co_jp_business_fee_transfer_html.txt',6,21,'法人の通常145円。前月円普通・円定期平均残高3,000万円以上の優遇、開設月の翌々月末まで月5回無料を除く。同行宛0円。'],
'rakuten':['www_rakuten_bank_co_jp_charge.txt',40,95,'通常振込・予約は無料回数なし145円。会員ステージ最大月3回と給与・賞与・公的年金受取の翌月3回は多い方のみ。受取特典分のみ月最大5回まで翌月繰越、ステージ分は繰越不可。無料回数利用取引はポイント・件数対象外。Viber・メルマネ・Facebookは別サービス。'],
'rakuten-biz':['www_rakuten_bank_co_jp_business_howto_interest_html.txt',86,135,'法人ビジネス口座の他行宛150円/229円。個人の無料回数とは区別する。'],
'yokohama':['www_boy_co_jp_fee_furikomi_html.txt',5,25,'個人IB・はまぎん365の他行宛3万円未満154円。ゼロ手数料条件充足時は15日〜翌月14日の合計3回無料。3万円以上の金額は正本抽出欠落につき未確認。'],
'yucho-biz':['www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt',53,98,'通常/総合振込の他行宛165円、給与振込の他行宛110円。同行振替100円、総合振込の同行宛39/50/66円、給与同行無料は別区分。契約/月額はスタンダード5,500/1,100円、エキスパート11,000/2,200円。契約法人ID単位、初月引落日の特則とプラン変更差額5,500円あり。'],
})
# Copies preserve exact input corpus bytes; no modification to RUN.
(E/'corpus').mkdir(exist_ok=True)
def source(f,lo,hi):
 t=(C/f).read_text();(E/'corpus'/f).write_text(t);ls=t.splitlines();return {'corpus_ref':f'corpus/{f}:{lo}-{hi}','snapshot_ref':f'{E}/corpus/{f}:{lo}-{hi}','source_url':ls[0].replace('出典: ','').strip(),'source_quote':'\n'.join(ls[lo-1:hi])}
def refs(row):
 out=[]
 for q in row.get('conditions',[]):
  for f,lo,hi in re.findall(r'corpus/([^:; ]+\.txt):(\d+)(?:-(\d+))?',q['corpus_ref']):out.append(source(f,int(lo),int(hi or lo)))
 return out
for c in l['claims']:c['covers']=[i for i in c.get('covers',[]) if i in now]
l['nonclaims']=[n for n in l['nonclaims'] if n['id'] in now]
l['verified']=[v for v in l['verified'] if v['id'] in now and v['id'] not in ad]
l['repairer_verified']=[v for v in l['repairer_verified'] if v['id'] in now and v['id'] not in ad]
context='';new=[]
for u in a:
 i=u['id'];t=u['text'];row=ad.get(i)
 if u['kind'] in ['h2','h3','heading'] or t.endswith('の振込手数料'):context=t
 if i in before and not row:continue
 if row and row['decision']=='ok':
  src=refs(row);ex=[c['condition'] for c in row['conditions']];status='ok' if not row.get('needed_source') else 'partially_verified'
 else:
  keys=[]
  effective=t+' '+context
  for token,ks in [('三菱',['mufg']),('BizSTATION',['mufg']),('メインバンク',['mufg']),('Olive',['smbc']),('SMBC',['smbc']),('三井住友銀行',['smbc']),('PayPay',['paypay','paypay-biz']),('GMO',['gmo','gmo-biz']),('カスタマー',['gmo']),('とくとく',['gmo-biz']),('楽天',['rakuten','rakuten-biz']),('横浜',['yokohama']),('ゼロ手数料',['yokohama']),('SMTB',['smtb','smtb-new','smtb-biz']),('件数優遇',['smtb-new','smtb-biz']),('提携サービスを除く',['smtb-new','smtb-biz']),('ゆうちょ',['yucho','yucho-biz']),('利用口座',['yucho']),('受入明細票',['yucho']),('165円',['yucho','yucho-biz','resona','saitama']),('75円〜440円',list(sections))]:
   if token in effective:keys+=ks
  if '予約は受付日を無料回数' in t:keys+=['gmo']
  if not keys: raise ValueError((i,t,context))
  keys=list(dict.fromkeys(keys));src=[source(*sections[k][:3]) for k in keys];ex=[sections[k][3] for k in keys];status='repaired_pending_independent_review'
  if row and row.get('needed_source'):src+=refs(row)
 if not src:raise ValueError(('missing source',i))
 claim={'id':'t8recheck1-'+i,'text':t,'where':[u.get('element_id') or u['kind']],'numbers':[],'applies':'2026年10月1日以後。旧料金の記述は改定前。資料取得日2026年9月30日。','scope':'本文で名指した銀行・個人/法人・サービス・宛先・金額帯に限る。通常単価は無料回数・優遇の適用外。'+(row.get('verified_scope','') if row else ''),'exceptions':ex,'covers':[i],'topic':['振込手数料の条件・例外'],'source_url':src[0]['source_url'],'source_quote':src[0]['source_quote'],'corpus_ref':src[0]['corpus_ref'],'sources':src,'result':status,'review_ref':f'{E}/segment-adjudication.json#{i}' if row else f'{E}/source-sections.json'}
 if row and row.get('needed_source'):
  claim['needed_source']=row['needed_source'];claim['unverified_parts']=row.get('out_of_corpus_parts',[])
  l['out_of_corpus'].append({'id':i,'text_hash':u['text_hash'],'result':'out_of_corpus','partial':True,'needed_source':row['needed_source'],'scope':row.get('out_of_corpus_parts',[]),'review_ref':claim['review_ref']})
 l['claims'].append(claim)
 if status=='ok':l['verified'].append({'id':i,'text_hash':u['text_hash'],'result':'ok','review_ref':claim['review_ref']})
 else:l['repairer_verified'].append({'id':i,'text_hash':u['text_hash'],'result':status,'sources':[s['corpus_ref'] for s in src]})
 new.append({'id':i,'text':t,'result':status,'sources':[s['corpus_ref'] for s in src]})
l['checked']='2026-10-02';l['review_run']='auto20261002/t8-q08461-recheck1';l['scope']='再照合のokは今回審査に対応。修正は担当者確認・独立再照合待ち。部分的な正本外はneeded_source付きで未確認。'
P.write_text(json.dumps(l,ensure_ascii=False,indent=2)+'\n');(E/'new-claims.json').write_text(json.dumps(new,ensure_ascii=False,indent=2)+'\n');(E/'source-sections.json').write_text(json.dumps(sections,ensure_ascii=False,indent=2)+'\n')
