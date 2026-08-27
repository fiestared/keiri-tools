"""記事の引用照合用コーパスを作る。

★申し送り1765: check_quotes.law_text() は children を持つノードにしか降りず、
素の文字列値は読み飛ばす。必ず {"law_full_text": {"children": [text]}} の形にする。
★作ったら必ず「何字か」を印字して見る（空コーパスのまま緑に見える経路を潰すため）。
"""
import json

SRC = ["tools/tmp_shogai_arts_0827.json", "tools/tmp_shogai_arts2_0827.json"]
OUT = "tools/tmp_shogai_corpus_0827.json"


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


parts = []
for path in SRC:
    d = json.load(open(path))
    for k, v in d.items():
        buf = []
        walk(v.get("law_full_text", v), buf)
        t = "".join(buf)
        print(k.ljust(16), str(len(t)).rjust(6), "字")
        if len(t) < 50:
            raise SystemExit("★短すぎる。抽出が壊れている: " + k)
        parts.append(t)

corpus = "\n".join(parts)
print("---")
print("合成コーパス", len(corpus), "字")
json.dump({"law_full_text": {"children": [corpus]}},
          open(OUT, "w"), ensure_ascii=False)
print("saved", OUT)
