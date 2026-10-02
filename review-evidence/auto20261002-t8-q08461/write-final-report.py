from pathlib import Path
import json,subprocess,re,collections
E=Path('review-evidence/auto20261002-t8-q08461'); R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t8-q08461')
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
assert not git('status','--porcelain'),'worktree must be clean before final report'
log=(E/'all-tests.log').read_text(); assert re.search(r'★赤 \d+/300 件:|全300ファイル緑',log),'full suite incomplete'
metrics=json.loads((E/'final-audit.json').read_text());assert metrics['original_oc_preserved']==96 and metrics['unprocessed']==96
red=re.search(r'★赤 (\d+)/300 件:',log); nred=int(red[1]) if red else 0
fail=log[red.end():].strip() if red else 'なし'
visual=json.loads((E/'visual-audit.json').read_text());assert len(visual)==6 and not any(x.get('issues') or x.get('pageOverflow') for x in visual)
layout=json.loads((E/'layout-initial-summary.json').read_text());assert layout['non_target_failures']==0
remaining=[x.strip() for x in fail.splitlines() if x.strip().startswith('tests/') and 'test_layout_render.mjs' not in x]
sha=git('rev-parse','HEAD');commits=git('log','--format=%h %s','origin/main..HEAD')
report=f'''# auto20261002（t8-q08461）修正報告

2026-10-02。担当: Astra。作業場: `{Path.cwd()}`。push・公開なし。他モデル・サブエージェント・Orca・スキル使用なし。

## 結果と単位数

未解決112単位を14論点に束ね、正本の同じ表・節の注記・別区分を読んで修正。high 15、medium 97、low 0（単位数、重複出現を含む）。正本外でwrongは0件。not_wrong 92・unsure 4は全件文面を保持し、needed_source付き未確認のまま残した。

|段階|単位数|確認・対応|非主張|正本外|未処理/未解決|
|---|---:|---|---:|---:|---|
|入力 coverage.json（審査前の生成値）|644|confirmed 356|183|99|unclear 6、unprocessed 0|
|今回の審査 segment-adjudication.json|644|ok 250|186|96|unresolved 112、判定欠落0|
|修正前の台帳実測|644|covers 144、独立確認129|177|現行ID・hash一致60（旧記録総数101）|未処理323|
|修正後の台帳実測|{metrics['total']}|covers {metrics['covered']}、独立確認{metrics['verified']}＋担当者照合{metrics['repairer_verified']}|{metrics['nonclaims']}|{metrics['out_of_corpus']}|未処理{metrics['unprocessed']}（すべて正本外）|

`check_claims --segments` の未処理は **323→96（227減）**。この検査はout_of_corpusを処理済みとして数えないため、正本外をok/nonclaimに変えてゼロにはしていない。本文の条件追加・文分割で単位総数は644→661。担当者照合131は独立再審査待ちであり、verified okに含めない。混合単位の未確認部分（個人マイゲートの経路見出し、未確認サービスの掲載額等）もneeded_sourceを残した。前の台帳記録は過去の記録と明示し、古いcoversは除去した。

## 正本に照らした誤り率

審査後に残った112には、Solのいずれかがwrongとした108と、wrong無しでunclearのみの4がある。wrongをunclearと混ぜない定義では **108 ÷ (250＋108) = 30.17%**。要修正をまとめた参考率は112 ÷ (250＋112) = 30.94%。正本外96・非主張186は分母に入れない。判定がokに覆ったSol所見をwrongへ戻していない。

修正後は、元の正本照合対象362単位の照合可能部分について担当者確認で残存wrong 0、自己確認率 **0 ÷ (362＋0) = 0%**。これは独立再照合の結果ではない。変更後の独立誤り率は未測定で、review_run.shの6.1/5.6による変更単位の再照合へ渡す。担当者のゼロ判定をgate.jsonへ書き戻していない。

## 重要度別の内容

- high 15: SMTB法人100円の開始日・通常振込/総合振込・予約受付日・提携サービス（料金セル4、逆引き2、個人法人倍率1）、法人レンジ等の範囲3、年間差額の前提2、グラフのサービス限定1、30,200円の差引例のBizSTATION限定1、現金ATMの10万円上限1。
- medium 97: 銀行別の無料/別料金宛先、BaaS・本人名義口座の条件、個人マイゲートのグループ除外、各表・逆引き・倍率・要約・FAQへの同条件反映、ATM別途利用料、ゆうちょ利用口座間の定義と明細票料金、ことらの対応金融機関限定。
- low 0。料金数値・計算coreの修正0。今回は料金の適用条件の修正なので、core境界値/conditions/stale_valuesへの追加対象はない。

## 論点 → 単位ID → 全修正箇所 → 根拠

以下の節アンカーは特記なければ `docs/column/furikomi-tesuryo-hikaku/index.html`。単位に複数論点がある場合は重複して載せる（14論点の和集合は112単位）。固定正本は `review-evidence/auto20261002-t8-q08461/corpus/` に保存し、台帳には指定形式のcorpus_refと実在するsnapshot_ref、逐語source_quoteを付けた。

{(E/'issue-report.md').read_text()}

## 横断確認・生成

- `docs/assets/fee_table.json` に宛先・適用日・対象サービスの条件を持たせ、冒頭一覧・銀行別・金額逆引きの全出現を統一。`tools/gen_bank_sections.mjs` は注記中の数字でソートせず、数値の料金で並べる。既存の未確認表示・取得日・横浜の掲載保留を生成後も保持する。
- `docs/assets/bank_presets.js` は手動選択とURL指定で条件注記を表示する。`final-audit` で30区分の料金と条件付き13区分の注記を確認。
- title / meta description / OG は正本外not_wrongの原文を保持。FAQ JSON-LDは `node tools/gen_faq_jsonld.mjs` で本文との一致を確認。SVGのaria-label・text・figcaptionは具体的銀行/サービスへ統一。
- `docs/embed/senpou-futan/` は銀行プリセットを読まない手入力版で、銀行料金の同一主張なし。`docs/assets/senpou_core.js` の100円等は入金差額候補で、今回の料金条件変更による数値変更なし。その他ページの同じ数字の検索結果は別制度の数値で、振込料金の同一主張は残っていない。
- `docs/assets/qa_index.json` は生成器で最新を確認（変更不要）。本文を先にcommitした後、CHECKABLEの5生成器（index_sitemap、datemodified、trust_footer、data_source_note、domain_bridge）を全実行。sitemapの対象ページlastmodを10月2日へ同期。
- 修正後のsource_quoteを **延べ{metrics['exact_source_ranges']}行範囲照合、不一致0**。正本外96単位の文面保持、古い/未知covers・nonclaimの残存0を確認。逆引きの100円等、値自体が変わらない単位も同じ行に宛先・条件を補足して解消した。

## テスト

指定環境 `PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js` で `./run_tests.sh -q` を全300本実行。Chromiumは本作業内で直列に使用。他セッションの終了は待っていない。

- 基点の赤: 指示で提示された2件（test_hojokin_sources、test_layout_visual）。基点全件の再実行はしていない。追加で見つかったstale_valuesの4ページについては、作業開始時の886e539eと本文・検査定義が一致することと、同じ日付で基点の本文から同じ4件が検出されることを確認した（baseline-stale.json）。残存する2件はlayout_visualの環境不一致と、基点でも検出されるstale_values。共有origin/main参照は作業中に進んだため、基点本文の比較には固定SHA 886e539eを使った。
- 初回の全件実測: **赤{nred}/300**。赤一覧:

```
{fail}
```

- 修正後の再検査を含めた残存赤: **{len(remaining)}件**（{', '.join(remaining) or 'なし'}）。今回の横はみ出しは同じ6画面幅の対象ページ再検査で解消。全ページ検査の残り3,132画面は元から問題0で、修正後に全300本をもう一巡はしていない。
- test_layout_visualは基準環境（Playwright 1.58.2 / Chromium 145.0.7632.6）と指定実行環境（1.62.1 / 151.0.7922.34）の不一致。画像比較前の失敗で、基準の自動更新はしていない。test_hojokin_sourcesは今回の作業場では全件実行・最終個別実行とも緑で、基点の提示された赤は再現しなかった。
- 料金比較、逆引き、銀行別、プリセット/導線、FAQ可視本文、質問箱、5生成器のfresh検査を最終生成後に再実行して緑。
- `node tools/check_claims.mjs --changed origin/main`: 緑。
- `node tools/check_claims.mjs --segments docs/column/furikomi-tesuryo-hikaku/index.html`: 実行成功、正本外96のみ警告。被覆は正確性の保証ではない。
- 全件レイアウト検査でゆうちょの利用口座間注記の横はみ出しを検出し、既存のcell-note表示で折り返すよう修正。変更後の対象ページを同じ6画面幅・印刷モード・目次/フォーム/空白領域検査で再測定。その他ページの全件結果は変更せず保存する。
- 全件ログ: `review-evidence/auto20261002-t8-q08461/all-tests.log`。最終関連検査は同ディレクトリの`test_*.log`、単位前後は`segments-before.log`/`segments-after.log`。

## コミット・受け渡し

基点886e539e。最終commit: **{sha}**。

```
{commits}
```

作業場の未コミット差分なし。pushなし。変更単位の独立再照合はシェル側に委ね、本担当はその完了を待たない。

DONE
'''
(R/'fixes-applied.md').write_text(report)
print(str(R/'fixes-applied.md'));print('HEAD',sha,'test failures',nred)
