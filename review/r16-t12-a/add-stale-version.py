import json
from pathlib import Path
p=Path('tests/stale_values.json');d=json.loads(p.read_text());id='r16-t12-toroku-source-versions'
if not any(x['id']==id for x in d['entries']):
 d['entries'].append(dict(id=id,value='租税特別措置法＝2026年6月25日施行版／同施行令＝2026年5月22日施行版',context='現行版',window=150,stale_from='2026-10-01',allow_near='旧記述|旧版|訂正前',reason='r16/t12-a固定正本は措法2026-08-12施行版・措令2026-07-31施行版。旧引用版を現行版と表示しない。',source='https://laws.e-gov.go.jp/law/332AC0000000026',allow_pages={},correct='2026年8月12日'))
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=Path('review/r16-t12-a/report-body.txt');s=p.read_text().replace('旧文・旧日付6件','旧文・旧日付7件').replace('相続以外一律5倍）。','相続以外一律5倍、登録免許税ページの旧引用版）。');p.write_text(s)
