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
