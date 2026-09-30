# r16 t1-z 修正監査メモ

照合基準日: 2026-09-30。テストは2026-10-01にまたがって実行。

原審査1328単位: ok478 / unresolved63 / nonclaim332 / out_of_corpus455。
正本の再確認でunresolvedの1単位を撤回し、ok479 / wrong・要修正62。
審査区分での正本照合誤り率は62/(479+62)=11.46%（再確認前63/541=11.65%）。
この62には見出しだけの2単位と用紙の欄新設を断定した1単位を含む。これらを事実誤認の集計から除外する厳密集計は59/(479+59)=10.97%。正本外の3件はこの分母・分子に含めない。

修正は65単位（high28 / medium31 / low6）。正本に照らした要修正62と、別モデルがwrongとした正本外3。
修正後の独立再審査は未実施のため、事後の誤り率を0%とは報告しない。

## 原審査をそのまま採用しなかった箇所

- s-1212ef957022b7cea260-1: 年末調整資料nencho_all.pdf p.3を画像で再確認。R8/R9の基礎控除104万円は正しい。99万円はR10の別の列。給与190万円→所得116万円の例と税額6126円、coreと既存テストを維持。画像はevidence/nencho-page3.png。
- s-1712d1e3fb930a3528da-1: 租税特別措置法41条の15の5第3項は「保険料控除申告書」に氏名・個人番号を記載する規定。基礎控除申告書への置換案は採らず、用紙に欄が追加されたとの断定を法定記載事項に精密化。証拠はevidence/special-tax-41_15_5.txt。

## 被覆の意味

台帳のcoversは0→565、verifiedは0→475、理由付きnonclaimsは0→332。元ok478のうち3単位は要件を精密化して文が変わったためverifiedを引き継がない。修正文には独立審査済みの印を付けない。
元not_wrong/unsureの正本外452単位はすべて元ID・text_hashを維持し、needed_sourceを記録。okへの昇格なし。
現在の総単位1349、未処理452、理由不明の未処理0。文の分割等により元1328から21増加。

## 計算機と検証

計算coreに誤りは確認されなかったためcore、条件表、境界値テストの追加はなし。既存のひとり親・配偶者控除テストで境界を確認。古い文言3件をtests/stale_values.jsonに登録。
HTMLをdb443c91で先にコミットしてからCHECKABLE全5生成器を実行。生成器fresh検証は成功。
全テストの最終結果はfinal-tests.log、python-tests.logを参照。ユーザー指定の基点の赤はtest_hojokin_sourcesとtest_layout_visualの2件。独自の事前全テストは中断したため完走した基点測定として扱わない。

個々の変更はresolutions.json / changed-units.json、被覆はcoverage-final.json、根拠はclaimsのcorpus_refとsource-registry.jsonを参照。

追記: 全テストは226本完走。生成物の追加同期と単独再試験を経て最終224緑・既知2赤。card-descと検索索引・関連記事カード2ページも同期し、追加生成物は10月1日付。詳細はtest-summary.json、generators-verified.log、generated-pages-check.json。
