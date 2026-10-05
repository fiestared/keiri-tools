# Article bodies for build.py (exec'd inside build.py's namespace).
# Each sentence is registered against one claim, so the ledger maps every review unit to its source.

def pair_claim(p, cid, field, text):
    """Claim stated for both funds in one sentence: A's quote, B's quote recorded in exceptions."""
    ca, cb = p.claims[p.fc(p.a, field)], p.claims[p.fc(p.b, field)]
    return p.claim(cid, text, ca['source_url'], ca['source_quote'], ca['applies'],
                   ca['exceptions'] + f' 比較相手: {cb["source_url"]}「{cb["source_quote"]}」')

def nofee_pair(p):
    """Both prospectuses list only 購入時手数料 and 信託財産留保額 as directly-borne costs, both 'ありません'."""
    if 'nofeepair' not in p.claims:
        pair_claim(p, 'nofeepair', 'nofee', f'{p.A["short"]}と{p.B["short"]}の交付目論見書の購入時手数料と信託財産留保額はどちらも「ありません」')
        c = p.claims['nofeepair']
        c['scope'] = f'2本の交付目論見書の「投資者が直接的に負担する費用」の欄（{GOT}に確認）。投資者ごとの税金は含まない'
        def taxq(d):
            for pat in (W(r'時 ?期 項 ?目 税 ?金.{0,300}?20\.315[％%].{0,200}?20\.315[％%]'),):
                try: return f'{url(d)}「{Q(d, pat)}」'
                except ValueError: pass
            return f'{url(d)}（税金の表の逐語は資料の段組で取り出せなかった）'
        tax = ' / '.join(taxq(FUNDS[k]['P']) for k in (p.a, p.b))
        c['exceptions'] += (' 同じ節の「投資者が直接的に負担する費用」はこの2項目だけで、換金手数料の項目は無い。'
                            '手取りとの差になるのは同じ節の「税金」の表（分配時は普通分配金に、換金（解約）時・償還時は差益に課税。個人の源泉徴収時の税率で、NISA・外国税額控除・法人の場合は異なる）で、本文では税金を含めていないと書いた: ' + tax)
    return 'nofeepair'

TAXQ = (r'以下の表は、 ?個人投資者の源泉徴収時の税率であり、 ?課税方法(?:など|等)により異なる場合があります。.{0,260}?差益（譲渡益） ?に対して20\.315[％%]',
        r'(?:本|当)ファンドは、 ?NISAの ?「成長投資枠（特定非課税管理勘定）」 ?の対象ですが、 ?販売会社に ?より.{0,12}?取扱いが異なる場合があります。',
        r'NISA.{0,140}?一定の額を上限として、 ?毎年、 ?一定額の範囲で新たに購入した ?公募株式投資信託などから生じる配当所得(?:及び|および)譲渡所得が ?無期限で非課税となります。.{0,140}?一定の条件に該 ?当する方が対象となります。',
        r'\x07?外国税額控除の適用となった場合には、 ?分配時の税金が上記と異なる場合があります。',
        r'\x07?法人の場合は、?上記と?は?異なります。',
        r'上記は、?2026年[0-9]+月末日?現在のものです。 ?税法が改正された場合等には、 ?税率等が変更される場合があります。')

def tax_pair(p):
    """Tax table + NISA lines of both prospectuses (who pays what, and the NISA exemption). None if any line is missing."""
    if 'taxpair' in p.claims:
        return 'taxpair'
    qs = {}
    for k in (p.a, p.b):
        d = FUNDS[k]['P']
        try: qs[k] = [Q(d, pat) for pat in TAXQ]
        except ValueError: return None
    da, db = FUNDS[p.a]['P'], FUNDS[p.b]['P']
    p.claim('taxpair', '2本の交付目論見書の税金の表（個人の源泉徴収時の税率20.315%）と、NISAの成長投資枠の対象であること・NISA利用時の非課税',
            url(da), qs[p.a][0] + ' … ' + qs[p.a][2], f'{GOT}に確認した交付目論見書',
            '（SBIの抽出テキストは段組のため、成長投資枠の文の途中に欄見出し「課 税 関 係」が挟まる。）同じ節・同じ欄の例外を全件（本文の計算条件の節とFAQに書いた）: 源泉徴収時の税率で課税方法などにより異なる場合がある／外国税額控除の適用となった場合は分配時の税金が異なる場合がある／法人の場合は異なる／税法改正等で税率等が変わる場合がある（資料の時点）／NISAの成長投資枠の取扱いは販売会社により異なる場合がある／NISAは非課税口座の開設など一定の条件に該当する方が対象。'
            '課税されるのは分配時は普通分配金、換金（解約）時・償還時は差益（譲渡益）で、差益が無ければ譲渡益の税金はかからない。'
            f' 根拠: {url(da)}「' + '」「'.join(qs[p.a]) + f'」 / {url(db)}「' + '」「'.join(qs[p.b]) + '」',
            scope=f'個人投資者が受け取る分配金・換金時の差益の税金（{GOT}に確認した2本の交付目論見書の「税金」「課税関係」の欄）。法人・個別の課税方法は含まない')
    return 'taxpair'

def eff_scope(p):
    """'実質的な負担' in the prospectuses is a trust-fee rate including the investee ETF fee; record what it leaves out."""
    c = p.claims['effpair']
    c['scope'] = f'2本の交付目論見書の費用欄の「実質的な負担」「実質的に負担する運用管理費用」（{GOT}に確認）。投資先ETFの報酬を加味した信託報酬率の概算で、その他の費用・手数料と貸付時の報酬は含まない'
    qs = []
    for k in (p.a, p.b):
        d = FUNDS[k]['P']
        for pat in (W(r'＊\x07?ファンドが ?実 ?質的に投 ?資 ?対 ?象とする投 ?資信 ?託証券 ?の管 ?理報酬を加味した、 ?投資者の皆様が実質的に負担する信託報酬率になります。'),
                    W(r'（有価証券の貸付の指図を行った場合）.{0,200}?に追加されます。'),
                    W(r'信託財産にかかる監査報酬、.{0,260}?示すことができません。'),
                    r'＊2「実質的に負担する運用管理費用」は、投資対象とする投資信託証券における報酬を加味した実質的な信託報酬の概算値です。',
                    r'その他の費用・ 以下の費用・手数料は、.{0,1400}?事前に料率や上限額を表示することができません。'):
            try: qs.append(f'{url(d)}「{Q(d, pat)}」')
            except ValueError: pass
    c['exceptions'] += (' 主な例外（本文のリード・費用の節・FAQ・表下の注に書いた）: この率は信託報酬の部分で、監査報酬などのその他の費用・手数料（運用状況により変動し、事前に料率・上限額を示せない）と、'
                        '有価証券の貸付を行った場合に信託報酬に追加される額（SBI側）・貸付有価証券関連報酬（楽天側）を含まない。総経費率（参考値）は別の行に載せた。根拠: ' + ' / '.join(qs))

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
    return S(p, 'perf', f"比較期間全体（{jd(r['起点'])}〜{jd(r['終点'])}）の税引前分配金再投資ベースの最大下落率は{A['short']}が{pct(r['A最大下落率'])}、{B['short']}が{pct(r['B最大下落率'])}です。")

def one_year_line(p):
    r, A, B = p.r_, p.A, p.B
    one = r['1年窓']
    return S(p, 'perf', f"直近1年（{jd(one['起点'])}〜{jd(one['終点'])}）の税引前分配金再投資ベースの騰落率は{A['short']}が{pct(one['A累積'])}、{B['short']}が{pct(one['B累積'])}でした。")

def fee_line(p):
    A, B = p.A, p.B
    return S(p, 'feepair', f"信託報酬（税込年率・ファンド本体）は{A['short']}が{A['fee']}、{B['short']}が{B['fee']}です。")

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
        ref = ' / '.join(f'{url(FUNDS[k][d])}「{Q(FUNDS[k][d], pat)}」' for k in pk for d, pat in (
            ('P', W(r'※\x07?これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なります。')),
            ('Ak', W(r'（注[0-9０-９]+）\x07?上記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なり ?ます。'))) if FUNDS[k].get(d))
        p.docq('tersrc', '総経費率は直近の運用報告書の作成対象期間について年率換算した参考値で、交付目論見書の（参考情報）欄に載っている。資料は実際に発生した費用の比率とは異なると注記している', FUNDS[pk[0]]['P'],
               r'[（〈]参考情報[）〉]\s?ファンドの総経費率.{0,40}', '交付目論見書の（参考情報）欄の見出しと対象期間で確認。同じ欄・交付運用報告書の注記で「参考」であり実際に発生した費用の比率とは異なる旨を確認し、本文に書いた: ' + ref + '。' + other)
        p.claims['tersrc']['scope'] = '2本の交付目論見書の（参考情報）欄と交付運用報告書の総経費率（それぞれの作成対象期間・年率換算）'
    in_p = [FUNDS[k]['short'] for k in pk]
    in_ak = [f['short'] for k, f in fs if f['ter'] and f.get('ter_doc') == 'Ak']
    srcs = []
    if in_p:
        srcs.append(S(p, 'tersrc',
                      f'表の総経費率は、直近の運用報告書の作成対象期間について年率換算した参考値で、{"と".join(in_p)}は交付目論見書の（参考情報）欄に載っている値です。' if len(in_p) < 2 else
                      '表の総経費率は、直近の運用報告書の作成対象期間について年率換算した参考値で、交付目論見書の（参考情報）欄に載っている値です。'))
        srcs.append(S(p, 'tersrc', '交付目論見書・交付運用報告書とも、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なると注記しています。'))
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
    effn = [x for x in (eff_note_sentence(p, k) for k, f in fs) if x]
    if effn:
        h += P(*effn)
    extra = []
    lend = [lend_sentence(p, k) for k, f in fs]
    first = next((k for k, f in fs if f.get('lend_q')), None)
    if first:
        rows = '表の信託報酬と実質的な信託報酬' if (A['etf'] or B['etf']) else '表の信託報酬'
        lend.append(S(p, f'{first}-lend', f'{rows}は、貸付を行った場合のこれらの額を含まない率です。'))
    h += P(*lend)
    oc = othercost_sentence(p)
    if oc:
        h += P(*oc)
    for k, f in fs:
        if f.get('ter_mark'):
            schd_terfund_claim(p)
            extra.append(S(p, f'{k}-terfund', f'※{f["short"]}の{f["ter"]}には、投資先ETFにかかる年0.06%程度の報酬が反映されていますが、委託会社がその相当額をファンドに別途充当しています（詳しくは「ETFの報酬をどう数えるかで、表示の料率が変わる」の節）。'))
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
    if f.get('lend_kind') == 'tawara':
        if short:
            return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書には、マザーファンドで有価証券の貸付の指図を行った場合に、品貸料の一部が信託報酬に加わる定めがあります（2026年7月14日現在は品貸料の49.5%（税抜45%）以内）。')
        return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書は、投資対象とするマザーファンドで有価証券の貸付の指図を行った場合、マザーファンドの品貸料のうちファンドに属するとみなした額に55%未満（税抜50%）の率を乗じた額を運用管理費用（信託報酬）に含めると定めています。2026年7月14日現在の率は品貸料の49.5%（税抜45%）以内です。')
    if f.get('lend_kind') == 'other':
        return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書は、その他の費用・手数料のひとつに貸付有価証券関連報酬を挙げ、有価証券の貸付取引を行った場合は、投資信託財産の収益となる品貸料に{f["lend_rate"]}を乗じて得た額としています。')
    assert '品貸料' not in text(f['P']), k
    import re as _re
    _m = _re.search(r'有価証券の貸付等においては、[^。]*。', text(f['P']))
    extra = (f'「{_m.group(0)}」という投資リスクの記載はあるが、品貸料の配分や信託報酬への追加の定めは無い。') if _m else ''
    p.claim(f'{k}-nolend', f'{f["name"]}の交付目論見書に品貸料についての記載が無い', url(f['P']), Q(*f['fee_q']), f'{PUB}に確認した{DOCS[f["P"]][1]}',
            '交付目論見書の抽出テキスト全文を「品貸料」で検索して0件であることを確認した（生成のたびに assert で確かめ、語が現れたら生成が止まる）。source_quote は同じ資料の運用管理費用（信託報酬）の欄で、ここに貸付時の追加の定めが無い。' + extra)
    return S(p, f'{k}-nolend', f'{f["short"]}の交付目論見書には、品貸料についての記載がありません。')

def othercost_sentence(p):
    """The costs the stated fee rates do NOT include: audit fees, custody, brokerage etc., borne by the fund."""
    # 費用の欄は2段組で、抽出テキストでは隣の段の見出し（その他の費用／及び手数料）が文の途中に挟まる
    pat = (r'信託財産にかかる監査報酬、信託事務の処理に要する諸費用、法定書類'
           r'.{0,260}?原則として受益者の負担とし、信託財産中から支払われま.{0,12}?す。')
    try:
        qs = [(k, Q(FUNDS[k]['P'], pat)) for k in (p.a, p.b)]
    except ValueError:
        return []
    a = FUNDS[p.a]; b = FUNDS[p.b]
    p.claim('othercost', f'{a["short"]}と{b["short"]}の「その他の費用・手数料」（信託報酬の料率に含まれない費用）',
            url(a['P']), qs[0][1], f'{GOT}に確認した2本の交付目論見書の費用の欄',
            '同じ欄の注記: 投資者が負担する手数料等の合計額は保有期間等に応じて異なるため表示できない旨と、費用等は本書作成日現在の情報で今後変更される場合がある旨。'
            + ('SBI・SPDR側にはさらに「これらの費用は、運用状況などにより変動するものであり、事前に料率、上限額などを示すことができません」の注記がある。' if '事前に料率' in text(a['P']) else '')
            + f' 比較相手: {url(b["P"])}「{qs[1][1]}」')
    return [S(p, 'othercost', f'{a["short"]}と{b["short"]}の交付目論見書は、信託財産にかかる監査報酬、信託事務の処理に要する諸費用、法定書類の作成・印刷・交付にかかる費用、組入有価証券の売買委託手数料、外貨建資産の保管に要する費用などを、原則として受益者の負担とし信託財産から支払うと定めています。'),
            S(p, 'othercost', '表の信託報酬と実質的な信託報酬は、これらのその他の費用・手数料を含まない率です。2本とも、投資者が負担する手数料等の合計額は保有期間等に応じて異なるため表示できないと書かれています。')]


def eff_note_sentence(p, k):
    """What the prospectus says about the as-of date and the variability of the 実質的な負担 figure."""
    f = FUNDS[k]
    if not f.get('effnote_q'):
        return ''
    extra = [f['effnote_asof']] if f.get('effnote_asof') else None
    p.docq(f'{k}-effnote', f'{f["name"]}の実質的な負担の値の時点と、変更・変動についての記載',
           f['effnote_q'][0], f['effnote_q'][1], f['effnote_exc'], extra_doc=extra)
    return S(p, f'{k}-effnote', f['effnote'])


def ter_fig_sentence(p, k):
    """The TER doughnut in the annual report breaks the fund's own cost into fee payees and 'other'."""
    f = FUNDS[k]
    if not f.get('terfig_q'):
        return ''
    p.docq(f'{k}-terfig', f'{f["name"]}の総経費率の内訳（交付運用報告書の図）',
           f['terfig_q'][0], f['terfig_q'][1],
           '交付運用報告書の（参考情報）○総経費率の図に印字された内訳をそのまま読んだ。注3に「四捨五入の関係により、合計が一致しない場合があります」の記載があるため、内訳を足し合わせた値は本文に書いていない。')
    return S(p, f'{k}-terfig', f'{f["short"]}の内訳は、{f["terfig"]}です。')


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
            'sbi-spyd4': ('sspyd_Ak', r'総経費率（①＋②） 0\.17％ ①当ファンドの費用の比率 0\.10％ ②投資先ファンドの運用管理費用の比率 0\.07％', '0.17%', '当ファンドの費用の比率0.10%、投資先ファンドの運用管理費用の比率0.07%'),
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
    elif other == 'sbi-vym4':
        p.docq('sbi-vym4-etfgap', 'SBI・V・米国高配当（年4回）の投資先ETFの費用は、交付目論見書の概算（年0.04%程度）と交付運用報告書の内訳（0.06%）で数字が違う', 'svym_P',
               r'年0\.04％程度 投 資 信 託 証 券 ＊マザーファンド受益証券を通じて投資するETF（上場投資信託証券）の信託報酬等',
               '交付目論見書の値は「程度」と書かれた概算、交付運用報告書の値は作成対象期間（2025年11月21日〜2026年5月20日）の実績の比率。2つが違う理由は資料に書かれていないため、本文でも理由を書いていない。',
               extra_doc=[('svym_Ak', r'②投資先ファンドの運用管理費用の比率 0\.06％')])
        etf.append(S(p, 'sbi-vym4-etfgap', 'SBI・V・米国高配当（年4回）の投資先ETFの費用は、交付目論見書の年0.04%程度と、総経費率の内訳の0.06%とで数字が違います。前者は交付目論見書の概算値、後者は2025年11月21日〜2026年5月20日の実績の比率で、違いの理由は資料に書かれていません。'))
    r = FUNDS['rakuten-schd']
    h = P(S(p, 'rakuten-schd-ter', '楽天・SCHDの総経費率0.19%の内訳は、交付目論見書では運用管理費用の比率0.12%とその他費用の比率0.07%、交付運用報告書では切り方が違い、このファンドの費用の比率0.13%と投資先ファンドの運用管理費用等の比率0.06%です。'),
          S(p, 'rakuten-schd-terfund', '交付目論見書は、その他費用の比率0.07%に「当該比率には、投資対象とする投資信託証券にかかる年0.06%程度の報酬が反映されていますが、委託会社が合理的に見積った当該報酬相当額をファンドに別途充当しています。」と注記しています。'),
          S(p, 'rakuten-schd-terfund', '交付運用報告書も、総経費率の注9に同じ文を載せています。'),
          S(p, f'{other}-terbrk', f'{o["short"]}の{v}の内訳は、交付運用報告書では{brk}で、このような充当の記載はありません。'), *etf,
          S(p, 'rakuten-schd-terfund', '充当の扱いが違うため、総経費率の数字どうしの差は、そのまま実質的な負担の差にはなりません。'))
    figs = [x for x in (ter_fig_sentence(p, k) for k in (other, 'rakuten-schd')) if x]
    if figs:
        tail = []
        if o.get('ter_other') and r.get('ter_other'):
            gap_claim(p, 'otherfee', '2本の総経費率のうち「その他費用」の実績の比率', 'ter')
            tail.append(S(p, 'otherfee', f'このうち「その他費用」（{o["ter_other"]}と{r["ter_other"]}）は、上で引き算した料率の差には入っていません。'))
        h += P(S(p, 'feehead', 'それぞれのファンド自身の費用の比率には、交付運用報告書の総経費率の図にさらに細かい内訳が載っています。'), *figs, *tail)
    return h

def faq_net(p):
    if not all(FUNDS[k].get('nofee_val', 'なし／なし') == 'なし／なし' for k in (p.a, p.b)):
        return ('method', '表の評価額は売却して受け取れる金額ですか？',
                '違います。税引前の分配金を再投資した基準価額で計算した売却前の金額です。購入時・換金時の手数料や投資者ごとの税金は含みません。基準価額に反映済みの信託報酬を二重に引いてもいません。')
    head = ([(tax_pair(p), '課税口座では違います。税引前の分配金を再投資した基準価額で計算した売却前の金額で、普通分配金と換金時の差益（譲渡益）にかかる税金（個人の源泉徴収時の税率で20.315%。課税方法や外国税額控除の適用などにより異なる場合があり、法人の場合は異なります）は含みません。'),
             (tax_pair(p), '2本ともNISAの成長投資枠の対象で（販売会社により取扱いが異なる場合があります）、NISAを利用した場合は、これらの配当所得と譲渡所得は非課税です。')]
            if tax_pair(p) else
            [('method', '違います。税引前の分配金を再投資した基準価額で計算した売却前の金額で、投資者ごとの税金（分配金や換金時の差益にかかる税金）は含みません。')])
    return ('method', '表の評価額は売却して受け取れる金額ですか？',
            head + [(nofee_pair(p), '2本とも、交付目論見書の購入時手数料と信託財産留保額は「ありません」と書かれています。'),
                    ('method', '基準価額に反映済みの信託報酬を二重に引いてもいません。')])

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
    return [('performance', '同じ期間の実績を、分配金再投資で比べる'), ('fees', '目論見書の料率と、総経費率（参考値）を分けて見る'),
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



# SBI's monthly-report PDFs encode some kanji as CJK compatibility ideographs (e.g. U+F9DB for 率).
# Patterns for those files wildcard these characters so the quote stays a verbatim excerpt.
_COMPAT = set('更滑金落論累異不量年了料流留率利履理離立切度行降見車菱復良力識')
def W(pat):
    return ''.join('.' if ch in _COMPAT else ch for ch in pat)

def distnav_claims_doc(p, doc, policy_pat=None):
    p.docq('distnav', '分配金は純資産から支払われ、その分基準価額が下がる', doc,
           r'分配金は、 ?預貯金の利息とは異なり、 ?投資信託の純資産から支払われますので、 ?分配金が支払われると、 ?その金額相当 ?分、 ?基準価額は下がります。',
           '無し: 交付目論見書の「収益分配金に関する留意事項」で確認。')
    p.docq('distpolicy', '分配金は委託会社が決定し、支払われない場合もある', doc,
           policy_pat or r'分配金額は、 ?収益分配方針に基づいて委託会社が決定します。 ?あらかじめ一定の額の分配をお約束するものでは ?ありません。 ?分配金が支払われない ?場合もあります。',
           '無し: 交付目論見書の分配の注記で確認。比較相手の資料にも同趣旨の記載がある。')

def dist_table(p, la, lb, ra, rb):
    sa = sum(v for _, v in ra); sb = sum(v for _, v in rb)
    t = f'<div class="scroll-wrap"><table><thead><tr><th scope="col">回（古い順）</th><th scope="col">決算日（{E(la)}）</th><th scope="col" class="num">{S(p, "distA", "分配金（1万口当たり・税引前）")}</th><th scope="col">決算日（{E(lb)}）</th><th scope="col" class="num">{S(p, "distB", "分配金（1万口当たり・税引前）")}</th></tr></thead><tbody>'
    for n_, ((da, va), (db, vb)) in enumerate(zip(ra, rb), 1):
        t += f'<tr><th scope="row">{S(p, "distA", f"{n_}回目")}</th><td>{S(p, "distA", jd(da.replace("/", "-")))}</td><td class="num">{S(p, "distA", f"{va}円")}</td><td>{S(p, "distB", jd(db.replace("/", "-")))}</td><td class="num">{S(p, "distB", f"{vb}円")}</td></tr>'
    t += f'<tr><th scope="row">合計</th><th scope="row">{S(p, "distA", f"4回の合計（{la}）")}</th><td class="num">{S(p, "distA", f"{sa}円")}</td><th scope="row">{S(p, "distB", f"4回の合計（{lb}）")}</th><td class="num">{S(p, "distB", f"{sb}円")}</td></tr></tbody></table></div>'
    return t, sa, sb

def last4(rows):
    return rows[-4:]

# ======================================================================== 1. Japan high dividend
@article
def a_jhd():
    p = Page('sbi-nihon-kohaitou-vs-rakuten-nihon-kohaitou', 'sbi-jhd', 'rakuten-jhd', 'sbi-jhd__rakuten-jhd')
    r = p.r_
    one = r['1年窓']
    p.title = title = 'SBI日本高配当 vs 楽天・高配当株式・日本｜費用・分配金・実績を比較'
    desc = (f"SBI日本高配当株式（分配）ファンドと楽天・高配当株式・日本ファンドを比較。{jd(r['起点'])}〜{jd(r['終点'])}の分配金再投資の実績、"
            "信託報酬（税込年率・貸付時の追加分を除く）はSBIが年0.099%・楽天が年0.297%、銘柄の選び方と分配金を交付目論見書と月次レポートで確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    distnav_claims_doc(p, 'sjhd_P', r'分配対象額が少額の場合等には、分配を行わない場合があります。将来の分配金の支払いおよびその金額について 保証するものではありません。')
    ra = last4(dist_rows_sbi('sbi-jhd', '2025-07-01')); rb = last4(dist_rows_rakuten(p, 'rakuten-jhd', '2025-07-01'))
    p.docq('distA', 'SBI日本高配当の分配金（1万口当たり・税引前）の直近4回（2025年10月10日〜2026年7月10日の決算）', 'sjhd_M',
           W(r'決算日 2025/7/10 2025/10/10 2026/1/13 2026/4/10 2026/7/10 分配金 120円 130円 140円 140円 140円 1,340円 ※収益分配金は1万口当たりの金額です。'),
           '運用会社の月次レポート（2026年8月31日基準）の収益分配金（税引前）推移で確認（同じ値はウエルスアドバイザー配信の基準価額データの分配金欄にもある）。2026年1月の決算日が13日なのは、原則の10日が休業日のため翌営業日になったもの（交付目論見書の決算日の欄）。'
           '同じ欄の注記: 分配金は過去の実績で、将来の分配金の水準を示唆・保証するものではない。分配金は収益分配方針に基づき委託会社が決定し、支払われない場合もある。')
    p.claims['distA']['scope'] = 'SBI日本高配当株式（分配）ファンド（年4回決算型）の1万口当たり・税引前の分配金の過去の実績（2025年10月10日〜2026年7月10日の4回の決算）。将来の分配金ではない'
    dist_claim(p, 'distA', 'sbi-jhd', ra); dist_claim(p, 'distB', 'rakuten-jhd', rb)
    p.claims['distB']['scope'] = '楽天・高配当株式・日本ファンド（四半期決算型）の1万口当たり・税引前の分配金の過去の実績（2025年12月25日〜2026年9月25日の4回の決算）。将来の分配金ではない'
    p.claims['distB']['exceptions'] += (' 基準価額データ（CSV）の列名は「基準日,基準価額(円),分配金再投資基準価額(円),純資産総額(億円),分配金(円)」。'
        '2025年12月〜2026年6月の110円・115円・120円は月次レポート（2026年8月31日作成基準）の「分配金（税引前、1万口当たり）」の表と一致し（' + url('risjde_M') + '「'
        + Q('risjde_M', r'分配金（税引前、1万口当たり） 設定来分配金合計額 550 円 3月 6月 9月 12月 2025年 - 100 円 105 円 110 円 2026年 115 円 120 円 - -') + '」）、'
        '基準価額は1万口当たりで表示される（交付目論見書）。2026年9月25日の125円はこの月次レポートより後の決算で、CSVだけが根拠（本文に注記）。')
    p.claims['distB']['applies'] = f'{GOT}に取得した運用会社（楽天投信投資顧問）公表の基準価額データの分配金欄'
    p.docq('distover', '分配金は計算期間中の収益を超えて支払われる場合があり、購入価額によっては元本の一部払戻しに相当する場合がある（2本とも）', 'sjhd_P',
           r'投資者のファンドの購入価額によっては、分配金の一部または全部が、実質的には元本の一部払戻しに 相当する場合があります。',
           '2本の交付目論見書の「収益分配金に関する留意事項」に同じ趣旨の記載がある。楽天側: ' + url('risjde_P') + '「'
           + Q('risjde_P', r'分配金は計算期間中に発生した収益を超えて支払われる場合があります。') + '」「'
           + Q('risjde_P', r'投資者のファンドの購入価額によっては、分配金の一部または全部が、実質的には元本の一部払戻しに相当する ?場合があります。') + '」。'
           'SBI側の収益を超える分配: 「' + Q('sjhd_P', r'収益分配は、 ?計算期間に生じた収益を超えて行われる場合があります。') + '」。'
           '「購入後の運用状況により、分配金額より基準価額の値上がりが小さかった場合も同様」の一文も2本にある。',
           extra_doc=[('sjhd_P', r'ファンド購入後の運用状況により、分配金額より基準価額の値上がりが小さ ?かった場合も同様です。')])
    p.docq('sel-s', 'SBI日本高配当の銘柄選定（予想配当利回りが市場平均より高い銘柄を中心に選別）', 'sjhd_P',
           r'銘柄の選定にあたっては、予想配当利回りが市場平均と比較して高い銘柄を中心に、配当の状況、企業のファンダメ ンタルズ要因、株価のバリュエーション等に関する評価・分析などを勘案し、 投資銘柄を選別します。',
           '交付目論見書の「ファンドの特色」。同じ欄に「予想配当利回りの高い銘柄が必ずしも組み入れられるとは限りません」「業種の分散を図れないことがあり」の注記があり、本文でも断定していない。',
           extra_doc=[('sjhd_P', r'※業種の分散を図れないことがあり、ファンドの基準価額の変動が、市場動向と乖離することがあります。')])
    p.docq('build-s', 'SBI日本高配当の組入比率の決め方と、平均配当利回りの基本方針（保証はしない）', 'sjhd_P',
           r'ポートフォリオの構築にあたっては、個別銘柄の時価総額や流動性等も勘案しながら、各銘柄の組入比率を決定し ?ます。',
           '同じ「ファンドの特色」の欄: 「' + Q('sjhd_P', r'ポートフォリオの平均配当利回りが市場平均を上回るように銘柄の選定、投資比率の決定を行なうことを基本とし ?ます。')
           + '」「' + Q('sjhd_P', r'※実質的なポートフォリオの平均配当利回りが市場平均を上回ることを保証するものではありません。') + '」。本文は「基本としている」「保証されていない」と書き、断定していない。'
           '楽天側は同じ欄に「流動性等を勘案して銘柄毎の組入比率を決定」とあり、本文の楽天の段落に書いた。')
    p.docq('sel-r', '楽天・高配当株式・日本の銘柄選定（ダウ・ジョーンズ日本配当100インデックスを参照）', 'risjde_P',
           r'株式への投資にあたっては、主としてダウ・ジョーンズ日本配当１００インデックス（S&P） （以下、｢対 象指数｣ ということがあります。）を参照し銘柄を選定し、流動性等を勘案して銘柄毎の組入比率を決 定します。',
           '交付目論見書の「ファンドの特色」。指数への連動を目指すとは書かれておらず、ベンチマークも無い（同資料）。',
           extra_doc=[('risjde_P', r'「ダウ・ジョーンズ日本配当１００指数」 は、S&P日本５００指数の中から、財務比率に基づき同業他社 と比較してファンダメンタルズの強さを考慮し選定された、安定した配当実績を持つ高配当企業 １００社から構成される指数です。')])
    p.docq('dj100', 'ダウ・ジョーンズ日本配当100指数の定義', 'risjde_P',
           r'「ダウ・ジョーンズ日本配当１００指数」 は、S&P日本５００指数の中から、財務比率に基づき同業他社 と比較してファンダメンタルズの強さを考慮し選定された、安定した配当実績を持つ高配当企業 １００社から構成される指数です。',
           '無し: 交付目論見書の指数の説明で確認。')
    p.docq('comp-s', 'SBI日本高配当のマザーファンドの銘柄数・配当利回り・上位銘柄・業種（2026年8月31日基準）', 'sjhd_M',
           W(r'株式組入比. 96\.70% 配当.回り 2\.98%.{0,200}?組入銘柄数：111.{0,1600}?30 4205 日本ゼオン 化学 1\.07% 3\.02%'),
           '比率はマザーファンドの純資産総額比。上位30銘柄より下の保有は月次レポートからは分からないため、本文では「上位30銘柄外」と書き、保有していないとは書いていない。',
           extra_doc=[('sjhd_M', W(r'※配当.回りは過去12か月間の配当落ち後の1株当り配当額の合計を基準日の株価で割った値です。'))])
    p.docq('comp-r', '楽天・高配当株式・日本のマザーファンドの銘柄数・予想配当利回り・上位業種・上位10銘柄（2026年8月31日）', 'risjde_M',
           r'投資銘柄数 76 （参考）予想配当利回り 3\.3%.{0,1200}?デンソー 輸送用機器 3\.0%',
           '比率はマザーファンドの純資産総額比。予想配当利回りは各種情報を基に算出した参考値（税金等控除前）で、ファンドの将来の分配金を示唆しない（同資料の注記）。',
           extra_doc=[('risjde_M', r'※ 予想配当利回りは、各種情報を基に組入銘柄の予想配当利回りをマザーファンドの純資産総額比で加重平均して算出した参考値（税金等控除前） ?です。')])
    p.claim('yielddef', '2本の月次レポートの配当利回りは定義が違う（SBIは過去12か月の実績、楽天は予想）', url('sjhd_M'),
            Q('sjhd_M', W(r'※配当.回りは過去12か月間の配当落ち後の1株当り配当額の合計を基準日の株価で割った値です。')), f'{GOT}に確認した月次レポート（2026年8月31日基準）',
            '楽天側: ' + url('risjde_M') + '「' + Q('risjde_M', r'※ 予想配当利回りは、各種情報を基に組入銘柄の予想配当利回りをマザーファンドの純資産総額比で加重平均して算出した参考値（税金等控除前） ?です。') + '」。定義が違うため数値の大小を比べていない。')
    p.claim('overlap', '楽天の上位10銘柄のうち6銘柄がSBIの上位30銘柄にも入っている（2026年8月末）', url('risjde_M'),
            p.claims['comp-r']['source_quote'], f'{GOT}に確認した月次レポート（2026年8月31日）',
            '楽天の上位10銘柄（日本たばこ産業・三菱ＵＦＪ・ブリヂストン・トヨタ・アステラス・東京海上・第一三共・スズキ・ＩＮＰＥＸ・デンソー）をSBIの上位30銘柄表と名前で照合した。SBI側: ' + url('sjhd_M') + '「' + p.claims['comp-s']['source_quote'][:300] + '…」')
    p.claim('index-none', '2本ともベンチマークがない', url('sjhd_P'), Q('sjhd_P', r'本ファンドにはベンチマークはありません。'), f'{GOT}に確認した交付目論見書',
            '楽天側: ' + url('risjde_P') + '「' + Q('risjde_P', r'当ファンドには、 ベンチマークはありません。') + '」')
    pair_claim(p, 'settlepair', 'settle', '2本の決算頻度と決算日')
    ci = p.claims[p.fc('rakuten-jhd', 'incept')]
    p.claim('period', f'比較期間（楽天の設定日{jd(r["起点"])}〜{jd(r["終点"])}）の長さ', ci['source_url'], ci['source_quote'], ci['applies'],
            ci['exceptions'] + ' 終点は月末に固定した（本文の計算条件）。期間の長さは暦日数から計算した値。',
            scope=f'この記事の比較期間（{jd(r["起点"])}〜{jd(r["終点"])}）の長さ。楽天の設定日を起点にした理由は計算条件の節')
    gap_claim(p, 'feegap', '2本の信託報酬の差と100万円あたりの目安')
    d, ds, amt, hi, lo = gap_text(p)
    sa = sum(v for _, v in ra); sb = sum(v for _, v in rb)
    lead = P(perf_lead(p, '結論から言うと、'), one_year_line(p), dd_line(p))
    lead += P(S(p, 'feepair', f"信託報酬（税込年率・ファンド本体、有価証券の貸付を行った場合の追加分を除く）は{p.A['short']}が{p.A['fee']}、{p.B['short']}が{p.B['fee']}です。"),
              S(p, 'sel-r', '銘柄の選び方も違い（交付目論見書の記載）、SBIは予想配当利回りが市場平均より高い銘柄を中心に運用会社が選別し、楽天は主にダウ・ジョーンズ日本配当100インデックスを参照して銘柄を選んでいます（2本ともベンチマークはありません）。'),
              S(p, 'period', f'比較期間は、楽天の設定日（{jd(r["起点"])}）から{jd(r["終点"])}までの約1年8か月です。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'sel-s', '<h2 id="mechanism">銘柄の選び方：運用会社の選別か、指数を参照するか</h2>')
    body += P(S(p, 'sel-s', 'SBI日本高配当は、予想配当利回りが市場平均と比べて高い銘柄を中心に、配当の状況、企業のファンダメンタルズ、株価のバリュエーションなどを評価・分析して投資銘柄を選別します。交付目論見書は、予想配当利回りの高い銘柄が必ずしも組み入れられるとは限らないこと、業種の分散を図れないことがあることも書いています。'),
              S(p, 'build-s', '各銘柄の組入比率は、個別銘柄の時価総額や流動性なども考えて決めます。'),
              S(p, 'build-s', 'ポートフォリオの平均配当利回りが市場平均を上回るように銘柄の選定・投資比率の決定を行うことを基本としていますが、上回ることは保証されていません。'),
              S(p, 'index-none', 'ベンチマークはありません。'))
    body += P(S(p, 'sel-r', '楽天・高配当株式・日本は、主にダウ・ジョーンズ日本配当100インデックスを参照して銘柄を選び、流動性などを考えて組入比率を決めます。'),
              S(p, 'dj100', 'この指数は、S&P日本500指数の中から、財務比率に基づき同業他社と比較してファンダメンタルズの強さを考慮して選んだ、安定した配当実績を持つ高配当企業100社で構成されます。'),
              S(p, 'index-none', 'このファンドも交付目論見書でベンチマークはありません。'),
              S(p, 'sel-r', 'この指数は、銘柄を選ぶときに参照する対象として書かれています。'))
    body += P(S(p, 'comp-s', '2026年8月31日時点で、SBIのマザーファンドは111銘柄、業種は銀行業12.04%、電気機器10.28%、輸送用機器7.82%の順です。'),
              S(p, 'comp-r', '楽天のマザーファンドは2026年8月31日時点で76銘柄で、上位業種は輸送用機器14.3%、保険業12.9%、建設業9.7%です。'))
    rows = [('日本たばこ産業', '2.07%', '4.5%'), ('三菱ＵＦＪフィナンシャル・グループ', '3.66%', '4.3%'), ('ブリヂストン', '上位30銘柄外', '4.2%'),
            ('トヨタ自動車', '1.40%', '4.2%'), ('アステラス製薬', '1.62%', '4.1%'), ('東京海上ホールディングス', '1.35%', '3.9%'),
            ('第一三共', '上位30銘柄外', '3.9%'), ('スズキ', '上位30銘柄外', '3.8%'), ('ＩＮＰＥＸ', '1.08%', '3.5%'), ('デンソー', '上位30銘柄外', '3.0%')]
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">' + S(p, 'comp-r', '楽天の組入上位10銘柄（2026年8月31日基準）') + '</th><th scope="col" class="num">' + S(p, 'comp-s', 'SBIでの比率（2026年8月31日）') + '</th><th scope="col" class="num">' + S(p, 'comp-r', '楽天での比率（2026年8月31日）') + '</th></tr></thead><tbody>'
    for n, s_, r_v in rows:
        t += f'<tr><th scope="row">{n}</th><td class="num">{S(p, "comp-s", s_)}</td><td class="num">{S(p, "comp-r", r_v)}</td></tr>'
    t += '</tbody></table></div>'
    body += t + P(S(p, 'overlap', '楽天の上位10銘柄のうち6銘柄は、SBIの組入上位30銘柄にも入っています（2026年8月末、比率はそれぞれのマザーファンドの純資産総額比）。'),
                  S(p, 'comp-s', 'SBI側の「上位30銘柄外」は月次レポートの上位30銘柄に載っていないという意味で、保有していないという意味ではありません。'))
    body += P(S(p, 'yielddef', '2026年8月31日基準の月次レポートの配当利回りは、SBIが2.98%、楽天が3.3%と書かれています。'),
              S(p, 'yielddef', 'SBIの値は、各銘柄の過去12か月間の配当落ち後の1株当たり配当額の合計を基準日の株価で割った値を、マザーファンドの株式の評価額の合計に対する比率で加重平均したものです。'),
              S(p, 'yielddef', '楽天の値は、組入銘柄の予想配当利回りをマザーファンドの純資産総額比で加重平均した参考値（税金等控除前）です。'),
              S(p, 'yielddef', '実績か予想か、加重の分母が何かが違うため、この2つの数字の大小は比べられません。'))
    t2, _, _ = dist_table(p, 'SBI日本高配当', '楽天', ra, rb)
    distnote = S(p, 'distB', '楽天の2026年9月25日決算の分配金（125円・1万口当たり・税引前）は、2026年8月31日作成基準の月次レポートにはまだ載っておらず、運用会社が公表している基準価額データ（2026年10月3日取得）の分配金欄の値です。')
    body += S(p, 'distA', '<h3 id="dist">直近4回の分配金（1万口当たり・税引前、2026年9月30日までの決算）</h3>') + t2
    body += P(distnote, S(p, 'settlepair', '決算日は、交付目論見書でSBIが原則として1・4・7・10月の各10日、楽天が原則として3・6・9・12月の各25日（どちらも休業日の場合は翌営業日）です。'),
              S(p, 'distA', '分配金は1万口当たりの金額で、基準価額の水準が違う2本の円の金額どうしでは利回りの高低を比べられません。'),
              S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われた金額に相当する分、基準価額は下がります。'),
              S(p, 'distpolicy', '分配対象額が少額の場合などには分配を行わない場合があり、将来の分配金の支払いとその金額は保証されていません。'),
              S(p, 'distover', '2本の交付目論見書はどちらも、分配金が計算期間中に発生した収益を超えて支払われる場合があること、投資者の購入価額によっては分配金の一部または全部が実質的には元本の一部払戻しに相当する場合があることを書いています。'),
              S(p, 'perf', '冒頭の実績表（累積騰落率・評価額など）は、分配金を受け取らずに税引前のまま再投資したと仮定した値です。'))
    body += S(p, 'feegap', '<h2 id="cost-detail">信託報酬（税込）の差と、総経費率の対象期間</h2>')
    body += P(S(p, 'feegap', f'交付目論見書の信託報酬（税込年率、貸付時の追加分を除く）はSBIが年0.099%、楽天が年0.297%で、差は年{ds}ポイントです。'),
              S(p, 'feegap', f'100万円を1年間一定額で保有すると仮定した信託報酬の差の目安は、100万円×年{ds}%で約{amt:,}円（税込）で、実際の利益差ではありません。'),
              ter_line(p), S(p, 'terpair', '2本の総経費率はどちらも約半年の作成対象期間の値で、対象期間の始まりは76日ずれています。'))
    body += P(S(p, 'perf', 'この比較期間ではSBIの累積騰落率が楽天を上回りましたが、2本は銘柄の選び方と業種の構成が違い、実績の差を費用の差だけで説明することはできません。'))
    body += method_section(p)
    body += faq_block(p, [
        ('index-none', '2本は同じ指数に連動していますか？', [('index-none', '2本とも、交付目論見書でベンチマークはありません。'),
                                                ('sel-r', '楽天は主にダウ・ジョーンズ日本配当100インデックスを参照して銘柄を選びますが、SBIは予想配当利回りが市場平均より高い銘柄を中心に運用会社が選別します。')]),
        ('yielddef', '配当利回りはどちらが高いですか？', '2026年8月31日基準の月次レポートの値はSBIが2.98%、楽天が3.3%ですが、SBIは過去12か月の配当実績による値、楽天は予想配当利回りの参考値で定義が違うため、比べられません。楽天の月次レポートは、この値がファンドの将来の分配金の支払いを示唆するものではないと注記しています。'),
        faq_net(p),
        ('perf', '直近1年ではどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の税引前分配金再投資ベースの騰落率はSBIが{pct(one['A累積'])}、楽天が{pct(one['B累積'])}でした。開始日によって結果は変わります。"),
    ])
    sections = std_sections('mechanism', '銘柄の選び方：運用会社の選別か、指数を参照するか', '信託報酬（税込）の差と、総経費率の対象期間')
    related = [('../rakuten-schd-vs-sbi-vym/', '楽天・SCHD vs SBI・V・米国高配当（年4回）', '米国の高配当ファンドを同じ方法で比べる'),
               ('../haitokin-kakutei-shinkoku/', '配当金と確定申告', '分配金・配当金の税金の扱いを確かめる'),
               ('../emaxis-topix-vs-nikkei/', 'eMAXIS Slim TOPIX vs 日経平均', '日本株の指数連動型を比べる')]
    return p, title, desc, body, sections, related

# ======================================================================== 2/3. SPYD helpers
def spyd_claims(p):
    p.docq('comp-spyd', 'SBI・SPDR・S&P500高配当の投資先ETFの業種別の比率（月次レポートが載せる11業種）と上位銘柄（2026年8月31日基準）', 'sspyd_M',
           W(r'組入上位業種 不動産 22\.97％ 生活必需品 15\.40％ 金融 14\.01％ 公益事業 10\.30％.{0,900}?※比率は、投資信託証券（ETF）の純資産総額に対する割合です。'),
           '業種比率はETFの株式評価額に対する割合、銘柄比率はETFの純資産総額に対する割合（同資料の注記を逐語に含めた）。資料が載せる業種の一覧は11業種（合計で約100%）。業種は投資信託証券（ETF）の組入比率に基づく加重平均で、資料はBloomberg等のデータを基に作成と注記している。')
    p.docq('spyd-80', 'S&P500高配当指数はS&P500採用銘柄のうち配当利回りが高い80銘柄', 'sspyd_P',
           r'Ｓ＆Ｐ500®高配当指数（S&P 500 High Dividend Index） とは米国のＳ＆Ｐ500インデックスの採用銘柄の うち配当利回りが高い80銘柄のパフォーマンスを計測する指数です。',
           '無し: 交付目論見書の「ベンチマークについて」で確認。')

# ======================================================================== 2. SPYD vs VYM
@article
def a_spyd_vym():
    p = Page('sbi-spyd-vs-sbi-vym', 'sbi-spyd4', 'sbi-vym4', 'sbi-spyd4__sbi-vym4')
    r = p.r_
    one = r['1年窓']
    p.title = title = 'SBI・SPDR・S&P500高配当 vs SBI・V・米国高配当｜業種・費用・実績を比較'
    desc = (f"SBIの米国高配当2本（年4回決算型）を{jd(r['起点'])}〜{jd(r['終点'])}・分配金再投資（税引前）で比較。"
            f"100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}（売却前）、投資先ETF分を含む実質的な負担は年0.1338%程度と年0.1038%程度。"
            "不動産と情報技術の比率の差も確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    distnav_claims_doc(p, 'sspyd_P')
    ra = last4(dist_rows_sbi('sbi-spyd4', '2025-07-01')); rb = last4(dist_rows_sbi('sbi-vym4', '2025-07-01'))
    dist_claim(p, 'distA', 'sbi-spyd4', ra); dist_claim(p, 'distB', 'sbi-vym4', rb)
    pair_claim(p, 'effpair', 'eff', '2本の実質的な負担')
    pair_claim(p, 'idxpair', 'index', '2本の連動対象')
    pair_claim(p, 'settlepair', 'settle', '2本の決算頻度と決算日')
    spyd_claims(p)
    p.docq('spyd-etf', 'SBI・SPDR・S&P500高配当（年4回）がマザーファンドを通じて投資する投資対象ファンド（ETF）の名称', 'sspyd_P',
           W(r'マザーファンド受益証券は、ETF（上場投資信託証券） を主要投資対象とします。.{0,200}?投資対象ファンドの名称 State Street SPDRポートフォリオS&P500高配当株式ETF'),
           '同じ節のただし書・注: 投資対象ファンドへの実質投資割合は「原則として高位を維持します」、詳細は同資料の＜投資対象ファンドの概要＞に記載される旨。投資対象ファンドはこの1本で、同資料の投資対象ファンドの概要（2026年5月末現在）と組入状況の欄（99.0%）でも同じ名称を確認した。')
    p.docq('vym-ftse-def', 'FTSEハイディビデンド・イールド・インデックスの定義（交付目論見書の文言）', 'svym_P',
           W(r'FTSEハイディビデンド・イールド・インデックスとは、米国株式市場における高配当利回りの銘柄（除く、REIT） で構成される 時価総額加重平均型の株価指数です。'),
           '同じ節のなお書き: 「配当込み、円換算ベース」の指数は、配当込みの指数をもとに委託会社が円換算したもの。REITは指数の対象から除かれる（原文のかっこ書「除く、REIT」）。指数の銘柄数は資料に書かれていない。')
    p.docq('comp-v', 'SBI・V・米国高配当の投資先ETFの業種別の比率（月次レポートが載せる11業種）と上位銘柄（2026年8月31日基準）', 'svym_M',
           W(r'組入上位業種 金融 21\.86％ 情報技術 15\.80％ ヘルスケア 13\.60％ 資本財・サービス 12\.46％.{0,900}?※比率は、投資信託証券（ETF）の純資産総額に対する割合です。'),
           '業種比率はETFの株式評価額に対する割合、銘柄比率はETFの純資産総額に対する割合（同資料の注記を逐語に含めた）。資料が載せる業種の一覧は11業種（合計で約100%）。業種は投資信託証券（ETF）の組入比率に基づく加重平均で、資料はBloomberg等のデータを基に作成と注記している。')
    p.docq('terbrk', '2本の総経費率の内訳（同じ作成対象期間）', 'sspyd_Ak',
           r'総経費率（①＋②） 0\.17％ ①当ファンドの費用の比率 0\.10％ ②投資先ファンドの運用管理費用の比率 0\.07％',
           '交付運用報告書の総経費率の内訳。作成対象期間は2本とも2025年11月21日〜2026年5月20日。',
           extra_doc=[('svym_Ak', r'総経費率（①＋②） 0\.14％ ①当ファンドの費用の比率 0\.08％ ②投資先ファンドの運用管理費用の比率 0\.06％')])
    p.docq('sbi-vym4-etfgap', 'SBI・V・米国高配当（年4回）の投資先ETFの費用は、交付目論見書の概算（年0.04%程度）と交付運用報告書の内訳（0.06%）で数字が違う', 'svym_P',
           r'年0\.04％程度 投 資 信 託 証 券 ＊マザーファンド受益証券を通じて投資するETF（上場投資信託証券）の信託報酬等',
           '交付目論見書の値は「程度」と書かれた概算、交付運用報告書の値は作成対象期間の実績の比率。違いの理由は資料に書かれていないため本文でも書いていない。',
           extra_doc=[('svym_Ak', r'②投資先ファンドの運用管理費用の比率 0\.06％')])
    p.docq('terbrknote', '2本の交付運用報告書の総経費率の内訳に付いた注記（計上期間・概算値）', 'sspyd_Ak',
           r'（注６）①と②の費用は、計上された期間が異なる場合があります。 （注７）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。',
           '同じ注の並びの（注５）は「①の費用は、マザーファンドが支払った費用を含み、投資先ファンドが支払った費用を含みません」、（注８）は「上記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なります」。2本とも同じ注記で、片寄りはない。',
           extra_doc=[('svym_Ak', r'（注６）①と②の費用は、計上された期間が異なる場合があります。 （注７）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。')])
    sa = sum(v for _, v in ra); sb = sum(v for _, v in rb)
    lead = P(perf_lead(p, '結論から言うと、'), one_year_line(p), dd_line(p))
    lead += P(S(p, 'effpair', '投資先ETFの報酬を含む実質的な負担は、SBI・SPDR・S&P500高配当（年4回）が年0.1338%程度、SBI・V・米国高配当（年4回）が年0.1038%程度です。'),
              S(p, 'idxpair', '連動を目指す指数は前者がS&P500高配当指数、後者がFTSEハイディビデンド・イールド・インデックスで、業種の構成が大きく違います。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'idxpair', '<h2 id="mechanism">指数が違う：80銘柄の高配当指数と、FTSEハイディビデンド・イールド</h2>')
    body += P(S(p, 'spyd-etf', 'SBI・SPDR・S&P500高配当（年4回）は、マザーファンドを通じて「State Street SPDRポートフォリオS&P500高配当株式ETF」に投資します。'),
              S(p, 'spyd-80', 'S&P500高配当指数は、米国のS&P500インデックスの採用銘柄のうち配当利回りが高い80銘柄のパフォーマンスを計測する指数です。'))
    body += P(S(p, 'sbi-vym4-index', 'SBI・V・米国高配当（年4回）は、マザーファンドを通じて「バンガード・米国高配当株式ETF」に投資し、FTSEハイディビデンド・イールド・インデックス（配当込み、円換算ベース）への連動を目指します。'),
              S(p, 'vym-ftse-def', 'FTSEハイディビデンド・イールド・インデックスは、米国株式市場における高配当利回りの銘柄（除く、REIT）で構成される時価総額加重平均型の株価指数です。'))
    # 月次レポートが載せる11業種すべて（並びは SBI・SPDR 側の資料の順＝比率の高い順）
    secs = [('不動産', '22.97%', '0.01%'), ('生活必需品', '15.40%', '8.12%'), ('金融', '14.01%', '21.86%'), ('公益事業', '10.30%', '5.12%'),
            ('素材', '7.79%', '3.67%'), ('コミュニケーション・サービス', '5.65%', '3.38%'), ('エネルギー', '5.18%', '9.96%'),
            ('資本財・サービス', '5.09%', '12.46%'), ('一般消費財サービス', '4.87%', '6.01%'),
            ('情報技術', '4.54%', '15.80%'), ('ヘルスケア', '4.22%', '13.60%')]
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">業種（投資先ETF）</th><th scope="col" class="num">SBI・SPDR・S&amp;P500高配当</th><th scope="col" class="num">SBI・V・米国高配当</th></tr></thead><tbody>'
    for n, a_, b_ in secs:
        t += f'<tr><th scope="row">{n}</th><td class="num">{S(p, "comp-spyd", a_)}</td><td class="num">{S(p, "comp-v", b_)}</td></tr>'
    t += '</tbody></table></div>'
    body += t + P(S(p, 'comp-spyd', '表は2本の月次レポートが載せる11業種をすべて並べ、SBI・SPDR・S&P500高配当側の比率が高い順にしています。業種の比率は2026年8月31日時点で、投資先ETFの株式評価額に対する割合です。'),
                  S(p, 'comp-spyd', 'S&P500高配当側は不動産が22.97%で最も大きく、組入1位のアクセンチュアでも1.68%です（組入銘柄の比率は、同じ資料で投資先ETFの純資産総額に対する割合）。'),
                  S(p, 'comp-v', 'FTSEハイディビデンド・イールド側は金融21.86%、情報技術15.80%の順で、組入1位のブロードコムが6.95%です。'),
                  S(p, 'perf', '同じ「米国高配当」でも業種の比率が大きく違うため、実績の差は費用の差だけでは説明できません。' + corr_period(p) + f"{r['同日相関']:.3f}でした。"))
    t2, _, _ = dist_table(p, 'SBI・SPDR', 'SBI・V', ra, rb)
    body += S(p, 'distA', '<h3 id="dist">直近4回の分配金（1万口当たり・税引前）</h3>') + t2
    body += P(S(p, 'settlepair', '2本とも、原則として2・5・8・11月の各20日が決算日です（休業日の場合は翌営業日）。'),
              S(p, 'distA', '分配金は1万口当たりの金額で、基準価額の水準が違う2本の円の金額どうしでは利回りの高低を比べられません。'),
              S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われた金額に相当する分、基準価額は下がります。'),
              S(p, 'distpolicy', '分配金額は収益分配方針に基づいて委託会社が決め、支払われない場合もあります。'),
              S(p, 'perf', '冒頭の比較表の値は、分配金を受け取らずに税引前のまま再投資したと仮定した値です。'))
    body += S(p, 'effpair', '<h2 id="cost-detail">目論見書の料率では国内ファンド分が同じ0.0638%、差は投資先ETFの報酬</h2>')
    body += P(S(p, 'feepair', '信託報酬（国内ファンド分）は2本とも年0.0638%です。'),
              S(p, 'effpair', '投資先ETFの報酬を加えた実質的な負担は年0.1338%程度と年0.1038%程度で、差は年0.03ポイント程度です。100万円を1年間一定額で保有すると仮定した目安は約300円で、実際の利益差ではありません。'))
    body += P(ter_line(p), S(p, 'terbrk', '2本の総経費率は同じ作成対象期間の値で、交付運用報告書が載せる内訳は、SBI・SPDR・S&P500高配当が①当ファンドの費用0.10%と②投資先ファンドの運用管理費用0.07%、SBI・V・米国高配当が①0.08%と②0.06%です。'),
              S(p, 'terbrk', 'この内訳で見ると、総経費率の差0.03ポイントのうち0.02ポイントは当ファンドの費用の差で、投資先ファンドの運用管理費用の差は0.01ポイントです。'),
              S(p, 'terbrknote', 'ただし2本の交付運用報告書とも、①と②の費用は計上された期間が異なる場合があること、投資先ファンドについては運用会社等から入手した概算値を使用している場合があることを注記しています。'),
              S(p, 'sbi-vym4-etfgap', 'SBI・V・米国高配当の投資先ETFの費用は、交付目論見書の年0.04%程度と、交付運用報告書の総経費率の内訳（②投資先ファンドの運用管理費用の比率）の0.06%とで数字が違い、違いの理由は資料に書かれていません。'))
    body += method_section(p)
    body += faq_block(p, [
        ('idxpair', '2本の違いは何ですか？', [('idxpair', '連動を目指す指数が違います。前者はS&P500高配当指数、後者はFTSEハイディビデンド・イールド・インデックスです。'),
                                      ('comp-spyd', '2026年8月31日時点で、前者は不動産が22.97%、後者は金融が21.86%で最も大きい業種です。')]),
        ('effpair', '交付目論見書の料率はどちらが低いですか？',
         [('effpair', '国内ファンド分の信託報酬は2本とも年0.0638%で、投資先ETFの報酬を含めた実質的な負担はSBI・SPDR・S&P500高配当（年4回）が年0.1338%程度、SBI・V・米国高配当（年4回）が年0.1038%程度です。'),
          ('othercost', 'この率には監査報酬などのその他の費用・手数料が含まれず、2本とも、投資者が負担する手数料等の合計額は保有される期間等に応じて異なるため表示できないと交付目論見書に書かれています。費用の総額を比べたものではありません。')]),
        faq_net(p),
        ('perf', '直近1年ではどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の騰落率はSBI・SPDR・S&P500高配当が{pct(one['A累積'])}、SBI・V・米国高配当が{pct(one['B累積'])}でした。開始日によって結果は変わります。"),
    ])
    sections = std_sections('mechanism', '指数が違う：80銘柄の高配当指数と、FTSEハイディビデンド・イールド', '目論見書の料率では国内ファンド分が同じ0.0638%、差は投資先ETFの報酬')
    related = [('../sbi-spyd-vs-rakuten-schd/', 'SBI・SPDR・S&P500高配当 vs 楽天・SCHD', 'S&P500高配当指数とダウ・ジョーンズ US ディビデンド 100 を比べる'),
               ('../rakuten-schd-vs-sbi-vym/', '楽天・SCHD vs SBI・V・米国高配当（年4回）', '米国高配当の別の組み合わせ'),
               ('../haitokin-kakutei-shinkoku/', '配当金と確定申告', '分配金・配当金の税金の扱いを確かめる')]
    return p, title, desc, body, sections, related

# ======================================================================== 3. SPYD vs SCHD
@article
def a_spyd_schd():
    p = Page('sbi-spyd-vs-rakuten-schd', 'sbi-spyd4', 'rakuten-schd', 'sbi-spyd4__rakuten-schd')
    r = p.r_
    one = r['1年窓']
    p.title = title = 'SBI・SPDR・S&P500高配当 vs 楽天・SCHD｜業種・費用・実績を比較'
    desc = (f"SBI・SPDR・S&P500高配当（年4回）と楽天・SCHD（四半期決算型）を{jd(r['起点'])}〜{jd(r['終点'])}・分配金再投資（税引前）で比較。"
            f"100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}（売却前）。投資先ETF分を含む実質的な信託報酬は年0.1338%程度と年0.1238%程度（監査報酬などのその他の費用と、貸付時の報酬は別）です。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    distnav_claims_doc(p, 'sspyd_P')
    ra = last4(dist_rows_sbi('sbi-spyd4', '2025-07-01')); rb = last4(dist_rows_rakuten(p, 'rakuten-schd', '2025-07-01'))
    dist_claim(p, 'distA', 'sbi-spyd4', ra); dist_claim(p, 'distB', 'rakuten-schd', rb)
    pair_claim(p, 'effpair', 'eff', '2本の実質的な信託報酬（投資先ETFの報酬を加味した信託報酬率。その他の費用・貸付時の報酬は含まない）')
    eff_scope(p)
    p.claims['desc']['scope'] = p.claims['perf']['scope'] + '。費用は' + p.claims['effpair']['scope']
    p.claims['desc']['exceptions'] += ' 実質的な信託報酬の範囲: ' + p.claims['effpair']['exceptions']
    pair_claim(p, 'idxpair', 'index', '2本の連動対象・投資先')
    spyd_claims(p)
    p.docq('comp-s', '楽天・SCHDの投資先ETFの銘柄数・上位銘柄（2026年8月末現在）', 'risude_M',
           r'2026年8月末現在 投資銘柄数 投資銘柄数 103.{0,120}?MERCK & CO INC ヘルスケア 4\.8%', 'ETF側の数値（シュワブ・米国配当株式ETF）。月次レポートの基準日を確認。')
    p.docq('nobm', '楽天・SCHDにはベンチマークがない', 'risude_P', r'当ファンドには、 ベンチマークはありません。',
           '無し: 交付目論見書の年間収益率の欄で確認。投資先ETFが指数への連動を目指す点は「投資対象ファンドの概要」で確認した。')
    p.docq('comp-rsec', '楽天・SCHDの投資先ETFの業種別構成比（最大はヘルスケア21.3%・2026年8月末現在）と、比率の分母', 'risude_M',
           r'業種別構成比 業種 比率 ヘルスケア 21\.3% 生活必需品 19\.4%.{0,160}?※ 比率は、ETFの純資産総額に対する各資産の評価額の比率です。',
           '無し: 月次レポートの業種別構成比の表を全9業種（公益事業0.1%まで）読み、最大がヘルスケアであることと分母の注記を確認した。表に載っているのはこの9業種だけで、合計は100%にならない。')
    p.docq('secbase', '2本の業種の比率は分母が違う（SBIは投資信託証券（ETF）の株式評価額、楽天はETFの純資産総額）', 'sspyd_M',
           r'組入上位業種 .動産 22\.97％.{0,200}?※比.は、投資信託証券（ETF）の株式評価額に対する割合です。',
           'SBI側の月次レポートの組入上位業種（11業種）と分母の注記。比較相手: ' + url(FUNDS['rakuten-schd']['M']) + '「※ 比率は、ETFの純資産総額に対する各資産の評価額の比率です。」',
           extra_doc=[('risude_M', r'※ 比率は、ETFの純資産総額に対する各資産の評価額の比率です。')])
    assert '銘柄数' not in text('sspyd_M'), 'sspyd_M now publishes a holdings count: write it instead of the omission note'
    p.claim('nocount', 'SBI・SPDR・S&P500高配当（年4回）の月次レポートには投資先ETFの組入銘柄数の記載が無い',
            url(FUNDS['sbi-spyd4']['M']), Q(*FUNDS['sbi-spyd4']['index_q']), f'{GOT}に確認した{DOCS[FUNDS["sbi-spyd4"]["M"]][1]}',
            '月次レポートの抽出テキスト全文を「銘柄数」で検索して0件であることを生成のたびに assert で確かめている（語が現れたら生成が止まる）。資料にあるのは組入上位10銘柄と組入上位業種で、銘柄数そのものは載っていない。連動対象の指数の構成銘柄数（80銘柄）は交付目論見書に載っているが、ETFの実際の組入銘柄数とは別のものなので置き換えていない。',
            scope='2026年8月31日基準の月次レポートに載っている情報の範囲')
    lead = P(perf_lead(p, '結論から言うと、'), one_year_line(p), dd_line(p))
    lead += P(S(p, 'effpair', '投資先ETFの報酬を加味した実質的な信託報酬は、SBI・SPDR・S&P500高配当（年4回）が年0.1338%程度、楽天・SCHD（四半期決算型）が年0.1238%程度です（楽天・SCHDは投資先ETFの報酬相当額を委託会社が充当するため、交付目論見書の投資先の報酬は年0.0%程度と表示されています）。'),
              S(p, 'effpair', 'この率は信託報酬の部分だけで、監査報酬などのその他の費用と、有価証券の貸付を行った場合に加わる報酬は含みません。'),
              S(p, 'idxpair', '投資先は前者がS&P500高配当指数、後者がダウ・ジョーンズ US ディビデンド 100 インデックスへの連動を目指すETFで、指数が違います。'),
              S(p, 'perf', f'楽天・SCHDの設定日（{jd(r["起点"])}）からの比較で、期間は約2年です。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'idxpair', '<h2 id="mechanism">指数が違う：S&amp;P500高配当指数と、ダウ・ジョーンズ US ディビデンド 100 インデックス</h2>')
    body += P(S(p, 'spyd-80', 'S&P500高配当指数は、S&P500の採用銘柄のうち配当利回りが高い80銘柄で構成される指数です。'),
              S(p, 'comp-spyd', '2026年8月31日時点の投資先ETFは不動産が22.97%で最も大きい業種で、組入1位のアクセンチュアが1.68%です。'))
    body += P(S(p, 'idxpair', '楽天・SCHDはマザーファンドを通じて「シュワブ・米国配当株式ETF」に投資し、このETFはダウ・ジョーンズ US ディビデンド 100 インデックスへの連動を目指します。'),
              S(p, 'nobm', 'ただし楽天・SCHD自体には、交付目論見書上のベンチマークはありません。'),
              S(p, 'comp-s', '投資先ETFの投資銘柄数は103で、最も比率が高いメルクが4.8%です（2026年8月末現在）。'),
              S(p, 'comp-rsec', '業種別構成比では、ヘルスケアが21.3%で最も大きい業種です。'))
    body += P(S(p, 'secbase', '業種の比率は2本で分母が違います。SBI・SPDR側は投資信託証券（ETF）の株式評価額に対する割合、楽天・SCHD側はETFの純資産総額に対する各資産の評価額の比率です。たとえばヘルスケアはSBI・SPDR側が4.22%、楽天・SCHD側が21.3%ですが、分母が違うのでこの差をそのまま読むことはできません。'),
              S(p, 'secbase', 'SBI・SPDR側の月次レポートは、同じ資料の中でも業種を株式評価額に対する割合、組入上位10銘柄を純資産総額に対する割合としています。'),
              S(p, 'nocount', 'また、SBI・SPDR側の月次レポートには投資先ETFの組入銘柄数の記載がないため、銘柄数は2本で並べていません。'))
    body += P(S(p, 'perf', '指数が違うため業種や銘柄の比率が異なり、実績の差は費用の差だけでは説明できません。' + corr_period(p) + f"{r['同日相関']:.3f}でした。"))
    t2, _, _ = dist_table(p, 'SBI・SPDR', '楽天・SCHD', ra, rb)
    body += S(p, 'distA', '<h3 id="dist">直近4回の分配金（1万口当たり・税引前）</h3>') + t2
    body += P(S(p, 'distA', '交付目論見書では、SBI・SPDR・S&P500高配当は原則として2・5・8・11月の各20日、楽天・SCHDは同じ月の各25日が決算日で、休業日の場合は翌営業日です。分配金は1万口当たりの金額で、基準価額の水準が違う2本の円の金額どうしでは利回りの高低を比べられません。'),
              S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われた金額に相当する分、基準価額は下がります。'),
              S(p, 'distpolicy', '分配金額は収益分配方針に基づいて委託会社が決め、支払われない場合もあります。'),
              S(p, 'distA', 'この表の分配金は、実際に支払われた1万口当たりの金額です。'),
              S(p, 'perf', '一方、冒頭の「同じ期間の100万円を、分配金再投資で比べる」の表の評価額と騰落率は、分配金を受け取らずに税引前のまま再投資したと仮定した値です。'))
    body += S(p, 'effpair', '<h2 id="cost-detail">ETFの報酬をどう数えるかで、表示の料率が変わる</h2>')
    body += P(S(p, 'rakuten-schd-eff', '楽天・SCHDの信託報酬は年0.1238%で、投資先ETFで日々差し引かれる年0.06%程度の報酬相当額は、委託会社が合理的に見積ってファンドに充当すると交付目論見書に書かれています。そのため実質的に負担する運用管理費用も年0.1238%程度と表示されています。'))
    body += P(S(p, 'sbi-spyd4-eff', 'SBI・SPDR・S&P500高配当（年4回）は国内ファンド分が年0.0638%で、投資先ETFの年0.07%程度を加味した、投資者が実質的に負担する信託報酬率が年0.1338%程度です。'),
              S(p, 'effpair', 'ここでそろえたのは信託報酬と投資先ETFの報酬（交付目論見書の料率）だけで、監査報酬などのその他の費用と、有価証券の貸付を行った場合に加わる報酬は入っていません。その範囲での差は年0.01ポイント程度で、100万円を1年間一定額で保有すると仮定した目安は約100円です。この金額は実際の利益差ではありません。'))
    body += P(ter_line(p), S(p, 'terpair', '総経費率の対象期間は半年ごとの作成期間で、2本で時期がずれています。'))
    body += schd_ter_detail(p, 'sbi-spyd4')
    body += method_section(p)
    body += faq_block(p, [
        ('effpair', '費用はどちらが低いですか？', '投資先ETFの報酬を加味した実質的な信託報酬は、SBI・SPDR・S&P500高配当（年4回）が年0.1338%程度、楽天・SCHD（四半期決算型）が年0.1238%程度です（楽天・SCHDは投資先ETFの報酬相当額を委託会社が充当する扱いです）。ファンド本体の信託報酬だけを比べると差が違って見えるので、加味する範囲をそろえて読みます。また、この2つの料率には監査報酬などのその他の費用と、有価証券の貸付を行った場合に加わる報酬が入っていません。'),
        ('distA', '分配金の金額が大きい方が利回りも高いのですか？', '言えません。分配金は1万口当たりの金額で、基準価額の水準が違う2本の金額を並べても利回りの比較にはなりません。分配金を再投資した基準価額の比較は表のとおりです。'),
        faq_net(p),
        ('perf', '直近1年の騰落率はそれぞれどれくらいでしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の税引前の分配金を再投資した基準価額による騰落率は、SBI・SPDR・S&P500高配当が{pct(one['A累積'])}、楽天・SCHDが{pct(one['B累積'])}でした。開始日によって結果は変わります。"),
    ])
    sections = std_sections('mechanism', '指数が違う：S&P500高配当指数と、ダウ・ジョーンズ US ディビデンド 100 インデックス', 'ETFの報酬をどう数えるかで、表示の料率が変わる')
    related = [('../rakuten-schd-vs-sbi-vym/', '楽天・SCHD vs SBI・V・米国高配当', '楽天・SCHDをSBIのVYM型と比べる'),
               ('../rakuten-schd-vs-rakuten-vym/', '楽天・SCHD vs 楽天・VYM', '楽天の米国高配当2本を比べる'),
               ('../haitokin-kakutei-shinkoku/', '配当金と確定申告', '分配金・配当金の税金の扱いを確かめる')]
    return p, title, desc, body, sections, related

# ======================================================================== 4. Emerging markets
@article
def a_emg():
    p = Page('emaxis-shinkoukoku-vs-tawara-shinkoukoku', 'emaxis-emg', 'tawara-emg', 'emaxis-emg__tawara-emg')
    r = p.r_
    one = r['1年窓']
    p.title = title = 'eMAXIS Slim新興国株式 vs たわらノーロード新興国株式｜費用と実績を比較'
    desc = (f"同じMSCIエマージング・マーケット・インデックスを使う2本を3年で比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}。"
            "信託報酬0.15180%以内と0.1859%、たわらの換金時の信託財産留保額0.3%も確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pair_claim(p, 'idxpair', 'index', '2本とも同じMSCIエマージング・マーケット・インデックスを対象とする')
    pair_claim(p, 'hedgepair', 'hedge', '2本とも原則として為替ヘッジを行わない')
    p.docq('comp-e', 'eMAXIS Slim新興国株式の組入上位国・銘柄数・1位銘柄（2026年8月31日現在）', 'eemg_M',
           r'1 台湾 26\.6%.{0,80}?2 韓国 20\.1%.{0,80}?3 インド 11\.0%.{0,80}?4 ケイマン諸島 10\.6%.{0,80}?5 中国 9\.0%.{0,600}?組入銘柄数: 1,130銘柄.{0,200}?1 TAIWAN SEMICONDUCTOR MANUFAC 台湾 半導体・半導体製造装置 14\.9%',
           '比率は純資産総額に対する割合。国・地域は原則として法人登録地で分類（同資料の注記）。')
    p.docq('comp-t', 'たわらノーロード新興国株式の組入上位国・銘柄数・1位銘柄（2026年8月31日基準）', 'temg_M',
           r'1 台湾 26\.3.{0,80}?2 韓国 19\.8.{0,80}?3 インド 10\.9.{0,80}?4 ケイマン 10\.4.{0,80}?5 中国 8\.9.{0,1200}?（組入銘柄数 1,193）.{0,120}?14\.7',
           '比率は純資産総額に対する実質的な割合。国・地域は原則として法人登録国または地域（同資料の注記）。')
    p.docq('ryuho', 'たわらノーロード新興国株式は換金時に信託財産留保額0.3%', 'temg_P',
           r'購 入 時 手 数 料 ありません。 換金申込受付日の翌営業日の基準価額に0\.3％の率を乗じて得た額を、換金時にご負担いただ 信託財産留保額 きます。',
           '交付目論見書の費用欄（段組のため見出し「信託財産留保額」が文中に挟まって抽出される）。eMAXIS側は「信託財産留保額 ありません。」。100万円×0.3%＝3,000円は本文で計算した例示。',
           extra_doc=[('eemg_P', r'購入時手数料 ありません。 信託財産留保額 ありません。')])
    p.docq('bmgap', '月次レポートの3年騰落率（ファンドとベンチマーク）', 'eemg_M',
           r'ファンド 9\.6% 0\.6% 10\.5% 50\.8% 101\.9% 178\.4%.{0,120}?ベンチマーク 9\.9% 0\.9% 10\.6% 51\.6% 103\.5% 187\.2%',
           '2026年8月31日基準の各社月次レポートの値。2社のベンチマークの3年騰落率自体が違う（103.5%と106.4%）ため、ファンドとの差どうしを並べて比べられない旨を本文に書いた。',
           extra_doc=[('temg_M', r'3年 101\.3 106\.4 -5\.1')])
    gap_claim(p, 'feegap', 'eMAXISの段階制の最も高い率とたわらの料率の差と100万円あたりの目安')
    d, ds, amt, hi, lo = gap_text(p)
    lead = P(perf_lead(p, '結論から言うと、'), dd_line(p),
             S(p, 'perf', '2本は同じ指数を対象にしており、' + corr_period(p) + f"{r['同日相関']:.4f}でした。"))
    lead += P(fee_line(p), S(p, 'ryuho', 'たわらノーロード新興国株式は換金時に基準価額の0.3%の信託財産留保額がかかり、eMAXIS Slim新興国株式にはありません。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p)
    body += P(S(p, 'ryuho', '表の評価額は換金前の値です。たわらノーロード新興国株式を換金すると、換金申込受付日の翌営業日の基準価額の0.3%（100万円分なら3,000円）が信託財産留保額として差し引かれます。'))
    body += fee_section(p) + fee_note(p)
    body += S(p, 'idxpair', '<h2 id="mechanism">同じ指数、ほぼ同じ国の比率</h2>')
    body += P(S(p, 'idxpair', '2本ともMSCIエマージング・マーケット・インデックス（配当込み、円換算ベース）を対象にしています。eMAXISはこの指数をベンチマークとして連動を目指し、たわらは「円換算ベース、配当込み、為替ヘッジなし」の同じ指数の動きを概ね捉えることを目指すと書いています。'),
              S(p, 'hedgepair', '為替ヘッジは2本とも原則として行いません。'))
    rows = [('台湾', '26.6%', '26.3%'), ('韓国', '20.1%', '19.8%'), ('インド', '11.0%', '10.9%'), ('ケイマン諸島', '10.6%', '10.4%'), ('中国', '9.0%', '8.9%')]
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">' + S(p, 'comp-e', '国・地域（上位5）') + '</th><th scope="col" class="num">eMAXIS Slim</th><th scope="col" class="num">たわら</th></tr></thead><tbody>'
    for n, a_, b_ in rows:
        t += f'<tr><th scope="row">{n}</th><td class="num">{S(p, "comp-e", a_)}</td><td class="num">{S(p, "comp-t", b_)}</td></tr>'
    t += '</tbody></table></div>'
    body += t + P(S(p, 'comp-e', '2026年8月末時点で、eMAXISは1,130銘柄、組入1位のTSMC（台湾）が14.9%です。'),
                  S(p, 'comp-t', 'たわらは1,193銘柄で、TSMCが14.7%です。'))
    body += P(S(p, 'bmgap', '2026年8月31日基準の月次レポートでは、3年の騰落率がeMAXISのファンド101.9%に対しベンチマーク103.5%、たわらのファンド101.3%に対しベンチマーク106.4%です。ベンチマークの値そのものが2社で違うため、ファンドとベンチマークの差どうしを並べて比べることはできません。'))
    body += S(p, 'feegap', f'<h2 id="cost-detail">信託報酬の差は年{ds}ポイント、総経費率は0.24209%と0.34%</h2>')
    body += P(S(p, 'emaxis-emg-fee', 'eMAXIS Slim新興国株式は純資産総額に応じた段階制で、2,500億円未満の部分が年0.15180%、2,500億円以上5,000億円未満の部分が年0.15169%、5,000億円以上の部分が年0.15158%です。'),
              S(p, 'emaxis-emg-tier', '交付目論見書は、純資産総額2,800億円・3,800億円・4,800億円の例で、実質信託報酬率を年0.15179%・0.15177%・0.15175%としています。'),
              S(p, 'tawara-emg-fee', 'たわらノーロード新興国株式は年0.1859%以内で、2026年7月14日現在の率は年0.1859%です。'))
    body += P(S(p, 'feegap', f'eMAXISの段階制で最も高い率（年0.15180%）とたわらの年0.1859%の差は年{ds}ポイントで、100万円を1年間一定額で保有すると仮定した目安は約{amt:,}円です。この金額は実際の利益差ではありません。'),
              ter_line(p), S(p, 'terpair', '2本の対象期間はずれているため、総経費率の差には年度の違いも入ります。'))
    body += method_section(p)
    body += faq_block(p, [
        ('idxpair', '2本は同じ指数ですか？', 'どちらもMSCIエマージング・マーケット・インデックス（配当込み、円換算ベース）を対象にしています。ただし別の投資信託で、信託報酬、総経費率、信託財産留保額、組入銘柄数が違います。'),
        ('ryuho', '換金するときに費用はかかりますか？', 'たわらノーロード新興国株式は、換金申込受付日の翌営業日の基準価額の0.3%が信託財産留保額として差し引かれます。eMAXIS Slim新興国株式の信託財産留保額はありません。購入時手数料は2本ともありません。'),
        faq_net(p),
        ('perf', '直近1年ではどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の騰落率はeMAXIS Slim新興国株式が{pct(one['A累積'])}、たわらノーロード新興国株式が{pct(one['B累積'])}でした。開始日によって結果は変わります。"),
    ])
    sections = std_sections('mechanism', '同じ指数、ほぼ同じ国の比率', f'信託報酬の差は年{ds}ポイント、総経費率は0.24209%と0.34%')
    related = [('../tawara-vs-emaxis-sensinkoku/', 'たわらノーロード先進国株式 vs eMAXIS Slim先進国株式', '先進国株式の同じ組み合わせ'),
               ('../orcan-hikaku/', 'eMAXIS Slimオルカン vs 楽天・プラス・オルカン', '全世界株式の商品差を確かめる'),
               ('../ifreenext-india-vs-rakuten-india/', 'iFreeNEXT インド株 vs 楽天・インド株Nifty50', '新興国の1か国に投資するファンドを比べる')]
    return p, title, desc, body, sections, related

# ======================================================================== 5. Balance 8
@article
def a_bal8():
    p = Page('emaxis-balance8-vs-tawara-balance8', 'emaxis-bal8', 'tawara-bal8', 'emaxis-bal8__tawara-bal8')
    r = p.r_
    one = r['1年窓']
    p.title = title = 'eMAXIS Slimバランス vs たわらノーロードバランス（8資産均等型）｜費用と実績'
    desc = (f"8資産均等型の2本を3年で比較。100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}。"
            "信託報酬は2本とも年0.143%以内。新興国債券の指数と配分の決め方の違いを確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pair_claim(p, 'hedgepair', 'hedge', '2本とも原則として為替ヘッジを行わない')
    p.docq('idx8-e', 'eMAXIS Slimバランスの合成ベンチマークを構成する8指数', 'ebal_P',
           r'東証株価指数 （ＴＯＰＩ Ｘ）（配当込み） 、ＭＳＣＩコクサイ・インデックス （配当込み、円換算ベース） 、ＭＳＣＩエマージン グ・マーケット・インデックス （配当込み、円換算ベース） 、ＮＯＭＵＲＡ－ＢＰ Ｉ総合、ＦＴＳＥ世界国債インデックス （除 く日本、円換算ベース） 、ＪＰモルガンＧＢ Ｉ ‐ＥＭグローバル・ダイバーシファイド （円換算ベース） 、東証ＲＥＩ Ｔ指数 （配当込み） およびＳ＆Ｐ先進国ＲＥ ＩＴインデックス （除く日本、配当込み、円換算ベース） の各対象インデックス （以 下「ベンチマーク」 という場合があります。） を12\.5％ずつ組み合わせた合成指数をいいます。',
           '交付目論見書の「ファンドの特色」。')
    p.docq('idx8-t', 'たわらノーロードバランスの各マザーファンドが連動対象とする指数', 'tbal_P',
           r'マザーファンド 資産クラス マザーファンドが連動対象とするインデックス 国内株式パッシブ・ファンド 国内株式 東証株価指数 （TOPIX） （配当込み）.{0,700}?S&P 先進国 REITインデックス （除く日本、円換算 先進国リート （除く日本） マザーファンド ベース、配当込み、為替ヘッジなし）',
           '交付目論見書の「ファンドの特色」のマザーファンド一覧（段組のため指数名の途中に資産クラス名が挟まって抽出される）。')
    p.docq('gbiem', 'eMAXIS側の新興国債券指数（GBI-EMグローバル・ダイバーシファイド）は現地通貨建て', 'ebal_P',
           r'ＪＰモルガンＧＢ Ｉ ‐ＥＭグローバル・ダイバーシファイドとは、 Ｊ\.Ｐ\.モルガン・セキュリティーズ・エルエルシーが算出し公表し ている指数で、現地通貨建てのエマージング債市場の代表的なインデックスです。',
           'たわら側の指数（JPモルガン・エマージング・マーケット・ボンド・インデックス・プラス）について、交付目論見書に通貨建ての説明は見当たらないため、本文ではたわら側の指数の性質を書いていない。',
           extra_doc=[('tbal_P', r'ＪＰモルガン・エマージング・マー エマージング・マーケット・インデックス （円換算ベース、配当込み、 ケット・ボンド・インデックス・プラス（円換算ベース・為替ヘッジな')])
    p.docq('rebal-t', 'たわらは配分比率が均等から一定以上乖離した場合にリバランスする', 'tbal_P',
           r'２ 各マザーファンドへの投資を通じた各資産クラスの配分比率は、均等とす ることを目標とします。時価変動等により、資産配分比率が均等比率から 一定以上乖離した場合にはリバランスすることとします。',
           '「一定以上」の具体的な幅は交付目論見書に書かれていないため、本文でも幅を書いていない。')
    p.docq('alloc-e', 'eMAXIS Slimバランスの資産構成（2026年8月31日現在）', 'ebal_M',
           r'国内株式 12\.5% 12\.7% 先進国株式（除く日本） 12\.5% 12\.6%.{0,200}?新興国株式 12\.5% 12\.8%.{0,200}?国内債券 12\.5% 11\.4%.{0,300}?先進国債券（除く日本） 12\.5% 12\.5% 新興国債券 12\.5% 12\.4% 国内リート 12\.5% 12\.3% 先進国リート（除く日本） 12\.5% 12\.3%',
           '比率は純資産総額に対する各マザーファンド受益証券の割合（同資料の注記）。左の12.5%は基本資産配分。')
    p.docq('alloc-t', 'たわらノーロードバランスのポートフォリオ構成（2026年8月31日基準）', 'tbal_M',
           r'国内株式ﾊﾟｯｼﾌﾞ･ﾌｧﾝﾄﾞ\(最適化法\)･ﾏｻﾞｰﾌｧﾝﾄﾞ 12\.6.{0,60}?国内債券ﾊﾟｯｼﾌﾞ･ﾌｧﾝﾄﾞ･ﾏｻﾞｰﾌｧﾝﾄﾞ 11\.8.{0,60}?外国株式ﾊﾟｯｼﾌﾞ･ﾌｧﾝﾄﾞ･ﾏｻﾞｰﾌｧﾝﾄﾞ 12\.5.{0,60}?外国債券ﾊﾟｯｼﾌﾞ･ﾌｧﾝﾄﾞ･ﾏｻﾞｰﾌｧﾝﾄﾞ 12\.4.{0,60}?ｴﾏｰｼﾞﾝｸﾞ株式ﾊﾟｯｼﾌﾞ･ﾏｻﾞｰﾌｧﾝﾄﾞ 13\.1.{0,60}?ｴﾏｰｼﾞﾝｸﾞ債券ﾊﾟｯｼﾌﾞ･ﾏｻﾞｰﾌｧﾝﾄﾞ 12\.4.{0,60}?J-REITｲﾝﾃﾞｯｸｽﾌｧﾝﾄﾞ･ﾏｻﾞｰﾌｧﾝﾄﾞ 12\.2.{0,60}?外国ﾘｰﾄ･ﾊﾟｯｼﾌﾞ･ﾌｧﾝﾄﾞ･ﾏｻﾞｰﾌｧﾝﾄﾞ 12\.2',
           '組入比率は純資産総額に対する割合（同資料の注記）。')
    lead = P(perf_lead(p, '結論から言うと、'), dd_line(p),
             S(p, 'perf', '2本とも8つの資産に12.5%ずつ配分することを目標にしており、' + corr_period(p) + f"{r['同日相関']:.4f}でした。"))
    lead += P(fee_line(p),
              S(p, 'gbiem', '違いの1つは新興国債券の指数で、eMAXISは現地通貨建ての新興国債券の指数（JPモルガンGBI-EMグローバル・ダイバーシファイド）、たわらはJPモルガン・エマージング・マーケット・ボンド・インデックス・プラスを使います。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p) + fee_note(p)
    body += S(p, 'idx8-e', '<h2 id="mechanism">8資産の指数と、配分の保ち方</h2>')
    body += P(S(p, 'idx8-e', 'eMAXIS Slimバランスは、TOPIX（配当込み）、MSCIコクサイ・インデックス、MSCIエマージング・マーケット・インデックス、NOMURA-BPI総合、FTSE世界国債インデックス（除く日本）、JPモルガンGBI-EMグローバル・ダイバーシファイド、東証REIT指数（配当込み）、S&P先進国REITインデックス（除く日本）を12.5%ずつ組み合わせた合成ベンチマークへの連動を目指します。'),
              S(p, 'idx8-t', 'たわらノーロードバランスは、各マザーファンドがそれぞれの指数に連動を目指し、国内株式・国内債券・先進国株式・先進国リートなど7つの資産は同じ名前の指数です。'),
              S(p, 'gbiem', '新興国債券だけは指数が違い、eMAXIS側の交付目論見書はGBI-EMグローバル・ダイバーシファイドを「現地通貨建てのエマージング債市場の代表的なインデックス」と説明しています。たわら側はJPモルガン・エマージング・マーケット・ボンド・インデックス・プラス（円換算ベース・為替ヘッジなし）です。'))
    body += P(S(p, 'rebal-t', 'たわらの交付目論見書は、各資産の配分比率を均等にすることを目標とし、時価の変動などで均等比率から一定以上離れた場合にリバランスすると書いています。'),
              S(p, 'hedgepair', '為替ヘッジは2本とも原則として行いません。'))
    rows = [('国内株式', '12.7%', '12.6'), ('先進国株式（除く日本）', '12.6%', '12.5'), ('新興国株式', '12.8%', '13.1'), ('国内債券', '11.4%', '11.8'),
            ('先進国債券（除く日本）', '12.5%', '12.4'), ('新興国債券', '12.4%', '12.4'), ('国内リート', '12.3%', '12.2'), ('先進国リート（除く日本）', '12.3%', '12.2')]
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">' + S(p, 'alloc-e', '資産（2026年8月末）') + '</th><th scope="col" class="num">eMAXIS Slim</th><th scope="col" class="num">たわら</th></tr></thead><tbody>'
    for n, a_, b_ in rows:
        t += f'<tr><th scope="row">{n}</th><td class="num">{S(p, "alloc-e", a_)}</td><td class="num">{S(p, "alloc-t", b_ + "%")}</td></tr>'
    t += '</tbody></table></div>'
    body += t + P(S(p, 'alloc-e', '比率は純資産総額に対する各マザーファンドの割合で、残りは現金等です。'),
                  S(p, 'perf', 'この比較期間ではeMAXISの累積騰落率がたわらを上回りましたが、新興国債券の指数の違い、配分のずれ、費用のどれがどれだけ効いたかを資料から特定することはできません。'))
    body += S(p, 'feepair', '<h2 id="cost-detail">信託報酬は同じ年0.143%、総経費率は0.17056%と0.17%</h2>')
    body += P(S(p, 'emaxis-bal8-fee', 'eMAXIS Slimバランスは純資産総額に応じた段階制で、2,500億円未満の部分が年0.14300%、2,500億円以上5,000億円未満の部分が年0.14289%、5,000億円以上の部分が年0.14278%です。'),
              S(p, 'emaxis-bal8-tier', '交付目論見書は、純資産総額4,000億円・5,000億円・6,000億円の例で、実質信託報酬率を年0.14296%・0.14295%・0.14292%としています。'),
              S(p, 'tawara-bal8-fee', 'たわらノーロードバランスは年0.143%以内で、2026年7月14日現在の率は年0.143%です。'))
    body += P(ter_line(p), S(p, 'terpair', '2本の対象期間はずれており、eMAXISは小数第5位まで、たわらは小数第2位までの表示です。'))
    body += method_section(p)
    body += faq_block(p, [
        ('gbiem', '2本は同じ指数に連動していますか？', '8資産のうち7資産は同じ名前の指数ですが、新興国債券の指数が違います。eMAXISはJPモルガンGBI-EMグローバル・ダイバーシファイド、たわらはJPモルガン・エマージング・マーケット・ボンド・インデックス・プラスです。'),
        ('feepair', '信託報酬はどちらが低いですか？', '交付目論見書の信託報酬は2本とも年0.143%以内です。eMAXISは純資産総額に応じた段階制で、たわらは2026年7月14日現在で年0.143%です。'),
        faq_net(p),
        ('perf', '直近1年ではどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の騰落率はeMAXIS Slimバランスが{pct(one['A累積'])}、たわらノーロードバランスが{pct(one['B累積'])}でした。開始日によって結果は変わります。"),
    ])
    sections = std_sections('mechanism', '8資産の指数と、配分の保ち方', '信託報酬は同じ年0.143%、総経費率は0.17056%と0.17%')
    related = [('../emaxis-shinkoukoku-vs-tawara-shinkoukoku/', 'eMAXIS Slim新興国株式 vs たわらノーロード新興国株式', '同じ2社の新興国株式を比べる'),
               ('../tawara-vs-emaxis-sensinkoku/', 'たわらノーロード先進国株式 vs eMAXIS Slim先進国株式', '同じ2社の先進国株式を比べる'),
               ('../../toushi/tsumitate/', '積立シミュレーター', '積立額と期間から将来額の目安を計算します')]
    return p, title, desc, body, sections, related
