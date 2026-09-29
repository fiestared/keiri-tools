# 正本からの継続更新（段階0〜3）

公開は司令塔（Claude）の検品後。これらのスクリプトは push しない。
原文はリポジトリ外 `~/Scripts/keiri-commander/corpus/<theme>/<取得日>/<時刻>/` に保存する。

## 定時監視

既存の `keiri-commander/daily.sh` から `python3 tools/source_monitor.py --out <日報dir>` を呼ぶ。
年度と引用日付の既存2本を呼び、JSON、stderr、各終了コード、`source-monitor.md` を保存する。
年度の発見／未公表／確認不能と、引用日付のずれ／一致／確認不能は別に数える。
取得不能・URL未登録は未公表にしない。固定URLの404・移転・年ラベル消失も確認不能。
新規plistは不要。先にkeiri-toolsのこの変更を司令塔が統合してからdaily.shを使用する。

## sol台帳の移行

```sh
python3 tools/import_sol_claims.py --runs ~/Scripts/keiri-commander/runs/review-loop --report /tmp/import-report.json
```

入力は `t1..t4/out/*.json` の読み取りのみ。既存台帳は保持し、`round/batch/page/id` で再実行を重複排除する。
`ok` は指定行を原文から抜粋し、その文字列がローカル正本に実在することを検査する。
1行だけのlocatorはそこから最大13行を文脈として保存する。複数箇所は `supporting_sources` に分ける。
solの要約・省略記号入り引用は `sol_quote` として区別し、逐語欄には使わない。
画像PDF/OCRを含む根拠は主張全体を除外し、件数を報告する。
`wrong` は既存台帳に採用・修正済みの主張と実在する逐語がある場合にのみ対応付ける。
不採用・未修正・採否不明のwrongを元の誤った文で追加しない。
`applies_period.years` は主張が明示する年を数値化する。年が明示されない主張は未特定とし、資料の発行年を適用年にしない。
主張の内容の再審査、既存の全ページ台帳不足の補完はこの変換器の処理ではない。

終了コード0は移行対象の処理完了、4は解決不能なlocatorまたは既存キーの入力変更あり。`wrong_not_imported`・`ocr_excluded` は報告に残る。
追加内容は通常の `node tools/check_claims.mjs <docs/.../index.html> ...` で全ページ単位に検査する。
ページ全体の未登録数字・例外・公表例をダミーの台帳で埋めたり、検査対象から除外して緑にしない。

## 再取得・影響候補

```sh
python3 tools/fetch_corpus.py t1 --report /tmp/t1-impact.json --pages /tmp/t1-pages.txt
```

初回比較先は登録簿の `local_raw/local_text`（旧テーマ正本）。以後は直前の取得・抽出成功snapshotを自動選択する。取得失敗・画像PDF等の未検証snapshotは比較元にしない。比較元を固定したい場合は `--baseline <snapshot>` を指定する。
`--runs` と `--store` で別マシンの保存先を指定できる。取得は直列、1秒間隔。
rawと抽出テキストのSHA256、文字コード、原文diffを保存する。過去snapshotは上書きしない。
HTTP/metaの文字コードが矛盾した場合はエラー。Shift_JISはCP932で厳密に読む。
PDFは `pdftotext -layout`。画像PDF、または日本語が出ないページがあれば未検証として赤にする（OCRで自動補完しない）。
`quote_missing` は取得・抽出できた新版で引用が見つからない変更候補であり誤り判定ではない。取得・抽出不能の資料の引用は `quote_unchecked`（source_unavailable）に分け、欠落と呼ばない。URL未登録の主張や引用以外の条件変更を網羅する検査ではない。
終了0＝原文不変・登録引用一致、3＝原文変更または引用欠落、4＝取得/抽出不能。
CLIの `--pages` は該当引用のページを出す。エラーがあるreportから範囲を絞ってテーマ周を始めてはならない。

## テーマ周

```sh
~/Scripts/keiri-commander/runs/review-loop/theme_round.sh t1 --pages /tmp/t1-impact.json --prepare-only
~/Scripts/keiri-commander/runs/review-loop/theme_round.sh t1 --run-dir <作成されたrun>
```

`--pages` はページ一覧テキストまたは `quote_missing` を持つJSON。JSONなら、そのreportが指す再取得snapshotをhash検証して照合用正本として固定する。テキストの場合も `--corpus-report <report.json>` で新版を指定できる。指定なしは既存tN正本。pages省略時は既存の `tN/pages_full.txt`。
既存t1〜t4を変更せず `theme-runs/<theme>/<時刻>/` に正本・テンプレ・ページ集合とsiteの固定版を保存する。
本実行は既存 `sol_theme.md` / `astra_theme.md` を使う。solもAstraも直列。
全ページdone、主張件数の整合、全batchが揃ってからAstraへ進む。
`--check-only` はbatchの検査だけ。`STOPPED` が1件なら同じthemeの再実行で自動再開、複数なら `--run-dir` で選ぶ。
正常なsol batchは再実行しない。正本・対象ページ・siteの改変時は停止する。
完了は当該実行で書かれた `fixes.md` の末尾DONEと終了0が必要。`publish-request` は検品依頼ファイルであり公開処理ではない。
`KEIRI_TOOLS_DIR` でこの実装のworktreeを指定できる。テストではworkerをスタブ化し、実モデルを呼ばない。

## 後続

R9切替・gensen URLロールオーバーは **BL-065（2026-12-15まで）**。
`_meta.source_id`等（推奨順5）は今回対象外。
