#!/usr/bin/env python3
"""インベスコ 世界厳選株式オープン＜為替ヘッジなし＞（毎月決算型）の分配金再投資系列を、
公式の日次基準価額と課税前分配金の履歴から独立に作り、公式の公表値で検算してから、
eMAXIS Slim 全世界株式（オール・カントリー）と同じ期間・同じ計算で並べる（ネットワークなし）。

保存した生データ（2026-10-02 取得・このディレクトリ）:
  invesco_wa_1999010702.xml   https://apl.wealthadvisor.jp/xml/chart/funddata/1999010702.xml
      インベスコ公式ファンドページ（invesco.com/jp … /funds/detail/312901.html）が iframe で組み込む
      apl.wealthadvisor.jp/webasp/invesco/fund/detail/ のチャートが読む日次データ（price=基準価額）
  invesco_dst_1999010702.xml  https://apl.wealthadvisor.jp/webasp/funddataxml/dst/dst_1999010702.xml
      同じ公式ページの「課税前分配金データをCSVでダウンロード」が読む分配金の履歴（決算日・1万口当たり）
  mufg_253425.csv             https://www.am.mufg.jp/fund_file/setteirai/253425.csv
  raw/inv_M.txt               月次運用レポート（2026年8月31日現在）jppdf.invesco.com/Monthly/312901_20260917.pdf
  raw/inv_P.txt               交付目論見書（2026年9月17日）jppdf.invesco.com/Prospectus/kofu312901.pdf

再投資の定義: 決算日に支払われた課税前分配金を、その決算日の基準価額で再投資したとみなす。
  日次倍率 = (当日の基準価額 + 当日の課税前分配金) ÷ 前営業日の基準価額
XML の return_value 列は使わない（突き合わせて一致を確かめるだけ）。
公式の公表値（月次レポート・目論見書の「課税前分配金再投資」騰落率）と表示桁で一致しなければ exit 1。
"""
import csv, datetime as dt, json, sys
from pathlib import Path
import xml.etree.ElementTree as ET
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools'))
from fund_pair_compare import load_nav

START, END, ONE_YEAR = dt.date(2023, 9, 11), dt.date(2026, 9, 10), dt.date(2025, 9, 11)

def invesco():
    root = ET.fromstring((HERE / 'invesco_wa_1999010702.xml').read_bytes().decode('cp932').replace('encoding="Shift_JIS"', 'encoding="utf-8"').encode())
    px, rv = {}, {}
    for r in root.iter('day'):
        a = r.attrib
        if not a.get('price'):
            continue
        assert not a.get('split_merge'), a
        d = dt.date(int(a['year']), int(a['month']), int(a['value']))
        px[d], rv[d] = float(a['price']), float(a['return_value'])
    dist = {}
    for y in ET.parse(HERE / 'invesco_dst_1999010702.xml').getroot().iter('date_y'):
        for m in y.iter('date_m'):
            for dd in m.iter('date_d'):
                dist[dt.date(int(y.attrib['value']), int(m.attrib['value']), int(dd.attrib['value']))] = float(dd.attrib['dst'])
    assert all(d in px for d in dist), '分配金の決算日が基準価額の営業日に無い'
    ds = sorted(px)
    ri, maxerr = {ds[0]: px[ds[0]]}, 0.0
    for p, d in zip(ds, ds[1:]):
        f = (px[d] + dist.get(d, 0.0)) / px[p]
        maxerr = max(maxerr, abs(f - rv[d]))
        ri[d] = ri[p] * f
    return px, dist, ri, maxerr

def on_or_before(ds, d):
    return max(x for x in ds if x <= d)

def stats(s):
    ds = sorted(s); peak = worst = 0; pk = pd = tr = None
    for d in ds:
        if s[d] > peak: peak, pk = s[d], d
        if s[d] / peak - 1 < worst: worst, pd, tr = s[d] / peak - 1, pk, d
    return worst, pd, tr

def window(s, a, b):
    return {d: v for d, v in s.items() if a <= d <= b}

def summary(s):
    a, b = min(s), max(s)
    cum = s[b] / s[a] - 1; days = (b - a).days
    dd, pk, tr = stats(s)
    return {'起点': str(a), '終点': str(b), '暦日数': days, '起点値': s[a], '終点値': s[b], '倍率': s[b] / s[a], '累積%': cum * 100,
            '年率365.25%': ((1 + cum) ** (365.25 / days) - 1) * 100, '年率365%': ((1 + cum) ** (365 / days) - 1) * 100,
            '100万円終価': round(1e6 * s[b] / s[a]), '最大下落率%': dd * 100, '最大下落の高値日': str(pk), '最大下落の安値日': str(tr)}

if __name__ == '__main__':
    px, dist, ri, maxerr = invesco()
    ds = sorted(px)
    # ── 外部オラクル: 公式の公表値と表示桁で一致するか ──
    oracle, ok = [], True
    def chk(label, base, end, official, nd):
        global ok
        got = (ri[end] / (ri[base] if base else 10000.0) - 1) * 100
        hit = round(got, nd) == official
        ok &= hit
        oracle.append({'資料': label, '起点': str(base) if base else '設定時10,000円', '終点': str(end), '再構成%': got, '公表%': official, '一致': hit})
    E8 = dt.date(2026, 8, 31)
    for name, base, off in [('1ヵ月', dt.date(2026, 7, 31), 0.80), ('3ヵ月', dt.date(2026, 5, 31), 5.47), ('6ヵ月', dt.date(2026, 2, 28), 12.14),
                            ('1年', dt.date(2025, 8, 31), 24.37), ('3年', dt.date(2023, 8, 31), 76.96)]:
        chk(f'月次レポート2026年8月31日現在 {name}', on_or_before(ds, base), E8, off, 2)
    chk('月次レポート2026年8月31日現在 設定来', None, E8, 555.14, 2)
    E6 = dt.date(2026, 6, 30)
    for name, base, off in [('1カ月', dt.date(2026, 5, 31), 1.6), ('3カ月', dt.date(2026, 3, 31), 17.3), ('6カ月', dt.date(2025, 12, 31), 11.5),
                            ('1年', dt.date(2025, 6, 30), 23.2), ('3年', dt.date(2023, 6, 30), 77.8), ('5年', dt.date(2021, 6, 30), 153.1)]:
        chk(f'交付目論見書2026年6月30日現在 {name}', on_or_before(ds, base), E6, off, 1)
    chk('交付目論見書2026年6月30日現在 設定来', None, E6, 531.3, 1)
    facts = {'基準価額2026-08-31': px[E8], '分配金設定来累計2026-08-31まで': sum(v for k, v in dist.items() if k <= E8),
             '基準価額2026-06-30': px[E6], '分配金設定来累計2026-06-30まで': sum(v for k, v in dist.items() if k <= E6)}
    ok &= facts == {'基準価額2026-08-31': 9061.0, '分配金設定来累計2026-08-31まで': 20650.0, '基準価額2026-06-30': 9023.0, '分配金設定来累計2026-06-30まで': 20350.0}
    # ── 同じ期間・同じ計算 ──
    orcan = load_nav(str(HERE / 'mufg_253425.csv'))
    common = sorted(d for d in set(ri) & set(orcan) if START <= d <= END)
    assert common[0] == START and common[-1] == END
    assert [d for d in ri if START <= d <= END and d not in orcan] == [] and [d for d in orcan if START <= d <= END and d not in ri] == []
    A = {d: ri[d] for d in common}; B = {d: orcan[d] for d in common}
    out = {'取得日': '2026-10-02', '共通営業日': len(common), 'return_valueとの最大差': maxerr, '全営業日数': len(ds),
           '公表値との検算': oracle, '公表値と一致した基準価額と分配金累計': facts,
           '世界のベスト': summary(A), 'オルカン': summary(B),
           '世界のベスト直近1年': summary(window(A, ONE_YEAR, END)), 'オルカン直近1年': summary(window(B, ONE_YEAR, END)),
           '世界のベスト_基準価額だけ': {'起点': px[START], '終点': px[END], '騰落%': (px[END] / px[START] - 1) * 100},
           '世界のベスト_期間内の分配金': {'回数': sum(1 for d in dist if START < d <= END), '合計円': sum(v for d, v in dist.items() if START < d <= END),
                                 '額の種類': sorted({v for d, v in dist.items() if START < d <= END})}}
    n = len(common) - 1
    pts = lambda S: ' '.join(f'{48 + 334 * i / n:.1f},{204 - 83 * S[d] / S[START]:.1f}' for i, d in enumerate(common))
    out['図'] = {'式': 'x=48+334*i/732; y=204-83*(値/起点値)。起点=100', 'オルカン': pts(B), '世界のベスト': pts(A)}
    (HERE / 'result.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    with (HERE / 'normalized.csv').open('w') as f:
        w = csv.writer(f); w.writerow(['date', 'invesco_nav', 'invesco_dist_pretax', 'invesco_reinvested_start_100', 'orcan_reinvested_start_100'])
        for d in common: w.writerow([d, int(px[d]), int(dist.get(d, 0)), A[d] / A[START] * 100, B[d] / B[START] * 100])
    for o in oracle: print('OK ' if o['一致'] else 'NG ', o['資料'], o['起点'], f"{o['再構成%']:.4f}", o['公表%'])
    for k in ['世界のベスト', 'オルカン', '世界のベスト直近1年', 'オルカン直近1年', '世界のベスト_基準価額だけ', '世界のベスト_期間内の分配金']:
        print(k, {a: b for a, b in out[k].items()})
    print('max |return_value − (基準価額+分配金)/前日基準価額| =', maxerr, '/ 共通営業日', len(common))
    sys.exit(0 if ok else 1)
