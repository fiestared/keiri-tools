"""Saved issuer CSVs and issuer-embedded WealthAdvisor feeds; no network writes.

XML return_value is a daily total-return multiplier, as used in sbi-chart.js.
For each publication window, independently check it against price + distribution.
All returns are before investor-level tax and purchase/redemption fees.
"""
import csv
import datetime as dt
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools'))
from fund_pair_compare import load_nav, compare

END = dt.date(2026, 9, 11)

def xml_nav(name):
    root = ET.fromstring((HERE / (name + '.xml')).read_bytes().decode('cp932'))
    result = {}
    last_price = None
    reinvested = None
    max_error = 0
    for row in root.findall('.//day'):
        a = row.attrib
        if not a.get('price') or not a.get('return_value'):
            continue
        date = dt.date(int(a['year']), int(a['month']), int(a['value']))
        if date > END:
            continue
        assert not a.get('split_merge'), ('split/merge needs separate handling', name, date)
        price = float(a['price'])
        mult = float(a['return_value'])
        if last_price is not None:
            independent = (price + float(a.get('divident') or 0)) / last_price
            max_error = max(max_error, abs(mult-independent))
            assert abs(mult-independent) < 0.00001, (name, date, mult, independent)
        reinvested = price if reinvested is None else reinvested * mult
        result[date] = reinvested
        last_price = price
    return result, max_error

data = {n: load_nav(str(HERE / (n + '.csv'))) for n in
        ['rakuten-vti', 'rakuten-bull', 'rakuten-nasdaq', 'fang', 'topix', 'nikkei', 'orcan', 'emaxis-sp', 'rakuten-sp', 'rakuten-orcan', 'mufg-gold']}
checks = {}
for n in ['sbi-vti', 'sbi-bull', 'invesco', 'sbi-sp', 'sbi-nasdaq', 'sbi-gold']:
    data[n], checks[n] = xml_nav(n)
data = {n: {d: v for d, v in series.items() if d <= END} for n, series in data.items()}
from catalog import selected
pairs = [(x['a'],x['b']) for x in selected if x['a'] != 'sbi-gold']
# Gold: domestic vs overseas valuation timing fails daily alignment check.
# Publish a specification/cost comparison, not an unmatched NAV performance table.
# Preserve original orientations for the first five manuscripts.
pairs += [('invesco','orcan')]
output = {'as_of': str(END), 'xml_multiplier_max_error': checks, 'pairs': {}}
for a, b in pairs:
    common = sorted(data[a].keys() & data[b].keys())
    # Last three years, shortened only by a fund's inception.
    start = max(common[0], dt.date(2023, 9, 11))
    aa = {d: data[a][d] for d in common if d >= start}
    bb = {d: data[b][d] for d in common if d >= start}
    result = compare(aa, bb)
    for key, series in [('A', aa), ('B', bb)]:
        peak = 0
        worst = 0
        for v in series.values():
            peak = max(peak, v)
            worst = min(worst, v / peak - 1)
        result[key + '最大下落率'] = worst
        result[key + '100万円終価'] = round(1e6 * series[max(series)] / series[min(series)])
    result['1年窓'] = compare({d:v for d,v in aa.items() if d >= dt.date(2025,9,11)},
                            {d:v for d,v in bb.items() if d >= dt.date(2025,9,11)})
    output['pairs'][a + '__' + b] = result
    print(a, b, result['起点'], result['終点'],
          '累積', round(result['A累積']*100, 3), round(result['B累積']*100, 3),
          '年率差', round(result['年率差']*100, 4),
          '終価', result['A100万円終価'], result['B100万円終価'],
          '下落', round(result['A最大下落率']*100,2), round(result['B最大下落率']*100,2))
    with (HERE / (a + '__' + b + '-normalized.csv')).open('w') as f:
        w = csv.writer(f); w.writerow(['date', a + '_start_100', b + '_start_100'])
        for d in aa: w.writerow([d, aa[d]/aa[min(aa)]*100, bb[d]/bb[min(bb)]*100])
(HERE / 'comparison.json').write_text(json.dumps(output, ensure_ascii=False, indent=2))
