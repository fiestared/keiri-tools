import re
lines = open('tools/gen_index_sitemap.mjs', encoding='utf-8').read().split('\n')
start = next(i for i, l in enumerate(lines) if l.startswith('const ORDER'))
end = next(i for i, l in enumerate(lines[start:], start) if l.strip() == '];')
for i in range(start + 1, end):
    m = re.match(r'\s*"([a-z0-9-]+)",\s*//\s*(.{0,60})', lines[i])
    if not m:
        continue
    d = re.search(r'([\d,]+)/月', m.group(2))
    if d:
        v = int(d.group(1).replace(',', ''))
        if 4000 <= v <= 9000:
            print(i + 1, v, m.group(1))
