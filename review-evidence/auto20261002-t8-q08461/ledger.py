from pathlib import Path
import json,re,subprocess,difflib,collections
E=Path('review-evidence/auto20261002-t8-q08461'); P=Path('claims/column/furikomi-tesuryo-hikaku.json')
old=json.loads(subprocess.check_output(['git','show','886e539e:'+str(P)])); ledger=json.loads(json.dumps(old)); before=json.loads((E/'segments.json').read_text()); after=json.loads((E/'segments-after.json').read_text()); adjud=json.loads((E/'segment-adjudication.json').read_text())['segments']; adj={s['id']:s for s in adjud}; prev={s['id']:s for s in before}; byhash=collections.defaultdict(list)
before_context={};context_key=''
for s in before:
 if s['kind'] in ['h2','h3']:context_key=s['element_id'] or s['text']
 before_context[s['id']]=context_key
 byhash[s['text_hash']].append(s)
# Preserve historical claim records, removing stale coverage and independently verified assertions.
for c in ledger['claims']:
 c['covers']=[]
 c['coverage_status']='過去の台帳記録。今回の単位への対応・確認判定はt8q08461 claims/verifiedを参照。'
ledger.update(checked='2026-10-02',scope='auto20261002/t8-q08461。審査okは固定単位の独立照合。修正文は担当者照合で独立再審査待ち。正本外は保持し未確認。',nonclaims=[],verified=[],out_of_corpus=[],repairer_verified=[],pending_segments=[])
ledger['review_run']=str(E)
oldclaim={sid:c for c in old['claims'] for sid in c.get('covers',[])}
# Complete fee sections read, including neighboring route/recipient exceptions.
sections={
'mufg':('www_bk_mufg_jp_tesuuryou_furikomi_html.txt',11,233,'個人ネット当行0円・他行154/220円、優遇とOTP登録、電話は別。信託・auじぶん宛はダイレクト/ATMで当行他店扱い。ATMはカード種別・法人/個人で別額、利用料別途の場合あり、現金または本人確認未了では10万円超不可。手数料込方式の利用不可帯30,154〜30,219円。法人BizSTATIONは別表484/660円。'),
'smbc':('www_smbc_co_jp_kojin_fee_furikomi_html.txt',10,188,'SMBCポイントパックの所定条件・本人名義PayPay口座宛無料。ただし口座設定・メンテナンス・名義の文字符号等により無料とならない。Oliveは契約口座からのダイレクト振込がランク回数分無料。コンビニATMは利用料220/330円別途。電話・自動送金・現金・窓口は別区分。ことらは対応金融機関・自行アプリで10万円以下。本人確認未了では利用できない場合あり。'),
'smbc-biz':('www_smbc_co_jp_hojin_fee_furikomi_html.txt',6,79,'Web21ライトは165/330円・1日300万円まで。エキスパート/デビュー等は495/660円。給与・同行・紙依頼・現金は別区分。'),
'smtb':('www_netbk_co_jp_contents_charge_furikomi.txt',15,59,'個人の同行・三井住友信託宛無料、他はスマプロ無料回数以降77円。BaaS/提携サービスは利用サービス・無料回数等が異なる場合あり。法人旧通常145円・件数優遇最安130円は10月改定前。組戻し880円は振込単価と別。'),
'smtb-new':('www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt',15,27,'2026年10月1日開始。総合振込サービスは適用対象外、提携サービスはサービス/特典差異、予約は実行日でなく受付日時点の料金。振込件数優遇は廃止。'),
'smtb-biz':('www_netbk_co_jp_contents_hojin_charge.txt',15,40,'改定前通常145円・件数優遇最安130円。総合振込は同行無料/他行145円、基本料無料、翌月15日（休業日は翌営業日）引落し。提携サービスは差異あり。'),
'paypay':('www_paypay_bank_co_jp_fee_transfer_html.txt',6,44,'個人カナ同一名義SMBC口座宛の振込・予約・自動振込無料、その他サービス/来店は対象外。逆方向はSMBCポイントパック条件追加。前月の円普通/円定期預金の平均残高3,000万円以上は優遇、給与受取で月3回無料。ネット以外は別料金。'),
'yucho':('www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt',29,68,'他行165円、非居住者による送金3,000円、他行非居住者宛は所定貯金窓口のみ。振替はアプリ合算5回無料/以降100円、非居住者関連は無料回数によらず3,000円。利用口座間は同一IDに登録済みの本人所有同一名義口座間、原則無料/月1,000回目以降100円。総合口座受入明細票送付は1件100円。'),
'resona':('www_resonabank_co_jp_direct_service_tesuryo_html.txt',14,49,'スタンダード/パール165円、ルビー月3回82円、ダイヤモンド月3回0円。グループ4行（りそな・埼玉りそな・関西みらい・みなと）宛は別区分。個人表の経路列見出しは正本抽出不足のため経路対応は未確認のまま。'),
'saitama':('www_saitamaresona_co_jp_direct_service_tesuryo_html.txt',14,49,'スタンダード/パール165円、ルビー月3回82円、ダイヤモンド月3回0円。グループ4行（りそな・埼玉りそな・関西みらい・みなと）宛は別区分。個人表の経路列見出しは正本抽出不足のため経路対応は未確認のまま。'),
'resona-biz':('www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt',12,46,'同一支店無料、グループ4行本支店330円、他行605円。基本料7,700円（Mini3,300円）別途、通信料別。電信扱い、都度/後払いの決済口座と時期を区別。'),
'saitama-biz':('www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt',12,46,'同一支店無料、グループ4行本支店330円、他行605円。基本料7,700円（Mini3,300円）別途、通信料別。電信扱い、都度/後払いの決済口座と時期を区別。'),
'au':('www_jibunbank_co_jp_interest_and_commission_commission.txt',55,80,'ステージ無料回数は毎月付与・繰越不可、申込日時基準。本支店・三菱UFJ宛は何回でも無料で無料回数に含まない。その他204円。通信料別。'),
'fukuoka':('www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt',6,48,'福岡・熊本・十八親和・福岡中央・みんなの銀行宛無料、その他220/440円。登録済口座の区分で限度額相違、土曜21時〜日曜7時予約扱い。振込受付明細票発行なし。'),
'fukuoka-biz':('www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt',5,52,'Web/マルチバンキングWebは同一店内無料、福岡・熊本・十八親和・福岡中央・みんなの銀行本支店55/110円、その他330/550円。データ伝送・FD/MD・窓口は別額。'),
'gmo':('gmo_aozora_com_contents_fee_html.txt',42,61,'個人無料回数はステージ別月1〜20回、以降75円。回数は暦月で繰越不可、予約受付日基準、当月予約取消で回数復活。同行無料、組戻880円別区分。'),
'gmo-biz':('gmo_aozora_com_business_contents_fee_html.txt',10,41,'法人通常100円、同行無料。とくとく会員99円は月額500円別、提携サービス口座は会員申込不可。組戻880円は別。'),
}
(E/'source-sections.json').write_text(json.dumps(sections,ensure_ascii=False,indent=2)+'\n')
def source(f,a,b):
 lines=(E/'corpus'/f).read_text().splitlines();b=min(b,len(lines));return dict(corpus_ref=f'corpus/{f}:{a}-{b}',snapshot_ref=f'{E}/corpus/{f}:{a}-{b}',source_url=lines[0].replace('出典: ','').strip(),source_quote='\n'.join(lines[a-1:b]))
def refs(s):
 out=[]
 for f,a,b in re.findall(r'corpus/([^:\s"、]+\.txt):(\d+)(?:[-–](\d+))?',s):
  if (E/'corpus'/f).exists():out.append(source(f,int(a),int(b or a)))
 return out

def keys(text):
 ks=[]
 for kw,arr in [('三菱UFJ',['mufg']),('BizSTATION',['mufg']),('三井住友',['smbc','smbc-biz']),('SMBC',['smbc']),('Olive',['smbc']),('PayPay',['paypay']),('ドコモ',['smtb','smtb-new','smtb-biz']),('SMTB',['smtb','smtb-new','smtb-biz']),('BaaS',['smtb']),('総合振込',['smtb-new','smtb-biz']),('提携サービス',['smtb','smtb-new']),('件数優遇',['smtb-new','smtb-biz']),('130円',['smtb-biz']),('ゆうちょ',['yucho']),('利用口座',['yucho']),('受入明細票',['yucho']),('りそな',['resona','saitama','resona-biz','saitama-biz']),('auじぶん',['au']),('福岡',['fukuoka','fukuoka-biz']),('GMO',['gmo','gmo-biz']),('ことら',['smbc','mufg']),('ATM',['mufg','smbc'])]:
  if kw in text:ks+=arr
 if re.search('75円〜440円|100円〜660円|掲載ネット単価',text):ks+=list(sections)
 for token,arr in [('77円→100円',['smtb','smtb-new','smtb-biz']),('165円→605円',['resona','saitama','resona-biz','saitama-biz']),('440円→550円',['fukuoka','fukuoka-biz']),('220円→660円',['mufg','smbc','smbc-biz'])]:
  if token in text:ks+=arr
 return list(dict.fromkeys(ks))
context='';context_key=''; mapping=[]
for u in after:
 if u['kind'] in ['h2','h3']:
  context=u['text'];context_key=u['element_id'] or u['text']
 candidates=byhash[u['text_hash']]
 contextual=[x for x in candidates if before_context[x['id']]==context_key]
 if contextual:candidates=contextual
 o=next((x for x in candidates if x['id']==u['id']),candidates[0] if candidates else None);j=adj[o['id']] if o else None
 if j and j['decision']=='out_of_corpus':
  ledger['out_of_corpus'].append(dict(id=u['id'],text_hash=u['text_hash'],text=u['text'],result='out_of_corpus',needed_source=j['needed_source'] or j['reason'],review_ref=f'{E}/segment-adjudication.json#{o["id"]}'));mapping.append((u['id'],'out_of_corpus'));continue
 if (j and j['decision']=='nonclaim') or (not j and u['text'].startswith('出典:')):
  if not u['protected']:
   ledger['nonclaims'].append(dict(id=u['id'],why=j['reason'] if j else '出典への案内ラベル。独立した料金・条件の断定なし。'));mapping.append((u['id'],'nonclaim'));continue
 status='ok' if j and j['decision']=='ok' else 'repaired'
 ss=refs(json.dumps(j,ensure_ascii=False)) if j else []
 # Reverse lookup rows retain the reviewed sources of every unchanged bank in that amount row.
 if not j and '【列】この金額になる区分' in u['text']:
  amount=re.match(r'【行】(\d+)円',u['text'])
  if amount:
   originals=[x for x in before if x['kind']=='td' and x['text'].startswith('【行】'+amount[1]+'円') and '【列】この金額になる区分' in x['text']]
   for original in originals:ss+=refs(json.dumps(adj[original['id']],ensure_ascii=False))
 ks=keys(u['text']+' '+context) if status=='repaired' else []
 for k in ks:
  f,a,b,_=sections[k];ss.append(source(f,a,b))
 if not ss and o and o['id'] in oldclaim:
  c=oldclaim[o['id']];ss=c.get('sources',[{k:c[k] for k in ['source_url','source_quote','corpus_ref'] if k in c}])
 if not ss:
  # Match the changed sentence to reviewed source conditions; never manufacture a quote.
  near=max(before,key=lambda x:difflib.SequenceMatcher(None,x['text'],u['text']).ratio());ss=refs(json.dumps(adj[near['id']],ensure_ascii=False))
  if not ss and near['id'] in oldclaim:
   c=oldclaim[near['id']];ss=c.get('sources',[{k:c[k] for k in ['source_url','source_quote','corpus_ref'] if k in c}])
 if not ss:raise Exception('no evidence '+str(u))
 ss=list({x.get('corpus_ref',x['source_url']):x for x in ss}.values()); exc=[sections[k][3] for k in ks] or [x['condition'] for x in (j or {}).get('conditions',[])]
 if not exc:exc=['無し: 審査の参照した正本の同じ料金節の注記を含めて確認。独立した追加例外のない料金表の構造の記述。']
 c=dict(id='t8q08461-'+u['id'],text=u['text'],where=[u['kind']+':'+(u['element_id'] or context)],numbers=[],applies='資料取得2026-09-30、SMTB法人改定は2026-10-01以後の受付。歴史記述はその時点。',scope='掲載ネット振込の個人/法人・指定サービス・宛先・金額帯、優遇除外。ATM/窓口/ことらは明記した経路のみ。比較計算は明記した件数・単価条件。',exceptions=exc,covers=[u['id']],topic=['振込手数料'],sources=ss,**{k:ss[0][k] for k in ['source_url','source_quote','corpus_ref'] if k in ss[0]})
 c['scope']='対象：'+(re.search(r'【行】(.*?) 【列】(.*?) 【値】',u['text']).group(0).replace(' 【値】','') if u['text'].startswith('【行】') else context+'／'+u['text'][:110])+'。時点：2026年9月30日取得資料、SMTB法人通常振込は2026年10月1日以後受付。掲載の経路・宛先・金額帯・優遇条件に限定。'
 c['review_ref']=f'{E}/segment-adjudication.json#{o["id"]}' if status=='ok' else f'{E}/source-sections.json (担当者照合・独立再審査待ち)'
 ledger['claims'].append(c)
 if status=='ok':ledger['verified'].append(dict(id=u['id'],text_hash=u['text_hash'],result='ok',review_ref=c['review_ref']))
 else:ledger['repairer_verified'].append(dict(id=u['id'],text_hash=u['text_hash'],result='repaired_pending_independent_review',sources=[x.get('corpus_ref') for x in ss]))
 mapping.append((u['id'],status))
ledger['pending_segments']=[dict(id=x['id'],reason='正本外・未確認',needed_source=x['needed_source']) for x in ledger['out_of_corpus']]
# Changed mixed claim retains the unconfirmed bands rather than claiming their proof.
for c in ledger['claims']:
 if c['id'].startswith('t8q08461-') and ('フィンサーバンク' in c['text'] or ('個人・マイゲート' in c['text'])):
  c['unverified_part']='掲載額の未確認区分/個人マイゲート経路見出しは従来どおり未確認。宛先条件の修正のみ正本照合。';c['needed_source']='フィンサー公式料金表、またはりそな/埼玉りそな公式表の経路見出しを含む原表'
P.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n');(E/'ledger-status.json').write_text(json.dumps(dict(counts=collections.Counter(v for _,v in mapping),units=mapping),ensure_ascii=False,indent=2)+'\n')
print(collections.Counter(v for _,v in mapping))
