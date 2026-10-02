# auto20261002/t8-q08461 修正の証跡

入力の固定コピー（segments / 審査 / Sol和集合 / oc-opinion / corpus）は当初RUNの読み取り結果です。入力RUNは変更していません。

- `issue-map.json` / `issue-report.md`: 未解決112単位を14論点へ対応付け。複数条件の単位は複数論点に登場します。
- `source-sections.json`: 同じ表・節の注記、別の経路・宛先・金額帯まで読んだ範囲と例外。
- `segments-after.json` / `ledger-status.json`: 修正後の単位と状態。担当者照合は独立審査okと区別。
- `final-audit.json`: 正本外文面96単位の保持、引用行、30プリセット、単位対応を確認。
- `all-tests.log`: 全テストの出力。`test_*.log`は最終生成後の関連検査。
- `baseline-ledger-metrics.json` / `segments-before.log` / `segments-after.log`: 台帳検査の前後。
- 作業スクリプトは修正過程の記録で、定常生成器ではありません。再実行で記事へ同じ追記を重ねないこと。

最終報告はRUNの`fixes-applied.md`とgbrain `implementation/keiri-auto20261002-t8-q08461-2026-10-02`。公開・pushは司令塔の検品後です。
