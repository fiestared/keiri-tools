"""How much each pair's result depends on the first days of the comparison window.

Added 2026-10-02 (audit of the published comparisons). When the window starts on the day
one fund's data begins, the first day's move can decide the order of two near-identical
funds. This script only reads the saved NAV files (same loaders as compare.py) and writes
start-sensitivity.json; the article generator quotes it. No network access.
"""
import datetime as dt, json, sys
from pathlib import Path
import xml.etree.ElementTree as ET
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools'))
from fund_pair_compare import load_nav
END = dt.date(2026, 9, 11)
START = dt.date(2023, 9, 11)

def xml_nav(name):
    root = ET.fromstring((HERE / (name + '.xml')).read_bytes().decode('cp932'))
    out, reinvested = {}, None
    for row in root.findall('.//day'):
        a = row.attrib
        if not a.get('price') or not a.get('return_value'):
            continue
        d = dt.date(int(a['year']), int(a['month']), int(a['value']))
        if d > END:
            continue
        reinvested = float(a['price']) if reinvested is None else reinvested * float(a['return_value'])
        out[d] = reinvested
    return out

data = {n: load_nav(str(HERE / (n + '.csv'))) for n in
        ['rakuten-vti', 'rakuten-bull', 'rakuten-nasdaq', 'fang', 'topix', 'nikkei', 'orcan', 'emaxis-sp', 'rakuten-sp', 'rakuten-orcan']}
for n in ['sbi-vti', 'sbi-bull', 'invesco', 'sbi-sp', 'sbi-nasdaq']:
    data[n] = xml_nav(n)
data = {n: {d: v for d, v in s.items() if d <= END} for n, s in data.items()}
pairs = json.loads((HERE / 'comparison.json').read_text())['pairs']
out = {}
for key, r in pairs.items():
    a, b = key.split('__')
    common = sorted(data[a].keys() & data[b].keys())
    start = max(common[0], START)
    days = [d for d in common if d >= start]
    end = days[-1]
    assert str(start) == r['起点'] and str(end) == r['終点'], key
    shifts = []
    for d in days[:6]:
        ra, rb = data[a][end] / data[a][d] - 1, data[b][end] / data[b][d] - 1
        shifts.append({'起点': str(d), 'A累積': ra, 'B累積': rb})
    assert abs(shifts[0]['A累積'] - r['A累積']) < 1e-12 and abs(shifts[0]['B累積'] - r['B累積']) < 1e-12, key
    lead = [(s['A累積'] > s['B累積']) for s in shifts]
    out[key] = {
        '起点': str(start), '終点': str(end), '暦日数': (end - start).days,
        'Aデータ初日': str(min(data[a])), 'Bデータ初日': str(min(data[b])),
        '起点がデータ初日': [n for n in (a, b) if min(data[n]) == start],
        '順序が入れ替わる起点': [s['起点'] for s, l in zip(shifts, lead) if l != lead[0]],
        '起点をずらした場合': shifts,
    }
(HERE / 'start-sensitivity.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
for k, v in out.items():
    print(k, v['起点'], v['暦日数'], v['起点がデータ初日'], v['順序が入れ替わる起点'])
