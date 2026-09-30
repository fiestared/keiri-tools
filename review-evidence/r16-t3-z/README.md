# r16 / t3-z 修正の照合記録

対象: `docs/column/koyou-hokenryo-ritsu/index.html`。制度照合日: 2026-10-01 JST。

固定正本は commander の `runs/review-loop/r16/t3-z/corpus/`。元の入力は変更していない。`input-hashes.json` が入力の同一性、`segment-adjudication-input.json` が109 ok / 61 nonclaim / 116 out_of_corpus / 14 unresolvedの元審査、`repair-map.json` が変更前後の対応を記録する。

修正対象は元の18単位（未解決14、正本外で別モデルwrongの4）。文を分割した後は21単位であり、20主張と1非主張。high 5 / medium 11 / low 2は**元の単位数**（同じ論点の別出現を含む）。正本外の加入除外3単位は加入・控除を誤らせるためhigh、二事業の用途1単位はmediumとした。

`claims/column/koyou-hokenryo-ritsu.json` の `verified` は元の独立審査ok109単位のみ。修正文20単位は `repair_checks` / `review_result: writer_rechecked` に分離し、第三者による新snapshot審査済みとはしない。`unverified` の112単位は元の文面・ID・text_hashを維持し、needed_sourceと別モデルのnot_wrong/unsureを保持する。被覆は正確性の保証ではない。

固定正本に照らした修正前誤り率: 14 / (109 + 14) = 11.38%。正本外116と非主張61は分母に含めない。追加一次資料でwrongを確認した4単位も固定正本の母集団へ後付けしない。

追加一次資料はe-Gov雇用保険法6条・37条の5・62条・63条、労働保険徴収法11条・31条。`additional-sources.json` は取得したXMLからの条文抜粋、`additional-source-manifest.json` は取得先・取得日・原本SHA。`expansion.txt` は同じ変更行に残る既存の2028年10月/10時間を台帳の数字検査に登録するための補助資料であり、元の正本外単位をokへ移さない。

再現コマンド:

- `node tests/test_koyou_article_conditions.mjs`（6条件の回帰検査）
- `node tools/check_claims.mjs --segments docs/column/koyou-hokenryo-ritsu/index.html`
- `node tools/check_claims.mjs --changed origin/main`

最終のコミット・全テスト・生成器の結果は commander の `runs/review-loop/r16/t3-z/fixes-applied.md` を参照。
