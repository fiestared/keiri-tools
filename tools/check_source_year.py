#!/usr/bin/env python3
"""年度が刻印された記事について、一次資料が「次の年度版」を出していないかを確かめる。

    python3 tools/check_source_year.py            # 監視できる分を全部見る
    python3 tools/check_source_year.py --json
    python3 tools/check_source_year.py --slug gensen-zeigakuhyo-mikata

★なぜ在るか（2026-09-07 の実害）
--------------------------------
国税庁は **令和9年分 源泉徴収税額表を令和8年8月31日に公表**していた。
こちらが気づいたのは **9月7日**で、7日遅れ。競合はもっと早く、
mt-tax.com は改正が決まった直後の **2026-04-23** に防衛特別所得税の記事を出している。

原因は2つとも仕組みの側にあった:
  1. ARTICLE_SPEC の「書く前に需要を測る。月1,000検索未満は書かない」に忠実だと、
     **年度刻印の語は永久に候補にならない**。「源泉徴収税額表 令和9年」の需要は
     公表時点で実測0件で、需要が立つ頃には競合が数か月先行している。
     年度ものは「需要が立つ前に書く」のが正解で、規則が逆を強制していた。
  2. 一次資料の更新を見る計器が無かった。`site_changes.py` は自分のgitコミットしか見ていない。

実測した晒され量: title に「令和8年」を持つ自社ページは **82本**あり、
そのうち22本がBing表示を持ち、合計 **33,662表示/週 = サイト全体の33%**。
同じ見落としが最大82回起こりうる。

★fail-loud（[[fail-loud-on-generation-error]]）
  「まだ公表されていない(404)」と「確かめられなかった(通信失敗・URL未調査)」を**混ぜない**。
  未調査を「公表なし」に混ぜると、監視しているつもりで穴が空く。
  終了コード: 0=次の年度版なし / 3=次の年度版を発見（要対応） / 4=確認できなかったものがある
"""
import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REGISTRY = os.path.join(HERE, "source_year_registry.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 keiri-tools-source-check"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """リダイレクトを追わない。

    ★2026-09-07: 追っていたせいで偽陽性を出した。
      未公表の zeigakuhyo2028/01.htm は **HTTP 302** を返し、追った先の200を掴んで
      「令和10年分が公表済み」と報告した。**ページが取れた ≠ 正しいページが取れた**。
    """
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def probe(url: str, expect: str, timeout: int = 20):
    """(state, detail) を返す。state は 'found' / 'absent' / 'unknown'。

    expect（例「令和9年分」）が本文に現れることまで確かめる。
    存在するだけでは 'found' にしない（ソフト404・案内ページを掴むため）。
    """
    req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=timeout) as r:
            if r.status != 200:
                return "absent", f"HTTP {r.status}（未公表）"
            raw = r.read(200_000)
            enc = "cp932"
            head = raw[:2048].decode("ascii", "ignore").lower()
            if "utf-8" in head:
                enc = "utf-8"
            text = raw.decode(enc, "replace")
            if expect in text:
                return "found", f"HTTP 200 / 本文に「{expect}」あり"
            return "unknown", f"HTTP 200 だが本文に「{expect}」が無い（別ページの可能性）"
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            return "absent", f"HTTP {e.code}（リダイレクト＝未公表）"
        if e.code == 404:
            return "absent", "HTTP 404（未公表）"
        return "unknown", f"HTTP {e.code}"
    except Exception as e:  # 通信失敗を「未公表」に混ぜない
        return "unknown", f"{type(e).__name__}: {e}"


def wareki(y: int) -> str:
    return f"令和{y - 2018}年"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--slug", help="この slug だけ見る")
    args = ap.parse_args()

    reg = json.load(open(REGISTRY, encoding="utf-8"))
    entries = reg["entries"]
    if args.slug:
        entries = [e for e in entries if e["slug"] == args.slug]
        if not entries:
            print(f"ERROR: slug が登録にない: {args.slug}", file=sys.stderr)
            return 1

    results = []
    for e in entries:
        nxt = e["covers"] + 1
        if not e.get("url"):
            results.append({**e, "next_year": nxt, "state": "unregistered",
                            "detail": "URLパターン未調査（登録に url が無い）"})
            continue
        if not e.get("probe_next", True):
            results.append({**e, "next_year": nxt, "state": "skipped", "detail": "probe_next=false"})
            continue
        url = e["url"].format(y=nxt)
        state, detail = probe(url, f"{wareki(nxt)}分")
        results.append({**e, "next_year": nxt, "probe_url": url, "state": state, "detail": detail})

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        found = [r for r in results if r["state"] == "found"]
        unknown = [r for r in results if r["state"] in ("unknown", "unregistered")]
        absent = [r for r in results if r["state"] == "absent"]
        for r in found:
            print(f"🔴 次の年度版が出ている: {r['name']}（{r['source']}）")
            print(f"     自社は {wareki(r['covers'])}分をカバー / 一次資料は {wareki(r['next_year'])}分を公表済み")
            print(f"     {r['probe_url']}")
            print(f"     対象ページ: /{'column/' if not r['slug'].endswith(('choshu',)) else ''}{r['slug']}/")
        for r in absent:
            print(f"✅ まだ未公表: {r['name']} — {wareki(r['next_year'])}分は {r['detail']}")
        for r in unknown:
            print(f"⚠️  確認できていない: {r['name']} — {r['detail']}")
        print()
        print(f"発見 {len(found)} / 未公表 {len(absent)} / 確認不能 {len(unknown)}（登録 {len(results)}）")
        if unknown:
            print("★確認不能は『未公表』ではない。URLパターンを調べて登録に足すこと。")

    if any(r["state"] == "found" for r in results):
        return 3
    if any(r["state"] in ("unknown", "unregistered") for r in results):
        return 4
    return 0


if __name__ == "__main__":
    sys.exit(main())
