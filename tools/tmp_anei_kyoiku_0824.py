#!/usr/bin/env python3
"""安全衛生教育（雇入れ時・特別・職長）を条文で確かめる（2026-08-24 第15便）。

★申し送り1425: md5 は**本文（law_full_text）だけ**に当てる。応答エンベロープを
  丸ごと md5 すると revision_info が同居するので**全リビジョンが「★変更」**になる。
★申し送り1424: 「罰則が無い」を言うなら罰則条文の列挙を**全数**当たる。将来版も当たる。
使い方:
    python3 tools/tmp_anei_kyoiku_0824.py diff        # 現行と将来版で条文の md5 を比べる
    python3 tools/tmp_anei_kyoiku_0824.py old <rev_id> <elm...>   # 過去版の条文を読む
"""
import hashlib
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "法": "347AC0000000057",
    "令": "347CO0000000318",
    "規則": "347M50002000032",
}
TARGETS = {
    "法": ["Article_59", "Article_60", "Article_60_2", "Article_119", "Article_120"],
    "令": ["Article_19"],
    "規則": ["Article_35", "Article_36", "Article_40"],
}


def fetch(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))


def text_of(node):
    out = []
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for x in node:
            out.append(text_of(x))
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("tag", "attr"):
                continue
            out.append(text_of(v))
    return "".join(out)


def revisions(law_id):
    d = fetch(f"{BASE}/law_revisions/{law_id}")
    items = d.get("revisions") or []
    if not items:
        raise SystemExit("★測定不能: revisions が空")
    return sorted(
        ((r.get("law_revision_id"), r.get("amendment_enforcement_date"),
          r.get("current_revision_status")) for r in items),
        key=lambda x: x[1] or "")


def art_text(rev_id, elm):
    """条文の**本文だけ**を返す。取得できなければ None（0字と混ぜない）。"""
    try:
        d = fetch(f"{BASE}/law_data/{rev_id}?elm={elm}")
    except Exception as e:
        print(f"    ★取得失敗（測定不能）: {elm} {e}")
        return None
    body = d.get("law_full_text")
    if body is None:
        return None
    return text_of(body)


def diff():
    for name, lid in LAWS.items():
        revs = [(r, d, s) for r, d, s in revisions(lid)
                if s in ("CurrentEnforced", "UnEnforced")]
        base = [x for x in revs if x[2] == "CurrentEnforced"][0]
        print(f"=== {name} 現行 {base[1]} ===")
        for elm in TARGETS[name]:
            b = art_text(base[0], elm)
            if b is None:
                print(f"  {elm}: ★現行が取れない＝比較不能")
                continue
            bh = hashlib.md5(b.encode()).hexdigest()[:10]
            print(f"  {elm}: 現行 {len(b)}字 {bh}")
            for rid, date, _ in revs:
                if rid == base[0]:
                    continue
                t = art_text(rid, elm)
                if t is None:
                    continue
                h = hashlib.md5(t.encode()).hexdigest()[:10]
                mark = "同一" if h == bh else "★変更"
                print(f"      {date} {mark} {len(t)}字 {h}")


if __name__ == "__main__":
    if sys.argv[1] == "diff":
        diff()
    else:
        rid = sys.argv[2]
        for elm in sys.argv[3:]:
            t = art_text(rid, elm)
            print(f"----- {elm} ({'測定不能' if t is None else str(len(t)) + '字'}) -----")
            print(t)
