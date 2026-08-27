import urllib.request, re, sys

UA = dict()
UA["User-Agent"] = "Mozilla/5.0"
url = "https://keiri-tools.com/column/shiharai-tsuchisho/"
h = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode("utf-8")

checks = [
    ("title", "<title>支払通知書・仕入明細書とは｜買い手が作った書類で仕入税額控除する6つの記載事項</title>"),
    ("canonical", 'rel="canonical" href="https://keiri-tools.com/column/shiharai-tsuchisho/"'),
    ("GA4", "G-E742DSDHPD"),
    ("AdSense", "ca-pub-2635067516563578"),
    ("track.js", "assets/track.js"),
    ("FAQPage", '"@type": "FAQPage"'),
    ("Person著者", '"name": "Masahiro Yasu"'),
    ("tool-cta", 'class="tool-cta" href="../../invoice-bangou/"'),
    ("免責", "筆者は税理士ではありません"),
    ("法30条9項3号", "仕入明細書、仕入計算書その他これらに類する書類で課税仕入れの相手方の氏名又は名称"),
    ("令49条4項2号", "課税仕入れの相手方の氏名又は名称及び登録番号（法第五十七条の二第四項の登録番号をいう。第六項第一号において同じ。）"),
    ("令49条4項6号", "百十分の十（当該課税仕入れが他の者から受けた軽減対象課税資産の譲渡等に係るものである場合には、百八分の八）"),
    ("通達11-6-6(3)", "一定期間内に誤りのある旨の連絡がない場合には記載内容のとおりに確認があったものとする基本契約等を締結した場合における当該一定期間を経たもの"),
    ("通達11-6-7ただし書", "ただし、建設工事完了日において再受託業者が適格請求書発行事業者でなかった場合には"),
    ("通達11-6-7なお書き", "当該出来高検収書に記載された課税仕入れを行ったこととなり"),
    ("電帳法2条5号", "取引情報の授受を電磁的方式により行う取引をいう。"),
    ("電帳法7条", "及び法人税に係る保存義務者は、電子取引を行った場合には"),
    ("所法231条1項", "記載した支払明細書を、その支払を受ける者に交付しなければならない。"),
    ("被リンク先", "shiharai-tsuchisho"),
]
ng = 0
for name, needle in checks:
    ok = needle in h
    if not ok:
        ng += 1
    print(("OK " if ok else "NG "), name)

print("svg数", h.count("<svg"))
print("外部画像", len(re.findall(r'<img[^>]+src="http', h)))
print("blockquote", h.count("<blockquote>"))
print("h2", len(re.findall(r"<h2", h)))
print("=== NG %d / %d 項目 ===" % (ng, len(checks)))

back = urllib.request.urlopen(urllib.request.Request(
    "https://keiri-tools.com/column/gaichuhi-kyuyo-kubun/", headers=UA), timeout=40).read().decode("utf-8")
print("被リンク元(gaichuhi)にリンクあり:", '../shiharai-tsuchisho/' in back)
sys.exit(1 if ng else 0)
