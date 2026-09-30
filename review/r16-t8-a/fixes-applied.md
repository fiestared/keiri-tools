# r16/t8-a 修正報告（2026-10-01）

作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-r16-t8-a`、ブランチ `wt/astra-r16-t8-a`。fetch後の基点は `d4126d4d`。pushなし。他モデル・サブエージェント・Orca・スキル使用なし。

## 単位と被覆

入力624単位を全件引き継いだ。修正後は文の分割・注記追加により633単位。基点と入力の本文単位は一致。

|ページ|単位 前→後|covers 前→後|非主張 前→後|未処理 前→後|
|---|---:|---:|---:|---:|
|column/furikomi-tesuryo-kanjo-kamoku|260→261|0→4|0→48|260→209|
|eigyobi|61→64|0→6|0→38|61→20|
|senpou-futan|236→241|0→32|0→82|236→127|
|embed/eigyobi|39→39|0→0|0→33|39→6|
|embed/senpou-futan|28→28|0→0|0→17|28→11|
|合計|624→633|0→42|0→218|624→373|

台帳登録前の独立審査は ok 21・nonclaim 212・out_of_corpus 377・unresolved 14。審査のok 21単位は全件coversとverifiedへ登録。修正後のcovers 42は元のok 21と修正担当の照合21で、独立審査済みが42に増えた意味ではない。nonclaimは見出し6件の解決で212→218。正本外・未確認は377→373（別モデルwrong 5件のうち4件は補足一次資料で照合済み、1件は複合単位に未確認の「方法2を選ぶ会社が増えている」が残るため単位全体をokにしない）。

台帳の `unverified` 373件はすべてneeded_sourceつき。機械検査の「未処理」にこの373件が残る。未分類・記録漏れは0だが、全被覆・全文確認済みとはしていない。not_wrong・unsure 372件はIDと本文ハッシュの前後一致を確認し、書き直し・削除なし。更新日等の生成器によるメタデータ更新は本文単位に含まれない。

`node tools/check_claims.mjs --segments <5ページ>` の前後ログ、`coverage-final.json`、`audit.log`、`preservation.json`をworktreeの `review/r16-t8-a/` に保存。unknown/stale ID、二重分類、保護単位のnonclaimは0。被覆は正確性の保証ではない。

## 誤り率

固定正本に照らす事実誤りは8件、okは21件なので **8÷(21+8)=27.59%**。low 6件は本文の誤りではなく見出しの保護・分類不備であり、この分母には入れない。

従来の「要修正unresolvedを全件wrongと数える」管理上の集計も併記すると **14÷(21+14)=40.00%**。正本外377件・非主張212件は分母に含めない。

補足一次資料で確認した正本外wrong 5件まで含む別集計は **13÷(21+13)=38.24%**。固定正本だけの率と混同しない。修正担当による再照合では対象の事実誤り13件は解消したが、修正後snapshotの別モデルによる再審査は実施していない。

## 修正内容と重要度

元のunresolvedは high 1・medium 7・low 6、正本外wrongは今回の重要度判定で high 1・medium 4。合計 **high 2・medium 11・low 6 = 19単位**。

- high: 年末年始を一律に除外する着金日案内を、即時振込登録・モアタイム・口座条件・メンテナンスと翌銀行営業日の場合に分けた。セブン銀行FAQ9–14行と三菱UFJ振込案内77–113行。
- high（補足正本）: SVGの「3処理とも10%」を訂正。売上値引きは元の売上税率で、軽減税率対象は8%。国税庁Q&A問29（令和8年4月改訂）。旧文を `tests/stale_values.json` に登録し、旧文で検出・修正文で非検出を確認。
- medium 7: 3万円境目の見出しを「多くの銀行」に限定（1）。三菱UFJ個人154円・220円に信託銀行／auじぶん銀行は0円の注記（2）。りそな165円のステータス条件・公表時点とルビー／ダイヤモンドの月間3回料金（1）。ゆうちょのチャネルをダイレクトに特定し、居住者165円・非居住者3,000円を明示（2）。初日不算入と午前零時開始の例外（1）。それぞれ固定正本の該当箇所を開いて照合。
- medium 4（補足正本）: 帳簿のみで控除できる取引を少額特例・ATMだけに限定していたFAQを訂正（1）。買手の役務提供として処理する場合の請求書等は買手のものと本文・FAQを訂正し少額特例を付記（2）。まとめの「2通り」を契約関係による3処理に訂正し、立替払は実費同額条件を明記（1）。国税庁問29とNo.6496を取得・保存・直接読解。
- low 6: 表見出し4件と整理用まとめ見出し2件は文言を変えず、抽出器でその組織用ラベルだけ保護対象から除外し、理由つきnonclaimsへ。本文・主張を含む見出し・データセルの保護は維持。回帰テストで修正前赤→修正後緑。

FAQ本文とJSON-LDの同じ主張も同期。計算coreの誤りは今回の対象所見に無く、core・境界値・条件表を変更する案件は0。既存の計算テストは全テストに含める。

正本外のnot_wrong・unsureを変更しないという指示に従い、本文中の別単位「処理は2通り」や「売上値引きが主流」等はそのまま未確認で残した。まとめの修正によって残存記述まで確認済みになったとは扱わない。司令塔はこの残存範囲を踏まえて検品すること。

補足一次資料: https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/qa/29.pdf 、 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6496.htm 。取得日・ローカルファイル・SHA256は `supplement/registry.json`。固定正本の入力は変更せず、参照用コピーをworktreeの証跡に保存。

## コミットと検査

- HTML・台帳・抽出器・回帰: `d3a8136d41d71aec6fecffd1879a8d05ed64caa7`
- HTMLコミット後、CHECKABLE 5本をすべて実行。生成物と証跡: `7efd528220cf3768410af70f52a949dc2f152e9a`
- `test_generators_fresh`: 5本すべて最新、緑。
- `check_claims --changed origin/main`: 緑。
- 全テスト: **290/292緑、赤2、終了コード1**。`PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js` を設定して `./run_tests.sh` を全件完走。省略・フィルタなし。Chromiumを使う検査はこの作業内で順次実行し、同時に起動するブラウザは1つ。他セッションの終了待ちはしていない。
- 赤の前後: **基点2件（依頼で提示された基点結果）→修正後実測2件、増分0**。基点の全件再実行は行っていない。`test_hojokin_sources` は `gen_hojokin_tabs --check` の既存生成物不一致、`test_layout_visual` はPlaywright/Chromium環境メタデータ差。基準画像や既知の赤を通すための変更はしていない。
- 全ページ描画: **514ページ×6サイズ=3,084画面、異常0**。`test_layout_render` は緑。画像比較の環境差による赤と区別する。
- `test_segment_claims`: 組織用見出しの追加ケースが修正前赤→修正後緑。税率の旧文はstale値検査で赤→修正文で緑。計算coreの変更は無いため、新規の計算境界値ケースは0。
- `test_eigyobi`・`test_eigyobi_article`・`test_furikomi_kamoku`・`test_senpou`・`test_segment_claims`・`test_stale_values`・条件表／境界値テストを含む全件ログを保存。台帳最終監査も緑。
- 入力60ファイルの記録SHA256を終業時に再照合し変更0。テスト後の追跡ファイル差分0。

