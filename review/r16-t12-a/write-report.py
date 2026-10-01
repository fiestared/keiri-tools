from pathlib import Path
import json, subprocess
D=Path('review/r16-t12-a');R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t12-a')
before=json.loads((D/'coverage-before.json').read_text());after=json.loads((D/'coverage-after.json').read_text());ts=json.loads((D/'test-summary.json').read_text())
assert ts['total_completed']==298,ts['total_completed']
assert ts['final_red']==['tests/test_layout_visual.mjs'],ts['final_red']
assert all(not x['oc_lost_by_edit'] and not x['unresolved_unchanged'] for x in json.loads((D/'preservation.json').read_text()))
assert 'GREEN real UI' in (D/'final-validation.log').read_text()
total=lambda obj,k:sum(v[k] for v in obj.values())
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
log=subprocess.check_output(['git','log','--reverse','--format=%H %s','e7391b66..HEAD'],text=True).strip()
text='---\ntype: concept\ntitle: keiri r16 t12-a 修正報告 2026-10-01\n---\n\n'+(D/'report-body.txt').read_text().rstrip()+'\n\n'
text+='台帳被覆の前後（node tools/check_claims.mjs --segments を対象12ページで実行）\n\n'
text+='比較元は着手時の e7391b66 の実HTMLと既存台帳。固定審査2,440単位とは基点時点で7単位の抽出差がある。修正後は文章分割や入力欄整理で単位数が変わる。被覆は正確性の保証ではない。\n\n'
text+='|項目|前|後|\n|---|---:|---:|\n'
for key,label in [('total','抽出単位'),('covered','主張IDに被覆'),('verified','独立確認済みの台帳記録'),('nonclaims','理由つき非主張'),('unprocessed','未処理')]:text+=f'|{label}|{total(before,key):,}|{total(after,key):,}|\n'
text+='|正本外（固定審査の全記録）|231|231（現行228＋旧抽出3）|\n\n'
text+='未処理の減少は '+str(total(before,'unprocessed')-total(after,'unprocessed'))+'単位。残る228単位はすべてneeded_sourceつきの正本外で、okにも被覆にもしていない。非主張は固定審査541件のうち現行にも残る535件と新しい非主張2件を登録（計537）。基点ですでに抽出外の4件と削除した月数欄2件、計6件をprior_nonclaimsへ保持。\n\n'
lines=(D/'metrics.txt').read_text().splitlines();text+='\n'.join(x for x in lines if x.startswith('|'))+'\n\n'
text+='テストの前後\n\n'
text+='- 基点の赤2件（test_hojokin_sources・test_layout_visual）はユーザー指定情報。こちらのbaseline-partial.logは途中終了であり、基点の全件実測とは扱わない。\n'
text+=f"- 全298本を実行。途中の追加修正を挟んだ全体実行ログの赤は{len(ts['full_initial_red'])}件。関係テストの再実行と実画面の再測定後、残赤は1件（test_layout_visual）。297件は全体実行または対応する修正後検証で問題なし。最終ツリーで298本を先頭から再走した数字ではない。\n"
text+='- test_layout_visualは基点既知のPlaywright/Chromium環境メタデータ不一致（保存基準1.58.2／145.0.7632.6、実行環境1.62.1／151.0.7922.34）。画像基準は更新していない。test_hojokin_sourcesは今回の全体実行では緑だったが、今回の修正による解消とは扱わない。\n'
text+='- test_input_wiringの赤は旧tokiMadeMonths欄の1件だけ。欄を除去し、対象ページの全入力欄をWIRING_STRICT=1で再検査して緑。\n'
text+='- test_layout_renderは全514ページ×6幅＝3,084画面を測定。修正文が長くなった4ページのSVGに24画面分のはみ出しを検出し、位置・枠幅・改行を修正。最終版の対象12ページ＋生成物変更3ページ、計15ページ×6幅＝90画面と印刷表示を同じ測定関数で再検査し、問題0。4図のPNGも目視確認。\n'
text+='- 赤→緑の境界値、core・ページ・生成表・壊しテスト、条件表、stale_values、claims、実UIの期限境界・土地のみの計算・初期値を検証。詳細はreview/r16-t12-a/final-validation.logとfinal-*.log。\n'
text+='- HTMLをコミットしてから、CHECKABLE全5生成器を再実行。test_generators_freshとnode tools/check_claims.mjs --changed origin/mainは緑。作業中のブラウザ検査は直列で、同時に動かしたChromium/Chromeは1つ。他セッションの終了は待っていない。\n\n'
text+='全体実行で赤になったテスト（修正後の結果はtest-summary.json）:\n\n'+'\n'.join('- '+p for p in ts['full_initial_red'])+'\n\n'
text+='コミット\n\nHEAD: '+head+'\n\n'+log+'\n\n'
text+='証跡: /Users/masahiroyasu/Scripts/keiri-tools-astra-r16-t12-a/review/r16-t12-a/ 。変更は指定worktreeにコミット済み。pushしていない。司令塔の検品・公開待ち。\n'
(R/'fixes-applied.md').write_text(text)
print('WROTE',R/'fixes-applied.md',len(text),'characters; HEAD',head)
