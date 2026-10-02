from pathlib import Path
import json,subprocess,collections,re,sys
R=Path('reports/auto20261002-t5-q08464');RUN=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t5-q08464')
def git(*a):return subprocess.check_output(['git',*a],text=True).strip()
coverage=json.load(open(R/'coverage-comparison.json'));issues=json.load(open(R/'issue-locations.json'));topics=json.load(open(R/'topics.json'));data={t['id']:t for t in topics}
text=['# auto20261002 t5-q08464 修正記録（2026-10-02）','',f'作業場: `{Path.cwd()}`。基点: `34be072a`（作成時の origin/main）。pushなし。他モデル・サブエージェント・orca・スキル不使用。RUNの入力・corpusは変更していない。','',
'## 結果と数え方','',
'審査の未解決81単位を8論点にまとめ、同じ論点の出現を本文・要約・FAQ・JSON-LD・meta/OG・SVG・embed・別コラム・データ注記まで確認した。high 33 / medium 47 / low 1を修正・解消。mediumのうち1件は、ひとり親の父1万円・母5万円が施行令と一致したため、数値を維持して根拠を明示した。審査high 33件のうち、gateが通過条件に数えるSOL和集合由来は26件、審査独自は7件。','',
'修正担当による論点照合では81件すべて対応済み。これは別モデル再照合の合格宣言ではない。変更後の独立再照合はreview_run.shに引き継ぐ。','',
'正本外73単位は全件、元の単位ID・文面を保持した（wrong判定0）。書換え・削除・okへの昇格なし。まとめの複合文を分けた結果、既存の「申請期限は翌年1月10日。」が独立した1単位となり、当初申請期限の一次資料をneeded_sourceに指定して正本外へ留保した。したがって変更後の未確認は74単位。','',
'### 単位と被覆','',
'|集計|変更前|変更後|','|---|---:|---:|',
'|対象2ページの単位総数|441|479|',
'|入力審査でokだった単位|170|165が同文のまま残り、verifiedに登録|',
'|今回の台帳で主張に対応済み（covers）|166|289|',
'|今回の台帳の独立照合記録（verified）|166（旧台帳の過去記録）|165（今回入力審査の同文okのみ）|',
'|非主張|審査117 / 旧台帳119|116|',
'|正本外|審査73|74（既存73＋分割1）|',
'|check_claims --segmentsの未処理|156|74（全件needed_source付き正本外）|',
'|未対応の修正論点|81単位|0（修正担当照合、独立再照合待ち）|','',
'台帳のcoversは正確性の保証ではない。変更後の289 = 同文ok 165＋修正文・追加説明124。修正文にはverifiedを付けていない。元のok 5単位は同論点の条件補足で変更したため再照合待ち。元のnonclaim 1単位（夫婦列の見出し）は年齢条件を加え主張へ変更した。','',
'|ページ|総数 前→後|covers 前→後|verified 前→後|nonclaims 前→後|未処理 前→後|','|---|---:|---:|---:|---:|---:|']
for p,v in coverage.items():
 b,a=v['before'],v['after'];text.append('|`'+p+'`|'+'|'.join(f"{b[k]}→{a[k]}" for k in ['total','covered','verified','nonclaims','unprocessed'])+'|')
text += ['', '### 正本に照らした誤り率', '',
'- 入力SOL和集合（wrong優先、次にunclear、ok）：wrong 62 / (ok 189＋wrong 62) = **24.70%**。正本外・非主張・unclearは分母から除外。',
'- 6.1単独（入力coverage.jsonと同じ）：59 / (185＋59) = **24.18%**。5.6単独：20 / (198＋20) = **9.17%**。',
'- 審査はwrongという分類を出さずunresolvedを81としたため、81 / (170＋81) = 32.27%は「要修正率」であり、確定wrongの誤り率とは区別する。父母の差のような根拠未収録による保留も含む。',
'- **変更後の独立誤り率は未測定**。自己点検の残論点0を独立の誤り率0%に置き換えない。', '',
'## 論点・単位ID・全修正箇所・正本', '',
'以下のcorpus/はRUNの固定正本。追加取得した施行令・令和9年施行版は作業場のreports/auto20261002-t5-q08464/corpus/。e-Gov API原文をcurlで直接取得し、JSON.gzと抜粋本文を保存した。WebFetch・検索要約は使用していない。', '']
for i,(key,info) in enumerate(issues.items(),1):
 t=data[key];sev=collections.Counter(x['severity'] for x in info['units']);text += [f"### {i}. {info['name']}（{len(info['units'])}単位）",'',f"内訳: high {sev['high']} / medium {sev['medium']} / low {sev['low']}。",'', '該当単位:','']
 for page in sorted({x['page'] for x in info['units']}):text.append('- `'+page+'`: '+', '.join('`'+x['id']+'`' for x in info['units'] if x['page']==page))
 text+=['','修正・根拠確認の内容: '+t['scope'],'']
 text += ['- '+e for e in t['exceptions']]
 if key=='single-parent':text += ['- 施行令7条の16の2・48条の7の2を追加取得。父母の法定区分が明記されており、SOLの「父1万円は誤り」という疑義は採らない。embedの説明と参照データ注記に法令名を追加。']
 text+=['','修正箇所（本文・JSON-LD等の同文出現を含む）:','']+['- `'+x+'`' for x in info['locations']]
 text+=['','根拠（同条・同表の例外まで読んだ範囲）: '+ ' / '.join('`'+x+'`' for x in info['refs']), '']
text += ['## 追加根拠・全出現の確認','',
'- 非居住者の全3区分、配偶者本人所得3区分、死亡・再婚、山林・退職の別計算、特例割合90％、変更届の対象期間と3事項を走査。例外を全部説明しない場所では「主な例外」又は適用範囲の限定を明記した。',
'- `docs/column/furusato-nozei-keisan/` は既存の `.nopublish` を維持。同じ説明が残るため横展開した。`docs/column/furusato-nozei-kakutei-shinkoku/` の控除内訳・総額説明・出典注も横展開した。',
'- `docs/assets/qa_index.json` は生成器でmetaの修正を同期。`docs/assets/juminzei_r08.json` は特例分用税率と父母差の**説明注記のみ**を修正。数値を正規化して基点と比較し、計算用の値が不変であることを検証。coreの計算誤り・改定済み値の残存を今回の対象論点として確定したものはないため、core・境界値ケース・stale_valuesに機能変更は加えていない。',
'- SVGの数値・aria-label・figcaptionは両税率20％・各限度内・復興特別所得税込みの設例として照合。旧コラムの図の注も本体と同期。単位の全文保存・照合結果は `self-audit.json`、変更箇所対応は `issue-locations.json`。',
'- 新しい62万円の扶養所得要件は、令和9年1月1日施行版の23条・292条と令和8年法律2号附則3条2項・11条2項の**令和9年度以後適用**を確認した。`corpus/chihozei-2027.txt:3-7`。追加の不変の出典注は `corpus/chihozei-2027-basis.txt:1-4`（施行日、人的控除差調整額、基礎控除43/29/15万円の全区分）を保存。','',
'## コミット・生成器・テスト','',
'HTMLを先にコミットし、その後に `test_generators_fresh` のCHECKABLE全5本（index_sitemap / datemodified / trust_footer / data_source_note / domain_bridge）を実行。FAQ JSON-LDは `node tools/gen_faq_jsonld.mjs`、QA索引は `gen_qa_index.mjs` で生成した。','',
'実装コミット:','',
]+['- '+line for line in git('log','--oneline','34be072a..HEAD').splitlines()]
if (R/'tests-after.exit').exists():
 log=(R/'tests-after.log').read_text();fails=re.findall(r'=== FAIL (.+?) ===',log)
 text+=['',f"全テスト: `PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js node tools/run_tests.mjs`。終了値 {(R/'tests-after.exit').read_text().strip()}。",'','```text','\n'.join(log.strip().splitlines()[-4:]),'```','',f"赤の前後: 依頼で示された基点は2件（test_hojokin_sources・test_layout_visual）。今回の全テスト実測は{len(fails)}件: "+', '.join(fails)+'。',
'test_layout_visualの失敗は画像差分の判定前に環境指紋が不一致になったもの。実行環境Playwright 1.58.2 / Chromium 145.0.7632.6に対し、保存基準は1.62.1 / 151.0.7922.34。基準の上書きはしていない。全523ページ×6画面サイズ＝3,138組の描画検査は問題0で通過（layout-render-summary.json）。',
'全件実行で出たtest_year_stalenessは、2026年寄附と令和9年度住民税の対応という制度の事実をデータ年分の不一致と誤検知していた。一次資料を理由として全文一致をHISTORICAL_FACTSに登録し、対象検査の再実行で緑（year-staleness-after.log）。年号全体やページ全体の免除はしていない。',
'全234件を実行、測定不能0。修正後の対象再検査を合わせると232件緑・2件赤。最終的に残る赤はtest_layout_visualとtest_stale_valuesの2件。後者は今回変更していないhotei-koyoritsu・nenshu-no-kabe・shakai-hoken-kanyu-joken・kabeの4ページで2026-10-01を過ぎた未来形。4ページと検出器・設定が基点34be072aとバイト単位で一致することを確認（stale-baseline-identity.json）。依頼の基点赤2件には含まれていなかったため、新たに観測した既存不具合として区別する。test_hojokin_sourcesは今回緑。',
'基点の全件再実行は入力配線テストの途中で中止し、前の赤2件は依頼の値として区別した。中断実行を全件測定・全件緑とは数えていない。変更後は全件を直列実行しており、今回の作業でChromiumを並列起動していない。']
else:text+=['','全テストは実行中。完了結果はこの欄へ追記する（この段階ではDONEではない）。']
text+=['','`check_claims --changed origin/main`、embedのページ全体チェック、対象2ページのsegmentsチェックを実施。segmentsの残りは74件すべて正本外であり、台帳のneeded_source付き未確認として残した。','',
'生成器鮮度チェック・check_claimsは緑。全出現の走査で、条件のない所得割20％の残存は0件。新規台帳62件のscope・exceptionsと167か所のcorpus参照行の存在も確認した（source-refs.log）。']
if '--final' in sys.argv:
 assert (R/'tests-after.exit').exists(), 'Full tests must finish first'
 assert not git('status','--porcelain'), 'Worktree must be clean'
 text += ['', '最終コミット: `'+git('rev-parse','HEAD')+'`。作業場は未コミット変更なし。pushしていない。', '', 'gbrain登録先: `implementation/keiri-auto20261002-t5-q08464-2026-10-02`。既存ページはgetで不存在を確認。登録後のgetで本文を照合して引き継ぐ。', '', 'DONE']
 (RUN/'fixes-applied.md').write_text('\n'.join(text)+'\n')
 print('Final report:',RUN/'fixes-applied.md')
 sys.exit(0)
(R/'fixes-applied-draft.md').write_text('\n'.join(text)+'\n')
print('Draft report:',len(text),'lines')
