"""Fund master for the 2026-10-01 batch. Every display value is paired with a verbatim
quote from the issuer document (see sources.py). Values were read from the saved PDFs on
2026-10-01; None means "not published" and is never replaced with 0.
"""
from sources import Q, url, nav_rows

ASOF_DOC = '2026年10月1日'

def F(**kw):
    return kw

FUNDS = {}

FUNDS['orcan'] = F(
    name='eMAXIS Slim 全世界株式（オール・カントリー）', short='eMAXIS Slimオルカン', company='三菱UFJアセットマネジメント',
    page='https://www.am.mufg.jp/fund/253425.html', P='orcan_P', Ak='orcan_Ak', M='orcan_M', etf=False,
    index='MSCIオール・カントリー・ワールド・インデックス（配当込み、円換算ベース）',
    index_q=('orcan_P', r'ＭＳＣＩ オール・カントリー・ワールド・インデックス（配当込み）とは、MSCI Inc\.が開発した株価指数で、世界の先\s?進国・新興国の株式で構成されています。'),
    fee='年0.05775%以内（段階制）', fee_num=0.05775, tiered=True,
    fee_q=('orcan_P', r'5,000億円未満の部分 0\.05775％ 0\.0525％.{0,120}?1兆円以上の部分 0\.05753％'),
    eff='上と同じ（ETFを経由しない）',
    eff_q=('orcan_P', r'※実際の運用は外国株式インデックスマザーファンド、 新興国株式インデックスマザーファンド、 日本株式インデックス マザーファンドを通じて行います。'),
    ter='0.07061%', ter_period='2025/4/26〜2026/4/27', ter_round='0.07%',
    terd_q=('orcan_P', r'0\.07％ 0\.06％ 0\.01％ （比率は年率、表示桁数未満四捨五入） ※上記の詳細な総経費率は以下の通りです。 0\.07061％'),
    terak_q=('orcan_Ak', r'総経費率（年率）は0\.07％です。'),
    lend_kind='add', lend_rate='49.5%（税抜45.0%）',
    lend_q=('orcan_P', r'ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の ?49\.5％ ?（税抜 45\.0％） ?以内の額が上記の運用管理費用（信託報酬）に追加されます。'),
    tier_q=('orcan_P', r'5,000億円以上 0\.05764％.{0,200}?ファンドの純資産総額 10兆9,000億円 11兆4,000億円 11兆9,000億円 実質信託報酬率 ?（税込 年率） 0\.05755% 0\.05755% 0\.05755%'),
    ter_q=('orcan_P', r'2025年４月26日～2026年４月27日）.{0,200}?0\.07061％ 〔内訳①運用管理費用：0\.05746％、②その他費用：0\.01315％〕'),
    hedge='原則なし', hedge_q=('orcan_P', r'原則として、為替ヘッジは行いません。'),
    settle='年1回（4月25日。休業日の場合は翌営業日）', settle_q=('orcan_P', r'年１回の決算時 （４月25日 （休業日の場合は翌営業日）） に分配金額を決定します。'),
    incept='2018年10月31日', incept_nav='2018-10-31',
    nofee_q=('orcan_P', r'購入時手数料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['emaxis-sensinkoku'] = F(
    name='eMAXIS Slim 先進国株式インデックス（除く日本）', short='eMAXIS Slim先進国株式', company='三菱UFJアセットマネジメント',
    page='https://www.am.mufg.jp/fund/252653.html', P='esen_P', Ak='esen_Ak', M='esen_M', etf=False,
    index='MSCIコクサイ・インデックス（配当込み、円換算ベース）',
    index_q=('esen_P', r'ＭＳＣ\s?Ｉコクサイ・インデックス\s?（配当込み）\s?とは、MSCI Inc\.が開発した株価指数で、\s*日本を除く世界の先進国で構成されています。'),
    fee='年0.09889%以内（段階制）', fee_num=0.09889, tiered=True,
    fee_q=('esen_P', r'5,000億円未満の部分 0\.09889％ 0\.0899％.{0,200}?１兆円以上の部分 0\.09757％'),
    eff='上と同じ（ETFを経由しない）',
    eff_q=('esen_P', r'※実際の運用は外国株式インデックスマザーファンドを通じて行います。'),
    ter='0.10312%', ter_period='2025/4/26〜2026/4/27', ter_round='0.10%',
    terd_q=('esen_P', r'0\.10％ 0\.10％ 0\.00％ （比率は年率、表示桁数未満四捨五入） ※上記の詳細な総経費率は以下の通りです。 0\.10312％'),
    terak_q=('esen_Ak', r'総経費率（年率）は0\.10％です。'),
    ter_q=('esen_P', r'2025年４月26日～2026年４月27日）.{0,200}?0\.10312％ 〔内訳①運用管理費用：0\.09835％、②その他費用：0\.00477％〕'),
    hedge='原則なし', hedge_q=('esen_P', r'原則として、為替ヘッジは行いません。'),
    settle='年1回（4月25日。休業日の場合は翌営業日）', settle_q=('esen_P', r'年１回の決算時 （４月25日 （休業日の場合は翌営業日）） に分配金額を決定します。'),
    incept='2017年2月27日', incept_nav='2017-02-27',
    nofee_q=('esen_P', r'購入時手数料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['tawara-sensinkoku'] = F(
    name='たわらノーロード 先進国株式', short='たわらノーロード先進国株式', company='アセットマネジメントOne',
    page='https://www.am-one.co.jp/fund/summary/313125/', P='tawara_P', Ak='tawara_Ak', M=None, etf=False,
    index='MSCIコクサイ・インデックス（円換算ベース、配当込み、為替ヘッジなし）',
    index_q=('tawara_P', r'（円換算ベース、配当込み、 為替ヘッジなし） ）'),
    fee='年0.09889%以内（2026年7月14日現在0.09889%）', fee_num=0.09889, tiered=False,
    fee_q=('tawara_P', r'年率0\.09889％ \s?（税抜0\.0899％）\s?以内.{0,300}?2026年７月14日現在は、年率0\.09889％'),
    eff='上と同じ（ETFを経由しない）',
    eff_q=('tawara_P', r'１ 外国株式パッシブ・ファンド'),
    ter='0.11%', ter_period='2024/10/16〜2025/10/14',
    ter_q=('tawara_P', r'総経費率 （①＋②） 運用管理費用の比率① その他費用の比率② 0\.11％ 0\.10％ 0\.02％ （表示桁数未満を四捨五入） ※対象期間：2024年10月16日～2025年10月14日'),
    hedge='原則なし（金利・為替状況により実施の可能性あり）',
    hedge_q=('tawara_P', r'組入外貨建資産については原則為替ヘッジは行いませんが、金利・為替状況によってはヘッジを実施する可能性が ?あります。'),
    settle='年1回（10月12日。休業日の場合は翌営業日）', settle_q=('tawara_P', r'年１回の決算時（毎年10月12日 ?（休業日の場合は翌営業日））'),
    incept='2015年12月18日', incept_q=('tawara_P', r'（設定日：2015年12月18日）'),
    nofee_q=('tawara_P', r'購 入 時 手 数 料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['fang'] = F(
    name='iFreeNEXT FANG+インデックス', short='iFreeNEXT FANG+', company='大和アセットマネジメント',
    page='https://www.daiwa-am.co.jp/funds/detail/3346/detail_top.html', P='fang_P', Ak='fang_Ak', M='fang_M', etf=False,
    index='NYSE FANG+指数（配当込み、円ベース）',
    index_q=('fang_P', r'米国上場企業の株式に投資し、NYSE FANG\+指数 （配当込み、円ベース） の動き に連動した投資成果をめざします。'),
    fee='年0.7755%', fee_num=0.7755, tiered=False,
    fee_q=('fang_P', r'運用管理費用 年率0\.7755％'),
    eff='上と同じ（ETFを経由しない）',
    eff_q=('fang_P', r'原則として、NYSE FANG\+指数を構成する全銘柄に投資します。'),
    ter='0.78%', ter_period='2025/1/31〜2026/1/30',
    ter_q=('fang_P', r'0\.78% 0\.78% 0\.01% FANG\+インデックス ※対象期間は2025年1月31日～2026年1月30日です。'),
    hedge='原則なし', hedge_q=('fang_P', r'為替変動リスクを回避するための為替ヘッジは原則として行ないません。'),
    settle='年1回（1月30日。休業日の場合は翌営業日）', settle_q=('fang_P', r'分配方針 毎年1月30日 （休業日の場合翌営業日） に決算を行ない'),
    incept='2018年1月31日', incept_q=('fang_P', r'当初設定日（2018年1月31日）'),
    nofee_q=('fang_P', r'信託財産留保額 ありません。'),
)
FUNDS['ifreenext-india'] = F(
    name='iFreeNEXT インド株インデックス', short='iFreeNEXT インド株', company='大和アセットマネジメント',
    page='https://www.daiwa-am.co.jp/funds/detail/3484/detail_top.html', P='dindia_P', Ak='dindia_Ak', M='dindia_M', etf=False,
    index='Nifty50指数（配当込み、円ベース）',
    index_q=('dindia_P', r'インドの株式に投資し、Nifty50指数 （配当込み、円ベース） の動きに連動した投資 成果をめざします。'),
    fee='年0.473%', fee_num=0.473, tiered=False,
    fee_q=('dindia_P', r'運用管理費用 年率0\.473％'),
    eff='上と同じ（ETFを経由しない）',
    eff_q=('dindia_M', r'外国株式 50 71\.8% インド・ルピー 100\.0% 第1期 \(24/03\) 0円 外国株式 先物 1 28\.0%'),
    ter='0.50%', ter_period='2025/3/13〜2026/3/12',
    ter_q=('dindia_P', r'0\.50% 0\.47% 0\.02% インド株インデックス ※対象期間は2025年3月13日～2026年3月12日です。'),
    hedge='原則なし', hedge_q=('dindia_P', r'為替変動リスクを回避するための為替ヘッジは原則として行ないません。'),
    settle='年1回（3月12日。休業日の場合は翌営業日）', settle_q=('dindia_P', r'分配方針 毎年3月12日 （休業日の場合翌営業日） に決算を行ない'),
    incept='2023年3月13日', incept_q=('dindia_P', r'当初設定日（2023年3月13日）'),
    nofee_q=('dindia_P', r'信託財産留保額 ありません。'),
)
FUNDS['rakuten-india'] = F(
    name='楽天・インド株Nifty50インデックス・ファンド', short='楽天・インド株Nifty50', company='楽天投信投資顧問',
    page='https://www.rakuten-toushin.co.jp/fund/nav/riinf50/', P='riinf50_P', Ak='riinf50_Ak', M='riinf50_M', etf=False,
    index='Nifty50指数（配当込み、円換算ベース）',
    index_q=('riinf50_P', r'当ファンドは、インドの株式市場の動きをとらえることを目指して、Ｎｉｆｔｙ５０指数（配当込み、円換算'),
    fee='年0.308%', fee_num=0.308, tiered=False,
    fee_q=('riinf50_P', r'財産の純資産総額に年0\.308％（税抜0\.28％）'),
    eff='上と同じ（ETFを経由しない）',
    eff_q=('riinf50_M', r'株式 78\.5%.{0,80}?株式先物 21\.6% 通貨先物 21\.5%'),
    ter='0.42%', ter_period='2025/2/18〜2026/2/16',
    ter_q=('riinf50_P', r'対象期間：2025年2月18日～ 2026年2月16日 総経費率（①＋②） ①運用管理費用の比率 ②その他費用の比率 0\.42% 0\.31% 0\.11%'),
    lend_kind='other', lend_rate='0.55（税抜0.5）',
    lend_q=('riinf50_P', r'・貸付有価証券関連報酬：有価証券の貸.{0,160}?品貸料に0\.55 ?（税抜0\.5） ?を乗 ?じて得た額'),
    lendhead_q=('riinf50_P', r'以下の費用・手数料は、原則として受益者の負担とし.{0,900}?・貸付有価証券関連報酬 等'),
    hedge='原則なし', hedge_q=('riinf50_P', r'原則として、為替ヘッジは行いません'),
    settle='年1回（2月15日。休業日の場合は翌営業日）', settle_q=('riinf50_P', r'決 算 日 原則として、毎年2月15日 （ただし、休業日の場合は翌営業日）'),
    incept='2024年4月5日', incept_q=('riinf50_P', r'無期限（設定日：2024年4月5日）'),
    nofee_q=('riinf50_P', r'購入時手数料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['rakuten-schd'] = F(
    name='楽天・シュワブ・高配当株式・米国ファンド（四半期決算型）', short='楽天・SCHD（四半期決算型）', company='楽天投信投資顧問',
    page='https://www.rakuten-toushin.co.jp/fund/nav/risude/', P='risude_P', Ak='risude_Ak', M='risude_M', etf=True,
    index='ベンチマークなし（投資先ETFはダウ・ジョーンズ US ディビデンド 100 インデックスに連動を目指す）',
    index_q=('risude_P', r'ダウ・ジョーンズ US ディビデンド.{0,60}?100 インデックスに連動する投 0\.06％ 米国配当株式ETF'),
    fee='年0.1238%', fee_num=0.1238, tiered=False,
    fee_q=('risude_P', r'財産の純資産総額に年0\.1238％（税抜0\.1125％）'),
    eff='年0.1238%程度（投資先ETFの報酬相当額は委託会社が充当）',
    eff_q=('risude_P', r'投資対象ファンドにおいて年0\.06％程度の報酬が日々控除されますが、委託会社が合理的に見積った当該報 酬相当額をファンドに充当します。'),
    ter='0.19%', ter_period='2025/8/26〜2026/2/25', ter_mark='※',
    ter_q=('risude_P', r'対象期間：2025年8月26日～ 2026年2月25日 総経費率（①＋②） ①運用管理費用の比率 ②その他費用の比率 0\.19% 0\.12% 0\.07%'),
    lend_kind='other', lend_rate='0.55（税抜0.5）',
    lend_q=('risude_P', r'・貸付有価証券関連報酬：有価証券の貸.{0,160}?品貸料に0\.55 ?（税抜0\.5） ?を乗 ?じて得た額'),
    lendhead_q=('risude_P', r'以下の費用・手数料は、原則として受益者の負担とし.{0,900}?・貸付有価証券関連報酬 等'),
    hedge='原則なし', hedge_q=('risude_P', r'◆原則として、為替ヘッジは行いません。'),
    settle='年4回（2・5・8・11月の各25日。休業日の場合は翌営業日）', settle_q=('risude_P', r'毎年2、5、8、11月の各25日 （休業日の場合は翌営業日） に決算を行い'),
    incept='2024年9月18日', incept_q=('risude_P', r'無期限（設定日：2024年9月18日）'),
    nofee_q=('risude_P', r'購入時手数料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['sbi-vym4'] = F(
    name='SBI・V・米国高配当株式インデックス・ファンド（年4回決算型）', short='SBI・V・米国高配当（年4回）', company='SBIアセットマネジメント',
    page='https://www.sbiam.co.jp/fund/report/sa_2024013001.html', P='svym_P', Ak='svym_Ak', M='svym_M', etf=True,
    index='FTSEハイディビデンド・イールド・インデックス（配当込み、円換算ベース）',
    index_q=('svym_P', r'「バンガード・米国高配当株式ETF」 を実質的な主要投資対象とします。.{0,200}?FTSE ハイディビデンド・イールド・インデックス （配当込'),
    fee='年0.0638%（国内ファンド分）', fee_num=0.0638, tiered=False,
    fee_q=('svym_P', r'ファンドの日々の純資産総額に年0\.0638％ （税抜：年0\.058％）'),
    eff='年0.1038%程度（投資先ETF年0.04%程度を含む）',
    eff_q=('svym_P', r'年0\.04％程度 投 資 信 託 証 券 ＊マザーファンド受益証券を通じて投資するETF（上場投資信託証券）の信託報酬等 年0\.1038％ （税込） 程度'),
    ter='0.14%', ter_period='2025/11/21〜2026/5/20',
    ter_q=('svym_P', r'直近の運用報告書の作成対象期間は2025年11月21日〜2026年5月20日です。 総経費率（①＋②） ①運用管理費用の比率 ②その他費用の比率 0\.14% 0\.06% 0\.08%'),
    lend_kind='add', lend_rate='55.0%（税抜50.0%）',
    lend_q=('svym_P', r'ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の ?55\.0％ ?（税抜 ?50\.0%） ?以内の額が上記の運用管理費用 ?（信託報酬） ?に追加されます。'),
    hedge='なし', hedge_q=('svym_P', r'実質組入外貨建資産については、為替ヘッジを行いません。'),
    settle='年4回（2・5・8・11月の各20日。休業日の場合は翌営業日）', settle_q=('svym_P', r'年4回 （原則として、2月、5月、8月および11月の各20日。休業日の場合は翌営業日。\)決算を行い'),
    incept='2024年1月30日', incept_q=('svym_P', r'（設定日：2024年1月30日'),
    nofee_q=('svym_P', r'購入時手数料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['rakuten-vym'] = F(
    name='楽天・米国高配当株式インデックス・ファンド', short='楽天・VYM', company='楽天投信投資顧問',
    page='https://www.rakuten-toushin.co.jp/fund/nav/rivuh/', P='rivuh_P', Ak='rivuh_Ak', M='rivuh_M', etf=True,
    index='FTSEハイディビデンド・イールド・インデックス（円換算ベース）',
    index_q=('rivuh_P', r'FTSEハイディビデンド・ イールド・インデックス （円換算ベース）に連動する投資成果を目標として運用を行います。'),
    fee='年0.132%（国内ファンド分）', fee_num=0.132, tiered=False,
    fee_q=('rivuh_P', r'産の純資産総額に年0\.132％（税抜0\.12％）'),
    eff='年0.172%程度（投資先ETF年0.04%程度を含む）',
    eff_q=('rivuh_P', r'年0\.04%程度 証 券 に お け る 報 酬 ＊1 信託証券の管理報酬等 実 質 的 に 負 担 する 年0\.172%（税込）程度'),
    ter='0.22%', ter_period='2025/7/16〜2026/7/15', ter_doc='Ak',
    ter_q=('rivuh_Ak', r'経費率（年率）は0\.22%です。'),
    ter_period_q=('rivuh_Ak', r'（作成対象期間 2025年7月16日～2026年7月15日）'),
    lend_kind='other', lend_rate='0.55（税抜0.5）',
    lend_q=('rivuh_P', r'・貸付有価証券関連報酬：有価証券の貸.{0,160}?品貸料に0\.55 ?（税抜0\.5） ?を乗 ?じて得た額'),
    lendhead_q=('rivuh_P', r'以下の費用・手数料は、原則として受益者の負担とし.{0,900}?・貸付有価証券関連報酬 等'),
    hedge='原則なし', hedge_q=('rivuh_P', r'原則として、為替ヘッジは行いません'),
    settle='年1回（7月15日。休業日の場合は翌営業日）', settle_q=('rivuh_P', r'毎年7月15日 ?（休業日の場合は翌営業日）に決算を行い'),
    incept='2018年1月10日', incept_q=('rivuh_P', r'当初設定日（2018年1月10日）'),
    nofee_q=('rivuh_P', r'購 入 時 手 数 料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['rakuten-gold'] = F(
    name='楽天・ゴールド・ファンド（為替ヘッジなし）', short='楽天・ゴールド（ヘッジなし）', company='楽天投信投資顧問',
    page='https://www.rakuten-toushin.co.jp/fund/nav/ricgld/', P='ricgld_P', Ak=None, M='ricgld_M', etf=True,
    index='金価格の値動きをとらえることを目指すETF等',
    index_q=('ricgld_P', r'主として金価格の値動きをとらえることを目指す上 場投資信託証券（ETF）等に投資します。 ※当ファンドは金地金への直接投資は行いません。'),
    fee='年0.1925%（国内ファンド分）', fee_num=0.1925, tiered=False,
    fee_q=('ricgld_P', r'純資産総額に年0\.1925％（税抜'),
    eff='年0.2925%程度（投資先ETF等年0.1%程度を含む）',
    eff_q=('ricgld_P', r'年0\.1％程度.{0,80}?年0\.2925％ （税込）程度'),
    ter=None, ter_period='未掲載（第1期決算日2026年8月17日）',
    ter_q=('ricgld_P', r'第1期決算日は、2026年8月17日とします。'),
    lend_kind='other', lend_rate='0.55（税抜0.5）',
    lend_q=('ricgld_P', r'・貸付有価証券関連報酬：有価証券の貸.{0,160}?品貸料に0\.55 ?（税抜0\.5） ?を乗 ?じて得た額'),
    lendhead_q=('ricgld_P', r'以下の費用・手数料は、原則として受益者の負担とし.{0,900}?・貸付有価証券関連報酬 等'),
    hedge='原則なし', hedge_q=('ricgld_P', r'「為替ヘッジなし」 は原則として為替ヘッジを行いません。'),
    settle='年1回（8月15日。休業日の場合は翌営業日）', settle_q=('ricgld_P', r'原則として、毎年8月15日（ただし、休業日の場合は翌営業日）'),
    incept='2026年1月21日', incept_q=('ricgld_P', r'無期限（設定日：2026年1月21日）'),
    nofee_q=('ricgld_P', r'購入時手数料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['sbi-gold'] = F(
    name='SBI・iシェアーズ・ゴールドファンド（為替ヘッジなし）', short='SBI・iシェアーズ・ゴールド（ヘッジなし）', company='SBIアセットマネジメント',
    page='https://www.sbiam.co.jp/fund/report/sa_202306080A.html', P='sgold_P', Ak='sgold_Ak', M=None, etf=True,
    index='LBMA金価格指数に連動するETFまたはETC',
    index_q=('sgold_P', r'2 ＬＢＭＡ金価格指数に連動するETFまたはETC'),
    fee='年0.0638%（国内ファンド分）', fee_num=0.0638, tiered=False,
    fee_q=('sgold_P', r'ファンドの日々の純資産総額に年0\.0638％ （税抜：年0\.058％）'),
    eff='年0.1538〜0.1838%程度（投資先年0.09〜0.12%程度を含む）',
    eff_q=('sgold_P', r'年0\.09％〜0\.12％程度.{0,80}?年0\.1538％〜0\.1838％ （税込） 程度'),
    ter='0.19%', ter_period='2025/6/11〜2026/6/10',
    ter_q=('sgold_P', r'直近の運用報告書の作成対象期間は2025年6月11日〜2026年6月10日です。.{0,260}?（為替ヘッジなし） ＞ 総経費率（①＋②） ①運用管理費用の比率 ②その他費用の比率 0\.19％ 0\.06％ 0\.13％'),
    lend_kind='add', lend_rate='55.0%（税抜50.0%）',
    lend_q=('sgold_P', r'ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の ?55\.0％ ?（税抜 ?50\.0%） ?以内の額が上記の運用管理費用 ?（信託報酬） ?に追加されます。'),
    hedge='原則なし', hedge_q=('sgold_P', r'為替ヘッジなし 実質組入外貨建資産について、原則として為替ヘッジを行い'),
    settle='年1回（6月10日。休業日の場合は翌営業日）', settle_q=('sgold_P', r'毎決算時（年１回、6月10日。休業日の場合は翌営業日とします。）'),
    incept='2023年6月8日', incept_q=('sgold_P', r'（設定日：2023年6月8日'),
    nofee_q=('sgold_P', r'購入時手数料 ありません。 信託財産留保額 ありません。'),
)
FUNDS['sbi-yukidaruma'] = F(
    name='SBI・全世界株式インデックス・ファンド（愛称：雪だるま（全世界株式））', short='雪だるま（全世界株式）', company='SBIアセットマネジメント',
    page='https://www.sbiam.co.jp/fund/report/sa_2017120601.html', P='yuki_P', Ak='yuki_Ak', M='yuki_M', etf=True,
    index='FTSEグローバル・オールキャップ・インデックス（配当込み、円換算ベース）',
    index_q=('yuki_P', r'「FTSEグローバル オール・キャップ インデックス」はFTSE社が開発した指数で、全世界の大型、中型、小型株の市場の 動きを表す指数です。'),
    fee='年0.0682%（国内ファンド分）', fee_num=0.0682, tiered=False,
    fee_q=('yuki_P', r'ファンドの日々の純資産総額に年0\.0682％（税抜：0\.062％）'),
    eff='年0.1022%程度（投資先ETF年0.034%程度を含む）',
    eff_q=('yuki_P', r'年 0\.034％程度.{0,200}?年 0\.1022％（税込）程度'),
    ter='0.10%', ter_period='2024/11/13〜2025/11/12',
    ter_q=('yuki_P', r'直近の運用報告書の作成対象期間は2024年11月13日〜2025年11月12日です。 総経費率（①＋②） ①運用管理費用の比率 ②その他費用の比率 0\.10％ 0\.06% 0\.04％'),
    lend_kind='add', lend_rate='55.0%（税抜50.0%）',
    lend_q=('yuki_P', r'ファンドの品貸料およびマザーファンドの品貸料のうちファンドに属するとみなした額の ?55\.0％ ?（税抜 ?50\.0%） ?以内の額が上記の運用管理費用 ?（信託報酬） ?に追加されます。'),
    hedge='なし（属性区分）', hedge_q=('yuki_P', r'決算頻度 投資形態 為替ヘッジ 対象インデックス.{0,200}?無し'),
    settle='年1回（11月12日。休業日の場合は翌営業日）', settle_q=('yuki_P', r'毎決算時（年１回毎年11月12日。休業日の場合は翌営業日とします。）'),
    incept='2017年12月6日', incept_q=('yuki_P', r'2017年は設定日2017年12月6日から年末まで'),
    nofee_q=('yuki_P', r'購入時手数料 ありません。 信託財産留保額 ありません。'),
)

# Funds whose prospectus has no securities-lending fee clause: the build stops if the word ever appears.
NO_LEND = ('emaxis-sensinkoku', 'tawara-sensinkoku', 'fang', 'ifreenext-india')

def check_all():
    from sources import text
    for k, f in FUNDS.items():
        assert ('品貸料' in text(f['P'])) == ('lend_q' in f), f'lending clause mismatch: {k}'
        assert ('lend_q' in f) != (k in NO_LEND), k
    for k, f in FUNDS.items():
        for key, v in f.items():
            if key.endswith('_q'):
                Q(*v)
    return True

if __name__ == '__main__':
    bad = 0
    for k, f in FUNDS.items():
        for key, v in f.items():
            if key.endswith('_q'):
                try:
                    print(k, key, '|', Q(*v)[:110])
                except Exception as e:
                    bad += 1; print('MISSING', k, key, e)
    print('missing', bad)
