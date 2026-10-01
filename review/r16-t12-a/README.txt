r16/t12-a 修正証跡（2026-10-01）

原本は /Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t12-a。
*-applied.json は固定審査単位と修正文・根拠の対応。matches は一括置換時点の件数であり、重複する長短の単位では0もあり、後続の個別補正を含む最終状態は git diff と preservation.json を見る。
coverage-before.json は origin/main e7391b66 の実HTML・既存台帳。coverage-after.json は修正後のHTML・台帳。固定segments.jsonとは基点の抽出差がある。
verified は元の独立審査okから本文ハッシュが一致するもののみ引継ぎ。修正後の主張は covers と corrected_pending_independent_review で、独立審査okを作らない。
正本外は needed_source を保持し out_of_corpus に残す。基点ですでに抽出が変わっていた3単位は prior_out_of_corpus で保持。
moj-obligation.html は curl による法務省の生HTML（取得2026-10-01）。固定正本外の既存複合単位をokにするためではなく、変更行に同居する相続登記義務化の開始日の数値のみの補足出典。
boundary-red.log / boundary-green.log は新設した住宅取得日・登記日の境界に対する旧coreと新coreの実行結果。HTML初期日付のケースは例の金額を用いた日付配線の検証であり、ページの空の金額欄をそのまま計算したケースではない。
baseline-partial.log は途中終了した基点の全テスト試行。全件の基点赤2件はユーザー指定情報として扱い、自分の全件実測とは記載しない。
