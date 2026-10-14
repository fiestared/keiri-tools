---
type: concept
title: 銀行別の振込手数料ページを生成（2026-10-14・三菱UFJとゆうちょ、みずほは一次取得不能で保留）
source: Masahiro 2026-10-14 の依頼。wt/bank-pages の実装・curl原本・検査ログ。
created: 2026-10-14
tags: [implementation, keiri-tools, bank-fees, growth]
---

[[decisions/keiri-opus-growth-go-2026-10-14]] と [[research/keiri-growth-areas-opus-2026-10-14]] に従い実装。作業場は ~/Scripts/keiri-tools-bank-pages、ブランチ wt/bank-pages。pushなし、公開は司令塔。

## 完成したもの

- /column/yucho-furikomi-tesuryo/ と /column/mufg-furikomi-tesuryo/ を tools/gen_bank_fee_pages.mjs で生成。fee_tableを修正していない。他行宛ての額・条件・verified_dateはfee_tableから取得。
- fee_tableに同行宛ての数値項目がないため、curlで照合した同行宛て・振替の補助データと一次資料の逐語を tools/bank_fee_page_data.json に保存。確認日は2026-10-14、主表はfee_tableのverified_dateを維持。
- 個人と法人、他行宛てと同行宛て、実際の振込額29,999/30,000/30,001円の境界、電信振替と総合・給与振込の違い、優遇・非居住者・取引時確認・法人契約料金を表示。印刷ボタンと差引ツール、比較ページとの相互リンク。
- 生成時にcurlで公式表の該当セルとfee_tableを照合。不一致・取得不能の銀行は生成しない。エラー時に前回の照合結果を再利用しない。--checkとtests/test_bank_fee_pages.mjsで鮮度・境界・タイトル・説明・出典・確認日を検査。局所破壊と公式表の金額/境界の変更も捕捉。

## 保留と一次照合

みずほのfee_tableにある個人・法人EBの公式URLはcurlでHTTP 403。別の公式ページやパラメータ付きURLでも取得不能。個人の公式FAQはHTTP 200で110円と一致したが、法人EBの料金を再照合できず、みずほのページ全体を生成していない。403は料金不一致と区別する。不一致を確認して勝手にデータを直したものはない。

三菱UFJの個人154/220円・法人484/660円、ゆうちょの個人と法人165/165円は、公式ページHTTP 200でfee_tableと一致。同行宛ては同じ原本の該当セルで確認。残りの銀行の一括生成は実施していない。補助データと公式表の確認を登録すれば同じ生成器を使える。

根拠は reports/bank-pages/evidence/ と source-verification.json。Bing優先順位の原本は research が参照する bing-GetQueryStats.json、集計は reports/bank-pages/bing-priority.json。需要・被覆もkeyword_demand.pyで再測定。既存の比較記事との役割を横並び比較／当該銀行の条件と印刷に分けた。

## 最終検査

全tests/*.mjs 321本を実行。今回の追加で発生したPVリンクとQA検索の2件を修正して再実行した最終状態は314緑、今回の赤0、既存の赤6・環境不一致による測定不能1。

既存の赤は test_hojokin_sources（補助金タブ）、test_kogaku_article（認定証の節の条項）、test_nav / test_site_search（既存shintaku-hoshuの検索ボタン）、test_no_orphan（既存emaxis-nikkei-vs-tawara-nikkei）、break_kogaku（無傷が赤なので停止）。test_layout_visualは基準がPlaywright 1.62.1 / Chromium 151、実環境が1.58.2 / 145。検査・画像基準を緩めていない。

作業開始時origin/main 22519fef49e11b3666545b8b1b4dec2695250c50の全262本は255緑・7赤。終盤のorigin/main 1981c21b64ce4e10bee1f08665fdca199e2df292でも残る該当7本を再実行してすべて再現。初回全体ログには修正前のPV/QAの赤も残し、修正後のpv-browser.log / qa-test.logとtest-results.jsonを最終判定にする。

銀行ページの単体・壊し、記事構造、比較表、関連リンク、layout、台帳の全被覆・条件、QA・PVは緑。両銀行のE2Eは1280pxと390pxのはみ出し、印刷呼出し、差引計算への遷移・正常な答えが緑。PCと390pxのスクリーンショットを目視。Browser接続がsandboxPolicy欠落で失敗したため、既存shot_page.mjsで撮影。

質問検索には対象名を必要とする索引属性を追加。銀行名のない「銀行振込」は比較・反映時間・振替との違いへ、銀行名のある質問は個別ページを候補にする。比較ページ側のリンクはPV計測の専用スロットと区別して通常の文脈付きリンクとした。

主張台帳は単位の全被覆と条件を検査したもので、独立の事実審査済みを名乗らない。公開前の独立照合と司令塔の判断は未実施。料金データへの修正は0、pushなし。詳しい再生成手順・検査ログ・原本・画面は作業場の reports/bank-pages/README.md。
