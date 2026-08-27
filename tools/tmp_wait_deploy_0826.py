#!/usr/bin/env python3
"""本番sitemapに指定slugが載るまで待つ（申し送り1637: 404の否定キャッシュと区別するため）。"""
import sys, time, urllib.request

slug = sys.argv[1]
for i in range(40):
    try:
        xml = urllib.request.urlopen("https://keiri-tools.com/sitemap.xml", timeout=20).read().decode("utf-8")
        if slug in xml:
            print(f"SITEMAP_OK after {i} polls")
            sys.exit(0)
    except Exception as e:
        print(f"poll {i}: {e}")
    time.sleep(15)
print("SITEMAP_TIMEOUT")
sys.exit(1)
