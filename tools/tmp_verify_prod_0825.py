#!/usr/bin/env python3
"""本番HTMLの title/og:title/h1/headline の一致と、sitemap掲載を実測する（2026-08-25 第24便）。"""
import re
import urllib.request

U = "https://keiri-tools.com/column/hojin-jigyo-gaikyo-setsumeisho/"


def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8")


h = get(U)
print("bytes:", len(h))
print("title   :", re.search(r"<title>(.*?)</title>", h).group(1))
print("og:title:", re.search(r'og:title" content="(.*?)"', h).group(1))
print("h1      :", re.search(r"<h1>(.*?)</h1>", h).group(1))
print("headline:", re.search(r'"headline": "(.*?)"', h).group(1))
for w in ["35条1項5号", "事業等の概況に関する書類", "会社事業概況書", "百万円単位",
          "電帳法適用状況", "出資関係図", "75条の4"]:
    print("  %s: %d回" % (w, h.count(w)))
sm = get("https://keiri-tools.com/sitemap.xml")
print("sitemap掲載:", sm.count("hojin-jigyo-gaikyo-setsumeisho"), "件 /", len(sm), "バイト")
