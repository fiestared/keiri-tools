"""Verbatim source access for the 2026-10-01 fund comparison batch.

Every number written into an article comes from one of the saved issuer files here
(raw/*.txt = pdftotext -layout of the issuer PDF; *.csv/*.xml/*.json = issuer NAV data).
Q() returns the matched span of the whitespace-collapsed document, so a ledger quote is
always a verbatim excerpt (only runs of whitespace are collapsed). A missing match raises.
"""
import csv, datetime as dt, re
from pathlib import Path
import xml.etree.ElementTree as ET

R = Path(__file__).resolve().parent
RAW = R / 'raw'

DOCS = {}  # key -> (url, label)
def doc(key, url, label):
    DOCS[key] = (url, label)

M = 'https://www.am.mufg.jp/pdf'
D = 'https://www.daiwa-am.co.jp/funds/doc_open/fund_doc_open.php?code='
RK = 'https://www.rakuten-toushin.co.jp/fund/nav'
S = 'https://www.sbiam.co.jp/fund/pdf'
doc('orcan_P', f'{M}/koumokuromi/253425/253425_20260725.pdf', 'eMAXIS Slim 全世界株式（オール・カントリー）交付目論見書（使用開始日2026年7月25日）')
doc('orcan_Ak', f'{M}/kouunyou/253425/253425_20260427_k.pdf', 'eMAXIS Slim 全世界株式（オール・カントリー）交付運用報告書（2026年4月27日決算）')
doc('orcan_M', f'{M}/geppou/253425/253425_202608.pdf', 'eMAXIS Slim 全世界株式（オール・カントリー）月次レポート（2026年8月31日現在）')
doc('esen_P', f'{M}/koumokuromi/252653/252653_20260725.pdf', 'eMAXIS Slim 先進国株式インデックス（除く日本）交付目論見書（使用開始日2026年7月25日）')
doc('esen_Ak', f'{M}/kouunyou/252653/252653_20260427_k.pdf', 'eMAXIS Slim 先進国株式インデックス 交付運用報告書（2026年4月27日決算）')
doc('esen_M', f'{M}/geppou/252653/252653_202608.pdf', 'eMAXIS Slim 先進国株式インデックス（除く日本）月次レポート（2026年8月31日現在）')
doc('tawara_P', 'https://www.am-one.co.jp/fund/pdf/313125/313125_pr_d.pdf', 'たわらノーロード 先進国株式 交付目論見書（使用開始日2026年7月15日）')
doc('tawara_Ak', 'https://www.am-one.co.jp/fund/pdf/313125/313125_r_d.pdf', 'たわらノーロード 先進国株式 交付運用報告書（作成対象期間2024年10月16日〜2025年10月14日）')
doc('fang_P', f'{D}3346&type=1', 'iFreeNEXT FANG+インデックス 交付目論見書（使用開始日2026年4月24日）')
doc('fang_Ak', f'{D}3346&type=4', 'iFreeNEXT FANG+インデックス 交付運用報告書（作成対象期間2025年1月31日〜2026年1月30日）')
doc('fang_M', f'{D}3346&type=6', 'iFreeNEXT FANG+インデックス 月次レポート（2026年8月末基準）')
doc('dindia_P', f'{D}3484&type=1', 'iFreeNEXT インド株インデックス 交付目論見書（使用開始日2026年6月6日）')
doc('dindia_Ak', f'{D}3484&type=4', 'iFreeNEXT インド株インデックス 交付運用報告書（作成対象期間2025年3月13日〜2026年3月12日）')
doc('dindia_M', f'{D}3484&type=6', 'iFreeNEXT インド株インデックス 月次レポート（2026年8月31日基準）')
doc('riinf50_P', f'{RK}/riinf50/pdf/riinf50_P.pdf', '楽天・インド株Nifty50インデックス・ファンド 交付目論見書（使用開始日2026年5月15日）')
doc('riinf50_Ak', f'{RK}/riinf50/pdf/riinf50_Ak.pdf', '楽天・インド株Nifty50インデックス・ファンド 交付運用報告書（作成対象期間2025年2月18日〜2026年2月16日）')
doc('riinf50_M', f'{RK}/riinf50/pdf/riinf50_M202608.pdf', '楽天・インド株Nifty50インデックス・ファンド 月次レポート（2026年8月）')
doc('risude_P', f'{RK}/risude/pdf/risude_P.pdf', '楽天・シュワブ・高配当株式・米国ファンド（四半期決算型）交付目論見書（使用開始日2026年5月26日）')
doc('risude_Ak', f'{RK}/risude/pdf/risude_Ak.pdf', '楽天・シュワブ・高配当株式・米国ファンド（四半期決算型）交付運用報告書（作成対象期間2025年8月26日〜2026年2月25日）')
doc('risude_M', f'{RK}/risude/pdf/risude_M202608.pdf', '楽天・シュワブ・高配当株式・米国ファンド（四半期決算型）月次レポート（2026年8月31日作成基準）')
doc('rivuh_P', f'{RK}/rivuh/pdf/rivuh_P.pdf', '楽天・米国高配当株式インデックス・ファンド 交付目論見書（使用開始日2026年4月16日）')
doc('rivuh_Ak', f'{RK}/rivuh/pdf/rivuh_Ak.pdf', '楽天・米国高配当株式インデックス・ファンド 交付運用報告書（第9期 2026年7月15日決算）')
doc('rivuh_M', f'{RK}/rivuh/pdf/rivuh_M202608.pdf', '楽天・米国高配当株式インデックス・ファンド 月次レポート（2026年8月）')
doc('ricgld_P', f'{RK}/ricgld/pdf/ricgld_P.pdf', '楽天・ゴールド・ファンド（為替ヘッジあり）／（為替ヘッジなし）交付目論見書（使用開始日2026年1月13日）')
doc('ricgld_M', f'{RK}/ricgld/pdf/ricgld_M202608.pdf', '楽天・ゴールド・ファンド 月次レポート（2026年8月31日作成基準）')
doc('yuki_P', f'{S}/8931217C_zensekaikabu_koufu_20260813.pdf', 'SBI・全世界株式インデックス・ファンド 交付目論見書（使用開始日2026年8月13日）')
doc('yuki_Ak', f'{S}/8931217C_zensekaikabu_koufuunpou_20251112.pdf', 'SBI・全世界株式インデックス・ファンド 交付運用報告書（第8期 2025年11月12日決算）')
doc('yuki_M', f'{S}/8931217C_zensekaikabu_mr_2608.pdf', 'SBI・全世界株式インデックス・ファンド 月次レポート（2026年8月31日基準）')
doc('svym_P', f'{S}/89311241_ushighdiveq_koufu_20260821.pdf', 'SBI・V・米国高配当株式インデックス・ファンド（年4回決算型）交付目論見書（使用開始日2026年8月21日）')
doc('svym_Ak', f'{S}/89313236_us%20highdiv_dis4_koufuunpou_20260520.pdf', 'SBI・V・米国高配当株式インデックス・ファンド（年4回決算型）交付運用報告書（作成対象期間2025年11月21日〜2026年5月20日）')
doc('svym_M', f'{S}/89311241_us%20highdiv4_mr_2608.pdf', 'SBI・V・米国高配当株式インデックス・ファンド（年4回決算型）月次レポート（2026年8月31日基準）')
doc('sgold_P', f'{S}/8931A236_gold%20fund%20hedged_unhedged_koufu_202609.pdf', 'SBI・iシェアーズ・ゴールドファンド（為替ヘッジあり）／（為替ヘッジなし）交付目論見書（使用開始日2026年9月11日）')
doc('sgold_Ak', f'{S}/360007_ish_gold_%20koufuunpou_20260610.pdf', 'SBI・iシェアーズ・ゴールドファンド 交付運用報告書（第3期 2026年6月10日決算）')

# NAV data (issuer-published; the SBI funds are WealthAdvisor XML feeds, see compare.xml_nav)
NAV = {
    'orcan': ('mufg_253425.csv', 'https://www.am.mufg.jp/fund_file/setteirai/253425.csv'),
    'emaxis-sensinkoku': ('mufg_252653.csv', 'https://www.am.mufg.jp/fund_file/setteirai/252653.csv'),
    'tawara-sensinkoku': ('amone_313125.json', 'https://www.am-one.co.jp/chart_data/313125/dat.json'),
    'fang': ('daiwa_3346.csv', 'https://www.daiwa-am.co.jp/funds/detail/csv_out.php?code=3346&type=1'),
    'ifreenext-india': ('daiwa_3484.csv', 'https://www.daiwa-am.co.jp/funds/detail/csv_out.php?code=3484&type=1'),
    'rakuten-india': ('rakuten_100098.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100098.csv'),
    'rakuten-schd': ('rakuten_100105.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100105.csv'),
    'rakuten-vym': ('rakuten_100035.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100035.csv'),
    'rakuten-gold': ('rakuten_100123.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100123.csv'),
    'sbi-yukidaruma': ('sbi_2017120601.xml', 'https://apl.wealthadvisor.jp/xml/chart/funddata/2017120601.xml'),
    'sbi-vym4': ('sbi_2024013001.xml', 'https://apl.wealthadvisor.jp/xml/chart/funddata/2024013001.xml'),
    'sbi-gold': ('sbi_202306080A.xml', 'https://apl.wealthadvisor.jp/xml/chart/funddata/202306080A.xml'),
}

_cache = {}
def text(key):
    if key not in _cache:
        _cache[key] = re.sub(r'\s+', ' ', (RAW / f'{key}.txt').read_text())
    return _cache[key]

def Q(key, pattern):
    """Verbatim (whitespace-collapsed) excerpt of document `key` matching `pattern`."""
    m = re.search(pattern, text(key))
    if not m:
        raise ValueError(f'quote not found in {key}: {pattern}')
    return m.group(0).strip()

def url(key):
    return DOCS[key][0]

def nav_rows(fund, *dates):
    """Verbatim rows of the issuer NAV file for the given dates (YYYY-MM-DD)."""
    f, u = NAV[fund]
    p = R / f
    out = []
    if p.suffix == '.csv':
        raw = p.read_bytes()
        try:
            s = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            s = raw.decode('cp932')
        lines = s.splitlines()
        header = next(l for l in lines if l.startswith('基準日'))
        out.append(header)
        for d in dates:
            keys = (d.replace('-', '/'), d.replace('-', ''))
            out.append(next(l for l in lines if l.split(',')[0] in keys))
    elif p.suffix == '.xml':
        s = p.read_bytes().decode('cp932')
        for d in dates:
            y, m, dd = d.split('-')
            out.append(re.search(rf'<day value="{dd}" year="{y}" month="{m}"[^>]*/>', s).group(0))
    else:
        s = p.read_text()
        for d in dates:
            t = int(dt.datetime.strptime(d, '%Y-%m-%d').timestamp() * 1000)
            out.append(re.search(rf'\[{t},\d+(?:\.\d+)?\]', s.split('"standard_price2"')[1]).group(0))
        out.insert(0, '"standard_price2"')
    return ' / '.join(out), u
