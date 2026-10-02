# auto20261002 t12-q08466 recheck1 修正報告

2026-10-02。作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261002-t12-q08466`。開始HEAD `f7f88770`。既存作業場で継続。他モデル・サブエージェント・orca・スキル・pushは使用していない。

## 入力と集計

RUN: `/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t12-q08466-recheck1`。segments、sol-union（76単位、9単位10所見）、審査、fixes、gate、coverage、正本・corpus_desc、oc-opinionを読んだ。gbrainの指定された設計・実装・一度で潰せない理由の3ページも確認した。

入力76単位の最終審査は **ok 67 / nonclaim 2 / out_of_corpus 3 / unresolved 4（high 2・medium 2・low 0）/ 判定未処理0**。`coverage.json` の69/2/4/unclear1は審査前のモデル集計であり、最終審査の数と混ぜない。正本に照らした誤り率は **4÷(67+4)=5.63%**。正本外3件の別モデル判定はすべてnot_wrong。

修正後、入力4件の修正担当による正本再確認は完了（未修正4→0）。入力単位を追跡した内訳は **独立審査ok67・修正担当再確認4・nonclaim2・正本外3・修正未処理0**。自己確認の参考誤り率は0÷(67+4)=0%だが、これは独立審査後の誤り率ではない。修正後の独立審査・gateはシェルの再照合待ちで、入力gateは変更していない。

ページ全体の機械抽出と台帳（今回の変更単位76件だけの集計とは別）:

|ページ|全単位|covers|独立確認済み verified|nonclaims|機械のunprocessed|
|---|---:|---:|---:|---:|---:|
|docs/jidoshazei/index.html|252→255|198→201|131→189|31→31|23→23|
|docs/embed/jidoshazei/index.html|53→53|25→25|19→24|12→12|16→16|
|計|305→308|223→226|150→213|43→43|39→39|

**機械の未処理39件は減っていない。前後とも全件がneeded_sourceつきの正本外で、正本外以外の未処理は0→0。** `check_claims --segments` はout_of_corpusを独立区分として差し引かず、covers/nonclaimsに載らないものをunprocessedと出す仕様。減少を見せるために正本外をokやnonclaimへ移していない。審査ok67件は既存主張へのcoversを確認し、不変のtext_hashだけverifiedへ反映した（すでに記録済みのものと重なるため純増は63）。nonclaim2件は理由つき登録を確認。4件の修正はcorrected_recheckedで独立照合と区別。FAQ追加による3単位純増を含む。根拠はcoverage-before/after.log、coverage-metrics.json、coverage-accounting.json。

## 論点 → 元単位 → 修正した全出現 → 根拠

### 1. 登録車の重課年数だけでは対象を決められない（high 1）

元単位 `s-6526458655eddddaa248-1`。

修正箇所:
- `docs/jidoshazei/index.html` の目次とh2 `#jyuka-kasan`: ガソリンハイブリッド等の対象外車を除く旨を見出し自体に明記。
- 同ページの重課calloutのガソリン・LPGのliとディーゼルのli: それぞれガソリンハイブリッド等、一般乗合バス・スクールバス等の除外を明記。
- 同ページと `docs/embed/jidoshazei/index.html` の `#fuel-hint`: 対象外車を除く旨を統一。
- `claims/jidoshazei.json` と `claims/embed/jidoshazei.json`: 変更単位のcovers、scope、exceptions、逐語・正本行を登録。

根拠: `corpus/www_tax_metro_tokyo_lg_jp_kazei_automobiles_shubetsu.txt:709-723` 全節（年数711-713、率715、対象外717-719、申請減免721）。対象外全7群を確認。乗用15%とバス・トラック10%を区別。本文の「主な対象外の例」の範囲を維持。附則12条の3第1項の自家用乗用除外と別用途の括弧書も読み、直接の自家用乗用根拠に混用していない。

### 2. 軽の12,900円は四輪以上・自家用乗用だけ（high 1）

元単位 `s-b1a390478ba8919f0576-1`。

修正箇所:
- `docs/jidoshazei/index.html` の `#kei` の重課liに「四輪以上の自家用乗用軽自動車で」を追加。後続の燃料5群と被けん引車の全6群除外は維持。
- `claims/jidoshazei.json`: 新しい単位の主張・scope・別区分を含むexceptions・coversを登録。

根拠: `corpus/www_city_osaka_lg_jp_zaisei_page_0000587096_html.txt:104-178`（税率表全行・全注・軽課別表）、`corpus/egov_chiho_fusoku_30.txt:4-18`（全条）。三輪4,600円、営業用乗用8,200円、貨物営業用4,500円・自家用6,000円も読み、12,900円と区別した。旧新検査日、重課開始年度、被けん引車、軽課の別区分も全件確認。

### 3. 重課FAQでも東京都の申請減免を説明する（medium 1）

元単位 `s-6ce6fe934ba859fa9b7d-1`。この文のIDは不変だが、同じFAQ回答pの文脈を修正。

修正箇所:
- `docs/jidoshazei/index.html` の重課FAQ回答末尾: 都指定粒子状物質減少装置付きディーゼル、1945年（昭和20年）まで製造車、納期限までの申請、重課分の減免を一体で追加。
- 同ページのFAQ JSON-LD: `node tools/gen_faq_jsonld.mjs` から生成。
- `claims/jidoshazei.json`: FAQ末尾の追加単位を登録し、元単位を独立verifiedへは上げずcorrected_recheckedとして記録。

根拠: `corpus/www_tax_metro_tokyo_lg_jp_kazei_automobiles_shubetsu.txt:709-723`、特に721。本文の既存減免説明と同じ根拠・条件で統一し、新しい理由づけは足していない。

### 4. EV6,500円の標準軽課試算と東京都の課税免除を区別する（medium 1）

元単位 `s-1519791128c77988582d-1`。

修正箇所:
- `docs/jidoshazei/index.html` のエコカーFAQ回答: 6,500円が課税免除・減免を適用しない標準軽課試算であることを明示。
- 同じ回答pに東京都の平成21〜令和12年度初回登録の電気・水素燃料電池・PHEV、登録年度月割＋翌5年度、営業・自家用、個人法人、リース、軽は市区町村という同節の条件を全件追加。
- 同じ回答pの試算範囲を既存の「その他の軽課・課税免除・申請減免は試算対象外です。」に統一。この機能宣言は正本外としてneeded_sourceを記録。
- 同ページFAQ JSON-LDを本文から再生成。
- `claims/jidoshazei.json`: 税制度部分のscope・exceptions・逐語引用・covers、機能部分の未確認記録を登録。

根拠: `corpus/www_tax_metro_tokyo_lg_jp_kazei_automobiles_shubetsu.txt:666-746`（営業用別区分・国の軽課・東京都免除の全節）、`corpus/www_pref_mie_lg_jp_common_content_001128502_pdf.txt:2-25`（全排気量と営業・自家用、EV行22）、`corpus/egov_chiho_fusoku_12_3.txt:61-139`（第2項の令和7〜9年度登録と第3項営業用限定の区別）、`corpus/www_tax_metro_tokyo_lg_jp_documents_d_tax_zikayou201910_green.txt:76-77`（被けん引車・東京都免除の注）。東京の軽課表全体も確認。

## 全出現・正本外・実装

`rg`で本文・リード・要約・callout・FAQ・title/meta/OG・JSON-LD・SVG text/aria-label/figcaption・embed・他ページ・参照JSONを走査。occurrences-before/after.txtに記録。

- 本文の対象外一覧・減免説明、税額表の列見出し/caption、軽のFAQ/表直下/出典、標準軽課と免除の本文説明は既に条件を含み、修正不要。
- `docs/assets/jidoshazei_r08.json` のscope_note・EV note・軽_note・jyuka_ruleのexcluded_fuel_note、`docs/assets/qa_index.json` の自動車税要約は条件を含んでいた。データ値を変更する誤りは無い。
- SVGは軽課・重課・免除等のない新旧税率比較で、今回の重課・軽課の条件欠落とは別。title/meta/OGにも今回の無限定な主張は残っていない。他ページの同じ数値は別制度の額であり、同一論点の取り残しではない。
- oc-opinionのnot_wrong3件は元のtext_hashを保ったまま、needed_sourceつき未確認を維持。削除・書換え・ok化していない。source-and-preservation-audit.jsonで検証。
- 追加主張に添えた20本の引用は、指定正本行の逐語一致を機械でも確認。
- 今回は表示条件の修正。coreの計算誤り・古い税額は無いため、core・境界値テスト・条件表・stale_valuesへの不要な変更は行わない。既存の全計算・境界・壊し検査を実行。

## コミット・テスト

- `83eacf24`: HTMLと台帳を先にコミット。
- `1d1f11c1`: FAQ JSON-LD再生成をコミット。
- CHECKABLE全5本（index_sitemap、datemodified、trust_footer、data_source_note、domain_bridge）とFAQ生成器を実行。`test_generators_fresh` 緑。
- `node tools/check_claims.mjs --changed origin/main` 緑。`--segments`の前後ログを保存。
- `PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js bash run_tests.sh`: **300件完走、298緑・2赤**。すべて直列実行し、この作業内でブラウザ検査を重複起動していない。
- 赤は `test_layout_visual`（既存の描画環境不一致）と `test_stale_values`（未変更の4ページの過去日付を未来形で説明）。開始HEAD `f7f88770` のページ・規則でも4箇所を再現した（stale-baseline.log）。既存の画像比較基準を緑にするための更新はしていない。
- **赤の前後: 前周の実測2→今回2、今回の新規赤0**。依頼文の「基点の赤はhojokin_sourcesとlayout_visual」に対し、この継続作業場では前周の `review/auto20261002-t12-q08466/final-tests.json` がlayout_visual＋stale_valuesの2赤を記録していた。今回はhojokin_sourcesは緑。基点の記述と実測を混同していない。
- 自動車税のcore・静的税額表の壊し検査、通常テスト、条件表、境界値、列挙、FAQ一致、全入力欄の配線、横スクロールを含め完走。描画は**3,138ケース・問題0**（うち自動車税/埋込12ケース）。
- 全テスト後の `check_claims --changed origin/main` とFAQ生成器 `--check` は緑。`git diff --check` は差分エラーなし、実装へのテスト残留差分なし。
- 証跡をコミットし、RUNの最終報告にそのSHAを記載する。修正後の独立照合はreview_run.shへ引き渡し、ここから別モデルを起動・待機しない。
