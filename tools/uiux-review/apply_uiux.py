# -*- coding: utf-8 -*-
"""UI/UXレビュー(tools/uiux-review/plan-*.md)のHTML側適用。冪等。
   ★順序が重要: コピーボタン(import を最後の </script> に足す)は、
     タブのJS(classic script を </body> 直前に足す)より **前** に流すこと。
     逆にすると import が classic script に入って壊れる。"""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[2] / "docs"
def pages():
    for p in sorted(ROOT.rglob("*.html")):
        if any(x.startswith("_") for x in p.parts): continue
        yield p
def rd(p): return p.read_text(encoding="utf-8")
def wr(p,s): p.write_text(s, encoding="utf-8")
rep = {}

# 1) SVG の警告色テキスト（--warn-line は白上1.57:1。装飾の枠線専用）
pat = re.compile(r'(<text\b[^>]*?)fill="var\(--warn-line\)"')
f=h=0
for p in pages():
    s=rd(p); new,k = pat.subn(r'\1fill="var(--warn-ink)"', s)
    if k: wr(p,new); f+=1; h+=k
rep["SVG警告色→--warn-ink"]=f"{f}ページ/{h}箇所"

# 2) スキップリンク（SC 2.4.1）
f=0
for p in pages():
    s=rd(p)
    if "<main" not in s or 'class="skip-link"' in s or 'id="main"' in s or "<body>" not in s: continue
    s=s.replace("<body>", '<body>\n<a class="skip-link" href="#main">本文へ移動</a>\n',1)
    s=s.replace("<main>", '<main id="main" tabindex="-1">',1)
    wr(p,s); f+=1
rep["スキップリンク"]=f"{f}ページ"

# 3) 結果領域に role="status" aria-live="polite"（タグ・属性順を問わない）
el = re.compile(r'<(\w+)((?:(?!aria-live)[^>])*?\bclass="[^"]*\bresult\b[^"]*"(?:(?!aria-live)[^>])*?)>')
f=h=0
for p in pages():
    s=rd(p); new,k = el.subn(lambda m: f'<{m.group(1)} role="status" aria-live="polite"{m.group(2)}>', s)
    if k: wr(p,new); f+=1; h+=k
rep["結果領域 aria-live"]=f"{f}ページ/{h}箇所"

# 4) パンくずの「ホーム」をリンクへ（深さから相対パス）
bc = re.compile(r'<nav class="breadcrumb">(\s*)ホーム')
f=0
for p in pages():
    s=rd(p)
    if not bc.search(s): continue
    d=len(p.relative_to(ROOT).parts)-1; href="../"*d if d else "./"
    wr(p, bc.sub(lambda m: f'<nav class="breadcrumb">{m.group(1)}<a href="{href}">ホーム</a>', s, count=1)); f+=1
rep["パンくずのホーム"]=f"{f}ページ"

# 5) 目次を正規形へ（<div class="toc-title"> の直後に <ul class="toc"> の崩れ形）
op = re.compile(r'<div class="toc-title">目次</div>\s*<ul class="toc">')
f=0
for p in pages():
    s=rd(p); m=op.search(s)
    if not m: continue
    close=s.find("</ul>", m.end()); inner=s[m.end():close]
    if "<ul" in inner: continue
    wr(p, s[:m.start()] + '<nav class="toc"><div class="toc-title">目次</div><ol>' + inner + "</ol></nav>" + s[close+5:]); f+=1
rep["目次の型崩れ"]=f"{f}ページ"

# 6) 結果をコピー（★タブより前に流す）
BTN=('<button id="copy-result" class="tool-cta" '
     'style="display:none;margin-top:10px;background:#5b6b7b">結果をコピー</button>')
f=0
for p in pages():
    s=rd(p)
    if 'id="result"' not in s or '<script type="module">' not in s or 'id="copy-result"' in s: continue
    m=re.search(r'<(\w+)[^>]*\bid="result"[^>]*>\s*</\1>', s)
    if not m: continue
    d=len(p.relative_to(ROOT).parts)-1
    s=s.replace(m.group(0), m.group(0)+"\n  "+BTN,1)
    i=s.rfind("</script>")
    s=s[:i]+(f'\n/* ---------- 結果をコピー（共通部品）2026-08-23 展開 ---------- */\n'
             f'import {{ attachCopyButton }} from "{"../"*d}assets/copy_result.js";\n'
             f'attachCopyButton(document.getElementById("copy-result"), document.getElementById("result"));\n')+s[i:]
    wr(p,s); f+=1
rep["結果をコピー"]=f"{f}ページ"

# 7) タブを完全な APG パターンへ
JS = """<script>
/* タブのキーボード操作（WAI-ARIA APG: Tabs）。2026-08-23 追加。
   role="tab" は「矢印キーで移動できる」と支援技術に案内するのに実装が無かった。
   ★左右/Home/End は複合ウィジェット内の操作＝SC 2.1.4（単一文字ショートカット）の対象外。 */
(function () {
  var list = document.querySelector('[role="tablist"]');
  if (!list) return;
  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
  function sync() { tabs.forEach(function (t) { t.tabIndex = t.getAttribute("aria-selected") === "true" ? 0 : -1; }); }
  sync();
  tabs.forEach(function (t) { t.addEventListener("click", function () { setTimeout(sync, 0); }); });
  list.addEventListener("keydown", function (e) {
    var i = tabs.indexOf(document.activeElement), j = null;
    if (i < 0) return;
    if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tabs.length - 1;
    if (j === null) return;
    e.preventDefault(); tabs[j].click(); tabs[j].focus();
  });
})();
</script>
</body>"""
tab_o=re.compile(r'<button id="tab-([a-z]+)" role="tab"'); pane_o=re.compile(r'<div class="pane" id="pane-([a-z]+)"')
f=0
for p in pages():
    s=rd(p)
    if 'role="tablist"' not in s or 'role="tabpanel"' in s: continue
    s=tab_o.sub(lambda m: f'<button id="tab-{m.group(1)}" role="tab" aria-controls="pane-{m.group(1)}"', s)
    s=pane_o.sub(lambda m: f'<div class="pane" role="tabpanel" tabindex="0" aria-labelledby="tab-{m.group(1)}" id="pane-{m.group(1)}"', s)
    s=s.replace("</body>", JS, 1); wr(p,s); f+=1
rep["タブ APG 化"]=f"{f}ページ"

# 8) エラー通知の共通部品を読み込む
f=0
for p in pages():
    s=rd(p)
    if ('class="result"' not in s and 'id="result"' not in s) or "a11y_error.js" in s: continue
    if s.count("</body>")!=1: continue
    d=len(p.relative_to(ROOT).parts)-1
    wr(p, s.replace("</body>", f'<script src="{"../"*d}assets/a11y_error.js" defer></script>\n</body>',1)); f+=1
rep["a11y_error.js 読み込み"]=f"{f}ページ"

# 9) 表の見出しに scope（空見出しは対象外・結合セルの表は触らない）
TABLE=re.compile(r'<table\b[^>]*>.*?</table>', re.S); TR=re.compile(r'<tr\b[^>]*>.*?</tr>', re.S)
TH=re.compile(r'<th(?![a-zA-Z])([^>]*)>(\s*)</th>|<th(?![a-zA-Z])([^>]*)>')
n_col=n_row=0; f=0
def th_sub(tr_text, kind):
    global n_col,n_row
    def r(m):
        global n_col,n_row
        if m.group(1) is not None: return m.group(0)          # 空見出しは付けない
        attrs=m.group(3)
        if "scope=" in attrs: return m.group(0)
        if kind=="col": n_col+=1
        else: n_row+=1
        return f'<th scope="{kind}"{attrs}>'
    return TH.sub(r, tr_text, count=(1 if kind=="row" else 0))
for p in pages():
    s=rd(p); orig=s
    def fix(mt):
        t=mt.group(0)
        if re.search(r'<th[^>]*(rowspan|colspan)', t): return t
        rows=list(TR.finditer(t))
        if not rows: return t
        out=[]; last=0
        for i,m in enumerate(rows):
            tr=m.group(0)
            if i==0 and "<th" in tr and "<td" not in tr: new=th_sub(tr,"col")
            elif "<td" in tr and "<th" in tr:            new=th_sub(tr,"row")
            else:                                        new=tr
            out.append(t[last:m.start()]); out.append(new); last=m.end()
        out.append(t[last:])
        return "".join(out)
    s=TABLE.sub(fix,s)
    if s!=orig: wr(p,s); f+=1
rep["表の scope"]=f"{f}ページ/col {n_col}/row {n_row}"

for k,v in rep.items(): print(f"  ✅ {k}: {v}")
