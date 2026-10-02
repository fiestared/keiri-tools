---
type: concept
title: auto20261002（t8-q08461）修正報告
ingested_at: '2026-10-02T02:32:52.974Z'
source_kind: put_page
ingested_via: put_page
---

# auto20261002（t8-q08461）修正報告

2026-10-02。担当: Astra。作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261002-t8-q08461`。push・公開なし。他モデル・サブエージェント・Orca・スキル使用なし。

## 結果と単位数

未解決112単位を14論点に束ね、正本の同じ表・節の注記・別区分を読んで修正。high 15、medium 97、low 0（単位数、重複出現を含む）。正本外でwrongは0件。not_wrong 92・unsure 4は全件文面を保持し、needed_source付き未確認のまま残した。

|段階|単位数|確認・対応|非主張|正本外|未処理/未解決|
|---|---:|---|---:|---:|---|
|入力 coverage.json（審査前の生成値）|644|confirmed 356|183|99|unclear 6、unprocessed 0|
|今回の審査 segment-adjudication.json|644|ok 250|186|96|unresolved 112、判定欠落0|
|修正前の台帳実測|644|covers 144、独立確認129|177|現行ID・hash一致60（旧記録総数101）|未処理323|
|修正後の台帳実測|661|covers 379、独立確認248＋担当者照合131|186|96|未処理96（すべて正本外）|

`check_claims --segments` の未処理は **323→96（227減）**。この検査はout_of_corpusを処理済みとして数えないため、正本外をok/nonclaimに変えてゼロにはしていない。本文の条件追加・文分割で単位総数は644→661。担当者照合131は独立再審査待ちであり、verified okに含めない。混合単位の未確認部分（個人マイゲートの経路見出し、未確認サービスの掲載額等）もneeded_sourceを残した。前の台帳記録は過去の記録と明示し、古いcoversは除去した。

## 正本に照らした誤り率

審査後に残った112には、Solのいずれかがwrongとした108と、wrong無しでunclearのみの4がある。wrongをunclearと混ぜない定義では **108 ÷ (250＋108) = 30.17%**。要修正をまとめた参考率は112 ÷ (250＋112) = 30.94%。正本外96・非主張186は分母に入れない。判定がokに覆ったSol所見をwrongへ戻していない。

修正後は、元の正本照合対象362単位の照合可能部分について担当者確認で残存wrong 0、自己確認率 **0 ÷ (362＋0) = 0%**。これは独立再照合の結果ではない。変更後の独立誤り率は未測定で、review_run.shの6.1/5.6による変更単位の再照合へ渡す。担当者のゼロ判定をgate.jsonへ書き戻していない。

## 重要度別の内容

- high 15: SMTB法人100円の開始日・通常振込/総合振込・予約受付日・提携サービス（料金セル4、逆引き2、個人法人倍率1）、法人レンジ等の範囲3、年間差額の前提2、グラフのサービス限定1、30,200円の差引例のBizSTATION限定1、現金ATMの10万円上限1。
- medium 97: 銀行別の無料/別料金宛先、BaaS・本人名義口座の条件、個人マイゲートのグループ除外、各表・逆引き・倍率・要約・FAQへの同条件反映、ATM別途利用料、ゆうちょ利用口座間の定義と明細票料金、ことらの対応金融機関限定。
- low 0。料金数値・計算coreの修正0。今回は料金の適用条件の修正なので、core境界値/conditions/stale_valuesへの追加対象はない。

## 論点 → 単位ID → 全修正箇所 → 根拠

以下の節アンカーは特記なければ `docs/column/furikomi-tesuryo-hikaku/index.html`。単位に複数論点がある場合は重複して載せる（14論点の和集合は112単位）。固定正本は `review-evidence/auto20261002-t8-q08461/corpus/` に保存し、台帳には指定形式のcorpus_refと実在するsnapshot_ref、逐語source_quoteを付けた。

### SMTB個人のBaaS・提携条件

- 単位ID: s-6d7b6ff461d4a99911f9-1, s-8c44156903f5a962faa8-1, s-cec4de36d33c172d57b8-1, s-6f4f74db83439d6b74d7-1, s-850a12ea629c028063ff-1, s-6d7b6ff461d4a99911f9-2, s-8c44156903f5a962faa8-2, s-0a744dfb8062e6241471-1, s-e350620558b88fb00aca-1, s-78429fc6e8247dd8b63e-1
- 修正箇所: #kojin・#bank-sbi-netの料金セル、#gyakubikiの77円行、個人料金の要約、#chuui、FAQ無料回数・JSON-LD、fee_table.jsonの個人行、bank_presets.jsの注記。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_netbk_co_jp_contents_charge_furikomi.txt:15-59

### SMTB法人10月改定の対象・予約・提携条件

- 単位ID: s-6d7b6ff461d4a99911f9-1, s-8c44156903f5a962faa8-1, s-5d246ad086b1ca34e557-1, s-faaed91f02476f9a6411-1, s-6f4f74db83439d6b74d7-1, s-850a12ea629c028063ff-1, s-f4ad3aa46049ef3ba269-1, s-153f607989865d4c04de-1, s-6d7b6ff461d4a99911f9-2, s-8c44156903f5a962faa8-2, s-5d246ad086b1ca34e557-2, s-faaed91f02476f9a6411-2, s-0a744dfb8062e6241471-1, s-38a56ea532960e0cffd1-1, s-034ce2d9527b3e04fb0a-1, s-0c8cf55d0c77b3a30e66-1, s-38a56ea532960e0cffd1-2, s-975cd5be93a26d33ed69-1
- 修正箇所: #hojin・#bank-sbi-netの料金セル/倍率/改定注記、#gyakubiki100円行、法人レンジ・まとめ・最安FAQ・JSON-LD、末尾改定注記、fee_table.json法人行・bank_presets.js。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27; corpus/www_netbk_co_jp_contents_hojin_charge.txt:15-40

### PayPay個人の本人名義SMBC宛無料

- 単位ID: s-67b5d7d48f763b80cf3d-1, s-0fa8f49a5ef3267310cf-1, s-ffc4b699d297e0b5386c-1, s-78c4ee3de6c84232508d-1, s-67b5d7d48f763b80cf3d-2, s-0fa8f49a5ef3267310cf-2
- 修正箇所: #kojin・#bank-paypayの個人セル、#gyakubiki145円行、銀行別の無料範囲注記、fee_table.json・bank_presets.js。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_paypay_bank_co_jp_fee_transfer_html.txt:6-44

### ゆうちょ他行非居住者宛の利用経路

- 単位ID: s-9818a66fe3f92265a96d-1, s-bc178d131d9cf788a4c6-1, s-646c07fa53a2eccce03d-1, s-eea58a06131030ac8db6-1, s-9818a66fe3f92265a96d-2, s-bc178d131d9cf788a4c6-2, s-5af4804c2d324d718bf9-1
- 修正箇所: #kojin・#bank-yuchoの個人セル、#gyakubiki165円行、#keiroネット欄、fee_table.json・bank_presets.js。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:29-68

### りそなグループ4行宛の別料金

- 単位ID: s-986e1a5f370e6b4c9020-1, s-d5d5fffe1db534662f00-1, s-b7fc11f8c9fc0f386338-1, s-45a41a10c3879476ae0f-1, s-df69cde145179cd4b272-1, s-73e780b5588814a0afe8-1, s-2e9544ace9d6c72f58ec-1, s-f8323ed3e9576a7661d4-1, s-646c07fa53a2eccce03d-1, s-eea58a06131030ac8db6-1, s-ecc279b6efea3f9f429c-1, s-057c3526c27e4d413d5b-1, s-986e1a5f370e6b4c9020-2, s-d5d5fffe1db534662f00-2, s-df69cde145179cd4b272-2, s-73e780b5588814a0afe8-2, s-9a5a0b6adaf68c17bff1-1, s-b7fc11f8c9fc0f386338-2, s-45a41a10c3879476ae0f-2, s-2e9544ace9d6c72f58ec-2, s-f8323ed3e9576a7661d4-2, s-9a5a0b6adaf68c17bff1-2, s-6d4f5f314b4148e887fe-1, s-237fe7f638623fd509ee-1
- 修正箇所: #kojin・#hojin・#bank-resona・#bank-saitama-resonaのセル/倍率、#gyakubiki165/605円行、#keiro、605円FAQ・JSON-LD、fee_table.json・bank_presets.js。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_resonabank_co_jp_direct_service_tesuryo_html.txt:14-49; corpus/www_saitamaresona_co_jp_direct_service_tesuryo_html.txt:14-49; corpus/www_resonabank_co_jp_hojin_b_direct_service_tesuryou_html.txt:12-46; corpus/www_saitamaresona_co_jp_hojin_b_direct_service_tesuryou_html.txt:12-46

### auじぶんの三菱UFJ宛無料

- 単位ID: s-bb700d0b799de8ba2232-1, s-e8b3ab0813aaed135a43-1, s-81ad33d4cbd8bda0f57b-1, s-5c3c4f00030bf6d11df3-1, s-bb700d0b799de8ba2232-2, s-e8b3ab0813aaed135a43-2
- 修正箇所: #kojin・#bank-au-jibunの個人セル、#gyakubiki204円行、fee_table.json・bank_presets.js。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_jibunbank_co_jp_interest_and_commission_commission.txt:55-80

### SMBC個人のポイントパック本人宛無料条件

- 単位ID: s-202fe6586adbfa198632-1, s-3bf815b464cba744ef77-1, s-8faf021aa0015e9dee7b-1, s-e9ab74239bee1ba5eb1a-1, s-6c157ac025f1b690f7d1-1, s-e3c8557356ab52466807-1, s-202fe6586adbfa198632-2, s-3bf815b464cba744ef77-2, s-f0c8b4a109eead749626-2, s-21a8128d97b0b66fe16b-1
- 修正箇所: #kojin・#bank-smbcの個人セル/倍率/例外注記、#gyakubiki154/220円行、#keiroネット欄、fee_table.json・bank_presets.js。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:10-188

### 三菱UFJの信託・auじぶん宛区分

- 単位ID: s-4211eca67033552e2fd7-1, s-a796a89fbf74917a42c5-1, s-b042ea2b6e12649b01f0-1, s-8faf021aa0015e9dee7b-1, s-e9ab74239bee1ba5eb1a-1, s-6c157ac025f1b690f7d1-1, s-e3c8557356ab52466807-1, s-4211eca67033552e2fd7-2, s-a796a89fbf74917a42c5-2, s-f0c8b4a109eead749626-1, s-9bddeb0a11be00226707-1, s-711de63d8fe2d2a4c061-1
- 修正箇所: #kojin・#bank-mufg個人セル/倍率、法人比較段落、#gyakubiki154/220円行、#keiroネット/ATM欄・法人ATM注記、fee_table.json・bank_presets.js。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-233

### 福岡グループ5行の宛先区分

- 単位ID: s-8fb3d6b06319e6ffbc2f-1, s-c704a416d8f7f2bd007a-1, s-4117a2c61f7a5bf6a881-1, s-ad2277eff7cb93667e95-1, s-6c157ac025f1b690f7d1-1, s-e3c8557356ab52466807-1, s-265bac614942c90a379f-1, s-0a530b729ed10d78bb67-1, s-260db28adc87c2ed3bdc-1, s-512f847bcbfbc08fe1fa-1, s-8669e8754be19f9e7a94-1, s-f6855405e00264fe9593-1, s-8fb3d6b06319e6ffbc2f-2, s-c704a416d8f7f2bd007a-2, s-4117a2c61f7a5bf6a881-2, s-ad2277eff7cb93667e95-2, s-c93e0cedd372385c235f-1
- 修正箇所: #kojin・#hojin・#bank-fukuokaのセル/倍率、#gyakubiki220/330/440/550円行、fee_table.json・bank_presets.js。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:6-48; corpus/www_fukuokabank_co_jp_corporate_ebservice_tesuuryou.txt:5-52

### レンジ・最安・年間差額の比較範囲

- 単位ID: s-bcc38823a6b5049add75-1, s-63dc09cd95f7901b3d22-1, s-6431947438251849f07f-1, s-e27f74039c901b4c4458-1, s-99c0bdc95abda32c1432-1, s-ccd1aa1b24eb9562d101-1
- 修正箇所: 個人/法人表の直後、#gapと目次、#matome、最安FAQとJSON-LD。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/gmo_aozora_com_contents_fee_html.txt:42-61; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-233; corpus/www_fukuokabank_co_jp_personal_service_directbanking_summary_furikomi.txt:6-48; corpus/www_netbk_co_jp_contents_company_press_2026_0902_006290_html.txt:15-27

### グラフと差引例の銀行・サービス名

- 単位ID: s-bc63520b183e0a3f801f-1, s-9a682b7ef8f6a36ed3da-1
- 修正箇所: #kyoukai図のSVG aria-label・text・figcaption、#nazeの請求額30,200円の例。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-233; corpus/gmo_aozora_com_business_contents_fee_html.txt:10-41

### ATM振込単価と利用料・現金上限

- 単位ID: s-9a682b7ef8f6a36ed3da-1, s-a4d24976ee06ff589bfe-1, s-7b3cc8995a9dd235afba-1, s-26d3af12516512121c0c-1, s-4166ecc3d871d7c1d087-1, s-f860adbb0dfbd1bf20b7-1, s-bf16349619af52026d54-1, s-711de63d8fe2d2a4c061-1
- 修正箇所: #keiroのUFJ/SMBCの当行カード・現金セル、同行宛callout、法人ATM比較、別途利用料と本人確認/現金上限の注記。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-233; corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:10-188

### ゆうちょ利用口座間と受入明細票

- 単位ID: s-f70dc65a7c2e2afe3094-1, s-3cbc0d64caebe7d38dd2-1
- 修正箇所: #keiroの振替ネットセル、#matomeのゆうちょ振替説明。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_jp_bank_japanpost_jp_direct_pc_price_dr_pc_pr_index_html.txt:29-68

### ことらの対応金融機関限定

- 単位ID: s-05b3bbb77e018b3f1131-1
- 修正箇所: #kotora見出しと目次。 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。
- 根拠: corpus/www_smbc_co_jp_kojin_fee_furikomi_html.txt:10-188; corpus/www_bk_mufg_jp_tesuuryou_furikomi_html.txt:11-233


## 横断確認・生成

- `docs/assets/fee_table.json` に宛先・適用日・対象サービスの条件を持たせ、冒頭一覧・銀行別・金額逆引きの全出現を統一。`tools/gen_bank_sections.mjs` は注記中の数字でソートせず、数値の料金で並べる。既存の未確認表示・取得日・横浜の掲載保留を生成後も保持する。
- `docs/assets/bank_presets.js` は手動選択とURL指定で条件注記を表示する。`final-audit` で30区分の料金と条件付き13区分の注記を確認。
- title / meta description / OG は正本外not_wrongの原文を保持。FAQ JSON-LDは `node tools/gen_faq_jsonld.mjs` で本文との一致を確認。SVGのaria-label・text・figcaptionは具体的銀行/サービスへ統一。
- `docs/embed/senpou-futan/` は銀行プリセットを読まない手入力版で、銀行料金の同一主張なし。`docs/assets/senpou_core.js` の100円等は入金差額候補で、今回の料金条件変更による数値変更なし。その他ページの同じ数字の検索結果は別制度の数値で、振込料金の同一主張は残っていない。
- `docs/assets/qa_index.json` は生成器で最新を確認（変更不要）。本文を先にcommitした後、CHECKABLEの5生成器（index_sitemap、datemodified、trust_footer、data_source_note、domain_bridge）を全実行。sitemapの対象ページlastmodを10月2日へ同期。
- 修正後のsource_quoteを **延べ1371行範囲照合、不一致0**。正本外96単位の文面保持、古い/未知covers・nonclaimの残存0を確認。逆引きの100円等、値自体が変わらない単位も同じ行に宛先・条件を補足して解消した。

## テスト

指定環境 `PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js` で `./run_tests.sh -q` を全300本実行。Chromiumは本作業内で直列に使用。他セッションの終了は待っていない。

- 基点の赤: 指示で提示された2件（test_hojokin_sources、test_layout_visual）。基点全件の再実行はしていない。追加で見つかったstale_valuesの4ページについては、作業開始時の886e539eと本文・検査定義が一致することと、同じ日付で基点の本文から同じ4件が検出されることを確認した（baseline-stale.json）。残存する2件はlayout_visualの環境不一致と、基点でも検出されるstale_values。共有origin/main参照は作業中に進んだため、基点本文の比較には固定SHA 886e539eを使った。
- 初回の全件実測: **赤3/300**。赤一覧:

```
tests/test_layout_render.mjs
  tests/test_layout_visual.mjs
  tests/test_stale_values.mjs
```

- 修正後の再検査を含めた残存赤: **2件**（tests/test_layout_visual.mjs, tests/test_stale_values.mjs）。今回の横はみ出しは同じ6画面幅の対象ページ再検査で解消。全ページ検査の残り3,132画面は元から問題0で、修正後に全300本をもう一巡はしていない。
- test_layout_visualは基準環境（Playwright 1.58.2 / Chromium 145.0.7632.6）と指定実行環境（1.62.1 / 151.0.7922.34）の不一致。画像比較前の失敗で、基準の自動更新はしていない。test_hojokin_sourcesは今回の作業場では全件実行・最終個別実行とも緑で、基点の提示された赤は再現しなかった。
- 料金比較、逆引き、銀行別、プリセット/導線、FAQ可視本文、質問箱、5生成器のfresh検査を最終生成後に再実行して緑。
- `node tools/check_claims.mjs --changed origin/main`: 緑。
- `node tools/check_claims.mjs --segments docs/column/furikomi-tesuryo-hikaku/index.html`: 実行成功、正本外96のみ警告。被覆は正確性の保証ではない。
- 全件レイアウト検査でゆうちょの利用口座間注記の横はみ出しを検出し、既存のcell-note表示で折り返すよう修正。変更後の対象ページを同じ6画面幅・印刷モード・目次/フォーム/空白領域検査で再測定。その他ページの全件結果は変更せず保存する。
- 全件ログ: `review-evidence/auto20261002-t8-q08461/all-tests.log`。最終関連検査は同ディレクトリの`test_*.log`、単位前後は`segments-before.log`/`segments-after.log`。

## コミット・受け渡し

基点886e539e。最終commit: **6d7dd350060dcb407c7867469ec90782e00d80bc**。

```
6d7dd350 振込手数料の修正根拠と全件検証の結果を記録
95f5b8d2 ゆうちょの利用口座間注記を表内で折り返す
4299c15a 倍率の比較から無料宛先を除外し銀行の節で審査結果を対応付ける
8de8ce12 PayPayの優遇条件を正本の残高・回数まで明記
b08dc2d5 料金注記を生成時にも保持し単位ごとの根拠と未確認範囲を記録
cd0d2318 振込手数料の宛先・サービス・適用日の条件を一覧と全出現に反映
```

作業場の未コミット差分なし。pushなし。変更単位の独立再照合はシェル側に委ね、本担当はその完了を待たない。

DONE
