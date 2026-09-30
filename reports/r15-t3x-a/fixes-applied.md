# r15 t3x-a 修正報告

2026-09-30 JST。対象: `docs/column/kyushoku-shakai-hokenryo/index.html`。
作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-r15-t3x-a`、ブランチ `wt/astra-r15-t3x-a`。
指定どおり fetch 後の origin/main `0bb9b1fad66d104402cf854d73575d91791b25cb` から作成。他モデル・サブエージェント・orca・スキル・push は使用していない。

## 修正

審査 unresolved 全4単位を修正。high 0、medium 3、low 1。重複するmeta/OGを含む単位数であり、文面としては3種類。

- medium: 順序2・4（meta/OG description）。徴収・復職後控除・仕訳・傷病手当金まで確認したような要約を、標準報酬に基づく保険料計算と産前産後・育児休業免除の対象・届出要件の説明に限定。
- medium: 順序19（callout）。資格喪失事由と私傷病休職の免除制度不存在という網羅的断定を削除。病気療養で算定対象月に報酬がない場合の従前標準報酬による決定と、産前産後・育児休業免除の限定された対象を記載。
- low: 順序56。「未回収残高が膨らまず、最も管理しやすい」を削除し、「未回収残高を累積させないため、毎月の本人負担額と入金額を照合しましょう」という運用提案へ変更。比較根拠や入金履行を仮定した断定を残していない。

正本の該当箇所を再度開いた: `corpus/pages/nenkin_seidoannai-1.png`、`santei_guidebook_r8-21.png`・`27.png`・`39.png`・`40.png`、`nenkin_ikuji.txt:346–375`、`nenkin_kosodate.txt:1–16`、東京料額表の該当行。画像必須箇所は画像を目視し、OCRだけで採用していない。
計算値・coreの誤りは今回0件。境界値テスト・条件表・stale_valuesへの追加対象となる変更値はないため、それらのファイルは変更していない。

## 被覆

`claims/column/kyushoku-shakai-hokenryo.json` に、審査ok22単位と修正後に正本と再照合した3主張をcoversで登録。非主張は理由つき。正本外54単位は全IDに needed_source と理由を保存し、covers/verifiedへ入れていない。過去の雇用保険料ゼロの台帳記録も、今回の正本では私傷病休職を裏付けられないためout_of_corpusへ明示訂正。

|区分|修正前|修正後|
|---|---:|---:|
|抽出単位|129|129|
|台帳covers|0|25|
|独立審査okのverified記録|0|22|
|修正担当による再照合（writer_checked）|0|3|
|台帳nonclaims|0|50|
|必要資料つき正本外の台帳記録|0|54|
|check_claimsの未処理|129|54|

審査結果の内訳は **ok22・nonclaim49・out_of_corpus54・unresolved4・未判定0 → 正本照合済み25・nonclaim50・out_of_corpus54・unresolved0・未判定0**。
修正後25の内訳は独立審査okを引き継いだ22と修正担当が再照合した3。修正後の独立審査・公開承認を得たという意味ではない。
RUNの元のcoverage.jsonはsol段階の12/50/56/unclear11/未処理0であり、Astra審査後の22/49/54/4と混同しない。
`check_claims --segments` は正本外を専用分類しないため、残る54は機械上の未処理にも数えられる。未処理IDの集合と台帳out_of_corpusの集合は完全一致。未分類残りは0。

正本に照らした誤り・要修正率: **wrong÷(ok+wrong) = 4÷(22+4) = 15.38% → 0÷(25+0) = 0%**。
ここでwrongは依頼の「unresolved（誤り・要修正）」4件を集計上読み替えたもの。審査JSONにwrongという判定はなく、根拠不足も含むため、確定した制度上の誤り4件という意味ではない。非主張・正本外は分母から除外。正本外54件の正確性は未確認のままで、ページ全体の誤り率0%を主張しない。

生成後の再抽出でも変更IDは4単位だけ。残り125単位はID・文面・text_hashとも一致。未知ID・重複・保護単位のnonclaim化なし。固定入力88ファイルはrun.jsonのSHA256と全件一致。

## コミット・検査

- 本文・台帳・前後の単位記録: `ca70d973747a94c79d0fbaec0121b3c8d87a2d74`。
- HTMLコミット後の生成物: `007c9ed8c0ad19a400f1f2fb952068614b83a91c`。
- CHECKABLE全5本（gen_index_sitemap、gen_datemodified、gen_trust_footer、gen_data_source_note、gen_domain_bridge）を実行し、test_generators_fresh緑。生成差分は記事dateModified、コラム一覧、sitemap。
- `node tools/check_claims.mjs --changed origin/main`: 緑。
- `node tools/check_claims.mjs --segments docs/column/kyushoku-shakai-hokenryo/index.html`: `0/129 covered, 0 nonclaims, 129 unprocessed` → `25/129 covered, 50 nonclaims, 54 unprocessed`。
- 全テストは指定PLAYWRIGHT_PATHでrun_tests.shを直列実行。この作業でChromium検査を並行起動していない。他セッションの完了待ちなし。
- 基点の赤: 依頼で指定されたtest_hojokin_sources・test_layout_visualの2件。今回、修正前の全テストを再実行したという意味ではない。

- 検索索引追加生成: `c4bddd6a3fc1dbed9e7f939ec0582ea572034f11`。CHECKABLE外のgen_qa_indexが必要と全件検査で判明し、対象記事1エントリのanswer・summary・termsのみ更新。
- 全件初回: **287/290緑、赤3、終了1**。既知のtest_hojokin_sources（補助金タブ生成物不一致）、test_layout_visual（Playwright/Chromium環境メタデータ不一致）に加え、test_qaが記事説明変更後の索引未更新を検出。
- 索引再生成後: **test_qa・test_qa_stopword_driftの2/2緑**、check_claims --changedも緑。追加の赤は解消し、残存の赤は基点と同じ2件。索引1エントリだけの変更に対する再検査であり、全290本をもう一度走らせた「288/290緑」とは記録しない。
- 描画: **513ページ×6サイズ＝3,078画面、異常0**。対象記事の6サイズも異常0。layout-summary.jsonに記録。
- テストの赤の推移: **基点2（依頼記載）→全件実測3→索引修正・関連2本再検査後の残存2**。テストを緩めたり、基点の赤を黙って除外したりしていない。

報告・全件ログ・機械照合結果は作業ツリーの `reports/r15-t3x-a/` に保存。正本外54単位は必要資料の補充と再審査が必要。公開・pushは司令塔の検品後に行う。

DONE
