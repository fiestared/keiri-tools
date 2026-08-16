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
  "36-kyotei",                  // 36協定 74,000/月（特別条項 9,900・わかりやすく 4,400・三六協定 4,
  "chokai-shobun",              // 懲戒処分 74,000/月（懲戒処分とは 27,100・減給 22,200・譴責 18,100・懲戒解雇 14,800・戒告 9,900・諭旨解雇 8,100・けん責 4,400・出勤停止 1,600）★着手時に全285ページで「懲戒処分」がtitle/節/本文とも0ヒットの完全な空白だった。踏み込みは①労基法に「懲戒」の語は0回・使うのは「制裁」3回、逆に労契法は「懲戒」5回・「制裁」0回＝2法が同じ現象を別の語で呼ぶ ②戒告/譴責/出勤停止/降格/諭旨は両法とも0回＝法律が名前を出す懲戒処分は「減給」だけ ③91条の2上限のうち先に効くのは「1回＝平均賃金の半額」で、月給30万なら約4,891円・6回重ねても10分の1(30,000円)に届かない ④平均賃金の分母は暦日数なので同じ月給でも処分の時期で上限が動く(92日→4,891円 / 90日→5,000円) ⑤20条3項が19条2項を準用し、19条2項単体は「但書後段(天災事変)」のみなのに準用先は20条1項但書全体＝懲戒解雇にも除外認定が要る400・届出 1,900 も同記事で受ける）
  "kibiki-keicho-kyuka",        // 忌引き休暇 60,500/月（忌引き 49,500・忌引きとは 33,100・慶弔休暇 18,100・忌引き 何日 5,400・慶弔休暇とは 4,400・忌引き 祖父母 4,400・慶弔費 3,600・忌引き 証明書 2,400・忌引き 給料 2,400・慶弔見舞金 1,900・慶弔休暇 有給 260・慶弔休暇 日数 170・慶弔休暇 無給 50 ＝クラスタ 186,180。★別称の忌引き系3語だけで143,100＝慶弔系の5.5倍。引き継ぎ候補は「慶弔休暇 18,100」だったので頭の語を取り違えると1/3に見誤る）
  "nenmatsu-chosei-kakikata",   // 年末調整 書き方 57,105/月
  "sanzen-sango-kyugyo",        // 産休 いつから 49,500/月（産休 期間 5,400・産前産後休業 4,400・産休 社会保険料 免除 1,300・産後休業 210 ＝クラスタ 60,810。★自サイトは出産手当金＝給付の側だけを持っており、労働基準法65条（産前は請求制／産後は強制）を主題にした記事は無かった。shussan-teate-kin は労働基準法の言及が0回）
  "kaigyo-todoke",              // 開業届 40,500/月（開業届 個人事業主 33,100・必要なもの 4,400・書き方 4,400・e-tax 2,900・ダウンロード 2,400・出し方 1,300・オンライン 1,300・開業届とは 1,000・住所変更 590 ＝クラスタ 91,890）
  "angoshisan-zeikin",          // 仮想通貨 税金 18,100/月 ＋ ビットコイン 税金 8,100・暗号資産 税金 5,400・仮想通貨 確定申告 2,900・暗号資産 確定申告 1,900・仮想通貨 税率 1,300・ビットコイン 確定申告 1,300・仮想通貨 損益通算 390・仮想通貨 利益 税金 320・暗号資産 雑所得 210・暗号資産 総平均法 90・暗号資産 計算方法 30 ＝クラスタ 40,040（本記事がそのまま答えになる語だけを数えた。★NFT・ステーブルコイン・DeFi関連の語は本記事が明示的に fail-closed した領域なので算入していない）★着手時に全300ページで「暗号資産」が title/h2/本文とも0ヒット・「仮想通貨」は kinro-gakusei の3回のみ（別主題内の付随言及）。対照実験「控除」31ページ・「保険料」49ページで検索経路の生存を確認済み。踏み込みは①所得区分は雑所得で固定ではなく**収入金額300万円**で分岐（帳簿の保存あり＝原則事業所得／なし＝業務に係る雑所得。FAQ 2-2・令和7年12月更新）②**その300万円は利益ではなく売却総額**（所法35条2項2号で譲渡原価は必要経費側＝控除前の金額）＝利益20万でも500万売れば超える ③円に換えなくても課税（商品購入・暗号資産同士の交換。FAQ 1-3の設例で20万円の所得）④譲渡原価は総平均法/移動平均法で金額が変わる（FAQ 2-4 の設例で 3,106,000 vs 3,080,200＝差25,800円。独立に検算済み）⑤**届出しないと個人は総平均法・法人は移動平均法＝法定の初期値が逆**（所令119の5第1項 vs 法令118の6）⑥変更には承認申請＋**相当期間＝特別の理由がなければ3年**の縛り（FAQ 2-6注2）＝年末に有利な方を選び直せない ⑦**FXと分かれるのは措法41の14が「暗号等資産に係るものを除く」と名指ししているから**＝該当しないのではなく該当したうえで除外（市場デリバティブ・店頭デリバティブの両方のかっこ書きで実測）⑧損益通算も繰越もできない（所法69の限定4区分に雑所得が無く、所法2条1項25号の純損失の定義が69条1項の損失を参照するので70条にも乗らない＝条文の連鎖で確認）⑨**令和8年法律第64号（金商法・資金決済法改正・2026-08-12施行）を経ても41の14は変わっていない**＝現行版と令和9年7月22日施行予定版の条文MD5が一致（0bfbb99514496318b868d8dc02250ba8・2,834文字）。措法内のキーワード検索でも本則3件は全て除外のかっこ書き ⑩同改正で用語が「暗号資産」→「暗号等資産」に変わり附則には旧語が残る ⑪一時的に必要な暗号資産の取得は平均単価に含めない（所令119の2第2項）⑫分裂で得た暗号資産の取得価額は0円 ⑬取得価額不明なら売却価額の5%（500万円→25万円）⑭**消費税は非課税かつ課税売上割合の分母にも含めなくてよい**（FAQ 6-1）＝「非課税だから分母に入る」の例外 ⑮**贈与・遺贈した側にも所得税**（時価を総収入金額に算入。FAQ 4-1注）⑯信用取引の譲渡原価は個別法 ⑰非居住者は申告不要・源泉徴収もなし ⑱**No.1524（令和7年4月1日現在）が案内する先のFAQ（令和7年12月最終改訂）の方が新しい**＝公的資料でも基準日は揃わない
  "kogaku-ryoyohi",             // 高額療養費制度 38,281/月（限度額適用認定証 31,302 も同記事で受ける）
  "flextime",                   // フレックスタイム制 33,100/月（フレックスタイム制とは 12,100・デメリット 1,600・フレックスタイム制度 880・コアタイム 720・残業 720・労使協定 390・メリット 320・フレックスタイム制度とは 210・法定労働時間 90 ＝クラスタ 50,130）
  "ikuji-kyugyo-kyufukin",      // 育児休業給付金 31,302/月
  "roudou-joken-tsuchisho",     // 雇用契約書 27,100/月（労働条件通知書 22,200・雇用契約書 ない 4,400・労働条件通知書とは 3,600・雇用契約書とは 2,900 ほかクラスタ計 64,670 も同記事で受ける）
  "chutaikyo",                  // 中退共 27,100/月（中小企業退職金共済 12,100・中退共 掛金 2,400・中退共 退職金 計算 1,900・中小企業退職金共済 掛金 320・中退共 デメリット 140 ＝クラスタ 43,960。★「中退共」「中小企業退職金共済」とも全285ページで0ヒットの完全な空白だった（/shokibo-kyosai/ と /tosan-boshi-kyosai/ ＝経営者側の共済は持っていたのに、従業員側の退職金制度だけ無かった）。踏み込みは①12月未満は不支給・23月以下は「掛金総額を下回る額」と法10条2項1号が明記＝元本割れは運用結果ではなく制度設計 ②ただし死亡退職は同号かっこ書きで掛金総額相当額＝元本割れしない ③解約手当金は法16条1項で「被共済者に」支給＝事業主に戻る経路が条文上存在しない ④所得税法施行令72条3項2号は法10条1項等を列挙するが16条の解約手当金は入っていない（対して小規模企業共済は同項3号ロ・ハで解約手当金を明示列挙）
  "tedori-keisan",              // 手取り計算 25,591/月（手取り20万 9,390・手取り30万 7,656 も同記事で受ける）
  "shitsugyo-hoken-keisan",     // 失業保険 計算 25,591/月（失業保険 自己都合 25,591・失業保険 期間 11,464 も同記事で受ける）
  "saishushoku-teate",          // 再就職手当 25,591/月
  "koyou-hoken-kanyu-joken",    // 雇用保険 加入条件 25,591/月
  "rishokuhyo",                 // 離職票 25,591/月（離職票 書き方 2,284・離職票 いつもらえる 1,226 も同記事で受ける）
  "sairyo-roudou",              // 裁量労働制 22,200/月（裁量労働制とは 5,400・残業代 1,600・職種 480・36協定 260・フレックス 210・休日出勤 140・半休 70 ＝クラスタ 30,370）
  "kyukei-jikan",               // 休憩時間 労働基準法 22,200/月（休憩時間 法律 12,100・休憩時間 9,900・6時間 6,600・8時間 880・5時間 480・法定 390・8時間以上 320 ＝クラスタ 52,870。「休憩時間 英語」1,300 は別意図なので除外）
  "kounenrei-koyou-keizoku",    // 高年齢雇用継続給付金 22,200/月（高年齢雇用継続給付 6,600・高年齢再就職給付金 1,600・高年齢雇用継続基本給付金 720・上限 480・とは 390・計算 260・高年齢雇用継続給付 計算 110・支給限度額 30・申請 20・いつまで 10 ＝クラスタ 32,420）
  "kango-kaigo-kyuka",          // 介護休暇 18,100/月（看護休暇 12,100・子の看護休暇 8,100・介護休暇 条件 6,600・介護休暇 介護休業 違い 1,300・介護休暇 日数 390・介護休暇 有給 260・子の看護休暇 有給 260・介護休暇 給料 140 ＝クラスタ 47,250。★「介護休暇」「看護休暇」とも全286ページで0ヒットの空白だった（/column/kaigo-kyugyo-kyufukin/ ＝介護休"業"給付金は持っていたのに、年5日の介護休"暇"は無かった＝1文字違いの別制度が丸ごと抜けていた）。★令和7年4月に法律上の名称が「子の看護休暇」→「子の看護等休暇」へ変わり、連続文字列「看護休暇」が新名称に含まれなくなった＝需要のある旧名も本文に置く必要がある。踏み込みは①賃金の定めが条文に無い（労基法39条9項が年休について明文で置いているのと対照）＝無給でも違法ではない ②令和7年4月改正の実体は準用条文へのかっこ書き14文字「（第二号に係る部分に限る。）」の挿入と読み替え25文字の削除で、勤続6か月未満の除外が根拠を失った ③時間単位の1日の時間数は所定労働時間の1時間未満切り上げ＝7時間30分の人は8時間×5＝40時間 ④法16条の2第2項の「省令で定めるもの」を規則が一度も定めていない＝時間単位から除外される労働者は0人 ⑤規則33条の2は法の「行事」を「式典」に絞っている ⑥拒否に罰則は無く、勧告→企業名公表（法56条の2）
  "shugyo-kisoku",              // 就業規則 18,100/月（就業規則とは 4,400・変更届 3,600・届出 1,600・意見書 1,300・10人未満 1,300・絶対的記載事項 1,000・不利益変更 880・作成義務 320・周知 260 ＝クラスタ 32,760。「就業規則 英語」は別意図なので除外）
  "invoice-wakariyasuku",
  "shakai-hoken-kanyu-joken",
  "shakai-hokenryo-keisan",
  "taishokukin-zeikin",
  "hojinzei-ritsu",             // 法人税率 18,100/月（推移 590・実効税率 260・中小企業 210・日本 210・改正 110・国税庁 50・大企業 30・中小企業 実効税率 10 ＝クラスタ 19,570）
  "cash-flow-keisansho",        // キャッシュフロー計算書 18,100/月（作り方 2,400・間接法 1,300・とは 1,000・ひな形 720・見方 590・直接法 390・作り方 エクセル 210・cs 50 ＝クラスタ 24,760。英語 210 は除外）
  "shiyo-kikan",                // 試用期間とは 18,100/月（試用期間 解雇 14,800・試用期間 9,900・試用期間 退職 9,900・試用期間 クビ 4,400・試用期間中の解雇 1,600・試用期間 社会保険 1,600・試用期間 給料 1,000・試用期間 有給 880・試用期間 本採用拒否 320・試用期間 長さ 70 ＝クラスタ 62,570。「試用期間 英語」は別意図なので除外）
  "tokutei-shinzoku-tokubetsu-kojo", // 特定親族特別控除 18,100/月（特定扶養親族 5,400 ＝クラスタ 23,500。★受け皿の /fuyo-kojo/ ツールは「段階的な控除額はこのツールでは計算していません」と自分で明言しており、記事も無かった＝片肺。所得税法84条の2の9段階を条文から導出したのがこの記事）
  "gensen-choshuhyo-mikata",    // 源泉徴収票 見方 17,131/月
  "sozokuzei-ikura",            // 相続税 いくらから 17,131/月
  "zoyozei-ikura",              // 贈与税 いくらから 17,131/月
  "henkei-roudou-jikan",        // 変形労働時間制 14,800/月（変形労働時間制とは 9,900・1ヶ月単位の変形労働時間制 2,400・1年単位の変形労働時間制 1,900・変形労働時間制 1ヶ月 1,900・変形労働制 1,600・残業 720・残業代 390・シフト制 違い 320・所定労働時間 170・労使協定 140・フレックスタイム制 違い 30 ＝クラスタ 34,270）
  "kaisha-setsuritsu",          // 会社設立 14,800/月（費用 3,600・税理士 2,900・流れ 2,400・必要書類 880・設立日 320・登記申請日 70 ＝クラスタ 24,970）
  "gensen-zeigakuhyo-mikata",   // 源泉徴収税額表 14,001/月
  "kaigo-kyugyo-kyufukin",      // 介護休業給付金 12,100/月（必要書類 1,300・支給申請書 720・対象者 720・添付書類 260・条件 260・申請 170・要件 90・上限 90・退職 20 ＝クラスタ 15,730）
  "kyugyo-teate",               // 休業手当 9,900/月（とは 2,400・条件 1,900・計算 1,300・会社都合 720・計算方法 390・休業補償 違い 390・期間 390・労働基準法 260 ＝クラスタ 17,650）
  "yakuin-taishokukin",         // 役員退職金 4,400/月（役員退職慰労金 1,000・役員退職金 税金 880・計算 720・相場 480・功績倍率 390・損金 260 ＝クラスタ 8,130）★着手時に全302ページで「役員退職金」が title/h1h2 とも0ヒット・本文も taishokukin-zeikin のFAQ1問のみ（受け取る個人側の記事で、法人側の損金算入は扱っていない）。対照実験「控除」31ページ・「保険料」49ページで検索経路の生存を確認済み。踏み込みは①**役員退職金は34条1項の3類型の外**（1項柱書のかっこ書きが「退職給与で業績連動給与に該当しないもの」を除いている）＝効くのは34条2項だけで、否認されても全額ではなく「不相当に高額な部分」だけ ②**施行令70条2号が名指しする判断要素は3つ**（業務に従事した期間・退職の事情・同種で事業規模が類似する法人の支給状況）で、**実務が使う「最終報酬月額」は名指しされていない**（末尾が「等に照らし」なので限定列挙ではない点も明記）③**「功績倍率」「功績」「最終報酬」「分掌変更」は法人税法・法人税法施行令の全文で0回**（両法令をe-Gov API v2で全文取得して計数。「退職給与」は法55回・令151回あるのに、額を算定する語だけが0回）④**「功績倍率」が現れるのは法人税基本通達9-2-27の3だけ**（第9章第2節の全8款を取得して計数＝第7款の本文と(注)の2回のみ）で、その役割は算定基準を与えることではなく**業績連動給与に該当しないと確認すること**。同族会社は34条1項3号柱書のかっこ書きで入口から外れ有価証券報告書も出さないので、業績連動給与に分類されると全額損金不算入になりうる ⑤**第6款「過大な役員給与の額」(9-2-21〜27)は施行令70条の1号イ1回・1号ロ3回・3号1回を引くだけで2号を一度も引いていない**＝退職給与の過大性の基準を示した箇条がその款に無い ⑥**損金算入時期は決議日が原則・支払日＋損金経理も可**（9-2-28）だが**取締役会の内定額を未払金計上しても不可**（国税庁No.5208注1）。退職年金は逆に支給すべき時（9-2-29）⑦**分掌変更(9-2-32)は「おおむね50%以上の減少」を満たしても経営上主要な地位を占める者は(1)(2)(3)すべてのかっこ書きで除かれる**・**未払金計上は原則として退職給与に含まれない**（(注)。「原則として」の例外は通達の文面から特定できないのでfail-closedで明記）⑧**使用人兼務役員は区分支給しても合計額で判定**（9-2-30）・企業年金からの給付も勘案（9-2-31）⑨**受け取る側は役員等勤続5年以下だと2分の1が一切使えない**（所法30条2項・5項の特定役員退職手当等）。従業員の短期退職手当等との差は**残額300万円超でちょうど150万円に頭打ち**（30条2項2号の式 150万+(収入-(300万+控除)) が 残額-150万 に整理できることから導出。数値でも検算済み）
  "shinya-teate",               // 深夜手当 8,100/月（計算 3,600・何時から 590・いくら 320・とは 210・何時から何時まで 170・法律 170・計算方法 110／深夜割増 720・深夜労働 720 ＝クラスタ 14,710）
  "furikae-kyujitsu-daikyu",    // 振替休日 8,100/月（振替休日 代休 違い 5,400・代休 4,400・代休 振休 違い 590・振替休日 割増賃金 210・代休 時間単位 110・代休 いつまでに取得 90・代休 給与計算 70・代休 有給 違い 30 ＝クラスタ 19,000）
  "kaiko-yokoku-teate",         // 解雇予告手当 6,600/月（とは 2,400・計算方法 1,000・アルバイト 590・計算 480・所得税 480・退職所得 170・支払日 110・手当金 70・退職金 50／解雇予告 1,600・解雇予告通知書 1,600・解雇予告除外認定 720・30日 20 ＝クラスタ 15,890）
  "iryohi-kojo-ikura-kara",     // 医療費控除 いくらから 11,464/月（計算9,390・明細書7,656も同記事で受ける）
  "shussan-teate-kin",          // 出産手当金 11,464/月
  "shussan-ikuji-ichijikin",    // 出産育児一時金 11,464/月
  "koyou-hokenryo-ritsu",       // 雇用保険料率 11,464/月
  "yotei-nozei-toha",           // 予定納税 11,840/月（減額申請 1,040・払えない 312・予定納税基準額 256 ＝クラスタ 13,448）。基準額は譲渡・一時・雑・臨時所得を除いて作る（所法104条1項1号）
  "rosai-hokenryoritsu",        // 労災保険料率 5,400/月（労災保険料 2,400・労災保険率 390 ＝クラスタ 8,190）。法令上の名前は「労災保険率」で"料"が入らない
  "doitsu-rodo-doitsu-chingin", // 同一労働同一賃金 11,840/月（同一労働同一賃金とは 1,040・パートタイム有期雇用労働法 1,040・不合理な待遇差 56 ＝クラスタ 13,976）。8条=不合理な待遇の禁止／9条=差別的取扱いの禁止で別物。18条2項の公表対象列挙に8条は入っていない。令和8年10月1日から則2条1項の特定事項が4→5（新4号=法14条2項の説明を求められる旨）
  "kasuhara",                   // カスハラ 32,400/月（カスタマーハラスメント 26,480・カスハラ 対策 1,920・カスハラ 定義 800・カスハラ 義務化 704・カスタマーハラスメント 定義 384・カスタマーハラスメント 義務化 72 ＝クラスタ 62,760）。令和8年10月1日施行＝執筆時点は未施行。新設33条1項が措置義務／パワハラの30条の2は同日に31条へ番号だけ変わる（本文はハッシュ一致）。中小の猶予は無い（附則に「中小」0回）。義務違反に罰則は無く、45条1項の報告懈怠が51条の過料20万円
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
  "muki-tenkan",          // 無期転換ルール 2,400/月（無期転換 1,900・5年ルール 1,000・無期転換申込権 590 ＝主題クラスタ 5,890。周辺に 契約社員 14,800・無期雇用 3,600・有期雇用 2,400・雇止め 1,900 があるが、これらは本記事より広いクエリなので受け皿として過大に見積もらないこと）★着手時に全295ページで「無期転換」が title/h2 とも0ヒット（本文の言及は roudou-joken-tsuchisho と career-up-joseikin の2本だけで、どちらも別主題の中の参照）。踏み込みは①18条1項は「承諾したものとみなす」＝会社に拒否権が条文上ない（19条には合理性判断があるのと対照）②通算の起点は平成24年法律56号の附則2項により「施行の日以後の日を契約期間の初日とする」契約だけ＝2013-03-01開始の1年契約は11か月が施行日後でも丸ごと入らない（基準は初日であって期間の重なりではない）③クーリングの「6か月」は直前の契約が1年以上の場合で、1年未満は省令2条により2分の1＋端数1か月切り上げ＝3か月契約は1.5か月ではなく2か月 ④18条2項は連続する複数契約を合算してから判定＝6か月契約を空白なしで2回の後は12か月扱いで必要な空白は6か月 ⑤18条1項後段により転換後の労働条件は「契約期間を除き同一」＝正社員化ではない ⑥有期特措法の特例（第一種10年・第二種の定年後不算入）はどちらも厚労大臣の認定が要る＝認定が無ければ定年後再雇用にも通常どおり申込権が発生する（8条2項の対象は7条1項が定義する「第二種認定事業主」に限られる）
  "shusei-shinkoku-kosei-seikyu", // 更正の請求 8,100/月 ＋ 修正申告 6,600・延滞税 5,400・無申告加算税 4,400・重加算税 3,600・過少申告加算税 2,900・加算税 1,300 ＝主題クラスタ 32,300（いずれも「申告を間違えたときどうするか」に対して本記事がそのまま答えになる語だけを数えた。「確定申告」のような本記事より広いクエリは足していない）★着手時に全296ページで「修正申告」「更正の請求」「延滞税」「加算税」が title/h2 とも0ヒット（本文の言及は yotei-nozei-toha の延滞税14回など別主題の中の参照のみ）。踏み込みは①19条には期限の定めが無く23条1項だけが「五年以内に限り」＝直す向きで期限が非対称 ②65条は0%/5%/10%の3段だが3段目（調査通知前は課さない）は1項でも括弧書きでもなく6項に置かれている ③65条2項の閾値は50万円ではなく「期限内申告税額と50万円のいずれか多い金額」＝期限内申告税額300万・増差200万なら加算はゼロ（50万閾値だと27.5万と誤る） ④66条3項は「区分して」＝累進のブラケットで300万超30%は全体にかからない（500万で117.5万 vs 全体30%だと150万）・事前通知後予知前は各段5%引きの10/15/25% ⑤68条は「代え」であって上乗せではない・かつ隠蔽仮装だと61条1項の期間控除が使えず70条5項で7年になる ⑥延滞税は令和8年に5年ぶりに改定され2.4%→2.8%／8.7%→9.1%（還付加算金も0.9%→1.3%。3つの数字から平均貸付割合0.8%が独立に検算できる） ⑦61条1項1号の1年ルール＝令和3年分を令和8年に直しても延滞税は24,000円で、控除が無い場合の94,300円の約4分の1 ⑧118条3項・119条4項により増差1万円未満・加算税5,000円未満・延滞税1,000円未満は課されない ⑨35条2項1号により修正申告の納期限は提出日＝提出日に納付すれば全期間が低い方の割合
  "lease-torihiki-zeimu", // オペレーティングリース 6,600/月 ＋ ファイナンスリース 4,400・リース資産 1,600・所有権移転外ファイナンスリース 1,300・リース 減価償却 480・リース取引 390・リース期間定額法 390 ＝クラスタ 15,160（本記事がそのまま答えになる語だけを数えた。★「リース 49,500」は最大だが**カーリース等の消費者向け役務の別意図が混ざる**ため算入していない＝「不良債権 3,520」を外したのと同じ理由。★「リース会計基準 3,600」「新リース会計基準 210」「リース 消費税 260」「リース 仕訳 390」「リース 会計処理 260」は**本記事が明示的に fail-closed した領域**（企業会計基準第34号・消費税・会計上の仕訳）なので算入していない＝答えていない語をクラスタに数えない）★着手時に全299ページで「リース」が title 0/h2 0・本文9（chusho-keiei-kyoka-zeisei のFAQ1問など付随的言及のみ）、「減損」「償却債権」は 0/0/0。踏み込みは①法法64条の2第1項でリース取引は「引渡しの時に売買があつたものとして」所得計算＝契約書の題名は要件でない ②要件は2つだけ（中途解約不能／フルペイアウト）③**「おおむね90%」は2か所にあり分母が違う**＝フルペイアウトは令131条の2第2項で「取得のために通常要する価額」の90%、中途解約不能の「準ずるもの」は No.5702 で「未経過期間に対応するリース料の合計額」の90% ④所有権移転外の除外要件は**政令が4つ・国税庁 No.5704 は6つ**＝差分（名目的な再リース／金融機関の資金引受構造）は政令の「これらに準ずるものを含む」を具体化したもの ⑤令131条の2第3項「賃借料……として損金経理をした金額は、償却費として損金経理をした金額に含まれる」＝科目名を付け替えなくてよい ⑥**所有権移転外リース資産には圧縮記帳・特別償却・少額減価償却資産（令133）・一括償却資産（令133の2）の適用が無い**（No.5704 が4つを名指し）＝「小さい金額なら即時損金」と逆 ⑦「耐用年数に比して相当短い」は**70%（10年以上は60%）・1年未満切捨て**（No.5704）＝6年なら4年・10年なら6年が境目 ⑧**令和7年度改正の2点を令和6年4月版との版比較で実証**＝(a)割安購入選択権が「著しく有利な価額で買い取る権利が与えられている」→「買い取る権利が与えられており、かつ……行使されることが確実であると見込まれる」へ＝判定軸が価額から行使可能性へ移り有利な価額は「その他の事情」の一例に降格 (b)残価保証額の控除に「契約が令和九年三月三十一日以前に締結されたもの」の限定が付いた（令和6年4月版には無い）＝**令和9年4月1日以後締結分は控除なし**・令48条の2第1項6号と第4項の2か所とも同じ限定で揃っている ⑨オペレーティング・リースは No.5705 で**令和7年4月1日以後開始事業年度**から債務確定基準で損金算入・付随費用を含む ⑩セール・アンド・リースバックは「実質的に金銭の貸借」と認められるときだけ売買がなかったものとされる＝必ずではない ⑪土地は二重否定の作りで、無償/名目的対価の譲渡・著しく有利な買取権のどちらかに当たると除外リストから外れる ⑫所法67条の2が法法64条の2とほぼ同一文言（主語と所得の単位だけ違う）
  "jigyoshozei",          // 事業所税 4,400/月 ＋ 事業所税 免税点 210・事業所税 計算 90・事業所税 申告 90・事業所税 とは 50 ＝クラスタ 4,840（本記事がそのまま答えになる語だけを数えた）★着手時に全301ページで「事業所税」が title/h2 とも0ヒット・本文も shogaku-genka-shokyaku の1回のみ（国税庁No.5400の列挙を引いた付随言及）。対照実験「控除」31ページ・「保険料」49ページで検索経路の生存を確認済み。踏み込みは①**課税団体が条文で限定**されている（701条の30。指定都市等＝政令指定都市20市／既成市街地を有する市／施行令56条の15の46市／東京23区）＝全国どこでもかかる税ではない ②**免税点1,000㎡・100人は「基礎控除」ではなく崖**（701条の43は「千平方メートル以下である場合には……課することができない」と書くのみで控除規定が無い。事業所税の節42条を通して「千平方メートル」は701条の43にしか現れないことを機械的に確認）＝1,000㎡なら0円・1,001㎡なら600,600円 ③**判定は事業所ごとではなく同一指定都市等の区域内の合計**（701条の43第1項）④**東京23区は23区全体で1つの区域とみなす**（737条3項）＝港区700㎡＋新宿区400㎡は課税だが横浜市700㎡＋川崎市400㎡は非課税 ⑤**従業者の定義が免税点にも及ぶ**（701条の31第1項第5号の括弧書きが「以下この号及び第七百一条の四十三において同じ」と明記）＝役員は含み**65歳以上（役員を除く）と政令で定める障害者は除く**ので110人でも判定上98人なら従業者割は課されない ⑥**新設と廃止で月割の起算が非対称**（新設は翌月から・廃止はその月まで。701条の40第2項）⑦**税額ゼロでも条例で申告書を求められうる**（701条の46第3項・701条の47第3項）⑧**事業所用家屋を貸している側にも申告義務**（701条の52第2項）⑨**「新増設に係る事業所税」は平成15年法律第9号により2003-04-01に廃止済み**＝地方税法の全文で本則0回・附則117回（本則901,619字／附則1,449,715字を分離して計数）。**なお国税庁タックスアンサー No.5400 は2026-08-16時点でも「(2) 新増設に係る事業所税」を列挙したまま**＝公的資料でも基準日と現行条文は別に確かめる必要がある
  "nenpousei",            // 年俸制 4,400/月（title/h1・本文とも自サイト保有0件をgrep で実測。対照実験「賞与」105件で検索経路の生存を確認済み）
  "kurinobe-shisan",      // 繰延資産 4,400/月 ＋ 開業費 2,400・開業費 個人事業主 1,000・開業費 償却 880・開業費 仕訳 720・繰延資産 償却 720・創立費 720・社債発行費 390・任意償却 320・株式交付費 320・創立費 開業費 違い 110 ＝クラスタ 11,980（本記事がそのまま答えになる語だけを数えた。「開発費 590」は software 開発費など別意図が混ざるため算入していない）★着手時に全297ページで「繰延資産」「開業費」「創立費」が title/h2 とも0ヒット（本文の言及は kurikoshi-kessonkin が法人税法58条1項を引用する中の1回のみ＝別主題）。踏み込みは①令14条1項の6つの号は「1〜5号」と「6号」に割れ、割っているのは範囲を定める14条ではなく償却限度額を定める64条1項＝グループAは限度額が「その繰延資産の額」＝任意償却、グループBは月数按分の均等償却 ②任意償却の要件が法人と個人で違う。法人は法法32条1項の「損金経理」（帳簿）、個人は所令137条3項の「確定申告書に記載した場合」（申告書）＝動かす場所が別 ③個人には創立費・株式交付費・社債等発行費が存在しない（所令7条1項は開業費・開発費・3号の3つだけ）・開業費の定義も法人は「設立後」で始期が区切られるが個人にはその限定が無い ④20万円未満の特例（令134条・所令139条の2）は6号／3号だけが対象でグループAには適用が無い・かつ法人は損金経理要件があるが個人の139条の2には無い ⑤同じ20万円でも減価償却資産なら令133条の2の一括償却資産＝36で除して按分＝結果が逆（繰延資産は即時、減価償却資産は3年）・即時は10万円未満（令133条） ⑥礼金は繰延資産だが仲介手数料は通達8-1-5注で支払時に全額損金＝同じ請求書で扱いが割れる ⑦8-2-3注2は償却期間の1年未満を切り捨て、令64条4項は月数の1月未満を切り上げ＝同じ計算の中で丸めの向きが逆 ⑧5年償却でも期中支出なら6事業年度にまたがる ⑨法基通8章は第1節・第2節を通じて「開業費」の語が0回＝通達に解釈が無く条文の「特別に支出する」だけが手がかり
  "kashidaore-sonshitsu", // 貸倒損失 2,880/月 ＋ 債権放棄 1,920・貸倒れ 800・備忘価額 704・貸倒損失 消費税 312・貸倒損失 仕訳 256・貸倒損失 要件 168・貸倒損失 計上時期 112・貸倒処理 72・貸倒損失 法人税 56・売掛金 貸倒 24・売掛金 未回収 処理 16・貸倒損失 個人事業主 8・回収不能 売掛金 8 ＝クラスタ 7,336（本記事がそのまま答えになる語だけを数えた。「不良債権 3,520」は銀行・マクロ経済の別意図が混ざるため算入していない。「貸倒 消費税 控除」は keyword_demand が `-`＝欠測を返したので 0 として扱わず除外）★着手時に全298ページで「貸倒損失」が title 0/h2 1・「債権放棄」「償却債権」が 0/0/0。唯一の h2 保有は kashidaore-hikiatekin の「貸倒引当金と貸倒損失は別物」節で、同ページに 9-6-1/9-6-2/9-6-3 は 0 回・消費税は 0 回＝要件そのものは空白だった。踏み込みは①3か条の語尾が違う＝9-6-1「損金の額に算入する」（損金経理は要件でない・事業年度が指定されている＝選べない）／9-6-2「損金経理をすることができる」／9-6-3「損金経理をしたときは、これを認める」②9-6-3の対象は売掛債権だけで「貸付金その他これに準ずる債権を含まない」と明文で除外・備忘価額を残す要件も9-6-3だけ③9-6-2は「全額」なので一部回収不能は対象外④担保の扱いが9-6-2（処分した後でなければ）と9-6-3(1)（担保物のある場合を除く）で違う⑤9-6-3(1)の1年は取引停止日ではなく最後の弁済期・最後の弁済の時のうち最も遅い時から起算・(注)で「継続的な取引」に限られ不動産取引のようにたまたまの取引には適用がない⑥消費税は別系統（消法39条・消令59条・消規18条）で控除は税込×110分の7.8（軽減108分の6.24）＝税込330,000円なら23,400円で30,000円は戻らない（差6,600＝300,000×2.2%）⑦消費税だけ免税事業者除外・書類保存が適用要件（39条2項）・回収したら課税標準額に対する消費税額に加算（39条3項）⑧「継続的な取引」の限定が法人税では通達9-6-3の(注)、消費税では消規18条3号イの本文＝同じ内容が格の違う場所に置かれている⑨個人は所法64条1項が2つのカッコ書き（「事業所得の金額を除く」「不動産所得又は山林所得を生ずべき事業から生じたものを除く」）で事業を外し、外れた先を51条2項が受ける＝事業は必要経費・事業以外は「なかったものとみなす」⑩保証債務は3通り（法人＝9-6-2注で現実の履行後／個人・事業＝所令141条2号→51条2項/個人・事業以外＝所法64条2項、かつ64条3項で申告書への記載＋書類添付が「限り」適用の要件）⑪債権放棄の行き先は貸倒れ（9-6-1(4)）／寄附金に該当しない（9-4-1・9-4-2）／寄附金の3つで、9-4-1注の「子会社等」は資本関係のない事業関連性のある者も含む
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
  "career-up-joseikin",        // キャリアアップ助成金の支給額 33,100/月（正社員化コース 6,600 ほかクラスタ計 40,370）
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
      "koyou-hoken-kanyu-joken", "koyou-hokenryo-ritsu", "rosai-hokenryoritsu",
      "kenko-hoken-nini-keizoku",
      "shikaku-kakuninsho",
    ],
  },
  {
    id: "nenmatsu-gensen",
    name: "年末調整・源泉徴収・控除",
    desc: "年末調整の書類の書き方と期限、源泉徴収票・税額表の読み方、医療費控除・ふるさと納税など各種控除と確定申告。税務署へ出す法定調書合計表と、市区町村へ1月31日までに出す給与支払報告書（30万円以下で省略できるのは退職者だけ）の違いもここ。開業届と青色申告承認申請の期限もここ。出した申告を後から直す修正申告（国税通則法19条・期限の定めなし）と更正の請求（同23条・法定申告期限から5年）、それに伴う加算税と延滞税（令和8年は年2.8%／年9.1%）もここ。",
    slugs: [
      "furusato-nozei-keisan", "kifukin-kojo",
      "nenmatsu-chosei-kakikata", "nenmatsu-chosei-itsumade", "nenmatsu-chosei-kanpukin",
      "fuyo-kojo-shinkokusho", "tokutei-shinzoku-tokubetsu-kojo", "gensen-choshuhyo-mikata", "gensen-zeigakuhyo-mikata",
      "hoteichosho-goukeihyo", "kyuyo-shiharai-hokokusho", "shiharai-chosho", "shakai-hokenryo-kojo", "iryohi-kojo-ikura-kara",
      "taishokukin-zeikin", "fukugyo-20man-kakutei-shinkoku", "angoshisan-zeikin", "kaigyo-todoke", "yotei-nozei-toha",
      "shusei-shinkoku-kosei-seikyu",
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
    desc: "額面から手取りまでの引かれ方、残業代・通勤手当・住民税の実務と、36協定による労働時間の上限、フレックスタイム制の清算期間、1か月・1年・1週間の3つに分かれる変形労働時間制、裁量労働制のみなし時間、入社時に明示すべき労働条件、22時以降の深夜手当、会社都合で休ませたときの休業手当、予告なしで解雇するときの解雇予告手当、休日出勤の振替休日と代休の違い、6時間・8時間で切り替わる休憩時間の下限、常時10人以上で義務になる就業規則の作成・届出・周知、労働基準法に定めがなく会社が日数を決める忌引き休暇（慶弔休暇）と香典・祝金の経理、予告なしの解雇が14日までに限られる試用期間、深夜業を含む業務だと年2回になる健康診断の実施義務と費用負担・受診時間の賃金、割増賃金の単価から外せる賃金が7つの限定列挙であることと分割回数で報酬と賞与が入れ替わる年俸制、令和8年10月1日から事業主の義務になるカスタマーハラスメント（カスハラ）対策とそれに伴うパワハラの条番号の付け替え、懲戒処分の減給に労働基準法91条が課す2つの上限（1回は平均賃金の1日分の半額まで・総額は一賃金支払期の賃金総額の10分の1まで）と、戒告・譴責・出勤停止といった処分名が労働基準法にも労働契約法にも書かれていないこと、有期契約が通算5年を超えたときに労働者が申し込める無期転換（労働契約法18条）の通算の起点が2013年4月1日以後を初日とする契約に限られることと、通算がリセットされるクーリング期間が直前の契約期間の2分の1（端数は1か月に切り上げ）であること。",
    slugs: [
      "tedori-keisan", "roudou-joken-tsuchisho", "36-kyotei", "flextime", "henkei-roudou-jikan", "sairyo-roudou", "zangyodai-keisan", "kotei-zangyodai", "shinya-teate", "kanri-kantokusha", "kenko-shindan", "kyugyo-teate", "kaiko-yokoku-teate", "furikae-kyujitsu-daikyu", "kyukei-jikan", "shugyo-kisoku", "kibiki-keicho-kyuka", "shiyo-kikan", "tsukin-teate-hikazei", "nenpousei", "doitsu-rodo-doitsu-chingin", "kasuhara", "chokai-shobun", "muki-tenkan",
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
    name: "有給休暇・法定の休暇",
    desc: "付与日数の数え方、年5日の取得義務、パート・アルバイトの比例付与と買い取り。育児・介護休業法が定める子の看護等休暇（旧・子の看護休暇）と介護休暇の年5労働日、時間単位取得の1時間未満切り上げ、賃金の定めが条文に無いこともここ。",
    slugs: ["yukyu-fuyo-nissu", "yukyu-nen5ka", "part-yukyu", "yukyu-kaitori", "kango-kaigo-kyuka"],
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
    desc: "毎月の給与計算の手順と、欠勤控除・日割り・賃金台帳・労働者名簿・訂正・社会保険料の徴収時期・法定福利費・年度更新。従業員の退職金を積み立てる中退共（中小企業退職金共済）の掛金と税務、掛金納付月数によって退職金が3段階に変わること、解約しても解約手当金が事業主ではなく従業員に支払われることもここ。",
    slugs: [
      "kyuyo-keisan-yarikata", "kekkin-kojo-keisan", "tsukitochu-nyusha-taishoku-kyuyo",
      "chingin-daicho", "roudousha-meibo", "kyuyo-keisan-machigai-teisei", "kyuyo-kojo-dekirumono",
      "shakai-hokenryo-choshu-jiki", "kyushoku-shakai-hokenryo", "shoyo-gensen-shotokuzei",
      "gensen-shotokuzei-noki-tokurei", "hotei-fukurihi-keisan", "rodo-hoken-nendo-koshin",
      "keiri-nenkan-schedule", "chutaikyo",
    ],
  },
  {
    id: "hojokin-keiri",
    name: "補助金の経理・税務",
    desc: "補助金を受け取った後の処理。仕訳と計上時期、圧縮記帳と特別勘定（法人税法42〜44条）、消費税、個人事業主の場合。雇用保険法施行規則118条の2が定めるキャリアアップ助成金の6コースと支給額、正社員化コースの額が通算勤続5年を境に4分の1へ下がること、本則の短時間労働者労働時間延長コースが附則で適用停止になっていることもここ。",
    slugs: [
      "career-up-joseikin",
      "hojokin-shiwake", "hojokin-tokubetsu-kanjo", "assyuku-kicho-houshiki",
      "hojokin-asshuku-gendogaku", "hojokin-koteishisan-genka-shokyaku", "hojokin-shohizei",
      "hojokin-kojin-jigyonushi",
    ],
  },
  {
    id: "kotei-shisan",
    name: "固定資産・減価償却",
    desc: "少額減価償却資産と一括償却、耐用年数の引き方、修繕費と資本的支出の判定、償却資産税。開業費・創立費や礼金などの繰延資産（任意償却と均等償却の分かれ目）や、売買として扱われるリース取引（リース期間定額法）もここ。",
    slugs: [
      "shogaku-genka-shokyaku", "taiyo-nensu", "shuzenhi-shihonteki-shishutsu",
      "shokyaku-shisanzei", "kurinobe-shisan", "lease-torihiki-zeimu",
    ],
  },
  {
    id: "hojinzei-kessan",
    name: "法人税・決算の実務",
    desc: "会社設立後の税務届出と法人税の税率、キャッシュフロー計算書、役員報酬・交際費・決算賞与・繰越欠損金・引当金・経過勘定と、賃上げ促進税制などの優遇措置。",
    slugs: [
      "kaisha-setsuritsu", "hojinzei-ritsu", "jigyoshozei", "cash-flow-keisansho",
      "yakuin-hoshu-kimekata", "yakuin-taishokukin", "kosaihi-kaigihi-chigai", "shutcho-nittou-ryohi-kitei",
      "kessan-shoyo", "kurikoshi-kessonkin", "chinage-sokushin-zeisei",
      "chusho-keiei-kyoka-zeisei", "jigyo-shokei-zeisei", "sentan-setsubi-dounyu-keikaku",
      "kashidaore-hikiatekin", "kashidaore-sonshitsu", "shueki-ninshiki-kijun", "maebarai-hiyo",
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
