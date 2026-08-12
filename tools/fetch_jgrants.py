#!/usr/bin/env python3
"""jGrants 公開API から「いま公募中の補助金」を集めて docs/assets/hojokin_jgrants.json を作る。

    python3 tools/fetch_jgrants.py            # 取得して書き出す
    python3 tools/fetch_jgrants.py --check    # 書き出さず、件数と収束だけ見る

★このAPIの制約（2026-08-11 実測）:
  **keyword が必須**。無しでも、空でも、1文字でも HTTP 400 が返る。
  つまり「全件ください」と言えないので、**網羅を証明できない**。
  → 語彙を広げて和集合を取り、増分が止まったところを実務上の全件として扱う。
  実測では50語で307件に収束し、最後の20語では1件も増えなかった。

★この「収束」は *今日の語彙で増えない* という意味でしかない。
  新制度の固有名（例: 「省力化投資補助金」のような造語）は既存語彙に引っかからない。
  → KEYWORDS は**足す前提**で持つ。減らすと黙って取りこぼす。

★利用規約（https://fs2.jgrants-portal.go.jp/API利用規約.pdf）:
  申請不要・認証なし・1秒10回まで。二次利用可。ただし**出典表示が義務**で、
  編集・加工した場合はその旨も明示する。→ ページ側の表示は hojokin_core.js の
  SOURCE_NOTICE が持ち、tests/test_hojokin.mjs が表示を強制する。

★鮮度が命。締切は動く（能登半島地震でものづくり18次の公募期間が延長された実例あり）。
  30日以内に締切を迎えるものが全体の約17%あり、放置すると**締切を過ぎた補助金を
  「公募中」として見せる**ことになる。captured_jst を必ず持たせ、ページはそれを表示する。
"""
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies'
UA = {'User-Agent': 'keiri-tools/1.0 (+https://keiri-tools.com)'}
JST = timezone(timedelta(hours=9))
OUT = Path(__file__).resolve().parent.parent / 'docs' / 'assets' / 'hojokin_jgrants.json'

# ★2026-08-11 の実測で収束した語彙。増やすのは可・減らすのは不可（取りこぼす）。
KEYWORDS = [
    '補助金', '助成金', '支援金', '給付金', '事業', '支援', '設備', '人材', 'デジタル', '省エネ',
    '創業', '販路', '研究', '観光', '雇用', '環境', '医療', '福祉', '農業', '漁業',
    '建設', '製造', '小売', '飲食', '運輸', '教育', 'IT', 'DX', 'AI', '脱炭素',
    '再エネ', '事業承継', '海外', '輸出', '商店', '空き家', '子育て', '女性', '若者', '障害',
    '高齢', '防災', '感染', '賃上げ', '生産性', '省力化', 'ロボット', '知財', '特許', 'ブランド',
]

# ページで使う項目だけ残す（詳細PDFの base64 まで持つと数十MBになり、配信できない）
KEEP = [
    'id', 'title', 'subsidy_catch_phrase', 'target_area_search', 'target_number_of_employees',
    'subsidy_max_limit', 'subsidy_rate', 'acceptance_start_datetime', 'acceptance_end_datetime',
    'use_purpose', 'industry', 'front_subsidy_detail_page_url',
]


def fetch(keyword, acceptance=1):
    url = (f'{API}?keyword={urllib.parse.quote(keyword)}'
           f'&sort=created_date&order=DESC&acceptance={acceptance}')
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.loads(r.read()).get('result', [])


def sweep(verbose=False):
    seen, growth, failed = {}, [], []
    for i, kw in enumerate(KEYWORDS, 1):
        try:
            for row in fetch(kw):
                seen[row['id']] = row
        except Exception as e:                      # ★1語落ちても続ける。欠測は下で申告する
            failed.append({'keyword': kw, 'error': f'{type(e).__name__}: {e}'})
            continue
        growth.append(len(seen))
        if verbose:
            print(f'  {i:>2}/{len(KEYWORDS)} {kw}: 累計{len(seen)}件', file=sys.stderr)
        time.sleep(0.25)                            # ★公共APIなので間隔を空ける（規約は1秒10回まで）
    return seen, growth, failed


def trim(row):
    out = {k: row.get(k) for k in KEEP}
    # 数値・日時はそのまま持ち、表示の整形はページ側でやる（データに表示を混ぜない）
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='書き出さずに件数と収束だけ見る')
    args = ap.parse_args()

    seen, growth, failed = sweep(verbose=True)
    tail = (growth[-1] - growth[-11]) if len(growth) > 11 else None
    converged = tail is not None and tail < 15 and not failed

    doc = {
        '_meta': {
            'label': '公募中の補助金（jGrants 公開API）',
            'captured_jst': datetime.now(JST).isoformat(timespec='seconds'),
            'source_name': 'Jグランツ',
            'source_url': 'https://www.jgrants-portal.go.jp/',
            'api': API,
            'terms_url': 'https://fs2.jgrants-portal.go.jp/API%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84.pdf',
            # ★規約上の義務。ページはこの文言をそのまま出す（tests が表示を強制する）
            'attribution': '出典：Jグランツ（編集・加工しています）',
            'keywords': len(KEYWORDS),
            'count': len(seen),
            'failed_keywords': failed,
            'tail_growth_last10': tail,
            'converged': converged,
            '_note': ('★keyword 必須のAPIなので全件を要求できない。語彙の和集合で近似している。'
                      'converged=false のときは取りこぼしがある前提で扱うこと。'),
        },
        'subsidies': [trim(r) for r in seen.values()],
    }

    print(f"\n{len(seen)}件 / 語彙{len(KEYWORDS)} / 失敗{len(failed)} / 収束={converged}", file=sys.stderr)
    if failed:
        print(f"★取得できなかった語: {[f['keyword'] for f in failed]}", file=sys.stderr)
    if args.check:
        return
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'✓ {OUT.relative_to(OUT.parent.parent.parent)} に書き出しました '
          f'({OUT.stat().st_size // 1024}KB)', file=sys.stderr)


if __name__ == '__main__':
    main()
