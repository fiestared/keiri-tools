# 銀行別の振込手数料ページ（2026-10-14）

対象はBing需要調査の優先3行。作業開始時のorigin/mainは22519fef49e11b3666545b8b1b4dec2695250c50。
一次資料はcurlで原本を取得。`source-verification.json`にHTTP状態と他行宛ての照合結果、`evidence/`に原本を保存。

- 三菱UFJ銀行：個人・法人の他行宛てはfee_tableと一致。同行宛ては同じ公式表の該当セルで確認。
- ゆうちょ銀行：個人・法人の他行宛てはfee_tableと一致。同行宛ての電信振替、総合振込の年間件数帯、給与振込を区別。
- みずほ銀行：fee_tableの個人・法人EBの公式URLはcurlで403。個人の公式FAQは200で110円と一致するが、法人EBを再照合できず銀行ページ全体を保留。403は不一致と区別。fee_tableは修正していない。
- 残りの銀行の一括生成は実施していない。同行宛て等の一次確認が必要なため、まず照合できた2行を完成させた。

他行宛ての額・条件・確認日はfee_tableから生成。fee_tableにない同行宛ては`tools/bank_fee_page_data.json`に一次資料の逐語と補助データを置く。ページに額を手書きしない。主表の確認日はfee_tableのverified_dateを維持し、同行宛て補助データの確認日は2026-10-14と区別する。

生成時にcurlの照合を実行し、不一致・取得不能の銀行は生成しない。失敗時に前回の照合結果を再利用しない。既に生成済みの対象は適格性を失うと取り除く。--checkはネットワークに依存せずfee_tableと生成物を照合する。未検証区分・未確認表示の区分は除外。

## 再生成

1. `node tools/gen_bank_fee_pages.mjs`（公式料金のcurl照合を含む。データ修正や承認は自動化しない）
2. `node tools/gen_bank_sections.mjs`（比較ページ側の相互リンク）
3. ARTICLE_SPECとpub_worktree.shの生成器順でFAQ→QA索引→次に読む→関連ツール→OGP→X共有/リンク→layout→presentation→フッタ→favicon→更新日→一覧/sitemap。sitemapは--checkが緑になるまで。
4. `node tools/gen_bank_fee_claims.mjs`（単位の台帳生成。独立の事実審査とは別）
5. `node tools/check_claims.mjs --changed`、`node tools/check_claim_scope.mjs docs/column/yucho-furikomi-tesuryo/index.html docs/column/mufg-furikomi-tesuryo/index.html`
6. `node tests/test_bank_fee_pages.mjs`、`E2E_ONLY='bank_fee*' node tools/e2e/e2e.mjs`、全tests/*.mjs。

銀行を増やす際は、verified_date/sourceだけでなく、その銀行の同行宛て・対象サービス・例外を公式原本で確認して補助データを登録し、公式照合器の該当表を指定する。ORDER/CATEGORIESにも登録する。未検証の銀行は登録しない。

## 検査証拠

- `origin-tests.log`：作業開始時origin/mainの隔離コピーでtest_*.mjsを実行。
- `final-tests.log`：今回の作業場でtest_*.mjsを実行。
- `break-results.json`・`break-logs/`：今回の変更を複写した隔離コピーで残りのtests/*.mjsを実行（壊しテストのファイル変更を商品と分離）。
- `e2e.log`：両ページの表示、印刷ボタン、差引ツールへ遷移、請求額30,000円の据置型で法人料金を適用した答え（MUFG29,340円・ゆうちょ29,835円）を確認。
- `claims-check.log`・`claims-scope.log`：数字・条件と単位の全被覆。台帳は独立審査済みを名乗らない。
- `*-1280.png`・`*-390.png`：PC/スマートフォンの全体を目視。390pxは実幅390pxのiframeで確認。アプリ内Browser接続はsandboxPolicy欠落で失敗し、既存shot_page.mjsで代替。

生成器の実行で、既存のX共有文などの更新も生じている。料金データや本文を勝手に修正していない。pushなし、公開は司令塔。

## 最終結果

全tests/*.mjs 321本を実行。初回の今回由来の赤2本（PVリンク・QA検索）を修正して再実行した最終状態は314緑、今回の赤0。既存の赤6本と環境不一致による測定不能1本を分ける。

- 既存の赤：test_hojokin_sources（補助金タブ生成物の古さ）、test_kogaku_article（認定証の節の条項）、test_nav / test_site_search（既存shintaku-hoshuの検索ボタン）、test_no_orphan（既存emaxis-nikkei-vs-tawara-nikkeiの孤立）、break_kogaku（同記事の無傷が赤のため停止）。
- 測定不能：test_layout_visualの基準環境はPlaywright 1.62.1 / Chromium 151、実環境は1.58.2 / 145。基準画像・検査を緩めていない。
- 作業開始時origin/mainの全262本は255緑・7赤。上記の残る赤は、終盤のorigin/main 1981c21b64ce4e10bee1f08665fdca199e2df292でも該当7本を再実行して再現。
- 初回全体ログは修正前のPV/QAの赤も残す。修正後のpv-browser.log / qa-test.logとtest-results.jsonが最終判定。修正した検査を省略・緩和していない。QAには銀行名を必要とするページの索引属性を追加し、汎用「銀行振込」を比較・反映時間・振替との違いから奪わない。
- 銀行ページの鮮度、記事構造、料金の正本照合、台帳の全被覆・条件、関連リンク、QA・PV、E2Eは緑。料金データへの変更は0。
