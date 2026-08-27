#!/usr/bin/env python3
"""協会けんぽ由来の引用を、取得済みの一次資料(HTML/PDF)に逐語で当てる。

check_quotes.py は e-Gov のコーパスしか見ないので、協会けんぽの文言は
必ず ④candidate に出る。それを「当たっていない」と誤読しないための対照。
規則2どおり、素が当たることと、改ざんが落ちることの両方を見る。
"""
import re
import sys

import pdfplumber

BASE = "/Users/masahiroyasu/Scripts/keiri-tools/tools/"


def html_text(path):
    raw = open(BASE + path, encoding="utf-8", errors="ignore").read()
    raw = re.sub(r"<script[\s\S]*?</script>", " ", raw)
    raw = re.sub(r"<style[\s\S]*?</style>", " ", raw)
    return re.sub(r"<[^>]+>", " ", raw)


def pdf_text(path):
    out = []
    with pdfplumber.open(BASE + path) as pdf:
        for p in pdf.pages:
            out.append(p.extract_text() or "")
    return "\n".join(out)


corpus = " ".join([
    html_text("tmp_shobyo_form_0827.html"),
    html_text("tmp_shobyo_kk_0827.html"),
    pdf_text("tmp_shobyo_youshiki_0827.pdf"),
])
# 改行・空白はレイアウト由来なので潰してから当てる
norm = re.sub(r"\s+", "", corpus)
print(f"協会けんぽ コーパス {len(norm)}字（HTML2本＋様式PDF4ページ）")
if len(norm) < 5000:
    print("✗ コーパスが小さすぎる＝測定不能")
    sys.exit(2)

QUOTES = [
    "以下は、協会使用欄のため、記入しないでください",
    # ★この設問は様式上、選択肢(1.はい/2.いいえ)が段組で挟まるので extract_text が
    #   行順に混ぜて返す。全文一致は取れないが、断片は全て実在する（tmp_kk_probe_0827.py で確認）。
    "労務不能と認めた期間",
    "に診療した日がありま",
    "申請時の事務負担の軽減及び事務の効率化を図るため、賃金台帳や出勤簿の写し等、不要な書類の添付はしないようご注意ください。",
    "２ページの申請期間のうち出勤した日付を【〇】で囲んでください。",
    "「年」「月」については出勤の有無に関わらずご記入ください。",
    "傷病手当金の消滅時効の起算日は、労務不能であった日ごとにその翌日となります。",
    "待期には、有給休暇、土日・祝日等の公休日も含まれるため、給与の支払いがあったかどうかは関係ありません。",
    "連続して2日間会社を休んだ後、3日目に仕事を行った場合には、「待期3日間」は成立しません。",
    "審査の結果お支払い可能であれば、受付日から10営業日以内にお支払いいたします。",
    "任意継続被保険者である期間中に発生した病気・ケガについては、傷病手当金は支給されません。",
]

ok = 0
for q in QUOTES:
    hit = re.sub(r"\s+", "", q) in norm
    print(("  ✓ " if hit else "  ✗ ") + q[:60])
    ok += hit
print(f"① 素の断片が当たるか … {ok}/{len(QUOTES)}")

# ② 改ざん対照(1文字変える)。当たっていたものが全部落ちることを見る。
bad = 0
for q in QUOTES:
    t = re.sub(r"\s+", "", q)
    if t not in norm:
        continue
    tampered = t.replace("な", "ナ", 1) if "な" in t else t[:-1] + "X"
    if tampered not in norm:
        bad += 1
print(f"② 改ざんすると落ちるか … {bad}/{ok}")
sys.exit(0 if ok == len(QUOTES) and bad == ok else 1)
