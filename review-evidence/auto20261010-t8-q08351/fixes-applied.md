# auto20261010 t8-q08351 修正報告（2026-10-10）

作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261010-t8-q08351`。基点 origin/main `38305d0e`。push・他モデル起動・サブエージェント・orca・スキルは使用していない。

## 単位・被覆・誤り率

入力審査: 699単位 = ok318 / 非主張126 / 正本外129 / 要修正126（high121・medium5・low0）、審査未処理0（通過判定high73・審査追加high48）。solのcoverage.jsonはconfirmed439だが、審査で変更された判定を優先する。

正本に照らした修正前誤り率: 審査の要修正をwrongとして126÷(318+126)=**28.38%**。参考にsol単独はwrong81÷(ok358+wrong81)=18.45%（unclear5は分母に含めない）。修正後の独立審査の誤り率は**未測定**。修正担当の確認を独立審査okに置き換えない。

台帳機械検査の前: 699単位、主張対応518・非主張121・未処理60。台帳機械検査の後: 741単位、主張対応615・非主張126・未処理0。独立審査okかつ不変の262単位をverified、修正担当確認の181単位と再分割43単位は再照合待ち。正本外129単位はneeded_source付き未確認を維持。被覆100%は正確性の保証ではない。

単位数増加42は条件文の追加と文の再分割による。旧単位 `s-818a96d02b2364576db0-1` のSMTB提携留保は100円未満比較の文に統合し、独立した旧文としては残らない。統合先は `s-1c66541d31a288cd0b44-1`。

## 論点 → 単位ID → 全修正箇所 → 正本の行

対象126単位は全件、修正後の本文または付属文脈が変わったことをunit-mapping.jsonと突き合わせた。正本外のwrongは0。正本外の金額・説明の内容を理由なく変更・削除していない。ラクスルの行名と横浜個人の未確認3万円以上のセルは、確認済みの同じ行の料金に他行宛限定を加えたため行見出しだけ変わる。未確認の状態は維持。

主な修正箇所は以下。各論点のIDと引用行の全リストを後掲する。

- 宛先/経路: `docs/assets/fee_table.json`の19銀行区分のfee_note・index_name・scope_note、比較表、銀行別、逆引き、年間試算。SMTBは当社/三井住友信託宛無料との区分も明示。PayPayはネットの料金区分、SMTB改定前料金は法人/他行宛、PayPay無料の送金元も明示。
- 比較レンジ: 個人75〜440円の本文・まとめ、100円未満の比較文にSMTBのBaaS/提携サービスと無料宛先、auじぶんの三菱UFJ宛除外を明示。
- 3万円境界: `tools/gen_bank_sections.mjs`と楽天・横浜・千葉・福岡・UFJ・SMBCの銀行別の境界文。通常の他行宛・掲載サービスに限定し、楽天の給与/賞与/総合、横浜再振込を除く。正本外のみずほ境界の文は維持。
- 経路別: 他行宛/同行宛の2表のUFJ・SMBC個人とネットサービス、二額の3万円未満/以上の順序、りそな同行ネットの個人マイゲート、同行比較callout、SMBC個人他行宛の窓口/現金ATM比較。
- マイゲート: ルビー82円・ダイヤ0円の銀行/個人/サービス/月3回と無料グループ宛の除外。
- 税込: ゆうちょダイレクトの非居住者3,000円を含む税込注記。FAQ本文・FAQ質問の回答文脈・FAQ JSON-LD（node tools/gen_faq_jsonld.mjs）。
- 全主張の台帳: `claims/column/furikomi-tesuryo-hikaku.json`。審査okをcovers/verified、非主張を理由付きnonclaims、正本外をneeded_source付きで登録。修正と追加にscope/exceptions/source_quote/corpus_refを付け、同じ料金表の例外全件をexception_sourcesに残す。

title/meta/OGは料金の個別額を含まない既存の正本外の編集履歴・収録数の主張を維持。図の対象料金/他行宛は従来から明示されており変更不要。本体senpou-futanの銀行プリセットは同じfee_table.jsonを参照し、bank_presets.jsがscope_note/public_noteを表示する。docs/embed/senpou-futanは銀行プリセットを読み込まず手数料を手入力するので、同じ銀行料金の出現はない。全出現検索で下記3ページの静的表/設例を追加修正した。額の古さを直した論点はなく、core・境界ケース・stale_valuesの変更は不要。

### 単位ごとの根拠と対応

#### 料金表・逆引きの宛先と経路限定（要修正98単位）

- `s-a68b0177c8c510c2c5e9-1` → `s-27d9c42dbde009ef3484-1` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-61 ; corpus/gmo_aozora_com_contents_fee_html.txt:47-50 ; corpus/gmo_aozora_com_contents_fee_html.txt:53-53
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（個人）他行宛。カスタマーステージの無料回数以降 【列】区分 【値】定額
- `s-ff4cc5567329f8d2efc8-1` → `s-3f3e9165074f9313b014-1` / high / 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-53
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（個人）他行宛。カスタマーステージの無料回数以降 【列】3万円未満 【値】75円
- `s-d87322ed923cd6e32d9d-1` → `s-9f815b81daa66ee59b07-1` / high / 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-53
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（個人）他行宛。カスタマーステージの無料回数以降 【列】3万円以上 【値】75円
- `s-783c9a665095a653a373-1` → `s-d4fe8e7b3d76523d4ce1-1` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-61 ; corpus/gmo_aozora_com_contents_fee_html.txt:47-50 ; corpus/gmo_aozora_com_contents_fee_html.txt:53-53
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / カスタマーステージの無料回数以降
- `s-dd53e332d7771663bfaf-1` → `s-21a3c33a6916ce4c100a-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-48 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:20-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-48
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）当社・三井住友信託銀行あて0円／それ以外の金融機関宛は無料回数以降。
- `s-cd090d9c8561816e9539-1` → `s-4064373188d3e47353ca-1` / high / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:22-48
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）当社・三井住友信託銀行あて0円／それ以外の金融機関宛は無料回数以降。BaaS・提携サービスは条件が異なる場合あり 【列】3万円未満 【値】77円
- `s-cc52c599f0283a1faef2-1` → `s-737a7819229ddb24aa4b-1` / high / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:22-48
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）当社・三井住友信託銀行あて0円／それ以外の金融機関宛は無料回数以降。BaaS・提携サービスは条件が異なる場合あり 【列】3万円以上 【値】77円
- `s-3bac8fd04f0cedf353bf-1` → `s-a034f8363e3cf31debd2-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-17 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:30-33 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:41-48
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）当社・三井住友信託銀行あて0円／それ以外の金融機関宛は無料回数以降。BaaS・提携サービスは条件が異なる場合あり 【列】区分 【値】定額
- `s-76f13ee1986ce50c003a-1` → `s-52c5b18b3ddd9c1ea0fb-1` / 同論点の別出現 / 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:11-17 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常料金（残高優遇・給与受取の月3回無料を除く）。
- `s-7878aee8298201af18fc-1` → `s-7613d6066972da9e1903-1` / high / 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-17
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（個人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・給与受取の月3回無料を除く）。カナ同一名義の個人の三井住友銀行口座あては振込・振込予約・自動振込が無料（その他サービス・来店は対象外） 【列】3万円未満 【値】145円
- `s-b4d9b50efb5bcd224e3f-1` → `s-7bc471ad8e269227aaf1-1` / high / 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-17
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（個人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・給与受取の月3回無料を除く）。カナ同一名義の個人の三井住友銀行口座あては振込・振込予約・自動振込が無料（その他サービス・来店は対象外） 【列】3万円以上 【値】145円
- `s-729b9f534fa40882aa4c-1` → `s-574c109b0a9f534333db-1` / 同論点の別出現 / 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:20-20 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:21-26 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:27-28 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（個人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・給与受取の月3回無料を除く）。カナ同一名義の個人の三井住友銀行口座あては振込・振込予約・自動振込が無料（その他サービス・来店は対象外） 【列】区分 【値】定額
- `s-6fcd8dcf2f796361968c-1` → `s-eca6cf08f7bddf0e39e0-1` / 同論点の別出現 / 根拠: corpus/www_rakuten_bank_co_jp_charge.txt:48-56 ; corpus/www_rakuten_bank_co_jp_charge.txt:48-64 ; corpus/www_rakuten_bank_co_jp_charge.txt:92-95
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常振込・振込予約の無料回数がない場合
- `s-4c3eff5f117fab0377ce-1` → `s-a1c1a4cd7ce1d2eb4535-1` / high / 根拠: corpus/www_rakuten_bank_co_jp_charge.txt:48-64
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（個人）他金融機関宛。通常振込・振込予約の無料回数がない場合 【列】3万円未満 【値】145円
- `s-2de3390af081b431716e-1` → `s-24fa2d95d4ea88c1b2fc-1` / high / 根拠: corpus/www_rakuten_bank_co_jp_charge.txt:48-64
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（個人）他金融機関宛。通常振込・振込予約の無料回数がない場合 【列】3万円以上 【値】145円
- `s-629c4659362596b54a46-1` → `s-1473a58026984d72e871-1` / 同論点の別出現 / 根拠: corpus/www_rakuten_bank_co_jp_charge.txt:48-56 ; corpus/www_rakuten_bank_co_jp_charge.txt:48-64 ; corpus/www_rakuten_bank_co_jp_charge.txt:92-95
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（個人）他金融機関宛。通常振込・振込予約の無料回数がない場合 【列】区分 【値】定額
- `s-007a95f66459db3c81a5-1` → `s-c950b79acaad0851423e-1` / 同論点の別出現 / 根拠: corpus/www_boy_co_jp_fee_furikomi_html.txt:12-25 ; corpus/www_boy_co_jp_fee_furikomi_html.txt:29-87
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ゼロ手数料の無料回数適用外
- `s-473fa352fd09148222e1-1` → `s-3d1aab1143502aeecd78-1` / high / 根拠: corpus/www_boy_co_jp_fee_furikomi_html.txt:12-25
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（個人IB）他行宛。ゼロ手数料の無料回数適用外 【列】3万円未満 【値】154円
- `s-4343b567b9b5a6d2f499-1` → `s-723688fa07a60ea38188-1` / 同論点の別出現 / 根拠: corpus/www_boy_co_jp_fee_furikomi_html.txt:12-25 ; corpus/www_boy_co_jp_fee_furikomi_html.txt:29-87
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（個人IB）他行宛。ゼロ手数料の無料回数適用外 【列】3万円以上 【値】未確認
- `s-74d8074d9d45322c1786-1` → `s-c1969e7103326ad243ef-1` / 同論点の別出現 / 根拠: corpus/www_boy_co_jp_fee_furikomi_html.txt:12-25 ; corpus/www_boy_co_jp_fee_furikomi_html.txt:29-87
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（個人IB）他行宛。ゼロ手数料の無料回数適用外 【列】区分 【値】3万円以上は未確認
- `s-f531acf5b44571eeb6b0-1` → `s-2e6daefc78fec380cc0a-1` / 同論点の別出現 / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-39 ; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43 ; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:42-43
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ゆうちょ銀行（個人・ゆうちょダイレクト）他金融機関宛。
- `s-ad550281eae2ffb2a38d-1` → `s-3cceee6e8aed7375e56b-1` / high / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-43
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（個人・ゆうちょダイレクト）他金融機関宛。非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ。ゆうちょダイレクトでは取引時確認が済んでいない口座からの10万円を超える送金は取扱不可 【列】3万円未満 【値】165円
- `s-cfbe95e2bab23c51a274-1` → `s-8801d049c0a7e8857f96-1` / high / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-43
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（個人・ゆうちょダイレクト）他金融機関宛。非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ。ゆうちょダイレクトでは取引時確認が済んでいない口座からの10万円を超える送金は取扱不可 【列】3万円以上 【値】165円
- `s-50d0a44d3df043c0e198-1` → `s-536961b31d85ce83f720-1` / 同論点の別出現 / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43 ; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:42-43 ; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:62-68
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（個人・ゆうちょダイレクト）他金融機関宛。非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ。ゆうちょダイレクトでは取引時確認が済んでいない口座からの10万円を超える送金は取扱不可 【列】区分 【値】定額
- `s-9b90cab87b6e968d7124-1` → `s-f9eeb7a2ad9934cf4f58-1` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三井住友銀行（個人・SMBCダイレクト）他行宛。
- `s-769966d143f6874aecf4-1` → `s-ac9659eae6031153dd18-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-23 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-179 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:180-180 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184-184 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人・SMBCダイレクト）他行宛。Oliveの無料回数適用外。所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（口座設定・メンテナンス時間・名義の文字や符号等により有料の場合あり） 【列】3万円未満 【値】154円
- `s-75de2d37c9686d4a1fa7-1` → `s-2523f7468af9d8e99426-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-23 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-179 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:180-180 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184-184 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人・SMBCダイレクト）他行宛。Oliveの無料回数適用外。所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（口座設定・メンテナンス時間・名義の文字や符号等により有料の場合あり） 【列】3万円以上 【値】220円
- `s-358cc4aad27e87ae1934-1` → `s-44eb40b1cccd13366b4b-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-23 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-179 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-184 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:180-180 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184-184 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人・SMBCダイレクト）他行宛。Oliveの無料回数適用外。所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（口座設定・メンテナンス時間・名義の文字や符号等により有料の場合あり） 【列】区分 【値】境界あり
- `s-7c45983ec9b3af091d4b-1` → `s-141e5c31775abc2c1608-1` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三菱UFJ銀行（個人・三菱UFJダイレクト）他行宛。
- `s-56661a159b9ecede2a14-1` → `s-02f1fad96ee3c19b4dd8-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-28 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:128-128 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:129-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:16-23 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-27 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:28-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人・三菱UFJダイレクト）他行宛。メインバンク プラスの無料優遇適用外。三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円 【列】3万円未満 【値】154円
- `s-85ff9ebc71b071a6fdd9-1` → `s-11b00da0f9b0000e5af1-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-28 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:128-128 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:129-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:16-23 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-27 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:28-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人・三菱UFJダイレクト）他行宛。メインバンク プラスの無料優遇適用外。三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円 【列】3万円以上 【値】220円
- `s-7869c181e591fc571335-1` → `s-f274b96ade6489e321d7-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-28 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:128-128 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:129-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:16-23 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-27 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:28-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人・三菱UFJダイレクト）他行宛。メインバンク プラスの無料優遇適用外。三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円 【列】区分 【値】境界あり
- `s-57cc5d419c1101edc235-1` → `s-bb46aba84a366d7326ff-1` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 千葉銀行（個人IB）他行宛。
- `s-abbaabdf6ef11ecc9ca5-1` → `s-23ff194448bd003dd530-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:106-107 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:13-14 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-66 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-75 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:67-75 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:98-107
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（個人IB）他行宛。同一店内・当行本支店宛は無料 【列】3万円未満 【値】165円
- `s-9a1e96cbda2135bbb28e-1` → `s-9f474cbda83fa9a95561-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:106-107 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:13-14 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-66 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-75 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:67-75 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:98-107
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（個人IB）他行宛。同一店内・当行本支店宛は無料 【列】3万円以上 【値】330円
- `s-de28b29a05f830619131-1` → `s-c3294c6f09f701010190-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:106-107 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:13-14 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-66 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-75 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:67-75 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:98-107
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（個人IB）他行宛。同一店内・当行本支店宛は無料 【列】区分 【値】境界あり
- `s-dbfa3c7bf9f5f684e779-1` → `s-cba9b2e0f27badc56595-1` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:11-18 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:23-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:36-41
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（法人）他行宛。通常料金（振込料金とくとく会員の99円を除く） 【列】区分 【値】定額
- `s-b0e4d94aa4b987665d7d-1` → `s-eecb8dfc7aaa803fa603-1` / high / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:11-18 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:23-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:36-41
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（法人）他行宛。通常料金（振込料金とくとく会員の99円を除く） 【列】3万円未満 【値】100円
- `s-c2dc4eb55486061fe8a7-1` → `s-fc5721bec24957bbe0fe-1` / high / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:11-18 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:23-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:36-41
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（法人）他行宛。通常料金（振込料金とくとく会員の99円を除く） 【列】3万円以上 【値】100円
- `s-dae295d007afa12d57ff-1` → `s-4a86c058a98847a2eea5-1` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:14-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:33-41
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常料金（振込料金とくとく会員の99円を除く）
- `s-b3077a92f2cd90316811-1` → `s-cc831a116f7585f7855b-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27 ; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:23-23
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）2026年10月1日以後受付の他行宛の通常振込。
- `s-7b7a59c24819946d116a-1` → `s-84698f0aa0e447954b98-1` / high / 根拠: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:13-27 ; corpus/www_netbk_co_jp_contents_hojin_charge.txt:17-23
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）2026年10月1日以後受付の他行宛の通常振込。総合振込・提携サービスを除く。予約は受付日時点の料金 【列】3万円未満 【値】100円
- `s-514683a8646dc8f18693-1` → `s-dba3b757a83c12ce516f-1` / high / 根拠: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:13-27 ; corpus/www_netbk_co_jp_contents_hojin_charge.txt:17-23
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）2026年10月1日以後受付の他行宛の通常振込。総合振込・提携サービスを除く。予約は受付日時点の料金 【列】3万円以上 【値】100円
- `s-752b1abf6783b8ae61b4-1` → `s-3fa3e611aebbbba6af7d-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27 ; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:23-23
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）2026年10月1日以後受付の他行宛の通常振込。総合振込・提携サービスを除く。予約は受付日時点の料金 【列】区分 【値】定額
- `s-01c347da58c70b6a8cf2-1` → `s-143664daebbeaa7f079b-1` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ラクスルバンク（法人）GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料）
- `s-49b73c94fc4e47f6a54d-1` → `s-5023399dadae193322ec-1` / high / 根拠: corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:57-65
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ラクスルバンク（法人）GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料） 【列】3万円未満 【値】119円
- `s-f1baa77f1e9e93e582fd-1` → `s-b8f40a4a1cacd0cac792-1` / high / 根拠: corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:57-65
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ラクスルバンク（法人）GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料） 【列】3万円以上 【値】119円
- `s-04aa9c4ed4b99b3a69dc-1` → `s-5d9212c74ad3a15d7c10-1` / 同論点の別出現 / 根拠: corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:57-67 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:58-63 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:64-65 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:66-67
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ラクスルバンク（法人）GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料） 【列】区分 【値】定額
- `s-f230505c540b8854d801-1` → `s-7993e42a712501e0e51b-1` / 同論点の別出現 / 根拠: corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:14-21 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:22-40 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:3-21 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-13
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常料金（残高優遇・口座開設特典の無料回数を除く）
- `s-b3ff30fdf0847d982353-1` → `s-fed3ad95a05147ed6d44-1` / high / 根拠: corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-21
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（法人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・口座開設特典の無料回数を除く） 【列】3万円未満 【値】145円
- `s-1a9d949f30fa0675d318-1` → `s-d42c8d9848c376a01599-1` / high / 根拠: corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-21
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（法人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・口座開設特典の無料回数を除く） 【列】3万円以上 【値】145円
- `s-38034d387cfdbf5ef29b-1` → `s-3429ceebb8fd3d5871b0-1` / 同論点の別出現 / 根拠: corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:14-21 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:22-40 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:3-21 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-13
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（法人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・口座開設特典の無料回数を除く） 【列】区分 【値】定額
- `s-a0b62f71d2d28aee3e8d-1` → `s-1980850d978839b0fec7-1` / 同論点の別出現 / 根拠: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:182-182 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:53-73 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:74-100,182-183,193-194 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:80-98 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:84-90
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常振込・総合振込（給与振込の他行宛110円を除く、総合・給与振込は依頼データ件数で課金し、不成立分も課金）。
- `s-711aba5b76a682ff227b-1` → `s-e3913a1a99921cfeb7bc-1` / high / 根拠: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:77-98
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（法人・Bizダイレクト）他金融機関宛。通常振込・総合振込（給与振込の他行宛110円を除く、総合・給与振込は依頼データ件数で課金し、不成立分も課金）。ゆうちょBizダイレクトでは非居住者関連の送金は取扱なし、取引時確認が済んでいない口座からの10万円を超える送金も取扱不可 【列】3万円未満 【値】165円
- `s-3f55024f1ef553ea58cf-1` → `s-eea6224a8bc04113e522-1` / high / 根拠: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:77-98
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（法人・Bizダイレクト）他金融機関宛。通常振込・総合振込（給与振込の他行宛110円を除く、総合・給与振込は依頼データ件数で課金し、不成立分も課金）。ゆうちょBizダイレクトでは非居住者関連の送金は取扱なし、取引時確認が済んでいない口座からの10万円を超える送金も取扱不可 【列】3万円以上 【値】165円
- `s-ffd16032751647039f9a-1` → `s-e46a8599dc51a9fef8dc-1` / 同論点の別出現 / 根拠: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:182-182 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:53-73 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:74-100,182-183,193-194 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:80-98 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:84-90
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（法人・Bizダイレクト）他金融機関宛。通常振込・総合振込（給与振込の他行宛110円を除く、総合・給与振込は依頼データ件数で課金し、不成立分も課金）。ゆうちょBizダイレクトでは非居住者関連の送金は取扱なし、取引時確認が済んでいない口座からの10万円を超える送金も取扱不可 【列】区分 【値】定額
- `s-6ae05611bfa58490ef73-1` → `s-731953ea676fe6577e3c-1` / 同論点の別出現 / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:104-112 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:166-182 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:189-206 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-103 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112,166-182
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 楽天銀行（法人・ビジネス口座）他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税）
- `s-fb4e8b2ae9282fbfa86b-1` → `s-4459eb101b2bf38f7345-1` / high / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（法人・ビジネス口座）他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税） 【列】3万円未満 【値】150円
- `s-ea8cac135b698e4341b5-1` → `s-c28009ce676c6ffecf00-1` / high / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（法人・ビジネス口座）他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税） 【列】3万円以上 【値】229円
- `s-0a9d2ac3c037ff16539a-1` → `s-c1c6f24c68adf3d5a936-1` / high / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（法人・ビジネス口座）他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税） 【列】区分 【値】境界あり
- `s-bb42bb116716bc21e610-1` → `s-5cdb36bbb6c149306a41-1` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 千葉銀行（法人・Web-EB）他行宛電信扱。
- `s-14b37ff2fe07bb0eca85-1` → `s-815bd01c7e8f134c1d13-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-100
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（法人・Web-EB）他行宛電信扱。同一店内無料、当行本支店宛は3万円未満110円・3万円以上330円 【列】3万円未満 【値】385円
- `s-a2ee8eaac2ca28bba912-1` → `s-9a6f6cd613acc3e63732-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-100
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（法人・Web-EB）他行宛電信扱。同一店内無料、当行本支店宛は3万円未満110円・3万円以上330円 【列】3万円以上 【値】550円
- `s-68c0839dd352453ecb56-1` → `s-896e3ff6a7be1c02247f-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:76-100
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（法人・Web-EB）他行宛電信扱。同一店内無料、当行本支店宛は3万円未満110円・3万円以上330円 【列】区分 【値】境界あり
- `s-88dc68eea11a7cf110c6-1` → `s-353b3f442570cc384680-1` / 同論点の別出現 / 根拠: corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:12-30 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:31-34 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:35-36 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:37-82 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:5-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常振込（振込訂正・組戻サービスの再振込は金額不問550円）
- `s-ac5947e0ffb81e412573-1` → `s-188bce2b70620f3f66b0-1` / high / 根拠: corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（法人・EB）他行宛。通常振込（振込訂正・組戻サービスの再振込は金額不問550円） 【列】3万円未満 【値】385円
- `s-289d1d32075eb6ba7b1b-1` → `s-75fff7c75afc4a487c8c-1` / high / 根拠: corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（法人・EB）他行宛。通常振込（振込訂正・組戻サービスの再振込は金額不問550円） 【列】3万円以上 【値】550円
- `s-876f9389853bbfeaaebc-1` → `s-ca09d6695b9e577b32e2-1` / high / 根拠: corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:16-21 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:35-36 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:9-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（法人・EB）他行宛。通常振込（振込訂正・組戻サービスの再振込は金額不問550円） 【列】区分 【値】境界あり
- `s-b1d262f64b305cb29388-1` → `s-5ea1b575b906e93aa1d3-1` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三菱UFJ銀行（法人・BizSTATION）他行宛。
- `s-9809d06f1d0e49f6f6e3-1` → `s-232493aa11c32e6511a2-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-211 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:199-200 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:201-206 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:224-230
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛。当行宛は3万円未満110円・3万円以上330円 【列】3万円未満 【値】484円
- `s-2916a00eccf59bd24c35-1` → `s-f5c083a5f57c251d90bf-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-211 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:199-200 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:201-206 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:224-230
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛。当行宛は3万円未満110円・3万円以上330円 【列】3万円以上 【値】660円
- `s-07930c75103a84757e2f-1` → `s-04b394baac802be13a0e-1` / 同論点の別出現 / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:199-206 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:208-230
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛。当行宛は3万円未満110円・3万円以上330円 【列】区分 【値】境界あり
- `s-7dc0b21ec3f32a820959-1` → `s-a190c7abbf66d14d6a01-1` / 同論点の別出現 / 根拠: corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-79 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:70-73 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:74-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛。給与振込（EB）は別料金（他行あて330円） 【列】区分 【値】境界あり
- `s-96c0eeb1c4dee5b556bb-1` → `s-167dd6041d2d8f3e1fe9-1` / high / 根拠: corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:13-61 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:34-79 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:59-61 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:70-71 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:9-21
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛。給与振込（EB）は別料金（他行あて330円） 【列】3万円未満 【値】495円
- `s-75b20a692cb4fe3323d7-1` → `s-e0f114f770bc8b920761-1` / high / 根拠: corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:13-61 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:34-79 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:59-61 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:70-71 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:9-21
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛。給与振込（EB）は別料金（他行あて330円） 【列】3万円以上 【値】660円
- `s-2f86c5b863563d8d22f0-1` → `s-518329f760dd28113a88-1` / 同論点の別出現 / 根拠: corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:19-61 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:30-73 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:34-79 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:76-79 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:9-21
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三井住友銀行（法人・Web21エキスパート等）他行宛。
- `s-d577f55e0a772b0b0107-1` → `s-472dd9107e47eefc964f-1` / high / 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-61 ; corpus/gmo_aozora_com_contents_fee_html.txt:43-50 ; corpus/gmo_aozora_com_contents_fee_html.txt:47-50 ; corpus/gmo_aozora_com_contents_fee_html.txt:53-55
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】75円 【列】この金額になる区分 【値】GMOあおぞらネット銀行（個人）【他行宛。カスタマーステージの無料回数以降】（金額不問）
- `s-8241bcc942f814d8c1b8-1` → `s-76569f43606f4ed90da2-1` / high / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:22-48
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】77円 【列】この金額になる区分 【値】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）【当社・三井住友信託銀行あて0円／それ以外の金融機関宛は無料回数以降。BaaS・提携サービスは条件が異なる場合あり】（金額不問）
- `s-01399846ccca455af702-1` → `s-c7cb85881c0d2c982afe-1` / high / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-28 ; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:13-27 ; corpus/www_netbk_co_jp_contents_hojin_charge.txt:17-23
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】100円 【列】この金額になる区分 【値】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）【2026年10月1日以後受付の他行宛の通常振込。総合振込・提携サービスを除く。予約は受付日時点の料金】（金額不問）GMOあおぞらネット銀行（法人）【他行宛。通常料金（振込料金とくとく会員の99円を除く）】（金額不問）
- `s-de03c22539d69f19d3d6-1` → `s-92ddb25a5268aaf897b1-1` / high / 根拠: corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:57-67 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:58-65
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】119円 【列】この金額になる区分 【値】ラクスルバンク（法人）【GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料）】（金額不問）
- `s-bb4de4adcc05d9648d90-1` → `s-31250b9b3c0fd5e97909-1` / high / 根拠: corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-21 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28 ; corpus/www_rakuten_bank_co_jp_charge.txt:48-64
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】145円 【列】この金額になる区分 【値】PayPay銀行（個人）【インターネットバンキングの他金融機関宛。通常料金（残高優遇・給与受取の月3回無料を除く）。カナ同一名義の個人の三井住友銀行口座あては振込・振込予約・自動振込が無料（その他サービス・来店は対象外）】（金額不問）PayPay銀行（法人）【インターネットバンキングの他金融機関宛。通常料金（残高優遇・口座開設特典の無料回数を除く）】（金額不問）楽天銀行（個人）【他金融機関宛。通常振込・振込予約の無料回数がない場合】（金額不問）
- `s-0de0e06c791e6986dc33-1` → `s-e5f40ef372c89313fd57-1` / high / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112,166-182
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】150円 【列】この金額になる区分 【値】楽天銀行（法人・ビジネス口座）【他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税）】（3万円未満）
- `s-0c2ed5083b75f235abc5-1` → `s-bd45da3191148f3718c9-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:17-26,94-106
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】154円 【列】この金額になる区分 【値】三菱UFJ銀行（個人・三菱UFJダイレクト）【他行宛。メインバンク プラスの無料優遇適用外。三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円】（3万円未満）三井住友銀行（個人・SMBCダイレクト）【他行宛。Oliveの無料回数適用外。所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（口座設定・メンテナンス時間・名義の文字や符号等により有料の場合あり）】（3万円未満）横浜銀行（個人IB）【他行宛。ゼロ手数料の無料回数適用外】（3万円未満）
- `s-9f51a0c49b68e402826d-1` → `s-d893904eca03a5a8677b-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-100
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】165円 【列】この金額になる区分 【値】りそな銀行（個人・マイゲート）【スタンダード・パール。りそな・埼玉りそな・関西みらい・みなと銀行あてを除く】（金額不問）埼玉りそな銀行（個人・マイゲート）【スタンダード・パール。りそな・埼玉りそな・関西みらい・みなと銀行あてを除く】（金額不問）ゆうちょ銀行（個人・ゆうちょダイレクト）【他金融機関宛。非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ。ゆうちょダイレクトでは取引時確認が済んでいない口座からの10万円を超える送金は取扱不可】（金額不問）ゆうちょ銀行（法人・Bizダイレクト）【他金融機関宛。通常振込・総合振込（給与振込の他行宛110円を除く、総合・給与振込は依頼データ件数で課金し、不成立分も課金）。ゆうちょBizダイレクトでは非居住者関連の送金は取扱なし、取引時確認が済んでいない口座からの10万円を超える送金も取扱不可】（金額不問）千葉銀行（個人IB）【他行宛。同一店内・当行本支店宛は無料】（3万円未満）
- `s-94f6c6154eac2d06d8f0-1` → `s-40dde07f8e3e2399b727-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:17-26,94-106
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】220円 【列】この金額になる区分 【値】三菱UFJ銀行（個人・三菱UFJダイレクト）【他行宛。メインバンク プラスの無料優遇適用外。三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円】（3万円以上）三井住友銀行（個人・SMBCダイレクト）【他行宛。Oliveの無料回数適用外。所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（口座設定・メンテナンス時間・名義の文字や符号等により有料の場合あり）】（3万円以上）福岡銀行（個人IB）【国内本支店あての電信振込。福岡・熊本・十八親和・福岡中央・みんなの銀行あては無料】（3万円未満）
- `s-e0e9dc371db80ba4c65e-1` → `s-2df26e86b79019439fb3-1` / high / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112,166-182
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】229円 【列】この金額になる区分 【値】楽天銀行（法人・ビジネス口座）【他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税）】（3万円以上）
- `s-53438d0427f54301f509-1` → `s-ed3a86a92f991346242b-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-100
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】330円 【列】この金額になる区分 【値】千葉銀行（個人IB）【他行宛。同一店内・当行本支店宛は無料】（3万円以上）福岡銀行（法人・ビジネスバンキングWeb）【福岡・熊本・十八親和・福岡中央・みんなの銀行本支店あては3万円未満55円・3万円以上110円、同一店内無料】（3万円未満）
- `s-d7de1eca5be9c5e36872-1` → `s-6e7fc2db46f8927654d8-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:76-106 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】385円 【列】この金額になる区分 【値】横浜銀行（法人・EB）【他行宛。通常振込（振込訂正・組戻サービスの再振込は金額不問550円）】（3万円未満）千葉銀行（法人・Web-EB）【他行宛電信扱。同一店内無料、当行本支店宛は3万円未満110円・3万円以上330円】（3万円未満）
- `s-ab838cafdf34b800b208-1` → `s-21935419b11a5b7c34a6-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:76-106 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】484円 【列】この金額になる区分 【値】三菱UFJ銀行（法人・BizSTATION）【他行宛。当行宛は3万円未満110円・3万円以上330円】（3万円未満）
- `s-48b60234283b3a44150b-1` → `s-6d948a494e928fe1289f-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:76-106 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】495円 【列】この金額になる区分 【値】三井住友銀行（法人・Web21エキスパート等）【他行宛。給与振込（EB）は別料金（他行あて330円）】（3万円未満）
- `s-8fdc9b3d4ce3655375e6-1` → `s-be7a5d81d7e59026c8cc-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:76-106 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】550円 【列】この金額になる区分 【値】横浜銀行（法人・EB）【他行宛。通常振込（振込訂正・組戻サービスの再振込は金額不問550円）】（3万円以上）千葉銀行（法人・Web-EB）【他行宛電信扱。同一店内無料、当行本支店宛は3万円未満110円・3万円以上330円】（3万円以上）福岡銀行（法人・ビジネスバンキングWeb）【福岡・熊本・十八親和・福岡中央・みんなの銀行本支店あては3万円未満55円・3万円以上110円、同一店内無料】（3万円以上）
- `s-449d872dae86e97032f2-1` → `s-01550aa63d05c8ab0152-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:76-106 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】660円 【列】この金額になる区分 【値】みずほ銀行（法人・EB）【みずほ信託銀行あてを除く】（3万円以上）三菱UFJ銀行（法人・BizSTATION）【他行宛。当行宛は3万円未満110円・3万円以上330円】（3万円以上）三井住友銀行（法人・Web21エキスパート等）【他行宛。給与振込（EB）は別料金（他行あて330円）】（3万円以上）
- `s-cd090d9c8561816e9539-2` → `s-4064373188d3e47353ca-2` / high / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:22-48
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）当社・三井住友信託銀行あて0円／それ以外の金融機関宛は無料回数以降。BaaS・提携サービスは条件が異なる場合あり 【列】3万円未満 【値】77円
- `s-cc52c599f0283a1faef2-2` → `s-737a7819229ddb24aa4b-2` / high / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:22-48
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）当社・三井住友信託銀行あて0円／それ以外の金融機関宛は無料回数以降。BaaS・提携サービスは条件が異なる場合あり 【列】3万円以上 【値】77円
- `s-b3077a92f2cd90316811-2` → `s-cc831a116f7585f7855b-2` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27 ; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:24-24 ; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:25-27
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）2026年10月1日以後受付の他行宛の通常振込。
- `s-7b7a59c24819946d116a-2` → `s-84698f0aa0e447954b98-2` / high / 根拠: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:13-27 ; corpus/www_netbk_co_jp_contents_hojin_charge.txt:17-23
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）2026年10月1日以後受付の他行宛の通常振込。総合振込・提携サービスを除く。予約は受付日時点の料金 【列】3万円未満 【値】100円
- `s-514683a8646dc8f18693-2` → `s-dba3b757a83c12ce516f-2` / high / 根拠: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:13-27 ; corpus/www_netbk_co_jp_contents_hojin_charge.txt:17-23
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）2026年10月1日以後受付の他行宛の通常振込。総合振込・提携サービスを除く。予約は受付日時点の料金 【列】3万円以上 【値】100円
- `s-a68b0177c8c510c2c5e9-2` → `s-3f3e9165074f9313b014-2` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-61 ; corpus/gmo_aozora_com_contents_fee_html.txt:47-50 ; corpus/gmo_aozora_com_contents_fee_html.txt:53
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（個人）他行宛。カスタマーステージの無料回数以降 【列】3万円未満 【値】75円
- `s-ff4cc5567329f8d2efc8-2` → `s-9f815b81daa66ee59b07-2` / high / 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-53
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（個人）他行宛。カスタマーステージの無料回数以降 【列】3万円以上 【値】75円
- `s-d87322ed923cd6e32d9d-2` → `s-fc5721bec24957bbe0fe-2` / high / 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-53
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（法人）他行宛。通常料金（振込料金とくとく会員の99円を除く） 【列】3万円以上 【値】100円
- `s-dbfa3c7bf9f5f684e779-2` → `s-eecb8dfc7aaa803fa603-2` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:36-41
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（法人）他行宛。通常料金（振込料金とくとく会員の99円を除く） 【列】3万円未満 【値】100円
- `s-b0e4d94aa4b987665d7d-2` → `s-4a86c058a98847a2eea5-2` / high / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-18 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:14-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:36-41
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常料金（振込料金とくとく会員の99円を除く）
- `s-c2dc4eb55486061fe8a7-2` → `s-f6cc1cece33000c10a50-2` / high / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-18 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:14-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:36-41
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / GMOあおぞらネット銀行（法人）他行宛。
- `s-01c347da58c70b6a8cf2-2` → `s-143664daebbeaa7f079b-2` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ラクスルバンク（法人）GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料）
- `s-49b73c94fc4e47f6a54d-2` → `s-5023399dadae193322ec-2` / high / 根拠: corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:57-67 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:58-62 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:63-63 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:64-65 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:66-67
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ラクスルバンク（法人）GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料） 【列】3万円未満 【値】119円
- `s-f1baa77f1e9e93e582fd-2` → `s-b8f40a4a1cacd0cac792-2` / high / 根拠: corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:57-67 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:58-62 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:63-63 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:64-65 ; corpus/support_raksulbank_com_faq_show_103_category_id_31_site_domain_default.txt:66-67
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ラクスルバンク（法人）GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料） 【列】3万円以上 【値】119円
- `s-76f13ee1986ce50c003a-2` → `s-52c5b18b3ddd9c1ea0fb-2` / 同論点の別出現 / 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:21-26 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常料金（残高優遇・給与受取の月3回無料を除く）。
- `s-7878aee8298201af18fc-2` → `s-7613d6066972da9e1903-2` / high / 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:21-26 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-13 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（個人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・給与受取の月3回無料を除く）。カナ同一名義の個人の三井住友銀行口座あては振込・振込予約・自動振込が無料（その他サービス・来店は対象外） 【列】3万円未満 【値】145円
- `s-b4d9b50efb5bcd224e3f-2` → `s-7bc471ad8e269227aaf1-2` / high / 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:14-17 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:21-26 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-13 ; corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（個人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・給与受取の月3回無料を除く）。カナ同一名義の個人の三井住友銀行口座あては振込・振込予約・自動振込が無料（その他サービス・来店は対象外） 【列】3万円以上 【値】145円
- `s-f230505c540b8854d801-2` → `s-7993e42a712501e0e51b-2` / 同論点の別出現 / 根拠: corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:15-21 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-13
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常料金（残高優遇・口座開設特典の無料回数を除く）
- `s-b3ff30fdf0847d982353-2` → `s-fed3ad95a05147ed6d44-2` / high / 根拠: corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:15-21 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-13 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-21
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（法人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・口座開設特典の無料回数を除く） 【列】3万円未満 【値】145円
- `s-1a9d949f30fa0675d318-2` → `s-d42c8d9848c376a01599-2` / high / 根拠: corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:15-21 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-13 ; corpus/www_paypay_bank_co_jp_business_fee_transfer_html.txt:6-21
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】PayPay銀行（法人）インターネットバンキングの他金融機関宛。通常料金（残高優遇・口座開設特典の無料回数を除く） 【列】3万円以上 【値】145円
- `s-a13f51fd98eaa4a4e26c-1` → `s-d44ed78405530e529318-1` / high / 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:18-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / PayPay銀行の個人口座から、カナ口座名義が同一の個人の三井住友銀行口座あては、振込・振込予約・自動振込サービスが無料です。
- `s-f531acf5b44571eeb6b0-2` → `s-2e6daefc78fec380cc0a-2` / 同論点の別出現 / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:40-43 ; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:42-43
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ゆうちょ銀行（個人・ゆうちょダイレクト）他金融機関宛。
- `s-ad550281eae2ffb2a38d-2` → `s-3cceee6e8aed7375e56b-2` / high / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-43 ; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:42-43
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（個人・ゆうちょダイレクト）他金融機関宛。非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ。ゆうちょダイレクトでは取引時確認が済んでいない口座からの10万円を超える送金は取扱不可 【列】3万円未満 【値】165円
- `s-cfbe95e2bab23c51a274-2` → `s-8801d049c0a7e8857f96-2` / high / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:34-43 ; corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:42-43
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（個人・ゆうちょダイレクト）他金融機関宛。非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ。ゆうちょダイレクトでは取引時確認が済んでいない口座からの10万円を超える送金は取扱不可 【列】3万円以上 【値】165円
- `s-a0b62f71d2d28aee3e8d-2` → `s-1980850d978839b0fec7-2` / 同論点の別出現 / 根拠: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:182-182 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:77-98 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:80-98 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:93-98
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常振込・総合振込（給与振込の他行宛110円を除く、総合・給与振込は依頼データ件数で課金し、不成立分も課金）。
- `s-711aba5b76a682ff227b-2` → `s-e3913a1a99921cfeb7bc-2` / high / 根拠: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:182-182 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:77-98 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:93-98
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（法人・Bizダイレクト）他金融機関宛。通常振込・総合振込（給与振込の他行宛110円を除く、総合・給与振込は依頼データ件数で課金し、不成立分も課金）。ゆうちょBizダイレクトでは非居住者関連の送金は取扱なし、取引時確認が済んでいない口座からの10万円を超える送金も取扱不可 【列】3万円未満 【値】165円
- `s-3f55024f1ef553ea58cf-2` → `s-eea6224a8bc04113e522-2` / high / 根拠: corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:182-182 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:77-98 ; corpus/www_jp_bank_japanpost_jp_hojin_smart_bizdirect_hj_smt_bd_ryokin_html.txt:93-98
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】ゆうちょ銀行（法人・Bizダイレクト）他金融機関宛。通常振込・総合振込（給与振込の他行宛110円を除く、総合・給与振込は依頼データ件数で課金し、不成立分も課金）。ゆうちょBizダイレクトでは非居住者関連の送金は取扱なし、取引時確認が済んでいない口座からの10万円を超える送金も取扱不可 【列】3万円以上 【値】165円
- `s-6fcd8dcf2f796361968c-2` → `s-eca6cf08f7bddf0e39e0-2` / 同論点の別出現 / 根拠: corpus/www_rakuten_bank_co_jp_charge.txt:48-56 ; corpus/www_rakuten_bank_co_jp_charge.txt:48-65 ; corpus/www_rakuten_bank_co_jp_charge.txt:92-95
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常振込・振込予約の無料回数がない場合
- `s-4c3eff5f117fab0377ce-2` → `s-a1c1a4cd7ce1d2eb4535-2` / high / 根拠: corpus/www_rakuten_bank_co_jp_charge.txt:48-56 ; corpus/www_rakuten_bank_co_jp_charge.txt:48-65 ; corpus/www_rakuten_bank_co_jp_charge.txt:49-56 ; corpus/www_rakuten_bank_co_jp_charge.txt:92-95
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（個人）他金融機関宛。通常振込・振込予約の無料回数がない場合 【列】3万円未満 【値】145円
- `s-2de3390af081b431716e-2` → `s-24fa2d95d4ea88c1b2fc-2` / high / 根拠: corpus/www_rakuten_bank_co_jp_charge.txt:48-56 ; corpus/www_rakuten_bank_co_jp_charge.txt:48-65 ; corpus/www_rakuten_bank_co_jp_charge.txt:49-56 ; corpus/www_rakuten_bank_co_jp_charge.txt:92-95
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（個人）他金融機関宛。通常振込・振込予約の無料回数がない場合 【列】3万円以上 【値】145円
- `s-6ae05611bfa58490ef73-2` → `s-731953ea676fe6577e3c-2` / 同論点の別出現 / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:166-182 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:178-179 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:189-206
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 楽天銀行（法人・ビジネス口座）他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税）
- `s-fb4e8b2ae9282fbfa86b-2` → `s-4459eb101b2bf38f7345-2` / high / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:166-182 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:178-179 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:189-206 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:96-103
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（法人・ビジネス口座）他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税） 【列】3万円未満 【値】150円
- `s-ea8cac135b698e4341b5-2` → `s-c28009ce676c6ffecf00-2` / high / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:166-182 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:178-179 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:189-206 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112 ; corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:96-103
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】楽天銀行（法人・ビジネス口座）他行宛の基本振込の料金、給与・賞与は金額不問で他行あて1件のみ229円、複数件は税抜209円×依頼件数に消費税（楽天銀行あて1件のみ52円、複数件は税抜48円×件数に消費税） 【列】3万円以上 【値】229円
- `s-007a95f66459db3c81a5-2` → `s-c950b79acaad0851423e-2` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ゼロ手数料の無料回数適用外
- `s-473fa352fd09148222e1-2` → `s-3d1aab1143502aeecd78-2` / high / 根拠: corpus/www_boy_co_jp_fee_furikomi_html.txt:12-25 ; corpus/www_boy_co_jp_fee_furikomi_html.txt:13-23
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（個人IB）他行宛。ゼロ手数料の無料回数適用外 【列】3万円未満 【値】154円
- `s-4343b567b9b5a6d2f499-2` → `s-723688fa07a60ea38188-2` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（個人IB）他行宛。ゼロ手数料の無料回数適用外 【列】3万円以上 【値】未確認
- `s-88dc68eea11a7cf110c6-2` → `s-353b3f442570cc384680-2` / 同論点の別出現 / 根拠: corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:14-30 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:35-36 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常振込（振込訂正・組戻サービスの再振込は金額不問550円）
- `s-ac5947e0ffb81e412573-2` → `s-188bce2b70620f3f66b0-2` / high / 根拠: corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:12-13 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:14-30 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:35-36 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（法人・EB）他行宛。通常振込（振込訂正・組戻サービスの再振込は金額不問550円） 【列】3万円未満 【値】385円
- `s-289d1d32075eb6ba7b1b-2` → `s-75fff7c75afc4a487c8c-2` / high / 根拠: corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:12-13 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:14-30 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:35-36 ; corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:6-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】横浜銀行（法人・EB）他行宛。通常振込（振込訂正・組戻サービスの再振込は金額不問550円） 【列】3万円以上 【値】550円
- `s-57cc5d419c1101edc235-2` → `s-bb46aba84a366d7326ff-2` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 千葉銀行（個人IB）他行宛。
- `s-abbaabdf6ef11ecc9ca5-2` → `s-23ff194448bd003dd530-2` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:106-107 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-106 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-99 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:67-86
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（個人IB）他行宛。同一店内・当行本支店宛は無料 【列】3万円未満 【値】165円
- `s-9a1e96cbda2135bbb28e-2` → `s-9f474cbda83fa9a95561-2` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:106-107 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-106 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-99 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:67-86
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（個人IB）他行宛。同一店内・当行本支店宛は無料 【列】3万円以上 【値】330円
- `s-bb42bb116716bc21e610-2` → `s-5cdb36bbb6c149306a41-2` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 千葉銀行（法人・Web-EB）他行宛電信扱。
- `s-14b37ff2fe07bb0eca85-2` → `s-815bd01c7e8f134c1d13-2` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:106-107 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-106 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-99 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:67-86
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（法人・Web-EB）他行宛電信扱。同一店内無料、当行本支店宛は3万円未満110円・3万円以上330円 【列】3万円未満 【値】385円
- `s-a2ee8eaac2ca28bba912-2` → `s-9a6f6cd613acc3e63732-2` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:106-107 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-106 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-99 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:67-86
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】千葉銀行（法人・Web-EB）他行宛電信扱。同一店内無料、当行本支店宛は3万円未満110円・3万円以上330円 【列】3万円以上 【値】550円
- `s-b569734808f08ae5a450-1` → `s-41b6cafd854e63dbec8f-1` / 同論点の別出現 / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:106-107 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-100 ; corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-99
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 上表の対象サービス・通常単価で、無料・別料金の宛先と優遇を除いて比べた他行宛ネット振込の3万円以上では、法人は個人の約1.7倍（330円→550円）。
- `s-7c45983ec9b3af091d4b-2` → `s-141e5c31775abc2c1608-2` / 同論点の別出現 / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:127-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三菱UFJ銀行（個人・三菱UFJダイレクト）他行宛。
- `s-56661a159b9ecede2a14-2` → `s-02f1fad96ee3c19b4dd8-2` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:128-128 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:129-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26,128-128 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:18-23 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人・三菱UFJダイレクト）他行宛。メインバンク プラスの無料優遇適用外。三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円 【列】3万円未満 【値】154円
- `s-85ff9ebc71b071a6fdd9-2` → `s-11b00da0f9b0000e5af1-2` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:128-128 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:129-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26,128-128 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:18-23 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:24-26
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人・三菱UFJダイレクト）他行宛。メインバンク プラスの無料優遇適用外。三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円 【列】3万円以上 【値】220円
- `s-b1d262f64b305cb29388-2` → `s-5ea1b575b906e93aa1d3-2` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三菱UFJ銀行（法人・BizSTATION）他行宛。
- `s-9809d06f1d0e49f6f6e3-2` → `s-232493aa11c32e6511a2-2` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-211 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:201-206 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:208-230
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛。当行宛は3万円未満110円・3万円以上330円 【列】3万円未満 【値】484円
- `s-2916a00eccf59bd24c35-2` → `s-f5c083a5f57c251d90bf-2` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-211 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:201-206 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:208-230
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛。当行宛は3万円未満110円・3万円以上330円 【列】3万円以上 【値】660円
- `s-9b90cab87b6e968d7124-2` → `s-f9eeb7a2ad9934cf4f58-2` / 同論点の別出現 / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:177-179 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:184-186 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-106,184-186
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三井住友銀行（個人・SMBCダイレクト）他行宛。
- `s-769966d143f6874aecf4-2` → `s-ac9659eae6031153dd18-2` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-23 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-23,94-106,177-186 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:179-184 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:180-180
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人・SMBCダイレクト）他行宛。Oliveの無料回数適用外。所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（口座設定・メンテナンス時間・名義の文字や符号等により有料の場合あり） 【列】3万円未満 【値】154円
- `s-75de2d37c9686d4a1fa7-2` → `s-2523f7468af9d8e99426-2` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-23 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-23,94-106,177-186 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:179-184 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:180-180
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人・SMBCダイレクト）他行宛。Oliveの無料回数適用外。所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（口座設定・メンテナンス時間・名義の文字や符号等により有料の場合あり） 【列】3万円以上 【値】220円
- `s-7dc0b21ec3f32a820959-2` → `s-167dd6041d2d8f3e1fe9-2` / 同論点の別出現 / 根拠: corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:54-73 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:56-58 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:59-71 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:72-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛。給与振込（EB）は別料金（他行あて330円） 【列】3万円未満 【値】495円
- `s-96c0eeb1c4dee5b556bb-2` → `s-e0f114f770bc8b920761-2` / high / 根拠: corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:13-21 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:56-58 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:59-71 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:9-21,34-41,54-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛。給与振込（EB）は別料金（他行あて330円） 【列】3万円以上 【値】660円
- `s-75b20a692cb4fe3323d7-2` → `s-518329f760dd28113a88-2` / high / 根拠: corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:13-21 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:56-58 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:59-71 ; corpus/www_smbc_co_jp_hojin_fee_furikomi_html.txt:9-21,34-41,54-79
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三井住友銀行（法人・Web21エキスパート等）他行宛。
- `s-dbfa3c7bf9f5f684e779-3` → `s-a9d1a324b76b77a3b7af-1` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-18 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:14-28 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:36-41
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（法人）他行宛。通常料金（振込料金とくとく会員の99円を除く） 【列】1件あたり 【値】100円
- `s-fc2e5b885f46d84187e5-1` → `s-cdae390904e801504e5d-1` / high / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】GMOあおぞらネット銀行（法人）他行宛。通常料金（振込料金とくとく会員の99円を除く） 【列】年120件の手数料 【値】12,000円
- `s-d1b1741a271aa9500c80-1` → `s-eca9d25bae633b83bc66-1` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。
- `s-5e70c810934b1538ecb5-1` → `s-e1c3f21d9baabf154cc3-1` / 同論点の別出現 / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:128-128 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:150-164 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:68-82 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:77-82
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。二額は3万円未満／3万円以上 【列】ATM（現金） 【値】880円現金は10万円以下。ATM利用料は別途の場合あり
- `s-4092d8a84ee845772882-1` → `s-ad2ecbddf3b7a374d511-1` / 同論点の別出現 / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:126-132 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:165-174 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:83-92
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。二額は3万円未満／3万円以上 【列】窓口 【値】990円
- `s-f7d23231d465cb05383a-1` → `s-f042f2ec89f5f51f9235-1` / 同論点の別出現 / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:167-167
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 二額は3万円未満／3万円以上本人確認未了では振込できない場合あり
- `s-df9158e49d6087235890-1` → `s-bdc2c48550d8cf3062a5-1` / 同論点の別出現 / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:110-112 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:167-167 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:171-173
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人）ネットはSMBCダイレクト。二額は3万円未満／3万円以上本人確認未了では振込できない場合あり 【列】ATM（現金） 【値】880円
- `s-d1b1741a271aa9500c80-2` → `s-eca9d25bae633b83bc66-2` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。
- `s-2163ea3e7fdd3fe76e24-1` → `s-ad168e7c69c96676d197-1` / 同論点の別出現 / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:165-174 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:83-92
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。二額は3万円未満／3万円以上 【列】窓口 【値】880円
- `s-f7d23231d465cb05383a-2` → `s-f042f2ec89f5f51f9235-2` / 同論点の別出現 / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-188 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:167-167
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 二額は3万円未満／3万円以上本人確認未了では振込できない場合あり
- `s-e798c63f6e3a5740b1e4-1` → `s-70c9b292f221360be39d-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-17 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:40-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:41-47 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:46-46
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / li / 個人のドコモSMTBネット銀行は（BaaS・提携サービスは条件が異なる場合があります）、当社・三井住友信託銀行以外への振込にもスマプロランクに応じた無料回数があります。
- `s-7f069b4d7f6046012971-1` → `s-3484b799deb16b94eb64-1` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:14-28 ; corpus/gmo_aozora_com_contents_fee_html.txt:42-53 ; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:196-206 ; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27 ; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:20-24 ; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:25
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / li / 料金を照合できた掲載ネット振込は、各表の宛先・サービス条件でSMTB個人のBaaS・提携サービスと非居住者の別料金を除く個人75円〜440円／法人100円〜660円（税込・SMTB法人は2026年10月1日以後受付の通常振込で、総合振込・提携サービスを除く。
- `s-151b37a2149bc7521e67-1` → `s-151b37a2149bc7521e67-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-46 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:41-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:48-51
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / h3 / この一覧に無料回数の特典は含まれますか？
- `s-ae652cccdc904e2fc575-1` → `s-ae652cccdc904e2fc575-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-46 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:41-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:48-51
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 含まれていません。
- `s-499afed3dbe8ea92a053-1` → `s-499afed3dbe8ea92a053-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-46 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:41-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:48-51
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 他行宛・税込の特典を適用しない料金を比較しています。
- `s-06637d6cf2c493d52aa3-1` → `s-c830bd0b447ae7398695-1` / 同論点の別出現 / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:29-46 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:41-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:48-51
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 個人のドコモSMTBネット銀行では（BaaS・提携サービスは条件が異なる場合があります）スマプロランクに応じて無料回数が決まり、当社・三井住友信託銀行以外への振込は無料回数以降77円です。
- `s-970adfcab45fdf946f34-1` → `s-970adfcab45fdf946f34-1` / 同論点の別出現 / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41 ; corpus/gmo_aozora_com_business_contents_fee_html.txt:23-41 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:20-51 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:41-51
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 対象口座・無料回数・通常単価・月額基本料を合わせて比較してください。
- `s-740576b63bda5da441c7-1` → `s-740576b63bda5da441c7-1` / 同論点の別出現 / 根拠: 同論点の表/節を台帳exception_sourcesに記録
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / なお、先方負担で差し引かれた手数料相当額を売手が支払手数料として処理する場合、インボイス制度のもとでは金融機関の適格請求書が手元に無い形になるため、実務上は「売上に係る対価の返還等」（値引き）として処理する方法が広く採られています。

#### 個人料金レンジ・100円未満の比較条件（要修正3単位）

- `s-359309764335ddbad22f-1` → `s-a45546cc5875faeb52e3-1` / medium / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15,40-51
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / SMTBのBaaS・提携サービス、無料回数・優遇・無料宛先・非居住者の別料金を除き、料金を照合できた掲載ネット振込の個人区分は75円〜440円。
- `s-fbdfc8e6b8e29c282863-1` → `s-1c66541d31a288cd0b44-1` / medium / 根拠: corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:64-77 ; corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15,29-51
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / GMOあおぞら75円・ドコモSMTB〈旧 住信SBI〉77円・auじぶんのスマートフォン・パソコン振込99円の個人向け通常料金は100円未満です（いずれも他行宛の無料回数以降で、SMTBは当社・三井住友信託銀行宛およびBaaS・提携サービスを、auじぶんは三菱UFJ銀行宛を除きます）。
- `s-dd53e332d7771663bfaf-2` → `s-21a3c33a6916ce4c100a-2` / medium / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15,40-51
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）当社・三井住友信託銀行あて0円／それ以外の金融機関宛は無料回数以降。

#### マイゲート優遇の銀行・サービス限定（要修正1単位）

- `s-4d476af90bc8cf34dab2-1` → `s-6d537fa5c1d891a7134e-1` / high / 根拠: corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:33-47
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / りそな銀行・埼玉りそな銀行の個人向けマイゲートの他行あて（りそな・埼玉りそな・関西みらい・みなと銀行あてを除く）は、ルビーが月間3回まで82円、ダイヤモンドが月間3回まで0円です。

#### SMTB改定前料金の法人・他行宛限定（要修正1単位）

- `s-863c18e2448bf2beaa13-1` → `s-f5a738b02085b0df100f-1` / high / 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:22-48 ; corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-26
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / ドコモSMTBネット銀行の法人で、提携サービスを除く改定前の通常の他行宛振込は145円、件数優遇で最安130円でした。

#### 3万円境界のサービス・宛先限定（要修正6単位）

- `s-09e7d6bed1cc7517b324-1` → `s-d40d1f9d7daa0c257cb8-1` / high / 根拠: corpus/www_rakuten_bank_co_jp_business_howto_interest_html.txt:86-112,166-182
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 楽天銀行の上表に掲載したサービスの通常の他行宛振込は3万円の境界あり（法人。
- `s-09e7d6bed1cc7517b324-2` → `s-b9e3552d10a972b0336b-1` / high / 根拠: corpus/www_boy_co_jp_hojin_eb_service_fee02_html.txt:12-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 横浜銀行の上表に掲載したサービスの通常の他行宛振込は3万円の境界あり（法人。
- `s-8039d0b101872b463653-1` → `s-e03143d780750423e43e-1` / high / 根拠: corpus/www_chibabank_co_jp_kinri_fee_transfer.txt:64-100
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 千葉銀行の上表に掲載したサービスの通常の他行宛振込は3万円の境界あり（個人・法人。
- `s-8039d0b101872b463653-2` → `s-6bde1637bf54d47b7f1b-1` / high / 根拠: corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:6-38 ; corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:38-46
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 福岡銀行の上表に掲載したサービスの通常の他行宛振込は3万円の境界あり（個人・法人。
- `s-8039d0b101872b463653-3` → `s-1ff4fdc7e218bac7fe03-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26,196-206
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 三菱UFJ銀行の上表に掲載したサービスの通常の他行宛振込は3万円の境界あり（個人・法人。
- `s-8039d0b101872b463653-4` → `s-59048cb04aa99eefca31-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:17-26,94-106,208-279
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 三井住友銀行の上表に掲載したサービスの通常の他行宛振込は3万円の境界あり（個人・法人。

#### 年間試算のGMO法人他行宛限定（要修正2単位）

- `s-5b326d60e0aeacdc2b09-1` → `s-2c754cce699174c3ba18-1` / high / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 三菱UFJのBizSTATION他行宛（3万円以上）とGMOあおぞら法人の通常の他行宛振込単価には560円（660円−100円）の差があります。
- `s-2c98b6434ce954f0353a-1` → `s-4a86c058a98847a2eea5-3` / high / 根拠: corpus/gmo_aozora_com_business_contents_fee_html.txt:10-28
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 通常料金（振込料金とくとく会員の99円を除く）

#### 経路別比較の個人・サービス・金額帯限定（要修正13単位）

- `s-45f9c03959de6ba6f3f4-1` → `s-148692fa5b2c4093c0ef-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:9-26,137-147,196-206
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。二額は3万円未満／3万円以上 【列】ネットバンキング 【値】154円／220円メインバンク プラスの無料優遇適用外。三菱UFJ信託・auじぶん銀行あて0円
- `s-a11dd0ed02fd2f1c12a3-1` → `s-e156a908e7936b480aa5-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:48-82,137-164
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。二額は3万円未満／3万円以上 【列】ATM（当行カード） 【値】275円ATM利用料は別途の場合あり。三菱UFJ信託・auじぶん銀行あて110円。本人確認未了では10万円超のATM振込不可
- `s-923a408f3282345ce63c-1` → `s-1376da1805f1c25dbaaf-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-123,266-296
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人）ネットはSMBCダイレクト。二額は3万円未満／3万円以上本人確認未了では振込できない場合あり 【列】ネットバンキング 【値】154円／220円Oliveの無料回数適用外。SMBCポイントパックの所定条件によるPayPay銀行本人名義あて無料（口座設定・メンテナンス時間・名義の文字や符号等により有料の場合あり）
- `s-44695018ea6314d21639-1` → `s-f452aad7974e0fbb2543-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:94-112,283-289
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人）ネットはSMBCダイレクト。二額は3万円未満／3万円以上本人確認未了では振込できない場合あり 【列】ATM（当行カード） 【値】165円／275円イーネット・ローソン銀行ATMは利用料別途
- `s-f1d8807ac4f8ab3c263c-1` → `s-1273f0d385755e103854-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:113-118,290-296
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人）ネットはSMBCダイレクト。二額は3万円未満／3万円以上本人確認未了では振込できない場合あり 【列】窓口 【値】口座出金 605円現金 990円
- `s-4cd84aafcdceb3b1a300-1` → `s-4aeab021696a16cbc24f-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26,196-206
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。二額は3万円未満／3万円以上 【列】ネットバンキング 【値】0円
- `s-46121f20a299abf1ce4d-1` → `s-47e45dfd0b3ed67b863e-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:48-57,137-147
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三菱UFJ銀行（個人）ネットは三菱UFJダイレクト。二額は3万円未満／3万円以上 【列】ATM（当行カード） 【値】110円ATM利用料は別途の場合あり。本人確認未了では10万円超のATM振込不可
- `s-1e8f6e2b75a766bde259-1` → `s-ed7986ed273665b3aaf7-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:17-26,208-246
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人）ネットはSMBCダイレクト。二額は3万円未満／3万円以上本人確認未了では振込できない場合あり 【列】ネットバンキング 【値】無料
- `s-b5b5515edd370bc86e20-1` → `s-194a46b06644b75d9216-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:24-26,223-255
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人）ネットはSMBCダイレクト。二額は3万円未満／3万円以上本人確認未了では振込できない場合あり 【列】ATM（当行カード） 【値】無料イーネット・ローソン銀行ATMは利用料別途
- `s-ff4fc7b9766328f45bde-1` → `s-d7f7b515b892e2b62e0e-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:30-58,226-262
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】三井住友銀行（個人）ネットはSMBCダイレクト。二額は3万円未満／3万円以上本人確認未了では振込できない場合あり 【列】窓口 【値】口座出金 220円現金 880円
- `s-70c82c7ffd9131daaa43-1` → `s-b1e62ba611a48f6eefcf-1` / high / 根拠: corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:25-32 ; corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:31-36
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / td / 【行】りそな銀行 【列】ネットバンキング 【値】0円個人向けマイゲート
- `s-16ec85ed730f0c10c24d-1` → `s-5e50d65e772b318589bf-1` / high / 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-26,83-92 ; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:24-26,223-255
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / div / 同行宛でも、利用経路ごとの料金を確認してください     三菱UFJ銀行の個人は三菱UFJダイレクトの当行あてが0円、窓口が880円です。三井住友銀行の個人の同行あてはSMBCダイレクトに加え、当行キャッシュカードによるATMの振込手数料も無料です（イーネット・ローソン銀行ATMは別途利用料が必要です）。
- `s-1415c4b4e9e74d98d8c5-1` → `s-6514cda2f557ca053aa5-1` / high / 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:15-58,94-118,290-296
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / li / ただし窓口が常に最高額とは限らず、三井住友銀行の個人の他行宛は窓口（口座出金）605円がATMの現金振込880円より安く設定されています（主要5行の実額）

#### ゆうちょダイレクト非居住者料金の税込表示（要修正2単位）

- `s-2e383f2e191a3872e549-1` → `s-2e383f2e191a3872e549-1` / medium / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:39-43,65
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / h3 / 消費税はかかりますか？
- `s-8cd57b1b3346a1986f46-1` → `s-cb4514e836a12a5d1b61-1` / medium / 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:39-43,65
  出現: `docs/column/furikomi-tesuryo-hikaku/index.html` / p / 国内の通常の振込手数料は課税取引で、掲載した通常料金は税込です（ゆうちょダイレクトの料金表は非居住者関連の1回3,000円も含め、消費税込みと案内しています）。

## 検証・コミット

本文・参照データ・生成器・台帳の初回コミット: `bfc393a6`。未確認維持・生成物同期・最終単位対応: `5acb4fbc`。最終HEAD・全テスト結果は完走後に追記。

HTMLを先にコミットした後、test_generators_freshのCHECKABLE全6生成器を実行。銀行別・FAQ JSON-LD・組版・QA索引も生成/確認。`check_claims --changed origin/main`は緑、`check_claims --segments`は未処理0。料金比較・銀行別・逆引き一致検査は緑。

基点の赤（指定された基点情報）: test_hojokin_sources / test_layout_visualの2件。予備のnode runnerは最終状態での全件検査に切り替えるため途中停止し、その結果を基点完走と数えない。最終の`bash run_tests.sh -q`は全mjs/壊しテスト/Pythonを実行、PLAYWRIGHT_PATHを指定しChromiumはこの作業内で直列に起動。

全件検査の初回でbreak_furikomi_amount_indexの旧条件文を名指しした壊し方が空振りした（22成功/3失敗）。壊す対象の文字列を「他行宛。」追加後の条件文に更新し、検査の強度は維持。完走後に当該壊しテストを再検査する。

## 横展開で追加修正した全出現

- `docs/senpou-futan/index.html`: 20変更単位。台帳の前→後: {"total": 218, "covered": 22, "verified": 13, "nonclaims": 66, "unprocessed": 130} → {"total": 222, "covered": 36, "verified": 8, "nonclaims": 66, "unprocessed": 120}。修正担当確認だけで独立okとはしない。
- `docs/column/senpou-futan-3hoshiki/index.html`: 21変更単位。台帳の前→後: {"total": 185, "covered": 0, "verified": 0, "nonclaims": 0, "unprocessed": 185} → {"total": 190, "covered": 21, "verified": 0, "nonclaims": 0, "unprocessed": 169}。修正担当確認だけで独立okとはしない。
- `docs/column/kumimodoshi/index.html`: 24変更単位。台帳の前→後: {"total": 496, "covered": 0, "verified": 0, "nonclaims": 0, "unprocessed": 496} → {"total": 496, "covered": 24, "verified": 0, "nonclaims": 0, "unprocessed": 472}。修正担当確認だけで独立okとはしない。

`docs/senpou-futan/index.html`・`docs/column/senpou-futan-3hoshiki/index.html`の6行（UFJ個人/法人、SMBC法人、千葉個人、りそな個人、ゆうちょ個人）の区分名セルに、他行宛/掲載サービス/通常料金/無料優遇・無料宛先の除外を付加。source_quote/corpus_refは各ページの台帳。

`docs/column/kumimodoshi/index.html`の実額の前提文を三菱UFJダイレクトの他行宛3万円未満・三菱UFJ信託/auじぶん/メインバンク プラス優遇除外に限定。設例表に前提文の局所文脈を付け、SVGを束ねるfigcaption・FAQ回答本文/JSON-LDも同じ条件にそろえた。根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:13-28,126-132。組戻制度や金額の主張を改変したものではない。

横展開65単位の元ページはこのRUNの照合対象外でold_idが存在しないため、fix-kinds.jsonのold_idをnullとし、new_idは作業場のsegment_claimsの出力と一致させた。新規の独立審査済み単位と数えない。
- `docs/senpou-futan/index.html` → `s-b356975b0acced22a4d2-1` / td / 三菱UFJ銀行（個人IB）個人の三菱UFJダイレクトの他行宛。
- `docs/senpou-futan/index.html` → `s-dd9d0ed1257162e95f21-1` / td / 三菱UFJ信託・auじぶん銀行宛とメインバンク プラスの無料優遇を除く
- `docs/senpou-futan/index.html` → `s-20cd7a9c898f4c019ea9-1` / td / 【行】三菱UFJ銀行（個人IB）個人の三菱UFJダイレクトの他行宛。三菱UFJ信託・auじぶん銀行宛とメインバンク プラスの無料優遇を除く 【列】3万円未満 【値】154円
- `docs/senpou-futan/index.html` → `s-239d91438b72948ed680-1` / td / 【行】三菱UFJ銀行（個人IB）個人の三菱UFJダイレクトの他行宛。三菱UFJ信託・auじぶん銀行宛とメインバンク プラスの無料優遇を除く 【列】3万円以上 【値】220円
- `docs/senpou-futan/index.html` → `s-badcd97ad5e37ac9e01f-1` / td / 三菱UFJ銀行（法人・BizSTATION）他行宛の通常料金
- `docs/senpou-futan/index.html` → `s-8fd9047c4dfc18ddade0-1` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛の通常料金 【列】3万円未満 【値】484円
- `docs/senpou-futan/index.html` → `s-c2c0f965acb8a916d1c2-1` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛の通常料金 【列】3万円以上 【値】660円
- `docs/senpou-futan/index.html` → `s-9bcab0c2a3c95603a964-1` / td / 三井住友銀行（法人・Web21エキスパート等）他行宛の一般振込。
- `docs/senpou-futan/index.html` → `s-a0e529a534174258827a-1` / td / 給与・賞与振込とWeb21ライトは別料金
- `docs/senpou-futan/index.html` → `s-d7f336805547602eab80-1` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛の一般振込。給与・賞与振込とWeb21ライトは別料金 【列】3万円未満 【値】495円
- `docs/senpou-futan/index.html` → `s-3fd41cd5b82ef68e5ef0-1` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛の一般振込。給与・賞与振込とWeb21ライトは別料金 【列】3万円以上 【値】660円
- `docs/senpou-futan/index.html` → `s-189f22920d2d68b77545-1` / td / 千葉銀行（個人IB）個人マイアクセスの他行宛。
- `docs/senpou-futan/index.html` → `s-97dd880faf664a1b87f4-1` / td / 同一店内・当行本支店宛は無料
- `docs/senpou-futan/index.html` → `s-bb2577dc8920d4057225-1` / td / 【行】千葉銀行（個人IB）個人マイアクセスの他行宛。同一店内・当行本支店宛は無料 【列】3万円未満 【値】165円
- `docs/senpou-futan/index.html` → `s-fe2c4872e0f78042e1d8-1` / td / 【行】千葉銀行（個人IB）個人マイアクセスの他行宛。同一店内・当行本支店宛は無料 【列】3万円以上 【値】330円
- `docs/senpou-futan/index.html` → `s-cbec3f2a6824317da94e-1` / td / りそな銀行（個人IB）個人マイゲートのスタンダード・パールの他行宛。
- `docs/senpou-futan/index.html` → `s-f7e35bc3254a7b735128-1` / td / りそな・埼玉りそな・関西みらい・みなと銀行宛を除く
- `docs/senpou-futan/index.html` → `s-98accf2293c264a18f61-1` / td / 【行】りそな銀行（個人IB）個人マイゲートのスタンダード・パールの他行宛。りそな・埼玉りそな・関西みらい・みなと銀行宛を除く 【列】3万円未満 【値】165円（金額区分なし・スタンダード／パール）
- `docs/senpou-futan/index.html` → `s-1d7e750a30132ad8541e-1` / td / ゆうちょダイレクト他金融機関宛・居住者による送金
- `docs/senpou-futan/index.html` → `s-655583e540156e661a94-1` / td / 【行】ゆうちょダイレクト他金融機関宛・居住者による送金 【列】3万円未満 【値】165円（金額区分なし・居住者）
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-b356975b0acced22a4d2-1` / td / 三菱UFJ銀行（個人IB）個人の三菱UFJダイレクトの他行宛。
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-dd9d0ed1257162e95f21-1` / td / 三菱UFJ信託・auじぶん銀行宛とメインバンク プラスの無料優遇を除く
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-20cd7a9c898f4c019ea9-1` / td / 【行】三菱UFJ銀行（個人IB）個人の三菱UFJダイレクトの他行宛。三菱UFJ信託・auじぶん銀行宛とメインバンク プラスの無料優遇を除く 【列】3万円未満 【値】154円
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-239d91438b72948ed680-1` / td / 【行】三菱UFJ銀行（個人IB）個人の三菱UFJダイレクトの他行宛。三菱UFJ信託・auじぶん銀行宛とメインバンク プラスの無料優遇を除く 【列】3万円以上 【値】220円
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-badcd97ad5e37ac9e01f-1` / td / 三菱UFJ銀行（法人・BizSTATION）他行宛の通常料金
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-8fd9047c4dfc18ddade0-1` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛の通常料金 【列】3万円未満 【値】484円
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-c2c0f965acb8a916d1c2-1` / td / 【行】三菱UFJ銀行（法人・BizSTATION）他行宛の通常料金 【列】3万円以上 【値】660円
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-9bcab0c2a3c95603a964-1` / td / 三井住友銀行（法人・Web21エキスパート等）他行宛の一般振込。
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-a0e529a534174258827a-1` / td / 給与・賞与振込とWeb21ライトは別料金
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-d7f336805547602eab80-1` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛の一般振込。給与・賞与振込とWeb21ライトは別料金 【列】3万円未満 【値】495円
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-3fd41cd5b82ef68e5ef0-1` / td / 【行】三井住友銀行（法人・Web21エキスパート等）他行宛の一般振込。給与・賞与振込とWeb21ライトは別料金 【列】3万円以上 【値】660円
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-189f22920d2d68b77545-1` / td / 千葉銀行（個人IB）個人マイアクセスの他行宛。
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-97dd880faf664a1b87f4-1` / td / 同一店内・当行本支店宛は無料
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-bb2577dc8920d4057225-1` / td / 【行】千葉銀行（個人IB）個人マイアクセスの他行宛。同一店内・当行本支店宛は無料 【列】3万円未満 【値】165円
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-fe2c4872e0f78042e1d8-1` / td / 【行】千葉銀行（個人IB）個人マイアクセスの他行宛。同一店内・当行本支店宛は無料 【列】3万円以上 【値】330円
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-cbec3f2a6824317da94e-1` / td / りそな銀行（個人IB）個人マイゲートのスタンダード・パールの他行宛。
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-f7e35bc3254a7b735128-1` / td / りそな・埼玉りそな・関西みらい・みなと銀行宛を除く
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-04129c246373e3cc9919-1` / td / 【行】りそな銀行（個人IB）個人マイゲートのスタンダード・パールの他行宛。りそな・埼玉りそな・関西みらい・みなと銀行宛を除く 【列】3万円未満 【値】165円（金額区分なし）
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-864648c2729ffadd9a2a-1` / td / ゆうちょ銀行個人ゆうちょダイレクトの他金融機関宛・居住者による送金。
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-e5a50584416350fa97f1-1` / td / 非居住者による送金は1回3,000円、他行の非居住者宛は所定窓口のみ
- `docs/column/senpou-futan-3hoshiki/index.html` → `s-86d9d73429f9887c4298-1` / td / 【行】ゆうちょ銀行個人ゆうちょダイレクトの他金融機関宛・居住者による送金。非居住者による送金は1回3,000円、他行の非居住者宛は所定窓口のみ 【列】3万円未満 【値】165円（金額区分なし）
- `docs/column/kumimodoshi/index.html` → `s-d706aef4b9d8fb25b0cb-1` / p / 三菱UFJ銀行・個人の三菱UFJダイレクトで、他行あて（三菱UFJ信託銀行・auじぶん銀行あてとメインバンク プラスの無料優遇を除く）に3万円未満を振り込んだ場合の実額で数えます。
- `docs/column/kumimodoshi/index.html` → `s-758c128203c310f0f51b-1` / th / 内訳
- `docs/column/kumimodoshi/index.html` → `s-c0c4457ea524217c88d6-1` / th / 金額
- `docs/column/kumimodoshi/index.html` → `s-7a14dc42c68bd2597cb2-1` / th / 説明
- `docs/column/kumimodoshi/index.html` → `s-d00da07aa944de46a54b-1` / td / 最初の振込手数料
- `docs/column/kumimodoshi/index.html` → `s-ab1b23fc0bc9a3b3aa33-1` / td / 【行】最初の振込手数料 【列】金額 【値】154円
- `docs/column/kumimodoshi/index.html` → `s-9b14892bc686a98ccaaa-1` / td / 【行】最初の振込手数料 【列】説明 【値】戻らない
- `docs/column/kumimodoshi/index.html` → `s-2e1a3581aeca92200337-1` / td / 組戻手数料（再振込）
- `docs/column/kumimodoshi/index.html` → `s-79bbcb5c7ff8cf91d4f7-1` / td / 【行】組戻手数料（再振込） 【列】金額 【値】880円
- `docs/column/kumimodoshi/index.html` → `s-e521f599a789adb2c331-1` / td / 【行】組戻手数料（再振込） 【列】説明 【値】個人・法人とも同額
- `docs/column/kumimodoshi/index.html` → `s-186f1d7c1f2ec1fd8ef1-1` / td / 振り込み直しの振込手数料
- `docs/column/kumimodoshi/index.html` → `s-ad28ceba00dce938a8ce-1` / td / 【行】振り込み直しの振込手数料 【列】金額 【値】154円
- `docs/column/kumimodoshi/index.html` → `s-00619c7a5f86996981bc-1` / td / 【行】振り込み直しの振込手数料 【列】説明 【値】新しい振込として発生
- `docs/column/kumimodoshi/index.html` → `s-90e4c438d2bcb3cace8d-1` / td / 合計
- `docs/column/kumimodoshi/index.html` → `s-7b1b7ac57ad9b6c21552-1` / td / 【行】合計 【列】金額 【値】1,188円
- `docs/column/kumimodoshi/index.html` → `s-0451cf7c6b84d67e365f-1` / td / 【行】合計 【列】説明 【値】最初の154円の約7.7倍
- `docs/column/kumimodoshi/index.html` → `s-4b820d30a83f83dc6653-1` / figure / 振込を間違えたときの手数料の内訳を、金額に比例した長さの帯で示した図 / 1回で済んだ場合 / 154円 / 間違えて組戻し、振り込み直した場合 / 合計 1,188円 / 154 / 組戻 880 / 154 / 帯の長さは金額に比例（1円＝0.35px）。組戻手数料880円が費用の大半を占める。 / 三菱UFJ銀行・個人の三菱UFJダイレクトで他行あて（三菱UFJ信託銀行・auじぶん銀行あてとメインバンク プラスの無料優遇を除く）3万円未満を振り込んだ場合の実額。組戻手数料が全体の約74%を占める。
- `docs/column/kumimodoshi/index.html` → `s-254ef076d52e2eaaedde-1` / h3 / Q. 組戻しの手数料はいくらですか。振込金額によって変わりますか？
- `docs/column/kumimodoshi/index.html` → `s-f5b87b8083194499faa3-1` / p / A. 三菱UFJ銀行の場合、振込組戻手数料は880円で、振込金額にも顧客区分にも関係なく同額です。
- `docs/column/kumimodoshi/index.html` → `s-9bc4037baf9fba7de761-1` / p / 個人のお客さま向けの表と法人のお客さま向けの表の両方に同じ880円が載っています。
- `docs/column/kumimodoshi/index.html` → `s-324d6c0373815e46d63d-1` / p / 組戻したうえで振り込み直す場合は880円に新しい振込手数料が加わります。
- `docs/column/kumimodoshi/index.html` → `s-4a69b774b6e182ec7aa6-1` / p / 加えて、最初に払った振込手数料は返ってきません。
- `docs/column/kumimodoshi/index.html` → `s-f085115bc6945e4b3031-1` / p / したがって個人の三菱UFJダイレクトで他行あて（三菱UFJ信託銀行・auじぶん銀行あてとメインバンク プラスの無料優遇を除く）に3万円未満を振り込んで間違えると、最初の154円と組戻の880円と振り込み直しの154円で合計1,188円かかることになります。
- `docs/column/kumimodoshi/index.html` → `s-faab4d603558d9c93794-1` / p / 他の銀行では金額が異なりますので、取引銀行の手数料表で確認してください。

## 最終照合の追加確認

- fix-kinds.json の305件は、保存した各ページの最終segment出力に全new_idが存在することを確認。入力SHA256は全件不変。
- 更新日生成とサイトマップ生成を再実行。全テスト中の一時変更を拾っていた登録免許税ページのlastmodを正しい2026-10-01に戻した（a25a42e5）。本文の変更ではない。
- CHECKABLE全6生成器を実行し、test_generators_fresh再検査は緑（39日に分散、最大20%）。

## 完走結果と最終状態

全テストは `PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js` で `bash run_tests.sh -q` を完走。323ファイル中、初回は316緑・7赤。修正後の個別再検査で、break_furikomi_amount_index（25成功/0失敗）、test_generators_fresh（CHECKABLE全6本）、test_retention_pages（保存/再読込/復元/消去/分離/イベント等）が緑。したがって初回と再検査を合わせた最終状態は319緑・4赤。全件を2回完走したという意味ではない。

残る赤:

- test_layout_render: 未変更4ページで15/3354 viewport失敗。預り金390pxの数字不可視1件、日経比較・高配当比較のdesktop横スクロール各4件、住民税早見表SVGのviewBox外6件。失敗4ページはorigin/mainと全バイト同一、共通スタイルも未変更。基点での全ブラウザ検査は再実行していない。今回変更した4ページ×6幅=24 viewportは全件緑。
- test_layout_visual: レビュー済み基準画像の環境メタデータと今回の環境が不一致。基準画像・検査基準は変更していない。
- test_no_orphan: 未変更の投資記事2本（ifreenext-india-vs-rakuten-india、orcan-vs-fang）が孤立。origin/mainのdocsと検査を別の読取用コピーで再実行し、同一の2件を再現。
- test_stale_values: 未変更の住民税早見表の5,600を検出。origin/mainのdocs・tools・条件JSONを読取用コピーに揃えて再実行し、同一の1件を再現。

指定された基点の赤2本のうち、test_hojokin_sourcesは今回緑、test_layout_visualは引き続き赤。追加で実測された上記3本は未変更ページの問題として残す。振込論点と無関係の本文・例外許可・画像基準を変更して赤を隠していない。

最終の `node tools/check_claims.mjs --changed origin/main` は4ページとも緑（全テスト後にも再確認）。対象の未処理は60→0。横展開3ページは前掲の通り減少し、審査対象外の残りを未処理のまま維持する。

修正済みの審査要修正はhigh121・medium5・low0。highは宛先・利用サービス・利用者・金額帯・優遇等の範囲欠落、mediumはBaaS/提携を含む比較範囲、年間試算の宛先、ゆうちょ非居住者手数料の税込説明。全126件のID・論点・正本根拠は上掲。正本外wrong0、not_wrong28/unsure101を独立okへ変更していない。

fix-kinds.jsonは305件（add_condition238 / add_text64 / replace3）。元の照合にない横展開65件はold_id=null。new_idは最終segment出力のidに照合済み。

コミット: bfc393a6（本文・データ・台帳）、5acb4fbc（未確認維持・生成同期）、74f6c593（同じ節の例外と引用・壊し方の更新）、6b9275fc（同論点の他ページ）、86589a84（更新日・修正区分）、a25a42e5（サイトマップ一時変更除去）。最後の証拠保存コミットのSHAはRUNの本報告とgbrainの正本末尾に記録する。

証拠: 作業場のreview-evidence/auto20261010-t8-q08351/。tests/に全件ログ・再検査ログ・基点再現ログ・台帳検査ログ・描画失敗と変更ページの測定を保存。入力ハッシュ全件不変。pushなし。
