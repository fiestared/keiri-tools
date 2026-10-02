# 独立審査結果

対象: docs/column/furikomi-tesuryo-hikaku/index.html。segments.json 全122 ID。モデル2本のout計244判定についてID・本文ハッシュ・sol-unionの判定の一致を確認。
判定: {'ok': 88, 'unresolved': 34}。未解決重要度: {'medium': 29, 'high': 5}。
siteおよび元の執筆作業場は変更していない。正本はRUN/corpus（2026-09-30取得）とcorpus_desc.mdのみ。外部検索・他モデル実行・サブエージェント・orca・スキル・pushは使用していない。

## 判定の範囲
全IDの根拠・条件・所見の採否はsegment-adjudication.jsonに記載。数値セルは同じ表の行で主語を特定。protectedのnonclaimは0。全モデルokも料金表の同じ節・注・別サービスを開いて確認した。
okのうちverified_scope/out_of_corpus_parts付きのものは、検証できた部分だけがok。列見出し欠落や未収録サービスの料金まで確認済みと扱ってはならない。正本外の裏付け不足だけをunresolvedにせず、現行主張を保持する。
モデルの重要度は転記せず、典型的な日付・宛先・総合振込/予約の誤適用をhigh、特定の優遇や非居住者の条件欠落をmediumとした。

## 主な採否
- GMOの75→100円比較をSMTBの77円と比較した5.6のhighは、siteのGMO節とGMO自身の正本により不採用。ただし無料枠/会員優遇除外は未解決。
- 福岡55円／110円は表の3万円未満／以上の列順と一致するためhighは不採用。各セルの注を該当額1つにすると明瞭。
- 77円単独セルは同じ表の行でSMTB個人と特定できる。165円単独セルも対応は特定できるが、給与振込の区分不足は残る。
- りそな個人資料の列見出し欠落は実在する。wrongのない資料不足だけをhigh未解決にはしない。銀行別資料の確認可能部分と未確認部分を分割記録した。
- ことら送金は指定された通常振込と別サービス。通常振込単価にその無料条件がないという指摘は不採用。ATM本人確認の取扱上限も成立した取引の単価とは分けた。
- SMBCの銀行別注記への明示参照と、同じ注記の直後の「ただし」は採用。単に離れた箇所に一般的な説明があるだけでは固定単位の不足を解消したとしない。

## 未解決と必要な修正

### s-fa5bb23188ab4b3d0183-1 — medium
【行】PayPay銀行（個人） 【列】3万円未満 【値】145円カナ同一名義の個人の三井住友銀行口座あては無料
corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28。145円と同名義SMBC宛無料は一致。両モデルの残高優遇・給与受取無料の条件不足を採用。別段落の除外説明はあるが固定行の対象条件は補う必要がある。 審査範囲: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17。
必要な修正: 通常単価（残高優遇・給与受取の無料回数適用外）であることを行で明示。

### s-cc63cf32ec94807fdd54-1 — medium
【行】PayPay銀行（個人） 【列】3万円以上 【値】145円カナ同一名義の個人の三井住友銀行口座あては無料
corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28。145円と同名義SMBC宛無料は一致。両モデルの残高優遇・給与受取無料の条件不足を採用。別段落の除外説明はあるが固定行の対象条件は補う必要がある。 審査範囲: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17。
必要な修正: 通常単価（残高優遇・給与受取の無料回数適用外）であることを行で明示。

### s-5dd6c554e1854a662e2f-1 — medium
【行】三井住友銀行（個人・SMBCダイレクト） 【列】3万円未満 【値】154円所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（例外は銀行別注記）
corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106,177-188。154/220円は一致。PayPay不適用例は「銀行別注記」への明示参照で補われるため当該指摘は不採用。Olive除外は固定行で明示がなく、この部分の指摘を採用。 審査範囲: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-188; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184。
必要な修正: Olive無料回数適用外の通常単価という限定。

### s-8545ec3ea3b7c34e6079-1 — medium
【行】三井住友銀行（個人・SMBCダイレクト） 【列】3万円以上 【値】220円所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（例外は銀行別注記）
corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106,177-188。154/220円は一致。PayPay不適用例は「銀行別注記」への明示参照で補われるため当該指摘は不採用。Olive除外は固定行で明示がなく、この部分の指摘を採用。 審査範囲: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-188; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184。
必要な修正: Olive無料回数適用外の通常単価という限定。

### s-154f42889e1c5ef6600c-1 — medium
【行】三菱UFJ銀行（個人・三菱UFJダイレクト） 【列】3万円未満 【値】154円三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-28,128。通常154/220円・指定2行無料は一致。メインバンクプラス無料対象の除外不足を採用。OTPはサービス利用要件だが料金そのものを変えず、本単価表で未記載を別の誤料金とは数えない。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-46; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26。
必要な修正: メインバンクプラスの無料優遇適用外という限定。

### s-434e514a44fbffb5ed90-1 — medium
【行】三菱UFJ銀行（個人・三菱UFJダイレクト） 【列】3万円以上 【値】220円三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-28,128。通常154/220円・指定2行無料は一致。メインバンクプラス無料対象の除外不足を採用。OTPはサービス利用要件だが料金そのものを変えず、本単価表で未記載を別の誤料金とは数えない。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-46; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26。
必要な修正: メインバンクプラスの無料優遇適用外という限定。

### s-60afbd0763ec2a003c13-1 — medium
無料回数・優遇・無料宛先を除き、料金を照合できた掲載ネット振込の個人区分は75円〜440円。
corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43に非居住者3,000円。75〜440円は居住者の通常区分なら一致するが、無料・優遇・無料宛先だけの除外では3,000円を除けない。6.1所見を採用。SMTBの提携留保は直後にもあるが範囲の非居住者問題は残る。 審査範囲: corpus/gmo_aozora_com_contents_fee_html.txt:42-61; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-51; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:17-28; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:62-68; corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-48; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:42。
必要な修正: 非居住者送金など別料金の対象を料金幅から除外。

### s-a89c56316110a93dc937-1 — medium
GMOあおぞら75円とドコモSMTB〈旧 住信SBI〉77円の個人向け通常料金は100円未満です（いずれも無料回数以降。
corpus/gmo_aozora_com_contents_fee_html.txt:42-61とcorpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-51を別々に照合。75円/77円は正しいが、SMTBの77円は三井住友信託宛を除く。無料枠後という限定だけでは宛先例外を表せない。6.1所見採用。 審査範囲: corpus/gmo_aozora_com_contents_fee_html.txt:42-61; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-51; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:17-28; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-46。
必要な修正: SMTB77円は三井住友信託銀行以外宛という限定。

### s-0a4d392649ba08554e30-1 — medium
同じ三菱UFJ銀行でも他行宛ネット振込で3万円以上なら（三菱UFJ信託銀行・auじぶん銀行あてを除く）、個人の三菱UFJダイレクト220円・法人のBizSTATION660円と3倍で、法人口座の手数料は「個人の感覚」から大きく外れます。
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26,196-206。660÷220=3は正しいが無料優遇対象では成り立たない。両モデルのメインバンクプラス指摘採用。ことら送金は別の送金サービスなのでダイレクト通常振込比較への指摘は不採用。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-46; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-233; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26。
必要な修正: 個人無料優遇を除く通常単価比較であること。

### s-9973cb03bc73d0ee4164-1 — medium
【行】100円 【列】この金額になる区分 【値】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）【2026年10月1日以後受付の通常振込。総合振込・提携サービスを除く。予約は受付日時点の料金】（金額不問）GMOあおぞらネット銀行（法人）（金額不問）
corpus/gmo_aozora_com_business_contents_fee_html.txt:14-41。SMTB側の条件は適切。GMO側に通常100円／会員99円の区別がなく、両モデルの条件不足を採用。 審査範囲: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27; corpus/www_netbk_co_jp_contents_hojin_charge.txt:30-40; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41; corpus/gmo_aozora_com_business_contents_fee_html.txt:23-41。
必要な修正: GMO法人はとくとく会員を除く通常料金。

### s-a42e2c9bb7ae2d1c344c-1 — medium
【行】145円 【列】この金額になる区分 【値】PayPay銀行（個人）【カナ同一名義の個人の三井住友銀行口座あては無料】（金額不問）PayPay銀行（法人）（金額不問）楽天銀行（個人）（金額不問）
corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-28、corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:15-21、corpus/www_rakuten_bank_co_jp_charge.txt:48-95。3サービスの145円は存在するが無料枠・優遇の除外が固定行にない。両モデルの所見採用。 審査範囲: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17; corpus/www_rakuten_bank_co_jp_charge.txt:40-95; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:15-21; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-21。
必要な修正: PayPay法人の残高優遇・口座開設月の翌々月末まで月5回無料、個人・楽天の無料枠を適用しない通常単価。

### s-209fd0aade25e655c6d1-1 — medium
【行】154円 【列】この金額になる区分 【値】三菱UFJ銀行（個人・三菱UFJダイレクト）【三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円】（3万円未満）三井住友銀行（個人・SMBCダイレクト）【所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（例外は銀行別注記）】（3万円未満）横浜銀行（個人IB）（3万円未満）
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26、corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184、corpus/www_boy_co_jp_fee_furikomi_html.txt:12-25。3行とも154円は確認。メインバンク・Olive・横浜ゼロ手数料を除く条件不足を採用。ことらは別サービスなのでその指摘は不採用。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-46; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-188; corpus/www_boy_co_jp_fee_furikomi_html.txt:12-25。
必要な修正: 横浜はゼロ手数料月3回、UFJ・SMBCは無料優遇適用外。

### s-a3e494582fade1be705a-1 — medium
165円
corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:80-98。165円は同じ表の行で対応を特定できるため5.6の単独数値unclearは不採用。一方Bizダイレクトには給与振込110円があり、通常/総合振込の限定不足は採用。 審査範囲: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:74-98; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:53-73; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:62-68; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-107; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:93-98; corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:33-49; corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:33-49。
必要な修正: ゆうちょ法人165円は通常・総合振込で給与振込を含まない。

### s-71885d33b51c40501267-1 — medium
【行】165円 【列】この金額になる区分 【値】りそな銀行（個人・マイゲート）【スタンダード・パール。りそな・埼玉りそな・関西みらい・みなと銀行あてを除く】（金額不問）埼玉りそな銀行（個人・マイゲート）【スタンダード・パール。りそな・埼玉りそな・関西みらい・みなと銀行あてを除く】（金額不問）ゆうちょ銀行（個人・ゆうちょダイレクト）【非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ】（金額不問）ゆうちょ銀行（法人・Bizダイレクト）（金額不問）千葉銀行（個人IB）（3万円未満）
corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:80-98。165円は同じ表の行で対応を特定できるため5.6の単独数値unclearは不採用。一方Bizダイレクトには給与振込110円があり、通常/総合振込の限定不足は採用。 審査範囲: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:74-98; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:53-73; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:62-68; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-107; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:93-98; corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:33-49; corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:33-49。
必要な修正: ゆうちょ法人165円は通常・総合振込で給与振込を含まない。

### s-004ac1399b2b7b9fb113-1 — medium
【行】220円 【列】この金額になる区分 【値】三菱UFJ銀行（個人・三菱UFJダイレクト）【三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円】（3万円以上）三井住友銀行（個人・SMBCダイレクト）【所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（例外は銀行別注記）】（3万円以上）福岡銀行（個人IB）【福岡・熊本・十八親和・福岡中央・みんなの銀行あては無料】（3万円未満）
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26とcorpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184。福岡220円と5行除外は一致。UFJ・SMBCの無料優遇適用外の限定不足は採用。ことらの指摘は別サービスとして不採用。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-46; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-188; corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-48; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184。
必要な修正: UFJメインバンクプラス・SMBC Oliveの無料優遇適用外。

### s-1db1587e0b0eb066a577-1 — medium
法人の通常の他行宛振込は2026年10月1日以後の受付で100円（税込）。
corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27。通常・受付日限定は正しい。提携サービスは必ずしも同額でなく、固定文の除外不足との6.1所見を採用。 審査範囲: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27; corpus/www_netbk_co_jp_contents_hojin_charge.txt:30-40; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:24。
必要な修正: 提携サービス除外を100円の文に結び付ける。

### s-4d67eff252d3f1f65897-1 — medium
改定前は通常145円、件数優遇で最安130円でした。
corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-26。改定前145円・件数優遇最安130円は一致。提携差異の留保を同じ固定文に付けるとの6.1指摘を採用。 審査範囲: corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-26。
必要な修正: 改定前料金も提携サービスの条件差がある。

### s-5abdef414b94ac34b466-1 — high
件数優遇プログラムは廃止されました。
corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:23-27。廃止の適用は2026年10月1日。site最終更新2026年9月30日の文で適用日なく過去形にすると改定前受付の優遇有無を誤る。6.1のhigh指摘を採用し、「2026年10月1日から廃止」とする。 審査範囲: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:23-27。
必要な修正: 件数優遇廃止の施行日2026年10月1日を明示。

### s-70e39cdf0d6d2ba4905d-1 — medium
他行宛ネット振込の3万円以上では、法人は個人の約1.3倍（75円→100円）。
site:283-290はGMOあおぞらの節。corpus/gmo_aozora_com_contents_fee_html.txt:42-61、corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41で75→100、100/75=1.333…を確認。5.6のSMTB77円とのhigh指摘は主語取り違えで不採用。6.1の個人無料枠後・法人会員除外不足は採用。 審査範囲: corpus/gmo_aozora_com_contents_fee_html.txt:42-61; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41; corpus/gmo_aozora_com_business_contents_fee_html.txt:14-41。
必要な修正: 個人無料回数後75円・法人会員優遇なし100円の比較に限定。

### s-fa5bb23188ab4b3d0183-2 — medium
【行】PayPay銀行（個人） 【列】3万円未満 【値】145円カナ同一名義の個人の三井住友銀行口座あては無料
corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28。145円と同名義SMBC宛無料は一致。両モデルの残高優遇・給与受取無料の条件不足を採用。別段落の除外説明はあるが固定行の対象条件は補う必要がある。 審査範囲: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17。
必要な修正: 通常単価（残高優遇・給与受取の無料回数適用外）であることを行で明示。

### s-cc63cf32ec94807fdd54-2 — medium
【行】PayPay銀行（個人） 【列】3万円以上 【値】145円カナ同一名義の個人の三井住友銀行口座あては無料
corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28。145円と同名義SMBC宛無料は一致。両モデルの残高優遇・給与受取無料の条件不足を採用。別段落の除外説明はあるが固定行の対象条件は補う必要がある。 審査範囲: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17。
必要な修正: 通常単価（残高優遇・給与受取の無料回数適用外）であることを行で明示。

### s-154f42889e1c5ef6600c-2 — medium
【行】三菱UFJ銀行（個人・三菱UFJダイレクト） 【列】3万円未満 【値】154円三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-28,128。通常154/220円・指定2行無料は一致。メインバンクプラス無料対象の除外不足を採用。OTPはサービス利用要件だが料金そのものを変えず、本単価表で未記載を別の誤料金とは数えない。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-46; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26。
必要な修正: メインバンクプラスの無料優遇適用外という限定。

### s-434e514a44fbffb5ed90-2 — medium
【行】三菱UFJ銀行（個人・三菱UFJダイレクト） 【列】3万円以上 【値】220円三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-28,128。通常154/220円・指定2行無料は一致。メインバンクプラス無料対象の除外不足を採用。OTPはサービス利用要件だが料金そのものを変えず、本単価表で未記載を別の誤料金とは数えない。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-46; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26。
必要な修正: メインバンクプラスの無料優遇適用外という限定。

### s-5dd6c554e1854a662e2f-2 — medium
【行】三井住友銀行（個人・SMBCダイレクト） 【列】3万円未満 【値】154円所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（例外は銀行別注記）
corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106,177-188。154/220円は一致。PayPay不適用例は「銀行別注記」への明示参照で補われるため当該指摘は不採用。Olive除外は固定行で明示がなく、この部分の指摘を採用。 審査範囲: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-188; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184。
必要な修正: Olive無料回数適用外の通常単価という限定。

### s-8545ec3ea3b7c34e6079-2 — medium
【行】三井住友銀行（個人・SMBCダイレクト） 【列】3万円以上 【値】220円所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（例外は銀行別注記）
corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106,177-188。154/220円は一致。PayPay不適用例は「銀行別注記」への明示参照で補われるため当該指摘は不採用。Olive除外は固定行で明示がなく、この部分の指摘を採用。 審査範囲: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-188; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184。
必要な修正: Olive無料回数適用外の通常単価という限定。

### s-c753701282171eec427c-1 — high
BizSTATIONとGMO法人：全件3万円以上・年120件なら差額67,200円
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206とcorpus/gmo_aozora_com_business_contents_fee_html.txt:10-41。560×120=67,200は正しいが、見出しの全件3万円以上だけでは同行宛も含み、同行なら差額は330×120=39,600。典型的な宛先区分の欠落で年額を誤るため6.1指摘採用。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-233; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206。
必要な修正: 全件他行宛・通常単価による差額と見出し自体を限定。

### s-b0b1eab6eab2224d98e0-1 — medium
【行】三菱UFJ銀行 【列】ネットバンキング 【値】154円／220円三菱UFJ信託・auじぶん銀行あて0円
corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-28,128。通常154/220円・指定2行無料は一致。メインバンクプラス無料対象の除外不足を採用。OTPはサービス利用要件だが料金そのものを変えず、本単価表で未記載を別の誤料金とは数えない。 審査範囲: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-46; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26。
必要な修正: メインバンクプラスの無料優遇適用外という限定。

### s-fef999b927ab708e8333-1 — medium
【行】三井住友銀行 【列】ネットバンキング 【値】154円／220円SMBCポイントパックの所定条件によるPayPay銀行本人名義あて無料の例外あり（銀行別注記）
corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106,177-188。154/220円は一致。PayPay不適用例は「銀行別注記」への明示参照で補われるため当該指摘は不採用。Olive除外は固定行で明示がなく、この部分の指摘を採用。 審査範囲: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-188; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184。
必要な修正: Olive無料回数適用外の通常単価という限定。

### s-02ebfa1f55397865be89-1 — medium（審査独自・次周候補）
料金を照合できた掲載ネット振込は、各表の宛先・サービス条件で個人75円〜440円／法人100円〜660円（税込・SMTB法人は2026年10月1日以後受付の通常振込で、総合振込・提携サービスを除く。
corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43。全モデルokだが、参照する個人表自体に非居住者3,000円が含まれる。各表の条件を参照するだけではこの別料金を幅から除けず、75〜440円の上限に合わない。法人通常100〜660円の部分は一致。審査独自指摘として次周候補。 審査範囲: corpus/gmo_aozora_com_contents_fee_html.txt:42-61; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-51; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:17-28; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17; corpus/www_rakuten_bank_co_jp_charge.txt:40-95; corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:58-77; corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:64-66; corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-48; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:62-68; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27; corpus/www_netbk_co_jp_contents_hojin_charge.txt:30-40; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-21; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:57-67; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:74-98; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:53-73; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-135; corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:5-52; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-107; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36; corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:12-46; corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:12-44; corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:12-46; corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:12-44; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-233; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-79; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:42。
必要な修正: 個人の料金幅から非居住者等の別料金区分を明示的に除外。

### s-778c5a4909387dc48baf-1 — medium
ゆうちょダイレクトの他のゆうちょ口座宛は通帳アプリと合算して月5回まで無料・6回目以降100円ですが、外為法上の非居住者に関連する送金は回数にかかわらず1回3,000円です。
corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-39,62-68。月5回と非居住者3,000円は正しいが「他のゆうちょ口座」には利用口座間も含み得る。固定文で別区分と受入明細票追加料金を結び付ける必要があり6.1指摘採用。 審査範囲: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-39; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:62-68; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:37-39。
必要な修正: 利用口座間送金は別枠、受入明細票送付100円は別料金であること。

### s-15d6fb44683aa0b300a4-1 — medium
同一IDに登録した本人所有の同一名義の利用口座間は原則無料（月1,000回目以降100円）、総合口座の受入明細票送付は1件100円です（主要5行の実額）
corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:37-39,62-68。定義・1,000回目・明細票料金は一致。「原則無料」の例外として非居住者関連3,000円を固定文に結び付ける必要があり6.1所見を採用。 審査範囲: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-39; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:62-68; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:39。
必要な修正: 非居住者関連3,000円の例外。

### s-e08a739561a755d7f362-1 — high
本記事で料金を照合できた法人区分の、無料回数・会員優遇・別料金の宛先を除くネット振込単価では、GMOあおぞらネット銀行の法人口座とドコモSMTBネット銀行（旧 住信SBIネット銀行）の法人口座が、金額にかかわらず100円で最安です。
corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27。通常100円は確認できるが総合振込除外と受付日時点の限定が固定文に欠け、総合振込145円や9月受付10月実行予約を100円と誤適用する。別文の注記はあるが、一律/最安という本文自体に適用範囲を結び付ける。改定日・予約の典型ケースで実額が変わるためhigh。両モデルの所見採用。 審査範囲: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27; corpus/www_netbk_co_jp_contents_hojin_charge.txt:30-40; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-27。
必要な修正: 2026年10月1日以後受付の通常振込に限定し総合振込・提携除外、予約受付基準を明示。

### s-649373adb15bc2ab1267-1 — high
ドコモSMTBネット銀行の法人の他行宛振込手数料は、2026年10月1日から一律100円（税込）となり、GMOあおぞらの通常料金と同額になりました。
corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27。通常100円は確認できるが総合振込除外と受付日時点の限定が固定文に欠け、総合振込145円や9月受付10月実行予約を100円と誤適用する。別文の注記はあるが、一律/最安という本文自体に適用範囲を結び付ける。改定日・予約の典型ケースで実額が変わるためhigh。両モデルの所見採用。 審査範囲: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27; corpus/www_netbk_co_jp_contents_hojin_charge.txt:30-40; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-27。
必要な修正: 2026年10月1日以後受付の通常振込に限定し総合振込・提携除外、予約受付基準を明示。

### s-e3ddc064eb2ba034fbdd-1 — high
ドコモSMTBネット銀行の法人の他行宛振込手数料は、2026年10月1日から一律100円（税込）となり、GMOあおぞらの通常料金と同額です。
corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27。通常100円は確認できるが総合振込除外と受付日時点の限定が固定文に欠け、総合振込145円や9月受付10月実行予約を100円と誤適用する。別文の注記はあるが、一律/最安という本文自体に適用範囲を結び付ける。改定日・予約の典型ケースで実額が変わるためhigh。両モデルの所見採用。 審査範囲: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:19-27; corpus/www_netbk_co_jp_contents_hojin_charge.txt:30-40; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-27。
必要な修正: 2026年10月1日以後受付の通常振込に限定し総合振込・提携除外、予約受付基準を明示。

## 正本外の必要資料
- s-fe3ade8b0cc4bba7ac22-1: 出典: https://www.resonabank.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。
- s-0536a3193486e80a8ceb-1: 出典: https://www.resonabank.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。
- s-6122e61503bc1473cc1f-1: 出典: https://www.saitamaresona.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。
- s-55df8469df013566cb56-1: 出典: https://www.saitamaresona.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。
- s-b95475ff39415656a231-1: フィンサーバンク法人フリープランの公式振込料金表、https://www.mizuhobank.co.jp/ の法人EB公式振込料金表（2026年9〜10月適用）。
- s-a3e494582fade1be705a-1: https://www.resonabank.co.jp/direct/service/tesuryo.html と https://www.saitamaresona.co.jp/direct/service/tesuryo.html の列見出し付き公式料金表。
- s-71885d33b51c40501267-1: https://www.resonabank.co.jp/direct/service/tesuryo.html と https://www.saitamaresona.co.jp/direct/service/tesuryo.html の列見出し付き公式料金表。
- s-fe3ade8b0cc4bba7ac22-2: 出典: https://www.resonabank.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。
- s-0536a3193486e80a8ceb-2: 出典: https://www.resonabank.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。
- s-c5be53e6dad757878602-1: 出典: https://www.resonabank.co.jp/direct/service/tesuryo.html の列見出し付き公式表。
- s-6122e61503bc1473cc1f-2: 出典: https://www.saitamaresona.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。
- s-55df8469df013566cb56-2: 出典: https://www.saitamaresona.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。
- s-c5be53e6dad757878602-2: 出典: https://www.saitamaresona.co.jp/direct/service/tesuryo.html の列見出し付き公式表。
- s-de7baa74b5cb2450d03f-1: 出典: https://www.resonabank.co.jp/direct/service/tesuryo.html の列見出しを含む公式料金表HTMLまたはPDF。現正本テキストには列名がない。

## 書き手への返却
未解決を修正し、新snapshotを作成した後に同じID相当の主張と正本を再照合すること。この固定コピーは修正しない。未解決highを残しているため通過扱いにはしない。全モデルokだった独自指摘はs-02ebfa1f55397865be89-1（medium）で、次周候補として区別した。

DONE
