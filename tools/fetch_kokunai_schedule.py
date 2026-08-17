#!/usr/bin/env python3
"""ミラサポplus（中小企業庁）の公募スケジュール表を取り、
docs/assets/hojokin_schedule.json を作る。

    python3 tools/fetch_kokunai_schedule.py           # 取得して書き出す
    python3 tools/fetch_kokunai_schedule.py --check   # 書き出さず件数だけ見る

★なぜ要るか（2026-08-12 実測）:
  国の看板補助金のうち、次は **jGrants に載らない**（自前の申請システムを使うため）:
    デジタル化・AI導入補助金（旧IT導入補助金）／中小企業省力化投資補助金／新事業進出補助金
  さらに jGrants に載る制度でも、**回と回の間は「公募中」が0件になる**。
  実測: 小規模事業者持続化補助金は jGrants の公募中4件がすべて災害支援枠で、
  **通常枠は1件も無い**。次回受付は 2026/11/5〜12/15（この表から判明）。
  → 「持続化補助金」で検索して来た人に、次回日程を出せるようになる。

★robots.txt を実際に読んで確認した（2026-08-12）:
    User-agent: *
    Disallow: /wp-admin/
    Allow: /wp-admin/admin-ajax.php
    Content-Signal: ai-train=yes, search=yes, ai-input=yes
  トップページは禁止されていない。Content-Signal も search=yes を明示している。

★この表は「日付」だけでなく「第23次受付終了」のような**文字列**も入る。
  日付に正規化しようとすると情報が落ちるので、**原文のまま持つ**。
  画面側で「受付終了」「随時受付中」を判別して見せる。

★HTMLが変わると黙って0件になるのが一番怖い。
  → 見出しに「公募開始日」を含む table を探す（位置ではなく中身で特定する）。
  → 件数ガード: 5行未満なら異常として書き出さない。
"""
import argparse
import html as html_mod
import json
import re
import sys
import urllib.request
from urllib.parse import urljoin
from datetime import datetime, timedelta, timezone
from pathlib import Path

SRC = 'https://mirasapo-plus.go.jp/'
UA = {'User-Agent': 'keiri-tools/1.0 (+https://keiri-tools.com)'}
JST = timezone(timedelta(hours=9))
OUT = Path(__file__).resolve().parent.parent / 'docs' / 'assets' / 'hojokin_schedule.json'
HTML_OUT = Path(__file__).resolve().parent.parent / 'docs' / 'hojokin' / 'schedule' / 'index.html'
MIN_ROWS = 5          # ★これを下回ったら異常とみなす（HTML変更の検知）

TAG = re.compile(r'<[^>]+>')
WS = re.compile(r'\s+')


def text(s):
    return WS.sub(' ', html_mod.unescape(TAG.sub('', s))).strip()


def fetch(url=SRC):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return r.read().decode('utf-8', 'ignore')


def parse(doc):
    """★位置ではなく中身で表を特定する（レイアウト変更に強い）"""
    for tb in re.findall(r'<table[\s\S]*?</table>', doc):
        if '公募開始日' not in tb:
            continue
        rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', tb)
        out = []
        for row in rows:
            cells = [text(c) for c in re.findall(r'<t[dh][^>]*>([\s\S]*?)</t[dh]>', row)]
            if len(cells) < 3 or cells[0] in ('補助金名', ''):
                continue                       # 見出し行と空行を飛ばす
            link = re.search(r'href="([^"]+)"', row)
            # ★先方は絶対URLと相対URLを混ぜてくる（2026-08-17 実測: 22行中1行が
            #   `/subsidy/shinjigyoumanufacturing/` の相対リンクで、検査
            #   「URLは絶対URL」が赤になり、補助金データの更新が丸ごと止まった）。
            #   href をそのまま持たない。**取得した時点で絶対URLに解決する。**
            out.append({
                'name': cells[0],
                'start': cells[1],             # ★「2026/7/1」も「第23次受付終了」も原文のまま
                'period': cells[2],
                'url': urljoin(SRC, link.group(1)) if link else None,
            })
        return out
    return []


def render_html(doc):
    """受付中を上にして、初期HTMLへそのまま読める表を焼き込む。"""
    rows = sorted(doc['schedule'], key=lambda r: bool(re.search(r'終了', r['period'])))
    open_n = sum(not re.search(r'終了', r['period']) for r in rows)
    trs = []
    for row in rows:
        name = html_mod.escape(row['name'])
        if row.get('url'):
            name = (f'<a href="{html_mod.escape(row["url"], quote=True)}" '
                    f'rel="nofollow noopener" target="_blank">{name}</a>')
        cls = ' class="hint"' if re.search(r'終了', row['period']) else ''
        trs.append(f'      <tr><td>{name}</td><td{cls}>{html_mod.escape(row["period"])}</td></tr>')
    meta = doc['_meta']
    captured = html_mod.escape(meta['captured_jst'], quote=True)
    day = html_mod.escape(meta['captured_jst'][:10])
    attribution = html_mod.escape(meta['attribution'])
    return f'''<!--sched:S-->
  <p class="hint">jGrants に載らない制度（デジタル化・AI導入／省力化投資／新事業進出）を含みます。
  <a href="../">補助金の検索</a>には出てきません。★<b>いま受付中は{open_n}件</b>で、受付が終わった回は下に並べています
  （次回の日程は公式に発表されるまで分かりません）。</p>
  <div class="scroll-wrap"><table class="res" id="hj-sched-table">
    <tr><th>補助金</th><th>申請受付期間</th></tr>
{chr(10).join(trs)}
  </table></div>
  <p class="note" id="sched-fresh" data-captured="{captured}">{attribution}　{day} 取得。最新の日程は各リンク先の公式ページでご確認ください。</p>
<!--sched:E-->'''


def bake_html(doc):
    source = HTML_OUT.read_text(encoding='utf-8')
    marker = re.compile(r'<!--sched:S-->[\s\S]*?<!--sched:E-->')
    if len(marker.findall(source)) != 1:
        raise RuntimeError(f'{HTML_OUT}: sched マーカーが1組見つからない')
    source = marker.sub(lambda _: render_html(doc), source)
    count_marker = re.compile(r'(<span class="hj-tab-n" id="hj-tab-n2">)[^<]*(</span>)')
    if len(count_marker.findall(source)) != 1:
        raise RuntimeError(f'{HTML_OUT}: hj-tab-n2 が1個見つからない')
    HTML_OUT.write_text(count_marker.sub(rf'\g<1>{len(doc["schedule"])}件\g<2>', source), encoding='utf-8')

    sibling = HTML_OUT.parent.parent / 'koyou' / 'index.html'
    sibling_source = sibling.read_text(encoding='utf-8')
    if len(count_marker.findall(sibling_source)) != 1:
        raise RuntimeError(f'{sibling}: hj-tab-n2 が1個見つからない')
    sibling.write_text(count_marker.sub(rf'\g<1>{len(doc["schedule"])}件\g<2>', sibling_source), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()

    try:
        rows = parse(fetch())
    except Exception as e:
        print(f'★取得に失敗: {type(e).__name__}: {e}', file=sys.stderr)
        return 1

    print(f'{len(rows)}行', file=sys.stderr)
    for r in rows[:3]:
        print(f'  {r["name"][:40]} / {r["start"]} / {r["period"][:30]}', file=sys.stderr)

    if len(rows) < MIN_ROWS:
        # ★HTMLの構造が変わると、正規表現が通っても0行になる。黙って空を書き出さない
        print(f'★{len(rows)}行しか取れなかった（想定は{MIN_ROWS}行以上）。'
              f'HTMLの構造が変わった可能性がある。書き出さない。', file=sys.stderr)
        return 1
    if args.check:
        return 0

    doc = {
        '_meta': {
            'label': '国の主要な補助金の公募スケジュール',
            'captured_jst': datetime.now(JST).isoformat(timespec='seconds'),
            'source_name': 'ミラサポplus（中小企業庁）',
            'source_url': SRC,
            'attribution': '出典：ミラサポplus（中小企業庁）',
            'count': len(rows),
            '_note': ('★jGrants に載らない制度（デジタル化・AI導入／省力化投資／新事業進出）と、'
                      '回と回の間で公募中が0件になる制度の次回日程を補うためのデータ。'
                      '「第23次受付終了」のような文字列もそのまま持つ（日付に潰さない）。'),
        },
        'schedule': rows,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    try:
        bake_html(doc)
    except Exception as e:
        print(f'★HTMLの焼き込みに失敗: {type(e).__name__}: {e}', file=sys.stderr)
        return 1
    print(f'✓ {OUT.name} に書き出しました（{len(rows)}行）', file=sys.stderr)
    print(f'✓ {HTML_OUT} に焼き込みました', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
