#!/usr/bin/env python3
"""日本語の文の中に紛れ込んだ**別の文字体系**（キリル/ギリシャ/ハングル）を捕まえる。

  python3 tools/check_homoglyph.py                       # docs/ 配下の公開HTML全部
  python3 tools/check_homoglyph.py <file> [<file>...]    # 個別（.md も可＝日報に掛ける用）

★なぜ道具にするか（2026-08-19 第11便）:
  2026-08-19 に**同じ便で2回**混入が起きた。①記事の「償却不足額」の「不」がキリル文字の
  `не` になっていた ②その①を報告している日報の「トレンド」が `тренд` になっていた。
  どちらも**目視では区別がつかない**（не と 不、тренд と トレンド）。
  ＝ 気をつけて防ぐ類のものではないので、機械に見張らせる。

🔴 単純な「キリル文字ゼロ」検査にはできない（申し送り917）:
  混入を**報告する**文章は、混入した文字列を引用する必要がある。実際 2026-08-19 の日報には
  `не` が8回・`тренд` が1回あるが、**全部が正当な引用**（バッククォートで囲ってある）。
  ゼロ検査にすると、混入を報告した日報が毎回赤くなり、やがて誰も見なくなる。

★そこで見るのは「混入したか」ではなく **「日本語の語の内側にあるか」**:
  異体字の連なり（run）の**直前と直後の文字**を見て、どちらかが CJK/かな なら混入と判定する。
  隣の文字を探すときは**空白（半角/全角/タブ）だけを読み飛ばす**。
    償却не足額        → 前「却」後「足」 = 内側 → ★混入
    トレンドと呼ばない  → тренд の後ろが「と」 = 内側 → ★混入
    7,629字から трим して → 空白を飛ばすと 前「ら」後「し」 = 内側 → ★混入
    `не` が混入していた → 前後がバッククォート = 引用 → 正常
  🔴 空白を飛ばすのは 2026-08-19 第12便の実害から。直前直後の**1文字**しか見ない旧判定は、
     日報の「着手時の7,629字から трим して7,438字」を**空白に囲まれていたので引用に分類し、
     緑のまま通した**。★空白**だけ**を飛ばす —— バッククォートや `**` を飛ばすと、
     混入を報告した日報が毎回赤くなる（＝検査が誤りを守る側に回る型を自分で作る）。
  ⚠️ この判定は**引用の書き方に依存する**。混入した文字が `**` や鉤括弧に
     囲まれていると見逃す（例: 「償却**не**足額」）。
     ＝ **この検査は「混入なし」を証明しない。よくある形を捕まえるだけ。**
     ★ --all を付けると引用も含めて全件並べる（目で見るとき用）。
"""
import re, sys, glob, os

# 日本語の文中に現れたら疑わしい文字体系（ラテン文字は除く＝英数字は日本語と正当に隣接する）
FOREIGN = re.compile(r'[Ѐ-ӿԀ-ԯͰ-Ͽἀ-῿가-힯ᄀ-ᇿ]+')
JP = re.compile(r'[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]')
TAGS = re.compile(r'(?is)<(script|style)\b.*?</\1>')


def strip_markup(s, path):
    if path.endswith(('.html', '.htm')):
        s = TAGS.sub(' ', s)
        s = re.sub(r'(?s)<[^>]+>', '\n', s)
    return s


def _skip_spaces(text, pos, step):
    """pos から step 方向へ、空白（半角/全角/タブ）だけを飛ばして最初の文字を返す。

    改行は飛ばさない（行をまたぐと無関係な行の文字を「隣」と呼ぶことになる）。

    🚫 飛ばすのは空白だけ。引用の目印（バッククォート・`**`・鉤括弧）は飛ばさない。
    """
    while 0 <= pos < len(text) and text[pos] in ' \u3000\t':
        pos += step
    return text[pos] if 0 <= pos < len(text) else ''


def scan(path):
    """(内側=混入, 引用) のリストを返す。"""
    raw = open(path, encoding='utf-8', errors='replace').read()
    text = strip_markup(raw, path)
    inside, quoted = [], []
    for m in FOREIGN.finditer(text):
        i, j = m.start(), m.end()
        # ★空白だけは読み飛ばして「隣の文字」を探す（2026-08-19 第12便の実測）。
        #   直前直後の1文字しか見ないと、**空白で区切って書いた混入を見逃す**。
        #   実害: 日報に「着手時の7,629字から трим して7,438字」と書いたが、
        #   前後が半角空白なので『引用』に分類され、検査は緑のまま通した。
        #   ⚠️ 空白**だけ**を飛ばす。バッククォートや `**` は飛ばさない
        #   —— それらは引用の目印であり、飛ばすと「混入を報告した日報が毎回赤くなる」
        #   （＝検査が誤りを守る側に回る型を自分で作る）。docstring の限界はそのまま残る。
        prev = _skip_spaces(text, i - 1, -1)
        nxt = _skip_spaces(text, j, +1)
        ctx = text[max(0, i - 20):j + 20].replace('\n', ' ')
        rec = (m.group(), prev, nxt, ctx)
        (inside if (JP.match(prev) or JP.match(nxt)) else quoted).append(rec)
    return inside, quoted


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    show_all = '--all' in sys.argv
    if args:
        files = args
    else:
        root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs')
        files = sorted(glob.glob(os.path.join(root, '**', '*.html'), recursive=True))

    bad = 0
    n_inside = n_quoted = 0
    for f in files:
        inside, quoted = scan(f)
        n_inside += len(inside)
        n_quoted += len(quoted)
        if inside:
            bad += 1
            print(f'■ {f}')
            for run, prev, nxt, ctx in inside:
                cps = ' '.join(f'U+{ord(c):04X}' for c in run)
                print(f'   ★混入 {run!r} ({cps})  前{prev!r}／後{nxt!r}  …{ctx}…')
        elif show_all and quoted:
            print(f'□ {f}')
            for run, prev, nxt, ctx in quoted:
                print(f'   引用 {run!r}  前{prev!r}／後{nxt!r}  …{ctx}…')

    print(f'\n走査 {len(files)}ファイル / ★日本語の語の内側 {n_inside}件 / 引用とみなした {n_quoted}件')
    if bad:
        print('🔴 日本語の語の内側に別の文字体系が混入している（目視では区別できない）。')
        return 1
    print('✓ 日本語の語の内側への混入なし')
    print('⚠ これは「混入ゼロ」の証明ではない（引用の書き方に囲まれていると見逃す）。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
