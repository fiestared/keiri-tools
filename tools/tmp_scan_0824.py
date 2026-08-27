import json


def flat(o, out):
    if isinstance(o, dict):
        for k, v in o.items():
            flat(v, out)
    elif isinstance(o, list):
        for v in o:
            flat(v, out)
    elif isinstance(o, str):
        out.append(o)


def load(p):
    d = json.load(open(p))
    out = []
    flat(d.get('law_full_text', d), out)
    return ''.join(out)


files = [
    ('労働契約法', 'tools/tmp_roukeiho.txt'),
    ('労働基準法', 'tools/tmp_roukiho.txt'),
    ('労働安全衛生法', 'tools/tmp_anei.txt'),
    ('労働安全衛生規則', 'tools/tmp_aneisoku.txt'),
    ('過労死等防止対策推進法', 'tools/tmp_karoshi.txt'),
    ('民法', 'tools/tmp_minpo.txt'),
]
tot = 0
for n, p in files:
    s = load(p)
    tot += len(s)
    print(n, len(s), '過労死ライン=', s.count('過労死ライン'),
          '安全配慮義務=', s.count('安全配慮義務'))
print('total', tot)

s = load('tools/tmp_karoshi.txt')
i = s.find('ArticleTitle第二条')
print(repr(s[i:i + 700]))
