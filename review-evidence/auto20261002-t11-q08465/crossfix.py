from pathlib import Path
import json
out=Path('review-evidence/auto20261002-t11-q08465/edits.json'); edits=json.loads(out.read_text())
def r(page,topic,a,b):
 p=Path(page); h=p.read_text(); assert a in h,(page,a); n=h.count(a);p.write_text(h.replace(a,b));edits.append(dict(page=page,topic=topic,old=a,new=b,count=n))
p='docs/column/shogaku-genka-shokyaku/index.html'
r(p,'期限','同日前の旧取得分は30万円未満です。','令和8年3月31日以前の取得分は30万円未満です。')
r(p,'除却清算','A. </span>できません。<b>除却・売却しても','A. </span>通常の除却・売却だけではできません。<b>通常の除却・売却では')
r(p,'除却清算','同条4・5項により','法人税法施行令133条の2第4・5項により')
r(p,'除却清算','同条7〜10項の','法人税法施行令133条の2第7〜10項の')
# Explicit statutory attribution rather than altered quotation.
r(p,'一括月数','この式の出どころは同条第1項で','この式の出どころは法人税法施行令133条の2第1項で')
r(p,'一括月数','<blockquote>通常購入の場合の式（同条1項の括弧書に適格組織再編による引継年度の別計算あり）: 当該','<p>以下は通常購入の式の引用です。同条1項の括弧書には適格組織再編による引継年度の別計算があります。</p>\n  <blockquote>当該')
r(p,'一括月数','<p>通常購入で組織再編による引継ぎがない法人の','<p>通常購入で組織再編がない法人の')
# Main topic cross occurrences.
p='docs/column/shomohinhi/index.html'
r(p,'一括月数','取得価額の合計を36で除して月数を乗じた額を各期の損金＝3年で均等','通常購入で組織再編がない場合、損金経理額のうち取得価額合計÷36×事業年度月数が各期の限度。各年度12か月なら3年均等、端数月は切上げ。適格組織再編の引継年度は再編日から年度末までの月数')
r(p,'適用条件','一括償却資産（104,500円÷3＝約34,833円ずつ3年）、青色申告の中小企業者等なら少額特例で全額損金','一括償却資産（通常購入・各年度12か月なら限度額は104,500円÷3＝約34,833円ずつ3年。短期年度は÷36×年度月数）、対象中小企業者等の青色申告法人なら少額特例で全額損金')
r(p,'適用条件','のどれかを選びます。同じ物を','のうち各制度の要件を満たすものを選びます。一括償却は供用・選定・損金経理・申告書記載・計算書類保存・明細添付が必要です。少額特例は供用年度の全額損金経理、年枠・期限・明細添付等が必要で、両制度とも貸付資産等の対象除外を確認します。同じ物を')
p='docs/column/kensetsu-karikanjo/index.html'
r(p,'付随費用','逆に、建設中の借入金利息や、','建設中の借入金利息は取得価額に含めないこともできますが、既に建設仮勘定に含めた利息は取得価額に含まれ、完成時に損金へ振り替えることはできません（国税庁 No.5400 関連QA）。また、')
p='docs/column/genka-shokyaku-toha/index.html'
r(p,'一括月数','全額を経費にする道や3年均等で落とす道があります。','各制度の適用要件を満たせば全額を経費にする道や一括償却の道があります。一括償却は個人では3年均等、法人の通常購入で組織再編がなければ損金経理額のうち取得価額合計÷36×年度月数が限度です（各年度12か月なら3年均等）。')
p='docs/genka/index.html'
r(p,'一括主体手続','<li><b>20万円未満</b> … <b>一括償却資産</b>として、耐用年数にかかわらず<b>3年で均等に</b>（毎年3分の1ずつ）償却できます。</li>','<li><b>20万円未満</b> … 個人の一括償却資産は、所定の対象所得・供用・選択・申告書への対象額と明細の添付・計算書類保存等の要件を満たす場合、<b>3年で均等に</b>（毎年3分の1ずつ）必要経費に算入します。10万円未満等の即時算入対象、所定リース資産、非主要業務の貸付資産は除きます（所得税法施行令139条）。</li>')
r(p,'期限','取得の期限は<b>令和11年3月31日</b>まで、対象は常時使用する従業員<b>400人以下</b>の中小企業者等（特定法人は300人以下）です。','取得・供用の期限は<b>令和11年3月31日</b>までです。令和8年4月1日以後取得分の従業員上限は<b>400人以下</b>、同日前取得分は500人以下で、特定法人は改正前後とも300人以下です。法人は供用年度の全額損金経理と資格・対象除外等も確認します。')
p='docs/assets/genka_core.js'
r(p,'資格','const chushoMangan = kakuju ?','const peopleLimit = kakuju ? S.chusho_jugyoin : S.chusho_jugyoin_kyu;\n    const chushoMangan = kakuju ?')
r(p,'資格','従業員${S.chusho_jugyoin}人以下','従業員${peopleLimit}人以下。法人の特定法人は${S.chusho_jugyoin_tokutei_hojin}人以下')
# This tool calculates individual income tax; make that scope explicit in explanatory notes.
r(p,'一括主体手続','（この計算とは別の取扱いです）。','（個人の所得税の取扱い。対象所得・供用・選択・申告明細添付・計算書類保存等が条件で、即時算入対象を一括償却に重複適用せず、所定リース・非主要業務の貸付資産等も除きます。この計算とは別の取扱いです）。')
out.write_text(json.dumps(edits,ensure_ascii=False,indent=2)+'\n')
p=Path('tests/test_shogaku_tokurei.mjs');s=p.read_text();start=s.index('// 旧取得・新供用でも'); extra=s[start:];s=s[:start];s=s.replace('console.log(`\\n${pass} passed, ${fail} failed`);',extra+'\nconsole.log(`\\n${pass} passed, ${fail} failed`);');p.write_text(s)
p=Path('tests/conditions/genka_core.json');d=json.loads(p.read_text());d['conditions'].append(dict(id='small-asset-employee-acquisition-date',statute='https://laws.e-gov.go.jp/law/332CO0000000043',disposition='input',input_ids=['acqyear','acqmonth'],cases=['少額特例の従業員上限 2026-03取得は500人','少額特例の従業員上限 2026-04取得は400人']));p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
