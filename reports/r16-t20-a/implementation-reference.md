---
type: concept
title: keiri-tools high予防 段階0〜3 実装報告
created: '2026-09-29T11:40:07.477Z'
ingested_at: '2026-09-29T11:40:07.477Z'
source_kind: put_page
ingested_via: put_page
---

# keiri-tools high予防 段階0〜3 実装報告

実施日: 2026-09-29 JST。担当: Astra/sys2。
段階0〜3の実装・壊しテスト・全件検査・コミットを完了。全件検査の赤と再実行結果は下記のとおり。公開・pushはしていない。

## 作業場と範囲

`git fetch origin` 後、origin/main **6c1885fb** から `wt/astra-sys2` を `~/Scripts/keiri-tools-astra-sys2` に作成。keiri-toolsの実装はこのworktreeだけ。公開・push・実モデル起動・他モデル・サブエージェント・Orca・スキルの使用は0。

commanderはローカルリポジトリを直接編集。既存のwrite.shにあった報告画面IP変更、ownerファイル、Chromeプロファイル等は今回のコミットに含めない。稼働中のrun_theme.sh/run_t4567.sh/t4b〜t7出力には書き込まない。

## 段階0: 正本・受け渡し・起源

- prompts/write.mdの手順2: 登録テーマはsource_registryの固定正本を先に読み、source_quote/corpus_refを残す。テーマ外は「該当テーマなし」とRUN内の最小registryを要求。
- write.sh → tools/write_completion.py: writer rc、result.md、HEAD実在、対象ブランチ、origin/mainにないコミット、tracked/untracked差分なし、COMMIT等のプレースホルダなしを検査。報告内のSHAもHEADと照合する。
- 独立審査のreview-summary.jsonにあるtreeとコミットtree、範囲、未処理0・未解決high0、審査証跡hashを照合。成功時のみreview-receipt.json。失敗時は古いreceiptを消し、既存notify block、終了1。外部への通知はテストで実行していない。
- lib.sh → tools/pending_opus.py: origin/mainに未掲載のブランチに加え、未コミット下書きがあるpublish/opus-*も在庫。ブランチ単位に重複除去。
- tools/high_origin.py: census106所見へhigh_originを記録。既存根拠の工程分類は初回執筆12・計算機実装8・改稿2・未特定84。introduced_commitをblameから推定で埋めない。逐語が一意にある場合だけblameを補助証拠にする。未コミットページでblame不能な場合・未コミット行の全ゼロSHAは起源コミットにせず、未特定を保つ（追加の正例が赤→修正後緑）。単位周のhigh候補にも起源未特定の記録を出す（sol_candidateと明示）。

## 段階1: 確認単位・被覆

- tools/segment_claims.mjs: JSDOMでtitle/meta/OG・見出し・本文・表・SVG text・FAQ・入力ラベル/選択肢/静的初期値/placeholder等を列挙。本文は文単位。語の存在で落とす検査ではない。NFKC・空白・太字の違いを正規化し、同文の別出現は別ID。
- claims/_TEMPLATE.jsonへcovers/nonclaims/verified/topicを追加。旧台帳の変更不要。非主張は理由必須、要約部とFAQ回答は非主張にできない。
- check_claims --segmentsは単位検査だけ。既存在庫の不足は警告、SEGMENTS_STRICT=1で関門。新規ページまたは分岐点に存在しなかった台帳を新規作成したページは全文を強制。既存の台帳なしページに対する警告実行を新規扱いしない。台帳だけの新規追加も検査対象。
- 従来のcheck_claims --changedの数値・出典検査を維持し、新規コホートでは単位検査も自動実行。write.mdでは両コマンドを要求。
- tools/coverage_report.mjsの実測（r11/pages_top.txtの上位120ページ）: **36,157単位、主張ID対応0、独立照合記録0、nonclaims0、未処理36,157、対応率/記録率とも0%**。旧主張件数を対応済みに換算しない。出力coverage-top120.jsonはコミットしない。**被覆100%は正確性の保証ではない**。

## 段階2: 条件表

- tests/conditions/{jutaku_core,gensen_hyo_core,santei_core,gensen_kyuyo_core}.json: **4/60 core、18条件、pending56**。t4住宅ローン、t2源泉徴収票、b1算定、t1/r10給与源泉を優先。
- tests/test_condition_tables.mjsとtools/condition_tables.mjs: 入力IDが一意に存在すること、入力条件に2件以上の一次資料つき実行ケース、固定/対象外の要素を一意に名指しして全文を照合、排他/端数処理の専用ケース、HTMLから読む初期値ケースを検査。
- 境界表の既存ケースを名前で接続して実行する。追加の条件ケースはtests/conditions/cases.mjs。旧boundariesのpending11とは別の移行台帳。
- _status.json: 基点に存在したcoreだけを初期pendingにでき、過去のstatus履歴との積集合より増やせない。新規coreは表か理由つき対象外が必須。
- **発見して修正したcoreの誤り0件、core/公開HTMLの変更0**。住宅ローン初期値の検査を最初は認定住宅と誤認して210,000円と置いたが、実HTMLの選択は省エネ基準適合住宅。t4正本nta_1211-1の令和8/9年14万円上限を読み直し、期待値を140,000円に修正した。coreのバグ修正として数えない。
- 条件表の登録は重要条件から。18行を全法律上の条件の網羅と称さない。残りcoreと、登録済coreの条件拡充は段階4。b1 censusで未修正とされたhojokin_zeimu_coreもpendingに残り、今回その内容審査や修正完了を新たに確認したとはしない。

## 段階3: 単位周・未コミット照合

- tools/theme_round.py --segmentsとtheme_segments.py: ページから抽出した固定単位を20〜40件に分割。coverage.jsonに総数/確認/非主張/正本外/unclear/未処理/単位→主張IDを記録。
- 欠落・未知・重複ID、text_hashずれ、判定抜け、正本の指定行にない逐語、wrong/unclearの所見抜け、保護単位のnonclaimを拒否。不成立の束ではAstraへ進まない。同runの完成した束は再利用し、未処理だけを進める。
- --draft-worktreeはtracked+untrackedの実ファイルを固定コピー。元worktreeとindexは変更しない。コピーを読取専用にし、SHA256と実行属性を前後で検証。コピー専用Git indexから将来のコミットtreeを算出する。RUNを元worktreeの中へ置く指定は拒否。
- 独立審査の対象も固定コピー。修正が必要なら未解決として書き手へ返し、新snapshotで再照合する。正本外はwrongにせず必要資料を要求。正本外を残したまま公開用receiptにはしない。
- write.mdへsol→Astra→司令塔検品を接続。新規・改稿とも当面は指定ページ全文を渡す（変更単位と同じ主張の全出現を含める保守的な実装）。最終treeが変わる追加生成・修正の後は再照合が必要。
- テンプレはKT tools/review_templates。既存の稼働中テンプレやrunスクリプトは変更しない。テーマ外は--registry/--corpus-dirでRUN内正本を渡せる。

## 壊しテスト

すべて無傷の緑を先に確認。実サイトの原本は壊さず、一時Gitリポジトリ・DOM文字列・メモリ上のcoreコピーを使用。

- coversを1件削除→赤、metaへ「だけです」を追加→赤、要約をnonclaimsへ→赤。
- 太字解除/空白変更/パンくず/関連記事追加→緑。同文別出現のIDは重複しない。OG/SVG/UI/FAQを列挙。
- 歴史fixture: r11 high-historyにある実HTML行19件を出典SHA/行番号つきで登録。**19/19を列挙、対応欠落19/19を拒否**。意味上の誤りを自動再検出した数字ではない。Opus案の93引用79件と同じ母集団ではない。
- 新規ページを全対応させる→緑、そのcovers欠落→赤。コミット済みの新規も赤。既存ページ/台帳なし在庫の警告は緑、STRICTは赤。台帳だけの追加も強制。
- 実給与coreの寡婦/ひとり親の排他をメモリ上で外す→赤。scope-note削除/hidden化→赤。pending増加/完了coreのpending戻し→赤。源泉徴収票HTMLの基礎控除初期値を58万円に戻す→赤。
- 単位周: 未コミット2ページをコピーして無傷の全ID応答→緑。ID欠落/未知/判定抜け/所見抜け/要約の非主張はAstra呼出し0。復元・再開後のAstra stub→review-summary生成、sourceをコミットするとtree一致。コピー改変→停止。
- 受け渡し: 正常コミット＋一致する審査証跡→receipt、非ゼロrc/COMMIT残り/未コミット/未解決high/tree不一致→拒否して古いreceiptも削除。未コミットだけのブランチも在庫に算入。

## 検証・コミット

- 基点: **277/279緑、赤2、終了1**。test_hojokin_sources（既存の生成物不一致）とtest_layout_visual（Playwright/Chromiumの環境メタデータ差）。[baseline-tests.log](baseline-tests.log)。実装の組み込み対象3ファイルは基点状態を保ち、基点完走後に差分を適用した。
- 基点の描画: **511ページ×6サイズ＝3,066画面、異常0**。[baseline-layout-summary.json](baseline-layout-summary.json)。
- 組み込み後の重点検査: **10/10コマンド緑**。旧check_claims、旧theme_round（7 tests）と、新規の単位/条件/CLI/draft stubを含む。[targeted-tests.log](targeted-tests.log)、[targeted-tests.json](targeted-tests.json)。
- commanderの受け渡し/起源テスト2ファイル・3 testsも緑。シェル構文検査緑。実際の通知は呼んでいない。
- 実装後の初回全件検査は282/285緑・赤3。追加の赤test_source_pipeline.pyは、findNumbersを単独利用する既存fixtureでも新しいsegment_claims.mjsを静的importしていたため。単位抽出のimportをCLI実行時へ移し、既存8 testsの赤→緑を確認。テストを緩めず互換性を修正した。[post-first-tests.log](post-first-tests.log)。
- 修正後の全件テスト: **282/285緑、赤3、終了1**。source_pipelineは緑。基点と同じ2件に加え、変更していないtest_retention_pagesでresultのsuccess待ちが7秒タイムアウトした。[post-tests.log](post-tests.log)。テスト・HTMLを変更せず同検査だけ再実行し、**1/1緑、終了0**。[retention-retry.log](retention-retry.log)。再実行で解消したタイムアウトを隠して「全件283/285緑」とは記録しない。残存の赤は基点と同じ2件。
- 修正後の描画: **511ページ×6サイズ＝3,066画面、異常0**。[post-layout-summary.json](post-layout-summary.json)。
- 検査開始前からコミット後まで入力**2,241ファイルのSHA256差分0**。公開HTML/core変更0、worktreeの未コミット差分0。[final-verification.json](final-verification.json)。条件表pendingのGit履歴検査はコミット後にも再実行して緑。[condition-post-commit.log](condition-post-commit.log)。
- commanderコミット: 759fea107eda8d9b085ce1ede86c412668b8822e（主実装）、c6d04379ac187b8aed8a91cb59ad2cc191842c81（完了記録の型検査）、913aa0d621894be9be9f0628185a222524e302f4（固定正本の起点を明示）、a422173114e91c7cd292933126931c54123aaec1（未コミットの起源記録）。write.shの既存IP差分は未コミットのまま維持。
- keiri-toolsコミット: **5b0e567ad6b92edab8088a6383f87c357f4943ba**（wt/astra-sys2、23ファイル）。明示したパスだけadd。pushなし。

## 残すもの

実モデルの照合と新規記事の公開実走は実施していない。120ページの実際のcovers/nonclaims整備、残り56 core、登録済coreの条件網羅拡充、既存記事の変更単位への厳格化は段階4。JSが動的に生成する文章/選択肢は静的抽出の外に残り、条件表/E2Eを併用する。CLAUDE.mdの既存9規則は変更しない。

## 引き渡し

この報告を `gbrain put implementation/keiri-high-severity-prevention-2026-09-29 < impl.md` で保存し、`gbrain get` で全文を読み戻して照合する。成功後だけローカルimpl.mdの末尾へDONEを付ける。読み戻しと照合結果は同じRUNのgbrain-get.md / gbrain-verification.jsonに残す。

## 司令塔の検品と公開（2026-09-29 22:1x JST）
- 公開 → origin/main **465538e6**（5b0e567a を最新 main 63295149 に cherry-pick、衝突なし）。全テスト 283/285 緑（赤は基点 test_hojokin_sources・test_layout_visual）。新規の test_condition_tables・test_segment_claims・test_check_claims・test_generators_fresh を個別にも確認。keiri-commander 側（write.md・write.sh・write_completion.py・pending_opus.py・high_origin.py）はローカル commit 済み。
- 実測の出発点: 上位120ページ = 36,157 確認単位、確認済み 0%。条件表 4/60 core・18条件。
- 次: 単位モードのレビュー r13（sol→Astra）。

## 2026-09-29 23:3x 訂正: 単位の全被覆の関門を新規記事だけに（f1daf326、t5 の公開ブランチに同梱）
- sys2 は「既存ページに初めて台帳を足した」だけでも全確認単位の被覆を関門にしていた（check_claims.mjs の changedPages が追加台帳を isNew に昇格＋newLedger が台帳の新規作成を fresh 扱い）。t5 の載せ直しで juminzei-hikazei-border 190・embed/juminzei 73 単位が赤。
- 訂正のたびに公開が止まり「台帳を足さない方が得」になるので、統合設計の「新規記事だけ強制」に戻した。既存ページ＝足した行の検査・被覆は警告（SEGMENTS_STRICT=1 で関門）。tests/test_segments_cli.py の期待値を更新（新規ページの covers 欠落→赤は維持）。
