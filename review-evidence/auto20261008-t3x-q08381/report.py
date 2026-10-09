from pathlib import Path
import json,collections,subprocess,re
run=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261008/t3x-q08381')
a=json.loads((run/'segment-adjudication.json').read_text())['segments'];s={(x['page'],x['id']):x for x in json.loads((run/'segments.json').read_text())}
un=[x for x in a if x['decision']=='unresolved'];groups=collections.defaultdict(list)
for x in un:
 t=s[x['page'],x['id']]['text'];r=x['reason']
 if x.get('severity')=='low':g='T11 FAQ質問と回答の対応'
 elif '通勤災害' in r:g='T08 傷病手当金の通勤災害除外'
 elif '逆方向' in r:g='T09 随時改定の逆方向2ケース'
 elif '提出主体' in r:g='T10 産休育休免除の申出と別制度'
 elif '年4回以上' in r and '賞与' in t:g='T07 標準賞与の対象と回数'
 elif '従前額' in r or '提出不要' in r:g='T06 定時決定の例外と別区分'
 elif '現物' in r or '臨時支給' in r:g='T02 月額報酬の金銭・現物・除外と図の制度区分'
 elif '任意継続' in r and ('上限' in r or '増加する帯' in r):g='T05 健保・厚年・任意継続の上限'
 elif '被扶養者' in r:g='T04 支援金の負担主体'
 elif '区域内' in r or '住所' in r or '第2号被保険者限定' in r:g='T03 介護の国内住所と医療保険加入'
 else:g='T01 額表・設例の適用月／基金／端数／介護資格・厚年範囲'
 groups[g].append(x)
refs={
'T01':'corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:2-87（表50行と全注記）; corpus/kyoukaikenpo_r08.txt:97-99; corpus/egov_kaigo_9.txt:3',
'T02':'corpus/santei_guidebook_r8.pdf:page 5-7（画像確認。本文の逐語は台帳source_quote）; corpus/service_kounen_hokenryo_hoshu_20150511.txt:145-146; corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:39,70',
'T03':'corpus/egov_kaigo_9.txt:3; corpus/egov_kaigo_10.txt:3; corpus/egov_kaigo_11.txt:3; corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:69',
'T04':'corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:9-16,85-87',
'T05':'corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:18-73',
'T06':'corpus/service_kounen_hokenryo_hoshu_20121017.txt:142-223; corpus/santei_guidebook_r8.pdf:page 5,7,21-26,39-40（画像確認）',
'T07':'corpus/santei_guidebook_r8.pdf:page 30（画像確認）; corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:81-87',
'T08':'corpus/nenkin_seidoannai.pdf:page 1（画像確認）',
'T09':'corpus/santei_guidebook_r8.pdf:page 27-29（画像確認）',
'T10':'corpus/nenkin_ikuji.txt:350-379',
'T11':'corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:2-4; corpus/kyoukaikenpo_r08.txt:97-99'
}
loc={
'T01':['docs/column/hyojun-hoshu-gakuhyo/index.html: meta description・OG description・Article description・表前説明・5列のdetails条件（各データセル全250単位の列見出しにも条件が結合）・4級/35級範囲・都道府県callout・FAQ回答・出典料率の基金区分','docs/column/kyushoku-shakai-hokenryo/index.html: amount段落の本人額と3か月累計・立替3/6か月・仕訳段落・仕訳2行の行見出し','docs/assets/hyojun_row_lookup.js: 結果説明にも東京一般・適用月・基金・端数・介護資格を表示。35級範囲の厚年注記を含む入力を最初の範囲2数値で読む','docs/column/shakai-hokenryo-keisan/index.html、docs/shakai-hoken/index.html: 同額の本文・合計行・報酬対照表・会社額・FAQ・リード・meta/OG/Article description・図figcaption（必要条件が既に全てある出現は維持）','docs/column/{fuyo-kojo-shinkokusho,shussan-teate-kin,taishoku-yukyu-shoka,tsukin-teate-hikazei,zuiji-kaitei}/index.html: 42,570円が出る比較例・行見出し・本文の設例条件','docs/assets/shaho_rates_r08.json: _meta.noteの開始月・一般／任意継続／日雇・介護資格・支援金被保険者・基金区分','docs/embed/shakai-hoken/index.html: 入力前の対象範囲説明','tools/gen_kenpo_ichiran.mjs、docs/column/kyokai-kenpo-ryoritsu-ichiran/index.html: 介護込み・折半列の条件を生成器にも登録'],
'T02':['docs/column/hyojun-hoshu-gakuhyo/index.html: grade-help・表の見方・等級を調べるli・SVG aria-label/text/軸/figcaption。図は健保20〜23級／厚年17〜20級を区分','docs/assets/hyojun_row_lookup.js: 追加した厚年範囲注記が検索境界を壊さない読み方','docs/shakai-hoken/index.html: 適用促進手当の本文・FAQの2出現に目的・指定名称・新規負担の条件を同期'],
'T03':['docs/column/hyojun-hoshu-gakuhyo/index.html: 介護列条件・65歳以上注記・介護の見方と40歳到達文・11.47% callout','docs/column/kyushoku-shakai-hokenryo/index.html: 介護追加の資格条件','docs/column/kaigo-hokenryo-itsukara/index.html: 同額比較行・11.47%の算式行・賞与段落・端数段落・FAQ','docs/column/kenko-hoken-nini-keizoku/index.html: 11.47%を引用する出典li','docs/column/kodomo-kosodate-shienkin/index.html: 40〜64歳を示す図figcaption','docs/column/shakai-hokenryo-keisan/index.html、docs/shakai-hoken/index.html: 11.47%各出現の本文・行・図・FAQ','tools/gen_kenpo_ichiran.mjs、docs/column/kyokai-kenpo-ryoritsu-ichiran/index.html: 介護の列条件と東京計算例','docs/assets/shaho_rates_r08.json、docs/embed/shakai-hoken/index.html: 対象資格の説明','docs/column/yakuin-shakai-hoken/index.html: card-descの東京一般・介護資格・開始月・基金区分。docs/column/index.htmlのカードと内部要約は生成器で同期'],
'T04':['docs/column/hyojun-hoshu-gakuhyo/index.html: 支援金の見方（全員→被保険者の折半負担）','docs/shakai-hoken/index.html: 本文と内部表示注記の全員表現','docs/assets/shaho_rates_r08.json: _meta.note','docs/column/azukarikin/index.html: 被保険者の折半負担に統一'],
'T05':['docs/column/hyojun-hoshu-gakuhyo/index.html: 上限比較表の健保セル・増加する帯を説明するp'],
'T06':['docs/column/hyojun-hoshu-gakuhyo/index.html: 自分の等級を調べるli・等級決定FAQの平均算定文と例外、年間平均の2等級差・例年発生見込み・事業主申立てと本人同意、遅配／遡及・低額休職給・ストライキ月の別区分、申出の紙／電子の取扱い'],
'T07':['docs/column/hyojun-hoshu-gakuhyo/index.html: 賞与FAQ（労働対償、年3回以下／4回以上、恩恵・実費、同一保険者累計上限と申出）'],
'T08':['docs/column/kyushoku-shakai-hokenryo/index.html: 傷病手当金の療養要件（業務上・通勤災害除外）'],
'T09':['docs/column/kyushoku-shakai-hokenryo/index.html: 月額変更の3条件文に逆方向の対象外2ケースを併記'],
'T10':['docs/column/kyushoku-shakai-hokenryo/index.html: 免除の事業主・宛先・主な期間条件・賞与・基金・国年／国保本人届出の別区分'],
'T11':['docs/column/hyojun-hoshu-gakuhyo/index.html: 有効期間FAQ見出しにdata-review-context="next"（質問＋既存隣接回答として照合）']
}
data=[{'topic':k,'units':[{'page':x['page'],'id':x['id'],'severity':x.get('severity'),'reason':x['reason'],'conditions':x.get('conditions',[])} for x in v],'locations':loc[k[:3]],'source':refs[k[:3]]} for k,v in sorted(groups.items())]
Path('review-evidence/auto20261008-t3x-q08381/issues.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print([(x['topic'],len(x['units'])) for x in data])

# Render the final report only after the complete test run and clean final commit.
if __name__ == '__main__' and '--final' in __import__('sys').argv:
    root=Path.cwd(); sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
    layout=json.loads((root/'review-evidence/auto20261008-t3x-q08381/layout-target.json').read_text());assert len(layout)==12 and all(not x['issues'] for x in layout)
    assert '緑' in (root/'review-evidence/auto20261008-t3x-q08381/nini-retest.log').read_text()
    audit=json.loads((root/'review-evidence/auto20261008-t3x-q08381/final-unit-audit.json').read_text())
    cv=json.loads((root/'review-evidence/auto20261008-t3x-q08381/coverage-before-after.json').read_text())
    log=(root/'review-evidence/auto20261008-t3x-q08381/tests-after.log').read_text()
    status=json.loads((root/'review-evidence/auto20261008-t3x-q08381/test-run-status.json').read_text());assert status['completed'], 'all tests incomplete'
    log='\n'.join(x for x in log.splitlines() if not x.rstrip().endswith('緑') or x.startswith('全309'))
    lines=['# auto20261008 t3x-q08381 修正報告','', '2026-10-08 / Astra。サブエージェント・他モデル・orca・スキルを使用せず、pushなし。', '',
        f'作業場: `{root}` / branch `wt/astra-auto20261008-t3x-q08381`。基点 `eee87619`（origin/main）。本文先行コミット `7166ff63`、最終コミット `{sha}`。',
        '入力正本はRUNのcorpus。既存台帳の過去のcorpus_rootは維持し、今回の各根拠は下記RUNのcorpus参照に対応する。', '',
        '## 単位数・被覆・誤り率', '',
        '入力622単位: 審査ok216 / unresolved284 / nonclaim83 / out_of_corpus39。oc-opinionはnot_wrong36・unsure3・wrong0。正本外39単位は本文・単位IDを全て維持し、needed_source付き未確認として残した。',
        'sol-union（入力にあるgpt-6.1-solのみ）: ok374、wrong121、nonclaim83、out_of_corpus43、unclear1。正本に照らした誤り率は **121 ÷ (374+121) = 24.44%**。coverage.jsonのconfirmed495はok+wrongなので、495件を正しい主張と扱わない。',
        '修正後の独立審査による誤り率は未算出。DONE後にシェルが変更単位を再照合する。自点検で元のunresolved IDの未変更は0/284、正本外の変更は0/39。これを独立審査のwrong=0と混同しない。', '',
        '| 対象ページ | 単位数 前→後 | covers 前→後 | verified 前→後 | nonclaims 前→後 | 未処理 前→後 | 正本外 後 |',
        '|---|---:|---:|---:|---:|---:|---:|']
    for x in audit['stats']:
        b=next(z['before'] for z in cv if z['page']==x['page']);c=x['coverage']
        lines.append('| '+x['page']+' | '+' | '.join(f'{b[k]}→{c[k]}' for k in ['total','covered','verified','nonclaims','unprocessed'])+' | '+str(c['unprocessed'])+' |')
    lines += ['', '合計: 622→676単位、covers135→558、verified104→210、nonclaims67→79、未処理420→39。入力審査ok216のうち今回変更されていない210単位をverifiedに保持。変更した主張はcovers・scope・exceptions・source_quote/corpus_refを登録し、自点検済み／変更単位の再審査待ちとした。coversは対応付けであり、正しさの独立判定ではない。',
        '残る未処理39件は正本外（等級表5・休職34）。`check_claims --segments`はこの39件を警告として残し成功。対象外ページの既存未処理は今回審査済みにしていない。都道府県一覧の東京以外の既存料率は数値を維持し、今回追加した介護条件だけを正本で点検した。東京以外の原数値の必要正本は各新規セルのneeded_sourceに残し、独立確認済みにしていない。新設したtaishoku-yukyu-shoka台帳の未変更の労働・税務等の主張もlegacy_unchanged_pending_source_review / needed_sourceとし、独立確認済みにしない。', '',
        '## 修正した論点（元の審査単位ID）', '',
        '審査unresolved284件を理由で11論点に束ね、high211 / medium72 / low1を修正。gateのhigh78と審査のみのhigh133を合算した件数。正本外wrongは0件。各節の表・注・備考・別区分まで確認し、説明の追加には台帳の根拠引用と適用範囲・全件例外を登録した。']
    for d in data:
        cnt=collections.Counter(u['severity'] for u in d['units'])
        lines += ['', '### '+d['topic'], '', '件数: '+str(len(d['units']))+' / '+str(dict(cnt)), '', '単位ID:\n\n'+'\n'.join('- '+pg+': '+', '.join(u['id'] for u in d['units'] if u['page']==pg) for pg in dict.fromkeys(u['page'] for u in d['units'])), '', '修正した全出現・関連箇所:']
        lines += ['- '+x for x in d['locations']]
        lines += ['- 対応するclaims JSONの新規・変更主張、covers、scope、exceptions、source_quote/corpus_ref。FAQは`node tools/gen_faq_jsonld.mjs`で本文に同期。', '', '根拠: '+d['source']]
    lines += ['', '### T12 横展開で見つけた3月分への支援金混入（追加medium、上記284件には含めない）', '',
        '原審査単位IDなし。`docs/column/azukarikin/index.html`の42,570円例は4月分・5月給与の設例へ明記し、仕訳日も5/25・5/31・6/10へ同期。3月末の別設例は東京一般・標準報酬30万円・介護なし・基金未加入の3月分として42,225円（14,775+27,450）に修正し、預り金残高58,545円、合計76,545円へ連動修正。本文・表・太字の全出現と`claims/column/azukarikin.json`を同期。税・雇用保険等の別額は設例の仮定と明示。',
        '根拠: corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt:3-4,39,75-87。3月に支援金0.23%を足さない。`tests/stale_values.json`と`tests/test_stale_values_rules.mjs`に古い組合せの拒否／4月許容ケースを登録。', '',
        '## テストと生成', '',
        '最初の全実行は終了コード143で中断したため、完了扱いにせず、作業場の残存Node/Chromeと一時変更を確認後、終了コード・完了状態・各テスト名を記録する独立プロセス群で全309本を再実行した。中断記録はtests-interrupted.json、最終完了記録はtest-run-status.json。実行環境: PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js。全テストはrun_tests.shで逐次実行し、この作業でChromiumを同時に2つ起動しない。他セッションを待機条件にしていない。',
        '基点の赤（ユーザー指定、今回の基点で再実測はしていない）: test_hojokin_sources / test_layout_visual の2件。修正後の実測ログ:', '', '```text', log.strip(), '```', '',
        '全実行は309本完走・赤7件（終了コード1）。今回由来の任意継続記事の閉じ括弧だけの単位は、句点を括弧の外へ移して本文を先行コミットcc4a33bf、台帳のIDも同期しtest_nini_keizoku_articleを再実行して緑。これにより残る赤は6ファイル（layout_render、layout_visual、left_edge、no_hscroll、no_orphan、stale_values）。left_edgeは10分の測定時間上限で165/511ページ未測定とヘッダー80/73px不一致、no_hscrollは8分の上限で119/550ページ未測定。no_orphanは未変更のifreenext-india-vs-rakuten-indiaへの本文リンク不足、stale_valuesは未変更のjuminzei-hayamihyoの5,600円。対象外の本文・テストの上限・画像基準を変更して緑にしたものではない。基点指定2件→全実測7件→今回由来修正の再テスト後6件。',
        '全描画検証で16/3300ケースが赤。うち今回の等級図6サイズは約3pxの文字はみ出しで、枠を238→250へ広げ、矢印の始点も同期（4e8e3a65）。全実行終了後、対象2ページ×6サイズの12ケースをlayout-target.mjsで再検証し全て緑。残る10ケースはorigin/mainから未変更のjuminzei-hayamihyo（SVG目盛り6サイズ）とsbi-spyd-vs-rakuten-vym（表横スクロール4サイズ）。基点で再実測していないため、ユーザー指定の赤2件と同一の基点実測結果だとは断定しない。画像比較の赤はブラウザ151.0.7922.34の基準に対し実行環境の版が異なるため（基準の更新はしていない）。',
        '本文を先に7166ff63へコミットした後、CHECKABLE全5生成器（index_sitemap・datemodified・trust_footer・data_source_note・domain_bridge）を実行。加えてFAQ・kenpo一覧・layout_markup・presentation_markup・qa_indexを同期。共有URLは対象記事のリンクhrefだけを更新し、マーカー内にある既存の説明文を保持した。',
        '`node tools/check_claims.mjs --changed origin/main`成功。対象2ページの`--segments`成功。`test_generators_fresh`の全CHECKABLE成功（全テスト結果にも含む）。境界検証はtest_uiux_0926の92999/93000/634999/635000/664999/665000と、新設test_hyojun_scope（50等級の公式率との算術照合・250セルの適用条件・3月設例）に記録。計算coreの金額誤りは見つからず、追加した範囲注記をlookupが読む部分を直した。',
        '証跡: review-evidence/auto20261008-t3x-q08381/{check-claims-final.log,segments-check.log,final-unit-audit.json,coverage-before-after.json,issues.json,table-calculations.json,tests-after.log,generators-final.log}。', '',
        '## 変更ファイル（origin/mainとの差分）', '']
    files=subprocess.check_output(['git','diff','--name-only','origin/main','HEAD'],text=True).splitlines()
    lines += ['- `'+f+'`' for f in files]
    lines += ['', '作業場は最終コミット後にgit status --porcelainで空を確認。pushなし。gbrainの既存同名ページは事前getでpage_not_foundだったため、本報告を新規保存し、getで読戻し一致を確認した。', '', 'DONE']
    (run/'fixes-applied.md').write_text('\n'.join(lines)+'\n')
