#!/usr/bin/env python3
"""ページ内 <script>（外部 *_core.js ではない層）に、制度に連動する数値が
直書きされていないかを走査する。

背景: 2026-07-24第7便で `genka_core.js` の `if (cost < 300000)` が改正後の40万円に
該当する人へ特例を表示しなかった（基準額ゲートの腐り）。07-25第2便で全31コアを
機械走査したが、**ページ内スクリプトは単体テストが原理的に届かない層**なので未走査だった。

出力: ファイル / 行 / 文脈 / 拾った数値。判定は人間（＝一次情報との照合）が行う。
"""
import json
import os
import re
import sys

DOCS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")

# 外部スクリプト・構造化データ・計測タグは対象外（制度の計算をしない層）
SKIP_TYPES = ("application/ld+json",)
SKIP_SRC_HINTS = ("googletagmanager", "adsbygoogle", "pagead")

# 制度に連動しない数値（UI・進数・時間・色・座標など）を落とすためのしきい値
# 4桁以上の整数、または 0.xx 形式の率を拾う
NUM_RE = re.compile(r"(?<![\w.])(\d{4,}|0\.\d+)(?![\w.])")

# 明らかに制度と無関係な文脈（除外するとノイズが減る）
CONTEXT_NOISE = re.compile(
    r"setTimeout|setInterval|scrollTo|innerWidth|innerHeight|"
    r"getFullYear\(\)|toFixed|padStart|Math\.random|"
    r"opacity|translate|rgba?\(|#[0-9a-fA-F]{6}|"
    r"charCodeAt|substring|slice\(|indexOf|"
    r"maxWidth|clientWidth|offsetTop|viewBox"
)


def extract_inline_scripts(html):
    """(開始オフセット, 中身) の列を返す。src付き・JSON-LD・計測タグは除く。"""
    out = []
    for m in re.finditer(r"<script([^>]*)>([\s\S]*?)</script>", html, re.I):
        attrs, body = m.group(1), m.group(2)
        if re.search(r"\bsrc\s*=", attrs, re.I):
            continue
        if any(t in attrs.lower() for t in SKIP_TYPES):
            continue
        if any(h in body for h in SKIP_SRC_HINTS):
            continue
        if not body.strip():
            continue
        out.append((m.start(2), body))
    return out


def line_of(html, offset):
    return html.count("\n", 0, offset) + 1


def main():
    findings = []
    for root, _dirs, files in os.walk(DOCS):
        for fn in files:
            if not fn.endswith(".html"):
                continue
            path = os.path.join(root, fn)
            rel = os.path.relpath(path, DOCS)
            try:
                html = open(path, encoding="utf-8").read()
            except Exception as e:  # noqa: BLE001
                print("READ-FAIL %s: %s" % (rel, e), file=sys.stderr)
                continue
            for start, body in extract_inline_scripts(html):
                for lm in NUM_RE.finditer(body):
                    val = lm.group(1)
                    ls = body.rfind("\n", 0, lm.start()) + 1
                    le = body.find("\n", lm.end())
                    if le == -1:
                        le = len(body)
                    ctx = body[ls:le].strip()
                    if CONTEXT_NOISE.search(ctx):
                        continue
                    findings.append(
                        {
                            "file": rel,
                            "line": line_of(html, start + lm.start()),
                            "value": val,
                            "context": ctx[:160],
                        }
                    )

    findings.sort(key=lambda f: (f["file"], f["line"]))
    if "--compact" in sys.argv:
        for f in findings:
            print("%-42s L%-5d %-10s %s" % (
                f["file"], f["line"], f["value"], f["context"][:110]))
    else:
        print(json.dumps(findings, ensure_ascii=False, indent=1))
    print("\n=== %d 件 / %d ファイル ===" % (
        len(findings), len({f["file"] for f in findings})), file=sys.stderr)


if __name__ == "__main__":
    main()
