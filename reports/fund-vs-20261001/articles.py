# Article bodies for build.py (exec'd inside build.py's namespace).
# Each sentence is registered against one claim, so the ledger maps every review unit to its source.

def pair_claim(p, cid, field, text):
    """Claim stated for both funds in one sentence: A's quote, B's quote recorded in exceptions."""
    ca, cb = p.claims[p.fc(p.a, field)], p.claims[p.fc(p.b, field)]
    return p.claim(cid, text, ca['source_url'], ca['source_quote'], ca['applies'],
                   ca['exceptions'] + f' 比較相手: {cb["source_url"]}「{cb["source_quote"]}」')

def desc_claim(p):
    pair_claim(p, 'feepair', 'fee', f'{p.A["short"]}と{p.B["short"]}の信託報酬（ファンド本体）')
    pair_claim(p, 'terpair', 'ter', f'{p.A["short"]}と{p.B["short"]}の総経費率と対象期間')
    c = p.claims['feepair']
    return p.claim('desc', 'meta description（実績と費用の要約）', c['source_url'], c['source_quote'], c['applies'],
                   c['exceptions'] + f' 実績: {p.claims["perfA"]["source_url"]}「{p.claims["perfA"]["source_quote"]}」 / {p.claims["perfB"]["source_url"]}「{p.claims["perfB"]["source_quote"]}」')

def S(p, cid, text):
    return p.r(cid, E(text) if '<' not in text else text)

def perf_lead(p, prefix=''):
    r, A, B = p.r_, p.A, p.B
    return S(p, 'perf', prefix + f"{jd(r['起点'])}〜{jd(r['終点'])}に100万円を一括で投資し、税引前の分配金を再投資した場合の終了時評価額は、{A['short']}が{yen(r['A100万円終価'])}、{B['short']}が{yen(r['B100万円終価'])}でした。")

def dd_line(p):
    r, A, B = p.r_, p.A, p.B
    return S(p, 'perf', f"同じ期間の最大下落率は{A['short']}が{pct(r['A最大下落率'])}、{B['short']}が{pct(r['B最大下落率'])}です。")

def one_year_line(p):
    r, A, B = p.r_, p.A, p.B
    one = r['1年窓']
    return S(p, 'perf', f"直近1年（{jd(one['起点'])}〜{jd(one['終点'])}）の騰落率は{A['short']}が{pct(one['A累積'])}、{B['short']}が{pct(one['B累積'])}でした。")

def fee_line(p):
    A, B = p.A, p.B
    return S(p, 'feepair', f"信託報酬（ファンド本体）は{A['short']}が{A['fee']}、{B['short']}が{B['fee']}です。")

def ter_line(p):
    A, B = p.A, p.B
    pair_claim(p, 'terpair', 'ter', f'{A["short"]}と{B["short"]}の総経費率と対象期間')
    ta = f"{A['ter']}（{A['ter_period']}）" if A['ter'] else f"未掲載（{A['ter_period']}）"
    tb = f"{B['ter']}（{B['ter_period']}）" if B['ter'] else f"未掲載（{B['ter_period']}）"
    return S(p, 'terpair', f"直近の運用報告書の作成対象期間の総経費率は、{A['short']}が{ta}、{B['short']}が{tb}です。")

def fee_note(p):
    """Notes under the fee table: what TER excludes, where each TER value is printed, and fund-specific conditions."""
    A, B = p.A, p.B
    h = P(S(p, 'feehead', '総経費率には、原則として購入時手数料、売買委託手数料、有価証券取引税が含まれません。対象期間と、含まれる費用の範囲をそろえて読む必要があります。'))
    fs = [(k, FUNDS[k]) for k in (p.a, p.b)]
    pk = [k for k, f in fs if f['ter'] and f.get('ter_doc', 'P') == 'P']
    if pk:
        other = ''.join(f' 比較相手: {url(FUNDS[k]["P"])}「{Q(FUNDS[k]["P"], r"[（〈]参考情報[）〉]\s?ファンドの総経費率.{0,40}")}」' for k in pk[1:])
        p.docq('tersrc', '総経費率は直近の運用報告書の作成対象期間の値で、交付目論見書の（参考情報）欄に載っている', FUNDS[pk[0]]['P'],
               r'[（〈]参考情報[）〉]\s?ファンドの総経費率.{0,40}', '交付目論見書の（参考情報）欄の見出しと対象期間で確認。楽天・VYMは交付目論見書の値が1期前の期間（2024年7月17日〜2025年7月15日）のため、新しい交付運用報告書の値を使った。' + other)
    in_p = [FUNDS[k]['short'] for k in pk]
    in_ak = [f['short'] for k, f in fs if f['ter'] and f.get('ter_doc') == 'Ak']
    srcs = []
    if in_p:
        srcs.append(S(p, 'tersrc',
                      f'表の総経費率は、直近の運用報告書の作成対象期間の実績値で、{"と".join(in_p)}は交付目論見書の（参考情報）欄に載っている値です。' if len(in_p) < 2 else
                      '表の総経費率は、直近の運用報告書の作成対象期間の実績値で、交付目論見書の（参考情報）欄に載っている値です。'))
    if in_ak:
        k = next(k for k, f in fs if f.get('ter_doc') == 'Ak')
        srcs.append(S(p, f'{k}-ter', f'{in_ak[0]}は、交付目論見書の値が1期前の期間のものなので、新しい交付運用報告書（{FUNDS[k]["ter_period"]}）の値を載せています。'))
    for k, f in fs:
        if f.get('terd_q'):
            srcs.append(S(p, f'{k}-terd', f'{f["short"]}の{f["ter"]}は交付目論見書が載せている小数第5位までの詳細な値で、同じ欄の小数第2位までの表示では{f["ter_round"]}です。'))
    if any(f.get('terd_q') for k, f in fs) and not all(f.get('terd_q') or not f['ter'] for k, f in fs):
        srcs.append(S(p, 'feehead', '2本で表示の桁数が違うため、小数第3位以下の差は比べられません。'))
    if srcs:
        h += P(*srcs)
    extra = []
    lend = [lend_sentence(p, k) for k, f in fs]
    first = next((k for k, f in fs if f.get('lend_q')), None)
    if first:
        rows = '表の信託報酬と実質的な負担' if (A['etf'] or B['etf']) else '表の信託報酬'
        lend.append(S(p, f'{first}-lend', f'{rows}は、貸付を行った場合のこれらの額を含まない率です。'))
    h += P(*lend)
    for k, f in fs:
        if f.get('ter_mark'):
            schd_terfund_claim(p)
            extra.append(S(p, f'{k}-terfund', f'※{f["short"]}の{f["ter"]}には、投資先ETFにかかる年0.06%程度の報酬が反映されていますが、委託会社がその相当額をファンドに別途充当しています（詳しくは下の費用の節）。'))
    if extra:
        h += P(*extra)
    return h

def lend_sentence(p, k, short=False):
    """What each prospectus says about securities-lending fees (品貸料). Written for both funds of a pair, including "no mention"."""
    f = FUNDS[k]
    if f.get('lend_kind') == 'add':
        if short:
            return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書には、有価証券の貸付の指図を行った場合に、品貸料の一部（{f["lend_rate"]}以内の額）が信託報酬に追加される定めがあります。')
        return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書は、有価証券の貸付の指図を行った場合、ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の{f["lend_rate"]}以内の額が運用管理費用（信託報酬）に追加されると定めています。')
    if f.get('lend_kind') == 'other':
        return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書は、その他の費用・手数料のひとつに貸付有価証券関連報酬を挙げ、有価証券の貸付取引を行った場合は、投資信託財産の収益となる品貸料に{f["lend_rate"]}を乗じて得た額としています。')
    assert '品貸料' not in text(f['P']), k
    extra = '「有価証券の貸付等においては、取引相手先の倒産等による決済不履行リスクを伴います」という投資リスクの記載はあるが、品貸料の配分や信託報酬への追加の定めは無い。' if '有価証券の貸付等においては' in text(f['P']) else ''
    p.claim(f'{k}-nolend', f'{f["name"]}の交付目論見書に品貸料についての記載が無い', url(f['P']), Q(*f['fee_q']), f'{PUB}に確認した{DOCS[f["P"]][1]}',
            '交付目論見書の抽出テキスト全文を「品貸料」で検索して0件であることを確認した（生成のたびに assert で確かめ、語が現れたら生成が止まる）。source_quote は同じ資料の運用管理費用（信託報酬）の欄で、ここに貸付時の追加の定めが無い。' + extra)
    return S(p, f'{k}-nolend', f'{f["short"]}の交付目論見書には、品貸料についての記載がありません。')

def schd_terfund_claim(p):
    return p.docq('rakuten-schd-terfund', '楽天・SCHDの総経費率には投資先ETFの報酬が反映され、その相当額は委託会社がファンドに充当している', 'risude_P',
           r'\(注\)当該比率には、投資対象とする投資信託証券にかかる年0\.06%程度の報酬が反映されていますが、委託会社が合理的に見積った当該報酬相当額 ?をファンドに別途充当しています。',
           '交付運用報告書（注9）にも同じ記載がある。比較相手の資料（交付目論見書・交付運用報告書）に「充当」の記載が無いことを全文検索で確認した。',
           extra_doc=[('risude_Ak', r'総経費率（①＋②） 0\.19% ①このファンドの費用の比率 0\.13% ②投資先ファンドの運用管理費用等の比率 0\.06%')])

def schd_ter_detail(p, other):
    """Rakuten SCHD's TER includes the investee ETF fee that the manager reimburses; the other fund's TER has no such note."""
    o = FUNDS[other]
    schd_terfund_claim(p)
    pats = {'sbi-vym4': ('svym_Ak', r'総経費率（①＋②） 0\.14％ ①当ファンドの費用の比率 0\.08％ ②投資先ファンドの運用管理費用の比率 0\.06％', '0.14%', '当ファンドの費用の比率0.08%、投資先ファンドの運用管理費用の比率0.06%'),
            'rakuten-vym': ('rivuh_Ak', r'総経費率（①＋②） 0\.22% ①このファンドの費用の比率 0\.16% ②投資先ファンドの運⽤管理費⽤等の⽐率 0\.06%', '0.22%', 'このファンドの費用の比率0.16%、投資先ファンドの運用管理費用等の比率0.06%')}
    d, pat, v, brk = pats[other]
    p.docq(f'{other}-terbrk', f'{o["short"]}の総経費率の内訳', d, pat, '交付運用報告書の総経費率の内訳で確認。投資先ETFの報酬相当額を委託会社が充当する旨の注記は無い。')
    etf = []
    if other == 'rakuten-vym':
        p.docq('rakuten-vym-etfchg', '楽天・VYMの投資先ETFの管理報酬等（年0.04%）は2026年2月2日付で変更された後の値', 'rivuh_P',
               r'0\.04%＊ 米国高配当株式ETF グループ・インク 目指す ＊2026年2月2日付で変更されました。',
               '交付目論見書の「投資対象ファンドの概要」の表（段組のため抽出テキストでは語順が入れ替わる）。変更前の率は資料に書かれていないため本文にも書いていない。総経費率の内訳0.06%は交付運用報告書の作成対象期間の実績で、変更日より前の期間を含む。',
               extra_doc=[('rivuh_Ak', r'（作成対象期間 2025年7月16日～2026年7月15日）'), ('rivuh_P', r'※上記の内容は、今後変更になる場合があります。')])
        etf.append(S(p, 'rakuten-vym-etfchg', '楽天・VYMの投資先ETFの費用は、交付目論見書の年0.04%程度と、総経費率の内訳の0.06%とで数字が違います。年0.04%程度は、投資先ETFの管理報酬等が2026年2月2日付で変更された後の率です。0.06%は2025年7月16日〜2026年7月15日の実績で、変更日より前の期間を含みます。'))
    else:
        p.docq('sbi-vym4-etfgap', 'SBI・V・米国高配当（年4回）の投資先ETFの費用は、交付目論見書の概算（年0.04%程度）と交付運用報告書の内訳（0.06%）で数字が違う', 'svym_P',
               r'年0\.04％程度 投 資 信 託 証 券 ＊マザーファンド受益証券を通じて投資するETF（上場投資信託証券）の信託報酬等',
               '交付目論見書の値は「程度」と書かれた概算、交付運用報告書の値は作成対象期間（2025年11月21日〜2026年5月20日）の実績の比率。2つが違う理由は資料に書かれていないため、本文でも理由を書いていない。',
               extra_doc=[('svym_Ak', r'②投資先ファンドの運用管理費用の比率 0\.06％')])
        etf.append(S(p, 'sbi-vym4-etfgap', 'SBI・V・米国高配当（年4回）の投資先ETFの費用は、交付目論見書の年0.04%程度と、総経費率の内訳の0.06%とで数字が違います。前者は交付目論見書の概算値、後者は2025年11月21日〜2026年5月20日の実績の比率で、違いの理由は資料に書かれていません。'))
    return P(S(p, 'rakuten-schd-terfund', '楽天・SCHDの総経費率0.19%には、投資先ETFにかかる年0.06%程度の報酬が反映されていますが、委託会社がその相当額をファンドに別途充当していると交付目論見書の注記にあります。交付運用報告書の内訳は、このファンドの費用の比率が0.13%、投資先ファンドの運用管理費用等の比率が0.06%です。'),
             S(p, f'{other}-terbrk', f'{o["short"]}の{v}の内訳は、{brk}で、このような充当の記載はありません。'), *etf,
             S(p, 'rakuten-schd-terfund', '充当の扱いが違うため、総経費率の数字どうしの差は、そのまま実質的な負担の差にはなりません。'))

def faq_net(p):
    return ('method', '表の評価額は売却して受け取れる金額ですか？',
            '違います。税引前の分配金を再投資した基準価額で計算した売却前の金額です。購入時・換金時の手数料や投資者ごとの税金は含みません。基準価額に反映済みの信託報酬を二重に引いてもいません。')

def gap_claim(p, cid, text, field='fee'):
    ca, cb = p.claims[p.fc(p.a, field)], p.claims[p.fc(p.b, field)]
    return p.claim(cid, text, ca['source_url'], ca['source_quote'], ca['applies'],
                   '2本の料率の差は本文で引き算した値（100万円×差の目安を含む）。実際の利益差ではない旨を同じ段落に書いた。比較相手: '
                   + f'{cb["source_url"]}「{cb["source_quote"]}」')

def gap_text(p, extra=''):
    A, B = p.A, p.B
    hi, lo = (A, B) if A['fee_num'] >= B['fee_num'] else (B, A)
    d = round(hi['fee_num'] - lo['fee_num'], 5)
    ds = f'{d:.5f}'.rstrip('0').rstrip('.')
    amt = round(d / 100 * 1_000_000)
    return d, ds, amt, hi, lo

def std_sections(mech_id, mech_title, cost_title):
    return [('performance', '同じ期間の100万円を、分配金再投資で比べる'), ('fees', '目論見書の料率と、総経費率の実績を分けて見る'),
            (mech_id, mech_title), ('cost-detail', cost_title), ('method', '計算条件と、この比較からは分からないこと'),
            ('faq', 'よくある質問'), ('source', '出典')]

def P(*parts):
    return '<p>' + ''.join(parts) + '</p>'

def orcan_tier(p):
    return (S(p, 'orcan-fee', 'オルカンは純資産総額に応じた段階制で、5,000億円未満の部分が年0.05775%、5,000億円以上1兆円未満の部分が年0.05764%、1兆円以上の部分が年0.05753%です。')
            + S(p, 'orcan-tier', '交付目論見書は、純資産総額が10兆9,000億円・11兆4,000億円・11兆9,000億円の例で、実質信託報酬率をいずれも年0.05755%としています。'))

def corr_period(p):
    r = p.r_
    return f"比較期間（{jd(r['起点'])}〜{jd(r['終点'])}）の日次騰落率の相関は"


# ======================================================================== 1. orcan vs FANG+
@article
def a_orcan_fang():
    p = Page('orcan-vs-fang', 'orcan', 'fang', 'orcan__fang')
    r = p.r_
    p.title = title = 'eMAXIS Slimオルカン vs iFreeNEXT FANG+｜費用と3年の実績を比較'
    desc = (f"eMAXIS Slimオルカンと iFreeNEXT FANG+を同じ3年で比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}、"
            f"最大下落率は{pct(r['A最大下落率'])}と{pct(r['B最大下落率'])}。信託報酬0.05775%以内と0.7755%、重なる8社も確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    om, fm = 'orcan_M', 'fang_M'
    p.docq('comp-orcan', 'オルカンの国・地域別比率、組入銘柄数、組入上位10銘柄（2026年8月31日現在）', om,
           r'1 アメリカ 62\.8%.{0,700}?組入銘柄数: 2,409銘柄.{0,400}?10 MICRON TECHNOLOGY INC アメリカ 情報技術 1\.0%',
           '月次レポートの比率は純資産総額に対する割合で、国・地域は先進国株式部分が主要取引所所在地、新興国株式部分が法人登録地による（同レポートの注記）。上位10銘柄より下の保有は月次レポートからは分からないため、本文で断らずに「入っていない」とは書いていない。')
    p.docq('comp-fang', 'FANG+の資産別構成・国別構成・組入上位10銘柄（2026年8月末基準）', fm,
           r'外国株式 10 96\.1%.{0,80}?外国株式 先物 1 3\.9%.{0,1400}?MICRON TECHNOLOGY マイクロン・テクノロジー 情報技術 アメリカ 7\.9%',
           '比率は純資産総額に対するもの。指数は四半期ごとに等金額へリバランスされるため、月末の比率は月によって変わる（交付目論見書の特色で確認）。',
           extra_doc=[('fang_P', r'※当指数は、四半期 （3・6・9・12月） ごとに等金額となるようリバランスを行ないます。')])
    p.claim('overlap', 'オルカン上位10銘柄とFANG+構成10社の重なり（8社）と比率の合計（22.1%・74.3%）', url(om),
            p.claims['comp-orcan']['source_quote'], f'{PUB}に確認した月次レポート（2026年8月末）',
            '合計はオルカン側の上位10銘柄のうちFANG+構成企業に当たる9行（アルファベットは2種類の株式）の比率を足した値、FANG+側は同じ8社の比率の合計。FANG+側の出典: '
            + f'{url(fm)}「{p.claims["comp-fang"]["source_quote"]}」')
    gap_claim(p, 'feegap', 'オルカンの段階制の最も高い率とFANG+の料率の差と100万円あたりの目安')
    p.docq('netnav', '基準価額は信託報酬控除後', 'fang_P', r'※基準価額の計算において運用管理費用（信託報酬）は控除しています。',
           '無し: 交付目論見書の運用実績欄の注記で確認。オルカン側も同趣旨。')
    d, ds, amt, hi, lo = gap_text(p)
    p.docq('fang-risk', 'FANG+の交付目論見書が挙げる集中投資のリスク', 'fang_P',
           r'当ファンドは、一銘柄当たりの組入比率が高くなる場合があり、より多 信用リスク 数の銘柄に分散投資した場合に比べて基準価額の変動が大きくなる可 能性があります。 また、特定の分野に関連する銘柄に投資しますので、こうした銘柄の下 落局面では、基準価額が大きく下落することがあります。',
           '交付目論見書の「投資リスク」の価格変動リスク・信用リスクの欄（PDFの段組で見出し「信用リスク」が文中に挟まって抽出される）。「場合がある」「可能性がある」「ことがある」の限定は本文でもそのまま残した。')
    lead = P(perf_lead(p, '結論から言うと、'), dd_line(p),
             S(p, 'fang-risk', 'なお、FANG+の交付目論見書は投資リスクとして、一銘柄当たりの組入比率が高くなる場合があり、より多数の銘柄に分散投資した場合に比べて基準価額の変動が大きくなる可能性があること、特定の分野に関連する銘柄の下落局面では基準価額が大きく下落することがあることを挙げています。'))
    lead += P(fee_line(p), S(p, 'overlap', 'FANG+の10社のうち8社は、オルカンの組入上位10銘柄にも入っています（2026年8月31日現在）。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'overlap', '<h2 id="mechanism">2,409銘柄と10銘柄：重なるのは上位の大型株</h2>')
    body += P(S(p, 'comp-orcan', 'オルカンの2026年8月31日現在の組入銘柄数は2,409銘柄で、国・地域別ではアメリカが62.8%、日本が5.0%です。'))
    body += P(S(p, 'comp-fang', 'FANG+は2026年8月末時点で外国株式10銘柄（純資産総額の96.1%）と株価指数先物（3.9%）を持ち、国・地域別ではアメリカが100.0%です。'),
              S(p, 'comp-fang', '対象のNYSE FANG+指数は、四半期（3・6・9・12月）ごとに等金額となるようリバランスを行います。月末の比率が10%ずつでないのは、リバランス後の株価の動きで比率が変わるためです。'))
    rows = [('パランティア・テクノロジーズ', '上位10銘柄外', '12.6%'), ('マイクロソフト', '3.4%', '11.9%'), ('アマゾン・ドット・コム', '2.4%', '9.9%'),
            ('アップル', '4.4%', '9.5%'), ('エヌビディア', '4.7%', '9.4%'), ('ネットフリックス', '上位10銘柄外', '9.3%'),
            ('メタ・プラットフォームズ', '1.2%', '9.0%'), ('アルファベット', '1.8%＋1.6%（2種類の株式）', '8.4%'),
            ('ブロードコム', '1.6%', '8.3%'), ('マイクロン・テクノロジー', '1.0%', '7.9%')]
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">FANG+の構成企業</th><th scope="col" class="num">オルカンでの比率</th><th scope="col" class="num">FANG+での比率</th></tr></thead><tbody>'
    for n, o, f in rows:
        t += f'<tr><th scope="row">{n}</th><td class="num">{S(p, "comp-orcan", o)}</td><td class="num">{S(p, "comp-fang", f)}</td></tr>'
    t += f'<tr><th scope="row">{S(p, "overlap", "重なる8社の合計")}</th><td class="num">{S(p, "overlap", "22.1%")}</td><td class="num">{S(p, "overlap", "74.3%")}</td></tr></tbody></table></div>'
    body += t + P(S(p, 'comp-orcan', '比率は2026年8月末時点、純資産総額に対する割合です。オルカン側の「上位10銘柄外」は、月次レポートの上位10銘柄に載っていないという意味で、保有していないという意味ではありません。'))
    body += P(S(p, 'overlap', 'オルカンの上位10銘柄のうち、台湾のTSMCを除く9行（アルファベットは2種類の株式）がFANG+の構成企業と同じ8社で、比率の合計は22.1%です。FANG+ではこの8社が74.3%を占めます。'),
              S(p, 'overlap', '2本を組み合わせると、この8社への配分が増えます。'))
    body += S(p, 'feegap', f'<h2 id="cost-detail">信託報酬の差は年{ds}ポイント（オルカンは段階制の最も高い率で計算）</h2>')
    body += P(S(p, 'fang-fee', 'FANG+の信託報酬は年0.7755%で、段階制ではありません。'), orcan_tier(p),
              S(p, 'feegap', f'オルカンの段階制で最も高い率（年0.05775%）とFANG+の年0.7755%の差は年{ds}ポイントで、100万円を1年間一定額で保有すると仮定した目安は約{amt:,}円です。この金額は実際の利益差ではありません。'))
    body += P(ter_line(p), S(p, 'terpair', '2本の対象期間はずれているため、総経費率の差には年度の違いも入ります。'))
    body += P(S(p, 'netnav', '基準価額は信託報酬を差し引いた後の値なので、上の実績表の差は費用を引いた後の結果です。'),
              S(p, 'perf', '費用の差が大きくても指数の値動きの差がそれを上回る期間・下回る期間があり、表の差は特定の期間に限った結果です。'))
    body += method_section(p)
    one = r['1年窓']
    body += faq_block(p, [
        ('overlap', 'オルカンを持っていれば、FANG+の企業にも投資していますか？',
         '2026年8月31日現在のオルカンの組入上位10銘柄には、FANG+を構成する10社のうち8社が入っており、比率の合計は22.1%です。FANG+ではこの8社が74.3%を占めます。'),
        faq_net(p),
        ('fang-index', 'iFreeNEXT FANG+は何に連動を目指すファンドですか？',
         [('fang-index', '交付目論見書の目的は「米国上場企業の株式に投資し、NYSE FANG+指数（配当込み、円ベース）の動きに連動した投資成果をめざします」です。'),
          ('fang-hedge', '為替ヘッジは原則として行いません。')]),
        ('perf', '直近1年ではどちらが上でしたか？',
         f"{jd(one['起点'])}〜{jd(one['終点'])}の騰落率はオルカンが{pct(one['A累積'])}、FANG+が{pct(one['B累積'])}でした。3年の比較とは差の大きさが違い、開始日によって結果は変わります。"),
    ])
    sections = std_sections('mechanism', '2,409銘柄と10銘柄：重なるのは上位の大型株', f'信託報酬の差は年{ds}ポイント（オルカンは段階制の最も高い率で計算）')
    related = [('../emaxis-sp-vs-fang/', 'eMAXIS Slim S&P500 vs iFreeNEXT FANG+', '米国株の大型株指数とFANG+を同じ方法で比べる'),
               ('../ifreenext-fang-vs-rakuten-nasdaq/', 'iFreeNEXT FANG+ vs 楽天・プラス・NASDAQ100', '集中度と費用を比べる'),
               ('../orcan-hikaku/', 'eMAXIS Slimオルカン vs 楽天・プラス・オルカン', '同じ指数の商品差を確かめる')]
    return p, title, desc, body, sections, related

# ======================================================================== 2. India
@article
def a_india():
    p = Page('ifreenext-india-vs-rakuten-india', 'ifreenext-india', 'rakuten-india', 'ifreenext-india__rakuten-india')
    r = p.r_
    p.title = title = 'iFreeNEXT インド株 vs 楽天・インド株Nifty50｜費用と実績を比較'
    desc = (f"iFreeNEXT インド株インデックスと楽天・インド株Nifty50を同期間で比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}。"
            f"信託報酬0.473%と0.308%、総経費率0.50%と0.42%、先物の使い方の違いを確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    p.docq('comp-d', 'iFreeNEXT インド株の資産別構成（2026年8月31日基準）', 'dindia_M',
           r'外国株式 50 71\.8% インド・ルピー 100\.0%.{0,40}?外国株式 先物 1 28\.0%',
           '比率は純資産総額に対するもの。先物の建玉がある場合は資産別構成の比率合計欄を表示しない旨が月次レポートにある。iFreeNEXT もファミリーファンド方式でマザーファンドを通じて投資する（交付目論見書）。',
           extra_doc=[('dindia_M', r'IFSC NIFTY 50 SEP 26 --- インド 28\.0%'), ('dindia_M', r'※比率は、純資産総額に対するものです'),
                      ('dindia_P', r'当ファンドは、ファミリーファンド方式で運用を行ないます。')])
    p.docq('idxseries', '2本の連動対象は、各運用会社がそれぞれ円換算したNifty50指数（配当込み）', 'dindia_P',
           r'当ファンドのベンチマークは、インド・ルピー建てのNifty50指数 ?（配当込み）.{0,60}?大和アセットマネジメントが円換算したNifty50指数 ?（配当込み、円ベース）です。',
           '「税引後配当込み」の表記は2社にある: 大和は交付目論見書の年間収益率の欄、楽天は月次レポートの基準価額グラフの注（本文に2社を並べて引用。楽天の交付目論見書の年間収益率の注は「配当込み、円換算ベース」）。2本の円換算後の指数値が一致するかは資料からは確かめられないため、同じ系列とは書いていない。',
           extra_doc=[('dindia_P', r'当ファンドのベンチマークはNifty50指数（税引後配当込み、円ベース）です。'),
                      ('riinf50_M', r'※ インデックスは、Ｎｉｆｔｙ５０指数（税引後配当込み、円換算ベース）です。'),
                      ('riinf50_P', r'「Ｎｉｆｔｙ５０指数 ?（配当込み、円換算ベース）」 ?とは、委託会社が「Ｎｉｆｔｙ５０指数」に日々の為替レー ?トを乗じて算出したものです。')])
    pair_claim(p, 'hedgepair', 'hedge', '2本とも原則として為替ヘッジを行わない')
    p.docq('comp-r', '楽天・インド株Nifty50のマザーファンドの投資状況（2026年8月末）', 'riinf50_M',
           r'株式 78\.5%.{0,80}?株式先物 21\.6% 通貨先物 21\.5%',
           '比率はマザーファンドの純資産総額に対するもの。月次レポートの「当ページの数値はマザーファンドベースです」の注記を確認。',
           extra_doc=[('riinf50_M', r'投資銘柄数 50')])
    p.docq('tax-d', 'インドのキャピタル・ゲイン課税と総経費率の注記（大和）', 'dindia_P',
           r'※その他費用には、\s?インドにおける非居住者による株式の売却益\s*（キャピタル・ゲイン）\s*に対する税が含まれる場合があります。',
           '「含まれる場合がある」との記載で、常に含まれるとは書かれていない。本文も「場合がある」と書いた。',
           extra_doc=[('riinf50_P', r'インドにおける、非 居住者による株式の売却益（キャピタル・ゲイン）に対する税負担等が、基準価額に影響を与える可能性が あります。')])
    p.docq('nifty', 'Nifty50指数の定義', 'dindia_P',
           r'Nifty50指数は、インドのナショナル証券取引所に上場している、浮動株調整後の時価総額、流動性の基準を 用いて選定した50社の株式で構成される株価指数です。',
           '無し: 交付目論見書の指数の説明で確認。楽天側も同じNifty50指数（配当込み、円換算ベース）を連動対象とする。')
    gap_claim(p, 'feegap', '2本の信託報酬の差')
    p.docq('futdev', '先物と指数の動きの不一致はかい離要因', 'riinf50_M', r'株価指数先物と対象指数の動きの不一致（先物を利用した場合）',
           '「要因は、上記に限定されるものではありません」の注記も確認した。')
    d, ds, amt, hi, lo = gap_text(p)
    a_cum, b_cum = r['A累積'], r['B累積']
    lead = P(perf_lead(p, '結論から言うと、'), S(p, 'perf', f"累積騰落率は{p.A['short']}が{pct(a_cum)}、{p.B['short']}が{pct(b_cum)}で、この期間は2本ともマイナスでした。"))
    lead += P(fee_line(p), S(p, 'feegap', f'信託報酬は楽天の方が年{ds}ポイント低い一方、この期間の実績は大和のiFreeNEXTの方が高く、料率の順序と実績の順序は一致していません。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'nifty', '<h2 id="mechanism">同じNifty50でも、株式と先物の持ち方が違う</h2>')
    body += P(S(p, 'nifty', 'Nifty50指数は、インドのナショナル証券取引所に上場している、浮動株調整後の時価総額と流動性の基準で選んだ50社の株式で構成される指数です。'),
              S(p, 'idxseries', '2本とも、この指数（配当込み）を円に換算した値への連動を目指しますが、円換算はそれぞれの運用会社が行っています。大和はインド・ルピー建ての指数を自社で円換算した値を、楽天は委託会社が指数に日々の為替レートを掛けて算出した値を使います。大和は交付目論見書の年間収益率の欄でベンチマークを「Nifty50指数（税引後配当込み、円ベース）」と表記し、楽天は月次レポートでインデックスを「Ｎｉｆｔｙ５０指数（税引後配当込み、円換算ベース）」と表記しています。'),
              S(p, 'hedgepair', '為替ヘッジは2本とも原則として行いません。'))
    body += P(S(p, 'comp-d', 'iFreeNEXT インド株もファミリーファンド方式で、マザーファンドを通じて投資します。2026年8月31日基準の資産別構成は、当ファンドの純資産総額に対し外国株式50銘柄が71.8%、株価指数先物が28.0%でした。'),
              S(p, 'comp-r', '楽天・インド株Nifty50はマザーファンドベースで株式78.5%（50銘柄）、株式先物21.6%、通貨先物21.5%です（2026年8月末）。'))
    body += P(S(p, 'comp-d', '株式を直接持つ部分と、先物で指数の値動きを取る部分の割合は2本で違い、月末ごとにも変わります。'),
              S(p, 'futdev', '楽天の月次レポートは、基準価額と指数がかい離する要因の1つに「株価指数先物と対象指数の動きの不一致（先物を利用した場合）」を挙げています。'),
              S(p, 'perf', corr_period(p) + f"{r['同日相関']:.3f}で、近いものの同じではありません。"))
    body += S(p, 'tax-d', '<h2 id="cost-detail">総経費率に入る費用と、入らない費用</h2>')
    body += P(ter_line(p), S(p, 'terpair', '対象期間は2本で約1か月ずれています。'))
    body += P(S(p, 'tax-d', '大和の交付目論見書は、総経費率のその他費用に「インドにおける非居住者による株式の売却益（キャピタル・ゲイン）に対する税が含まれる場合があります」と書いています。'),
              S(p, 'tax-d', '楽天の交付目論見書も、同じ税負担が基準価額に影響を与える可能性があると記載しています。'))
    body += P(S(p, 'feegap', f'信託報酬の差は年{ds}ポイントで、100万円を1年間一定額で保有すると仮定した目安は約{amt:,}円です。この金額は実際の利益差ではありません。'),
              S(p, 'perf', 'この期間は信託報酬の低い方が実績で下回りました。差の要因を、税・売買・先物の使い方のどれか1つに資料から特定することはできません。'))
    body += method_section(p)
    body += faq_block(p, [
        ('idxseries', '2本は同じ指数ですか？', '2本ともNifty50指数（配当込み）を円に換算した値への連動を目指しますが、円換算はそれぞれの運用会社が行っています。大和は交付目論見書の年間収益率の欄でベンチマークを「Nifty50指数（税引後配当込み、円ベース）」と表記し、楽天は月次レポートでインデックスを「Ｎｉｆｔｙ５０指数（税引後配当込み、円換算ベース）」と表記しています。2本は別の投資信託で、株式と先物の割合、信託報酬、決算期間が異なります。'),
        faq_net(p),
        ('tax-d', 'インドの税金は信託報酬に含まれますか？', '信託報酬には含まれません。大和の交付目論見書は、インドの非居住者に対するキャピタル・ゲイン課税が総経費率のその他費用に含まれる場合があると記載しています。'),
        ('perf', '信託報酬が低い方が実績も上回りますか？', f"この比較期間では、信託報酬が低い楽天・インド株Nifty50の累積騰落率が{pct(b_cum)}、iFreeNEXT インド株が{pct(a_cum)}で、料率の低い方が下回りました。期間を変えれば順序は変わり得ます。"),
    ])
    sections = std_sections('mechanism', '同じNifty50でも、株式と先物の持ち方が違う', '総経費率に入る費用と、入らない費用')
    related = [('../index-toushi/', 'インデックス投資の仕組みと費用', '指数連動型の費用の読み方'),
               ('../orcan-hikaku/', 'eMAXIS Slimオルカン vs 楽天・プラス・オルカン', '同じ指数の商品差を確かめる'),
               ('../../toushi/tsumitate/', '積立シミュレーター', '積立額と期間から将来額の目安を計算します')]
    return p, title, desc, body, sections, related

# ======================================================================== 3/8. high dividend helpers
def dist_rows_rakuten(p, k, since):
    import csv as _csv
    f = R / NAV[k][0]
    rows = list(_csv.reader(f.read_bytes().decode('cp932').splitlines()))
    return [(r_[0], int(r_[4])) for r_ in rows[1:] if len(r_) > 4 and r_[4].strip() and r_[0].replace('/', '-') >= since]

def dist_rows_sbi(k, since):
    import xml.etree.ElementTree as ET
    root = ET.fromstring((R / NAV[k][0]).read_bytes().decode('cp932'))
    out = []
    for d in root.findall('.//day'):
        a = d.attrib
        if a.get('divident') and float(a['divident'] or 0) > 0:
            ds_ = f"{a['year']}-{a['month']}-{a['value']}"
            if ds_ >= since: out.append((f"{a['year']}/{a['month']}/{a['value']}", int(float(a['divident']))))
    return out

def distnav_claims(p):
    p.docq('distnav', '分配金は純資産から支払われ、その分基準価額が下がる', 'risude_P',
           r'分配金は、 預貯金の利息とは異なり、 投資信託の純資産から支払われますので、 分配金が支払われると、 その金額相当 分、 基準価額は下がります。',
           '無し: 交付目論見書の「収益分配金に関する留意事項」で確認。')
    p.docq('distpolicy', '分配金は委託会社が決定し、支払われない場合もある', 'risude_P',
           r'※分配金額は、収益分配方針に基づいて委託会社が決定します。あらかじめ一定の額の分配をお約束するものではありません。分配金が支払われない 場合もあります。',
           '無し: 交付目論見書の分配の注記で確認。SBI・楽天VYMの資料にも同趣旨の記載がある。')

def dist_claim(p, cid, k, rows):
    dates = [d.replace('/', '-') for d, _ in rows]
    q, u = nav_rows(k, *dates)
    return p.claim(cid, f"{FUNDS[k]['short']}の分配金（1万口当たり・税引前）", u, q, f'{PUB}に取得した運用会社公表データ（{dates[0]}〜{dates[-1]}の決算）',
                   '分配金は1万口当たり・税引前の金額。基準価額の水準が異なるため、円の金額どうしで利回りを比べられない旨を本文に書いた。分配金は収益分配方針に基づき委託会社が決定し、支払われない場合もある。')

@article
def a_schd_sbivym():
    p = Page('rakuten-schd-vs-sbi-vym', 'rakuten-schd', 'sbi-vym4', 'rakuten-schd__sbi-vym4')
    r = p.r_
    p.title = title = '楽天・SCHD vs SBI・V・米国高配当（年4回）｜分配金・費用・実績を比較'
    one = r['1年窓']
    desc = (f"楽天・シュワブ・高配当株式・米国ファンドとSBI・V・米国高配当株式（年4回決算型）を比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}、"
            f"実質的な負担は0.1238%程度と0.1038%程度。直近1年は順序が逆でした。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    distnav_claims(p)
    ra = dist_rows_rakuten(p, 'rakuten-schd', '2025-10-01'); rb = dist_rows_sbi('sbi-vym4', '2025-10-01')
    dist_claim(p, 'distA', 'rakuten-schd', ra); dist_claim(p, 'distB', 'sbi-vym4', rb)
    pair_claim(p, 'effpair', 'eff', '2本の実質的な負担')
    pair_claim(p, 'idxpair', 'index', '2本の投資先ETFと指数')
    p.docq('comp-s', '楽天・SCHDの投資先ETFの銘柄数・上位銘柄（2026年8月末現在）', 'risude_M',
           r'2026年8月末現在 投資銘柄数 投資銘柄数 103.{0,120}?MERCK & CO INC ヘルスケア 4\.8%', 'ETF側の数値（シュワブ・米国配当株式ETF）。月次レポートの基準日を確認。')
    p.docq('comp-v', 'SBI・V・米国高配当の組入上位銘柄（2026年8月31日基準）', 'svym_M',
           r'1 ブロードコム 米国 情報技術 6\.95％', 'ETF（バンガード・米国高配当株式ETF）の純資産総額に対する割合。')
    p.docq('nobm', '楽天・SCHDにはベンチマークがない', 'risude_P', r'当ファンドには、 ベンチマークはありません。',
           '無し: 交付目論見書の年間収益率の欄で確認。投資先ETFが指数への連動を目指す点は「投資対象ファンドの概要」で確認した。')
    d, ds, amt, hi, lo = gap_text(p)
    sa = sum(v for _, v in ra); sb = sum(v for _, v in rb)
    lead = P(perf_lead(p, '結論から言うと、'), one_year_line(p),
             S(p, 'perf', '比較期間全体ではSBI・V・米国高配当、直近1年では楽天・SCHDが上回り、期間によって順序が入れ替わっています。'))
    lead += P(S(p, 'effpair', '投資先ETFの報酬を含む実質的な負担は、楽天・SCHDが年0.1238%程度、SBI・V・米国高配当（年4回）が年0.1038%程度です。'),
              S(p, 'idxpair', '投資先は前者がダウ・ジョーンズ US ディビデンド 100 インデックスに連動を目指すETF、後者がFTSEハイディビデンド・イールド・インデックスに連動を目指すETFで、指数が違います。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'idxpair', '<h2 id="mechanism">投資先のETFと指数が違う：ダウ・ジョーンズ US ディビデンド 100 とFTSEハイディビデンド・イールド</h2>')
    body += P(S(p, 'idxpair', '楽天・SCHDはマザーファンドを通じて「シュワブ・米国配当株式ETF」に投資します。このETFはダウ・ジョーンズ US ディビデンド 100 インデックスへの連動を目指します。'),
              S(p, 'nobm', 'ただし楽天・SCHD自体には、交付目論見書上のベンチマークはありません。'))
    body += P(S(p, 'sbi-vym4-index', 'SBI・V・米国高配当（年4回）は「バンガード・米国高配当株式ETF」を通じて、FTSEハイディビデンド・イールド・インデックス（配当込み、円換算ベース）への連動を目指すインデックス型です。'))
    body += P(S(p, 'comp-s', '楽天・SCHDの投資先ETFの投資銘柄数は103で、最も比率が高いメルクが4.8%です（2026年8月末現在）。'),
              S(p, 'comp-v', 'SBI・V・米国高配当の組入1位はブロードコムで6.95%です（2026年8月31日基準）。'),
              S(p, 'perf', '指数が違うため、同じ「米国高配当」でも業種や銘柄の比率が異なり、実績の差は費用の差だけでは説明できません。'))
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">決算日（楽天・SCHD）</th><th scope="col" class="num">分配金</th><th scope="col">決算日（SBI・V・米国高配当）</th><th scope="col" class="num">分配金</th></tr></thead><tbody>'
    for (da, va), (db, vb) in zip(ra, rb):
        t += f'<tr><td>{S(p, "distA", jd(da.replace("/", "-")))}</td><td class="num">{S(p, "distA", f"{va}円")}</td><td>{S(p, "distB", jd(db.replace("/", "-")))}</td><td class="num">{S(p, "distB", f"{vb}円")}</td></tr>'
    t += f'<tr><th scope="row">{S(p, "distA", "4回の合計")}</th><td class="num">{S(p, "distA", f"{sa}円")}</td><th scope="row">{S(p, "distB", "4回の合計（SBI）")}</th><td class="num">{S(p, "distB", f"{sb}円")}</td></tr></tbody></table></div>'
    body += S(p, 'distA', '<h3 id="dist">直近4回の分配金（1万口当たり・税引前）</h3>') + t
    body += P(S(p, 'distA', '分配金は1万口当たりの金額で、2本は基準価額の水準が違うため、円の金額どうしで利回りの高低は比べられません。'),
              S(p, 'perf', '上の実績表は、分配金を受け取らずに再投資したと仮定した値です。'),
              S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われた金額に相当する分、基準価額は下がります。'))
    body += S(p, 'effpair', '<h2 id="cost-detail">ETFの報酬をどう数えるかで、表示の料率が変わる</h2>')
    body += P(S(p, 'rakuten-schd-eff', '楽天・SCHDの信託報酬は年0.1238%で、投資先ETFで日々差し引かれる年0.06%程度の報酬相当額は、委託会社が合理的に見積ってファンドに充当すると交付目論見書に書かれています。そのため実質的な負担も年0.1238%程度と表示されています。'))
    body += P(S(p, 'sbi-vym4-eff', 'SBI・V・米国高配当（年4回）は国内ファンド分が年0.0638%で、投資先ETFの年0.04%程度を加えた実質的な負担が年0.1038%程度です。'),
              S(p, 'effpair', '「ファンド本体の信託報酬」の行だけを並べると0.1238%と0.0638%に見えますが、ETF分を含めてそろえた差は年0.02ポイント程度です。'))
    body += P(ter_line(p), S(p, 'terpair', '総経費率の対象期間は半年ごとの作成期間で、2本で時期がずれています。'))
    body += schd_ter_detail(p, 'sbi-vym4')
    body += method_section(p)
    body += faq_block(p, [
        ('effpair', '信託報酬はどちらが低いですか？', '投資先ETFの報酬を含めた実質的な負担は、楽天・SCHDが年0.1238%程度、SBI・V・米国高配当（年4回）が年0.1038%程度です。ファンド本体の信託報酬だけを比べると差が大きく見えるので、含める範囲をそろえて読みます。'),
        ('distA', '分配金の金額が大きい方が利回りも高いのですか？', '言えません。分配金は1万口当たりの金額で、基準価額の水準が違う2本の金額を並べても利回りの比較にはなりません。分配金を再投資した基準価額の比較は表のとおりです。'),
        faq_net(p),
        ('perf', 'どちらが上回ったかは期間で変わりますか？', f"変わりました。{jd(r['起点'])}〜{jd(r['終点'])}の累積騰落率はSBI・V・米国高配当（年4回）が上でしたが、直近1年は楽天・SCHDが上でした。"),
    ])
    sections = [('performance', '同じ期間の100万円を、分配金再投資で比べる'), ('fees', '目論見書の料率と、総経費率の実績を分けて見る'),
                ('mechanism', '投資先のETFと指数が違う：ダウ・ジョーンズ US ディビデンド 100 とFTSEハイディビデンド・イールド'), ('cost-detail', 'ETFの報酬をどう数えるかで、表示の料率が変わる'),
                ('method', '計算条件と、この比較からは分からないこと'), ('faq', 'よくある質問'), ('source', '出典')]
    related = [('../rakuten-schd-vs-rakuten-vym/', '楽天・SCHD vs 楽天・VYM', '同じ楽天の米国高配当2本を比べる'),
               ('../haitokin-kakutei-shinkoku/', '配当金と確定申告', '分配金・配当金の税金の扱いを確かめる'),
               ('../index-toushi/', 'インデックス投資の仕組みと費用', 'ETF経由の費用の読み方')]
    return p, title, desc, body, sections, related

@article
def a_schd_rvym():
    p = Page('rakuten-schd-vs-rakuten-vym', 'rakuten-schd', 'rakuten-vym', 'rakuten-schd__rakuten-vym')
    r = p.r_
    p.title = title = '楽天・SCHD vs 楽天・VYM｜分配金の有無・費用・実績を比較'
    desc = (f"楽天・シュワブ・高配当株式・米国ファンド（四半期決算型）と楽天・米国高配当株式インデックス・ファンドを比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}。"
            "楽天・VYMは設定来分配金0円です。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    distnav_claims(p)
    ra = dist_rows_rakuten(p, 'rakuten-schd', '2025-10-01')
    dist_claim(p, 'distA', 'rakuten-schd', ra)
    pair_claim(p, 'effpair', 'eff', '2本の実質的な負担')
    pair_claim(p, 'idxpair', 'index', '2本の投資先と指数')
    p.docq('vym0', '楽天・VYMの分配金（第9期まで0円）', 'rivuh_Ak', r'期 末：32,813円（既払分配金0円）',
           '交付運用報告書の最近5期の表で期間分配金合計がすべて0円であることも確認。将来の分配を約束・否定するものではない（分配方針は委託会社が決定）。',
           extra_doc=[('rivuh_Ak', r'期間分配金合計（税込） （円） － 0 0 0 0 0')])
    p.docq('comp-s', '楽天・SCHDの投資先ETFの銘柄数・上位銘柄（2026年8月末現在）', 'risude_M',
           r'2026年8月末現在 投資銘柄数 投資銘柄数 103.{0,120}?MERCK & CO INC ヘルスケア 4\.8%', 'ETF側の数値。')
    p.docq('comp-v', '楽天・VYMの投資先ETFの銘柄数・上位銘柄（2026年7月末現在）', 'rivuh_M',
           r'2026年7月末現在 投資銘柄数 投資銘柄数 604.{0,120}?Broadcom Inc テクノロジー 7\.3%', '月次レポートの注記「当ページの内容は作成基準日の前月の数値です」を確認し、本文に7月末と書いた。')
    p.docq('nobm', '楽天・SCHDにはベンチマークがない', 'risude_P', r'当ファンドには、 ベンチマークはありません。', '無し: 交付目論見書で確認。')
    sa = sum(v for _, v in ra)
    one = r['1年窓']
    lead = P(perf_lead(p, '結論から言うと、'), one_year_line(p),
             S(p, 'perf', '比較期間全体では楽天・VYM、直近1年では楽天・SCHDが上回りました。'))
    lead += P(S(p, 'distA', f'分配の扱いも違います。楽天・SCHDは年4回決算で、直近4回の分配金は1万口当たり合計{sa}円でした。'),
              S(p, 'vym0', '楽天・VYMは年1回決算で、2026年7月15日の第9期まで分配金は0円です。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'vym0', '<h2 id="mechanism">分配金を出すか、出さずに基準価額に残すか</h2>')
    body += P(S(p, 'vym0', '楽天・VYMは交付運用報告書の第9期末（2026年7月15日）で「既払分配金0円」です。'),
              S(p, 'perfB', '分配金が0円のため、運用会社の公表データでは基準価額と分配金再投資基準価額が同じ値で推移しています。'),
              S(p, 'distA', '楽天・SCHDは四半期ごとに分配しており、直近4回は1万口当たり次のとおりです。'))
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">決算日</th><th scope="col" class="num">楽天・SCHDの分配金</th></tr></thead><tbody>'
    for da, va in ra:
        t += f'<tr><td>{S(p, "distA", jd(da.replace("/", "-")))}</td><td class="num">{S(p, "distA", f"{va}円")}</td></tr>'
    t += f'<tr><th scope="row">{S(p, "distA", "4回の合計")}</th><td class="num">{S(p, "distA", f"{sa}円")}</td></tr></tbody></table></div>'
    body += t
    p.docq('tax', '分配時と換金時の課税、NISAの非課税', 'risude_P',
           r'所得税および ?配当所得として課税されます。 ?分配時 ?地方税 ?普通分配金に対して20\.315%',
           '個人投資者の源泉徴収時の税率で、課税方法等により異なる場合があり、外国税額控除の適用となった場合は分配時の税金が異なる場合がある。法人は異なる（同資料。いずれも本文に書いた）。NISAは一定の額を上限とする非課税で、利用には条件がある旨を本文に書いた。楽天・VYMは第9期まで分配金0円で、分配時の課税が生じていない（交付運用報告書）。',
           extra_doc=[('risude_P', r'以下の表は、個人投資者の源泉徴収時の税率であり、課税方法等により異なる場合があります。'),
                      ('risude_P', r'※外国税額控除の適用となった場合には、分配時の税金が上記と異なる場合があります。 ※法人の場合は、上記と異なります。'),
                      ('risude_P', r'NISAをご利用の場合、一定の額を上限として、毎年、一定額の範囲で新たに購入した公募株式投資信託などから生じる配当所得および譲渡所得が ?無期限で非課税となります。')])
    body += P(S(p, 'perf', '実績表は、楽天・SCHDの分配金を税引前のまま受け取らずに再投資したと仮定した値です。'),
              S(p, 'tax', '個人の課税口座では、楽天・SCHDの分配金のうち普通分配金に分配のたびに20.315%の税金がかかるため、実際に再投資できる額は表の前提より少なくなります。20.315%は交付目論見書が示す個人投資者の源泉徴収時の税率で、課税方法等によって異なる場合があり、外国税額控除の適用となった場合も分配時の税金が異なる場合があります。法人の場合は異なります。分配金が0円の楽天・VYMには、分配時の課税が生じていません。このため個人の課税口座では、表の差がそのまま手取りの差にはなりません。NISAを利用する場合は、一定の額を上限として配当所得と譲渡所得が非課税です。'),
              S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われた金額に相当する分、基準価額は下がります。'),
              S(p, 'distpolicy', '分配金額は収益分配方針に基づいて委託会社が決め、支払われない場合もあります。'))
    body += S(p, 'idxpair', '<h3 id="index">投資先ETFの指数と銘柄数</h3>')
    body += P(S(p, 'idxpair', '楽天・SCHDの投資先はダウ・ジョーンズ US ディビデンド 100 インデックスに連動を目指すETFで、楽天・VYMはFTSEハイディビデンド・イールド・インデックスへの連動を目指します。'),
              S(p, 'nobm', '楽天・SCHD自体には交付目論見書上のベンチマークがありません。'))
    body += P(S(p, 'comp-s', '投資銘柄数は、楽天・SCHDの投資先ETFが103（2026年8月末現在、最大はメルク4.8%）です。'),
              S(p, 'comp-v', '楽天・VYMの投資先ETFは604（2026年7月末現在、最大はブロードコム7.3%）です。'))
    body += S(p, 'effpair', '<h2 id="cost-detail">実質的な負担は年0.1238%程度と年0.172%程度</h2>')
    body += P(S(p, 'rakuten-schd-eff', '楽天・SCHDは信託報酬年0.1238%で、投資先ETFの年0.06%程度の報酬相当額を委託会社がファンドに充当するため、実質的な負担も年0.1238%程度です。'),
              S(p, 'rakuten-vym-eff', '楽天・VYMは国内ファンド分が年0.132%で、投資先ETFの年0.04%程度を含む実質的な負担が年0.172%程度です。'))
    body += P(S(p, 'effpair', '実質的な負担どうしの差は年0.0482ポイント程度で、100万円を1年間一定額で保有すると仮定した目安は約482円です。この金額は実際の利益差ではありません。'))
    body += P(ter_line(p), S(p, 'terpair', '楽天・SCHDの総経費率は半年の作成期間、楽天・VYMは1年の作成期間の値で、時期もずれています。'))
    body += schd_ter_detail(p, 'rakuten-vym')
    body += method_section(p)
    body += faq_block(p, [
        ('vym0', '楽天・VYMは分配金を出していますか？', [('vym0', '2026年7月15日の第9期まで、分配金は0円です。'),
                                                  ('perfB', '運用会社の公表データでは、基準価額と分配金再投資基準価額が同じ値で推移しています。')]),
        ('distA', '楽天・SCHDの分配金はいくらでしたか？', f'直近4回（{jd(ra[0][0].replace("/", "-"))}〜{jd(ra[-1][0].replace("/", "-"))}の決算）の合計は1万口当たり{sa}円（税引前）でした。'),
        faq_net(p),
        ('effpair', '費用はどちらが低いですか？', [('effpair', '投資先ETFの報酬を含めた実質的な負担は、楽天・SCHDが年0.1238%程度、楽天・VYMが年0.172%程度です。'),
                                              ('rakuten-schd-terfund', '総経費率は0.19%と0.22%ですが、楽天・SCHDの0.19%には委託会社がファンドに別途充当している投資先ETFの報酬（年0.06%程度）が反映されており、対象期間も異なります。')]),
    ])
    sections = [('performance', '同じ期間の100万円を、分配金再投資で比べる'), ('fees', '目論見書の料率と、総経費率の実績を分けて見る'),
                ('mechanism', '分配金を出すか、出さずに基準価額に残すか'), ('cost-detail', '実質的な負担は年0.1238%程度と年0.172%程度'),
                ('method', '計算条件と、この比較からは分からないこと'), ('faq', 'よくある質問'), ('source', '出典')]
    related = [('../rakuten-schd-vs-sbi-vym/', '楽天・SCHD vs SBI・V・米国高配当（年4回）', '分配型どうしで比べる'),
               ('../haitokin-kakutei-shinkoku/', '配当金と確定申告', '分配金・配当金の税金の扱いを確かめる'),
               ('../../toushi/tsumitate/', '積立シミュレーター', '積立額と期間から将来額の目安を計算します')]
    return p, title, desc, body, sections, related

# ======================================================================== 4. Tawara vs eMAXIS developed
@article
def a_tawara_esen():
    p = Page('tawara-vs-emaxis-sensinkoku', 'tawara-sensinkoku', 'emaxis-sensinkoku', 'tawara-sensinkoku__emaxis-sensinkoku')
    r = p.r_
    p.title = title = 'たわらノーロード先進国株式 vs eMAXIS Slim先進国株式｜費用と実績'
    diff = r['B100万円終価'] - r['A100万円終価']
    desc = (f"たわらノーロード先進国株式とeMAXIS Slim先進国株式インデックス（除く日本）を同じ3年で比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}で差は{yen(abs(diff))}。"
            "同じMSCIコクサイ、信託報酬の上限は同じ0.09889%です。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pair_claim(p, 'idxpair', 'index', '2本の連動対象')
    p.docq('tier', 'eMAXIS Slim先進国の段階制と実質信託報酬率の例', 'esen_P',
           r'5,000億円未満の部分 0\.09889％.{0,300}?実質信託報酬率 （税込 年率） 0\.09865％ 0\.09834％ 0\.09812％',
           '純資産総額8,000億円・1兆3,000億円・1兆8,000億円の例。実際の純資産総額で率は変わる。',
           extra_doc=[('esen_P', r'ファンドの純資産総額 8,000億円 １兆3,000億円 １兆8,000億円')])
    p.docq('comp-e', 'eMAXIS Slim先進国の国・地域と銘柄数（2026年8月31日現在）', 'esen_M', r'1 アメリカ 75\.5%.{0,500}?組入銘柄数: 1,112銘柄', '比率は純資産総額に対する割合。')
    p.docq('tw-fund', 'たわら先進国の組入（外国株式パッシブ・ファンド・マザーファンド）', 'tawara_P', r'１ 外国株式パッシブ・ファンド・マザーファンド 100\.00', '交付目論見書の運用実績の組入銘柄欄で確認。',
           extra_doc=[('esen_P', r'※実際の運用は外国株式インデックスマザーファンドを通じて行います。')])
    rob = r['起点をずらした年率差']
    signs = {('+' if q['年率差'] >= 0 else '-') for q in rob}
    lead = P(perf_lead(p, '結論から言うと、'),
             S(p, 'perf', f"差は{yen(abs(diff))}で、累積騰落率の差は{abs(r['A累積'] - r['B累積']) * 100:.2f}ポイントでした。"))
    pair_claim(p, 'hedgepair', 'hedge', '2本とも原則として為替ヘッジを行わない（たわらは状況により実施の可能性）')
    lead += P(S(p, 'idxpair', '2本とも日本を除く先進国株式のMSCIコクサイ・インデックスへの連動を目指します。'),
              S(p, 'hedgepair', '為替ヘッジは2本とも原則として行いませんが、たわらの交付目論見書は、金利・為替状況によってはヘッジを実施する可能性があると書いています。'),
              S(p, 'feepair', '信託報酬の上限はどちらも年0.09889%で、eMAXIS Slimは純資産総額に応じて率が下がる段階制です。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'idxpair', '<h2 id="mechanism">同じ指数・同じ上限料率で、残る差は何か</h2>')
    body += P(S(p, 'idxpair', 'たわらノーロード先進国株式とeMAXIS Slim先進国株式インデックス（除く日本）は、どちらもMSCIコクサイ・インデックス（配当込み、円換算ベース）を連動対象にしています。'),
              S(p, 'tw-fund', 'たわらは外国株式パッシブ・ファンド・マザーファンドを、eMAXIS Slimは外国株式インデックスマザーファンドを通じて運用します。'))
    body += P(S(p, 'comp-e', 'eMAXIS Slim先進国の2026年8月31日現在の組入銘柄数は1,112銘柄で、国・地域別ではアメリカが75.5%です。'))
    body += P(S(p, 'perf', corr_period(p) + f"{r['同日相関']:.4f}で、値動きはほぼ同じでした。"),
              S(p, 'perf', 'わずかな差には、信託報酬の段階制、その他の費用、資金の出入りへの対応などが関わり得ますが、資料からどれか1つの要因に特定することはできません。'))
    tr = '<div class="scroll-wrap"><table><thead><tr><th scope="col">起点</th><th scope="col" class="num">年率の差（たわら−eMAXIS Slim）</th></tr></thead><tbody>'
    for q in rob:
        tr += f'<tr><td>{S(p, "perf", jd(q["起点"]))}</td><td class="num">{S(p, "perf", f"{q["年率差"] * 100:+.3f}ポイント")}</td></tr>'
    tr += '</tbody></table></div>'
    body += S(p, 'perf', '<h3 id="robust">起点をずらしても差は小さい</h3>') + tr
    body += P(S(p, 'perf', f"終点を{jd(r['終点'])}に固定し、起点を5通りに変えて年率の差を計算しました。" +
                ('どの起点でも差は0.1ポイント未満です。' if all(abs(q['年率差']) < 0.001 for q in rob) else '起点によって差の大きさは変わります。')
                + ('5通りすべてで、たわらの年率がわずかに低い結果でした。' if all(q['年率差'] < 0 for q in rob) else '')))
    body += S(p, 'tier', '<h2 id="cost-detail">上限は同じでも、段階制で実際の率が下がる</h2>')
    body += P(S(p, 'tawara-sensinkoku-fee', 'たわらの信託報酬は年0.09889%以内で、2026年7月14日現在は年0.09889%です。'),
              S(p, 'perfB', 'eMAXIS Slim先進国の2026年9月30日の純資産総額は13,598.57億円（運用会社の基準価額データ）です。'),
              S(p, 'tier', 'eMAXIS Slimは5,000億円未満の部分が年0.09889%、5,000億円以上1兆円未満の部分が年0.09823%、1兆円以上の部分が年0.09757%の段階制です。交付目論見書は、純資産総額8,000億円で0.09865%、1兆3,000億円で0.09834%、1兆8,000億円で0.09812%という実質信託報酬率の例を載せています。'))
    body += P(ter_line(p), S(p, 'terpair', '対象期間が半年ずれているため、総経費率の差をそのまま今の費用差とは読めません。'))
    body += method_section(p)
    body += faq_block(p, [
        ('idxpair', '2本は同じ指数ですか？', '同じです。どちらもMSCIコクサイ・インデックス（配当込み、円換算ベース）への連動を目指し、日本を除く先進国の株式に投資します。'),
        ('tier', '信託報酬は同じですか？', '上限はどちらも年0.09889%です。eMAXIS Slimは純資産総額に応じて率が下がる段階制で、交付目論見書には純資産総額1兆3,000億円で0.09834%という例があります。'),
        faq_net(p),
        ('perf', '実績の差はどれくらいですか？', f"{jd(r['起点'])}〜{jd(r['終点'])}の100万円の終了時評価額の差は{yen(abs(diff))}でした。日次騰落率の相関は{r['同日相関']:.4f}です。"),
    ])
    sections = std_sections('mechanism', '同じ指数・同じ上限料率で、残る差は何か', '上限は同じでも、段階制で実際の率が下がる')
    related = [('../orcan-vs-emaxis-sensinkoku/', 'eMAXIS Slimオルカン vs eMAXIS Slim先進国株式', '全世界と先進国の違いを比べる'),
               ('../orcan-hikaku/', 'eMAXIS Slimオルカン vs 楽天・プラス・オルカン', '同じ指数の商品差を確かめる'),
               ('../index-toushi/', 'インデックス投資の仕組みと費用', '段階制と総経費率の読み方')]
    return p, title, desc, body, sections, related

# ======================================================================== 5. orcan vs eMAXIS developed
@article
def a_orcan_esen():
    p = Page('orcan-vs-emaxis-sensinkoku', 'orcan', 'emaxis-sensinkoku', 'orcan__emaxis-sensinkoku')
    r = p.r_
    p.title = title = 'eMAXIS Slimオルカン vs eMAXIS Slim先進国株式｜全世界と先進国の違い'
    desc = (f"eMAXIS Slim全世界株式（オール・カントリー）と先進国株式インデックス（除く日本）を比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}、"
            "アメリカ比率は62.8%と75.5%、総経費率は0.07061%と0.10312%です。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pair_claim(p, 'idxpair', 'index', '2本の連動対象')
    p.docq('comp-o', 'オルカンの国・地域と銘柄数（2026年8月31日現在）', 'orcan_M', r'1 アメリカ 62\.8%.{0,200}?2 日本 5\.0%.{0,120}?3 台湾 3\.2%.{0,800}?組入銘柄数: 2,409銘柄', '比率は純資産総額に対する割合。')
    p.docq('comp-e', 'eMAXIS Slim先進国の国・地域と銘柄数（2026年8月31日現在）', 'esen_M', r'1 アメリカ 75\.5%.{0,500}?組入銘柄数: 1,112銘柄', '比率は純資産総額に対する割合。')
    p.docq('mothers', 'オルカンは3つのマザーファンド、先進国は外国株式マザーファンドで運用', 'orcan_P',
           r'※実際の運用は外国株式インデックスマザーファンド、 新興国株式インデックスマザーファンド、 日本株式インデックス マザーファンドを通じて行います。',
           '先進国側の出典: ' + Q('esen_P', r'※実際の運用は外国株式インデックスマザーファンドを通じて行います。'))
    p.docq('netnav', '基準価額は信託報酬控除後', 'orcan_P', r'基準価額は運用報酬 （信託報酬）控除後です。', '無し: 交付目論見書の運用実績欄の注記で確認。')
    lead = P(perf_lead(p, '結論から言うと、'), dd_line(p))
    p.claim('comp-both', 'オルカンと先進国株式の銘柄数・アメリカ比率（2026年8月31日現在）', p.claims['comp-o']['source_url'], p.claims['comp-o']['source_quote'],
            p.claims['comp-o']['applies'], p.claims['comp-o']['exceptions'] + f' 先進国株式側: {p.claims["comp-e"]["source_url"]}「{p.claims["comp-e"]["source_quote"]}」')
    lead += P(S(p, 'comp-both', 'オルカンは日本・先進国・新興国の株式で2,409銘柄（アメリカ62.8%）、先進国株式は日本を除く先進国の1,112銘柄（アメリカ75.5%）です（2026年8月31日現在）。'),
              S(p, 'terpair', '同じ2025年4月26日〜2026年4月27日の総経費率は、オルカン0.07061%、先進国株式0.10312%でした。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'idxpair', '<h2 id="mechanism">違いは日本と新興国を含むかどうか</h2>')
    body += P(S(p, 'idxpair', 'オルカンはMSCIオール・カントリー・ワールド・インデックスを、先進国株式はMSCIコクサイ・インデックスを連動対象にします（どちらも配当込み、円換算ベース）。前者は世界の先進国・新興国の株式、後者は日本を除く世界の先進国の株式で構成されます。'))
    body += P(S(p, 'mothers', 'オルカンは外国株式・新興国株式・日本株式の3つのマザーファンドを通じて、先進国株式は外国株式インデックスマザーファンドを通じて運用します。'))
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">2026年8月31日現在</th><th scope="col" class="num">オルカン</th><th scope="col" class="num">先進国株式</th></tr></thead><tbody>'
    t += f'<tr><th scope="row">アメリカの比率</th><td class="num">{S(p, "comp-o", "62.8%")}</td><td class="num">{S(p, "comp-e", "75.5%")}</td></tr>'
    t += f'<tr><th scope="row">日本の比率</th><td class="num">{S(p, "comp-o", "5.0%")}</td><td class="num">{S(p, "idxpair", "対象外（日本を除く）")}</td></tr>'
    t += f'<tr><th scope="row">組入銘柄数</th><td class="num">{S(p, "comp-o", "2,409銘柄")}</td><td class="num">{S(p, "comp-e", "1,112銘柄")}</td></tr></tbody></table></div>'
    body += t
    body += P(S(p, 'comp-o', 'オルカンの国・地域別の上位は、アメリカ62.8%、日本5.0%、台湾3.2%の順です。'),
              S(p, 'comp-both', '先進国株式は日本と新興国を含まないぶん、アメリカの比率が75.5%と高くなっています。'),
              S(p, 'perf', 'この期間の実績差には、費用の差だけでなく国・地域の配分の違いが含まれます。'))
    body += S(p, 'terpair', '<h2 id="cost-detail">同じ期間の総経費率で比べられる組</h2>')
    body += P(S(p, 'feepair', 'オルカンの信託報酬は年0.05775%以内、先進国株式は年0.09889%以内で、どちらも純資産総額に応じた段階制です。'),
              lend_sentence(p, 'orcan', short=True), S(p, 'emaxis-sensinkoku-nolend', '先進国株式の交付目論見書には、品貸料についての記載がありません。'))
    body += P(S(p, 'terpair', '2本とも決算日が4月25日で、交付目論見書に載っている総経費率は同じ2025年4月26日〜2026年4月27日の値です。オルカン0.07061%、先進国株式0.10312%で、差は0.03251ポイントでした。'),
              S(p, 'netnav', '基準価額は信託報酬を差し引いた後の値なので、実績表の差は費用を引いた後の結果です。'))
    body += method_section(p)
    body += faq_block(p, [
        ('idxpair', 'オルカンと先進国株式の違いは何ですか？', '連動対象の指数が違います。オルカンは先進国・新興国の株式で構成されるMSCIオール・カントリー・ワールド・インデックス、先進国株式は日本を除く先進国のMSCIコクサイ・インデックスです。'),
        ('comp-both', 'アメリカの比率はどのくらい違いますか？', '2026年8月31日現在、オルカンが62.8%、先進国株式が75.5%です。比率は毎月変わります。'),
        faq_net(p),
        ('terpair', '費用の差はどのくらいですか？', [('terpair', '同じ2025年4月26日〜2026年4月27日の総経費率は、オルカン0.07061%、先進国株式0.10312%でした。'),
                                                ('feepair', '信託報酬は純資産総額に応じた段階制で、年0.05775%以内と年0.09889%以内です。'),
                                                ('orcan-lend', 'オルカンの交付目論見書には、有価証券の貸付の指図を行った場合に、品貸料の一部（49.5%（税抜45.0%）以内の額）が信託報酬に追加される定めがあります。'),
                                                ('emaxis-sensinkoku-nolend', '先進国株式の交付目論見書には、品貸料についての記載がありません。')]),
    ])
    sections = std_sections('mechanism', '違いは日本と新興国を含むかどうか', '同じ期間の総経費率で比べられる組')
    related = [('../tawara-vs-emaxis-sensinkoku/', 'たわらノーロード先進国株式 vs eMAXIS Slim先進国株式', '同じ指数の商品差を比べる'),
               ('../orcan-vs-emaxis-sp/', 'オルカンとS&P500を併用すると米国比率は何%？', '併用時の米国比率の計算'),
               ('../sbi-yukidaruma-vs-orcan/', '雪だるま（全世界株式） vs eMAXIS Slimオルカン', '全世界株式どうしを比べる')]
    return p, title, desc, body, sections, related

# ======================================================================== 6. gold
@article
def a_gold():
    p = Page('rakuten-gold-vs-sbi-gold', 'rakuten-gold', 'sbi-gold', 'rakuten-gold__sbi-gold')
    r = p.r_
    p.title = title = '楽天・ゴールド vs SBI・iシェアーズ・ゴールド（ヘッジなし）｜費用と実績'
    desc = (f"楽天・ゴールド・ファンドとSBI・iシェアーズ・ゴールドファンド（ともに為替ヘッジなし）を比較。2026年1月21日以降の100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}ですが、"
            "差は起点翌日の値動きでつき、起点を1日ずらすと順序が逆になります。実質的な負担と投資先の違いも確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pair_claim(p, 'effpair', 'eff', '2本の実質的な負担')
    pair_claim(p, 'hedgepair', 'hedge', '2本とも為替ヘッジを行わない')
    p.docq('hold-r', '楽天・ゴールド（ヘッジなし）のマザーファンドの組入（2026年8月31日作成基準）', 'ricgld_M',
           r'楽天・ゴールド・マザーファンド 100\.0% SPDR ゴールド・ミニシェアーズ・トラスト 99\.9%', '月次レポートの「為替ヘッジなし」の欄で確認。')
    p.docq('hold-s', 'SBI・iシェアーズ・ゴールド（ヘッジなし）のマザーファンドの組入（基準日2026年6月30日）', 'sgold_P',
           r'マザーファンド 100\.0% iシェアーズ・フィジカル・ゴールドETC 99\.4%', '交付目論見書の運用実績（基準日：2026年6月30日）の「為替ヘッジなし」の欄で確認。投資対象ファンドは今後変更する場合がある（同資料）。',
           extra_doc=[('sgold_P', r'主要な資産の状況 （基準日：2026年6月30日）')])
    ds_ = sorted(set(p.series[p.a]) & set(p.series[p.b]))
    d0, d1, d2, de = ds_[0], ds_[1], ds_[2], max(d for d in ds_ if str(d) <= r['終点'])
    sa_, sb_ = p.series[p.a], p.series[p.b]
    day1a, day1b = sa_[d1] / sa_[d0] - 1, sb_[d1] / sb_[d0] - 1
    c1a, c1b = sa_[de] / sa_[d1] - 1, sb_[de] / sb_[d1] - 1
    c2a, c2b = sa_[de] / sa_[d2] - 1, sb_[de] / sb_[d2] - 1
    assert r['A累積'] < r['B累積'] and day1a < day1b and c1a > c1b and c2a < c2b, 'gold start-day sensitivity changed; rewrite the text'
    gap = abs(r['A累積'] - r['B累積']) * 100
    gap1 = (day1b - day1a) * 100  # gap opened on the first day, in points of the start value (=100)
    assert gap1 > gap > 0, 'gold: first-day gap no longer exceeds the end gap; rewrite the text'
    for side, k in (('A', p.a), ('B', p.b)):
        rows_, u_ = nav_rows(k, str(d0), str(d1), str(d2), str(de))
        p.claim(f'day1{side}', f"{FUNDS[k]['short']}の起点・翌営業日・翌々営業日・終点の基準価額", u_, rows_, f'{jd(str(d0))}〜{jd(str(de))}の公表基準価額（{PUB}取得）',
                '起点の翌営業日の騰落率と、起点を1日・2日ずらした累積騰落率は、この4日の値から計算した（分配金は0円で、基準価額と再投資ベースは同じ動き）。')
    p.claim('day1', '起点の翌営業日の1日で約2.16ポイントの差がつき、終点の差は1.36ポイント。起点を1日ずらすと順序が逆になる', p.claims['day1A']['source_url'], p.claims['day1A']['source_quote'],
            p.claims['day1A']['applies'], p.claims['day1A']['exceptions'] + f" 比較相手: {p.claims['day1B']['source_url']}「{p.claims['day1B']['source_quote']}」")
    p.claims['desc']['exceptions'] += (f" 起点の扱い（差は起点翌日の値動きでつき、起点を1日ずらすと順序が逆になる）: {p.claims['day1A']['source_url']}「{p.claims['day1A']['source_quote']}」 / {p.claims['day1B']['source_url']}「{p.claims['day1B']['source_quote']}」")
    day1_core = (f"起点の翌営業日（{jd(str(d1))}）の騰落率は楽天・ゴールドが{pct(day1a)}、SBI・iシェアーズ・ゴールドが{pct(day1b)}で、この1日で約{gap1:.2f}ポイントの差がつきました。終点（{jd(str(de))}）での差は{gap:.2f}ポイントです。"
                 f"起点を{jd(str(d1))}にすると累積騰落率は楽天・ゴールドが{pct(c1a)}、SBI・iシェアーズ・ゴールドが{pct(c1b)}で順序が逆になり、{jd(str(d2))}にすると{pct(c2a)}と{pct(c2b)}で再び入れ替わります。この期間の実績の差から、どちらが上回りやすいかは読み取れません。")
    lead = P(perf_lead(p, '結論から言うと、'),
             S(p, 'perf', f"楽天・ゴールドの設定日（2026年1月21日）からの共通期間は1年未満で、この期間は2本とも基準価額が下がり、累積騰落率は{pct(r['A累積'])}と{pct(r['B累積'])}でした。"),
             S(p, 'day1', 'ただし、SBI・iシェアーズ・ゴールドが上回ったこの差は、起点の翌営業日の値動きによるものです。' + day1_core))
    lead += P(S(p, 'effpair', '投資先の報酬を含む実質的な負担は、楽天・ゴールドが年0.2925%程度、SBI・iシェアーズ・ゴールドが年0.1538〜0.1838%程度です。'),
              S(p, 'rakuten-gold-ter', '楽天・ゴールドは第1期決算日が2026年8月17日で、総経費率を載せた運用報告書は2026年10月1日時点で運用会社のサイトに掲載されていませんでした。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'hold-r', '<h2 id="mechanism">投資先は別々の金ETF・ETC</h2>')
    p.docq('cand-r', '楽天・ゴールドの交付目論見書が挙げる投資対象ETF（2025年9月末現在の情報）', 'ricgld_P',
           r'以下は、2025年9月末現在で委託会社が知り得る情報を基に作成しています。.{0,300}?SPDR ゴールド・.{0,200}?iシェアーズ ゴールド・.{0,120}?トラスト・マイクロ',
           '「上記の内容は、今後変更になる場合があります」の注記を確認。実際の組入は月次レポートの値を別に書いた。')
    p.docq('cand-s', 'SBI・iシェアーズ・ゴールドの実質的な主要投資対象と投資対象ファンドの概要（2026年6月末現在）', 'sgold_P',
           r'「iシェアーズ・フィジカル・ゴールド ETC」 ?を実質的な主要投資対象とします。',
           '「投資対象ファンドは今後変更する場合があります」の注記を確認。',
           extra_doc=[('sgold_P', r'投資対象ファンドの概要 マザーファンド受益証券を通じて、実質的に投資する投資対象ファンドの概要です。 （2026年6月末現在） 名 称 iシェアーズ・フィジカル・ゴールド ETC.{0,200}?名 称 iシェアーズ・ゴールド・トラスト・ミクロ')])
    p.docq('effdate', '投資先の報酬の基準時点（楽天2025年9月末現在、SBI2026年6月末現在）', 'ricgld_P', r'＊1 2025年9月末現在。今後、投資内容等によりこの数値は変動します。',
           '無し: 両社の交付目論見書の注記・概要の日付で確認。',
           extra_doc=[('sgold_P', r'投資対象ファンドの概要 マザーファンド受益証券を通じて、実質的に投資する投資対象ファンドの概要です。 （2026年6月末現在）')])
    body += P(S(p, 'rakuten-gold-index', '楽天・ゴールドは、マザーファンドを通じて主として金価格の値動きをとらえることを目指す上場投資信託証券（ETF）等に投資し、金地金への直接投資は行いません。'),
              S(p, 'cand-r', '交付目論見書は、投資対象とするETF等としてSPDR ゴールド・ミニシェアーズ・トラストとiシェアーズ ゴールド・トラスト・マイクロの2本を挙げています（2025年9月末現在の情報）。'),
              S(p, 'hold-r', '2026年8月31日作成基準の月次レポートでは、為替ヘッジなしのマザーファンドの組入はSPDR ゴールド・ミニシェアーズ・トラストが99.9%です。'))
    body += P(S(p, 'sbi-gold-index', 'SBI・iシェアーズ・ゴールドは、LBMA金価格指数に連動するETFまたはETCに投資します。'),
              S(p, 'cand-s', '交付目論見書は、iシェアーズ・フィジカル・ゴールドETCを実質的な主要投資対象とし、投資対象ファンドの概要にはiシェアーズ・ゴールド・トラスト・ミクロも載せています（2026年6月末現在）。'),
              S(p, 'hold-s', '交付目論見書の基準日2026年6月30日の運用実績では、為替ヘッジなしのマザーファンドの組入はiシェアーズ・フィジカル・ゴールドETCが99.4%です。'))
    body += P(S(p, 'hedgepair', '2本とも外貨建ての上場商品を通じて金に投資し、原則として為替ヘッジを行わないため、金価格と円相場の両方が基準価額に影響します。'),
              S(p, 'perf', corr_period(p) + f"{r['同日相関']:.3f}で、同じ日でも値動きに差が出ています。資料から、その差の原因を特定することはできません。"))
    body += S(p, 'effpair', '<h2 id="cost-detail">国内の信託報酬と投資先の報酬を足して比べる</h2>')
    body += P(S(p, 'rakuten-gold-eff', '楽天・ゴールドは国内ファンド分が年0.1925%、投資先ETF等の報酬が年0.1%程度で、実質的な負担は年0.2925%程度です。'),
              S(p, 'sbi-gold-eff', 'SBI・iシェアーズ・ゴールドは国内ファンド分が年0.0638%、投資先の報酬が年0.09〜0.12%程度で、実質的な負担は年0.1538〜0.1838%程度です。'))
    body += P(S(p, 'effdate', '投資先の報酬は、楽天が2025年9月末現在、SBIが2026年6月末現在の交付目論見書の概算値で、投資内容によって変わります。'),
              S(p, 'effpair', '実質的な負担どうしの差は年0.1087〜0.1387ポイント程度で、100万円を1年間一定額で保有すると仮定した目安は約1,087〜1,387円です。この金額は実際の利益差ではありません。'))
    body += P(S(p, 'sbi-gold-ter', 'SBI・iシェアーズ・ゴールド（為替ヘッジなし）の総経費率は0.19%（2025年6月11日〜2026年6月10日）です。'),
              S(p, 'rakuten-gold-ter', '楽天・ゴールドの総経費率は、第1期の運用報告書が公表された後に追記します。未掲載の値を0%とは扱っていません。'))
    body += method_section(p)
    body += faq_block(p, [
        ('effpair', '費用はどちらが低いですか？', '投資先の報酬を含む実質的な負担は、楽天・ゴールド（為替ヘッジなし）が年0.2925%程度、SBI・iシェアーズ・ゴールド（為替ヘッジなし）が年0.1538〜0.1838%程度です。'),
        ('day1', '累積騰落率の差は、どの時期に生じましたか？', f"{jd(str(d0))}〜{jd(str(de))}の累積騰落率は楽天・ゴールドが{pct(r['A累積'])}、SBI・iシェアーズ・ゴールドが{pct(r['B累積'])}で、SBI・iシェアーズ・ゴールドが{gap:.2f}ポイント上回りました。この差は起点の翌営業日の値動きによるものです。" + day1_core),
        ('perf', 'なぜ年率や直近1年の実績を載せていないのですか？', '楽天・ゴールドの設定日が2026年1月21日で、2本の共通期間が1年未満だからです。短い期間の騰落を1年分に引き延ばすと実際より大きな印象を与えるため、累積騰落率だけを載せています。'),
        faq_net(p),
        ('rakuten-gold-index', '2本は金地金を直接持っていますか？', [('rakuten-gold-index', '楽天・ゴールドの交付目論見書には、ETF等に投資し、金地金への直接投資は行わないと書かれています。'),
                                                              ('sbi-gold-index', 'SBI・iシェアーズ・ゴールドは、マザーファンドを通じてLBMA金価格指数に連動するETFまたはETCに投資します。')]),
    ])
    sections = std_sections('mechanism', '投資先は別々の金ETF・ETC', '国内の信託報酬と投資先の報酬を足して比べる')
    related = [('../sbi-gold-vs-mufg-gold/', 'SBI・iシェアーズ・ゴールド vs 三菱UFJ純金', '国内と海外の金価格の違いを確かめる'),
               ('../index-toushi/', 'インデックス投資の仕組みと費用', 'ETF経由の費用の読み方'),
               ('../../toushi/tsumitate/', '積立シミュレーター', '積立額と期間から将来額の目安を計算します')]
    return p, title, desc, body, sections, related

# ======================================================================== 7. Yukidaruma vs orcan
@article
def a_yuki_orcan():
    p = Page('sbi-yukidaruma-vs-orcan', 'sbi-yukidaruma', 'orcan', 'sbi-yukidaruma__orcan')
    r = p.r_
    p.title = title = '雪だるま（全世界株式） vs eMAXIS Slimオルカン｜費用と実績を比較'
    desc = (f"SBI・全世界株式インデックス・ファンド（雪だるま）とeMAXIS Slimオルカンを同じ3年で比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}。"
            "指数・3本のETF構成・実質的な負担0.1022%程度と0.05775%以内の違いを確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pair_claim(p, 'idxpair', 'index', '2本の連動対象')
    p.docq('etf3', '雪だるまの投資対象ETFと基本投資割合', 'yuki_P',
           r'投資対象ファンド及び基本投資割合は次の通りとします。 基本投資割合は、ベンチマークの動きへの連動を目的として変動させる場合があります。.{0,90}?マーケットETF＊1 60% State Street ® SPDR ® ポートフォリオ 先進国株式（除く米国）ETF＊2 30% State Street ® SPDR ® ポートフォリオ 新興国株式 ETF＊3 10%',
           '基本投資割合はベンチマークへの連動を目的として変動させる場合がある（同資料）。実際の比率は月次レポートの値を併記した。')
    p.docq('etf3m', '雪だるまのETF組入比率・国別比率（2026年8月31日基準）', 'yuki_M',
           r'59\.97％.{0,80}?29\.75％.{0,80}?9\.99％', 'マザーファンドにおける投資信託証券（ETF）の組入比率。',
           extra_doc=[('yuki_M', r'米国 59\.30％'), ('yuki_M', r'日本 6\.51％')])
    p.docq('comp-o', 'オルカンの国・地域と銘柄数（2026年8月31日現在）', 'orcan_M', r'1 アメリカ 62\.8%.{0,200}?2 日本 5\.0%', '比率は純資産総額に対する割合。雪だるま側は株式評価額に対する割合で、分母が異なる。')
    pair_claim(p, 'effpair', 'eff', '2本の実質的な負担')
    lead = P(perf_lead(p, '結論から言うと、'), dd_line(p))
    lead += P(S(p, 'effpair', '投資先ETFの報酬を含む実質的な負担は、雪だるまが年0.1022%程度、オルカンが年0.05775%以内（段階制）です。'),
              S(p, 'idxpair', '連動対象は雪だるまがFTSEグローバル・オールキャップ・インデックス、オルカンがMSCIオール・カントリー・ワールド・インデックスで、同じ「全世界株式」でも指数が違います。'))
    pair_claim(p, 'effpair', 'eff', '2本の実質的な負担')
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'etf3', '<h2 id="mechanism">3本のETFで組む雪だるま、3つのマザーファンドで組むオルカン</h2>')
    body += P(S(p, 'sbi-yukidaruma-index', 'FTSEグローバル・オールキャップ・インデックスは、全世界の大型・中型・小型株の市場の動きを表す指数で、先進国株式と新興国株式を対象にします。'),
              S(p, 'orcan-index', 'MSCIオール・カントリー・ワールド・インデックスは、世界の先進国・新興国の株式で構成される指数です。'))
    body += P(S(p, 'etf3', '雪だるまはマザーファンドを通じて3本の海外ETFに投資し、基本投資割合はバンガード・モーニングスター・トータル・ストック・マーケットETFが60%、State Street SPDR ポートフォリオ 先進国株式（除く米国）ETFが30%、同 新興国株式ETFが10%です。基本投資割合は、ベンチマークへの連動を目的として変える場合があります。'),
              S(p, 'etf3m', '2026年8月31日基準の実際の組入比率は59.97%、29.75%、9.99%でした。'))
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">2026年8月31日</th><th scope="col" class="num">雪だるま</th><th scope="col" class="num">オルカン</th></tr></thead><tbody>'
    t += f'<tr><th scope="row">米国（アメリカ）の比率</th><td class="num">{S(p, "etf3m", "59.30%")}</td><td class="num">{S(p, "comp-o", "62.8%")}</td></tr>'
    t += f'<tr><th scope="row">日本の比率</th><td class="num">{S(p, "etf3m", "6.51%")}</td><td class="num">{S(p, "comp-o", "5.0%")}</td></tr></tbody></table></div>'
    body += t
    body += P(S(p, 'comp-o', '雪だるまの比率はETFの株式評価額に対する割合、オルカンは純資産総額に対する割合で、分母が違うため小さな差は比べられません。'),
              S(p, 'perf', corr_period(p) + f"{r['同日相関']:.4f}" + 'で値動きは近く、実績の差には費用のほか指数と構成の違いが含まれます。'))
    body += S(p, 'effpair', '<h2 id="cost-detail">ETFの報酬を含めるかで、比べる数字が変わる</h2>')
    body += P(S(p, 'sbi-yukidaruma-eff', '雪だるまは国内ファンド分の信託報酬が年0.0682%、投資先ETFの報酬が年0.034%程度で、実質的な負担は年0.1022%程度です。'),
              orcan_tier(p))
    body += P(ter_line(p), S(p, 'terpair', '総経費率は2本で対象期間が約半年ずれています。雪だるまの総経費率には、投資先ファンドにかかる費用が含まれています。'))
    body += method_section(p)
    body += faq_block(p, [
        ('idxpair', '雪だるまとオルカンは同じ指数ですか？', '違います。雪だるまはFTSEグローバル・オールキャップ・インデックス、オルカンはMSCIオール・カントリー・ワールド・インデックスへの連動を目指します。'),
        ('effpair', '費用はどちらが低いですか？', [('effpair', '投資先ETFの報酬を含む実質的な負担は、雪だるまが年0.1022%程度、オルカンが年0.05775%以内です。'),
                                              ('terpair', '総経費率は0.10%（2024年11月13日〜2025年11月12日）と0.07061%（2025年4月26日〜2026年4月27日）です。')]),
        faq_net(p),
        ('perf', '3年の実績の差はどのくらいですか？', f"{jd(r['起点'])}〜{jd(r['終点'])}の100万円の終了時評価額は、雪だるまが{yen(r['A100万円終価'])}、オルカンが{yen(r['B100万円終価'])}でした。"),
    ])
    sections = std_sections('mechanism', '3本のETFで組む雪だるま、3つのマザーファンドで組むオルカン', 'ETFの報酬を含めるかで、比べる数字が変わる')
    related = [('../orcan-hikaku/', 'eMAXIS Slimオルカン vs 楽天・プラス・オルカン', '同じ指数の商品差を確かめる'),
               ('../invesco-sekai-vs-emaxis-orcan/', 'インベスコ世界のベスト vs eMAXIS Slimオルカン', '世界株のアクティブ型と比べる'),
               ('../orcan-vs-emaxis-sensinkoku/', 'eMAXIS Slimオルカン vs eMAXIS Slim先進国株式', '全世界と先進国の違い')]
    return p, title, desc, body, sections, related
