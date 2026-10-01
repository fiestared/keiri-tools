r16/t12-a 修正証跡（2026-10-01）

原本は /Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t12-a。
*-applied.json は固定審査単位と修正文・根拠の対応。matches は一括置換時点の件数であり、重複する長短の単位では0もあり、後続の個別補正を含む最終状態は git diff と preservation.json を見る。
coverage-before.json は origin/main e7391b66 の実HTML・既存台帳。coverage-after.json は修正後のHTML・台帳。固定segments.jsonとは基点の抽出差がある。
verified は元の独立審査okから本文ハッシュが一致するもののみ引継ぎ。修正後の主張は covers と corrected_pending_independent_review で、独立審査okを作らない。
正本外は needed_source を保持し out_of_corpus に残す。基点ですでに抽出が変わっていた3単位は prior_out_of_corpus で保持。
moj-obligation.html は curl による法務省の生HTML（取得2026-10-01）。固定正本外の既存複合単位をokにするためではなく、変更行に同居する相続登記義務化の開始日の数値のみの補足出典。
boundary-red.log / boundary-green.log は新設した住宅取得日・登記日の境界に対する旧coreと新coreの実行結果。HTML初期値のケースは最終版で日付・金額・持分・住宅条件を実際のHTMLからすべて読み、土地225,000円・建物30,000円・抵当権35,000円を期待値として検証する。
baseline-partial.log は途中終了した基点の全テスト試行。全件の基点赤2件はユーザー指定情報として扱い、自分の全件実測とは記載しない。
full-tests.log は全298本の実行ログ。test_input_wiring終了後に親ランナーのみを一時停止し、追加のHTML修正・コミット・生成器・台帳を反映後に残りを再開した。前半の失敗は final-validation.log で関係テストを再実行する。Chromiumは同時に1つだけ。
作業中に共有origin/main参照が他セッションのfetchで進むため、保存・移行監査の比較元は着手SHA e7391b66に固定。check_claims --changed origin/main 自体は実装のmerge-baseを使うため分岐点からの自分の差分を検査する。
post-full.logの末尾の終了127は、実行中ラッパーの生成器リストを編集したことによる末尾コマンドの読み取りずれ（idation.log）。set -e下のvalidate-fixes.shはその前に正常終了し、final-validation.logの全テスト・実UI・入力配線がGREEN。ラッパーをbash -nで確認し、最終claims検査・作業ツリー復元・test-summary集計を独立に実行している。製品やテスト本体の失敗とは混同しない。
