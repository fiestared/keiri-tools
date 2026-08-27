import re, sys

h = open('tools/tmp_zan_resona4.html', encoding='utf-8', errors='replace').read()
i = h.find('残高証明書発行手数料')
seg = h[max(0, i - 4000):i + 3000]
rows = re.findall(r'<tr[^>]*>.*?</tr>', seg, re.S)
for r in rows:
    cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)
    out = []
    for c in cells:
        txt = re.sub(r'<[^>]+>', '', c).strip().replace('\n', '')
        out.append(txt)
    spans = re.findall(r'rowspan="(\d+)"', r)
    if any(('残高証明' in c) or ('440' in c) or ('880' in c) or ('法人' in c) for c in out):
        print(spans, out)
