# 検証中の記録

- CHECKABLE 5本の生成をHTMLコミット後に実行。生成物変更0。
- 最初の個別test_generators_freshは、修正後全件ランナーのbreak_izoku_pageと重なり、同テストが一時改変したdocs/izoku/index.htmlの更新日を検出して赤になった。個別検査の完了前に全件ランナーを開始した進行上の不備。対象記事の更新日不整合と扱わない。break_izoku_page完了で同ファイルの改変は復元。最終判断は壊しテスト終了後に直列で実行される全件ランナー内のtest_generators_freshによる。
- 基点再実行は31ファイル緑のログを取得後にSIGTERM。実行中のbreak_kokuho_pageが終了して復元した後にランナー終了(exit143)。git diff空を確認してから本文変更に着手。基点赤2件はユーザー提示値。

- 最終全件: 295/297緑、赤2、exit1。test_layout_visual（環境メタデータ差）とtest_theme_segments.py（旧モデル名期待値）。test_hojokin_sourcesは今回緑。
- test_theme_segments.py個別再実行は4 tests中1 failureを再現。期待gpt-5.6-solに対して実装既定gpt-6.1-sol。該当テスト・theme_round.py・theme_segments.py・segment_claims.mjsは基点a5675f89とバイト一致。実モデル呼出しはテストのmockで置換されており0。無関係なテスト期待値は本作業で変更しない。
- 全件内のtest_generators_fresh、test_shogaku_tokurei、test_stale_values、test_stale_values_rules、test_retention_pagesは緑。個別生成器検査の先行した一時赤は全件内の直列検査で解消。
- 描画最終集計: 514ページ×6サイズ=3,084画面、異常0。対象記事の6サイズも異常0。途中の3,066画面を最終値にはしない。
- 入力210ファイルの保存ハッシュとの不一致0。最終check_claims --changed origin/main緑、--segments未処理9→5。
