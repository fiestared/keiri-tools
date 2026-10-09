import json,subprocess,re
from pathlib import Path
RUN=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261005/t2-q08502')
E=Path('review/auto20261005-t2-q08502');issues=json.loads((E/'issues.json').read_text());locs=json.loads((E/'issue-locations.json').read_text());a=json.loads((RUN/'segment-adjudication.json').read_text())['segments'];head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
text='''# auto20261005 t2-q08502 修正報告（2026-10-05）

作業場: `/Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261005-t2-q08502`。基点 `b1a5a596`（開始時のorigin/main）。作業中に共有origin/mainは別記事の公開で`31b4d141`へ進んだが、本作業の11ファイルの差分は開始基点から確認した。別記事を取り消すcommitは作っていない。他のモデル・サブエージェント・orca・スキル・pushは使用していない。入力のsnapshotと正本は変更していない。

審査の unresolved 54単位を12論点に束ねて修正した。high 11、medium 43、low 0（通過判定対象のhighは10、審査だけの独立追加highは1）。正本外への別モデルwrongは0。正本外117単位は全件同文のまま残し、needed_source付き未確認として登録した。未確認を独立okに変えていない。

## 単位と被覆の前後

| 指標 | 修正前 | 修正後 |
|---|---:|---:|
| 単位総数 | 495 | 520 |
| 独立審査ok | 192 | 178（同文のokのみ継承） |
| 審査unresolved | 54 | 元の54単位すべて訂正。94単位を再審査待ち |
| 非主張 | 132 | 131 |
| 正本外 | 117 | 117（全件同文・未確認） |
| 未処理（審査入力／現行台帳） | 0 | 0 |

修正後の内訳は独立確認178＋非主張131＋正本外117＋修正／追加後の再審査待ち94＝520。元のokの14単位も論点の全出現修正で文が変わったため再審査待ちへ移した。1つの旧非主張見出しも条件を明示した主張に変わった。94は誤り94件を意味しない。

`check_claims --segments` の実測は、対応369／495・非主張126・未処理0 → 対応389／520・非主張131・未処理0。未処理はもともと0なので減少は0。独立確認記録は旧台帳46 → 178。新しい主張のscope・exceptions・source_quote／corpus_refを登録し、古いcoversを現行IDへ更新した。被覆は正確性の保証ではない。

## 正本に照らした誤り率

審査後の修正前は wrong相当54 ÷ (ok192＋wrong54) ＝ **21.95%**。sol原判定だけなら53 ÷ (169＋53) ＝ **23.87%**（coverage.jsonのconfirmed222はsolのwrongを含む照合済み総数で、ok数として使わない）。

修正後の独立誤り率は**再照合前なので未確定**。本担当の自己点検では元の54／54単位の条件・値・区分を訂正し、元の照合可能246単位に対する残存既知誤りは0／246＝0%だが、独立審査の結果とは区別する。修正・追加94単位はシェルが6.1／5.6で再照合する対象であり、台帳でokにしていない。

## 論点 → 単位ID → 全出現の修正箇所 → 正本

対象本文はすべて `docs/column/gensen-choshuhyo-mikata/index.html`。以下の行番号は最終HTML。具体的な文・位置の全一覧は作業場の `review/auto20261005-t2-q08502/issue-locations.json`、変更単位と元IDの対応は `changed-unit-records.json`、根拠の逐語は `source-evidence.json` に保存した。
'''
for issue,loc in zip(issues,locs):
 sev=[x.get('severity') for x in a if x['id'] in issue['unit_ids']];counts={v:sev.count(v) for v in ['high','medium','low'] if sev.count(v)}
 text+='\n### '+issue['issue']+'\n\n'
 text+='単位ID: '+', '.join('`'+x+'`' for x in issue['unit_ids'])+'。重要度: '+str(counts)+'。\n\n'
 text+='修正・確認した範囲: '+issue['exceptions']+'\n\n'
 text+='全出現の位置: 対象HTML:'+','.join(str(x['line']) for x in loc['locations'] if x['file']=='docs/column/gensen-choshuhyo-mikata/index.html')+'（本文・要約・表・図のaria-label/text/figcaption・FAQ・該当FAQのJSON-LDを含む）。台帳は `claims/column/gensen-choshuhyo-mikata.json` の `auto20261005-*` に対応。\n\n'
 text+='転載の出現: '+', '.join(x['file']+':'+str(x['line']) for x in loc['locations'] if x['file']!='docs/column/gensen-choshuhyo-mikata/index.html')+'。\n\n' if any(x['file']!='docs/column/gensen-choshuhyo-mikata/index.html' for x in loc['locations']) else ''
 text+='根拠: '+', '.join('`'+x+'`' for x in issue['corpus_ref'])+'。\n'
text+='''
## 横断検索と生成物

給与収入と支払金額の論点はmeta description・OG description・リード・summary-box・早見表・年収の節・FAQ・FAQ JSON-LD・X共有文まで反映。関連記事カードは `meta card-desc` の短い文を用い、弁済額の除外・②③の年末調整条件まで読み切れる長さにした。title／OG title／Article headlineは欄名の説明であり、当該誤りの主張が無いことを確認した。

対象記事の説明を転載した `docs/column/index.html`、`docs/column/denchoho-kensaku-yoken/index.html`、`docs/column/denchoho-scanner-hozon/index.html`、`docs/column/denchoho-wakariyasuku/index.html`、`docs/assets/qa_index.json`、`docs/gensen-hyo/index.html`、`docs/juminzei/index.html` を生成器で揃えた。`docs/sitemap.xml` の更新日も反映。対象記事に対応するembed版は無く、既存の `docs/embed/gensen-choshu/` 等に今回の誤りの説明は無い。

「117,900円」「115,500円」の他出現を調べ、同じ設例は対象記事だけだった。他ページの源泉徴収税額表の115,500円は別の税額表の値なので変更していない。旧様式説明「令和8年8月以降」を `tests/stale_values.json` に拒否値として追加し、正しい時期と書面提出限定の根拠を記録した。計算機coreの誤りは0件で、core・境界値ケース・条件表に変更は無い。

HTMLを先にcommitし、FAQは `node tools/gen_faq_jsonld.mjs` で生成。CHECKABLE全5生成器（gen_index_sitemap・gen_datemodified・gen_trust_footer・gen_data_source_note・gen_domain_bridge）とgen_article_next_read・gen_qa_index・gen_tool_related・対象のX共有文を更新した。X共有生成器が触った対象外82件中の対象記事以外の変更は復元し、対象の論点に必要な差分だけ残した。

500万円例は実行計算で確認: 5,000,000−1,440,000＝3,560,000、750,000＋680,000＝1,430,000、課税所得2,130,000、税額115,500、115,500×1.021＝117,925.5、100円未満切捨て117,900。令和7年分居住者・給与のみ・他控除なし・年末調整済みの前提を図と表にも明示。

自己点検で、12論点のID集合＝審査unresolved54件の集合、54件の全文変更、正本外117件の同文保持、根拠引用の行との完全一致を機械で確認した（self-audit.json）。追加説明の最終監査で根拠行を直接示せない余分な1文を除去し、最終520単位・再審査待ち94単位とした。

## 検証

基点の赤はユーザーの指示値で test_hojokin_sources・test_layout_visual の2件（基点全テストの再実行ではない）。修正後は全300ファイルを実行し、298緑・2赤（test_layout_visual、test_tool_related）。関連記事の転載2ページを生成し直し、test_tool_related は再実行で緑。最終残存赤は既知の test_layout_visual 1件で、画像比較前の環境メタデータ不一致。基準画像・環境情報は変更していない。test_hojokin_sources は今回は緑だが、そのソース・テストはorigin/mainから変更していないので本修正による改善とは数えない。PLAYWRIGHT_PATHは指定値を使用し、この作業内のChromiumは常に同時1つ。

全サイトの表示検査は526ページ×6画面幅＝3,156ケースで異常0。最終本文の追加文除去後にも対象記事を1280・1536・1920・1200・768・390pxと印刷表示で再検証し異常0。関連記事更新のcommit後にCHECKABLE全5生成器を再実行し、test_generators_freshの最終結果を確認した。関連記事更新で住民税ページの更新日が変わったため、日付・サイトマップも再生成した。

`node tools/check_claims.mjs --changed origin/main` と `SEGMENTS_STRICT=1 node tools/check_claims.mjs --segments docs/column/gensen-choshuhyo-mikata/index.html` は緑、未処理0。`check_claim_scope` はcalc欠落0、must_with条件検査は0単位（この台帳のmust_with未設定なので、語の同伴条件を機械で検査したとは報告しない）。
'''
text+='\nコミットSHA（報告作成時）: `'+head+'`。pushなし。作業場の未コミット変更0。\n'
(RUN/'fixes-applied.md').write_text(text)
