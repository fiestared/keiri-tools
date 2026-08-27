#!/usr/bin/env python3
"""URLを取り、meta charset を見てから decode して grep する（iconv が許可外・2026-08-25 第24便）。

  python3 tools/tmp_get_0825.py <URL> [語] [前後の字数]
"""
import re
import sys
import urllib.request

url = sys.argv[1]
word = sys.argv[2] if len(sys.argv) > 2 else None
ctx = int(sys.argv[3]) if len(sys.argv) > 3 else 120

req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
raw = urllib.request.urlopen(req, timeout=30).read()
m = re.search(rb"charset=[\"']?([A-Za-z0-9_-]+)", raw[:4000])
enc = (m.group(1).decode() if m else "utf-8").lower()
if enc in ("shift_jis", "sjis", "x-sjis", "shift-jis"):
    enc = "cp932"
print(f"# charset={enc} bytes={len(raw)}", file=sys.stderr)
text = raw.decode(enc, "replace")
if not word:
    print(text)
else:
    for mm in re.finditer(re.escape(word), text):
        print(text[max(0, mm.start() - ctx):mm.end() + ctx].replace("\n", " "))
        print("---")
