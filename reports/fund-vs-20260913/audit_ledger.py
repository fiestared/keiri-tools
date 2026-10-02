"""Claims ledgers (claims/column/<slug>.json) for the 2026-09-13 fund comparison pages.

Added by the 2026-10-02 audit. The article bodies are single long lines, so any edit makes
check_claims require every number of the page. This script writes one ledger per page:
each number is tied to a verbatim excerpt of the issuer document saved in raw/*_P.txt
(pdftotext -layout of the prospectus fetched 2026-10-02) or to rows of the saved NAV data.
A number that cannot be located in a saved source stops the run (no invented quotes).
"""
import csv, datetime as dt, json, re, sys
from pathlib import Path
from catalog import funds, selected, R
from build_articles import articles, RESULT, SENS, jdate
import expand_articles
ROOT = R.parents[1]
RAW = R / 'raw'
CHECKED = '2026-10-02'
M = 'https://www.am.mufg.jp/pdf/koumokuromi/'
RK = 'https://www.rakuten-toushin.co.jp/fund/nav/'
S = 'https://www.sbiam.co.jp/fund/pdf/'
P_URL = {
    'orcan': M + '253425/253425_20260725.pdf', 'emaxis-sp': M + '253266/253266_20260725.pdf',
    'topix': M + '252634/252634_20260725.pdf', 'nikkei': M + '253144/253144_20260725.pdf',
    'mufg-gold': M + '251065/251065_20260418.pdf',
    'rakuten-orcan': RK + 'riracwi/pdf/riracwi_P.pdf', 'rakuten-sp': RK + 'rirsp500/pdf/rirsp500_P.pdf',
    'rakuten-vti': RK + 'rivue/pdf/rivue_P.pdf', 'rakuten-nasdaq': RK + 'rirndx/pdf/rirndx_P.pdf',
    'rakuten-bull': RK + 'ribla43/pdf/ribla43_P.pdf',
    'sbi-sp': S + '89311199_S%26P500_koufu_20260617.pdf', 'sbi-vti': S + '89311216_us%20all_koufu_20260411.pdf',
    'sbi-nasdaq': S + '89311265_NASDAQ100_koufu_20260507.pdf', 'sbi-bull': S + '8931417C_4.3bull_koufu_20260905.pdf',
    'sbi-gold': S + '8931A236_gold%20fund%20hedged_unhedged_koufu_202609.pdf',
    'fang': 'https://www.daiwa-am.co.jp/funds/doc_open/fund_doc_open.php?code=3346&type=1',
    'invesco': 'https://jppdf.invesco.com/Prospectus/kofu312901.pdf',
}
WA = 'https://apl.wealthadvisor.jp/xml/chart/funddata/'
NAV = {
    'orcan': ('https://www.am.mufg.jp/fund_file/setteirai/253425.csv', 'orcan.csv'),
    'emaxis-sp': ('https://www.am.mufg.jp/fund_file/setteirai/253266.csv', 'emaxis-sp.csv'),
    'topix': ('https://www.am.mufg.jp/fund_file/setteirai/252634.csv', 'topix.csv'),
    'nikkei': ('https://www.am.mufg.jp/fund_file/setteirai/253144.csv', 'nikkei.csv'),
    'rakuten-orcan': (RK + 'riracwi/', 'rakuten-orcan.csv'), 'rakuten-sp': (RK + 'rirsp500/', 'rakuten-sp.csv'),
    'rakuten-vti': (RK + 'rivue/', 'rakuten-vti.csv'), 'rakuten-nasdaq': (RK + 'rirndx/', 'rakuten-nasdaq.csv'),
    'rakuten-bull': (RK + 'ribla43/', 'rakuten-bull.csv'),
    'fang': ('https://www.daiwa-am.co.jp/funds/detail/csv_out.php?code=3346&type=1', 'fang.csv'),
    'sbi-sp': (WA + '2019092601.xml', 'sbi-sp.xml'), 'sbi-vti': (WA + '2021062901.xml', 'sbi-vti.xml'),
    'sbi-nasdaq': (WA + '2026052101.xml', 'sbi-nasdaq.xml'), 'sbi-bull': (WA + '2017121901.xml', 'sbi-bull.xml'),
    'invesco': (WA + '1999010702.xml', 'invesco.xml'),
}
HALF = str.maketrans('０１２３４５６７８９％．，', '0123456789%.,')
_text = {}
def text(key):
    if key not in _text:
        _text[key] = re.sub(r'\s+', ' ', (RAW / (key + '_P.txt')).read_text())
    return _text[key]
def quote(key, token, width=70, nth=0):
    """Verbatim window of the saved prospectus text around `token` (full-width digits matched too)."""
    token = token.rstrip('%')   # 目論見書は「0.08140％」「1.243 %」のように書くことがあるので数字の部分で探す
    t = text(key); h = t.translate(HALF); hits = [m.start() for m in re.finditer(r'(?<![0-9.])' + re.escape(token), h)]
    if len(hits) <= nth: return None
    i = hits[nth]
    return t[max(0, i - width): i + len(token) + width].strip()
def qre(key, pattern):
    t = text(key); m = re.search(pattern.translate(HALF), t.translate(HALF))   # 全角の数字・％も同じ位置で照合し、原文のまま切り出す
    assert m, (key, pattern)
    return t[m.start():m.end()]
def nav_rows(key, dates):
    url, name = NAV[key]; raw = (R / name).read_bytes().decode('cp932', errors='replace'); out = []
    for d in dates:
        y, m, dd = d.split('-')
        if name.endswith('.xml'):
            hit = re.search(r'<day value="%s" year="%s" month="%s"[^>]*/>' % (dd, y, m), raw)
        else:
            hit = re.search(r'^(?:%s/%s/%s|%s%s%s),.*$' % (y, m, dd, y, m, dd), raw, re.M)
        assert hit, (key, d)
        out.append(hit.group(0).strip())
    return url, ' / '.join(out)
def doc_label(key):
    f = funds[key]; return f"{f['name']} 交付目論見書（使用開始日{f['prospectus']}）"
pct = lambda v: f'{abs(v) * 100:.2f}%'

class Ledger:
    def __init__(self, slug):
        self.slug = slug; self.claims = []; self.absolutes = []
    def add(self, cid, text_, numbers, url, q, applies, exceptions, scope, kind=None):
        assert q and len(q.strip()) >= 8, (self.slug, cid)
        c = {'id': 'audit-' + cid, 'text': text_, 'numbers': sorted(set(numbers)), 'applies': applies, 'source_url': url,
             'source_quote': q, 'exceptions': exceptions, 'scope': scope}
        if kind: c['kind'] = kind
        self.claims.append(c)

def fund_claims(L, key, extra_numbers=()):
    """Fee / total-expense-ratio / lending / hedge statements of one fund, each with its prospectus excerpt."""
    f = funds[key]; ap = f'{CHECKED}に確認した{doc_label(key)}'; url = P_URL[key]
    who = f"{f['name']}の保有者（交付目論見書の「ファンドの費用」の記載）"
    nums, quotes = [], []
    cand = [f"{f['fee']:.5f}".rstrip('0').rstrip('.') + '%']
    if f['domestic'] is not None: cand.append(f"{f['domestic']}%")
    cand += list(extra_numbers)
    for n in cand:
        q = quote(key, n)
        assert q, (key, n, 'not in prospectus text')
        nums.append(n); quotes.append(q)
    L.add('fee-' + key, f"{f['short']}の運用管理費用（信託報酬）の率", nums, url, ' ／ '.join(dict.fromkeys(quotes)), ap,
          '税込年率。段階制のファンドは純資産総額の区分ごとに率が異なり、表の率は最も高い区分の率（「以内」と表示）。ETFを使うファンドは投資先の報酬を加えた概算で、目論見書も「程度」としている。購入時手数料・信託財産留保額・売買委託手数料等は別（同じ節）。', who)
    if f['ter'] is not None:
        n = (f"{f['ter']:.5f}" if f['ter2'] else f"{f['ter']:.2f}") + '%'
        nums = [n] + ([f['ter2']] if f['ter2'] else [])
        qs = [quote(key, n, 60)] if f['ter2'] else []
        for x in nums:
            q = qre(key, r'総経費率 ?（ ?①＋② ?）.{0,140}')
            assert q, (key, x); qs.append(q)
        L.add('ter-' + key, f"{f['short']}の総経費率（対象期間 {f['period']}）", nums, url, ' ／ '.join(dict.fromkeys(qs)), ap,
              '直近の運用報告書の作成対象期間の実績で、交付目論見書の（参考情報）欄の値。原則として購入時手数料・売買委託手数料・有価証券取引税を含まない（同じ欄の注）。投資先ファンドの費用を含む旨の注があるファンドはその値。将来の費用を示すものではない。', who)
    if f['lend'] == 'add':
        q = qre(key, r'(?:この場合、 ?)?(?:（税抜 ?45\.0％） ?)?ファンドの品貸料.{0,90}?以内の額が上記の運用管理費 ?用.{0,30}?に追加されます。')
        L.add('lend-' + key, f"{f['short']}：有価証券の貸付の指図を行った場合の品貸料の扱い", re.findall(r'[0-9.]+%', f['lend_rate']), url, q, ap,
              '有価証券の貸付の指図を行った場合だけの定めで、運用管理費用（信託報酬）に追加される額。貸付を行わない場合は追加されない。率は「以内」の上限で、実際に追加された額は交付目論見書からは分からない。', who)
    elif f['lend'] == 'rk':
        q = qre(key, r'・貸付有価証券関連報酬：有価証券の貸.{0,170}?品貸料に0\.55 ?（税抜0\.5） ?を乗 ?じて得た額')
        L.add('lend-' + key, f"{f['short']}：貸付有価証券関連報酬（その他の費用・手数料の一項目）", [], url, q, ap,
              '有価証券の貸付取引を行った場合だけの費用で、運用管理費用（信託報酬）とは別の「その他の費用・手数料」の項目。抽出テキストは2段組のため隣の段の注記が行単位で混ざる（右段の「貸付有価証券関連報酬：…品貸料に0.55（税抜0.5）を乗じて得た額」が該当）。', who)
    else:
        assert '品貸' not in re.sub(r'\s+', '', text(key)), key
        q = quote(key, cand[0])
        L.add('nolend-' + key, f"{f['short']}の交付目論見書に品貸料についての記載が無い", [], url, q, ap,
              '交付目論見書の抽出テキスト全文（空白を除く）を「品貸」で検索して0件であることを確認した（この生成のたびに assert で確かめる）。source_quote は同じ資料の運用管理費用（信託報酬）の欄で、ここに貸付時の追加の定めが無い。「有価証券の貸付等」の決済不履行リスクの記載だけがある資料も「記載なし」に含めた。', who)
    if f['hedge']:
        pat = {'原則なし': r'原則として、? ?(?:対円での ?)?為替ヘッジ[はを] ?行な?いません|為替ヘッジは原則として行な?いません', 'なし': r'(?:実質)?組入外貨建資産については、為替ヘッジ[はを]行いません'}[f['hedge']]
        q = qre(key, pat)
        L.add('hedge-' + key, f"{f['short']}の為替ヘッジの方針（{f['hedge']}）", [], url, q, ap,
              '「原則として」とある資料は、資金動向・市況動向等によっては方針どおりの運用ができない場合がある旨を同じ資料に書いている。「行いません」とだけ書く資料には留保の語が無いので、表では「なし」とした。', who)
        if f['hedge'] == '原則なし':
            pass

def perf_claims(L, a, names, pairkey, title):
    r = RESULT[pairkey]; s = SENS[pairkey]; ka, kb = pairkey.split('__'); one = r['1年窓']; full = r['年数'] >= 1
    period = f"{r['起点']}〜{r['終点']}"
    ap = f'{period}の基準価額（2026-09-13取得の保存データ）'
    ex = '税引前の分配金を再投資した基準価額による計算で、購入・換金時の手数料と投資者の税金は含まない（本文の計算条件に明記）。過去の特定の期間の実績で、将来の成果を示さない。最大下落率は比較期間内の日次の値。'
    for side, k, nm in (('A', ka, names[0]), ('B', kb, names[1])):
        nums = [pct(r[side + '累積']), f"{r[side + '100万円終価']:,}円", pct(r[side + '最大下落率'])]
        dates = [r['起点'], r['終点']]
        if full: nums += [pct(r[side + '年率']), pct(one[side + '累積'])]; dates.append(one['起点'])
        url, q = nav_rows(k, dates)
        L.add('perf' + side, f'{nm}の{period}の分配金再投資基準価額による累積騰落率・年率・終了時評価額・最大下落率・直近1年騰落率', nums, url, q, ap, ex,
              f'{nm}を{r["起点"]}に100万円一括で買い、{r["終点"]}まで保有した場合（売却前・税引前分配金再投資）')
    sh = s['起点をずらした場合']; nums = ['100万円', f"{abs(r['A100万円終価'] - r['B100万円終価']):,}円", '2023年9月11日', jdate(r['起点']), jdate(r['終点'])] + list(PERF_EXTRA.get(L.slug, []))
    if full: nums += [f"{s['暦日数']:,}" if s['暦日数'] >= 1000 else f"{s['暦日数']}日", '25日']
    else: nums += ['1年未満', '1日']
    dates = [r['起点'], r['終点']]
    if s['起点がデータ初日']:
        nums += [jdate(r['起点']), jdate(sh[1]['起点']), pct(sh[1]['A累積']), pct(sh[1]['B累積'])]; dates.append(sh[1]['起点'])
        for fl in s['順序が入れ替わる起点'][:1]:
            x = next(v for v in sh if v['起点'] == fl); nums += [jdate(fl), pct(x['A累積']), pct(x['B累積'])]; dates.append(fl)
    ua, qa = nav_rows(ka, dates); ub, qb = nav_rows(kb, dates)
    L.add('perf', f'{title}：同じ期間の実績の差、年率換算の日数、起点を動かした場合の結果', nums, ua, f'{names[0]}: {qa} ／ {names[1]}: {qb}（{ub}）', ap,
          ex + '年率は暦日数を365.25日で割った年数による複利換算。起点を動かした値は start-sensitivity.json（保存データからの再計算）で、起点直後の値動きで差や順序が変わる組は本文にその旨を書いた。',
          f'{names[0]}と{names[1]}を同じ日に同じ金額で買って{r["終点"]}まで保有した場合の比較')

def site_claims(L, slug, numbers):
    L.add('site', 'この記事の資料確認日・データ取得日と、対象の選び方（2026年9月7日〜11日の週間ランキング上位10本）', numbers,
          f'https://keiri-tools.com/column/{slug}/', '対象選定には2026年9月7日〜11日の週間買付・販売金額上位10本を使いました。順位は対象を選んだ根拠で、商品の推奨順位ではありません。／2026年9月13日に取得した日次データを使い、2023年9月11日以降、かつ両方のデータがある日だけで比較しました。',
          '2026年9月13日時点', '無し: このサイトの記事の作り方（確認日・比較の起点の決め方・対象の選び方）についての記述で、金融商品の仕様や数値の主張ではない（kind: own_site）。ランキングは週次で上書きされるため再確認できない旨を出典欄に記録として書いている。',
          'この記事の読者（記事の前提条件の説明）', kind='own_site')

ABS_REVIEW = [
    ('原則', '有価証券取引税は原則として含まれません', '交付目論見書の総経費率の注記（原則として購入時手数料・売買委託手数料・有価証券取引税を含まない）を写した。含まれない費用の範囲は各社の注記どおりで、本文は「原則として」を付けたまま書いている。'),
    ('原則', '「原則として行いません」', '交付目論見書の為替ヘッジの文言を引用符つきで写した箇所。原則の外（資金動向・市況動向等により方針どおりの運用ができない場合）は各目論見書に書かれており、もう一方のファンドの「行いません」と書き分けている。'),
    ('必ず', '必ず上回りますか', '「必ずとは言えません」と打ち消している設問と回答。言い切りではない。'),
    ('必ず', '必ずとは言えません', '「必ずとは言えません」と打ち消している回答。言い切りではない。'),
    ('必ず', '必ず小さいとは限りません', '「必ず小さいとは限りません」と打ち消している文。言い切りではない。'),
    ('必ず', '必ず上回るという関係にはなりません', '「必ず上回るという関係にはなりません」と打ち消している文。言い切りではない。'),
    ('必ず', '必ず4.3倍上がりますか', '設問の言い回しで、回答は「日々の値動きについての目標で、複数日の騰落率に4.3を掛けても同じにならない」と打ち消している。'),
]

# 実績の表から本文が丸めて書いた数字（同じ保存データから出る）
PERF_EXTRA = {
    'emaxis-topix-vs-nikkei': ['182万円', '207万円', '20%'],          # 終了時評価額 1,823,810円・2,071,023円の丸め／2本とも最大下落率が20%超
    'rakuten-bull-vs-sbi-bull': ['85%'],                              # 最大下落率 -85.20%・-85.63%（「85%を超える下落」）
}
# Numbers that sit in hand-written paragraphs (mechanism / cost sections). Filled per page below.
EXTRA = {}
def extra(slugs, cid, text_, numbers, src, q, applies, exceptions, scope, kind=None):
    for s in slugs: EXTRA.setdefault(s, []).append((cid, text_, numbers, src, q, applies, exceptions, scope, kind))

PAIRS = {x['slug']: x for x in selected}
def build(slug, art):
    x = PAIRS[slug]; ka, kb = x['a'], x['b']; L = Ledger(slug)
    site_claims(L, slug, ['2026年9月13日', '2026年9月7日', '11日', '2023年9月11日'])
    for k in (ka, kb): fund_claims(L, k)
    if art['pair'] in RESULT: perf_claims(L, art, art['names'], art['pair'], art['title'])
    for (cid, text_, numbers, src, q, applies, exceptions, scope, kind) in EXTRA.get(slug, []):
        if callable(q): q = q()
        L.add(cid, text_, numbers, src, q, applies, exceptions, scope, kind)
    return L

def gap_yen(a, b): return f"{abs(funds[a]['fee'] - funds[b]['fee']) * 10000:,.0f}円"
def setup_extra():
    generic = {a['slug'] for a in expand_articles.new}
    for slug, x in PAIRS.items():
        a, b = x['a'], x['b']; fa, fb = funds.get(a), funds.get(b)
        if slug in ('invesco-sekai-vs-emaxis-orcan', 'orcan-vs-emaxis-sp', 'orcan-hikaku', 'sp500-hikaku', 'sbi-gold-vs-mufg-gold'): continue
        tier = fa['fee_note'].startswith('以内') or fb['fee_note'].startswith('以内')
        gap = {'rakuten-vti-vs-sbi-vti': '682円', 'ifreenext-fang-vs-rakuten-nasdaq': '5,775円'}.get(slug) or (gap_yen(a, b) if slug in generic and not tier else None)
        if gap:
            extra([slug], 'feegap', f"{fa['short']}と{fb['short']}の表示料率の差を100万円・1年間に直した目安", [gap, '1年間', '100万円'], P_URL[a],
                  lambda a=a, b=b: quote(a, f"{funds[a]['fee']:.5f}".rstrip('0').rstrip('.')) + ' ／ ' + quote(b, f"{funds[b]['fee']:.5f}".rstrip('0').rstrip('.')),
                  f'{CHECKED}に確認した2本の交付目論見書', '2本の表示料率の差に100万円を掛けた算術で、保有額が1年間一定という仮定の目安。実際の利益差ではなく、基準価額は日々変わる（本文に明記）。ETFを使うファンドは投資先の報酬を含む概算の率どうしの差。',
                  '2本を同じ金額（100万円）で1年間保有すると仮定した場合の、目論見書の料率差の目安')
        if 'fang' in (a, b) and slug in generic:
            extra([slug], 'fang-weight', 'iFreeNEXT FANG+の対象指数は構成企業への等金額投資で、10社なら調整時点で1社あたり約10%', ['10%'], P_URL['fang'],
                  lambda: qre('fang', r'NYSE FANG＋指数は、 ?これらの企業に等金額投資したポートフォリオで構成されています。') + ' ／ ' + qre('fang', r'※当指数は、四半期.{0,40}ごとに等金額となるようリバランスを行ないます。'),
                  f"{CHECKED}に確認した{doc_label('fang')}", '約10%は「10社へ等金額」からの算術で、リバランス時点の目安。その後は株価の動きで比率が変わる（本文に明記）。構成企業数（10社）は出典欄の ICE の指数定義による。', 'iFreeNEXT FANG+インデックスの対象指数（NYSE FANG+指数）の配分方法')
        if 'sbi-nasdaq' in (a, b):
            extra([slug], 'sbi-nasdaq-first', 'SBI NASDAQ100は2026年5月21日運用開始で初回決算は2027年5月11日。総経費率は未公表（0%ではない）', ['2027年5月11日', '0%', '2026年5月21日'], P_URL['sbi-nasdaq'],
                  lambda: qre('sbi-nasdaq', r'初回決算日は、2027年5月11日（火） ?となります。') + ' ／ ' + qre('sbi-nasdaq', r'ファンドは運用を開始していないため、開示できる情報はありません。') + ' ／ ' + qre('sbi-nasdaq', r'本ファンドは、2026年5月21日より運用開始予定'),
                  f"{CHECKED}に確認した{doc_label('sbi-nasdaq')}", '総経費率は初回決算（2027年5月11日）後の運用報告書まで公表されない。本文の「0%」は「未公表を0%に置き換えられない」という否定の文に出てくる数字で、SBI NASDAQ100の費用が0%という主張ではない。', 'SBI NASDAQ100インデックス・ファンドの保有者・検討者（2026年10月時点で初回決算前）')
        if x['kind'] == 'regional' and slug in generic:
            extra([slug], 'overlap-example', '全世界株と米国株を併用したときの米国比率の計算例（全世界株の米国比率を仮に60%と置いた説明用の仮定）', ['50%', '60%', '100%', '80%'],
                  f'https://keiri-tools.com/column/{slug}/', '全世界株の米国比率を仮に60%と置き、米国株ファンドを50%組み合わせると、全体の米国比率は60%×50%＋100%×50%＝80%になります。60%は仕組みを説明するための仮定で、現在の構成比を示していません。',
                  '仮定の計算例（時点なし）', '無し: 仕組みを説明するための仮定の算術で、ファンドの現在の構成比の主張ではない（本文に「60%は仮定で、現在の構成比を示していません」と明記。kind: own_site）。', 'この記事の読者（併用の考え方の説明）', 'own_site')
    extra(['rakuten-vti-vs-sbi-vti'], 'etf-fee', '楽天VTI・SBI・V・全米株式が投資するETF（VTI）の管理報酬等は年0.03%', ['0.03%'], P_URL['rakuten-vti'],
          lambda: quote('rakuten-vti', '0.03') + ' ／ ' + quote('sbi-vti', '0.03'), f'{CHECKED}に確認した2本の交付目論見書', '投資先ETFの報酬は各目論見書の基準日現在の値で、今後変更になる場合がある（両資料の注）。総経費率にはすでに投資先の費用が含まれるので足し直さない（本文に明記）。', '楽天・全米株式インデックス・ファンドとSBI・V・全米株式インデックス・ファンドの保有者')
    extra(['emaxis-topix-vs-nikkei'], 'faq-wording', 'よくある質問の設問の言い回し（「分散が2倍になりますか」）', ['2倍'], 'https://keiri-tools.com/column/emaxis-topix-vs-nikkei/',
          'Q. 2本とも持てば日本株への分散が2倍になりますか？ A. 構成銘柄が重複するため、単純に2倍にはなりません。', '時点なし', '無し: 設問の言い回しで、数値の主張ではない（回答は「単純に2倍にはなりません」と打ち消している。kind: own_site）。', 'この記事の読者', 'own_site')
    extra(['rakuten-bull-vs-sbi-bull'], 'bull-target', '2本とも日々の基準価額の値動きが日本の株式市場の値動きの概ね4.3倍程度となることを目指す', ['4.3倍'], P_URL['rakuten-bull'],
          lambda: qre('rakuten-bull', r'日々の基準価額の値動きがわが国の株式市場の値動きに対して概ね4\.3倍程度 ?となることを目指して運用を行います。') + ' ／ ' + qre('sbi-bull', r'基準価額の値動きがわが国の株式市場全体の値動きの概ね4\.3倍程度となる投資成果を目指し ?て運用を行います。'),
          f'{CHECKED}に確認した2本の交付目論見書', '倍率は「日々」の値動きについての目標で、複数の営業日にわたる期間では4.3倍にならない（両資料に明記、本文でも説明）。目標どおりの値動きを保証するものではない。', '楽天日本株4.3倍ブル・SBI 日本株4.3ブルの保有者')
    extra(['rakuten-bull-vs-sbi-bull'], 'bull-fee', '購入時手数料の上限（楽天3.3%・SBI2.2%）と、楽天の総経費率の決算日（2026年6月15日）', ['3.3%', '2.2%', '2026年6月15日', '2026年9月16日'], P_URL['rakuten-bull'],
          lambda: qre('rakuten-bull', r'購入時手数料 3\.3%（税抜3%） ?を上限として、販売会社が定め') + ' ／ ' + qre('sbi-bull', r'購入価額に2\.2%（税抜：2\.0%）を上限として販売会社が定') + ' ／ ' + qre('rakuten-bull', r'対象期間：.{0,30}?2026 ?年 ?6 ?月 ?15 ?日 総経費率.{0,60}?1\.30%') + ' ／ ' + qre('rakuten-bull', r'使用開始日：2026 ?年 ?9 ?月 ?16 ?日'),
          f'{CHECKED}に確認した2本の交付目論見書', '購入時手数料は上限で、実際の料率は販売会社が定める（両資料）。総経費率は原則として購入時手数料・売買委託手数料・有価証券取引税を含まない。', '楽天日本株4.3倍ブル・SBI 日本株4.3ブルの購入者・保有者')
    extra(['rakuten-bull-vs-sbi-bull'], 'bull-wording', '説明のための言い回し（3倍型・1倍型はこの表に混ぜていない／1日目・2日目の計算例／1日の変化）', ['3倍', '1倍', '1日', '2日'], 'https://keiri-tools.com/column/rakuten-bull-vs-sbi-bull/',
          '倍率の違う3倍型や通常の1倍型はこの表に混ぜていません。／株式市場が1日目に10%上がり、2日目に約9.09%下がると、100は110を経て100に戻ります。', '時点なし', '無し: 比較の対象範囲の説明と、仕組みを説明するための仮定の計算例で、特定のファンドの数値の主張ではない（kind: own_site）。', 'この記事の読者', 'own_site')
    INV_R = 'https://jppdf.invesco.com/Report/312901.pdf'
    extra(['rakuten-orcan-vs-invesco'], 'invesco-dist', '世界のベスト（為替ヘッジなし・毎月決算型）の2026年2月24日決算の分配金150円の内訳（当期の収益4円・当期の収益以外146円）', ['2026年2月24日', '150円', '146円'], INV_R,
          '2026年1月23日 2026年2月24日 2026年3月23日 2026年4月23日 2026年5月25日 2026年6月23日 ／ 当期の収益 150 4 － 150 143 150 ／ 当期の収益以外 － 146 150 － 6 －',
          '交付運用報告書（作成対象期間2025年12月24日〜2026年6月23日）の＜為替ヘッジなし＞の分配原資の内訳', '1万口当たり・税引前。「当期の収益」「当期の収益以外」は小数点以下切捨てで合計が分配金と一致しない場合がある（同じ表の注）。合冊の前半は＜為替ヘッジあり＞で、ここは後半の＜為替ヘッジなし＞の表。運用報告書上の分配原資の区分は、投資者ごとの税務上の普通分配金・元本払戻金の区分とは別（本文に明記）。', 'インベスコ 世界厳選株式オープン＜為替ヘッジなし＞（毎月決算型）の受益者')
    extra(['rakuten-orcan-vs-invesco'], 'invesco-fees', '世界のベストの購入時手数料の上限3.3%・信託財産留保額0.3%と、分配時の税率20.315%（2026年6月末現在）', ['3.3%', '0.3%', '20.315%', '2026年6月'], P_URL['invesco'],
          lambda: qre('invesco', r'販売会社が定める3\.30％（税抜3\.00％）以内の ?率を乗じて得た額') + ' ／ ' + qre('invesco', r'換金の申込受付日の翌営業日の基準価額に0\.30％の率を乗じて得た額') + ' ／ ' + qre('invesco', r'以下の表は、個人投資家の源泉徴収時の税率であり、課税方法等により異なる場合があります。') + ' ／ ' + qre('invesco', r'普通分配金に対して20\.315％') + ' ／ ' + qre('invesco', r'＊上記税率は2026年６月末現在のものです。'),
          f"{CHECKED}に確認した{doc_label('invesco')}", '購入時手数料は上限で販売会社が定める。20.315%は個人投資家の源泉徴収時の税率（2026年6月末現在）で、課税方法等により異なる場合があり、外国税額控除の適用となった場合は分配時の税金が異なる場合がある。法人・確定拠出年金は異なる。税法が改正された場合は変更される（同じ表の注）。課税されるのは普通分配金で、元本払戻金（特別分配金）は非課税。', 'インベスコ 世界厳選株式オープン＜為替ヘッジなし＞（毎月決算型）を個人の課税口座で保有する場合')

def main(dev=None):
    setup_extra()
    arts = {a['slug']: a for a in articles + expand_articles.new}
    need = json.loads(Path(dev).read_text()) if dev else {}
    bad = 0
    for slug, art in sorted(arts.items()):
        if slug in ('invesco-sekai-vs-emaxis-orcan', 'orcan-vs-emaxis-sp'): continue   # 別担当／書き直し済みで生成器の外
        L = build(slug, art); path = ROOT / 'claims/column' / (slug + '.json')
        if slug == 'sbi-gold-vs-mufg-gold':
            led = json.loads(path.read_text()); have = {c['id'] for c in led['claims']}
            keep = [c for c in L.claims if c['id'].startswith(('audit-lend', 'audit-ter-mufg'))]
            led['claims'] = [c for c in led['claims'] if not c['id'].startswith('audit-')] + keep
        else:
            led = {'page': f'docs/column/{slug}/index.html', 'checked': CHECKED, 'claims': L.claims, 'absolutes': [], 'tool_cases': [],
                   'review_note': '2026-10-02 既存の投信比較記事の見直し（品貸料の条項・為替ヘッジの書き方・総経費率の出所・起点の影響）で作った台帳。数字は保存した交付目論見書の抽出テキストと基準価額データの行に結び付けた。数値そのものの全数再照合（sol/Astra の巡回）は別。'}
        led['absolutes'] = [a for a in led.get('absolutes', []) if not a.get('audit')] + [{'phrase': p, 'context': c, 'reviewed': rv, 'audit': CHECKED} for p, c, rv in ABS_REVIEW + ABS_EXTRA.get(slug, [])]
        if dev:
            have = {re.sub(r'\s+', '', n) for c in led['claims'] for n in c.get('numbers', [])}
            miss = [n for n in need.get(slug, {}).get('numbers', []) if n not in have]
            if miss: bad += 1; print(slug, 'MISSING', miss)
        path.write_text(json.dumps(led, ensure_ascii=False, indent=2) + '\n')
    print('ledgers written', 'missing pages', bad)
ABS_EXTRA = {}

# ── 手書きの3ページ（生成器の外）: orcan-hikaku（既存の台帳に追記）・sp500-hikaku・index-toushi ──
TAWARA_URL = 'https://www.am-one.co.jp/fund/pdf/313161/313161_pr_d.pdf'
def special():
    col = ROOT / 'claims/column'
    # orcan-hikaku: 言い換えた文に合わせて既存の主張の text をそろえ、3本目（たわら）の「記載なし」を足す
    p = col / 'orcan-hikaku.json'; led = json.loads(p.read_text())
    swaps = [('信託報酬の上限と総経費率、', '信託報酬と総経費率、'), ('が上限で年0.05775%で、', 'が年0.05775%以内（純資産総額に応じた段階制で最も高い区分の率）で、'),
             ('0.05775%（純資産総額に応じた段階制の上限）', '0.05775%以内（純資産総額に応じた段階制で最も高い区分の率）'), ('実際の料率は上限より低くなる', '実際の料率は最も高い区分の率より低くなる'),
             ('表の0.05775%は上限の値です。', '表の0.05775%は最も高い区分の率で、有価証券の貸付の指図を行った場合に運用管理費用（信託報酬）に追加される額（「書類に書かれている運用の違い」の表）を含みません。'),
             ('楽天・プラスのほうが上限比で年0.00165ポイント安いのに', '楽天・プラスのほうが、eMAXIS Slimの段階制で最も高い区分の率と比べて年0.00165ポイント安いのに'),
             ('実際に品貸料がいくら発生したかは、交付目論見書からは分かりません。', '実際に品貸料がいくら発生したかは、交付目論見書からは分かりません。3本目のたわらノーロード 全世界株式の交付目論見書には、品貸料についての記載がありません。')]
    n = 0
    for c in led['claims']:
        t = c.get('text', '')
        for o, nw in swaps:
            if o in t and nw not in t: t = t.replace(o, nw)
        if t != c.get('text'):
            c['text'] = t; n += 1
            c.setdefault('scope', 'eMAXIS Slim 全世界株式（オール・カントリー）と楽天・プラス・オールカントリー株式インデックス・ファンドの保有者（各交付目論見書の費用の記載）')
    assert n >= 6 or all(nw in json.dumps(led, ensure_ascii=False) for _, nw in swaps), n   # 再実行しても同じ結果になる
    led['claims'] = [c for c in led['claims'] if c.get('id') != 'audit-nolend-tawara-ac']
    _text['tawara-ac'] = re.sub(r'\s+', ' ', (RAW / 'tawara-ac_P.txt').read_text())
    assert '品貸' not in re.sub(r'\s+', '', _text['tawara-ac'])
    led['claims'].append({'id': 'audit-nolend-tawara-ac', 'text': 'たわらノーロード 全世界株式の交付目論見書に品貸料についての記載が無い', 'numbers': [], 'applies': f'{CHECKED}に確認した交付目論見書（使用開始日2026年7月15日）',
                          'source_url': TAWARA_URL, 'source_quote': quote('tawara-ac', '0.10989'),
                          'exceptions': '交付目論見書の抽出テキスト全文（空白を除く）を「品貸」で検索して0件（生成のたびに assert で確かめる）。「有価証券の貸付等においては、取引相手先の倒産等による決済不履行リスクを伴います」という留意点の1文はあるが、品貸料の配分や信託報酬への追加の定めは無い。source_quote は同じ資料の運用管理費用（信託報酬）の欄。',
                          'scope': 'たわらノーロード 全世界株式の保有者（交付目論見書の費用の記載）'})
    p.write_text(json.dumps(led, ensure_ascii=False, indent=2) + '\n')
    # sp500-hikaku: 直した行に出てくる数字の台帳
    L = Ledger('sp500-hikaku'); ap = f"{CHECKED}に確認した{doc_label('emaxis-sp')}"
    who = 'eMAXIS Slim 米国株式（S&P500）の保有者（交付目論見書の「ファンドの費用」の記載）'
    L.add('fee-emaxis-sp', 'eMAXIS Slim 米国株式（S&P500）の信託報酬の段階料率（1兆円未満の部分0.08140%〜10兆円以上の部分0.07568%）と、純資産総額11兆8,000億円のときの実質信託報酬率の例0.07648%',
          ['0.0814%', '0.08140%', '0.07568%', '0.07648%', '8,000'], P_URL['emaxis-sp'],
          quote('emaxis-sp', '0.08140') + ' ／ ' + qre('emaxis-sp', r'1兆円未満の部分 ?0\.08140％') + ' ／ ' + qre('emaxis-sp', r'10兆円以上の部分 ?0\.07568％') + ' ／ ' + qre('emaxis-sp', r'ファンドの純資産総額 ?10兆8,000億円 ?11兆3,000億円 ?11兆8,000億円 ?実質信託報酬率 ?（税込 ?年率） ?0\.07655% ?0\.07651% ?0\.07648%'),
          ap, '段階制で、純資産総額の区分ごとに率が異なる。0.08140%は最も高い区分（1兆円未満の部分）の率で、目論見書は「年率0.08140%以内」と書く。実質信託報酬率は例示で、純資産総額によって変わる。有価証券の貸付の指図を行った場合の追加（lend-emaxis-sp）は含まない。', who)
    L.add('ter-emaxis-sp', 'eMAXIS Slim 米国株式（S&P500）の総経費率0.07953%（2025年4月26日〜2026年4月27日）', ['0.07953%', '2025年4月26日', '2026年4月27日'], P_URL['emaxis-sp'],
          quote('emaxis-sp', '0.07953', 60) + ' ／ ' + qre('emaxis-sp', r'2025年4月26日～2026年4月27日'), ap,
          '直近の運用報告書作成対象期間の実績で、原則として購入時手数料・売買委託手数料・有価証券取引税を含まない（同じ欄の注）。小数第2位までの表示は0.08%。', who)
    f = funds['emaxis-sp']
    L.add('lend-emaxis-sp', 'eMAXIS Slim 米国株式（S&P500）：有価証券の貸付の指図を行った場合の品貸料の扱い', ['49.5%', '45.0%'], P_URL['emaxis-sp'],
          qre('emaxis-sp', r'(?:この場合、 ?)?ファンドの品貸料.{0,90}?以内の額が上記の運用管理費 ?用.{0,30}?に追加されます。'), ap,
          '有価証券の貸付の指図を行った場合だけの定めで、運用管理費用（信託報酬）に追加される額。貸付を行わない場合は追加されない。率は「以内」で、実際に追加された額は交付目論見書からは分からない。', who)
    L.add('fee-rakuten-sp', '楽天・プラス・S&P500インデックス・ファンドの信託報酬（年0.077%）と貸付有価証券関連報酬', ['0.077%'], P_URL['rakuten-sp'],
          quote('rakuten-sp', '0.077') + ' ／ ' + qre('rakuten-sp', r'・貸付有価証券関連報酬：有価証券の貸.{0,170}?品貸料に0\.55 ?（税抜0\.5） ?を乗 ?じて得た額'),
          f"{CHECKED}に確認した{doc_label('rakuten-sp')}", '貸付有価証券関連報酬は有価証券の貸付取引を行った場合だけの費用で、運用管理費用（信託報酬）とは別の「その他の費用・手数料」の項目。抽出テキストは2段組で、隣の段の注記が行単位で混ざる。', '楽天・プラス・S&P500インデックス・ファンドの保有者')
    s = SENS['emaxis-sp__rakuten-sp']; x = next(v for v in s['起点をずらした場合'] if v['起点'] == '2023-11-02')
    assert pct(x['A累積']) == '89.68%' and pct(x['B累積']) == '89.70%' and s['順序が入れ替わる起点'] == ['2023-11-02']
    ua, qa = nav_rows('emaxis-sp', ['2023-11-02', '2026-09-11']); ub, qb = nav_rows('rakuten-sp', ['2023-11-02', '2026-09-11'])
    L.add('start-shift', '起点を2023年11月2日にすると累積騰落率は eMAXIS Slim 89.68%・楽天・プラス 89.70% で順序が入れ替わる', ['2023年11月2日', '89.68%', '89.70%', '100万円'], ua,
          f'eMAXIS Slim 米国株式（S&P500）: {qa} ／ 楽天・プラス・S&P500: {qb}（{ub}）', '2023-11-02〜2026-09-11の基準価額（2026-09-13取得の保存データ）',
          '税引前分配金再投資の基準価額による計算（2本とも分配金なし）。起点から6営業日の範囲で順序が入れ替わるのはこの1日だけで、本文の表の5つの起点ではどれも eMAXIS Slim が上（start-sensitivity.json）。差は0.02ポイントで、どちらが上回りやすいかを示すものではない。',
          '2本を2023年11月2日に同じ金額で買って2026年9月11日まで保有した場合')
    (col / 'sp500-hikaku.json').write_text(json.dumps({'page': 'docs/column/sp500-hikaku/index.html', 'checked': CHECKED, 'claims': L.claims, 'absolutes': [], 'tool_cases': [],
        'review_note': '2026-10-02 既存記事の見直しで直した行（信託報酬の「上限」の言い換え・品貸料の条項・起点を動かした場合）に出てくる数字の台帳。ページ全体の台帳ではない。'}, ensure_ascii=False, indent=2) + '\n')
    (col / 'index-toushi.json').write_text(json.dumps({'page': 'docs/column/index-toushi/index.html', 'checked': CHECKED, 'claims': [], 'tool_cases': [],
        'absolutes': [{'phrase': '原則', 'context': '有価証券取引税は原則として含まれません', 'reviewed': '各社の交付目論見書の総経費率の注記（原則として購入時手数料・売買委託手数料・有価証券取引税を含まない）と同じ書き方。含まれない費用の範囲は資料ごとの注記による。この行は「段階制の上限」を「段階制で最も高い区分の率」に言い換えただけで、数字の主張は足していない。', 'audit': CHECKED}],
        'review_note': '2026-10-02 既存記事の見直しで、信託報酬の「上限」という言い方を2か所言い換えた。足した行に数字は無い。ページ全体の台帳ではない。'}, ensure_ascii=False, indent=2) + '\n')
    print('special ledgers written')
if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
    special()
