#!/usr/bin/env python3
"""厚生労働省の雇用関係助成金の一覧（制度名＋公式URL）を取り、
docs/assets/koyou_joseikin.json を作る。

    python3 tools/fetch_koyou_joseikin.py           # 取得して書き出す
    python3 tools/fetch_koyou_joseikin.py --check   # 書き出さず件数だけ見る

★なぜ要るか（2026-08-12 実測）:
  キャリアアップ助成金・人材開発支援助成金・両立支援等助成金などの
  **雇用関係助成金は jGrants に1件も載っていない**（国の制度としてはタイトル一致0件。
  ヒットするのは同名の自治体制度だけ）。競合は全社が持っている。
  keiri-tools の読者は給与・労務の担当者で、ここは一番探されるところ。

★★このデータは「補助金の検索」と混ぜない。
  雇用関係助成金には**公募型のような単一の締切が無い**（雇入れの日や支給対象期に
  応じた申請期限になる）。「あと◯日」の一覧に混ぜると**嘘になる**。
  → 制度名と公式URLだけを持ち、別の見せ方をする。金額・要件は各制度ページの正本を見せる。

★robots.txt を実際に読んで確認した（2026-08-12）:
    User-agent: *
    Disallow: /cgi-bin/
    Disallow: /images/
    Disallow: /topics/bukyoku/iyaku/kaisyu/00-1-010.html
  対象パス（/stf/seisakunitsuite/...）は禁止されていない。

★一覧に無いものを足さない。
  例: 業務改善助成金は労働基準局の所管で、この2ページには**載っていない**
  （実測で出現0回）。競合が持っているからといって、一覧に無いものを
  手で書き足すと出所が曖昧になる。取れた分だけを、取れた事実として持つ。

★HTMLが変わると黙って0件になる。→ 件数ガード（MIN_ITEMS）で止める。
"""
import argparse
import html as html_mod
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/'
PAGES = [('index_00058.html', '対象者別'), ('index_00059.html', '取組内容別')]
UA = {'User-Agent': 'keiri-tools/1.0 (+https://keiri-tools.com)'}
JST = timezone(timedelta(hours=9))
OUT = Path(__file__).resolve().parent.parent / 'docs' / 'assets' / 'koyou_joseikin.json'
HTML_OUT = Path(__file__).resolve().parent.parent / 'docs' / 'hojokin' / 'koyou' / 'index.html'
MIN_ITEMS = 30        # ★実測47件。これを下回ったらHTML変更を疑って止める

TAG = re.compile(r'<[^>]+>')
WS = re.compile(r'\s+')
# 制度名に見える語（これが無いリンクは制度ではない）
NAME_RE = re.compile(r'助成金|奨励金|給付金')
# 目次・案内など、制度ではないもの
SKIP_RE = re.compile(r'^(各種|[０-９0-9１-９]+[．.]|.*一覧$)')


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return r.read().decode('utf-8', 'ignore')


def parse(doc, page_url):
    out = []
    for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,120}?)</a>', doc):
        href = m.group(1)
        name = WS.sub('', TAG.sub('', html_mod.unescape(m.group(2))))
        if not name or len(name) < 5 or not NAME_RE.search(name):
            continue
        if SKIP_RE.match(name):
            continue
        url = urllib.parse.urljoin(page_url, href)
        # ★ページ内の目次リンク（#h2_free1 等）と外部サイトを除く
        if 'index_0005' in url and '#' in url:
            continue
        if 'mhlw.go.jp' not in url:
            continue
        out.append({'name': name, 'url': url})
    return out


def render_html(doc):
    """制度名の頭でまとめ、初期HTMLへ公式リンク一覧を焼き込む。"""
    groups = {}
    for row in doc['joseikin']:
        groups.setdefault(row['name'].split('（')[0], []).append(row)
    lis = []
    for key, rows in groups.items():
        if len(rows) == 1:
            row = rows[0]
            lis.append(f'    <li><a href="{html_mod.escape(row["url"], quote=True)}" '
                       f'rel="nofollow noopener" target="_blank">{html_mod.escape(row["name"])}</a></li>')
            continue
        subs = []
        for row in rows:
            sub = row['name'][len(key):]
            sub = re.sub(r'^（|）$', '', sub) or row['name']
            subs.append(f'<li><a href="{html_mod.escape(row["url"], quote=True)}" '
                        f'rel="nofollow noopener" target="_blank">{html_mod.escape(sub)}</a></li>')
        lis.append(f'    <li>{html_mod.escape(key)}<ul>{"".join(subs)}</ul></li>')
    meta = doc['_meta']
    captured = html_mod.escape(meta['captured_jst'], quote=True)
    day = html_mod.escape(meta['captured_jst'][:10])
    attribution = html_mod.escape(meta['attribution'])
    count = len(doc['joseikin'])
    return f'''<!--koyou:S-->
  <p class="hint">{count}制度・{day}取得。これらは<a href="../">補助金の検索</a>には含まれていません（jGrants に載らないため）。
  ★雇用関係助成金には公募型のような<b>単一の締切がありません</b>。雇入れの日や支給対象期に応じて申請期限が決まるので、
  金額・要件・期限は必ず各リンク先の公式ページでご確認ください。</p>
  <ul class="hj-koyou-list" id="hj-koyou-list">
{chr(10).join(lis)}
  </ul>
  <p class="note" id="koyou-fresh" data-captured="{captured}">{attribution}　この一覧に無い制度もあります
  （例: 業務改善助成金は労働基準局の所管で、この一覧には掲載されていません）。</p>
<!--koyou:E-->'''


def bake_html(doc):
    source = HTML_OUT.read_text(encoding='utf-8')
    marker = re.compile(r'<!--koyou:S-->[\s\S]*?<!--koyou:E-->')
    if len(marker.findall(source)) != 1:
        raise RuntimeError(f'{HTML_OUT}: koyou マーカーが1組見つからない')
    source = marker.sub(lambda _: render_html(doc), source)
    count_marker = re.compile(r'(<span class="hj-tab-n" id="hj-tab-n3">)[^<]*(</span>)')
    if len(count_marker.findall(source)) != 1:
        raise RuntimeError(f'{HTML_OUT}: hj-tab-n3 が1個見つからない')
    HTML_OUT.write_text(count_marker.sub(rf'\g<1>{len(doc["joseikin"])}制度\g<2>', source), encoding='utf-8')

    sibling = HTML_OUT.parent.parent / 'schedule' / 'index.html'
    sibling_source = sibling.read_text(encoding='utf-8')
    if len(count_marker.findall(sibling_source)) != 1:
        raise RuntimeError(f'{sibling}: hj-tab-n3 が1個見つからない')
    sibling.write_text(count_marker.sub(rf'\g<1>{len(doc["joseikin"])}制度\g<2>', sibling_source), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()

    items, failed = {}, []
    for page, kind in PAGES:
        try:
            rows = parse(fetch(BASE + page), BASE + page)
        except Exception as e:
            failed.append({'page': page, 'error': f'{type(e).__name__}: {e}'})
            continue
        for r in rows:
            it = items.setdefault(r['name'], {'name': r['name'], 'url': r['url'], 'kinds': []})
            if kind not in it['kinds']:
                it['kinds'].append(kind)
        print(f'  {page}（{kind}）: {len(rows)}件 → 累計 {len(items)}', file=sys.stderr)

    print(f'\n{len(items)}制度 / 失敗 {len(failed)}', file=sys.stderr)
    if failed or len(items) < MIN_ITEMS:
        print(f'★{len(items)}件しか取れなかった（想定は{MIN_ITEMS}件以上）。'
              f'HTMLの構造が変わった可能性がある。書き出さない。', file=sys.stderr)
        return 1
    if args.check:
        return 0

    doc = {
        '_meta': {
            'label': '雇用関係助成金の一覧（厚生労働省）',
            'captured_jst': datetime.now(JST).isoformat(timespec='seconds'),
            'source_name': '厚生労働省',
            'source_url': BASE + PAGES[0][0],
            'attribution': '出典：厚生労働省「雇用関係助成金」',
            'count': len(items),
            '_note': ('★制度名と公式URLだけを持つ。金額・要件・申請期限は持たない。'
                      '雇用関係助成金には公募型のような単一の締切が無く（雇入れの日や'
                      '支給対象期に応じた申請期限）、「あと◯日」の一覧に混ぜると嘘になるため。'
                      '★この2ページに載っていない制度は入れていない'
                      '（例: 業務改善助成金は労働基準局の所管で、この一覧には無い）。'),
        },
        'joseikin': sorted(items.values(), key=lambda x: x['name']),
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    try:
        bake_html(doc)
    except Exception as e:
        print(f'★HTMLの焼き込みに失敗: {type(e).__name__}: {e}', file=sys.stderr)
        return 1
    print(f'✓ {OUT.name} に書き出しました（{len(items)}制度）', file=sys.stderr)
    print(f'✓ {HTML_OUT} に焼き込みました', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
