2026-10-17 curl -L による出典確認。sources.json の15 URLはすべてHTTP 200。
協会けんぽページtitleは令和8年度保険料率、東京PDFは令和8年3月分・東京支部を確認。年金機構3ページはtitleの資料名と一致。算定ガイドPDFは固定正本corpus/santei_guidebook_r8.pdfとSHA256完全一致。
e-Gov本文はクライアント描画のため、同じ法律IDの /api/1/lawdata/211AC0000000070 と /api/1/lawdata/329AC0000000115 をcurlで取得（ともに200）。LawTitleと本則のArticle Num 3/45/156/159/159_3、24_4/81/81_2を確認。WebFetch・検索要約は不使用。
正本画像で確認した頁: PDF 6,14,15,16,17,18,21,22,23,37,38。
