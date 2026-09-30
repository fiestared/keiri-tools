# r16 t2-a 修正報告（2026-10-01）

作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-r16-t2-a`、ブランチ `wt/astra-r16-t2-a`。基点 `2d0c0862`（fetch後のorigin/main）。push・他モデル・サブエージェント・orca・スキルは使用していない。Chromiumを使う検査は直列で実行し、他セッションを待つ処理は入れていない。

## 修正

審査で unresolved の91単位（high 48 / medium 39 / low 4）と、正本外意見でwrongの8単位（今回付与: high 3 / low 5）、計99単位を修正。合計は **high 51 / medium 39 / low 9**。件数は重複出現を含む確認単位の数で、独立した原因の数ではない。

- high: 令和8年分の提出・給与源泉徴収票の交付期限を令和9年2月1日と明示。①から④を引き算だけで求める説明、特親を扶養控除人数に含める説明、未調整時の配偶者区分、地震保険料の内訳、前職を通算する条件、社会保険料等の範囲、振込額の差の断定を修正。支払調書の年50万円・1回75万円の区分、不動産使用料等の支払者要件、国内役務の要件、みなし提出、写しへのマイナンバー禁止を反映。正本外wrongのうち、引き算と扶養判定の一般化も修正。
- medium: 「4つだけ」「差額から控除を特定できる」という断定を修正。給与等・所得金額調整控除・徴収猶予税額、本人の障害者控除、還付の有無、年末調整していない票、前職通算、収入と合計所得金額、特定親族の生計・所得要件、電子提出の判定枚数、非居住者の調書2種類、訂正・追加の手順を明確化。
- low: 欄名「控除対象扶養親族等の数」、令和8年分の記載要領⑤・⑰、調書の正式名称を修正。正本外wrongの欄位置と国税庁資料の法令時点・No.7455の現行題名も修正。

詳細は worktree の `review/r16-t2-a/changes.md`（99件の修正前後）、`edits.json`、`fix-mapping.json`。FAQ JSON-LD、目次、図のaria-label、計算結果の候補表示も対応する本文に同期。図の期限・提出義務は枠内に収まる短文にし、みなし提出の条件は図の直後で補足した。

変更行に同居する既存数値の補助参照として国税庁No.2582・1177と地方税法321条の5も取得した。出典確認日などはサイト自身の既存記録として区別した。これらはcoversを付けず、元の正本外単位をokへ昇格させていない。

指定正本の該当箇所を開いて確認した。主な根拠は `corpus/01.txt:12-13,80-99`、`02.txt:17-60,117-257,487-498,535-580`、`04.txt:9-26,44-47`、`05.txt:3-16`、`09.txt:38-116`、`12.txt:3-6`、t1 `nencho_all.txt:149-156,2835-2876,6790-6823`。参照した本文は `review/r16-t2-a/sources/` に保存。正本外wrongは国税庁No.1180・7431・7441・7455と令和8年分手引の一次資料を再取得・照合した。

計算 core の誤りは0件。`gensen_kojo_check_core` は本人の障害者控除を候補として持ち、27万円に本人障害者・寡婦・勤労学生の3候補を返す既存実装・検査を確認した。計算の誤りとして赤→緑を捏造せず、誤って確定的に説明していた本文と結果表示を修正した。したがって core・境界値表・条件表の変更はない。旧期限を `tests/stale_values.json` に登録し、拒否3・受入4の7ケースを `tests/test_stale_values_rules.mjs` に追加。

## 被覆の前後

台帳の機械検査値（`node tools/check_claims.mjs --segments <ページ>`）:

| ページ | 単位数 前→後 | covers 前→後 | 独立審査okのverified 前→後 | 非主張 前→後 | CLI未処理 前→後 |
| --- | ---: | ---: | ---: | ---: | ---: |
| gensen-choshuhyo-mikata | 555→556 | 0→199 | 0→138 | 0→180 | 555→177 |
| kyuyo-shiharai-hokokusho | 340→340 | 0→62 | 0→42 | 0→46 | 340→232 |
| shiharai-chosho | 189→191 | 0→87 | 0→66 | 0→34 | 189→70 |
| 合計 | **1084→1087** | **0→348** | **0→246** | **0→260** | **1084→479** |

CLI未処理は **605単位減少**。残る479単位は全て正本外としてneeded_sourceを登録した未確認で、okにもnonclaimにもしていない。`out_of_corpus` は台帳内の未確認記録として保持し、現在のCLIはそれを未処理に数える。正本外を差し引いた未分類は0。

審査上の分類は、修正前が ok 246 / nonclaim 260 / out_of_corpus 487 / unresolved 91。修正後は元のok 246を維持、修正再照合102（元の99単位の修正に伴う分割1と補足2を含む）を主張に対応、nonclaim 260、未確認の正本外479、今回の修正対象の残件0。修正102単位は `author_corrected_pending_independent_review` とし、独立再審査済みのverifiedに水増ししない。

正本外not_wrong・unsureの479単位は文面を維持したことを全件機械照合した。別モデルがwrongとした8単位だけを修正。修正後の被覆率は正確性の保証ではなく、司令塔の検品・独立再照合は別に必要。

なお入力 `coverage.json` の confirmed 281 はsolのok 233＋wrong 48であり、「正しい281件」ではない。本報告の246件はAstra審査のokを使う。

## 正本に照らした誤り率

- 指定正本で採否を決めた元単位: **91 ÷ (246 + 91) = 27.00%**。
- 正本外wrong 8件を追加一次資料で確かめた拡張母集団: **99 ÷ (246 + 99) = 28.70%**。
- 修正担当の再照合では、元の母集団337単位に残るwrongは0（0/337 = 0%）。追加8件を含めても0/345 = 0%。これは修正担当による結果で、独立再審査の誤り率ではない。
- 正本外479・nonclaim260は分母から除外。単位分割・追加によって誤り率を下げないため、前後比較の分母は元単位に固定した。

## コミット・検証

ローカルコミット（pushなし）:

1. `6918fd00bdf0f1a8aba874d78c496054f0b4e176` — 対象3記事のHTMLを先にコミット。
2. `82ae1cd7a9f73385cb4ade9df327bafcbc3c7cf2` — CHECKABLEの全5生成器を実行し、更新日・一覧・sitemapを同期。
3. `59c69f5c2a32f726eb112ad0e535bc0849a32a5d` — 台帳・旧値登録・回帰7ケース。
4. `6677a62472037bce7a93d9d02d9c1aecc1410f77` — 全件検査で見つけた質問検索索引の更新漏れを修正。差分は対象3記事の7フィールドのみ。

テストは `export PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js` を指定して直列実行した。

| 段階 | 緑 | 赤 | 内容 |
| --- | ---: | ---: | --- |
| 基点の全295件 | 293 | 2 | test_hojokin_sources / test_layout_visual |
| 修正後の全295件（59c69f5c） | 292 | 3 | 上記2件＋test_qa（索引更新漏れ） |
| 索引修正後の関連再検査 | 5/5 | 0 | test_qa / test_qa_stopword_drift / test_retention_core / test_uiux_retention / test_generators_fresh |

最終的に残る既知の赤は **2→2件**。追加の赤test_qaはgen_qa_indexの再生成で解消した。全件結果と追加再検査を合わせると293件通過・既存2件失敗だが、索引修正後に全295件を再実行したという意味ではない。HTMLや計算コードを変えず、対象3記事の検索索引だけを更新したため、その生成物を利用する全4検査と生成器鮮度検査を再実行した。途中の進捗でtest_qaの赤を見落としたが、最終集計で発見・修正した。基点・修正後の全ログと追加検査ログを保存し、最初の失敗を上書きしていない。

既存の赤の内訳:
- test_hojokin_sources: `gen_hojokin_tabs.mjs --check` が基点から赤。今回の対象外。
- test_layout_visual: 基点と同じブラウザ環境情報のdeepStrictEqual不一致（期待Playwright 1.62.1 / Chromium 151.0.7922.34）。画像比較の完了は主張しない。環境基準の更新は行っていない。

検証の証跡:
- `baseline-tests.log` / `post-tests.log`、各 `*-tests-summary.json`、`targeted-final-summary.json`。
- 全ページの幾何検査は前後とも **514ページ×6幅＝3,084表示、不具合0件**。`baseline-layout-summary.json` / `post-layout-summary.json` と全JSONのgzipを保存。
- 対象3ページは1280px・390pxの計6表示を個別確認。図のスクリーンショットを目視し、表示不良なし。`rendered/` に証跡。
- `test_gensen_kojo_check` 81ケース、`test_stale_values_rules` 23ケース（既存16＋新規7）、`test_stale_values` 482ページ・68登録が通過。`stale-red-green.json` に元HTMLの旧期限拒否→修正後通過を保存。
- CHECKABLEは `gen_index_sitemap` / `gen_datemodified` / `gen_trust_footer` / `gen_data_source_note` / `gen_domain_bridge` の全5本をHTMLコミット後に実行。`test_generators_fresh` は最終再検査でも緑。さらにgen_qa_indexを実行した。
- `node tools/check_claims.mjs --changed origin/main` は最終差分で緑（`claims-final.log`）。対象3ページの `--segments` も再実行し、前表の未処理数を確認（`segments-final.log`）。
- 元の独立審査okの参照引用について、正規化後8文字以上の1,346行を宣言された参照本文と照合し欠落0（`quote-audit.json`）。意味内容の独立再審査を代替するものではない。
- 正本外479単位の保持、99修正単位の対応、FAQ本文とJSON-LDの一致を再確認。最終HTMLから抽出した単位列が台帳作成時の候補と一致した。
- 入力64ファイルは修正後全件テスト実行中に採取したハッシュと最終時点で一致（`input-integrity.json`）。作業開始時からのハッシュ比較とは主張しない。
- サイト・台帳・テストの変更は `git diff --check` 通過。証跡の原資料・元HTMLには元来の空白があり、証跡一括の空白検査は警告を出すため、原文保持を優先している。pushしていない。公開と独立検品は司令塔の担当。

