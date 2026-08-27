#!/usr/bin/env python3
"""本番の sitemap.xml に kogitte が現れるまで15秒間隔で照会し、現れたら記事URLを実測する。

★「出たことにする」のではなく、反映を捕まえてから記事を叩く（申し送り1494）。
"""
import urllib.request
import time
import re

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}


def get(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25)
    return r.getcode(), r.read()


found = False
for i in range(20):
    try:
        code, body = get("https://keiri-tools.com/sitemap.xml?cb=%d" % (i,))
        t = body.decode("utf-8", "ignore")
        n = t.count("<loc>")
        if "/column/kogitte/" in t:
            print("反映 %d回目 (URL %d件)" % (i + 1, n))
            found = True
            break
        print("未反映 %d回目 (URL %d件)" % (i + 1, n))
    except Exception as e:
        print("ERR", e)
    time.sleep(15)

if not found:
    raise SystemExit("★sitemap に現れなかった。デプロイを確認すること（記事の確認はしない）")

code, body = get("https://keiri-tools.com/column/kogitte/?cb=verify")
html = body.decode("utf-8", "ignore")
print("HTTP", code, "bytes", len(body))

CHECKS = [
    ("title", "<title>小切手とは｜書き方・線引・先日付・有効期限を小切手法の条文で</title>"),
    ("canonical", 'rel="canonical" href="https://keiri-tools.com/column/kogitte/"'),
    ("AdSense", "ca-pub-2635067516563578"),
    ("GA4", "G-E742DSDHPD"),
    ("FAQPage", '"@type": "FAQPage"'),
    ("og:title", 'property="og:title"'),
    ("小3条ただし書", "此ノ規定ニ従ハザルトキト雖モ証券ノ小切手タル効力ヲ妨ゲズ"),
    ("小1条本文", "小切手ニハ左ノ事項ヲ記載スベシ"),
    ("小2条1項", "前条ニ掲グル事項ノ何レカヲ欠ク証券ハ小切手タル効力ヲ有セズ"),
    ("小4条", "小切手ハ引受ヲ為スコトヲ得ズ"),
    ("小5条3項", "受取人ノ記載ナキ小切手ハ之ヲ持参人払式小切手ト看做ス"),
    ("小6条3項", "小切手ハ振出人ノ自己宛ニテ之ヲ振出スコトヲ得"),
    ("小12条", "振出人ハ支払ヲ担保ス"),
    ("小28条2項", "振出ノ日附トシテ記載シタル日ヨリ前ニ支払ノ為呈示シタル小切手ハ呈示ノ日ニ於テ之ヲ支払フベキモノトス"),
    ("小29条1項", "国内ニ於テ振出シ且支払フベキ小切手ハ十日内ニ支払ノ為之ヲ呈示スルコトヲ要ス"),
    ("小32条2項", "支払委託ノ取消ナキトキハ支払人ハ期間経過後ト雖モ支払ヲ為スコトヲ得"),
    ("小33条", "振出ノ後振出人ガ死亡シ意思能力ヲ喪失シ"),
    ("小37条5項", "線引又ハ被指定銀行ノ名称ノ抹消ハ之ヲ為サザルモノト看做ス"),
    ("小38条1項", "一般線引小切手ハ支払人ニ於テ銀行ニ対シ又ハ支払人ノ取引先ニ対シテノミ之ヲ支払フコトヲ得"),
    ("小51条1項", "呈示期間経過後六月ヲ以テ時効ニ罹ル"),
    ("小55条1項", "支払保証ヲ為シタル支払人ハ呈示期間ノ経過前ニ小切手ノ呈示アリタル場合ニ於テノミ"),
    ("小61条", "本法ニ規定スル期間ニハ其ノ初日ヲ算入セズ"),
    ("附則71条", "五千円以下ノ過料ニ処ス"),
    ("附則72条", "其ノ受ケタル利益ノ限度ニ於テ償還ノ請求ヲ為スコトヲ得"),
    ("印基通17-18", "小切手等の有価証券を受け取る場合の受取書で"),
    ("指定省令", "指定する手形交換所は、電子交換所（一般社団法人全国銀行協会が設置するもの）とする。"),
    ("厚労省令別表1", "現金、他人振出当座小切手、送金小切手、郵便振替小切手"),
    ("75219字", "75,219字"),
    ("173686字", "173,686字"),
    ("SVG2枚", None),
    ("CTA", 'class="tool-cta" href="../../inshi/"'),
    ("被リンク先", 'href="../shoguchi-genkin/"'),
]

ng = 0
for name, needle in CHECKS:
    if needle is None:
        ok = html.count("<svg") == 2
    else:
        ok = needle in html
    if not ok:
        ng += 1
    print(("  OK  " if ok else "  ✗NG ") + name)

print("本文照合 %d/%d" % (len(CHECKS) - ng, len(CHECKS)))

code2, body2 = get("https://keiri-tools.com/column/tegata-toha/?cb=verify")
h2 = body2.decode("utf-8", "ignore")
print("tegata-toha HTTP", code2, "被リンク:", 'href="../kogitte/"' in h2)
