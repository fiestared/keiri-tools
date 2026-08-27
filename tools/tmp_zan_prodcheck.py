import re

h = open('tools/tmp_zan_prod.html', encoding='utf-8', errors='replace').read()

title = re.search(r'<title>(.*?)</title>', h, re.S).group(1)
ogt = re.search(r'og:title" content="(.*?)"', h, re.S).group(1)
h1 = re.sub(r'<[^>]+>', '', re.search(r'<h1>(.*?)</h1>', h, re.S).group(1))
headline = re.search(r'"headline": "(.*?)"', h, re.S).group(1)

print('title    :', title)
print('og:title :', ogt)
print('一致(title/og):', title == ogt)
print('h1       :', h1)
print('headline :', headline)
print('一致(h1/headline):', h1 == headline)

for w in ['勘定科目内訳明細書', '2,200円', '当行制定外書式', 'お客さま指定書式',
          '相続財産残高証明書', '百五十万円', '既経過利子', '第一号に掲げるものに係る',
          '定期郵便貯金', '440円', '770円', '880円', '550円']:
    print(f'  {w}: {h.count(w)}回')
