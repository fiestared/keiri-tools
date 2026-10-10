"""Verbatim source access for the 2026-10-03 fund comparison batch.

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
doc('risude_P', f'{RK}/risude/pdf/risude_P.pdf', '楽天・シュワブ・高配当株式・米国ファンド（四半期決算型）交付目論見書（使用開始日2026年5月26日）')
doc('risude_Ak', f'{RK}/risude/pdf/risude_Ak.pdf', '楽天・シュワブ・高配当株式・米国ファンド（四半期決算型）交付運用報告書（作成対象期間2025年8月26日〜2026年2月25日）')
doc('risude_M', f'{RK}/risude/pdf/risude_M202608.pdf', '楽天・シュワブ・高配当株式・米国ファンド（四半期決算型）月次レポート（2026年8月31日作成基準）')
doc('svym_P', f'{S}/89311241_ushighdiveq_koufu_20260821.pdf', 'SBI・V・米国高配当株式インデックス・ファンド（年4回決算型）交付目論見書（使用開始日2026年8月21日）')
doc('svym_Ak', f'{S}/89313236_us%20highdiv_dis4_koufuunpou_20260520.pdf', 'SBI・V・米国高配当株式インデックス・ファンド（年4回決算型）交付運用報告書（作成対象期間2025年11月21日〜2026年5月20日）')
doc('svym_M', f'{S}/89311241_us%20highdiv4_mr_2608.pdf', 'SBI・V・米国高配当株式インデックス・ファンド（年4回決算型）月次レポート（2026年8月31日基準）')
doc('svy1_P', f'{S}/89312216_us%20highdiv_koufu_20260411.pdf', 'SBI・V・米国高配当株式インデックス・ファンド 交付目論見書（使用開始日2026年4月11日）')
doc('svy1_Ak', f'{S}/89312216_us%20highdiv_koufuunpou_2026_07_13.pdf', 'SBI・V・米国高配当株式インデックス・ファンド 交付運用報告書（第5期・作成対象期間2025年7月12日〜2026年7月13日）')
doc('svy1_M', f'{S}/89312216_us%20highdiv_mr_2608.pdf', 'SBI・V・米国高配当株式インデックス・ファンド 月次レポート（2026年8月31日基準）')
doc('sspyd_P', f'{S}/26b89ec6cb0527ad0db83873046cd898fa7d9d6a.pdf', 'SBI・SPDR・S&P500高配当株式インデックス・ファンド（年4回決算型）交付目論見書（使用開始日2026年8月21日）')
doc('sspyd_Ak', f'{S}/89312241_spdrsp500div4_koufuunpou_20260520.pdf', 'SBI・SPDR・S&P500高配当株式インデックス・ファンド（年4回決算型）交付運用報告書（作成対象期間2025年11月21日〜2026年5月20日）')
doc('sspyd_M', f'{S}/89312241_spdrsp500div4_mr_2608.pdf', 'SBI・SPDR・S&P500高配当株式インデックス・ファンド（年4回決算型）月次レポート（2026年8月31日基準）')
doc('sjhd_P', f'{S}/705395f7975c0cab63fc547b1d0871688c1e9f92.pdf', 'SBI日本高配当株式（分配）ファンド（年4回決算型）交付目論見書（使用開始日2026年7月11日）')
doc('sjhd_Ak', f'{S}/8931123C_japanhighdiveq_dis4_koufuunpou_20260410.pdf', 'SBI日本高配当株式（分配）ファンド（年4回決算型）交付運用報告書（作成対象期間2025年10月11日〜2026年4月10日）')
doc('sjhd_M', f'{S}/8931123C_japanhighdiveq_dis4_mr_2608.pdf', 'SBI日本高配当株式（分配）ファンド（年4回決算型）月次レポート（2026年8月31日基準）')
doc('risjde_P', f'{RK}/risjde/pdf/risjde_P.pdf', '楽天・高配当株式・日本ファンド（四半期決算型）交付目論見書（使用開始日2026年9月25日）')
doc('risjde_Ak', f'{RK}/risjde/pdf/risjde_Ak.pdf', '楽天・高配当株式・日本ファンド（四半期決算型）交付運用報告書（作成対象期間2025年12月26日〜2026年6月25日）')
doc('risjde_M', f'{RK}/risjde/pdf/risjde_M202608.pdf', '楽天・高配当株式・日本ファンド（四半期決算型）月次レポート（2026年8月31日作成基準）')
doc('eemg_P', f'{M}/koumokuromi/252878/252878_20260725.pdf', 'eMAXIS Slim 新興国株式インデックス 交付目論見書（使用開始日2026年7月25日）')
doc('eemg_Ak', f'{M}/kouunyou/252878/252878_20260427_k.pdf', 'eMAXIS Slim 新興国株式インデックス 交付運用報告書（2026年4月27日決算）')
doc('eemg_M', f'{M}/geppou/252878/252878_202608.pdf', 'eMAXIS Slim 新興国株式インデックス 月次レポート（2026年8月31日現在）')
doc('temg_P', 'https://www.am-one.co.jp/fund/pdf/313128/313128_pr_d.pdf', 'たわらノーロード 新興国株式 交付目論見書（使用開始日2026年7月15日）')
doc('temg_Ak', 'https://www.am-one.co.jp/fund/pdf/313128/313128_r_d.pdf', 'たわらノーロード 新興国株式 交付運用報告書（作成対象期間2024年10月16日〜2025年10月14日）')
doc('temg_M', 'https://www.am-one.co.jp/fund/pdf/313128/313128_mr.pdf', 'たわらノーロード 新興国株式 マンスリーレポート（2026年8月31日基準）')
doc('ebal_P', f'{M}/koumokuromi/252760/252760_20260725.pdf', 'eMAXIS Slim バランス（8資産均等型）交付目論見書（使用開始日2026年7月25日）')
doc('ebal_Ak', f'{M}/kouunyou/252760/252760_20260427_k.pdf', 'eMAXIS Slim バランス（8資産均等型）交付運用報告書（2026年4月27日決算）')
doc('ebal_M', f'{M}/geppou/252760/252760_202608.pdf', 'eMAXIS Slim バランス（8資産均等型）月次レポート（2026年8月31日現在）')
doc('tbal_P', 'https://www.am-one.co.jp/fund/pdf/313144/313144_pr_d.pdf', 'たわらノーロード バランス（8資産均等型）交付目論見書（使用開始日2026年7月15日）')
doc('tbal_Ak', 'https://www.am-one.co.jp/fund/pdf/313144/313144_r_d.pdf', 'たわらノーロード バランス（8資産均等型）交付運用報告書（作成対象期間2024年10月16日〜2025年10月14日）')
doc('tbal_M', 'https://www.am-one.co.jp/fund/pdf/313144/313144_mr.pdf', 'たわらノーロード バランス（8資産均等型）マンスリーレポート（2026年8月31日基準）')
doc('rirsox_P', f'{RK}/rirsox/pdf/rirsox_P.pdf', '楽天・プラス・ＳＯＸインデックス・ファンド 交付目論見書（使用開始日2026年7月16日）')
doc('rirsox_Ak', f'{RK}/rirsox/pdf/rirsox_Ak.pdf', '楽天・プラス・ＳＯＸインデックス・ファンド 交付運用報告書（第2期・作成対象期間2024年10月16日〜2025年10月15日）')
doc('rirsox_M', f'{RK}/rirsox/pdf/rirsox_M202608.pdf', '楽天・プラス・ＳＯＸインデックス・ファンド 月次レポート（2026年8月31日作成基準）')
doc('rirndx_P', f'{RK}/rirndx/pdf/rirndx_P.pdf', '楽天・プラス・ＮＡＳＤＡＱ－１００インデックス・ファンド 交付目論見書（使用開始日2026年7月16日）')
doc('rirndx_Ak', f'{RK}/rirndx/pdf/rirndx_Ak.pdf', '楽天・プラス・ＮＡＳＤＡＱ－１００インデックス・ファンド 交付運用報告書（第2期・作成対象期間2024年10月16日〜2025年10月15日）')
doc('rirndx_M', f'{RK}/rirndx/pdf/rirndx_M202608.pdf', '楽天・プラス・ＮＡＳＤＡＱ－１００インデックス・ファンド 月次レポート（2026年8月31日作成基準）')
doc('rivuh_P', f'{RK}/rivuh/pdf/rivuh_P.pdf', '楽天・米国高配当株式インデックス・ファンド 交付目論見書（使用開始日2026年4月16日）')
doc('rivuh_Ak', f'{RK}/rivuh/pdf/rivuh_Ak.pdf', '楽天・米国高配当株式インデックス・ファンド 交付運用報告書（第9期・作成対象期間2025年7月16日〜2026年7月15日）')
doc('rivuh_M', f'{RK}/rivuh/pdf/rivuh_M202608.pdf', '楽天・米国高配当株式インデックス・ファンド 月次レポート（2026年8月31日作成基準）')
doc('rijepi_P', f'{RK}/rijepi/pdf/rijepi_P.pdf', '楽天・米国大型株式・プレミアム・インカム・ファンド（毎月決算型）交付目論見書（使用開始日2026年4月27日）')
doc('rijepi_Ak', f'{RK}/rijepi/pdf/rijepi_Ak.pdf', '楽天・米国大型株式・プレミアム・インカム・ファンド（毎月決算型）交付運用報告書（第1期・作成対象期間2026年5月11日〜2026年7月15日）')
doc('rijepi_M', f'{RK}/rijepi/pdf/rijepi_M202608.pdf', '楽天・米国大型株式・プレミアム・インカム・ファンド（毎月決算型）月次レポート（2026年8月31日作成基準）')
doc('enk_P', f'{M}/koumokuromi/253144/253144_20260725.pdf', 'eMAXIS Slim 国内株式（日経平均）交付目論見書（使用開始日2026年7月25日）')
doc('enk_Ak', f'{M}/kouunyou/253144/253144_20260427_k.pdf', 'eMAXIS Slim 国内株式（日経平均）交付運用報告書（作成対象期間2025年4月26日〜2026年4月27日）')
doc('enk_M', f'{M}/geppou/253144/253144_202609.pdf', 'eMAXIS Slim 国内株式（日経平均）月次レポート（2026年9月30日現在）')
doc('tnk_P', 'https://www.am-one.co.jp/fund/pdf/313122/313122_pr_d.pdf', 'たわらノーロード 日経225 交付目論見書（使用開始日2026年7月15日）')
doc('tnk_Ak', 'https://www.am-one.co.jp/fund/pdf/313122/313122_r_d.pdf', 'たわらノーロード 日経225 交付運用報告書（作成対象期間2024年10月16日〜2025年10月14日）')
doc('tnk_M', 'https://www.am-one.co.jp/fund/pdf/313122/313122_mr.pdf', 'たわらノーロード 日経225 マンスリーレポート（2026年9月30日基準）')
doc('spdji_hd', 'https://www.spglobal.com/spdji/en/documents/methodologies/methodology-sp-high-dividend-indices.pdf', 'S&P Dow Jones Indices：S&P High Dividend Indices Methodology（2026年10月7日に確認）')
doc('nq_sox', 'https://indexes.nasdaqomx.com/docs/Methodology_SOX.pdf', 'Nasdaq：PHLX Semiconductor Sector Index（SOX）Index Methodology（2026年10月6日に確認）')
doc('nq_ndx', 'https://indexes.nasdaqomx.com/docs/Methodology_NDX.pdf', 'Nasdaq：Nasdaq-100 Index（NDX）Index Methodology（2026年10月6日に確認）')

# NAV data (issuer-published; the SBI funds are WealthAdvisor XML feeds, see compare.xml_nav)
NAV = {
    'sbi-jhd': ('sbi_2023121201.xml', 'https://apl.wealthadvisor.jp/xml/chart/funddata/2023121201.xml'),
    'rakuten-jhd': ('rakuten_100111.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100111.csv'),
    'sbi-spyd4': ('sbi_2024013002.xml', 'https://apl.wealthadvisor.jp/xml/chart/funddata/2024013002.xml'),
    'sbi-vym4': ('sbi_2024013001.xml', 'https://apl.wealthadvisor.jp/xml/chart/funddata/2024013001.xml'),
    'rakuten-schd': ('rakuten_100105.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100105.csv'),
    'emaxis-emg': ('mufg_252878.csv', 'https://www.am.mufg.jp/fund_file/setteirai/252878.csv'),
    'tawara-emg': ('amone_313128.json', 'https://www.am-one.co.jp/chart_data/313128/dat.json'),
    'emaxis-bal8': ('mufg_252760.csv', 'https://www.am.mufg.jp/fund_file/setteirai/252760.csv'),
    'tawara-bal8': ('amone_313144.json', 'https://www.am-one.co.jp/chart_data/313144/dat.json'),
    'rakuten-sox': ('rakuten_100092.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100092.csv'),
    'rakuten-vym': ('rakuten_100035.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100035.csv'),
    'rakuten-jepi': ('rakuten_100127.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100127.csv'),
    'emaxis-nk': ('mufg_253144.csv', 'https://www.am.mufg.jp/fund_file/setteirai/253144.csv'),
    'tawara-nk': ('amone_313122.json', 'https://www.am-one.co.jp/chart_data/313122/dat.json'),
    'sbi-vym1': ('sbi_2021062902.xml', 'https://apl.wealthadvisor.jp/xml/chart/funddata/2021062902.xml'),
    'rakuten-ndx': ('rakuten_100091.csv', 'https://www.rakuten-toushin.co.jp/assets/csv/chart_100091.csv'),
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
