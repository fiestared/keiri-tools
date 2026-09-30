from pathlib import Path
import json,subprocess,re,collections
root=Path.cwd(); evidence=root/'review/r16-t3-a'; run=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t3-a')
assert (evidence/'tests-full.rc').exists(), 'full suite has not completed'
assert (evidence/'targeted-tests.json').exists(), 'post-fix checks missing'
target=json.loads((evidence/'targeted-tests.json').read_text());assert all(x['rc']==0 for x in target)
stats=json.loads((evidence/'coverage-stats.json').read_text());dispositions=json.loads((evidence/'dispositions.json').read_text());rate=json.loads((evidence/'error-rate.json').read_text())
full=(evidence/'tests-full.log').read_text();reds=re.findall(r'^(tests/\S+)\s+★赤',full,re.M);n=len(list((root/'tests').glob('*.mjs')))+len(list((root/'tests').glob('test_*.py')))
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();commits=subprocess.check_output(['git','log','--reverse','--format=%H %s','de83e2ef..HEAD'],text=True).strip()
rows=[]
for p in stats:
 b=p['before'];a=p['after'];name=p['page'].removeprefix('docs/').removesuffix('/index.html')
 rows.append(f"| {name} | {b['total']} → {a['total']} | {b['covered']} → {a['covered']} | {b['verified']} → {a['verified']} | {b['nonclaims']} → {a['nonclaims']} | {b['out_of_corpus']} → {a['out_of_corpus']} | {b['unprocessed']} → {a['unprocessed']} |")
summary='\n'.join(rows)
report=f'''# r16 t3-a 修正実施報告

2026-09-30 JST。担当 Astra。修正・被覆登録・検証を実施。pushなし。公開は司令塔の新snapshot確認・検品待ち。

## 作業場・入力

- 作業場: `{root}`、ブランチ `wt/astra-r16-t3-a`。
- 指定どおりfetch後、基点 `de83e2ef`（origin/main）から専用worktreeを作成。コード・HTML・台帳・補足資料はここだけで編集。
- RUNのsegments/out/裁定/coverage/正本/説明は読み取り専用で扱い、変更なし。他モデル・サブエージェント・Orca・スキルは使用していない。
- 指定されたgbrain設計・実装を読み、coversと独立照合済みverifiedを区別した。
- 正本の短時間労働者153–213行、被扶養者153–200/300–303行、協会けんぽ料率153–156/293–294行を開いた。制度案内PDF p.1–2、算定ガイドPDF p.11–12・43はページ画像を目視した。

## 単位数と被覆の前後

入力審査は789単位すべてに判定あり。**ok 256、nonclaim 203、out_of_corpus 257、unresolved 73、審査未処理0**。solのcoverage.json（confirmed184等）をAstraの裁定256と混同していない。

実ページを再抽出した台帳の機械被覆は次のとおり。`check_claims --segments`の未処理には、理由つき正本外も含まれる。

| ページ | 単位数 | covers | 独立確認済みverified | 非主張 | 台帳の正本外 | 機械上の未処理 |
|---|---:|---:|---:|---:|---:|---:|
{summary}
| 合計 | 789 → 814 | 235 → 357 | 184 → 255 | 182 → 201 | 283 → 256 | **372 → 256** |

- 修正後814単位 = 独立確認済み255 + 修正者確認102 + 非主張201 + 正本外256。分類・対応理由のない残りは0。**被覆100%や全件正確を意味しない。**
- 元のok256のうち255は同文で継承。475番は引用に続く文を要約へ直したため、元のokを新文に流用せず修正者確認にした。
- 元の非主張203のうち21・153番は試算条件等へ変更したため、新文を非主張扱いにしていない。
- 元の正本外257を一括okにしない。同文の248はそのまま保持し、変更で退役した9単位も各台帳の`_r16.retired_units`にneeded_sourceつきで残した。新たな複合単位8を未確認として登録し、現行の正本外は256。
- 変更・追加資料を採用した102単位はcoversへ結びつけたが、`verified`にはせず`pending_review`で新snapshotの独立確認を要求した。保護された共有ラベル789は非主張にしていない。
- 4ページの`--segments`で上記減少を確認。`--changed origin/main`も終了0。旧ID・無効なnonclaim・重複ID等の構造エラー0。

## 正本に照らした誤り率

元の裁定はwrongを独立集計せず、誤り・条件不足・資料不足を73件のunresolvedにまとめていた。この修正工程では原因を区別した（`dispositions.json`に全IDと理由）。

- **明確な不一致・条件を落とした断定・同条件試算との不整合: wrong 15件。正本でokとした256件との比率は15÷(256+15) = 5.54%。**
- wrongの番号: 16、23、34、87、212、340、346、412、415、469、538、712、772、778、785。
- 残り58件は説明の限定・引用元・資料・実行証跡の不足として分け、資料未収録だけでwrongにしない。正本外257・非主張203も分母から除外。
- unresolvedを便宜上すべてwrongと数える要修正率は73÷(256+73) = 22.19%。これは資料不足も含む値で、事実誤認率とは区別する。
- 原文の15件は修正者として対応済み。**修正後の独立審査の誤り率は未測定**であり、0%になったと宣言しない。

## 73件への対応

元のunresolved73件は修正者対応73件・未対応0件（独立検品は未実施）。優先度別の対応は**high 3 / medium 68 / low 2**。本文の変更は40単位（high3・medium37）、同文のまま補足資料・検証を加えたのは33単位（medium31・low2）。solのseverityがない追加指摘は、dispositions.jsonにmedium付与の理由を明記した。

- **high 23**（同趣旨87も修正）: 7つの壁を暦年の給与収入で一律判定する説明を撤回。税の年分、短時間労働者の所定内賃金月額、扶養の今後の年間見込み収入（給与以外も含む）を分けた。税を含む単位全体の正本外は留保。
- **high 498**: 正本未収録のQ&Aの長い逐語引用と遡及断定を削り、正本で確認できる所定労働時間の定義と、契約・実態が異なる場合の窓口確認へ限定。関連FAQ668–669とJSON-LDも同期。
- **high 781**: 「賃金の額にかかわらず加入」を撤廃の事実と残存要件に書き分け、最低賃金減額特例は個別確認・計算機対象外とした。日付を「予定」へ戻していない。
- **medium（条件・対象）**: 適用事業所・年齢・適用除外の前提、企業人数の「1年のうち6か月以上」、埋込版の任意特定適用・国等、被扶養配偶者/第3号の範囲、年齢別の加入手続き、過去の厚生年金期間を含む給付説明を修正。裏付けのない同意割合や断定は収録正本で確認できる範囲へ限定。
- **medium（試算）**: 東京・30/39歳・一定月給・賞与等なし、勤務時間等の変更により勤務先加入要件も満たす仮定、保険別の給与控除時端数処理、4月分以後の料率×12、所得税/住民税/雇用保険の除外を明記。労使の折半率と端数処理後の実負担を区別。150万5,000円は丸めた試算点であり、150万円時点では129万円に4,548円足りないことをFAQ・meta等へ反映。
- **low 149**: 計算したという説明に対応する入力・出力・再現コードを保存。
- **low 789**: X共有ラベルの静的href、intent/tweet、対象ページURL、共有本文を確認。投稿・外部送信は実施していない。

73件それぞれの原文ID、severity、修正/資料補充、後継単位ブロック、裁定理由は `{evidence}/dispositions.json`。

## 計算と補足正本

今回の指摘について、正本照合・再現で計算coreの数値誤りは見つからず、coreの修正は行っていない。従ってcore修正に伴う新しいboundaries/条件表の登録はなし。既存のkabe・境界値・条件表を含め全テストを実行した。

入力corpusを変更せず、次の公式本文を`review/r16-t3-a/sources/`に保存しURL・取得日・SHA256をmanifestへ記録した。

- [協会けんぽ東京・令和8年度保険料額表](https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf): PDF画像を目視し、等級・折半額・50銭以下切捨て/50銭超切上げ・支援金開始月を確認。
- [日本年金機構・第3号被保険者](https://www.nenkin.go.jp/service/yougo/tagyo/dai3hihokensha.html)と[協会けんぽ・退職後の健康保険](https://www.kyoukaikenpo.or.jp/faq/voluntary_continuation/001/): 被扶養配偶者/第3号の対象と本人負担を確認。
- [19歳以上23歳未満の被扶養者の収入要件](https://www.nenkin.go.jp/oshirase/taisetu/2025/202508/0819.html): 配偶者除外・認定日・年末年齢判定の補足資料。

`reproduce.mjs` / `reproduction.json`で18組の年額・境界値を公式額表から置いた定数と照合し、扶養内129万円の回復試算・月給10万円の本人額も再現。1,504,547円では手取り1,289,999円、1,504,548円で1,290,000円、1,505,000円で1,290,452円。1,000円刻みのcoreの回復点1,505,000円は仕様どおりで、最低額そのものとは異なる。

旧説明は`tests/stale_values.json`へ狭い文脈つきで登録し、`test_stale_values_rules`で旧断定を拒否・正しい比較を許可する2ケースを追加。

## コミットと生成器

HTMLを先にコミットした後、test_generators_freshのCHECKABLE 5本（index_sitemap、datemodified、trust_footer、data_source_note、domain_bridge）を実行。FAQ JSON-LDと対象ページのX共有文、QA検索索引も同期。余分な他ページの共有文更新は戻し、この修正に混ぜていない。

最終HEAD: **{sha}**

```text
{commits}
```

## テストの赤の前後

- 基点の既知赤は依頼で指定された2件: `test_hojokin_sources`、`test_layout_visual`。この便で基点全体を再実行したとは報告しない。
- `PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js`で`./run_tests.sh`を直列実行。初回は**{n-len(reds)}/{n}緑、赤{len(reds)}、終了{(evidence/'tests-full.rc').read_text().strip()}**。
- 初回赤: {', '.join('`'+f+'`' for f in reds)}。
- 今回追加した「令和8年4月分以後」が、厳密な年度表記チェックのデータ年度「令和8年度」と一致しなかった。基点コピーのチェックは緑、今回HTMLを載せたコピーは赤、年度表記を揃えたコピーは緑と切り分け。実HTMLも「令和8年度の4月分以後」へ修正し、年度・関連破壊テストを含む最終検査を再実行した。テストの条件は緩めていない。
- 初回の`test_qa`は本文変更を反映するQA検索索引の更新漏れで赤。`gen_qa_index.mjs`を実行し、最終検査で一致を確認した。
- 初回の`test_layout_mutations`も、変更していない画像破損fixture（390px）で赤になったため、同じテストを変更せず再実行した。初回失敗と再実行結果の両方をログに残した。再実行では再現しなかったが、初回失敗の原因は特定していない。
- 最終の関連検査 **{len(target)}/{len(target)}コマンド緑**。詳細は`targeted-tests.json`と各log。全体の初回赤を隠して「最終全件一発緑」とは報告しない。残存赤は基点指定の2件。
- 初回の全サイト表示検査は514ページ×6画面幅＝3,084ケースが緑（`layout-full-summary.json`）。最終本文は対象4ページ×6画面幅の24ケースを改めて描画し、はみ出し・重なり・欠落等の計測エラー0を確認。`layout-final.json`に保存。
- この作業内のChromiumは直列で最大同時1つ。自分のrunner配下でも1プロセスを確認。他セッションの終了を待つ運用はしていない。

## 検品への引き渡し

修正後814単位の再抽出結果、73件の対応表、追加資料、被覆ログ、全テストと追加検査のログは専用worktreeの`review/r16-t3-a/`に保存。正本外256単位と修正者確認102単位は、必要資料・新snapshotの独立確認を残す。公開可のreceiptを発行したり、pushしたりしていない。

本報告は`gbrain put implementation/keiri-r16-t3-a-2026-09-30`で保存し、`gbrain get`で本文を読み戻して一致を確認する。
'''
(run/'fixes-applied.md').write_text(report)
print(run/'fixes-applied.md')
