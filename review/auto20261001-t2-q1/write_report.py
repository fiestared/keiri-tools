from pathlib import Path
import json,subprocess
root=Path(__file__).resolve().parents[2];p=root/'review/auto20261001-t2-q1'
run=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261001/t2-q1')
results=json.loads((p/'all-tests.results.json').read_text())
expected=list(root.glob('tests/*.mjs'))+list(root.glob('tests/test_*.py'))
assert len(results)==len(expected) and (p/'all-tests.finished').exists()
assert {r['test'] for r in results}=={str(f.relative_to(root)) for f in expected}
red=[r for r in results if r['returncode']]
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
commits=subprocess.check_output(['git','log','--format=%H %s','f8c2cfe1..HEAD'],cwd=root,text=True).strip()
report=f'''# auto20261001（t2-q1）修正完了報告

実施日: 2026-10-01 JST。担当: Astra。push・他モデル・サブエージェント・orca・スキル使用なし。公開は司令塔の検品後。

## 作業場・コミット

- 作業場: `{root}`
- ブランチ: `wt/astra-auto20261001-t2-q1`
- fetch後の基点: `f8c2cfe1`（origin/main）。入力RUN・正本・先行判定は変更していない。
- 最終HEAD: `{head}`
- コミット:

```
{commits}
```

本文HTML・台帳・旧表記拒否リストを先にコミットし、その後CHECKABLE全5生成器を実行。生成物は別コミット。

## 単位数と被覆

今回の独立審査入力は611単位: ok 325、nonclaim 155、out_of_corpus 115、unresolved 16、審査未処理0。oc-opinionはwrong 0件なので正本外115単位の文面を全件維持し、needed_source付きの未確認として残した。okへ昇格していない。

既存台帳は別周の記録だったため、今回の審査と分類が異なる。以下は実際の台帳を `check_claims --segments` で測った前後。確認済みは有効なcovers＋text_hash一致のverified。正本外は機械の未処理にも含まれるため、列を加算しない。

| ページ | 総単位 前→後 | 確認済み 前→後 | 非主張 前→後 | 正本外 前→後 | 機械の未処理 前→後 |
|---|---:|---:|---:|---:|---:|
| hoteichosho-goukeihyo | 308→308 | 160→168 | 92→87 | 56→53 | 56→53 |
| taishoku-gensen-choshuhyo | 303→310 | 135→179 | 94→69 | 74→62 | 74→62 |
| 合計 | 611→618 | 295→347 | 186→156 | 130→115 | 130→115 |

元のok 325・nonclaim 155・正本外115はID/text_hashとも全件維持。unresolved 16単位だけを置換し、修正後23単位（主張22・案内文1）へ対応させた。元の審査基準で見ると、確認済み325→347、非主張155→156、正本外115→115、unresolved16→0。未処理115は全件正本外であり、不明ID・理由なしnonclaim・残存unresolvedではない。

修正後の新単位のverifiedは修正担当の一次資料再照合で、独立再審査を受けたという意味ではない。被覆は正確性の保証ではない。

## 正本に照らした誤り率

- 修正前: **16 ÷ (325 + 16) = 4.69%**。審査のunresolved（誤り・要修正）をwrongとして集計。非主張と正本外は分母に入れない。
- 修正後の現行単位: **0 ÷ (347 + 0) = 0%**（修正担当による正本・追加一次資料での再照合。独立再審査は未実施）。単位の分割・案内文への変更により分母が変わる。

## 修正した16単位

high **4**、medium **12**、low **0**。同じ原因の別出現も審査単位として数える。

| 重要度 | 単位数 | 修正内容・根拠 |
|---|---:|---|
| high | 2 | 電子等の提出義務の表から提出日＝対象年分の同値表現を除去。令和9年1月以後の提出で30枚基準を判断する。corpus/01.txt:80–90。 |
| high | 1 | 不動産使用料の15万円以下を「同一の相手への年間支払額の合計」と明記。corpus/05.txt:3–16。 |
| high | 1 | 少額報酬等の合計表FAQの「書きます」を、原則総額・実際に提出する支払調書だけでも可という回答へ。corpus/08.txt:80–92。 |
| medium | 2 | 「多くの担当者がつまずく」「いちばん多い」の根拠のない頻度断定を除去。提出範囲の案内・上段の使用条件へ。corpus/00.txt:16–17、03.txt:45–47。 |
| medium | 1 | 正本にない用紙送付停止の年分・引用を、最新の書面様式を使う案内へ。corpus/01.txt:114–120。 |
| medium | 1 | 不動産使用料FAQの引用断定をやめ、総額記載と提出分限定の両方式を明記。corpus/08.txt:106–110。 |
| medium | 4 | meta・OG・冒頭・比較表で、番号欄の新設／令和8年9月の書面様式変更／現行無効区分欄の存在を区別し、新設時点の断定を解消。corpus/01.txt:110–120、03.txt:24–28、03.pdf:19頁。 |
| medium | 3 | 住民税の2分の1計算は一般退職手当等に限定し、短期・特定役員の例外を図の補足とFAQへ。段によって税額不変という図の説明は後掲の一般退職・単独受給設例に限定。固定正本03.txt:120–140と追加の自治体一次資料。 |
| medium | 1 | FAQの「同上・〃禁止だから他段を埋めない」という因果を、申告書と他社退職手当の有無による段の選択へ。corpus/03.txt:45–54。 |

追加一次資料: [岡山市「退職所得にかかる市民税・県民税の算出方法」](https://www.city.okayama.jp/kurashi/0000005624.html)。HTMLを直接取得して本文を読み、一般・短期・特定役員の区分及び申告書未提出時の取扱いを確認。固定取得物は `review/auto20261001-t2-q1/okayama.html` と `.txt`。この補足を理由に既存正本外の単位をokへ変更していない。

計算機coreの誤りは今回の対象に0件。core・境界値ケース・条件表の変更なし。適用日と対象年分を同一視する旧表記2件を `tests/stale_values.json` に登録し、旧値検査を通過。

## 検査結果

- `node tools/check_claims.mjs --changed origin/main`: 緑。
- `node tools/check_claims.mjs --segments <対象2ページ>`: 終了0。未処理56→53、74→62。残る警告115は必要資料付きの正本外であり、全件確認済みとは扱わない。
- FAQ本文・JSON-LD一致: 468ページ／3155問、緑。
- 全ページ描画: 514ページ×6サイズ＝3,084画面、異常0。対象2ページも各6サイズで異常0。`layout-summary.json` に集計。
- CHECKABLE全5生成器: gen_index_sitemap、gen_datemodified、gen_trust_footer、gen_data_source_note、gen_domain_bridgeを実行。test_generators_fresh緑。
- 基点の赤: **2件**（ユーザー指定: test_hojokin_sources・test_layout_visual）。今回の変更前run_tests.shはSIGTERMで中断したため、基点全件を独自に完走したとは記録しない。
- 修正後もrun_tests.shがSIGTERM（-15）で中断したため、同じ `tests/*.mjs` と `tests/test_*.py` の全ファイルを直列の保存型ランナーで実行。実行環境は `PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js`。他セッションを待たず、この作業内のブラウザテストは重ねていない。
- 修正後の初回全件: **{len(results)-len(red)}/{len(results)}緑、赤{len(red)}件**。赤: {', '.join(r['test'] for r in red) or 'なし'}。
- 初回のtest_qaは本文修正に伴うQA検索索引の更新漏れ。CHECKABLEの5生成器とは別にgen_qa_indexを実行し、test_qa・test_qa_stopword_drift・test_retention_core・test_site_searchを再実行して4/4緑。元の全件結果は書き換えていない。
- **最終残存の赤はtest_layout_visualの1件**。基点の赤2件という指定情報に対し、test_hojokin_sourcesは今回35チェックすべて緑であり、同検査・補助金データは今回変更していない。これを今回の修正成果には数えない。
- test_layout_visualの赤は環境メタデータ不一致: 指定環境Playwright 1.58.2／Chromium 145.0.7632.6、基準1.62.1／151.0.7922.34。画像基準は更新していない。
- 全件の結果: `review/auto20261001-t2-q1/all-tests.results.json`、個別ログ: `all-test-logs/`。中断した実行のログも保存し、完走記録と区別した。

## 証跡・引き渡し

`review/auto20261001-t2-q1/` に入力審査のコピー、入力・正本ハッシュ、単位前後、coverage-before/after、repair-review、applied-edits、追加一次資料、生成器・全テストのログを保存。正本・RUNの入力は変更していない。修正対象HTML2ページとその一覧生成物をコミット済み。pushはしていない。

修正後23単位と、正本外115単位を未確認のまま保持している状況を司令塔へ引き渡す。今回は公開操作を行っていない。
'''
(run/'fixes-applied.md').write_text(report)
print(run/'fixes-applied.md')
