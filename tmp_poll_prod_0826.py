"""本番デプロイの到達確認。申し送り1637の順序（sitemap → 200 → 本文照合）で見る。"""
import time
import urllib.request

SLUG = "taishokukin-soba"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "keiri-tools-deploy-check"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "replace")


for i in range(1, 25):
    try:
        st, body = get("https://keiri-tools.com/sitemap.xml")
    except Exception as e:
        print("poll %d: %s" % (i, e), flush=True)
        time.sleep(20)
        continue
    if SLUG in body:
        print("✓ sitemap にヒット（%d回目・約%d秒）" % (i, (i - 1) * 20), flush=True)
        break
    print("poll %d: まだ" % i, flush=True)
    time.sleep(20)
else:
    raise SystemExit("✘ sitemap に出てこない")

st, html = get("https://keiri-tools.com/column/%s/" % SLUG)
print("本番 HTTP %d / %d バイト" % (st, len(html.encode("utf-8"))))
open("/tmp/prod_taishokukin_soba.html", "w", encoding="utf-8").write(html)
