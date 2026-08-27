#!/usr/bin/env python3
"""404 が「0件」を意味するのかを対照実験で確かめる（測定失敗を答えと読まない）。"""
import json, urllib.request, urllib.parse, urllib.error

def probe(kw):
    url = ("https://laws.e-gov.go.jp/api/2/keyword?keyword="
           + urllib.parse.quote(kw) + "&limit=3")
    try:
        with urllib.request.urlopen(url, timeout=180) as r:
            d = json.loads(r.read().decode("utf-8"))
        return f"HTTP 200  total_count={d.get('total_count')}"
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}"
    except Exception as e:
        return f"ERR {e}"

cases = [
    ("熟慮期間", "本命：民法226,737字に0回だった語"),
    ("相続の放棄", "陽性対照：在ることが分かっている語"),
    ("限定承認", "陽性対照：在ることが分かっている語"),
    ("ヌルポインタ例外", "陰性対照：法令に在るはずのない語"),
    ("ズブロッカ蒸留法", "陰性対照：法令に在るはずのない語"),
]
for kw, note in cases:
    print(f"{kw:<12} {probe(kw):<28} … {note}")
