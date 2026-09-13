# 人気投資信託の商品名比較32本

2026年9月13日確認。既存2本の改題・追記、新規30本（当初5本＋追加25本）。この作業ブランチ上での成果で、公開・push・mainへの取り込みは行っていない。

## 対象の選び方

SBI証券の週間販売金額と楽天証券の週間買付金額、それぞれ2026/9/7〜9/11の上位10本を確認。6月の日付が残る旧SBIランキング、NISA限定ランキング、別週の検索キャッシュは採用していない。

20掲載枠のうち重複は5商品。15商品、全105組を `pair-matrix.csv` に列挙した。同一テーマ内の26組（世界株3・米国株21・国内株1・日次4.3倍ブル1）と、全世界/米国の範囲を比べる4組を採用。75組は地域・資産・倍率の違いと記事範囲から除外。さらに上位10本外のSBI・V・全米株式、三菱UFJ純金を同テーマの比較相手として各1組補足し、合計32組。

全世界/米国の4組は同一シリーズ内または全市場型の投資範囲を比べる記事。世界株アクティブと米国集中株等まで一律に組み合わせていない。「同じテーマ」と「同じ指数」は各本文で区別する。

SBI順位は公開マーケットページのJavaScript描画後に取得（`sbi-top10.json`）。投信トップの3件や、メンテナンスに転送される新ランキング入口だけで取得不可と断定しない。

## 対象商品

| 商品 | SBI順位 | 楽天順位 |
|---|---:|---:|
| eMAXIS Slim 全世界株式（オール・カントリー） | 1 | 1 |
| 楽天・プラス・オールカントリー株式インデックス・ファンド | — | 3 |
| eMAXIS Slim 米国株式（S&P500） | 2 | 2 |
| 楽天・プラス・S&P500インデックス・ファンド | — | 4 |
| SBI・V・S&P500インデックス・ファンド | 3 | — |
| 楽天・全米株式インデックス・ファンド | — | 5 |
| iFreeNEXT FANG+インデックス | 5 | 7 |
| 楽天・プラス・NASDAQ-100インデックス・ファンド | — | 9 |
| SBI NASDAQ100インデックス・ファンド | 9 | — |
| インベスコ 世界厳選株式オープン＜為替ヘッジなし＞（毎月決算型） | 7 | 8 |
| eMAXIS Slim 国内株式（TOPIX） | 6 | 10 |
| eMAXIS Slim 国内株式（日経平均） | 8 | — |
| 楽天日本株4.3倍ブル | — | 6 |
| SBI 日本株4.3ブル | 4 | — |
| SBI・iシェアーズ・ゴールドファンド（為替ヘッジなし） | 10 | — |

## 記事一覧

| 記事 | 区分 |
|---|---|
| [eMAXIS Slimオルカン vs 楽天・プラス・オルカン](../../docs/column/orcan-hikaku/index.html) | 同指数 |
| [eMAXIS Slimオルカン vs eMAXIS Slim S&P500](../../docs/column/orcan-vs-emaxis-sp/index.html) | 全世界/米国の範囲 |
| [eMAXIS Slimオルカン vs 楽天VTI](../../docs/column/orcan-vs-rakuten-vti/index.html) | 全世界/米国の範囲 |
| [eMAXIS Slimオルカン vs 世界のベスト（ヘッジなし・毎月）](../../docs/column/invesco-sekai-vs-emaxis-orcan/index.html) | 同テーマ・異なる構成 |
| [楽天・プラス・オルカン vs 楽天・プラス・S&P500](../../docs/column/rakuten-orcan-vs-rakuten-sp/index.html) | 全世界/米国の範囲 |
| [楽天・プラス・オルカン vs 楽天VTI](../../docs/column/rakuten-orcan-vs-rakuten-vti/index.html) | 全世界/米国の範囲 |
| [楽天・プラス・オルカン vs 世界のベスト（ヘッジなし・毎月）](../../docs/column/rakuten-orcan-vs-invesco/index.html) | 同テーマ・異なる構成 |
| [eMAXIS Slim S&P500 vs 楽天・プラス・S&P500](../../docs/column/sp500-hikaku/index.html) | 同指数 |
| [eMAXIS Slim S&P500 vs SBI・V・S&P500](../../docs/column/emaxis-sp-vs-sbi-sp/index.html) | 同指数 |
| [eMAXIS Slim S&P500 vs 楽天VTI](../../docs/column/emaxis-sp-vs-rakuten-vti/index.html) | 同テーマ・異なる構成 |
| [eMAXIS Slim S&P500 vs iFreeNEXT FANG+](../../docs/column/emaxis-sp-vs-fang/index.html) | 同テーマ・異なる構成 |
| [eMAXIS Slim S&P500 vs 楽天・プラス・NASDAQ100](../../docs/column/emaxis-sp-vs-rakuten-nasdaq/index.html) | 同テーマ・異なる構成 |
| [eMAXIS Slim S&P500 vs SBI NASDAQ100](../../docs/column/emaxis-sp-vs-sbi-nasdaq/index.html) | 同テーマ・異なる構成 |
| [楽天・プラス・S&P500 vs SBI・V・S&P500](../../docs/column/rakuten-sp-vs-sbi-sp/index.html) | 同指数 |
| [楽天・プラス・S&P500 vs 楽天VTI](../../docs/column/rakuten-sp-vs-rakuten-vti/index.html) | 同テーマ・異なる構成 |
| [楽天・プラス・S&P500 vs iFreeNEXT FANG+](../../docs/column/rakuten-sp-vs-fang/index.html) | 同テーマ・異なる構成 |
| [楽天・プラス・S&P500 vs 楽天・プラス・NASDAQ100](../../docs/column/rakuten-sp-vs-rakuten-nasdaq/index.html) | 同テーマ・異なる構成 |
| [楽天・プラス・S&P500 vs SBI NASDAQ100](../../docs/column/rakuten-sp-vs-sbi-nasdaq/index.html) | 同テーマ・異なる構成 |
| [SBI・V・S&P500 vs 楽天VTI](../../docs/column/sbi-sp-vs-rakuten-vti/index.html) | 同テーマ・異なる構成 |
| [SBI・V・S&P500 vs iFreeNEXT FANG+](../../docs/column/sbi-sp-vs-fang/index.html) | 同テーマ・異なる構成 |
| [SBI・V・S&P500 vs 楽天・プラス・NASDAQ100](../../docs/column/sbi-sp-vs-rakuten-nasdaq/index.html) | 同テーマ・異なる構成 |
| [SBI・V・S&P500 vs SBI NASDAQ100](../../docs/column/sbi-sp-vs-sbi-nasdaq/index.html) | 同テーマ・異なる構成 |
| [楽天VTI vs iFreeNEXT FANG+](../../docs/column/rakuten-vti-vs-fang/index.html) | 同テーマ・異なる構成 |
| [楽天VTI vs 楽天・プラス・NASDAQ100](../../docs/column/rakuten-vti-vs-rakuten-nasdaq/index.html) | 同テーマ・異なる構成 |
| [楽天VTI vs SBI NASDAQ100](../../docs/column/rakuten-vti-vs-sbi-nasdaq/index.html) | 同テーマ・異なる構成 |
| [iFreeNEXT FANG+ vs 楽天・プラス・NASDAQ100](../../docs/column/ifreenext-fang-vs-rakuten-nasdaq/index.html) | 同テーマ・異なる構成 |
| [iFreeNEXT FANG+ vs SBI NASDAQ100](../../docs/column/fang-vs-sbi-nasdaq/index.html) | 同テーマ・異なる構成 |
| [楽天・プラス・NASDAQ100 vs SBI NASDAQ100](../../docs/column/rakuten-nasdaq-vs-sbi-nasdaq/index.html) | 同指数 |
| [eMAXIS Slim TOPIX vs eMAXIS Slim 日経平均](../../docs/column/emaxis-topix-vs-nikkei/index.html) | 同テーマ・異なる構成 |
| [楽天日本株4.3倍ブル vs SBI 日本株4.3ブル](../../docs/column/rakuten-bull-vs-sbi-bull/index.html) | 同指数 |
| [楽天VTI vs SBI・V・全米株式](../../docs/column/rakuten-vti-vs-sbi-vti/index.html) | 同指数 |
| [SBI・iシェアーズ・ゴールド（ヘッジなし） vs 三菱UFJ 純金ファンド](../../docs/column/sbi-gold-vs-mufg-gold/index.html) | 同テーマ・異なる構成 |

## 数値と未公表項目の扱い

- 基準価額の取得上限は2026/9/11。各組の共通日付を使用し、SBI・インベスコを含む組は9/10が終点。原則直近3年、設定が新しい商品は開始日を繰り下げる。
- CSVは運用会社公開の分配金再投資列。SBI・インベスコは運用会社公式サイトの委託提供チャートを使用。XMLの日次倍率を（当日価額＋分配金）÷前日価額で独立照合し、分割等がある場合は停止する。
- 年率は複利、最大下落率は比較期間内の日次高値からの下落。評価額は100万円の一括投資・税引前分配金再投資・売却前。購入/換金時の負担と投資者税金は除く。基準価額に反映済みの費用は再控除しない。
- SBI NASDAQ100（2026/5/21設定）はSBI・インベスコQQQとは別商品。初回決算2027/5/11、総経費率は未公表。関連6記事では年率換算と直近1年の表を掲載せず、未公表を0としない。
- 金の比較は仕様・費用のみ。直近1年2025/9/11〜2026/9/10の日次相関は同日0.475503、SBI側を1共通営業日後にした組0.542238。`gold-alignment.json`。国内/海外の市場・評価時点と需給が異なるため、日次実績差を費用差として掲載しない。
- 総経費率は資料ごとの作成対象期間を併記。目論見書と報告書で費用内訳の分類が異なる場合がある。どちらでもETF分を二重加算しない。
- 生の抽出JSONは自動判定の診断資料であり、正本は一次資料を目視照合した `funds.json` と本文。委託会社への配分0.88%を楽天ブルの総信託報酬と読まない（正しくは1.243%）。複数クラスPDFの最初の値を他クラスへ流用しない。三菱UFJ純金の信託財産留保額はなし。

## 需要の記録

keyword_demand.pyの推計を2026/9/13に確認。Google欄: オルカン240,800、sp500 13,280,000、楽天VTI 9,680、NASDAQ100 2,192,000、FANG+160,800、世界のベスト2,880、TOPIX 日経平均 違い3,520、SBI 日本株4.3ブル1,920、金 投資信託11,840、三菱UFJ 純金ファンド1,280。検索数はツール推計で、保証された流入ではない。

これらは商品・指数の親語の需要である。「A vs B」完全一致の各組に月1,000件あることを確認したわけではない。S&P500の表記は sp500 と記号入りで結果に大差があり、sbi v s&p500 は8、複合比較語は0の結果もあった。需要を合算して各記事の値としない。今回の網羅範囲はユーザーの「上位10ずつから同テーマ比較を増やす」という追加指示に基づく。

## 保守と再計算

- 実績比較: 四半期ごとに基準価額を再取得し、次回確認目安2026/12/13。対象期間を各本文に書き換える。
- 総経費率: 各商品の次の運用報告書公表後に更新する。SBI・V・S&P500の次の9月決算分、楽天各商品の7月/10月決算分は旧期間のまま放置しない。
- 新SBI NASDAQ100は2027/5/11の初回決算後にTER欄を再確認。それまでは未公表のまま。
- この記録は更新方針であり、定期ジョブの設定済みを意味しない。今回ジョブの作成・変更はしていない。
- 再計算は `python3 reports/fund-vs-20260913/compare.py`。記事本文の再生成は `expand_articles.py`。その後リポジトリのFAQ/QA/OGP/共有リンク/日付/一覧・sitemapジェネレーターを実行する。
- PDF原本と取得HTMLはこのworktreeにローカル保存しgit対象外。`pdf-manifest.json`にファイル名・サイズ・SHA256を保存。各ファンドの公式資料への入口は `funds.json`、SBIランキングのURLは `sbi-top10.json`。再取得時は日付とハッシュが変わるので過去の証跡を上書きしない。

## 検証

32本の構成・読みやすさ・一次資料要件を3担当で全文確認。終価、複利年率、最大下落率を正規化CSVから独立再計算して一致。32本×画面幅320/390/1280pxの96ケースでページ横はみ出し・見出し重複・切れた本文アンカー0。記事構造・FAQ・孤立ページ・内部リンク・OGP・共有URL・sitemap、および生成物一致の14検査は最終状態で通過。全体テストは182件実行し、今回起因のFAQと孤立ページの失敗は修正・再検査済み。変更前でも失敗する5件（医療費控除記事・勧奨記事・高額療養費記事・既存広告宣伝費記事の1px横スクロール・補助金日程の年度記載）は別件として残る。jsdom不足で拡張機能3件は測定不能。詳細は `validation.json`。
