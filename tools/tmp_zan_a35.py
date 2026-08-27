import json


def walk(o, out):
    if isinstance(o, dict):
        for v in o.values():
            walk(v, out)
    elif isinstance(o, list):
        for v in o:
            walk(v, out)
    elif isinstance(o, str):
        out.append(o)


d = json.load(open('tools/tmp_zan_hojinkisoku35.json'))
out = []
walk(d, out)
t = ''.join(out)
i = t.find('（確定申告書の添付書類）')
if i < 0:
    i = t.find('第三十五条')
print(t[i:i + 1600])
