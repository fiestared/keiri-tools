import json, sys


def walk(o, out):
    if isinstance(o, dict):
        for v in o.values():
            walk(v, out)
    elif isinstance(o, list):
        for v in o:
            walk(v, out)
    elif isinstance(o, str):
        out.append(o)


d = json.load(open(sys.argv[1]))
out = []
walk(d, out)
print(''.join(out))
