# 確認単位と条件表（2026-09-29）

`node tools/segment_claims.mjs docs/.../index.html` はDOMから確認単位を列挙する。
語の有無で採否を決めない。title・description・OG・見出し・本文・表・SVG・FAQ・UIの静的ラベル/初期値が対象。
本文は文に分け、同文の別出現を別IDにする。太字・空白・NFKCの差ではIDを変えない。
ナビ・パンくず・共通ヘッダ/フッタ・関連記事を除外する。JSが後で作る文や初期値は静的抽出だけでは保証できず、条件表/E2Eでも守る。

台帳の各主張に `covers: [segment ID]` を追加する。主張IDとの対応が必要な単位を語で間引かない。
ページの `nonclaims: [{id,why}]` は理由必須で、要約部・FAQ回答は非主張にできない。
`verified: [{id,text_hash,result:"ok",review_ref}]` は独立照合の記録用。自己申告の checked 日付から推定しない。
この欄の存在だけで審査証跡の真正性を保証しない。受け渡しは theme_round の固定入力と完了記録で確認する。

- 従来の数値検査: `node tools/check_claims.mjs --changed [base]`
- 単位検査だけ: `node tools/check_claims.mjs --segments --changed [base]`
- 既存ページの全文を関門化: `SEGMENTS_STRICT=1 node tools/check_claims.mjs --segments docs/.../index.html`

既存台帳の単位不足は既定で警告。baseとの分岐点に台帳が無かったページは全文を強制する。
新規台帳だけを足した場合も対象になる。新規ページに台帳が無い場合も強制対象。
段階1では既存ページの変更行だけへの単位限定を行わず、警告は全文。段階4で移行する。

`node tools/coverage_report.mjs <pages_top.txt> [120]` はstdout JSON。
主張との対応率（covered/total）と独立照合記録率（verified/total）を別々に出す。出力はコミットしない。
**被覆100%は正確性の保証ではない。**

`python3 tools/theme_round.py <theme> --segments --draft-worktree <worktree> --pages <pages.txt> --run-dir <新しいRUN>`
はtracked/untrackedの実ファイルをコピーし、元作業場・indexを変更せず、コピーを読み取り専用にする。
新規・改稿とも指定ページ全文（変更単位と同じ主張の別出現を含む）を20〜40単位で照合する。
`--prepare-only` と `--check-only` はモデルを起動しない。本実装の検証はstubのみ。
既存runの完了した束を再利用して未処理を減らす。別runや旧台帳から未確認の判定を自動継承しない。
`--registry <json> --corpus-dir <dir>` でテーマ外のRUN内最小正本登録も利用できる（registryのthemesにテーマ名を登録）。

solは全ID・現在のtext_hash・判定を返す。wrong/unclearは所見が必要。正本外は必要資料を指定する。
Astraはコピーを変更せずに審査する。修正が要れば書き手へ戻し、新しいrunで修正後を照合する。
review-summary.jsonは審査したGit treeと対応する。これを執筆RUNへコピーしてコミット後のwrite_completion.pyへ渡す。
対象外の変更もtreeが変われば再照合が必要になる保守的な仕様。受け渡し前に追加生成器を回す場合も同様。
公開は司令塔の検品後。ツールはpushしない。

条件表: `tests/conditions/<core>.json`。条件をinput/fixed/out_of_scopeに振り分け、一次資料つき実行ケース名へ結ぶ。
inputは実在する入力IDと2件以上のケース。固定/対象外は一意な要素の全文と一致させる（既存ページはscope_selector、新規はdata-scope-noteを推奨）。
排他・端数条件には専用ケース、表ごとにHTMLから読む初期値ケースを要求する。
ケースの意味が条件全体をカバーするかは独立レビューで確かめる。条件表の行数は法制度の全条件の網羅率ではない。
pendingは基点の既存coreから開始し、Git履歴上のpendingとの積集合より増やせない。新規coreは表または理由つき対象外が必要。

## 2026-10-01 一発で潰すための変更（gbrain audits/keiri-why-not-one-pass-2026-10-01・implementation/keiri-onepass-countermeasures-2026-10-01）
- **単位の切り方（対策5）**: 図は SVG の text 断片・aria-label・title・図の figcaption を図ごとに1単位（kind `figure`）。
  表のデータのセルは `【行】行見出し 【列】列見出し 【値】セル` の1単位（文で分けない。見出しを変えればセルの ID も変わる）。
  見出し・ラベル・表・図のうち金額・数字・日付・境界語（超・以上・未満・以下・以内・まで 等）を含むものは protected＝非主張にできない。
  ★既存台帳の covers のうち表のセル・SVG の text・図の figcaption を指していたものは古い ID になる（既存ページは警告のみ。直すときに付け替える）。
- **ok の条件・例外の走査（対策1）**: sol・審査の ok は `conditions: [{condition, corpus_ref, covered: yes|no|irrelevant}]` 必須。
  数字・境界・対象者・期限・義務・言い切りを含む単位で空、または no が1つでもあれば ok として数えない（sol は未処理、審査は run を止める）。
  審査は sol の conditions で足りれば `"conditions":"sol"`。この要求は run に固定したひな形が conditions を求めるときだけ（旧 run の再開は従来どおり）。
- **sol の並走（対策2）**: `--sol-models gpt-6.1-sol,gpt-5.6-sol` で同じ束を並走。1本目は `out/s*.json`、2本目以降は `out/<モデル>/s*.json`。
  `sol-models.json` と単位ごとの和集合 `sol-union.json` を審査が読む。再開でモデルの組を変えると止まる。
- **正本外（対策3・A に統一）**: 照合できない主張は別モデルが wrong と言わない限り残す。裏付けの無さは重要度の理由にしない。
  照合できる部分を含む単位を丸ごと out_of_corpus にしない。
- **関門と high の数え方**: 修正の対象は unresolved 全部と別モデルが wrong とした正本外（`STOPPED` の unresolved findings）。
  徹底チェックの通過判定に使う high は「審査が high かつ sol のどれかが wrong/unclear」だけ（`gate.json` の `unresolved_high`。審査だけの high は `unresolved_high_adjudication_only`＝次の周の候補）。
- **変わった単位だけの再照合（対策4）**: `--changed-since <前の run>` は、前の run の segments.json に同じページ・同じ本文の無い単位だけを照合する。0件ならモデルを呼ばずに `.finished`。

## 2026-10-09 局所文脈（gbrain implementation/keiri-unit-context-2026-10-09）
- 単位に `context`（文字列）と `context_hash` が付く。**id・text・text_hash は変わらない**（台帳の covers はそのまま）。`context_hash` は常に出る（null＝文脈なし。欄の有無で新旧の出力を見分ける）。
- 自動で付くもの: FAQ（「よくある質問」の h3〜h6 と直後の `<p>`）は、設問に `【回答】…`、回答の各文に `【質問】… 【回答の全文】…`。表に `<caption>` があれば、その表のセル・見出しに `【表題】…`。
- 書き手が印を付けるもの: 表の全行に共通する前提を書いた段落に `<p data-review-context="before-table">`（表の直前）／`<p data-review-context="after-table">`（表の直後の注）。
  表（または表だけを包む `.scroll-wrap`・figure）と**隣り合っていない**と例外で止まる。`<p>` だけ・500字まで。印を付けた段落自身も従来どおり1単位として照合される。
- 文脈に置けるのは表全体に共通する前提だけ（設例の仮定・対象者・年分・時点・料率・単位・端数処理・出典）。**その行だけで答えが変わる条件は行に書く**（ひな形が文脈に逃がすのを認めない）。記事全体の前提・離れた段落は束ねない。title・description・要約には付かない。
- `--changed-since`: 本文が同じでも context_hash が変わった単位は照合し直す（前の run が旧出力なら本文だけで比べる）。台帳の `verified` に `context_hash` を書いた記録は、文脈が変わると無効。
- 既存の `data-review-context="next"`／`"row"`（text を置き換える・ID が変わる）はそのまま使える。新しく書くときは使わない（FAQ は自動で束ねる）。
