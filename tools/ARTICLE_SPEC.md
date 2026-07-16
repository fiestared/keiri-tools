# 記事の書き方（keiri-tools コラム）

**このファイルが記事の正本の型。** `node tests/test_article_structure.mjs` が機械で強制する。
書き終えたら必ず自分で流し、緑にしてから終わること。

## 絶対に守ること（これを破ると商品が壊れる）

1. **数字を推測で書かない。** 税率・料率・上限額・期限は、必ず**一次情報**（国税庁・
   日本年金機構・全国健康保険協会・厚生労働省・e-Gov法令）を読んで確かめる。
   確かめられなかった数字は**書かない**。「たぶんこうだったはず」は、経理の現場では実害になる。

   ⚠️ **政府サイトの数値確認に WebFetch を使うな。要約器が「もっともらしい嘘」を返す。**
   実例2件（2026-07-13）: ①国税庁の2割特例のページで、対象者を「認定経営革新等支援機関の支援を
   受けた小規模事業者」と**完全に捏造**。②協会けんぽの料率ページで「最低は沖縄県9.44%」と回答
   （正しくは新潟県9.21%。同じ回答の中に9.21%を列挙しながら矛盾していた）。
   **エラーにならないので気づけない。必ず生テキストを読む。**
   ```
   curl -s <URL> | grep -io 'charset=[a-z0-9_-]*'  # ★まず文字コードを見る。ディレクトリで決め打つな
   curl -s <URL>                                   # charset=utf-8 のとき(iconv を通すと壊れる)
   curl -s <URL> | iconv -f cp932 -t utf-8         # charset=shift_jis のとき
   # 同じ taxanswer 配下でも混在する: 1130.htm=UTF-8 / 1130_qa.htm(質疑応答)=Shift_JIS
   curl -s -o /tmp/x.pdf <URL> && pdftotext -layout /tmp/x.pdf -
   curl -s "https://laws.e-gov.go.jp/api/2/law_data/{law_id}"      # ← v2。v1は古い条文を返す
   ```
   **未施行リビジョンに注意**: 令和8年度改正の所得税法は**施行日が令和8年12月1日**。
   今日の「現行」を引くと**改正前の額が返る**。`/api/2/law_revisions/{law_id}` で将来施行版を読む。
   PDFの**表**は `pdftotext` だと結合セルで行がずれる。**`pdfplumber` でbboxごと**取ること。
   **改正直後は国税庁のタックスアンサーが古いままのことがある。財務省の大綱が正本。**

2. **出典を h2「出典」に列挙する。** どのページを見たか（発行元＋資料名）を書く。
3. **年度・年分を明記する。** 「令和8年度」「令和8年分」。無記名の数字は将来の嘘になる。
4. 一般論の免責を末尾に置く（既存記事の最終行と同じ文言）。

## ファイルの場所

`docs/column/<slug>/index.html` の1ファイルだけを作る。
**sitemap.xml / column/index.html / assets/style.css は触らない**（親が中央で更新する。競合するため）。

## 型（テストが見ている）

```
<head>
  <title>…</title>                     60字以内。検索結果で切れる
  <meta name="description" …>          60字以上。要点＋数字を入れる
  <link rel="stylesheet" href="../../assets/style.css">
  <link rel="canonical" href="https://keiri-tools.com/column/<slug>/">
  JSON-LD @graph に Article（datePublished/dateModified）と BreadcrumbList
  GA4タグ (G-E742DSDHPD) と AdSense (ca-pub-2635067516563578)
     → 既存記事の <head> をそのままコピーして中身だけ差し替えるのが確実
</head>
<body>
  <header class="site">…共通ナビ…</header>
  <main>
  <nav class="breadcrumb">ホーム › 経理コラム › <この記事></nav>
  <article>
    <h1>…</h1>
    <p class="article-meta">公開日: 2026年7月13日 ／ 〈根拠の出所を一言〉</p>
    <p class="byline">文責: <a href="../../about/">Masahiro Yasu</a>（クリニック・EC事業の経営者／経理実務者）</p>
       ← 実名バイライン必須(E-E-A-T)。JSON-LDの author も Person(Masahiro Yasu, about参照)で書く。
         匿名Organizationに戻すとテストが落とす。免責(税理士でない旨)はaboutと記事末尾の注記に集約し、
         バイラインには書かない(毎回書くと冗長・防御的)。本文は「あなたはこうすべき」でなく
         「一般に〜と計算する」で書く(一般的情報提供であって個別の税務相談ではない=税理士法の線引き)

    〈結論ファーストのリード 2〜3段落〉  ← 読者は「答え」を探しに来ている。先に言う

    <nav class="toc"><div class="toc-title">目次</div><ol>…全h2へのリンク…</ol></nav>

    <h2 id="…">…</h2>   ← h2 は3つ以上。すべて id を持ち、すべて目次に載る
    …
    <figure class="figure">…インラインSVG…<figcaption>…</figcaption></figure>
       ← 図解は必須。外部画像は使わない（<img src="http…"> はテストが落とす）

    <a class="tool-cta" href="../../<tool>/">…</a>   ← 記事は入口、ツールが商品

    <h2 id="faq">よくある質問</h2>
    <h3>Q. …？</h3>
    <p>A. …</p>          ← 答えは h3 直後の <p> ひとつだけ。表・calloutを入れない
    （FAQのJSON-LDは本文から自動生成する。手で書かない）

    <section class="related">…関連ツール/記事のカード…</section>
    <h2>出典</h2><ul>…</ul>
    〈免責の一文〉
  </article>
  </main>
  <footer class="site">…</footer>
</body>
```

## 使えるCSSクラス（`<style>` は書かない。テストが落とす）

`.callout`（注意ボックス／`<b>`が見出しになる）・`.figure`＋`figcaption`・`.tool-cta`（ツールへのCTA）・
`.tool-grid`＋`.tool-card`（関連カード）・`.summary-box`・`.note`・`.scroll-wrap`（横長の表を包む）・
`.article-meta`・`.toc`・`.breadcrumb`・`.related`。表は素の `<table>` でよい。

## 中身の質（ここで差がつく）

- **結論を先に。** 「〜については諸説あり」ではなく「**結論から言うと、Xです**」。
- **具体例と実数を必ず入れる。** 「東京都・月給30万円・35歳なら、健康保険料は◯◯円」。
  抽象論だけの記事は誰にも読まれないし、上位に来ない。
- **落とし穴・間違えやすい点を書く。** 実務者は「自分のケースは大丈夫か」を確かめに来る。
  1日違いで結論が変わる／年度で変わった／例外がある、を明示する。
- **表で比較する。** 「AとBの違い」は文章で並べず表にする。
- 競合（会計SaaSのブログ）が書いていない **踏み込んだ一段**を必ず1つ入れる。
  改正の経緯・条文番号・境界ケース・実際の帳票の見方など。
- 文字数の目安 3,000〜6,000字（可視テキスト）。薄い記事は量産しても価値がない。

## SVG図解の作り方

`viewBox` を切って、矩形・線・テキストで描く。凝った絵はいらない。
**流れ図（判定の分岐）・時系列（いつ何をするか）・内訳（金額の内わけ）**のどれかが有効。
色は `var(--accent)` `var(--sub)` `var(--warn-line)` などCSS変数が使える。
文字は `font-size="13"` 程度、`fill="currentColor"` で本文色に追従させる。
