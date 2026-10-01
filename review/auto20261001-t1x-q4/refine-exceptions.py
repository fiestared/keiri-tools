import json
from pathlib import Path
notes={
 'fees':'原稿料・弁護士・税理士等は100万円超の部分が20.42%。司法書士・土地家屋調査士・海事代理士は1回の支払につき1万円控除後に10.21%。条件を省略して全報酬に一律10.21%とはしない。',
 'age':'特定親族は19歳以上23歳未満。令和8年分の生年月日範囲を併記し、源泉控除対象親族に含む特定親族は所得100万円以下。相互適用等で申告書に記載がない扱いの人は除く。',
 'disability':'16歳未満の基本人数と障害者・同居特別障害者加算を区別。合計所得58万円超100万円以下の特定親族には障害者加算をしない。',
 'bonus':'前月給与なし・前月給与が社会保険料等以下・控除後賞与が控除後前月給与の10倍超は月額表。乙欄の算出率に扶養人数や1,610円控除を使わない。月の整数倍払いでは月割額を使う。',
 'round':'No.2523の設例に限った端数処理の説明。例外計算全体の端数処理を定める一般則を新たに確認したとはしない。月額表は申告書の提出区分に応じて適用する。',
 'holiday':'納期限が土曜・休日なら休日明け。法律と政令がそれぞれ追加した休日の内訳は固定正本で確認できないため、修正文はその分担を断定しない。',
 'future':'令和9年分の表が改正されていることのみ確認。基礎控除改正との因果関係は主張せず、令和8年分と令和9年分の表を区別する。',
 'diff':'国税庁の公表設例に限った比較。任意の実額について月額表と電算機特例の差の上限や範囲を示したものではない。',
 'tax_round':'原稿料・弁護士・税理士等の所定報酬の式に限る。給与の税額表・電算機特例の端数処理とは区別し、No.2795と2798の注記を追加資料で確認。'}
for page in {u['page'] for u in json.load(open('review/auto20261001-t1x-q4/segments-after.json'))}:
 p=Path('claims')/(page[5:].removesuffix('/index.html')+'.json');d=json.loads(p.read_text())
 for c in d['claims']:
  if c.get('review_result')!='corrected_author_checked_pending_independent_review':continue
  url=c['source_url'];kind='fees'
  if url.endswith('/2795.htm'):kind='tax_round'
  elif url.endswith('/03.pdf'):kind='holiday'
  elif url.endswith('/16.pdf'):kind='diff'
  elif url.endswith('/15-16.pdf'):kind='bonus'
  elif url.endswith('/2523.htm'):kind='future' if '2027' in c['text'] else 'round'
  elif url.endswith('/19-22.pdf'):kind='age'
  elif url.endswith('/04.pdf'):kind='disability'
  c['exceptions']=notes[kind]
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
