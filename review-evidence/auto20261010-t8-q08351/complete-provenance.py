import json,re
from pathlib import Path
E=Path('review-evidence/auto20261010-t8-q08351');p=Path('claims/column/furikomi-tesuryo-hikaku.json');L=json.loads(p.read_text())
def src(file,bands):
 ls=(E/'corpus'/file).read_text().splitlines();q=[]
 for b in bands.split(','):
  ns=list(map(int,b.split('-')));q+=ls[ns[0]-1:ns[-1]]
 return {'corpus_ref':'corpus/'+file+':'+bands,'snapshot_ref':str(E/'corpus'/file)+':'+bands,'source_url':ls[0].removeprefix('出典: ').strip(),'source_quote':'\n'.join(q)}
extra={
 'www_bk_mufg_jp_tesuuryou_furikomi_html.txt':('9-28,48-92,126-132,137-164,196-230','三菱UFJ: 個人ネット当行宛0円、三菱UFJ信託・auじぶん宛は当行他店扱い。メインバンク プラス優遇、電話は別区分、OTP登録が必要。手数料を含む方式は30,154〜30,219円を受付不可。ATMは個人/法人・カード/現金・宛先が別区分、ATM利用料は別途の場合あり、現金/本人確認未了は10万円超不可。窓口とBizSTATIONは本文の区分に限定。'),
 'gmo_aozora_com_contents_fee_html.txt':('42-61','GMO個人: 当社宛無料。他行宛は月1〜20回無料、毎月1日〜末日・繰越なし、予約は受付日基準・当月取消で回数復帰。通常単価は無料回数以降。組戻880円は別手数料。'),
 'gmo_aozora_com_business_contents_fee_html.txt':('10-41','GMO法人: 当社宛無料。会員は99円で別途月額500円、提携サービス口座は会員申込不可。組戻880円は別手数料。'),
 'www_netbk_co_jp_contents_charge_furikomi.txt':('15-51','SMTB個人: 当社・三井住友信託宛0円、その他はスマプロ無料回数以降77円。BaaS・提携サービスのサービス/特典は異なる場合あり。法人は別区分。'),
 'www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt':('10-27','SMTB法人: 2026年10月1日以後受付の他行宛通常振込100円。総合振込は改定対象外、提携サービスは異なる場合あり、予約は実行日でなく受付日。件数優遇廃止。'),
 'www_netbk_co_jp_contents_hojin_charge.txt':('15-41','SMTB法人: 当社宛0円。改定前の他行宛通常145円・件数優遇最安130円、総合振込の他行宛145円。提携サービスは条件が異なる場合あり。'),
 'www_paypay_bank_co_jp_fee_transfer_html.txt':('6-45','PayPay個人: 同行ネット0円、他行145円。前月円普通/円定期平均残高3,000万円以上優遇、給与受取月3回無料。同一カナ名義の個人SMBC宛はPayPayからの振込/予約/自動振込のみ無料、その他サービス/来店対象外。逆方向はSMBCポイントパック条件。ネット以外は別料金。'),
 'www_paypay_bank_co_jp_business_fee_transfer_html.txt':('6-40','PayPay法人: 同行ネット0円。他行145円、前月円普通/円定期平均残高3,000万円以上優遇、開設月翌々月末まで月5回無料。ネット以外は宛先・3万円帯で別料金。'),
 'www_rakuten_bank_co_jp_charge.txt':('40-95,167-168','楽天個人: 通常/予約の同行宛無料、他行無料回数なし145円。ステージ特典と給与/賞与/公的年金受取特典は多い方のみ。受取特典は上限月5回翌月繰越、ステージ特典は繰越不可。他サービスは別料金。無料回数利用はポイント付与/取引カウント外、楽天ポイントでの手数料支払は対象。'),
 'www_rakuten_bank_co_jp_business_howto_interest_html.txt':('86-118,166-206','楽天法人: 基本振込の同行52円/他行150・229円、一括は最大30件で振込先件数課金。給与賞与は金額不問、他行229/同行52は1件時、複数件は税抜209/48×件数に消費税。総合は別区分（同行105円、他行150/229円は1件時、複数件は税抜137/209/96×件数に消費税）。組戻もサービス別。'),
 'support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt':('57-70','ラクスル: GMOあおぞら宛無料・その他119円。ラクスルアカウント利用時はGMOからの振込でも同料金適用。外部から振込側負担の手数料は振込元料金。'),
 'www_chibabank_co_jp_kinri_fee_transfer.txt':('5-107','千葉: 個人マイアクセス/アプリは同一店内・本支店無料。法人EBは同一店内無料、本支店110/330円、他行電信385/550円。ATM/窓口・提携行は別区分。本文は他行ネットに限定し同一店内定義/店舗内店舗の窓口ATM例外は対象外。'),
 'www_boy_co_jp_fee_furikomi_html.txt':('5-25','横浜個人: マイダイレクト/はまぎん365の横浜宛無料。他行3万円未満154円、ゼロ手数料は15日〜翌月14日合計3回無料。正本で3万円以上の金額欠落につき未確認。'),
 'www_boy_co_jp_hojin_eb_service_fee02_html.txt':('5-36','横浜法人EB: 同一店無料・本支店110/330円・他行385/550円。同一店舗内支店間は同一店扱い。訂正/組戻サービスの再振込は金額不問550円。外為は別節・比較対象外。'),
 'www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt':('6-46','福岡個人IB: 国内本支店電信扱い。福岡/熊本/十八親和/福岡中央/みんなの銀行宛無料、それ以外220/440円。登録有無による限度額・受付時間は別条件、単価を変更しない。'),
 'www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt':('6-47','福岡法人: ビジネスバンキングWebの同一店無料、グループ本支店55/110円、他行330/550円。AnserDATAPORT・FD/MD・窓口は別経路。'),
 'www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt':('29-43,62-68','ゆうちょ個人ダイレクト: ゆうちょ宛月5回無料・6回以降100円、通帳アプリと合算。利用口座間は本人所有同一名義・同一ID登録、月1,000回以降100円。非居住者関連は回数不問3,000円、他行の非居住者宛は所定窓口のみ。総合口座受入明細票送付は別途100円。料金表は消費税込み。'),
 'www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt':('53-98,182-194','ゆうちょ法人: 他金融機関通常/総合165円・給与110円。同行通常100円、総合年間100万件以上39円・10万件以上50円・10万件未満66円、給与無料。総合/給与は依頼件数で不成立も課金、年間件数判定は法人サービス部確認。契約/基本料は別、税込。'),
 'www_resonabank_co_jp_direct_service_tesuryo_html.txt':('14-49','りそな個人マイゲート: 同一支店/グループ本支店0円、他行スタンダード・パール165円、ルビー月3回82円/ダイヤ月3回0円。ATM/窓口は別料金。グループはりそな/埼玉りそな/関西みらい/みなと。'),
 'www_saitamaresona_co_jp_direct_service_tesuryo_html.txt':('14-49','埼玉りそな個人マイゲート: 同一支店/グループ本支店0円、他行スタンダード・パール165円、ルビー月3回82円/ダイヤ月3回0円。ATM/窓口は別料金。グループはりそな/埼玉りそな/関西みらい/みなと。'),
 'www_smbc_co_jp_kojin_fee_furikomi_html.txt':('15-118,177-188,266-296','三井住友個人: 同行ダイレクト/当行カードATM無料。他行ネット154/220円は無料回数以降。本人名義PayPay宛無料はSMBCポイントパック所定条件・名義一致、設定/保守時間/文字符号により有料。Olive契約口座からの他行ネットはランク別無料回数。ATMはカード/現金・宛先・金額帯の別区分、イーネット/ローソン利用料別途。本人確認未了では振込不可の場合、不成立他行振込は手数料返却なし。法人Trunk/その他・Web21ライト/一般/給与等は別区分。'),
 'www_smbc_co_jp_hojin_fee_furikomi_html.txt':('6-79','三井住友法人: 掲載エキスパート等の一般振込の他行495/660円、同一店110/220円、本支店220/440円。ライトは同一本支店無料/他行165・330円。給与EBは同一店無料・本支店110・他行330円。依頼書/現金は別料金、ライト1日300万円まで、媒体持込/振込振替サービス含む。'),
}
updated=0
for c in L['claims']:
 if not c['id'].startswith('t8q08351-') or c.get('status')=='out_of_corpus':continue
 if c.get('status')=='ok':continue
 refs=c.get('sources',[]);files=set()
 for q in refs:
  m=re.search(r'corpus/([\w.-]+):',q.get('corpus_ref',''))
  if m:files.add(m[1])
 # A formerly nonclaim row header must use its own bank rather than a generic fallback.
 t=c['text']
 if '千葉銀行' in t:files.add('www_chibabank_co_jp_kinri_fee_transfer.txt')
 if 'ラクスルバンク' in t:files.add('support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt')
 c['exception_sources']=[src(f,extra[f][0]) for f in sorted(files) if f in extra]
 c['exceptions']=list(dict.fromkeys((c.get('exceptions',[]) if isinstance(c.get('exceptions'),list) else [c.get('exceptions','')])+[extra[f][1] for f in sorted(files) if f in extra]))
 if c['corpus_ref'].startswith('corpus/www_bk_mufg') and '千葉銀行' in t and '三菱UFJ' not in t:
  q=src('www_chibabank_co_jp_kinri_fee_transfer.txt','64-107');c.update(q);c['sources']=[q]
 updated+=1
p.write_text(json.dumps(L,ensure_ascii=False,indent=2)+'\n');print('completed section/exception provenance',updated)
