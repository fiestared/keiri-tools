import re
s = open('tools/gen_index_sitemap.mjs', encoding='utf-8').read()
i = s.index('const CATEGORIES')
c = s[i:]
names = [(m.start(), m.group(1)) for m in re.finditer(r'name: "([^"]+)"', c)]
for slug in ['mimoto-hosho', 'rishokuhyo', 'roudou-joken-tsuchisho', 'kounenrei-kyushokusha-kyufukin']:
    try:
        j = c.index('"%s"' % slug)
    except ValueError:
        print(slug, '→ 未登録')
        continue
    prev = [n for p, n in names if p < j][-1]
    print(slug, '→', prev)
