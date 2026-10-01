from edit import *
p=ROOT/'docs/column/kotei-shisanzei/index.html';s=p.read_text()
for fn,needle in [('egov_chiho_350.txt','百分の一・七を超える税率で固定資産税を課する旨の条例を制定しようとするときは、当該市町村の議会において、当該納税義務者の意見を聴くものとする。'),('egov_chiho_351.txt','市町村は、同一の者について当該市町村の区域内におけるその者の所有に係る土地、家屋又は償却資産に対して課する固定資産税の課税標準となるべき額が土地にあつては三十万円、家屋にあつては二十万円、償却資産にあつては百五十万円に満たない場合においては、固定資産税を課することができない。')]:
 line=(RUN/'corpus'/fn).read_text().splitlines()[4 if '350' in fn else 3].strip();s=s.replace('<blockquote>'+needle+'</blockquote>','<blockquote>'+line+'</blockquote>')
p.write_text(s)
p=ROOT/'docs/toroku-menkyozei/index.html';s=p.read_text()
s=s.replace('>令和9年3月31日</text>','>新築・取得：令和9年3月31日</text>')
s=s.replace('その間の2年間は土地だけ軽減が使える','住宅は期限内取得後1年以内の登記も対象')
s=s.replace('所有権の保存（自分で新築して最初に登記する）','所有権の保存（自ら新築・未使用住宅を取得して最初に登記する）')
s=s.replace('<input aria-describedby="kigen-hint" type="date" id="tokiBi" value="2026-07-01">','<input aria-describedby="kigen-hint" type="date" id="tokiBi" value="2026-07-01">\n    <label for="shutokuBi">住宅の新築・取得日</label>\n    <input type="date" id="shutokuBi" value="2026-04-01">\n    <p class="hint">住宅軽減の取得期限と登記までの期間を判定します。日付入力がある場合は下の月数より優先します。</p>')
s=s.replace('tokiBi: $("tokiBi").value,','tokiBi: $("tokiBi").value,\n    shutokuBi: $("shutokuBi").value,')
s=s.replace('<b id="kigen-jutaku">${K.jutaku_kigen_hyoji}</b>まで、','<b id="kigen-jutaku">${K.jutaku_kigen_hyoji}</b>までの新築・取得と原則その後1年以内の登記が対象、')
s=s.replace('競落は建物の軽減は使えますが、','競落は住宅用家屋の要件を満たせば建物の軽減を使えますが、')
p.write_text(s)
# Inline replacements retain tags; clear empty emphasis nodes left by replacing a complete sentence.
for p in dict.fromkeys(x['page'] for x in json.load(open(RUN/'segments.json'))):
 f=ROOT/p;s=f.read_text();s=re.sub(r'<(b|strong|em)>(\s*)</\1>',r'\2',s);f.write_text(s)
