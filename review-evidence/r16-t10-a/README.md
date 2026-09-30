# r16 / t10-a 修正証跡（2026-10-01）

基点: `023d21017660db9cb7f88ef7911589a0d240bcd2` (`origin/main`)。
入力正本は keiri-commander/runs/review-loop/r16/t10-a の corpus と単位審査。

- `records.json`: 元の3,123単位、審査結果、正本引用との対応。
- `edits.json`: 主な文字列修正の旧文・新文。後続のFAQ反映・図の改行・リンク修復はgit diffを参照。
- `resolutions.json`: 元のunresolved全322単位の修正対応。修正者の再確認であり独立再審査ではない。
- `source-excerpts.txt`, `source-ranges.json`: 開いた正本の箇所。
- `coverage-before.json`: 基点HTMLと基点台帳を `validateSegments` で集計。
- `coverage-after.json`, `after-segments.json`: 修正後の単位と被覆。out_of_corpusはunprocessedの内数。
- `segments-cli.log`: 対象12ページの実際の `node tools/check_claims.mjs --segments <page>` の出力。
- `claims-check.log`: `node tools/check_claims.mjs --changed origin/main`。
- `local-refund-source.*`: 追加発見した地方消費税の還付端数処理の国税庁事務運営指針。
- `core-red.log`, `core-green.log`: 地方消費税の還付99円を0円にしていた不具合の赤→緑。
- `target-layout-first.log`, `target-layout-second.log`, `target-layout.json`: 対象12ページ×2幅の図・幾何検査。初回のはみ出しを改行・枠拡張で修正。
- `*-figure.png`: 変更した5ページの図を目視確認したスクリーンショット。
- `all-tests-first.log`: 指定PLAYWRIGHT_PATHで全296ファイルを逐次実行したログ。途中で判明した年度照合文字列の不一致はその場で修正したため、break_izokuの初回赤は再実行結果と合わせて読む。初回の赤6件のうち追加4件は最終再検査で解消。既知の赤2件は維持。

HTMLは生成器より先にコミット。CHECKABLEの5生成器を実行。
Chromiumを使う検査は本作業内で直列実行。他セッションを待機・停止していない。pushしていない。

- `final-retests.log`, `final-retests.json`: 追加の赤4件と生成器・年度チェックの最終結果。
- `related-generators.log`: Q&A索引・関連記事を生成。
- `full-layout-summary.json`: 514ページ×6画面幅=3,084組、失敗0。
- `related-layout.json`, `related-layout.log`: 最後に生成物が変わった3ページ×6画面幅=18組、失敗0。
