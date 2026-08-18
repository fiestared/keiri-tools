#!/usr/bin/env python3
"""記事のインラインSVG図解を幾何的に検査する。

なぜ道具にするか(2026-08-19): この検査は毎便 /tmp に書き捨てられており、
**同じバグを毎回作り直していた**。実際、本便の書き捨て版は属性名の正規表現が
`(\\w+)="..."` で、`text-anchor` と `font-size` は**ハイフンを含むので一度も
マッチしていなかった** = 全テキストが anchor=start / font-size=13 として測られていた。
指摘が出ても出なくても、それは測っていないのと同じ。→ 道具に固定する。

  python3 tools/check_figures.py                       # docs/ 全体
  python3 tools/check_figures.py docs/column/x/index.html
  python3 tools/check_figures.py --exact                # 算術で確定するものだけ

🔴 この検査が言えることと言えないこと(混ぜて読まない):
  【exact】 rect が viewBox からはみ出しているか
        …座標の比較だけなので**算術で確定**する。ただし transform を解釈できた場合に限る。
        ⚠️ 「<line> の混入」は検査しない。stroke を class(CSS)で当てている図が実在し
           (例: zengin-format-guide の class="fg-axis")、属性の有無で欠陥を判定できないため。
           2026-08-19 に一度入れて **40件すべて誤検知**だったので外した。
  【estimate】 text のはみ出し・text 同士の重なり
        …**文字幅を推定している**(CJK=font-size / ASCII=0.55*font-size)。
          実フォントのメトリクスではないので、**指摘は候補であって欠陥の確定ではない**。
          目で見るまで「はみ出している」と報告しないこと。

⚠️ transform は translate(x,y) と scale(s) だけ解釈する。matrix/rotate は**解釈できない**ので
   その要素は検査対象から外す(黙って座標だけで測ると誤検知になる。実測: 2026-08-19 に
   translate(-60,0) 付きの rect を「viewBox 外」と誤って断定しかけた)。
"""
import re, sys, glob

ATTR = re.compile(r'([\w:-]+)="([^"]*)"')          # ← ハイフンを含む属性名を取りこぼさない
SVG  = re.compile(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*?)</svg>', re.S)


def parse_transform(t):
    """translate/scale だけ解釈する。解釈できない変換があれば None を返す(=検査対象外)。"""
    if not t:
        return (0.0, 0.0, 1.0)
    dx = dy = 0.0
    s = 1.0
    for name, arg in re.findall(r'(\w+)\s*\(([^)]*)\)', t):
        vals = [float(v) for v in re.split(r'[,\s]+', arg.strip()) if v]
        if name == 'translate':
            dx += vals[0]
            dy += vals[1] if len(vals) > 1 else 0.0
        elif name == 'scale':
            s *= vals[0]
        else:
            return None                            # rotate/matrix/skew は測れない
    return (dx, dy, s)


def text_width(s, fs):
    """CJK は全角、ASCII は約0.55倍。★推定であって実測ではない。"""
    return sum(fs * (0.55 if ord(c) < 0x2E80 else 1.0) for c in s)


def check_svg(vb, body, fig):
    exact, estimate = [], []
    try:
        x0, y0, w, h = [float(v) for v in vb.split()]
    except ValueError:
        return exact, estimate
    for m in re.finditer(r'<rect ([^>]*?)/?>', body):
        a = dict(ATTR.findall(m.group(1)))
        if not {'x', 'y', 'width', 'height'} <= a.keys():
            continue
        tr = parse_transform(a.get('transform'))
        if tr is None:
            continue
        dx, dy, sc = tr
        try:
            rx, ry, rw, rh = (float(a[k]) for k in ('x', 'y', 'width', 'height'))
        except ValueError:
            continue
        rx, ry, rw, rh = rx * sc + dx, ry * sc + dy, rw * sc, rh * sc
        if rx < x0 - 1 or ry < y0 - 1 or rx + rw > x0 + w + 1 or ry + rh > y0 + h + 1:
            exact.append(f"fig{fig}: rect が viewBox 外 ({rx:.0f},{ry:.0f},{rw:.0f}x{rh:.0f}) / viewBox {vb}")
    boxes = []
    for m in re.finditer(r'<text ([^>]*)>(.*?)</text>', body, re.S):
        a = dict(ATTR.findall(m.group(1)))
        if 'x' not in a or 'y' not in a:
            continue
        tr = parse_transform(a.get('transform'))
        if tr is None:
            continue
        dx, dy, sc = tr
        try:
            tx, ty = float(a['x']) * sc + dx, float(a['y']) * sc + dy
            fs = float(a.get('font-size', 13)) * sc
        except ValueError:
            continue
        s = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        if not s:
            continue
        wpx = text_width(s, fs)
        anchor = a.get('text-anchor', 'start')
        left = tx - wpx / 2 if anchor == 'middle' else (tx - wpx if anchor == 'end' else tx)
        boxes.append(((left, ty - fs, wpx, fs * 1.25), s))
        if left < x0 - 1 or left + wpx > x0 + w + 1:
            estimate.append(f"fig{fig}: text はみ出しの疑い「{s[:24]}」 x {left:.0f}〜{left+wpx:.0f} / viewBox 0〜{w:.0f}")
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            (ax, ay, aw, ah), sa = boxes[i]
            (bx, by, bw, bh), sb = boxes[j]
            ox = min(ax + aw, bx + bw) - max(ax, bx)
            oy = min(ay + ah, by + bh) - max(ay, by)
            if ox > 2 and oy > 2:
                estimate.append(f"fig{fig}: text 重なりの疑い「{sa[:16]}」×「{sb[:16]}」({ox:.0f}x{oy:.0f})")
    return exact, estimate


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    only_exact = '--exact' in sys.argv
    files = args or sorted(glob.glob('docs/**/index.html', recursive=True))
    npage = nfig = nex = nest = 0
    for f in files:
        h = open(f, encoding='utf-8', errors='replace').read()
        svgs = SVG.findall(h)
        if not svgs:
            continue
        npage += 1
        ex, est = [], []
        for n, (vb, body) in enumerate(svgs, 1):
            nfig += 1
            a, b = check_svg(vb, body, n)
            ex += a
            est += b
        nex += len(ex)
        nest += len(est)
        if ex or (est and not only_exact):
            print(f"■ {f}")
            for x in ex:
                print("   [exact]    " + x)
            if not only_exact:
                for x in est:
                    print("   [estimate] " + x)
    print(f"\n図を持つページ {npage} / 図 {nfig} / [exact] {nex}件 / [estimate] {nest}件")
    print("★ [estimate] は文字幅の推定にもとづく**候補**。目で見るまで欠陥として報告しない。")
    return 1 if nex else 0


if __name__ == '__main__':
    sys.exit(main())
