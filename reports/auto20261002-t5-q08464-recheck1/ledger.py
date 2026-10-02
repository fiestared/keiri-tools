import json,re,subprocess
from pathlib import Path
P=Path('reports/auto20261002-t5-q08464-recheck1');R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t5-q08464-recheck1')
adj=json.loads((R/'segment-adjudication.json').read_text())['segments']; originals={(u['page'],u['id']):u for u in json.loads((R/'segments.json').read_text())}
topics={
 'donation':('指定時点・特別利益除外・年合計2,000円超・控除限度',['egov_chihozei_37_2.txt:9-15','egov_chihozei_37_2.txt:40-125','soumu_furusato_deduction.txt:32-70'],'寄附時指定・特別利益除外・対象寄附年合計2,000円超。所得税40％・基本分30％・特例分20％。各税率が異なる場合があり全額控除を保証しない。指定都市は県2％市8％、通常は県4％市6％。'),
 'age':('扶養・配偶者の年途中死亡時の現況と年齢',['egov_chihozei_314_2.txt:551-586','egov_chihozei_314_2.txt:672-769','egov_chihozei_314_2.txt:817-835','egov_chihozei_314_2.txt:1010-1024'],'寄附年末、年途中死亡時は死亡時。扶養所得・生計・専従者除外等の資格も必要。配偶者本人所得900/950/1000万円の別区分、非居住者30〜69歳3要件、同居老親等、死亡後再婚の別規定。特定親族特別控除は扶養控除の別区分。'),
 'nonresident':('非居住者の全3例外を同一列挙に含める',['egov_chihozei_314_2.txt:672-714'],'16〜29歳・70歳以上、30〜69歳は留学による国内住所居所喪失・障害者・寄附者から年中生活教育費38万円以上受領のいずれか。所得等の扶養要件も必要。'),
 'rate':('特例割合の第1号表・90％・山林退職の別区分',['egov_chihozei_37_2.txt:125-237','soumu_furusato_deduction.txt:32-70'],'第1号は課税総所得あり人的控除差調整後0円以上。第2号は差引後負で山林退職なし90％。第3号は課税総所得なし又は差引後負で山林退職あり、山林1/5・退職全額に表適用、両方なら低い割合。実際の所得税率と特例分用税率は異なり得る。'),
 'adjustment':('所得金額調整控除全区分と所得割の区別',['tokyo_kojin_ju.txt:358-373','soumu_kojin_juminzei.txt:100-124','egov_chihozei_37_2.txt:125-125'],'給与のみの概算。850万円超で本人特別障害・23歳未満扶養・特別障害の同一生計配偶者又は扶養の3区分、給与1000万円上限で差額10％。給与年金併有はこの給与のみの説明の対象外。所得割非課税は0円、特例分限度は調整控除後その他税額控除前。'),
 'onestop':('任意申告を含むワンストップ失効',['egov_chihozei_fusoku_7.txt:6-71','nta_1155.txt:20-57'],'所得税申告義務なし、寄附以外に住民税申告不要、5団体以下で申請。任意も含む確定申告・住民税申告、5団体超、通知先と賦課期日住所の不一致は無効。氏名住所生年月日の申請日から賦課期日までの変更は翌年1月10日まで届出。'),
 'income62':('62万円要件の令和9年度適用（OC指摘の再確認）',[],'令和9年度以後の住民税の扶養所得62万円。令和8年度までは従前。専従者除外・生計同一・重複不可の要件は維持。')}
def topic(t):
 if '非居住者の控除対象' in t:return 'nonresident'
 if '給与所得のみで所得割' in t:return 'adjustment'
 if 'ワンストップは' in t:return 'onestop'
 if '合計所得62万円以下' in t:return 'income62'
 if '年末' in t and any(v in t for v in ['扶養','配偶者','子1人','子2人','70歳']):return 'age'
 if any(v in t for v in ['割合','第1号表','これは「90','③ 住民税からの控除・特例分']):return 'rate'
 return 'donation'
def sources(refs):
 qs=[]
 for ref in refs:
  name,r=ref.split(':');lo,hi=map(int,r.split('-'));lines=(R/'corpus'/name).read_text().splitlines();qs.append('\n'.join(lines[lo-1:hi]).strip())
 return '\n\n'.join(qs)
issues={k:dict(name=v[0],units=[],refs=['corpus/'+r for r in v[1]],exceptions=v[2]) for k,v in topics.items()}
for a in adj:
 if a['decision']=='unresolved':issues[topic(originals[a['page'],a['id']]['text'])]['units'].append({'page':a['page'],'id':a['id'],'severity':a['severity']})
issues['income62']['units']=[{'page':'docs/furusato/index.html','id':'s-fad414e416129658d1f1-1','severity':'not_wrong_after_primary_check'}]
for f in P.glob('after-docs*.json'):
 us=json.loads(f.read_text())['units'];before=json.loads((P/f.name.replace('after','before')).read_text())['units'];page=us[0]['page'];lp=Path(page.replace('docs/','claims/').replace('/index.html','.json'));d=json.loads(lp.read_text());current={u['id']:u for u in us};oldids={u['id'] for u in before}
 for c in d['claims']:c['covers']=[id for id in c.get('covers',[]) if id in current]
 d['nonclaims']=[n for n in d.get('nonclaims',[]) if n['id'] in current];d['verified']=[v for v in d.get('verified',[]) if v['id'] in current]
 # independent adjudicated ok units: preserve precise scope of each reviewed part
 for i,a in enumerate(adj):
  if a['page']!=page or a['decision']!='ok' or a['id'] not in current:continue
  u=current[a['id']];refs=[]
  for co in a.get('conditions',[]):
   for name,ran in re.findall(r'corpus/([^ :]+\.txt):(\d+(?:-\d+)?)',co.get('corpus_ref','')):
    if '-' not in ran:ran+='-'+ran
    refs.append(name+':'+ran)
  if not refs:continue
  refs=list(dict.fromkeys(refs));d['claims'].append(dict(id=f'recheck1-ok-{i}',text=u['text'],where=[u['kind']],numbers=[],applies='2026年寄附・令和9年度住民税。単位に別記の年分はその範囲。',scope='当該単位の制度説明のうち審査で正本照合した部分。'+a.get('unchecked_part',''),exceptions=[co['condition'] for co in a.get('conditions',[])],source_url='https://laws.e-gov.go.jp/law/325AC0000000226',source_quote=sources(refs),corpus_ref='; '.join('corpus/'+r for r in refs),covers=[u['id']],review_ref=str(R/'segment-adjudication.json')))
  if not a.get('unchecked_part'):d['verified'].append(dict(id=u['id'],text_hash=u['text_hash'],result='ok',review_ref=str(R/'segment-adjudication.json')))
 for k,(name,refs,exc) in topics.items():
  units=[u for u in us if u['id'] not in oldids and topic(u['text'])==k]
  if not units:continue
  quote=sources(refs);cref='; '.join('corpus/'+r for r in refs)
  if k=='income62':quote=(P/'corpus/fuyo-2027.txt').read_text();cref=str(P/'corpus/fuyo-2027.txt')+':3-9';refs=[cref]
  # Table amounts and future tax legislation stay unconfirmed; only changed conditions are covered by this claim.
  d['claims'].append(dict(id='recheck1-'+k,text=name,where=[u['kind']+': '+u['text'][:90] for u in units],numbers=[],applies='2026年寄附・令和9年度住民税',scope='上記対象年の'+name+'。表の実額・改正法の読替期間・製品の計算精度はこの主張の確認範囲外。',exceptions=exc,source_url='https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju' if k=='adjustment' else 'https://laws.e-gov.go.jp/law/325AC0000000226',source_quote=quote,corpus_ref=cref,covers=[u['id'] for u in units],topic=[k]))
  for u in units:
   if u['kind']=='td' or '令和29年' in u['text'] or '平成26年度' in u['text']:
    d['claims'].append(dict(id='recheck1-unconfirmed-'+u['id'],text=u['text'],where=[u['kind']],numbers=[],applies='当該単位の年分',scope='単位の正本外部分は未確認',exceptions='制度条件の修正と表の実額・将来改正の確認は別。',status='unconfirmed',needed_source='表の実額は独立再計算資料、将来改正は改正法の適用附則全文。',source_url='https://laws.e-gov.go.jp/law/325AC0000000226',source_quote=quote,corpus_ref=cref,covers=[]))
 # Do not upgrade out-of-corpus not_wrong units.
 for a in adj:
  if a['page']==page and a['decision']=='out_of_corpus' and a['id'] in current:
   for c in d['claims']:
    if a['id'] in c.get('covers',[]):c['covers'].remove(a['id'])
   d['verified']=[v for v in d['verified'] if v['id']!=a['id']]
   d['claims'].append(dict(id='recheck1-oc-'+a['id'],text=current[a['id']]['text'],where=[current[a['id']]['kind']],numbers=[],applies='記載年分',scope='固定正本外・未確認',exceptions='別モデルnot_wrongは正本照合済みを意味しない。',status='unconfirmed',needed_source=a.get('needed_source') or '地方税法の扶養親族定義・重複算入又はワンストップ申請期限の一次資料',source_url='https://laws.e-gov.go.jp/law/325AC0000000226',source_quote='固定正本外のため未確認',covers=[]))
 lp.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
(P/'issues.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2)+'\n')
