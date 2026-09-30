from pathlib import Path
import json,re
for slug,old,new in [('kifukin-kojo','結論：経路は寄付先で決まる','寄附先と控除の適用関係'),('shunyu-shotoku-chigai','結論 — 4つの数を1つの設例で並べる','収入・所得・課税所得を設例で比較')]:
 p=Path(f'docs/column/{slug}/index.html');s=p.read_text().replace(old,new);p.write_text(s)
p=Path('docs/iryohi/index.html');s=p.read_text().replace('<p style="margin-top:12px">くわしくは','<h2 id="references-share">参照先と共有</h2>\n  <p style="margin-top:12px">くわしくは');p.write_text(s)
p=Path('docs/embed/iryohi/index.html');s=p.read_text();s=s.replace('<label for="shunyu">','<p id="salary-scope">この画面は給与所得のみの人が対象です。給与以外の所得がある人は総所得金額等を使って申告書等で計算してください。</p>\n<label for="shunyu">');p.write_text(s)
# Source-based static tests keep checking the corrected formula and comparison amount.
p=Path('tests/test_iryohi_hayami.mjs');s=p.read_text().replace('/医療費 − 補填金 − 足切り/','/医療費 − 対象医療費を限度とする補填金 − 足切り/').replace('/所得税率 ＋ 10%/','/所得税率×1.021＋10%/');p.write_text(s)
p=Path('tests/break_iryohi_hayami.mjs');s=p.read_text().replace('"<td>¥8,610</td><td>¥5,700</td>"','"<td>¥5,700</td><td>¥5,700</td>"').replace('"<td>¥8,610</td><td>¥8,610</td>"','"<td>¥5,700</td><td>¥8,610</td>"').replace('"戻り<b>¥4,042</b>です。", "戻り<b>¥5,000</b>です。"','"合計¥4,042の軽減目安", "合計¥5,000の軽減目安"');p.write_text(s)
# Register law-changing conditions and their executable boundaries.
p=Path('tests/conditions/_status.json');d=json.loads(p.read_text());d['pending'].remove('iryohi_core');p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
conditions=[
 {'id':'medical-cost-compensation','statute':'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm','disposition':'input','input_ids':['iryohi','hoten','hotenTaisho'],'cases':['r16補填対象未入力','r16補填超過を他の医療費から引かない']},
 {'id':'salary-threshold','statute':'https://laws.e-gov.go.jp/law/340AC0000000033','disposition':'input','input_ids':['shunyu'],'cases':['r16給与2971999円の足切り','r16給与2972000円の足切り','r16給与160万円は所得税0']},
 {'id':'rate-edges','statute':'https://laws.e-gov.go.jp/law/340AC0000000033','disposition':'input','input_ids':['zeiritsu'],'cases':['r16税率19500000','r16税率19500001']},
 {'id':'salary-only','statute':'https://laws.e-gov.go.jp/law/340AC0000000033','disposition':'out_of_scope','scope_selector':'#shunyu-hint','scope_text':'税引き前・賞与込みの給与収入です。この画面は給与所得のみの人が対象です。給与以外の所得がある人は総所得金額等を使って申告書等で計算してください。','cases':['r16給与2971999円の足切り']},
]
Path('tests/conditions/iryohi_core.json').write_text(json.dumps({'version':1,'core':'iryohi_core','page':'docs/iryohi/index.html','priority_evidence':'r16/t14-a','conditions':conditions,'default_cases':['r16HTML初期値は計算不能']},ensure_ascii=False,indent=2)+'\n')
p=Path('tests/stale_values.json');d=json.loads(p.read_text())
for id,value,context,correct,reason,source in [
 ('r16-iryohi-8610','8,610','57,000|医療費','5,700円','令和8年分の給与収入160万円のみは基礎控除104万円で所得税0。57000円控除の住民税軽減目安は5700円。','https://laws.e-gov.go.jp/law/332AC0000000026'),
 ('r16-iryohi-298','298万円','足切り|5%','2,972,000円','給与所得のみの足切り切替は別表第五により2972000円。','https://laws.e-gov.go.jp/law/340AC0000000033'),
 ('r16-shunyu-annual','528,840円','社会保険|年額|課税所得','530,000円','年度料率を12倍した528840円を暦年の社会保険料としない。設例は年中の実支払額を530000円と仮定。','https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf')]:
 d['entries'].append({'id':id,'value':value,'context':context,'window':120,'stale_from':'2026-10-01','allow_near':'旧|誤り|改定前|修正前','reason':reason,'source':source,'allow_pages':{},'correct':correct})
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
