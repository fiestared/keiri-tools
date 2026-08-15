/**
 * sitemap.xml と コラム一覧(column/index.html の記事リスト) を、記事ファイルから生成する。
 *
 * なぜ生成にするか:
 * 記事を書くたびに「sitemap に足す」「一覧に足す」を手でやると、**必ずいつか忘れる**。
 * 忘れた記事は誰にも届かない(検索にも載らず、サイト内からも辿れない)。
 * このリポジトリは同じ理由でFAQのJSON-LDも生成方式にした。同じ規律を適用する。
 *
 *   node tools/gen_index_sitemap.mjs           生成
 *   node tools/gen_index_sitemap.mjs --check   差分があれば失敗(CI/テスト用)
 *
 * 記事側の正本:
 *   タイトル … <h1>
 *   日付     … JSON-LD の datePublished
 *   説明文   … <meta name="card-desc">(一覧カード用の短い惹句)。無ければ meta description
 * 並び順は下の ORDER。載っていない記事は日付降順で後ろに付く。
 *
 * 一覧は CATEGORIES ごとのセクションに分けて出す(48本を縦一列に並べても探せない)。
 * **カテゴリ内の並びは ORDER(検索需要順)のまま**。日付順にしない
 * (需要の大きい記事ほど上に出したいのであって、新しい記事を上に出したいのではない)。
 * CATEGORIES に無い記事は「その他」に入れたうえで名指しで警告する。
 * 黙って埋もれさせないため、未分類は test_article_structure.mjs が落とす。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const COLUMN = join(DOCS, "column");
const CHECK = process.argv.includes("--check");

/** 一覧の並び(検索需要の大きい順。ここに無い記事は日付降順で末尾) */
const ORDER = [
  "furusato-nozei-keisan",      // ふるさと納税 計算 85,023/月（ふるさと納税 シミュレーション 57,105 も同記事で受ける）
  "36-kyotei",                  // 36協定 74,000/月（特別条項 9,900・わかりやすく 4,400・三六協定 4,400・届出 1,900 も同記事で受ける）
  "kibiki-keicho-kyuka",        // 忌引き休暇 60,500/月（忌引き 49,500・忌引きとは 33,100・慶弔休暇 18,100・忌引き 何日 5,400・慶弔休暇とは 4,400・忌引き 祖父母 4,400・慶弔費 3,600・忌引き 証明書 2,400・忌引き 給料 2,400・慶弔見舞金 1,900・慶弔休暇 有給 260・慶弔休暇 日数 170・慶弔休暇 無給 50 ＝クラスタ 186,180。★別称の忌引き系3語だけで143,100＝慶弔系の5.5倍。引き継ぎ候補は「慶弔休暇 18,100」だったので頭の語を取り違えると1/3に見誤る）
  "nenmatsu-chosei-kakikata",   // 年末調整 書き方 57,105/月
  "sanzen-sango-kyugyo",        // 産休 いつから 49,500/月（産休 期間 5,400・産前産後休業 4,400・産休 社会保険料 免除 1,300・産後休業 210 ＝クラスタ 60,810。★自サイトは出産手当金＝給付の側だけを持っており、労働基準法65条（産前は請求制／産後は強制）を主題にした記事は無かった。shussan-teate-kin は労働基準法の言及が0回）
  "kaigyo-todoke",              // 開業届 40,500/月（開業届 個人事業主 33,100・必要なもの 4,400・書き方 4,400・e-tax 2,900・ダウンロード 2,400・出し方 1,300・オンライン 1,300・開業届とは 1,000・住所変更 590 ＝クラスタ 91,890）
  "kogaku-ryoyohi",             // 高額療養費制度 38,281/月（限度額適用認定証 31,302 も同記事で受ける）
  "flextime",                   // フレックスタイム制 33,100/月（フレックスタイム制とは 12,100・デメリット 1,600・フレックスタイム制度 880・コアタイム 720・残業 720・労使協定 390・メリット 320・フレックスタイム制度とは 210・法定労働時間 90 ＝クラスタ 50,130）
  "ikuji-kyugyo-kyufukin",      // 育児休業給付金 31,302/月
  "roudou-joken-tsuchisho",     // 雇用契約書 27,100/月（労働条件通知書 22,200・雇用契約書 ない 4,400・労働条件通知書とは 3,600・雇用契約書とは 2,900 ほかクラスタ計 64,670 も同記事で受ける）
  "tedori-keisan",              // 手取り計算 25,591/月（手取り20万 9,390・手取り30万 7,656 も同記事で受ける）
  "shitsugyo-hoken-keisan",     // 失業保険 計算 25,591/月（失業保険 自己都合 25,591・失業保険 期間 11,464 も同記事で受ける）
  "saishushoku-teate",          // 再就職手当 25,591/月
  "koyou-hoken-kanyu-joken",    // 雇用保険 加入条件 25,591/月
  "rishokuhyo",                 // 離職票 25,591/月（離職票 書き方 2,284・離職票 いつもらえる 1,226 も同記事で受ける）
  "sairyo-roudou",              // 裁量労働制 22,200/月（裁量労働制とは 5,400・残業代 1,600・職種 480・36協定 260・フレックス 210・休日出勤 140・半休 70 ＝クラスタ 30,370）
  "kyukei-jikan",               // 休憩時間 労働基準法 22,200/月（休憩時間 法律 12,100・休憩時間 9,900・6時間 6,600・8時間 880・5時間 480・法定 390・8時間以上 320 ＝クラスタ 52,870。「休憩時間 英語」1,300 は別意図なので除外）
  "kounenrei-koyou-keizoku",    // 高年齢雇用継続給付金 22,200/月（高年齢雇用継続給付 6,600・高年齢再就職給付金 1,600・高年齢雇用継続基本給付金 720・上限 480・とは 390・計算 260・高年齢雇用継続給付 計算 110・支給限度額 30・申請 20・いつまで 10 ＝クラスタ 32,420）
  "shugyo-kisoku",              // 就業規則 18,100/月（就業規則とは 4,400・変更届 3,600・届出 1,600・意見書 1,300・10人未満 1,300・絶対的記載事項 1,000・不利益変更 880・作成義務 320・周知 260 ＝クラスタ 32,760。「就業規則 英語」は別意図なので除外）
  "invoice-wakariyasuku",
  "shakai-hoken-kanyu-joken",
  "shakai-hokenryo-keisan",
  "taishokukin-zeikin",
  "hojinzei-ritsu",             // 法人税率 18,100/月（推移 590・実効税率 260・中小企業 210・日本 210・改正 110・国税庁 50・大企業 30・中小企業 実効税率 10 ＝クラスタ 19,570）
  "cash-flow-keisansho",        // キャッシュフロー計算書 18,100/月（作り方 2,400・間接法 1,300・とは 1,000・ひな形 720・見方 590・直接法 390・作り方 エクセル 210・cs 50 ＝クラスタ 24,760。英語 210 は除外）
  "shiyo-kikan",                // 試用期間とは 18,100/月（試用期間 解雇 14,800・試用期間 9,900・試用期間 退職 9,900・試用期間 クビ 4,400・試用期間中の解雇 1,600・試用期間 社会保険 1,600・試用期間 給料 1,000・試用期間 有給 880・試用期間 本採用拒否 320・試用期間 長さ 70 ＝クラスタ 62,570。「試用期間 英語」は別意図なので除外）
  "gensen-choshuhyo-mikata",    // 源泉徴収票 見方 17,131/月
  "sozokuzei-ikura",            // 相続税 いくらから 17,131/月
  "zoyozei-ikura",              // 贈与税 いくらから 17,131/月
  "henkei-roudou-jikan",        // 変形労働時間制 14,800/月（変形労働時間制とは 9,900・1ヶ月単位の変形労働時間制 2,400・1年単位の変形労働時間制 1,900・変形労働時間制 1ヶ月 1,900・変形労働制 1,600・残業 720・残業代 390・シフト制 違い 320・所定労働時間 170・労使協定 140・フレックスタイム制 違い 30 ＝クラスタ 34,270）
  "kaisha-setsuritsu",          // 会社設立 14,800/月（費用 3,600・税理士 2,900・流れ 2,400・必要書類 880・設立日 320・登記申請日 70 ＝クラスタ 24,970）
  "gensen-zeigakuhyo-mikata",   // 源泉徴収税額表 14,001/月
  "kaigo-kyugyo-kyufukin",      // 介護休業給付金 12,100/月（必要書類 1,300・支給申請書 720・対象者 720・添付書類 260・条件 260・申請 170・要件 90・上限 90・退職 20 ＝クラスタ 15,730）
  "kyugyo-teate",               // 休業手当 9,900/月（とは 2,400・条件 1,900・計算 1,300・会社都合 720・計算方法 390・休業補償 違い 390・期間 390・労働基準法 260 ＝クラスタ 17,650）
  "shinya-teate",               // 深夜手当 8,100/月（計算 3,600・何時から 590・いくら 320・とは 210・何時から何時まで 170・法律 170・計算方法 110／深夜割増 720・深夜労働 720 ＝クラスタ 14,710）
  "furikae-kyujitsu-daikyu",    // 振替休日 8,100/月（振替休日 代休 違い 5,400・代休 4,400・代休 振休 違い 590・振替休日 割増賃金 210・代休 時間単位 110・代休 いつまでに取得 90・代休 給与計算 70・代休 有給 違い 30 ＝クラスタ 19,000）
  "kaiko-yokoku-teate",         // 解雇予告手当 6,600/月（とは 2,400・計算方法 1,000・アルバイト 590・計算 480・所得税 480・退職所得 170・支払日 110・手当金 70・退職金 50／解雇予告 1,600・解雇予告通知書 1,600・解雇予告除外認定 720・30日 20 ＝クラスタ 15,890）
  "iryohi-kojo-ikura-kara",     // 医療費控除 いくらから 11,464/月（計算9,390・明細書7,656も同記事で受ける）
  "shussan-teate-kin",          // 出産手当金 11,464/月
  "shussan-ikuji-ichijikin",    // 出産育児一時金 11,464/月
  "koyou-hokenryo-ritsu",       // 雇用保険料率 11,464/月
  "kyuyo-shiharai-hokokusho",   // 給与支払報告書 18,100/月（書き方 3,600・総括表 2,400・提出先 1,300・eltax 1,300・提出期限 880・退職者 880・普通徴収 210 ＝副意図クラスタ 10,570）
  "shikaku-kakuninsho",         // 資格確認書・資格情報のお知らせ（資格確認書 165,000/月・資格確認書 いつ届く 22,200・資格情報のお知らせ 22,200）。法令上の名前は「資格情報通知書」（健保則51条の3）
  "kenko-shindan",              // 健康診断 会社 9,900/月（義務 4,400・費用 3,600・勘定科目 1,600・費用 会社負担 390 ＝クラスタ 19,890）
  "kanri-kantokusha",           // 管理監督者 4,400/月（とは 1,600・残業代 720・要件 390・定義 320・休日出勤 260・36協定 170・欠勤控除 170／名ばかり管理職 1,600 ＝クラスタ 9,630）
  "tsukin-saigai",              // 通勤災害 3,600/月（通勤労災 1,600・休業補償 880・様式 390・とは 170・寄り道 90・第三者行為 90・認定 50／通勤中の事故 720・労災 通勤中 1,000・通勤災害 16号の3 480・通勤中 事故 労災 210・業務災害 通勤災害 違い 70・通勤途中 怪我 労災 50・マイカー通勤 労災 30・給付 20 ＝クラスタ 9,450）
  "shakai-hokenryo-kojo",       // 社会保険料控除 9,390/月
  "shiharai-chosho",            // 支払調書 9,390/月
  "yukyu-fuyo-nissu",           // 有給休暇 付与日数 7,656/月
  "shobyo-teate-kin",           // 傷病手当金 6,260/月
  "roudousha-meibo",            // 労働者名簿 5,400/月（テンプレート 2,900・書き方 1,000・とは 720・記入例 720・必須項目 480・記載事項 110・様式 90・項目 40／法定三帳簿 590・法定三帳簿 エクセル 20 ＝クラスタ 12,070）
  "kashidaore-hikiatekin",      // 貸倒引当金 5,119/月
  "zuiji-kaitei",               // 随時改定・月額変更届 4,652/月
  "kotei-zangyodai",            // 固定残業代 4,188/月
  "kenko-hoken-nini-keizoku",   // 健康保険 任意継続 4,188/月
  "shunyu-inshi-warihan",       // 収入印紙 割印 4,188/月（収入印紙 貼り方 3,426・消印 676 も同記事で受ける）
  "taiyo-nensu",                // 減価償却 耐用年数 2,791/月（耐用年数表 1,861 も同記事で受ける）
  "tsukin-teate-hikazei",       // 通勤手当 非課税 2,791/月
  "yakuin-hoshu-kimekata",      // 役員報酬 決め方 2,284/月（事前確定届出給与 2,791・定期同額給与 1,015・変更タイミング 550 も同記事で受ける＝クラスタ 6,894）
  "kosaihi-kaigihi-chigai",     // 接待交際費 2,791/月（交際費 会議費 違い 1,523・会議費 交際費 676・交際費 損金不算入 676・交際費 上限 550・交際費 経費 250 も同記事で受ける＝クラスタ 約6,100）
  "shuzenhi-shihonteki-shishutsu", // 修繕費とは 1,523/月（資本的支出とは 550・修繕費 資本的支出 423・修繕費 60万円 72・資本的支出 減価償却 59・修繕費 20万円 38 も同記事で受ける＝クラスタ 2,669）
  "shutcho-nittou-ryohi-kitei",  // 出張手当 相場 1,226/月（出張旅費規程 550・出張 日当 423・日当 非課税 203・旅費規程 節税 110 も同記事で受ける＝クラスタ 2,512）
  "kessan-shoyo",               // ★2026-08-13 22時に計器を修正（旧値は月間推定検索数の42.3%だった）。
                               //   以下この行より上の数値コメントは**旧計器**の値なので、新しい候補と直接比べないこと。
                               //   決算賞与とは 6,600/月・決算賞与 4,400・要件 390・いつ 390・損金算入 260・社会保険料 170・税金 140 ＝クラスタ 12,350
  "kurikoshi-kessonkin",        // 繰越欠損金 3,600/月（期限 1,300・とは 720・何年 480・別表 110・利用制限 40 も同記事で受ける＝クラスタ 6,250）※修正後の計器の値
  "chinage-sokushin-zeisei",    // 所得拡大促進税制 12,100/月（★旧称のほうが新称の3.4倍多い）＋賃上げ促進税制 3,600・雇用者給与等支給額 480・賃上げ促進税制 中小企業 320・教育訓練費 税額控除 170 ＝クラスタ 16,670
  "chusho-keiei-kyoka-zeisei",  // 経営力向上計画 8,100/月 ＋ 中小企業経営強化税制 4,400・即時償却 1,900・経営力向上計画 認定 210・A類型 110 ＝クラスタ 14,720
  "jigyo-shokei-zeisei",  // 事業承継税制 6,600/月 ＋ 先端設備等導入計画は別・特例事業承継税制 480・事業承継税制 特例措置 140・非上場株式 納税猶予 110 ＝クラスタ 7,330
  "ikuji-jitan-kyufukin",  // 育児時短就業給付金 2,400/月（2025-04創設。育児 時短 給付金 50・時短勤務 手当 30 ＝クラスタ 2,480。自サイトの言及は ikuji-kyugyo-kyufukin の1回のみ＝実質未保有だった）
  "nenpousei",            // 年俸制 4,400/月（title/h1・本文とも自サイト保有0件を grep で実測。対照実験「賞与」105件で検索経路の生存を確認済み）
  "maebarai-hiyo",        // 前払費用 2,400/月 ＋ 短期前払費用 1,600・長期前払費用 1,600・前払費用 消費税 590・前払費用 仕訳 480・前払金 前払費用 違い 70 ＝クラスタ 6,740
  "sentan-setsubi-dounyu-keikaku", // 先端設備等導入計画 4,400/月 ＋「等」なしの別称 先端設備導入計画 880 ＝クラスタ 5,280
  "miharai-hiyo-miharaikin", // 買掛金 未払金 違い 2,900/月 ＋ 未払金 2,400・未払費用 1,300・未払金 仕訳 1,000・未払金 未払費用 違い 720・未払費用 仕訳 480・未払費用 未払金 違い 210・未払金 とは 50・未払費用 決算 50 ＝クラスタ 9,110
  "urikake-mishunyukin-mishushueki", // 売掛金 9,900/月 ＋ 未収入金 1,900・売掛金 仕訳 1,900・未収金 1,600・未収収益 590・売掛金 未収入金 違い 480・未収入金 仕訳 480・売掛金 とは 390・売掛金 未収金 違い 110・未収収益 仕訳 110・未収入金 とは 70・未収入金 未収収益 違い 40 ＝クラスタ 17,570
  "karibaraikin-kariukekin", // 仮払金 2,900/月 ＋ 控除対象外消費税 2,900・仮受金 1,900・仮払消費税 1,600・仮受消費税 1,000・仮払金 仕訳 720・仮受金 仕訳 260 ＝クラスタ 11,280
  "shueki-ninshiki-kijun", // 収益認識基準 4,400/月 ＋ 収益認識に関する会計基準 1,900・売上計上基準 880・検収基準 390・収益認識 5ステップ 210・出荷基準 210・収益認識基準 中小企業 110・売上 計上時期 90 ＝クラスタ 8,190
  "shokyaku-shisanzei", // 償却資産税 6,600/月 ＋ 償却資産税 計算 1,900・償却資産税 免税点 1,000・償却資産申告 880・固定資産税 償却資産 880・償却資産税 いくらから 90 ＝クラスタ 11,350
  "kifukin-kojo", // 寄付金控除 14,800/月 ＋ 寄付金 5,400・寄付金税額控除額 2,400・寄付金受領証明書 2,400・寄付金控除 上限 1,600・寄付金 勘定科目 720・寄付金 消費税 720・寄付金控除とは 480 ＝クラスタ 28,520（ふるさと納税向けの 寄付金控除 ふるさと納税 1,900 は /furusato/ が受けるので除外）
  "tanaoroshi-hyoka-hoho", // 移動平均法 4,400/月 ＋ 棚卸資産 3,600・総平均法 1,600・低価法 1,300・棚卸資産 評価方法 880・最終仕入原価法 880・棚卸 仕訳 480・棚卸資産 評価損 390・棚卸資産 とは 260 ＝クラスタ 13,790
  "furikomi-tesuryo-kanjo-kamoku", // 振込手数料 勘定科目 1,523/月
  "nenmatsu-chosei-itsumade",
  "denchoho-wakariyasuku",
  "kaigo-hokenryo-itsukara",
  "shogaku-genka-shokyaku",
  "nenshu-no-kabe",
  "shakai-hoken-fuyo-joken",
  "yukyu-kaitori",
  "juminzei-hikazei-border",     // 住民税非課税のボーダー（2026-08-05 新規）
  "juminzei-tokubetsu-choshu",
  "zangyodai-keisan",
  "invoice-2wari-tokurei",
  "fuyo-kojo-shinkokusho",
  "nenmatsu-chosei-kanpukin",
  "part-yukyu",
  "hoteichosho-goukeihyo",
  "kani-kazei",
  "shohizei-hasu-shori",
  "denchoho-kensaku-yoken",
  "hyojun-hoshu-gakuhyo",
  "shoyo-shakaihoken",
  "teiji-kettei",
  "kodomo-kosodate-shienkin",
  "yukyu-nen5ka",
  "eigyobi-kazoekata",
  "furikomi-tesuryo-hikaku",
  "senpou-futan-3hoshiki",
  "zengin-format-guide",
  "fukugyo-20man-kakutei-shinkoku", // 副業 確定申告 20万円
  "ai-keiri-hanjidoka",         // AIで経理を半自動化(E-E-A-T・実務経験)
  "hojokin-tokubetsu-kanjo",   // 補助金の特別勘定（法人税法43条）
  "hojokin-shiwake",           // 補助金の仕訳と計上時期
  "hojokin-shohizei",          // 補助金と消費税（不課税・仕入控除税額の返還）
  "assyuku-kicho-houshiki",    // 圧縮記帳の直接減額方式と積立金方式
  "hojokin-kojin-jigyonushi",  // 個人事業主の補助金（所得税法42条・43条）
  "hojokin-asshuku-gendogaku",         // 圧縮限度額は取得価額で頭打ち
  "hojokin-koteishisan-genka-shokyaku",// 圧縮後の減価償却
  "kyuyo-keisan-yarikata",             // 給与計算のやり方(ハブ)
  "kekkin-kojo-keisan",                // 欠勤控除の計算
  "tsukitochu-nyusha-taishoku-kyuyo",  // 月途中入社・退職の日割り
  "chingin-daicho",                    // 賃金台帳
  "kyuyo-keisan-machigai-teisei",      // 給与計算の訂正
  "rodo-hoken-nendo-koshin",           // 労働保険の年度更新
  "gensen-shotokuzei-noki-tokurei",    // 源泉所得税の納期の特例
  "shoyo-gensen-shotokuzei",           // 賞与の源泉所得税
  "shakai-hokenryo-choshu-jiki",       // 社会保険料の徴収時期
  "kyuyo-kojo-dekirumono",             // 給与から控除できるもの
  "hotei-fukurihi-keisan",             // 法定福利費の計算
  "kyushoku-shakai-hokenryo",          // 休職中の社会保険料
  "keiri-nenkan-schedule",             // 経理の年間スケジュール(ハブ)
];

/**
 * 一覧のカテゴリ。ここに無い記事は「その他」送り + 警告 + テスト失敗。
 * 記事を書いたら ORDER と CATEGORIES の**両方**に登録する(片方だけだと一覧で埋もれる)。
 * カテゴリ内の並びは ORDER(需要順)が効くので、slugs の順序は意味を持たない。
 */
const CATEGORIES = [
  {
    id: "shakai-hoken",
    name: "社会保険・年金",
    desc: "加入の条件、保険料の決まり方(標準報酬月額・定時決定・随時改定)、扶養と年収の壁。",
    slugs: [
      "shakai-hoken-kanyu-joken", "shakai-hokenryo-keisan", "hyojun-hoshu-gakuhyo",
      "teiji-kettei", "zuiji-kaitei", "sanzen-sango-kyugyo", "shoyo-shakaihoken", "kaigo-hokenryo-itsukara",
      "kodomo-kosodate-shienkin", "shakai-hoken-fuyo-joken", "nenshu-no-kabe",
      "koyou-hoken-kanyu-joken", "koyou-hokenryo-ritsu", "kenko-hoken-nini-keizoku",
      "shikaku-kakuninsho",
    ],
  },
  {
    id: "nenmatsu-gensen",
    name: "年末調整・源泉徴収・控除",
    desc: "年末調整の書類の書き方と期限、源泉徴収票・税額表の読み方、医療費控除・ふるさと納税など各種控除と確定申告。税務署へ出す法定調書合計表と、市区町村へ1月31日までに出す給与支払報告書（30万円以下で省略できるのは退職者だけ）の違いもここ。開業届と青色申告承認申請の期限もここ。",
    slugs: [
      "furusato-nozei-keisan", "kifukin-kojo",
      "nenmatsu-chosei-kakikata", "nenmatsu-chosei-itsumade", "nenmatsu-chosei-kanpukin",
      "fuyo-kojo-shinkokusho", "gensen-choshuhyo-mikata", "gensen-zeigakuhyo-mikata",
      "hoteichosho-goukeihyo", "kyuyo-shiharai-hokokusho", "shiharai-chosho", "shakai-hokenryo-kojo", "iryohi-kojo-ikura-kara",
      "taishokukin-zeikin", "fukugyo-20man-kakutei-shinkoku", "kaigyo-todoke",
    ],
  },
  {
    id: "sozoku-zoyo",
    name: "相続税・贈与税",
    desc: "相続税・贈与税がいくらからかかるか、基礎控除と速算表・早見表、非課税になるお金。",
    slugs: ["sozokuzei-ikura", "zoyozei-ikura"],
  },
  {
    id: "kyuyo",
    name: "給与計算・手取り",
    desc: "額面から手取りまでの引かれ方、残業代・通勤手当・住民税の実務と、36協定による労働時間の上限、フレックスタイム制の清算期間、1か月・1年・1週間の3つに分かれる変形労働時間制、裁量労働制のみなし時間、入社時に明示すべき労働条件、22時以降の深夜手当、会社都合で休ませたときの休業手当、予告なしで解雇するときの解雇予告手当、休日出勤の振替休日と代休の違い、6時間・8時間で切り替わる休憩時間の下限、常時10人以上で義務になる就業規則の作成・届出・周知、労働基準法に定めがなく会社が日数を決める忌引き休暇（慶弔休暇）と香典・祝金の経理、予告なしの解雇が14日までに限られる試用期間、深夜業を含む業務だと年2回になる健康診断の実施義務と費用負担・受診時間の賃金、割増賃金の単価から外せる賃金が7つの限定列挙であることと分割回数で報酬と賞与が入れ替わる年俸制。",
    slugs: [
      "tedori-keisan", "roudou-joken-tsuchisho", "36-kyotei", "flextime", "henkei-roudou-jikan", "sairyo-roudou", "zangyodai-keisan", "kotei-zangyodai", "shinya-teate", "kanri-kantokusha", "kenko-shindan", "kyugyo-teate", "kaiko-yokoku-teate", "furikae-kyujitsu-daikyu", "kyukei-jikan", "shugyo-kisoku", "kibiki-keicho-kyuka", "shiyo-kikan", "tsukin-teate-hikazei", "nenpousei",
      "juminzei-tokubetsu-choshu", "juminzei-hikazei-border",
    ],
  },
  {
    id: "kyufu",
    name: "健康保険・雇用保険・労災保険の給付",
    desc: "医療費が高額になったとき、病気・出産・育児・家族の介護で働けないとき、通勤中にケガをしたとき、失業したとき、60歳以後に賃金が下がった状態で働き続けるときに受け取れるお金。",
    slugs: [
      "kogaku-ryoyohi", "shobyo-teate-kin", "shussan-teate-kin", "shussan-ikuji-ichijikin",
      "ikuji-kyugyo-kyufukin", "ikuji-jitan-kyufukin", "kaigo-kyugyo-kyufukin", "tsukin-saigai", "shitsugyo-hoken-keisan",
      "saishushoku-teate", "rishokuhyo", "kounenrei-koyou-keizoku",
    ],
  },
  {
    id: "yukyu",
    name: "有給休暇",
    desc: "付与日数の数え方、年5日の取得義務、パート・アルバイトの比例付与と買い取り。",
    slugs: ["yukyu-fuyo-nissu", "yukyu-nen5ka", "part-yukyu", "yukyu-kaitori"],
  },
  {
    id: "shohizei",
    name: "消費税・インボイス",
    desc: "インボイス制度の基本と2割特例・簡易課税、消費税の端数処理。",
    slugs: ["invoice-wakariyasuku", "invoice-2wari-tokurei", "kani-kazei", "shohizei-hasu-shori"],
  },
  {
    id: "denchoho",
    name: "電子帳簿保存法",
    desc: "電子取引データの保存義務と、検索要件を満たす索引簿・ファイル名のつけ方。",
    slugs: ["denchoho-wakariyasuku", "denchoho-kensaku-yoken"],
  },
  {
    id: "keiri",
    name: "振込・支払の実務",
    desc: "振込手数料の比較と勘定科目、先方負担の差引方式、全銀フォーマット、営業日の数え方、収入印紙。",
    slugs: [
      "furikomi-tesuryo-hikaku", "furikomi-tesuryo-kanjo-kamoku", "senpou-futan-3hoshiki",
      "zengin-format-guide", "eigyobi-kazoekata", "shunyu-inshi-warihan",
    ],
  },
  {
    id: "kyuyo-jitsumu",
    name: "給与計算の実務（会社側）",
    desc: "毎月の給与計算の手順と、欠勤控除・日割り・賃金台帳・労働者名簿・訂正・社会保険料の徴収時期・法定福利費・年度更新。",
    slugs: [
      "kyuyo-keisan-yarikata", "kekkin-kojo-keisan", "tsukitochu-nyusha-taishoku-kyuyo",
      "chingin-daicho", "roudousha-meibo", "kyuyo-keisan-machigai-teisei", "kyuyo-kojo-dekirumono",
      "shakai-hokenryo-choshu-jiki", "kyushoku-shakai-hokenryo", "shoyo-gensen-shotokuzei",
      "gensen-shotokuzei-noki-tokurei", "hotei-fukurihi-keisan", "rodo-hoken-nendo-koshin",
      "keiri-nenkan-schedule",
    ],
  },
  {
    id: "hojokin-keiri",
    name: "補助金の経理・税務",
    desc: "補助金を受け取った後の処理。仕訳と計上時期、圧縮記帳と特別勘定（法人税法42〜44条）、消費税、個人事業主の場合。",
    slugs: [
      "hojokin-shiwake", "hojokin-tokubetsu-kanjo", "assyuku-kicho-houshiki",
      "hojokin-asshuku-gendogaku", "hojokin-koteishisan-genka-shokyaku", "hojokin-shohizei",
      "hojokin-kojin-jigyonushi",
    ],
  },
  {
    id: "kotei-shisan",
    name: "固定資産・減価償却",
    desc: "少額減価償却資産と一括償却、耐用年数の引き方、修繕費と資本的支出の判定、償却資産税。",
    slugs: [
      "shogaku-genka-shokyaku", "taiyo-nensu", "shuzenhi-shihonteki-shishutsu",
      "shokyaku-shisanzei",
    ],
  },
  {
    id: "hojinzei-kessan",
    name: "法人税・決算の実務",
    desc: "会社設立後の税務届出と法人税の税率、キャッシュフロー計算書、役員報酬・交際費・決算賞与・繰越欠損金・引当金・経過勘定と、賃上げ促進税制などの優遇措置。",
    slugs: [
      "kaisha-setsuritsu", "hojinzei-ritsu", "cash-flow-keisansho",
      "yakuin-hoshu-kimekata", "kosaihi-kaigihi-chigai", "shutcho-nittou-ryohi-kitei",
      "kessan-shoyo", "kurikoshi-kessonkin", "chinage-sokushin-zeisei",
      "chusho-keiei-kyoka-zeisei", "jigyo-shokei-zeisei", "sentan-setsubi-dounyu-keikaku",
      "kashidaore-hikiatekin", "shueki-ninshiki-kijun", "maebarai-hiyo",
      "miharai-hiyo-miharaikin", "urikake-mishunyukin-mishushueki", "tanaoroshi-hyoka-hoho",
      "karibaraikin-kariukekin", "ai-keiri-hanjidoka",
    ],
  },
];

/** sitemap に載せるツール・固定ページ(記事は自動で追加される) */
const STATIC_PAGES = [
  "", "tedori/", "bonus-tedori/", "genka/", "inshi/", "jidoshazei/", "kabe/", "iryohi/", "sozokuzei/", "zoyozei/", "jutaku/", "furusato/", "shobyo/", "shussan/", "ikuji/", "papa-ikukyu/", "juminzei/", "shakai-hoken/", "gensen-choshu/", "kihonteate/", "taishokukin/", "zangyodai/", "shohizei/", "eigyobi/",
  "yukyu/", "denchoho-index/", "senpou-futan/", "zengin-kana/", "shiharai-site/", "saitei-chingin/",
  "shokibo-kyosai/", "ideco-setsuzei/", "fuyo-kojo/", "haigusha-kojo/", "seimei-hoken-kojo/", "aoiro-kojo/", "tosan-boshi-kyosai/", "hitorioya-kojo/", "kinro-gakusei/", "seizen-zoyo/", "sozoku-toki-menkyozei/", "iryubun/", "shokibo-takuchi/", "jishin-hoken-kojo/", "hikazei-setai/", "fudosan-jouto/", "invoice-bangou/", "kotei-shisanzei/", "fudosan-shutoku/", "kokuho/", "nenkin/", "toroku-menkyozei/", "chukai-tesuryo/", "izoku/", "zaishoku/", "saishushoku/", "kogaku-ryoyohi/", "kokunen-menjo/", "yakuin-shataku/",
  // ★資産形成セクション（2026-08-08 新設）。column/ と並ぶ独立カテゴリ
  "toushi/", "toushi/tsumitate/", "toushi/ideco-deguchi/", "yotei-nozei/", "santei/", "hojinzei/", "hotei-fukuri/", "gensen-hyo/", "hojokin/", "hojokin/schedule/", "hojokin/koyou/", "hojokin-zeimu/",
  // "ext/amazon-receipt/" は 2026-08-03 に提供終了(ストア掲載削除済み)。ページごと削除したので載せない
  "column/", "about/", "privacy/", "contact/", "embed/",
  "nenshu/",
];

/** 年収別ページ（tools/gen_nenshu_pages.mjs が生成）。★固定リストにせず実体を走査する。
 *  刻みや範囲を変えたときに、ここを直し忘れて sitemap から漏れるのを防ぐ。 */
const NENSHU_PAGES = existsSync(join(DOCS, "nenshu"))
  ? readdirSync(join(DOCS, "nenshu"))
      .filter((n) => statSync(join(DOCS, "nenshu", n)).isDirectory()
        && existsSync(join(DOCS, "nenshu", n, "index.html")))
      .map((n) => `nenshu/${n}/`)
  : [];

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;");

const articles = [];
const skipped = [];
for (const slug of readdirSync(COLUMN)) {
  const f = join(COLUMN, slug, "index.html");
  if (!existsSync(f) || !statSync(join(COLUMN, slug)).isDirectory()) continue;
  // 書きかけ・公開してはいけない記事は .nopublish を置いて外す。
  // これが無いと、作業ツリーに残った記事(未コミット=本番に出ない)が sitemap と一覧に載り、
  // 404 へのリンクを公開してしまう(2026-07-13 第23便に実際に起きかけた)。
  if (existsSync(join(COLUMN, slug, ".nopublish"))) { skipped.push(slug); continue; }
  const html = readFileSync(f, "utf8");
  const title = strip(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const date = html.match(/"datePublished":\s*"(\d{4})-(\d{2})-(\d{2})"/);
  const desc = html.match(/<meta name="card-desc" content="([^"]*)"/)?.[1]
            ?? html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  if (!title || !date) {
    console.error(`✗ ${slug}: h1 か datePublished が読めない`);
    process.exit(1);
  }
  articles.push({ slug, title, desc, ymd: `${date[1]}.${date[2]}.${date[3]}`,
                  iso: `${date[1]}-${date[2]}-${date[3]}` });
}

articles.sort((a, b) => {
  const ia = ORDER.indexOf(a.slug), ib = ORDER.indexOf(b.slug);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return b.iso.localeCompare(a.iso);
});

// ---- sitemap.xml ----
// lastmod は「そのページが最後に変わった日」= gitのコミット日から採る。
// **生成日(今日)を全URLに押すと嘘になる**: 中身が変わっていない69本まで「今日更新した」と
// 名乗ることになり、Googleは lastmod が当てにならないと学習して**以後この値を無視する**
// (= 本当に更新した日を伝える手段を自分で捨てる)。
// 未コミット/未追跡のファイルだけは「今まさに変わっている」ので今日でよい(こちらも真)。
// ★末尾の改行だけ落とす。`.trim()` にすると status --porcelain の**1行目の先頭スペース**
//   (` M path` の状態カラム)まで削れ、**dirty一覧の先頭ファイルだけ** slice(3) が path を
//   1文字食う(`docs/…`→`ocs/…`)→照合が外れ lastmod が古いまま/新規ページなら丸ごと落ちる
//   (2026-07-17 第12便で実発生: 先頭の denchoho-index だけ lastmod が更新されなかった)。
const git = (...a) => {
  try { return execFileSync("git", a, { cwd: DOCS, encoding: "utf8" }).replace(/\s+$/, ""); }
  catch { return ""; }
};
const TODAY = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD
const root = git("rev-parse", "--show-toplevel");
// 作業ツリーで変更中のファイル(未追跡を含む)を1回で集める。git status の経路は root からの相対。
// ★`-uall` が要る: 既定の git status は**未追跡ディレクトリを1行に畳む**(`?? docs/juminzei/`)。
//   畳まれると dirty に入るのは**ディレクトリ**なので、`docs/juminzei/index.html` の照合が外れ、
//   git log にも履歴が無い(まだコミット前)ため **lastmod が丸ごと落ちる**。
//   = **新しく作ったページ**、つまり lastmod がいちばん要るページだけが黙って lastmod 無しで出る。
//   実際に /juminzei/ を lastmod 無しで本番へ出した(2026-07-14 第23便)。
const dirty = new Set(
  git("status", "--porcelain", "-uall", "--", DOCS).split("\n").filter(Boolean)
    .map((l) => l.slice(3).split(" -> ").pop().replace(/^"|"$/g, ""))
    .map((p) => join(root, p)),
);
const lastmodOf = (file) => {
  if (dirty.has(file)) return TODAY;
  return git("log", "-1", "--format=%cs", "--", file); // 履歴が無ければ "" → lastmod を出さない
};

const urls = [
  ...[...STATIC_PAGES, ...NENSHU_PAGES].map((p) => ({ loc: `https://keiri-tools.com/${p}`, file: join(DOCS, p, "index.html") })),
  ...articles.map((a) => ({ loc: `https://keiri-tools.com/column/${a.slug}/`,
                            file: join(COLUMN, a.slug, "index.html") })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, file }) => {
  const d = lastmodOf(file);
  return `  <url><loc>${loc}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`;
}).join("\n")}
</urlset>
`;

// ---- column/index.html の記事リスト(カテゴリ別セクション) ----
// CATEGORIES の記述ミス(存在しない記事・同じ記事を2つのカテゴリに登録)は黙って通すと
// 「一覧に2回出る」「カテゴリの件数が合わない」になる。ここで落とす。
{
  const seen = new Map();
  for (const c of CATEGORIES) {
    for (const s of c.slugs) {
      if (seen.has(s)) {
        console.error(`✗ CATEGORIES: ${s} が「${seen.get(s)}」と「${c.name}」に重複登録`);
        process.exit(1);
      }
      seen.set(s, c.name);
    }
  }
}

const catOf = new Map();
for (const c of CATEGORIES) for (const s of c.slugs) catOf.set(s, c.id);
const uncategorized = articles.filter((a) => !catOf.has(a.slug));

// 記事カード。data-s = 「タイトル＋説明文」を小文字化したもの(クライアント側の絞り込み用)。
// 検索はブラウザの中だけで完結する — 入力を外部に送らない(このサイトの売り)。
const card = (a, indent) => `${indent}<a href="${a.slug}/" data-s="${esc((a.title + " " + a.desc).toLowerCase())}">
${indent}  <div class="p-date">${a.ymd}</div>
${indent}  <div>
${indent}    <div class="p-title">${esc(a.title)}</div>
${indent}    <div class="p-desc">${esc(a.desc)}</div>
${indent}  </div>
${indent}</a>`;

// カテゴリ内の並びは articles(=ORDER=需要順)のまま。日付順にはしない。
const groups = CATEGORIES.map((c) => ({
  id: c.id, name: c.name, desc: c.desc,
  items: articles.filter((a) => catOf.get(a.slug) === c.id),
})).filter((g) => g.items.length > 0);
if (uncategorized.length) {
  groups.push({
    id: "sonota", name: "その他",
    desc: "カテゴリ未設定の記事(gen_index_sitemap.mjs の CATEGORIES に登録してください)。",
    items: uncategorized,
  });
}

const catNav = groups.map((g) =>
  `    <a href="#cat-${g.id}">${esc(g.name)}<span>(${g.items.length})</span></a>`).join("\n");

const sections = groups.map((g) => `  <section class="cat" id="cat-${g.id}" data-cat>
    <h2>${esc(g.name)}<span class="cat-n">(${g.items.length})</span></h2>
    <p class="cat-desc">${esc(g.desc)}</p>
    <div class="post-list">
${g.items.map((a) => card(a, "      ")).join("\n")}
    </div>
  </section>`).join("\n");

const colBlock = `  <nav class="cat-nav" id="cat-nav">
${catNav}
  </nav>

${sections}`;

const colPath = join(COLUMN, "index.html");
let col = readFileSync(colPath, "utf8");
const OPEN = "<!-- GEN:COLUMN-INDEX -->";
const CLOSE = "<!-- /GEN:COLUMN-INDEX -->";
const cOpen = col.indexOf(OPEN);
const cClose = col.indexOf(CLOSE);
if (cOpen === -1 || cClose === -1) {
  console.error(`✗ column/index.html に ${OPEN} … ${CLOSE} が見つからない`);
  process.exit(1);
}
col = col.slice(0, cOpen + OPEN.length) + "\n" + colBlock + "\n" + col.slice(cClose);

const write = (path, next, label) => {
  const prev = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (prev === next) return false;
  if (CHECK) {
    console.error(`✗ ${label} が古い。node tools/gen_index_sitemap.mjs を流すこと`);
    process.exit(1);
  }
  writeFileSync(path, next);
  console.log(`  更新: ${label}`);
  return true;
};

// ---- トップページの「コラム」欄(上位6本だけ) ----
// 手打ちにしておくと、記事が増えても**古い低需要の記事が居座り続ける**(実際にそうなっていた)
const topPath = join(DOCS, "index.html");
let top = readFileSync(topPath, "utf8");
const topCards = articles.slice(0, 6).map((a) => `    <a href="column/${a.slug}/">
      <div class="p-date">${a.ymd}</div>
      <div>
        <div class="p-title">${esc(a.title)}</div>
        <div class="p-desc">${esc(a.desc)}</div>
      </div>
    </a>`).join("\n");
const tOpen = top.indexOf(`<div class="post-list">`);
const tStart = top.indexOf(">", tOpen) + 1;
const tEnd = top.indexOf("</div>\n</main>", tStart);
if (tOpen === -1 || tEnd === -1) {
  console.error("✗ index.html の post-list ブロックが見つからない");
  process.exit(1);
}
top = top.slice(0, tStart) + "\n" + topCards + "\n  " + top.slice(tEnd);

const a = write(join(DOCS, "sitemap.xml"), sitemap, "sitemap.xml");
const b = write(colPath, col, "column/index.html");
const c = write(topPath, top, "index.html（トップの新着6本）");
// 黙って落とさない。外した記事は必ず名指しで報告する(「全部載った」と誤読させない)
for (const slug of skipped) console.log(`  ⚠️  除外(.nopublish): ${slug} — sitemap・一覧に載せていない`);

// 未分類は「その他」に落ちて誰にも探されない。名指しで警告する
// (ORDER と同じで、登録忘れは黙って通ると気づけない。test_article_structure.mjs が落とす)
for (const a of uncategorized) {
  console.error(`  ⚠️  未分類: ${a.slug} — CATEGORIES に登録していないので「その他」に入れた`);
}
if (uncategorized.length) {
  console.error(`  → tools/gen_index_sitemap.mjs の CATEGORIES に ${uncategorized.length}本を割り当てること`);
}

const counts = groups.map((g) => `${g.name} ${g.items.length}`).join(" / ");
console.log(`✓ 記事 ${articles.length}本${a || b || c ? "" : "（変更なし）"}  [${counts}]`);
