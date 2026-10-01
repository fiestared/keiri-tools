# 修正根拠（2026-10-01 JST）

入力正本は RUN=/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261001/t3-q2 の corpus。入力は変更しない。

- 短時間労働者: service_kounen_tekiyo_jigyosho_tanjikan.txt 167–213行を開いて照合。事業所の三分類、週20時間、学生と例外、除外賃金、2か月以内等の適用除外。撤廃日は corpus_desc.md の確定事項に従った。
- 被扶養者: service_kounen_tekiyo_hihokensha1_20141202.txt 158–196行を開いて照合。130万円未満、60歳以上・障害者180万円未満、19歳以上23歳未満150万円未満、見込み収入、国民年金第1号手続き。
- 標準報酬: corpus/pages/santei_guidebook_r8-43.png（印刷40頁）を画像で確認。月給10万円は93,000円以上101,000円未満、標準報酬98,000円、厚生年金折半8,967円。今回削除した「健康保険5等級」は元の審査が未収録とした括弧であり、等級5が事実として誤りと確認したわけではない。実際、追加の保険料調整ページの健康保険表では98,000円が5等級。計算金額は変えない。
- 配偶者の150万円例外: 新規の図注だけを日本年金機構 https://www.nenkin.go.jp/oshirase/taisetu/2025/202508/0819.html で補足確認。配偶者は対象外。既存の正本外単位はokへ昇格させない。取得本文 dependents-19to22.html。
- 正本外のwrong（基礎控除）: 国税庁 https://www.nta.go.jp/publication/pamph/gensen/2026kaisei.pdf の1頁で、489万円超655万円以下は基礎控除67万円、655万円超2,350万円以下は62万円と確認。引用の前提（加算対象655万円以下）を補記。取得資料2026kaisei.pdf。
- 正本外のwrong（保険料軽減）: 日本年金機構 https://www.nenkin.go.jp/service/kounen/hokenryo/hokenryochosei/keisan.html の保険料額表を確認。88,000円・厚生年金18.3%なら全額16,104円、通常の本人負担8,052円に対して初めの24か月4,026円、25–36か月6,039円。したがって元の「本来の25/50（半分）」は通常の本人負担を分母にすれば正しい。別モデルの「半分を通常の折半と取り違えた」という理由はそのまま採らず、分母と対象外保険料の明確化として修正。取得本文hokenryochosei-keisan.html。

基礎控除の古い上限省略をstale_values.jsonに登録。staleHitsへ旧文を渡すと1件拒否、修正文では0件。計算機/coreの誤りは今回0件で、core・境界表・条件表の変更はない。

被覆の読み方: coversは主張IDとの対応、verifiedは確認済みの記録。既存の正本外対応38件はcoverage_status/needed_sourceを付けて維持し、verifiedには登録しない。正本外のnot_wrong 246件・unsure 2件は、変更後にも同じpage/idが全248件存在することを確認。修正後の新文面は担当者再照合で、別モデルによる再審査ではない。

被覆登録の引用も確認: nenkin_seidoannai-3.png 左下を画像で開き、正社員・法人代表者等、および週時間と月日数の両方で4分の3以上という文面を確認。新規台帳のOCRの崩れた引用はこの画像の逐語へ差し替えた。算定ガイドのOCR引用も印刷40頁で確認した給与控除の端数処理と額表抜粋へ置き換えた。
