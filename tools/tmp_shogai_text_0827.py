import json, sys

d = json.load(open("tools/tmp_shogai_arts_0827.json"))


def walk(node, out):
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for x in node:
            walk(x, out)
    elif isinstance(node, dict):
        for k in ("children",):
            if k in node:
                walk(node[k], out)
                return
        for v in node.values():
            walk(v, out)


keys = sys.argv[1:] or list(d.keys())
for k in keys:
    if k not in d:
        print("== " + k + " : MISSING")
        continue
    buf = []
    walk(d[k].get("law_full_text", d[k]), buf)
    txt = "".join(buf)
    print("===== " + k + " (" + str(len(txt)) + "字) =====")
    print(txt)
    print()
