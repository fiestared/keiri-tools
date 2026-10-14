# 印刷表と Excel（2026-10-14）

対象は既存の `/inshi/`、`/column/koyou-hokenryo-ritsu/`、`/column/rosai-hokenryoritsu/`。印紙と保険料率の2対象として、保険料率の別々の着地を改修した。title・h1 は文字列一致テストで維持する。公開・push は司令塔が行う。

## 対象を決めた根拠

司令塔の `runs/seo-astra-2026-10-14/evidence/bing-GetPageStats.json`（07-31〜10-09）の着地集計は、印紙 29,921表示・65クリック、雇用保険 12,292表示・47クリック、労災 8,730表示・121クリック。GSC の `gsc-oct-page-query.json` は「収入印紙 金額 一覧」を `/inshi/` に記録。`gsc-oct-page.json` も雇用保険と労災の既存ページを記録する。新規の重複ページは作らない。

## 正本・一次資料・生成

- 印紙：`docs/assets/inshi_r07.json` の第17号（営業に関する紙の売上領収書）。既存の全20号判定機は引き続き使える。今回の印刷・Excel は領収書の16行。5万円未満、各階級の上限と超過、金額記載なしを含む。
- 雇用保険：`docs/assets/shaho_rates_r08.json` の `koyou`。料率の年度・確認日と前年度比較もこの部分に持たせる。
- 労災：新設 `docs/assets/rosai_rates_r08.json`。curl で取得した e-Gov v2 の別表第1から53業種を作り、厚労省PDFの業種名・全料率をbboxで独立に照合した。船舶所有者・特別加入・メリット制の個別率は表の対象外と表示。
- `tools/gen_print_tables.py` は標準ライブラリで静的HTMLと決定的なOOXMLを同時に生成。既存 `gen_inshi_receipt_table.mjs` は互換入口。`--check` で stale を検出する。金額・料率は数値セル、各行に一次資料のハイパーリンク、適用時点・確認日・条件・出典を同梱する。
- 一次資料は6件とも curl HTTP 200。取得原本と SHA-256 は `source-verification.json`。確認日は画面・Excelとも2026-10-14。

## 検査の守備範囲

`tests/test_print_tables.mjs` は生成器をimportせず、HTMLとZIP/XMLを独立に読み、全行・業種名・料率・境界表記・金額・数値セル型・出典リンク・適用時点を照合する。`tests/fixtures/print_tables_primary.json` は国税庁の生HTMLと厚労省PDFの公表値の外部オラクル。

`tests/test_print_tables_render.mjs` は1280/390と印刷PDFを確認。印紙1枚、雇用保険1枚、労災2枚。PDFに全行名・確認日・出典があり、操作・ナビが印刷されないことを確認。計算後の印紙でも表印刷を選べ、通常の計算結果印刷は維持する。正常条件の `print_table_inshi` / `print_table_koyou` / `print_table_rosai` を `tools/e2e` に追加し、印刷操作と配信されたxlsxを検査。

この網に含めないものは、個別文書の課否・所属判定、労災の個別適用率、第三者アプリごとのExcel表示差。一次資料と確認範囲を示し、個別相談の回答はしない。

生成器は司令塔 `pub_worktree.sh` と同じ順（faq→qa→article_next_read→tool_related→layout→presentation→footer→favicon→datemodified→sitemap）で実行。ARTICLE_SPECのOGP・X導線も実行したが、今回と無関係なX共有テキストだけの既存差分は含めない。共有CSS style.css は変更せず、対象ページだけが読む print_tables.css を追加した。

全テストの最終集計と固定した origin/main（22519fef49e11b3666545b8b1b4dec2695250c50）の比較は `test-summary.json` に記録する。原本・ログ・画面・PDFはこのディレクトリに保存し、baseline-site は検査用の独立コピーなのでコミットしない。

## 最終結果

全264本を実行。バッチ中に出た12本の赤は、修正・生成器の再実行・タイムアウトの再試行後に6本を解消し、258本が緑。未解消6本はすべて開始時 origin/main（22519fef49e11b3666545b8b1b4dec2695250c50）の独立コピーでも同じ失敗を再現した。今回の未解消の赤は0。

- `test_hojokin_sources`：既存の補助金タブ生成物が古い。
- `test_kogaku_article`：既存の認定証の節に施行規則129条の2第2項の記載がない。
- `test_nav` / `test_site_search`：既存 `column/shintaku-hoshu` のヘッダが不一致。
- `test_no_orphan`：既存 `column/emaxis-nikkei-vs-tawara-nikkei` に被リンクがない。
- `test_layout_visual`：比較用の環境はPlaywright 1.62.1 / Chromium 151だが、実行環境は1.58.2 / 145。製品の画面差を測れない環境不一致で、開始時originでも同じ。

修正後の全サイト画面検査は582ページ×6幅=3,492件すべて緑。前年度比較のPC横スクロールと、労災のスマホで数値が最初に見えない問題を直し、開いた比較表も検査に含めた。印刷は祖先コンテナを隠す方式にして、非印刷の表のthead指定も維持する。追加の画面・PDF検査は6幅すべてで緑、A4は1・1・2枚。既存の計算結果印刷の検査も全件バッチで通過。

`check_claims --changed` は緑。補足で流した `check_claim_scope` は、既存のmust_with未登録135件が開始時originでも同数（条件の抜けは0）。個別の税務・労務判断は検査の対象にしない。

`final-tests.log` は修正途中を含む全件バッチの原記録。再実行後の有効な結果と対応するログは `test-summary.json`。必要な原本・ログ・PNG/PDFだけを明示してコミットした。
