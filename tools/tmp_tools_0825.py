import re
import glob

for f in sorted(glob.glob('docs/*/index.html')):
    d = f.split('/')[1]
    if d in ('column', 'assets', 'nenshu', 'hojokin', 'ext', 'about', 'embed'):
        continue
    h = open(f, encoding='utf-8').read()
    m = re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S)
    t = re.sub(r'<[^>]+>', '', m.group(1)).strip()[:46] if m else ''
    print(d.ljust(26), t)
