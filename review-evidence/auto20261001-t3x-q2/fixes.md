# 独立審査結果

対象: RUN/site の固定snapshot。正本: RUN/corpus と corpus_desc.md。site・元の執筆作業場・既存outは変更していない。他モデル、サブエージェント、orca、スキル、pushは使用していない。

全479件（page＋id）を審査。内訳: ok 255、nonclaim 125、out_of_corpus 91、unresolved 8。未解決はすべてmedium、high 0、low 0。重要度は読者への影響から独立に付け直した。正本外は正しさの承認ではない。公開可・全件合格の判定はしない。

## 審査範囲と方法

segments.json全479件とout/s0000.json〜s0011.json全479判定を読み、ページ内文脈を含め照合した。以下の番号はsegments.jsonの1始まりの位置であり、各行のpage＋idと採否理由はsegment-adjudication.jsonに全件収録した。

- 1〜28: 埋め込み計算機の全ID。賞与累計・年齢・入力案内と制度主張を区別。
- 29〜108: 本体のタイトル、description、冒頭、入力、前提、結論・calloutを全件確認。summary/protectedをnonclaimに落としていない。
- 109〜224: 計算図、30万円の35歳/42歳設例、早見表6行の両年齢列、等級と境界を全件確認。
- 225〜267: 合算・端数処理の説明、134,000円の設例、現金支払と特約、全50等級の差分を確認。
- 268〜352: 47都道府県料率、順位・差・年換算・改定数、厚年上下限を全件確認。
- 353〜417: 支援金と拠出金、会社負担、退職月・天引き・同月得喪の全ID。収録正本で証明できない規定は追加資料を明示。
- 418〜479: 記事のまとめ（zone=bodyも含む）、全FAQ回答、出典注記を確認。要約も本文と同じ正本で再審査。

使用した主な正本箇所: 東京額表2〜87行（全50等級と脚注）、kyoukaikenpo_r08.txt 97〜294行（47県すべて）、koyou_ryoritsu_r8.txt（年度・業種別料率）、hoshu_hyo_2026.txtの現物給与Q10、定時決定ページ155〜188行、短時間労働者資料221行、被保険者資料300〜319行、介護保険法9〜11条。

OCRは位置検索にのみ使用。直接開いて目視した画像: santei_guidebook_r8 PDF 5・6・7・14・27・28・30・31・35・43ページ、nenkin_seidoannai PDF 1・2ページ。PDF番号と冊子内印刷番号は異なるため、JSONは画像ファイル名で特定した。

再計算: 早見表12金額は28,380/30,000、36,894/39,000、42,570/45,000、58,178/61,499、70,950/75,000、95,258/101,009円で一致。合算と別端数処理の差は第10・11級のみ。47県の改定は40県引下げ・7県据置、最大下げ幅は長崎0.35ポイント。

## 既存wrong/unclearの独立裁定

- 賞与累計のwrongは未解決medium。同一保険者の範囲を示す必要がある。同文の埋め込み版の既存okも同じ未解決とした。
- 「別々だと1円ずれる」のwrongは未解決medium。多数の等級は一致するため断定を修正する。
- FAQの「最後に1回だけ」のwrongは未解決medium。特約なしの限定が必要。本文の同旨の既存okおよびFAQの50銭確認文も同じ基準で未解決とした。
- 随時改定のunclear（high-originの候補）は正本PDF27ページの要件図とPDF28ページの逆方向除外を目視できたためok。17日/11日、3か月、2等級、4か月目を確認した。旧highはOCR欠損を理由としており、未解決highを根拠なくokへ変更したものではない。
- 健康保険組合の料率注意はPDF14ページで確認しout_of_corpusからokへ。「1円ずれることがある」は額表の独立計算で証明できるためokへ。

## 未解決・必要な修正

- [medium] docs/embed/shakai-hoken/index.html / s-c9f4a4144cf2caa3c615-1（位置24）
  corpus/pages/santei_guidebook_r8-30.png（PDF30ページ、冊子27ページ）の標準賞与額・健康保険年度累計573万円と同一保険者の注記、および東京額表82〜84行を確認。年度・千円切捨て・573万円自体は一致するが、入力案内が年度内の全支給を無条件に合計させ、転職等で保険者が異なる既払分まで算入するおそれがある。少数の保険者変更者で上限到達判定と保険料が変わるためmedium。現在の保険者で通算する対象範囲を明記して新snapshotで再審査。
- [medium] docs/shakai-hoken/index.html / s-c9f4a4144cf2caa3c615-1（位置58）
  corpus/pages/santei_guidebook_r8-30.png（PDF30ページ、冊子27ページ）の標準賞与額・健康保険年度累計573万円と同一保険者の注記、および東京額表82〜84行を確認。年度・千円切捨て・573万円自体は一致するが、入力案内が年度内の全支給を無条件に合計させ、転職等で保険者が異なる既払分まで算入するおそれがある。少数の保険者変更者で上限到達判定と保険料が変わるためmedium。現在の保険者で通算する対象範囲を明記して新snapshotで再審査。
- [medium] docs/shakai-hoken/index.html / s-6bee9540a6818ed08dc0-1（位置226）
  corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:27-28,75-78から1円差は再現できるが、「ほとんどの解説サイトが書いていない」という他サイト一般の主張はcorpus_desc.mdの資料では裏付けられない。根拠のない普及度の断定はmedium。この修飾を削除するか調査根拠を追加する。 必要資料: 対象サイト一覧、調査時点、調査方法および当該説明の掲載有無を確認した資料。
- [medium] docs/shakai-hoken/index.html / s-a456da94f1f72024cc10-1（位置227）
  corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:14-16,75-78。合算列11.47%は正しい。しかし「してはいけません」「最後に1回だけ」「正しい方法」と無条件に断定し、特約に基づく端数処理を認める正本78行の例外を当該案内に示していない。特約を持つ少数の給与計算担当者が適正な処理を誤りと判断するためmedium。給与からの控除・端数処理の特約なしの場合という限定を本文とFAQ双方に明記する。
- [medium] docs/shakai-hoken/index.html / s-1a385312fcd3931a0337-1（位置228）
  corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:14-16,75-78。合算列11.47%は正しい。しかし「してはいけません」「最後に1回だけ」「正しい方法」と無条件に断定し、特約に基づく端数処理を認める正本78行の例外を当該案内に示していない。特約を持つ少数の給与計算担当者が適正な処理を誤りと判断するためmedium。給与からの控除・端数処理の特約なしの場合という限定を本文とFAQ双方に明記する。
- [medium] docs/shakai-hoken/index.html / s-7d81d015eaeb86a854ec-1（位置422）
  corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:18-68,75-78。合算の方向は正しいが「別々だと1円ずれる」は過剰断定。全50等級を再計算すると差が出るのは第10級134,000円と第11級142,000円のみ。本文の30万円例では別々でも17,205円で一致する。読者が一致する計算まで誤りと思う表現のためmedium。「別々に端数処理すると、一部の等級で1円ずれることがある」に修正。
- [medium] docs/shakai-hoken/index.html / s-04ca9f9d345b53055e82-1（位置455）
  corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:14-16,75-78。合算列11.47%は正しい。しかし「してはいけません」「最後に1回だけ」「正しい方法」と無条件に断定し、特約に基づく端数処理を認める正本78行の例外を当該案内に示していない。特約を持つ少数の給与計算担当者が適正な処理を誤りと判断するためmedium。給与からの控除・端数処理の特約なしの場合という限定を本文とFAQ双方に明記する。
- [medium] docs/shakai-hoken/index.html / s-d677b61dde7f8969befa-1（位置457）
  corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:76-78。50銭以下切捨ては給与から控除し特約がない場合の規則。FAQが無条件で50銭切上げを誤り扱いするため、特約のある場合の正しい設定を変えさせる。特定の少数に関する条件欠落でmedium。FAQ内に特約の確認を追加する。

## 正本外で必要な資料

全該当IDと必要資料はJSONのneeded_sourceに記載。主な不足は、ツール仕様・検証結果、雇用保険の賃金算定根拠、通勤手当の所得税非課税限度額、全国平均9.90%の公式資料、料率の決定・歴史、給与明細表示、健康保険法167条・厚年法84条と退職月/同月得喪の公式説明、介護保険の年齢到達・徴収月、退職後の保険料負担。収録済みの制度値からツールの実装保証へ飛躍しないため、一部の既存ok/nonclaimも正本外へ変更した。

書き手への返却: 上記未解決の文言を執筆作業場で修正し、必要な正本を追加した新snapshotを提出すること。本審査では固定コピーへの修正を行わず、修正済みとも扱わない。新snapshot受領後、該当IDと関連要約・FAQ・埋め込み版を再照合する。

DONE
