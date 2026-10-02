---
type: concept
title: auto20261002 t5-q08464 修正記録（2026-10-02）
ingested_at: '2026-10-02T02:16:21.137Z'
source_kind: put_page
ingested_via: put_page
---

# auto20261002 t5-q08464 修正記録（2026-10-02）

作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261002-t5-q08464`。基点: `34be072a`（作成時の origin/main）。pushなし。他モデル・サブエージェント・orca・スキル不使用。RUNの入力・corpusは変更していない。

## 結果と数え方

審査の未解決81単位を8論点にまとめ、同じ論点の出現を本文・要約・FAQ・JSON-LD・meta/OG・SVG・embed・別コラム・データ注記まで確認した。high 33 / medium 47 / low 1を修正・解消。mediumのうち1件は、ひとり親の父1万円・母5万円が施行令と一致したため、数値を維持して根拠を明示した。審査high 33件のうち、gateが通過条件に数えるSOL和集合由来は26件、審査独自は7件。

修正担当による論点照合では81件すべて対応済み。これは別モデル再照合の合格宣言ではない。変更後の独立再照合はreview_run.shに引き継ぐ。

正本外73単位は全件、元の単位ID・文面を保持した（wrong判定0）。書換え・削除・okへの昇格なし。まとめの複合文を分けた結果、既存の「申請期限は翌年1月10日。」が独立した1単位となり、当初申請期限の一次資料をneeded_sourceに指定して正本外へ留保した。したがって変更後の未確認は74単位。

### 単位と被覆

|集計|変更前|変更後|
|---|---:|---:|
|対象2ページの単位総数|441|479|
|入力審査でokだった単位|170|165が同文のまま残り、verifiedに登録|
|今回の台帳で主張に対応済み（covers）|166|289|
|今回の台帳の独立照合記録（verified）|166（旧台帳の過去記録）|165（今回入力審査の同文okのみ）|
|非主張|審査117 / 旧台帳119|116|
|正本外|審査73|74（既存73＋分割1）|
|check_claims --segmentsの未処理|156|74（全件needed_source付き正本外）|
|未対応の修正論点|81単位|0（修正担当照合、独立再照合待ち）|

台帳のcoversは正確性の保証ではない。変更後の289 = 同文ok 165＋修正文・追加説明124。修正文にはverifiedを付けていない。元のok 5単位は同論点の条件補足で変更したため再照合待ち。元のnonclaim 1単位（夫婦列の見出し）は年齢条件を加え主張へ変更した。

|ページ|総数 前→後|covers 前→後|verified 前→後|nonclaims 前→後|未処理 前→後|
|---|---:|---:|---:|---:|---:|
|`docs/furusato/index.html`|372→399|150→256|150→156|82→79|140→64|
|`docs/embed/furusato/index.html`|69→80|16→33|16→9|37→37|16→10|

### 正本に照らした誤り率

- 入力SOL和集合（wrong優先、次にunclear、ok）：wrong 62 / (ok 189＋wrong 62) = **24.70%**。正本外・非主張・unclearは分母から除外。
- 6.1単独（入力coverage.jsonと同じ）：59 / (185＋59) = **24.18%**。5.6単独：20 / (198＋20) = **9.17%**。
- 審査はwrongという分類を出さずunresolvedを81としたため、81 / (170＋81) = 32.27%は「要修正率」であり、確定wrongの誤り率とは区別する。父母の差のような根拠未収録による保留も含む。
- **変更後の独立誤り率は未測定**。自己点検の残論点0を独立の誤り率0%に置き換えない。

## 論点・単位ID・全修正箇所・正本

以下のcorpus/はRUNの固定正本。追加取得した施行令・令和9年施行版は作業場のreports/auto20261002-t5-q08464/corpus/。e-Gov API原文をcurlで直接取得し、JSON.gzと抜粋本文を保存した。WebFetch・検索要約は使用していない。

### 1. 指定対象寄附・各人課税と自己負担2,000円の条件（6単位）

内訳: high 2 / medium 4 / low 0。

該当単位:

- `docs/embed/furusato/index.html`: `s-d5f412f56fbc3765c1a4-1`, `s-20dc4e52fc917a291da5-1`
- `docs/furusato/index.html`: `s-0a3cabf77f73d58e1584-1`, `s-c2ac704e31073fee19df-1`, `s-3ebb6b4beb999c4abe8e-1`, `s-f90962e886ba32ed777c-1`

修正・根拠確認の内容: 2026年寄附。寄附時に指定された自治体への特例控除対象寄附。各人の寄附・所得・控除についての説明。

- 設備の専属利用等の特別の利益が及ぶ寄附を除く。指定は寄附支出時で判定。指定基準の記載は一部の例示で、募集適正・過去の基準適合・報告適正等もある。
- 所得税対象寄附は総所得金額等40％、住民税基本分対象寄附は同30％、特例分は調整控除後所得割20％。所得税と特例分用税率の相違・所得割の額自体による限度を別途確認。
- 寄附年合計2,000円超が控除対象。夫婦は別々に判定。住宅ローン控除等との併用により全額控除できない場合がある。

修正箇所（本文・JSON-LD等の同文出現を含む）:

- `claims/column/furusato-nozei-kakutei-shinkoku.json#auto-t5-eligibility`
- `claims/column/furusato-nozei-keisan.json#auto-t5-eligibility`
- `claims/embed/furusato.json#auto-t5-eligibility`
- `claims/furusato.json#auto-t5-eligibility`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:184`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:186`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:361`
- `docs/column/furusato-nozei-keisan/index.html:102`
- `docs/column/furusato-nozei-keisan/index.html:110`
- `docs/column/furusato-nozei-keisan/index.html:187`
- `docs/column/furusato-nozei-keisan/index.html:194`
- `docs/column/furusato-nozei-keisan/index.html:197`
- `docs/column/furusato-nozei-keisan/index.html:199`
- `docs/column/furusato-nozei-keisan/index.html:203`
- `docs/column/furusato-nozei-keisan/index.html:204`
- `docs/column/furusato-nozei-keisan/index.html:251`
- `docs/column/furusato-nozei-keisan/index.html:257`
- `docs/column/furusato-nozei-keisan/index.html:258`
- `docs/column/furusato-nozei-keisan/index.html:261`
- `docs/column/furusato-nozei-keisan/index.html:267`
- `docs/column/furusato-nozei-keisan/index.html:269`
- `docs/column/furusato-nozei-keisan/index.html:285`
- `docs/column/furusato-nozei-keisan/index.html:312`
- `docs/column/furusato-nozei-keisan/index.html:319`
- `docs/column/furusato-nozei-keisan/index.html:320`
- `docs/column/furusato-nozei-keisan/index.html:332`
- `docs/column/furusato-nozei-keisan/index.html:333`
- `docs/column/furusato-nozei-keisan/index.html:336`
- `docs/column/furusato-nozei-keisan/index.html:344`
- `docs/column/furusato-nozei-keisan/index.html:345`
- `docs/column/furusato-nozei-keisan/index.html:346`
- `docs/column/furusato-nozei-keisan/index.html:347`
- `docs/column/furusato-nozei-keisan/index.html:355`
- `docs/column/furusato-nozei-keisan/index.html:357`
- `docs/column/furusato-nozei-keisan/index.html:361`
- `docs/column/furusato-nozei-keisan/index.html:363`
- `docs/column/furusato-nozei-keisan/index.html:78`
- `docs/column/furusato-nozei-keisan/index.html:86`
- `docs/embed/furusato/index.html:57`
- `docs/furusato/index.html:336`
- `docs/furusato/index.html:341`
- `docs/furusato/index.html:473`
- `docs/furusato/index.html:494`
- `docs/furusato/index.html:500`
- `docs/furusato/index.html:74`
- `docs/furusato/index.html:98`

根拠（同条・同表の例外まで読んだ範囲）: `corpus/nta_1155.txt:25-37` / `corpus/soumu_furusato_deduction.txt:32-70` / `corpus/egov_chihozei_37_2.txt:9-69` / `corpus/egov_chihozei_37_2.txt:113-125`

### 2. 40％・30％の分母と20％限度に用いる所得割額（12単位）

内訳: high 12 / medium 0 / low 0。

該当単位:

- `docs/embed/furusato/index.html`: `s-494d1d769136027dc51d-1`
- `docs/furusato/index.html`: `s-6a5d8d0868d6e32b91d3-1`, `s-e798e05205fad6a3842f-1`, `s-44deba628ce659e9b004-1`, `s-c6697b037697064813bd-1`, `s-9090686505fc68aa5f19-1`, `s-d71687f3013b1d7bbe9c-1`, `s-2f39d8d795a89ba6ba46-1`, `s-2222d7819747ce8a7fd5-1`, `s-18bd183fe010497e5ecf-1`, `s-72e0503427310c6a8b26-1`, `s-82e14774c481bd86eb9d-1`

修正・根拠確認の内容: 2026年の指定対象寄附。都道府県・市町村を合計した標準税率による限度の説明。

- 40％・30％は総所得金額等に対する対象寄附額の限度。20％は調整控除後・その他の税額控除前の所得割額に対する特例控除額の限度。
- 指定都市は道府県・市町村の配分が異なる。住民税控除額は所得割額自体を超えない。各寄附金の対象・他控除との併用・所得税と特例分の税率相違により、逆算値でも全額控除にならない場合がある。

修正箇所（本文・JSON-LD等の同文出現を含む）:

- `claims/column/furusato-nozei-kakutei-shinkoku.json#auto-t5-denominators`
- `claims/column/furusato-nozei-keisan.json#auto-t5-denominators`
- `claims/embed/furusato.json#auto-t5-denominators`
- `claims/furusato.json#auto-t5-denominators`
- `docs/assets/qa_index.json: furusato answer/summary/terms`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:184`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:186`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:361`
- `docs/column/furusato-nozei-keisan/index.html:170`
- `docs/column/furusato-nozei-keisan/index.html:188`
- `docs/column/furusato-nozei-keisan/index.html:190`
- `docs/column/furusato-nozei-keisan/index.html:192`
- `docs/column/furusato-nozei-keisan/index.html:193`
- `docs/column/furusato-nozei-keisan/index.html:197`
- `docs/column/furusato-nozei-keisan/index.html:210`
- `docs/column/furusato-nozei-keisan/index.html:265`
- `docs/column/furusato-nozei-keisan/index.html:267`
- `docs/column/furusato-nozei-keisan/index.html:269`
- `docs/column/furusato-nozei-keisan/index.html:291`
- `docs/column/furusato-nozei-keisan/index.html:296`
- `docs/column/furusato-nozei-keisan/index.html:302`
- `docs/column/furusato-nozei-keisan/index.html:305`
- `docs/column/furusato-nozei-keisan/index.html:344`
- `docs/column/furusato-nozei-keisan/index.html:346`
- `docs/column/furusato-nozei-keisan/index.html:355`
- `docs/column/furusato-nozei-keisan/index.html:408`
- `docs/column/furusato-nozei-keisan/index.html:78`
- `docs/embed/furusato/index.html:57`
- `docs/furusato/index.html:154`
- `docs/furusato/index.html:299`
- `docs/furusato/index.html:306`
- `docs/furusato/index.html:325`
- `docs/furusato/index.html:330`
- `docs/furusato/index.html:347`
- `docs/furusato/index.html:402`
- `docs/furusato/index.html:404`
- `docs/furusato/index.html:406`
- `docs/furusato/index.html:433`
- `docs/furusato/index.html:434`
- `docs/furusato/index.html:439`
- `docs/furusato/index.html:442`
- `docs/furusato/index.html:444`
- `docs/furusato/index.html:483`
- `docs/furusato/index.html:492`
- `docs/furusato/index.html:541`
- `docs/furusato/index.html:66`

根拠（同条・同表の例外まで読んだ範囲）: `corpus/nta_1155.txt:28-37` / `corpus/soumu_furusato_deduction.txt:32-70` / `corpus/egov_chihozei_37_2.txt:9-16` / `corpus/egov_chihozei_37_2.txt:125-237`

### 3. 配偶者・扶養の所得資格、判定日、非居住者・年齢・同居区分（40単位）

内訳: high 8 / medium 32 / low 0。

該当単位:

- `docs/embed/furusato/index.html`: `s-d281b26436ce82d1e585-1`, `s-fcaf130df8826eded0db-1`, `s-4d2dcc35d66043f2b09b-1`, `s-95354f4dbb428999e90e-1`, `s-f5001353a1bdadce5bc8-1`, `s-1ee69778febcba578f6d-1`, `s-0bc436b81a5a7dba5474-1`, `s-febbc6271ce2ef367aac-1`
- `docs/furusato/index.html`: `s-d281b26436ce82d1e585-1`, `s-fcaf130df8826eded0db-1`, `s-b13e3ef5f8af31598a96-1`, `s-95354f4dbb428999e90e-1`, `s-0bc436b81a5a7dba5474-1`, `s-f5001353a1bdadce5bc8-1`, `s-43cba46de5db2e360f41-1`, `s-febbc6271ce2ef367aac-1`, `s-dfef345f6369bc3323e1-1`, `s-9e9ea521c26c242df51f-1`, `s-e28a14c57538c2edf621-1`, `s-08ea37fa0398ee3b2f40-1`, `s-f99a20027ba954c55811-1`, `s-3818f93541ded68c8d4e-1`, `s-a7bad26af795e490e91c-1`, `s-288635f0bf3fc906a16a-1`, `s-50b9a5f2651d591a7f20-1`, `s-28bea453cfaf2400b143-1`, `s-e1a0871bc5bf77a7a96e-1`, `s-10fc248b775503de30ed-1`, `s-ad319a3d03297ab2c99d-1`, `s-d226a3d61082a24b95d7-1`, `s-9f4ad0cbcb1c3b7be948-1`, `s-5bc39a90e2bd1057f766-1`, `s-2821979ba40cc3f97ddc-1`, `s-42e7e8113d68a5e783d2-1`, `s-e8e37fb48561dbaae2cf-1`, `s-7f70efb06ee80662afc0-1`, `s-faeedab2339e1cffc634-1`, `s-50709e17e6c91bb0db22-1`, `s-87c98cb94799f2958c7e-1`, `s-c7c06bc457a6024d5293-1`

修正・根拠確認の内容: 2026年寄附に対応する令和9年度住民税。入力欄と年収別早見表の家族資格・年齢区分を確認。早見表の個別金額は独立認証しない。

- 扶養親族は生計を一にする親族（配偶者除外）・里子・養護受託老人、合計所得62万円以下。給与を受ける青色事業専従者・白色事業専従者を除外、他の納税者との重複不可。
- 配偶者控除は同一生計・配偶者所得62万円以下・本人所得1,000万円以下。本人900万円以下/900万円超950万円以下/950万円超1,000万円以下で一般33/22/11万円、老人38/26/13万円。
- 年齢・該当性は寄附年12月31日、年内死亡は死亡時。死亡後再婚の範囲特例は本文で主な例外として案内。
- 控除対象扶養は16歳以上、特定19〜22歳、老人70歳以上。同居老親等は本人又は配偶者の直系尊属で本人又は配偶者と同居を常況。70歳以上の同居兄姉は同居老親等以外。
- 非居住者は16〜29歳・70歳以上、30〜69歳は留学で国内住所居所喪失/障害者/納税者からその年中の生活費教育費38万円以上の支払のいずれか。
- 16歳未満は扶養控除対象外だが扶養資格を満たせば非課税人数に含める。表は70歳未満の控除対象配偶者、16〜18歳・19〜22歳の控除対象扶養親族を前提。
- 19〜22歳で通常の扶養所得要件を超える親族は特定親族特別控除という別制度。特定扶養の人数欄には含めない。配偶者特別控除も配偶者控除の選択肢の対象外。

修正箇所（本文・JSON-LD等の同文出現を含む）:

- `claims/column/furusato-nozei-keisan.json#auto-t5-family`
- `claims/embed/furusato.json#auto-t5-family`
- `claims/furusato.json#auto-t5-family`
- `docs/column/furusato-nozei-keisan/index.html:102`
- `docs/column/furusato-nozei-keisan/index.html:110`
- `docs/column/furusato-nozei-keisan/index.html:165`
- `docs/column/furusato-nozei-keisan/index.html:178`
- `docs/column/furusato-nozei-keisan/index.html:192`
- `docs/column/furusato-nozei-keisan/index.html:193`
- `docs/column/furusato-nozei-keisan/index.html:197`
- `docs/column/furusato-nozei-keisan/index.html:200`
- `docs/column/furusato-nozei-keisan/index.html:203`
- `docs/column/furusato-nozei-keisan/index.html:204`
- `docs/column/furusato-nozei-keisan/index.html:206`
- `docs/column/furusato-nozei-keisan/index.html:207`
- `docs/column/furusato-nozei-keisan/index.html:208`
- `docs/column/furusato-nozei-keisan/index.html:210`
- `docs/column/furusato-nozei-keisan/index.html:214`
- `docs/column/furusato-nozei-keisan/index.html:244`
- `docs/column/furusato-nozei-keisan/index.html:248`
- `docs/column/furusato-nozei-keisan/index.html:251`
- `docs/column/furusato-nozei-keisan/index.html:254`
- `docs/column/furusato-nozei-keisan/index.html:261`
- `docs/column/furusato-nozei-keisan/index.html:263`
- `docs/column/furusato-nozei-keisan/index.html:264`
- `docs/column/furusato-nozei-keisan/index.html:265`
- `docs/column/furusato-nozei-keisan/index.html:267`
- `docs/column/furusato-nozei-keisan/index.html:269`
- `docs/column/furusato-nozei-keisan/index.html:275`
- `docs/column/furusato-nozei-keisan/index.html:276`
- `docs/column/furusato-nozei-keisan/index.html:277`
- `docs/column/furusato-nozei-keisan/index.html:278`
- `docs/column/furusato-nozei-keisan/index.html:279`
- `docs/column/furusato-nozei-keisan/index.html:280`
- `docs/column/furusato-nozei-keisan/index.html:281`
- `docs/column/furusato-nozei-keisan/index.html:282`
- `docs/column/furusato-nozei-keisan/index.html:285`
- `docs/column/furusato-nozei-keisan/index.html:287`
- `docs/column/furusato-nozei-keisan/index.html:288`
- `docs/column/furusato-nozei-keisan/index.html:296`
- `docs/column/furusato-nozei-keisan/index.html:297`
- `docs/column/furusato-nozei-keisan/index.html:301`
- `docs/column/furusato-nozei-keisan/index.html:302`
- `docs/column/furusato-nozei-keisan/index.html:305`
- `docs/column/furusato-nozei-keisan/index.html:308`
- `docs/column/furusato-nozei-keisan/index.html:312`
- `docs/column/furusato-nozei-keisan/index.html:316`
- `docs/column/furusato-nozei-keisan/index.html:333`
- `docs/column/furusato-nozei-keisan/index.html:336`
- `docs/column/furusato-nozei-keisan/index.html:339`
- `docs/column/furusato-nozei-keisan/index.html:344`
- `docs/column/furusato-nozei-keisan/index.html:345`
- `docs/column/furusato-nozei-keisan/index.html:355`
- `docs/column/furusato-nozei-keisan/index.html:357`
- `docs/column/furusato-nozei-keisan/index.html:361`
- `docs/column/furusato-nozei-keisan/index.html:363`
- `docs/column/furusato-nozei-keisan/index.html:406`
- `docs/column/furusato-nozei-keisan/index.html:408`
- `docs/column/furusato-nozei-keisan/index.html:409`
- `docs/column/furusato-nozei-keisan/index.html:78`
- `docs/column/furusato-nozei-keisan/index.html:86`
- `docs/embed/furusato/index.html:103`
- `docs/embed/furusato/index.html:107`
- `docs/embed/furusato/index.html:113`
- `docs/embed/furusato/index.html:118`
- `docs/embed/furusato/index.html:79`
- `docs/embed/furusato/index.html:80`
- `docs/embed/furusato/index.html:86`
- `docs/embed/furusato/index.html:87`
- `docs/embed/furusato/index.html:92`
- `docs/embed/furusato/index.html:99`
- `docs/furusato/index.html:114`
- `docs/furusato/index.html:179`
- `docs/furusato/index.html:180`
- `docs/furusato/index.html:186`
- `docs/furusato/index.html:187`
- `docs/furusato/index.html:192`
- `docs/furusato/index.html:199`
- `docs/furusato/index.html:203`
- `docs/furusato/index.html:210`
- `docs/furusato/index.html:215`
- `docs/furusato/index.html:230`
- `docs/furusato/index.html:270`
- `docs/furusato/index.html:287`
- `docs/furusato/index.html:301`
- `docs/furusato/index.html:306`
- `docs/furusato/index.html:309`
- `docs/furusato/index.html:329`
- `docs/furusato/index.html:330`
- `docs/furusato/index.html:334`
- `docs/furusato/index.html:337`
- `docs/furusato/index.html:340`
- `docs/furusato/index.html:341`
- `docs/furusato/index.html:343`
- `docs/furusato/index.html:344`
- `docs/furusato/index.html:345`
- `docs/furusato/index.html:347`
- `docs/furusato/index.html:351`
- `docs/furusato/index.html:381`
- `docs/furusato/index.html:385`
- `docs/furusato/index.html:388`
- `docs/furusato/index.html:391`
- `docs/furusato/index.html:398`
- `docs/furusato/index.html:40`
- `docs/furusato/index.html:400`
- `docs/furusato/index.html:401`
- `docs/furusato/index.html:402`
- `docs/furusato/index.html:404`
- `docs/furusato/index.html:406`
- `docs/furusato/index.html:412`
- `docs/furusato/index.html:413`
- `docs/furusato/index.html:414`
- `docs/furusato/index.html:415`
- `docs/furusato/index.html:416`
- `docs/furusato/index.html:417`
- `docs/furusato/index.html:418`
- `docs/furusato/index.html:419`
- `docs/furusato/index.html:422`
- `docs/furusato/index.html:424`
- `docs/furusato/index.html:425`
- `docs/furusato/index.html:433`
- `docs/furusato/index.html:434`
- `docs/furusato/index.html:438`
- `docs/furusato/index.html:439`
- `docs/furusato/index.html:442`
- `docs/furusato/index.html:445`
- `docs/furusato/index.html:449`
- `docs/furusato/index.html:453`
- `docs/furusato/index.html:470`
- `docs/furusato/index.html:473`
- `docs/furusato/index.html:476`
- `docs/furusato/index.html:481`
- `docs/furusato/index.html:482`
- `docs/furusato/index.html:492`
- `docs/furusato/index.html:494`
- `docs/furusato/index.html:498`
- `docs/furusato/index.html:500`
- `docs/furusato/index.html:504`
- `docs/furusato/index.html:539`
- `docs/furusato/index.html:541`
- `docs/furusato/index.html:542`
- `docs/furusato/index.html:553`
- `docs/furusato/index.html:631`
- `docs/furusato/index.html:636`
- `docs/furusato/index.html:641`
- `docs/furusato/index.html:66`
- `docs/furusato/index.html:666`
- `docs/furusato/index.html:669`
- `docs/furusato/index.html:678`
- `docs/furusato/index.html:680`
- `docs/furusato/index.html:683`
- `docs/furusato/index.html:707`
- `docs/furusato/index.html:712`
- `docs/furusato/index.html:718`
- `docs/furusato/index.html:728`
- `docs/furusato/index.html:735`
- `docs/furusato/index.html:74`
- `docs/furusato/index.html:804`
- `docs/furusato/index.html:90`
- `docs/furusato/index.html:98`
- `tests/test_year_staleness.mjs:33 — 寄附年と翌年度住民税の対応を全文一致・根拠付きで登録`

根拠（同条・同表の例外まで読んだ範囲）: `corpus/egov_chihozei_34.txt:551-586` / `corpus/egov_chihozei_34.txt:672-714` / `corpus/egov_chihozei_34.txt:817-835` / `corpus/egov_chihozei_34.txt:1010-1024` / `corpus/tokyo_kojin_ju.txt:488-529` / `reports/auto20261002-t5-q08464/corpus/chihozei-2027.txt:3-7` / `corpus/egov_chihozei_34.txt:595-663,720-769`

### 4. ひとり親の調整控除差は母5万円・父1万円（1単位）

内訳: high 0 / medium 1 / low 0。

該当単位:

- `docs/embed/furusato/index.html`: `s-19757c5810339f306b59-1`

修正・根拠確認の内容: ひとり親に該当する納税者の住民税調整控除に用いる法定の差額。ひとり親控除の所得税・住民税の実額差そのものではない。

- 父は1万円、母は5万円と政令が法の表の区分を指定。適用はひとり親該当者に限り、性別だけでひとり親控除を認めるものではない。
- 所得税のひとり親控除と住民税の調整控除を区別する。数値・coreの実装変更は不要。
- 施行令7条の16の2・48条の7の2を追加取得。父母の法定区分が明記されており、SOLの「父1万円は誤り」という疑義は採らない。embedの説明と参照データ注記に法令名を追加。

修正箇所（本文・JSON-LD等の同文出現を含む）:

- `claims/embed/furusato.json#auto-t5-single-parent`
- `docs/assets/juminzei_r08.json: jinteki_kojo_sa._note`
- `docs/embed/furusato/index.html:129`

根拠（同条・同表の例外まで読んだ範囲）: `corpus/egov_chihozei_314_6.txt:47-58` / `reports/auto20261002-t5-q08464/corpus/chihozei-order.txt:3-4`

### 5. 障害者135万円非課税の寄附年・住民税年度（2単位）

内訳: high 2 / medium 0 / low 0。

該当単位:

- `docs/embed/furusato/index.html`: `s-a4de7e8520ba29f7f30b-1`
- `docs/furusato/index.html`: `s-ef5d8a0ea83e778d4c40-1`

修正・根拠確認の内容: 寄附年の所得で判定する翌年度住民税。本人障害者の非課税案内。

- 135万円以下は寄附年（住民税の前年）の合計所得。本人ではない障害者扶養控除とは別。所得税が課税される場合には所得税の寄附金控除が残り得る。
- 同じ非課税節では未成年者・寡婦・ひとり親、生活扶助受給、条例非課税、所得割非課税の別類型もある。本文は本人障害者の入力についての案内に限定。

修正箇所（本文・JSON-LD等の同文出現を含む）:

- `claims/embed/furusato.json#auto-t5-exempt-year`
- `claims/furusato.json#auto-t5-exempt-year`
- `docs/embed/furusato/index.html:135`
- `docs/furusato/index.html:258`

根拠（同条・同表の例外まで読んだ範囲）: `corpus/tokyo_kojin_ju.txt:488-520` / `corpus/nta_1155.txt:28-37` / `corpus/soumu_furusato_deduction.txt:75-79`

### 6. 特例分用税率・復興税・0％・山林退職の別区分（12単位）

内訳: high 7 / medium 5 / low 0。

該当単位:

- `docs/furusato/index.html`: `s-4ed051782cff14f14e89-1`, `s-526344bcbd9dfa77d836-1`, `s-351b3b32b0cdf939da97-1`, `s-6cafae3dc958257b8891-1`, `s-2d8031ff133f1958e118-1`, `s-59ad17d09907547f5fa7-1`, `s-6e218ca051a6d887fc35-1`, `s-43e4785ab3e39596dfcf-1`, `s-ee63e52fb37b26b1aee8-1`, `s-4a0d8424ae716b055933-1`, `s-edb5b9beb462e07c0e12-1`, `s-0b8c08da48f717b87e3f-1`

修正・根拠確認の内容: 2026年寄附の概算式と住民税特例割合。通常区分と別区分を区別。既存の将来改正・特定年収の実額に対する新たな認証はしない。

- 所得税の税率と特例分用税率は異なる場合がある。特例分は課税総所得金額から人的控除差調整額を引いた金額による通常区分。7段階の列挙は37条の2第11項第1号の表に限定。
- 差引後が負で課税山林・課税退職所得がない第2号は90％。課税総所得なし/差引後負で課税山林又は課税退職ありの第3号は別計算。山林は5分の1、退職は全額を表に当てはめ、両方なら低い割合。
- 2026年寄附は所得税率×1.021。0％は0のままで固定税率を加えない。正の特例分用税率で同じ天井なら×1.021省略で逆算額が小さく、0％なら変わらない。
- 各限度、指定対象寄附、基本分の総所得金額等30％・所得税40％・調整控除後所得割20％を別途満たす。

修正箇所（本文・JSON-LD等の同文出現を含む）:

- `claims/column/furusato-nozei-kakutei-shinkoku.json#auto-t5-rates`
- `claims/column/furusato-nozei-keisan.json#auto-t5-rates`
- `claims/furusato.json#auto-t5-rates`
- `docs/assets/juminzei_r08.json: furusato.tokurei_ritsu._note`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:184`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:186`
- `docs/column/furusato-nozei-kakutei-shinkoku/index.html:361`
- `docs/column/furusato-nozei-keisan/index.html:206`
- `docs/column/furusato-nozei-keisan/index.html:208`
- `docs/column/furusato-nozei-keisan/index.html:253`
- `docs/column/furusato-nozei-keisan/index.html:266`
- `docs/column/furusato-nozei-keisan/index.html:269`
- `docs/column/furusato-nozei-keisan/index.html:333`
- `docs/column/furusato-nozei-keisan/index.html:347`
- `docs/column/furusato-nozei-keisan/index.html:406`
- `docs/column/furusato-nozei-keisan/index.html:411`
- `docs/furusato/index.html:114`
- `docs/furusato/index.html:305`
- `docs/furusato/index.html:306`
- `docs/furusato/index.html:309`
- `docs/furusato/index.html:343`
- `docs/furusato/index.html:345`
- `docs/furusato/index.html:390`
- `docs/furusato/index.html:470`
- `docs/furusato/index.html:484`
- `docs/furusato/index.html:504`
- `docs/furusato/index.html:539`
- `docs/furusato/index.html:544`

根拠（同条・同表の例外まで読んだ範囲）: `corpus/nta_1155.txt:25-37` / `corpus/soumu_furusato_deduction.txt:32-70` / `corpus/egov_chihozei_37_2.txt:125-237`

### 7. 所得割の概算は課税対象者・給与所得に限定し0円下限（2単位）

内訳: high 2 / medium 0 / low 0。

該当単位:

- `docs/furusato/index.html`: `s-d8edc54179a5f684ed14-1`, `s-9252b4abb595ea692ad0-1`

修正・根拠確認の内容: 給与所得のみの納税者に対する所得割の概算。住民税非課税者には算式で正の税額を示さない。

- 課税所得と税額は0円を下限とする。所得割非課税なら0円。生活扶助・障害者等135万円・条例非課税・所得割の総所得金額等基準の別類型を確認。
- 均等割の非課税限度は自治体差がある。所得割標準合計税率10％、調整控除以外の税額控除前の額を寄附特例限度に使う。分離課税・山林・退職所得はこの給与のみの概算式の対象外。

修正箇所（本文・JSON-LD等の同文出現を含む）:

- `claims/column/furusato-nozei-keisan.json#auto-t5-floor`
- `claims/furusato.json#auto-t5-floor`
- `docs/column/furusato-nozei-keisan/index.html:193`
- `docs/column/furusato-nozei-keisan/index.html:197`
- `docs/furusato/index.html:330`
- `docs/furusato/index.html:334`

根拠（同条・同表の例外まで読んだ範囲）: `corpus/soumu_kojin_juminzei.txt:100-124` / `corpus/tokyo_kojin_ju.txt:488-529`

### 8. ワンストップ対象者、申請と変更届、申告の提出先・別手続（6単位）

内訳: high 0 / medium 5 / low 1。

該当単位:

- `docs/furusato/index.html`: `s-6dda6ff3c41e53ba174a-1`, `s-2582f31dc1d4566a3152-1`, `s-078ad70c5bd1cdd67726-1`, `s-1fdec98f239e9b052b27-1`, `s-0a442207912a6d1ef254-1`, `s-657c4baa81472b144d81-1`

修正・根拠確認の内容: 特例控除対象寄附についての申告手続。変更届は申請日から翌年の賦課期日までの氏名・住所・生年月日変更。

- ワンストップは5団体以内、所得税確定申告義務なし、寄附金税額控除以外に住民税申告不要。確定申告・住民税申告をすると無効。6団体以上・通知先が賦課期日住所の市町村と異なる場合も法定の無効規定。
- 変更届は上記期間・3事項の変更につき翌年1月10日までに寄附先へ。賦課期日後の変更まで一般化しない。見出しを申請と変更届に分け、既存の当初申請期限は正本外として留保。
- 確定申告は住所地等の所轄税務署。所得税0円で住民税のみ控除を受ける場合は市区町村への住民税申告が必要な場合あり。申告書第二表の住民税欄も記載。更正の請求は所得税等の額が動かない場合には不可、市区町村へ相談。

修正箇所（本文・JSON-LD等の同文出現を含む）:

- `claims/column/furusato-nozei-keisan.json#auto-t5-procedures`
- `claims/furusato.json#auto-t5-procedures`
- `docs/column/furusato-nozei-keisan/index.html:102`
- `docs/column/furusato-nozei-keisan/index.html:181`
- `docs/column/furusato-nozei-keisan/index.html:311`
- `docs/column/furusato-nozei-keisan/index.html:312`
- `docs/column/furusato-nozei-keisan/index.html:316`
- `docs/column/furusato-nozei-keisan/index.html:318`
- `docs/column/furusato-nozei-keisan/index.html:325`
- `docs/column/furusato-nozei-keisan/index.html:328`
- `docs/column/furusato-nozei-keisan/index.html:348`
- `docs/column/furusato-nozei-keisan/index.html:361`
- `docs/column/furusato-nozei-keisan/index.html:410`
- `docs/furusato/index.html:448`
- `docs/furusato/index.html:453`
- `docs/furusato/index.html:455`
- `docs/furusato/index.html:465`
- `docs/furusato/index.html:485`
- `docs/furusato/index.html:543`

根拠（同条・同表の例外まで読んだ範囲）: `corpus/egov_chihozei_fusoku_7.txt:6-71` / `corpus/nta_1155.txt:38-57` / `corpus/soumu_furusato_deduction.txt:75-99`

## 追加根拠・全出現の確認

- 非居住者の全3区分、配偶者本人所得3区分、死亡・再婚、山林・退職の別計算、特例割合90％、変更届の対象期間と3事項を走査。例外を全部説明しない場所では「主な例外」又は適用範囲の限定を明記した。
- `docs/column/furusato-nozei-keisan/` は既存の `.nopublish` を維持。同じ説明が残るため横展開した。`docs/column/furusato-nozei-kakutei-shinkoku/` の控除内訳・総額説明・出典注も横展開した。
- `docs/assets/qa_index.json` は生成器でmetaの修正を同期。`docs/assets/juminzei_r08.json` は特例分用税率と父母差の**説明注記のみ**を修正。数値を正規化して基点と比較し、計算用の値が不変であることを検証。coreの計算誤り・改定済み値の残存を今回の対象論点として確定したものはないため、core・境界値ケース・stale_valuesに機能変更は加えていない。
- SVGの数値・aria-label・figcaptionは両税率20％・各限度内・復興特別所得税込みの設例として照合。旧コラムの図の注も本体と同期。単位の全文保存・照合結果は `self-audit.json`、変更箇所対応は `issue-locations.json`。
- 新しい62万円の扶養所得要件は、令和9年1月1日施行版の23条・292条と令和8年法律2号附則3条2項・11条2項の**令和9年度以後適用**を確認した。`corpus/chihozei-2027.txt:3-7`。追加の不変の出典注は `corpus/chihozei-2027-basis.txt:1-4`（施行日、人的控除差調整額、基礎控除43/29/15万円の全区分）を保存。

## コミット・生成器・テスト

HTMLを先にコミットし、その後に `test_generators_fresh` のCHECKABLE全5本（index_sitemap / datemodified / trust_footer / data_source_note / domain_bridge）を実行。FAQ JSON-LDは `node tools/gen_faq_jsonld.mjs`、QA索引は `gen_qa_index.mjs` で生成した。

実装コミット:

- 3d771650 ふるさと納税の単位被覆・根拠行・生成物と全テスト結果を記録
- 926c2195 扶養欄の対象から特定親族特別控除の別区分を明示
- aec57e41 ふるさと納税の確定申告解説にも特例税率と20％限度の条件を反映
- 5f26a74d ふるさと納税: 旧コラムの要約条件を同期し参照データ差分を限定
- d20b33c3 ふるさと納税: 控除限度・扶養資格・特例税率・申告条件を全出現で補足

全テスト: `PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js node tools/run_tests.mjs`。終了値 1。

```text
  「使ったデータの申告」なら、データの年に合わせて書き直す。


❌ 3ファイル失敗 / 実行 234
```

赤の前後: 依頼で示された基点は2件（test_hojokin_sources・test_layout_visual）。今回の全テスト実測は3件: test_layout_visual.mjs, test_stale_values.mjs, test_year_staleness.mjs。
test_layout_visualの失敗は画像差分の判定前に環境指紋が不一致になったもの。実行環境Playwright 1.58.2 / Chromium 145.0.7632.6に対し、保存基準は1.62.1 / 151.0.7922.34。基準の上書きはしていない。全523ページ×6画面サイズ＝3,138組の描画検査は問題0で通過（layout-render-summary.json）。
全件実行で出たtest_year_stalenessは、2026年寄附と令和9年度住民税の対応という制度の事実をデータ年分の不一致と誤検知していた。一次資料を理由として全文一致をHISTORICAL_FACTSに登録し、対象検査の再実行で緑（year-staleness-after.log）。年号全体やページ全体の免除はしていない。
全234件を実行、測定不能0。修正後の対象再検査を合わせると232件緑・2件赤。最終的に残る赤はtest_layout_visualとtest_stale_valuesの2件。後者は今回変更していないhotei-koyoritsu・nenshu-no-kabe・shakai-hoken-kanyu-joken・kabeの4ページで2026-10-01を過ぎた未来形。4ページと検出器・設定が基点34be072aとバイト単位で一致することを確認（stale-baseline-identity.json）。依頼の基点赤2件には含まれていなかったため、新たに観測した既存不具合として区別する。test_hojokin_sourcesは今回緑。
基点の全件再実行は入力配線テストの途中で中止し、前の赤2件は依頼の値として区別した。中断実行を全件測定・全件緑とは数えていない。変更後は全件を直列実行しており、今回の作業でChromiumを並列起動していない。

`check_claims --changed origin/main`、embedのページ全体チェック、対象2ページのsegmentsチェックを実施。segmentsの残りは74件すべて正本外であり、台帳のneeded_source付き未確認として残した。

生成器鮮度チェック・check_claimsは緑。全出現の走査で、条件のない所得割20％の残存は0件。新規台帳62件のscope・exceptionsと167か所のcorpus参照行の存在も確認した（source-refs.log）。

最終コミット: `3d7716508b8417311e63d78deb8fa4704a98402b`。作業場は未コミット変更なし。pushしていない。

gbrain登録先: `implementation/keiri-auto20261002-t5-q08464-2026-10-02`。既存ページはgetで不存在を確認。登録後のgetで本文を照合して引き継ぐ。

DONE
