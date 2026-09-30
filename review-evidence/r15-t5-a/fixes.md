# 独立審査結果

判定：差し戻し。現snapshotは合格としない。修正は執筆者の作業場で行い、修正後の新snapshot・対応するsegments/outを受け取って再照合する。固定コピーsiteと元の執筆作業場は変更していない。

対象：全694件（page,idの組で一意）。内訳：ok 187、nonclaim 199、out_of_corpus 243、unresolved 65。protected=true 106件にnonclaimは0件。zone=summary全55件に加え、本文のsummary-box、FAQ回答、calloutも照合した。既存high全10件は未解決を維持。

正本はRUN/corpusとcorpus_desc.mdに限定。他モデル・サブエージェント・orca・スキル・pushは使用していない。外部資料を追加取得して現snapshotの正本に混ぜることもしていない。正本にある非課税・調整控除の記載はその記載範囲だけを用い、未収録の自治体差・条文・適用年度を補完していない。

## 審査範囲

segments.jsonの全件とout/s0000.json〜out/s0017.jsonの全判定・findingsを確認した。IDはページ間で重複するためpageとの組で照合。以下は各outファイルの掲載順全範囲であり、okを抜粋審査したものではない。

|入力|件数|開始ID|終了ID|元okの再審査件数|
|---|---:|---|---|---:|
|out/s0000.json|39|s-0c7f1b8d312b90b2f892-1|s-0a413bb30973b5367e08-1|12|
|out/s0001.json|39|s-b1a655c95e99b2712349-1|s-c3a78ab8340bd25bf3ca-1|10|
|out/s0002.json|39|s-d0a8c01ca5acc56c0950-1|s-a45cf0ebea4f306f624e-1|3|
|out/s0003.json|39|s-1137ddeffed4ccfa1bed-1|s-2c78b3212ab451dc4d88-1|17|
|out/s0004.json|39|s-b4e15c5d3c9f7c57a39c-1|s-8764511a16835b0b64c5-1|14|
|out/s0005.json|39|s-c5d7e7b4542aa4d129e7-1|s-b9fe4582e8441d04676c-1|5|
|out/s0006.json|39|s-e8de3db2ce1a17a9e786-1|s-313980f375839482f8d3-1|8|
|out/s0007.json|39|s-eccd61facebfbab67554-1|s-9b8a565311dd466fce74-1|7|
|out/s0008.json|39|s-19757c5810339f306b59-1|s-43354277202057c02d0d-1|3|
|out/s0009.json|39|s-4d64cae90d87cc14fa8b-1|s-5df454d85745604ac721-1|8|
|out/s0010.json|39|s-4e1c12182e67d9ccb9f3-1|s-969ca4e37679635745ca-1|13|
|out/s0011.json|39|s-896b3205507d87aae94a-1|s-1e16e30a503951b88eec-1|25|
|out/s0012.json|39|s-b11a00b3148ac5b4acb2-1|s-62ac39bd72c3994408ee-1|5|
|out/s0013.json|39|s-535ef611ac25404a7933-1|s-fc1c3831b3c490f3b3d8-1|8|
|out/s0014.json|39|s-6441b07032ef6b80571c-1|s-2cffce712bf695fc71aa-1|9|
|out/s0015.json|39|s-fd0d9e882621dcd15cce-1|s-9e45aa9a28b394b9fc81-1|27|
|out/s0016.json|39|s-0a442207912a6d1ef254-1|s-4c776590be735d4c95e8-1|22|
|out/s0017.json|31|s-a43f0a374889aeb90bd1-1|s-313980f375839482f8d3-1|8|

|ページ|全件|ok|nonclaim|out_of_corpus|unresolved|
|---|---:|---:|---:|---:|---:|
|docs/column/juminzei-tokubetsu-choshu/index.html|273|63|72|119|19|
|docs/embed/furusato/index.html|58|9|36|10|3|
|docs/furusato/index.html|363|115|91|114|43|

正本を開いて確認した主要範囲：東京都個人住民税250〜376、460〜529、554〜555、586〜650、683〜760、825〜841行／総務省個人住民税98〜134行／総務省ふるさと納税控除25〜99行・概要27〜38行／国税庁1155の9〜85行・1150の11〜24、74〜109、135〜156行／地方税法34条・314条の2の所得控除、配偶者・扶養区分、基礎控除、同居直系尊属（1〜96、495〜587、670〜696、748〜835行等）／35条・314条の3全文／37条の2・314条の7の寄附金税額控除・税率区分（1〜55、120〜205行等）／314条の6全文／附則7全文／附則5条の4の1〜32行。各IDの採否理由と具体的な箇所はsegment-adjudication.jsonに記録。

## 書き手に必要な修正

1. 特別徴収：要約・本文・図表の1〜4月退職の一括徴収に支払予定額等の条件を明示する。「当初から不足」と「予定されていた支払がなくなった」を混同した図注は条文原本を追加して修正する。5月退職の「未徴収分は残らない」も徴収不能時を区別する。
2. 新卒・退職：就労なしと所得なしを同一視しない。2年目6月の開始や退職翌年課税には前年の課税所得等の条件を付ける。転居は単純な翌年度ではなく当該年度の1月1日住所地で説明する。
3. ふるさと納税：×1.021省略で分母が大きくなると寄附上限は小さくなる。「過大」「自腹を切る」という逆方向の説明を本文・callout・まとめで修正する。例えば天井46,840円を固定すると46,840÷0.85＋2,000 ≒57,105.88円、÷0.84895なら約57,174.04円である。この算術は年収500万円の税制計算全体を認証するものではない。
4. 両計算機：通常の老人扶養は「同居老親等以外」とし、同居老親等は本人又は配偶者の直系尊属・常況同居という要件を案内する。共働きだけで配偶者控除なしと判定させない。16歳未満の子について給与850万円超の所得金額調整控除も説明する。
5. 所得税率と特例分用税率の相違、各控除上限・成立条件を明記する。全額控除・手続間の損得・要約等式を無条件で断定しない。社会保険料の実額入力だけで「正確」「こちらが正しい」とする精度保証を改める。
6. 令和8年分の改正適用、基礎控除104万円の対象所得、特例割合、年収500万円57,174円と全早見表、端数配分は不足資料を補って独立検算する。未解決highを文章上の言い換えだけでok化しない。
7. 確定申告への寄附記載漏れは「一切控除を受けられない」と断定せず、更正の請求・所得税額に異動がない場合の自治体相談を案内する（nta_1155:46,50）。

## 不足する正本資料

- 特別徴収の期限・端数・初月一括・退職・異動届：地方税法20条の4の2、20条の5、317条の6、321条の3〜5及び321条の5の2、施行規則9条の24・10条、自治体手引きと様式。源泉所得税との比較は所得税法・国税庁年末調整資料。
- 普A〜普F、級地別の非課税限度額、納期特例、延滞金：対象自治体の条例・切替理由書と対応法令。収録された東京都の概説だけから未収録条件を補わない。
- 所得税法86条、租税特別措置法29条の4・41条の16の2、給与所得の法定表、令和8年度改正附則の適用年、地方税法附則5条の6、特例控除絶対上限・防衛特別所得税の改正条文と適用年度。将来施行版を使う場合も附則で年度を確認する。
- 社会保険料概算の年度別料率・標準報酬・賞与条件、源泉徴収票記載要領、端数処理規定、入力を固定した独立検算結果。サイト自身の計算結果は正本の代用にならない。
- ワンストップの当初申請1月10日必着、決済日・名義の取扱いは公式手続資料。附則7の変更届期限を当初申請期限の根拠に流用しない。
- 年収700万円の公式内訳図、引用されているが未収録の出典本文、プロフィール・サービス仕様の裏付け。各out_of_corpusの必要資料はJSONのneeded_sourceに全件記載。

## 未解決ID（全件）

- [high] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-0a6eeea4793131054195-1`：corpus/tokyo_kojin_ju.txt:755-755。正本再照合の結果、現snapshotでは未解決。死亡退職の除外だけで1〜4月退職者の残額全額一括徴収を無条件の義務としている。正本は「5月31日までの間に支払われる予定の退職手当等が残りの税額を超える場合」という条件を付けており、この確認単位にはその条件がない。本文後方には条件の補足があるが、固定単位の断定には含まれていない。死亡退職除外と条文の詳細は321条の5本文が未収録のため未確認。 同じ単位内の均等割額相当以下の初月一括徴収、所得税との年分比較は必要な正本が未収録で照合できない。
- [high] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-b5bccb785e6e3c431d1d-1`：corpus/tokyo_kojin_ju.txt:755-755。正本再照合の結果、現snapshotでは未解決。死亡退職の除外だけで1〜4月退職者の残額全額一括徴収を無条件の義務としている。正本は「5月31日までの間に支払われる予定の退職手当等が残りの税額を超える場合」という条件を付けており、この確認単位にはその条件がない。本文後方には条件の補足があるが、固定単位の断定には含まれていない。死亡退職除外と条文の詳細は321条の5本文が未収録のため未確認。 同じ単位内の均等割額相当以下の初月一括徴収、所得税との年分比較は必要な正本が未収録で照合できない。
- [high] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-c02c53709bc9a898895e-1`：corpus/tokyo_kojin_ju.txt:755-755。正本再照合の結果、現snapshotでは未解決。死亡退職の除外だけで1〜4月退職者の残額全額一括徴収を無条件の義務としている。正本は「5月31日までの間に支払われる予定の退職手当等が残りの税額を超える場合」という条件を付けており、この確認単位にはその条件がない。本文後方には条件の補足があるが、固定単位の断定には含まれていない。死亡退職除外と条文の詳細は321条の5本文が未収録のため未確認。
- [low] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-96b885a73a0cbf6e6092-1`：corpus/soumu_kojin_juminzei.txt:102、corpus/tokyo_kojin_ju.txt:751-755。正本再照合の結果、現snapshotでは未解決。退職年と課税対象の所得年が特定されず、「翌年」と「去年の所得の分がまだ残っている」の対応を確定できない。正本は前年所得課税と退職時の未徴収残額を別に説明している。
- [low] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-cea1079b6ba547797d4f-1`：corpus/tokyo_kojin_ju.txt:277,638-647。正本再照合の結果、現snapshotでは未解決。固定単位が疑問の途中で終わり、住宅ローン控除の「還付」と1年のずれの具体的な因果関係・対象年が明示されていない。正本だけではこの範囲の説明を裏付けられない。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-0ec5f435f988da7703f8-1`：corpus/tokyo_kojin_ju.txt:297-305;corpus/tokyo_kojin_ju.txt:464-466。正本再照合の結果、現snapshotでは未解決。就労していないことから所得がないとは言えない。正本には預貯金利子や株式等の譲渡所得もある。新卒者も前年に所得がある場合があり、同一視できない。
- [追加審査] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-c97ab70a6e4562537e63-1`：corpus/tokyo_kojin_ju.txt:297-311,488-503。前年所得がないという仮定なら結論は対応するが、実際の直前文は「働いていなかった＝新卒＝所得なし」と誤って一般化している。前提の修正がない固定snapshotでは当該結論も採用しない。前年に課税される所得がない場合という条件を明示する。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-64e4aba8c1b50fa3ae0c-1`：corpus/tokyo_kojin_ju.txt:488-503;corpus/tokyo_kojin_ju.txt:291-291。正本再照合の結果、現snapshotでは未解決。直前の前年所得なしという設例でも、入社年の所得が非課税基準以下なら2年目6月に天引きは始まらない。課税される所得・税額があるという条件を欠いた断定。
- [low] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-c42d749cb2b7d7568673-1`：corpus/tokyo_kojin_ju.txt:291,488-503。正本再照合の結果、現snapshotでは未解決。手取りの変化には給与額や保険料等も関係し得るが、相談者の課税所得・給与等が示されず、住民税が変化の原因と断定するための根拠が不足。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-741cdbbd53494f880cfa-1`：corpus/soumu_kojin_juminzei.txt:102-102;corpus/tokyo_kojin_ju.txt:488-503。正本再照合の結果、現snapshotでは未解決。前年に所得があるだけで必ず課税されるわけではない。正本には前年の所得が一定額以下等の場合の非課税条件がある。「課税対象の所得」等の条件を欠いている。
- [追加審査] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-bbdca4f9de4925d877e6-1`：corpus/tokyo_kojin_ju.txt:752-755。1〜4月退職の一括徴収には支払予定額が残税額を超える等の条件がある。図注はあるが、その図注の「足りなければ徴収できる額まで」が未解決であり、無条件の義務表示としてokにはできない。図と注記を一体で修正する。 必要資料：地方税法321条の5第2項全文（死亡・継続徴収・支払予定額不足と予定後の不払いの区別）。
- [追加審査] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-dbab8e43299d956f952e-1`：corpus/tokyo_kojin_ju.txt:291,751-755。通常の徴収期間が5月で終わることは確認できるが、5月退職者の最終給与から常に通常どおり徴収して終了できるとはいえない。給与不足等で徴収できない場合を区別し、図の「未徴収分は残らない」と併せて修正が必要。 必要資料：地方税法321条の5全文と5月退職・最終給与不足時の自治体事務手引き。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-727e07a38af241275fca-1`：corpus/tokyo_kojin_ju.txt:291,751-755。正本再照合の結果、現snapshotでは未解決。6月〜翌年5月の徴収期間は正本291行で確認できるが、5月退職時に必ず未徴収額がなくなるとは確認できない。最終給与から徴収できない場合の扱いが正本にないため根拠不足。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-13a4742e3d96cebbe301-1`：corpus/tokyo_kojin_ju.txt:752-755。正本再照合の結果、現snapshotでは未解決。正本755行は5月31日までの予定退職手当等が残税額を超える場合を示すが、死亡退職の除外と「足りなければ徴収できる額まで」は確認できない。支払額不足時にも一部一括徴収するという補足の根拠が不足し、単位全体を照合済みとできない。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-6b2b9e400aba5e93b8dc-1`：corpus/tokyo_kojin_ju.txt:752-755。正本再照合の結果、現snapshotでは未解決。正本755行には支払予定退職手当等が残税額を超える条件があるが、この表行は条件を記さず全額天引きを断定する。図の注記を含めても不足時の扱いと「最後の給与」の根拠が不足し、単位全体の妥当性を確定できない。
- [追加審査] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-2c78b3212ab451dc4d88-1`：corpus/tokyo_kojin_ju.txt:291,751-755。通常の徴収期間が5月で終わることは確認できるが、5月退職者の最終給与から常に通常どおり徴収して終了できるとはいえない。給与不足等で徴収できない場合を区別し、図の「未徴収分は残らない」と併せて修正が必要。 必要資料：地方税法321条の5全文と5月退職・最終給与不足時の自治体事務手引き。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-03034f7463ffdfe6a032-1`：corpus/tokyo_kojin_ju.txt:291,488-503。正本再照合の結果、現snapshotでは未解決。根拠不足。正本は前年所得課税・6月開始を示すが、入社2年目に必ず課税が始まるとは示していない。新卒・前年所得なしという文脈でも、1年目の所得が非課税限度額を超える条件が必要。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-5c914f2991b2278e8a36-1`：corpus/tokyo_kojin_ju.txt:291,488-503。正本再照合の結果、現snapshotでは未解決。根拠不足。前年所得課税と給与天引きの仕組みは収録されているが、1年目の所得が非課税限度額以下なら2年目も徴収されず、住民税により手取りが変わるという条件を確定できない。
- [medium] `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-15c06c3bc33064e91639-1`：corpus/soumu_kojin_juminzei.txt:109-109。正本再照合の結果、現snapshotでは未解決。「翌年度から新住所地に変わります」は翌年度の1月1日住所地という条件が欠落。1〜3月の転居では、その直後の4月に始まる年度の1月1日は転居前なので、納入先が直ちに新住所地になるとは限らない。
- [medium] `docs/embed/furusato/index.html` / `s-4d64cae90d87cc14fa8b-1`：corpus/tokyo_kojin_ju.txt:524-525,610-611、corpus/egov_chihozei_34.txt:551-586。正本再照合の結果、現snapshotでは未解決。「共働き」を配偶者控除なしと一括する妥当性を判断するには配偶者の所得要件が必要。正本には控除対象配偶者の区分があるが、共働きという条件と控除対象配偶者の関係を確定できる定義資料が不足している。
- [medium] `docs/embed/furusato/index.html` / `s-e6de6ba01d80bd4fe0e3-1`：corpus/egov_chihozei_34.txt:823-823。正本再照合の結果、現snapshotでは未解決。老人扶養の通常区分を「別居」に限定しているが、同居していても本人又は配偶者の直系尊属でない老人扶養親族は同居老親等の増額対象にならず通常区分となる。別居・同居だけの区分では入力先を誤らせる。
- [medium] `docs/embed/furusato/index.html` / `s-230237a89c587d524f33-1`：corpus/egov_chihozei_34.txt:823-823。正本再照合の結果、現snapshotでは未解決。同居老親等には本人又は配偶者の直系尊属であり、本人又は配偶者との同居を常況とする要件がある。「70歳以上・同居」だけでは同居する兄姉等まで含む読みに繋がり、対象者要件が不足している。
- [追加審査] `docs/furusato/index.html` / `s-4d64cae90d87cc14fa8b-1`：corpus/tokyo_kojin_ju.txt:524-525,610-611、corpus/egov_chihozei_314_2.txt:551-586。配偶者控除は本人・配偶者の所得等で判定する。「共働き」を一律に「なし」へ誘導する選択肢は単なるUI名ではない。埋め込み版の同一表示と同様に未解決とし、所得要件を明示する。 必要資料：控除対象配偶者の定義・対象年の所得要件を示す法令本文。
- [medium] `docs/furusato/index.html` / `s-d382689283592365e758-1`：corpus/egov_chihozei_314_2.txt:675-675;corpus/egov_chihozei_314_2.txt:823-823。正本再照合の結果、現snapshotでは未解決。老人扶養の通常区分は「同居以外」ではなく、同居直系尊属に該当しない老人扶養親族。同居する兄姉などの非直系尊属も通常の老人扶養に含まれるため、この表示では該当する入力先がなくなる。
- [medium] `docs/furusato/index.html` / `s-7dd4e0676cf9a50859c5-1`：corpus/tokyo_kojin_ju.txt:363-368;corpus/egov_chihozei_314_2.txt:682-685;corpus/tokyo_kojin_ju.txt:506-520。正本再照合の結果、現snapshotでは未解決。「所得割がかかる方は限度額は変わりません」は例外を落としている。給与収入850万円超で23歳未満の扶養親族を有する場合には所得金額調整控除が適用され、16歳未満の子も対象となり得るため、所得割と寄附限度額に影響し得る。扶養控除の廃止年を確認する改正資料はこの正本にはない。
- [追加審査] `docs/furusato/index.html` / `s-230237a89c587d524f33-1`：corpus/egov_chihozei_314_2.txt:675,823。70歳以上で同居するだけでは足りず、本人又は配偶者の直系尊属で、本人又は配偶者との同居を常況とすることが必要。通常老人扶養を「同居以外」とする隣接ラベルと組み合わせると同居兄姉等を誤分類させる。埋め込み版と同じ未解決判定とする。
- [medium] `docs/furusato/index.html` / `s-4c49a48ce9525f83871f-1`：corpus/egov_chihozei_314_2.txt:529-532、corpus/egov_chihozei_314_6.txt:47-58,119-134。正本再照合の結果、現snapshotでは未解決。正本の地方税法314条の2第1項8の2は30万円、314条の6の表はひとり親の1万円・5万円を示すが「政令で定めるもの」の父母対応を定める施行令が収録されていない。また所得等によって調整控除差が所得割へ反映されない場合を含め、文全体の条件を確認する根拠が不足。
- [medium] `docs/furusato/index.html` / `s-4d2d966209252c5b8372-1`：corpus/soumu_kojin_juminzei.txt:112-120、corpus/soumu_furusato_deduction.txt:38-70、corpus/egov_chihozei_314_2.txt:672-685。正本再照合の結果、現snapshotでは未解決。式と所得控除の仕組みは正本にあるが、社会保険料・扶養が増えると限度額も必ず小さくなることや年収だけの早見表は当てにならないとの断定は、税率区分・表の前提まで確認できず根拠不足。固定単位全体をokとは判定できない。
- [high] `docs/furusato/index.html` / `s-cb9e6ace70a5daa6e646-1`：corpus/tokyo_kojin_ju.txt:692-696;corpus/soumu_furusato_deduction.txt:51-70。正本再照合の結果、現snapshotでは未解決。限度額は特例控除割合で割るため、×1.021を省略して90％−所得税率とすると分母が大きくなり、限度額は小さくなる。5％の場合90％−5％＝85％であり、前半の85％と同じ計算。「大きく見積もる」という後半が逆。
- [high] `docs/furusato/index.html` / `s-2c69481436ea3865adbf-1`：corpus/tokyo_kojin_ju.txt:692-696;corpus/soumu_furusato_deduction.txt:51-70。正本再照合の結果、現snapshotでは未解決。限度額は特例控除割合で割るため、×1.021を省略して90％−所得税率とすると分母が大きくなり、限度額は小さくなる。5％の場合90％−5％＝85％であり、前半の85％と同じ計算。前文の「後者」を原因として上限超過するとする因果が逆。
- [medium] `docs/furusato/index.html` / `s-90bffd465017a65a7f4c-1`：corpus/soumu_furusato_deduction.txt:57-58、corpus/egov_chihozei_314_7.txt:131-152。正本再照合の結果、現snapshotでは未解決。正本は特例分の税率が実際の所得税率と異なる場合があると明記（総務省控除資料57〜58行）。実際の所得税率区分が下がるだけで特例割合が上がるか、令和8年度改正後の人的控除差調整を確認できず根拠不足。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [medium] `docs/furusato/index.html` / `s-c20301e777ce4448b299-1`：corpus/egov_chihozei_35.txt:9、corpus/egov_chihozei_314_3.txt:9、corpus/egov_chihozei_314_6.txt:18,122、corpus/egov_chihozei_37_2.txt:125、corpus/egov_chihozei_314_7.txt:125。正本再照合の結果、現snapshotでは未解決。税率と配分の変更は確認できるが、市・県別の端数処理後も限度額が「1円も変わらない」と保証する資料がなく根拠不足。
- [medium] `docs/furusato/index.html` / `s-87201b974f326fe7e5e4-1`：corpus/tokyo_kojin_ju.txt:464-481,638-647,729、corpus/egov_chihozei_314_7.txt:125。正本再照合の結果、現snapshotでは未解決。医療費控除や住宅ローン控除の規定はあるが、ワンストップ・退職金・株式所得・配当所得を含む全列挙条件で計算機結果より限度額が小さくなるとの結論は、この正本だけでは確認できず根拠不足。
- [追加審査] `docs/furusato/index.html` / `s-02a871692baf3564decd-1`：corpus/soumu_furusato_deduction.txt:38,50,53-58、corpus/egov_chihozei_314_7.txt:125,131。式は特例分20%限度を逆算した目安としては導けるが、実際の所得税率と特例分用税率が異なる場合や他の限度がある。「自己負担2,000円の正確な上限」と無条件に同一視せず、概算式・成立条件を当該要約にも明記する。
- [追加審査] `docs/furusato/index.html` / `s-fa8ebc6c6520e86fe63c-1`：corpus/soumu_furusato_deduction.txt:38,50,53-58、corpus/egov_chihozei_314_7.txt:125,131。式は特例分20%限度を逆算した目安としては導けるが、実際の所得税率と特例分用税率が異なる場合や他の限度がある。「自己負担2,000円の正確な上限」と無条件に同一視せず、概算式・成立条件を当該要約にも明記する。
- [medium] `docs/furusato/index.html` / `s-896b3205507d87aae94a-1`：corpus/egov_chihozei_314_2.txt:672-685。正本再照合の結果、現snapshotでは未解決。扶養家族の人数だけで所得割額・上限が必ず小さくなるとはいえない。扶養控除は控除対象扶養親族に限られ、国内居住者は16歳以上という条件がある。控除額が増える場合という条件が必要。
- [追加審査] `docs/furusato/index.html` / `s-f95ae0e725029ca4dd35-1`：corpus/soumu_kojin_juminzei.txt:112-120、corpus/tokyo_kojin_ju.txt:693-695。控除の条件で上限が変わることは確認できるが、条件を固定した目安表もあるため「年収だけの早見表は当てにならない」という一律の精度評価までは導けない。対象表と前提の相違を示す表現に修正する。 必要資料：比較対象の早見表と年分・所得控除・社会保険料の計算前提。
- [medium] `docs/furusato/index.html` / `s-bc8b5a869f47955c6af3-1`：corpus/soumu_furusato_deduction.txt:40-42;corpus/nta_1155.txt:36-37。正本再照合の結果、現snapshotでは未解決。適用税率を決めるのは年収そのものではなく所得控除後の課税所得。0〜45％という範囲と特例分20％限度は一致するが、「年収により変わる」では課税所得という条件を取り違える。
- [medium] `docs/furusato/index.html` / `s-f6d6382d495e9bf0b647-1`：corpus/soumu_furusato_deduction.txt:59-70。正本再照合の結果、現snapshotでは未解決。「必ず」は上限内という条件を落とす。特例分が所得割額20％の限度を超える場合、3控除の合計は寄附額−2,000円に届かない。図の上限内の例に限定して表現する必要がある。
- [high] `docs/furusato/index.html` / `s-1e16e30a503951b88eec-1`：corpus/tokyo_kojin_ju.txt:693-695;corpus/soumu_furusato_deduction.txt:52-70;corpus/nta_1155.txt:37-37。正本再照合の結果、現snapshotでは未解決。×1.021を忘れると上限額を過大に出すという方向が逆。所得税率20％では正しい特例割合69.58％に対し省略すると70％となり、所得割額×20％を割る分母が大きくなるため上限額は小さくなる。正本の特例式と20％限度から確認できる。なお防衛特別所得税1％・復興分1.1％への組替え、2027年寄附から193万円の絶対上限、改正附則の適用年度と課税所得9,650万円の記述を裏付ける改正法・附則は未収録で、この単位の残りを照合済みとはしない。
- [medium] `docs/furusato/index.html` / `s-0c756eb29c47f3b9ffa9-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。5％を仮定した90％−5％×1.021＝84.895％の算術は一致する。しかし正本は特例分の税率を住民税課税総所得金額から人的控除差調整額を差し引いて求めると規定している（corpus/soumu_furusato_deduction.txt:57-58、corpus/egov_chihozei_314_7.txt:131-152）。令和8年分・給与所得356万円に対する所得税基礎控除104万円の適用条件と62万円＋42万円の内訳が正本にないため、この例に5％を適用できるか根拠不足。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [medium] `docs/furusato/index.html` / `s-5d4f029135cc878758a4-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。5％を仮定した90％−5％×1.021＝84.895％の算術は一致する。しかし正本は特例分の税率を住民税課税総所得金額から人的控除差調整額を差し引いて求めると規定している（corpus/soumu_furusato_deduction.txt:57-58、corpus/egov_chihozei_314_7.txt:131-152）。令和8年分・給与所得356万円に対する所得税基礎控除104万円の適用条件と62万円＋42万円の内訳が正本にないため、この例に5％を適用できるか根拠不足。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [medium] `docs/furusato/index.html` / `s-210b4dbd40f24dcff8e5-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。特例分の天井を割合で割って2,000円を加える式は正本の控除式と整合するが、例の46,840円の前提である社会保険料概算と84.895％の適用条件を確定できず、固定単位全体の根拠不足。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [medium] `docs/furusato/index.html` / `s-665e53485bb51a7f45a7-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。46,840÷0.84895＋2,000の円未満切捨てとして57,174円は算術上整合するが、天井額と特例割合の適用条件を正本から確定できず、令和8年分のこの人物の上限額として根拠不足。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [high] `docs/furusato/index.html` / `s-e4be1d7581193a3ba8c8-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。corpus/tokyo_kojin_ju.txt:529には令和8・9年分の所得税基礎控除が最高104万円となる記載があるが、給与所得356万円の場合の適用条件、62万円＋加算42万円の内訳、所得税率表は収録されていない。最高額の記載だけでは、この人物の控除額104万円・課税所得195万円未満・税率5％を照合できない。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [high] `docs/furusato/index.html` / `s-f749ddd5de7d476d06a8-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。53,000×5.105％＝2,705.65円、53,000×84.895％＝44,994.35円となり、表示の2,705円・44,995円への端数配分を裏付ける根拠がない。加えてこの例の5％の適用条件と上限額を正本から確定できず、自己負担がちょうど2,000円になるとの断定は根拠不足。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [medium] `docs/furusato/index.html` / `s-eee892886cafc1292bcc-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。44,995＜46,840の比較は正しいが、44,995円の端数処理、特例分の適用税率、46,840円の所得割額の前提を正本から確定できず、全額控除との結論は根拠不足。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [medium] `docs/furusato/index.html` / `s-32c83304c1425c48b79f-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。源泉徴収票の社会保険料等の金額の入力だけで正確な上限額が得られるというツールの精度を正本では確認できない。他の所得・控除・特例分税率・端数処理も影響し、指定正本に当ツールの検証資料がない。
- [medium] `docs/furusato/index.html` / `s-2e3322ec24793ec680fb-1`：corpus/tokyo_kojin_ju.txt:363-368,506-518、corpus/egov_chihozei_314_2.txt:672-685。正本再照合の結果、現snapshotでは未解決。正本は16歳未満を扶養控除の対象から除く一方、非課税判定には含める（corpus/egov_chihozei_314_2.txt:672-685、corpus/tokyo_kojin_ju.txt:506-518）。後続単位に例外の補足はあるが、この固定単位の「上限額に影響しない」という断定全体は扶養控除0円だけでは確認できず、適用範囲の根拠不足。さらに給与850万円超・23歳未満扶養の所得金額調整控除（東京都363-368行）もあり、低所得者の非課税例外だけの補足では足りない。
- [medium] `docs/furusato/index.html` / `s-143385b4ea3d5c0d3a60-1`：corpus/soumu_kojin_juminzei.txt:113-122、corpus/tokyo_kojin_ju.txt:638-647,729-730。正本再照合の結果、現snapshotでは未解決。所得控除が課税所得を下げる仕組みと特例分20％限度は正本にあるが、住宅ローン控除・退職金・株の譲渡益や配当の各ケースで、この表の上限より小さくなる条件を確定できない。corpus/soumu_kojin_juminzei.txt:113-122、corpus/tokyo_kojin_ju.txt:638-645、729-730だけでは複合主張全体の根拠不足。
- [medium] `docs/furusato/index.html` / `s-3b5d69f199719af1d02e-1`：corpus/soumu_furusato_deduction.txt:59-72。正本再照合の結果、現snapshotでは未解決。上限超過時に負担が2,000円を超える点は正本で確認できるが、「上限を知ることが全て」「失敗する典型」「少なく寄附しても損はしない」という評価全体と数円程度の端数差の根拠は不足しており、この固定単位全体をokと断定できない。
- [medium] `docs/furusato/index.html` / `s-53ebc535a194d097e688-1`：corpus/soumu_furusato_deduction.txt:59-70。正本再照合の結果、現snapshotでは未解決。寄附額−2,000円の全額控除は上限内等の条件を満たす場合に限られる。直前に上限超過の例を説明しているのに、この単位は条件を付けず控除総額を寄附額−2,000円と断定しており、上限超過時の正本の説明に反する。
- [high] `docs/furusato/index.html` / `s-18e76a9759e1c36c8353-1`：corpus/nta_1155.txt:21-23,45-46,55-56。正本再照合の結果、現snapshotでは未解決。確定申告で特例が無効になる点と第二表への記載は正本と一致するが、「含め忘れると…控除が一切受けられません」は断定が過剰。正本は申告漏れでも更正の請求により寄附金控除を受けられると明記している（所得税額に異動がない場合は市区町村に相談）。
- [medium] `docs/furusato/index.html` / `s-c96552a72018aa758fac-1`：corpus/egov_chihozei_314_7.txt:125、corpus/egov_chihozei_fusoku_5_4.txt:9-21、corpus/tokyo_kojin_ju.txt:638-647。正本再照合の結果、現snapshotでは未解決。「上限」が特例分20％から算出する寄附上限か、住宅ローン控除との併用後に自己負担2,000円で済む実質的な額か不明。正本の20％の母体は調整控除後の所得割額で、住宅ローン控除の減算は含まない。住宅ローン控除による未控除額の発生と上限自体の減少を区別する根拠が不足。
- [追加審査] `docs/furusato/index.html` / `s-5d0bfba5ac9f9b0af9dd-1`：corpus/soumu_furusato_deduction.txt:38,50,53-58、corpus/egov_chihozei_314_7.txt:125,131。式は特例分20%限度を逆算した目安としては導けるが、実際の所得税率と特例分用税率が異なる場合や他の限度がある。「自己負担2,000円の正確な上限」と無条件に同一視せず、概算式・成立条件を当該要約にも明記する。
- [追加審査] `docs/furusato/index.html` / `s-ecd4bf9ad5e70d37ee20-1`：corpus/nta_1155.txt:28-37、corpus/soumu_furusato_deduction.txt:59-70。要約の等式は全額控除の上限内等の条件付き。上限超過なら等号は成立しない。前後に天井の説明があっても、この要約にも「上限内では」を明示し、本文の同種指摘と整合させる。
- [low] `docs/furusato/index.html` / `s-9e45aa9a28b394b9fc81-1`：corpus/tokyo_kojin_ju.txt:693-695、corpus/soumu_furusato_deduction.txt:53-70。正本再照合の結果、現snapshotでは未解決。「過大になる」の対象が省略されている。直前の特例分の割合なら1.021を忘れると過大になるが、まとめ冒頭の寄附上限額なら分母が増えて過小になる。正本の算式だけでは、この省略された対象を確定できない。
- [medium] `docs/furusato/index.html` / `s-ce0e56f2a0b009691c4c-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。上限約6万円と寄附8万円だけでは所得税率・所得割額・各控除限度が特定できず、自己負担約1万7千円を正本から確認できない。総務省の計算式は税率を要するため、計算例の前提に根拠が不足している。
- [medium] `docs/furusato/index.html` / `s-d454935b1d411e02c828-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。正本は全額控除に一定の上限があると明記している。本文の当該単位には上限内等の条件がなく、どちらも常に寄附額−2,000円で損得なしという断定を確認できない。税率や他の税額控除等の個別条件についても根拠不足。
- [medium] `docs/furusato/index.html` / `s-13855f64baa0caf5c4b5-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。正本で手続きと控除税目の相違は確認できるが、「だけ」と限定してその他の差異を否定するための対象者・控除条件の根拠が不足している。
- [medium] `docs/furusato/index.html` / `s-381f848f27c7940501f5-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。令和8年度改正で上限が下がる対象者の存在を判定するための改正前後の全控除・適用条件が正本に不足している。最高104万円の基礎控除の記載だけではこの結論を確定できない。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [medium] `docs/furusato/index.html` / `s-ed130ed4c207a9d2964a-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。特例分の税率は住民税の課税総所得金額から人的控除差調整額を差し引いて求め、所得税の税率と異なる場合がある（corpus/soumu_furusato_deduction.txt:57-58）。所得税率区分が下がったという条件だけで特例分の割合上昇・上限低下を一律に結論づけられるか、改正の控除差調整・対象条件の根拠が不足している。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [high] `docs/furusato/index.html` / `s-f86a34dcc0356e59825c-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。SITEの説明には改正後計算とあるが、正本には計算機の実装の正確性や改正前早見表との比較を保証する資料がない。「そちらが正しい上限」とする断定の検証根拠が不足している。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [medium] `docs/furusato/index.html` / `s-21a852ca96d42bb50bab-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。当サイトの計算ロジックに基づくという出典説明はあるが、正本に令和8年分の所得税法・租税特別措置法の計算規定一式がないため、記事の算出根拠とツール実装の一致および法令準拠を検証する根拠が不足している。 必要資料：令和8年分の所得税法86条・租税特別措置法29条の4及び41条の16の2の適用本文と改正附則、社会保険料概算の資料、特例分の人的控除差調整額・端数処理を含む独立計算明細。
- [low] `docs/furusato/index.html` / `s-0b0fa93e79460ed590e0-1`：corpus/soumu_furusato_deduction.txt:33-79、corpus/nta_1155.txt:15-57、corpus/tokyo_kojin_ju.txt:521-529,638-647,686-705。正本再照合の結果、現snapshotでは未解決。控除や所得種類が計算に影響することを示す規定はあるが、住宅ローン控除・退職所得・譲渡所得まで含むこの計算機の結果への影響を単位全体として検証するための計算条件と正本規定が不足している。

## 既存判定から追加変更したID

- `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-c97ab70a6e4562537e63-1`：ok → unresolved。corpus/tokyo_kojin_ju.txt:297-311,488-503。前年所得がないという仮定なら結論は対応するが、実際の直前文は「働いていなかった＝新卒＝所得なし」と誤って一般化している。前提の修正がない固定snapshotでは当該結論も採用しない。前年に課税される所得がない場合という条件を明示する。
- `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-bbdca4f9de4925d877e6-1`：ok → unresolved。corpus/tokyo_kojin_ju.txt:752-755。1〜4月退職の一括徴収には支払予定額が残税額を超える等の条件がある。図注はあるが、その図注の「足りなければ徴収できる額まで」が未解決であり、無条件の義務表示としてokにはできない。図と注記を一体で修正する。
- `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-91dedf93ad9d00053871-1`：ok → out_of_corpus。corpus/tokyo_kojin_ju.txt:752-755は「支払われる予定の退職手当等」と普通徴収の原則を記すが、給与を含む支払額判定・義務免除の厳密な条件は条文未収録。概説から条文の全条件を補ってokとすることはできない。
- `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-dbab8e43299d956f952e-1`：ok → unresolved。corpus/tokyo_kojin_ju.txt:291,751-755。通常の徴収期間が5月で終わることは確認できるが、5月退職者の最終給与から常に通常どおり徴収して終了できるとはいえない。給与不足等で徴収できない場合を区別し、図の「未徴収分は残らない」と併せて修正が必要。
- `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-2c78b3212ab451dc4d88-1`：ok → unresolved。corpus/tokyo_kojin_ju.txt:291,751-755。通常の徴収期間が5月で終わることは確認できるが、5月退職者の最終給与から常に通常どおり徴収して終了できるとはいえない。給与不足等で徴収できない場合を区別し、図の「未徴収分は残らない」と併せて修正が必要。
- `docs/column/juminzei-tokubetsu-choshu/index.html` / `s-102bdaf17e7f92b27599-1`：ok → out_of_corpus。corpus/tokyo_kojin_ju.txt:752-755は「支払われる予定の退職手当等」と普通徴収の原則を記すが、給与を含む支払額判定・義務免除の厳密な条件は条文未収録。概説から条文の全条件を補ってokとすることはできない。
- `docs/furusato/index.html` / `s-4d64cae90d87cc14fa8b-1`：nonclaim → unresolved。corpus/tokyo_kojin_ju.txt:524-525,610-611、corpus/egov_chihozei_314_2.txt:551-586。配偶者控除は本人・配偶者の所得等で判定する。「共働き」を一律に「なし」へ誘導する選択肢は単なるUI名ではない。埋め込み版の同一表示と同様に未解決とし、所得要件を明示する。
- `docs/furusato/index.html` / `s-230237a89c587d524f33-1`：ok → unresolved。corpus/egov_chihozei_314_2.txt:675,823。70歳以上で同居するだけでは足りず、本人又は配偶者の直系尊属で、本人又は配偶者との同居を常況とすることが必要。通常老人扶養を「同居以外」とする隣接ラベルと組み合わせると同居兄姉等を誤分類させる。埋め込み版と同じ未解決判定とする。
- `docs/furusato/index.html` / `s-02a871692baf3564decd-1`：ok → unresolved。corpus/soumu_furusato_deduction.txt:38,50,53-58、corpus/egov_chihozei_314_7.txt:125,131。式は特例分20%限度を逆算した目安としては導けるが、実際の所得税率と特例分用税率が異なる場合や他の限度がある。「自己負担2,000円の正確な上限」と無条件に同一視せず、概算式・成立条件を当該要約にも明記する。
- `docs/furusato/index.html` / `s-fa8ebc6c6520e86fe63c-1`：ok → unresolved。corpus/soumu_furusato_deduction.txt:38,50,53-58、corpus/egov_chihozei_314_7.txt:125,131。式は特例分20%限度を逆算した目安としては導けるが、実際の所得税率と特例分用税率が異なる場合や他の限度がある。「自己負担2,000円の正確な上限」と無条件に同一視せず、概算式・成立条件を当該要約にも明記する。
- `docs/furusato/index.html` / `s-f95ae0e725029ca4dd35-1`：ok → unresolved。corpus/soumu_kojin_juminzei.txt:112-120、corpus/tokyo_kojin_ju.txt:693-695。控除の条件で上限が変わることは確認できるが、条件を固定した目安表もあるため「年収だけの早見表は当てにならない」という一律の精度評価までは導けない。対象表と前提の相違を示す表現に修正する。
- `docs/furusato/index.html` / `s-905eb1ace1dc4beaef4c-1`：ok → out_of_corpus。corpus/soumu_furusato_about.txt:34は3万円寄附・2万8千円控除という合計のみ。corpus/soumu_furusato_deduction.txt:34-58は税率と特例分の算式を示すが、年収700万円・夫婦子なしの税率20%という条件や復興税を省いた公式図の内訳は示さない。20%を仮定した算術は一致するが、この図の実例・出典としてのokは採用しない。
- `docs/furusato/index.html` / `s-8d0120816ea32497240b-1`：ok → out_of_corpus。corpus/soumu_furusato_about.txt:34は3万円寄附・2万8千円控除という合計のみ。corpus/soumu_furusato_deduction.txt:34-58は税率と特例分の算式を示すが、年収700万円・夫婦子なしの税率20%という条件や復興税を省いた公式図の内訳は示さない。20%を仮定した算術は一致するが、この図の実例・出典としてのokは採用しない。
- `docs/furusato/index.html` / `s-98eba30bafa7d445f026-1`：ok → out_of_corpus。corpus/soumu_furusato_about.txt:34は3万円寄附・2万8千円控除という合計のみ。corpus/soumu_furusato_deduction.txt:34-58は税率と特例分の算式を示すが、年収700万円・夫婦子なしの税率20%という条件や復興税を省いた公式図の内訳は示さない。20%を仮定した算術は一致するが、この図の実例・出典としてのokは採用しない。
- `docs/furusato/index.html` / `s-b8cc007c417a0deeebda-1`：ok → out_of_corpus。corpus/soumu_furusato_about.txt:34は3万円寄附・2万8千円控除という合計のみ。corpus/soumu_furusato_deduction.txt:34-58は税率と特例分の算式を示すが、年収700万円・夫婦子なしの税率20%という条件や復興税を省いた公式図の内訳は示さない。20%を仮定した算術は一致するが、この図の実例・出典としてのokは採用しない。
- `docs/furusato/index.html` / `s-5d0bfba5ac9f9b0af9dd-1`：ok → unresolved。corpus/soumu_furusato_deduction.txt:38,50,53-58、corpus/egov_chihozei_314_7.txt:125,131。式は特例分20%限度を逆算した目安としては導けるが、実際の所得税率と特例分用税率が異なる場合や他の限度がある。「自己負担2,000円の正確な上限」と無条件に同一視せず、概算式・成立条件を当該要約にも明記する。
- `docs/furusato/index.html` / `s-ecd4bf9ad5e70d37ee20-1`：ok → unresolved。corpus/nta_1155.txt:28-37、corpus/soumu_furusato_deduction.txt:59-70。要約の等式は全額控除の上限内等の条件付き。上限超過なら等号は成立しない。前後に天井の説明があっても、この要約にも「上限内では」を明示し、本文の同種指摘と整合させる。
- `docs/furusato/index.html` / `s-657c4baa81472b144d81-1`：ok → out_of_corpus。corpus/egov_chihozei_fusoku_7.txt:22,55で変更届の期限自体は確認できる。ただし固定単位は総務省トピックスの特定資料を出典として挙げており、当該資料本文は収録されていない。法令本文による制度確認とその資料の引用確認を区別する。

## 完全性確認

694/694のpage・IDを重複なく収録。判定値は指定された4種のみ。protectedのnonclaimなし。既存high 10/10をunresolvedで維持。入力JSONのtext_hashはsegments.jsonと全件一致。出力作成前後で、segments.json、corpus_desc.md、corpus内ファイル、out/s*.json、対象3ページのSHA-256が一致することを検査した。siteおよび元の執筆作業場への書込み・修正は行っていない。

DONE
