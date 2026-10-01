# auto20261001 t1x-q2 修正結果

2026-10-01 JST。作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261001-t1x-q2`。ブランチ: `wt/astra-auto20261001-t1x-q2`。基点: `f8c2cfe1b23af1baed38bb56ddd31608d2eea3d1`。他モデル・サブエージェント・orca・スキル・pushは使用していない。

## 修正

high 0、medium 3、low 0。計算coreの誤りは今回の指摘にないため、core・境界値・条件表の変更なし。数値の改定や旧値の訂正もなく、stale_values.jsonへの追加対象なし。

- 本文 通番32 / `s-e9220b13b1ac5245e823-1`: 国外居住親族の書類条件に、30歳以上70歳未満の対象留学生に必要な留学ビザ等書類の添付・提示を追加。
- 本文 通番58 / `s-de1c4a24fdef67657441-1`: 「正確な源泉税」を計算機で確認できるとの保証を、対応範囲・入力条件を確認して試算する案内に訂正。
- 埋め込み 通番187 / `s-ecc420c9ebaea16d3e3a-1`: 相互適用等による除外、障害者等加算の申告書記載、国外居住親族の書類・対象留学生の留学ビザ等書類を本文と同じ条件で説明。

正本の該当箇所を直接開いて照合した。中心根拠は `corpus/zeigakuhyo/www_nta_go_jp_publication_pamph_gensen_zeigakuhyo2026_data_19_22_pdf.txt:45-102`、同 `15_16_pdf.txt:49-68,110-126`、`www_nta_go_jp_taxes_shiraberu_taxanswer_gensen_2523_htm.txt:25-47`。証跡の `source-excerpts.json` に逐語・URL・LF行番号を保存。PDFの改ページ文字を行として数えるPython splitlinesではなく、LF基準で照合している。

入力206単位と基点の本文は完全一致。変更したのは上記3単位だけ。`oc-opinion.json` はnot_wrong 72、unsure 13、wrong 0。正本外85単位の本文はすべて不変で、needed_source付きunconfirmedに残した。

## 単位と被覆

入力coverage.json（sol集計）は確認45・非主張80・正本外80・unclear1だったが、今回の基準は独立審査の確認43・非主張75・正本外85・unresolved3。両者を混同しない。

|独立審査の206単位|修正前|修正後|
|---|---:|---:|
|確認済みok（独立審査）|43|43|
|作業者修正・正本再照合済み、独立再審査待ち|0|3|
|非主張|75|75|
|正本外・必要資料待ち|85|85|
|未修正unresolved|3|0|
|分類漏れ|0|0|

修正前の正本に照らした誤り率は **3÷(43＋3)＝6.52%**。正本外・非主張は分母に含めない。修正後の作業者照合では残存wrong 0、0÷(46＋0)＝0%だが、修正3件について独立再審査が済んだという意味ではない。

基点mainには別便t1x-q4の被覆登録が既に存在した。次は実際のcheck_claims/validateSegmentsの前後であり、未登録0から始めた値ではない。

|ページ|単位|主張への対応 前→後|独立確認済み 前→後|非主張 前→後|検査上の未処理 前→後|
|---|---:|---:|---:|---:|---:|
|bonus-tedori|164→164|36→40|31→38|59→52|69→72|
|embed/bonus-tedori|42→42|5→6|4→5|24→23|13→13|
|合計|206→206|41→46|35→43|83→75|82→85|

**未処理数は減少せず82→85になった。** 今回okの4単位を新たに被覆した一方、既存台帳で被覆/非主張となっていた正本外7単位を未確認に戻したため、差引3増。7単位は本体の `s-f30f927a866f998acc9e-1`、`s-334220e4b41c156035ae-1`、`s-b7534e076e05a2da901a-1`、`s-7b3dcae71931b7741e4d-1`、`s-11a949c2eed83dc43f8c-1`、`s-3d9c9b03aa87add8d856-1`、`s-2298228feb1bb2b04c6a-1`。正本外をokにしない指示を優先し、被覆数を増やす目的でcoversに入れていない。

最終の未処理85はすべてneeded_source付きの正本外であり、分類漏れ0。既存check_claimsはunconfirmedを被覆と数えない。被覆率は正確性を保証しない。旧主張は履歴として保持し、今回のcovers/nonclaims/verified/unconfirmedに現行の判定を登録した。修正3単位はcoversへ結びつけたがverifiedには入れていない。

## コミットと検証

- HTMLを先にコミット: `e01351ede8ea611869989ca1ba30787694152dab`。
- 台帳・審査証跡: `fbfcb8ed5120bdda1ee47233e8af2323ad347760`。
- HTMLコミット後にtest_generators_freshのCHECKABLE全5本を実行。生成物の差分0、鮮度検査は緑。
- `node tools/check_claims.mjs --changed origin/main`: 緑。
- `node tools/check_claims.mjs --segments docs/bonus-tedori/index.html docs/embed/bonus-tedori/index.html`: 終了0。未処理警告は上記85件。
- 基点の赤は依頼で提示された `test_hojokin_sources`・`test_layout_visual` の2件。今回の基点再実行は途中で停止し、完走した実測とは扱わない。実行中の壊しテストが終了・復元した境界で停止し、git diffが空であることを確認してから修正した。途中ログはbaseline-tests.logに保存。
- 修正後全テスト: 最初のrun_tests.shは40件緑の後、break_papa_ikukyuの途中で終了143となった（原因未特定）。追跡ファイルが復元済みであることを確認し、同じ探索範囲（tests/*.mjs と tests/test_*.py）の残りを直列再開した。完了済み40件は繰り返していない。post-tests.log・resumed-tests.log・resumed-results.jsonを合わせて全299件の実行結果を照合する。結果は **298/299緑、赤1件**。重複なしの299件がrun_tests.shの探索対象と完全一致することを照合済み。再開用ラッパーの終了は0だが、個別結果の集計は赤1件であり、全緑とは扱わない。

検証時のPLAYWRIGHT_PATHは `/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js`。テストは直列実行し、この作業内のChromium検査を並行起動していない。他セッションの終了待ちや操作はしていない。

- 最終の赤: `test_layout_visual.mjs`。指定Playwrightは1.58.2・Chromium 145.0.7632.6、基準画像の環境は1.62.1・151.0.7922.34。環境メタデータの不一致で停止しており、基準画像やテストを緩めていない。
- 赤の前後: 依頼提示の基点2件 → 今回実測1件。`test_hojokin_sources.mjs` は緑。基点全件を今回完走していないため、その緑化を本修正の成果とは主張しない。追加の赤0件。
- 全ページ描画: **514ページ×6サイズ＝3,084画面、問題0件**。本体・埋め込みの各6サイズ、合計12画面も問題0件。
- 正本・入力77ファイルの記録済みSHA256は最終照合で一致。現在の206単位も保存した修正後単位と完全一致。
- 証跡: `/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261001-t1x-q2/review/auto20261001-t1x-q2/`。coverage-comparison.json、audit.json、fixed-segments.json、test-summary.json、resumed-results.json、layout-summary.jsonと実行ログを保存。
