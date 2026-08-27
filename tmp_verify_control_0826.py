"""対照実験: 同じ検査を隣接記事に当てて、素通ししないことを確かめる。
一発で緑になったものを、そのまま「検証済み」と称さないため（規則2）。"""
import re
import subprocess

CORE = [
    "取締役は、次に掲げる場合には、株主総会において、当該取引につき重要な事実を開示し、その承認を受けなければならない。",
    "当該取引によって取締役、執行役又は第三者が得た利益の額は、前項の損害の額と推定する。",
    "使用者は、労働契約の不履行について違約金を定め、又は損害賠償額を予定する契約をしてはならない。",
    "消去すべきものを消去せず、かつ、当該記載又は記録を消去したように仮装すること。",
]
for url in ["https://keiri-tools.com/column/mimoto-hosho/",
            "https://keiri-tools.com/column/jigyo-joto/"]:
    html = subprocess.run(["curl", "-s", url], capture_output=True, text=True, timeout=60).stdout
    quotes = re.findall(r"<blockquote>(.*?)</blockquote>", html, re.S)
    blob = "\n".join(re.sub(r"<[^>]+>", "", q) for q in quotes)
    present = [q[:20] for q in CORE if q in blob]
    text = re.sub(r"<[^>]+>", " ", html)
    print(url.split("/column/")[1])
    print(f"   blockquote {len(quotes)}本 / 核の逐語 {len(present)}/{len(CORE)} 本が存在"
          + (f" ← {present}" if present else "（全て absent＝検査は素通ししない）"))
    print("   ツールCTA(kihonteate) の有無:", 'class="tool-cta" href="../../kihonteate/"' in html)
    print("   本文に「1本もありません」:", "1本もありません" in text)
