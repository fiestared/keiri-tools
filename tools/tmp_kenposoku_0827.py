import json, re, urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://laws.e-gov.go.jp/api/2/law_data/414M60000100159"
r = urllib.request.Request(url, headers=UA)
with urllib.request.urlopen(r, timeout=120) as f:
    b = f.read()
print("bytes", len(b))
d = json.loads(b.decode("utf-8"))
json.dump(d, open("tools/tmp_kenposoku_0827.json", "w"), ensure_ascii=False)


def walk(node, out):
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for x in node:
            walk(x, out)
    elif isinstance(node, dict):
        if "children" in node:
            walk(node["children"], out)
            return
        for v in node.values():
            walk(v, out)


buf = []
walk(d.get("law_full_text", d), buf)
txt = "".join(buf)
print("chars", len(txt))
open("tools/tmp_kenposoku_0827.txt", "w").write(txt)
for m in re.finditer(r"三百六十", txt):
    print("---")
    print(txt[max(0, m.start() - 400):m.start() + 200])
