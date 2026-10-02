from pathlib import Path
import json,collections,re,subprocess
E=Path('review-evidence/auto20261002-t8-q08461'); a=json.loads((E/'segment-adjudication.json').read_text())['segments']; ss={s['id']:s for s in json.loads((E/'segments.json').read_text())};u=[s for s in a if s['decision']=='unresolved']
topics=[
('SMTB個人のBaaS・提携条件',lambda r:'BaaS' in r,'#kojin・#bank-sbi-netの料金セル、#gyakubikiの77円行、個人料金の要約、#chuui、FAQ無料回数・JSON-LD、fee_table.jsonの個人行、bank_presets.jsの注記。','smtb'),
('SMTB法人10月改定の対象・予約・提携条件',lambda r:'100円は2026年10月1日開始' in r or '提携サービス' in r,'#hojin・#bank-sbi-netの料金セル/倍率/改定注記、#gyakubiki100円行、法人レンジ・まとめ・最安FAQ・JSON-LD、末尾改定注記、fee_table.json法人行・bank_presets.js。','smtb-new,smtb-biz'),
('PayPay個人の本人名義SMBC宛無料',lambda r:'カナ同一名義' in r,'#kojin・#bank-paypayの個人セル、#gyakubiki145円行、銀行別の無料範囲注記、fee_table.json・bank_presets.js。','paypay'),
('ゆうちょ他行非居住者宛の利用経路',lambda r:'他行の非居住者' in r,'#kojin・#bank-yuchoの個人セル、#gyakubiki165円行、#keiroネット欄、fee_table.json・bank_presets.js。','yucho'),
('りそなグループ4行宛の別料金',lambda r:'グループ' in r,'#kojin・#hojin・#bank-resona・#bank-saitama-resonaのセル/倍率、#gyakubiki165/605円行、#keiro、605円FAQ・JSON-LD、fee_table.json・bank_presets.js。','resona,saitama,resona-biz,saitama-biz'),
('auじぶんの三菱UFJ宛無料',lambda r:'auじぶん本支店' in r,'#kojin・#bank-au-jibunの個人セル、#gyakubiki204円行、fee_table.json・bank_presets.js。','au'),
('SMBC個人のポイントパック本人宛無料条件',lambda r:'SMBCポイントパック' in r,'#kojin・#bank-smbcの個人セル/倍率/例外注記、#gyakubiki154/220円行、#keiroネット欄、fee_table.json・bank_presets.js。','smbc'),
('三菱UFJの信託・auじぶん宛区分',lambda r:'三菱UFJ信託' in r,'#kojin・#bank-mufg個人セル/倍率、法人比較段落、#gyakubiki154/220円行、#keiroネット/ATM欄・法人ATM注記、fee_table.json・bank_presets.js。','mufg'),
('福岡グループ5行の宛先区分',lambda r:'熊本' in r,'#kojin・#hojin・#bank-fukuokaのセル/倍率、#gyakubiki220/330/440/550円行、fee_table.json・bank_presets.js。','fukuoka,fukuoka-biz'),
('レンジ・最安・年間差額の比較範囲',lambda r:'通常単価' in r or '端点' in r or '年120件' in r or '要約はネット' in r,'個人/法人表の直後、#gapと目次、#matome、最安FAQとJSON-LD。','gmo,gmo-biz,mufg,fukuoka,smtb-new'),
('グラフと差引例の銀行・サービス名',lambda r:'グラフ' in r or '30,200' in r,'#kyoukai図のSVG aria-label・text・figcaption、#nazeの請求額30,200円の例。','mufg,gmo-biz'),
('ATM振込単価と利用料・現金上限',lambda r:'ATM' in r,'#keiroのUFJ/SMBCの当行カード・現金セル、同行宛callout、法人ATM比較、別途利用料と本人確認/現金上限の注記。','mufg,smbc'),
('ゆうちょ利用口座間と受入明細票',lambda r:'利用口座間' in r,'#keiroの振替ネットセル、#matomeのゆうちょ振替説明。','yucho'),
('ことらの対応金融機関限定',lambda r:'対応金融機関' in r,'#kotora見出しと目次。','smbc,mufg'),
]
sec=json.loads((E/'source-sections.json').read_text());groups=[]; covered=set()
# Multi-topic units intentionally appear in every applicable issue, never drop a second condition.
for title,test,where,ks in topics:
 ids=[s['id'] for s in u if test(s['reason'])];covered.update(ids)
 if ids:groups.append(dict(topic=title,ids=ids,locations=where,refs=[f'corpus/{sec[k][0]}:{sec[k][1]}-{sec[k][2]}' for k in ks.split(',')]))
left=[s for s in u if s['id'] not in covered];assert not left,[(s['id'],s['reason']) for s in left]
(E/'issue-map.json').write_text(json.dumps(groups,ensure_ascii=False,indent=2)+'\n')
lines=[]
for g in groups:
 lines+=['### '+g['topic'],'','- 単位ID: '+', '.join(g['ids']),'- 修正箇所: '+g['locations']+' 台帳の該当claims/covers/scope/exceptions/source_quote/corpus_refも更新。','- 根拠: '+'; '.join(g['refs']),'']
(E/'issue-report.md').write_text('\n'.join(lines))
print(len(groups),'論点',len(covered),'単位')
