"""本番デプロイの到達を待つだけの使い捨てポーラ（2026-08-26 第1便）。

★404 が先で 200 が後なら「デプロイ待ち」であって否定キャッシュではない、を確かめるためのもの。
"""
import sys
import time
import urllib.request

URL = "https://keiri-tools.com/column/kigyo-ban-furusato-nozei/"


def code():
    try:
        with urllib.request.urlopen(URL, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:  # noqa: BLE001
        return "ERR:%s" % e


for i in range(45):
    c = code()
    print("try %2d  %s" % (i + 1, c), flush=True)
    if c == 200:
        print("DEPLOYED")
        sys.exit(0)
    time.sleep(20)
print("TIMEOUT")
sys.exit(1)
