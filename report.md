# keiri-tools UI/UX 再レビュー — 2026-09-27

## 結果・範囲

全268テストが緑。全511ページ×6画面幅＝3,066件、全100ツール×2幅×4状態＝800状態で検出異常0件。指定された4ページの空枠を修正し、生成・共通表示・実ブラウザ検査の各段階で再発を防ぐ仕組みを追加した。

Astraが直接実施。他モデル・orca・スキルは使っていない。作業場は `/Users/masahiroyasu/Scripts/keiri-tools-uiux-0927`、ブランチは `wt/uiux-0927`、開始点は `8ae8be5e8f5404b24ec521463e5e4fb7bd2f7013`。push・本番公開・課金操作・AdSense設定変更なし。

指定refs（layout-audit-report、rail-toc-report、design-system、creative_ui-ux-aesthetics、no-left-accent-border-cards、過去Fable監査2本、audience-memory）を先に読んだ。gbrainは `creative/ui-ux-standards`、`decisions/keiri-experiment-protection-lifted-2026-09-25`、`decisions/keiri-tools-nav-local-fixes-2026-09-16`、`keiri-tools/pv-per-session-strategy-2026-09`、`ops/keiri-tools-worker-collision` の全文を取得した。スキル禁止を優先した。

本文・数値・リンク先を維持し、入口記事を薄くしていない。銀行プリセット、計算後の導線、記事内の次の疑問を保持。511 HTMLの本文照合、全リンク先の重複数を含む照合、AdSenseスクリプト照合はいずれも差分0件。

司令塔担当の `tools/gen_layout_markup.mjs` は無変更。`docs/{shiharai-site,eigyobi,nenshu}/index.html` の差分は共通 `empty-state.js` を読む1行だけで、目次・既存HTMLは無変更。最初は3ページ全体を除外していたが、全件検査で /nenshu/ の万円の折返しから共通保護の読み込み漏れを発見した。目次作業とは分けて共通保護を全511ページへ配線し、読み込み漏れ自体も必須検査にした。

## 見た画面

代表25ページを1280×900・1536×864・1920×1080・1200×800・768×1024・390×844で開き、ページ末尾まで順にスクロールして撮影・計測した。保存画像を開き、ヘッダー、パンくず、h1、導入、目次・関連、入力、結果、表、図、FAQ、次に読む、出典、フッターを確認した。

| 型 | パス |
|---|---|
| トップ・一覧 | /、/column/ |
| PRあり・長い記事 | /column/furikomi-tesuryo-hikaku/、/column/hoteichosho-goukeihyo/ |
| PRなし・図表記事 | /column/shakai-hoken-kanyu-joken/、/column/shunyu-shotoku-chigai/ |
| 投資・比較・比較的短い記事 | /column/emaxis-sp-vs-sbi-sp/、/column/orcan-sp500-holding-period/ |
| 入力・表・結果の異なるツール | /tedori/、/iryohi/、/kihonteate/、/shobyo/、/gensen-hyo/、/shiharai-site/ |
| 補助金 | /hojokin/、/hojokin/koyou/、/hojokin/schedule/ |
| 投資ハブ | /toushi/ |
| 運営・ポリシー | /about/、/privacy/、/policy/disclosure/、/policy/editorial/ |
| embed | /embed/、/embed/tedori/、/embed/iryohi/ |

追加重点確認: /zengin-kana/、/yakuin-shataku/、/column/shisanhyo-mikata/、/column/shukkin-denpyo/、/column/denchoho-kensaku-yoken/、/column/denchoho-wakariyasuku/、/column/nenmatsu-chosei-kanpukin/、/column/orcan-vs-emaxis-sp/、/column/orcan-sp500-recovery-days/、/nenshu/。

実計算の確認例: 手取り237,060円、医療費控除200,000円、基本手当756,840円、傷病手当金6,667円、支払予定日12行。全100ツールの正常入力・出力も操作検査JSONに残した。

証拠の基点は作業場の `reports/uiux-0927/`。パスと画像の対応は `review-coverage.json`、`before/measurements.json`、`after/measurements.json`。初回の投資記事URL誤指定6件は404だったため、修正前の有効全景は144件。holding-periodの記事を含む修正途中の全景150件はすべて成功した。404を成功に数えていない。

保存済み全景は途中版を含む。最後の投資3記事の上部は本対話で実画像を表示し、フッターは小さい要素画像6枚と `footer-evidence.json` を追加した。最終版の合否は最終3,066件の計測・32画像比較・操作検査で確認。全景を大量に撮り直していない。

## 空の箱

原因は、注意・結果・関連の外観を内容の有無と独立して描き、従来検査が「枠はあるが中身がない」を見ていなかったこと。

修正前の全511ページ×1280/390走査では、通常初期表示3ページ・6件。役員社宅は正常なデータ取得後に説明が入るため、取得失敗とJS無効で4ページ目を再現した。

| 対象 | 修正前の寸法（1280 / 390） | 修正後 |
|---|---|---|
| zengin-kana #copyErr | 630×22 / 316×22px | 空なら非表示。失敗の本文が入れば表示 |
| yakuin-shataku #menseki-note | 630×22 / 316×22px | 空なら非表示。JS未実行・データ取得失敗でも空枠なし |
| shisanhyo-mikata section.related | 672×21 / 358×21px | 空sectionを生成しない |
| shukkin-denpyo section.related | 672×21 / 358×21px | 空sectionを生成しない |

前後画像は `before/evidence/` と `after/evidence/` の `_zengin-kana_-{1280,390}.png`、`_yakuin-shataku_-{1280,390}.png`、`_column_shisanhyo-mikata_-{1280,390}.png`、`_column_shukkin-denpyo_-{1280,390}.png`。両方の `metrics.json` にgetBoundingClientRectの値と修正後のnullを記録した。

印刷でも同じ検査をかけ、途中検査で275ページに空の関連領域を発見。既存印刷CSSがリンクだけを消していたため、印刷では関連領域全体を非表示にした。

| 洗い出した型 | 仕組み |
|---|---|
| 空の注意・警告・結果・live region | 共通CSSの:emptyでJS実行前から非表示 |
| 空白だけ・非表示の子だけ・閉じたdetailsの内容だけ・content-visibility:hidden | 共通JSが可視内容を判定し、専用属性で非表示を管理 |
| 空の関連section・関連見出しだけ | 生成器が空sectionを除去。リンクのない関連見出しも常設検査で拒否 |
| 結果見出しだけ・コピーボタンだけ | 意味のある結果に数えない。回答自体が見出しの「35,000円」「対象外」は保持 |
| placeholder・TODO・ダッシュだけ | 常設検査で拒否 |
| 空のfieldset・details・form・nav・dl・table・表行 | 背景・罫線のある無内容コンテナとして検出 |
| 古いコピー警告・コピー拒否 | 全銀カナでコピー拒否を表示し、空入力への再変換で古い警告と操作を解除 |
| 計算・不正入力・クリア・再計算、保存・開閉 | 操作後にも同じ可視内容検査 |

共通JSは元の意図的な非表示を勝手に解除せず、自身の属性だけを管理する。空live regionを削除して後の通知を失わせない。直接空の器はCSS、空白や隠れた内容はJS、静的空sectionは生成器で防ぐ。

許可リスト0件。ページ単位除外なし。装飾用hr・SVG内部の図形・個々の空セルは内容コンテナではないので対象定義から外すが、空の行全体は検査する。

全100ツール×2幅×4状態＝800状態を実行。正常シーンのない新ツールは失敗する。自由入力のない /jidoshazei/、/embed/jidoshazei/、/embed/shiharai-site/、/hojokin/koyou/、/hojokin/schedule/ は、自由入力によるエラー・クリアを作れない理由をJSONに記録し、現在の選択で再描画した各状態を検査した。ページを検査から外してはいない。不正候補値は-1・1900-01-01・!等で、全ツールが必ず警告を出すという主張ではない。

壊し検査は空状態10種＋コンテナ6種＋placeholder2種を両幅で拒否。空note・空related・空結果枠を実際に見える状態にすると落ち、保護を戻すと通る。実メッセージの再表示・再クリア、コピー拒否、保存、開閉、JS無効も確認済み。

## そのほかの修正と数値

- 操作対象: 修正前26ページ・137要素/幅の組合せで44px未満。button・summary・ボタン相当リンクを最低44px、フォーカスを2pxの輪郭に統一。
- 入力の優先順位: 21ツールで狭い画面の目次・関連記事より入力カードを先にした。医療費390の入力上端1103.45→636.88px。PC1280は469.75pxのまま。
- 記事の優先順位: 投資3記事で目次がh1より先に出る状態を修正。390のh1上端は182.48px。文章を削らずタイトル・導入を先に読める順序にした。
- 金額・単位: 符号・万円・月数を途中で切らない。静的HTMLの数字は変えず共通JSで静的表・計算後の表を整える。単位保持に伴って途中版で出た5ツール（chukai-tesuryo、fudosan-shutoku、kokuho、kotei-shisanzei、toroku-menkyozei）の結果表の横あふれも共通スクロール枠で解消。
- 印刷: 修正前76ページ・96枠で表が縦に切れていた。印刷時のmax-heightと内部スクロールを解除。通常画面の結果表にも不要な縦の高さ制限を持ち込まない。
- コントラスト: 年末調整還付金記事の警告面2リンクは4.374:1。既存の文字用トークンへ変更して5.42:1にした。
- パンくず: 最後の区切りがない29ページに補助クラスを付け、CSSで区切りを描く。本文・リンク文字列は維持。
- 文字参照: 次に読むの二重エスケープを修正。候補・並び・90文字の切断位置は維持。目次はデコードした文字列が参照先見出しと一致する場合だけ修復し、意図した短縮ラベルは変えない。
- 長すぎる関連記事: 電帳法2記事の356件を、先頭3件＋残りの開閉に変更。全リンクと順序を保持。検索要件記事の領域高は1280で48956.33→441.53px、390で77709.06→701.16px。ページ全高61318→12803px、95905→18873px。
- 重複フッター: 投資3記事の同一更新通知2行を可視1行へ。先の複製に非表示属性を付け、既存生成マーカー側を保持。ソース内の文章とリンクは維持し、再生成でも戻らない。
- 主操作の不揃い: 不動産譲渡のclassなし計算ボタンを既存primaryへ統一。

左線カードは新設していない。FAQのQ/A、本文幅・行間、表の白地・罫線、SVG文字、フッター左端は共通部品を維持し、実画像と常設検査で確認した。

/hojokin/schedule/ をA4 PDF（3ページ・約431KB）に出力し、最終ページの実画像を開いた。表の最後の行・出典・フッターまで出力され、旧スクロール枠による縦切れがないことを確認。`.layout-artifacts/schedule-final.pdf` に保存。

## 常設検査・画像基準

run_tests.shはtests直下を自動実行するため、追加検査も既定の全件実行に入る。

- test_layout_render: 全511ページ×6サイズ。空枠、目次の存在・可視性、横あふれ、表・SVG・余白・左端、44px、色、文字参照、表示順、重複フッター。1280では全ページの印刷CSSも検査。
- test_empty_surfaces: 空状態・コンテナ・placeholderの壊し検査、復帰、コピー失敗、保存・開閉、JSなし。
- test_empty_tool_states: 全100ツールの正常シーン必須、800状態。JSエラーと操作後の横あふれも拒否。投資計算機3本の正常シーンを追加。
- test_uiux_presentation: 7種類の表示破壊×6幅、単位・入力/記事の順序・長い関連・重複フッター等の破壊を拒否。実キーボード操作・計算結果も確認。
- test_article_structure: class完全一致による誤判定を修正。空related箱を必須にする旧判定を、relatedまたはnext-read内のリンク実在検査へ変更。
- test_layout_markup: 新生成器の--checkと全ページの共通スクリプト読み込み検査を追加。
- tools/ARTICLE_SPEC.md、tests/layout/README.mdに執筆・生成・検査の規則を追加。

画像基準は更新前にvisual-diffsの前後・差分10画像を開いて理由を確認した。採用は10枚だけ。更新処理が許容差内の5枚も再保存したため、その5枚は元に戻した。

| 基準 | 採用理由 |
|---|---|
| kihonteate-input 1280/390 | summaryの44px確保。高さ1550→1572、2379→2400px |
| kihonteate-table 390 | 金額・単位を分断しない折返し。高さ565→637px |
| tedori-footer 390 | 上流の表の折返しによる描画位置差。フッター文言・左端は維持 |
| shunyu-svg 390 | 上流の高さによるクリップ高261→262px。SVG文字の欠落なし |
| iryohi-top 390 | 入力を目次より先へ移動 |
| top 1280、hojokin 390、embed 1280/390 | 操作対象44pxの確保 |

## 変更しなかったもの・限界

- 司令塔が別ブランチで担当する3ツールの目次追加は未変更。目次必須検査には3URLだけ一時的な統合例外を理由付きで記載した。統合後は例外を外す。空枠検査の除外ではない。
- /privacy/ の「4. Chrome拡張機能について」は本文のない見出し。方針文の創作・削除は表示修正の範囲を超えるため司令塔の内容確認に残す。
- /iryohi/ のフッターは確認日の異なる適用情報が2組ある。同一文の表示重複とは異なり、正しい日付の選択は内容判断なので変更していない。
- 電帳法の356リンクの選定自体は残した。リンク先を削除せず表示を開閉化した。
- 環境はmacOS arm64、Playwright 1.58.2 / Chromium 145.0.7632.6。Windows版Edgeそのものの実測ではない。今回追加した表示検査はローカルHTTP以外の通信を遮断している。外部PR画像・広告配信・計測先の動作の合格は主張しない。問い合わせ送信は実施していない。
- 空枠検査は可視内容・背景・罫線と既知の仮置き表記を検査する。文章の正しさやあらゆる意味の欠落まで自動判定するものではない。

## 再起動・容量対策・最終テスト

再開時にgit status・直近コミット・ログ・途中成果を確認した。未コミットの修正と約826MBの撮影成果を保持し、完了済み全景は撮り直していない。ブラウザは1つずつ。全ページ検査は1280/390を新規読み込みし、他4サイズは同じページをリサイズして再計測。全6サイズを省略せず小さいNDJSONにも逐次記録する。

18:47の移管後に再確認したところ、テストプロセスは継続しており、表示検査は18:55:54、全テストは19:04:58に完了していた。3,066行の最終成果とログを照合し、683件からの再撮影・再計測は行わなかった。内蔵空きは再開時60GB、完了時約59GB。大きな全景の複製・再撮影はせず、追加は必要な代表基準・小さいフッター画像・印刷PDFだけ。

途中の全テストでは静的な金額span追加が既存の本文検査と衝突したため、検査を弱めず、元の本文HTMLを保持して表示時に整える方式へ変更した。最後に残った/nenshu/の読み込み漏れも直した。編集時は実行中テストが終了・復元してから行い、最終全件テスト中の作業ツリー編集はしていない。

| 確認 | 結果 |
|---|---|
| npm i --no-save jsdom | 実行済み（npm-install.log / npm-install-resume.log） |
| ./run_tests.sh | 全268ファイル緑、失敗0 |
| 全ページ表示 | 511×6＝3,066件、異常0、各幅511件 |
| 全ツール操作 | 100×2×4＝800状態、異常0、JS例外0 |
| 画像比較 | 32画像すべて合格。基準更新は確認済み10画像のみ |
| 本文・リンク先・AdSense照合 | 511 HTML、差分0 |
| git diff --check | 合格 |
| コミット後の更新日生成 --check | 対象461本、要更新0 |
| コミット後の一覧・sitemap生成 --check | 記事392本、変更なし |

最終証拠: reports/uiux-0927/full-tests-final.log、render-final-summary.json、tool-states-final.json、content-invariance.json、review-coverage.json。`.layout-artifacts/render.json` が全3,066件の詳細。前後要素画像・差分画像・測定JSONはコミットに含め、大きい全景画像はローカルに保持する。

## 引き渡し・再利用する規則

HTML→共通部品/生成器/検査→確認済み生成物/報告書の順でコミットした。HTMLは `ee998869`、共通実装は `7ab208cb`。生成物・報告書のコミットはこの報告書を含む後続コミット（git log参照）。本文の改稿ではないので更新日を機械的に今日へ変えていない。

今後も「枠だけある」を目視の注意事項で済ませず、内容のある状態・ない状態・復帰する状態を共通部品と実ブラウザ検査で固定する。新しい計算機は正常入力シーンを追加しないと合格しない。空関連sectionを生成しない。担当外の目次を避ける場合でも共通保護の配線まで外さない。画像基準は差分を開いて理由を記録してから変更する。Macでは1ブラウザ逐次実行し、既存成果を使って全景の重複撮影を避ける。

gbrain記録先: `implementation/keiri-uiux-review-2026-09-27`。putを試みたが `URLError: [Errno 61] Connection refused`。getも同じ接続拒否で失敗し、書き込み・照合は未完了。ユーザー指定の接続不能時の扱いに従い、この報告書に記録する。接続復旧後に本報告を同じslugへputし、getで全文を照合する。公開は司令塔の検品後に行う。

DONE
