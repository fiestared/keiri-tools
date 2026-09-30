---
title: keiri-tools r16 t-tanaoroshi-hyo-a 修正報告
created: 2026-09-30
source: Masahiro依頼・r16固定正本と単位審査
tags: [keiri-tools, review, r16]
---

対象: docs/column/tanaoroshi-hyo/index.html。作業場: /Users/masahiroyasu/Scripts/keiri-tools-astra-r16-t-tanaoroshi-hyo-a。origin/main de83e2ef から wt/astra-r16-t-tanaoroshi-hyo-a を作成。pushなし。他モデル・サブエージェント・orca・スキルなし。入力RUNと正本は変更していない。

## 単位と被覆

| 指標 | 審査確定・修正前 | 修正後 |
|---|---:|---:|
| 全単位 |333|333|
| 正本照合ok |212|218|
| nonclaim |63|62|
| out_of_corpus |52|53|
| unresolved |6|0|
| 判定未処理 |0|0|

非主張の導入文1単位を条文に沿う説明に置換し、混合単位から計算機紹介を独立させた。正本外の増加1はその紹介文であり、確認済みに昇格していない。元の正本外52単位はID・text_hashとも不変。oc-opinionはwrong 0件で、not_wrong・unsureの文面を維持した。

既存台帳の機械検査と審査結果は別指標。check_claims --segments実測はcovered 273→271、nonclaims 58→62、unprocessed 2→0、verified 137→218。pending_reviewは42→53。旧台帳のstale ID参照も解消、修正後errorsは0。coveredには正本外の主張への対応を含むが、正本外をverifiedに含めていない。修正後6単位のokは修正担当自身の再照合であり、独立再審査済みとは扱わない。被覆100%は正確性の保証ではない。

入力coverage.jsonは一次結果（confirmed 215＝ok 214＋wrong 1、nonclaim 65、正本外49、unclear 4、未処理0）。上表はそれを独立審査で改訂した212/63/52/6が基準であり、入力coverageの215をokとは読まない。

## 正本に照らした誤り率

一次判定の明示wrongは1、okは214なので、1÷(214＋1)＝0.4651%。審査で追加した明確な条文との不一致（集約の一律禁止）を含めると、確定誤り2、ok 212、2÷(212＋2)＝0.9346%。他のunresolved 4は根拠不足であり、この厳密なwrong率から除外する。6件すべてを「誤り・要修正」とまとめた対応対象率は6÷(212＋6)＝2.7523%で、wrong率とは区別する。

修正後は担当者再照合のok 218、残存確定wrong 0、0÷(218＋0)＝0%。正本外53・非主張62は分母に入れない。独立した修正後レビューの結果ではない。

## 修正内容

- high 2単位: #186 s-02281799e44d3bbb934d-1 と #288 s-fa88607beea770b6e4f8-1。手書きの紙を下書きと位置づけ、転記した電子ファイルを棚卸表とすれば電子保存できるという提案を削除。紙が棚卸表なら紙を保存する説明を残す。本文・FAQ・JSON-LDを同期。根拠はqa_chobo_r8_07.txt:1134-1142（問24）、denchoho_art4.txt:3、denchoki_art2.txt:8-9。
- medium 3単位: #128 s-e53ba9a5afb8885e6526-1 の集約禁止を、異なる種類・品質・型を混在させ区分ごとの数量・単価・金額が分からなくなる集約に限定。#151 s-c87440c5cb5d435b1d94-1 は数量を金額とする誤りを修正。#153 s-915cdd9361d31039f08d-1 は条文が数量を期末棚卸高の根拠として帳簿訂正を要求するという説明を、数量・単価・金額の記載義務と評価方法に沿う単価の説明へ修正。根拠はhoki_arts.txt:3、shoki_arts.txt:4。
- low 1単位: #6 s-347139b4256908fbc29d-1。法令引用と計算機紹介の混合をHTMLの要素で分離。法令引用はhoki_arts.txt:3、shoki_arts.txt:4、denchoki_art2.txt:8、shohi_art36.txt:3に一致。紹介文は書き換えずneeded_source付きの未確認単位として登録。

計算機coreの誤り・改定前の数値は今回の対象に0件。core・境界値テスト・条件表・stale_values.jsonの変更なし。

## コミット・検証

- 525aff135da2a2bb1e5bf12d9066ac6709d3e5c2: HTML修正。
- 10715144f6b6f54d7b8f29f6936e750ca3f23692: 全単位の台帳登録。
- HTMLのコミット後にCHECKABLE全5本（gen_index_sitemap、gen_datemodified、gen_trust_footer、gen_data_source_note、gen_domain_bridge）を実行、変更0。
- FAQ全8問の本文・JSON-LD一致、正本外とverifiedの非重複、全単位被覆をaudit.mjsで確認。

- `export PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js` を設定して `./run_tests.sh` を直列実行。**全292本、290緑・赤2、終了コード1**。
- 赤の前後: ユーザー指定の基点はtest_hojokin_sources・test_layout_visualの2件。修正後も同じ2件、増加0。前者はgen_hojokin_tabs --checkの生成物不一致、後者はPlaywright/Chromium等の環境メタデータdeepStrictEqual。今回変更していない箇所で、テストや期待値を緩めていない。
- 自分で開始した基点の追加実行は序盤で中止し、完走した基点実測として扱っていない。実行中の壊しテストが終了して原状復帰したことを確認後、修正と修正後全件検査へ移った。基点2件という比較はユーザー提示値である。partial-baseline-tests.logは部分記録。
- この作業のブラウザ検査は直列。入力接続テストの子プロセスを確認した時点でもChromium本体は1つ。他セッションを待つロックは使っていない。
- test_layout_renderは**514ページ×6サイズ＝3,084画面、異常0**。対象ページも390/768/1200/1280/1536/1920pxの6幅すべて異常0。test_layout_visualの環境比較が赤なので、画像基準比較まで合格したとは扱わない。
- 最終の `node tools/check_claims.mjs --changed origin/main`、`node tools/check_claims.mjs --segments docs/column/tanaoroshi-hyo/index.html` は緑。FAQ同期・未確認とverifiedの非重複の最終auditも緑。

証跡は作業場のreports/r16-t-tanaoroshi-hyo-a/。tests-after.log、segments-before.txt、segments-after.txt、claims-changed.txt、coverage-audit.json、review.json、layout-summary.json、units-before.json・units-after.json。未確認53単位の必要資料はclaims/column/tanaoroshi-hyo.jsonのpending_reviewに残す。公開判断・pushは司令塔へ委ねる。

DONE
