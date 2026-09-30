import json,re,shutil
from pathlib import Path
R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t8-a');D=Path('review/r16-t8-a')
read=lambda p:json.loads(Path(p).read_text())
write=lambda p,x:Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
before=read(D/'segments-before.json');after=read(D/'segments-after.json');adj={(x['page'],x['id']):x for x in read(R/'segment-adjudication.json')['segments']};sol={(x['page'],x['id']):x for p in sorted((R/'out').glob('s*.json')) for x in read(p)['segments']}
(D/'corpus').mkdir(exist_ok=True)
for p in (R/'corpus').glob('*.txt'):shutil.copyfile(p,D/'corpus'/p.name)
for f in ['segments.json','segment-adjudication.json','oc-opinion.json','coverage.json','fixes.md','corpus_desc.md']:shutil.copyfile(R/f,D/f)

def source(ref):
 parts=[];url=''
 for part in ref.split(';'):
  f,rs=part.split(':');p=D/f;lines=p.read_text().splitlines()
  if not url:url=re.search(r'https://\S+', '\n'.join(lines[:3]))[0]
  for rr in rs.split(','):
   a,b=map(int,rr.split('-'));parts.append('\n'.join(lines[a-1:b]))
 return url,'\n'.join(parts)
M='corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt';S='corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt';Y='corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt';RE='corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt';CH='corpus/www_chibabank_co_jp_kinri_fee_transfer.txt'
fees=f'{M}:13-27,127-128,196-206,225-226;{S}:13-21,34-61;{CH}:64-75;{RE}:14-47;{Y}:29-43,65-65'
fixed_rules=[
 ('minpo',lambda u: u['text'].startswith(('日・週・月・年で','ただし、午前零時')), 'corpus/egov_minpo_140.txt:3-3','午前零時開始の例外を直後に明記。'),
 ('arrival',lambda u: u['text'].startswith(('振込の着金日は、','即時振込が利用','翌銀行営業日扱いとなる')), 'corpus/faqsearch_sevenbank_co_jp_answer_68c01de9700e23540e35bd95.txt:9-14;corpus/www_bk_mufg_jp_tsukau_furikomi_direct_index_html.txt:77-89,110-113','メンテナンス、即時振込登録、モアタイムと口座条件により区別。'),
 ('fees',lambda u: u['text'].startswith(('前提：多く','165円（金額区分なし・','ゆうちょダイレクト','三菱UFJダイレクトの三菱','りそなマイゲートは')) or u['id'] in ['s-8faf021aa0015e9dee7b-1','s-6c157ac025f1b690f7d1-1'],fees,'表と直下注でチャネル・ステータス・非居住者・特別宛先を限定。無料回数を除く標準料金。'),
 ('nta29',lambda u: u['text'].startswith(('売上値引きは元の売上','処理方法は、契約','立替払いは差引額','買手の役務提供への対価を','少額特例の要件を満たす場合は帳簿')),None,'契約関係による3処理、軽減税率、買手の確認、少額特例を区別。'),
 ('nta6496',lambda u: u['text'].startswith(('振込手数料について帳簿','振込手数料以外にも、')),None,'帳簿のみの例示であって網羅や一律免除ではない。金額・対象・保存事項の条件を明記。')]

for page in dict.fromkeys(x['page'] for x in before):
 lp=Path('claims')/(page.removeprefix('docs/').removesuffix('/index.html')+'.json');lp.parent.mkdir(parents=True,exist_ok=True)
 ledger=read(lp) if lp.exists() else dict(page=page,claims=[],absolutes=[],tool_cases=[])
 ledger['checked']='2026-10-01';ledger['nonclaims']=[];ledger['verified']=[];ledger['unverified']=[]
 # Preserve historical claims, but do not present their scope as newly verified.
 ledger['claims']=[x for x in ledger['claims'] if not x['id'].startswith('r16-')]
 for cl in ledger['claims']:cl.pop('covers',None)
 ledger['review_scope']='r16/t8-a。coversは固定正本または明示した補足一次資料で照合した単位のみ。unverifiedは未確認であり被覆に算入しない。'
 for u in [x for x in after if x['page']==page]:
  k=(page,u['id']);a=adj.get(k);rule=next((x for x in fixed_rules if x[1](u)),None)
  if a and (a['decision']=='nonclaim' or a['decision']=='unresolved' and not u['protected'] and u['kind'] in ['th','h2','div'] and not rule):
   ledger['nonclaims'].append(dict(id=u['id'],why=a['reason'] if a['decision']=='nonclaim' else '整理用の見出しで事実命題を含まない。本文・表の主張セルは別単位で照合。'));continue
  if a and a['decision']=='ok' or rule:
   ref=rule[2] if rule else sol[k].get('corpus_ref',fees)
   exc=rule[3] if rule else a['reason']
   if ref:url,quote=source(ref);cref=';'.join(str(D/p) for p in ref.split(';'))
   else:
    f='nta29' if rule[0]=='nta29' else 'nta6496';txt=(D/'supplement'/f'{f}.txt').read_text();url='https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/qa/29.pdf' if f=='nta29' else 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6496.htm';quote=txt if f=='nta29' else txt[txt.index('帳簿のみの保存で仕入税額控除が認められる場合'):txt.index('金または白金の地金の課税仕入れを行った場合')];cref=str(D/'supplement'/f'{f}.txt')
   cl=dict(id='r16-'+u['id'],text=u['text'],where=[u['kind']+'/'+u['zone']],numbers=[],applies='固定正本2026-09-30取得版。銀行料金は各公表時点。補足国税庁資料は2026-10-01取得。',source_url=url,source_quote=quote,exceptions=exc,covers=[u['id']],topic=['r16-t8-a'],corpus_ref=cref)
   ledger['claims'].append(cl)
   if a and a['decision']=='ok':ledger['verified'].append(dict(id=u['id'],text_hash=u['text_hash'],result='ok',review_ref=str(D/'segment-adjudication.json')))
   continue
  if a:
   assert a['decision']=='out_of_corpus',(u,a)
   ledger['unverified'].append(dict(id=u['id'],text_hash=u['text_hash'],result='out_of_corpus',needed_source=a['needed_source'],reason=a['reason']))
  else:
   # The changed callout contains an unchanged, unverified popularity assertion as well as the corrected invoice rules.
   assert u['text'].startswith('インボイス制度との関係'),u
   ledger['unverified'].append(dict(id=u['id'],text_hash=u['text_hash'],result='out_of_corpus',needed_source='方法2を選ぶ会社が増えていることを示す調査・統計。インボイスの修正文自体は補足nta29.txtで確認。',reason='複合単位の全体をokにしない。'))
 # Replace obsolete historical invoice claim to avoid a contradictory ledger.
 if page=='docs/senpou-futan/index.html':
  old=next(x for x in ledger['claims'] if x['id']=='r9-changed-statements');old['text']='買手の役務提供への対価を課税仕入れとする場合は、買手の適格請求書または買手確認済み仕入明細書等を保存。少額特例あり。';old['source_url']='https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/qa/29.pdf';old['source_quote']=(D/'supplement/nta29.txt').read_text();old['exceptions']='少額特例と金融機関への立替払いは別の取扱い。';old['numbers']=[]
 write(lp,ledger)
