#!/usr/bin/env python3
"""相続税法基本通達の取得経路を探す。★対照（当たるはずのURL）を必ず並べる（申し送り1601）。"""
import urllib.request, urllib.error

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                     "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")}
CANDS = [
    ("対照(法基通9-3)", "https://www.nta.go.jp/law/tsutatsu/kihon/hojin/09/09_03.htm"),
    ("相基通 sisan/sozoku/01", "https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku/01.htm"),
    ("相基通 sisan/sozoku/03", "https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku/03.htm"),
    ("相基通 sisan/sozoku_new/01", "https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku_new/01.htm"),
    ("財基通 hyoka_new/01", "https://www.nta.go.jp/law/tsutatsu/kihon/sisan/hyoka_new/01.htm"),
    ("相基通 souzoku/01", "https://www.nta.go.jp/law/tsutatsu/kihon/souzoku/01.htm"),
    ("相基通 sisan/01", "https://www.nta.go.jp/law/tsutatsu/kihon/sisan/01.htm"),
]
for name, url in CANDS:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
            final = r.geturl()
        mark = "★404へ" if "/error/404" in final else "OK"
        print("%-30s %s %8d bytes  %s  %s" % (name, r.status, len(body), mark, final))
    except urllib.error.HTTPError as e:
        print("%-30s HTTPError %s" % (name, e.code))
    except Exception as e:
        print("%-30s FAIL %s" % (name, e))
