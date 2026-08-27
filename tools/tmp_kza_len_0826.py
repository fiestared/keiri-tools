"""記事の可視字数と title 長を測る。"""
import re, sys
p = sys.argv[1]
h = open(p, encoding="utf-8").read()
t = re.search(r"<title>(.*?)</title>", h, re.S).group(1)
body = re.sub(r"(?is)<(script|style|svg)[^>]*>.*?</\1>", " ", h)
body = re.sub(r"(?is)^.*?<article", "<article", body)
body = re.sub(r"(?is)</article>.*$", "", body)
vis = re.sub(r"<[^>]+>", "", body)
vis = re.sub(r"\s+", "", vis)
print("title %d字: %s" % (len(t), t))
print("可視 %d字" % len(vis))
