# r15-t5-a 修正証拠（2026-09-30）

元入力の写しとSHA256、元審査、全65単位の対応、修正後の被覆、正本の参照箇所、追加取得した公式資料、赤→緑の記録を保存する。

- `fix-dispositions.json`: 元unresolvedの65単位。修正適用は独立した解決認定ではない。
- `final-coverage-audit.json` / `coverage-after-command.log`: 現HTMLの被覆。正本外と修正後未審査は未処理に含む。
- `segment-adjudication.json`: 固定正本に対する元審査。claimsのreview_ref参照先。
- `supplemental-sources.json`: 固定正本とは区別した追加資料と利用範囲。
- `baseline-tests.log`: 基点の途中打切り記録。全件完走結果ではない。
- `post-tests.log`: 修正後の全件実行。途中で検出したboeiの追加赤は修正後の`boei-retry.log`と合わせて読む。
- `*-red.log` / `*-green.log`: 回帰ケース等の実行記録。
- `input-verification.json`: 元入力44ファイルの不変確認。

最終報告は keiri-commander/runs/review-loop/r15/t5-a/fixes-applied.md および gbrain implementation/keiri-r15-t5-a-2026-09-30。
