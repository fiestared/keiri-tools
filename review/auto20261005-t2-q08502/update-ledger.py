import json,re,difflib
from pathlib import Path
RUN=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261005/t2-q08502')
E=Path('review/auto20261005-t2-q08502')
old=json.loads((RUN/'segments.json').read_text());new=json.loads((E/'segments-after.json').read_text());adj={x['id']:x for x in json.loads((RUN/'segment-adjudication.json').read_text())['segments']};opin={x['id']:x for x in json.loads((RUN/'oc-opinion.json').read_text())['units']}
p=Path('claims/column/gensen-choshuhyo-mikata.json');d=json.loads(p.read_text());ids={x['id'] for x in new};oldmap={x['id']:x for x in old}
d['claims']=[c for c in d['claims'] if not c['id'].startswith('auto20261005-')]
# Retain historical source records and numeric registrations, retire stale mappings/proofs.
for c in d['claims']:c['covers']=[]
d['nonclaims']=[];d['verified']=[];d['out_of_corpus']=[]
issues=[
 ('給与収入と支払金額の例外',[1,3,10,56,259,263,286,426,433],['corpus/02.txt:117-124','corpus/02.txt:535-543'],'年中の支払確定額。通算した前職分を含み、作成日現在の未払額を内書き。賃金支払確保法7条の弁済額は除外して摘要に記載。条約免税対象額は含める。'),
 ('年末調整済みのみ記載・内訳',[20,21,22,42,95,99,104,114,117,120,124,127,231,246,252,350,441],['corpus/02.txt:125-134','corpus/02.txt:167-172','corpus/02.txt:217-257','corpus/02.txt:372-376'],'②③・配偶者控除額・特定親族特別控除額・保険料控除額・保険料内訳・基礎控除額・調整控除額は年末調整済みのみ。社会保険料等は未調整でも記載。配偶者2控除は重複不可。本人所得1000万円超は配偶者控除不可。配偶者特別控除は配偶者所得62万円以下・133万円超不可。特定親族特別控除は62万円以下・123万円超不可。小規模企業共済等掛金（企業型・個人型年金加入者掛金、一定の心身障害者扶養共済掛金を含む）は内書き。前職通算の社会保険料を含む。基礎控除不適用は0。令和8年12月1日以後の記載要領。令和8年分の23歳未満扶養親族に係る生命保険料控除の特例は摘要に租税特別措置法第41条の15の5第1項適用と記載。新旧の生命・個人年金契約は平成24年1月1日以後と平成23年12月31日以前で区分。国民年金保険料等は国民年金保険料と国民年金基金掛金。旧長期損害保険料は平成18年12月31日までの長期契約分を記載。本文は主な例外と明示して主要な欄の読み方を説明する範囲。'),
 ('年調計算の下限・端数・調整控除の適用',[45,48,228],['corpus/02.txt:125-142','corpus/../t1-corpus/nencho/nencho_all.txt:2771-2835','corpus/../t1-corpus/nencho/nencho_all.txt:2860-2982'],'660万円未満は当該年分の表、以上は算式の1円未満切捨て。適用ある所得金額調整控除のみ減算し1円未満切上げ、給与総額1000万円上限・控除最高15万円。課税所得1000円未満切捨て、住宅ローン控除後0下限、102.1%後100円未満切捨て。'),
 ('500万円計算例の前提',[34,50,65,66,74,75,76],['corpus/../t1-corpus/gensen/01.txt:12-47','corpus/../t1-corpus/nencho/nencho_all.txt:2771-2982'],'令和7年分の居住者・年末調整済み、給与のみ500万円、社会保険料75万円、扶養なし、他の所得控除・住宅ローン控除・所得金額調整控除・特定支出控除なし。基礎控除加算は居住者のみ、合計所得帯により変化。'),
 ('未払・災害猶予と税額',[13,226,276],['corpus/02.txt:117-142','corpus/02.txt:545-548'],'未払額と未徴収税額の内書きは作成日現在。未調整税額は災害の徴収猶予税額を除外し、摘要に猶予税額と災害者欄に印を記載。年末調整済みは精算後。'),
 ('空欄の確認と申告時の給与所得',[229,272,446],['corpus/02.txt:117-134'],'②③は年末調整済みのみ。未調整による空欄は不備でないが、空欄だけから未調整とは断定しない。票が1枚でも未調整なら①から給与所得を計算。前職通算済みの票は前職票を重ねない。申告書転記の詳細は正本外として分離。'),
 ('特親・年少者・摘要の条件',[240,241,255],['corpus/02.txt:173-208','corpus/02.txt:378-453','corpus/02.txt:487-558'],'未調整の特親は所得見積100万円以下。年少者は扶養控除なし。申告書の年少扶養と退職手当親族の双方に記載された年少者は退職所得を含む合計所得62万円超なら氏名欄に記載しない。国外住所の年少者は受給者票の氏名欄区分に○、5人目以降は摘要に年少・非居住者を付記。税務署票では区分00/01。マイナンバーは受給者票に記載しない。摘要は主な例の紹介であり全10区分の網羅を主張しない。'),
 ('電子交付の承諾',[311],['corpus/10.txt:24-38'],'種類・内容を事前提示し書面又は電磁的方法で承諾。給与所得票は事前のみなし承諾通知と期限まで無回答なら承諾とみなす。請求があれば書面交付。'),
 ('住宅ローン控除と過納額還付',[337,338,341,436],['corpus/02.txt:233-264','corpus/../t1-corpus/nencho/nencho_all.txt:2962-3055'],'年末調整で適用した場合の記載。控除額は算出所得税額が上限。控除しきれなければ可能額欄に控除全額。年税額0でも還付済みとは限らず、計算上の超過額から未払給与の未徴収税額・年調月の未納付徴収税額を控除して精算。納期特例・順次還付・税務署還付区分も本文で説明。'),
 ('システム更改に伴う様式変更',[372],['corpus/01.txt:100-120'],'令和8年9月の更改に伴う書面で税務署提出する法定調書の様式変更。税制改正による変更とは別。最新様式を使用し提出の注意点も確認。'),
 ('11月30日以前の所得要件読替え',[401,407],['corpus/02.txt:82-82','corpus/02.txt:424-428','corpus/02.txt:438-451','corpus/02.txt:560-570'],'令和8年12月1日以後の年末調整が前提。11月30日以前の年調、又は未調整票を同日以前に提出された扶養控除等又は従たる給与申告書に基づいて作成する場合は62万円を58万円へ読替え。'),
 ('通常交付期限と中途退職',[488],['corpus/02.txt:572-591'],'在職者の令和8年分は令和9年2月1日。中途退職は退職日以後1か月以内。税務署提出には翌年1月末の一括提出の運用あり。非居住者向け別支払調書の提出とは区別。')]
byold={old[i]['id']:j for j,(_,ix,_,_) in enumerate(issues) for i in ix}

def readref(ref):
 m=re.match(r'(.*):(\d+)(?:-(\d+))?$',ref);f,a,b=m.groups();lines=(RUN/f).read_text().split('\n');return '\n'.join(lines[int(a)-1:int(b or a)])
allrefs=list(dict.fromkeys(ref for _,_,refs,_ in issues for ref in refs))
allquotes=[{'corpus_ref':r,'source_quote':readref(r)} for r in allrefs]
(E/'source-evidence.json').write_text(json.dumps(allquotes,ensure_ascii=False,indent=2)+'\n')
# Match exact independent review records; edited units get repair records, never independent ok.
newrecords=[]
for u in new:
 a=adj.get(u['id']);orig=oldmap.get(u['id']);same=bool(a)
 if not same:
  candidates=[o for o in old if o['kind']==u['kind']]
  orig=max(candidates,key=lambda o:difflib.SequenceMatcher(None,o['text'],u['text']).ratio())
  a=adj[orig['id']]
 if a['decision']=='nonclaim' and same and not u['protected']:
  d['nonclaims'].append({'id':u['id'],'why':a['reason'],'review_ref':str(RUN/'segment-adjudication.json')+'#'+u['id']});continue
 oc=same and a['decision']=='out_of_corpus'
 j=byold.get(orig['id'])
 # Changed calculations/table fragments inherit their containing example conditions.
 t=u['text']
 if not same and any(v in t for v in ['117,900','115,500','680,000','1,430,000','令和7年分の居住者']):j=3
 if not same and '年末調整済みのみ印字' in t:j=1
 if not same and j is None:
  if '58万円' in t and ('読替' in t or '読み替' in t):j=10
  elif '未徴収' in t:j=4
  elif '賃金支払確保法' in t:j=0
  else:j=1
 refs=issues[j][2] if j is not None else list(dict.fromkeys(re.findall(r'corpus/(?:\.\./)?[\w/.-]+\.txt:\d+(?:-\d+)?',a['reason']+' '+json.dumps(a.get('conditions',[]),ensure_ascii=False))))
 if not refs:refs=['corpus/02.txt:117-142']
 refs=[r for r in refs if (RUN/r.rsplit(':',1)[0]).exists()]
 c={'id':'auto20261005-'+u['id'],'text':t,'where':[u['kind']+': '+(u.get('element_id') or t[:90])],'numbers':[],'applies':'本文に明示した年分・対象区分。金額設例は令和7年分。','scope':t if len(t)>4 else '源泉徴収票の欄名・位置の説明。','source_url':'https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/02.pdf','source_quote':readref(refs[0]),'corpus_ref':refs[0],'supporting_sources':[{'corpus_ref':r,'source_quote':readref(r)} for r in refs[1:]],'exceptions':issues[j][3] if j is not None else [x['condition'] for x in a.get('conditions',[])] or ['無し: 記載要領の該当節の注・別区分を審査で確認した範囲の欄名の説明。'],'covers':[u['id']],'review_status':'out_of_corpus_unverified' if oc else 'independent_ok' if same and a['decision']=='ok' else 'repaired_pending_independent_review','review_ref':str(RUN/'segment-adjudication.json')+'#'+orig['id']}
 if oc:
  needed=a.get('needed_source') or a['reason'];c['needed_source']=needed
  c['source_quote']='正本外のため未確認。以下の needed_source の取得が必要。';c.pop('corpus_ref');c['supporting_sources']=[]
  d['out_of_corpus'].append({'id':u['id'],'text_hash':u['text_hash'],'text':t,'status':'unverified','needed_source':needed,'second_opinion':opin.get(u['id'],{}).get('verdict','unsure'),'opinion_reason':opin.get(u['id'],{}).get('reason'),'review_ref':c['review_ref']})
 elif same and a['decision']=='ok':
  d['verified'].append({'id':u['id'],'text_hash':u['text_hash'],'result':'ok','review_ref':c['review_ref']})
 if not same and j==3:
  c['derived']=True;c['calc']='Python実行: 5000000-(5000000*0.2+440000)=3560000; 750000+680000=1430000; 3560000-1430000=2130000; 2130000*0.1-97500=115500; 115500*1.021=117925.5; floor(117925.5/100)*100=117900。令和7年分の居住者・給与のみ・他控除なし・年末調整済み。'
 if a.get('needed_source'):c['needed_source']=a['needed_source']
 if not same and a['decision']=='out_of_corpus':
  c['needed_source']=a.get('needed_source') or a['reason']
  c['unverified_part']='申告理由の例示と具体的な転記方法。年末調整済み限定・未調整の②の空欄・前職通算条件だけを修正。'
 if c.get('corpus_ref','').startswith('corpus/../t1-corpus/nencho/'):
  c['source_url']='https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf'
 elif c.get('corpus_ref','').startswith('corpus/../t1-corpus/gensen/'):
  c['source_url']='https://www.nta.go.jp/publication/pamph/gensen/aramashi2026/pdf/01.pdf'
 elif c.get('corpus_ref','').startswith('corpus/01.txt'):
  c['source_url']='https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/01.pdf'
 elif c.get('corpus_ref','').startswith('corpus/10.txt'):
  c['source_url']='https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/10.pdf'
 d['claims'].append(c)
 if not same:newrecords.append({'id':u['id'],'original_id':orig['id'],'issue':issues[j][0] if j is not None else None,'text':t,'corpus_ref':refs})
d['checked']='2026-10-05';d['scope']='auto20261005 t2-q08502。独立okは同文だけ継承。修正箇所は再審査待ち。正本外は未確認のまま保持。'
(E/'issues.json').write_text(json.dumps([{'issue':name,'unit_ids':[old[i]['id'] for i in ix],'indices':ix,'corpus_ref':refs,'exceptions':ex} for name,ix,refs,ex in issues],ensure_ascii=False,indent=2)+'\n')
(E/'changed-unit-records.json').write_text(json.dumps(newrecords,ensure_ascii=False,indent=2)+'\n')
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('units',len(new),'independent ok',len(d['verified']),'nonclaims',len(d['nonclaims']),'OC',len(d['out_of_corpus']),'new',len(newrecords))
