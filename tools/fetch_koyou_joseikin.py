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
    print(f'✓ {OUT.name} に書き出しました（{len(items)}制度）', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
