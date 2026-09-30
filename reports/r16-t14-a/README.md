# r16 / t14-a 修正証跡

入力正本は `/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t14-a`（読取のみ）。作業ブランチは `wt/astra-r16-t14-a`。最終報告は同RUNの `fixes-applied.md`。

- `coverage-before.json` / `coverage-after.json`: 台帳の登録前後。`adjudication-before.json` は元審査の分類であり、台帳登録件数とは別。
- `segments-after.json` / `segments-check.log`: 修正後の固定単位と各ページのチェック出力。正本外108単位の未処理は意図的。`coverage.mjs` は正本外以外のエラーを拒否する。
- `remediation.json` / `replacements.json`: 元unresolved単位と編集計画。最終HTMLとgit diffが変更内容の正本。`unchanged-unresolved.json` の17単位は非主張への区分変更12・前提修正で結果が同じ5。
- `source-passages.txt`: 元審査が示した66正本の抜粋。行番号はLFだけを改行として数え、PDF由来のform feedは改行扱いしない。
- `chiho-37.json` / `rouho-11.json`: 追加取得した一次資料。等級は協会けんぽ正本と日本年金機構PDFも参照（台帳additional_sources）。
- `annual-example.json`: 社会保険料530,000円という仮定の設例を住民税coreで検算した結果。
- `core-red.log` / `core-green.log`: 境界値を先に追加した赤→緑。mutationログは壊しを検出することの確認。
- `baseline-tests.log`: 基点の全テストを開始したが、`test_input_wiring`実行中に修正後の全件実行を優先して、この作業のプロセスだけを終了した**部分ログ**。全件完走を意味しない。基点赤2件は依頼の既知情報、うちhojokinの赤はこのログでも実測。
- `post-tests.log`: 修正後の全294ファイルの実行記録。初回は286緑・8赤。今回発生した6赤を修正・再実行して、最終的な未解消は既知の2赤のみ。詳細は`test-status-final.json`。
- `generators.log`: HTMLコミット後の5生成器の実行と、dateModified更新による一時的なsitemap不整合。`generators-final.log` / `.exit`: 生成物コミット後の再生成・鮮度チェック成功。
- PNGと`visual.json`: 修正した図の目視確認とSVG領域外への文字はみ出し検査。1つのChromiumで逐次撮影。

`edit.py`・`update-core.py`・`patch-core.py`・`post-edits.py`・`ledger.py`・`finalize-ledger.mjs` は作業経緯のために保存した一度限りの編集スクリプト。最終状態に再実行しないこと。最終台帳にはその後の一次資料追記も含む。

最終の全ページ再測定は514ページ×6サイズ＝3,084画面で問題0。`layout-final-summary.json`と7対象ページの`layout-targets-final.json`を収録。全生測定は`layout-final/`にローカル保存しgitから除外した。
