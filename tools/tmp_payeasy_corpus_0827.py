import json, subprocess

PAGES = [
    "/tmp/pe_top.html",
    "/tmp/pe_howto.html",
    "/tmp/pe_faq.html",
    "/tmp/nta_nofu.html",
    "/tmp/nta_shudan.html",
]

parts = []
for p in PAGES:
    out = subprocess.run(
        ["python3", "/Users/masahiroyasu/Scripts/keiri-tools/tools/read_html.py", p],
        capture_output=True, text=True).stdout
    print(p, len(out))
    parts.append(out)

corpus = "".join(parts)
print("corpus chars =", len(corpus))
# law_text() は "children" を持つノードだけ降りる。素の文字列値は読み飛ばされるので
# （実測: corpus 0字 → bq1 が 0/31 で落ちた）、children にぶら下げた形で書く。
json.dump({"law_full_text": {"children": [corpus]}},
          open("/tmp/pe_corpus.json", "w"), ensure_ascii=False)
