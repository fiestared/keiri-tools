#!/usr/bin/env python3
"""本番に記事が出るまで待つ。対照URLは推測せず sitemap/実ディレクトリから取る(申し送り1749)。"""
import time
import urllib.request

NEW = "https://keiri-tools.com/column/shobyo-teate-kin-shinseisho/"
# 対照: 実在が確実なもの(トップ + 前便の記事。slug はディレクトリ一覧で確認済み)
CONTROLS = [
    "https://keiri-tools.com/",
    "https://keiri-tools.com/column/kyuyo-shiharai-jimusho-kaisetsu/",
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "keiri-tools-deploy-check"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)


for i in range(40):  # 最大 40 x 20s = 13分
    code, body = get(NEW)
    print(f"[{i:02d}] {time.strftime('%H:%M:%S')} 新記事 HTTP={code} bytes={len(body)}", flush=True)
    if code == 200 and "傷病手当金支給申請書" in body:
        print("✓ 本番に出た", flush=True)
        break
    time.sleep(20)
else:
    print("✗ 期限内に出なかった", flush=True)

print("--- 対照(推測でURLを作らない) ---", flush=True)
for u in CONTROLS:
    c, _ = get(u)
    print(f"  HTTP={c}  {u}", flush=True)
