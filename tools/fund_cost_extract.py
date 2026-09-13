#!/usr/bin/env python3
"""投資信託の「隠れコスト」を交付目論見書・交付運用報告書のPDFから抽出する。

★なぜ要るか: 投資家が目にする「信託報酬」は、実際の負担の一部でしかない。
  層はこうなっている（実測で確認した順）:

    1. 信託報酬（交付目論見書。税込年率。純資産総額による段階制のことがある）
    2. その他費用 → 1+2 = 総経費率（交付目論見書／運用報告書。年1回・対象期間つき）
    3. 売買委託手数料・有価証券取引税（★総経費率から明示的に除かれている）
    4. 外国源泉税（配当への課税）
    5. 為替ヘッジコスト（ヘッジありのみ。費用ではなく金利差として基準価額に効く）
    6. 借入コスト（レバレッジ型のみ）

  3〜6は総経費率に出てこない。**全部をまとめて捉える唯一の指標は、
  基準価額騰落率とベンチマーク騰落率の差（かい離）**で、これは運用報告書にある。

  ★かい離は必ずマイナスとは限らない。有価証券の貸付による品貸料が収益として計上されるため、
  コストを上回ってプラスになる年がある（実測: eMAXIS Slim 全世界株式は5期中3期がプラス）。
  「隠れコスト」には隠れ収益もある。記事でここを飛ばすと事実と違う。

使い方:
    python3 tools/fund_cost_extract.py --isin JP90C000H1T1            # ★楽天証券から2つのPDFを取って抽出（いちばん手が速い）
    python3 tools/fund_cost_extract.py --prospectus <交付目論見書.pdf> --report <交付運用報告書.pdf>
    python3 tools/fund_cost_extract.py --url-prospectus <URL> --url-report <URL> [--json out.json]

★PDFは必ず自分で取得して pdftotext で読む。要約器（WebFetch等）を通さないこと。
  政府・金融機関のページで「もっともらしい嘘」が返る事故が実際に起きている（ARTICLE_SPEC.md）。
"""
import argparse, json, re, subprocess, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def fetch(url: str, dest: Path) -> Path:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
        f.write(r.read())
    if dest.stat().st_size < 20_000:
        sys.exit(f"PDFが小さすぎる（{dest.stat().st_size}バイト）: {url}\n"
                 "★HTTP 200 でもエラーページのことがある。中身を見ること。")
    return dest


def fetch_rakuten(isin: str, kind: str, dest: Path) -> Path:
    """楽天証券が掲載している交付目論見書(prospectus)・運用報告書(invest)を ISIN で取る。
    ★ファンド詳細ページのリンクは javascript:showDoc(...) で、中身は display.asp への POST（2026-09-13 実測）。
      運用会社ごとにサイトを探すより確実で、10本すべて200で取れた。
    ★楽天証券に載っている運用報告書が、運用会社サイトの最新版より古いことがある。対象期間を必ず確かめる。"""
    body = urllib.parse.urlencode({"doc": f"{isin}_{kind}.pdf", "docType": kind}).encode()
    req = urllib.request.Request("https://www.rakuten-sec.co.jp/web/fund/scr/common/display.asp",
                                 data=body, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
        if "pdf" not in (r.headers.get("Content-Type") or ""):
            sys.exit(f"PDFではない応答（{r.headers.get('Content-Type')}）: {isin} {kind}")
        f.write(r.read())
    return dest


def text_of(pdf: Path) -> str:
    r = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True)
    if r.returncode != 0 or len(r.stdout) < 500:
        sys.exit(f"pdftotext が本文を取れなかった: {pdf}")
    # ★楽天投信のPDFは「騰落率」と「（％）」の間にバックスペース(\x08)が埋まっている（2026-09-13 実測）。
    #   制御文字を落とさないと行ラベルの正規表現が黙って外れ、騰落率が「未取得」になる。
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", r.stdout)


def num(s):
    try:
        return float(s.replace(",", ""))
    except (ValueError, AttributeError):
        return None


def _pct(x):
    """'0. 99' '0 982' のように小数点が空白に化けた値も読む（大和の運用報告書で実測）。"""
    if x is None:
        return None
    x = x.replace("．", ".").replace(" ", "").replace("　", "")
    return num(x)


def parse_prospectus(t: str) -> dict:
    out = {}
    flat1 = re.sub(r"[ 　]+", " ", t)
    # 信託報酬（税込年率）: 「年率0.05775％（税抜 年率0.0525％）」「年0.0561%（税抜0.051%）」「年率0.4334％（税抜0.394％）」
    m = re.search(r"年率?\s*([0-9]+\.[0-9]+)\s*[％%]\s*\n?\s*（税抜\s*(?:年率)?\s*([0-9]+\.[0-9]+)\s*[％%]）", flat1)
    if not m:  # 大和様式: 「運用管理費用 年率0.9845％ 〈別列の説明文〉\n（信託報酬） （税抜0.895％）」
        m = re.search(r"運用管理費用[^\n]{0,10}年率\s*([0-9]+\.[0-9]+)\s*[％%][\s\S]{0,160}?（税抜\s*([0-9]+\.[0-9]+)\s*[％%]）", flat1)
    if m:
        out["信託報酬_税込年率"] = num(m.group(1))
        out["信託報酬_税抜年率"] = num(m.group(2))
    tiers = re.findall(r"([0-9,]+億円[^\n]{0,20}の部分|[0-9,]+兆円[^\n]{0,20}の部分|[0-9,]+億円以上)\s+([0-9.]+)％", t)
    if tiers:
        out["信託報酬_段階"] = [{"区分": a.strip(), "税込年率": num(b)} for a, b in tiers]
    # 投資先（連動債券・投資信託証券等）の費用 — 総経費率の外にある層
    m = re.search(r"(?:パフォーマンス連動債券|投資対象とする[^\n]{0,20}|投資先ファンド)[^\n]{0,40}\n?[^\n]{0,40}?年率\s*([0-9.]+)\s*[％%]\s*程度", t)
    if m:
        out["投資先の費用_年率程度"] = num(m.group(1))
    m = re.search(r"実質的に負担する[\s\S]{0,40}?年率\s*([0-9.]+)\s*[％%]", t)
    if m:
        out["実質的な運用管理費用_概算"] = num(m.group(1))
    # 総経費率: MUFG の詳細値 → 丸めた表 → 大和の文章形
    m = re.search(r"([0-9.]+)％\s*〔内訳①運用管理費用：([0-9.]+)％、②その他費用：([0-9.]+)％〕", t)
    if m:
        out["総経費率"] = num(m.group(1)); out["総経費率_運用管理費用"] = num(m.group(2)); out["総経費率_その他費用"] = num(m.group(3))
        out["総経費率_精度"] = "詳細値"
    else:
        blk = re.search(r"総経費率[\s\S]{0,300}?([0-9]+\.[0-9]+)\s*[%％]\s+([0-9]+\.[0-9]+)\s*[%％]\s+([0-9]+\.[0-9]+)\s*[%％]", t)
        if blk:
            out["総経費率"] = num(blk.group(1)); out["総経費率_運用管理費用"] = num(blk.group(2)); out["総経費率_その他費用"] = num(blk.group(3))
            out["総経費率_精度"] = "表示桁数未満四捨五入（小数第2位）"
    flat = re.sub(r"\s+", "", t)
    m = re.search(r"(?:「当期間」|対象期間)[^0-9]{0,20}(\d{4})年(\d{1,2})月(\d{1,2})日～(\d{4})年(\d{1,2})月(\d{1,2})日", flat)
    if m:
        out["総経費率_対象期間"] = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}〜{m.group(4)}-{int(m.group(5)):02d}-{int(m.group(6)):02d}"
    m = re.search(r"購入時手数料\s*(ありません。|[^\n]{0,30}上限[^\n]{0,20}|[^\n]{2,40})", t)
    if m:
        v = m.group(1).strip()
        u = re.search(r"〈上限〉\s*([0-9.]+％)", t)
        out["購入時手数料"] = (v + (f"（上限{u.group(1)}）" if u and "上限" not in v else ""))[:60]
    m = re.search(r"信託財産留保額\s+(\S[^\n]{0,30})", t)
    if m:
        out["信託財産留保額"] = m.group(1).strip()
    m = re.search(r"(?:信託期間|償還日)\s+(無期限|\S[^\n]{0,24})", t)
    if m:
        out["信託期間"] = m.group(1).strip()
    m = re.search(r"(ＭＳＣＩ[ァ-ヶー・Ａ-ＺA-Za-z0-9（）\(\)、]{4,60}|MSCI[A-Za-z ]{4,40}|NYSEFANG\+[^、。]{0,30}|ＮＡＳＤＡＱ[^、。]{0,20}|NASDAQ100指数（[^）]{0,20}）|Ｓ＆Ｐ５００[^、。]{0,30}|S&P500[^、。]{0,30}|ＴＯＰＩＸ|日経平均株価)", flat)
    if m:
        out["指数_候補"] = m.group(1)
    if re.search(r"為替ヘッジは(原則として)?行な?いません|為替ヘッジを行な?いません|為替ヘッジ無しと同等|原則として為替ヘッジを行わない", flat):
        out["為替ヘッジ"] = "なし（明示）"
    elif re.search(r"為替変動リスクを低減するため、為替ヘッジを行な?(います|う)", flat):
        out["為替ヘッジ"] = "あり（明示）"
    else:
        out["為替ヘッジ"] = "要確認（PDFを目で見る）"
    out["ヘッジコストの記載"] = bool(re.search(r"金利差相当分がコスト", flat))
    out["レバレッジ"] = (re.search(r"値動きの([０-９0-9.]+)倍程度", flat) or [None, None])[1]
    out["品貸料_記載"] = "品貸料" in t
    return out


def _row_values(line: str):
    """騰落率の行から値の列を取る。'－' は欠損。大和様式の '66 3' '△46 1' は小数点落ちとして2トークンで1値。"""
    body = re.sub(r"^[^（(]*[（(]％[）)]", "", line)
    toks = body.split()
    if any("." in x for x in toks):
        return [None if x in ("－", "-", "─", "−") else num(x.replace("△", "-").replace("▲", "-")) for x in toks]
    vals, i = [], 0
    while i < len(toks):
        x = toks[i]
        if x in ("－", "-", "─", "−"):
            vals.append(None); i += 1; continue
        if i + 1 < len(toks) and re.fullmatch(r"\d", toks[i + 1]):
            neg = x.startswith(("△", "▲"))
            vals.append((-1 if neg else 1) * num(x.lstrip("△▲") + "." + toks[i + 1])); i += 2
        else:
            vals.append(num(x.replace("△", "-").replace("▲", "-"))); i += 1
    return vals


def parse_report(t: str) -> dict:
    out = {}
    flat = re.sub(r"\s+", "", t)
    m = re.search(r"作成対象期間[（(]?(\d{4})年(\d{1,2})月(\d{1,2})日[～〜](\d{4})年(\d{1,2})月(\d{1,2})日", flat)
    if m:
        out["運用報告書_対象期間"] = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}〜{m.group(4)}-{int(m.group(5)):02d}-{int(m.group(6)):02d}"
    m = re.search(r"ファンドの騰落率は、ベンチマークの騰落率（([0-9.\-]+)％）を([0-9.]+)％(上回り|下回り)", flat)
    m2 = re.search(r"当作成期のベンチマークの騰落率は(△?[0-9.]+)％、当ファンドの基準価額の騰落率は(△?[0-9.]+)％", re.sub(r"(\d)\s+(\d)", r"\1.\2", re.sub(r"[ 　]+", " ", t)).replace(" ", "").replace("\n", ""))
    if m2 and not m:
        b = num(m2.group(1).replace("△", "-")); f = num(m2.group(2).replace("△", "-"))
        out["当期_ベンチマーク騰落率"] = b; out["当期_基準価額騰落率"] = f; out["当期_かい離"] = round(f - b, 4)
    if m:
        out["当期_ベンチマーク騰落率"] = num(m.group(1))
        out["当期_かい離"] = round((1 if m.group(3) == "上回り" else -1) * num(m.group(2)), 4)
    # 基準の種類: ベンチマーク（連動目標）か参考指数（説明用）か
    kind = "ベンチマーク" if re.search(r"ベンチマーク騰落率|当ファンドのベンチマークは|＊ベンチマークは", flat) else ("参考指数" if "参考指数" in t else None)
    bdef = re.search(r"(?:ベンチマーク|参考指数)は、?([^。]{4,80}?)です。", flat)
    if bdef:
        out["基準指数_定義"] = bdef.group(1)
        out["基準指数_配当込み明記"] = bool(re.search(r"配当込み", bdef.group(1)))
    out["基準指数_種類"] = kind
    lines = t.splitlines()
    frow = next((l for l in lines if re.search(r"基準価額(の)?騰落率\s*[（(]", l)), None)
    brow = None
    for i, l in enumerate(lines):
        if re.search(r"ベンチマーク騰落率\s*[（(]", l):
            brow = l; break
        if re.search(r"指数.*[（(]％[）)]", l) or (re.search(r"^\s*[（(]％[）)]", l.strip()) and i > 0):
            pass
    if brow is None:
        # 参考指数の行はラベルが2〜3行に割れる（au・大和）。「（％）」を持ち、直前後に「騰落率」がある行を拾う
        for i, l in enumerate(lines):
            if re.search(r"[（(]％[）)]", l) and not re.search(r"基準価額", l) and any("騰落率" in lines[j] for j in range(max(0, i - 2), min(len(lines), i + 3))) and re.search(r"\d", l):
                brow = l; break
    if frow and brow:
        f = _row_values(frow); g = _row_values(brow)
        n = min(len(f), len(g))
        rows = [{"基準価額騰落率": f[i], "指数騰落率": g[i],
                 "差": None if f[i] is None or g[i] is None else round(f[i] - g[i], 4)} for i in range(n)]
        out["年間騰落率"] = rows
        if kind == "ベンチマーク":
            ds = [r["差"] for r in rows if r["差"] is not None]
            # ★連動を目標にするファンドでベンチマークとの差が年3ポイントを超えるのは、ほぼ抽出の誤対応。
            #   実測: 大和の運用報告書は小数点が空白に化け、指数行のラベルが3行に割れるため、
            #   iFreeNEXT NASDAQ100 で「−32.4」という値を出した（正しくは当期 −0.5）。黙って平均に入れない。
            bad = [d for d in ds if abs(d) > 3]
            if bad:
                out["_異常値"] = f"ベンチマークとの差 {bad} は連動型として不自然。年間騰落率の表は使わず、PDFを目で確認すること"
                out["年間騰落率_信頼できない"] = True
                ds = []
            if ds:
                out["かい離_平均"] = round(sum(ds) / len(ds), 4)
                out["かい離_最小"] = min(ds); out["かい離_最大"] = max(ds)
                out["かい離_プラスの期数"] = sum(1 for d in ds if d > 0); out["かい離_期数"] = len(ds)
        else:
            out["_注意"] = ("参考指数はファンドの連動目標ではない（レバレッジ型等）。"
                          "「基準価額騰落率−指数騰落率」を隠れコストとして読まないこと。")
    # 実績の総経費率（運用報告書側）
    m = re.search(r"総経費率[（(]年率[）)]は([0-9.\s]+)[％%]", t)
    if m:
        out["運用報告書_総経費率"] = _pct(m.group(1))
    m = re.search(r"年率\s*([0-9.\s]+)[％%]\s*程度以下", t)
    if m:
        out["運用報告書_投資先の費用_年率程度以下"] = _pct(m.group(1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prospectus"); ap.add_argument("--report")
    ap.add_argument("--url-prospectus"); ap.add_argument("--url-report")
    ap.add_argument("--isin", help="楽天証券掲載のPDFを ISIN で取る（例 JP90C000H1T1）")
    ap.add_argument("--name", default=""); ap.add_argument("--json")
    a = ap.parse_args()
    tmp = Path(tempfile.mkdtemp())
    res = {"ファンド名": a.name or (a.isin or "")}
    if a.isin:
        a.prospectus = str(fetch_rakuten(a.isin, "prospectus", tmp / "k.pdf"))
        a.report = str(fetch_rakuten(a.isin, "invest", tmp / "u.pdf"))
    if a.url_prospectus or a.prospectus:
        p = fetch(a.url_prospectus, tmp / "k.pdf") if a.url_prospectus else Path(a.prospectus)
        res["交付目論見書"] = a.url_prospectus or a.prospectus
        res.update(parse_prospectus(text_of(p)))
    if a.url_report or a.report:
        p = fetch(a.url_report, tmp / "u.pdf") if a.url_report else Path(a.report)
        res["交付運用報告書"] = a.url_report or a.report
        res.update(parse_report(text_of(p)))
    # 取れなかった項目を明示する（★空欄を0や「なし」と読み替えないため）
    want = ["信託報酬_税込年率", "総経費率", "総経費率_対象期間", "購入時手数料",
            "信託財産留保額", "年間騰落率", "運用報告書_対象期間"]
    res["_未取得"] = [k for k in want if k not in res or res[k] in (None, [])]
    if res.get("年間騰落率_信頼できない"):
        res["_未取得"].append("年間騰落率（異常値のため不採用）")
    print(json.dumps(res, ensure_ascii=False, indent=2))
    if a.json:
        Path(a.json).write_text(json.dumps(res, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if res["_未取得"]:
        print(f"\n⚠️ 未取得 {len(res['_未取得'])}件: {res['_未取得']}\n"
              "   ★PDFの様式は運用会社ごとに違う。取れない項目は手で確認し、"
              "推測で埋めないこと。", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
