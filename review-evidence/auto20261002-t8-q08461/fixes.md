# 独立審査結果

対象: `site/docs/column/furikomi-tesuryo-hikaku/index.html`。正本: RUN/corpus と corpus_desc.md。全644 IDを審査。外部検索・他モデル呼出し・サブエージェント・orca・スキル・pushは使用していない。siteと元の執筆作業場は変更していない。

sol-models.jsonの2モデル（gpt-6.1-sol、gpt-5.6-sol）についてout/s*.json、out/gpt-5.6-sol/s*.jsonを全17束ずつ読み、各644 ID・重複なし・欠落なし・sol-unionとの判定不一致0を確認。wrong/unclearの和集合は185 ID。全所見の原文と独立判断をJSONのmodel_findings_reviewに記録した。

判定件数: ok=250、unresolved=112、out_of_corpus=96、nonclaim=186。未解決重要度: medium=97、high=15。

未解決highが残るため通過扱いにしない。重要度は実際の料金・日付・利用可否・計算対象への影響で再判定した。審査だけの追加指摘はorigin=adjudication_onlyとし、当周の徹底チェックhighには数えない。

## 判定の読み方

- 通常料金・無料回数除外・会員優遇除外は記事の明示された比較前提として読んだ（siteの表前193行、調査方法575行等）。無料枠内を有料としたとの指摘はこの前提で退けた。宛先例外、BaaS、適用日は無料回数除外で補えないため別に未解決とした。
- 定額/境界ありの分類と、すべての送金が同額という断定を区別した。表の共通3万円列は、定額銀行に存在しない料金境界を創作したものではない。
- 正本外はA方針で残す。混在単位ではpartsとneeded_sourceを記録し、okは照合できる部分だけを意味する。parts内out_of_corpusを含む行を全体照合済みと数えない。
- みずほ・イオン403欠落、フィンサー欠落、横浜個人3万円以上の抽出欠落、りそな個人の経路列見出し欠落、ゆうちょ窓口/ATM/ことら条件の未収録を区別した。銀行名・制度名をまたいだ根拠の転用はしていない。

## 必要な修正

1. ドコモSMTB法人100円の行・逆引き・比率は2026年10月1日開始、通常振込、総合振込対象外、予約受付日基準、提携サービス差異を近接表示する。9月時点と10月改定後を混ぜない。
2. 通常他行宛から除外される具体的銀行を料金行・逆引き・比較文に明示する。UFJ信託/auじぶん、PayPay/SMBCの本人名義条件、りそなグループ4行、福岡グループの別銀行4行を混同しない。
3. ゆうちょは他行非居住者宛の窓口限定、利用口座間の定義/別枠、受入明細票送付100円を補う。SMTB個人はBaaSによる特典差異を補う。
4. ATM表は別途利用料を注記し、UFJ現金ATMの10万円超不可を料金行にも付ける。
5. 年間削減額の見出し・グラフ・手動差引例は対象銀行/サービス・他行宛・通常料金・金額帯・件数を明記する。ネットの選択区分の金額範囲を全経路の範囲にしない。
6. 正本外だけの記載は本審査で削除/修正を要求しない。必要資料は各IDのneeded_source。修正後は新snapshotを作り、同じIDだけでなく関連表・要約・FAQ・逆引き全体を再照合する。

## 採用しなかった主な所見

- 三井住友のATM現金880円と窓口現金990円は別経路。corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:110-118で確認。880円を990円へ直す指摘は不採用。
- UFJの手数料込み方式の禁止帯は手数料抜き金額指定を禁じない（corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:227-230）。30,200−660=29,540という手動差引の算術まで禁止帯で否定しない。例のサービス限定不足は別途未解決。
- 無料枠・会員99円の存在だけで通常単価比較を誤りとはしない。表前/節の比較条件を読んだ上で採否を決めた。
- SMBC個人料金の抽出では無料ネット/現金ATM550円の別ブロックの宛先見出しがない。別ブロックの宛先をSMBC信託と断定する所見は、正本だけでは実証できない。

## 全範囲の審査記録

番号はsegments.jsonの0始まり位置。以下の全範囲は、wrong/unclearのあるIDだけでなくok/正本外/非主張も含めて確認した。各IDの根拠行・条件はJSONに記録。

- 0–33: title/description/導入/概要/比較軸。要約はGMO・UFJ・各行料金表を開き、更新日と料金適用日を分離。著者経歴・編集数は正本外。
- 34–173: 個人15・法人15区分の全料金セル、分類、但し書。全銀行の該当料金節を開き、無料回数・会員・宛先・サービス・施行日を走査。
- 174–230: 逆引き行75/77/100/110/119/145/150/154/165/204/220/229/330/385/440/484/490/495/550/605/660円の全列挙先を、各銀行の正本に突合。
- 231–447: 銀行別の全再掲、比率、境界分類、出典表示を審査。同じ文章の重複も全IDを出力。
- 448–482: 年間比較を再計算、10境界/15定額/5除外を全件再集計、歴史説明の未収録と手動差引の数学を分離。
- 483–568: 個人の全経路表、同行表、ATM上限、ことら送金を各主体の資料で照合。未収録のゆうちょ/みずほを他行資料でokにしない。
- 569–594: 注意点・要約を再照合。要約のネット限定欠落・9月/10月混在、ゆうちょ例外を未解決。
- 595–643: FAQ/税/改定注/調査方法/出典/関連リンクを審査。正本内の確認部分と正本外の税務・商品仕様をpartsで分離。

全件分類台帳: 境界10 = 三菱UFJ個人、三菱UFJ法人、三井住友個人、三井住友法人、千葉個人、千葉法人、福岡個人、福岡法人、横浜法人、楽天法人。定額15 = GMO個人、GMO法人、SMTB個人、SMTB法人、PayPay個人、PayPay法人、楽天個人、ゆうちょ個人、ゆうちょ法人、りそな個人、りそな法人、埼玉りそな個人、埼玉りそな法人、auじぶん個人、ラクスル法人。除外5 = みずほ個人・みずほ法人・イオン個人・フィンサー法人・横浜個人。分類の成立は、各単価や例外の未解決の解消を意味しない。

## 未解決ID一覧

- **medium** `s-6d7b6ff461d4a99911f9-1`（位置39、sol_union） 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人） 【列】3万円未満 【値】77円三井住友信託銀行あて0円／その他は無料回数以降
  通常料金の値は正本と一致するが、次の適用条件が未充足：BaaS・提携サービスでサービスや無料回数特典が異なる。対象口座の除外がない。（corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48）
- **medium** `s-8c44156903f5a962faa8-1`（位置40、sol_union） 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人） 【列】3万円以上 【値】77円三井住友信託銀行あて0円／その他は無料回数以降
  通常料金の値は正本と一致するが、次の適用条件が未充足：BaaS・提携サービスでサービスや無料回数特典が異なる。対象口座の除外がない。（corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48）
- **medium** `s-67b5d7d48f763b80cf3d-1`（位置51、sol_union） 【行】PayPay銀行（個人） 【列】3万円未満 【値】145円
  通常料金の値は正本と一致するが、次の適用条件が未充足：カナ同一名義の個人SMBC口座宛は振込・予約・自動振込無料。来店等は対象外。この宛先例外を当該行は除外しない。（corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28）
- **medium** `s-0fa8f49a5ef3267310cf-1`（位置52、sol_union） 【行】PayPay銀行（個人） 【列】3万円以上 【値】145円
  通常料金の値は正本と一致するが、次の適用条件が未充足：カナ同一名義の個人SMBC口座宛は振込・予約・自動振込無料。来店等は対象外。この宛先例外を当該行は除外しない。（corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28）
- **medium** `s-9818a66fe3f92265a96d-1`（位置63、sol_union） 【行】ゆうちょ銀行（個人・ゆうちょダイレクト） 【列】3万円未満 【値】165円外為法上の非居住者による送金は1回3,000円
  通常料金の値は正本と一致するが、次の適用条件が未充足：他行の非居住者への送金は所定貯金窓口のみ。ダイレクト料金行に利用不可の宛先条件がない。（corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:43）
- **medium** `s-bc178d131d9cf788a4c6-1`（位置64、sol_union） 【行】ゆうちょ銀行（個人・ゆうちょダイレクト） 【列】3万円以上 【値】165円外為法上の非居住者による送金は1回3,000円
  通常料金の値は正本と一致するが、次の適用条件が未充足：他行の非居住者への送金は所定貯金窓口のみ。ダイレクト料金行に利用不可の宛先条件がない。（corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:43）
- **medium** `s-986e1a5f370e6b4c9020-1`（位置67、sol_union） 【行】りそな銀行（個人・マイゲート） 【列】3万円未満 【値】165円スタンダード・パール
  通常料金の値は正本と一致するが、次の適用条件が未充足：グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。（corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:29-49） 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-d5d5fffe1db534662f00-1`（位置68、sol_union） 【行】りそな銀行（個人・マイゲート） 【列】3万円以上 【値】165円スタンダード・パール
  通常料金の値は正本と一致するが、次の適用条件が未充足：グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。（corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:29-49） 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-b7fc11f8c9fc0f386338-1`（位置71、sol_union） 【行】埼玉りそな銀行（個人・マイゲート） 【列】3万円未満 【値】165円スタンダード・パール
  通常料金の値は正本と一致するが、次の適用条件が未充足：グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。（corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:29-49） 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-45a41a10c3879476ae0f-1`（位置72、sol_union） 【行】埼玉りそな銀行（個人・マイゲート） 【列】3万円以上 【値】165円スタンダード・パール
  通常料金の値は正本と一致するが、次の適用条件が未充足：グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。（corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:29-49） 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-bb700d0b799de8ba2232-1`（位置75、sol_union） 【行】auじぶん銀行（個人） 【列】3万円未満 【値】204円
  通常料金の値は正本と一致するが、次の適用条件が未充足：auじぶん本支店・三菱UFJ銀行宛は何回でも無料。対象外宛先の明記がない。（corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:64-75）
- **medium** `s-e8b3ab0813aaed135a43-1`（位置76、sol_union） 【行】auじぶん銀行（個人） 【列】3万円以上 【値】204円
  通常料金の値は正本と一致するが、次の適用条件が未充足：auじぶん本支店・三菱UFJ銀行宛は何回でも無料。対象外宛先の明記がない。（corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:64-75）
- **medium** `s-202fe6586adbfa198632-1`（位置79、sol_union） 【行】三井住友銀行（個人・SMBCダイレクト） 【列】3万円未満 【値】154円
  通常料金の値は正本と一致するが、次の適用条件が未充足：Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。（corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184）
- **medium** `s-3bf815b464cba744ef77-1`（位置80、sol_union） 【行】三井住友銀行（個人・SMBCダイレクト） 【列】3万円以上 【値】220円
  通常料金の値は正本と一致するが、次の適用条件が未充足：Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。（corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184）
- **medium** `s-4211eca67033552e2fd7-1`（位置83、sol_union） 【行】三菱UFJ銀行（個人・三菱UFJダイレクト） 【列】3万円未満 【値】154円
  通常料金の値は正本と一致するが、次の適用条件が未充足：三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。（corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132）
- **medium** `s-a796a89fbf74917a42c5-1`（位置84、sol_union） 【行】三菱UFJ銀行（個人・三菱UFJダイレクト） 【列】3万円以上 【値】220円
  通常料金の値は正本と一致するが、次の適用条件が未充足：三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。（corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132）
- **medium** `s-8fb3d6b06319e6ffbc2f-1`（位置91、sol_union） 【行】福岡銀行（個人IB） 【列】3万円未満 【値】220円
  通常料金の値は正本と一致するが、次の適用条件が未充足：福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。（corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46）
- **medium** `s-c704a416d8f7f2bd007a-1`（位置92、sol_union） 【行】福岡銀行（個人IB） 【列】3万円以上 【値】440円
  通常料金の値は正本と一致するが、次の適用条件が未充足：福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。（corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46）
- **medium** `s-bcc38823a6b5049add75-1`（位置96、sol_union） 個人は75円〜440円。
  corpus/gmo_aozora_com_contents_fee_html.txt:42-61、corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46：掲載通常ネット単価の端点75/440は一致するが、無料宛先を除く対象の明記が不足。未確認行を含む全個人口座の実額範囲としては使えない。
- **medium** `s-cec4de36d33c172d57b8-1`（位置97、sol_union） GMOあおぞら75円とドコモSMTB〈旧 住信SBI〉77円の個人向け通常料金は100円未満です。
  通常75円・77円はいずれも100円未満だがSMTBのBaaS対象差異を一般個人口座へ広げる限定不足。corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48
- **high** `s-5d246ad086b1ca34e557-1`（位置109、sol_union） 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人） 【列】3万円未満 【値】100円
  通常料金の値は正本と一致するが、次の適用条件が未充足：100円は2026年10月1日開始。9月更新の料金表の当該行には適用日がない。（corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27） 総合振込対象外、予約受付日時点の料金、提携サービス差異の限定が当該行にない。（corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-25） 改定前通常145円・件数優遇最安130円、総合振込145円。100円を全取引へ適用できない。（corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-40）
- **high** `s-faaed91f02476f9a6411-1`（位置110、sol_union） 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人） 【列】3万円以上 【値】100円
  通常料金の値は正本と一致するが、次の適用条件が未充足：100円は2026年10月1日開始。9月更新の料金表の当該行には適用日がない。（corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27） 総合振込対象外、予約受付日時点の料金、提携サービス差異の限定が当該行にない。（corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-25） 改定前通常145円・件数優遇最安130円、総合振込145円。100円を全取引へ適用できない。（corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-40）
- **medium** `s-4117a2c61f7a5bf6a881-1`（位置133、sol_union） 【行】福岡銀行（法人・ビジネスバンキングWeb） 【列】3万円未満 【値】330円
  通常料金の値は正本と一致するが、次の適用条件が未充足：熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。（corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38）
- **medium** `s-ad2277eff7cb93667e95-1`（位置134、sol_union） 【行】福岡銀行（法人・ビジネスバンキングWeb） 【列】3万円以上 【値】550円
  通常料金の値は正本と一致するが、次の適用条件が未充足：熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。（corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38）
- **medium** `s-df69cde145179cd4b272-1`（位置145、sol_union） 【行】りそな銀行（法人・ビジネスダイレクト） 【列】3万円未満 【値】605円
  通常料金の値は正本と一致するが、次の適用条件が未充足：通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。（corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46）
- **medium** `s-73e780b5588814a0afe8-1`（位置146、sol_union） 【行】りそな銀行（法人・ビジネスダイレクト） 【列】3万円以上 【値】605円
  通常料金の値は正本と一致するが、次の適用条件が未充足：通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。（corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46）
- **medium** `s-2e9544ace9d6c72f58ec-1`（位置149、sol_union） 【行】埼玉りそな銀行（法人・ビジネスダイレクト） 【列】3万円未満 【値】605円
  通常料金の値は正本と一致するが、次の適用条件が未充足：通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。（corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46）
- **medium** `s-f8323ed3e9576a7661d4-1`（位置150、sol_union） 【行】埼玉りそな銀行（法人・ビジネスダイレクト） 【列】3万円以上 【値】605円
  通常料金の値は正本と一致するが、次の適用条件が未充足：通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。（corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46）
- **high** `s-63dc09cd95f7901b3d22-1`（位置166、sol_union） 法人は100円〜660円。
  corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41、corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27、corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38：選択した通常単価の100～660円は概ね整合。ネット/法人一般への拡張、SMTBの適用日と対象、福岡の宛先別料金の区別が不足。会員99円のみの指摘は記事の除外方針で不採用。
- **high** `s-6431947438251849f07f-1`（位置167、sol_union） フィンサーバンク・ラクスルバンクを含むネット銀行系の6サービスが100〜229円に収まる一方、メガバンク・地銀は3万円以上で550〜660円と、はっきり階層が分かれています。
  corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41、corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27、corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38：選択した通常単価の100～660円は概ね整合。ネット/法人一般への拡張、SMTBの適用日と対象、福岡の宛先別料金の区別が不足。会員99円のみの指摘は記事の除外方針で不採用。
- **medium** `s-b042ea2b6e12649b01f0-1`（位置168、sol_union） 同じ三菱UFJ銀行でも他行宛ネット振込で3万円以上なら、個人の三菱UFJダイレクト220円・法人のBizSTATION660円と3倍で、法人口座の手数料は「個人の感覚」から大きく外れます。
  通常料金の倍率計算自体は整合するが、宛先・対象口座/サービスの限定が足りない。三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。 corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132
- **medium** `s-6f4f74db83439d6b74d7-1`（位置182、sol_union） 77円三井住友信託銀行あて0円／その他は無料回数以降
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、BaaS・提携サービスでサービスや無料回数特典が異なる。対象口座の除外がない。 corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48
- **medium** `s-850a12ea629c028063ff-1`（位置183、sol_union） 【行】77円三井住友信託銀行あて0円／その他は無料回数以降 【列】この金額になる区分 【値】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）（三井住友信託銀行以外・無料回数以降、金額不問）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、BaaS・提携サービスでサービスや無料回数特典が異なる。対象口座の除外がない。 corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48
- **high** `s-f4ad3aa46049ef3ba269-1`（位置184、sol_union） 100円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、100円は2026年10月1日開始。9月更新の料金表の当該行には適用日がない。 corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27 総合振込対象外、予約受付日時点の料金、提携サービス差異の限定が当該行にない。 corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-25 改定前通常145円・件数優遇最安130円、総合振込145円。100円を全取引へ適用できない。 corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-40
- **high** `s-153f607989865d4c04de-1`（位置185、sol_union） 【行】100円 【列】この金額になる区分 【値】GMOあおぞらネット銀行（法人）（金額不問）ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）（金額不問）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、100円は2026年10月1日開始。9月更新の料金表の当該行には適用日がない。 corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27 総合振込対象外、予約受付日時点の料金、提携サービス差異の限定が当該行にない。 corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-25 改定前通常145円・件数優遇最安130円、総合振込145円。100円を全取引へ適用できない。 corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-40
- **medium** `s-ffc4b699d297e0b5386c-1`（位置190、sol_union） 145円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、カナ同一名義の個人SMBC口座宛は振込・予約・自動振込無料。来店等は対象外。この宛先例外を当該行は除外しない。 corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28
- **medium** `s-78c4ee3de6c84232508d-1`（位置191、sol_union） 【行】145円 【列】この金額になる区分 【値】PayPay銀行（個人）（金額不問）PayPay銀行（法人）（金額不問）楽天銀行（個人）（金額不問）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、カナ同一名義の個人SMBC口座宛は振込・予約・自動振込無料。来店等は対象外。この宛先例外を当該行は除外しない。 corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28
- **medium** `s-8faf021aa0015e9dee7b-1`（位置194、sol_union） 154円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。 corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132 Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。 corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184
- **medium** `s-e9ab74239bee1ba5eb1a-1`（位置195、sol_union） 【行】154円 【列】この金額になる区分 【値】三菱UFJ銀行（個人・三菱UFJダイレクト）（3万円未満）三井住友銀行（個人・SMBCダイレクト）（3万円未満）横浜銀行（個人IB）（3万円未満）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。 corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132 Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。 corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184
- **medium** `s-646c07fa53a2eccce03d-1`（位置196、sol_union） 165円ゆうちょ個人の非居住者送金は1回3,000円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。 corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:29-49 グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。 corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:29-49 他行の非居住者への送金は所定貯金窓口のみ。ダイレクト料金行に利用不可の宛先条件がない。 corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:43 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-eea58a06131030ac8db6-1`（位置197、sol_union） 【行】165円ゆうちょ個人の非居住者送金は1回3,000円 【列】この金額になる区分 【値】りそな銀行（個人・マイゲート、スタンダード・パール）（金額不問）埼玉りそな銀行（個人・マイゲート、スタンダード・パール）（金額不問）ゆうちょ銀行（個人・ゆうちょダイレクト、居住者による送金）（金額不問）ゆうちょ銀行（法人・Bizダイレクト）（金額不問）千葉銀行（個人IB）（3万円未満）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。 corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:29-49 グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。 corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:29-49 他行の非居住者への送金は所定貯金窓口のみ。ダイレクト料金行に利用不可の宛先条件がない。 corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:43 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-81ad33d4cbd8bda0f57b-1`（位置198、sol_union） 204円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、auじぶん本支店・三菱UFJ銀行宛は何回でも無料。対象外宛先の明記がない。 corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:64-75
- **medium** `s-5c3c4f00030bf6d11df3-1`（位置199、sol_union） 【行】204円 【列】この金額になる区分 【値】auじぶん銀行（個人）（金額不問）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、auじぶん本支店・三菱UFJ銀行宛は何回でも無料。対象外宛先の明記がない。 corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:64-75
- **medium** `s-6c157ac025f1b690f7d1-1`（位置200、sol_union） 220円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。 corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132 Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。 corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184 福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。 corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46
- **medium** `s-e3c8557356ab52466807-1`（位置201、sol_union） 【行】220円 【列】この金額になる区分 【値】三菱UFJ銀行（個人・三菱UFJダイレクト）（3万円以上）三井住友銀行（個人・SMBCダイレクト）（3万円以上）福岡銀行（個人IB）（3万円未満）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。 corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132 Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。 corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184 福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。 corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46
- **medium** `s-265bac614942c90a379f-1`（位置204、sol_union） 330円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。 corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38
- **medium** `s-0a530b729ed10d78bb67-1`（位置205、sol_union） 【行】330円 【列】この金額になる区分 【値】千葉銀行（個人IB）（3万円以上）福岡銀行（法人・ビジネスバンキングWeb）（3万円未満）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。 corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38
- **medium** `s-260db28adc87c2ed3bdc-1`（位置208、sol_union） 440円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。 corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46
- **medium** `s-512f847bcbfbc08fe1fa-1`（位置209、sol_union） 【行】440円 【列】この金額になる区分 【値】福岡銀行（個人IB）（3万円以上）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。 corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46
- **medium** `s-8669e8754be19f9e7a94-1`（位置216、sol_union） 550円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。 corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38
- **medium** `s-f6855405e00264fe9593-1`（位置217、sol_union） 【行】550円 【列】この金額になる区分 【値】横浜銀行（法人・EB）（3万円以上）千葉銀行（法人・Web-EB）（3万円以上）福岡銀行（法人・ビジネスバンキングWeb）（3万円以上）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。 corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38
- **medium** `s-ecc279b6efea3f9f429c-1`（位置218、sol_union） 605円
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。 corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46 通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。 corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46
- **medium** `s-057c3526c27e4d413d5b-1`（位置219、sol_union） 【行】605円 【列】この金額になる区分 【値】りそな銀行（法人・ビジネスダイレクト）（金額不問）埼玉りそな銀行（法人・ビジネスダイレクト）（金額不問）
  逆引き行の列挙全件を各銀行自身の正本と突合。値は通常区分として存在するが、通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。 corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46 通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。 corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46
- **medium** `s-67b5d7d48f763b80cf3d-2`（位置273、sol_union） 【行】PayPay銀行（個人） 【列】3万円未満 【値】145円
  通常料金の値は正本と一致するが、次の適用条件が未充足：カナ同一名義の個人SMBC口座宛は振込・予約・自動振込無料。来店等は対象外。この宛先例外を当該行は除外しない。（corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28）
- **medium** `s-0fa8f49a5ef3267310cf-2`（位置274、sol_union） 【行】PayPay銀行（個人） 【列】3万円以上 【値】145円
  通常料金の値は正本と一致するが、次の適用条件が未充足：カナ同一名義の個人SMBC口座宛は振込・予約・自動振込無料。来店等は対象外。この宛先例外を当該行は除外しない。（corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28）
- **medium** `s-6d7b6ff461d4a99911f9-2`（位置285、sol_union） 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人） 【列】3万円未満 【値】77円三井住友信託銀行あて0円／その他は無料回数以降
  通常料金の値は正本と一致するが、次の適用条件が未充足：BaaS・提携サービスでサービスや無料回数特典が異なる。対象口座の除外がない。（corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48）
- **medium** `s-8c44156903f5a962faa8-2`（位置286、sol_union） 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人） 【列】3万円以上 【値】77円三井住友信託銀行あて0円／その他は無料回数以降
  通常料金の値は正本と一致するが、次の適用条件が未充足：BaaS・提携サービスでサービスや無料回数特典が異なる。対象口座の除外がない。（corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48）
- **high** `s-5d246ad086b1ca34e557-2`（位置288、sol_union） 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人） 【列】3万円未満 【値】100円
  通常料金の値は正本と一致するが、次の適用条件が未充足：100円は2026年10月1日開始。9月更新の料金表の当該行には適用日がない。（corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27） 総合振込対象外、予約受付日時点の料金、提携サービス差異の限定が当該行にない。（corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-25） 改定前通常145円・件数優遇最安130円、総合振込145円。100円を全取引へ適用できない。（corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-40）
- **high** `s-faaed91f02476f9a6411-2`（位置289、sol_union） 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人） 【列】3万円以上 【値】100円
  通常料金の値は正本と一致するが、次の適用条件が未充足：100円は2026年10月1日開始。9月更新の料金表の当該行には適用日がない。（corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27） 総合振込対象外、予約受付日時点の料金、提携サービス差異の限定が当該行にない。（corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-25） 改定前通常145円・件数優遇最安130円、総合振込145円。100円を全取引へ適用できない。（corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-40）
- **high** `s-0a744dfb8062e6241471-1`（位置290、sol_union） 法人は個人の約1.3倍（77円→100円）。
  通常料金の倍率計算自体は整合するが、宛先・対象口座/サービスの限定が足りない。BaaS・提携サービスでサービスや無料回数特典が異なる。対象口座の除外がない。 corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48 100円は2026年10月1日開始。9月更新の料金表の当該行には適用日がない。 corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27 総合振込対象外、予約受付日時点の料金、提携サービス差異の限定が当該行にない。 corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-25 改定前通常145円・件数優遇最安130円、総合振込145円。100円を全取引へ適用できない。 corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-40
- **medium** `s-38a56ea532960e0cffd1-1`（位置292、sol_union） ドコモSMTBネット銀行の法人の他行宛振込手数料は、2026年10月1日から一律100円（税込）となり、GMOあおぞらと同額になります。
  開始日と通常100円は一致し、同じ段落に総合振込・予約の条件もあるので、その欠落所見は不採用。ただし提携サービスの条件は未記載。corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:24
- **medium** `s-9818a66fe3f92265a96d-2`（位置300、sol_union） 【行】ゆうちょ銀行（個人・ゆうちょダイレクト） 【列】3万円未満 【値】165円外為法上の非居住者による送金は1回3,000円
  通常料金の値は正本と一致するが、次の適用条件が未充足：他行の非居住者への送金は所定貯金窓口のみ。ダイレクト料金行に利用不可の宛先条件がない。（corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:43）
- **medium** `s-bc178d131d9cf788a4c6-2`（位置301、sol_union） 【行】ゆうちょ銀行（個人・ゆうちょダイレクト） 【列】3万円以上 【値】165円外為法上の非居住者による送金は1回3,000円
  通常料金の値は正本と一致するが、次の適用条件が未充足：他行の非居住者への送金は所定貯金窓口のみ。ダイレクト料金行に利用不可の宛先条件がない。（corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:43）
- **medium** `s-8fb3d6b06319e6ffbc2f-2`（位置352、sol_union） 【行】福岡銀行（個人IB） 【列】3万円未満 【値】220円
  通常料金の値は正本と一致するが、次の適用条件が未充足：福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。（corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46）
- **medium** `s-c704a416d8f7f2bd007a-2`（位置353、sol_union） 【行】福岡銀行（個人IB） 【列】3万円以上 【値】440円
  通常料金の値は正本と一致するが、次の適用条件が未充足：福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。（corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46）
- **medium** `s-4117a2c61f7a5bf6a881-2`（位置355、sol_union） 【行】福岡銀行（法人・ビジネスバンキングWeb） 【列】3万円未満 【値】330円
  通常料金の値は正本と一致するが、次の適用条件が未充足：熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。（corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38）
- **medium** `s-ad2277eff7cb93667e95-2`（位置356、sol_union） 【行】福岡銀行（法人・ビジネスバンキングWeb） 【列】3万円以上 【値】550円
  通常料金の値は正本と一致するが、次の適用条件が未充足：熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。（corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38）
- **medium** `s-c93e0cedd372385c235f-1`（位置357、sol_union） 他行宛ネット振込の3万円以上では、法人は個人の約1.3倍（440円→550円）。
  通常料金の倍率計算自体は整合するが、宛先・対象口座/サービスの限定が足りない。福岡・熊本・十八親和・福岡中央・みんなの銀行宛は無料。同行除外だけでは残る4銀行宛の除外がない。 corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46 熊本・十八親和・福岡中央・みんなの銀行本支店宛は55円／110円。宛先除外がない。 corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38
- **medium** `s-986e1a5f370e6b4c9020-2`（位置365、sol_union） 【行】りそな銀行（個人・マイゲート） 【列】3万円未満 【値】165円スタンダード・パール
  通常料金の値は正本と一致するが、次の適用条件が未充足：グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。（corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:29-49） 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-d5d5fffe1db534662f00-2`（位置366、sol_union） 【行】りそな銀行（個人・マイゲート） 【列】3万円以上 【値】165円スタンダード・パール
  通常料金の値は正本と一致するが、次の適用条件が未充足：グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。（corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:29-49） 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-df69cde145179cd4b272-2`（位置368、sol_union） 【行】りそな銀行（法人・ビジネスダイレクト） 【列】3万円未満 【値】605円
  通常料金の値は正本と一致するが、次の適用条件が未充足：通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。（corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46）
- **medium** `s-73e780b5588814a0afe8-2`（位置369、sol_union） 【行】りそな銀行（法人・ビジネスダイレクト） 【列】3万円以上 【値】605円
  通常料金の値は正本と一致するが、次の適用条件が未充足：通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。（corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46）
- **medium** `s-9a5a0b6adaf68c17bff1-1`（位置370、sol_union） 法人は個人の約3.7倍（165円→605円）。
  通常料金の倍率計算自体は整合するが、宛先・対象口座/サービスの限定が足りない。グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。 corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:29-49 通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。 corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-b7fc11f8c9fc0f386338-2`（位置378、sol_union） 【行】埼玉りそな銀行（個人・マイゲート） 【列】3万円未満 【値】165円スタンダード・パール
  通常料金の値は正本と一致するが、次の適用条件が未充足：グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。（corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:29-49） 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-45a41a10c3879476ae0f-2`（位置379、sol_union） 【行】埼玉りそな銀行（個人・マイゲート） 【列】3万円以上 【値】165円スタンダード・パール
  通常料金の値は正本と一致するが、次の適用条件が未充足：グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。（corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:29-49） 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-2e9544ace9d6c72f58ec-2`（位置381、adjudication_only） 【行】埼玉りそな銀行（法人・ビジネスダイレクト） 【列】3万円未満 【値】605円
  通常料金の値は正本と一致するが、次の適用条件が未充足：通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。（corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46）
- **medium** `s-f8323ed3e9576a7661d4-2`（位置382、adjudication_only） 【行】埼玉りそな銀行（法人・ビジネスダイレクト） 【列】3万円以上 【値】605円
  通常料金の値は正本と一致するが、次の適用条件が未充足：通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。（corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46）
- **medium** `s-9a5a0b6adaf68c17bff1-2`（位置383、sol_union） 法人は個人の約3.7倍（165円→605円）。
  通常料金の倍率計算自体は整合するが、宛先・対象口座/サービスの限定が足りない。グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。 corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:29-49 通常他行宛605円（税込）、同一支店無料、グループ本支店330円。グループ4行宛の除外がない。 corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-4211eca67033552e2fd7-2`（位置405、sol_union） 【行】三菱UFJ銀行（個人・三菱UFJダイレクト） 【列】3万円未満 【値】154円
  通常料金の値は正本と一致するが、次の適用条件が未充足：三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。（corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132）
- **medium** `s-a796a89fbf74917a42c5-2`（位置406、sol_union） 【行】三菱UFJ銀行（個人・三菱UFJダイレクト） 【列】3万円以上 【値】220円
  通常料金の値は正本と一致するが、次の適用条件が未充足：三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。（corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132）
- **medium** `s-f0c8b4a109eead749626-1`（位置410、sol_union） 他行宛ネット振込の3万円以上では、法人は個人の3倍（220円→660円）。
  通常料金の倍率計算自体は整合するが、宛先・対象口座/サービスの限定が足りない。三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。 corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132
- **medium** `s-202fe6586adbfa198632-2`（位置419、sol_union） 【行】三井住友銀行（個人・SMBCダイレクト） 【列】3万円未満 【値】154円
  通常料金の値は正本と一致するが、次の適用条件が未充足：Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。（corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184）
- **medium** `s-3bf815b464cba744ef77-2`（位置420、sol_union） 【行】三井住友銀行（個人・SMBCダイレクト） 【列】3万円以上 【値】220円
  通常料金の値は正本と一致するが、次の適用条件が未充足：Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。（corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184）
- **medium** `s-f0c8b4a109eead749626-2`（位置424、sol_union） 他行宛ネット振込の3万円以上では、法人は個人の3倍（220円→660円）。
  通常料金の倍率計算自体は整合するが、宛先・対象口座/サービスの限定が足りない。Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。 corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184
- **medium** `s-bb700d0b799de8ba2232-2`（位置434、sol_union） 【行】auじぶん銀行（個人） 【列】3万円未満 【値】204円
  通常料金の値は正本と一致するが、次の適用条件が未充足：auじぶん本支店・三菱UFJ銀行宛は何回でも無料。対象外宛先の明記がない。（corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:64-75）
- **medium** `s-e8b3ab0813aaed135a43-2`（位置435、sol_union） 【行】auじぶん銀行（個人） 【列】3万円以上 【値】204円
  通常料金の値は正本と一致するが、次の適用条件が未充足：auじぶん本支店・三菱UFJ銀行宛は何回でも無料。対象外宛先の明記がない。（corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:64-75）
- **high** `s-e27f74039c901b4c4458-1`（位置448、sol_union） 法人は銀行選びで年67,200円変わる
  見出し/最安最高の断定には選択されたネット通常料金・全件3万円以上・年120件という比較対象が明示されず、一般的削減額と読める。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206。計算自体は正しいが金額帯や件数で結果が変わる。
- **high** `s-99c0bdc95abda32c1432-1`（位置449、sol_union） 法人の最安と最高で560円（660円−100円）の差があります。
  見出し/最安最高の断定には選択されたネット通常料金・全件3万円以上・年120件という比較対象が明示されず、一般的削減額と読める。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206。計算自体は正しいが金額帯や件数で結果が変わる。
- **high** `s-bc63520b183e0a3f801f-1`（位置474、sol_union） 振込金額に対する手数料の推移。メガバンク法人は3万円で484円から660円へ段が付くが、ネット銀行法人は100円で一定 / 660 / 484 / 100 / 手数料(円) / 3万円 / 0 / 6万円 →（振込金額） / メガバンク（法人）484円 → 660円 / ネット銀行（法人）100円で一定 / この段差が / 先方負担の計算を狂わせる / 3万円の境界はメガバンク・地銀に加え、楽天銀行の法人にもあります（グラフは三菱UFJ法人）。ネット銀行（同 GMOあおぞら法人）は定額で段が無い。
  グラフの484→660はBizSTATION他行宛、100はGMO通常区分。図中の「メガバンク法人」「ネット銀行法人」一般への拡張が過大。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206、corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:93-112。個人ダイレクトの手数料込み指定制限を、手動差引の数学説明へそのまま転用する指摘は不採用。
- **high** `s-9a682b7ef8f6a36ed3da-1`（位置478、sol_union） たとえば請求額30,200円を三菱UFJ法人から先方負担で振り込む場合、「3万円以上だから660円」と考えて差し引くと振込額は29,540円になり、振り込んだ瞬間に3万円未満（484円）の区分に落ちます。
  30,200−660=29,540、実送金29,540円のBizSTATION通常他行宛手数料484円という算術は一致。一方「三菱UFJ法人」一般にはATM770円・窓口990円もあるため、例にBizSTATION他行宛を明記する。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:137-206。手数料込み方式の禁止帯に請求額が入ることのみで、手動差引・手数料抜き指定の例まで誤りとする5.6の所見は不採用。
- **medium** `s-9bddeb0a11be00226707-1`（位置503、sol_union） 【行】三菱UFJ銀行 【列】ネットバンキング 【値】154円／220円
  通常料金の値は存在するが対象外宛先の除外が不足。三菱UFJ信託・auじぶん宛は当行他店扱い0円。この宛先除外が当該行にない。 corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132
- **medium** `s-a4d24976ee06ff589bfe-1`（位置504、sol_union） 【行】三菱UFJ銀行 【列】ATM（当行カード） 【値】275円
  個人当行カードATM他行275円自体は一致。特定2銀行宛は110円となり、利用料が別途必要な場合もある。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:48-82、128。
- **high** `s-7b3cc8995a9dd235afba-1`（位置505、sol_union） 【行】三菱UFJ銀行 【列】ATM（現金） 【値】880円
  880円は現金ATMの他行宛単価だが10万円超の現金振込は利用不可。別途ATM利用料もあり、金額帯に上限のない表へそのまま載せると利用可否を誤る。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:68-82
- **medium** `s-21a8128d97b0b66fe16b-1`（位置508、sol_union） 【行】三井住友銀行 【列】ネットバンキング 【値】154円／220円
  通常料金の値は存在するが対象外宛先の除外が不足。Oliveランク無料回数は無料回数除外で対象外。所定SMBCポイントパック・PayPay本人名義宛の無料条件は別途宛先注記が必要。 corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184
- **medium** `s-26d3af12516512121c0c-1`（位置509、sol_union） 【行】三井住友銀行 【列】ATM（当行カード） 【値】165円／275円
  corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:107-109の振込単価は一致するが、同171-173のコンビニATM別途利用料が未記載。SMBC信託宛の別料金という所見は、宛先見出しが抽出されていないため保留。
- **medium** `s-6d4f5f314b4148e887fe-1`（位置513、adjudication_only） 【行】りそな銀行 【列】ネットバンキング 【値】165円スタンダード・パール
  通常料金の値は存在するが対象外宛先の除外が不足。グループ本支店宛は別区分。りそな・埼玉りそな・関西みらい・みなと銀行を通常他行料金から除く必要がある。 corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:29-49 個人の経路列見出し欠落は正本外部分として残す。未解決の理由は資料欠落自体ではなく、確認できるグループ宛の別料金条件の欠落。
- **medium** `s-5af4804c2d324d718bf9-1`（位置518、sol_union） 【行】ゆうちょ銀行 【列】ネットバンキング 【値】165円外為法上の非居住者による送金は1回3,000円
  通常料金の値は存在するが対象外宛先の除外が不足。他行の非居住者への送金は所定貯金窓口のみ。ダイレクト料金行に利用不可の宛先条件がない。 corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:43
- **medium** `s-4166ecc3d871d7c1d087-1`（位置538、sol_union） 【行】三菱UFJ銀行 【列】ATM（当行カード） 【値】110円
  corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:48-82：110円は振込単価として一致。別途ATM利用手数料が必要な場合があり、支払総額と区別する注記が必要。
- **medium** `s-f860adbb0dfbd1bf20b7-1`（位置542、sol_union） 【行】三井住友銀行 【列】ATM（当行カード） 【値】無料
  corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:24-26、171-173：同行宛振込単価は無料だが、コンビニATMの別途利用料を明示する必要がある。
- **medium** `s-f70dc65a7c2e2afe3094-1`（位置549、sol_union） 【行】ゆうちょ銀行（振替） 【列】ネットバンキング 【値】通帳アプリと合算で月5回まで無料6回目以降 100円非居住者関連は1回3,000円利用口座間は原則無料（月1,000回目以降100円）
  通常月5回/以降100円、非居住者関連3,000円は一致。ただし利用口座間の定義と、総合口座受入明細票送付100円の追加条件が不足。594では利用口座間の月1,000回目以降100円の別枠も省略。corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-39、62、68。
- **medium** `s-bf16349619af52026d54-1`（位置552、sol_union） 同行宛でも、利用経路ごとの料金を確認してください     三菱UFJ銀行の個人は三菱UFJダイレクトの当行あてが0円、窓口が880円です。三井住友銀行の同行あてはSMBCダイレクトに加え、当行キャッシュカードによるATM振込も無料です。
  振込手数料の単価は正しいがATM利用料が別途発生する場合の注記がない。少数の経路/時間帯で総負担を誤認する。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:77-82、corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:171-173。SMBC信託宛の名付けは抽出資料の宛先見出し不足につき断定しない。
- **medium** `s-711de63d8fe2d2a4c061-1`（位置556、adjudication_only） 法人口座は窓口・ATMの額が別に定められている銀行があります（たとえば三菱UFJ銀行の法人は、当行のキャッシュカードによるATM振込が当行あて440円・他行あて770円で、個人の110円・275円とは違います）。
  個人ATM110/275円、法人440/770円は一致。ただし三菱UFJ信託・auじぶん宛の当行他店扱いが双方の他行料金から除外されていない。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:48-82、137-164、226。
- **medium** `s-05b3bbb77e018b3f1131-1`（位置560、sol_union） 10万円以下の個人間送金なら、ことら送金は0円
  10万円以下個人間無料はUFJ説明で確認するが、対応金融機関限定を欠く見出しは利用可能先を広げる。corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:168
- **medium** `s-e350620558b88fb00aca-1`（位置572、sol_union） 個人のドコモSMTBネット銀行は、三井住友信託銀行以外への振込にもスマプロランクに応じた無料回数があります。
  スマプロ無料回数・77円は通常サービスで一致するが、BaaSサービスの特典差異を省く。corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48
- **high** `s-ccd1aa1b24eb9562d101-1`（位置585、sol_union） 他行宛の振込手数料は個人75円〜440円／法人100円〜660円（2026年9月・税込。
  要約はネット振込の選択区分という限定を欠き、2026年9月と明記しながらSMTB法人100円の10月改定を混在させる。corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:68-91では880/990円、corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27では10月1日開始。次の括弧文の優遇除外だけでは解消しない。
- **medium** `s-3cbc0d64caebe7d38dd2-1`（位置594、sol_union） ゆうちょダイレクトの他のゆうちょ口座宛は通帳アプリと合算して月5回まで無料・6回目以降100円ですが、外為法上の非居住者に関連する送金は回数にかかわらず1回3,000円です（主要5行の実額）
  通常月5回/以降100円、非居住者関連3,000円は一致。ただし利用口座間の定義と、総合口座受入明細票送付100円の追加条件が不足。594では利用口座間の月1,000回目以降100円の別枠も省略。corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-39、62、68。
- **medium** `s-237fe7f638623fd509ee-1`（位置597、sol_union） 本記事で確認した30区分では、りそな銀行と埼玉りそな銀行の法人口座（ビジネスダイレクト）の他行宛が605円で、3万円未満・3万円以上のどちらも同額の定額です。
  605円・金額不問は一致するが、グループ本支店宛330円を他行宛から除く必要がある。corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46、corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:29-46
- **medium** `s-034ce2d9527b3e04fb0a-1`（位置602、sol_union） 本記事で確認した15区分では、GMOあおぞらネット銀行の法人口座とドコモSMTBネット銀行（旧 住信SBIネット銀行）の法人口座が、金額にかかわらず100円で最安です。
  通常100円は存在するがSMTBは10月施行の通常振込に限り、提携サービスの例外がない。最安の比較対象も未確認法人区分を含む。会員99円のみの反論は記事の会員優遇除外で不採用。corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27
- **medium** `s-0c8cf55d0c77b3a30e66-1`（位置603、sol_union） ドコモSMTBネット銀行の法人の他行宛振込手数料は、2026年10月1日から一律100円（税込）となり、GMOあおぞらと同額になりました。
  開始日と通常100円は一致し、同じ段落に総合振込・予約の条件もあるので、その欠落所見は不採用。ただし提携サービスの条件は未記載。corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:24
- **medium** `s-78429fc6e8247dd8b63e-1`（位置616、sol_union） 個人のドコモSMTBネット銀行ではスマプロランクに応じて無料回数が決まり、三井住友信託銀行以外への振込は無料回数以降77円です。
  スマプロ無料回数・77円は通常サービスで一致するが、BaaSサービスの特典差異を省く。corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48
- **medium** `s-38a56ea532960e0cffd1-2`（位置621、sol_union） ドコモSMTBネット銀行の法人の他行宛振込手数料は、2026年10月1日から一律100円（税込）となり、GMOあおぞらと同額になります。
  開始日と通常100円は一致し、同じ段落に総合振込・予約の条件もあるので、その欠落所見は不採用。ただし提携サービスの条件は未記載。corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:24
- **medium** `s-975cd5be93a26d33ed69-1`（位置624、sol_union） 上記の料金表は、この法人通常振込について2026年10月1日からの100円を反映しています。
  開始日と通常100円は一致し、同じ段落に総合振込・予約の条件もあるので、その欠落所見は不採用。ただし提携サービスの条件は未記載。corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:24

## 正本外・部分認定の必要資料

- `s-9a19de35eb42586cb586-1`（位置0、out_of_corpus）: 記事の更新履歴と30区分の選定台帳
- `s-8bf12d33390d6d90b960-1`（位置1、out_of_corpus）: 個人15・法人15区分の編集台帳と未確認区分の扱い
- `s-b1ebc75e6ae72ddd4e86-1`（位置2、out_of_corpus）: 記事の更新履歴と30区分の選定台帳
- `s-c8156a22cf9fb3db1a4c-1`（位置3、out_of_corpus）: 個人15・法人15区分の編集台帳と未確認区分の扱い
- `s-1c04fd8e0aa008f17c58-1`（位置5、out_of_corpus）: 計算機の仕様・プリセット一覧・3方式の計算定義と検証記録
- `s-e2e182ee29d519e0e49f-1`（位置6、out_of_corpus）: 記事の更新履歴と30区分の選定台帳
- `s-334220e4b41c156035ae-1`（位置7、out_of_corpus）: 著者が公開する経歴・文責の記録
- `s-49b49a5c446c2ac21f3c-1`（位置11、out_of_corpus）: 比較記事の調査と企業の金融機関選択要因に関する調査資料
- `s-c24231723f13b42f87e6-1`（位置12、out_of_corpus）: 個人15・法人15区分の編集台帳と未確認区分の扱い
- `s-40323c06dd36561b3983-1`（位置28、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-a29f6e9c58e952f3caa3-1`（位置29、out_of_corpus）: 個人15・法人15区分の編集台帳と未確認区分の扱い
- `s-d5524430a2ef932af04c-1`（位置43、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-92f15c3e43dfa53a56df-1`（位置44、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-3a4366fbac6f15bec48b-1`（位置45、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-f5e8aa39d1712056ea74-1`（位置47、out_of_corpus）: https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）
- `s-d4f9efb3cc4bb6a5897e-1`（位置48、out_of_corpus）: https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）
- `s-d54c1ac42c637ba5896c-1`（位置49、out_of_corpus）: https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）
- `s-30dc8508c8f9b865013c-1`（位置60、out_of_corpus）: https://www.boy.co.jp/fee/furikomi.html の列構造を保った個人IB料金表
- `s-645ee0eabb1debe48237-1`（位置61、out_of_corpus）: https://www.boy.co.jp/fee/furikomi.html の列構造を保った個人IB料金表
- `s-986e1a5f370e6b4c9020-1`（位置67、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-d5d5fffe1db534662f00-1`（位置68、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-b7fc11f8c9fc0f386338-1`（位置71、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-45a41a10c3879476ae0f-1`（位置72、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-7fb7f4cc30de4c86a060-1`（位置99、out_of_corpus）: 個人15・法人15区分の編集台帳と未確認区分の扱い
- `s-990a860c6bfe176d0c12-1`（位置113、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-a747cab8f9c8365e30d0-1`（位置114、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-6971f3957b15867e0a12-1`（位置115、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-f8f4e825b56148890168-1`（位置157、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-fc906c2bd2d1d4e0d833-1`（位置158、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-97f3ec20b3de9dc77a4a-1`（位置159、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-6431947438251849f07f-1`（位置167、unresolved）: フィンサー法人・みずほ法人等の比較対象全件の公式料金表
- `s-5a6ee3b7eac5f28f86e3-1`（位置169、out_of_corpus）: auじぶん銀行の法人口座申込資格を定める公式FAQ
- `s-3f8eda8145505fb7fb2c-1`（位置170、out_of_corpus）: 計算機の仕様・プリセット一覧・3方式の計算定義と検証記録
- `s-1100aa5036ee99a03ec4-1`（位置171、ok）: りそな・埼玉りそなの経路列見出し付きマイゲート料金表
- `s-66ce676ce760bdb0c48c-1`（位置176、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-dc5fea883e9beeb57c24-1`（位置177、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-d71c19fc47550ad9348a-1`（位置186、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）; https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）; フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-3b15255c69723500e2e7-1`（位置187、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）; https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）; フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-646c07fa53a2eccce03d-1`（位置196、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-eea58a06131030ac8db6-1`（位置197、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-6f4e4efcc1005053158a-1`（位置212、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-31f5c7f5b26a26c65d1d-1`（位置213、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-23a5a8980c6052a56b6f-1`（位置220、ok）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-a6ee346697123ce56752-1`（位置221、ok）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-3e378736e9c12ce9fce6-1`（位置222、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-b2fe87bbf0b413066092-1`（位置224、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-26e72f66412a6dffe9dc-1`（位置227、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-8bab68ceb89c42d559dd-1`（位置228、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-4b5a7311764282e5ce11-1`（位置229、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-ec3178c52a30282a1640-1`（位置230、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-990a860c6bfe176d0c12-2`（位置249、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-a747cab8f9c8365e30d0-2`（位置250、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-ac9ebde9519c1b2ac59a-2`（位置251、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-de220920a4f28071e3f0-1`（位置252、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-66cf88d63e34f585b76b-1`（位置253、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-c005188dd78f6fe83bdc-1`（位置254、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-e16fa3649d5f633956b8-1`（位置255、out_of_corpus）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-7b8c70b965e3628f02fb-1`（位置265、ok）: ラクスルバンクの公式商品概要・口座開設条件
- `s-30dc8508c8f9b865013c-2`（位置326、out_of_corpus）: https://www.boy.co.jp/fee/furikomi.html の列構造を保った個人IB料金表
- `s-986e1a5f370e6b4c9020-2`（位置365、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-d5d5fffe1db534662f00-2`（位置366、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-9a5a0b6adaf68c17bff1-1`（位置370、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-b7fc11f8c9fc0f386338-2`（位置378、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-45a41a10c3879476ae0f-2`（位置379、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-9a5a0b6adaf68c17bff1-2`（位置383、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-d5524430a2ef932af04c-2`（位置391、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-92f15c3e43dfa53a56df-2`（位置392、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-f8f4e825b56148890168-2`（位置394、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-fc906c2bd2d1d4e0d833-2`（位置395、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-a900fac1815f1654bcf9-1`（位置396、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-09e7d6bed1cc7517b324-3`（位置397、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-f5e8aa39d1712056ea74-2`（位置443、out_of_corpus）: https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）
- `s-d4f9efb3cc4bb6a5897e-2`（位置444、out_of_corpus）: https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）
- `s-ac9ebde9519c1b2ac59a-10`（位置445、out_of_corpus）: https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）
- `s-5fa092c831f1b40c7556-1`（位置465、out_of_corpus）: 比較記事の調査と企業の金融機関選択要因に関する調査資料
- `s-e676801292dc95c97b09-1`（位置467、out_of_corpus）: 全銀ネット/全銀協の2021年10月1日制度改定・旧銀行間手数料の区分と内国為替制度運営費の公式説明
- `s-8226026028a2489bd142-1`（位置468、out_of_corpus）: 全銀ネット/全銀協の2021年10月1日制度改定・旧銀行間手数料の区分と内国為替制度運営費の公式説明
- `s-c461a856254a04527c2b-1`（位置479、out_of_corpus）: 差引方式の3分類の定義、契約上の根拠・当事者の合意資料
- `s-5cb3dbdb30af4f6dd08c-1`（位置483、out_of_corpus）: 記事の構成台帳・比較対象/注意点の定義
- `s-f3286755fbb584302ff9-1`（位置487、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-78efbbf5c66338ecd005-1`（位置488、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-a4bb446c7beb18feaf73-1`（位置498、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-1aba5bd4aae13bcc884d-1`（位置499、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-b507dd780e6b5d1a7a5c-1`（位置500、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-810f146decc44900265f-1`（位置501、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-6d4f5f314b4148e887fe-1`（位置513、unresolved）: りそな/埼玉りそなの経路列見出しを保持した個人マイゲート料金表
- `s-9cd6a36d19eb97acec22-1`（位置519、out_of_corpus）: ゆうちょ銀行公式の個人窓口/ATMの振込・振替料金表（境界・現金取扱可否・適用日を含む）
- `s-abdc84edb132c47d5b11-1`（位置520、out_of_corpus）: ゆうちょ銀行公式の個人窓口/ATMの振込・振替料金表（境界・現金取扱可否・適用日を含む）
- `s-1735a01c2cf21507253b-1`（位置521、out_of_corpus）: ゆうちょ銀行公式の個人窓口/ATMの振込・振替料金表（境界・現金取扱可否・適用日を含む）
- `s-bcda7a4ab9c9b1b9834e-1`（位置522、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-3f2954866cc50572328f-1`（位置533、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-b42e48cce513fb4929c1-1`（位置534、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-4d9165a051a6c03f6898-1`（位置535、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-70c82c7ffd9131daaa43-1`（位置545、out_of_corpus）: https://www.resonabank.co.jp/direct/service/tesuryo.html の経路列見出しを保存した料金表
- `s-0379720a263cffb93d44-1`（位置550、out_of_corpus）: ゆうちょ銀行公式の個人窓口/ATMの振込・振替料金表（境界・現金取扱可否・適用日を含む）
- `s-5025b9c20f8a35c9f8ae-1`（位置551、out_of_corpus）: ゆうちょ銀行公式の個人窓口/ATMの振込・振替料金表（境界・現金取扱可否・適用日を含む）
- `s-bc786520da84cce34633-1`（位置555、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-cc36c6f9de794b7ff82d-1`（位置558、ok）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）及び現金ATM利用上限の公式説明
- `s-98406924d6da016062eb-1`（位置559、out_of_corpus）: ゆうちょ銀行公式の個人窓口/ATMの振込・振替料金表（境界・現金取扱可否・適用日を含む）
- `s-19cfc46f6a32b47e84c7-1`（位置565、ok）: ゆうちょ銀行ことら送金の公式サービス概要・利用規定（対象口座/居住者/提供経路の条文）
- `s-bb8d00fa4fe538129832-1`（位置566、ok）: ゆうちょ銀行ことら送金の公式サービス概要・利用規定（対象口座/居住者/提供経路の条文）
- `s-e0907e5086fea62f7ce4-1`（位置567、out_of_corpus）: ことら送金利用規定の送受金主体・用途制限・取消の条文
- `s-1308e1722f333376f52e-1`（位置569、out_of_corpus）: 記事の構成台帳・比較対象/注意点の定義
- `s-eccdd4b4305dfb25e7eb-1`（位置578、ok）: 対象ネット銀行全体の基本料調査と主流を判断する母集団
- `s-51d18723bc0b55fae228-1`（位置581、out_of_corpus）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）
- `s-8d73f4fc41b1ad6e5626-1`（位置586、out_of_corpus）: 記事の比較仕様（通常料金・無料枠・会員優遇・基本料・対象口座の扱い）
- `s-3ef5351f3d283ed85658-1`（位置591、out_of_corpus）: 記事の比較仕様（通常料金・無料枠・会員優遇・基本料・対象口座の扱い）
- `s-5135995c7aa5e6f2de7e-1`（位置598、ok）: みずほ・イオン・フィンサー・横浜個人上位帯を補完した30区分全件の公式資料
- `s-ae958b4cf684d5b16141-1`（位置599、ok）: 国税庁の国内振込手数料の課税区分・適用税率の根拠、未収録銀行の税込料金表、実際の明細表示仕様
- `s-0b70aafd476fd9455426-1`（位置600、ok）: 国税庁の国内振込手数料の課税区分・適用税率の根拠、未収録銀行の税込料金表、実際の明細表示仕様
- `s-034ce2d9527b3e04fb0a-1`（位置602、unresolved）: フィンサー法人・みずほ法人等の比較対象全件の公式料金表
- `s-a85aab43f6014d1ee977-1`（位置605、ok）: フィンサーバンク公式の料金表・各プラン条件・運営会社/仲介業登録・対象法人の資料
- `s-89f6367558a03f6e289c-1`（位置608、out_of_corpus）: 全銀ネット/全銀協の2021年10月1日制度改定・旧銀行間手数料の区分と内国為替制度運営費の公式説明
- `s-1e15cd27d12437a71419-1`（位置609、out_of_corpus）: 全銀ネット/全銀協の2021年10月1日制度改定・旧銀行間手数料の区分と内国為替制度運営費の公式説明
- `s-ae652cccdc904e2fc575-1`（位置613、out_of_corpus）: 記事の比較仕様（通常料金・無料枠・会員優遇・基本料・対象口座の扱い）
- `s-499afed3dbe8ea92a053-1`（位置614、out_of_corpus）: 記事の比較仕様（通常料金・無料枠・会員優遇・基本料・対象口座の扱い）
- `s-970adfcab45fdf946f34-1`（位置617、out_of_corpus）: 記事の比較仕様（通常料金・無料枠・会員優遇・基本料・対象口座の扱い）
- `s-1995fd05540d29452ece-1`（位置619、ok）: 国税庁の国内振込手数料の課税区分・適用税率の根拠、未収録銀行の税込料金表、実際の明細表示仕様
- `s-740576b63bda5da441c7-1`（位置620、out_of_corpus）: 国税庁の売手負担振込手数料相当額のインボイス取扱いQ&Aと処理実態資料
- `s-7c0693078a6bd21a22ae-1`（位置626、ok）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）; https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）; ゆうちょ窓口ATM料金表・ことら規定
- `s-9ff496652d18b20013b9-1`（位置629、out_of_corpus）: 記事の対象区分・編集方針・表生成仕様/照合台帳
- `s-78754242c71e8f93ad71-1`（位置632、out_of_corpus）: auじぶん銀行の法人口座申込資格を定める公式FAQ
- `s-ad2a52ce37ff38638150-1`（位置634、out_of_corpus）: https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）
- `s-3e7b6ff825e5254208ca-1`（位置635、ok）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）; https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）; ゆうちょ窓口ATM料金表・ことら規定
- `s-95f8af4375dad3367286-1`（位置637、out_of_corpus）: 全銀ネット/全銀協の2021年10月1日制度改定・旧銀行間手数料の区分と内国為替制度運営費の公式説明
- `s-a5db3a77230470169c16-1`（位置638、ok）: https://www.mizuhobank.co.jp/rate_fee/fee_furikomi.html ; https://www.mizuhobank.co.jp/corporate/ebservice/account/ebusiness/charge.html（個人・法人EB・窓口・ATMの適用日付き料金表）; https://www.aeonbank.co.jp/fee/transfer-atm/（対象口座・経路・金額区分・優遇を含む料金表）; ゆうちょ窓口ATM料金表・ことら規定
- `s-132360ecb077b4384895-1`（位置642、out_of_corpus）: リンク先計算/検索ツールの仕様・利用規約・プライバシー/営業運用方針

整合性検査: 644/644 ID、ID重複0、protectedのnonclaim 0、okのconditions:no 0、unresolvedのseverity欠落0。正本参照ファイルと行番号の存在を確認。

DONE
