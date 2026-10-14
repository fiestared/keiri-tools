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

# 2026-10-07: 楽天・VYM の表は段組で「差益 所得税および地方税 および償還時 （譲渡益）」と割れ、NISA は「つみたて投資枠」も併記、「譲渡 所得」で改行が入る
TAXQ = (r'以下の表は、 ?個人投資者の源泉徴収時の税率であり、 ?課税方法(?:など|等)により異なる場合があります。.{0,260}?差益(?: 所得税および地方税 および償還時 )?（譲渡益） ?に対して20\.315[％%]',
        r'(?:本|当)ファンドは、 ?NISAの ?「成長投資枠（特定非課税管理勘定）」 ?(?:および ?「つみたて投資枠（特定 ?累積投資勘定）」 ?)?の対象ですが、 ?販売会社に ?より.{0,12}?取扱いが異なる場合があります。',
        r'NISA.{0,140}?一定の額を上限として、 ?毎年、 ?一定額の範囲で新たに購入した ?公募株式投資信託などから生じる配当所得(?:及び|および)譲渡 ?所得が ?無期限で非課税となります。.{0,140}?一 ?定の条件に該 ?当する方が対象となります。',
        r'\x07?外国税額控除の適用となった場合には、 ?分配時の税金が上記と異なる場合があります。',
        r'\x07?法人の場合は、?上記と?は?異なります。',
        r'上記は、?2026年[0-9]+月末日?現在のものです。 ?税法が改正された場合等には、 ?税率等が変更される場合があります。')

def tax_asof(p):
    """The as-of date printed under the prospectus tax table (e.g. 2026年4月末). Both funds must agree."""
    import re as _re
    ds = {k: _re.search(r'2026年[0-9]+月末日?', Q(FUNDS[k]['P'], TAXQ[-1])).group(0) for k in (p.a, p.b)}
    if len(set(ds.values())) == 1:
        return next(iter(ds.values()))
    return '、'.join(f'{FUNDS[k]["short"]}は{d}' for k, d in ds.items())  # 2026-10-07: 日付が違うときはどちらの資料かを書く

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
            url(da), qs[p.a][0], f'{GOT}に確認した交付目論見書',
            ('（SBIの抽出テキストは段組のため、成長投資枠の文の途中に欄見出し「課 税 関 係」が挟まる。）' if 'SBI' in FUNDS[p.a]['name'] + FUNDS[p.b]['name'] else '') + '同じ節・同じ欄の例外を全件（本文の計算条件の節とFAQに書いた）: 源泉徴収時の税率で課税方法などにより異なる場合がある／外国税額控除の適用となった場合は分配時の税金が異なる場合がある／法人の場合は異なる／税法改正等で税率等が変わる場合がある（資料の時点）／NISAの成長投資枠の取扱いは販売会社により異なる場合がある／NISAは非課税口座の開設など一定の条件に該当する方が対象。'
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

def ter_line(p, cond=''):
    A, B = p.A, p.B
    pair_claim(p, 'terpair', 'ter', f'{A["short"]}と{B["short"]}の総経費率と対象期間')
    ta = f"{A['ter']}（{A['ter_period']}）" if A['ter'] else f"未掲載（{A['ter_period']}）"
    tb = f"{B['ter']}（{B['ter_period']}）" if B['ter'] else f"未掲載（{B['ter_period']}）"
    return S(p, 'terpair', f"直近の運用報告書の作成対象期間について年率換算した総経費率（参考値{cond}）は、{A['short']}が{ta}、{B['short']}が{tb}です。")

def fee_note(p):
    """Notes under the fee table: what TER excludes, where each TER value is printed, and fund-specific conditions."""
    A, B = p.A, p.B
    h = P(S(p, 'feehead', '総経費率には、原則として購入時手数料、売買委託手数料、有価証券取引税が含まれません。対象期間と、含まれる費用の範囲をそろえて読む必要があります。'))
    fs = [(k, FUNDS[k]) for k in (p.a, p.b)]
    pk = [k for k, f in fs if f['ter'] and f.get('ter_doc', 'P') == 'P']
    if pk:
        other = ''.join(f' 比較相手: {url(FUNDS[k]["P"])}「{Q(FUNDS[k]["P"], r"[（〈]参考情報[）〉]\s?ファンドの総経費率.{0,40}")}」' for k in pk[1:])
        def _q(d, pat):  # 2026-10-13: 三菱UFJの交付目論見書には「参考」の注が無く、交付運用報告書は「（注）前記の前提条件…」の形（従来のページの出力は変わらない）
            try: return f'{url(d)}「{Q(d, pat)}」'
            except ValueError: return None
        ref = ' / '.join(x for x in (_q(FUNDS[k][d], pat) for k in pk for d, pat in (
            ('P', W(r'※\x07?これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なります。')),
            ('Ak', W(r'（注[0-9０-９]*）\x07?[上前]記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比 ?率とは異なり ?ます。'))) if FUNDS[k].get(d)) if x)
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
        _pnote = all(_q(FUNDS[k]['P'], W(r'※\x07?これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なります。')) for k in pk)
        srcs.append(S(p, 'tersrc', '交付目論見書・交付運用報告書とも、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なると注記しています。' if _pnote else
                      '交付運用報告書は、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なると注記しています。'))
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
    if all(f.get('lend_kind') == 'other' for k, f in fs) and A['lend_rate'] == B['lend_rate']:
        ca = p.claims[p.fc(p.a, 'lend')]; cb = p.claims[p.fc(p.b, 'lend')]
        p.claim('lendpair', f'{A["short"]}と{B["short"]}の交付目論見書の貸付有価証券関連報酬（その他の費用・手数料）', ca['source_url'], ca['source_quote'], ca['applies'],
                ca['exceptions'] + f' 比較相手: {cb["source_url"]}「{cb["source_quote"]}」')
        lend = [S(p, 'lendpair', f'2本の交付目論見書はどちらも、その他の費用・手数料のひとつに貸付有価証券関連報酬を挙げ、有価証券の貸付取引を行った場合は、投資信託財産の収益となる品貸料に{A["lend_rate"]}を乗じて得た額としています。')]
    else:
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
        return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書は、有価証券の貸付の指図を行った場合、ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の{f["lend_rate"]}以内の額が運用管理費用（信託報酬）に追加されると定めています' + (f'（{f["lend_now"]}）' if f.get('lend_now') else '') + '。')
    if f.get('lend_kind') == 'tawara':
        if short:
            return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書には、マザーファンドで有価証券の貸付の指図を行った場合に、品貸料の一部が信託報酬に加わる定めがあります（2026年7月14日現在は品貸料の49.5%（税抜45%）以内）。')
        return S(p, f'{k}-lend', f'{f["short"]}の交付目論見書は、投資対象とするマザーファンドで有価証券の貸付の指図を行った場合、マザーファンドの品貸料のうちファンドに属するとみなした額に55%未満（税抜50%）の率を乗じた額を運用管理費用（信託報酬）に含めると定めており、2026年7月14日現在の率は品貸料の49.5%（税抜45%）以内です。')
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
    return S(p, f'{k}-effnote', getattr(p, 'effnote_override', {}).get(k, f['effnote']))  # 2026-10-10: ページ単位で文を差し替え（公開済みページの生成結果を動かさない）


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
            'sbi-schd4': ('sschd_Ak', r'総経費率（①＋②） 0\.13％ ①当ファンドの費用の比率 0\.07％ ②投資先ファンドの運用管理費用の比率 0\.06％', '0.13%', '当ファンドの費用の比率0.07%、投資先ファンドの運用管理費用の比率0.06%'),
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

def faq_net(p, tax_lead='課税口座では違います。'):
    if not all(FUNDS[k].get('nofee_val', 'なし／なし') == 'なし／なし' for k in (p.a, p.b)):
        return ('method', '表の評価額は売却して受け取れる金額ですか？',
                '違います。税引前の分配金を再投資した基準価額で計算した売却前の金額です。購入時・換金時の手数料や投資者ごとの税金は含みません。基準価額に反映済みの信託報酬を二重に引いてもいません。')
    head = ([(tax_pair(p), f'{tax_lead}税引前の分配金を再投資した基準価額で計算した売却前の金額で、普通分配金と換金時の差益（譲渡益）にかかる税金（交付目論見書の{tax_asof(p)}現在の記載で、個人の源泉徴収時の税率で20.315%。課税方法などにより異なる場合があり、外国税額控除の適用となった場合は分配時の税金が異なる場合があり、法人の場合は異なります）は含みません。'),
             (tax_pair(p), '2本ともNISAの成長投資枠の対象で（販売会社により取扱いが異なる場合があります）、非課税口座の開設など一定の条件に該当する方がNISAを利用した場合は、一定の額を上限として毎年一定額の範囲で新たに購入した分から生じる配当所得と譲渡所得が非課税です。')]
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

# ======================================================================== 6. Rakuten Plus SOX vs Rakuten Plus NASDAQ-100 (2026-10-06)
@article
def a_sox_ndx():
    p = Page('rakuten-sox-vs-rakuten-nasdaq', 'rakuten-sox', 'rakuten-ndx', 'rakuten-sox__rakuten-ndx')
    r = p.r_
    one = r['1年窓']
    for k in (p.a, p.b):
        for d in (FUNDS[k]['P'], FUNDS[k]['Ak'], FUNDS[k]['M']):
            p.src(d)
    p.src('nq_sox'); p.src('nq_ndx')
    p.title = title = '楽天・プラス・SOX vs 楽天・プラス・NASDAQ-100｜費用・指数の中身・実績を比較'
    desc = (f"楽天・プラス・SOXと楽天・プラス・NASDAQ-100を比較。{jd(r['起点'])}〜{jd(r['終点'])}の分配金再投資の実績と最大下落率、"
            "信託報酬（税込年率・貸付時の報酬を除く）はSOXが年0.176%・NASDAQ-100が年0.198%、指数の銘柄数と比率の上限を交付目論見書と指数算出方法書で確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pk_a, tr_a = peak_trough({d: v for d, v in p.series[p.a].items() if r['起点'] <= str(d) <= r['終点']})
    pk_b, tr_b = peak_trough({d: v for d, v in p.series[p.b].items() if r['起点'] <= str(d) <= r['終点']})
    # --- index definitions (issuer prospectus) and index rules (index provider)
    p.docq('sox-def', 'SOXインデックスの定義（米国上場の主要な半導体関連30銘柄）', 'rirsox_P',
           r'「ＳＯＸインデックス」は正式名称を「PHLX Semiconductor SectorTM Index」 ?といい、米国上場の ?主要な半導体関連30銘柄で構成されている株価指数です。',
           '同じ欄に「フィラデルフィア半導体株指数」とも呼ばれ、半導体の設計や製造、流通、販売などを手掛ける銘柄で構成される旨。円換算ベースは委託会社が日々の為替レートを乗じて算出したもの（同資料）。',
           extra_doc=[('rirsox_P', r'「フィラデルフィア半導体株指数」 ?とも呼ばれており、半導体の設計や製造、流通、販売などを手掛け ?る銘柄で構成されています。')])
    p.docq('ndx-def', 'Nasdaq-100インデックスの定義（ナスダック上場・時価総額の大きい金融を除く100社）', 'rirndx_P',
           r'「Ｎａｓｄａｑ－１００インデックス」 ?は、米国のナスダック市場に上場している銘柄のうち、時価総額 ?の大きい金融を除く100社の株式で構成される株価指数です。',
           '指数提供者の算出方法書では、時価総額上位の会社が一時的に追加されて100銘柄を超える場合がある（Fast Entry）。本文の指数の節に書いた。円換算ベースは委託会社が日々の為替レートを乗じて算出したもの（同資料）。')
    p.claims['ndx-def']['exceptions'] += ' 根拠: ' + url('nq_ndx') + '「' + Q('nq_ndx', r'A Fast Entry inclusion will not require the removal of another security, and may ?temporarily increase the constituent count to more than 100\.') + '」'
    p.docq('nq-sox-sel', 'SOX指数の銘柄の選び方（米国上場の半導体関連で時価総額の大きい30銘柄、年1回の入れ替え）', 'nq_sox',
           r'An index reconstitution is conducted annually based on the Reconstitution Reference Date\. The Index selects the 30 largest eligible securities by market capitalization\.',
           '同じ算出方法書の条件: 米国の取引所に上場（A security must be listed on a U.S. exchange）、ICBの半導体（Semiconductors）または製造装置（Production Technology Equipment）のサブセクター、ADRも対象で国・地域の要件は無い、時価総額1億ドル以上・流動性・上場期間などの要件。入れ替えの適用は9月の第3金曜日の翌取引日。本文は「米国の取引所に上場」「ADRも対象」「主な条件」と範囲を書いた。',
           extra_doc=[('nq_sox', r'Security types generally eligible for the Index include common stocks, ordinary shares, ?American Depositary Receipts \(ADRs\)'),
                      ('nq_sox', r'The security must be classified under the Semiconductors Subsector or Production Technology ?Equipment Subsector'),
                      ('nq_sox', r'At market open on the first trading day after the Reconstitution Effective Dates third Friday in September')])
    p.docq('nq-sox-w', 'SOX指数の比率の上限（上位3銘柄は12%・10%・8%、ほかは4%。四半期ごとに調整）', 'nq_sox',
           r'The weights of the top three \(3\) Index Securities by market capitalization, may not exceed 12%, ?10%, 8%, respectively\..{0,200}?The individual weights of other Index Securities may not exceed 4%; only the top three \(3\) may ?exceed this constraint\.',
           '上限は四半期ごとのリバランス（Rebalance）で当てる値で、次のリバランスまでの間は株価の動きで比率が上限を上回ることがある（算出方法書は四半期ごとに調整すると書き、日々の上限維持は書いていない）。本文では「四半期ごとの調整で当てる上限」と書き、月次レポートの比率（2026年8月31日）が上限を上回っていることと矛盾しない旨を書いた。超過分は時価総額の小さい銘柄へ配分し直す。',
           extra_doc=[('nq_sox', r'An index rebalance is conducted quarterly based on the Rebalance Reference Date\.'),
                      ('nq_sox', r'The Index is a modified market capitalization-weighted index\.')])
    p.docq('nq-ndx', 'Nasdaq-100指数の銘柄の選び方と見直しの時期（修正時価総額加重、12月に年次見直し、3・6・9月にリバランス）', 'nq_ndx',
           r'The Nasdaq-100 Index® \(the “Index”\) is designed to measure the performance of 100 of the largest ?Nasdaq-listed non-financial companies\. The Index employs a modified market capitalization weighting ?scheme\.',
           '同じ算出方法書: 年次の見直し（Annual Reconstitution & Rebalance）は12月、リバランスは3・6・9月。比率が一定の水準を超えた場合に会社単位・銘柄単位で下げる多段階の調整があり、条件つきのため本文には数値を書かず「詳細は算出方法書」とした。REITは対象外。時価総額上位40に入る銘柄は臨時に追加され、銘柄数が一時的に100を超えることがある。',
           extra_doc=[('nq_ndx', r'An Annual Reconstitution & Rebalance is conducted in December'),
                      ('nq_ndx', r'A Rebalance is conducted in March, June, and September\.')])
    p.docq('nq-sox-cal', 'SOX指数の入れ替えは9月、リバランスは3・6・9・12月（第3金曜日の翌取引日の取引開始時に適用）', 'nq_sox',
           r'At market open on the first trading day after the Reconstitution Effective Dates third Friday in September',
           '定期の入れ替え以外の除外・補充（Deletion Policy / Replacement Policy）: 「' + Q('nq_sox', r'If, at any time other than an index reconstitution, Nasdaq determines that an Index Security has or will ?undergo a fundamental alteration that would make it ineligible for index inclusion, the Index Security is ?removed as soon as practicable\.') + '」「' + Q('nq_sox', r'The ?issuer with the largest market capitalization which is not in the Index and meets all security eligibility ?criteria will replace the deleted security\.') + '」。' +
'同じ表のリバランスの適用日（Rebalance Effective Dates）は3・6・9・12月の第3金曜日の翌取引日の取引開始時。基準日（Reference Date）は入れ替えが7月の最終取引日、リバランスが2・5・8・11月の最終取引日。抽出テキストは2段組のため表の行見出しが文の途中に挟まる。',
           extra_doc=[('nq_sox', r'At market open on the first trading day after the Rebalance Effective Dates third Friday in March, June, September, and')])
    p.docq('nq-sox-old', 'SOX指数の比率の上限は2024年4月22日に変わり、それ以前は全銘柄8%以下・4%超は上位5銘柄までの2段階', 'nq_sox',
           r'4/22/2024 Constituent SOX employs a two-stage weight',
           '算出方法書の付録A（METHODOLOGY CHANGE LOG）の 4/22/2024 の行。Previous 欄に Stage 1「No Index Security weight may exceed 8%.」、Stage 2「For Index Securities with the five largest market capitalizations, Stage 1 weights are maintained.」「For all other Index Securities, no weight may exceed 4%.」。抽出テキストは3段組で行が交互に混ざるため、source_quote は行の先頭だけにした。同じ表の 7/6/2026 の行は上場取引所の要件の変更（本文の「米国の取引所に上場」は変更後の定め）。',
           extra_doc=[('nq_sox', r'• No Index Security weight may.{0,120}?exceed 8% of the index; five may.{0,120}?exceed 4%\.'), ('nq_sox', r'• For all other Index Securities, no.{0,160}?weight may exceed 4%\.')])
    p.docq('nq-ndx-sp', 'Nasdaq-100指数の臨時リバランス（1社24%超、または4.5%超の会社の合計48%超で）', 'nq_ndx',
           r'A Special Rebalance may be triggered, if either of the following weighting constraints are breached, ?based on end-of-day \(EOD\) values: • No company.s weight may exceed 24%\. • The aggregate weight of the companies whose weights exceed 4\.5% may not exceed 48%\.',
           '同じ節: 臨時リバランスの適用日・基準日は事前に公表され、3・6・9月のリバランスの節にある会社単位の調整の手順に従う。本文は「行われることがあります」と書き、必ず行うとは書いていない。')
    p.docq('nq-ndx-w', 'Nasdaq-100指数の年次見直しの比率の調整（当初比率24%超の会社があるとき1社20%以下、4.5%超の会社の合計48%以上なら40%へ、ほかに銘柄単位の調整）', 'nq_ndx',
           r"If any company.s initial weight exceeds 24%: Company-Level Weighting Constraints Stage 1: The weights are adjusted such that no company.s weight exceeds 20%\. Stage 2: Any resulting company weights that exceed 4\.5% are added together\. If the sum of ?those weights is 48% or greater, then that group of companies will have its aggregate weight ?adjusted down to 40%\.",
           '同じ節の続き: 銘柄単位（Security-Level）の調整（当初比率15%超の銘柄があれば14%以下、上位5銘柄の合計が40%以上なら38.5%へ等）。会社単位の調整は「当初の比率が24%を超える会社がある場合」の条件つきで、本文は条件ごと書き、銘柄単位は「銘柄単位の調整を重ねる」とだけ書いた。3・6・9月のリバランスにも別の定めがある。')
    # --- holdings (issuer monthly report, mother-fund basis, 2026-08-31)
    p.docq('comp-sox', '楽天・プラス・SOXのマザーファンドの投資銘柄数・資産の内訳・業種・上位10銘柄（2026年8月31日）', 'rirsox_M',
           r'投資銘柄数 31 株式 93\.9% 投資信託証券 4\.8% 短期金融資産等 1\.3% 合計 100\.0% 株式先物 1\.4% 業種別構成比 業種 比率 情報技術 93\.9%.{0,80}?組入上位10銘柄 銘柄 業種 比率 NVIDIA CORP 情報技術 13\.1%.{0,400}?KLA CORPORATION 情報技術 3\.9% ※ 比率は、マザーファンドの純資産総額に対する各資産の評価額の比率です。',
           '比率はマザーファンドの純資産総額比。業種別構成比はETF・先物を含まない（同資料の注記）。上位10銘柄にはETF（ISHARES SEMICONDUCTOR ETF 4.8%）が含まれ、本文の表にも載せた。投資銘柄数31にETFを数えているかは資料に書かれていない。')
    p.docq('comp-ndx', '楽天・プラス・NASDAQ-100のマザーファンドの投資銘柄数・資産の内訳・業種・上位10銘柄（2026年8月31日）', 'rirndx_M',
           r'投資銘柄数 103 株式 93\.9% 投資信託証券 4\.9% 短期金融資産等 1\.3% 合計 100\.0% 株式先物 1\.4% 業種別構成比 業種 比率 情報技術 54\.6% コミュニケーション・サービス 12\.7% 一般消費財・サービス 10\.1%.{0,200}?組入上位10銘柄 銘柄 業種 比率 NVIDIA CORP 情報技術 7\.9%.{0,500}?BROADCOM INC 情報技術 2\.6% ※ 比率は、マザーファンドの純資産総額に対する各資産の評価額の比率です。',
           '比率はマザーファンドの純資産総額比。業種別構成比はETF・先物を含まない。上位10銘柄にはETF（INVESCO QQQ TRUST SERIES 1 4.9%）が含まれ、ALPHABET INC が2行（3.0%と2.8%、株式の種類が違うと見られるが資料に種類の記載は無い）ある。本文の表は資料の行どおりに載せた。')
    p.claim('top10', '2026年8月31日の上位10銘柄（ETFを含む）の比率の合計：SOXは60.4%、NASDAQ-100は45.7%', url('rirsox_M'),
            p.claims['comp-sox']['source_quote'], f'{GOT}に確認した月次レポート（2026年8月31日作成基準）',
            'マザーファンドの純資産総額に対する比率を、月次レポートの上位10行（ETFの行を含む）について足した値。比較相手: ' + url('rirndx_M') + '「' + p.claims['comp-ndx']['source_quote'] + '」',
            scope='2本の月次レポート（2026年8月31日作成基準）の組入上位10銘柄の比率（マザーファンドの純資産総額比）の合計。ETFの行を含む。指数そのものの比率ではない')
    p.claim('overlap', '2026年8月31日の上位10銘柄のうち、2本に共通するのはNVIDIA・BROADCOM・MICRON TECHNOLOGYの3銘柄', url('rirsox_M'),
            p.claims['comp-sox']['source_quote'], f'{GOT}に確認した月次レポート（2026年8月31日作成基準）',
            '2本の上位10銘柄を名前で照合した。上位10より下の保有は月次レポートからは分からないため、本文では「上位10銘柄の中で」と範囲を書いた。比較相手: ' + url('rirndx_M') + '「' + p.claims['comp-ndx']['source_quote'] + '」',
            scope='2本の月次レポート（2026年8月31日作成基準）の組入上位10銘柄の名前の重なり。上位10より下の保有は含まない')
    p.docq('mf-etf', '2本のマザーファンドは、連動性を保つためにETFと株価指数先物取引を使うことがある', 'rirsox_P',
           r'マザーファンドにおいては、ベンチマークとの連動性を維持するため、米国株式の指数との連動をめ ?ざすETF（上場投資信託証券）、米国株式の指数を対象とした株価指数先物取引を利用することが ?あります。',
           '2本の交付目論見書に同じ文。同じ欄に、投資信託財産の規模や資金流出入の規模によってはETFや株価指数先物取引への投資割合が相対的に大きくなることがある旨。比較相手: ' + url('rirndx_P') + '「'
           + Q('rirndx_P', r'マザーファンドにおいては、ベンチマークとの連動性を維持するため、米国株式の指数との連動をめ ?ざすETF（上場投資信託証券）、米国株式の指数を対象とした株価指数先物取引を利用することが ?あります。') + '」')
    p.docq('fut-sox', '楽天・プラス・SOXの交付目論見書の運用実績（2026年4月30日現在）では、株式先物（2.2%）はNASDAQ-100株価指数先物', 'rirsox_P',
           r'株式先物 2\.2% ※当ファンドの純資産総額に対し、楽天･SOXインデックス･マザーファンドを100\.0％組入れています。 ※投資比率は、 ?マザーファンドの純資産総額に対する各資産の評価額の比率です。 ※業種は、GICS\(世界産業分類基準\)による分類です。 ※株式先物は、NASDAQ-100 株価指数先物です。',
           '交付目論見書の「運用実績（2026年4月30日現在）」の欄。2026年8月31日の月次レポートの株式先物1.4%については先物の種類の記載が無いため、本文では2026年4月30日現在と時点を限って書いた。')
    p.claims['fut-sox']['exceptions'] += ' 時点: 「' + Q('rirsox_P', r'2026年4月30日現在 ※過去の実績を示したものであり、将来の成果を示唆・保証するものではありません。') + '」'
    p.docq('dist0', '2本とも、2024年10月と2025年10月の決算の分配金は0円（1万口当たり・税引前）', 'rirsox_M',
           r'分配金（税引前、1万口当たり） 設定来分配金合計額 0 円 決算期 2024年10月 2025年10月 2026年10月 分配金 0 円 0 円 - 円',
           '同じ欄の注記: 分配金実績は将来の分配金の水準を示唆・保証するものではない／分配金は分配方針に基づいて委託会社が決定し、分配を行わない場合もある。比較相手: ' + url('rirndx_M') + '「'
           + Q('rirndx_M', r'分配金（税引前、1万口当たり） 設定来分配金合計額 0 円 決算期 2024年10月 2025年10月 2026年10月 分配金 0 円 0 円 - 円') + '」')
    p.docq('distpolicy', '分配金は委託会社が決定し、必ず分配を行うものではない', 'rirsox_P',
           r'収益分配金額は、委託会社が基準価額水準、市況動向等を勘案して決定します。ただし、必ず分配を行うも ?のではありません。',
           '比較相手の交付目論見書にも同じ文がある（全文検索で確認）。')
    pair_claim(p, 'settlepair', 'settle', '2本の決算頻度と決算日')
    pair_claim(p, 'hedgepair', 'hedge', '2本とも為替ヘッジは原則として行わない')
    ci = p.claims[p.fc(p.a, 'incept')]
    p.claim('period', f'比較期間（2本の設定日{jd(r["起点"])}〜{jd(r["終点"])}）の長さ', ci['source_url'], ci['source_quote'], ci['applies'],
            ci['exceptions'] + ' 2本とも設定日は同じ。終点は月末に固定した（本文の計算条件）。期間の長さは暦日数から計算した値。',
            scope=f'この記事の比較期間（{jd(r["起点"])}〜{jd(r["終点"])}）の長さ')
    gap_claim(p, 'feegap', '2本の信託報酬の差と100万円あたりの目安')
    d, ds, amt, hi, lo = gap_text(p)
    # --- lead
    lead = P(perf_lead(p, '結論から言うと、'), one_year_line(p), dd_line(p), S(p, 'perf', 'いずれも過去の実績で、将来の成果を示すものではありません。'))
    lead += P(S(p, 'feepair', f"信託報酬（税込年率・ファンド本体、有価証券の貸付を行った場合の報酬を除く）は{p.A['short']}が{p.A['fee']}、{p.B['short']}が{p.B['fee']}です。"),
              S(p, 'sox-def', '連動を目指す指数が違い、SOXインデックスは米国上場の主要な半導体関連30銘柄、'),
              S(p, 'ndx-def', 'Nasdaq-100インデックスは米国のナスダック市場に上場している時価総額の大きい金融を除く100社で構成されます（交付目論見書の説明）。'),
              S(p, 'period', f'比較期間は、2本の設定日（{jd(r["起点"])}）から{jd(r["終点"])}までの約2年8か月です。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p)
    body += P(S(p, 'perf', f"楽天・プラス・SOXの最大下落率（{pct(r['A最大下落率'])}）は{jd(str(pk_a))}の高値から{jd(str(tr_a))}の安値まで、楽天・プラス・NASDAQ-100の最大下落率（{pct(r['B最大下落率'])}）は{jd(str(pk_b))}の高値から{jd(str(tr_b))}の安値までで、どちらも比較期間（{jd(r['起点'])}〜{jd(r['終点'])}）の分配金再投資基準価額で測った値です。"),
              S(p, 'perf', f"{corr_period(p)}{r['同日相関']:.2f}で、同じ日に同じ方向へ動くことが多かった一方、この期間の累積騰落率と最大下落率の大きさはどちらもSOXのほうが大きくなりました。"))
    body += fee_section(p) + fee_note(p)
    body += S(p, 'sox-def', '<h2 id="mechanism">指数の中身：半導体30銘柄か、金融を除く100社か</h2>')
    body += P(S(p, 'nq-sox-sel', '指数を算出するNasdaqの指数算出方法書によると、SOX指数は米国の取引所に上場する半導体・半導体製造装置の銘柄から、時価総額の大きい30銘柄を年1回選びます（ADRも対象で、主な条件は時価総額・売買高・上場期間など）。'),
              S(p, 'nq-sox-w', 'SOX指数は修正時価総額加重で、四半期ごとの調整では、時価総額の上位3銘柄の比率の上限を順に12パーセント・10パーセント・8パーセント、それ以外の銘柄の上限を4パーセントとし、超えた分をほかの銘柄へ配り直します。'),
              S(p, 'nq-sox-cal', 'SOX指数の定期の銘柄の入れ替えは年1回9月、比率の調整は3・6・9・12月で、適用はその月の第3金曜日の翌取引日の取引開始時です。'),
              S(p, 'nq-sox-cal', '合併などで条件を満たさなくなった銘柄は定期の入れ替えを待たずに除かれ、条件を満たす時価総額の最も大きい銘柄が加わります。'),
              S(p, 'nq-sox-old', 'この比率の上限は2024年4月22日からの定めで、それ以前は、どの銘柄も8パーセントまで、4パーセントを超えてよいのは時価総額の上位5銘柄までという2段階の上限でした。'),
              S(p, 'nq-ndx', '同じ算出方法書によると、Nasdaq-100指数はナスダック上場の金融を除く大型100社の修正時価総額加重で、定期の見直しは12月の年次の入れ替え・リバランスと、3・6・9月のリバランスです。'),
              S(p, 'nq-ndx-sp', 'このほか、日々の終値で1社の比率が24パーセントを超えるか、4.5パーセントを超える会社の比率の合計が48パーセントを超えた場合には、臨時のリバランス（Special Rebalance）が行われることがあります。'),
              S(p, 'nq-ndx-w', 'Nasdaq-100指数の12月の年次見直しでは、当初の比率が24パーセントを超える会社があるときに、1社を20パーセント以下にし、4.5パーセントを超える会社の比率の合計が48パーセント以上なら40パーセントまで下げるといった会社単位の調整と、銘柄単位の調整を重ねる定めがあります（詳細は算出方法書）。'),
              S(p, 'ndx-def', '時価総額の大きい銘柄が臨時に加わり、銘柄数が一時的に100を超える場合があります。'))
    body += P(S(p, 'comp-sox', '2026年8月31日時点の月次レポート（マザーファンドの純資産総額比）では、楽天・プラス・SOXの投資銘柄数は31、業種別構成比は情報技術が93.9%です。'),
              S(p, 'comp-ndx', '同じ2026年8月31日時点の楽天・プラス・NASDAQ-100の投資銘柄数は103で、業種別構成比は情報技術54.6%、コミュニケーション・サービス12.7%、一般消費財・サービス10.1%の順です（2本とも業種別構成比にETFと先物は含みません）。'))
    sox_rows = [('NVIDIA CORP', '13.1%'), ('BROADCOM INC', '8.8%'), ('MICRON TECHNOLOGY INC', '8.2%'), ('ISHARES SEMICONDUCTOR ETF', '4.8%'), ('MARVELL TECHNOLOGY INC', '4.5%'),
                ('ASML HOLDING NV', '4.5%'), ('APPLIED MATERIALS INC', '4.4%'), ('TAIWAN SEMICONDUCTOR MANUFACTURING', '4.2%'), ('LAM RESEARCH CORP', '4.0%'), ('KLA CORPORATION', '3.9%')]
    ndx_rows = [('NVIDIA CORP', '7.9%'), ('APPLE INC', '7.0%'), ('MICROSOFT CORP', '5.7%'), ('INVESCO QQQ TRUST SERIES 1', '4.9%'), ('MICRON TECHNOLOGY INC', '4.4%'),
                ('AMAZON COM INC', '4.3%'), ('ADVANCED MICRO DEVICES INC', '3.1%'), ('ALPHABET INC', '3.0%'), ('ALPHABET INC', '2.8%'), ('BROADCOM INC', '2.6%')]
    t = ('<div class="scroll-wrap"><table><thead><tr><th scope="col">' + S(p, 'comp-sox', '順位（2026年8月31日）') + '</th><th scope="col">' + S(p, 'comp-sox', '楽天・プラス・SOXの上位10銘柄（2026年8月31日）') + '</th><th scope="col" class="num">' + S(p, 'comp-sox', '楽天・プラス・SOXのマザーファンドでの比率（2026年8月31日・純資産総額比）')
         + '</th><th scope="col">' + S(p, 'comp-ndx', '楽天・プラス・NASDAQ-100の上位10銘柄（2026年8月31日）') + '</th><th scope="col" class="num">' + S(p, 'comp-ndx', '楽天・プラス・NASDAQ-100のマザーファンドでの比率（2026年8月31日・純資産総額比）') + '</th></tr></thead><tbody>')
    for i, ((na, va), (nb, vb)) in enumerate(zip(sox_rows, ndx_rows), 1):
        t += f'<tr><th scope="row">{S(p, "comp-sox", f"{i}位")}</th><td>{S(p, "comp-sox", na)}</td><td class="num">{S(p, "comp-sox", va)}</td><td>{S(p, "comp-ndx", nb)}</td><td class="num">{S(p, "comp-ndx", vb)}</td></tr>'
    t += '</tbody></table></div>'
    body += t
    body += P(S(p, 'top10', '2026年8月31日の上位10銘柄（ETFの行を含む）の比率を足すと、楽天・プラス・SOXは60.4%、楽天・プラス・NASDAQ-100は45.7%です（どちらもマザーファンドの純資産総額比）。'),
              S(p, 'overlap', '2026年8月31日の上位10銘柄の中で2本に共通するのは、NVIDIA・BROADCOM・MICRON TECHNOLOGYの3銘柄です。'),
              S(p, 'comp-sox', '月次レポートの比率はマザーファンドの純資産総額に対する比率で、指数の中の比率そのものではありません。'),
              S(p, 'nq-sox-w', 'SOX指数の比率の上限は、算出方法書では四半期ごとの調整の時点で当てる値として書かれています。'),
              S(p, 'comp-sox', '2026年8月31日の上位10銘柄にあるISHARES SEMICONDUCTOR ETFとINVESCO QQQ TRUST SERIES 1は株式ではなくETFです。'),
              S(p, 'mf-etf', '2本のマザーファンドは、指数との連動性を保つためにETFや株価指数先物取引を使うことがあると交付目論見書に書かれています。'),
              S(p, 'fut-sox', '楽天・プラス・SOXの交付目論見書の運用実績（2026年4月30日現在）では、マザーファンドの株式先物2.2%はNASDAQ-100株価指数先物と注記されています。'))
    body += P(S(p, 'hedgepair', '為替ヘッジは2本とも原則として行わないため、円換算した値動きには為替の変動も含まれます。'))
    body += S(p, 'feegap', '<h2 id="cost-detail">信託報酬（税込）の差と、分配金の実績</h2>')
    body += P(S(p, 'feegap', f'交付目論見書の信託報酬（税込年率、貸付時の報酬を除く）は楽天・プラス・SOXが年0.176%、楽天・プラス・NASDAQ-100が年0.198%で、差は年{ds}ポイントです。'),
              S(p, 'feegap', f'100万円を1年間一定額で保有すると仮定した信託報酬の差の目安は、100万円×年{ds}%で約{amt:,}円（税込）で、実際の利益差ではありません。'),
              ter_line(p), S(p, 'terpair', '2本の総経費率は同じ作成対象期間（2024年10月16日〜2025年10月15日）の参考値です。'))
    body += P(S(p, 'feegap', f'この比較期間の実績の差は信託報酬（税込）の差（年{ds}ポイント）よりはるかに大きく、費用の差では説明できません。'), S(p, 'perf', '2本は連動を目指す指数が違い、実績の差は主に指数の値動きの違いから生じていますが、どの業種・銘柄がどれだけ効いたかはこの記事の資料からは分けられません。'))
    body += P(S(p, 'settlepair', '決算は2本とも年1回で、交付目論見書の決算日は原則として毎年10月15日（休業日の場合は翌営業日）です。'),
              S(p, 'dist0', '月次レポート（2026年8月31日作成基準）では、2本とも2024年10月と2025年10月の決算の分配金が0円（1万口当たり・税引前）です。'),
              S(p, 'distpolicy', '分配金は委託会社が基準価額水準や市況動向などを考えて決め、必ず分配を行うものではありません。'))
    assert '確定拠出' not in text('rirsox_P') and '確定拠出' in text('rirndx_P')
    p.docq('dc-ndx', '楽天・プラス・NASDAQ-100の交付目論見書の税金の欄には確定拠出年金の資産管理機関等についての記載があり、楽天・プラス・SOXの交付目論見書には無い', 'rirndx_P',
           r'※受益者が確定拠出年金法に規定する資産管理機関および国民年金基金連合会等の場合は、所得税、復興特別所得税および地方税がかかりません。 なお、確定拠出年金制度の加入者については、確定拠出年金の積立金の運用にかかる税制が適用されます。',
           '楽天・プラス・SOXの交付目論見書（使用開始日2026年7月16日）の抽出テキスト全文を「確定拠出」で検索して0件（生成のたびに assert で確認）。記載の有無は、どの確定拠出年金の商品一覧に入っているかを示すものではないため、本文では商品一覧で確かめる必要があると書いた。')
    body += P(S(p, 'dc-ndx', '楽天・プラス・NASDAQ-100の交付目論見書の税金の欄には、受益者が確定拠出年金法に規定する資産管理機関や国民年金基金連合会等の場合は所得税・復興特別所得税・地方税がかからないという記載があり、楽天・プラス・SOXの交付目論見書にはこの記載がありません。'),
              S(p, 'dc-ndx', 'この記載は、どの確定拠出年金（iDeCoや企業型）で選べるかを示すものではないため、加入している制度の商品一覧で確かめる必要があります。'))
    body += method_section(p)
    body += faq_block(p, [
        ('sox-def', 'SOX指数は、ナスダックの大型株の指数に含まれる半導体株だけを集めたものですか？', [('sox-def', '違います。SOXインデックスは米国上場の主要な半導体関連30銘柄で構成されます。'),
                                                                   ('nq-sox-sel', '指数算出方法書の条件は米国の取引所への上場で、ナスダック上場に限らず、ADRも対象です。'),
                                                                   ('overlap', '2026年8月31日の上位10銘柄で2本に共通するのは、NVIDIA・BROADCOM・MICRON TECHNOLOGYの3銘柄です。')]),
        ('feepair', '信託報酬はどちらが低いですか？', [('feepair', '交付目論見書の信託報酬（税込年率、貸付時の報酬を除く）は楽天・プラス・SOXが年0.176%、楽天・プラス・NASDAQ-100が年0.198%です。'),
                                              ('terpair', '総経費率（2024年10月16日〜2025年10月15日の作成対象期間の参考値）は楽天・プラス・SOXが0.20%、楽天・プラス・NASDAQ-100が0.21%です。')]),
        faq_net(p),
        ('perf', '直近の年間騰落率はどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の税引前分配金再投資ベースの騰落率は楽天・プラス・SOXが{pct(one['A累積'])}、楽天・プラス・NASDAQ-100が{pct(one['B累積'])}でした。開始日によって結果は変わり、過去の実績は将来の成果を示しません。"),
    ])
    sections = std_sections('mechanism', '指数の中身：半導体30銘柄か、金融を除く100社か', '信託報酬（税込）の差と、分配金の実績')
    related = [('../rakuten-sp-vs-rakuten-nasdaq/', '楽天・プラス・S&P500 vs 楽天・プラス・NASDAQ-100', '同じ楽天・プラスのS&P500と比べる'),
               ('../rakuten-nasdaq-vs-sbi-nasdaq/', '楽天・プラス・NASDAQ-100 vs SBI NASDAQ100', '同じ指数の別の運用会社と比べる'),
               ('../../toushi/tsumitate/', '積立シミュレーター', '積立額と期間から将来額の目安を計算します')]
    return p, title, desc, body, sections, related

# ======================================================================== 2026-10-07. SPYD vs Rakuten VYM
@article
def a_spyd_rvym():
    p = Page('sbi-spyd-vs-rakuten-vym', 'sbi-spyd4', 'rakuten-vym', 'sbi-spyd4__rakuten-vym')
    r = p.r_
    one = r['1年窓']
    p.title = title = 'SBI・SPDR・S&P500高配当 vs 楽天・VYM｜分配金・指数・費用・実績を比較'
    desc = (f"SBI・SPDR・S&P500高配当（年4回）と楽天・VYMを{jd(r['起点'])}〜{jd(r['終点'])}・分配金再投資（税引前）で比較。"
            f"100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}（売却前）。"
            "年4回決算（分配しない場合あり）と第9期（2026年7月15日決算）まで分配金0円の違い、入れ替えの7営業日前の価格で80銘柄を均等加重にする設計の指数（入れ替え時点でも値動きで均等からずれる）と時価総額加重の指数の違いも確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    distnav_claims_doc(p, 'sspyd_P')
    ra = last4(dist_rows_sbi('sbi-spyd4', '2025-07-01'))
    dist_claim(p, 'distA', 'sbi-spyd4', ra)
    sa = sum(v for _, v in ra)
    pair_claim(p, 'effpair', 'eff', '2本の実質的な信託報酬（投資先ETFの報酬を加味した信託報酬率。その他の費用・貸付時の報酬は含まない）')
    eff_scope(p)
    p.claims['effpair']['exceptions'] += (' 楽天・VYMの同じ費用欄の注（FAQにも書いた）: 「＊1 2026年2月末現在。今後、投資内容等によりこの数値は変動します。」（投資先の報酬）、'
        '「＊2 …実質的な信託報酬の概算値です。この値は目安であり、実際の投資信託証券の組入状況、運用状況によって変動します。」（rivuh_P）')
    p.claims['desc']['scope'] = p.claims['perf']['scope']
    pair_claim(p, 'idxpair', 'index', '2本の連動対象・投資先')
    pair_claim(p, 'settlepair', 'settle', '2本の決算頻度と決算日')
    spyd_claims(p)
    p.docq('spyd-etf', 'SBI・SPDR・S&P500高配当（年4回）がマザーファンドを通じて投資する投資対象ファンド（ETF）の名称', 'sspyd_P',
           W(r'マザーファンド受益証券は、ETF（上場投資信託証券） を主要投資対象とします。.{0,200}?投資対象ファンドの名称 State Street SPDRポートフォリオS&P500高配当株式ETF'),
           '同じ節のただし書・注: 投資対象ファンドへの実質投資割合は「原則として高位を維持します」、詳細は同資料の＜投資対象ファンドの概要＞に記載される旨。投資対象ファンドはこの1本。')
    # 指数提供者の算出方法書（S&P DJI）。80銘柄・均等加重・1月と7月の年2回の入れ替え
    p.docq('sp-eq', 'S&P500高配当指数は、年2回（1月・7月の最終営業日の取引終了後に有効）の定期入れ替えのたびに80銘柄を均等加重にする設計（比率は有効日の7営業日前の価格で決めるため、入れ替え時点でも値動きで均等からずれる）', 'spdji_hd',
           r'Constituent Weightings\. At each rebalancing, constituents are equal weighted\.',
           '同じ算出方法書の「Rebalancing」の節: 「The indices rebalance semi-annually, effective after the close of the last business day of January and July. The rebalancing reference dates are the last business days of December and June, respectively.」'
           '同じ節の例外: 株数は入れ替えの有効日の7営業日前の価格で決めるため、入れ替え時点の実際の比率は値動きで均等からずれる（「the actual weight of each stock at the rebalancing differs from these weights due to market movements」）。'
           '入れ替えの間は値動きで比率が変わる。銘柄の追加はスピンオフを除き入れ替え時だけ。毎月の配当の見直し（Monthly Dividend Review）で、無配・減配などの銘柄が入れ替え日を待たずに除かれることがある。'
           '銘柄の選び方は、予想年間配当利回りの順に上位64位は自動で採用、既存の構成銘柄は96位以内なら残す（バッファ）。本文では「均等」「年2回」と、例外（値動きでずれる・毎月の見直しで除かれることがある）を同じ段落に書いた。',
           extra_doc=[('spdji_hd', r'The indices rebalance semi-annually, effective after the close of the last business day of January and July\.'),
                      ('spdji_hd', r'Since index shares are assigned based on prices prior to the rebalancing effective date, the actual weight of each stock at the rebalancing differs from these weights due to market movements\.'),
                      ('spdji_hd', r'Monthly Dividend Review Index constituents are reviewed monthly for ongoing eligibility\.')])
    p.claims['sp-eq']['scope'] = 'S&P Dow Jones Indices の S&P High Dividend Indices Methodology（2026年10月7日に取得した版）に書かれた S&P500高配当指数の構成方法。ETF・ファンドの実際の保有比率ではない'
    p.docq('ftse-def', 'FTSEハイディビデンド・イールド・インデックスは、米国株式市場の高配当利回りの銘柄を対象とし、REITを除く銘柄で構成される時価総額加重平均型の株価指数', 'rivuh_P',
           r'「FTSEハイディビデンド・イールド・インデックス」は、米国株式市場における高配当利回りの銘柄 ?を対象とし、REITを除く銘柄で構成される時価総額加重平均型の株価指数です。',
           '同じ節のなお書き: 「FTSEハイディビデンド・イールド・インデックス（円換算ベース）」は、委託会社が指数に日々の為替レートを乗じて算出したもの。指数の銘柄数・見直しの時期は交付目論見書・交付運用報告書・月次レポートに書かれていない（本文にもその旨を書いた）。')
    assert not any(w in text(d) for d in ('rivuh_P', 'rivuh_Ak', 'rivuh_M') for w in ('リバランス', '入れ替え', '入替')), 'rivuh now mentions index review timing: write it'
    p.claim('ftse-noreview', '楽天・VYMの交付目論見書・交付運用報告書・月次レポートには、FTSEハイディビデンド・イールド・インデックスの銘柄の見直しの時期の記載が無い',
            url('rivuh_P'), Q('rivuh_P', r'「FTSEハイディビデンド・イールド・インデックス」は、米国株式市場における高配当利回りの銘柄 ?を対象とし、REITを除く銘柄で構成される時価総額加重平均型の株価指数です。'),
            f'{GOT}に確認した楽天・VYMの交付目論見書・交付運用報告書・月次レポート',
            '3資料の抽出テキスト全文を「リバランス」「入れ替え」「入替」で検索して0件であることを生成のたびに assert で確かめている（語が現れたら生成が止まる）。指数提供者（FTSE Russell）の指数ルール文書は、2026年10月7日に推定したURLがいずれも404で取得できず、この記事では見直しの時期を書いていない。',
            scope='楽天・VYMの運用会社の3資料（2026年10月7日に確認）に書かれている範囲')
    p.docq('rvym-etf', '楽天・VYMはマザーファンドを通じて「バンガード・米国高配当株式ETF」を実質的な主要投資対象とする', 'rivuh_P',
           r'◆ バンガードが運用する ｢バンガード ・米国高配当株式ETF｣を実質的な主要投資対象とします。',
           '同じ節の注: ファミリーファンド方式で運用。資金動向・市況動向等に急激な変化が生じたとき等は上記の運用ができない場合がある（月次レポートの特色の注記）。')
    p.docq('comp-rv', '楽天・VYMの投資先ETFの投資銘柄数（604）・組入上位銘柄・業種別構成比（2026年7月末現在、ICB基準）', 'rivuh_M',
           r'※ 当ページの内容は作成基準日の前月の数値です。 2026年7月末現在 投資銘柄数 投資銘柄数 604.{0,700}?※ 業種は、業種分類ベンチマーク（ICB）基準による分類です。',
           '月次レポート（2026年8月31日作成基準）の投資先ETFのページは前月末（2026年7月末）の数値。比率はETFの純資産総額、業種別構成比は組入株式に対する評価額の比率（同じ注記）。業種はICB基準の分類で、SBI側の月次レポートの業種名・分母（ETFの株式評価額）とは違うため、本文で業種を行どうしで並べていない。四捨五入のため合計が100%にならない場合がある（同じ注記）。')
    p.claims['comp-rv']['scope'] = '楽天・VYMの投資先ETF（バンガード・米国高配当株式ETF）の2026年7月末現在の数値（楽天投信の月次レポート）'
    assert '銘柄数' not in text('sspyd_M'), 'sspyd_M now publishes a holdings count: write it instead of the omission note'
    p.claim('nocount', 'SBI・SPDR・S&P500高配当（年4回）の月次レポートには投資先ETFの組入銘柄数の記載が無い',
            url(FUNDS['sbi-spyd4']['M']), Q(*FUNDS['sbi-spyd4']['index_q']), f'{GOT}に確認した{DOCS[FUNDS["sbi-spyd4"]["M"]][1]}',
            '月次レポートの抽出テキスト全文を「銘柄数」で検索して0件であることを生成のたびに assert で確かめている。連動対象の指数の構成銘柄数（80銘柄）は交付目論見書に載っているが、ETFの実際の組入銘柄数とは別のものなので置き換えていない。',
            scope='2026年8月31日基準の月次レポートに載っている情報の範囲')
    p.docq('vym0', '楽天・VYMの分配金は第9期（2026年7月15日決算）まで0円（設定来分配金合計0円）', 'rivuh_Ak', r'期 末：32,813円（既払分配金0円）',
           '交付運用報告書の最近5期の表で期間分配金合計がすべて0円、月次レポート（2026年8月31日作成基準）の設定来分配金合計額も0円であることを確認。将来の分配を約束・否定するものではない（分配金額は委託会社が決定し、必ず分配を行うものではない）。',
           extra_doc=[('rivuh_Ak', r'期間分配金合計（税込） （円） － 0 0 0 0 0'), ('rivuh_M', r'設定来分配金合計額 0 円')])
    p.claims['vym0']['scope'] = '楽天・VYMの第9期（2026年7月15日決算）までの分配金（1万口当たり・税引前）。将来の分配は含まない'
    p.docq('rvym-policy', '楽天・VYMの決算は毎年7月15日（休業日の場合は翌営業日）で、収益分配方針に基づき分配を行うが、必ず分配を行うものではない', 'rivuh_P',
           r'決 算 日 毎年7月15日 （ただし、休業日の場合は翌営業日） 毎決算時に、原則として収益分配方針に基づき分配を行います。 ただし、必ず分配を行うも のではありません。',
           '同じ欄の注: 「分配金受取コース」と「分配金再投資コース」があり、取扱いのコースとコース名は販売会社により異なる場合がある。分配方針の欄: 収益分配額は委託会社が基準価額水準、市況動向等を勘案して決定。')
    p.docq('terbrk', '2本の総経費率の内訳（交付運用報告書。作成対象期間は2本で違う）', 'sspyd_Ak',
           r'総経費率（①＋②） 0\.17％ ①当ファンドの費用の比率 0\.10％ ②投資先ファンドの運用管理費用の比率 0\.07％',
           '交付運用報告書の総経費率の内訳。作成対象期間はSBI・SPDRが2025年11月21日〜2026年5月20日、楽天・VYMが2025年7月16日〜2026年7月15日。2本とも、①と②の費用は計上された期間が異なる場合がある・投資先ファンドは運用会社等より入手した概算値を使用している場合がある旨の注記がある。',
           extra_doc=[('rivuh_Ak', r'総経費率（①＋②） 0\.22% ①このファンドの費用の比率 0\.16% ②投資先ファンドの運⽤管理費⽤等の⽐率 0\.06%')])
    p.docq('rakuten-vym-etfchg', '楽天・VYMの投資先ETFの管理報酬等（年0.04%）は2026年2月2日付で変更された後の値', 'rivuh_P',
           r'0\.04%＊ 米国高配当株式ETF グループ・インク 目指す ＊2026年2月2日付で変更されました。',
           '交付目論見書の「投資対象ファンドの概要」の表（段組のため抽出テキストでは語順が入れ替わる）。変更前の率は資料に書かれていないため本文にも書いていない。総経費率の内訳0.06%は交付運用報告書の作成対象期間の実績で、変更日より前の期間を含む。',
           extra_doc=[('rivuh_Ak', r'（作成対象期間 2025年7月16日～2026年7月15日）'), ('rivuh_P', r'※上記の内容は、今後変更になる場合があります。')])
    p.docq('terbrknote', '2本の交付運用報告書の総経費率の内訳に付いた注記（計上期間・概算値）', 'rivuh_Ak',
           r'（注6）このファンドの費用と投資先ファンドの費用は、計上された期間が異なる場合があります。 （注7）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。',
           '同じ注の並びの（注8）は「上記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なります」。SBI・SPDR側の交付運用報告書にも同じ趣旨の（注６）（注７）がある。',
           extra_doc=[('sspyd_Ak', r'（注６）①と②の費用は、計上された期間が異なる場合があります。 （注７）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。')])
    p.docq('opcaveat', '2本の交付目論見書の運用方針の留保（資金動向・市況動向の急変時や投資信託財産の規模によっては運用ができない場合がある）', 'sspyd_P',
           r'資金動向、市況動向の急激な変化が生じたとき等ならびに投資信託財産の規模によっては、上記の運用ができない ?場合があります。',
           '楽天・VYM側は同じ文に「やむを得ない事情が発生した場合」も挙げている（本文は両方に共通する部分を書いたうえで、楽天・VYMだけのこの条件を次の文に書いた）。同じ節で運用ができない場合として挙げているのはこれで全部。',
           extra_doc=[('rivuh_P', r'資金動向、市況動向等に急激な変化が生じたとき等ならびに投資信託財産の規模によっては、 ?また、 ?やむを得ない事情が発生した場 ?合には、上記の運用ができない場合があります。')])
    gap_claim(p, 'effgap', '2本の実質的な信託報酬（交付目論見書の概算）の差と、100万円を1年間一定額で保有すると仮定した目安', 'eff')
    lead = P(perf_lead(p, '結論から言うと、'), one_year_line(p), dd_line(p))
    lead += P(S(p, 'distA', f'分配のしかたが違います。SBI・SPDR・S&P500高配当（年4回）は年4回決算で、直近4回（{jd(ra[0][0].replace("/", "-"))}〜{jd(ra[-1][0].replace("/", "-"))}の決算）の分配金は1万口当たり合計{sa:,}円（税引前）でした。'),
              S(p, 'vym0', '楽天・VYMは年1回決算で、第9期（2026年7月15日決算）まで分配金は0円です。'),
              S(p, 'idxpair', '連動を目指す指数も違い、前者はS&P500高配当指数（配当込み、円換算ベース）、後者はFTSEハイディビデンド・イールド・インデックス（円換算ベース）です。'),
              S(p, 'effpair', '投資先ETFの報酬を加味した実質的な信託報酬（税込年率）は、交付目論見書の概算でSBI・SPDR・S&P500高配当（年4回）が年0.1338%程度（投資先ETFの報酬は2026年5月末現在の値）、楽天・VYMが年0.172%程度（投資先ETFの報酬は2026年2月末現在の値）で、投資先の報酬の変更や組入状況などで変わり、監査報酬などのその他の費用と、有価証券の貸付を行った場合の報酬は含みません。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p) + fee_section(p, labels={
        'eff': '投資先ETF等を加味した実質的な信託報酬（税込年率・交付目論見書の概算で、投資先の報酬の変更や組入状況などで変わる。その他の費用と貸付時の報酬を除く）',
        'ter': '総経費率（年率換算の参考値。原則として購入時手数料・売買委託手数料・有価証券取引税を含まない。ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合がある）',
        'hedge': '為替ヘッジ（交付目論見書の運用方針。資金動向や市況動向に急激な変化が生じたときや投資信託財産の規模によってはこの運用ができない場合があり、楽天・VYMはやむを得ない事情が発生した場合も同じ）'},
        vals={('sbi-spyd4', 'eff'): '年0.1338%程度（投資先ETF年0.07%程度を含む。投資先ETFの報酬は2026年5月末現在）',
              ('rakuten-vym', 'eff'): '年0.172%程度（投資先ETF年0.04%程度を含む。投資先ETFの報酬は2026年2月末現在）',
              ('sbi-spyd4', 'ter'): '0.17%（作成対象期間2025/11/21〜2026/5/20）',
              ('rakuten-vym', 'ter'): '0.22%（作成対象期間2025/7/16〜2026/7/15）'}) + fee_note(p)
    body += S(p, 'idxpair', '<h2 id="mechanism">指数が違う：80銘柄の均等加重を目指す設計か、時価総額の大きさで持つか</h2>')
    body += P(S(p, 'spyd-etf', 'SBI・SPDR・S&P500高配当（年4回）は、交付目論見書の運用方針では、マザーファンドを通じて「State Street SPDRポートフォリオS&P500高配当株式ETF」に投資します（資金動向や市況動向に急激な変化が生じたときや投資信託財産の規模によっては、この運用ができない場合があります）。'),
              S(p, 'spyd-80', 'S&P500高配当指数は、米国のS&P500インデックスの採用銘柄のうち配当利回りが高い80銘柄のパフォーマンスを計測する指数です。'),
              S(p, 'sp-eq', '指数提供者の算出方法書では、1月と7月の最終営業日の取引終了後に有効となる年2回の入れ替えのたびに、80銘柄を均等の比率にする設計ですが、比率は入れ替えの有効日の7営業日前の価格で決めるため、入れ替えの時点でも値動きで均等からずれ、その後も値動きでずれていきます。'),
              S(p, 'sp-eq', '無配・減配などの銘柄は、毎月の見直しで入れ替えを待たずに除かれることがあります。'))
    body += P(S(p, 'rvym-etf', '楽天・VYMは、交付目論見書の運用方針では、マザーファンドを通じて「バンガード・米国高配当株式ETF」を実質的な主要投資対象とします（資金動向や市況動向に急激な変化が生じたときや投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、この運用ができない場合があります）。'),
              S(p, 'opcaveat', '運用ができない場合として、2本の交付目論見書はどちらも資金動向や市況動向に急激な変化が生じたときや投資信託財産の規模によってはを挙げ、楽天・VYMの交付目論見書はこれに加えて、やむを得ない事情が発生した場合も挙げています。'),
              S(p, 'ftse-def', 'FTSEハイディビデンド・イールド・インデックスは、米国株式市場における高配当利回りの銘柄を対象とし、REITを除く銘柄で構成される時価総額加重平均型の株価指数です。'),
              S(p, 'ftse-noreview', 'この指数の銘柄の見直しの時期は、楽天・VYMの交付目論見書・交付運用報告書・月次レポートには書かれていません。'))
    body += P(S(p, 'comp-spyd', '2026年8月31日時点のSBI・SPDR側の投資先ETFは、業種では不動産が22.97%で最も大きく（ETFの株式評価額に対する割合）、組入1位のアクセンチュアでも1.68%です（ETFの純資産総額に対する割合）。'),
              S(p, 'comp-rv', '楽天・VYMの投資先ETFは2026年7月末現在で投資銘柄数が604、組入1位のブロードコムが7.3%（ETFの純資産総額に対する比率）で、業種別構成比（組入株式に対する比率・ICB基準）は金融21.3%が最も大きい業種です。'),
              S(p, 'comp-rv', '2本の月次レポートは業種の分類の基準・時点が違うため、この記事では業種を行どうしで並べていません。'),
              S(p, 'nocount', 'また、SBI・SPDR側の月次レポートには投資先ETFの組入銘柄数の記載がないため、銘柄数も2本で並べていません。'))
    body += P(S(p, 'perf', '指数の作り方と業種の比率が大きく違うため、実績の差は費用の差だけでは説明できません。' + corr_period(p) + f"{r['同日相関']:.3f}でした。"))
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">回（古い順）</th><th scope="col">決算日（SBI・SPDR）</th><th scope="col" class="num">' + S(p, 'distA', '分配金（1万口当たり・税引前）') + '</th></tr></thead><tbody>'
    for n_, (da, va) in enumerate(ra, 1):
        t += f'<tr><th scope="row">{S(p, "distA", f"{n_}回目")}</th><td>{S(p, "distA", jd(da.replace("/", "-")))}</td><td class="num">{S(p, "distA", f"{va:,}円")}</td></tr>'
    t += f'<tr><th scope="row">合計</th><th scope="row">{S(p, "distA", "4回の合計（SBI・SPDR）")}</th><td class="num">{S(p, "distA", f"{sa:,}円")}</td></tr></tbody></table></div>'
    body += S(p, 'distA', '<h3 id="dist">分配金：年4回決算の分配の実績と、第9期まで0円</h3>') + t
    body += P(S(p, 'sbi-spyd4-settle', 'SBI・SPDR・S&P500高配当（年4回）の決算日は、原則として2・5・8・11月の各20日です（休業日の場合は翌営業日）。'),
              S(p, 'rvym-policy', '楽天・VYMの決算日は毎年7月15日（休業日の場合は翌営業日）で、収益分配方針に基づき分配を行いますが、必ず分配を行うものではありません。'),
              S(p, 'vym0', '楽天・VYMの交付運用報告書（第9期・2026年7月15日決算）では既払分配金が0円で、月次レポート（2026年8月31日作成基準）の設定来分配金合計額も0円です。'),
              S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われた金額に相当する分、基準価額は下がります。'),
              S(p, 'distpolicy', '分配金額は収益分配方針に基づいて委託会社が決め、支払われない場合もあります。'),
              S(p, 'perf', '冒頭の比較表の値は、SBI・SPDR側の分配金を受け取らずに税引前のまま再投資したと仮定した値です。'))
    tax = tax_pair(p)
    if tax:
        body += P(S(p, 'vym0', '第9期（2026年7月15日決算）まで分配金が0円の楽天・VYMには、それまでの決算で分配時の税金は生じていません。'),
                  S(p, 'perf', 'このため、普通分配金に税金がかかる個人の課税口座では、SBI・SPDR側の分配金を税引前で再投資したと仮定した表の差が、そのまま手取りの差にはなりません（分配金にかかる税金とその例外は「計算条件」の節に書いています）。'))
    body += S(p, 'effpair', '<h2 id="cost-detail">実質的な信託報酬と、総経費率の内訳</h2>')
    d = round(0.172 - 0.1338, 4); amt = round(d / 100 * 1_000_000)
    body += P(S(p, 'sbi-spyd4-eff', 'SBI・SPDR・S&P500高配当（年4回）は国内ファンド分の信託報酬が年0.0638%で、投資先ETFの年0.07%程度（2026年5月末現在の値で、今後変更になる場合があります）を加味した、投資者が実質的に負担する信託報酬率が年0.1338%程度（税込・交付目論見書の概算。その他の費用と貸付時の報酬を除く）です。'),
              S(p, 'rakuten-vym-eff', '楽天・VYMは国内ファンド分の信託報酬が年0.132%で、投資先ETFの年0.04%程度（2026年2月末現在の値で、投資内容等により変動）を含む実質的な負担が年0.172%程度（税込・交付目論見書の概算で目安であり、組入状況・運用状況により変動。その他の費用と貸付時の報酬を除く）です。'),
              S(p, 'effgap', f'この2つの概算（交付目論見書の税込の料率で、その他の費用と貸付時の報酬を除く）の差は年{d}ポイント程度で、100万円を1年間一定額で保有すると仮定した目安は約{amt:,}円です。この金額は実際の利益差ではありません。'))
    body += P(ter_line(p, '、原則として購入時手数料・売買委託手数料・有価証券取引税を含まず、ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合がある'), S(p, 'terpair', '総経費率の作成対象期間は、SBI・SPDRが約半年、楽天・VYMが1年で、時期もずれています。'),
              S(p, 'terbrk', '交付運用報告書が載せる総経費率（年率換算の参考値で、原則として購入時手数料・売買委託手数料・有価証券取引税を含まない）の内訳は、SBI・SPDR・S&P500高配当が2025年11月21日〜2026年5月20日の作成対象期間について①当ファンドの費用の比率0.10%と②投資先ファンドの運用管理費用の比率0.07%、楽天・VYMが2025年7月16日〜2026年7月15日の作成対象期間について①このファンドの費用の比率0.16%と②投資先ファンドの運用管理費用等の比率0.06%です（①と②は計上された期間が異なる場合があり、②は運用会社等より入手した概算値の場合があります）。'),
              S(p, 'rakuten-vym-etfchg', '楽天・VYMの投資先ETFの費用は、交付目論見書の年0.04%程度（2026年2月末現在の値で、今後変動します）と、2025年7月16日〜2026年7月15日の作成対象期間の総経費率の内訳の0.06%（年率換算の参考値で、概算値の場合があります）とで数字が違います。年0.04%程度は投資先ETFの管理報酬等が2026年2月2日付で変更された後の率です。0.06%は2025年7月16日〜2026年7月15日の作成対象期間について交付運用報告書が総経費率の内訳に載せる参考値で（投資先ファンドの費用は計上された期間が異なる場合があり、運用会社等より入手した概算値の場合があります）、この期間は変更日より前を含みます。'),
              S(p, 'terbrknote', '交付運用報告書は、このファンドの費用と投資先ファンドの費用は計上された期間が異なる場合があり、投資先ファンドについては運用会社等より入手した概算値を使用している場合があると注記しており、2つの数字の差の理由は資料に書かれていません。'))
    # 照合4周目: 表のセル・投資先の文・費用の文に、同じ節の条件（運用できない場合・料率の基準時点・総経費率の注）を足した
    cav_s = Q('sspyd_P', r'資金動向、市況動向の急激な変化が生じたとき等ならびに投資信託財産の規模によっては、上記の運用ができない ?場合があります。')
    cav_r = Q('rivuh_P', r'資金動向、市況動向等に急激な変化が生じたとき等ならびに投資信託財産の規模によっては、 ?また、 ?やむを得ない事情が発生した場 ?合には、上記の運用ができない場合があります。')
    for cid in ('sbi-spyd4-hedge', 'rakuten-vym-hedge', 'spyd-etf', 'rvym-etf'):
        p.claims[cid]['exceptions'] += f' 同じ運用方針の節の留保（表の行見出し・本文の同じ文に書いた）: 「{cav_s}」（sspyd_P）／「{cav_r}」（rivuh_P）。運用ができない場合として挙げているのはこれで全部。'
    p.claims['effpair']['exceptions'] += (' SBI・SPDR側の投資先ETFの管理報酬等（年0.07%）の基準時点: 「' + Q(*FUNDS['sbi-spyd4']['effnote_asof']) + '」「※上記の内容は今後変更になる場合があります。」（sspyd_P。表のセル・リード・FAQ・費用の節の同じ文に書いた）。')
    p.claims['rakuten-vym-etfchg']['exceptions'] += (' 年0.04%程度の基準時点: 「' + Q('rivuh_P', r'＊1 ?2026年2月末現在。今後、投資内容等によりこの数値は変動します。')
        + '」（rivuh_P）。0.06%の概算: 「' + Q('rivuh_Ak', r'（注7）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。') + '」（rivuh_Ak）。どちらも本文の同じ文に書いた。')
    for cid in ('terpair', 'terbrk'):
        p.claims[cid]['exceptions'] += (' 同じ表の注（表の行見出し・本文・FAQの同じ文に書いた）: 「' + Q('sspyd_Ak', r'（注６）①と②の費用は、計上された期間が異なる場合があります。 （注７）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。')
            + '」（sspyd_Ak）、楽天・VYMの（注6）（注7）も同旨（rivuh_Ak）。購入時手数料・売買委託手数料・有価証券取引税を原則含まない旨も同じ文に書いた。')
    body += method_section(p)
    body += faq_block(p, [
        ('idxpair', '両者の違いは何ですか？', [('idxpair', '連動を目指す指数が違います。前者はS&P500高配当指数（配当込み、円換算ベース）、後者はFTSEハイディビデンド・イールド・インデックス（円換算ベース）です。'),
                                      ('sp-eq', 'S&P500高配当指数は年2回の入れ替えのたびに80銘柄を均等の比率にする設計で（比率は入れ替えの7営業日前の価格で決めるため、入れ替えの時点でも値動きでずれます）、FTSEハイディビデンド・イールド・インデックスは時価総額加重平均型です。'),
                                      ('vym0', '分配金も、楽天・VYMは第9期（2026年7月15日決算）まで0円です。')]),
        ('distA', '分配金を受け取りたい場合はどう見ればよいですか？', [('distA', f'SBI・SPDR・S&P500高配当（年4回）は年4回決算で、直近4回（{jd(ra[0][0].replace("/", "-"))}〜{jd(ra[-1][0].replace("/", "-"))}の決算）の合計は1万口当たり{sa:,}円（税引前）でした。'),
                                                  ('rvym-policy', '楽天・VYMは年1回決算で、必ず分配を行うものではありません。'),
                                                  ('distpolicy', 'どちらも分配金額は委託会社が決め、支払われない場合もあります。この記事はどちらかを勧めるものではありません。')]),
        faq_net(p, '課税口座で課税される普通分配金や譲渡益が生じた場合は、その税金の分だけ手取りは表の金額より少なくなります。'),
        ('effpair', '費用はどちらが低いですか？', [('effpair', '投資先ETFの報酬を加味した実質的な信託報酬（税込年率）は、交付目論見書の概算でSBI・SPDR・S&P500高配当（年4回）が年0.1338%程度（投資先ETFの報酬は2026年5月末現在の値で、今後変更になる場合があります）、楽天・VYMが年0.172%程度です（楽天・VYMの値は目安で、投資先ETFの報酬は2026年2月末現在の値で、組入状況や運用状況によって変動し、どちらもその他の費用と、有価証券の貸付を行った場合の報酬は含みません）。'),
                                              ('terpair', '総経費率（年率換算の参考値で、原則として購入時手数料・売買委託手数料・有価証券取引税を含まない）はSBI・SPDRが0.17%（2025年11月21日〜2026年5月20日）、楽天・VYMが0.22%（2025年7月16日〜2026年7月15日）で、作成対象期間が違います。どちらも、ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合があります。')]),
        ('perf', '直近の騰落率はどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の税引前分配金再投資ベースの騰落率はSBI・SPDR・S&P500高配当が{pct(one['A累積'])}、楽天・VYMが{pct(one['B累積'])}でした。開始日によって結果は変わり、過去の実績は将来の成果を示しません。"),
    ])
    sections = std_sections('mechanism', '指数が違う：80銘柄の均等加重を目指す設計か、時価総額の大きさで持つか', '実質的な信託報酬と、総経費率の内訳')
    related = [('../sbi-spyd-vs-sbi-vym/', 'SBI・SPDR・S&P500高配当 vs SBI・V・米国高配当', 'S&P500高配当型を、SBIのVYM型（FTSEの指数）と比べる'),
               ('../rakuten-schd-vs-rakuten-vym/', '楽天・SCHD vs 楽天・VYM', '楽天・VYMを楽天・SCHDと比べる'),
               ('../haitokin-kakutei-shinkoku/', '配当金と確定申告', '分配金・配当金の税金の扱いを確かめる')]
    return p, title, desc, body, sections, related


# ======================================================================== 8. JEPI vs SCHD（カバード・コール型と高配当株指数型。共通期間は約4か月半）
@article
def a_jepi_schd():
    p = Page('rakuten-jepi-vs-rakuten-schd', 'rakuten-jepi', 'rakuten-schd', 'rakuten-jepi__rakuten-schd')
    p.strict_cursor = True  # 台帳の単位→主張の対応を文書の順で取る（表の短いセルが description に吸われないように）
    r = p.r_
    days = (dt.date.fromisoformat(r['終点']) - dt.date.fromisoformat(r['起点'])).days
    assert '1年窓' not in r and r['年数'] < 1 and days == 142, (r['年数'], days)  # 1年未満の間は年率換算・直近1年を出さない
    per = f"{jd(r['起点'])}〜{jd(r['終点'])}"
    J, Sx = 'rakuten-jepi', 'rakuten-schd'
    cost_title = '実質的な信託報酬と、総経費率の内訳'
    mech_title = 'カバード・コール戦略のETFと、配当株の指数に連動するETF'
    p.title = title = '楽天・JEPI vs 楽天・SCHD｜カバードコールと高配当株の仕組み・分配・費用を比較'
    desc = (f"楽天・JEPI（毎月決算型）と楽天・SCHD（四半期決算型）を、楽天・JEPIの設定日{jd(r['起点'])}から{jd(r['終点'])}までの142日間・分配金再投資（税引前）で比較。"
            f"{jd(r['起点'])}に100万円を投資したと仮定した{jd(r['終点'])}の評価額は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}（売却前。期間が短いため年率換算はしていません）。"
            "カバード・コール戦略で基準価額の上昇が制限される可能性、決算の頻度、NISAの対象かどうか、交付目論見書の実質的な信託報酬（概算）も確認します。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    p.claims['desc']['scope'] = p.claims['perf']['scope']
    cav_pat = r'資金動向、市況動向等に急激な変化が生じたとき等、ならびに投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、 上記のような運用ができない場合があります。'
    cav_j, cav_s = Q('rijepi_P', cav_pat), Q('risude_P', cav_pat)
    cav_txt = '資金動向や市況動向に急激な変化が生じたとき、投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、この運用ができない場合があります'
    cav_exc = f' 同じ運用方針の節の留保（本文の同じ文・表の行見出しに書いた）: 「{cav_j}」（rijepi_P）／「{cav_s}」（risude_P）。運用ができない場合として挙げているのはこれで全部。'
    # ---- 期間
    ja, _u = nav_rows(J, r['起点'], r['終点'])
    p.claim('period', f'2本の基準価額がそろう期間は{per}の142日間（約4か月半）', NAV[J][1], ja, f'{GOT}に取得した運用会社の基準価額データ',
            '楽天・JEPIの設定日は2026年5月11日（交付目論見書「' + Q(*FUNDS[J]['incept_q']) + '」）。楽天・SCHDの設定日は2024年9月18日でそれより前。終点は月末の2026年9月30日に固定した（取得したデータは2026年10月7日分まである）。'
            '1年未満のため年率換算・直近1年の騰落率は載せていない。',
            scope=f'この記事の比較期間（{per}。終点は月末に固定）。運用会社公表の基準価額データがある営業日')
    # ---- 分配
    distnav_claims_doc(p, 'rijepi_P')
    p.claims['distpolicy']['exceptions'] = ('同じ節の注: 「※上記はイメージであり、将来の分配金の支払いおよびその金額について示唆、保証するものではありません。」。分配方針の欄: 「' + Q('rijepi_P', r'●収益分配金額は、委託会社が基準価額水準、市況動向等を勘案して決定します。ただし、必ず分 配を行うものではありません。')
                                            + '」。比較相手（risude_P）にも同じ注記: 「' + Q('risude_P', r'※分配金額は、収益分配方針に基づいて委託会社が決定します。あらかじめ一定の額の分配をお約束するものではありません。分配金が支払われない 場合もあります。') + '」')
    ra = [x for x in dist_rows_rakuten(p, J, r['起点']) if x[0].replace('/', '-') <= r['終点']]
    rb = [x for x in dist_rows_rakuten(p, Sx, r['起点']) if x[0].replace('/', '-') <= r['終点']]
    assert [v for _, v in ra] == [65, 60, 55] and [v for _, v in rb] == [90, 95], (ra, rb)
    dist_claim(p, 'distA', J, ra); dist_claim(p, 'distB', Sx, rb)
    for c_ in ('distA', 'distB'):
        p.claims[c_]['exceptions'] += ' 過去の実績で、将来の分配金の水準を示さない（月次レポートの注記「' + Q('rijepi_M', r'※ 分配金実績は、将来の分配金の水準を示唆・保証するものではありません。') + '」）。比較期間内に決算日が来た分配の全件（楽天・JEPI 3回、楽天・SCHD 2回）を表に載せた。'
    p.claim('distpair', f'比較期間（{per}）に決算日が来た分配は楽天・JEPIが3回、楽天・SCHDが2回', p.claims['distA']['source_url'], p.claims['distA']['source_quote'], p.claims['distA']['applies'],
            p.claims['distA']['exceptions'] + f' 比較相手: {p.claims["distB"]["source_url"]}「{p.claims["distB"]["source_quote"]}」')
    p.docq('distnote', '月次レポートの注記: 分配金実績は将来の分配金の水準を示唆・保証するものではない', 'rijepi_M',
           r'※ 分配金実績は、将来の分配金の水準を示唆・保証するものではありません。',
           '無し: 月次レポートの分配金の表の注記。楽天・SCHDの月次レポートにも同じ注記がある。',
           extra_doc=[('risude_M', r'※ 分配金実績は、将来の分配金の水準を示唆・保証するものではありません。')])
    p.docq('distover', '2本の交付目論見書: 分配金は計算期間中に発生した収益を超えて支払われる場合があり、その場合は当期決算日の基準価額が前期決算日と比べて下落する', 'rijepi_P',
           r'分配金は計算期間中に発生した収益を超えて支払われる場合があります。その場合、当期決算日の基準価額は前期決 算日と比べて下落することになります。',
           '同じ文の続き: 「また、分配金の水準は、必ずしも計算期間におけるファンドの収益率を示すもの ではありません。」（本文に書いた）。',
           extra_doc=[('risude_P', r'分配金は計算期間中に発生した収益を超えて支払われる場合があります。その場合、当期決算日の基準価額は前期決 算日と比べて下落することになります。')])
    p.docq('jepi-d1', '楽天・JEPIの第1期（2026年5月11日〜2026年7月15日）の当期分配金65円（1万口当たり・税込）は当期の収益65円、当期の収益以外は「－」', 'rijepi_Ak',
           r'（1万口当たり・税込） 第1期 項 目 2026年5月11日～2026年7月15日 当期分配金 （円） 65 （対基準価額比率） （％） （0\.614） 当期の収益 （円） 65 当期の収益以外（円） － 翌期繰越分配対象額（円） 524',
           '同じ表の注を全件: （注1）対基準価額比率は当期分配金の期末基準価額（分配金込み）に対する比率で、ファンドの収益率とは異なる。（注2）「' + Q('rijepi_Ak', r'「当期の収益」は経費控除後の配当等収益および経費控除後の有価証券売買等損益、 「当期の収益以外」は収益調整金お よび分配準備積立金です。')
           + '」（注3）当期の収益・当期の収益以外は円未満を切捨てて表示しているため、合計が当期分配金と一致しない場合がある。ファンドの決算の内訳で、投資者ごとの普通分配金・元本払戻金（特別分配金）の区分とは別（本文に書いた）。')
    p.claims['jepi-d1']['scope'] = '楽天・JEPIの第1期（作成対象期間2026年5月11日〜2026年7月15日）の交付運用報告書の分配金の表。ファンドの決算の内訳で、投資者ごとの課税上の区分ではない'
    p.docq('schd-d45', '楽天・SCHDの第4期・第5期（作成対象期間2025年8月26日〜2026年2月25日）の当期分配金85円・90円（1万口当たり・税込）はどちらも当期の収益と同額、当期の収益以外は「－」', 'risude_Ak',
           r'（1万口当たり・税込） 第4期 第5期 項 目 2025年8月26日～ 2025年11月26日～ 2025年11月25日 2026年2月25日 当期分配金 （円） 85 90 （対基準価額比率） （％） （0\.797） （0\.725） 当期の収益 （円） 85 90 当期の収益以外（円） － －',
           '同じ表の注は楽天・JEPIの交付運用報告書と同じ（注1〜注3）。この2期は比較期間（2026年5月11日〜）より前の決算で、比較期間内の2回（2026年5月25日・2026年8月25日の決算）は、2026年10月8日に運用会社のサイトに掲載されていた交付運用報告書の作成対象期間より後。')
    p.claims['schd-d45']['scope'] = '楽天・SCHDの第4期・第5期（作成対象期間2025年8月26日〜2026年2月25日）の交付運用報告書の分配金の表。ファンドの決算の内訳で、投資者ごとの課税上の区分ではない'
    p.docq('incdef', '交付運用報告書の注: 「当期の収益」「当期の収益以外」の定義', 'rijepi_Ak',
           r'「当期の収益」は経費控除後の配当等収益および経費控除後の有価証券売買等損益、 「当期の収益以外」は収益調整金お よび分配準備積立金です。',
           '同じ注の並び: （注3）円未満を切捨てて表示しているため合計が当期分配金と一致しない場合がある。楽天・SCHDの交付運用報告書の（注2）も同じ文。',
           extra_doc=[('risude_Ak', r'「当期の収益」は経費控除後の配当等収益および経費控除後の有価証券売買等損益、 「当期の収益以外」は収益調整金お よび分配準備積立金です。')])
    p.docq('d-unpub', '比較期間内の決算のうち、分配金の内訳が交付運用報告書で確認できるのは楽天・JEPIの第1期（2026年7月15日決算）だけ', 'rijepi_Ak',
           r'（作成対象期間 2026年5月11日～2026年7月15日） 第1期（決算日 2026年 7 月15日）',
           f'{jd(GOT)}に運用会社のファンドページに掲載されていた交付運用報告書は、楽天・JEPIが第1期（〜2026年7月15日）、楽天・SCHDが第4期・第5期（2025年8月26日〜2026年2月25日）のもの。'
           '楽天・JEPIの交付目論見書は「' + Q('rijepi_P', r'原則として、毎年1月および7月の決算時および償還時に交付運用報告書を作成し、販売 運 用 報 告 書 会社を通じて知れている受益者に交付します。') + '」としている。',
           extra_doc=[('risude_Ak', r'（作成対象期間 2025年8月26日～2026年2月25日）')])
    p.claims['d-unpub']['scope'] = f'{jd(GOT)}に運用会社のファンドページに掲載されていた2本の交付運用報告書の範囲'
    pdef_pat = r'普 通 分 配 金：個別元本（投資者のファンドの購入価額）を上回る部分からの分配金です。 元本払戻金 （特別分配金） ：個別元本を下回る部分からの分配金です。 分配後の投資者の個別元本は、 元本払戻金 （特別分配金） の額だ け減少します。'
    p.docq('pdef', '普通分配金と元本払戻金（特別分配金）は投資者ごとの個別元本で決まる区分（交付目論見書の収益分配金に関する留意事項）', 'rijepi_P', pdef_pat,
           '同じ節: 「' + Q('rijepi_P', r'投資者のファンドの購入価額によっては、分配金の一部または全部が、実質的には元本の一部払戻しに相当する 場合があります。 ファンド購入後の運用状況により、分配金額より基準価額の値上がりが小さかった場合も同様です。')
           + '」。元本払戻金（特別分配金）部分は非課税扱い、普通分配金は課税（同じ節の注）。楽天・SCHDの交付目論見書にも同じ説明がある。')
    # ---- 仕組み
    p.docq('jepi-etfs', '楽天・JEPIはマザーファンドを通じて米ドル建ての2本のETF（JPモルガン・米国株式・プレミアム・インカムETF／同アクティブUCITS ETF）を実質的な投資対象とする', 'rijepi_Ak',
           r'当ファンドは「楽天・米国大型株式・プレミアム・インカム・マザーファンド」受益証券（以下、 「マ ザーファンド」）を通じて米ドル建ての「JPモルガン・米国株式・プレミアム・インカムETF」および「JP モルガン・米国株式・プレミアム・インカム・アクティブUCITS ETF」 （以下、 「投資先ETF」）を実質的 な投資対象とする',
           '同じ文の続き: 「（マザーファンドを通じて純資産総額の一部を実質的に海外株価指数先物に投資しているため、海外株価指数先物の価格変動の影響も受けます）」。' + cav_exc)
    p.docq('jepi-alloc', '楽天・JEPIのマザーファンドの組入比率（2026年8月31日作成基準）: JPモルガン・米国株式・プレミアム・インカムETF 98.1%、同アクティブUCITS ETF「-」', 'rijepi_M',
           r'組入資産（マザーファンド） 比率 楽天・米国大型株式・プレミアム JPモルガン・米国株式・プレミアム 100\.0% 98\.1% ・インカム・マザーファンド ・インカムETF \* 短期金融資産等 0\.01% JPモルガン・米国株式・プレミアム - ・インカム・アクティブUCITS ETF \* 合計 100\.0% 短期金融資産等 1\.9% 合計 100\.0% 株式先物 1\.9%',
           '同じ表の注: 「※ 比率は、ファンドまたはマザーファンドの純資産総額に対する各資産の評価額の比率です。」。同じ表に短期金融資産等1.9%・株式先物1.9%の行がある（段組のため抽出テキストでは2つの表の行が交互に並ぶ）。作成基準日（2026年8月31日）の値で、その後は変わる。')
    p.claims['jepi-alloc']['scope'] = '楽天・JEPIのマザーファンドの2026年8月31日（月次レポートの作成基準日）の組入比率'
    p.claims[p.fc(J, 'index')]['exceptions'] += (' 同じ節の注: 「※上記は、 当ファンドの主要投資対象である外国投資信託にかかる特色を説明したもので、 当ファンドの投資成果を示唆 または保証するものではありません。」。' + cav_exc)
    p.docq('jepi-cap', 'カバード・コール戦略は一定の水準以上の株価上昇による値上がり益を放棄する代わりにプレミアムの獲得を目指す手法で、基準価額の上昇が制限される可能性がある（投資リスクの欄）', 'rijepi_M',
           r'【基準価額の上昇余地が制限されるリスク】 投資対象ファンドが採用する「カバード・コール戦略」は、一定の水準以上の株価上昇による値上がり益を放棄する代わりに、コールオ プションの売却によるプレミアム（収益）の獲得を目指す運用手法です。そのため、原資産である米国株価指数やそれに連動するETF 等が目標水準を超えて上昇した場合でも、その上昇分を享受できず、当ファンドの基準価額の上昇が制限される可能性があります。',
           '月次レポート（2026年8月31日作成基準）の投資リスクの欄。交付目論見書の投資リスクの欄にも同じ文がある（段組のため抽出テキストでは欄見出しが文の途中に挟まるので、逐語は月次レポートから取った）。同じ欄の他の変動要因（価格変動・株価変動・為替変動・オプション価格の変動・流動性・信用・カントリー）は基準価額の下落要因で、株価が下落した場合は基準価額の下落要因になる（「' + Q('rijepi_M', r'当該株式の価格が下落した場合には、基準価額の下落要因となります。') + '」）。「※ 基準価額の変動要因は、上記に限定されるものではありません。」')
    p.docq('jepi-opt', '投資対象ファンドは株価連動債券を通じて、または直接的に、コールオプションの売却を行う（投資リスクの欄）', 'rijepi_M',
           r'【オプション価格の変動に伴うリスク】 当ファンドの投資対象ファンドにおいては、株価連動債券を通じて、または直接的に、米国株価指数やそれに連動するETF等を原資産 とするコールオプションの売却を行います。このため、米国株価指数やそれに連動するETF等の価格変動および同指数のボラティリ ティ（価格変動率）の変化等により、オプション価格が大きく変動し、投資対象ファンドの基準価額に影響を与える可能性があります。',
           '無し: 月次レポートの投資リスクの欄の全文を読んで確認した。交付目論見書の投資リスクの欄にも同じ文がある。')
    p.docq('jepi-direct', '楽天・JEPI自体は株式への直接投資・デリバティブの直接利用を行わない（主な投資制限）', 'rijepi_P',
           r'●株式への直接投資は行いません。 ●デリバティブの直接利用は行いません。',
           '同じ欄の他の制限（全件）: マザーファンド受益証券への投資割合に制限なし／投資信託証券（マザーファンドの受益証券および上場投資信託証券を除く）への実質投資割合は純資産総額の5%以下／外貨建資産への実質投資割合に制限なし／外国為替予約取引を行うことができる／外国為替予約取引は為替変動リスクを回避する目的以外には利用しない。' + cav_exc)
    p.docq('jepi-etfpol', '投資先ETFの運用の基本方針（交付目論見書「投資対象ファンドの概要」・2026年1月末現在）', 'rijepi_P',
           r'以下は、2026年1月末現在で委託会社が知り得る情報を基に作成しています。.{0,520}?※上記の内容は、今後変更になる場合があります。',
           '交付目論見書の「投資対象ファンドの概要」の表（段組のため抽出テキストでは列が交互に並ぶ。運用の基本方針の列は「米国の大型株とオプションの売却を組み合わせたポートフォリオからインカムを獲得し、株式の配当金とオプションプレミアムを原資として毎月分配を目指す」）。同じ表の注: 今後変更になる場合がある（本文に書いた）。ETFの方針であり、楽天・JEPIの分配金額は委託会社が決め、必ず分配を行うものではない。')
    p.claims['jepi-etfpol']['scope'] = '楽天・JEPIの投資先ETF（2本）の運用の基本方針。2026年1月末現在で委託会社が知り得る情報'
    p.claims[p.fc(Sx, 'index')]['exceptions'] += (' 「投資対象ファンドの概要」は「' + Q('risude_P', r'以下は、2026年2月末現在で委託会社が知り得る情報を基に作成しています。') + '」「' + Q('risude_P', r'※上記の内容は、今後変更になる場合があります。') + '」。' + cav_exc)
    assert not any(w in text('risude_P') for w in ('オプション', 'カバード')), 'risude_P now mentions options: rewrite the nocc sentence'
    p.claim('nocc', '楽天・SCHDの交付目論見書には、オプション・カバード・コール戦略についての記載が無い', url('risude_P'), Q(*FUNDS[Sx]['index_q']), f'{GOT}に確認した{DOCS["risude_P"][1]}',
            '交付目論見書の抽出テキスト全文を「オプション」「カバード」で検索して0件であることを生成のたびに assert で確かめている（語が現れたら生成が止まる）。交付運用報告書の費用明細には「（先物・オプション）」という売買委託手数料の項目名があるが、戦略の記載ではない。',
            scope='楽天・SCHDの交付目論見書（使用開始日2026年5月26日）に書かれている範囲')
    p.docq('nobm2', '2本とも交付目論見書上のベンチマークはない', 'rijepi_P', r'なお当ファンドに、ベンチマークはありません。',
           '楽天・JEPIの交付運用報告書: 「' + Q('rijepi_Ak', r'当ファンドの運用方針に対応する適切な指数が存在しないため、ベンチマークおよび参考指数を設定しておりませ ん。') + '」。楽天・SCHDの投資先ETFが指数への連動を目指す点は別の主張（rakuten-schd-index）。',
           extra_doc=[('risude_P', r'当ファンドには、 ベンチマークはありません。')])
    p.docq('comp-j', '楽天・JEPIの投資先ETF（JPモルガン・米国株式・プレミアム・インカムETF）の投資銘柄数・上位銘柄・業種別構成比（2026年8月末現在）', 'rijepi_M',
           r'2026年8月末現在 投資銘柄数 投資銘柄数 135 組入上位10銘柄 銘柄 業種 比率 MICROSOFT CORP COMMON 情報技術 2\.0%.{0,700}?業種別構成比 業種 比率 情報技術 15\.4% その他 14\.6% 資本財・サービス 12\.2% ヘルスケア 12\.1%.{0,260}?※ 比率は、ETFの純資産総額に対する各資産の評価額の比率です。 ※ 業種は、GICS（世界産業分類基準）に準じて分類しております。',
           '月次レポートの投資先ETFのページを全12行（情報技術15.4%・その他14.6%〜素材1.4%）読み、最大が情報技術であることを確認した。比率はETFの純資産総額に対する比率で、業種はGICSに準じた分類（同じ注記）。出所はJPモルガン・アセット・マネジメント社が公開するデータを基に楽天投信投資顧問が作成。2026年8月末現在の値で、その後は変わる。')
    p.claims['comp-j']['scope'] = '楽天・JEPIの投資先ETF（JPモルガン・米国株式・プレミアム・インカムETF）の2026年8月末現在の数値（楽天投信の月次レポート）'
    p.docq('comp-s', '楽天・SCHDの投資先ETF（シュワブ・米国配当株式ETF）の投資銘柄数・上位銘柄・業種別構成比（2026年8月末現在）', 'risude_M',
           r'2026年8月末現在 投資銘柄数 投資銘柄数 103.{0,120}?MERCK & CO INC ヘルスケア 4\.8%.{0,700}?業種別構成比 業種 比率 ヘルスケア 21\.3% 生活必需品 19\.4% エネルギー 15\.8% 資本財・サービス 11\.8% 金融 9\.7% 情報技術 8\.7%.{0,160}?※ 比率は、ETFの純資産総額に対する各資産の評価額の比率です。 ※ 業種は、GICS（世界産業分類基準）に準じて分類しております。',
           '月次レポートの業種別構成比の表を全9業種（ヘルスケア21.3%〜公益事業0.1%）読み、最大がヘルスケアであることを確認した。表に載っているのはこの9業種だけで、合計は100%にならない。比率はETFの純資産総額に対する比率で、業種はGICSに準じた分類（楽天・JEPI側と同じ注記）。2026年8月末現在の値で、その後は変わる。')
    p.claims['comp-s']['scope'] = '楽天・SCHDの投資先ETF（シュワブ・米国配当株式ETF）の2026年8月末現在の数値（楽天投信の月次レポート）'
    # ---- NISA・信託期間・特化型
    p.docq('jepi-nisa', '楽天・JEPIはNISAの対象ではない（交付目論見書・使用開始日2026年4月27日の課税関係の欄）', 'rijepi_P', r'当ファンドは、NISAの対象ではありません。',
           '同じ欄の全文: 「' + Q('rijepi_P', r'課税上は株式投資信託として取り扱われます。.{0,260}?配当控除の適用はありません。') + '」。月次レポート（2026年8月31日作成基準）の課税関係の欄にも「当ファンドは、NISAの対象ではありません。」とある。対象でない理由は資料に書かれていないため本文にも書いていない。資料の時点の記載で、今後変わる場合がある。')
    p.claims['jepi-nisa']['scope'] = '楽天・JEPIの交付目論見書（使用開始日2026年4月27日）の課税関係の欄の記載'
    p.docq('schd-nisa', '楽天・SCHDはNISAの成長投資枠（特定非課税管理勘定）の対象で、販売会社により取扱いが異なる場合がある（交付目論見書・使用開始日2026年5月26日）', 'risude_P',
           r'当ファンドは、NISAの 「成長投資枠（特定非課税管理勘定）」 の対象ですが、販売会社に より取扱いが異なる場合があります。',
           '同じ節の注: 「' + Q('risude_P', TAXQ[2]) + '」（NISAを利用できるのは一定の条件に該当する方。本文に書いた）。つみたて投資枠の記載は無い。資料の時点の記載で、今後変わる場合がある。')
    p.claims['schd-nisa']['scope'] = '楽天・SCHDの交付目論見書（使用開始日2026年5月26日）の課税関係の欄の記載'
    p.docq('jepi-term', '楽天・JEPIの信託期間は2036年4月14日まで（延長または繰上償還の場合あり）', 'rijepi_P',
           r'2036年4月14日まで （設定日：2026年5月11日） 信 託 期 間 ※ただし、一定の条件により信託期間を延長または繰上償還する場合があります。',
           '同じ欄のただし書（延長・繰上償還）を本文の表に書いた。繰上償還の条件（次の欄・全件）: 「' + Q('rijepi_P', r'委託会社は、受益権の口数が10億口を下回ることとなったとき、.{0,220}?信託を終了させることができます。') + '」')
    p.docq('schd-term', '楽天・SCHDの信託期間は無期限（繰上償還の場合あり）', 'risude_P',
           r'無期限（設定日：2024年9月18日） 信 託 期 間 ※ただし、一定の条件により繰上償還する場合があります。',
           '同じ欄のただし書（繰上償還）を本文の表に書いた。繰上償還の条件（次の欄・全件）: 「' + Q('risude_P', r'委託会社は、受益権の口数が10億口を下回ることとなったとき、.{0,220}?信託を終了させることができます。') + '」')
    p.docq('jepi-tokka', '楽天・JEPIは特化型運用（寄与度が10%を超える又は超える可能性の高い支配的な銘柄が存在。当該銘柄のエクスポージャーが純資産総額の35%を超えないように運用）', 'rijepi_P',
           r'※当ファンドは、特化型運用を行います。 当ファンドがマザーファンド受益証券への投資を通じて投資対象とする上場投資信託証券 （ETF） は、実質投資対象であ る米国の株式等に集中投資することを基本戦略としており、一般社団法人資産運用業協会規則で定める寄与度が10％ を超える又は超える可能性の高い支配的な銘柄が存在するため、特定の銘柄への投資が集中することがあります。 当該銘柄のエクスポージャーが投資信託財産の純資産総額の35％を超えないように運用を行いますが、 当該銘柄に 財政難、経営不振等が生じた場合又はそれが予想される場合には、大きな損失が発生することがあります。',
           '無し: 交付目論見書の特化型運用の注記の全文を逐語に取った。どの銘柄が支配的な銘柄にあたるかは資料に書かれていないため本文にも書いていない。')
    assert not any('特化型' in text(d) for d in ('risude_P', 'risude_Ak', 'risude_M')), 'risude now mentions 特化型: rewrite'
    p.claim('schd-notokka', '楽天・SCHDの交付目論見書・交付運用報告書・月次レポートには「特化型運用」の記載が無い', url('risude_P'), Q('risude_P', r'追加型投信／海外／株式'), f'{GOT}に確認した楽天・SCHDの交付目論見書・交付運用報告書・月次レポート',
            '3資料の抽出テキスト全文を「特化型」で検索して0件であることを生成のたびに assert で確かめている（語が現れたら生成が止まる）。source_quote は交付目論見書の表紙の商品分類で、楽天・JEPIの表紙にある「当ファンドは、特化型運用を行います。」の表示がここに無い。',
            scope=f'楽天・SCHDの運用会社の3資料（{jd(GOT)}に確認）に書かれている範囲')
    tq = lambda d: '」「'.join(Q(d, TAXQ[i]) for i in (0, 3, 4, 5))
    p.claim('taxboth', '2本の交付目論見書の税金の表: 個人投資者の源泉徴収時の税率で、普通分配金と換金（解約）時・償還時の差益（譲渡益）にそれぞれ20.315%', url('rijepi_P'), Q('rijepi_P', TAXQ[0]), f'{GOT}に確認した2本の交付目論見書',
            '同じ節のNISAの注（楽天・SCHD側。本文の同じ文に書いた）: 「' + Q('risude_P', TAXQ[2]) + '」。楽天・JEPIはNISAの対象ではない（別の主張 jepi-nisa）。' + '同じ表の注を全件（本文の同じ文に書いた）: 課税方法等により異なる場合がある／外国税額控除の適用となった場合は分配時の税金が異なる場合がある／法人の場合は異なる／楽天・JEPIは2026年1月末現在、楽天・SCHDは2026年2月末現在の記載で、税法改正等で税率等が変更される場合がある。課税されるのは分配時は普通分配金、換金時・償還時は差益で、元本払戻金（特別分配金）は非課税扱い。'
            f' 根拠: {url("rijepi_P")}「{tq("rijepi_P")}」 / {url("risude_P")}「{tq("risude_P")}」',
            scope=f'個人投資者が受け取る分配金・換金時の差益の税金（{GOT}に確認した2本の交付目論見書の「税金」の表）。法人・個別の課税方法は含まない')
    # ---- 費用
    pair_claim(p, 'effpair', 'eff', '2本の実質的な信託報酬（投資先ETFの報酬を加味した信託報酬率。その他の費用・貸付時の報酬は含まない）')
    eff_scope(p)
    schd_eff_tbl = Q('risude_P', r'年0\.0％程度（注） における報酬＊1 年 0\.06％程度の報酬が日々控除されま すが、委託会社が合理的に見積った当 該報酬相当額をファンドに充当します。 実質的に負担する運用管理費用＊2 年0\.1238％（税込）程度')
    for c_ in ('effpair', f'{Sx}-eff'):
        p.fc(Sx, 'eff')
        p.claims[c_]['exceptions'] += (' 2本の同じ費用欄の注（本文の同じ文・表のセルに書いた）: 楽天・JEPI「' + Q(*FUNDS[J]['effnote_q']) + '」（rijepi_P）／楽天・SCHD「' + Q(*FUNDS[Sx]['effnote_q']) + '」（risude_P）。楽天・SCHDの費用の表: 「' + schd_eff_tbl + '」')
    p.fc(J, 'eff')
    p.claims[f'{J}-eff']['exceptions'] += ' 同じ費用欄の注: 「' + Q(*FUNDS[J]['effnote_q']) + '」'
    gap_claim(p, 'effgap', '2本の実質的な信託報酬（交付目論見書の概算）の差と、100万円を1年間一定額で保有すると仮定した目安', 'eff')
    schd_terfund_claim(p)
    assert '総経費率' not in text('rijepi_P'), 'rijepi_P now has a TER column: use it and drop ter_ak_note'
    ter_notes = r'（注1）このファンドの費用は1万口当たりの費用明細において用いた簡便法により算出したものです。 （注2）各費用は、原則として、募集手数料、売買委託手数料および有価証券取引税を含みません。 （注3）各比率は、年率換算した値です。 （注4）投資先ファンドとは、このファンドまたはマザーファンドが組み入れている投資信託証券（マザーファンドを除く）です。 （注5）このファンドの費用は、マザーファンドが支払った費用を含み、投資先ファンドが支払った費用を含みません。 （注6）このファンドの費用と投資先ファンドの費用は、計上された期間が異なる場合があります。 （注7）\x07?投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。 （注8）\x07?上記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なり ます。'
    p.docq('jepi-terbrk', '楽天・JEPIの総経費率0.65%の内訳（第1期の交付運用報告書・作成対象期間2026年5月11日〜2026年7月15日）: ①このファンドの費用0.30%、②投資先ファンドの運用管理費用等0.35%', 'rijepi_Ak',
           r'総経費率（①＋②） 0\.65% ①このファンドの費用の比率 0\.30% ②投資先ファンドの運用管理費用等の比率 0\.35%',
           '同じ表の注を全件: 「' + Q('rijepi_Ak', ter_notes) + '」。作成対象期間は設定日（2026年5月11日）から第1期決算日（2026年7月15日）までで、年率換算した値（注3）。')
    p.docq('schd-terbrk', '楽天・SCHDの総経費率0.19%の内訳（交付運用報告書・作成対象期間2025年8月26日〜2026年2月25日）: ①このファンドの費用0.13%、②投資先ファンドの運用管理費用等0.06%', 'risude_Ak',
           r'総経費率（①＋②） 0\.19% ①このファンドの費用の比率 0\.13% ②投資先ファンドの運用管理費用等の比率 0\.06%',
           '同じ表の注を全件: 「' + Q('risude_Ak', ter_notes) + '」「' + Q('risude_Ak', r'（注9）\x07?当該比率には、投資対象とする投資信託証券にかかる年0\.06%程度の報酬が反映されていますが、委託会社が合理的に見積 った当該報酬相当額をファンドに別途充当しています。') + '」。交付目論見書の（参考情報）欄は同じ0.19%を①運用管理費用の比率0.12%・②その他費用の比率0.07%と別の切り方で載せている（本文では交付運用報告書の切り方だけを書いた）。')
    for c_ in (f'{J}-ter', 'terpair'):
        p.fc(J, 'ter')
        p.claims[c_]['exceptions'] += ' 楽天・JEPIの同じ表の注: 「' + Q('rijepi_Ak', ter_notes) + '」。楽天・SCHDの交付目論見書の（参考情報）欄の注: 「' + Q('risude_P', r'※投資先ファンドの費用は、計上された期間が異なる場合があります。 ※これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なります。') + '」「' + Q('risude_P', r'\(注\)当該比率には、投資対象とする投資信託証券にかかる年0\.06%程度の報酬が反映されていますが、委託会社が合理的に見積った当該報酬相当額 ?をファンドに別途充当しています。') + '」'
    p.docq('tersrc', '楽天・SCHDの総経費率は交付目論見書の（参考情報）欄に載っている、対象期間2025年8月26日〜2026年2月25日の年率の参考値', 'risude_P',
           r'（参考情報） ファンドの総経費率 対象期間：2025年8月26日～ 2026年2月25日 総経費率（①＋②） ①運用管理費用の比率 ②その他費用の比率 0\.19% 0\.12% 0\.07%\(注\) （表示桁数未満を四捨五入）',
           '同じ欄の注を全件: 「' + Q('risude_P', r'※対象期間の運用・管理にかかった費用の総額（原則として、購入時手数料、売買委託手数料および有価証券取引税を含みません。.{0,420}?をファンドに別途充当しています。') + '」。楽天・JEPIの交付運用報告書の注8: 「（注8）上記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なり ます。」')
    p.claims['tersrc']['scope'] = '2本の総経費率（楽天・SCHDは交付目論見書の（参考情報）欄・対象期間2025年8月26日〜2026年2月25日、楽天・JEPIは交付運用報告書・作成対象期間2026年5月11日〜2026年7月15日）。年率換算の参考値'
    ca_, cb_ = p.claims[p.fc(J, 'lend')], p.claims[p.fc(Sx, 'lend')]
    p.claim('lendpair', '2本の交付目論見書の貸付有価証券関連報酬（その他の費用・手数料）', ca_['source_url'], ca_['source_quote'], ca_['applies'],
            ca_['exceptions'] + f' 比較相手: {cb_["source_url"]}「{cb_["source_quote"]}」')
    oc_m = r'■ その他の費用・手数料 信託事務費用、監査報酬、印刷費用、売買委託手数料、外貨建資産保管費用(?:、貸付有価証券関連報酬)?等が支払われます。 ※ 委託会社は、投資信託財産の規模等を考慮して、当該費用・手数料等の一部もしくは全てを負担する場合があります。 ※ これらの費用・手数料等については、運用状況により変動するものであり、事前に料率や上限額を表示することができません。'
    p.claim('othercost', '2本の「その他の費用・手数料」（信託報酬の料率に含まれない費用）', url('rijepi_P'), Q(*FUNDS[J]['lendhead_q']), f'{GOT}に確認した2本の交付目論見書の費用の欄',
            '交付目論見書の欄が挙げる項目（全件・末尾は「等」）: 信託事務の処理に要する諸費用／投資信託財産にかかる監査報酬／法定書類の作成・印刷・交付にかかる費用／その他投資信託財産の運営にかかる費用／組入有価証券の売買の際に発生する売買委託手数料／外貨建資産の保管に要する費用／貸付有価証券関連報酬 等。'
            '同じ欄の注（月次レポートの同じ欄から逐語。交付目論見書は段組で注が項目の説明に挟まる）: 「' + Q('rijepi_M', oc_m) + '」（rijepi_M）／「' + Q('risude_M', oc_m) + '」（risude_M）。'
            f' 比較相手の交付目論見書: {url("risude_P")}「{Q(*FUNDS[Sx]["lendhead_q"])}」')
    pair_claim(p, 'settlepair', 'settle', '2本の決算頻度と決算日')
    p.claims['settlepair']['exceptions'] += (' 分配は必ず行われるものではない: 「' + Q('rijepi_P', r'毎決算時に、原則として収益分配方針に基づき分配を行います。ただし、必ず分配を行う 収 益 分 配 ものではありません。') + '」（rijepi_P）／「'
                                             + Q('risude_P', r'● 収益分配金額は、委託会社が基準価額水準、市況動向等を勘案して決定します。ただし、必ず分配を行うも のではありません。') + '」（risude_P）。信託の終了（繰上償還）の場合は以後の決算日が来ない。')

    # ================= リード
    lead = P(S(p, 'period', f'楽天・JEPIは2026年5月11日に設定されたファンドで、2本の基準価額がそろうのは同じ2026年5月11日からです。この記事は終点を月末の2026年9月30日に固定し、{per}の142日間（約4か月半）を比較期間にしました。'),
             S(p, 'perf', f"{jd(r['起点'])}の基準価額で100万円を一括で投資したと仮定し、税引前の分配金を再投資した場合の{jd(r['終点'])}時点の評価額（売却前）は、楽天・JEPIが{yen(r['A100万円終価'])}、楽天・SCHD（四半期決算型）が{yen(r['B100万円終価'])}でした。"), dd_line(p),
             S(p, 'perf', f'比較期間（{per}）が1年に満たないため、年率換算はしておらず、3年や5年といった長さでの比較もしていません。'))
    lead += P(S(p, f'{J}-index', f'投資先のETFの運用が違います。楽天・JEPIの投資先ETFは、交付目論見書によると、米国の株式を保有しつつ株式のコール・オプション（買う権利）を売却する「カバード・コール戦略」を採用しています（{cav_txt}）。'),
              S(p, 'jepi-cap', '同じ資料は、この戦略では原資産が目標水準を超えて上昇した場合でもその上昇分を享受できず、基準価額の上昇が制限される可能性があるとしています。'),
              S(p, f'{Sx}-index', '楽天・SCHD（四半期決算型）の投資先ETFは、交付目論見書の2026年2月末現在の情報では、ダウ・ジョーンズ US ディビデンド 100 インデックスに連動する投資成果を目指すETFです。'),
              S(p, 'settlepair', '決算は楽天・JEPIが年12回（原則として毎月15日で、第1期決算日は2026年7月15日、設定された2026年5月と翌6月の決算はありません）、楽天・SCHDが年4回（原則として2・5・8・11月の各25日）で、どちらも休業日の場合は翌営業日になり、必ず分配を行うものではありません。'),
              S(p, 'jepi-nisa', '交付目論見書（使用開始日2026年4月27日）の課税関係の欄には、楽天・JEPIはNISAの対象ではないと書かれています。'),
              S(p, 'effpair', '投資先ETFの報酬を加味した実質的な信託報酬（税込年率）は、交付目論見書の概算で楽天・JEPIが年0.658%程度（投資先ETFの報酬は2026年1月末現在の値）、楽天・SCHD（四半期決算型）が年0.1238%程度（投資先ETFの報酬は2026年2月末現在の値で、委託会社が合理的に見積った報酬相当額をファンドに充当）で、組入状況や運用状況によって変動し、監査報酬などのその他の費用と、有価証券の貸付を行った場合の報酬は含みません。'))
    p.lead = lead_block(p, lead)

    # ================= 実績・費用の表
    body = perf_section(p, head=f'項目（{per}の142日間。楽天・JEPIの設定日からで、1年未満のため年率換算なし）')
    body += fee_section(p, labels={
        'eff': '投資先ETF等を加味した実質的な信託報酬（税込年率・交付目論見書の概算で目安。組入状況・運用状況により変動。その他の費用と貸付時の報酬を除く）',
        'ter': '総経費率（年率換算の参考値。原則として購入時手数料（募集手数料）・売買委託手数料・有価証券取引税を含まない。ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合がある）',
        'hedge': f'為替ヘッジ（交付目論見書の運用方針。{cav_txt.replace("この運用ができない場合があります", "この運用ができない場合がある")}）',
        'index': f'連動対象・投資対象（交付目論見書の運用方針。{cav_txt.replace("この運用ができない場合があります", "この運用ができない場合がある")}）',
        'settle': '決算（交付目論見書。必ず分配を行うものではない）'},
        vals={(J, 'settle'): '年12回（原則として毎月15日、休業日の場合は翌営業日、第1期決算日は2026年7月15日）',
              (J, 'eff'): '年0.658%程度（投資先ETF年0.35%程度を含む。投資先ETFの報酬は2026年1月末現在）',
              (Sx, 'eff'): '年0.1238%程度（投資先ETFの年0.06%程度の報酬は、委託会社が合理的に見積った報酬相当額をファンドに充当。投資先ETFの報酬は2026年2月末現在）',
              (Sx, 'index'): 'ベンチマークなし（投資先ETFはダウ・ジョーンズ US ディビデンド 100 インデックスに連動を目指す。交付目論見書の2026年2月末現在の情報）',
              (J, 'ter'): '0.65%（作成対象期間2026/5/11〜2026/7/15）',
              (Sx, 'ter'): '0.19%※（作成対象期間2025/8/26〜2026/2/25。投資先ETFにかかる報酬を反映するが、委託会社が合理的に見積った報酬相当額をファンドに別途充当）'})
    for c_ in (f'{J}-hedge', f'{Sx}-hedge'):
        p.claims[c_]['exceptions'] += cav_exc
    body += P(S(p, 'feehead', '総経費率には、原則として購入時手数料（募集手数料）、売買委託手数料、有価証券取引税が含まれません。対象期間と、含まれる費用の範囲をそろえて読む必要があります。'))
    body += P(S(p, f'{J}-ter', FUNDS[J]['ter_ak_note']),
              S(p, 'tersrc', '楽天・SCHD（四半期決算型）の総経費率は、交付目論見書の（参考情報）欄に載っている、対象期間2025年8月26日〜2026年2月25日について年率に直した参考値です。'),
              S(p, 'tersrc', '2本の資料とも、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なると注記しています。'))
    body += P(eff_note_sentence(p, J), eff_note_sentence(p, Sx))
    body += P(S(p, 'lendpair', f'2本の交付目論見書はどちらも、その他の費用・手数料のひとつに貸付有価証券関連報酬を挙げ、有価証券の貸付取引を行った場合は、投資信託財産の収益となる品貸料に{FUNDS[J]["lend_rate"]}を乗じて得た額としています。'),
              S(p, 'lendpair', '表の信託報酬と実質的な信託報酬は、貸付を行った場合のこの額を含まない率です。'))
    body += P(S(p, 'othercost', '2本の交付目論見書はどちらも、信託事務の処理に要する諸費用、投資信託財産にかかる監査報酬、法定書類の作成・印刷・交付にかかる費用、その他投資信託財産の運営にかかる費用、組入有価証券の売買委託手数料、外貨建資産の保管に要する費用、貸付有価証券関連報酬などを「その他の費用・手数料」とし、原則として受益者の負担として投資信託財産中から支払うと定めています（委託会社がその一部またはすべてを負担する場合があります）。'),
              S(p, 'othercost', '表の信託報酬と実質的な信託報酬は、これらのその他の費用・手数料を含まない率です。2本とも、これらの費用・手数料は運用状況により変動するため、事前に料率や上限額を表示できないと書かれています。'))
    body += P(S(p, 'rakuten-schd-terfund', f'※楽天・SCHD（四半期決算型）の0.19%（作成対象期間2025年8月26日〜2026年2月25日の年率換算の参考値で、原則として募集手数料・売買委託手数料・有価証券取引税を含まず、ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合があります）には、投資先ETFにかかる年0.06%程度の報酬が反映されていますが、委託会社が合理的に見積った報酬相当額をファンドに別途充当しています（詳しくは「{cost_title}」の節）。'))

    # ================= 仕組み
    body += S(p, f'{J}-index', f'<h2 id="mechanism">{mech_title}</h2>')
    body += P(S(p, 'jepi-etfs', f'楽天・JEPIは、第1期の交付運用報告書（作成対象期間2026年5月11日〜2026年7月15日）によると、マザーファンドを通じて、米ドル建ての「JPモルガン・米国株式・プレミアム・インカムETF」と「JPモルガン・米国株式・プレミアム・インカム・アクティブUCITS ETF」を実質的な投資対象とします（交付目論見書が投資対象として挙げるのもこの2本で、2026年1月末現在の情報であり、今後変更になる場合があり、{cav_txt}）。'),
              S(p, 'jepi-alloc', '月次レポート（2026年8月31日作成基準）では、マザーファンドの純資産総額に対する比率は前者が98.1%で、後者は「-」です。'),
              S(p, f'{J}-index', f'交付目論見書によると、投資先のETFは、米国の株式を保有しつつ、株式のコール・オプション（買う権利）を売却する「カバード・コール戦略」を採用しています（{cav_txt}）。'),
              S(p, 'jepi-etfpol', '交付目論見書の「投資対象ファンドの概要」（2026年1月末現在の情報で、今後変更になる場合があります）は、投資先ETFの運用の基本方針を、米国の大型株とオプションの売却を組み合わせたポートフォリオからインカムを獲得し、株式の配当金とオプションプレミアムを原資として毎月分配を目指す、としています。'))
    body += P(S(p, 'jepi-cap', '交付目論見書と月次レポートの投資リスクの欄は、カバード・コール戦略を、一定の水準以上の株価上昇による値上がり益を放棄する代わりに、コール・オプションの売却によるプレミアム（収益）の獲得を目指す運用手法と説明しています。'),
              S(p, 'jepi-cap', 'そのため、原資産である米国株価指数やそれに連動するETF等が目標水準を超えて上昇した場合でも、その上昇分を享受できず、楽天・JEPIの基準価額の上昇が制限される可能性があると書かれています。'),
              S(p, 'jepi-cap', '一方、同じ欄は、投資先ETFに組み入れられた株式の価格が下落した場合は基準価額の下落要因になるとしています。'),
              S(p, 'jepi-opt', 'コール・オプションの売却は投資先のETFの中で、株価連動債券を通じて、または直接的に行われ、オプション価格が大きく変動して投資先ETFの基準価額に影響を与える可能性があるとも書かれています。'),
              S(p, 'jepi-direct', f'楽天・JEPI自体は、主な投資制限として、株式への直接投資とデリバティブの直接利用を行わないと定めています（{cav_txt}）。'))
    body += P(S(p, f'{Sx}-index', f'楽天・SCHD（四半期決算型）は、マザーファンドを通じて「シュワブ・米国配当株式ETF」に投資し、交付目論見書の「投資対象ファンドの概要」（2026年2月末現在の情報で、今後変更になる場合があります）によると、このETFはダウ・ジョーンズ US ディビデンド 100 インデックスに連動する投資成果を目指します（{cav_txt}）。'),
              S(p, 'nocc', '楽天・SCHDの交付目論見書には、オプションやカバード・コール戦略についての記載がありません。'),
              S(p, 'nobm2', '2本とも、交付目論見書上のベンチマークはありません。'),
              S(p, 'site', '楽天・SCHDの投資先ETFの銘柄や業種の内訳は、<a href="../rakuten-schd-vs-rakuten-vym/">楽天・SCHD vs 楽天・VYM</a>と<a href="../sbi-spyd-vs-rakuten-schd/">SBI・SPDR・S&amp;P500高配当 vs 楽天・SCHD</a>でも扱っています。'))
    body += P(S(p, 'comp-j', '2026年8月末現在、楽天・JEPIの投資先ETFのうち「JPモルガン・米国株式・プレミアム・インカムETF」は投資銘柄数が135で、組入1位のマイクロソフトが2.0%、業種別では情報技術が15.4%で最も大きく、ヘルスケアは12.1%です（月次レポートの値で、比率はETFの純資産総額に対する比率）。'),
              S(p, 'comp-s', '同じ2026年8月末現在、楽天・SCHDの投資先ETF「シュワブ・米国配当株式ETF」は投資銘柄数が103で、組入1位のメルクが4.8%、業種別ではヘルスケアが21.3%で最も大きく、情報技術は8.7%です（月次レポートの値で、比率はETFの純資産総額に対する比率）。'),
              S(p, 'perf', f'運用の仕組みも組入銘柄も違うため、比較期間（{per}）の税引前分配金再投資ベースの実績の差は、費用の差だけでは説明できません。'))
    # NISA・信託期間・特化型
    body += S(p, 'jepi-nisa', '<h3 id="nisa">NISAの対象かどうか、信託期間、特化型運用</h3>')
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">項目</th><th scope="col">楽天・JEPI</th><th scope="col">楽天・SCHD（四半期決算型）</th></tr></thead><tbody>'
    t += (f'<tr><th scope="row">{S(p, "jepi-nisa", "NISA（交付目論見書の課税関係の欄。楽天・JEPIは使用開始日2026年4月27日、楽天・SCHDは使用開始日2026年5月26日の版）")}</th>'
          f'<td>{S(p, "jepi-nisa", "対象ではない")}</td><td>{S(p, "schd-nisa", "成長投資枠（特定非課税管理勘定）の対象（販売会社により取扱いが異なる場合がある）")}</td></tr>')
    t += (f'<tr><th scope="row">{S(p, "jepi-term", "信託期間（交付目論見書）")}</th>'
          f'<td>{S(p, "jepi-term", "2036年4月14日まで（一定の条件により延長または繰上償還する場合がある）")}</td><td>{S(p, "schd-term", "無期限（一定の条件により繰上償還する場合がある）")}</td></tr>')
    t += (f'<tr><th scope="row">{S(p, "jepi-tokka", "特化型運用の表示（交付目論見書）")}</th>'
          f'<td>{S(p, "jepi-tokka", "あり")}</td><td>{S(p, "schd-notokka", "記載なし")}</td></tr>')
    t += '</tbody></table></div>'
    body += t
    body += P(S(p, 'jepi-tokka', '楽天・JEPIの交付目論見書は、投資先のETFに、一般社団法人資産運用業協会規則で定める寄与度が10%を超える、または超える可能性の高い支配的な銘柄が存在するため、特定の銘柄への投資が集中することがあるとして「特化型運用」と表示し、その銘柄のエクスポージャーが投資信託財産の純資産総額の35%を超えないように運用するとしています（' + cav_txt + '）。'),
              S(p, 'jepi-tokka', '同じ箇所は、その銘柄に財政難、経営不振等が生じた場合またはそれが予想される場合には、大きな損失が発生することがあるとも書いています。'))
    body += P(S(p, 'taxboth', '2本の交付目論見書の税金の表はどちらも、個人投資者の源泉徴収時の税率として、分配時の普通分配金と、換金（解約）時・償還時の差益（譲渡益）にそれぞれ20.315%としています（楽天・JEPIは2026年1月末現在、楽天・SCHDは2026年2月末現在の記載。課税方法等により異なる場合があり、外国税額控除の適用となった場合は分配時の税金が異なる場合があり、法人の場合は異なり、NISAの対象のファンドを、非課税口座の開設など一定の条件に該当する方がNISAで利用した場合は、一定の額を上限として、毎年一定額の範囲で新たに購入した分から生じる配当所得と譲渡所得が非課税になります）。'),
              S(p, 'schd-nisa', '楽天・SCHD（四半期決算型）の交付目論見書（使用開始日2026年5月26日）は、NISAの「成長投資枠（特定非課税管理勘定）」の対象としたうえで、販売会社により取扱いが異なる場合があるとし、NISAを利用できるのは販売会社で非課税口座を開設するなど一定の条件に該当する方としています。'),
              S(p, 'jepi-nisa', '楽天・JEPIの交付目論見書（使用開始日2026年4月27日）は「当ファンドは、NISAの対象ではありません」としており、その理由は書かれていません。'))
    # 分配
    body += S(p, 'distpair', '<h3 id="dist">分配金：毎月決算と年4回決算</h3>')
    t = ('<div class="scroll-wrap"><table><thead><tr><th scope="col">ファンド</th><th scope="col">' + S(p, 'distpair', f'決算日（比較期間{per}のもの）') + '</th><th scope="col" class="num">'
         + S(p, 'distpair', '分配金（1万口当たり・税引前。過去の実績で、将来の水準を示さない）') + '</th></tr></thead><tbody>')
    for cid_, nm, rows_ in (('distA', '楽天・JEPI', ra), ('distB', '楽天・SCHD（四半期決算型）', rb)):
        for d_, v_ in rows_:
            t += f'<tr><th scope="row">{nm}</th><td>{S(p, cid_, jd(d_.replace("/", "-")))}</td><td class="num">{S(p, cid_, f"{v_}円")}</td></tr>'
    t += '</tbody></table></div>'
    body += t
    body += P(S(p, f'{J}-settle', '楽天・JEPIの決算日は原則として毎月15日（休業日の場合は翌営業日）で、交付目論見書は第1期決算日を2026年7月15日としています。'),
              S(p, f'{Sx}-settle', '楽天・SCHD（四半期決算型）の決算日は、原則として2・5・8・11月の各25日（休業日の場合は翌営業日）です。'),
              S(p, 'distpair', f'比較期間（{per}）に決算日が来た分配は楽天・JEPIが3回、楽天・SCHDが2回で、表はその全部です。金額は1万口当たり・税引前の過去の実績で、将来の分配金の水準を示すものではありません。'),
              S(p, 'distpair', '基準価額の水準も決算の回数も違う2本の、1万口当たりの円の金額どうしでは、利回りの高低を比べられません。'),
              S(p, 'distpolicy', '2本とも、分配金額は収益分配方針に基づいて委託会社が決め、あらかじめ一定の額の分配を約束するものではなく、支払われない場合もあります。'))
    body += P(S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われた金額に相当する分、基準価額は下がります。'),
              S(p, 'distover', '2本の交付目論見書はどちらも、分配金は計算期間中に発生した収益を超えて支払われる場合があり、その場合は当期決算日の基準価額が前期決算日と比べて下落すること、分配金の水準は必ずしも計算期間におけるファンドの収益率を示すものではないことを書いています。'),
              S(p, 'perf', f'冒頭の比較表の値（比較期間{per}）は、分配金を受け取らずに税引前のまま再投資したと仮定した値です。'))
    body += P(S(p, 'jepi-d1', '分配金がファンドのどの収益から出たかは、交付運用報告書の分配金の表で確認できます。楽天・JEPIの第1期（作成対象期間2026年5月11日〜2026年7月15日）では、当期分配金65円（1万口当たり・税込）の内訳は「当期の収益」が65円、「当期の収益以外」が「－」です。'),
              S(p, 'incdef', '同じ表の注では、「当期の収益」は経費控除後の配当等収益と経費控除後の有価証券売買等損益、「当期の収益以外」は収益調整金と分配準備積立金です。'),
              S(p, 'schd-d45', '楽天・SCHD（四半期決算型）は、交付運用報告書の作成対象期間が2025年8月26日〜2026年2月25日（第4期・第5期）で、この2期の当期分配金85円と90円（1万口当たり・税込）はどちらも「当期の収益」と同額、「当期の収益以外」は「－」です。'),
              S(p, 'd-unpub', f'楽天・JEPIの2026年8月17日・2026年9月15日の決算と、楽天・SCHDの2026年5月25日・2026年8月25日の決算の内訳は、{jd(GOT)}に運用会社のサイトに掲載されていたこれらの交付運用報告書の作成対象期間より後なので、載っていません。'))
    body += P(S(p, 'pdef', '投資者が受け取る分配金が普通分配金か元本払戻金（特別分配金）かは、ファンドの決算の内訳とは別に、投資者ごとの個別元本（ファンドの購入価額）で決まります。2本の交付目論見書は、個別元本を上回る部分からの分配金を普通分配金、個別元本を下回る部分からの分配金を元本払戻金（特別分配金）とし、分配後の個別元本は元本払戻金（特別分配金）の額だけ減少すると説明しています。'))

    # ================= 費用の内訳
    d = round(0.658 - 0.1238, 4); amt = round(d / 100 * 1_000_000)
    assert (d, amt) == (0.5342, 5342)
    body += S(p, 'effpair', f'<h2 id="cost-detail">{cost_title}</h2>')
    body += P(S(p, f'{J}-eff', '楽天・JEPIは国内ファンド分の信託報酬が年0.308%（税込）で、投資先ETFの管理報酬等の年0.35%程度（2026年1月末現在の値で、今後、投資内容等により変動します）を加味した、実質的に負担する運用管理費用が年0.658%程度（税込・交付目論見書の概算で目安であり、組入状況・運用状況により変動。その他の費用と貸付時の報酬を除く）です。'),
              S(p, f'{Sx}-eff', '楽天・SCHD（四半期決算型）は信託報酬が年0.1238%（税込）で、交付目論見書は、投資先ETFで日々控除される年0.06%程度の報酬（2026年2月末現在の値で、今後、投資内容等により変動します）について委託会社が合理的に見積った相当額をファンドに充当するとし、実質的に負担する運用管理費用を年0.1238%程度（税込・概算で目安であり、組入状況・運用状況により変動。その他の費用と貸付時の報酬を除く）と表示しています。'),
              S(p, 'effgap', f'この2つの概算（交付目論見書の税込の料率で、その他の費用と貸付時の報酬を除く）の差は年{d}ポイント程度で、100万円を1年間一定額で保有すると仮定した目安は約{amt:,}円です。この金額は実際の利益差ではありません。'))
    body += P(S(p, f'{J}-ter', '楽天・JEPIの総経費率は、第1期の交付運用報告書（作成対象期間2026年5月11日〜2026年7月15日）で年率0.65%です（年率換算の参考値で、原則として募集手数料・売買委託手数料・有価証券取引税を含まず、ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は運用会社等より入手した概算値の場合があります）。'),
              S(p, 'jepi-terbrk', '内訳は、同じ作成対象期間（2026年5月11日〜2026年7月15日）について①このファンドの費用の比率が0.30%、②投資先ファンドの運用管理費用等の比率が0.35%です（年率換算の参考値で、原則として募集手数料・売買委託手数料・有価証券取引税を含まず、①と②は計上された期間が異なる場合があり、②は運用会社等より入手した概算値の場合があります）。'),
              S(p, 'jepi-terbrk', '作成対象期間は設定日の2026年5月11日から第1期決算日の2026年7月15日までで、1年分の実績ではなく、この期間の費用を年率に直した値です。'))
    body += P(S(p, f'{Sx}-ter', '楽天・SCHD（四半期決算型）の総経費率は、作成対象期間2025年8月26日〜2026年2月25日について年率0.19%です（年率換算の参考値で、原則として募集手数料・売買委託手数料・有価証券取引税を含まず、ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は運用会社等より入手した概算値の場合があり、投資先ETFにかかる報酬が反映されていますが、委託会社が合理的に見積った報酬相当額をファンドに別途充当しています）。'),
              S(p, 'schd-terbrk', '交付運用報告書の内訳は、同じ作成対象期間（2025年8月26日〜2026年2月25日）について①このファンドの費用の比率が0.13%、②投資先ファンドの運用管理費用等の比率が0.06%です（年率換算の参考値で、原則として募集手数料・売買委託手数料・有価証券取引税を含まず、①と②は計上された期間が異なる場合があり、②は運用会社等より入手した概算値の場合があり、②の報酬については、委託会社が合理的に見積った報酬相当額をファンドに別途充当しています）。'),
              S(p, 'rakuten-schd-terfund', 'この0.19%（作成対象期間2025年8月26日〜2026年2月25日の年率換算の参考値）には投資先ETFにかかる年0.06%程度の報酬が反映されていますが、交付目論見書と交付運用報告書は、委託会社が合理的に見積った報酬相当額をファンドに別途充当していると注記しています。'),
              S(p, 'terpair', '2本の総経費率（年率換算の参考値）は作成対象期間が重なっておらず（楽天・SCHDが2025年8月26日〜2026年2月25日、楽天・JEPIが2026年5月11日〜2026年7月15日）、楽天・SCHDには充当の扱いもあるため、0.65%と0.19%の差をそのまま負担の差として読むことはできません。'))
    body += method_section(p)
    body += faq_block(p, [
        (f'{J}-index', '両者の違いは何ですか？', [
            (f'{J}-index', f'投資先のETFの運用が違います。楽天・JEPIの投資先ETFは、交付目論見書によると、米国の株式を保有しつつ株式のコール・オプション（買う権利）を売却するカバード・コール戦略を採用しています（{cav_txt}）。'),
            (f'{Sx}-index', '楽天・SCHD（四半期決算型）の投資先ETFは、交付目論見書の2026年2月末現在の情報では、ダウ・ジョーンズ US ディビデンド 100 インデックスに連動する投資成果を目指します。'),
            ('settlepair', '決算は楽天・JEPIが原則として毎月15日（第1期決算日は2026年7月15日で、設定された2026年5月と翌6月の決算はありません）、楽天・SCHDが原則として2・5・8・11月の各25日です（どちらも休業日の場合は翌営業日で、必ず分配を行うものではありません）。')]),
        ('jepi-cap', 'カバード・コール戦略で上昇が制限されるとは、どういうことですか？', [
            ('jepi-cap', '楽天・JEPIの交付目論見書は、カバード・コール戦略を、一定の水準以上の株価上昇による値上がり益を放棄する代わりに、コール・オプションの売却によるプレミアム（収益）の獲得を目指す運用手法と説明しています。原資産である米国株価指数やそれに連動するETF等が目標水準を超えて上昇した場合でも、その上昇分を享受できず、基準価額の上昇が制限される可能性があるとしています。'),
            ('jepi-cap', '株式の価格が下落した場合は、基準価額の下落要因になります。')]),
        ('jepi-nisa', '楽天・JEPIはNISAの対象ですか？', [
            ('jepi-nisa', '交付目論見書（使用開始日2026年4月27日）の課税関係の欄には「当ファンドは、NISAの対象ではありません」と書かれています。'),
            ('schd-nisa', '楽天・SCHD（四半期決算型）の交付目論見書（使用開始日2026年5月26日）は、NISAの「成長投資枠（特定非課税管理勘定）」の対象で、販売会社により取扱いが異なる場合があるとしています。')]),
        ('jepi-d1', '楽天・JEPIの分配金は、どの収益から出ていますか？', [
            ('jepi-d1', '第1期（作成対象期間2026年5月11日〜2026年7月15日）の交付運用報告書では、当期分配金65円（1万口当たり・税込）は「当期の収益」が65円で、「当期の収益以外」は「－」です。'),
            ('d-unpub', f'2026年8月17日と2026年9月15日の決算の内訳は、{jd(GOT)}に運用会社のサイトに掲載されていた交付運用報告書（第1期・作成対象期間2026年5月11日〜2026年7月15日）の作成対象期間より後なので、載っていません。'),
            ('pdef', '投資者ごとに普通分配金になるか元本払戻金（特別分配金）になるかは、その人の個別元本（ファンドの購入価額）で決まり、ファンドの決算の内訳とは別です。')]),
        faq_net(p),
        ('effpair', '費用はどちらが低いですか？', [
            ('effpair', '投資先ETFの報酬を加味した実質的な信託報酬（税込年率・交付目論見書の概算で目安）は、楽天・JEPIが年0.658%程度（投資先ETFの報酬は2026年1月末現在の値）、楽天・SCHD（四半期決算型）が年0.1238%程度（投資先ETFの報酬は2026年2月末現在の値で、委託会社が合理的に見積った報酬相当額をファンドに充当）で、どちらも組入状況や運用状況によって変動し、その他の費用と、有価証券の貸付を行った場合の報酬は含みません。'),
            ('terpair', '総経費率（年率換算の参考値で、原則として購入時手数料（募集手数料）・売買委託手数料・有価証券取引税を含まない）は楽天・JEPIが0.65%（作成対象期間2026年5月11日〜2026年7月15日）、楽天・SCHDが0.19%（作成対象期間2025年8月26日〜2026年2月25日）で、作成対象期間が重なっていません。どちらも、ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合があります。楽天・SCHDの0.19%（作成対象期間2025年8月26日〜2026年2月25日の年率換算の参考値で、原則として募集手数料・売買委託手数料・有価証券取引税を含まず、ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合があります）には投資先ETFにかかる報酬が反映されていますが、委託会社が合理的に見積った報酬相当額をファンドに別途充当しています。')]),
    ])
    sections = std_sections('mechanism', mech_title, cost_title)
    related = [('../rakuten-schd-vs-rakuten-vym/', '楽天・SCHD vs 楽天・VYM', '楽天・SCHDを、FTSEの高配当指数に連動するファンドと比べる'),
               ('../sbi-spyd-vs-rakuten-schd/', 'SBI・SPDR・S&P500高配当 vs 楽天・SCHD', '楽天・SCHDを、S&P500高配当指数のファンドと比べる'),
               ('../rakuten-schd-vs-sbi-vym/', '楽天・SCHD vs SBI・V・米国高配当（年4回）', '楽天・SCHDを、SBIのVYM型と比べる'),
               ('../haitokin-kakutei-shinkoku/', '配当金と確定申告', '分配金・配当金の税金の扱いを確かめる')]
    return p, title, desc, body, sections, related


# ======================================================================== 9. eMAXIS Slim Nikkei vs Tawara Nikkei 225 (2026-10-09)
def nk_fee_note(p):
    """Notes under the fee table for the Nikkei pair (both prospectuses print the TER in （参考情報）; the 'reference only' caveat is in the annual reports)."""
    A, B = p.A, p.B
    h = P(S(p, 'feehead', '2本の総経費率には、原則として購入時手数料、売買委託手数料、有価証券取引税が含まれず、消費税等のかかる費用は消費税等を含みます。'),
          S(p, 'feehead', '対象期間と、含まれる費用の範囲をそろえて読む必要があります。'))
    p.claims['feehead']['exceptions'] += ' 同じ注のかっこ書: eMAXIS側「' + Q('enk_P', r'消費税等 のかかるものは消費税等を含む。') + '」、たわら側「' + Q('tnk_P', r'消費税等のかかるもの は消費税等を含みます。') + '」（本文の同じ文に書いた）。'
    p.docq('ternote-t', 'たわらノーロード日経225の総経費率の注: ファンドにより計算に含まれない費用が存在する場合があるが、このファンドは入手し得る情報において計算に含まれていない費用は無い', 'tnk_P',
           r'※総経費率には、 ファンドにより購入時手数料、売買委託手数料および有価証券取引税以外にも計算に含まれない費用が存在する場合があります。 ※なお、当ファンドについては、入手し得る情報において計算に含まれていない費用はありません。',
           '交付目論見書の（参考情報）ファンドの総経費率の欄の注（対象期間2024年10月16日〜2025年10月14日）。eMAXIS側の同じ欄にこの注は無い（「入手し得る情報」で全文検索して0件）。')
    assert '入手し得る情報' not in text('enk_P')
    p.docq('tersrc', '総経費率は直近の運用報告書の作成対象期間について年率換算した参考値で、2本の交付目論見書の（参考情報）欄に載っている。2本の交付運用報告書は実際に発生した費用の比率とは異なると注記している', 'enk_P',
           r'（参考情報） ファンドの総経費率 直近の運用報告書作成対象期間（以下「当期間」 といいます。 （）2025年４月26日～2026年４月27日） における 当ファンドの総経費率は以下の通りです。',
           '交付目論見書の（参考情報）欄の見出しと対象期間で確認。「参考」であり実際に発生した費用の比率とは異なる旨は2本の交付運用報告書の注記で確認し、本文に書いた。',
           extra_doc=[('tnk_P', r'（参考情報） ファンドの総経費率 総経費率 （①＋②） 運用管理費用の比率① その他費用の比率② 0\.14％ 0\.14％ 0\.00％ （表示桁数未満を四捨五入） ※対象期間：2024年10月16日～2025年10月14日'),
                      ('enk_Ak', r'（注）各比率は、年率換算した値です。 （注）前記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比 率とは異なります。'),
                      ('tnk_Ak', r'（注４）上記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比率と異なります。')])
    p.claims['tersrc']['scope'] = '2本の交付目論見書の（参考情報）欄と交付運用報告書の総経費率（それぞれの作成対象期間・年率換算）'
    h += P(S(p, 'tersrc', '表の総経費率は、直近の運用報告書の作成対象期間について年率換算した参考値で、2本とも交付目論見書の（参考情報）欄に載っている値です。'),
           S(p, 'tersrc', '2本の交付運用報告書は、総経費率などの値について、あくまでも参考であり、実際に発生した費用の比率とは異なると注記しています。'),
           S(p, 'emaxis-nk-terd', f'{A["short"]}の総経費率{A["ter"]}（対象期間{A["ter_period"]}の年率で、原則として購入時手数料・売買委託手数料・有価証券取引税を除く参考値）は交付目論見書が載せている小数第5位までの詳細な値で、同じ欄の小数第2位までの表示は{A["ter_round"]}です（どちらも資料の表示のまま）。'),
           S(p, 'terpair', f'{B["short"]}の総経費率（対象期間{B["ter_period"]}）は小数第2位までの表示しかないため、2本の総経費率の小数第3位以下の差は比べられません。'),
           S(p, 'ternote-t', 'たわらノーロード日経225の交付目論見書は、総経費率（対象期間2024/10/16〜2025/10/14）について、ファンドにより購入時手数料、売買委託手数料、有価証券取引税以外にも計算に含まれない費用が存在する場合があるとしたうえで、このファンドについては入手し得る情報において計算に含まれていない費用はないと注記しています。'))
    p.fc(p.b, 'lend')
    h += P(lend_sentence(p, p.a),
           S(p, 'tawara-nk-lend', 'たわらノーロード日経225の交付目論見書は、投資対象とするマザーファンドで有価証券の貸付の指図を行った場合、マザーファンドの品貸料のうちファンドに属するとみなした額に55%未満（税抜50%）の率を乗じた額を運用管理費用（信託報酬）に含めると定めており、2026年7月14日現在の率は品貸料の49.5%（税抜45%）以内で、この額と通常の信託報酬との合計（税抜）は各計算期間に純資産総額に年0.5%（税抜）を乗じて得た額を超えないとも定めています。'),
           S(p, 'emaxis-nk-lend', '表の信託報酬は、有価証券の貸付の指図を行った場合のこれらの額を含まない率です。'))
    p.docq('othercost', f'{A["short"]}と{B["short"]}の「その他の費用・手数料」（信託報酬の料率に含まれない費用）', 'enk_P',
           r'以下の費用・手数料についてもファンドが負担します。 ・監査法人に支払われるファンドの監査費用 ・有価証券等の売買時に取引した証券会社等に支払われる手数料 その他の費用・ ・有価証券等を海外で保管する場合、海外の保管機関に支払われる費用 手数料 ・その他信託事務の処理にかかる諸費用 等 ※上記の費用・手数料については、売買条件等により異なるため、あらかじめ金額または上限額等を記 載することはできません。',
           '交付目論見書の「その他の費用・手数料」の欄（2段組のため欄見出しが文の途中に挟まって抽出される）。列挙は2本とも「等」で終わるため、本文でも「など」と書いた。同じ欄の注記（eMAXIS側は売買条件等により異なるため金額・上限額等を記載できない、たわら側は定期的に見直されるものや売買条件等により異なるものがあるため料率・上限額等を示せない）を本文に書いた。',
           extra_doc=[('tnk_P', r'その他の費用・手数料として、 お客様の保有期間中、以下の費用等を信託財産からご負担いただ きます。 ・組入有価証券等の売買の際に発生する売買委託手数料 ・信託事務の処理に要する諸費用 ・外国での資産の保管等に要する費用 そ の 他 の ・監査法人等に支払うファンドの監査にかかる費用 等.{0,260}?※これらの費用等は、定期的に見直されるものや売買条件等により異なるものがあるため、事前 に料率・上限額等を示すことができません。')])
    h += P(S(p, 'othercost', '2本の交付目論見書は、信託報酬のほかに、監査費用、有価証券の売買時の手数料、信託事務の処理にかかる諸費用、海外（外国）で資産を保管する場合の費用などを、その他の費用・手数料としてファンドが負担すると定めています。'),
           S(p, 'othercost', 'このその他の費用・手数料について、eMAXIS Slim国内株式（日経平均）の交付目論見書は、売買条件等により異なるため、あらかじめ金額または上限額等を記載できないとしています。'),
           S(p, 'othercost', 'たわらノーロード日経225の交付目論見書は、定期的に見直されるものや売買条件等により異なるものがあるため、事前に料率・上限額等を示すことができないとしています。'),
           S(p, 'othercost', '表の信託報酬は、このその他の費用・手数料を含まない率です。'))
    return h

@article
def a_nikkei():
    p = Page('emaxis-nikkei-vs-tawara-nikkei', 'emaxis-nk', 'tawara-nk', 'emaxis-nk__tawara-nk')
    r = p.r_
    one = r['1年窓']
    A, B = p.A, p.B
    p.title = title = 'eMAXIS Slim国内株式（日経平均） vs たわらノーロード日経225｜費用と実績'
    desc = (f"同じ日経平均トータルリターン・インデックスへの連動を目指す2本を、{jd(r['起点'])}〜{jd(r['終点'])}の基準価額（税引前分配金再投資）で比較。"
            f"100万円の終了時評価額は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}。信託報酬（税込・貸付時の追加分を除く）は2本とも年0.143%以内です。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pair_claim(p, 'idxpair', 'index', '2本とも日経平均トータルリターン・インデックス（配当込みの日経平均株価）への連動を目指す')
    p.claims['idxpair']['exceptions'] += ' 指数の説明: ' + f'{url("tnk_P")}「{Q("tnk_P", r"＊日経平均トータルリターン・インデックスは、配当込みの日経平均株価 （日経２２５） の値動きを示す指数です。")}」'
    pair_claim(p, 'motherpair', 'eff', '2本ともファミリーファンド方式で、マザーファンドを通じて国内の株式に投資する')
    p.claims['motherpair']['exceptions'] = ('交付目論見書の「ファンドの仕組み」「ファンドの特色」で確認。eMAXIS側には「※実際の運用は日経２２５マザーファンドを通じて行います。」、たわら側には「※マザーファンドの組入比率は、原則として高位を保ちます。」の注がある。'
                                             + p.claims['motherpair']['exceptions'].split(' 比較相手: ', 1)[-1].join([' 比較相手: ', '']))
    pair_claim(p, 'settlepair', 'settle', '2本とも決算は年1回で、決算日は休業日の場合は翌営業日')
    p.docq('fut-e', 'eMAXIS Slim国内株式（日経平均）は連動を維持するため先物取引等を利用し、株式の実質投資比率が100%を超える場合がある', 'enk_P',
           r'● 対象インデックスとの連動を維持するため、先物取引等を利用し株式の実質投資比率 が100％を超える場合があります。',
           '交付目論見書の「ファンドの特色」。同じページに「市況動向および資金動向等により、上記のような運用が行えない場合があります。」の注記がある。',
           extra_doc=[('tnk_P', r'※日経平均トータルリターン・インデックスへの連動性を高めるため、有価証券先物取引等を活用する場合があります。')])
    p.docq('comp-e', 'eMAXIS Slim国内株式（日経平均）の組入上位銘柄・銘柄数・資産構成（2026年9月30日現在）', 'enk_M',
           r'ファンド 1\.2% -4\.1% 31\.6% 50\.8% 119\.9% 232\.5% 実質国内株式 99\.9% ベンチマーク 1\.3% -4\.1% 31\.7% 51\.0% 121\.1% 237\.5% 内 現物 98\.1%.{0,80}?内 先物 1\.8%.{0,400}?組入銘柄数: 225銘柄.{0,120}?1 アドバンテスト 電気機器 10\.9% 12\.4%.{0,60}?2 東京エレクトロン 電気機器 8\.8% 8\.9%.{0,60}?3 ファーストリテイリング 小売業 8\.4% 8\.5%.{0,60}?4 ソフトバンクグループ 情報・通信業 7\.6% 7\.7%.{0,60}?5 リクルートホールディングス サービス業 2\.5% 2\.5%',
           '月次レポートの注記: 「・表示桁未満の数値がある場合、四捨五入しています。・原則として、比率は純資産総額に対する割合です。」。同じ表の右の列はベンチマーク構成比（アドバンテスト12.4%など）で、本文の表にはファンドの比率だけを載せた。コールローン他は0.1%。')
    p.docq('comp-t', 'たわらノーロード日経225の組入上位銘柄・銘柄数・ポートフォリオ構成（2026年9月30日基準）', 'tnk_M',
           r'株式等現物 96\.8.{0,120}?株式先物 3\.2.{0,40}?株式実質組入（現物＋先物） 100\.0.{0,900}?（組入銘柄数 225） 銘柄 業種 組入比率 1 アドバンテスト 電気機器 10\.7 2 東京エレクトロン 電気機器 8\.7 3 ファーストリテイリング 小売業 8\.3 4 ソフトバンクグループ 情報・通信業 7\.5 5 リクルートホールディングス サービス業 2\.5',
           '月次レポートの注記: 「※組入比率は、純資産総額に対する実質的な割合です。」「※現金等の中には未払金等が含まれるため、比率が一時的にマイナスとなる場合があります。」。現金等は3.2%。')
    p.docq('nav-e', 'eMAXIS Slim国内株式（日経平均）の純資産総額（2026年9月30日現在）', 'enk_M',
           r'基準価額（１万口当たり） 33,247円.{0,60}?純資産総額 5,551\.83億円', '月次レポートの「基準価額および純資産総額」の欄。純資産総額は日々変わる。')
    p.docq('nav-t', 'たわらノーロード日経225の純資産総額（2026年9月30日基準）', 'tnk_M',
           r'基準価額（円） 40,759 40,260 純資産総額（百万円） 511,999 496,603', 'マンスリーレポートの「基準価額・純資産総額」の欄の当月末の値（単位は百万円）。純資産総額は日々変わる。')
    p.docq('bmgap', '月次レポートの過去3年の騰落率（ファンドとベンチマーク・2026年9月30日）', 'enk_M',
           r'過去1ヵ月 過去3ヵ月 過去6ヵ月 過去1年 過去3年 設定来 比率 ファンド 1\.2% -4\.1% 31\.6% 50\.8% 119\.9% 232\.5%.{0,40}?ベンチマーク 1\.3% -4\.1% 31\.7% 51\.0% 121\.1% 237\.5%',
           'eMAXIS側の注記: 「・実際のファンドでは、課税条件によってお客さまごとの騰落率は異なります。また、換金時の費用・税金等は考慮していません。」「・分配金実績がある場合は、分配金（税引前）を再投資したものとして計算しています。」。たわら側の注記: 「※騰落率は、税引前の分配金を再投資したものとして算出していますので、実際の投資家利回りとは異なります。」。ベンチマークは2本とも日経平均トータルリターン・インデックス。',
           extra_doc=[('tnk_M', r'3年 119\.6 121\.1 -1\.5')])
    p.docq('dist-e', 'eMAXIS Slim国内株式（日経平均）の分配金実績（1万口当たり・税引前）', 'enk_M',
           r'■分配金実績（１万口当たり、税引前） 決算期 決算日 分配金.{0,20}?第9期 2026/04/27 0円 第8期 2025/04/25 0円.{0,20}?第7期 2024/04/25 0円 第6期 2023/04/25 0円.{0,10}?第5期 2022/04/25 0円.{0,60}?第4期 2021/04/26 0円 設定来累計 0円',
           '月次レポートの注記: 「・運用状況によっては、分配金額が変わる場合、あるいは分配金が支払われない場合があります。」。交付目論見書の分配方針: 「' + Q('enk_P', r'分配金額の決定にあたっては、信託財産の成長を優先し、原則として分配を抑制する方針とし ます。 （基準価額水準や市況動向等により変更する場合があります。） 将来の分配金の支払いおよびその金額について保証するものではありません。') + '」。')
    p.docq('dist-t', 'たわらノーロード日経225の分配金の実績（1万口当たり・税引前・直近3年分）', 'tnk_M',
           r'分配金の実績\(税引前\)\(直近3年分\).{0,60}?第8期 2023/10/12 0.{0,20}?第9期 2024/10/15 0.{0,20}?第10期 2025/10/14 0.{0,40}?設定来累計分配金 0',
           'マンスリーレポートの注記: 「※分配金は、1万口当たりの金額です。」「※分配金は過去の実績であり、将来の分配金の支払いおよびその金額について保証するものではありません。」。交付目論見書の分配方針: 「' + Q('tnk_P', r'※分配金額は、分配方針に基づいて委託会社が決定します。あらかじめ一定の額の分配をお約束するものでは ありません。分配金が支払われない場合もあります。') + '」。')
    p.docq('nisapair', '2本ともNISAの成長投資枠とつみたて投資枠の対象（販売会社により取扱いが異なる場合がある）', 'enk_P',
           r'ファンドは、 ＮＩＳＡの 「成長投資枠 （特定非課税管理勘定） およびつみたて投資枠（特定累 積投資勘定） 」 の対象です。 販売会社により取扱いが異なる場合があります。',
           '交付目論見書の「課税関係」の欄。同じ欄・税金の節の注: NISAを利用できるのは販売会社で非課税口座を開設し、税法上の要件を満たした商品を購入するなど一定の条件に該当する方（本文に書いた）。税法が改正された場合等には変更される場合がある（資料の時点の記載と本文に書いた）。',
           extra_doc=[('tnk_P', r'当ファンドは、NISAの 「成長投資枠 （特定非課税管理勘定） 」および 「つみたて投資枠 （特定累積投 資勘定）」の対象ですが、販売会社により取扱いが異なる場合があります。'),
                      ('enk_P', r'ご利用になれるのは、販売会社で非課税口座 を開設し、税法上の要件を満たした商品を購入するなど、一定の条件に該当する方が対象となります。')])
    p.docq('cap-t', 'たわらノーロード日経225の信託報酬①と貸付時の②の合計（税抜）は各計算期間に純資産総額の年0.5%を超えない', 'tnk_P',
           r'以下により計算される①と②の合計額とします。 ただし、 ①により計算される額 （税抜） と②により計算される額 （税抜） の合計額は、 各計算期間にお いてファンドの純資産総額に対して年率0\.5％ （税抜） を乗じて得た額を超えないものとします。',
           '交付目論見書の運用管理費用（信託報酬）の欄。①は純資産総額に対する年率0.143%（税抜0.13%）以内の率、②はマザーファンドで有価証券の貸付の指図を行った場合の額。eMAXIS側の交付目論見書に、この種の合計の上限の定めは無い（「超えないもの」で全文検索して0件）。')
    assert '超えないもの' not in text('enk_P')
    p.docq('bmchg-t', 'たわらノーロード日経225は2025年1月16日にベンチマークを日経平均株価（日経225）から日経平均トータルリターン・インデックスに変更した', 'tnk_Ak',
           r'約款変更のお知らせ ■当ファンドおよび当ファンドが投資対象とする「インデックス225 マザーファンド」において、ベン チマークを日経平均株価（日経225）から日経平均トータルリターン・インデックスに変更しました。 （2025年１月16日）',
           '交付運用報告書（作成対象期間2024年10月16日〜2025年10月14日）の「お知らせ」。同じ資料の注: 「' + Q('tnk_Ak', r'＊ベンチマークの変更に伴い、2025年10月14日決算の運用報告書から「配当込み」の指数に変更しました（以下同じ）。') + '」、運用経過: 「' + Q('tnk_Ak', r'ベンチマークである日経平均株価（2025年１月16日以降は、日経平均トータルリターン・インデッ クス）に連動する投資成果を目標に運用を行いました。') + '」。eMAXIS側の交付目論見書・交付運用報告書に、ベンチマークの変更の記載は無い（「ベンチマークを」「ベンチマークの変更」で全文検索して確認）。比較期間（2023年9月29日〜2026年9月30日）はこの変更日をまたぐ旨を本文に書いた。')
    assert 'ベンチマークの変更' not in text('enk_P') + text('enk_Ak')
    PERIOD = f"{jd(r['起点'])}〜{jd(r['終点'])}"
    lead = P(perf_lead(p, '結論から言うと、'), dd_line(p),
             S(p, 'perf', '2本は、' + jd(GOT) + 'に確認した交付目論見書では同じ指数への連動を目指しており、' + corr_period(p) + f"小数第4位までの表示で{r['同日相関']:.4f}でした。"),
             S(p, 'bmchg-t', 'たわらノーロード日経225は、2025年1月16日にベンチマークを日経平均株価（日経225）から日経平均トータルリターン・インデックスに変更しており（交付運用報告書の約款変更のお知らせ）、比較期間（' + PERIOD + '）はこの変更日をまたいでいます。'))
    lead += P(S(p, 'feepair', '信託報酬（税込年率・ファンド本体・有価証券の貸付を行った場合の追加分を除く）は、eMAXIS Slim国内株式（日経平均）が年0.143%以内（純資産総額に応じた段階制）、たわらノーロード日経225が年0.143%以内（2026年7月14日現在は年0.143%）です。'),
              ter_line(p, '・原則として購入時手数料、売買委託手数料、有価証券取引税を除く'),
              S(p, 'nisapair', '2本とも、交付目論見書（eMAXIS Slim国内株式（日経平均）は使用開始日2026年7月25日、たわらノーロード日経225は使用開始日2026年7月15日）にNISAの「成長投資枠」と「つみたて投資枠」の対象と書かれており、販売会社により取扱いが異なる場合があります。'))
    p.lead = lead_block(p, lead)
    body = perf_section(p)
    body += P(S(p, 'bmgap', '2026年9月30日現在の各社の月次レポートでは、過去3年の騰落率（税引前の分配金を再投資したものとして計算した累積の値で、投資者ごとの実際の利回りとは異なります）が、ベンチマークの日経平均トータルリターン・インデックス121.1%に対し、eMAXIS Slim国内株式（日経平均）が119.9%、たわらノーロード日経225が119.6%です。'),
              S(p, 'perf', f'この記事が基準価額から計算した比較期間（{PERIOD}）の累積騰落率（{pct(r["A累積"])}と{pct(r["B累積"])}・税引前分配金再投資）は、小数第1位に四捨五入すると月次レポートのこの値（119.9%と119.6%）と一致します。'))
    fs = fee_section(p, vals={(p.a, 'ter'): f'{A["ter"]}（対象期間{A["ter_period"]}）', (p.b, 'ter'): f'{B["ter"]}（対象期間{B["ter_period"]}）'})
    ctx = S(p, 'feehead', f'<p data-review-context="before-table">次の表は{jd(GOT)}に確認した交付目論見書（eMAXIS Slim国内株式（日経平均）は使用開始日2026年7月25日、たわらノーロード日経225は使用開始日2026年7月15日）の記載で、料率は税込の年率、総経費率は表の対象期間についての年率換算の参考値です。</p>')
    assert fs.count('<div class="scroll-wrap">') == 1
    body += fs.replace('<div class="scroll-wrap">', ctx + '<div class="scroll-wrap">') + nk_fee_note(p)
    body += S(p, 'idxpair', '<h2 id="mechanism">同じ指数への連動を目指す2本の、組入比率・設定日・決算日</h2>')
    body += P(S(p, 'idxpair', '2本とも、配当込みの日経平均株価（日経225）の値動きを示す日経平均トータルリターン・インデックスへの連動を目指します。'),
              S(p, 'idxpair', 'eMAXIS Slim国内株式（日経平均）はこの指数をベンチマークとし、たわらノーロード日経225はこの指数の動きに連動する投資成果をめざすと、それぞれの交付目論見書に書いています。'),
              S(p, 'bmchg-t', 'たわらノーロード日経225の交付運用報告書（作成対象期間2024年10月16日〜2025年10月14日）は、約款変更のお知らせとして、このファンドとマザーファンドのベンチマークを2025年1月16日に日経平均株価（日経225）から日経平均トータルリターン・インデックスに変更したと書いています。'),
              S(p, 'motherpair', '2本ともファミリーファンド方式で、eMAXIS Slim国内株式（日経平均）は日経225マザーファンド、たわらノーロード日経225はインデックス225マザーファンドへの投資を通じて国内の株式に投資します。'))
    rows = [('アドバンテスト', '10.9%', '10.7%'), ('東京エレクトロン', '8.8%', '8.7%'), ('ファーストリテイリング', '8.4%', '8.3%'),
            ('ソフトバンクグループ', '7.6%', '7.5%'), ('リクルートホールディングス', '2.5%', '2.5%'), ('株式の現物', '98.1%', '96.8%'), ('株式の先物', '1.8%', '3.2%')]
    t = S(p, 'comp-e', '<p data-review-context="before-table">次の表は、2026年9月30日現在の各社の月次レポートに載っている、純資産総額に対する比率です（組入上位5銘柄と、株式の現物・先物の比率）。</p>')
    t += '<div class="scroll-wrap"><table><thead><tr><th scope="col">' + S(p, 'comp-e', '銘柄・資産（2026年9月30日・純資産総額に対する比率）') + '</th><th scope="col" class="num">eMAXIS Slim</th><th scope="col" class="num">たわら</th></tr></thead><tbody>'
    for n, a_, b_ in rows:
        t += f'<tr><th scope="row">{n}</th><td class="num">{S(p, "comp-e", a_)}</td><td class="num">{S(p, "comp-t", b_)}</td></tr>'
    t += '</tbody></table></div>'
    body += t + P(S(p, 'comp-e', '2026年9月30日現在の月次レポートでは、eMAXIS Slim国内株式（日経平均）の組入銘柄数は225銘柄で、純資産総額に対する比率は株式の現物98.1%・先物1.8%（実質国内株式99.9%）です。'),
                  S(p, 'comp-t', '2026年9月30日基準のマンスリーレポートでは、たわらノーロード日経225の組入銘柄数は225で、純資産総額に対する実質的な比率は株式等現物96.8%・株式先物3.2%（株式実質組入100.0%）です。'))
    body += P(S(p, 'fut-e', 'eMAXIS Slim国内株式（日経平均）の交付目論見書は、対象インデックスとの連動を維持するため、先物取引等を利用し株式の実質投資比率が100%を超える場合があるとしています。'),
              S(p, 'fut-e', 'たわらノーロード日経225の交付目論見書は、指数への連動性を高めるため、有価証券先物取引等を活用する場合があるとしています。'))
    body += P(S(p, 'nav-e', '純資産総額は、eMAXIS Slim国内株式（日経平均）が2026年9月30日現在で5,551.83億円です。'),
              S(p, 'nav-t', 'たわらノーロード日経225の純資産総額は、2026年9月30日基準で511,999百万円（億円に直すと5,119.99億円）です。'))
    body += P(S(p, 'emaxis-nk-incept', 'eMAXIS Slim国内株式（日経平均）の設定日は2018年2月2日です。'),
              S(p, 'tawara-nk-incept', 'たわらノーロード日経225の設定日は2015年12月7日です。'),
              S(p, 'settlepair', '決算は2本とも年1回で、決算日はeMAXIS Slim国内株式（日経平均）が毎年4月25日、たわらノーロード日経225が毎年10月12日です（どちらも休業日の場合は翌営業日）。'))
    body += P(S(p, 'dist-e', 'eMAXIS Slim国内株式（日経平均）の分配金（1万口当たり・税引前）は、2026年9月30日現在の月次レポートに載っている第4期（2021年4月26日決算）から第9期（2026年4月27日決算）までの各期が0円で、設定来累計も0円です。'),
              S(p, 'dist-t', 'たわらノーロード日経225の分配金（1万口当たり・税引前）は、2026年9月30日基準のマンスリーレポートに載っている第8期（2023年10月12日決算）から第10期（2025年10月14日決算）までの各期が0円で、設定来累計も0円です。'),
              S(p, 'dist-e', '分配金は過去の実績で、eMAXIS Slim国内株式（日経平均）の交付目論見書は、信託財産の成長を優先し、原則として分配を抑制する方針（基準価額水準や市況動向等により変更する場合があります）としています。'),
              S(p, 'dist-t', 'たわらノーロード日経225の交付目論見書は、分配金額は分配方針に基づいて委託会社が決定し、分配金が支払われない場合もあるとしています。'))
    body += S(p, 'feepair', '<h2 id="cost-detail">信託報酬（貸付時の追加分を除く）の上限は2本で同じ。決め方が違う</h2>')
    body += P(S(p, 'emaxis-nk-fee', 'eMAXIS Slim国内株式（日経平均）の信託報酬（税込・有価証券の貸付を行った場合の追加分を除く）は純資産総額に応じた段階制で、2,500億円未満の部分が年0.14300%、2,500億円以上5,000億円未満の部分が年0.14289%、5,000億円以上の部分が年0.14278%です。'),
              S(p, 'emaxis-nk-tier', '交付目論見書（使用開始日2026年7月25日）は、上の段階制の率を用いて計算した例として、純資産総額2,900億円・3,900億円・4,900億円のときの実質信託報酬率（税込）を年0.14299%・0.14297%・0.14295%としています。'),
              S(p, 'nav-e', '2026年9月30日現在の純資産総額5,551.83億円はこの3つの例のどれよりも大きく、この水準では、純資産総額のうち5,000億円以上の部分に、信託報酬（税込・貸付時の追加分を除く）の段階のうち最も低い年0.14278%がかかります。'))
    body += P(S(p, 'tawara-nk-fee', 'たわらノーロード日経225の信託報酬（税込・マザーファンドで有価証券の貸付を行った場合の追加分を除く）は年0.143%以内で、2026年7月14日現在の率は年0.143%です。'))
    body += P(S(p, 'terpair', '2本の総経費率は対象期間がずれており（eMAXIS Slim国内株式（日経平均）は2025/4/26〜2026/4/27、たわらノーロード日経225は2024/10/16〜2025/10/14）、差には年度の違いも入ります。'))
    p.docq('taxnote', '2本の交付目論見書の税金の表と注: 個人投資者の普通分配金と換金（解約）時・償還時の差益に課税され、NISAの非課税の扱いや確定拠出年金の資産管理機関等の場合は税金がかからない', 'enk_P',
           r'この表は、個人投資者の源泉徴収時の税率であり、課税方法等により 異なる場合があります。.{0,300}?（譲渡益） に対して20\.315％ ※上記は2026年４月末現在のものです。',
           '同じ節の注を全件: NISAを利用した場合は一定の額を上限として配当所得および譲渡所得が非課税（一定の条件に該当する方が対象）／確定拠出年金法に定める資産管理機関および国民年金基金連合会等の場合は所得税および地方税がかからない／外国税額控除の適用となった場合は分配時の税金が異なる場合がある／法人の場合は異なる／税法が改正された場合等には税率等が変更される場合がある。本文には税率の数字は書かず、課税される場合と税金がかからない場合を同じ文に書いた。',
           extra_doc=[('enk_P', r'※確定拠出年金法に定める加入者等の運用の指図に基づいて購入の申込みを行う資産管理機関および国民年金基金連合会等 の場合、所得税および地方税がかかりません。'),
                      ('tnk_P', r'●以下の表は、個人投資者の源泉徴収時の税率であり、課税方法等により異なる場合があります。.{0,300}?（譲渡益） に対して20\.315％'),
                      ('tnk_P', r'※受益者が確定拠出年金法に規定する資産管理機関および国民年金基金連合会等の場合は、所得税および地方税がかかりません。')])
    ms = method_section(p)
    old_tax = '投資者ごとの税金（分配金や換金時の差益にかかる税金）は含めていないため、実際に受け取る手取り額とは異なります。'
    new_tax = '投資者ごとの税金（分配金や換金時の差益にかかる税金）は含めていないため、課税される普通分配金や譲渡益がある場合の実際の手取り額は、その税金の分だけこの評価額より少なくなります（NISAの非課税の扱いを受ける場合や、確定拠出年金の資産管理機関等が受益者の場合は、この税金はかかりません）。'
    assert ms.count(old_tax) == 1
    S(p, 'taxnote', new_tax)
    body += ms.replace(old_tax, new_tax)
    body += faq_block(p, [
        ('idxpair', '2本は同じ指数ですか？', [('idxpair', 'どちらも、' + jd(GOT) + 'に確認した交付目論見書では日経平均トータルリターン・インデックス（配当込みの日経平均株価）への連動を目指します。'),
                                   ('bmchg-t', 'たわらノーロード日経225は、2025年1月16日にベンチマークを日経平均株価（日経225）から日経平均トータルリターン・インデックスに変更しています（交付運用報告書の約款変更のお知らせ）。'),
                                   ('motherpair', 'ただし別の投資信託で、投資先のマザーファンド、設定日、決算日、信託報酬の決め方（純資産総額に応じた段階制か、単一の率か）が違います。')]),
        ('feepair', '信託報酬はどちらが低いですか？', [('feepair', '交付目論見書の信託報酬（税込・有価証券の貸付を行った場合の追加分を除く）は2本とも年0.143%以内です。'),
                                       ('emaxis-nk-fee', 'eMAXIS Slim国内株式（日経平均）の信託報酬（税込・貸付時の追加分を除く）は純資産総額に応じた段階制で、2,500億円未満の部分が年0.14300%、2,500億円以上5,000億円未満の部分が年0.14289%、5,000億円以上の部分が年0.14278%です。'),
                                       ('tawara-nk-fee', 'たわらノーロード日経225の信託報酬（税込・貸付時の追加分を除く）は年0.143%以内で、2026年7月14日現在の率は年0.143%です。')]),
        ('nisapair', 'NISAのつみたて投資枠の対象ですか？', '2本とも、交付目論見書（eMAXIS Slim国内株式（日経平均）は使用開始日2026年7月25日、たわらノーロード日経225は使用開始日2026年7月15日）にNISAの「成長投資枠」と「つみたて投資枠」の対象と書かれており、販売会社により取扱いが異なる場合があるほか、NISAを利用できるのは非課税口座を開設するなど一定の条件に該当する方です。'),
        faq_net(p),
        ('dist-e', '分配金は出ていますか？', [('dist-e', 'eMAXIS Slim国内株式（日経平均）の分配金（1万口当たり・税引前）は、2026年9月30日現在の月次レポートで設定来累計0円です。'),
                                  ('dist-t', 'たわらノーロード日経225の分配金（1万口当たり・税引前）も、2026年9月30日基準のマンスリーレポートで設定来累計0円です。'),
                                  ('dist-t', 'どちらも過去の実績で、将来の分配金の支払いやその金額を保証するものではありません。')]),
        ('perf', '直近1年ではどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の税引前分配金再投資ベースの騰落率は、eMAXIS Slim国内株式（日経平均）が{pct(one['A累積'])}、たわらノーロード日経225が{pct(one['B累積'])}で、開始日によって結果は変わります。"),
    ])
    sections = std_sections('mechanism', '同じ指数への連動を目指す2本の、組入比率・設定日・決算日', '信託報酬（貸付時の追加分を除く）の上限は2本で同じ。決め方が違う')
    related = [('../emaxis-topix-vs-nikkei/', 'eMAXIS Slim TOPIX vs 日経平均', '国内株式の2つの指数の違いを比べる'),
               ('../tawara-vs-emaxis-sensinkoku/', 'たわらノーロード先進国株式 vs eMAXIS Slim先進国株式', '同じ2社の先進国株式を比べる'),
               ('../../toushi/tsumitate/', '積立シミュレーター', '積立額と期間から将来額の目安を計算します')]
    return p, title, desc, body, sections, related

# ======================================================================== 10. SBI・V・米国高配当株式 vs 楽天・VYM（同じ投資先ETF・同じ指数系列。2026-10-10）
@article
def a_vym_vym():
    p = Page('sbi-vym-vs-rakuten-vym', 'sbi-vym1', 'rakuten-vym', 'sbi-vym1__rakuten-vym')
    r = p.r_
    one = r['1年窓']
    A, B = p.A, p.B
    PERIOD = f"{jd(r['起点'])}〜{jd(r['終点'])}"
    p.title = title = 'SBI・V・米国高配当株式 vs 楽天・VYM｜費用・NISA・実績を比較'
    desc = (f"SBI・V・米国高配当株式と楽天・VYMを、{PERIOD}の基準価額（税引前分配金再投資・売却前）で比較。"
            f"100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}。費用（交付目論見書の概算）・NISAの枠・分配の実績の違いも、資料の時点と条件つきで確かめます。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    pair_claim(p, 'effpair', 'eff', '2本の実質的な信託報酬（投資先ETFの報酬を加味した信託報酬率。その他の費用・貸付時の報酬は含まない）')
    eff_scope(p)
    p.claims['effpair']['exceptions'] += (' SBI側の投資先ETFの管理報酬等（年0.04%）の基準時点: 「' + Q(*A['effnote_asof']) + '」「※上記内容は今後変更になる場合があります。」（svy1_P）。'
        ' 楽天・VYMの同じ費用欄の注: 「＊1 2026年2月末現在。今後、投資内容等によりこの数値は変動します。」「＊2 …実質的な信託報酬の概算値です。この値は目安であり、実際の投資信託証券の組入状況、運用状況によって変動します。」（rivuh_P）')
    p.claims['desc']['scope'] = p.claims['perf']['scope'] + ' 費用は2本の交付目論見書の概算（税込・その他の費用と貸付時の報酬を除く）、NISAは交付目論見書の課税関係の欄の記載'
    pair_claim(p, 'idxpair', 'index', '2本ともFTSEハイディビデンド・イールド・インデックス（円換算ベース。SBI側の表記は配当込み、円換算ベース）への連動を目指し、マザーファンドを通じてバンガード・米国高配当株式ETFに投資する')
    pair_claim(p, 'settlepair', 'settle', '2本とも決算は年1回（7月）で、休業日の場合は翌営業日')
    p.docq('rvym-etf', '楽天・VYMはマザーファンドを通じて「バンガード・米国高配当株式ETF」を実質的な主要投資対象とする', 'rivuh_P',
           r'◆ バンガードが運用する ｢バンガード ・米国高配当株式ETF｣を実質的な主要投資対象とします。',
           '同じ節の注: ファミリーファンド方式で運用。資金動向・市況動向等に急激な変化が生じたとき等ならびに投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、上記の運用ができない場合がある。',
           extra_doc=[('rivuh_P', r'資金動向、市況動向等に急激な変化が生じたとき等ならびに投資信託財産の規模によっては、 ?また、 ?やむを得ない事情が発生した場 ?合には、上記の運用ができない場合があります。')])
    p.docq('svy1-etf', 'SBI・V・米国高配当株式はマザーファンドを通じて「バンガード・米国高配当株式ETF」を実質的な主要投資対象とする', 'svy1_P',
           r'バンガードが運用を行う 「バンガード・米国高配当株式ETF」 を実質的な主要投資対象とします。',
           '同じ節の注: 資金動向、市況動向の急激な変化が生じたとき等ならびに投資信託財産の規模によっては、上記の運用ができない場合がある。ETFの市場価格の動きと対象指数の動きとの乖離により、基準価額の変動が指数と乖離する可能性がある。',
           extra_doc=[('svy1_P', r'資金動向、 市況動向の急激な変化が生じたとき等ならびに投資信託財産の規模によっては、上記の運用ができない場合があります。')])
    p.docq('ftse-def', 'FTSEハイディビデンド・イールド・インデックスは、米国株式市場における高配当利回りの銘柄（REITを除く）で構成される時価総額加重平均型の株価指数', 'svy1_P',
           r'FTSEハイディビデンド・イールド・インデックスとは、米国株式市場における高配当利回りの銘柄 （除く、REIT） で構成される 時価総額加重平均型の株価指数です。',
           '楽天・VYMの交付目論見書にも同じ趣旨の定義がある（下記）。SBI側の「配当込み、円換算ベース」は指数をもとに委託会社が円換算したものと同じ資料にある。',
           extra_doc=[('rivuh_P', r'「FTSEハイディビデンド・イールド・インデックス」は、米国株式市場における高配当利回りの銘柄 ?を対象とし、REITを除く銘柄で構成される時価総額加重平均型の株価指数です。')])
    p.docq('nisa-a', 'SBI・V・米国高配当株式の交付目論見書は、NISAの「成長投資枠」の対象と書き、「つみたて投資枠」の記載は無い（販売会社により取扱いが異なる場合がある）', 'svy1_P',
           r'本ファンドは、NISAの 「成長投資枠 （特定非課税管理勘定）」の対象ですが、販売会社により取扱いが 異なる場合があります。',
           '交付目論見書（使用開始日2026年4月11日）の課税関係の欄。抽出テキスト全文を「つみたて」で検索して0件であることを生成のたびに assert で確かめている。同じ欄・税金の節の注: NISAを利用できるのは販売会社で非課税口座を開設し、税法上の要件を満たした商品を購入するなど一定の条件に該当する方。税制が改正された場合には変更となる場合がある。')
    assert 'つみたて' not in text('svy1_P'), 'svy1_P now mentions the tsumitate frame: rewrite the NISA sentences'
    p.docq('nisa-b', '楽天・VYMの交付目論見書は、NISAの「成長投資枠」と「つみたて投資枠」の対象と書いている（販売会社により取扱いが異なる場合がある）', 'rivuh_P',
           r'当ファンドは、NISAの 「成長投資枠（特定非課税管理勘定）」 および 「つみたて投資枠（特定 累積投資勘定）」の対象ですが、販売会社により取扱いが異なる場合があります。',
           '交付目論見書（使用開始日2026年4月16日）の課税関係の欄。同じ欄・税金の節の注: NISAを利用できるのは非課税口座を開設するなど一定の条件に該当する方。税法が改正された場合等には変更される場合がある。')
    p.docq('nolend-a', 'SBI・V・米国高配当株式の交付目論見書は、有価証券の貸付は現在行っていないため、それに関連する報酬はかからないと書いている', 'svy1_P',
           r'また、有価証券の貸付は現在行っていないため、それに関連する報酬はかかりません。',
           '交付目論見書（使用開始日2026年4月11日）の「その他の費用及び手数料」の欄。同じ資料の運用管理費用の欄には、貸付の指図を行った場合に品貸料の55.0%（税抜50.0%）以内の額を信託報酬に追加する定めがあり、本文では両方を書いた。「現在」は資料の作成日現在で、今後変更される場合がある（同じ欄の注）。')
    p.docq('dist-a', 'SBI・V・米国高配当株式の分配金は第1期（2022年7月11日）から第5期（2026年7月13日決算）まで0円', 'svy1_P',
           r'第1期 （2022年7月11日） 0円.{0,40}?第2期 （2023年7月11日） 0円.{0,40}?第3期 （2024年7月11日） 0円.{0,40}?第4期 （2025年7月11日） 0円.{0,140}?設定来累計 0円',
           '交付目論見書の運用実績の分配の推移（1万口当たり・税引前）は第4期まで。第5期は交付運用報告書の「分配金（税込み）合計 0円」で確認。将来の分配を約束・否定するものではない。',
           extra_doc=[('svy1_Ak', r'第５期末（2026年７月13日） 基 準 価 額 25,540円 純 資 産 総 額 42,128百万円 第５期 騰 落 率 33\.8％ 分配金（税込み）合計 0円')])
    p.claims['dist-a']['scope'] = 'SBI・V・米国高配当株式の第5期（2026年7月13日決算）までの分配金（1万口当たり・税引前）。将来の分配は含まない'
    p.docq('policy-a', 'SBI・V・米国高配当株式の分配方針: 毎決算時（年1回、7月11日。休業日の場合は翌営業日）に分配を行い、信託財産の成長を優先し、原則として分配を抑制する', 'svy1_P',
           r'分配金の決定にあたっては、信託財産の成長を優先し、原則として分配を抑制することとします。 （基準価額水準や市況動向等により変更する場合があります。） 将来の分配金の支払い及びその金額について保証するものではありません。',
           '同じ欄のただし書: 分配対象額が少額の場合は、分配を行わない場合がある。「原則として」の外は、かっこ書の「基準価額水準や市況動向等により変更する場合があります」。')
    p.docq('vym0', '楽天・VYMの分配金は第9期（2026年7月15日決算）まで0円（設定来分配金合計0円）', 'rivuh_Ak', r'期 末：32,813円（既払分配金0円）',
           '交付運用報告書の最近5期の表で期間分配金合計がすべて0円、月次レポート（2026年8月31日作成基準）の設定来分配金合計額も0円であることを確認。将来の分配を約束・否定するものではない（分配金額は委託会社が決定し、必ず分配を行うものではない）。',
           extra_doc=[('rivuh_Ak', r'期間分配金合計（税込） （円） － 0 0 0 0 0'), ('rivuh_M', r'設定来分配金合計額 0 円')])
    p.claims['vym0']['scope'] = '楽天・VYMの第9期（2026年7月15日決算）までの分配金（1万口当たり・税引前）。将来の分配は含まない'
    p.docq('rvym-policy', '楽天・VYMの決算は毎年7月15日（休業日の場合は翌営業日）で、収益分配方針に基づき分配を行うが、必ず分配を行うものではない', 'rivuh_P',
           r'決 算 日 毎年7月15日 （ただし、休業日の場合は翌営業日） 毎決算時に、原則として収益分配方針に基づき分配を行います。 ただし、必ず分配を行うも のではありません。',
           '同じ欄の注: 「分配金受取コース」と「分配金再投資コース」があり、取扱いのコースとコース名は販売会社により異なる場合がある。分配方針の欄: 収益分配額は委託会社が基準価額水準、市況動向等を勘案して決定。')
    p.docq('nav-a', 'SBI・V・米国高配当株式の純資産総額（2026年8月31日基準）', 'svy1_M',
           r'基準価額 25,705円 前月末比 ＋246円 純資産総額 429\.62億円', '月次レポートの運用実績の欄。純資産総額は日々変わる。2026年9月30日基準の月次レポートは10月10日時点で運用会社のページに未掲載（掲載されているのは2026年8月分まで）。')
    p.docq('nav-b', '楽天・VYMの純資産総額（2026年8月31日作成基準）', 'rivuh_M',
           r'基準価額 33,183 円 \+329 円 40,000 800 純資産総額 407\.12 億円', '月次レポートの「基準価額・純資産総額」の欄（抽出テキストではグラフの目盛が間に挟まる）。純資産総額は日々変わる。2026年9月分の月次レポートは10月10日時点で未掲載（rivuh_M202609.pdf は404）。')
    p.docq('terbrk', '2本の総経費率の内訳（交付運用報告書。作成対象期間は2本で違う）', 'svy1_Ak',
           r'総経費率（①＋②） 0\.13％ ①当ファンドの費用の比率 0\.07％ ②投資先ファンドの運用管理費用の比率 0\.06％',
           '交付運用報告書の総経費率の内訳。作成対象期間はSBI・V・米国高配当株式が2025年7月12日〜2026年7月13日、楽天・VYMが2025年7月16日〜2026年7月15日。2本とも、①と②の費用は計上された期間が異なる場合がある・投資先ファンドは運用会社等より入手した概算値を使用している場合がある・あくまでも参考で実際に発生した費用の比率とは異なる旨の注記がある。',
           extra_doc=[('rivuh_Ak', r'総経費率（①＋②） 0\.22% ①このファンドの費用の比率 0\.16% ②投資先ファンドの運⽤管理費⽤等の⽐率 0\.06%'),
                      ('svy1_Ak', r'（注６）①と②の費用は、計上された期間が異なる場合があります。 （注７）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。'),
                      ('rivuh_Ak', r'（注6）このファンドの費用と投資先ファンドの費用は、計上された期間が異なる場合があります。 （注7）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。')])
    p.docq('rakuten-vym-etfchg', '楽天・VYMの投資先ETFの管理報酬等（年0.04%）は2026年2月2日付で変更された後の値', 'rivuh_P',
           r'0\.04%＊ 米国高配当株式ETF グループ・インク 目指す ＊2026年2月2日付で変更されました。',
           '交付目論見書の「投資対象ファンドの概要」の表（段組のため抽出テキストでは語順が入れ替わる）。変更前の率は資料に書かれていないため本文にも書いていない。',
           extra_doc=[('rivuh_P', r'※上記の内容は、今後変更になる場合があります。')])
    gap_claim(p, 'effgap', '2本の実質的な信託報酬（交付目論見書の概算）の差と、100万円を1年間一定額で保有すると仮定した目安', 'eff')
    d = round(0.172 - 0.1038, 4); amt = round(d / 100 * 1_000_000)
    assert (d, amt) == (0.0682, 682), (d, amt)
    p.claims['effgap'].update(derived=True, calc=f'python3: round(0.172 - 0.1038, 4) = {d} ; round({d} / 100 * 1_000_000) = {amt}')
    _n6 = Q('svy1_Ak', r'（注６）①と②の費用は、計上された期間が異なる場合があります。 （注７）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。')
    _r6 = Q('rivuh_Ak', r'（注6）このファンドの費用と投資先ファンドの費用は、計上された期間が異なる場合があります。 （注7）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。')
    for cid in ('sbi-vym1-ter', 'rakuten-vym-ter', 'terpair', 'terbrk'):
        p.fc(*cid.rsplit('-', 1)) if cid.endswith('-ter') else None
        p.claims[cid]['exceptions'] += f' 同じ表の注（本文の同じ文・表の行見出し・FAQに書いた）: 「{_n6}」（svy1_Ak）／「{_r6}」（rivuh_Ak）。'
    p.claims['terbrk']['exceptions'] += (' 内訳の注: 「' + Q('svy1_Ak', r'（注２）各費用は、原則として、募集手数料、売買委託手数料及び有価証券取引税を含みません。') + '」「' + Q('svy1_Ak', r'（注５）①の費用は、マザーファンドが支払った費用を含み、投資先ファンドが支払った費用を含みません。')
        + '」（svy1_Ak）／「' + Q('rivuh_Ak', r'（注2）各費用は、原則として、募集手数料、売買委託手数料および有価証券取引税を含みません。') + '」「' + Q('rivuh_Ak', r'（注5）このファンドの費用は、マザーファンドが支払った費用を含み、投資先ファンドが支払った費用を含みません。') + '」（rivuh_Ak）。本文の同じ文に書いた。')
    _rv2 = Q('rivuh_P', r'この値は目安であり、 ?実際の投資信託証券の組入状況、 ?運用状況によって変動します。')
    for cid in ('desc', 'effgap'):
        p.claims[cid]['exceptions'] += f' 楽天・VYMの実質的な負担の注: 「{_rv2}」（rivuh_P）。その他の費用・手数料と貸付時の報酬を含まない旨とともに同じ文に書いた。'
    p.fc('rakuten-vym', 'effnote') if 'rakuten-vym-effnote' in p.claims else None
    p.fc('sbi-vym1', 'incept')
    p.claims['sbi-vym1-incept']['exceptions'] += ' 同じ文に併記した決算日のかっこ書: 「' + Q('svy1_P', r'毎決算時 （年１回、7月11日。休業日の場合は翌営業日とします。）') + '」（本文の同じ文に「休業日の場合は翌営業日」と書いた）。'
    p.fc('sbi-vym1', 'lend')
    p.claims['sbi-vym1-lend']['exceptions'] += ' 同じ資料のその他の費用の欄: 「' + Q('svy1_P', r'また、有価証券の貸付は現在行っていないため、それに関連する報酬はかかりません。') + '」（貸付の定めの文の同じ文のかっこ書と、別の段落に書いた）。'
    # ---- lead
    lead = P(perf_lead(p, '結論から言うと、'), one_year_line(p), dd_line(p),
             S(p, 'perf', '2本は、' + jd(GOT) + 'に確認した交付目論見書の運用方針では同じバンガード・米国高配当株式ETFを実質的な主要投資対象としており（資金動向や市況動向の急激な変化が生じたときなどは、この運用ができない場合があります）、' + corr_period(p) + f"小数第4位までの表示で{r['同日相関']:.4f}でした。"))
    lead += P(S(p, 'effpair', '投資先ETFの報酬を加味した実質的な信託報酬（税込年率）は、交付目論見書の概算でSBI・V・米国高配当株式が年0.1038%程度（投資先ETFの報酬は2026年1月末現在の値）、楽天・VYMが年0.172%程度（投資先ETFの報酬は2026年2月末現在の値）で、投資先の報酬の変更や組入状況などで変わり、監査報酬などのその他の費用と、有価証券の貸付を行った場合の報酬は含みません。'),
              S(p, 'nisa-b', '確認日（' + jd(GOT) + '）の交付目論見書では、楽天・VYM（使用開始日2026年4月16日）はNISAの「成長投資枠」と「つみたて投資枠」の対象です（販売会社により取扱いが異なる場合があります）。'),
              S(p, 'nisa-a', 'SBI・V・米国高配当株式（使用開始日2026年4月11日）の交付目論見書は「成長投資枠」の対象とだけ書いていて（販売会社により取扱いが異なる場合があります）、「つみたて投資枠」の記載はありません。'))
    p.lead = lead_block(p, lead)
    p.effnote_override = {'rakuten-vym': '楽天・VYMの交付目論見書は、投資先ETFの報酬の数値（年0.04%程度）を2026年2月末現在のものとし、今後の投資内容等により変動するとしています。実質的に負担する運用管理費用（税込年0.172%程度で、投資先ETFの報酬は2026年2月末現在の値。その他の費用と貸付時の報酬を含まない）も概算値で目安であり、実際の組入状況・運用状況によって変動すると書いています。'}
    ps = perf_section(p)
    pctx = S(p, 'perf', f'<p data-review-context="before-table">次の表の値は、比較期間（{PERIOD}）の基準価額から計算した、税引前の分配金を再投資した場合の売却前の値です（直近1年の行だけは行見出しの期間）。購入時・換金時の手数料と投資者ごとの税金は含みません。</p>')
    assert ps.count('<div class="scroll-wrap">') == 1
    body = ps.replace('<div class="scroll-wrap">', pctx + '<div class="scroll-wrap">', 1)
    fctx = S(p, 'feehead', f'<p data-review-context="before-table">次の表は{jd(GOT)}に確認した交付目論見書（SBI・V・米国高配当株式は使用開始日2026年4月11日、楽天・VYMは使用開始日2026年4月16日）と交付運用報告書の記載で、料率は税込の年率です（SBI・V・米国高配当株式の交付目論見書は、費用を本書作成日現在の情報で今後変更される場合があるとしています）。為替ヘッジと連動対象・投資対象は運用方針で、資金動向や市況動向に急激な変化が生じたときや投資信託財産の規模によっては（楽天・VYMはやむを得ない事情が発生した場合も）、この運用ができない場合があります。</p>')
    fs = fee_section(p, labels={
        'eff': '投資先ETF等を加味した実質的な信託報酬（税込年率・交付目論見書の概算で、投資先の報酬の変更や組入状況などで変わる。その他の費用と貸付時の報酬を除く）',
        'ter': '総経費率（年率換算の参考値。原則として購入時手数料・売買委託手数料・有価証券取引税を含まない。ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合がある）'},
        vals={('sbi-vym1', 'eff'): '年0.1038%程度（投資先ETF年0.04%程度を含む。投資先ETFの報酬は2026年1月末現在）',
              ('rakuten-vym', 'eff'): '年0.172%程度（投資先ETF年0.04%程度を含む。投資先ETFの報酬は2026年2月末現在）',
              ('sbi-vym1', 'ter'): '0.13%（作成対象期間2025/7/12〜2026/7/13）',
              ('rakuten-vym', 'ter'): '0.22%（作成対象期間2025/7/16〜2026/7/15）'})
    assert fs.count('<div class="scroll-wrap">') == 1
    body += fs.replace('<div class="scroll-wrap">', fctx + '<div class="scroll-wrap">', 1) + fee_note(p)
    p.claims['feehead']['exceptions'] += (' 表の前の段落に書いた資料の時点と留保: 「' + Q('svy1_P', r'上記の費用等については、 ?本書作成日現在の情報であり、 ?今後変更される場合があります。') + '」（svy1_P）、運用方針の留保「'
        + Q('svy1_P', r'資金動向、 市況動向の急激な変化が生じたとき等ならびに投資信託財産の規模によっては、上記の運用ができない場合があります。') + '」（svy1_P）／「'
        + Q('rivuh_P', r'資金動向、市況動向等に急激な変化が生じたとき等ならびに投資信託財産の規模によっては、 ?また、 ?やむを得ない事情が発生した場 ?合には、上記の運用ができない場合があります。') + '」（rivuh_P）。')
    p.claims['rakuten-vym-effnote']['exceptions'] += ' 同じ費用の表の注＊2: 「' + _rv2 + '」。本文の同じ段落の次の文（概算値で目安・組入状況・運用状況によって変動）に書いた。'
    body += S(p, 'idxpair', '<h2 id="mechanism">運用方針上の投資先は同じETF。NISAの枠と分配方針の書き方が違う</h2>')
    body += P(S(p, 'svy1-etf', 'SBI・V・米国高配当株式は、交付目論見書の運用方針では、マザーファンドを通じて「バンガード・米国高配当株式ETF」を実質的な主要投資対象とします（資金動向や市況動向の急激な変化が生じたときや投資信託財産の規模によっては、この運用ができない場合があります）。'),
              S(p, 'rvym-etf', '楽天・VYMも、マザーファンドを通じて同じ「バンガード・米国高配当株式ETF」を実質的な主要投資対象とします（資金動向や市況動向に急激な変化が生じたときや投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、この運用ができない場合があります）。'),
              S(p, 'ftse-def', '連動を目指すFTSEハイディビデンド・イールド・インデックスは、米国株式市場における高配当利回りの銘柄（REITを除く）で構成される時価総額加重平均型の株価指数です。'),
              S(p, 'idxpair', '指数の表記は、SBI・V・米国高配当株式の交付目論見書が「配当込み、円換算ベース」、楽天・VYMの交付目論見書が「円換算ベース」です。'))
    body += S(p, 'nisa-b', '<h3 id="nisa">NISAの枠：つみたて投資枠の記載があるのは楽天・VYM</h3>')
    body += P(S(p, 'nisa-b', '楽天・VYMの交付目論見書（使用開始日2026年4月16日）は、このファンドをNISAの「成長投資枠（特定非課税管理勘定）」と「つみたて投資枠（特定累積投資勘定）」の対象と書いています（販売会社により取扱いが異なる場合があります）。'),
              S(p, 'nisa-a', 'SBI・V・米国高配当株式の交付目論見書（使用開始日2026年4月11日）は「成長投資枠（特定非課税管理勘定）」の対象と書き（販売会社により取扱いが異なる場合があります）、「つみたて投資枠」の記載はありません。'),
              S(p, 'nisa-a', 'NISAを利用できるのは、販売会社で非課税口座を開設し、税法上の要件を満たした商品を購入するなど一定の条件に該当する方で、税制が改正された場合は扱いが変わる場合があります。'))
    body += S(p, 'settlepair', '<h3 id="dist">決算と分配金：2本とも年1回の決算で、SBI側は第5期・楽天側は第9期まで分配金0円</h3>')
    body += P(S(p, 'sbi-vym1-incept', 'SBI・V・米国高配当株式の設定日は2021年6月29日で、決算は年1回（7月11日、休業日の場合は翌営業日）です。'),
              S(p, 'rakuten-vym-incept', '楽天・VYMの設定日は2018年1月10日です。'),
              S(p, 'rvym-policy', '楽天・VYMの決算日は毎年7月15日（休業日の場合は翌営業日）で、収益分配方針に基づき分配を行いますが、必ず分配を行うものではありません。'),
              S(p, 'policy-a', 'SBI・V・米国高配当株式の交付目論見書は、分配金の決定にあたって信託財産の成長を優先し、原則として分配を抑制する（基準価額水準や市況動向等により変更する場合がある）と書いています。'),
              S(p, 'dist-a', 'SBI・V・米国高配当株式の分配金（1万口当たり・税引前）は、第1期（2022年7月11日決算）から第5期（2026年7月13日決算）まで各期0円です。'),
              S(p, 'vym0', '楽天・VYMの分配金（1万口当たり・税引前）も、交付運用報告書（第9期・2026年7月15日決算）の既払分配金が0円で、月次レポート（2026年8月31日作成基準）の設定来分配金合計額も0円です。'),
              S(p, 'dist-a', 'どちらも過去の実績で、将来の分配金の支払いやその金額を保証するものではありません。'))
    body += P(S(p, 'nav-a', '純資産総額は、SBI・V・米国高配当株式が2026年8月31日基準の月次レポートで429.62億円です。'),
              S(p, 'nav-b', '楽天・VYMの純資産総額は、2026年8月31日作成基準の月次レポートで407.12億円です。'))
    body += S(p, 'effpair', '<h2 id="cost-detail">実質的な信託報酬と、総経費率の内訳</h2>')
    body += P(S(p, 'sbi-vym1-eff', 'SBI・V・米国高配当株式は国内ファンド分の信託報酬が年0.0638%（税込）で、投資先ETFの年0.04%程度（2026年1月末現在の値で、今後変更になる場合があります）を加味した、投資者が実質的に負担する信託報酬率が年0.1038%程度（税込・交付目論見書の概算で、本書作成日現在の情報として今後変更される場合がある。その他の費用と貸付時の報酬を除く）です。'),
              S(p, 'rakuten-vym-eff', '楽天・VYMは国内ファンド分の信託報酬が年0.132%（税込）で、投資先ETFの年0.04%程度（2026年2月末現在の値で、投資内容等により変動）を含む実質的な負担が年0.172%程度（税込・交付目論見書の概算で目安であり、組入状況・運用状況により変動。その他の費用と貸付時の報酬を除く）です。'),
              S(p, 'effgap', f'この2つの概算（交付目論見書の税込の料率で、楽天・VYMの値は組入状況・運用状況によって変動し、どちらもその他の費用と貸付時の報酬を除く）の差は年{d}ポイント程度で、100万円を1年間一定額で保有すると仮定した目安は約{amt:,}円です。この金額は実際の利益差ではありません。'))
    body += P(ter_line(p, '、原則として購入時手数料・売買委託手数料・有価証券取引税を含まず、ファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合がある'),
              S(p, 'terbrk', '交付運用報告書が載せる総経費率（年率換算の参考値で、原則として購入時手数料・売買委託手数料・有価証券取引税を含まない）の内訳は、SBI・V・米国高配当株式が2025年7月12日〜2026年7月13日の作成対象期間について①当ファンドの費用の比率0.07%と②投資先ファンドの運用管理費用の比率0.06%、楽天・VYMが2025年7月16日〜2026年7月15日の作成対象期間について①このファンドの費用の比率0.16%と②投資先ファンドの運用管理費用等の比率0.06%です（①はマザーファンドが支払った費用を含み投資先ファンドが支払った費用を含まず、①と②は計上された期間が異なる場合があり、②は運用会社等より入手した概算値の場合があります）。'),
              S(p, 'rakuten-vym-etfchg', '楽天・VYMの交付目論見書は、投資先ETFの管理報酬等（年0.04%）を2026年2月2日付で変更された後の率としています。'))
    body += P(S(p, 'nolend-a', 'SBI・V・米国高配当株式の交付目論見書（使用開始日2026年4月11日）は、貸付の指図を行った場合に品貸料の一部を信託報酬に追加する定めとは別に、その他の費用の欄で、有価証券の貸付は現在行っていないため、それに関連する報酬はかからないと書いています。'))
    ms = method_section(p)
    old_tax = '投資者ごとの税金（分配金や換金時の差益にかかる税金）は含めていないため、実際に受け取る手取り額とは異なります。'
    new_tax = '投資者ごとの税金（分配金や換金時の差益にかかる税金）は含めていないため、課税口座で課税される普通分配金や譲渡益がある場合の実際の手取り額は、その税金の分だけこの評価額より少なくなります（NISAの非課税の扱いを受ける場合は、この税金はかかりません）。'
    assert ms.count(old_tax) == 1
    p.docq('taxnote', '2本の交付目論見書の税金の節: 個人投資者の普通分配金と換金（解約）時・償還時の差益に課税され、NISAを利用した場合は一定の額を上限として配当所得・譲渡所得が無期限で非課税', 'svy1_P',
           r'一定の額を上限として、毎年、一定額の範囲で新た に購入した公募株式投資信託などから生じる配当所得及び譲渡所得が無期限で非課税となります。',
           '同じ節の注を全件: 個人投資者の源泉徴収時の税率で課税方法等により異なる場合がある／NISAを利用できるのは非課税口座を開設するなど一定の条件に該当する方／外国税額控除の適用となった場合は分配時の税金が異なる場合がある／法人の場合は異なる／税法が改正された場合等には税率等が変更される場合がある。本文には税率の数字は書かず、課税される場合と税金がかからない場合を同じ文に書いた。',
           extra_doc=[('rivuh_P', r'一定の額を上限として、毎年、一定額の範囲で新たに購入した公募株式投資信託などから生じる配当所得および譲渡 所得が無期限で非課税となります。')])
    S(p, 'taxnote', new_tax)
    body += ms.replace(old_tax, new_tax)
    body += faq_block(p, [
        ('idxpair', '2本は同じものに投資していますか？', [('idxpair', 'どちらも、' + jd(GOT) + 'に確認した交付目論見書では、マザーファンドを通じてバンガード・米国高配当株式ETFに投資し、FTSEハイディビデンド・イールド・インデックス（円換算ベース）への連動を目指します。'),
                                              ('settlepair', 'ただし別の投資信託で、運用会社、設定日、決算日（SBI側は7月11日、楽天側は7月15日で、どちらも休業日の場合は翌営業日）、信託報酬の率が違います。')]),
        ('nisa-b', 'NISAのつみたて投資枠で買えますか？', [('nisa-b', '確認日（' + jd(GOT) + '）の交付目論見書では、楽天・VYMは「成長投資枠」と「つみたて投資枠」の対象と書かれています。'),
                                                  ('nisa-a', 'SBI・V・米国高配当株式の交付目論見書は「成長投資枠」の対象とだけ書き、「つみたて投資枠」の記載はありません。どちらも販売会社により取扱いが異なる場合があり、NISAを利用できるのは非課税口座を開設するなど一定の条件に該当する方です。')]),
        ('effpair', '費用はどちらが低いですか？', [('effpair', '投資先ETFの報酬を加味した実質的な信託報酬（税込年率）は、交付目論見書の概算でSBI・V・米国高配当株式が年0.1038%程度（投資先ETFの報酬は2026年1月末現在の値で、今後変更になる場合があります）、楽天・VYMが年0.172%程度です（楽天・VYMの値は目安で、投資先ETFの報酬は2026年2月末現在の値で、組入状況や運用状況によって変動し、どちらもその他の費用と、有価証券の貸付を行った場合の報酬は含みません）。'),
                                          ('terpair', '総経費率（年率換算の参考値で、原則として購入時手数料・売買委託手数料・有価証券取引税を含まない）はSBI・V・米国高配当株式が0.13%（2025年7月12日〜2026年7月13日）、楽天・VYMが0.22%（2025年7月16日〜2026年7月15日）で、どちらもファンド本体と投資先の費用は計上された期間が異なる場合があり、投資先の費用は概算値の場合があります。')]),
        ('dist-a', '分配金は出ていますか？', [('dist-a', 'SBI・V・米国高配当株式の分配金（1万口当たり・税引前）は第5期（2026年7月13日決算）まで各期0円です。'),
                                      ('vym0', '楽天・VYMの分配金（1万口当たり・税引前）も第9期（2026年7月15日決算）まで0円です。'),
                                      ('dist-a', 'どちらも過去の実績で、将来の分配金の支払いやその金額を保証するものではありません。')]),
        faq_net(p, '課税口座で課税される普通分配金や譲渡益が生じた場合は、その税金の分だけ手取りは表の金額より少なくなります。'),
        ('perf', '直近1年ではどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の税引前分配金再投資ベースの騰落率は、SBI・V・米国高配当株式が{pct(one['A累積'])}、楽天・VYMが{pct(one['B累積'])}でした。開始日によって結果は変わり、過去の実績は将来の成果を示しません。"),
    ])
    sections = std_sections('mechanism', '運用方針上の投資先は同じETF。NISAの枠と分配方針の書き方が違う', '実質的な信託報酬と、総経費率の内訳')
    related = [('../sbi-spyd-vs-sbi-vym/', 'SBI・SPDR・S&P500高配当 vs SBI・V・米国高配当', 'SBIのVYM型（年4回決算型）をS&P500高配当型と比べる'),
               ('../rakuten-schd-vs-rakuten-vym/', '楽天・SCHD vs 楽天・VYM', '楽天・VYMを楽天・SCHDと比べる'),
               ('../sbi-spyd-vs-rakuten-vym/', 'SBI・SPDR・S&P500高配当 vs 楽天・VYM', '楽天・VYMをS&P500高配当型と比べる')]
    return p, title, desc, body, sections, related

# ======================================================================== 11. 楽天・SCHD vs SBI・SCHD（同じ投資先ETF・運用会社違い。共通期間は約1年9か月。2026-10-11）
@article
def a_schd_schd():
    p = Page('rakuten-schd-vs-sbi-schd', 'rakuten-schd', 'sbi-schd4', 'rakuten-schd__sbi-schd4')
    r = p.r_
    one = r['1年窓']
    A, B = p.A, p.B
    PERIOD = f"{jd(r['起点'])}〜{jd(r['終点'])}"
    p.title = title = '楽天・SCHD vs SBI・SCHD（年4回決算型）｜信託報酬・分配金・実績を比較'
    desc = (f"楽天・SCHDとSBI・SCHD（年4回決算型）を{PERIOD}の基準価額（税引前分配金再投資）で比較。"
            f"100万円は{yen(r['A100万円終価'])}と{yen(r['B100万円終価'])}（売却前）。費用の表示・決算月・分配金の実績の違いも資料で確かめます。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    assert tax_pair(p) is None  # SBI側の課税関係の欄は段組が違い共通の型に合わない。税金の文はこのページ用に書く
    pair_claim(p, 'effpair', 'eff', '2本の実質的な信託報酬（投資先ETFの報酬を加味した信託報酬率。その他の費用・貸付時の報酬は含まない）')
    eff_scope(p)
    pair_claim(p, 'settlepair', 'settle', '2本とも決算は年4回で、楽天・SCHDは原則として2・5・8・11月の各25日、SBI・SCHDは原則として3・6・9・12月の各28日（休業日の場合は翌営業日）')
    # ---- 投資先
    RK_RES = r'資金動向、市況動向等に急激な変化が生じたとき等、ならびに投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、 上記のような運用ができない場合があります。'
    SB_RES = r'資金動向、市況動向等に急激な変化が生じたとき等ならびに信託財産の規模によっては、上記の運用ができない場合があり ます。'
    p.docq('rk-etf', '楽天・SCHDはマザーファンドを通じて、米国の株式を主要投資対象とする上場投資信託証券（シュワブ・米国配当株式ETF）に投資する', 'risude_P',
           r'◆マザーファンド受益証券への投資を通じて、主に米国の株式を主要投資対象とする上場投資信託証券 （ETF） に投資し、主として配当収益の確保および中長期的な値上がり益の獲得を目指します。',
           '同じ節の注（本文の同じ段落に書いた）: 資金動向、市況動向等に急激な変化が生じたとき等、ならびに投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、上記のような運用ができない場合がある。投資対象のETFの名称は「投資対象ファンドの概要」と主要な資産の状況で確認した。',
           extra_doc=[('risude_P', RK_RES), ('risude_P', r'シュワブ・米国配当株式ETF 投資信託証券 アメリカ 米ドル 98\.1%'), ('risude_P', FUNDS['rakuten-schd']['index_q'][1])])
    p.docq('sb-etf', 'SBI・SCHD（年4回決算型）はマザーファンドを通じて、米国の株式を主要投資対象とするETF（シュワブ・米国配当株式ETF）に投資する', 'sschd_P',
           r'1 マザーファンド受益証券への投資を通じて、米国の株式を主要投資対象とする ETF（上場投資信託証券） に投資することにより、主として配当等収益の確保 および中長期的な値上がり益の獲得をめざします。',
           '同じ節の注（本文の同じ段落に書いた）: 資金動向、市況動向等に急激な変化が生じたとき等ならびに信託財産の規模によっては、上記の運用ができない場合がある。投資対象のETFの名称と運用方針は「投資対象ファンドの概要」（2026年3月末現在。今後変更になる場合がある）で確認した。',
           extra_doc=[('sschd_P', SB_RES), ('sschd_P', FUNDS['sbi-schd4']['index_q'][1]), FUNDS['sbi-schd4']['effnote_asof']])
    ca, cb = p.claims['rk-etf'], p.claims['sb-etf']
    p.claim('etfpair', '2本とも、交付目論見書の運用方針ではマザーファンドを通じてシュワブ・米国配当株式ETFに投資する', ca['source_url'], ca['source_quote'], ca['applies'],
            ca['exceptions'] + f' 比較相手: {cb["source_url"]}「{cb["source_quote"]}」 {cb["exceptions"]}',
            scope=f'{GOT}に確認した2本の交付目論見書の運用方針（ファンドの特色・投資対象ファンドの概要）。運用方針どおりの運用ができない場合の留保は同じ段落に書いた')
    p.claim('nobmpair', '2本とも交付目論見書でベンチマークはなく、投資先のETFがダウ・ジョーンズ US ディビデンド 100 インデックスへの連動をめざす',
            url('risude_P'), Q('risude_P', r'当ファンドには、 ベンチマークはありません。'), f'{GOT}に確認した2本の交付目論見書',
            '交付目論見書の年間収益率の欄で確認。投資先ETFの運用方針は「投資対象ファンドの概要」で確認した（楽天側は2026年2月末現在、SBI側は2026年3月末現在の記載で、どちらも今後変更になる場合がある）。'
            ' 比較相手: ' + url('sschd_P') + '「' + Q('sschd_P', r'本ファンドにはベンチマークはありません。') + '」「' + Q(*FUNDS['sbi-schd4']['index_q']) + '」 楽天側: 「' + Q(*FUNDS['rakuten-schd']['index_q']) + '」')
    # ---- NISA
    assert 'つみたて' not in text('risude_P') and 'つみたて' not in text('sschd_P'), 'a prospectus now mentions the tsumitate frame: rewrite the NISA sentences'
    p.docq('nisapair', '2本の交付目論見書はどちらも、NISAの「成長投資枠」の対象と書き、「つみたて投資枠」の記載は無い（販売会社により取扱いが異なる場合がある）', 'risude_P',
           r'当ファンドは、NISAの 「成長投資枠（特定非課税管理勘定）」 の対象ですが、販売会社に より取扱いが異なる場合があります。',
           '2本の交付目論見書の課税関係の欄。抽出テキスト全文を「つみたて」で検索して2本とも0件であることを生成のたびに assert で確かめている。同じ欄・税金の節の注: NISAを利用できるのは販売会社で非課税口座を開設し、税法上の要件を満たした商品を購入するなど一定の条件に該当する方。税制・税法が改正された場合は変更となる場合がある。',
           extra_doc=[('sschd_P', r'当ファンドは、NISAの 「成長投資枠 （特定非課税管理勘定）」の対象ですが、販売会社により取扱いが 異なる場合があります。'),
                      ('sschd_P', r'ご利用になれるのは、販売会社で非課税 口座を開設し、税法上の要件を満たした商品を購入するなど、一定の条件に該当する方が対象となります。')])
    # ---- 分配金
    distnav_claims_doc(p, 'sschd_P', r'分配金額は、収益分配方針に基づいて委託会社が決定します。あらかじめ一定の額の分配をお約束するものではあり ません。分配金が支払われない場合もあります。')
    ra = last4(dist_rows_rakuten(p, 'rakuten-schd', '2025-07-01')); rb = last4(dist_rows_sbi('sbi-schd4', '2025-07-01'))
    assert [v for _, v in ra] == [85, 90, 90, 95] and [v for _, v in rb] == [90, 95, 90, 95], (ra, rb)
    dist_claim(p, 'distA', 'rakuten-schd', ra); dist_claim(p, 'distB', 'sbi-schd4', rb)
    p.claims['distA']['scope'] = '楽天・SCHDの1万口当たり・税引前の分配金の過去の実績（2025年11月25日〜2026年8月25日の4回の決算）。将来の分配金ではない'
    p.claims['distA']['exceptions'] += (' 月次レポート（2026年8月31日作成基準）の表と一致: ' + url('risude_M') + '「'
        + Q('risude_M', r'分配金（税引前、1万口当たり） 設定来分配金合計額 595 円 2月 5月 8月 11月 2025年 85 円 70 円 80 円 85 円 2026年 90 円 90 円 95 円 -') + '」「'
        + Q('risude_M', r'※ 分配金実績は、将来の分配金の水準を示唆・保証するものではありません。') + '」')
    p.claims['distB']['scope'] = 'SBI・SCHD（年4回決算型）の1万口当たり・税引前の分配金の過去の実績（2025年12月29日〜2026年9月28日の4回の決算）。将来の分配金ではない'
    p.claims['distB']['exceptions'] += (' 月次レポート（2026年9月30日基準）の収益分配金（税引前）推移と一致: ' + url('sschd_M') + '「'
        + Q('sschd_M', W(r'決算日 2025/9/29 2025/12/29 2026/3/30 2026/6/29 2026/9/28 分配金 85円 90円 95円 90円 95円 517円 ※収益分配金は1万口当たりの金額です。 ※分配金は過去の実績であり、将来の分配金の水準を示唆・保証するものではありません。')) + '」')
    p.docq('schg', 'SBI・SCHD（年4回決算型）は2025年8月13日の約款変更で、決算日を3・6・9・12月の各19日から各28日に変えた（投資対象ETFの配当時期に対応させる変更）', 'sschd_N2',
           r'より効率的な運用と収益分配が行えるよう、本ファンドの決算日を、投資対象 ETF（シュワブ・米国配当 株式 ETF）の配当時期に対応させる変更を行います。',
           '運用会社のお知らせ。変更前後とも「原則として」「休業日の場合は翌営業日」の定めで、本文の同じ段落（決算日の文）に書いた。同じお知らせは信託金の限度額の変更（3,500億円）も伝えているが、本文には書いていない。',
           extra_doc=[('sschd_N2', r'1\. 変更年月日 2025 年 8 月 13 日'), ('sschd_N2', r'決算日 各 28 日（休業日の場合は翌営業日） 各 19 日（休業日の場合は翌営業日）')])
    p.docq('distover', '2本の交付目論見書はどちらも、購入価額によっては分配金の一部または全部が実質的には元本の一部払戻しに相当する場合があると書いている', 'sschd_P',
           r'投資者のファンドの購入価額によっては、分配金の一部または全部が、実質的には元本の一部払戻しに 相当する場合があります。',
           '2本の交付目論見書の「収益分配金に関する留意事項」。同じ欄: 分配金は計算期間中に発生した収益を超えて支払われる場合がある／購入後の運用状況により分配金額より基準価額の値上がりが小さかった場合も同様／元本払戻金（特別分配金）は非課税扱いで、その額だけ個別元本が減少する。',
           extra_doc=[('risude_P', r'投資者のファンドの購入価額によっては、分配金の一部または全部が、実質的には元本の一部払戻しに相当する ?場合があります。')])
    p.docq('cum-a', '楽天・SCHDの設定来分配金合計額は595円（1万口当たり・税引前。2025年2月〜2026年8月の7回の決算）', 'risude_M',
           r'分配金（税引前、1万口当たり） 設定来分配金合計額 595 円 2月 5月 8月 11月 2025年 85 円 70 円 80 円 85 円 2026年 90 円 90 円 95 円 -',
           '月次レポート（2026年8月31日作成基準）の表。85＋70＋80＋85＋90＋90＋95＝595円で7回。同じ欄の注: 分配金実績は将来の分配金の水準を示唆・保証するものではない。委託会社の判断により分配を行わない場合もある。',
           extra_doc=[('risude_M', r'※ 分配金実績は、将来の分配金の水準を示唆・保証するものではありません。')])
    assert 85 + 70 + 80 + 85 + 90 + 90 + 95 == 595 and 0 + 62 + 85 + 90 + 95 + 90 + 95 == 517
    p.docq('cum-b', 'SBI・SCHD（年4回決算型）の設定来の分配金の累計は517円（1万口当たり・税引前。第7期・2026年9月28日決算まで）で、第1期（2025年3月19日）は0円', 'sschd_M',
           W(r'決算日 2025/9/29 2025/12/29 2026/3/30 2026/6/29 2026/9/28 分配金 85円 90円 95円 90円 95円 517円 ※収益分配金は1万口当たりの金額です。'),
           '月次レポート（2026年9月30日基準）の収益分配金（税引前）推移（第3期〜第7期と設定来累計）。第1期0円・第2期62円は交付目論見書の分配の推移で確認（0＋62＋85＋90＋95＋90＋95＝517円）。同じ欄の注: 分配金は過去の実績で、将来の分配金の水準を示唆・保証するものではない。',
           extra_doc=[('sschd_P', r'第1期 （2025年 3 月19日） 0円 第2期 （2025年 6 月19日） 62円')])
    # ---- 純資産
    q_nav, u_nav = nav_rows('rakuten-schd', '2026-09-30')
    p.claim('nav-a', '楽天・SCHDの純資産総額（2026年9月30日）', u_nav, q_nav, f'{GOT}に確認した運用会社（楽天投信投資顧問）公表の基準価額データの純資産総額の列',
            '純資産総額は日々変わる。楽天・SCHDの2026年9月分の月次レポートは' + jd(GOT) + '時点で運用会社のページに未掲載（最新は2026年8月31日作成基準で2,718.13億円）のため、同じ運用会社が公表する日次データの9月30日の行を使った。')
    p.docq('nav-b', 'SBI・SCHD（年4回決算型）の純資産総額（2026年9月30日基準）', 'sschd_M', W(r'基準価額 12,158円 前月末比 ▲978円 純資産総額 2,273\.27億円'),
           '月次レポートの運用実績の欄。純資産総額は日々変わる。')
    # ---- 費用
    p.docq('feecut', 'SBI・SCHD（年4回決算型）の信託報酬は2025年5月20日に税込年0.0638%から年0.0627%へ引き下げられ、実質的な負担の表示は年0.1238%程度から年0.1227%程度になった', 'sschd_N1',
           r'＜変更後＞ ＜変更前＞ （支払先） 年 0\.0627％（税抜:年 0\.057％） 年 0\.0638％（税抜:年 0\.058％）',
           '運用会社のお知らせ。同じ表の注: 費用等は本書作成日現在の情報で、今後変更される場合がある。投資対象とする投資信託証券（年0.06%程度）は変更前後で同じ。',
           extra_doc=[('sschd_N1', r'1\. 変更年月日 2025 年 5 月 20 日'), ('sschd_N1', r'実質的な負担 年 0\.1227％（税込）程度 年 0\.1238％（税込）程度'),
                      ('sschd_N1', r'上記の費用等については、本書作成日現在の情報であり、今後変更される場合があります。')])
    gap_claim(p, 'effgap', '2本の実質的な信託報酬（交付目論見書の概算）の差と、100万円を1年間一定額で保有すると仮定した目安', 'eff')
    d = round(0.1238 - 0.1227, 4); amt = round(d / 100 * 1_000_000)
    assert (d, amt) == (0.0011, 11), (d, amt)
    ci = p.claims[p.fc('sbi-schd4', 'incept')]
    days = (dt.date.fromisoformat(r['終点']) - dt.date.fromisoformat(r['起点'])).days
    assert days == 649 and round(days / 365.25 * 12) == 21
    p.claim('period', f'比較期間（SBI・SCHDの設定日{jd(r["起点"])}〜{jd(r["終点"])}）の長さは約1年9か月', ci['source_url'], ci['source_quote'], ci['applies'],
            ci['exceptions'] + ' 終点は月末に固定した（本文の計算条件）。期間の長さは暦日数から計算した値。楽天・SCHDの設定日: 「' + Q(*FUNDS['rakuten-schd']['incept_q']) + '」',
            scope=f'この記事の比較期間（{PERIOD}）の長さ。SBI・SCHDの設定日を起点にした理由は計算条件の節')
    a_, b_ = '楽天・SCHD', 'SBI・SCHD'
    # ---- lead（答えを先に。条件は表の前の段落と各節に1回）
    # 2026-10-11 画面の関門: 答えの3点（実績・費用・決算月）を箇条書きにし、それぞれの条件は同じ項目の2文目に1回だけ書く
    lead = P(S(p, 'etfpair', f'結論から言うと、{a_}と{b_}は、交付目論見書の運用方針では、どちらもマザーファンドを通じて同じ「シュワブ・米国配当株式ETF」に投資する投資信託です。'),
             S(p, 'effpair', '主な違いは、運用会社、費用の表示、決算月、設定日などです。'))
    lead += ('<ul><li>' + S(p, 'perf', f"<b>実績</b>：{PERIOD}に100万円を一括で投資し、税引前の分配金を再投資した場合の終了時評価額は、{a_}が{yen(r['A100万円終価'])}、{b_}が{yen(r['B100万円終価'])}でした。売却前の金額で、投資者ごとの税金は含みません。")
             + '</li><li>' + S(p, 'effpair', f'<b>費用</b>：投資先ETFの報酬を加味した実質的な信託報酬は、今後変わりうる税込年率の概算で、{a_}が年0.1238%程度、{b_}が年0.1227%程度です（その他の費用と、貸付を行った場合の報酬は含まない率）。')
             + '</li><li>' + S(p, 'settlepair', f'<b>決算月</b>：決算は年4回で、{a_}が原則として2・5・8・11月、{b_}が原則として3・6・9・12月です。') + '</li></ul>')
    lead += P(S(p, 'period', f'{b_}の設定日（{jd(r["起点"])}）からの比較で、期間は約1年9か月です。'),
              S(p, 'identity', f'この記事では、{A["name"]}を「{a_}」、{B["name"]}を「{b_}」と書きます。'))
    p.lead = lead_block(p, lead)
    # データの出どころの段落は、リードから計算条件の節へ移す（最初の表までの前置きを減らす。長い1文は3文に分ける）
    old_src = (f'<p>基準価額は{A["short"]}が運用会社の公表する分配金再投資基準価額、{B["short"]}がウエルスアドバイザーが配信する基準価額と日々の騰落率から計算した、税引前の分配金再投資ベースの値で、どちらも{jd(r["終点"])}までのデータです。'
               f'費用は{jd(GOT)}に確認した交付目論見書・交付運用報告書・月次レポートの記載です。どちらかの購入や売却を勧めるものではなく、資料で確かめられる事実を並べています。</p>\n')
    assert p.lead.count(old_src) == 1
    p.lead = p.lead.replace(old_src, '')
    _nf = len(p.frags)
    p.frags = [(c, t) for c, t in p.frags if not t.startswith('基準価額は')]
    assert len(p.frags) == _nf - 1
    # ---- 実績
    ps = perf_section(p)
    pctx = S(p, 'perf', f'<p data-review-context="before-table">次の表の値は、比較期間（{PERIOD}）の基準価額から計算した、税引前の分配金を再投資した場合の売却前の値です（直近1年の行だけは行見出しの期間）。購入時・換金時の手数料と投資者ごとの税金は含みません。</p>')
    assert ps.count('<div class="scroll-wrap">') == 1
    body = ps.replace('<div class="scroll-wrap">', pctx + '<div class="scroll-wrap">', 1)
    body += P(S(p, 'perf', f"2本の差は小さく、{corr_period(p)}小数第4位までの表示で{r['同日相関']:.4f}でした。"),
              S(p, 'period', '比較期間が約1年9か月と短いので、この差が今後も続くかどうかは、この実績からは分かりません。'))
    # ---- 費用の表
    # 2026-10-11 画面の関門: 表の前は「何の資料の、どんな料率か」だけ。総経費率・※・運用方針の注は表の直下に1回
    fctx = S(p, 'feehead', f'<p data-review-context="before-table">次の表は、{jd(GOT)}に確認した交付目論見書と交付運用報告書の記載で、料率は税込の年率です。確認した交付目論見書の使用開始日は、{a_}が2026年5月26日、{b_}が2026年7月1日です。費用は今後変更される場合があります。</p>')
    fafter = S(p, 'feehead', '<p class="note" data-review-context="after-table">総経費率は年率換算の参考値で、投資先ファンドの費用は計上された期間が異なる場合があり、概算値の場合があります。※の楽天・SCHDの総経費率は投資先ETFの年0.06%程度の報酬を含みますが、委託会社が合理的に見積った報酬相当額をファンドに別途充当しています。為替ヘッジと投資対象は運用方針で、資金動向や市況動向に急激な変化が生じたときなどは、この運用ができない場合があります。</p>')
    fs = fee_section(p, vals={('rakuten-schd', 'ter'): '0.19%※（2025/8/26〜2026/2/25の年率換算）', ('sbi-schd4', 'ter'): '0.13%（2025/9/30〜2026/3/30の年率換算）'})
    assert fs.count('<div class="scroll-wrap">') == 1
    fn = fee_note(p)
    import re as _re
    fn, _n = _re.subn(r'<p>※楽天・SCHD（四半期決算型）の0\.19%には、[^<]*</p>', '', fn)  # ※の説明は表の前の段落に1回だけ書く（対象期間・参考値の条件と同じ場所）
    assert _n == 1
    p.frags = [(c, t) for c, t in p.frags if not t.startswith('※楽天・SCHD（四半期決算型）の0.19%には')]
    # 表の下の注は小見出しで3つに分ける。貸付の段落は答え（表の率に含まない）を先頭にし、長い1文は略称で120字に収める
    fparas = fn[len('<p>'):-len('</p>')].split('</p><p>')
    assert len(fparas) == 4 and fn.startswith('<p>') and fn.endswith('</p>'), len(fparas)
    old_tail = '表の信託報酬と実質的な信託報酬は、貸付を行った場合のこれらの額を含まない率です。'
    new_head = '表の信託報酬と実質的な信託報酬は、貸付を行った場合の次の額を含まない率です。'
    old_sb = f'{B["short"]}の交付目論見書は、有価証券の貸付の指図を行った場合、'
    new_sb = f'{b_}の交付目論見書は、有価証券の貸付の指図を行った場合、'
    assert fparas[3].count(old_tail) == 1 and fparas[3].endswith(old_tail) and fparas[3].count(old_sb) == 1
    _old_sb_full = next(t for c, t in p.frags if c == 'sbi-schd4-lend' and t.startswith(old_sb))
    p.frags = [(c, t) for c, t in p.frags if t != old_tail and t != _old_sb_full]
    lend_p = S(p, 'rakuten-schd-lend', new_head) + fparas[3][:-len(old_tail)].replace(old_sb, new_sb)
    S(p, 'sbi-schd4-lend', _old_sb_full.replace(old_sb, new_sb))
    fn = (S(p, 'tersrc', '<h3 id="ter-note">総経費率の読み方</h3>') + P(fparas[0]) + P(fparas[1])
          + S(p, 'rakuten-schd-effnote', '<h3 id="eff-note">実質的な信託報酬の時点と変動</h3>') + P(fparas[2])
          + S(p, 'rakuten-schd-lend', '<h3 id="lend-fee">貸付を行った場合の報酬</h3>') + P(lend_p))
    assert fs.endswith('</table></div>')
    body += fs.replace('<div class="scroll-wrap">', fctx + '<div class="scroll-wrap">', 1) + fafter + fn
    p.claims['feehead']['exceptions'] += (' 表の前の段落に書いた資料の時点と留保: 「' + Q('sschd_P', r'上記の費用等については、本書作成日現在の情報であり、今後変更される場合があります。') + '」（sschd_P）、運用方針の留保「'
        + Q('sschd_P', SB_RES) + '」（sschd_P）／「' + Q('risude_P', RK_RES) + '」（risude_P）。')
    # ---- 投資先・決算・分配金
    body += S(p, 'etfpair', '<h2 id="mechanism">投資先のETFと、決算月・分配金の実績</h2>')
    # 2026-10-11 画面の関門: 答え（同じETF・連動対象・ベンチマークなし）を先に。記載の時点と運用できない場合は、ファンドごとの注に1回
    body += P(S(p, 'etfpair', '2本とも、交付目論見書の運用方針では、マザーファンドを通じて同じ「シュワブ・米国配当株式ETF」に投資します。'),
              S(p, 'nobmpair', '投資先のETFは、2本の交付目論見書の投資対象ファンドの概要では、ダウ・ジョーンズ US ディビデンド 100 インデックスへの連動をめざします。'),
              S(p, 'nobmpair', '2本とも交付目論見書上のベンチマークはありません。'))
    body += ('<ul><li>' + S(p, 'rk-etf', f'{a_}の投資先の記載は2026年2月末現在で、今後変更になる場合があります。{a_}は、資金動向や市況動向の急変時、投資信託財産の規模、やむを得ない事情によっては、この運用ができない場合があります。')
             + '</li><li>' + S(p, 'sb-etf', f'{b_}の投資先の記載は2026年3月末現在で、今後変更になる場合があります。{b_}は、資金動向や市況動向の急変時や信託財産の規模によっては、この運用ができない場合があります。') + '</li></ul>')
    t2, sa, sb = dist_table(p, a_, b_, ra, rb)
    body += S(p, 'settlepair', '<h3 id="dist">決算月と、直近4回の分配金</h3>')
    body += P(S(p, 'settlepair', f'決算日は、{a_}が原則として2・5・8・11月の各25日、{b_}が原則として3・6・9・12月の各28日です（どちらも休業日の場合は翌営業日）。'),
              S(p, 'schg', f'{b_}は2025年8月13日の約款変更で、決算日を各19日から各28日に変えました。運用会社は、投資対象ETFの配当時期に対応させる変更と説明しています。'))
    body += S(p, 'distA', '<p data-review-context="before-table">次の表は、2026年9月30日までの直近4回の決算で実際に支払われた分配金で、1万口当たり・税引前の金額です。</p>') + t2
    body += P(S(p, 'distA', '分配金は1万口当たりの金額で、基準価額の水準が違う2本の円の金額どうしでは利回りの高低を比べられません。'),
              S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われた金額に相当する分、基準価額は下がります。'),
              S(p, 'distpolicy', '分配金額は収益分配方針に基づいて委託会社が決め、支払われない場合もあります。'),
              S(p, 'distover', 'どちらの交付目論見書も、購入価額によっては分配金の一部または全部が、実質的には元本の一部払戻しに相当する場合があるとしています。'),
              S(p, 'perf', '冒頭の実績の表は、分配金を受け取らずに税引前のまま再投資したと仮定した値です。'))
    body += P(S(p, 'cum-a', f'設定来の分配金の合計（1万口当たり・税引前）は、{a_}が2026年8月の決算までの7回で595円です（月次レポート・2026年8月31日作成基準）。'),
              S(p, 'cum-b', f'{b_}の設定来の分配金の合計（1万口当たり・税引前）は、2026年9月の第7期決算までで517円で、第1期（2025年3月の決算）は0円でした。'),
              S(p, 'cum-b', '設定日と決算の時期が違うので、この2つの合計も金額どうしでは比べられません。'))
    body += S(p, 'nisapair', '<h3 id="nisa">NISAと純資産総額</h3>')
    body += P(S(p, 'nisapair', f'{jd(GOT)}に確認した交付目論見書では、2本ともNISAの「成長投資枠」の対象で、「つみたて投資枠」の記載はありません（販売会社により取扱いが異なる場合があります）。'),
              S(p, 'nav-a', f'2026年9月30日の純資産総額は、{a_}が運用会社の公表データで2,577.04億円です。'),
              S(p, 'nav-b', f'{b_}の純資産総額は、2026年9月30日基準の月次レポートで2,273.27億円です。'))
    # ---- 費用の詳細
    body += S(p, 'effpair', '<h2 id="cost-detail">ETFの報酬をどう数えるかで、表示の料率が変わる</h2>')
    body += P(S(p, 'rakuten-schd-eff', f'{a_}の信託報酬は税込で年0.1238%です（その他の費用と貸付時の報酬を除く）。投資先ETFで日々差し引かれる年0.06%程度の報酬相当額は、委託会社が合理的に見積ってファンドに充当すると交付目論見書に書かれています。そのため交付目論見書は、実質的に負担する運用管理費用を信託報酬と同じ率の概算で表示していますが、実際の組入状況・運用状況によって変動する目安です。'))
    body += P(S(p, 'sbi-schd4-eff', f'{b_}は、国内ファンド分の税込年0.0627%に投資先ETFの年0.06%程度を加味した信託報酬率を、年0.1227%程度と表示しています（その他の費用と貸付時の追加分を除く税込の概算で、変更の場合あり）。'),
              S(p, 'feecut', f'{b_}の信託報酬は、2025年5月20日に税込で年0.0638%から年0.0627%へ引き下げられました。'))
    body += P(S(p, 'effgap', f'この2つの税込の概算料率の差は年{d}ポイント程度で、100万円を1年間一定額で保有し料率も変わらないと仮定した目安は約{amt}円です（その他の費用と貸付時の報酬を除いた料率だけの差）。この金額は実際の利益差ではありません。'))
    pair_claim(p, 'terpair', 'ter', f'{A["short"]}と{B["short"]}の総経費率と対象期間')
    schd_terfund_claim(p)
    p.docq('sbi-schd4-terbrk', 'SBI・SCHD（年4回決算型）の総経費率の内訳（作成対象期間2025年9月30日〜2026年3月30日・年率換算の参考値）', 'sschd_Ak',
           r'総経費率（①＋②） 0\.13％ ①当ファンドの費用の比率 0\.07％ ②投資先ファンドの運用管理費用の比率 0\.06％',
           '交付運用報告書の総経費率の内訳。同じ表の注: 各比率は年率換算した値で四捨五入の関係により合計が一致しない場合がある／①と②の費用は計上された期間が異なる場合がある／投資先ファンドは概算値を使用している場合がある／あくまでも参考で実際に発生した費用の比率とは異なる。投資先ETFの報酬相当額を委託会社が充当する旨の注記は無い（交付目論見書・交付運用報告書の全文を「充当」で検索して0件）。',
           extra_doc=[('sschd_Ak', r'（注６）①と②の費用は、計上された期間が異なる場合があります。 （注７）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。')])
    assert '充当' not in text('sschd_P') and '充当' not in text('sschd_Ak')
    body += P(S(p, 'rakuten-schd-terfund', f'上の表の総経費率は、{a_}の値にだけ、投資先ETFの報酬を含めたうえで、委託会社が合理的に見積った報酬相当額をファンドに別途充当しているという注記があります。'),
              S(p, 'sbi-schd4-terbrk', f'{b_}の交付目論見書と交付運用報告書には、このような充当の注記はありません。'),
              S(p, 'rakuten-schd-terfund', '充当の扱いが違うため、総経費率の数字どうしの差は、そのまま実質的な負担の差にはなりません。'))
    # ---- 計算条件
    ms = method_section(p)
    old_tax = '投資者ごとの税金（分配金や換金時の差益にかかる税金）は含めていないため、実際に受け取る手取り額とは異なります。'
    new_tax = '課税口座で課税される普通分配金や譲渡益がある場合の手取り額は、その税金の分だけこの評価額より少なくなります（NISAの非課税の扱いを受ける場合は、この税金はかかりません）。'
    assert ms.count(old_tax) == 1
    old_f = '比較期間の終了時評価額は「100万円×終点の再投資基準価額÷起点の再投資基準価額」で計算しました。'
    new_f = '比較期間の終了時評価額は、税引前の分配金を再投資した基準価額を使い、「100万円×終点の値÷起点の値」で計算した売却前の金額で、投資者ごとの税金は含みません。'
    assert ms.count(old_f) == 1
    ms = ms.replace(old_f, new_f); S(p, 'method', new_f)
    # 2026-10-11 画面の関門: 1段落目（301字・かっこの入れ子）を、起点の段落と終点・データの段落に分ける。リードから移した段落はここに置く
    _m4 = _re.search(r'終点は月末の[^<]*?月末で区切っています）。</p>', ms)
    assert _m4 and ms.count(_m4.group(0)) == 1
    new_end = _m4.group(0)[:-len('</p>')].replace('に固定しました（取得したデータは', 'に固定しました。取得したデータは').replace('月末で区切っています）。', '月末で区切っています。')
    assert '（取得した' not in new_end and new_end.count('。') == 2
    new_src = (f'基準価額は、{A["short"]}が運用会社の公表する分配金再投資基準価額です。{B["short"]}は、ウエルスアドバイザーが配信する基準価額と日々の騰落率から計算した、税引前の分配金再投資ベースの値です。どちらも{jd(r["終点"])}までのデータです。'
               f'費用は{jd(GOT)}に確認した交付目論見書・交付運用報告書・月次レポートの記載です。どちらかの購入や売却を勧めるものではなく、資料で確かめられる事実を並べています。')
    ms = ms.replace(_m4.group(0), '</p>' + P(S(p, 'method', new_end)) + P(S(p, 'method', new_src)))
    p.docq('taxnote', '2本の交付目論見書の税金の節: 個人投資者の普通分配金と換金（解約）時・償還時の差益に課税され、NISAを利用した場合は一定の額を上限として配当所得・譲渡所得が無期限で非課税', 'sschd_P',
           r'一定の額を上限として、毎年、 一定額の範囲で新たに 購入した公募株式投資信託などから生じる配当所得及び譲渡所得が無期限で非課税となります。',
           '同じ節の注を全件: 個人投資者の源泉徴収時の税率で課税方法等により異なる場合がある／NISAを利用できるのは非課税口座を開設するなど一定の条件に該当する方／外国税額控除の適用となった場合は分配時の税金が異なる場合がある／法人の場合は異なる／税法が改正された場合等には税率等が変更される場合がある。本文には税率の数字は書かず、課税される場合と税金がかからない場合を同じ文に書いた。',
           extra_doc=[('risude_P', r'以下の表は、個人投資者の源泉徴収時の税率であり、課税方法等により異なる場合があります。'), ('risude_P', r'※法人の場合は、上記と異なります。')])
    S(p, 'taxnote', new_tax)
    body += ms.replace(old_tax, new_tax)
    body += faq_block(p, [
        ('etfpair', f'{a_}と{b_}は同じものに投資していますか？', [('etfpair', f'どちらも、{jd(GOT)}に確認した交付目論見書の運用方針では、マザーファンドを通じてシュワブ・米国配当株式ETFに投資します。'),
                                                         ('settlepair', 'ただし別の投資信託で、運用会社、設定日、決算月、信託報酬の率が違います。')]),
        ('effpair', '信託報酬はどちらが低いですか？', [('effpair', f'投資先ETFの報酬を加味した実質的な信託報酬は、交付目論見書の概算（税込年率）で{a_}が年0.1238%程度、{b_}が年0.1227%程度です。'),
                                             ('effpair', 'どちらも、監査報酬などのその他の費用と、有価証券の貸付を行った場合の報酬は含みません。'),
                                             ('rakuten-schd-terfund', f'総経費率は{a_}のほうに投資先ETFの報酬の充当の注記があり、数字どうしをそのまま比べられません。')]),
        ('settlepair', '分配金が出る月は同じですか？', [('settlepair', f'違います。決算日は{a_}が原則として2・5・8・11月の各25日、{b_}が原則として3・6・9・12月の各28日で、休業日の場合は翌営業日です。'),
                                              ('distpolicy', '分配金額は収益分配方針に基づいて委託会社が決め、支払われない場合もあります。')]),
        ('nisapair', 'NISAのつみたて投資枠の対象ですか？', f'{jd(GOT)}に確認した交付目論見書では、2本ともNISAの「成長投資枠」の対象と書かれていて、「つみたて投資枠」の記載はありません。販売会社により取扱いが異なる場合があります。'),
        faq_net(p),
        ('perf', '直近1年ではどちらが上でしたか？', f"{jd(one['起点'])}〜{jd(one['終点'])}の税引前分配金再投資ベースの騰落率は、{a_}が{pct(one['A累積'])}、{b_}が{pct(one['B累積'])}でした。開始日によって結果は変わり、過去の実績は将来の成果を示しません。"),
    ])
    for k in (p.a, p.b):
        for dd_ in (FUNDS[k]['P'], FUNDS[k].get('Ak'), FUNDS[k].get('M')):
            p.src(dd_)
    p.src('sschd_N1'); p.src('sschd_N2')
    sections = std_sections('mechanism', '投資先のETFと、決算月・分配金の実績', 'ETFの報酬をどう数えるかで、表示の料率が変わる')
    related = [('../rakuten-schd-vs-rakuten-vym/', '楽天・SCHD vs 楽天・VYM', '楽天・SCHDをVYM型と比べる'),
               ('../sbi-spyd-vs-rakuten-schd/', 'SBI・SPDR・S&P500高配当 vs 楽天・SCHD', '楽天・SCHDをS&P500高配当型と比べる'),
               ('../rakuten-jepi-vs-rakuten-schd/', '楽天・JEPI vs 楽天・SCHD', '楽天・SCHDをカバードコール型と比べる'),
               ('../sbi-nihon-kohaitou-vs-rakuten-nihon-kohaitou/', 'SBI日本高配当 vs 楽天・高配当株式・日本', '日本株の高配当ファンドどうしを比べる')]
    return p, title, desc, body, sections, related


# ======================================================================== 2026-10-12 gold: Rakuten Gold (unhedged) vs MUFG Junkin
@article
def a_gold_mufg():
    p = Page('rakuten-gold-vs-mufg-gold', 'rakuten-gold', 'mufg-gold', 'rakuten-gold__mufg-gold')
    r = p.r_
    A, B = p.A, p.B
    a_, b_ = '楽天・ゴールド', '三菱UFJ 純金ファンド'
    PERIOD = f"{jd(r['起点'])}〜{jd(r['終点'])}"
    assert '1年窓' not in r and r['年数'] < 1
    p.title = title = '楽天・ゴールド vs 三菱UFJ 純金ファンド（ファインゴールド）の違い｜費用と実績'
    desc = (f"楽天・ゴールド（為替ヘッジなし）と三菱UFJ 純金ファンドは、投資先が外貨建ての金ETF等と国内上場の金ETFで別です。"
            f"{PERIOD}の税引前・分配金再投資ベースの実績と、費用の違いを資料で比べます。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    assert tax_pair(p) is None  # 三菱UFJ側の税金の表は段組が違い共通の型に合わない。税金の文はこのページ用に書く
    pair_claim(p, 'effpair', 'eff', '2本の実質的な信託報酬（投資先ETFの報酬を加味した信託報酬率の概算。その他の費用・貸付時の報酬・購入時手数料は含まない）')
    eff_scope(p)
    RK_RES = r'資金動向、市況動向等に急激な変化が生じたとき等、ならびに投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、 上記のような運用ができない場合があります。'
    MG_RES = r'市況動向および資金動向等により、上記のような運用が行えない場合があります。'
    # ---- 投資先
    p.docq('rk-etf', '楽天・ゴールド（為替ヘッジなし）はマザーファンドを通じて、主として金価格の値動きをとらえることを目指す上場投資信託証券（ETF）等に投資し、金地金への直接投資は行わない', 'ricgld_P',
           FUNDS['rakuten-gold']['index_q'][1],
           '同じ節の注（本文の同じ節に書いた）: 資金動向、市況動向等に急激な変化が生じたとき等、ならびに投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、上記のような運用ができない場合がある。効率的な運用のため有価証券の貸付取引を行う場合がある。',
           extra_doc=[('ricgld_P', RK_RES)])
    p.docq('cand-r', '楽天・ゴールドの交付目論見書が挙げる投資対象ETF等（2025年9月末現在の情報）と、その運用の基本方針・管理報酬等', 'ricgld_P',
           r'以下は、2025年9月末現在で委託会社が知り得る情報を基に作成しています。.{0,400}?SPDR ゴールド・.{0,260}?iシェアーズ ゴールド・.{0,260}?動させることを目指す .{1,3}上記の内容は、今後変更になる場合があります。',
           '表の下の注「上記の内容は、今後変更になる場合があります」を本文の同じ文に書いた。実際の組入は月次レポートの値を別の文に書いた。表は段組のため、抽出テキストでは語順が入れ替わる（SPDR ゴールド・ミニシェアーズ・トラスト＝ＬＢＭＡ金価格指数のパフォーマンスへの連動を目指す・0.10%／iシェアーズ ゴールド・トラスト・マイクロ＝金価格の値動きに概ね連動させることを目指す・0.09%）。')
    p.docq('hold-r', '楽天・ゴールド（為替ヘッジなし）のマザーファンドの組入（月次レポート・2026年8月31日作成基準）', 'ricgld_M',
           r'楽天・ゴールド・マザーファンド 100\.0% SPDR ゴールド・ミニシェアーズ・トラスト 99\.9%',
           '月次レポートの「為替ヘッジなし」の欄。同じ欄の注: 比率はファンドまたはマザーファンドの純資産総額に対する各資産の評価額の比率。追加設定の計上タイミングのずれ等で主要投資対象の比率が100%超となることがある。2026年9月分の月次レポートは' + jd(GOT) + '時点で運用会社のページに未掲載。')
    p.docq('mg-etf', '三菱UFJ 純金ファンドは「純金上場信託（現物国内保管型）」（愛称「金の果実」）を主要投資対象とし、投資比率は原則として高位を維持する。金の果実は国内に保管される金の現物を裏付け資産とする', 'mgold_P',
           r'● 純金上場信託\(現物国内保管型\)\(愛称: 「金の果実」 \)への投資比率は原則として高位を維 持します。',
           '同じ節の注を全件（本文の同じ節に書いた）: 上記の各運用プロセスは変更される場合があり、市場環境等によっては上記のような運用ができない場合がある／金の果実の基準価額と市場価格とのカイ離が著しい場合等には、他の上場投資信託証券に投資することがある／ファンドの基準価額は指標価格・国内の店頭小売・買取価格・海外で公表される取引価格とカイ離が生じる場合がある／金の果実についての記載は2026年1月末時点の内容。',
           extra_doc=[('mgold_P', r'とは、三菱商事が信託委託者として拠 出した金の現物を、信託受託者である三菱UFJ信託銀行が信託財産として国内に保管し た上で、当該信託財産を裏付けとして発行された受益証券発行信託の受益権を、2010 年７月に東京証券取引所に上場したETFです。'),
                      ('mgold_P', r'※2026年１月末時点の内容です。'), ('mgold_P', MG_RES),
                      ('mgold_P', r'の基準価額と市場価格とのカイ離が著しい場合等には、 他の上場投資信託証券に投資することがあります。')])
    p.docq('mg-price', '三菱UFJ 純金ファンドの参考指標「わが国の取引所における金価格」は、大阪取引所における金1グラムあたりの先物価格をもとに現在価値として算出した理論価格で、ベンチマークは無い', 'mgold_P',
           r'わが国の取引所における金価格とは、大阪取引所における金１グラムあたりの先物価格をもとに現在価値として 算出した理論価格をいい、 ファンドの参考指標です。',
           '同じ節の注（本文の同じ段落に書いた）: 金の果実の市場価格は市場の需給により変動するため、ファンドの基準価額は金価格の理論値である指標価格および日本における金の店頭小売・買取価格や海外で公表される取引価格とカイ離が生じる場合がある。信託報酬等のコスト負担等により基準価額が指標価格と一致した推移となることを約束するものではない。ベンチマークが無い旨は運用実績の欄。',
           extra_doc=[('mgold_P', r'・ファンドにベンチマークはありません。'),
                      ('mgold_P', r'ファンドの基準価額は金価格の理論値である指標価 格および日本における金の店頭小売・買取価格や海外で公表される取引価格とカイ離が生じる場合があります。')])
    p.docq('hold-m', '三菱UFJ 純金ファンドの資産構成（月次レポート・2026年9月30日現在）: ETF 99.8%', 'mgold_M',
           r'ETF 99\.8%', '月次レポートの資産構成の欄。原則として比率は純資産総額に対する割合で、表示桁未満は四捨五入。コールローン他は0.2%。',
           extra_doc=[('mgold_M', r'・表示桁未満の数値がある場合、四捨五入しています。・原則として、比率は純資産総額に対する割合です。')])
    p.claim('nobmpair', '2本とも交付目論見書でベンチマークは無い', url('ricgld_P'), Q('ricgld_P', r'なお当ファンドに、ベンチマークはありません。'), f'{GOT}に確認した2本の交付目論見書',
            '2本の交付目論見書の運用実績（年間収益率の推移）の欄で確認。三菱UFJ 純金ファンドは参考指標（わが国の取引所における金価格）を持つが、ベンチマークではない。 比較相手: ' + url('mgold_P') + '「' + Q('mgold_P', r'・ファンドにベンチマークはありません。') + '」')
    # ---- 為替
    p.docq('rk-fx', '楽天・ゴールド（為替ヘッジなし）は実質的な外貨建資産について原則として為替ヘッジを行わず、円高方向の為替変動は基準価額の下落要因になる', 'ricgld_P',
           r'「為替ヘッジなし」は、実質的な外貨建資産について原則として為替ヘッジを行わないた め、為替レートの変動により基準価額は変動します。為替レートが円高方向に変動した 場合には、基準価額が下落する要因となります。',
           '交付目論見書の投資リスク（為替変動リスク）の欄の「為替ヘッジなし」の全文。同じ欄の前半は「為替ヘッジあり」のコースの記載で、この記事の対象外。運用方針どおりの運用ができない場合がある旨（特色の節の注）は投資先の節に書いた。',
           extra_doc=[('ricgld_P', FUNDS['rakuten-gold']['hedge_q'][1])])
    p.docq('rk-2c', '楽天・ゴールド・ファンドは為替ヘッジの有無が違う2つのファンド（為替ヘッジあり／為替ヘッジなし）で構成される', 'ricgld_P',
           r'2 為替ヘッジ有無の異なる2つのファンドから構成されています',
           '同じ節の注: 販売会社によっては一部のコースのみの取扱いとなる場合がある（本文の同じ文に書いた）。この記事は「為替ヘッジなし」だけを扱う。',
           extra_doc=[('ricgld_P', r'※販売会社によっては、一部のコースのみの取扱いとなる場合があります。')])
    p.docq('mg-fx', '三菱UFJ 純金ファンドは外貨建資産への投資を行わず、為替ヘッジも行わない。ただし裏付けとなる金地金の指標価格は一般的に為替相場の変動の影響を受ける', 'mgold_P',
           FUNDS['mufg-gold']['hedge_q'][1],
           '交付目論見書の投資リスク（為替変動リスク）の欄の全文（抽出テキストでは欄の見出し「為替変動 リスク」が文の途中に挟まる）。主な投資制限の欄にも「外貨建資産への投資は行いません」とある。',
           extra_doc=[('mgold_P', r'外貨建資産 外貨建資産への投資は行いません。')])
    # ---- 売買
    p.docq('rk-trade', '楽天・ゴールドの購入価額・換金価額は申込受付日の翌営業日の基準価額（継続申込期間）。換金代金は原則として換金申込受付日から起算して5営業日目以降。ニューヨーク証券取引所・ニューヨークの銀行の休業日などは申込みを受け付けない', 'ricgld_P',
           r'【継続申込期間】購入申込受付日の翌営業日の基準価額',
           '交付目論見書のお申込みメモ。同じ欄を全件: 当初申込期間（2026年1月13日〜1月20日）の購入価額は1口当たり1円で、本文は継続申込期間の定めを書いた／申込締切は原則として営業日の午後3時30分までに販売会社所定の事務手続きが完了したもの（販売会社によっては対応が異なる場合がある）／申込不可日はニューヨーク証券取引所およびニューヨークの銀行の休業日と、委託会社が定める日／大口の換金には制限を設ける場合がある／取引の停止などやむを得ない事情があるときは受付を中止・取消すことができる。',
           extra_doc=[('ricgld_P', r'換 金 価 額 換金申込受付日の翌営業日の基準価額 換 金 代 金 原則として、換金申込受付日から起算して5営業日目以降に受益者にお支払いします。'),
                      ('ricgld_P', r'以下のいずれかに該当する日には、申込みの受付を行いません。 購 入・ 換 金 申 込 不 可 日 ・ニューヨーク証券取引所およびニューヨークの銀行の休業日 ・委託会社が定める日')])
    p.docq('mg-trade', '三菱UFJ 純金ファンドの購入価額・換金価額は申込受付日の基準価額。換金代金は原則として換金申込受付日から起算して4営業日目から', 'mgold_P',
           r'購入申込受付日の基準価額 購入価額',
           '交付目論見書のお申込みメモ。同じ欄を全件: 申込締切は原則として午後3時30分までに販売会社が受付けたもの（販売会社によっては異なる場合がある）／大口の換金に制限を設ける場合がある／金融商品取引所等の取引の停止、投資対象とするETFの売買停止等のやむを得ない事情があるときは受付を中止・取消すことがある。海外の休業日による申込不可日の定めは無い。',
           extra_doc=[('mgold_P', r'換金価額 換金申込受付日の基準価額 換金時 原則として、換金申込受付日から起算して４営業日目から販売会社においてお支払いし 換金代金 ます。')])
    assert '申込不可日' not in text('mgold_P').replace(' ', '') and 'ニューヨーク' not in text('mgold_P')
    # ---- NISA・分配・純資産
    assert 'つみたて' not in text('ricgld_P') and 'つみたて' not in text('mgold_P'), 'a prospectus now mentions the tsumitate frame: rewrite the NISA sentences'
    p.docq('nisapair', '2本の交付目論見書はどちらも、NISAの「成長投資枠」の対象と書き、「つみたて投資枠」の記載は無い（販売会社により取扱いが異なる場合がある）', 'ricgld_P',
           r'・当ファンドは、NISAの 「成長投資枠（特定非課税管理勘定） 」の対象ですが、販売会社に より取扱いが異なる場合があります。',
           '2本の交付目論見書の課税関係の欄。抽出テキスト全文を「つみたて」で検索して2本とも0件であることを生成のたびに assert で確かめている。同じ欄・税金の節の注: NISAを利用できるのは販売会社で非課税口座を開設し、税法上の要件を満たした商品を購入するなど一定の条件に該当する方。税法が改正された場合等には変更される場合がある。',
           extra_doc=[('mgold_P', r'の対象です。 販売会社により取扱いが異なる場合があります。くわしくは、販売会社にご確認ください。')])
    p.docq('dist-r', '楽天・ゴールド（為替ヘッジなし）の分配金は第1期（2026年8月の決算）が0円で、設定来分配金合計額は0円（1万口当たり・税引前）', 'ricgld_M',
           r'設定来 △6\.9% ご確認ください。.{0,160}?分配金（税引前、1万口当たり） 設定来分配金合計額 0 円 決算期 2026年8月 2027年8月 2028年8月 分配金 0 円 - 円 - 円',
           '月次レポート（2026年8月31日作成基準）の「為替ヘッジなし」の欄。同じ欄の注: 分配金実績は将来の分配金の水準を示唆・保証するものではない。委託会社の判断により分配を行わない場合もある。',
           extra_doc=[('ricgld_M', r'※ 分配金実績は、将来の分配金の水準を示唆・保証するものではありません。')])
    p.docq('dist-m', '三菱UFJ 純金ファンドの分配金は設定来累計0円（1万口当たり・税引前。第15期・2026年1月20日の決算まで）で、信託財産の成長を優先し原則として分配を抑制する方針', 'mgold_M',
           r'第15期 2026/01/20 0円 .{0,400}?設定来累計 0円',
           '月次レポート（2026年9月30日現在）の分配金実績。同じ欄の注: 運用状況によっては分配金額が変わる場合、あるいは分配金が支払われない場合がある。分配方針は交付目論見書（原則として分配を抑制する方針。基準価額水準や市況動向等により変更する場合がある。将来の分配金の支払いおよびその金額を保証するものではない）。',
           extra_doc=[('mgold_P', r'分配金額の決定にあたっては、信託財産の成長を優先し、原則として分配を抑制する方針とし ます。 （基準価額水準や市況動向等により変更する場合があります。）')])
    q_nav, u_nav = nav_rows('rakuten-gold', '2026-09-30')
    assert q_nav.endswith('2026/09/30,8581,8581,300.54,'), q_nav
    p.claim('nav-a', '楽天・ゴールド（為替ヘッジなし）の純資産総額（2026年9月30日）', u_nav, q_nav, f'{GOT}に確認した運用会社（楽天投信投資顧問）公表の基準価額データの純資産総額の列',
            '純資産総額は日々変わる。2026年9月分の月次レポートは' + jd(GOT) + '時点で運用会社のページに未掲載（最新は2026年8月31日作成基準で313.08億円）のため、同じ運用会社が公表する日次データの9月30日の行を使った。')
    p.docq('nav-b', '三菱UFJ 純金ファンドの純資産総額（2026年9月30日現在）', 'mgold_M', r'純資産総額 8,443\.21億円',
           '月次レポートの「基準価額および純資産総額」の欄。純資産総額は日々変わる。')
    # ---- 費用
    p.docq('mg-buy', '三菱UFJ 純金ファンドの購入時手数料は購入価額に対して上限1.1%（税抜1%）で、販売会社が定める。信託財産留保額は無い', 'mgold_P',
           FUNDS['mufg-gold']['nofee_q'][1],
           '交付目論見書の「投資者が直接的に負担する費用」の欄の全文。購入時手数料は販売会社により異なる（上限の率で、0%の販売会社もありうるが、個々の販売会社の率は資料に無いので本文に書いていない）。')
    gap_claim(p, 'effgap', '2本の実質的な信託報酬（交付目論見書の概算）の差と、100万円を1年間一定額で保有すると仮定した目安', 'eff')
    d = round(0.99 - 0.2925, 4); amt = round(d / 100 * 1_000_000)
    assert (d, amt) == (0.6975, 6975), (d, amt)
    ci = p.claims[p.fc('rakuten-gold', 'incept')]
    days = (dt.date.fromisoformat(r['終点']) - dt.date.fromisoformat(r['起点'])).days
    assert days == 252 and round(days / 365.25 * 12, 1) == 8.3
    p.claim('period', f'比較期間（楽天・ゴールドの設定日{jd(r["起点"])}〜{jd(r["終点"])}）の長さは約8か月', ci['source_url'], ci['source_quote'], ci['applies'],
            ci['exceptions'] + ' 終点は月末に固定した（本文の計算条件）。期間の長さは暦日数から計算した値。三菱UFJ 純金ファンドの設定日: 「' + Q(*FUNDS['mufg-gold']['incept_q']) + '」',
            scope=f'この記事の比較期間（{PERIOD}）の長さ。楽天・ゴールドの設定日を起点にした理由は計算条件の節')
    # ---- lead
    lead = P(S(p, 'mg-etf', f'結論から言うと、{a_}（為替ヘッジなし）と{b_}は、どちらも金に連動する値動きをめざす投資信託ですが、投資先のETFが別です。'),
             S(p, 'effpair', '費用の率と、購入・換金に使う基準価額の日も違います。'))
    lead += ('<ul><li>' + S(p, 'rk-etf', f'<b>投資先</b>：{a_}はマザーファンドを通じて主に外貨建ての金ETF等に投資し、{b_}は国内に保管される金の現物を裏付けとする国内上場のETF「金の果実」を主要投資対象とします。')
             + '</li><li>' + S(p, 'effpair', f'<b>費用</b>：実質的な信託報酬（税込の概算で、その他の費用と貸付時の報酬を除く）は、今後変わりうる目安で、{a_}が2025年9月末現在の投資先報酬で年0.2925%程度、{b_}が2026年1月末現在で年0.99%程度です。')
             + '</li><li>' + S(p, 'perf', f"<b>実績</b>：{PERIOD}に一括投資した100万円の評価額は、税引前の分配金再投資ベースで{a_}が{yen(r['A100万円終価'])}、{b_}が{yen(r['B100万円終価'])}でした（売却前で、購入時手数料と税金を除く仮定）。") + '</li></ul>')
    lead += P(S(p, 'period', f'{a_}の設定日（{jd(r["起点"])}）からの比較で、期間は約8か月です。'),
              S(p, 'identity', f'この記事では、{A["name"]}を「{a_}」と書きます。{b_}の愛称は「ファインゴールド」です。'))
    p.lead = lead_block(p, lead)
    old_src = (f'<p>基準価額は{A["short"]}と{B["short"]}とも運用会社の公表する分配金再投資基準価額で、どちらも{jd(r["終点"])}までのデータです。'
               f'費用は{jd(GOT)}に確認した交付目論見書・交付運用報告書・月次レポートの記載です。どちらかの購入や売却を勧めるものではなく、資料で確かめられる事実を並べています。</p>\n')
    assert p.lead.count(old_src) == 1, p.lead[-600:]
    p.lead = p.lead.replace(old_src, '')
    _nf = len(p.frags)
    p.frags = [(c, t) for c, t in p.frags if not t.startswith('基準価額は')]
    assert len(p.frags) == _nf - 1
    # ---- 違いの早見表（核になる違いを先頭の行に）
    def row(label, ca, va, cb, vb, lc=None):
        th = S(p, lc, label) if lc else label
        return f'<tr><th scope="row">{th}</th><td>{S(p, ca, va)}</td><td>{S(p, cb, vb)}</td></tr>'
    body = S(p, 'mg-etf', '<h2 id="diff">2本の違いの早見表</h2>')
    body += S(p, 'feehead', f'<p data-review-context="before-table">次の表は、{jd(GOT)}に確認した2本の交付目論見書の記載です。確認した交付目論見書の使用開始日は、{a_}が2026年1月13日、{b_}が2026年4月18日です。運用方針は、市況動向や資金動向などによってはそのとおりに運用できない場合があります。</p>')
    body += ('<div class="scroll-wrap"><table><thead><tr><th scope="col">項目</th>' + f'<th scope="col">{E(a_)}（為替ヘッジなし）</th><th scope="col">{E(b_)}</th></tr></thead><tbody>'
             + row('主な投資先', 'rk-etf', '外貨建ての金ETF等（マザーファンド経由）', 'mg-etf', '国内上場の純金上場信託「金の果実」')
             + row('外貨建資産と為替ヘッジ', 'rk-fx', '外貨建資産に投資し、原則として為替ヘッジなし', 'mg-fx', '外貨建資産に投資しない。為替ヘッジなし')
             + row('ベンチマーク', 'nobmpair', 'なし', 'mg-price', 'なし（参考指標は国内の取引所の金価格）')
             + row('購入・換金に使う基準価額', 'rk-trade', '申込受付日の翌営業日', 'mg-trade', '申込受付日')
             + row('購入時手数料', 'rakuten-gold-nofee', 'なし', 'mg-buy', '上限1.1%（税込。販売会社が定める）')
             + row('設定日', 'rakuten-gold-incept', A['incept'], 'mufg-gold-incept', B['incept'])
             + row('NISA', 'nisapair', '成長投資枠の対象', 'nisapair', '成長投資枠の対象')
             + '</tbody></table></div>')
    body += S(p, 'nisapair', '<p class="note" data-review-context="after-table">購入時手数料とNISAの取扱いは、販売会社によって異なる場合があります。信託報酬などの料率は「費用」の節の表にまとめています。</p>')
    # ---- 実績
    ps = perf_section(p)
    pctx = S(p, 'perf', f'<p data-review-context="before-table">次の表の値は、比較期間（{PERIOD}）の基準価額から計算した、税引前の分配金を再投資した場合の売却前の値です。購入時・換金時の手数料と投資者ごとの税金は含みません。</p>')
    assert ps.count('<div class="scroll-wrap">') == 1
    body += ps.replace('<div class="scroll-wrap">', pctx + '<div class="scroll-wrap">', 1)
    body += P(S(p, 'perf', f"比較期間は2本とも基準価額が下がり、税引前分配金再投資ベースの累積騰落率は{a_}が{pct(r['A累積'])}、{b_}が{pct(r['B累積'])}でした。"),
              S(p, 'perf', f"{corr_period(p)}{r['同日相関']:.2f}で、同じ日の値動きはそろっていません。"),
              S(p, 'period', '比較期間が約8か月と短いので、この差が今後も続くかどうかは、この実績からは分かりません。'))
    # ---- 費用の表
    body += S(p, 'feehead', '<h2 id="fees">目論見書の料率と、総経費率（参考値）を分けて見る</h2>')
    body += S(p, 'feehead', f'<p data-review-context="before-table">次の表は、{jd(GOT)}に確認した交付目論見書の記載で、料率は税込の年率です。信託報酬の2行は、その他の費用と、有価証券の貸付を行った場合の報酬を含まない率です。費用は今後変更される場合があります。</p>')
    def frow(label, fa_, va, fb_, vb, num=True):
        cls = ' class="num"' if num else ''
        return f'<tr><th scope="row">{label}</th><td{cls}>{S(p, p.fc(p.a, fa_), va)}</td><td{cls}>{S(p, p.fc(p.b, fb_), vb)}</td></tr>'
    body += ('<div class="scroll-wrap"><table class="num-nowrap"><thead><tr><th scope="col">項目</th>' + f'<th scope="col">{E(a_)}（為替ヘッジなし）</th><th scope="col">{E(b_)}</th></tr></thead><tbody>'
             + frow('信託報酬（ファンド本体）', 'fee', '年0.1925%', 'fee', '年0.55%')
             + frow('投資先ETFの報酬を加味した実質的な信託報酬（概算）', 'eff', '年0.2925%程度（2025年9月末現在の投資先報酬による目安で、組入状況により変動）', 'eff', '年0.99%程度（2026年1月末現在）', num=False)
             + frow('総経費率（年率換算の参考値）', 'ter', '未掲載', 'ter', '1.00%（2025/1/21〜2026/1/20）', num=False)
             + frow('決算', 'settle', A['settle'], 'settle', B['settle'], num=False)
             + '</tbody></table></div>')
    p.docq('mg-ternote', '三菱UFJ 純金ファンドの総経費率（交付目論見書の参考情報）は運用管理費用の比率とその他費用の比率の合計で、有価証券貸付の品貸料の一部収受分を含めている場合がある', 'mgold_P',
           r'※総経費率は、有価証券貸付の品貸料の一部収受分を含めている場合があります。',
           '交付目論見書の（参考情報）ファンドの総経費率の欄。同じ欄の注を全件: 当期間の運用・管理にかかった費用の総額（原則として購入時手数料、売買委託手数料および有価証券取引税を除く。消費税等のかかるものは消費税等を含む）を平均受益権口数×平均基準価額で除した値（除く3費目は本文の同じ注記に書いた）／①の運用管理費用には投資先ファンドの運用管理費用を含む／投資先ファンドの費用は対象期間が異なる場合がある／総経費率は有価証券貸付の品貸料の一部収受分を含めている場合がある（本文に書いた）／比率は年率、表示桁数未満四捨五入。',
           extra_doc=[('mgold_P', r'総経費率 （①＋②） ①運用管理費用の比率 ②その他費用の比率'),
                      ('mgold_P', r'※投資先ファンドの費用は対象期間が異なる場合があります。')])
    body += ('<p class="note" data-review-context="after-table">'
             + S(p, 'rakuten-gold-ter', '総経費率は、原則として購入時手数料・売買委託手数料・有価証券取引税を含まない参考値で、実際に発生した費用の比率とは異なります。')
             + S(p, 'mg-ternote', f'{b_}の総経費率は、その他の費用を含み、有価証券貸付の品貸料の一部収受分を含めている場合があります。')
             + S(p, 'rakuten-gold-ter', f'{a_}は第1期決算日が2026年8月17日で、総経費率を載せた交付運用報告書は{jd(GOT)}時点で運用会社のページに未掲載でした。総経費率が未掲載でも、0%とは扱っていません。') + '</p>')
    # ---- 投資先・為替・売買
    body += S(p, 'mg-etf', '<h2 id="mechanism">投資先は、外貨建ての金ETFと国内の金ETF</h2>')
    body += P(S(p, 'rk-etf', f'{a_}は、マザーファンドを通じて、主として金価格の値動きをとらえることを目指す上場投資信託証券（ETF）等に投資します（資金・市況の急変時などは、この運用ができない場合あり）。金地金への直接投資は行いません。'),
              S(p, 'cand-r', '交付目論見書は投資対象のETF等として、SPDR ゴールド・ミニシェアーズ・トラストとiシェアーズ ゴールド・トラスト・マイクロを挙げています（2025年9月末現在の情報で、今後変更になる場合があります）。'),
              S(p, 'hold-r', '2026年8月31日作成基準の月次レポートでは、為替ヘッジなしのマザーファンドの純資産総額に対する組入比率は、SPDR ゴールド・ミニシェアーズ・トラストが99.9%です。'))
    body += P(S(p, 'mg-etf', f'{b_}は、東京証券取引所に上場する「純金上場信託（現物国内保管型）」（愛称「金の果実」）を主要投資対象とし、投資比率は原則として高位を維持します。'),
              S(p, 'mg-etf', '金の果実の基準価額と市場価格のカイ離が著しい場合などは、他の上場投資信託証券に投資することがあります。'),
              S(p, 'mg-etf', '金の果実は、国内に保管される金の現物を裏付け資産とするETFです（2026年1月末時点の交付目論見書の記載）。'),
              S(p, 'hold-m', '2026年9月30日現在の月次レポートでは、純資産総額に対するETFの比率は99.8%です。'))
    body += P(S(p, 'mg-price', f'{b_}がとらえることをめざす「わが国の取引所における金価格」は、大阪取引所における金1グラムあたりの先物価格をもとに、現在価値として算出した理論価格です。'),
              S(p, 'mg-price', '交付目論見書は、ファンドの基準価額が、この指標価格や国内の店頭小売・買取価格、海外で公表される取引価格とカイ離する場合があるとしています。'),
              S(p, 'nobmpair', '2本とも、交付目論見書上のベンチマークはありません。'))
    body += S(p, 'rk-fx', '<h3 id="fx">為替の影響の受け方</h3>')
    body += P(S(p, 'rk-fx', f'{a_}（為替ヘッジなし）は、実質的な外貨建資産について原則として為替ヘッジを行わないため、為替レートが円高方向に動くと基準価額の下落要因になります。'),
              S(p, 'rk-2c', '楽天・ゴールド・ファンドには「為替ヘッジあり」のコースもありますが、この記事は「為替ヘッジなし」だけを扱います（販売会社によっては一部のコースのみの取扱いです）。'))
    body += P(S(p, 'mg-fx', f'{b_}は外貨建資産への投資を行わず、為替ヘッジも行いません。'),
              S(p, 'mg-fx', 'ただし交付目論見書は、裏付けとなる金地金の指標価格は一般的に為替相場の変動の影響を受けると書いています。外貨建資産を持たなくても、為替の影響が無いわけではありません。'))
    body += S(p, 'rk-trade', '<h3 id="trade">購入・換金に使う基準価額の日</h3>')
    body += P(S(p, 'rk-trade', f'{a_}の購入価額と換金価額は、継続申込期間では申込受付日の翌営業日の基準価額です。'),
              S(p, 'mg-trade', f'{b_}の購入価額と換金価額は、申込受付日の基準価額です。'))
    body += P(S(p, 'rk-trade', f'{a_}は、ニューヨーク証券取引所とニューヨークの銀行の休業日、委託会社が定める日には、購入・換金の申込みを受け付けません。'),
              S(p, 'mg-trade', f'{b_}の換金代金の支払いは、原則として換金申込受付日から起算して4営業日目からです。')
              + S(p, 'rk-trade', f'{a_}の換金代金の支払いは、原則として換金申込受付日から起算して5営業日目以降です。'))
    body += S(p, 'dist-m', '<h3 id="dist">分配金・NISA・純資産総額</h3>')
    body += P(S(p, 'dist-m', f'{b_}の1万口当たり・税引前の分配金は、2026年1月20日の第15期決算まで設定来の累計が0円で、交付目論見書は原則として分配を抑制する方針（基準価額水準や市況動向等により変更する場合あり）としています。'),
              S(p, 'dist-r', f'{a_}（為替ヘッジなし）の1万口当たり・税引前の分配金も、2026年8月の第1期決算は0円でした（2026年8月31日作成基準の月次レポート）。'))
    body += P(S(p, 'nisapair', f'{jd(GOT)}に確認した交付目論見書では、2本ともNISAの「成長投資枠」の対象で、「つみたて投資枠」の記載はありません（販売会社により取扱いが異なる場合があります）。'),
              S(p, 'nav-a', f'2026年9月30日の純資産総額は、{a_}（為替ヘッジなし）が運用会社の公表データで300.54億円です。'),
              S(p, 'nav-b', f'{b_}の純資産総額は、2026年9月30日現在の月次レポートで8,443.21億円です。'))
    # ---- 費用の詳細
    body += S(p, 'effpair', '<h2 id="cost-detail">信託報酬の差と、購入時手数料</h2>')
    body += P(S(p, 'rakuten-gold-eff', f'{a_}の信託報酬は税込で年0.1925%で、投資先ETF等の報酬（2025年9月末現在で年0.1%程度）を加味した実質的な負担は年0.2925%程度です（その他の費用と貸付時の報酬を除く概算で、組入状況により変動）。'))
    body += P(S(p, 'mufg-gold-eff', f'{b_}の信託報酬は税込で年0.55%で、投資先ETFの年0.44%程度を合わせた実質的な信託報酬率は年0.99%程度です（2026年1月末現在で、その他の費用と貸付時の追加分を除き、今後変更の場合あり）。'))
    body += P(S(p, 'effgap', f'この2つの税込の概算料率の差は年{d}ポイント程度で、100万円を1年間一定額で保有し料率も変わらないと仮定した目安は約{amt:,}円です（その他の費用と貸付時の報酬を除いた料率だけの差）。この金額は実際の利益差ではありません。'))
    body += P(S(p, 'mg-buy', f'{b_}には、信託報酬とは別に購入時手数料があり、購入価額に対して上限1.1%（税込）の範囲で販売会社が定めます。'),
              S(p, 'rakuten-gold-nofee', f'{a_}の交付目論見書では、購入時手数料は「ありません」です。'),
              S(p, 'mg-buy', '信託財産留保額は2本ともありません。'))
    p.claims['mg-buy']['exceptions'] += ' 楽天・ゴールドの信託財産留保額: ' + url('ricgld_P') + '「' + Q(*FUNDS['rakuten-gold']['nofee_q']) + '」'
    lend_m = p.fc('mufg-gold', 'lend'); lend_r = p.fc('rakuten-gold', 'lend')
    p.claims[lend_m]['exceptions'] = '有価証券の貸付の指図を行った場合だけの定めで、ファンドの品貸料の49.5%（税抜45.0%）以内の額が運用管理費用（信託報酬）に追加される。貸付を行わない場合は追加されない。委託会社と受託会社が受け取る品貸料の配分は1:1。費用の欄は段組のため、抽出テキストでは「（税抜 45.0％）」が文の途中に挟まる。'
    body += P(S(p, lend_m, f'有価証券の貸付の指図を行った場合、{b_}はファンドの品貸料の49.5%（税抜45.0%）以内の額が信託報酬に追加されます。'),
              S(p, lend_r, f'{a_}は、有価証券の貸付取引を行った場合、品貸料に0.55（税抜0.5）を乗じて得た額を、その他の費用・手数料のひとつ（貸付有価証券関連報酬）としています。'))
    # ---- 計算条件
    ms = method_section(p)
    old_f = '比較期間の終了時評価額は「100万円×終点の再投資基準価額÷起点の再投資基準価額」で計算しました。'
    new_f = '比較期間の終了時評価額は、税引前の分配金を再投資した基準価額を使い、「100万円×終点の値÷起点の値」で計算した売却前の金額です。'
    assert ms.count(old_f) == 1
    ms = ms.replace(old_f, new_f); S(p, 'method', new_f)
    import re as _re
    _m4 = _re.search(r'終点は月末の[^<]*?月末で区切っています）。</p>', ms)
    assert _m4 and ms.count(_m4.group(0)) == 1
    new_end = _m4.group(0)[:-len('</p>')].replace('に固定しました（取得したデータは', 'に固定しました。取得したデータは').replace('月末で区切っています）。', '月末で区切っています。')
    new_src = (f'基準価額は、2本とも運用会社の公表する分配金再投資基準価額で、{jd(r["終点"])}までのデータです。'
               f'費用は{jd(GOT)}に確認した交付目論見書・交付運用報告書・月次レポートの記載です。どちらかの購入や売却を勧めるものではなく、資料で確かめられる事実を並べています。')
    ms = ms.replace(_m4.group(0), '</p>' + P(S(p, 'method', new_end)) + P(S(p, 'method', new_src)))
    body += ms
    body += faq_block(p, [
        ('mg-etf', f'{a_}と{b_}（ファインゴールド）の違いは何ですか？', [('rk-etf', f'投資先が違います。{jd(GOT)}に確認した交付目論見書では、{a_}はマザーファンドを通じて外貨建ての金ETF等に投資します。'),
                                                                 ('mg-etf', f'{b_}は、国内に保管される金の現物を裏付けとする国内上場の「金の果実」を主要投資対象とします。'),
                                                                 ('effpair', '信託報酬の率、購入時手数料、購入・換金に使う基準価額の日、設定日も違います。')]),
        ('effpair', '信託報酬はどちらが低いですか？', [('effpair', f'投資先ETFの報酬を加味した実質的な信託報酬は、交付目論見書の概算（税込年率）で、{a_}が2025年9月末現在の投資先報酬で年0.2925%程度、{b_}が2026年1月末現在で年0.99%程度です。'),
                                             ('effpair', 'どちらも、監査費用などのその他の費用と、有価証券の貸付を行った場合の報酬は含まず、今後変更される場合があります。'),
                                             ('rakuten-gold-eff', f'{a_}の率は目安で、投資先の組入状況や運用状況によって変動します。')]),
        ('mg-fx', f'{b_}は為替の影響を受けませんか？', [('mg-fx', f'受けないわけではありません。{b_}は外貨建資産に投資しませんが、交付目論見書は、裏付けとなる金地金の指標価格は一般的に為替相場の変動の影響を受けるとしています。'),
                                                  ('rk-fx', f'{a_}（為替ヘッジなし）は実質的な外貨建資産について原則として為替ヘッジを行わず、円高方向の為替変動は基準価額の下落要因になります。')]),
        ('nisapair', 'NISAのつみたて投資枠の対象ですか？', f'{jd(GOT)}に確認した交付目論見書では、2本ともNISAの「成長投資枠」の対象と書かれていて、「つみたて投資枠」の記載はありません。販売会社により取扱いが異なる場合があります。'),
        faq_net(p),
        ('perf', 'なぜ年率や直近1年の実績を載せていないのですか？', [('period', f'{a_}の設定日が{jd(r["起点"])}で、2本の共通期間が約8か月と1年未満だからです。'),
                                                           ('perf', '短い期間の騰落を1年分に引き延ばすと実際より大きな印象を与えるため、比較期間の累積騰落率だけを載せています。')]),
    ])
    sections = [('diff', '2本の違いの早見表'), ('performance', '同じ期間の実績を、分配金再投資で比べる'), ('fees', '目論見書の料率と、総経費率（参考値）を分けて見る'),
                ('mechanism', '投資先は、外貨建ての金ETFと国内の金ETF'), ('cost-detail', '信託報酬の差と、購入時手数料'), ('method', '計算条件と、この比較からは分からないこと'),
                ('faq', 'よくある質問'), ('source', '出典')]
    related = [('../rakuten-gold-vs-sbi-gold/', '楽天・ゴールド vs SBI・iシェアーズ・ゴールド', '金ETFに投資する別の組を比べる'),
               ('../sbi-gold-vs-mufg-gold/', 'SBI・iシェアーズ・ゴールド vs 三菱UFJ純金', '国内と海外の金価格の違いを確かめる'),
               ('../rakuten-sox-vs-rakuten-nasdaq/', '楽天・プラス・SOX vs 楽天・プラス・NASDAQ-100', '同じ楽天投信の2本を、指数の違いで比べる'),
               ('../../toushi/tsumitate/', '積立シミュレーター', '積立額と期間から将来額の目安を計算します')]
    return p, title, desc, body, sections, related


# ======================================================================== 2026-10-13 金融アドオン: 全世界株式 vs 米国の配当株ETF
@article
def a_orcan_schd():
    p = Page('emaxis-orcan-vs-rakuten-schd', 'orcan', 'rakuten-schd', 'orcan__rakuten-schd')
    p.strict_cursor = True  # 台帳の単位→主張の対応を文書の順で取る
    r = p.r_
    one = r['1年窓']
    O, Sx = 'orcan', 'rakuten-schd'
    a_, b_ = 'eMAXIS Slimオルカン', '楽天・SCHD'
    PERIOD = f"{jd(r['起点'])}〜{jd(r['終点'])}"
    days = (dt.date.fromisoformat(r['終点']) - dt.date.fromisoformat(r['起点'])).days
    assert days == 742 and round(r['年数'], 2) == 2.03, (days, r['年数'])
    p.title = title = 'eMAXIS Slimオルカン vs 楽天・SCHDの違い｜指数・構成・分配・費用と実績'
    desc = (f"eMAXIS Slimオルカンと楽天・SCHD（四半期決算型）は、連動をめざす指数、国と業種の構成、決算の回数が違います。"
            f"{PERIOD}の税引前・分配金再投資の実績と費用を資料で比べます。")
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    p.claims['desc']['scope'] = p.claims['perf']['scope']
    RS_RES = r'資金動向、市況動向等に急激な変化が生じたとき等、ならびに投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、 上記のような運用ができない場合があります。'
    # ---- 指数・投資対象
    p.docq('or-idx', 'eMAXIS Slimオルカンは、日本を含む先進国と新興国の株式で構成されるMSCIオール・カントリー・ワールド・インデックス（配当込み、円換算ベース）をベンチマークとし、連動する投資成果をめざす', 'orcan_P',
           r'ファンドの目的 日本を含む先進国および新興国の株式市場の値動きに連動する投資成果をめざします。',
           '同じ節: 「' + Q('orcan_P', r'ＭＳＣＩ オール・カントリー・ワールド・インデックス（配当込み）とは、MSCI Inc\.が開発した株価指数で、世界の先 ?進国・新興国の株式で構成されています。') + '」。実際の運用は外国株式・新興国株式・日本株式の3つのマザーファンドを通じて行う（費用の欄の注）。ETFは経由しない。',
           extra_doc=[('orcan_P', FUNDS[O]['index_q'][1])])
    p.docq('rs-idx', '楽天・SCHDは米国の株式を実質的な主要投資対象とし、マザーファンドを通じて、ダウ・ジョーンズ US ディビデンド 100 インデックスに連動する投資成果を目指す米国籍のETF（シュワブ・米国配当株式ETF）に投資する。ファンド自体にベンチマークは無い', 'risude_P',
           r'当ファンドは、米国の株式を実質的な主要投資対象とし、主として配当収益の確保および中長期的な値 上がり益の獲得を目指します。',
           '投資先ETFの概要は「' + Q('risude_P', r'以下は、2026年2月末現在で委託会社が知り得る情報を基に作成しています。') + '」「' + Q('risude_P', r'※上記の内容は、今後変更になる場合があります。')
           + '」（本文の同じ文に時点と変更の可能性を書いた）。同じ節の留保: 「' + Q('risude_P', RS_RES) + '」（表の前の段落に書いた）。ベンチマークが無い旨は運用実績の欄。',
           extra_doc=[('risude_P', FUNDS[Sx]['index_q'][1]), ('risude_P', r'当ファンドには、 ベンチマークはありません。')])
    # ---- 国と業種
    p.docq('or-comp', 'eMAXIS Slimオルカンの組入上位の国・地域と業種、組入銘柄数（月次レポート・2026年9月30日現在）', 'orcan_M',
           r'1 アメリカ 63\.4% 1 情報技術 32\.4% 2 日本 5\.2% 2 金融 16\.0% 3 台湾 3\.3% 3 資本財・サービス 10\.2% 4 イギリス 3\.0% 4 ヘルスケア 8\.3% 5 カナダ 2\.9% 5 一般消費財・サービス 8\.1% 6 韓国 2\.5% 6 コミュニケーション・サービス 7\.9% 7 フランス 1\.9% 7 生活必需品 4\.5% 8 スイス 1\.9% 8 エネルギー 3\.9% 9 ドイツ 1\.8% 9 素材 3\.5% 10 オーストラリア 1\.3% 10 公益事業 2\.2%',
           '同じ欄の注を全件: 表示桁未満は四捨五入／原則として比率は純資産総額に対する割合／国・地域は原則として外国株式マザーファンドは主要取引所所在地、新興国株式マザーファンドは法人登録地で分類し、ETFは参照インデックスに準じて分類／業種はGICSのセクター（本文の表の前の段落に書いた）。上位10の国・業種だけが載っていて、11位以下は資料に無い。2026年9月30日現在の値で、その後は変わる。',
           extra_doc=[('orcan_M', r'組入銘柄数: 2,359銘柄'),
                      ('orcan_M', r'・国・地域は原則、外国株式インデックスマザーファンドについては投資対象銘柄の主要取引所所在地、新興国株式イン デックスマザーファンドについては投資対象銘柄の法人登録地で分類しています。')])
    p.claims['or-comp']['scope'] = 'eMAXIS Slimオルカンの2026年9月30日現在の組入比率（月次レポート。ファンドの純資産総額に対する割合）'
    p.docq('or-alloc', 'eMAXIS Slimオルカンの資産構成（月次レポート・2026年9月30日現在）: 国内株式5.2%、先進国株式（除く日本）82.7%、新興国株式12.0%', 'orcan_M',
           r'比率 ファンド -2\.9% -0\.6% 17\.5% 24\.3% 90\.7% 277\.9% 国内株式 5\.2% ベンチマーク -3\.0% -0\.7% 17\.2% 24\.0% 90\.0% 275\.8% 先進国株式（除く日本） 82\.7%.{0,80}?新興国株式 12\.0%',
           '月次レポートの資産構成の欄（段組のため抽出テキストでは騰落率の表と行が交互に並ぶ）。比率は純資産総額に対する各マザーファンド受益証券の割合（同じ欄の注）。コールローン他は0.0%。2026年9月30日現在の値で、その後は変わる。')
    p.claims['or-alloc']['scope'] = 'eMAXIS Slimオルカンの2026年9月30日現在の資産構成（月次レポート）'
    p.docq('rs-comp', '楽天・SCHDの投資先ETF（シュワブ・米国配当株式ETF）の投資銘柄数と業種別構成比（2026年8月末現在）', 'risude_M',
           r'2026年8月末現在 投資銘柄数 投資銘柄数 103.{0,700}?業種別構成比 業種 比率 ヘルスケア 21\.3% 生活必需品 19\.4% エネルギー 15\.8% 資本財・サービス 11\.8% 金融 9\.7% 情報技術 8\.7% 一般消費財・サービス 6\.8% コミュニケーション・サービス 6\.4% 公益事業 0\.1% ※ 比率は、ETFの純資産総額に対する各資産の評価額の比率です。 ※ 業種は、GICS（世界産業分類基準）に準じて分類しております。',
           '月次レポート（2026年8月31日作成基準）の投資先ETFの欄。表に載っているのは9業種で、素材の行は無い。比率はETFの純資産総額に対する比率で、業種はGICSに準じた分類（本文の表の前の段落に書いた）。出所はチャールズ・シュワブ・インベストメント・マネジメント社が公開するデータを基に楽天投信投資顧問が作成。2026年9月分の月次レポートは' + jd(GOT) + '時点で運用会社のページに未掲載（URLは404）。')
    p.claims['rs-comp']['scope'] = '楽天・SCHDの投資先ETFの2026年8月末現在の数値（楽天投信の月次レポート。ETFの純資産総額に対する比率）'
    p.docq('rs-hold', '楽天・SCHDのマザーファンドの組入（月次レポート・2026年8月31日作成基準）: シュワブ・米国配当株式ETF 98.4%、株式先物1.6%', 'risude_M',
           r'楽天・高配当株式・米国 99\.9% シュワブ・米国配当株式ETF 98\.4% マザーファンド 短期金融資産等 0\.1% 短期金融資産等 1\.6% 合計 100\.0% 合計 100\.0% 株式先物 1\.6%',
           '同じ表の注: 比率はファンドまたはマザーファンドの純資産総額に対する各資産の評価額の比率（段組のため抽出テキストでは2つの表の行が交互に並ぶ）。2026年8月31日の値で、その後は変わる。')
    # ---- 分配
    p.docq('or-dist', 'eMAXIS Slimオルカンは年1回（4月25日。休業日は翌営業日）の決算で、信託財産の成長を優先し原則として分配を抑制する方針。分配金は設定来累計0円（1万口当たり・税引前、2026年4月27日の第8期決算まで）', 'orcan_M',
           r'第8期 2026/04/27 0円 第7期 2025/04/25 0円.{0,120}?第3期 2021/04/26 0円 設定来累計 0円',
           '月次レポート（2026年9月30日現在）の分配金実績の欄。同じ欄の注: 運用状況によっては分配金額が変わる場合、あるいは分配金が支払われない場合がある。分配方針は交付目論見書: 「' + Q('orcan_P', r'分配金額の決定にあたっては、信託財産の成長を優先し、原則として分配を抑制する方針とし ます。 （基準価額水準や市況動向等により変更する場合があります。） 将来の分配金の支払いおよびその金額について保証するものではありません。') + '」（本文の同じ文に変更の場合を書いた）。',
           extra_doc=[('orcan_P', FUNDS[O]['settle_q'][1])])
    rows_d = [x for x in dist_rows_rakuten(p, Sx, '2025-09-01') if x[0].replace('/', '-') <= r['終点']]
    assert [v for _, v in rows_d] == [85, 90, 90, 95], rows_d
    dist_claim(p, 'rs-dist', Sx, rows_d)
    p.claims['rs-dist']['exceptions'] += (' 2025年11月〜2026年8月の決算の全4回。月次レポート（2026年8月31日作成基準）の表と一致し、同じ欄の設定来分配金合計額は595円: 「' + Q('risude_M', r'設定来分配金合計額 595 円 2月 5月 8月 11月 2025年 85 円 70 円 80 円 85 円 2026年 90 円 90 円 95 円 -')
                                         + '」。同じ欄の注: 「' + Q('risude_M', r'※ 分配金実績は、将来の分配金の水準を示唆・保証するものではありません。') + '」')
    distnav_claims(p)
    s4 = sum(v for _, v in rows_d)
    assert s4 == 360
    # ---- NISA・純資産
    p.docq('nisa-o', 'eMAXIS Slimオルカンは、NISAの「成長投資枠」と「つみたて投資枠」の対象（販売会社により取扱いが異なる場合がある）', 'orcan_P',
           r'ファンドは、 ＮＩＳＡの 「成長投資枠 （特定非課税管理勘定） およびつみたて投資枠（特定累 積投資勘定） 」 の対象です。 販売会社により取扱いが異なる場合があります。',
           '交付目論見書（使用開始日2026年7月25日）の課税関係の欄。同じ欄: 公募株式投資信託は税法上、一定の要件を満たした場合にNISAの適用対象となる。資料の時点の記載で、今後変わる場合がある。')
    p.docq('nisa-r', '楽天・SCHDは、NISAの「成長投資枠」の対象（販売会社により取扱いが異なる場合がある）で、交付目論見書に「つみたて投資枠」の記載は無い', 'risude_P',
           r'当ファンドは、NISAの 「成長投資枠（特定非課税管理勘定）」 の対象ですが、販売会社に より取扱いが異なる場合があります。',
           '交付目論見書（使用開始日2026年5月26日）の課税関係の欄。抽出テキスト全文を「つみたて」で検索して0件であることを生成のたびに assert で確かめている。NISAを利用できるのは一定の条件に該当する方（同じ節の注）。')
    assert 'つみたて' not in text('risude_P'), 'risude_P now mentions the tsumitate frame: rewrite the NISA sentences'
    p.docq('nav-o', 'eMAXIS Slimオルカンの純資産総額（2026年9月30日現在）', 'orcan_M', r'純資産総額 138,794\.52億円',
           '月次レポートの「基準価額および純資産総額」の欄。純資産総額は日々変わる。')
    q_nav, u_nav = nav_rows(Sx, '2026-09-30')
    assert q_nav.endswith('2026/09/30,13022,13720,2577.04,'), q_nav
    p.claim('nav-r', '楽天・SCHDの純資産総額（2026年9月30日）', NAV[Sx][1], q_nav, f'{GOT}に確認した運用会社（楽天投信投資顧問）公表の基準価額データの純資産総額の列',
            '純資産総額は日々変わる。2026年9月分の月次レポートは' + jd(GOT) + '時点で運用会社のページに未掲載のため、同じ運用会社が公表する日次データの9月30日の行を使った。')
    # ---- 期間
    ci = p.claims[p.fc(Sx, 'incept')]
    p.claim('period', f'比較期間（楽天・SCHDの設定日{jd(r["起点"])}〜{jd(r["終点"])}）の長さは約2年', ci['source_url'], ci['source_quote'], ci['applies'],
            ci['exceptions'] + ' 終点は月末に固定した（本文の計算条件）。期間の長さは暦日数742日から計算した値（2.03年）。eMAXIS Slimオルカンの設定日は2018年10月31日でそれより前。',
            scope=f'この記事の比較期間（{PERIOD}）の長さ。楽天・SCHDの設定日を起点にした理由は計算条件の節')
    # ---- lead
    lead = P(S(p, 'or-idx', f'結論から言うと、交付目論見書の方針では、{a_}は先進国と新興国の株式に広く投資し、{b_}は米国の配当株の指数に連動をめざすETFに投資します（ETFは2026年2月末現在の情報）。'),
             S(p, 'or-dist', '分配金の出し方も、決算の回数も違います。'))
    lead += ('<ul><li>' + S(p, 'or-comp', f'<b>国と業種</b>：2026年9月30日現在の{a_}は2,359銘柄で、純資産総額に対する比率は米国が63.4%、業種（GICS）は情報技術の32.4%が最大です。')
             + '</li><li>' + S(p, 'rs-comp', f'{b_}の投資先ETFは2026年8月末現在で103銘柄の米国株で、ETFの純資産総額に対する業種（GICS）の比率はヘルスケア21.3%・生活必需品19.4%・エネルギー15.8%が上位です。')
             + '</li><li>' + S(p, 'or-dist', f'<b>分配金</b>：{a_}は年1回決算で、原則として分配を抑制する方針（変更の場合あり）で、2026年4月27日の決算まで設定来0円です。')
             + '</li><li>' + S(p, 'rs-dist', f'{b_}は年4回決算で、2025年11月〜2026年8月の4回の分配金は1万口当たり・税引前で計{s4}円でした。')
             + '</li><li>' + S(p, 'perf', f"<b>実績</b>：{PERIOD}に一括投資した100万円の評価額は、税引前の分配金再投資ベースで{a_}が{yen(r['A100万円終価'])}、{b_}が{yen(r['B100万円終価'])}でした（売却前で、税金を除く仮定）。") + '</li></ul>')
    lead += P(S(p, 'period', f'{b_}の設定日（{jd(r["起点"])}）からの比較で、期間は約2年です。'),
              S(p, 'identity', f'この記事では、{FUNDS[O]["name"]}を「{a_}」、{FUNDS[Sx]["name"]}を「{b_}」と書きます。'))
    p.lead = lead_block(p, lead)
    p.fc(O, 'incept')
    # ---- 違いの早見表
    def row(label, ca, va, cb, vb):
        return f'<tr><th scope="row">{label}</th><td>{S(p, ca, va)}</td><td>{S(p, cb, vb)}</td></tr>'
    body = S(p, 'or-idx', '<h2 id="diff">2本の違いの早見表</h2>')
    body += S(p, 'feehead', f'<p data-review-context="before-table">次の表は、{jd(GOT)}に確認した交付目論見書と月次レポートの記載です。運用方針は、市況動向や資金動向などによってはそのとおりに運用できない場合があります。組入比率は資料の基準日の値で、その後は変わります。</p>')
    body += ('<div class="scroll-wrap"><table><thead><tr><th scope="col">項目</th>' + f'<th scope="col">{E(a_)}</th><th scope="col">{E(b_)}</th></tr></thead><tbody>'
             + row('連動をめざす指数', 'or-idx', 'MSCIオール・カントリー・ワールド・インデックス（配当込み、円換算ベース）をベンチマークに連動をめざす', 'rs-idx', '投資先ETFがダウ・ジョーンズ US ディビデンド 100 インデックスへの連動を目指す（2026年2月末現在の情報。ファンドのベンチマークはなし）')
             + row('投資する国', 'or-alloc', '日本を含む先進国と新興国（2026年9月30日現在、新興国株式マザーファンドが純資産総額の12.0%）', 'rs-idx', '米国の株式')
             + row('組入銘柄数', 'or-comp', '2,359銘柄（2026年9月30日現在）', 'rs-comp', '投資先ETFが103銘柄（2026年8月末現在）')
             + row('ETFの経由', 'or-idx', 'しない（3つのマザーファンド経由）', 'rs-hold', 'する（マザーファンド経由）')
             + row('決算と分配の方針', 'or-dist', '年1回。原則として分配を抑制（変更の場合あり）', 'rakuten-schd-settle', '年4回（2・5・8・11月の各25日）')
             + row('設定日', 'orcan-incept', FUNDS[O]['incept'], 'rakuten-schd-incept', FUNDS[Sx]['incept'])
             + row('NISA', 'nisa-o', '成長投資枠・つみたて投資枠の対象', 'nisa-r', '成長投資枠の対象')
             + '</tbody></table></div>')
    body += S(p, 'nisa-r', '<p class="note" data-review-context="after-table">NISAの取扱いは販売会社によって異なる場合があります。楽天・SCHDの決算日は、休業日の場合は翌営業日です。信託報酬などの料率は「費用」の節の表にまとめています。</p>')
    # ---- 実績
    ps = perf_section(p)
    pctx = S(p, 'perf', f'<p data-review-context="before-table">次の表の値は、比較期間（{PERIOD}）の基準価額から計算した、税引前の分配金を再投資した場合の売却前の値です（直近1年の行だけは2025年9月30日からの1年）。購入時・換金時の手数料と投資者ごとの税金は含みません。</p>')
    assert ps.count('<div class="scroll-wrap">') == 1
    body += ps.replace('<div class="scroll-wrap">', pctx + '<div class="scroll-wrap">', 1)
    body += P(S(p, 'perf', f"比較期間（{PERIOD}）の税引前分配金再投資ベースの累積騰落率は、{a_}が{pct(r['A累積'])}、{b_}が{pct(r['B累積'])}でした。"),
              S(p, 'perf', f"一方、直近1年（{jd(one['起点'])}〜{jd(one['終点'])}）の同じ税引前分配金再投資ベースの騰落率は{a_}が{pct(one['A累積'])}、{b_}が{pct(one['B累積'])}で、上下が入れ替わっています。"),
              S(p, 'perf', f"{corr_period(p)}{r['同日相関']:.2f}で、同じ日の値動きは一致していません。"))
    p.docq('or-mret', 'eMAXIS Slimオルカンの月次レポート（2026年9月30日現在）の騰落率: 過去1年24.3%・設定来277.9%（分配金再投資）', 'orcan_M',
           r'ファンド -2\.9% -0\.6% 17\.5% 24\.3% 90\.7% 277\.9%',
           '同じ欄の注: 設定来の騰落率は10,000を起点として計算／分配金実績がある場合は税引前分配金を再投資したものとして計算／課税条件によって騰落率は異なり、換金時の費用・税金等は考慮していない。本文の直近1年の値（24.27%）を小数第1位に丸めた値と一致する。')
    body += P(S(p, 'or-mret', f'{a_}の直近1年の値は、運用会社の2026年9月30日現在の月次レポートの過去1年の騰落率（24.3%）と一致します。'))
    # ---- 国と業種
    body += S(p, 'or-comp', '<h2 id="mechanism">国と業種の構成：全世界の株式と、米国の配当株</h2>')
    body += P(S(p, 'or-idx', f'{a_}は、日本を含む先進国と新興国の株式で構成されるMSCIオール・カントリー・ワールド・インデックス（配当込み、円換算ベース）をベンチマークとし、連動する投資成果をめざします。'),
              S(p, 'or-alloc', '2026年9月30日現在、純資産総額に対する各マザーファンドの比率は、先進国株式（除く日本）82.7%、新興国株式12.0%、国内株式5.2%です。'))
    body += P(S(p, 'rs-idx', f'{b_}は、マザーファンドを通じて、ダウ・ジョーンズ US ディビデンド 100 インデックスに連動する投資成果を目指すETFに投資します（ETFの情報は2026年2月末現在で、運用できない場合や変更の場合あり）。'),
              S(p, 'rs-hold', '2026年8月31日作成基準の月次レポートでは、マザーファンドの純資産総額に対してこのETFが98.4%、株式先物が1.6%です。'))
    body += S(p, 'or-comp', f'<p data-review-context="before-table">次の表は業種別の比率で、業種はGICS（世界産業分類基準）の分類です。{a_}は2026年9月30日現在のファンドの純資産総額に対する割合（上位10業種）、{b_}は2026年8月末現在の投資先ETFの純資産総額に対する割合です。基準日と分母が違うので、目安として並べています。</p>')
    secs = [('情報技術', '32.4%', '8.7%'), ('金融', '16.0%', '9.7%'), ('資本財・サービス', '10.2%', '11.8%'), ('ヘルスケア', '8.3%', '21.3%'),
            ('一般消費財・サービス', '8.1%', '6.8%'), ('コミュニケーション・サービス', '7.9%', '6.4%'), ('生活必需品', '4.5%', '19.4%'), ('エネルギー', '3.9%', '15.8%'),
            ('公益事業', '2.2%', '0.1%')]
    t = '<div class="scroll-wrap"><table><thead><tr><th scope="col">業種</th>' + f'<th scope="col" class="num">{E(a_)}</th><th scope="col" class="num">{E(b_)}の投資先ETF</th></tr></thead><tbody>'
    for n_, va, vb in secs:
        t += f'<tr><th scope="row">{n_}</th><td class="num">{S(p, "or-comp", va)}</td><td class="num">{S(p, "rs-comp", vb)}</td></tr>'
    t += '</tbody></table></div>'
    body += t
    body += S(p, 'or-comp', f'<p class="note" data-review-context="after-table">表は、{a_}の上位10業種のうち投資先ETFの表にもある9業種です。{a_}の残る1業種の素材（2026年9月30日現在3.5%）は、投資先ETFの表にありません。{a_}の2026年9月30日現在の国・地域の上位は、米国63.4%、日本5.2%、台湾3.3%です。</p>')
    body += P(S(p, 'or-comp', f'業種の比率では、2026年9月30日現在の{a_}は情報技術が最も高く、2026年8月末現在の{b_}の投資先ETFはヘルスケア・生活必需品・エネルギーが高くなっています。'),
              S(p, 'perf', '業種の比率が違うため、どの業種の株価が動いたかで、2本の値動きは変わります。'))
    # ---- 分配
    body += S(p, 'rs-dist', '<h3 id="dist">分配金と決算の回数</h3>')
    body += P(S(p, 'or-dist', f'{a_}の決算は年1回（4月25日、休業日は翌営業日）で、信託財産の成長を優先し、原則として分配を抑制する方針（基準価額水準や市況動向により変更の場合あり）です。'),
              S(p, 'or-dist', '1万口当たり・税引前の分配金は、2026年4月27日の第8期決算まで設定来0円です。'))
    ds_ = '・'.join(f'{d[:4]}年{int(d[5:7])}月{v}円' for d, v in rows_d)
    body += P(S(p, 'rakuten-schd-settle', f'{b_}の決算は原則として2・5・8・11月の各25日（休業日は翌営業日）の年4回です。'),
              S(p, 'rs-dist', f'1万口当たり・税引前の分配金は、直近4回が{ds_}（計{s4}円）でした。'),
              S(p, 'distpolicy', '分配金額は委託会社が決め、支払われない場合もあります。'))
    body += P(S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われるとその金額相当分、基準価額は下がります。'),
              S(p, 'perf', 'このため実績の表は、分配金を受け取らずに再投資したものとして2本をそろえています。'))
    body += P(S(p, 'nisa-o', f'{jd(GOT)}に確認した交付目論見書では、{a_}はNISAの成長投資枠とつみたて投資枠の対象です（販売会社により取扱いが異なる場合あり）。'),
              S(p, 'nisa-r', f'{b_}は成長投資枠の対象で（販売会社により取扱いが異なる場合あり）、つみたて投資枠の記載はありません。'))
    body += P(S(p, 'nav-o', f'2026年9月30日の純資産総額は、{a_}が月次レポートで138,794.52億円です。'),
              S(p, 'nav-r', f'{b_}の2026年9月30日の純資産総額は、運用会社の公表データで2,577.04億円です。'))
    # ---- 費用
    fs_ = fee_section(p, skip=('index', 'settle', 'incept', 'ter_period'), vals={
        (Sx, 'eff'): '年0.1238%程度（2026年2月末現在の情報による概算で、組入・運用状況で変動。ETFの報酬は合理的な見積額を委託会社が充当）',
        (O, 'ter'): '0.07061%（2025/4/26〜2026/4/27）', (Sx, 'ter'): '0.19%※（2025/8/26〜2026/2/25。合理的に見積ったETFの報酬相当額は別途充当。投資先の費用は計上期間が異なる場合あり）'})  # 指数・決算・設定日は早見表と本文にあるので費用の表に書き写さない
    fn_ = fee_note(p)
    _o, _n = '（詳しくは「ETFの報酬をどう数えるかで、表示の料率が変わる」の節）', ''
    assert fn_.count(_o) == 1
    fn_ = fn_.replace(_o, _n)
    p.frags = [(c, t.replace(_o, _n)) for c, t in p.frags]
    _o, _n = '委託会社がその相当額をファンドに別途充当しています', '委託会社が合理的に見積った報酬相当額をファンドに別途充当しています'
    assert fn_.count(_o) == 1
    fn_ = fn_.replace(_o, _n)
    p.frags = [(c, t.replace(_o, _n)) for c, t in p.frags]
    body += fs_ + fn_
    body += S(p, 'orcan-fee', '<h3 id="cost-detail">オルカンの段階制の信託報酬</h3>')
    ot_ = orcan_tier(p)
    for _o, _n in (('オルカンは純資産総額に応じた段階制で、', 'オルカンの信託報酬（税込年率、貸付時の追加分を除く）は純資産総額に応じた段階制で、'), ('実質信託報酬率をいずれも', '貸付時の追加分を除く税込の実質信託報酬率をいずれも')):
        assert ot_.count(_o) == 1
        ot_ = ot_.replace(_o, _n); p.frags = [(c, t.replace(_o, _n)) for c, t in p.frags]
    _o = 'eMAXIS Slimオルカンの交付目論見書は、有価証券の貸付の指図を行った場合、ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の49.5%（税抜45.0%）以内の額が運用管理費用（信託報酬）に追加されると定めています。'
    _n = 'eMAXIS Slimオルカンは、有価証券の貸付の指図を行った場合、ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の49.5%（税抜45.0%）以内を信託報酬に追加します。'
    assert fn_.count(E(_o)) == 1, 'lend sentence moved'
    fn_ = fn_.replace(E(_o), E(_n)); p.frags = [(c, t.replace(_o, _n)) for c, t in p.frags]
    body = body.replace(E(_o), E(_n))
    body += P(ot_)
    # ---- preclaim（2026-10-13）の例外の指摘を台帳に記録する（本文に書いた箇所も併記）
    _lend = '有価証券の貸付の指図を行った場合は、ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の49.5%（税抜45.0%）以内の額が信託報酬に追加される（本文の費用の節の注に書き、段階制の段落の2文には「貸付時の追加分を除く」と書いた）: 「' + Q(*FUNDS[O]['lend_q']) + '」'
    for c_ in ('orcan-fee', 'orcan-tier'):
        p.claims[c_]['exceptions'] += ' ' + _lend
    p.claims['orcan-terd']['exceptions'] += (' 対象期間は2025年4月26日〜2026年4月27日（表の次の行に書いた）。原則として購入時手数料・売買委託手数料・有価証券取引税を除き、消費税等のかかるものは消費税等を含む（表の行見出しと表の下の段落に書いた）。'
                                             '交付運用報告書の注: 「' + Q('orcan_Ak', W(r'前記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比 ?率とは異なります。')) + '」（本文に書いた）。')
    _chg = '「' + Q('risude_P', r'投資対象ファンドにおいて年0\.06％程度の報酬が日々控除されますが、委託会社が合理的に見積った当該報 酬相当額をファンドに充当します。') + '」'
    for c_ in ('rakuten-schd-eff', 'rakuten-schd-effnote', 'rakuten-schd-terfund', 'rakuten-schd-ter'):
        p.claims[c_]['exceptions'] += ' 充当されるのは委託会社が合理的に見積った報酬相当額（本文の費用の節に書いた）: ' + _chg
    p.claims['rakuten-schd-eff']['exceptions'] += ' 投資先の報酬の数値は2026年2月末現在で、今後の投資内容等により変動する（＊1）。実質的に負担する運用管理費用は概算値・目安（＊2）。どちらも本文の同じ文と費用の節の注に書いた。'
    p.claims['rakuten-schd-ter']['exceptions'] += ' 同じ欄の注: 「' + Q('risude_P', r'※投資先ファンドの費用は、計上された期間が異なる場合があります。') + '」。総経費率は参考値で実際に発生した費用の比率とは異なる（本文に書いた）。'
    # ---- 計算条件
    ms_ = method_section(p)
    _o, _n = '実際に受け取る手取り額とは異なります。', '課税口座では、実際に受け取る手取り額と異なる場合があります。'
    assert ms_.count(_o) == 1
    ms_ = ms_.replace(_o, _n); p.frags = [(c, t.replace(_o, _n)) for c, t in p.frags]
    body += ms_
    body += faq_block(p, [
        ('or-idx', f'{a_}と{b_}の違いは何ですか？', [('or-idx', f'連動をめざす指数が違います。{a_}は先進国と新興国の株式で構成されるMSCIオール・カントリー・ワールド・インデックス（配当込み、円換算ベース）に連動をめざします。'),
                                                 ('rs-idx', f'{b_}は、ダウ・ジョーンズ US ディビデンド 100 インデックスに連動を目指す米国の配当株のETFに投資します（2026年2月末現在の情報）。'),
                                                 ('or-dist', '決算の回数（年1回と年4回）と分配金の出し方も違います。')]),
        ('or-dist', f'{a_}は分配金を出しますか？', [('or-dist', '交付目論見書は、信託財産の成長を優先し、原則として分配を抑制する方針（変更の場合あり）としています。'),
                                               ('or-dist', '1万口当たり・税引前の分配金は、2026年4月27日の第8期決算まで設定来0円です。')]),
        ('nisa-o', 'NISAのつみたて投資枠の対象ですか？', [('nisa-o', f'{jd(GOT)}に確認した交付目論見書では、{a_}は成長投資枠とつみたて投資枠の対象です。'),
                                                   ('nisa-r', f'{b_}は成長投資枠の対象で、つみたて投資枠の記載はありません。どちらも販売会社により取扱いが異なる場合があります。')]),
        faq_net(p),
    ])
    sections = [('diff', '2本の違いの早見表'), ('performance', '同じ期間の実績を、分配金再投資で比べる'), ('mechanism', '国と業種の構成：全世界の株式と、米国の配当株'),
                ('fees', '目論見書の料率と、総経費率（参考値）を分けて見る'), ('method', '計算条件と、この比較からは分からないこと'), ('faq', 'よくある質問'), ('source', '出典')]
    related = [('../orcan-vs-emaxis-sp/', 'eMAXIS Slimオルカン vs eMAXIS Slim米国株式（S&P500）', 'オルカンを米国株の指数のファンドと比べる'),
               ('../rakuten-schd-vs-rakuten-vym/', '楽天・SCHD vs 楽天・VYM', '楽天・SCHDを別の米国高配当のファンドと比べる'),
               ('../rakuten-jepi-vs-rakuten-schd/', '楽天・JEPI vs 楽天・SCHD', '米国株の分配型の2本の仕組みを比べる'),
               ('../../toushi/tsumitate/', '積立シミュレーター', '積立額と期間から将来額の目安を計算します')]
    return p, title, desc, body, sections, related


# ======================================================================== 14. Rakuten VYM vs Rakuten JEPI (2026-10-14)
@article
def a_vym_jepi():
    p = Page('rakuten-vym-vs-rakuten-jepi', 'rakuten-vym', 'rakuten-jepi', 'rakuten-vym__rakuten-jepi')
    p.strict_cursor = True  # 台帳の単位→主張の対応を文書の順で取る
    r = p.r_
    days = (dt.date.fromisoformat(r['終点']) - dt.date.fromisoformat(r['起点'])).days
    assert '1年窓' not in r and r['年数'] < 1 and days == 142, (r['年数'], days)  # 1年未満の間は年率換算・直近1年を出さない
    V, J = 'rakuten-vym', 'rakuten-jepi'
    a_, b_ = '楽天・VYM', '楽天・JEPI'
    PERIOD = f"{jd(r['起点'])}〜{jd(r['終点'])}"
    p.title = title = '楽天・VYM vs 楽天・JEPIの違い｜指数連動とカバードコール・分配・費用'
    desc = (f'{a_}は高配当株の指数に連動をめざすETFに、{b_}はカバード・コール戦略のETFに投資する方針です（市況の急変時などは例外あり）。'
            f'決算と分配金、NISA、費用、{PERIOD}の実績を資料で比べます。')
    common_claims(p, title, desc); perf_claims(p); desc_claim(p)
    p.claims['desc']['scope'] = p.claims['perf']['scope'] + ' 仕組み・決算・NISA・費用は2本の交付目論見書の記載'
    RES_V = r'資金動向、市況動向等に急激な変化が生じたとき等ならびに投資信託財産の規模によっては、 ?また、 ?やむを得ない事情が発生した場 ?合には、上記の運用ができない場合があります。'
    RES_J = r'資金動向、市況動向等に急激な変化が生じたとき等、ならびに投資信託財産の規模によっては、また、やむを得ない事情が発生した場合には、 上記のような運用ができない場合があります。'
    res = f' 同じ運用方針の節の留保（早見表の前の段落に書いた）: 「{Q("rivuh_P", RES_V)}」（rivuh_P）／「{Q("rijepi_P", RES_J)}」（rijepi_P）。運用ができない場合として挙げているのはこれで全部。'
    # ---- 仕組み（指数・投資先ETF）
    p.docq('rv-idx', '楽天・VYMはマザーファンドを通じて「バンガード・米国高配当株式ETF」を実質的な主要投資対象とし、FTSEハイディビデンド・イールド・インデックス（円換算ベース）に連動する投資成果を目標とする', 'rivuh_P',
           FUNDS[V]['index_q'][1],
           '同じ節: 「' + Q('rivuh_P', r'◆ バンガードが運用する ｢バンガード ・米国高配当株式ETF｣を実質的な主要投資対象とします。') + '」。指数の定義: 「'
           + Q('rivuh_P', r'「FTSEハイディビデンド・イールド・インデックス」は、米国株式市場における高配当利回りの銘柄 ?を対象とし、REITを除く銘柄で構成される時価総額加重平均型の株価指数です。') + '」。' + res)
    p.claims['rv-idx']['scope'] = '楽天・VYMの交付目論見書（使用開始日2026年4月16日）の運用方針。ファンド全体の方針で、実際の運用は資金動向などによりこのとおりにできない場合がある'
    p.docq('jp-idx', '楽天・JEPIの投資先ETFは、米国の株式を保有しつつ、株式のコール・オプション（買う権利）を売却する「カバード・コール戦略」を採用している。ファンドにベンチマークは無い', 'rijepi_P',
           FUNDS[J]['index_q'][1],
           '同じ節の注: 「※上記は、 当ファンドの主要投資対象である外国投資信託にかかる特色を説明したもので、 当ファンドの投資成果を示唆 または保証するものではありません。」。ベンチマーク: 「'
           + Q('rijepi_P', r'なお当ファンドに、ベンチマークはありません。') + '」。' + res)
    p.claims['jp-idx']['scope'] = '楽天・JEPIの交付目論見書（使用開始日2026年4月27日）の運用方針。ファンド全体の方針で、実際の運用は資金動向などによりこのとおりにできない場合がある'
    p.docq('jepi-etfs', '楽天・JEPIはマザーファンドを通じて米ドル建ての2本のETF（JPモルガン・米国株式・プレミアム・インカムETF／同アクティブUCITS ETF）を実質的な投資対象とする', 'rijepi_Ak',
           r'当ファンドは「楽天・米国大型株式・プレミアム・インカム・マザーファンド」受益証券（以下、 「マ ザーファンド」）を通じて米ドル建ての「JPモルガン・米国株式・プレミアム・インカムETF」および「JP モルガン・米国株式・プレミアム・インカム・アクティブUCITS ETF」 （以下、 「投資先ETF」）を実質的 な投資対象とする',
           '同じ文の続き: マザーファンドを通じて純資産総額の一部を実質的に海外株価指数先物に投資しているため、海外株価指数先物の価格変動の影響も受ける。' + res)
    p.claims['jepi-etfs']['scope'] = '楽天・JEPIの第1期の交付運用報告書（作成対象期間2026年5月11日〜2026年7月15日）の運用方針の記載'
    p.docq('jepi-alloc', '楽天・JEPIのマザーファンドの組入比率（2026年8月31日作成基準）: JPモルガン・米国株式・プレミアム・インカムETF 98.1%、同アクティブUCITS ETF「-」', 'rijepi_M',
           r'組入資産（マザーファンド） 比率 楽天・米国大型株式・プレミアム JPモルガン・米国株式・プレミアム 100\.0% 98\.1% ・インカム・マザーファンド ・インカムETF \* 短期金融資産等 0\.01% JPモルガン・米国株式・プレミアム - ・インカム・アクティブUCITS ETF \* 合計 100\.0% 短期金融資産等 1\.9% 合計 100\.0% 株式先物 1\.9%',
           '同じ表の注: 比率はファンドまたはマザーファンドの純資産総額に対する各資産の評価額の比率。同じ表に短期金融資産等1.9%・株式先物1.9%の行がある（段組のため抽出テキストでは2つの表の行が交互に並ぶ）。作成基準日（2026年8月31日）の値で、その後は変わる。')
    p.claims['jepi-alloc']['scope'] = '楽天・JEPIのマザーファンドの2026年8月31日（月次レポートの作成基準日）の組入比率'
    p.docq('jepi-cap', 'カバード・コール戦略は一定の水準以上の株価上昇による値上がり益を放棄する代わりにプレミアムの獲得を目指す手法で、基準価額の上昇が制限される可能性がある（投資リスクの欄）', 'rijepi_M',
           r'【基準価額の上昇余地が制限されるリスク】 投資対象ファンドが採用する「カバード・コール戦略」は、一定の水準以上の株価上昇による値上がり益を放棄する代わりに、コールオ プションの売却によるプレミアム（収益）の獲得を目指す運用手法です。そのため、原資産である米国株価指数やそれに連動するETF 等が目標水準を超えて上昇した場合でも、その上昇分を享受できず、当ファンドの基準価額の上昇が制限される可能性があります。',
           '月次レポート（2026年8月31日作成基準）の投資リスクの欄。交付目論見書の投資リスクの欄にも同じ文がある。同じ欄の他の変動要因は基準価額の下落要因で、株式の価格が下落した場合は基準価額の下落要因になる（「' + Q('rijepi_M', r'当該株式の価格が下落した場合には、基準価額の下落要因となります。') + '」。本文に書いた）。「※ 基準価額の変動要因は、上記に限定されるものではありません。」')
    p.docq('jepi-etfpol', '投資先ETFの運用の基本方針（交付目論見書「投資対象ファンドの概要」・2026年1月末現在）', 'rijepi_P',
           r'以下は、2026年1月末現在で委託会社が知り得る情報を基に作成しています。.{0,520}?※上記の内容は、今後変更になる場合があります。',
           '交付目論見書の「投資対象ファンドの概要」の表（段組のため抽出テキストでは列が交互に並ぶ。運用の基本方針の列は「米国の大型株とオプションの売却を組み合わせたポートフォリオからインカムを獲得し、株式の配当金とオプションプレミアムを原資として毎月分配を目指す」）。同じ表の注: 今後変更になる場合がある（本文に書いた）。ETFの方針であり、楽天・JEPIの分配金額は委託会社が決め、必ず分配を行うものではない。')
    p.claims['jepi-etfpol']['scope'] = '楽天・JEPIの投資先ETF（2本）の運用の基本方針。2026年1月末現在で委託会社が知り得る情報'
    assert not any(w in text(d) for d in ('rivuh_P', 'rivuh_M') for w in ('オプション', 'カバード')), 'rivuh now mentions options: rewrite the nocc sentence'
    assert 'カバード' not in text('rivuh_Ak') and text('rivuh_Ak').count('オプション') == text('rivuh_Ak').count('（先物・オプション）'), 'rivuh_Ak mentions options beyond the fee item'
    p.claim('nocc', '楽天・VYMの交付目論見書・月次レポートには、オプション・カバード・コール戦略についての記載が無い', url('rivuh_P'), Q(*FUNDS[V]['index_q']), f'{GOT}に確認した楽天・VYMの3資料',
            '交付目論見書・月次レポートの抽出テキスト全文を「オプション」「カバード」で検索して0件であることを生成のたびに assert で確かめている（語が現れたら生成が止まる）。交付運用報告書は費用明細の売買委託手数料の項目名「（先物・オプション）」（金額0円）だけで、戦略の記載ではない（これも assert）。source_quote は運用方針（指数への連動）の文。',
            scope=f'楽天・VYMの運用会社の3資料（{jd(GOT)}に確認）に書かれている範囲')
    p.docq('comp-v', '楽天・VYMの投資先ETF（バンガード・米国高配当株式ETF）の投資銘柄数604・組入1位Broadcom 7.3%・業種別構成比の最大は金融21.3%（2026年7月末現在、ICB基準）', 'rivuh_M',
           r'※ 当ページの内容は作成基準日の前月の数値です。 2026年7月末現在 投資銘柄数 投資銘柄数 604 組入上位10銘柄 銘 柄 業種 比率 Broadcom Inc テクノロジー 7\.3%.{0,400}?業種別構成比 金融 21\.3% 資本財 14\.1% テクノロジー 14\.0%.{0,300}?※ 業種は、業種分類ベンチマーク（ICB）基準による分類です。',
           '月次レポート（2026年8月31日作成基準）の投資先ETFのページは前月末（2026年7月末）の数値。比率はETFの純資産総額、業種別構成比は組入株式に対する評価額の比率（同じ注記）。業種はICB基準で、楽天・JEPI側（GICS）と分類も基準日も違うため、本文で業種を行どうしで並べていない。全11業種（金融21.3%〜不動産0.0%）を読み、最大が金融であることを確認した。')
    p.claims['comp-v']['scope'] = '楽天・VYMの投資先ETFの2026年7月末現在の数値（楽天投信の月次レポート・2026年8月31日作成基準）'
    p.docq('comp-j', '楽天・JEPIの投資先ETF（JPモルガン・米国株式・プレミアム・インカムETF）の投資銘柄数135・組入1位マイクロソフト2.0%・業種別構成比の最大は情報技術15.4%（2026年8月末現在、GICS）', 'rijepi_M',
           r'2026年8月末現在 投資銘柄数 投資銘柄数 135 組入上位10銘柄 銘柄 業種 比率 MICROSOFT CORP COMMON 情報技術 2\.0%.{0,700}?業種別構成比 業種 比率 情報技術 15\.4% その他 14\.6% 資本財・サービス 12\.2% ヘルスケア 12\.1%.{0,260}?※ 比率は、ETFの純資産総額に対する各資産の評価額の比率です。 ※ 業種は、GICS（世界産業分類基準）に準じて分類しております。',
           '月次レポートの投資先ETFのページを全12行（情報技術15.4%・その他14.6%〜素材1.4%）読み、最大が情報技術であることを確認した。比率はETFの純資産総額に対する比率で、業種はGICSに準じた分類（同じ注記）。2026年8月末現在の値で、その後は変わる。')
    p.claims['comp-j']['scope'] = '楽天・JEPIの投資先ETF（JPモルガン・米国株式・プレミアム・インカムETF）の2026年8月末現在の数値（楽天投信の月次レポート）'
    # ---- 分配
    distnav_claims_doc(p, 'rijepi_P')
    p.claims['distpolicy']['exceptions'] = ('分配方針の欄: 「' + Q('rijepi_P', r'●収益分配金額は、委託会社が基準価額水準、市況動向等を勘案して決定します。ただし、必ず分 配を行うものではありません。')
                                            + '」。楽天・VYMの交付目論見書: 「' + Q('rivuh_P', r'毎決算時に、原則として収益分配方針に基づき分配を行います。 ただし、必ず分配を行うも のではありません。') + '」')
    p.docq('vym0', '楽天・VYMの分配金は第9期（2026年7月15日決算）まで0円（設定来分配金合計0円）', 'rivuh_Ak', r'期 末：32,813円（既払分配金0円）',
           '交付運用報告書の最近5期の表で期間分配金合計がすべて0円、月次レポート（2026年8月31日作成基準）の設定来分配金合計額も0円であることを確認。将来の分配を約束・否定するものではない（分配金額は委託会社が決定し、必ず分配を行うものではない）。運用会社の基準価額データの分配金の列も、2018年7月17日〜2026年7月15日の9回の決算日がすべて0。',
           extra_doc=[('rivuh_Ak', r'期間分配金合計（税込） （円） － 0 0 0 0 0'), ('rivuh_M', r'設定来分配金合計額 0 円')])
    p.claims['vym0']['scope'] = '楽天・VYMの第9期（2026年7月15日決算）までの分配金（1万口当たり・税引前）。将来の分配は含まない'
    _vd = dist_rows_rakuten(p, V, '2018-01-01')
    assert len(_vd) == 9 and all(v == 0 for _, v in _vd) and _vd[-1][0] == '2026/07/15', _vd  # 9回の決算がすべて0円
    p.docq('rvym-policy', '楽天・VYMの決算は毎年7月15日（休業日の場合は翌営業日）で、収益分配方針に基づき分配を行うが、必ず分配を行うものではない', 'rivuh_P',
           r'決 算 日 毎年7月15日 （ただし、休業日の場合は翌営業日） 毎決算時に、原則として収益分配方針に基づき分配を行います。 ただし、必ず分配を行うも のではありません。',
           '同じ欄の注: 「分配金受取コース」と「分配金再投資コース」があり、取扱いのコースとコース名は販売会社により異なる場合がある。分配方針の欄: 収益分配額は委託会社が基準価額水準、市況動向等を勘案して決定。')
    rj = [x for x in dist_rows_rakuten(p, J, r['起点']) if x[0].replace('/', '-') <= r['終点']]
    assert [v for _, v in rj] == [65, 60, 55], rj
    dist_claim(p, 'distJ', J, rj)
    p.claims['distJ']['exceptions'] += ' 過去の実績で、将来の分配金の水準を示さない（月次レポートの注記「' + Q('rijepi_M', r'※ 分配金実績は、将来の分配金の水準を示唆・保証するものではありません。') + '」）。比較期間内に決算日が来た分配の全件（3回）を表に載せた。'
    p.docq('jepi-settle1', '楽天・JEPIの決算日は原則として毎月15日（休業日の場合は翌営業日）で、第1期決算日は2026年7月15日', 'rijepi_P', FUNDS[J]['settle_q'][1],
           '分配は必ず行うものではない: 「' + Q('rijepi_P', r'毎決算時に、原則として収益分配方針に基づき分配を行います。ただし、必ず分配を行う 収 益 分 配 ものではありません。') + '」。信託の終了（繰上償還）の場合は以後の決算日が来ない。')
    p.docq('jepi-d1', '楽天・JEPIの第1期（2026年5月11日〜2026年7月15日）の当期分配金65円（1万口当たり・税込）は当期の収益65円、当期の収益以外は「－」', 'rijepi_Ak',
           r'（1万口当たり・税込） 第1期 項 目 2026年5月11日～2026年7月15日 当期分配金 （円） 65 （対基準価額比率） （％） （0\.614） 当期の収益 （円） 65 当期の収益以外（円） － 翌期繰越分配対象額（円） 524',
           '同じ表の注を全件: （注1）対基準価額比率は当期分配金の期末基準価額（分配金込み）に対する比率で、ファンドの収益率とは異なる。（注2）「' + Q('rijepi_Ak', r'「当期の収益」は経費控除後の配当等収益および経費控除後の有価証券売買等損益、 「当期の収益以外」は収益調整金お よび分配準備積立金です。')
           + '」（注3）円未満を切捨てて表示しているため、合計が当期分配金と一致しない場合がある。2026年8月・9月の決算の内訳は、確認日に掲載されていた交付運用報告書（第1期）の作成対象期間より後なので載っていない（本文に書いた）。ファンドの決算の内訳で、投資者ごとの普通分配金・元本払戻金（特別分配金）の区分とは別（本文に書いた）。')
    p.claims['jepi-d1']['scope'] = '楽天・JEPIの第1期（作成対象期間2026年5月11日〜2026年7月15日）の交付運用報告書の分配金の表。ファンドの決算の内訳で、投資者ごとの課税上の区分ではない'
    p.docq('distover', '交付目論見書: 分配金は計算期間中に発生した収益を超えて支払われる場合があり、その場合は当期決算日の基準価額が前期決算日と比べて下落する', 'rijepi_P',
           r'分配金は計算期間中に発生した収益を超えて支払われる場合があります。その場合、当期決算日の基準価額は前期決 算日と比べて下落することになります。',
           '同じ文の続き: 「また、分配金の水準は、必ずしも計算期間におけるファンドの収益率を示すもの ではありません。」。')
    p.docq('pdef', '普通分配金と元本払戻金（特別分配金）は投資者ごとの個別元本で決まる区分（交付目論見書の収益分配金に関する留意事項）', 'rijepi_P',
           r'普 通 分 配 金：個別元本（投資者のファンドの購入価額）を上回る部分からの分配金です。 元本払戻金 （特別分配金） ：個別元本を下回る部分からの分配金です。 分配後の投資者の個別元本は、 元本払戻金 （特別分配金） の額だ け減少します。',
           '同じ節: 投資者のファンドの購入価額によっては、分配金の一部または全部が実質的には元本の一部払戻しに相当する場合がある。元本払戻金（特別分配金）部分は非課税扱い、普通分配金は課税（同じ節の注）。')
    # ---- NISA・特化型・信託期間・純資産
    p.docq('nisa-v', '楽天・VYMは、NISAの「成長投資枠」と「つみたて投資枠」の対象（販売会社により取扱いが異なる場合がある）', 'rivuh_P',
           r'当ファンドは、NISAの 「成長投資枠（特定非課税管理勘定）」 および 「つみたて投資枠（特定 累積投資勘定）」の対象ですが、販売会社により取扱いが異なる場合があります。',
           '交付目論見書（使用開始日2026年4月16日）の課税関係の欄。同じ欄・税金の節の注: NISAを利用できるのは非課税口座を開設するなど一定の条件に該当する方。税法が改正された場合等には変更される場合がある。')
    p.claims['nisa-v']['scope'] = '楽天・VYMの交付目論見書（使用開始日2026年4月16日）の課税関係の欄の記載'
    p.docq('jepi-nisa', '楽天・JEPIはNISAの対象ではない（交付目論見書・使用開始日2026年4月27日の課税関係の欄）', 'rijepi_P', r'当ファンドは、NISAの対象ではありません。',
           '月次レポート（2026年8月31日作成基準）の課税関係の欄にも同じ文がある。対象でない理由は資料に書かれていないため本文にも書いていない。資料の時点の記載で、今後変わる場合がある。')
    p.claims['jepi-nisa']['scope'] = '楽天・JEPIの交付目論見書（使用開始日2026年4月27日）の課税関係の欄の記載'
    p.docq('jepi-tokka', '楽天・JEPIは特化型運用（寄与度が10%を超える又は超える可能性の高い支配的な銘柄が存在する）', 'rijepi_P',
           r'※当ファンドは、特化型運用を行います。 当ファンドがマザーファンド受益証券への投資を通じて投資対象とする上場投資信託証券 （ETF） は、実質投資対象であ る米国の株式等に集中投資することを基本戦略としており、一般社団法人資産運用業協会規則で定める寄与度が10％ を超える又は超える可能性の高い支配的な銘柄が存在するため、特定の銘柄への投資が集中することがあります。 当該銘柄のエクスポージャーが投資信託財産の純資産総額の35％を超えないように運用を行いますが、 当該銘柄に 財政難、経営不振等が生じた場合又はそれが予想される場合には、大きな損失が発生することがあります。',
           '無し: 交付目論見書の特化型運用の注記の全文を逐語に取った。10%は規則で定める寄与度で、その銘柄のエクスポージャーを純資産総額の35%以内に抑える運用（どちらも本文に書いた）。どの銘柄が支配的な銘柄にあたるかは資料に書かれていないため本文にも書いていない。')
    assert not any('特化型' in text(d) for d in ('rivuh_P', 'rivuh_Ak', 'rivuh_M')), 'rivuh now mentions 特化型: rewrite'
    p.claim('vym-notokka', '楽天・VYMの交付目論見書・交付運用報告書・月次レポートには「特化型運用」の記載が無い', url('rivuh_P'), Q(*FUNDS[V]['index_q']), f'{GOT}に確認した楽天・VYMの3資料',
            '3資料の抽出テキスト全文を「特化型」で検索して0件であることを生成のたびに assert で確かめている（語が現れたら生成が止まる）。',
            scope=f'楽天・VYMの運用会社の3資料（{jd(GOT)}に確認）に書かれている範囲')
    p.docq('term-v', '楽天・VYMの信託期間は無期限（一定の条件により繰上償還する場合がある）', 'rivuh_P',
           r'無期限（2018年1月10日設定） 信 託 期 間 ※ただし、一定の条件により繰上償還する場合があります。',
           '繰上償還の条件（次の欄）: 受益権の口数が10億口を下回ることとなったとき、受益者のため有利であると認めるとき、対象指数が改廃されたとき、実質的な投資対象のETFが上場廃止となるとき、やむを得ない事情が発生したとき。')
    p.docq('term-j', '楽天・JEPIの信託期間は2036年4月14日まで（延長または繰上償還の場合あり）', 'rijepi_P',
           r'2036年4月14日まで （設定日：2026年5月11日） 信 託 期 間 ※ただし、一定の条件により信託期間を延長または繰上償還する場合があります。',
           '繰上償還の条件（次の欄・全件）: 「' + Q('rijepi_P', r'委託会社は、受益権の口数が10億口を下回ることとなったとき、.{0,220}?信託を終了させることができます。') + '」')
    navs = {}
    for k_, cid_ in ((V, 'nav-v'), (J, 'nav-j')):
        q_, u_ = nav_rows(k_, '2026-09-30')
        navs[k_] = q_.split(' / ')[1].split(',')[3]
        p.claim(cid_, f'{FUNDS[k_]["short"]}の純資産総額（2026年9月30日）', u_, q_, f'{GOT}に確認した運用会社（楽天投信投資顧問）公表の基準価額データの純資産総額の列',
                '純資産総額は日々変わる。2本とも2026年9月分の月次レポートがそろっていない（楽天・JEPIは' + jd(GOT) + '時点で未掲載）ため、同じ運用会社が公表する日次データの9月30日の行で日付をそろえた。')
    assert navs == {V: '388.34', J: '29.45'}, navs
    # ---- 期間
    ci = p.claims[p.fc(J, 'incept')]
    p.claim('period', f'2本の基準価額がそろう期間は{PERIOD}の142日間（約4か月半）', ci['source_url'], ci['source_quote'], ci['applies'],
            ci['exceptions'] + ' 楽天・VYMの設定日は2018年1月10日でそれより前。終点は月末の2026年9月30日に固定した。1年未満のため年率換算・直近1年の騰落率は載せていない。',
            scope=f'この記事の比較期間（{PERIOD}。終点は月末に固定）。楽天・JEPIの設定日を起点にした理由は計算条件の節')
    # ---- 費用の主張
    pair_claim(p, 'effpair', 'eff', '2本の実質的な信託報酬（投資先ETFの報酬を加味した信託報酬率。その他の費用・貸付時の報酬は含まない）')
    eff_scope(p)
    for k_ in (V, J):
        p.claims['effpair']['exceptions'] += f' {FUNDS[k_]["short"]}の同じ費用欄の注: 「' + Q(*FUNDS[k_]['effnote_q']) + '」'
    gap_claim(p, 'effgap', '2本の実質的な信託報酬（交付目論見書の概算）の差と、100万円を1年間一定額で保有すると仮定した目安', 'eff')
    d = round(0.658 - 0.172, 4); amt = round(d / 100 * 1_000_000)
    assert (d, amt) == (0.486, 4860), (d, amt)
    p.claims['effgap']['exceptions'] += ' 2本の実質的な負担の注（本文の同じ文に「組入状況などで変わる目安」と書いた）: 「' + Q('rivuh_P', r'この値は目安であり、 ?実際の投資信託証券の組入状況、 ?運用状況によって変動します。') + '」（rivuh_P）／「' + Q(*FUNDS[J]['effnote_q']) + '」（rijepi_P）'
    ter_notes = r'（注1）このファンドの費用は1万口当たりの費用明細において用いた簡便法により算出したものです。 （注2）各費用は、原則として、募集手数料、売買委託手数料および有価証券取引税を含みません。 （注3）各比率は、年率換算した値です。 （注4）投資先ファンドとは、このファンドまたはマザーファンドが組み入れている投資信託証券（マザーファンドを除く）です。 （注5）このファンドの費用は、マザーファンドが支払った費用を含み、投資先ファンドが支払った費用を含みません。 （注6）このファンドの費用と投資先ファンドの費用は、計上された期間が異なる場合があります。 （注7）\x07?投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。 （注8）\x07?上記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なり ます。'
    for c_ in (f'{V}-ter', f'{J}-ter', 'terpair'):
        p.fc(J, 'ter'); p.fc(V, 'ter')
        p.claims[c_]['exceptions'] += ' 楽天・JEPIの同じ表の注: 「' + Q('rijepi_Ak', ter_notes) + '」。楽天・VYMの交付運用報告書の（注6）（注7）も同旨: 「' + Q('rivuh_Ak', r'（注6）このファンドの費用と投資先ファンドの費用は、計上された期間が異なる場合があります。 （注7）投資先ファンドについては、運用会社等より入手した概算値を使用している場合があります。') + '」'
    assert '総経費率' not in text('rijepi_P'), 'rijepi_P now has a TER column'
    p.docq('ternote', '2本の総経費率は交付運用報告書の作成対象期間について年率換算した参考値で、資料は実際に発生した費用の比率とは異なると注記している', 'rijepi_Ak',
           r'（注8）\x07?上記の前提条件で算出したものです。このため、これらの値はあくまでも参考であり、実際に発生した費用の比率とは異なり ます。',
           '楽天・VYMの交付運用報告書（作成対象期間2025年7月16日〜2026年7月15日）の同じ表の注にも同旨がある。楽天・JEPIの交付目論見書は設定前の資料で総経費率の欄が無い。楽天・VYMの交付目論見書の（参考情報）欄の0.22%は1期前（対象期間2024年7月17日〜2025年7月15日）の値で、本文は新しい交付運用報告書の値を使った。',
           extra_doc=[('rivuh_Ak', r'（作成対象期間 2025年7月16日～2026年7月15日）'), ('rivuh_P', r'対象期間：2024年7月17日～ 2025年7月15日 総経費率（①＋②） ①運用管理費用の比率 ②その他費用の比率 0\.22% 0\.14% 0\.08%')])
    p.claims['ternote']['scope'] = '2本の交付運用報告書の総経費率（楽天・VYMは作成対象期間2025年7月16日〜2026年7月15日、楽天・JEPIは2026年5月11日〜2026年7月15日）。年率換算の参考値'
    p.docq('rakuten-vym-etfchg', '楽天・VYMの投資先ETFの管理報酬等（年0.04%）は2026年2月2日付で変更された後の値', 'rivuh_P',
           r'0\.04%＊ 米国高配当株式ETF グループ・インク 目指す ＊2026年2月2日付で変更されました。',
           '交付目論見書の「投資対象ファンドの概要」の表（段組のため抽出テキストでは語順が入れ替わる）。変更前の率は資料に書かれていないため本文にも書いていない。',
           extra_doc=[('rivuh_P', r'※上記の内容は、今後変更になる場合があります。')])
    oc_m = r'■ その他の費用・手数料 信託事務費用、監査報酬、印刷費用、売買委託手数料、外貨建資産保管費用(?:、貸付有価証券関連報酬)?等が支払われます。 ※ 委託会社は、投資信託財産の規模等を考慮して、当該費用・手数料等の一部もしくは全てを負担する場合があります。 ※ これらの費用・手数料等については、運用状況により変動するものであり、事前に料率や上限額を表示することができません。'
    p.claim('othercost', '2本の「その他の費用・手数料」（信託報酬の料率に含まれない費用）', url('rijepi_P'), Q(*FUNDS[J]['lendhead_q']), f'{GOT}に確認した2本の交付目論見書の費用の欄',
            '交付目論見書の欄が挙げる項目（全件・末尾は「等」）: 信託事務の処理に要する諸費用／投資信託財産にかかる監査報酬／法定書類の作成・印刷・交付にかかる費用／その他投資信託財産の運営にかかる費用／組入有価証券の売買の際に発生する売買委託手数料／外貨建資産の保管に要する費用／貸付有価証券関連報酬 等。'
            '同じ欄の注（月次レポートの同じ欄から逐語）: 「' + Q('rijepi_M', oc_m) + '」（rijepi_M）／「' + Q('rivuh_M', oc_m) + '」（rivuh_M）。'
            f' 比較相手の交付目論見書: {url("rivuh_P")}「{Q(*FUNDS[V]["lendhead_q"])}」')
    ca_, cb_ = p.claims[p.fc(V, 'lend')], p.claims[p.fc(J, 'lend')]
    p.claim('lendpair', '2本の交付目論見書の貸付有価証券関連報酬（その他の費用・手数料）', ca_['source_url'], ca_['source_quote'], ca_['applies'],
            ca_['exceptions'] + f' 比較相手: {cb_["source_url"]}「{cb_["source_quote"]}」'
            + ' 委託会社の負担（本文の同じ文に「委託会社が一部を負担する場合あり」と書いた）: 「' + Q('rijepi_M', r'※ 委託会社は、投資信託財産の規模等を考慮して、当該費用・手数料等の一部もしくは全てを負担する場合があります。') + '」（rijepi_M・rivuh_M の同じ欄）')

    # ================= リード
    lead = P(S(p, 'rv-idx', f'結論から言うと、{a_}は米国の高配当株の指数（FTSEハイディビデンド・イールド・インデックス）に連動をめざすETFに投資する方針です（市況の急変時などは例外あり）。'),
             S(p, 'jp-idx', f'{b_}は、米国株を持ちながらコール・オプションを売る「カバード・コール戦略」のETFに投資する方針で（市況の急変時などは例外あり）、ベンチマークはありません。'))
    lead += ('<ul><li>' + S(p, 'vym0', f'<b>分配金</b>：{a_}は年1回（7月15日、休業日は翌営業日）の決算で、分配金は2026年7月15日の第9期決算まで設定来0円です。')
             + '</li><li>' + S(p, 'distJ', f'{b_}は毎月決算で、2026年7〜9月の3回の分配金は1万口当たり・税引前で65円・60円・55円でした。')
             + '</li><li>' + S(p, 'nisa-v', f'<b>NISA</b>：交付目論見書では、{a_}は成長投資枠とつみたて投資枠の対象です（販売会社により取扱いが異なる場合あり）。')
             + S(p, 'jepi-nisa', f'{b_}はNISAの対象ではありません。')
             + '</li><li>' + S(p, 'effpair', f'<b>費用</b>：投資先ETFの報酬を含む実質的な信託報酬は、交付目論見書の税込の概算で{a_}が年0.172%程度、{b_}が年0.658%程度です（組入状況などで変わる目安）。')
             + '</li><li>' + S(p, 'perf', f"<b>実績</b>：{PERIOD}の142日間に一括投資した100万円の評価額は、税引前の分配金再投資ベースで{a_}が{yen(r['A100万円終価'])}、{b_}が{yen(r['B100万円終価'])}でした（売却前）。") + '</li></ul>')
    lead += P(S(p, 'period', f'{b_}の設定日（{jd(r["起点"])}）からの比較で、期間は約4か月半しかありません。'),
              S(p, 'perf', 'この短い期間の差で、2本の優劣は判断できません。'),
              S(p, 'identity', f'この記事では、{FUNDS[V]["name"]}を「{a_}」、{FUNDS[J]["name"]}を「{b_}」と書きます。'))
    p.lead = lead_block(p, lead)
    for k_ in (V, J):
        p.fc(k_, 'incept'); p.fc(k_, 'settle')

    # ================= 違いの早見表
    def row(label, ca, va, cb, vb):
        return f'<tr><th scope="row">{label}</th><td>{S(p, ca, va)}</td><td>{S(p, cb, vb)}</td></tr>'
    body = S(p, 'rv-idx', '<h2 id="diff">2本の違いの早見表</h2>')
    body += S(p, 'feehead', f'<p data-review-context="before-table">次の表は、{jd(GOT)}に確認した交付目論見書（{a_}は使用開始日2026年4月16日、{b_}は使用開始日2026年4月27日）と運用報告書の記載です。運用方針は、資金動向や市況動向に急激な変化が生じたときなどは、そのとおりに運用できない場合があります。</p>')
    body += ('<div class="scroll-wrap"><table><thead><tr><th scope="col">項目</th>' + f'<th scope="col">{E(a_)}</th><th scope="col">{E(b_)}</th></tr></thead><tbody>'
             + row('運用の型', 'rv-idx', 'FTSEハイディビデンド・イールド・インデックス（円換算ベース）への連動をめざす', 'jp-idx', '投資先ETFがカバード・コール戦略。ベンチマークなし')
             + row('投資先のETF', 'rv-idx', 'バンガード・米国高配当株式ETF', 'jepi-etfs', 'JPモルガン・米国株式・プレミアム・インカムETFなど2本')
             + row('決算', 'rakuten-vym-settle', '年1回（7月15日。休業日は翌営業日）', 'jepi-settle1', '毎月（原則15日。休業日は翌営業日。第1期は2026年7月15日）')
             + row('分配金の実績', 'vym0', '設定来0円（2026年7月15日の決算まで）', 'distJ', '2026年7〜9月に3回（下の表）')
             + row('NISA', 'nisa-v', '成長投資枠・つみたて投資枠の対象', 'jepi-nisa', '対象ではない')
             + row('特化型運用の表示', 'vym-notokka', '記載なし', 'jepi-tokka', 'あり')
             + row('設定日', 'rakuten-vym-incept', FUNDS[V]['incept'], 'rakuten-jepi-incept', FUNDS[J]['incept'])
             + row('信託期間', 'term-v', '無期限（繰上償還の場合あり）', 'term-j', '2036年4月14日まで（延長・繰上償還の場合あり）')
             + '</tbody></table></div>')
    body += S(p, 'nisa-v', '<p class="note" data-review-context="after-table">NISAの取扱いは販売会社によって異なる場合があります。2本とも、分配金は委託会社が決め、必ず分配を行うものではありません。信託報酬などの料率は「費用」の節の表にまとめています。</p>')
    # ================= 実績
    ps = perf_section(p, head=f'項目（{PERIOD}の142日間）')
    pctx = S(p, 'perf', f'<p data-review-context="before-table">次の表の値は、比較期間（{PERIOD}）の基準価額から計算した、税引前の分配金を再投資した場合の売却前の値です。購入時・換金時の手数料と投資者ごとの税金は含みません。期間が1年未満のため、年率換算はしていません。</p>')
    assert ps.count('<div class="scroll-wrap">') == 1
    body += ps.replace('<div class="scroll-wrap">', pctx + '<div class="scroll-wrap">', 1)
    body += P(S(p, 'perf', f"比較期間（{PERIOD}）の税引前分配金再投資ベースの累積騰落率は、{a_}が{pct(r['A累積'])}、{b_}が{pct(r['B累積'])}でした。"),
              S(p, 'perf', f"{corr_period(p)}{r['同日相関']:.2f}です。"),
              S(p, 'perf', '比較期間は約4か月半で、上昇した相場・下落した相場のどちらを多く含むかで結果は入れ替わりえます。'))
    # ================= 仕組み
    body += S(p, 'jp-idx', '<h2 id="mechanism">仕組みの違い：指数に連動するか、オプションを売るか</h2>')
    body += P(S(p, 'rv-idx', f'{a_}は、マザーファンドを通じて「バンガード・米国高配当株式ETF」に投資し、FTSEハイディビデンド・イールド・インデックス（円換算ベース）に連動する投資成果をめざします（市況の急変時などは例外あり）。'),
              S(p, 'rv-idx', 'この指数は、米国株式市場の高配当利回りの銘柄（REITを除く）で構成される時価総額加重平均型の株価指数です。'),
              S(p, 'nocc', f'{a_}の交付目論見書と月次レポートには、オプションやカバード・コール戦略の記載はありません。'))
    body += P(S(p, 'jepi-etfs', f'{b_}は、マザーファンドを通じて、米ドル建ての「JPモルガン・米国株式・プレミアム・インカムETF」と、同じ名前の「アクティブUCITS ETF」を実質的な投資対象とします（第1期の交付運用報告書）。'),
              S(p, 'jepi-alloc', '2026年8月31日作成基準の月次レポートでは、マザーファンドの純資産総額に対する比率は前者が98.1%で、後者は「-」です。'),
              S(p, 'jepi-etfpol', '交付目論見書の2026年1月末現在の情報では、投資先ETFは株式の配当金とオプションのプレミアムを原資に毎月分配をめざします（今後変更の場合あり）。'))
    body += P(S(p, 'jepi-cap', 'カバード・コール戦略は、一定の水準以上の株価上昇による値上がり益を放棄する代わりに、コール・オプションの売却によるプレミアム（収益）の獲得をめざす手法です。'),
              S(p, 'jepi-cap', f'そのため、米国株価指数などが目標水準を超えて上昇しても、その上昇分を享受できず、{b_}の基準価額の上昇が制限される可能性があります。'),
              S(p, 'jepi-cap', '株式の価格が下落した場合は、基準価額の下落要因になります。'))
    body += S(p, 'comp-v', '<p data-review-context="before-table">次の表は、2本の投資先ETFの組入銘柄数と、組入1位・業種の最大の比率です。比率はETFの純資産総額に対する割合（楽天・VYMの業種は組入株式に対する割合）です。基準日と業種の分類が違うため、目安として並べています。</p>')
    t = ('<div class="scroll-wrap"><table><thead><tr><th scope="col">項目</th>' + f'<th scope="col">{E(a_)}の投資先ETF</th><th scope="col">{E(b_)}の投資先ETF</th></tr></thead><tbody>'
         + row('基準日と業種の分類', 'comp-v', '2026年7月末・ICB', 'comp-j', '2026年8月末・GICS')
         + row('組入銘柄数', 'comp-v', '604', 'comp-j', '135')
         + row('組入1位', 'comp-v', 'Broadcom 7.3%', 'comp-j', 'マイクロソフト 2.0%')
         + row('最大の業種', 'comp-v', '金融 21.3%', 'comp-j', '情報技術 15.4%')
         + '</tbody></table></div>')
    body += t
    body += P(S(p, 'comp-j', '仕組みも組入銘柄も違うため、2本の値動きの差は費用の差だけでは説明できません。'))
    # ================= 分配
    body += S(p, 'distJ', '<h3 id="dist">分配金：年1回決算と毎月決算</h3>')
    body += P(S(p, 'rvym-policy', f'{a_}の決算は毎年7月15日（休業日は翌営業日）の年1回です。'),
              S(p, 'vym0', '1万口当たりの分配金は、2026年7月15日の第9期決算まで設定来0円です。'),
              S(p, 'jepi-settle1', f'{b_}の決算は原則として毎月15日（休業日は翌営業日）で、第1期の決算日は2026年7月15日でした。'))
    body += S(p, 'distJ', f'<p data-review-context="before-table">次の表は、比較期間（{PERIOD}）に決算日が来た{b_}の分配金の全件です。過去の実績で、将来の水準を示すものではありません。</p>')  # 表より先に登録する（台帳の対応は文書の順）
    t = ('<div class="scroll-wrap"><table><thead><tr><th scope="col">決算日</th><th scope="col" class="num">'
         + S(p, 'distJ', f'{b_}の分配金（1万口当たり・税引前）') + '</th></tr></thead><tbody>')
    for d_, v_ in rj:
        t += f'<tr><th scope="row">{S(p, "distJ", jd(d_.replace("/", "-")))}</th><td class="num">{S(p, "distJ", f"{v_}円")}</td></tr>'
    t += '</tbody></table></div>'
    body += t
    body += P(S(p, 'distpolicy', '2本とも、分配金額は委託会社が決め、必ず分配を行うものではありません。'),
              S(p, 'distnav', '分配金は投資信託の純資産から支払われるので、支払われるとその金額相当分、基準価額は下がります。'),
              S(p, 'distover', f'{b_}の交付目論見書は、分配金が計算期間中の収益を超えて支払われる場合があり、その場合は決算日の基準価額が前期決算日より下がると書いています。'),
              S(p, 'perf', 'このため実績の表は、分配金を受け取らずに再投資したものとして2本をそろえています。'))
    body += P(S(p, 'jepi-d1', f'{b_}の第1期（作成対象期間2026年5月11日〜2026年7月15日）の交付運用報告書では、分配金65円（1万口当たり・税込）の内訳は「当期の収益」が65円、「当期の収益以外」が「－」です。'),
              S(p, 'jepi-d1', '2026年8月・9月の決算の内訳は、確認日に掲載されていた交付運用報告書の作成対象期間より後なので、まだ載っていません。'),
              S(p, 'pdef', '受け取った分配金が普通分配金か元本払戻金（特別分配金）かは、ファンドの内訳とは別に、投資者ごとの購入価額（個別元本）で決まります。'))
    body += P(S(p, 'nav-v', f'2026年9月30日の純資産総額は、運用会社の公表データで{a_}が{navs[V]}億円です。'),
              S(p, 'nav-j', f'同じ日の{b_}の純資産総額は{navs[J]}億円です。'))
    body += P(S(p, 'jepi-tokka', f'{b_}の交付目論見書は、資産運用業協会の規則で定める寄与度が10%を超える（または超える可能性の高い）支配的な銘柄が投資先ETFにあるとして、「特化型運用」と表示しています。'),
              S(p, 'jepi-tokka', 'その銘柄のエクスポージャーは、純資産総額の35%を超えないように運用するとしています。'))
    # ================= 費用
    fs_ = fee_section(p, skip=('index', 'settle', 'incept', 'ter_period'), vals={
        (V, 'eff'): '年0.172%程度（投資先ETF年0.04%程度を含む）',
        (J, 'eff'): '年0.658%程度（投資先ETF年0.35%程度を含む）',
        (V, 'ter'): '0.22%（2025/7/16〜2026/7/15）', (J, 'ter'): '0.65%（2026/5/11〜2026/7/15）'})
    body += fs_.replace('<h2 id="fees">目論見書の料率と、総経費率（参考値）を分けて見る</h2>',
                        '<h2 id="fees">目論見書の料率と、総経費率（参考値）を分けて見る</h2>'
                        + S(p, 'feehead', f'<p data-review-context="before-table">次の表は、{jd(GOT)}に確認した交付目論見書と交付運用報告書の記載で、料率は税込の年率です。実質的な信託報酬は交付目論見書の概算で、組入状況や運用状況で変わります。信託報酬の2行は、その他の費用と、有価証券の貸付を行った場合の報酬を含まない率です。</p>'), 1)
    body += P(S(p, f'{V}-eff', f'{a_}の実質的な信託報酬（年0.172%程度）は、国内ファンド分の年0.132%に、投資先ETFの管理報酬等の年0.04%程度（2026年2月末現在）を加えた概算で、組入状況などで変わります。'),
              S(p, 'rakuten-vym-etfchg', '投資先ETFの年0.04%程度は、2026年2月2日付で変更された後の率です。'),
              S(p, f'{J}-eff', f'{b_}の実質的な信託報酬（年0.658%程度）は、国内ファンド分の年0.308%に、投資先ETFの報酬の年0.35%程度（2026年1月末現在）を加えた概算で、組入状況などで変わります。'),
              S(p, 'effgap', f'2つの概算（組入状況などで変わる目安）の差は年{d}ポイント程度で、100万円を1年間持ち続けたと仮定すると約{amt:,}円です（実際の損益の差ではありません）。'))
    body += P(S(p, 'ternote', '総経費率は、交付運用報告書の作成対象期間の費用を年率に直した参考値で、原則として売買委託手数料などを含みません。'),
              S(p, 'terpair', f'総経費率は、{a_}の0.22%が直近1年、{b_}の0.65%が設定日から第1期決算日までの約2か月の値です（対象期間は表のとおり）。'),
              S(p, 'ternote', '対象期間の長さが違い、資料も実際に発生した費用の比率とは異なるとしているため、2つの差をそのまま負担の差としては読めません。'))
    body += P(S(p, 'othercost', '監査報酬や売買委託手数料などの「その他の費用・手数料」は、運用状況で変わるため料率や上限額を事前に示せないとされ、表の信託報酬には含まれません。'),
              S(p, 'lendpair', f'2本とも、有価証券の貸付を行った場合は、品貸料に{FUNDS[J]["lend_rate"]}を乗じた額の貸付有価証券関連報酬がかかります（委託会社が一部を負担する場合あり）。'))
    # ================= 計算条件・FAQ
    ms_ = method_section(p)
    body += ms_
    body += faq_block(p, [
        ('jp-idx', f'{a_}と{b_}の違いは何ですか？', [
            ('rv-idx', f'{a_}は、米国の高配当株の指数（FTSEハイディビデンド・イールド・インデックス）に連動をめざすETFに投資する方針です（市況の急変時などは例外あり）。'),
            ('jp-idx', f'{b_}は、米国株を持ちながらコール・オプションを売るカバード・コール戦略のETFに投資する方針で（市況の急変時などは例外あり）、ベンチマークはありません。'),
            ('distJ', f'決算も違い、{a_}は年1回、{b_}は毎月です。')]),
        ('vym0', f'{a_}は分配金を出していますか？', [
            ('vym0', '1万口当たりの分配金は、2026年7月15日の第9期決算まで設定来0円です。'),
            ('rvym-policy', '分配金額は委託会社が決め、必ず分配を行うものではありません。')]),
        ('jepi-cap', 'カバード・コール戦略で上昇が制限されるとは、どういうことですか？', [
            ('jepi-cap', '株価が一定の水準を超えて上がっても、その上昇分を受け取れない代わりに、オプションを売ったプレミアムの獲得をめざすということです。'),
            ('jepi-cap', '株価が下がったときは、基準価額の下落要因になります。')]),
        ('jepi-nisa', f'{b_}はNISAで買えますか？', [
            ('jepi-nisa', f'交付目論見書（使用開始日2026年4月27日）には、{b_}はNISAの対象ではないと書かれています。'),
            ('nisa-v', f'{a_}は、交付目論見書（使用開始日2026年4月16日）で成長投資枠とつみたて投資枠の対象です（販売会社により取扱いが異なる場合があります）。')]),
        faq_net(p),
    ])
    sections = [('diff', '2本の違いの早見表'), ('performance', '同じ期間の実績を、分配金再投資で比べる'), ('mechanism', '仕組みの違い：指数に連動するか、オプションを売るか'),
                ('fees', '目論見書の料率と、総経費率（参考値）を分けて見る'), ('method', '計算条件と、この比較からは分からないこと'), ('faq', 'よくある質問'), ('source', '出典')]
    related = [('../rakuten-jepi-vs-rakuten-schd/', '楽天・JEPI vs 楽天・SCHD', '楽天・JEPIを、配当株の指数に連動するファンドと比べる'),
               ('../rakuten-schd-vs-rakuten-vym/', '楽天・SCHD vs 楽天・VYM', '楽天・VYMを、別の米国高配当のファンドと比べる'),
               ('../sbi-vym-vs-rakuten-vym/', 'SBI・V・米国高配当株式 vs 楽天・VYM', '同じETFに投資する2本を比べる'),
               ('../sbi-spyd-vs-rakuten-vym/', 'SBI・SPDR・S&P500高配当 vs 楽天・VYM', '楽天・VYMを、S&P500高配当指数のファンドと比べる')]
    return p, title, desc, body, sections, related
