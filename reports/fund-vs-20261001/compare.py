"""2026-10-01 batch: compute same-period comparisons from saved issuer NAV files (no network).

Sources (saved 2026-10-01 in this directory):
  MUFG  https://www.am.mufg.jp/fund_file/setteirai/<code>.csv
  Daiwa https://www.daiwa-am.co.jp/funds/detail/csv_out.php?code=<code>&type=1
  Rakuten https://www.rakuten-toushin.co.jp/assets/csv/chart_<n>.csv
  AM-One https://www.am-one.co.jp/chart_data/<code>/dat.json
  SBI (issuer-embedded WealthAdvisor) https://apl.wealthadvisor.jp/xml/chart/funddata/<code>.xml
XML return_value is a daily total-return multiplier; checked against (price+distribution)/prev price.
All returns are before investor-level tax and purchase/redemption fees.
"""
import csv, datetime as dt, json, sys
from pathlib import Path
import xml.etree.ElementTree as ET
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools'))
from fund_pair_compare import load_nav, compare

END = dt.date(2026, 9, 30)
START3Y = dt.date(2023, 9, 29)  # 3 years before END, first business day on/after is used
ONE_YEAR = dt.date(2025, 9, 30)

def xml_nav(path):
    root = ET.fromstring(path.read_bytes().decode('cp932'))
    out, last, reinv, maxerr = {}, None, None, 0
    for row in root.findall('.//day'):
        a = row.attrib
        if not a.get('price') or not a.get('return_value'):
            continue
        d = dt.date(int(a['year']), int(a['month']), int(a['value']))
        assert not a.get('split_merge'), (path, d)
        price, mult = float(a['price']), float(a['return_value'])
        if last is not None:
            ind = (price + float(a.get('divident') or 0)) / last
            maxerr = max(maxerr, abs(mult - ind))
            assert abs(mult - ind) < 1e-5, (path, d, mult, ind)
        reinv = price if reinv is None else reinv * mult
        out[d] = reinv
        last = price
    return out, maxerr

FILES = {
    'orcan': 'mufg_253425.csv', 'emaxis-sensinkoku': 'mufg_252653.csv',
    'tawara-sensinkoku': 'amone_313125.json', 'fang': 'daiwa_3346.csv',
    'ifreenext-india': 'daiwa_3484.csv', 'rakuten-india': 'rakuten_100098.csv',
    'rakuten-schd': 'rakuten_100105.csv', 'rakuten-vym': 'rakuten_100035.csv',
    'rakuten-gold': 'rakuten_100123.csv', 'rakuten-gold-hedged': 'rakuten_100122.csv',
    'sbi-yukidaruma': 'sbi_2017120601.xml', 'sbi-vym4': 'sbi_2024013001.xml', 'sbi-gold': 'sbi_202306080A.xml',
}
PAIRS = [('orcan', 'fang'), ('ifreenext-india', 'rakuten-india'), ('rakuten-schd', 'sbi-vym4'),
         ('tawara-sensinkoku', 'emaxis-sensinkoku'), ('orcan', 'emaxis-sensinkoku'),
         ('rakuten-gold', 'sbi-gold'), ('sbi-yukidaruma', 'orcan'), ('rakuten-schd', 'rakuten-vym')]

def series(key):
    p = HERE / FILES[key]
    if p.suffix == '.xml':
        s, err = xml_nav(p)
        return s, err
    return load_nav(str(p)), None

def stats(s):
    peak, worst = 0, 0
    for d in sorted(s):
        peak = max(peak, s[d]); worst = min(worst, s[d] / peak - 1)
    return worst

if __name__ == '__main__':
    data, checks = {}, {}
    for k in FILES:
        s, err = series(k)
        data[k] = {d: v for d, v in s.items() if d <= END}
        if err is not None: checks[k] = err
    out = {'as_of': str(END), 'xml_multiplier_max_error': checks, 'inception_in_data': {k: str(min(v)) for k, v in data.items()}, 'pairs': {}}
    for a, b in PAIRS:
        common = sorted(data[a].keys() & data[b].keys())
        start = max(common[0], START3Y)
        aa = {d: data[a][d] for d in common if d >= start}
        bb = {d: data[b][d] for d in common if d >= start}
        r = compare(aa, bb)
        r['A最大下落率'], r['B最大下落率'] = stats(aa), stats(bb)
        r['A100万円終価'] = round(1e6 * aa[max(aa)] / aa[min(aa)])
        r['B100万円終価'] = round(1e6 * bb[max(bb)] / bb[min(bb)])
        if (max(aa) - min(aa)).days >= 365:
            r['1年窓'] = compare({d: v for d, v in aa.items() if d >= ONE_YEAR}, {d: v for d, v in bb.items() if d >= ONE_YEAR})
        out['pairs'][a + '__' + b] = r
        print(a, b, r['起点'], r['終点'], f"{r['年数']:.2f}y corr{r['同日相関']:.4f}",
              'cum', round(r['A累積']*100, 2), round(r['B累積']*100, 2),
              'end', r['A100万円終価'], r['B100万円終価'], 'dd', round(r['A最大下落率']*100, 2), round(r['B最大下落率']*100, 2),
              '1y', (round(r['1年窓']['A累積']*100, 2), round(r['1年窓']['B累積']*100, 2)) if '1年窓' in r else None)
        with (HERE / (a + '__' + b + '-normalized.csv')).open('w') as f:
            w = csv.writer(f); w.writerow(['date', a + '_start_100', b + '_start_100'])
            for d in aa: w.writerow([d, aa[d] / aa[min(aa)] * 100, bb[d] / bb[min(bb)] * 100])
    (HERE / 'comparison.json').write_text(json.dumps(out, ensure_ascii=False, indent=1, default=str))
