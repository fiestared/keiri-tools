# r16 t19-a 修正報告

2026-10-01 JST。作業場 `/Users/masahiroyasu/Scripts/keiri-tools-astra-r16-t19-a`、ブランチ `wt/astra-r16-t19-a`。fetch後の基点 `043df137`。push・他モデル・サブエージェント・orca・スキルは使用していない。公開は司令塔の検品待ち。

## 修正と正本照合

審査の unresolved **142単位を全件修正**（high 58 / medium 76 / low 8）。別モデルの正本外wrong **4単位も修正**（high 3 / medium 1）。合計 **146単位＝high 61 / medium 77 / low 8**。同じ主張の隣接出現・図の説明等11単位を整合補足し、本文を変更した元単位は計157。11単位を重複する新規findingとして146件に足してはいない。全変更の元ID・旧文・新文・重要度・根拠は `reports/r16-t19-a/applied.json`、新IDへの対応は `mapping.json`。

- **中退共（37件）**: 掛金の法人損金／個人必要経費、死亡退職でも12月未満は原則不支給・12～23月死亡は掛金総額相当、通算・引継ぎ・過去勤務・減額支給の例外、解約の同意以外の要件と不正解除時の特例、個人企業等の加入判定、分割受給の金額要件、受給時の所得区分、口座振替の翌営業日、付加退職金の「仮定の退職月」を修正。
- **労働者死傷病報告（審査31＋正本外3件）**: 原因・場所を含む報告対象、4日未満の記載事項、紙提出・保存期間の終期を断定しない説明、メリット制の賃金締切日／貨物取扱事業／確定保険料40万円／3保険年度の条件、休業補償の要件と調整、派遣の記載事項と義務の根拠の区別、所定休日の算入を修正。
- **産後パパ育休（44件）**: 取得終端の「8週間経過日の翌日」、遅い申出に対する指定日と労使協定の期間、契約更新時の回数・拒否制限の例外、初日「又は」最終日の就業上限、開始月と終了翌日月による14日要件、就業日を挟まない通算と賞与免除、改正2か条と施行日の説明を修正。11/26・57日・68日・12/5・66日の例示は維持。
- **産前産後休業（審査30＋正本外1件）**: 産後6週経過後の本人請求・医師判断、早産時も42日／多胎98日という健保の対象期間、予定日を含む42日の開始日、月単位の保険料・賞与免除、厚年第2号・第3号本人申出と船員の記載例外、年休の出勤率・比例付与、終了時改定の対象を修正。健康保険料率を協会けんぽと健康保険組合で区別。

重要度別では、high 61件は受給・免除・報告の可否、期間端点、所得区分等の結論を修正。medium 77件は適用対象、例外、計算期間・説明の条件不足を修正。low 8件は過去勤務等の例外補足、報告経路の図説明、派遣・外国人記載事項の区別、改正条数・変更のない目的規定、引用条番号、解雇制限と出勤率の根拠範囲を修正した。単位別の重要度は `applied.json` に記録。

固定正本の該当条文・案内本文を開いて照合した。正本外wrongの休日算入は、[和歌山労働基準監督署の資料](https://jsite.mhlw.go.jp/wakayama-roudoukyoku/content/contents/002475730.pdf)の補足「仕事が休みの日も含む」と具体例を取得し確認（`holidays.pdf/txt`）。健康保険料率は[e-Gov健保法160条](https://laws.e-gov.go.jp/law/211AC0000000070#Mp-At_160)第1・2・13項をAPIの生データで確認（`kenpo160.json/txt`）。追加資料をRUNの固定corpusへ混入していない。

計算coreの変更は0。今回の対象は記事4本で、計算機の境界値・条件表に修正対象はない。旧説明4件を `tests/stale_values.json` に追加し、元HTMLで各1件検出→修正後0件を確認（`stale-regression.json`）。

## 単位被覆と誤り率

当初審査は **1,371単位：ok 902 / nonclaim 253 / out_of_corpus 74 / unresolved 142**。固定正本に照らした審査誤り率は **142 ÷ (902＋142)＝13.60%**。正本外・非主張は分母に含めない。追加一次資料を含めた参考値は146÷(902＋146)＝13.93%だが、固定正本の誤り率とは分ける。

修正後は **1,372単位：根拠へ対応づけたcovers 1,050 / nonclaims 252 / 正本外70 / その他未処理0**。1単位の非主張を例外を説明する主張に変更し、文の分割で総数が1増えた。修正者の照合では元の142件・正本外wrong4件の残存誤りは0。修正後の独立モデル再審査は未実施で、0件を独立審査の合格とは扱わない。

|ページ|単位数 前→後|covers 前→後|nonclaims 前→後|check_claims未処理 前→後|残る正本外|
|---|---:|---:|---:|---:|---:|
|chutaikyo|348→348|0→277|0→62|348→9|9|
|roudousha-shishobyo-houkoku|336→336|0→228|0→67|336→41|41|
|sango-papa-ikukyu|368→368|0→292|0→68|368→8|8|
|sanzen-sango-kyugyo|319→320|0→253|0→55|319→12|12|
|合計|1,371→1,372|0→1,050|0→252|1,371→70|70|

`node tools/check_claims.mjs --segments <4ページ>` の実測。ツールはout_of_corpusを処理済み扱いしないため、未処理70＝正本外70の警告を意図的に残している。`needed_source`と元IDを台帳の `out_of_corpus` に記録し、covers／verifiedへは入れていない。not_wrong・unsureの70件は元ID・文面を全件維持（`oc-preservation.json`）。

独立審査okかつ本文が変わらない **892単位**を `verified` に記録。修正後の158単位はcoversのみで、独立確認済みへ自己昇格しない。被覆100%や独立再審査合格とは報告しない。

## テスト・コミット

基点の赤 **2件 → 全件初回4/294件 → 追加修正・該当再検査後2件**。基点2件はユーザー指定の既知結果で、基点全件検査の再測定は行っていない。

`export PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js` を設定し `./run_tests.sh` 全294ファイルを直列実行（`tests.log`、初回exit 1）。作業内のChromium同時起動は1つ。他セッションの終了待ちはしていない。

- 残る既知の赤: `test_hojokin_sources.mjs`（公募タブ生成物の不一致、35 checks中1件）、`test_layout_visual.mjs`（基準画像の描画環境と実行環境の不一致）。基準画像の更新で隠していない。
- 初回追加の赤: `test_qa.mjs` と `test_tool_related.mjs`。`gen_qa_index` と `gen_tool_related` を実行し、QA索引と5ツールの関連記事欄へ今回の記事修正を反映。両テストの再実行は緑（`qa-rerun.log`、`tool-related-rerun.log`）。全294本の二巡目は行っていない。
- HTMLを先にコミットし、その後 `test_generators_fresh` のCHECKABLE全5種を実行。更新日反映後にサイトマップを最後に再生成し、鮮度検査は緑（`generators-rerun.log`）。
- `node tools/check_claims.mjs --changed origin/main` は変更9ページで緑（4記事＋生成された関連記事欄5ページ、`claims-changed.log`）。対象4記事の単位数は `coverage-final.log`。
- 全514ページ×6サイズ＝3,084画面の描画検査は異常0。修正記事4ページ×2サイズも異常0、図7点を目視確認。後から再生成した5ページ×6サイズ＝30画面も異常0（`layout-render-summary.json`、`visual.json`、`related-visual.json`）。
- FAQ、旧値ルール、旧値検出、入力配線、全ページ横スクロール等は全件実行で緑。入力167ファイルのハッシュを照合し変更0（`input-integrity.json`）。

実装・生成物・台帳のコミットSHA（いずれもローカルのみ）:

```text
c50b6abdb74b3b5a16f5eda02ac39fe4a5f9efeb fix: correct r16 t19 article eligibility, dates and exceptions
f22de9aa314274c0cda9ae919d32370c3774fb16 chore: regenerate article metadata and sitemap after r16 corrections
69bd32bb1058321e8628cc6181ddbdd12dbe5c7e fix: keep corrected FAQ answers outside aria-hidden markers
b523f976234947ef64e60fcce4c222d40593636d docs: record r16 t19 segment evidence and preserve unverified claims
aa02d038f3c914304974c2524407dec159118cd1 chore: refresh QA index and related article summaries for r16
a790f2145af0116a5345d7df9ef72eb5110a1d49 chore: refresh dates and sitemap for regenerated related summaries
```

検証ログ・画像・本報告も同じ作業ブランチの `reports/r16-t19-a/` に保存。RUNへの書込みは本報告のみ。公開・pushは行っていない。

## gbrain

登録先: `implementation/keiri-r16-t19-a-2026-10-01`。put後にgetで本文一致を確認済み。


DONE
