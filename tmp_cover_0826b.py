import glob, re, sys
words = ["社宅", "借上社宅", "食事補助", "残業 食事", "健康診断", "人間ドック",
         "資格取得", "研修費", "日当", "出張旅費", "見舞金", "慶弔", "住宅手当",
         "食事代", "旅費規程", "結婚祝金", "出張手当"]
files = sorted(glob.glob("docs/**/index.html", recursive=True))
print("total pages:", len(files))
for w in words:
    body_hits, title_hits = [], []
    for f in files:
        s = open(f, encoding="utf-8", errors="replace").read()
        if w.replace(" ", "") in s.replace(" ", ""):
            body_hits.append(f)
            m = re.search(r"<title>(.*?)</title>", s, re.S)
            h1 = re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S)
            t = (m.group(1) if m else "") + " " + (h1.group(1) if h1 else "")
            if w.replace(" ", "") in t.replace(" ", ""):
                title_hits.append(f)
    print(f"{w}: body={len(body_hits)} title/h1={len(title_hits)} {title_hits[:4]}")
