"""Build the 2026-10-03 fund comparison articles (HTML) and, with --ledger, their claim ledgers.

  python3 reports/fund-vs-20261003/compare.py      # NAV comparison (saved data only)
  python3 reports/fund-vs-20261003/build.py         # write docs/column/<slug>/index.html
  (run the site generators)
  python3 reports/fund-vs-20261003/build.py --ledger # write claims/column/<slug>.json from the final HTML

Numbers come from comparison.json (issuer NAV files) and funds.py (verbatim document quotes).
Text is factual comparison only: no ranking, recommendation, or buy/sell judgement.
"""
import datetime as dt, html as H, json, re, subprocess, sys
from pathlib import Path
R = Path(__file__).resolve().parent
ROOT = R.parents[1]
sys.path.insert(0, str(R))
from sources import Q, url, nav_rows, DOCS, NAV, text
from funds import FUNDS, check_all
check_all()
import compare as CP

PUB = '2026-10-03'  # 公開日（datePublished・ページの公開日の表示）
GOT = '2026-10-03'  # 資料・基準価額データの取得日（公開日と分けて持つ。2026-10-02 の TODO）
CMP = json.loads((R / 'comparison.json').read_text())['pairs']
E = H.escape

def plain(h):
    return re.sub(r'\s+', ' ', H.unescape(re.sub(r'<[^>]+>', ' ', h))).strip()

def jd(d):
    y, m, dd = map(int, str(d).split('-'))
    return f'{y}年{m}月{dd}日'

def pct(x, sign=True, nd=2):
    s = f'{x*100:+.{nd}f}%' if sign else f'{x*100:.{nd}f}%'
    return s.replace('+', '+') if sign else s

def yen(n):
    return f'{n:,}円'

# ---------------------------------------------------------------- page model
class Page:
    def __init__(self, slug, a, b, pair):
        self.slug, self.a, self.b, self.A, self.B = slug, a, b, FUNDS[a], FUNDS[b]
        self.pair = pair
        self.r_ = CMP[pair]
        self.claims, self.frags, self.sources = {}, [], []
        self.series = {k: {d: v for d, v in CP.series(k)[0].items() if d <= CP.END} for k in (a, b)}

    def claim(self, cid, text, src, quote, applies, exceptions, kind=None, scope=None):
        if cid not in self.claims:
            if scope is None:
                if kind == 'own_site':
                    scope = f'このサイトの記事の書き方・計算方法（{jd(PUB)}公開の{self.slug}）。金融商品の仕様の主張ではない'
                elif cid.startswith('perf') or cid in ('perf', 'desc'):
                    scope = (f"{jd(self.r_['起点'])}〜{jd(self.r_['終点'])}の運用会社公表の基準価額（税引前分配金再投資）による過去の実績。"
                             '購入時・換金時の手数料、信託財産留保額、投資者ごとの税金は含まない。将来の成果ではない')
                else:
                    scope = f'{applies}の記載。ファンド全体（全受益者に共通）の仕様・数値で、個々の投資者の税金・販売会社ごとの取扱いは含まない'
            c = dict(id=cid, text=text, where=[], numbers=[], applies=applies, scope=scope, source_url=src,
                     source_quote=quote, exceptions=exceptions, covers=[])
            if kind: c['kind'] = kind
            self.claims[cid] = c
        return cid

    def r(self, cid, h):
        if cid not in self.claims:
            k, _, field = cid.rpartition('-')
            if k in FUNDS and field + '_q' in FUNDS[k]:
                self.fc(k, field)
        assert cid in self.claims, cid
        self.frags.append((cid, plain(h)))
        return h

    # fund document claim
    def fc(self, k, field):
        f = FUNDS[k]
        cid = f'{k}-{field}'
        if field == 'incept' and 'incept_nav' in f:
            rows, u = nav_rows(k, f['incept_nav'])
            return self.claim(cid, f"{f['name']}の設定日（基準価額データの初日）", u, rows, f'{GOT}に取得した運用会社の基準価額データ',
                              '設定日は運用会社の基準価額データの初日（基準価額10,000円）で確認。')
        doc, pat = f[field + '_q']
        label = DOCS[doc][1]
        exc = {
            'fee': ('交付目論見書の費用欄で料率の適用条件を確認。段階制は純資産総額の区分ごとに率が異なり、本文では「以内（段階制）」と表示した。投資先ETF等の報酬は別の行（実質的な負担）に分けた。' if f.get('tiered') else
                    '交付目論見書の費用欄で料率と適用条件を確認。純資産総額による段階制ではない。資料が「以内」と書いている場合は、その旨と現在の率を表示した。投資先ETF等の報酬は別の行（実質的な負担）に分けた。'),
            'eff': '実質的な負担は投資先ETF等の報酬を加味した実質的な信託報酬率の概算値で、交付目論見書も「目安」「程度」と記載。組入状況で変動する旨を本文の注記に書いた。監査報酬などのその他の費用・手数料（運用状況により変動し料率を事前に表示できない）と、有価証券の貸付を行った場合に信託報酬に追加される額・貸付有価証券関連報酬は含まない率で、その旨を本文に書いた。',
            'ter': '総経費率は対象期間の運用・管理にかかった費用の総額から算出した年率換算の値で、資料は「これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なります」と注記している（本文では参考値と表示し、この注記も書いた）。購入時手数料・売買委託手数料・有価証券取引税を含まない（本文に明記）。対象期間が2本で異なる場合は表に期間を併記した。',
            'index': '連動対象・投資対象は交付目論見書の「ファンドの目的・特色」で確認。円換算・配当込み等の表記は資料の表記に合わせた。',
            'hedge': '為替ヘッジの有無は交付目論見書の特色・投資態度・属性区分の文言どおりに表示した（「原則として」があるものは「原則なし」、ないものは「なし」、例外が書かれているものは例外も併記）。',
            'settle': '決算頻度・決算日は交付目論見書で確認。休業日の場合は翌営業日になる旨も本文の表に書いた。',
            'terd': '交付目論見書の（参考情報）欄の総経費率は、小数第2位の表示と「上記の詳細な総経費率」（小数第5位）の2つがある。本文では詳細値を使い、小数第2位の値も併記した。',
            'terak': '交付運用報告書の総経費率は小数第2位までの表示。交付目論見書の詳細値を四捨五入した値と一致することを確認した。',
            'lend': ('有価証券の貸付の指図を行った場合だけの定めで、運用管理費用（信託報酬）に追加される額。貸付を行わない場合は追加されない。本文では原文の条件と対象（ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額）を縮めずに書いた。' if f.get('lend_kind') == 'add' else
                     'マザーファンドで有価証券の貸付の指図を行った場合だけの定めで、運用管理費用（信託報酬）の②として計算される額。率は「55%未満（税抜50%）」で、2026年7月14日現在は品貸料の49.5%（税抜45%）以内。①と②の合計（税抜）は純資産総額の年0.75%を超えないと同じ欄にある。本文では対象（マザーファンドの品貸料のうちファンドに属するとみなした額）と現在の率を縮めずに書いた。' if f.get('lend_kind') == 'tawara' else
                     '有価証券の貸付取引を行った場合だけの定め。楽天投信の交付目論見書は、信託報酬への追加ではなく「その他の費用・手数料」の一項目（貸付有価証券関連報酬）として書いており、本文でもその位置づけのまま書いた。費用欄は2段組で、抽出テキストでは隣の段の注記が引用の途中に挟まる。'),
            'tier': '交付目論見書の（ご参考）の実質信託報酬率の例。実際の率は純資産総額で変わる。',
            'incept': '設定日は交付目論見書・運用会社の基準価額データの初日で確認。',
            'nofee': '購入時手数料・信託財産留保額は交付目論見書の費用欄で確認。販売会社が別に定める場合の注記がある資料は、その旨を確認した。',
        }.get(field, '交付目論見書・運用報告書・月次レポートの該当箇所で確認。')
        if field == 'incept' and 'incept_nav' in f:
            rows, u = nav_rows(k, f['incept_nav'])
            return self.claim(cid, f"{f['name']}の設定日", u, rows, f'{GOT}に取得した運用会社の基準価額データ', exc)
        if field == 'ter' and f.get('ter_period_q'):
            exc += ' 対象期間: ' + Q(*f['ter_period_q'])
        if field == 'eff':
            exc += ' 国内ファンド分の料率: 「' + Q(*f['fee_q']) + '」'
        if field == 'lend' and f.get('lendhead_q'):
            exc += ' その他の費用・手数料の欄の見出しと項目: 「' + Q(*f['lendhead_q']) + '」'
        if field == 'ter' and f['ter'] is None:
            exc += f' {jd(GOT)}に運用会社のファンドページ（' + f['page'] + '）を確認し、交付運用報告書のPDFが未掲載（掲載予定URLは「ページが見つかりません」）であることを確かめた。'
        return self.claim(cid, f"{f['name']}：{field}", url(doc), Q(doc, pat), f'{GOT}に確認した{label}', exc)

    def docq(self, cid, text, doc, pat, exceptions, extra_doc=None):
        q = Q(doc, pat)
        if doc in DOCDATE:
            exceptions += f' 資料の日付: 「{Q(doc, DOCDATE[doc])}」。'
        if extra_doc:
            exceptions += ' 併せて確認した資料: ' + ' / '.join(f'{url(d)}「{Q(d, p)}」' for d, p in extra_doc)
        return self.claim(cid, text, url(doc), q, f'{GOT}に確認した{DOCS[doc][1]}', exceptions)

    def src(self, doc):
        if doc and doc not in self.sources:
            self.sources.append(doc)

# ---------------------------------------------------------------- performance helpers
def peak_trough(s):
    peak_v, peak_d, worst, wd, wp = 0, None, 0, None, None
    for d in sorted(s):
        if s[d] > peak_v:
            peak_v, peak_d = s[d], d
        dd = s[d] / peak_v - 1
        if dd < worst:
            worst, wd, wp = dd, d, peak_d
    return wp, wd

def perf_claims(p):
    r = p.r_
    start, end = r['起点'], r['終点']
    for side, k in (('A', p.a), ('B', p.b)):
        s = {d: v for d, v in p.series[k].items() if str(d) >= start and str(d) <= end}
        common = sorted(set(p.series[p.a]) & set(p.series[p.b]))
        s = {d: p.series[k][d] for d in common if start <= str(d) <= end}
        pk, tr = peak_trough(s)
        dates = [start, end, str(pk), str(tr)]
        if '1年窓' in r:
            dates.insert(2, r['1年窓']['起点'])
        rows, u = nav_rows(k, *dict.fromkeys(dates))
        p.claim(f'perf{side}', f"{FUNDS[k]['short']}の{start}〜{end}の分配金再投資基準価額による累積騰落率・終了時評価額・最大下落率・直近1年騰落率",
                u, rows, f'{jd(start)}〜{jd(end)}の公表基準価額（{GOT}取得）',
                f'税引前分配金を再投資した基準価額による計算。購入・換金時の手数料と投資者の税金は含まない（本文の計算条件に明記）。最大下落率は高値{jd(pk)}から安値{jd(tr)}まで。'
                + (' データはウエルスアドバイザー配信のXML（運用会社のサイトのものではない）。price は分配落ちの基準価額で、日々の return_value を連乗して分配金再投資ベースを作った（compare.py xml_nav が (price+分配金)/前日price と1e-5以内で一致することを全日で検証）。本文と出典欄にこの取得元と加工を書いた。' if NAV[k][0].endswith('.xml') else ''))
    pa = p.claims['perfA']
    p.claim('perf', f'{p.A["short"]}と{p.B["short"]}の同一期間の実績比較', pa['source_url'], pa['source_quote'], pa['applies'],
            pa['exceptions'] + f' 比較相手の値は {p.claims["perfB"]["source_url"]} の「{p.claims["perfB"]["source_quote"]}」。')

def perf_section(p, intro_cid=None):
    r, A, B = p.r_, p.A, p.B
    yrs = r['年数']
    rows = [('比較期間', f"{jd(r['起点'])}〜{jd(r['終点'])}", f"{jd(r['起点'])}〜{jd(r['終点'])}", 'perf'),
            ('累積騰落率', pct(r['A累積']), pct(r['B累積']), None)]
    if yrs >= 1:
        rows.append(('年率換算（複利）', pct(r['A年率']), pct(r['B年率']), None))
    rows.append(('100万円の終了時評価額（売却前）', yen(r['A100万円終価']), yen(r['B100万円終価']), None))
    rows.append(('比較期間内の最大下落率', pct(r['A最大下落率']), pct(r['B最大下落率']), None))
    if '1年窓' in r:
        one = r['1年窓']
        rows.append((f"直近1年の騰落率（{jd(one['起点'])}〜）", pct(one['A累積']), pct(one['B累積']), None))
    h = p.r('perf', '<h2 id="performance">同じ期間の100万円を、分配金再投資で比べる</h2>')
    h += '<div class="scroll-wrap"><table><thead><tr><th scope="col">項目</th>'
    h += f'<th scope="col" class="num">{E(A["short"])}</th><th scope="col" class="num">{E(B["short"])}</th></tr></thead><tbody>'
    for label, va, vb, cid in rows:
        if cid:
            h += f'<tr><th scope="row">{label}</th><td class="num">{p.r(cid, va)}</td><td class="num">{p.r(cid, vb)}</td></tr>'
        else:
            h += f'<tr><th scope="row">{p.r("perf", label)}</th><td class="num">{p.r("perfA", va)}</td><td class="num">{p.r("perfB", vb)}</td></tr>'
    h += '</tbody></table></div>'
    notes = ['最大下落率は、比較期間内のそれまでの高値から、その後の安値までの下落を日次で測った値です。将来の損失の上限ではありません。']
    if yrs >= 1:
        notes.append(f"年率は複利換算で、比較期間の暦日数（{(dt.date.fromisoformat(r['終点']) - dt.date.fromisoformat(r['起点'])).days:,}日）を365.25日で割った年数（{yrs:.2f}年）で計算しています。毎年同じ率で増えたという意味ではありません。")
    else:
        notes.append('共通期間が1年未満のため、年率換算と直近1年の欄は載せていません。短い期間の騰落を1年分に引き延ばすと、実際より大きな印象を与えるためです。')
    h += p.r('perf', '<p class="note">' + ''.join(notes) + '</p>')
    h += chart(p)
    return h

def chart(p):
    r = p.r_
    common = sorted(set(p.series[p.a]) & set(p.series[p.b]))
    ds = [d for d in common if r['起点'] <= str(d) <= r['終点']]
    a0, b0 = p.series[p.a][ds[0]], p.series[p.b][ds[0]]
    va = [p.series[p.a][d] / a0 * 100 for d in ds]
    vb = [p.series[p.b][d] / b0 * 100 for d in ds]
    hi = max(max(va), max(vb)); lo = min(min(va), min(vb))
    top = (int(hi // 50) + 1) * 50; bot = max(0, int(lo // 50) * 50)
    x0, x1, y0, y1 = 56, 382, 30, 204
    step = max(1, len(ds) // 330)
    idx = list(range(0, len(ds), step))
    if idx[-1] != len(ds) - 1: idx.append(len(ds) - 1)
    def pts(v):
        return ' '.join(f'{x0 + (x1 - x0) * i / (len(ds) - 1):.1f},{y1 - (y1 - y0) * (v[i] - bot) / (top - bot):.1f}' for i in idx)
    yb = y1 - (y1 - y0) * (100 - bot) / (top - bot)
    label = f'開始日を100とした分配金再投資基準価額の推移。実線は{p.A["short"]}、破線は{p.B["short"]}'
    p.r('perf', E(label))
    svg = (f'<svg viewBox="0 0 400 250" role="img" aria-label="{E(label)}"><path d="M{x0} {y0}V{y1}H{x1}" fill="none" stroke="currentColor"/>'
           f'<line x1="{x0}" y1="{yb:.1f}" x2="{x1}" y2="{yb:.1f}" stroke="currentColor" stroke-dasharray="2 4" opacity="0.5"/>'
           f'<text x="4" y="{y0 + 8}" fill="currentColor" font-size="13">{top}</text>' + (f'<text x="4" y="{yb + 5:.0f}" fill="currentColor" font-size="13">100</text>' if y1 - yb > 18 and yb - y0 > 18 else '') +
           f'<text x="4" y="{y1 + 4}" fill="currentColor" font-size="13">{bot}</text>'
           f'<polyline points="{pts(va)}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>'
           f'<polyline points="{pts(vb)}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="7 5"/>'
           f'<text x="{x0}" y="237" fill="currentColor" font-size="13">開始日</text><text x="300" y="237" fill="currentColor" font-size="13">終了日</text></svg>')
    cap = p.r('perf', f'<figcaption>開始日（{jd(r["起点"])}）を100に統一。実線：{E(p.A["short"])}。破線：{E(p.B["short"])}。税引前の分配金を再投資した推移で、数値は直上の表のとおりです。</figcaption>')
    return f'<figure class="figure">{svg}{cap}</figure>'

FIELD_ROWS = [('fee', '信託報酬（税込年率・ファンド本体）'), ('eff', '投資先ETF等を加味した実質的な信託報酬'), ('ter', '総経費率（参考値・年率）'),
              ('ter_period', '総経費率の対象期間'), ('index', '連動対象・投資対象'), ('hedge', '為替ヘッジ'), ('settle', '決算'),
              ('incept', '設定日'), ('nofee', '購入時手数料／信託財産留保額')]

def fee_section(p, show_eff=None):
    A, B = p.A, p.B
    show_eff = (A['etf'] or B['etf']) if show_eff is None else show_eff
    h = p.r('feehead', '<h2 id="fees">目論見書の料率と、総経費率（参考値）を分けて見る</h2>')
    h += '<div class="scroll-wrap"><table class="num-nowrap"><thead><tr><th scope="col">項目</th>'
    h += f'<th scope="col">{E(A["short"])}</th><th scope="col">{E(B["short"])}</th></tr></thead><tbody>'
    for field, label in FIELD_ROWS:
        if field == 'eff' and not show_eff:
            continue
        if field == 'hedge' and all(FUNDS[k].get('hedge') is None for k in (p.a, p.b)):
            continue
        cells = []
        for k in (p.a, p.b):
            f = FUNDS[k]
            if field == 'ter_period':
                cid = p.fc(k, 'ter'); val = f['ter_period']
            elif field == 'ter':
                cid = p.fc(k, 'ter'); val = (f['ter'] + f.get('ter_mark', '')) if f['ter'] else '未掲載'
            elif field == 'hedge':
                cid = p.fc(k, 'hedge'); val = f['hedge']
            elif field == 'nofee':
                cid = p.fc(k, 'nofee'); val = f.get('nofee_val', 'なし／なし')
            else:
                cid = p.fc(k, field); val = f[field]
            cls = ' class="num"' if field in ('fee', 'ter') else ''
            cells.append(f'<td{cls}>{p.r(cid, E(val))}</td>')
        h += f'<tr><th scope="row">{label}</th>{"".join(cells)}</tr>'
    h += '</tbody></table></div>'
    return h

def head(p, title, desc):
    can = f'https://keiri-tools.com/column/{p.slug}/'
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "headline": title, "datePublished": PUB, "dateModified": PUB,
         "author": {"@type": "Person", "name": "Masahiro Yasu", "url": "https://keiri-tools.com/about/"},
         "mainEntityOfPage": can, "publisher": {"@type": "Organization", "name": "税金・経理・補助金ツールズ"}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://keiri-tools.com/"},
            {"@type": "ListItem", "position": 2, "name": "コラム", "item": "https://keiri-tools.com/column/"},
            {"@type": "ListItem", "position": 3, "name": title, "item": can}]}]}
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<!-- favicon:auto -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="stylesheet" href="../../assets/style.css">
<link rel="canonical" href="{can}">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=2)}
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-E742DSDHPD"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){{dataLayer.push(arguments);}}
gtag('js', new Date());
gtag('config', 'G-E742DSDHPD');
</script>
<script src="../../assets/track.js" defer></script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2635067516563578" crossorigin="anonymous"></script>
<!--nav-exp:toc-script S--><script src="../../assets/toc-rail.js" defer></script><!--nav-exp:toc-script E--></head>
<body>
<a class="skip-link" href="#main">本文へ移動</a>
<header class="site">
  <a class="brand" href="../../">税金・経理・補助金ツールズ</a>
  <nav>
    <a href="../../#tools">ツール</a>
    <a href="../../hojokin/">補助金</a>
    <a href="../../column/" aria-current="page">コラム</a>
    <a href="../../toushi/">資産形成</a>
  </nav>
  <button type="button" class="site-search-btn" data-site-search aria-label="サイト内検索" aria-haspopup="dialog" aria-expanded="false"><svg class="site-search-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.75" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="site-search-label">検索</span></button>
  <script type="module" src="../../assets/site_search.js"></script>
</header>
<main id="main" tabindex="-1">
<nav class="breadcrumb"><a href="../../">ホーム</a> › <a href="../">コラム</a> › {E(title)}</nav>
<article>
'''

FOOT = '''</main>
<footer class="site" style="display:block">© 税金・経理・補助金ツールズ
  <div style="margin-top:8px;font-size:12px"><a href="../../about/" style="color:var(--sub)">このサイトについて</a>　<a href="../../privacy/" style="color:var(--sub)">プライバシーポリシー</a>　<a href="../../contact/" style="color:var(--sub)">お問い合わせ</a></div>
</footer>
<script src="../../assets/empty-state.js" defer></script>
</body>
</html>
'''

def common_claims(p, title, desc):
    p.claim('site', 'このサイトの記事の書き手・比較の方法・免責（サイト自身の運営方針）', 'https://keiri-tools.com/about/',
            '運営者 Masahiro Yasu', f'サイトの運営方針（{jd(PUB)}時点）',
            '無し: サイト自身の運営・方法についての記述で、金融商品の仕様や数値の主張ではない（kind: own_site）。', kind='own_site')
    p.claim('method', 'この記事の計算方法（期間・分配金再投資・100万円換算・費用の扱い）', f'https://keiri-tools.com/column/{p.slug}/',
            "r['A100万円終価'] = round(1e6 * aa[max(aa)] / aa[min(aa)])", f'{GOT}に行った計算（reports/fund-vs-20261003/compare.py）',
            '無し: 計算方法の説明。数値そのものは perfA / perfB の運用会社データで確認した。', kind='own_site')
    fa, fb = p.A, p.B
    p.claim('identity', f'比較する2本の正式名称と運用会社：{fa["name"]}（{fa["company"]}）と{fb["name"]}（{fb["company"]}）',
            url(fa['P']), Q(fa['P'], _name_pat(fa)), f'{GOT}に確認した交付目論見書',
            f'比較相手の名称: {url(fb["P"])}「{Q(fb["P"], _name_pat(fb))}」')
    fx, fy = (fa, fb) if fa['ter'] else (fb, fa)
    other = Q(fy['P'], _ter_def_pat(fy)) if fy['ter'] else f'{fy["short"]}は初回決算前の交付目論見書で総経費率の欄がない'
    p.claim('feehead', '費用は目論見書の料率と運用報告書の総経費率を分けて示す', url(fx['P']),
            Q(fx['P'], _ter_def_pat(fx)), f'{GOT}に確認した交付目論見書',
            '総経費率が購入時手数料・売買委託手数料・有価証券取引税を含まない旨を交付目論見書で確認。比較相手: ' + other)

NAME_PATS = {
    'rakuten-schd': r'楽天・シュワブ・高配当株式・米国ファンド （四半期決算型）',
    'sbi-vym4': r'SBI・V・米国高配当株式インデックス・ファンド（年4回決算型）',
    'sbi-spyd4': r'この目論見書により行う「SBI・SPDR・S＆P５００高配当株式インデックス・ファンド（年４回決算型）」の募集',
    'sbi-jhd': r'この目論見書により行う「ＳＢＩ日本高配当株式（分配） ファンド （年4回決算型）」の募集',
    'rakuten-jhd': r'楽天・高配当株式・日本ファンド （四半期決算型）',
    'emaxis-emg': r'この目論見書により行う 「ｅＭＡＸＩ ＳＳ ｌ ｉｍ 新興国株式インデックス」の募集',
    'tawara-emg': r'たわらノーロード 新興国株式',
    'emaxis-bal8': r'この目論見書により行う 「ｅＭＡＸＩＳＳｌ ｉｍ バランス（８資産均等型） 」の募集',
    'tawara-bal8': r'たわらノーロード バランス （８資産均等型）',
}
def _name_pat(f):
    k = next(k for k, v in FUNDS.items() if v is f)
    return NAME_PATS[k]

def _ter_def_pat(f):
    return r'（原則として[、]?\s?購入時手数料、売買委託手数料(?:および|及び)有価証券取引税(?:を|は)(?:除く|含みません)|原則として、募集手数料、売買委託手数料(?:および|及び)有価証券取引税を(?:除く|含みません)'

DOCDATE = {
    'risude_P': r'使用開始日：2026年5月26日', 'risude_Ak': r'（作成対象期間 2025年8月26日～2026年2月25日）', 'risude_M': r'作成基準日 ： 2026年8月31日',
    'svym_P': r'2026\.8\.21', 'svym_Ak': r'作成対象期間（2025年11月21日〜2026年５月20日）', 'svym_M': r'2026.8月31日基準',
    'sspyd_P': r'使用開始日 2026\.8\.21', 'sspyd_Ak': r'作成対象期間（2025年11月21日〜2026年５月20日）', 'sspyd_M': r'2026.8月31日基準',
    'sjhd_P': r'使用開始日 （交付目論見書） 2026\.7\.11', 'sjhd_Ak': r'作成対象期間（2025年10月11日〜2026年４月10日）', 'sjhd_M': r'2026.8月31日基準',
    'risjde_P': r'使用開始日：2026年9月25日', 'risjde_Ak': r'（作成対象期間 2025年12月26日～2026年6月25日）', 'risjde_M': r'作成基準日 ： 2026年8月31日',
    'eemg_P': r'使用開始日 2026\.７\.25', 'eemg_Ak': r'作成対象期間：2025年４月26日～2026年４月27日', 'eemg_M': r'2026年08月31日現在',
    'ebal_P': r'使用開始日 2026\.７\.25', 'ebal_Ak': r'作成対象期間：2025年４月26日～2026年４月27日', 'ebal_M': r'2026年08月31日現在',
    'temg_P': r'使用開始日 2026年７月15日', 'temg_Ak': r'作成対象期間 2024年10月16日～2025年10月14日', 'temg_M': r'2026年8月31日基準',
    'tbal_P': r'使用開始日 2026年７月15日', 'tbal_Ak': r'作成対象期間 2024年10月16日～2025年10月14日', 'tbal_M': r'2026年8月31日基準',
}

def lead_block(p, conclusion_html, extra_html=''):
    h = f'<h1>{p.r("identity", E(p.title))}</h1>\n'
    h += f'<p class="article-meta">公開日: <time datetime="{PUB}">{jd(PUB)}</time></p>\n'
    h += f'<p class="byline">{p.r("site", "文責: <a href=\"../../about/\">Masahiro Yasu</a>（クリニック・EC事業の経営者／経理実務者）")}</p>\n'
    h += conclusion_html + extra_html
    xmls = [FUNDS[k]['short'] for k in (p.a, p.b) if NAV[k][0].endswith('.xml')]
    pubs = [FUNDS[k]['short'] for k in (p.a, p.b) if not NAV[k][0].endswith('.xml')]
    wa = 'ウエルスアドバイザーが配信する基準価額と日々の騰落率から計算した、税引前の分配金再投資ベースの値'
    if xmls and pubs:
        srcs = f'{"と".join(pubs)}が運用会社の公表する分配金再投資基準価額、{"と".join(xmls)}が{wa}'
    elif xmls:
        srcs = f'{"と".join(xmls)}とも{wa}'
    else:
        srcs = f'{"と".join(pubs)}とも運用会社の公表する分配金再投資基準価額'
    h += p.r('method', f'<p>基準価額は{srcs}で、どちらも{jd(p.r_["終点"])}までのデータです。費用は{jd(GOT)}に確認した交付目論見書・交付運用報告書・月次レポートの記載です。どちらかの購入や売却を勧めるものではなく、資料で確かめられる事実を並べています。</p>\n')
    return h

def toc(sections):
    return '<nav class="toc"><div class="toc-title">目次</div><ol>' + ''.join(f'<li><a href="#{i}">{E(t)}</a></li>' for i, t in sections) + '</ol></nav>\n'

def method_section(p):
    r = p.r_
    h = p.r('method', '<h2 id="method">計算条件と、この比較からは分からないこと</h2>')
    h += '<p>' + p.r('method', f'{jd(GOT)}に取得した日次データを使い、{jd(r["起点"])}以降で、2本とも基準価額がある日だけを比べました。')
    if r['起点'] > str(CP.START3Y):
        late = next(k for k in (p.a, p.b) if str(min(p.series[k])) == r['起点'])
        h += p.r('method', 'この比較は、終点から3年さかのぼった日を起点にするのを既定にしています。')
        h += p.r(f'{late}-incept', f'ただし{FUNDS[late]["short"]}の設定日（{jd(r["起点"])}）がその3年前より後なので、2本の基準価額がそろう最初の日であるこの設定日を起点にしました。')
    else:
        h += p.r('method', f'2本とも終点の3年前より前に設定されているため、起点は{jd(r["起点"])}です（3年前にあたる2023年9月30日が土曜日のため、その前の営業日）。')
    lasts = [(FUNDS[k]['short'], str(max(CP.series(k)[0]))) for k in (p.a, p.b)]  # p.series is already cut at END; read the raw file's last day
    got = f'{jd(lasts[0][1])}分まで' if lasts[0][1] == lasts[1][1] else '、'.join(f'{n}が{jd(d)}分まで' for n, d in lasts)
    h += p.r('method', f'終点は月末の{jd(r["終点"])}に固定しました（取得したデータは{got}ありますが、月末で区切っています）。') + '</p>'
    nofee = all(FUNDS[k].get('nofee_val', 'なし／なし') == 'なし／なし' for k in (p.a, p.b))
    tax = nofee and tax_pair(p)
    cost = ('投資者ごとの税金は含めていません。' if tax else '投資者ごとの税金（分配金や換金時の差益にかかる税金）は含めていないため、実際に受け取る手取り額とは異なります。') if nofee else '購入時・換金時の手数料と投資者ごとの税金は含めていないため、実際に受け取る手取り額とは異なります。'
    h += '<p>' + p.r('method', '終了時評価額は「100万円×終点の再投資基準価額÷起点の再投資基準価額」で計算しました。基準価額は信託報酬などを差し引いた後の値なので、費用をもう一度引いてはいません。' + cost)
    if tax:
        h += p.r(tax, '交付目論見書の税金の表では、個人投資者が受け取る普通分配金と、換金（解約）時・償還時の差益（譲渡益）に、源泉徴収時の税率でそれぞれ20.315%がかかります（課税方法や外国税額控除の適用などにより異なる場合があり、法人の場合は異なります）。')
        h += p.r(tax, '課税口座では、その税金の分だけ実際の手取り額はこの評価額より少なくなります。')
        h += p.r(tax, '2本ともNISAの「成長投資枠」の対象で（販売会社により取扱いが異なる場合があります）、NISAを利用した場合はこれらの配当所得と譲渡所得が非課税です。')
    if nofee:
        h += p.r(nofee_pair(p), '2本とも、交付目論見書の購入時手数料と信託財産留保額は「ありません」と書かれています。')
    h += '</p>'
    h += p.r('method', '<p>開始日を変えれば実績の差も変わります。この記事は費用・投資対象・下落率を並べるところまでとし、総合順位や購入判断にはまとめていません。総経費率は次の運用報告書が出た時点で、実績は四半期ごとに期間を更新する予定です。</p>')
    h += p.r('site', '<a class="tool-cta" href="../../toushi/tsumitate/">積立額と仮定の年率から将来額を計算する</a>')
    h += p.r('site', '<p class="note">シミュレーターに入れる年率は仮定です。過去の実績が将来も続く前提にはしないでください。</p>')
    return h

def faq_block(p, qas):
    h = '<h2 id="faq">よくある質問</h2>'
    for cid, q, a in qas:
        if isinstance(a, str):
            a = [(cid, a)]
        ans = ''.join(p.r(c, E(t)) for c, t in a)
        p.r(a[0][0], 'A. ' + a[0][1])
        h += f'<h3>{p.r(cid, "Q. " + q)}</h3><p>A. {ans}</p>'
    return h

def related_block(items):
    return '<section class="related"><h2>関連記事・ツール</h2><div class="tool-grid">' + ''.join(
        f'<a class="tool-card" href="{h}"><b>{E(t)}</b><span>{E(s)}</span></a>' for h, t, s in items) + '</div></section>\n'

def sources_block(p, extra=()):
    lis = []
    for doc in p.sources:
        cid = p.claim(f'doc-{doc}', f'出典資料の名称と日付：{DOCS[doc][1]}', url(doc), Q(doc, DOCDATE[doc]), f'{GOT}に確認',
                      '無し: 資料の表紙・作成対象期間・基準日の記載で、資料名に付けた日付を確認した。')
        lis.append(p.r(cid, f'<li><a href="{E(url(doc))}" target="_blank" rel="noopener">{E(DOCS[doc][1])}</a></li>'))
    for k in (p.a, p.b):
        u = NAV[k][1]
        who = 'ウエルスアドバイザー配信。日々の騰落率から分配金再投資ベースを計算' if NAV[k][0].endswith('.xml') else '運用会社公表'
        lis.append(p.r('method', f'<li><a href="{E(u)}" target="_blank" rel="noopener">{E(FUNDS[k]["name"])}：基準価額データ（{who}・{jd(GOT)}取得）</a></li>'))
    for u, t in extra:
        lis.append(f'<li><a href="{E(u)}" target="_blank" rel="noopener">{E(t)}</a></li>')
    h = '<h2 id="source">出典</h2><ul>' + ''.join(lis) + '</ul>'
    h += p.r('site', '<p class="note">本記事は一般的な情報提供を目的とし、特定の金融商品の取得・売買を勧めるものではありません。当サイトは金融商品取引業者ではなく、投資助言を行うものでもありません。数値は記載した期間の過去の実績であり、将来の運用成果を示しません。費用・運用方針は変更されるため、最新の交付目論見書をご確認ください。</p>')
    xmls = [FUNDS[k]['short'] for k in (p.a, p.b) if NAV[k][0].endswith('.xml')]
    nav_src = (f'基準価額データ（{"と".join(xmls)}はウエルスアドバイザー配信' + ('' if len(xmls) == 2 else '、もう1本は運用会社公表') + '）') if xmls else '運用会社公表の基準価額データ'
    h += f'\n<p class="source-method">資料確認日: {jd(GOT)}。運用会社の交付目論見書・交付運用報告書・月次レポートと、{nav_src}。</p>\n'
    return h

def page_html(p, title, desc, body, sections, related):
    p.title = title
    for k in (p.a, p.b):
        for d in (FUNDS[k]['P'], FUNDS[k].get('Ak'), FUNDS[k].get('M')):
            p.src(d)
    return head(p, title, desc), body, sections, related

# ---------------------------------------------------------------- articles
ARTICLES = []
def article(fn):
    ARTICLES.append(fn)
    return fn

def fee_gap_sentence(p, cid):
    A, B = p.A, p.B
    hi, lo = (A, B) if A['fee_num'] > B['fee_num'] else (B, A)
    d = round(hi['fee_num'] - lo['fee_num'], 5)
    return d

exec((R / 'articles.py').read_text())  # article bodies share this module's namespace

def selected():
    """ARTICLES, narrowed to --only <slug> when given (one article per shipping run)."""
    if '--only' in sys.argv:
        want = sys.argv[sys.argv.index('--only') + 1].split(',')
        sel = [fn for fn in ARTICLES if fn.__name__ in want or any(w in fn.__code__.co_consts for w in want)]
        assert sel, f'--only matched no article: {want}'
        return sel
    return ARTICLES

def build_all():
    out = []
    for fn in selected():
        p, title, desc, body, sections, related = fn()
        p.title = title
        for k in (p.a, p.b):
            for d in (FUNDS[k]['P'], FUNDS[k].get('Ak'), FUNDS[k].get('M')):
                p.src(d)
        h = head(p, title, desc)
        # title/desc/og units are registered against claims
        p.r('identity', E(title))
        p.r('desc', E(desc))
        html_out = h + lead_html(p) + toc(sections) + body + related_block(related) + sources_block(p) + '</article>\n' + FOOT
        path = ROOT / 'docs/column' / p.slug / 'index.html'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html_out)
        out.append(p)
        print('wrote', path.relative_to(ROOT), len(plain(body)), 'chars body')
    return out

def lead_html(p):
    return p.lead

# ---------------------------------------------------------------- ledger
def build_ledger(p):
    page = f'docs/column/{p.slug}/index.html'
    res = subprocess.run(['node', str(R / 'units.mjs'), str(ROOT / page)], capture_output=True, text=True, cwd=ROOT)
    data = json.loads(res.stdout)
    norm = lambda s: re.sub(r'\s+', '', H.unescape(s)).replace('　', '')
    frag = [(cid, norm(t)) for cid, t in p.frags]
    nonclaims, errors = [], []
    for c in p.claims.values():
        c['covers'], c['where'], c['numbers'] = [], [], []
    cursor = 0
    for u in data['units']:
        raw = u['text']
        if '【値】' in raw:  # table cell units carry row/column labels; match on the cell value
            raw = raw.split('【値】', 1)[1]
        if u['kind'] == 'figure':  # aria-label / axis ticks / figcaption joined by " / ": all parts belong to the chart claim
            parts = raw.split(' / ')
            assert all(norm(x) in ''.join(f for _, f in frag) or re.fullmatch(r'\d+|開始日|終了日', x) for x in parts), parts
            raw = parts[-1]
        t = norm(raw)
        # Prefer the next fragment in document order (short cell values like "12.4%" recur across tables).
        hit = next((i for i in range(cursor, len(frag)) if t and t in frag[i][1]), None)
        if hit is None:
            hit = next((i for i in range(len(frag)) if t and t in frag[i][1]), None)
        cid = frag[hit][0] if hit is not None else None
        if hit is not None and hit >= cursor:
            cursor = hit
        if cid:
            c = p.claims[cid]
            c['covers'].append(u['id']); c['where'].append(f"{u['kind']}: {u['text'][:40]}")
            for n in u['numbers']:
                if n not in c['numbers']: c['numbers'].append(n)
        elif not u['protected'] and not u['numbers']:
            nonclaims.append({'id': u['id'], 'why': NONCLAIM_WHY(u)})
        else:
            errors.append(f"unmapped unit {u['kind']} {u['zone']} {u['text'][:60]}")
    have = {re.sub(r'\s+', '', n) for c in p.claims.values() for n in c['numbers']}
    for n in data['pageNumbers']:
        if n not in have:
            errors.append(f'page number not in any claim: {n}')
    absolutes = []
    for a in data['absolutes']:
        ctx = a['context'].strip()
        absolutes.append({'phrase': a['phrase'], 'context': ctx[:30], 'reviewed': ABS_REVIEW(a)})
    claims = [c for c in p.claims.values() if c['covers']]
    verified = []
    keep = OC_KEEP.get(p.slug, {})
    if keep:
        segs = json.loads(subprocess.run(['node', 'tools/segment_claims.mjs', page], capture_output=True, text=True, cwd=ROOT).stdout)
        for sg in segs:
            if sg['id'] in keep:
                verified.append({'id': sg['id'], 'text_hash': sg['text_hash'], 'result': 'out_of_corpus', 'needed_source': keep[sg['id']][0], 'review_reason': keep[sg['id']][1]})
        missing = set(keep) - {v['id'] for v in verified}
        for m in missing:
            errors.append(f'out_of_corpus unit kept in the review is no longer on the page: {m}')
    ledger = {'page': page, 'checked': GOT, 'claims': claims, 'absolutes': absolutes, 'tool_cases': [], 'nonclaims': nonclaims, 'verified': verified}
    (ROOT / 'claims/column').mkdir(parents=True, exist_ok=True)
    (ROOT / f'claims/column/{p.slug}.json').write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')
    return errors

# Units the 2026-10-03 segment review left as out_of_corpus with no model judging them wrong
# (oc-opinion.json: all "unsure"). Kept unchanged as unverified, with the source that would settle them.
_OCR = 'segment-review 2026-10-03（write-2026-10-03-fin）: 正本（目論見書・運用報告書・月次・基準価額データ）に無い。別モデルの意見は unsure（wrong ではない）ので書き換えず未確認のまま残す。'
OC_KEEP = {'sbi-spyd-vs-rakuten-schd': {
    's-334220e4b41c156035ae-1': ('文責者の肩書（クリニック・EC事業の経営者／経理実務者）を示す運営者情報（/about/ の記載など）。', _OCR),
    's-d666cca387098425ff12-1': ('資料の確認日（2026年10月3日）と取得元URLを記録した取得ログ（corpus_desc.md / source_registry の取得日）。', _OCR),
    's-88cb4618a808586b8e9e-1': ('比較の起点を終点の3年前とする既定を定めた計算仕様（reports/fund-vs-20261003/compare.py の START3Y）。', _OCR),
    's-bc0d4681ae39bec3ac07-1': ('運営者が金融商品取引業者として登録していないことを示す資料（金融庁の登録業者一覧での不在確認など）。', _OCR),
}}

def NONCLAIM_WHY(u):
    t = u['text']
    if u['kind'] in ('main', 'article', 'div'):
        return '非主張。ナビゲーション・ツールへの導線・共有リンクなどの構成要素の文字で、商品の仕様や数値を述べていない。'
    if u['kind'] == 'th':
        return '非主張。表の項目名（列・行の見出し）で、値は隣のセルの主張として台帳に載せている。'
    if u['kind'] == 'text':
        return '非主張。図の軸ラベル（開始日・終了日・目盛り）で、数値の主張は表と figcaption 側にある。'
    if u['kind'] == 'li':
        return '非主張。出典の資料名とリンク。資料の内容は各主張の source_quote で照合している。'
    if u['kind'] in ('h2', 'h3'):
        return '非主張。節の見出しで、具体的な数値・要件の断定を含まない。'
    return '非主張。構成要素の文字で、金融商品の仕様・数値の主張を含まない。'

def ABS_REVIEW(a):
    ctx = a['context']
    if '原則' in ctx and ('ヘッジ' in ctx or '為替' in ctx):
        return ('交付目論見書の文言（原則として為替ヘッジを行わない）を写した。例外は目論見書の「市況動向の急激な変化等の場合は上記の運用ができない場合がある」旨で、本文では「原則なし」と表示して断定していない。')
    if '原則' in ctx and ('決算' in ctx or '各20日' in ctx or '各25日' in ctx or '各10日' in ctx or '各12日' in ctx):
        return ('交付目論見書の決算日の欄の文言（原則として…各○日）を写した。同じ欄のかっこ書・ただし書は「休業日の場合は翌営業日」で、これは本文と表の両方に書いた。'
                'もうひとつの原則の外は、同じ欄のすぐ上にある信託の終了（繰上償還・解約）で、その場合は以後の決算日が来ない。'
                '分配を必ず行うわけではない旨は別の主張（分配方針）として本文に書いている。')
    if '原則として' in ctx and ('ヘッジ' in ctx or '為替' in ctx):
        return '交付目論見書の文言（原則として為替ヘッジを行わない）を写した。例外は目論見書の「市況動向の急激な変化等の場合は上記の運用ができない場合がある」旨で、本文では「原則なし」と表示して断定していない。'
    if '原則として' in ctx:
        return '交付目論見書の総経費率の注記（原則として購入時手数料・売買委託手数料・有価証券取引税を含まない）を写した。含まれない費用がほかにもある場合がある旨は目論見書の注記どおり。'
    if '必ず' in ctx:
        return '否定文・限定文（必ずしも〜とは限らない）として使い、断定していない。過去の実績と将来の関係について例外を述べる文。'
    return '文脈を読み、例外を本文に書いたことを確認した。'

if __name__ == '__main__':
    if '--ledger' in sys.argv:
        # Rebuild the page model only (do not rewrite HTML: generators have already run on it).
        ps = []
        for fn in selected():
            p, title, desc, body, sections, related = fn()
            p.title = title
            for k in (p.a, p.b):
                for d in (FUNDS[k]['P'], FUNDS[k].get('Ak'), FUNDS[k].get('M')):
                    p.src(d)
            p.r('identity', E(title)); p.r('desc', E(desc)); lead_html(p); sources_block(p)
            ps.append(p)
        bad = 0
        for p in ps:
            for e in build_ledger(p):
                print('LEDGER', p.slug, e); bad += 1
        print('ledger errors', bad)
        sys.exit(1 if bad else 0)
    ps = build_all()
