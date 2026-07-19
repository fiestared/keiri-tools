// e2e.mjs — 公開中の3ツールをヘッドレスChromeで実際に操作する結合テスト。
//   node tools/e2e/e2e.mjs            全シーン
//   E2E_ONLY=payday_slow node ...     1シーンだけ
//
// tests/*.mjs が見ているのは assets/*_core.js の純ロジックだけで、ページ内の
// <script type="module">(入力の読み取り・fetchの適用・描画)は無検査だった。ここを埋める。
//
// payday_slow は「祝日JSONの配信を800ms遅らせて、届く前に計算ボタンを押す」シーン。
// モバイル回線で開いてすぐ押したユーザーの再現で、実際にこれで**祝日が無視された支払日**が
// 出ていた(2026-07-13に発見・修正)。回線の速さに結果が左右されないことを固定する。

import { createServer } from "node:http";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SCENES = [
  { name: "senpou_preset", expect: (s) =>
      s.filled.under === s.expectFilled.under && s.filled.over === s.expectFilled.over &&
      s.result.includes(s.expectTransfer) },
  { name: "senpou_disagree", expect: (s) =>
      /方式によって差引額が変わります/.test(s.result) &&
      /据置型/.test(s.result) && /未満手数料加算型/.test(s.result) && /以上手数料加算型/.test(s.result) },
  { name: "senpou_check", expect: (s) => /550 円/.test(s.result) && /先方負担/.test(s.result) },
  { name: "zengin", expect: (s) =>
      /ｶ\)ﾔﾏﾀﾞ/.test(s.out) && s.injectedImg === 0 && !s.pwned && s.copyShown },
  // 未変換の行が黙ってクリップボード(=総合振込ファイル)へ流れないこと
  { name: "zengin_ng_copy", expect: (s) =>
      s.blocked && /組戻し/.test(s.errText) &&
      s.forcedLines === 3 && /山田商店/.test(s.forced) },
  // 支払予定日が銀行休業日に落ちていたら不合格。ツールの存在意義そのもの
  { name: "payday", expect: (s) => s.rows === 12 && s.onHoliday.length === 0 && !s.warn },
  { name: "payday_slow", slow: true,
    expect: (s) => s.rows === 12 && s.onHoliday.length === 0 && !s.warn },
  // 祝日データが読めない/古いときに「黙って答える」のではなく、断り書きを出すこと
  { name: "payday_nodata", holidays: "404",
    expect: (s) => s.rows === 12 && s.noteText.includes("読み込めませんでした") },
  { name: "payday_stale", holidays: "stale", // 2025年までしか収録が無い状態を再現
    expect: (s) => s.rows === 12 && s.beyondRows === 12 && /2026年以降の祝日/.test(s.noteText) },

  // 営業日計算。営業日数が独立実装と一致すること = 祝日がちゃんと効いていること。
  { name: "eigyobi", expect: (s) => s.business === s.expected.business && !s.warn && !s.beyond },
  // 祝日JSONが届く前にボタンを押されても、待って正しく数えること(遅い回線のユーザー)
  { name: "eigyobi_slow", slow: true,
    expect: (s) => s.business === s.expected.business && !s.warn && !s.beyond },
  // 読めなかったら黙って土日だけで答えず、断り書きを出すこと
  { name: "eigyobi_nodata", holidays: "404", expect: (s) => s.warn },
  // 収録範囲外の年(2028)は「概算」と申告すること。黙って断言しない
  { name: "eigyobi_beyond", expect: (s) => s.beyond },

  // 有給: 月末入社。応当日が無い月は末日(民法143条2項)。繰り越すと法定より遅い付与日になる
  { name: "yukyu_monthend", expect: (s) =>
      s.showsLegal && !s.showsCarried && s.clampNote },
  { name: "yukyu_monthend_leap", expect: (s) =>
      s.showsLegal && !s.showsCarried && s.clampNote },
  { name: "yukyu_normal", expect: (s) =>
      s.showsLegal && !s.showsCarried && !s.clampNote },

  // 消費税: 国税庁Q&A問57の記載例(税込10万・8%と10%混在)を画面が再現すること
  { name: "shohizei_invoice", expect: (s) =>
      s.expected.total === 8416 && s.showsStd && s.showsRed && s.showsTotal },
  // 明細ごとの端数処理(認められない方法)との差を、黙って飲み込まず警告すること
  { name: "shohizei_perline", expect: (s) =>
      s.correct === 105 && s.perLine === 100 && s.showsCorrect && s.warns },
  // 税込99円 = 真の税額がちょうど9円。素朴な浮動小数点実装なら8円になる常設プローブ
  { name: "shohizei_convert_99", expect: (s) =>
      s.expectedTax === 9 && s.taxOk && s.reconciles && s.anchorOk },
  { name: "shohizei_convert_incl", expect: (s) => s.taxOk && s.reconciles && s.anchorOk },
  { name: "shohizei_convert_excl", expect: (s) => s.taxOk && s.reconciles && s.anchorOk },
  // 申告(割戻し/積上げ)。納付税額はハーネス側の独立オラクルと照合し、
  // 認められない組み合わせ(売上=積上げ×仕入=割戻し)を画面に出さないことを固定する
  { name: "shohizei_shinkoku", expect: (s) =>
      s.national === s.want.national && s.local === s.want.local && s.total === s.want.total &&
      s.total === 500000 && !s.offersForbidden && s.showsThree && s.explainsForbidden },
  // 積上げ用の入力が空のとき、0円として計算して積上げを不当に有利に見せないこと
  { name: "shohizei_shinkoku_noinv", expect: (s) => s.declaresSkip && s.positive },

  // 給与の源泉徴収: 額は**ハーネス側が生の月額表を独立に引いた値**と一致すること。
  // どの年分の表を引いたのかを画面に出していること(来年の表に差し替えたら文言も追随する)
  { name: "gensen_kyuyo", expect: (s) =>
      s.tax === s.expected && s.tax > 0 && s.showsYear && !s.failed },
  // 表の到着を待たずに押しても、待って正しい額を出すこと(0円と答えない)
  { name: "gensen_kyuyo_slow", slow: true, expect: (s) =>
      s.tax === s.expected && s.tax > 0 && !s.failed },
  // 表を配信できないときは、額を出さずに「読み込めませんでした」と申告すること。
  // 税額表を引けないまま税額を断言するのが、このツールで最悪の壊れ方
  { name: "gensen_kyuyo_nodata", data404: "gensen_getsugaku_r08.json",
    expect: (s) => s.failed && s.tax === null },
  // 乙欄は同じ給与額でも甲欄よりかなり高い。欄の取り違えを固定する
  { name: "gensen_kyuyo_otsu", expect: (s) => s.tax === s.expected && s.tax > 0 },

  // 賞与: 額は**ハーネス側が生の算出率の表を独立に引いた値**と一致すること。
  // 国税庁の使用例(554,000円/前月196,616円/扶養2人 → 2.042% → 9,564円)をそのまま流す
  { name: "gensen_shoyo", expect: (s) =>
      s.tax === s.expected && s.tax === 9564 && s.showsYear && !s.failed },
  // 表の到着を待たずに押しても、待って正しい額を出すこと(0円と答えない)
  { name: "gensen_shoyo_slow", slow: true, expect: (s) =>
      s.tax === s.expected && s.tax === 9564 && !s.failed },
  // 算出率の表を配信できないときは、額を出さずに「読み込めませんでした」と申告すること
  { name: "gensen_shoyo_nodata", data404: "gensen_shoyo_r08.json",
    expect: (s) => s.failed && s.tax === null },
  // 前月給与の10倍超は算出率の表を使ってはいけない(備考4)。月額表による額を出し、
  // かつ「表を使えない」と画面で申告すること。率で答えると黙って誤答になる
  { name: "gensen_shoyo_10x", expect: (s) =>
      s.viaGetsugaku && s.tax === s.expected && s.tax > 0 && s.declaresGetsugaku },
  // 乙欄は扶養親族等の数を見ず、前月給与だけで率が決まる
  { name: "gensen_shoyo_otsu", expect: (s) => s.tax === s.expected && s.tax > 0 },

  // 社会保険料(需要最大の看板ツール。2026-07-13 第14便までE2Eが1つも無かった)。
  // 期待値は協会けんぽの**公式保険料額表**(PDF機械抽出)。ツールのコードを通っていない独立オラクル
  // 40歳未満は介護保険料の**行が出ない**こと(否定文「かかりません」は本文に出るので、
  // 判定は本文の正規表現でなく結果テーブルの行ラベルで見る)。どの年度の料率かも申告すること
  // 42,570(公式額表) + 1,500(雇用保険 300,000×5/1000) = 44,070
  { name: "shaho", expect: (s) =>
      s.self === s.expected && s.self === 44070 && !s.failed &&
      !s.showsKaigoRow && s.showsKoyouRow && s.showsYear },
  // 料率の到着を待たずに押しても、待って正しい額を出すこと
  { name: "shaho_slow", slow: true, expect: (s) =>
      s.self === s.expected && s.self === 44070 && !s.failed },
  // 料率を配信できないときは、額を出さずに「読み込めませんでした」と申告すること
  { name: "shaho_nodata", data404: "shaho_rates_r08.json",
    expect: (s) => s.failed && s.self === null },
  // 40〜64歳は介護保険料がかかる。合算料率で控除するのが公式額表と同じ方式
  // 45,000 + 1,500 = 46,500
  { name: "shaho_kaigo", expect: (s) =>
      s.self === s.expected && s.self === 46500 && s.showsKaigoRow && !s.failed },
  // ★雇用保険は標準報酬月額でなく**賃金総額**にかかる。報酬月額305,000は等級としては
  //   300,000(第22級)なので健保・厚年は据え置きだが、雇用保険だけは 305,000×5/1000 = 1,525円。
  //   ページが標準報酬月額を渡していれば1,500円になり 44,070 に落ちて**ここで捕まる**
  //   (coreの単体テストは全部緑のままなので、この検査でしか捕まらない)
  { name: "shaho_koyou_gaku", expect: (s) =>
      s.self === s.expected && s.self === 44095 && s.expectedKoyou === 1525 &&
      s.showsKoyouRow && !s.failed },
  // 業種を建設にすると本人6/1000 → 300,000×6/1000 = 1,800円。42,570 + 1,800 = 44,370
  { name: "shaho_koyou_kensetsu", expect: (s) =>
      s.self === s.expected && s.self === 44370 && s.expectedKoyou === 1800 &&
      s.showsKoyouRow && !s.failed },

  // ── 失業保険(基本手当) ──────────────────────────────────────────────────
  // 35歳・月30万・勤続12年・自己都合 → 賃金日額10,000円 → 日額6,207円 × 120日 = 744,840円
  { name: "kihonteate", expect: (s) =>
      s.daily === s.expectedDaily && s.daily === 6207 && s.days === 120 &&
      s.total === 6207 * 120 && s.showsRestriction && !s.failed },
  // ★離職理由で変わるのは**日数と給付制限だけ**。日額は1円も変わらない
  { name: "kihonteate_kaisha", expect: (s) =>
      s.daily === s.expectedDaily && s.daily === 6207 && s.days === 240 &&
      s.total === 6207 * 240 && s.showsNoRestriction && !s.failed },
  // 上限額が配信できないときは、額を出さずに断る(fail closed)
  { name: "kihonteate_nodata", data404: "kihonteate_r07.json",
    expect: (s) => s.failed && s.daily === null && s.total === null },

  // ── 退職金の税金(退職所得) ──────────────────────────────────────────────
  // ★期待値は**国税庁 No.2732 の計算例(実額)**。退職金800万円・勤続10年2か月 → 91,890円。
  //   控除440万・1年未満切上げ(11年)・1/2・千円未満切捨・超過累進・102.1%の**どれか1つでも
  //   間違っていたら、この額にはならない**。住民税は地税328条の3/50条の4から独立に計算。
  { name: "taishoku", expect: (s) =>
      s.kojo === 4400000 && s.taxable === 1800000 &&
      s.incomeTax === 91890 &&                       // ← 国税庁が公表している実額
      s.juminzei === 180000 &&                       // ← 180万×6% + 180万×4%
      s.tedori === 8000000 - 91890 - 180000 && !s.failed },
  // ★看板の主張が画面に出ているか: 勤続20年0か月なら「あと1か月で91,155円安くなる」
  { name: "taishoku_kiriage", expect: (s) =>
      s.kojo === 8000000 && s.taxable === 3500000 && s.showsOneMonth && !s.failed },
  // ★特定役員(役員等5年以下)は1/2が効かない → 課税退職所得は400万でなく800万になる
  { name: "taishoku_yakuin", expect: (s) =>
      s.kojo === 2000000 && s.taxable === 8000000 && !s.failed },
  // 税率表が配信できないときは、額を出さずに断る(fail closed)
  { name: "taishoku_nodata", data404: "taishoku_rates_r08.json",
    expect: (s) => s.failed && s.taxable === null && s.tedori === null },

  // ── 残業代(割増賃金) ────────────────────────────────────────────────
  // ★期待値は**神奈川労働局が実額で公表している計算例**(1,500円×1.5＝2,250円)。
  //   同じ1時間を「時間外」と「深夜」に重ねて数え、深夜は**上乗せ25%だけ**を足す ──
  //   この設計が正しいことを、労働局の公表額が裏書きしている(125%で足していたら3,750円)。
  { name: "zangyodai", expect: (s) =>
      s.hourlyRate === 1500 && s.total === 2250 && !s.failed },
  // ★1か月60時間超の50%(2023年4月から中小企業も)。画面が率の変化を名指しすること
  { name: "zangyodai_over60", expect: (s) =>
      s.total === 137755 + 27551 && s.showsOver60 && s.shows50pct && !s.failed },
  // ★固定残業代を超えた差額。この計算機のいちばん実利のある答え
  { name: "zangyodai_fixed", expect: (s) => s.total === 45918 && s.showsShortfall && !s.failed },
  // 割増率が配信できないときは、額を出さずに断る(fail closed)
  { name: "zangyodai_nodata", data404: "zangyodai_rates.json",
    expect: (s) => s.failed && s.total === null },

  // ── ふるさと納税 限度額 ──────────────────────────────────────────────
  // ★期待値は条文から手で積み上げた実額(harness側のコメントに鎖を全部書いた)。
  //   年収500万・独身・社保70万 → 所得割240,500円 → 限度額**62,283円**。
  //   本則の80%で割ると62,125円になるので、**62,283円が出ること自体が
  //   「附則5条の6の読替え(79.79%)が効いている」ことの証明**になる。
  { name: "furusato", expect: (s) =>
      s.gendo === 62283 && s.shotokuwari === 240500 && s.showsRitsu && !s.failed },
  // ★限度額ちょうど寄附すると自己負担は**きっかり2,000円**。これは限度額の定義そのもので、
  //   給与所得・調整控除・割合・20%上限・端数のどれか1つでも狂うと2,000円にならない
  { name: "furusato_gendo", expect: (s) => s.gendo === 62283 && s.jikoFutan === 2000 && !s.failed },
  // ★超えた分は自腹。8万円寄附 → 自己負担は2,000円ではなく16,137円になることを画面が言う
  { name: "furusato_over", expect: (s) =>
      s.jikoFutan === 16137 && s.showsOver && !s.failed },
  // ★社保が空欄なら年収から概算し、**その金額と前提を画面に出す**(黙って勝手な社保で答えない)
  { name: "furusato_gaisan", expect: (s) =>
      s.gendo === 60704 && s.showsGaisan && !s.failed },
  // 税率表が配信できないときは、限度額を出さずに断る(fail closed)。
  // ★黙って答えると、利用者は上限を超えて寄附して自腹を切る
  { name: "furusato_nodata", data404: "juminzei_r08.json",
    expect: (s) => s.failed && s.gendo === null },
  // ★★公開済みページに実在したバグの再発防止(2026-07-14 第23便)。
  //   16歳未満の子は**扶養控除が0円**だが**非課税限度額の扶養親族の数には入る**(施行令47条の3)。
  //   年収170万・子1人は**所得割が非課税** → 控除される所得割が無いので**限度額は0円**。
  //   ページが fuyoNensho を渡していなかったので「限度額9,888円」と答えていた
  //   ＝ **税金が1円も戻らない人に寄附させる**(いちばん余裕のない層を直撃する)。
  //   **coreは正しく、壊れていたのはページ**なので単体テストでは捕まらない。E2Eでしか守れない。
  { name: "furusato_nensho", expect: (s) =>
      s.gendo === 0 && s.showsNoBenefit && !s.failed },

  // ── 住民税 ────────────────────────────────────────────────────────────
  // ★期待値は条文から手で積み上げた実額(鎖は harness.html のコメントに全部書いた)。
  //   標準税率・独身・年収500万・社保70万 → 所得割240,500 + 均等割5,000 = **245,500円**。
  //   所得割240,500は /furusato/ の検証済みの鎖と同じ値(同じコアの別の顔なので一致するのが正しい)。
  { name: "juminzei", expect: (s) =>
      s.total === 245500 && s.shotokuwari === 240500 && s.kintouwari === 5000 &&
      s.showsShinrin && !s.failed },
  // ★★この計算機の看板の主張: **16歳未満の子は扶養控除が0円なのに住民税を変える**。
  //   合計所得105万・1級地・子1人 → 均等割の限度額101万は超える / 所得割の限度額112万は超えない
  //   → **均等割だけ課税** = 住民税5,000円。画面がその帯にいることを名指しで言うこと。
  { name: "juminzei_nensho", expect: (s) =>
      s.total === 5000 && s.shotokuwari === 0 && s.kintouwari === 5000 &&
      s.showsKintouOnly && !s.failed },
  // ↑の対照。同じ所得で子がいなければ所得割も課税され 40,500円(=所得割35,500+均等割5,000)。
  // **この2シーンの差35,500円が「扶養控除0円なのに効く」ことの証明**(片方だけでは何も言えない)
  { name: "juminzei_nensho_nashi", expect: (s) =>
      s.total === 40500 && s.shotokuwari === 35500 && !s.showsKintouOnly && !s.failed },
  // ★超過課税。横浜市は市3,900+県1,300+森林環境税1,000 = **6,200円**(横浜市の公表額と一致)。
  //   所得割は指定都市の8%:2% に神奈川県の超過課税(+0.025%)が乗る → 241,107円
  { name: "juminzei_yokohama", expect: (s) =>
      s.total === 247307 && s.shotokuwari === 241107 && s.kintouwari === 6200 && !s.failed },
  // 税率表が配信できないときは、税額を出さずに断る(fail closed)
  { name: "juminzei_nodata", data404: "juminzei_r08.json",
    expect: (s) => s.failed && s.total === null },

  // ── 手取り (/tedori/) ─────────────────────────────────────────────────
  // ★このツールは3つの検証済みコアの**合成**。E2Eは合成とページ配線が正しいかを見る。
  //   期待値(s.expected*)はハーネス側で社保=公式額表・所得税=月額表を**独立に**引いて組む。
  //   東京都・額面30万・30歳・扶養0・住民税(月)10,000 → 44,070 + 6,320 + 10,000 → 手取り**239,610**。
  { name: "tedori", expect: (s) =>
      s.tedori === s.expectedTedori && s.tedori === 239610 &&
      s.expectedShaho === 44070 && s.expectedTax === 6320 && s.showsYear && !s.failed },
  { name: "tedori_slow", slow: true, expect: (s) =>
      s.tedori === s.expectedTedori && s.tedori === 239610 && !s.failed },
  // 料率・税額表を配信できない → 手取りを出さず断る(fail closed)。黙って住民税だけ引いた額を信じさせない
  { name: "tedori_nodata", data404: "shaho_rates_r08.json",
    expect: (s) => s.failed && s.tedori === null },
  // ★住民税を除くと記事の早見表と同じ値(額面30万 → 249,610円)。同じコアの別の顔なので一致するのが正しい
  { name: "tedori_none", expect: (s) =>
      s.tedori === s.expectedTedori && s.tedori === 249610 && s.expectedJumin === 0 && !s.failed },
  // ★概算(前年ベース)。住民税 年150,600 → 月12,550 → 手取り237,060。住民税の配線が狂えば落ちる
  { name: "tedori_estimate", expect: (s) =>
      s.tedori === s.expectedTedori && s.tedori === 237060 &&
      s.juminMonthly === s.expectedJumin && s.juminMonthly === 12550 && !s.failed },

  // ── ボーナス手取り (/bonus-tedori/) ──────────────────────────────────
  // ★検証済み3コア(calcBonus/calcKoyou/calcShoyo)の合成。期待値はハーネス側で
  //   公式額表(fixture)と生の算出率の表を独立に引いて組む(被検体のコアを一切通さない)。
  //   東京都・賞与50万・30歳・扶養0・前月額面30万 → 社保73,450 + 税17,420 → 手取り409,130。
  //   ★住民税の行が「¥0・賞与からは天引きされません」と明示されること(このツールの看板の主張)
  { name: "bonus_tedori", expect: (s) =>
      s.tedori === s.expectedTedori && s.tedori === 409130 &&
      s.shahoSelf === s.expectedShaho && s.shahoSelf === 73450 &&
      s.shotokuzei === s.expectedTax && s.shotokuzei === 17420 &&
      s.juminzei === 0 && s.declaresNoJuminzei && s.showsYear && !s.failed },
  // 表の到着を待たずに押しても、待って正しい額を出すこと(0円と答えない)
  { name: "bonus_tedori_slow", slow: true, expect: (s) =>
      s.tedori === s.expectedTedori && s.tedori === 409130 && !s.failed },
  // 算出率の表を配信できない → 手取りを出さずに断ること(fail closed)
  { name: "bonus_tedori_nodata", data404: "gensen_shoyo_r08.json",
    expect: (s) => s.failed && s.tedori === null },
  // 前月給与なし → 算出率の表を使えない(備考4)。月額表による例外計算を**画面で申告**し、
  // 賞与30万は月額表の非課税帯 → 税0円・手取り255,930。黙って率で計算したら落ちる
  { name: "bonus_tedori_noprev", expect: (s) =>
      s.viaGetsugaku && s.declaresGetsugaku && s.shotokuzei === 0 &&
      s.tedori === s.expectedTedori && s.tedori === 255930 && !s.failed },

  // ── 医療費控除 (/iryohi/) ────────────────────────────────────────────
  // ★看板の答え: 医療費30万・補填0・年収500万(足切り10万)・税率10% → 控除額20万・軽減40,420。
  //   juminzei.kyuyoShotoku(年収→総所得)＋所法73条の足切り＋速算表の合成が1段でも狂えば落ちる。
  { name: "iryohi", expect: (s) =>
      s.kojo === 200000 && s.ashikiri === 100000 && s.keigen === 40420 && s.showsYear && !s.failed },
  { name: "iryohi_slow", slow: true, expect: (s) =>
      s.kojo === 200000 && s.keigen === 40420 && !s.failed },
  // ★★低所得の主役: 年収160万・医療費6万 → 足切り47,500(5%側)・控除額12,500。「10万円は下限ではない」。
  //   足切りを一律10万に実装していたら控除額0になってここで落ちる（記事の目玉の逆）。
  { name: "iryohi_lowincome", expect: (s) =>
      s.ashikiri === 47500 && s.kojo === 12500 && !s.failed },
  // ★通常とセルフメディは選択 → 控除額の大きい②を推奨。控除額88,000。
  { name: "iryohi_selfmed", expect: (s) =>
      s.selfmedKojo === 88000 && s.recommendsSelf && !s.failed },
  // ★税率未選択 → 軽減額を黙って0円で出さず「税率を選んでください」と言う（控除額は出す）。
  { name: "iryohi_norate", expect: (s) =>
      s.kojo === 200000 && s.keigen === null && s.showsRatePrompt && !s.failed },
  // 参照データが配信できないときは、控除額を出さずに断る（fail closed）。過大な控除額を信じさせない
  { name: "iryohi_nodata", data404: "iryohi_r08.json",
    expect: (s) => s.failed && s.kojo === null },

  // ── 相続税 (/sozokuzei/) ─────────────────────────────────────────────
  // ★公開されている早見表: 1億・配偶者＋子2人 → 相続税の総額630万・実際の納税額315万。
  //   基礎控除4,800万→課税遺産総額→法定相続分(配偶者1/2・子1/4ずつ)→速算表→配偶者の税額軽減 の
  //   合成が1段でも狂えば落ちる。
  { name: "sozokuzei", expect: (s) =>
      s.sogaku === 6300000 && s.jishitsu === 3150000 && s.kiso === 48000000 && s.showsYear && !s.failed },
  { name: "sozokuzei_slow", slow: true, expect: (s) =>
      s.sogaku === 6300000 && s.jishitsu === 3150000 && !s.failed },
  // ★兄弟姉妹は2割加算(相法18条): 1億・兄弟2人 → 総額770万・実質924万。加算を落とせば770万で落ちる。
  { name: "sozokuzei_siblings", expect: (s) =>
      s.sogaku === 7700000 && s.jishitsu === 9240000 && !s.failed },
  // ★配偶者のみ → 配偶者の税額軽減で実質0（総額1,220万は出す）。軽減を外せば実質1,220万で落ちる。
  { name: "sozokuzei_spouseonly", expect: (s) =>
      s.sogaku === 12200000 && s.jishitsu === 0 && !s.failed },
  // ★基礎控除以下(遺産4,000万・配偶者＋子2人＝基礎控除4,800万)→ 相続税0を明言。黙って税額を出さない
  { name: "sozokuzei_below", expect: (s) =>
      s.belowKiso && s.sogaku === null && !s.failed },
  // 参照データ配信不可 → 税額を出さずに断る(fail closed)。過大/過少な税額を信じさせない
  { name: "sozokuzei_nodata", data404: "sozokuzei_r08.json",
    expect: (s) => s.failed && s.sogaku === null },

  // ── 贈与税 (/zoyozei/) ───────────────────────────────────────────────
  // ★No.4408例: 特例500万 → 48.5万円。基礎控除110万→390万→特例税率15%−10万 の配線が1段でも狂えば落ちる。
  { name: "zoyozei", expect: (s) =>
      s.zei === 485000 && s.showsYear && !s.failed },
  { name: "zoyozei_slow", slow: true, expect: (s) =>
      s.zei === 485000 && !s.failed },
  // ★一般500万 → 53万円（特例より重い＝一般/特例の取り違えを検出。特例なら48.5万で落ちる）。
  { name: "zoyozei_ippan", expect: (s) =>
      s.zei === 530000 && !s.failed },
  // ★混在（一般100万＋特例400万）→ 49.4万円（按分・No.4408 (3)）。按分を落とせば別の額で落ちる。
  { name: "zoyozei_mixed", expect: (s) =>
      s.zei === 494000 && !s.failed },
  // ★合計110万以下（特例100万）→ 相続税ならぬ贈与税0を明言。黙って税額を出さない。
  { name: "zoyozei_below", expect: (s) =>
      s.below && s.zei === null && !s.failed },
  // 参照データ配信不可 → 税額を出さずに断る(fail closed)。過大/過少な税額を信じさせない
  { name: "zoyozei_nodata", data404: "zoyozei_r08.json",
    expect: (s) => s.failed && s.zei === null },

  // ── 収入印紙 (/inshi/) ───────────────────────────────────────────────
  // ★No.6925: 税込54,800円・消費税等4,981円区分記載 → 税抜49,819円で判定＝非課税（印紙不要）。
  //   ハーネス側の引き算 54,800−4,981=49,819<50,000 と一致し、一覧表23行（判取帳まで）も描かれること。
  { name: "inshi", expect: (s) =>
      s.hikazei && s.judge === 49819 && s.tax === null &&
      s.tableRows === 23 && s.tableHasHantori && !s.failed },
  { name: "inshi_slow", slow: true, expect: (s) =>
      s.hikazei && s.judge === 49819 && s.tax === null && !s.failed },
  // ★免税事業者は区分記載しても税込判定 → 200円（非課税と言ったら誤答＝過怠税コース）。
  { name: "inshi_menzei", expect: (s) =>
      s.tax === 200 && !s.hikazei && !s.failed },
  // ★No.7108の計算例: 不動産6,000万円 → 軽減30,000円（本則60,000円なら落ちる）。
  { name: "inshi_keigen", expect: (s) =>
      s.tax === 30000 && s.keigen && !s.failed },
  // ★5万円ちょうどの領収書 → 200円（「5万円未満」の境界を「以下」に読み違えたら落ちる）。
  { name: "inshi_50k", expect: (s) =>
      s.tax === 200 && !s.hikazei && !s.failed },
  // 参照データ配信不可 → 印紙額を出さずに断る(fail closed)。誤った印紙額を信じさせない
  { name: "inshi_nodata", data404: "inshi_r07.json",
    expect: (s) => s.failed && s.tax === null },

  // ── 自動車税 (/jidoshazei/) ──────────────────────────────────────────
  // ★新税率(令和元10月以降)・1.5L超2L以下=36,000。一覧表11区分・6L超まで描かれること。
  { name: "jidoshazei", expect: (s) =>
      s.annual === 36000 && s.rateNew && !s.jyuka &&
      s.tableRows === 11 && s.tableHasGt6000 && !s.failed },
  { name: "jidoshazei_slow", slow: true, expect: (s) =>
      s.annual === 36000 && s.rateNew && !s.failed },
  // ★旧税率(令和元9月以前)=39,500。新旧の境界を読み違えたら落ちる。
  { name: "jidoshazei_old", expect: (s) =>
      s.annual === 39500 && s.rateOld && !s.failed },
  // ★13年超の重課(ガソリン): 旧39,500→45,400。
  { name: "jidoshazei_jyuka", expect: (s) =>
      s.annual === 45400 && s.jyuka && !s.failed },
  // ★★ハイブリッドは13年超でも重課対象外→旧標準39,500のまま(一律15%増しと答えたら落ちる)。
  { name: "jidoshazei_hybrid", expect: (s) =>
      s.annual === 39500 && !s.jyuka && !s.failed },
  // ★月割: 新2.5L超(43,500)を8月登録=7か月分25,300(43,500×7/12=25,375の100円未満切捨)。
  { name: "jidoshazei_getsuwari", expect: (s) =>
      s.proration === 25300 && s.annual === 43500 && !s.failed },
  // ★軽自動車(H27.4以降 最初の新規検査)=10,800。別の税・月割なし。
  { name: "jidoshazei_kei", expect: (s) =>
      s.annual === 10800 && !s.failed },
  // 参照データ配信不可 → 税額を出さずに断る(fail closed)。誤った税額を信じさせない
  { name: "jidoshazei_nodata", data404: "jidoshazei_r08.json",
    expect: (s) => s.failed && s.annual === null },

  // ── 減価償却 (/genka/) ───────────────────────────────────────────────
  // ★独立オラクル=国税庁 No.2106/別表第十の公表計算例（取得価額100万円・耐用年数10年）。
  //   定額法=毎年10万円・合計999,999・10年で1円まで。償却率一覧表(2〜50年=49行)が正本データから描かれる。
  { name: "genka", expect: (s) =>
      s.firstYear === 100000 && s.total === 999999 && s.rows === 10 && s.ritsuRows === 49 && !s.failed },
  { name: "genka_slow", slow: true, expect: (s) =>
      s.firstYear === 100000 && s.total === 999999 && !s.failed },
  // ★200%定率法: 1年目20万・7年目に償却保証額を下回り改定65,536へ切替・10年目65,535（1円残す）。
  { name: "genka_teiritsu", expect: (s) =>
      s.firstYear === 200000 && s.depCol[6] === 65536 && s.depCol[s.depCol.length - 1] === 65535 &&
      s.total === 999999 && !s.failed },
  // ★初年度の月割: 4月取得(9か月)=75,000。以降10万で11年目まで延びる。
  { name: "genka_getsuwari", expect: (s) =>
      s.firstYear === 75000 && s.rows === 11 && s.total === 999999 && !s.failed },
  // ★事業専用割合60%: 償却費10万・必要経費算入額6万（帳簿価額は全額で減る）。
  { name: "genka_ratio", expect: (s) =>
      s.firstYear === 100000 && s.necessary === 60000 && !s.failed },
  // ★平成19年3月以前取得=旧法で対象外。誤って新法で答えず断る（fail closed）。
  { name: "genka_kyuho", expect: (s) =>
      s.rejected && s.firstYear === null && !s.failed },
  // 参照データ配信不可 → 償却費を出さずに断る（fail closed）。
  { name: "genka_nodata", data404: "genka_rates.json",
    expect: (s) => s.failed && s.firstYear === null },

  // ── 年収の壁 (/kabe/) ────────────────────────────────────────────────
  // ★合成(壁判定→社保→手取り)とページ配線を見る。独立オラクルは協会けんぽ額表の端数処理で組む。
  //   東京都・30歳・130万の壁: 年収129万(扶養内)→手取り129万・壁の底(130万加入)112万2,704・回復150万5,000。
  { name: "kabe", expect: (s) =>
      s.current === s.expectedTedori && s.current === 1290000 &&
      s.bottom === s.expectedBottom && s.bottom === 1112704 &&
      s.recoveryShown === 1505000 && !s.failed },
  // 加入側(131万): 社保187,296を引いて手取り112万2,704
  { name: "kabe_join", expect: (s) =>
      s.tedori === s.expectedTedori && s.tedori === 1122704 && s.shaho === 187296 && !s.failed },
  { name: "kabe_slow", slow: true, expect: (s) =>
      s.current === 1290000 && s.bottom === 1112704 && s.recoveryShown === 1505000 && !s.failed },
  // 基準額・料率を配信できない → 手取りを出さず断る(fail closed)。黙って壁ゼロの手取りを信じさせない
  { name: "kabe_nodata", data404: "kabe_thresholds_r08.json",
    expect: (s) => s.failed && s.current === null && s.tedori === null },

  // ── 傷病手当金 ────────────────────────────────────────────────────────
  // ★期待値は**保険者が実額で公表している計算例**(コアを一切通さない。詳細は harness.html)。
  //   協会けんぽ: 標準報酬16万×6 + 18万×6 → 平均17万 → ÷30=5,670 → ×2/3 = **3,780円/日**。
  //   30日休むと待期3日を引いて**27日分** = 102,060円。
  //   ★同時に**支給期間**も見る: 厚労省事務連絡の実例 2022-03-04 開始 → 2023-09-03 まで=**549日**。
  //     「1年6か月=546日」と焼き込んでいたら落ちる。**そして startDate の渡し忘れもここで落ちる**
  //     (コアは startDate が無いと kikan を null にするだけ = 画面から支給期間が黙って消える)。
  { name: "shobyo", expect: (s) =>
      s.nichigaku === 3780 && s.base === 5670 && s.days === 27 && s.total === 102060 &&
      s.kikanDays === 549 && s.showsKikanEnd && !s.failed },
  // ★★丸めの向きが**逆**の公表例(ITS健保/厚労省資料): 20万×5 + 24万×7 → ÷30=7,440(切捨て側)
  //   → ×2/3 = **4,960円/日**。協会けんぽ(切上げ側)と**同時に**合う = 四捨五入の境界が正しい証明。
  { name: "shobyo_its", expect: (s) =>
      s.nichigaku === 4960 && s.base === 7440 && !s.failed },
  // ★入社1年未満の頭打ち(99条2項ただし書)。月給50万・3か月 → 自分の平均16,670ではなく
  //   全被保険者の平均32万から出た10,670を採り → ×2/3 = **7,113円/日**。
  //   ★★世に出回る「上限は日額6,667円」は**30万円時代の古い値**。6,667を出したらここで落ちる。
  { name: "shobyo_cap", expect: (s) =>
      s.nichigaku === 7113 && s.days === 27 && s.total === 192051 && s.showsCap && !s.failed },
  // ★給与が出ていても差額は出る(108条1項ただし書)。日額6,667 − 給与日額3,000 = **3,667円/日**。
  //   ここで0円を出すと「給料が出てるから対象外」の誤解を機械が追認し、**差額を失う人**を生む。
  { name: "shobyo_sagaku", expect: (s) =>
      s.nichigaku === 3667 && s.total === 99009 && s.showsSagaku && !s.failed },
  // 任意継続の期間中に**新たに**発病した人には支給されない(99条1項のかっこ書き)。
  // ★★ただしその ¥0 の画面は、**104条という逃げ道**と「どこを押せばよいか」を必ず言うこと。
  //   ここを黙ると、退職前から受けていた人が「自分は対象外」と読んで諦める(本番で起きていた)。
  { name: "shobyo_ninnikeizoku", expect: (s) =>
      s.total === 0 && s.showsNinnikeizoku && s.showsKeizokuHint && !s.failed },
  // ★★【第6便】任意継続でも、退職する前から受けていた人は受け続けられる(104条の継続給付)。
  //   本番は **¥0(支給されません)** と答えていた。月給30万・546日 → 543日 × 6,667 = **3,620,181円**。
  //   コアの keizokuKyufu() は実装も単体テストもあったのに **どのページからも呼ばれていなかった**
  //   (=§37の到達不能コード)。単体は永久に緑。**このシーンだけが画面でそれを捕まえる。**
  { name: "shobyo_keizoku", expect: (s) =>
      s.total === 3620181 && s.nichigaku === 6667 && s.days === 543 &&
      s.showsKeizoku && !s.failed },
  // 参照データが配信できないときは、金額を出さずに断る(fail closed)。
  // ★黙って答えると入社1年未満の人に**上限を無視した高い額**を信じさせる
  { name: "shobyo_nodata", data404: "shobyo_r08.json",
    expect: (s) => s.failed && s.total === null },

  // ── 出産手当金 (/shussan/) 健保法102条 ────────────────────────────────
  // ★日額は傷病手当金と同じ算式(30万→6,667)だが、**待期3日が無い**(102条2項は99条1項を準用しない)ので
  //   産前42+産後56=**98日**まるごと出る。6,667 × 98 = **653,366円**(協会けんぽ公表・gbrain)。−3日で落ちる。
  { name: "shussan", expect: (s) =>
      s.nichigaku === 6667 && s.days === 98 && s.total === 653366 && !s.failed },
  // ★★出産が予定日より遅れた日数はそのまま給付が増える(102条1項かっこ書き)。
  //   10日遅れ → 産前52+産後56=**108日** → 6,667 × 108 = **720,036円**(+66,670円)。
  //   産前を42日に焼き込んでいたら98日のまま落ちる。**このツールの主役の事実**。
  { name: "shussan_late", expect: (s) =>
      s.days === 108 && s.total === 720036 && s.showsDelay && !s.failed },
  // ★★任意継続でも、退職前から産休に入っていた人は104条で受け続けられる(shobyoと同じ「黙って¥0」の罠)。
  //   ¥0ではなく653,366円と、104条の名乗りが画面に出ることを固定する。
  { name: "shussan_keizoku", expect: (s) =>
      s.total === 653366 && s.showsKeizoku && !s.failed },
  // 参照データ配信不可 → 金額を出さずに断る(fail closed)。上限を無視した高い額を信じさせない
  { name: "shussan_nodata", data404: "shobyo_r08.json",
    expect: (s) => s.failed && s.total === null },

  // ── 育児休業給付金 ────────────────────────────────────────────────────
  // ★期待値はコアを一切通さず、**厚労省の公表する支給限度額**と条文の率から積む(harness.html参照)。
  // ★★【第3便】支給単位期間を**暦の応当日**で区切るよう作り直した(61条の7第5項)。
  //   それまでの「30日ずつ」モデルは**1年で25,100円 過大**に答えていた(本番で公開済みだった)。
  //   月給30万・2026-04-01開始・365日 → 賃金日額10,000円
  //   1〜5回目 各30日×67% / ★6回目(9/1〜9/30)は180日目(9/27)をまたぐので**27日×67% + 3日×50% = 195,900円**
  //   7〜11回目 各30日×50%(★2月も暦28日だが**支給日数30日**) / 12回目(終了月)は**実日数31日**×50%
  //   → 合計 **2,105,900円**(67%は**177日**・50%は184日)。「30日区切り」なら2,131,000円で赤くなる。
  //   13%は**配偶者が育休を取らないので0円**(既定)。**その理由が画面に出ること**まで見る
  //   (黙って0円にすると、配偶者が14日取れば36,400円もらえたことに永久に気づけない)。
  { name: "ikuji", expect: (s) =>
      s.daily === 10000 && s.ikujiTotal === 2105900 && s.total === 2105900 &&
      s.unit1 === 201000 && s.unit7 === 150000 &&
      // ★★到達不能だった日割りが、はじめて**画面で**検査される
      s.straddleAmount === 195900 && s.showsHiwari &&
      // ★支給日数(30日)と暦(28日/31日)の食い違いを、画面が自分から開示すること
      s.showsFebPayDays && s.showsFinalPayDays && s.showsPayDays67 &&
      s.shien === 0 && s.showsSpouseReason && s.showsSpouseHint && !s.failed },
  // ★★開始日で答えが変わる = ページが startDate を**本当にコアへ渡している**ことの証明。
  //   2/1開始は短い2月が31日の月を相殺して67%が180日フル → **2,116,000円**(4/1開始と10,100円違う)。
  //   開始日を無視した実装なら2つが同額になり、ここで落ちる。
  { name: "ikuji_feb", expect: (s) =>
      s.ikujiTotal === 2116000 && s.ikujiTotal !== 2105900 && !s.failed },
  // ★★13%が**画面に届いている**ことを実額で固定する: 10,000×28×0.13 = **36,400円**。
  //   **ページが shien を渡し忘れたら、この行は0円になってここで落ちる。**
  //   /furusato/ の fuyoNensho(第23便)・/shobyo/ の startDate(第25便)と同じ型の事故が3便連続したので、
  //   コア側は shien を必須引数にし(省略で例外)、ページ側は13%の行を常に描くようにした。その錠前の検査。
  { name: "ikuji_shien", expect: (s) =>
      s.shien === 36400 && s.total === 2142300 && !s.failed },
  // ★ひとり親等は配偶者要件が免除される(61条の10第2項) → 配偶者0日でも13%が乗る
  { name: "ikuji_hitorioya", expect: (s) =>
      s.shien === 36400 && s.total === 2142300 && !s.failed },
  // ★★上限は**年齢で変わらない**(61条の7第6項が17条4項2号**ハ**=30歳以上45歳未満の額に固定)。
  //   月給60万 → 賃金日額20,000円だが**16,110円**で頭打ち。67%の上限 = 16,110×30×0.67 = **323,811円/月**
  //   (厚労省が公表する支給限度額そのもの)。180日 → 323,811×6 = **1,942,866円**。
  //   ★このツールは**年齢を聞いていない**。基本手当(kihonteate)の作法を流用して年齢で上限を選ぶと、
  //     30〜44歳以外の**全員**が黙って間違う(45歳以上17,740円/30歳未満14,510円は育休には無い)。
  //   ★★暦で180日ちょうど休んでも、67%で払われるのは**177日**(5/7/8月が31日あるぶん支給日数が遅れる)。
  //     323,811×5 + 終了月27日分291,429 = **1,910,484円**。「323,811×6=1,942,866」は**32,382円の過大**。
  { name: "ikuji_cap", expect: (s) =>
      s.daily === 16110 && s.unit1 === 323811 && s.ikujiTotal === 1910484 &&
      s.showsCap && !s.failed },
  // 参照データが配信できないときは、金額を出さずに断る(fail closed)。
  // ★黙って答えると、上限に張りつく人に**上限を無視した高い額**を信じさせる(月30万円以上ずれる)
  { name: "ikuji_nodata", data404: "kihonteate_r07.json",
    expect: (s) => s.failed && s.total === null },

  // ───────── 産後パパ育休(/papa-ikukyu/) 61条の8 + 61条の10 ─────────
  // ★★期待値は**厚労省 001461102.pdf 5頁の計算例**そのもの(実装を一切通さない外部オラクル)。
  //   賃金日額10,000円・14日・賃金なし → 67%: **93,800円** / 13%: **18,200円** / 合計 **112,000円**(=80%)
  //   ★★13%が乗るのは、ページが「配偶者が出産した(=産後休業中)」を**exempt としてコアに渡している**から
  //     (61条の10第2項3号)。**渡し忘れれば「配偶者の育児休業が14日未満」で0円**になり、ここで落ちる。
  //     これが**このツールの主役の事実**: 父親は妻が育休を1日も取らなくても13%をもらえる。
  { name: "papa", expect: (s) =>
      s.daily === 10000 && s.shusshoji === 93800 && s.shien === 18200 && s.total === 112000 &&
      // ★28日は「そのあとの育休の180日枠」を食う → 14日なら残り166日と画面が自分から言う
      s.remaining67 === 166 && !s.failed },
  // ★★厚労省5頁の計算例②: 3日就労して賃金30,000円
  //   80%相当額 112,000 − 賃金 30,000 = **82,000円**。★**13%は減額されない**(18,200円のまま)。
  //   「賃金が出たから13%も減るはず」と実装すると、ここで落ちる。
  { name: "papa_wage", expect: (s) =>
      s.shusshoji === 82000 && s.shien === 18200 && s.total === 100200 &&
      s.showsWageReduced && !s.failed },
  // ★★賃金が80%相当額(112,000円)以上 → 67%は不支給。**13%も道連れで消える**(厚労省5頁)。
  //   ⚠️**この規則は条文に無い**。61条の10には賃金調整の規定が無いので、条文だけを読むと
  //     「13%は賃金と無関係に必ず出る」と読める。**その読みのまま実装すると、よく働いた人に
  //     最大58,640円を「もらえる」と嘘をつく**。ここはその嘘を捕まえる錠前。
  { name: "papa_unpaid", expect: (s) =>
      s.shusshoji === 0 && s.shien === 0 && s.total === 0 &&
      s.showsUnpaidBoth && !s.failed },
  // ★14日の崖(61条の10第1項2号): 13日では13%が**1円も出ない**。
  //   67%は13日分(87,100円)出るが13%は0円 → 合計87,100円。**あと1日で18,200円乗る**ことを画面が言う。
  { name: "papa_13days", expect: (s) =>
      s.shusshoji === 87100 && s.shien === 0 && s.total === 87100 &&
      s.showsOwnDaysReason && s.showsCliffHint && !s.failed },
  // ★免除に当てはまらない人(子が養子など)は、配偶者が14日以上取らないと13%は0円(1項3号)
  { name: "papa_no_exempt", expect: (s) =>
      s.shusshoji === 93800 && s.shien === 0 && s.showsSpouseReason && !s.failed },
  // ★28日で頭打ち(61条の8第2項2号)＋上限に張りつく人(月給60万 → 16,110円)。
  //   67%: 16,110×28×0.67 = **302,223円** / 13%: 16,110×28×0.13 = **58,640円**(どちらも厚労省の公表値)
  //   40日と入力しても支給は28日 → 180日枠を食うのも28日なので残り**152日**
  { name: "papa_cap", expect: (s) =>
      s.daily === 16110 && s.shusshoji === 302223 && s.shien === 58640 && s.total === 360863 &&
      s.remaining67 === 152 && s.showsCap && s.showsDaysCap && !s.failed },
  // 参照データが配信できないときは、金額を出さずに断る(fail closed)
  { name: "papa_nodata", data404: "kihonteate_r07.json",
    expect: (s) => s.failed && s.total === null },

  // ── 住宅ローン控除(/jutaku/) 措置法41条・国税庁 No.1211-1 ──────────────────
  // ★期待値は jutaku_core.js を一切通さず、国税庁が No.1211-1 で公表する控除限度額と条文の率から積む。
  //   認定住宅・令和6年(一般)・年末残高4,500万 → 借入限度額4,500万 × 0.7% = **31.5万円/年**、控除期間13年。
  //   総控除額の上限概算 = 315,000 × 13 = **4,095,000円**(残高一定と仮定した天井。実際は毎年減る)。
  { name: "jutaku", expect: (s) =>
      s.nenkan === 315000 && s.kikan === 13 && s.soKoujo === 4095000 &&
      s.showsGaisan && !s.failed },
  // ★★このツールの主役の事実: 「その他の住宅」を令和6年に入居した人は**原則0円**(借入限度額0円)。
  //   ローンを組んでも1円も戻らないという事実と、経過措置という逃げ道を、必ず画面に出すこと。
  //   ページが year/kubun を渡し忘れて別区分で計算すれば0円が21万円に化けてここで落ちる。
  { name: "jutaku_sonota_r6", expect: (s) =>
      s.zero && s.showsSonotaZero && s.showsKeikaHint && s.nenkan === null && !s.failed },
  // ★経過措置に該当 → 借入2,000万・控除期間10年・14万円/年で復活。経過措置フラグの渡し忘れを捕まえる
  { name: "jutaku_keika", expect: (s) =>
      s.nenkan === 140000 && s.kikan === 10 && s.soKoujo === 1400000 &&
      s.showsKeikaApplied && !s.failed },
  // ★★子育て世帯・若者夫婦世帯の上乗せ(令和6年入居のみ)。認定4,500万→5,000万 → 35万円/年。
  //   特例フラグの渡し忘れで上乗せが消えると31.5万円になってここで落ちる。
  { name: "jutaku_tokurei", expect: (s) =>
      s.nenkan === 350000 && s.showsTokurei && !s.failed },
  // ★中古(既存住宅・No.1211-3)は新築と別レジーム。認定住宅等・令和6年・残高4,500万 →
  //   借入限度3,000万 × 0.7% = **21万円/年**、控除期間**10年**、総額概算 21万×10 = **210万円**。
  //   ページが type を渡し忘れて新築で計算すると 31.5万/13年 に化けてここで落ちる。
  { name: "jutaku_chuko", expect: (s) =>
      s.nenkan === 210000 && s.kikan === 10 && s.soKoujo === 2100000 &&
      s.showsChuko && !s.failed },
  // ★★中古の主役の事実: 「その他の住宅」でも0円にならない(新築との決定的な違い)。
  //   中古・その他・令和6年・残高3,000万 → 借入限度2,000万 × 0.7% = **14万円/年**、10年。**0円ではない**。
  { name: "jutaku_chuko_sonota", expect: (s) =>
      s.nenkan === 140000 && s.kikan === 10 && !s.zero && s.showsChuko && !s.failed },
  // ★★令和8年(2026)入居の再編(令和8年法律第12号): 中古・認定は3,500万・13年＋子育て上乗せが中古にも効く(→4,500万)。
  //   中古・認定・令和8年・残高6,000万・特例あり → 4,500万 × 0.7% = **31.5万円/年**・**13年**・総額 **4,095,000円**。
  //   旧・中古表(3,000万・10年・上乗せ無し)のままだと 21万/10年 に化けてここで落ちる。
  { name: "jutaku_r8_chuko_tokurei", expect: (s) =>
      s.nenkan === 315000 && s.kikan === 13 && s.soKoujo === 4095000 &&
      s.showsChuko && s.showsTokurei && !s.failed },
  // ★令和9年(2027)入居＝令和8年と同値(2026-07-20 条文確認)。新築・省エネ・特例あり・残高4,000万 →
  //   上乗せ3,000万 × 0.7% = **21万円/年**・**13年**・総額 **2,730,000円**。
  //   2027年の収録漏れなら「収録範囲の外です」、令和6・7年の上乗せ表(4,000万)を誤って引けば28万円に化けてここで落ちる。
  { name: "jutaku_r9_shoene_tokurei", expect: (s) =>
      s.nenkan === 210000 && s.kikan === 13 && s.soKoujo === 2730000 &&
      s.showsTokurei && !s.failed },
  // ★増改築(No.1211-4)は計算方法がまるごと違う → 黙って答えず「この計算機では計算できません」と断る
  { name: "jutaku_zokaichiku", expect: (s) =>
      s.showsCannotCompute && s.nenkan === null && !s.failed },
  // 参照データが配信できないときは、控除額を出さずに断る(fail closed)。
  // ★黙って答えると、戻らない金額を「戻る」と信じて資金計画を誤らせる
  { name: "jutaku_nodata", data404: "jutaku_r07.json",
    expect: (s) => s.failed && s.nenkan === null },
  // ── ★実際に戻る税額(総務省「所得税から住宅ローン控除額を引ききれなかった方」) ──────────
  // 期待値は jutaku_core.js を通さず、控除枠と条文の率(5%・97,500円)から手で積む。
  // 控除枠315,000・所得税25万・課税総所得600万 → 所得税から25万＋住民税から6.5万 = **31.5万円**が満額戻る(切り捨て0)。
  { name: "jutaku_refund", expect: (s) =>
      s.showsRefund && s.jitsuGenzei === 315000 && s.refundShotokuzei === 250000 &&
      s.refundJuminzei === 65000 && s.kirisute === null && !s.showsCapUnknown && !s.failed },
  // ★★控除枠315,000だが所得税7.5万・課税総所得150万 → 住民税上限は5%側の75,000で頭打ち。
  //   実還付150,000・切り捨て165,000。★課税総所得の渡し忘れ(97,500に化ける)をこのシーンが捕まえる。
  { name: "jutaku_refund_capped", expect: (s) =>
      s.showsRefund && s.jitsuGenzei === 150000 && s.refundShotokuzei === 75000 &&
      s.refundJuminzei === 75000 && s.kirisute === 165000 && !s.showsCapUnknown && !s.failed },
  // ★課税総所得を入れない → 上限97,500で概算し、その旨を名乗る(fail closed)。実還付172,500・切り捨て142,500。
  { name: "jutaku_refund_nocap", expect: (s) =>
      s.showsRefund && s.jitsuGenzei === 172500 && s.refundJuminzei === 97500 &&
      s.showsCapUnknown && !s.failed },
];

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
               ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8" };

let received = null;
let onReceived = null;   // 結果が届いた瞬間にシーンを終わらせる(下記)
let slowHolidays = false;
let holidayMode = null; // null=そのまま | "404"=配信失敗 | "stale"=2025年までしか無い
let data404 = null;     // 指定したJSONファイルだけ配信失敗させる(参照データ全般)

const server = createServer(async (req, res) => {
  const [rawPath, query] = req.url.split("?");
  const path = decodeURIComponent(rawPath);
  if (path === "/__state" && req.method === "POST") {
    let b = ""; for await (const c of req) b += c;
    received = JSON.parse(b);
    res.writeHead(204); res.end();
    onReceived?.();   // シーンの答えは出た。Chromeの終了を待たない
    return;
  }
  // ハーネス自身の照合用フェッチ(?raw=1)は素通し。ツール側のfetchだけを細工する。
  // 遅延・配信失敗は**参照データ全般**に効かせる(祝日JSONだけの細工にしていると、
  // 新しい参照データ=税額表などを足したときに「待っているか」を試せない)
  const isToolDataFetch = /\/assets\/[\w.-]+\.json$/.test(path) && !/raw=1/.test(query || "");
  if (isToolDataFetch) {
    if (slowHolidays) await new Promise((r) => setTimeout(r, 800));
    if (data404 && path.endsWith(data404)) { res.writeHead(404); res.end("not found"); return; }
  }
  const isToolHolidayFetch = path.endsWith("holidays_jp.json") && !/raw=1/.test(query || "");
  if (isToolHolidayFetch) {
    if (holidayMode === "404") { res.writeHead(404); res.end("not found"); return; }
    if (holidayMode === "stale") {
      const all = JSON.parse(await readFile(join(ROOT, "docs/assets/holidays_jp.json"), "utf8"));
      const only2025 = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("2025")));
      res.writeHead(200, { "content-type": MIME[".json"] });
      res.end(JSON.stringify(only2025));
      return;
    }
  }
  const file = path.endsWith("/") ? join(path, "index.html") : path;
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/plain" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;

const only = process.env.E2E_ONLY;
const fails = [];
const covered = new Map(); // ページ → 正常条件で駆動したシーン名

for (const sc of SCENES.filter((s) => !only || s.name === only)) {
  slowHolidays = !!sc.slow;
  holidayMode = sc.holidays || null;
  data404 = sc.data404 || null;
  received = null;
  const url = `http://127.0.0.1:${port}/tools/e2e/harness.html?scene=${sc.name}`;
  // Chromeのuser-data-dirは**毎回使い捨て**にする(2026-07-13 第15便)。
  // 以前は `tools/e2e/.chrome-<シーン名>` を使い回していたが、これには2つ問題があった:
  //   1. 同じ名前なので**2つ目の実行が1つ目のプロファイルを奪い合う**。うっかり全数実行を
  //      並走させたら全部が停滞し、中断で**壊れたプロファイルが36個(513MB)残った**
  //   2. 壊れたプロファイルは次の実行でも**そのまま開かれる**ので、Chromeが復旧を試みて
  //      起動が数分に劣化する。テストが自分の残骸で遅くなっていく
  // 使い捨てなら、並走しても衝突せず、前回の残骸も引きずらない(リポジトリも汚れない)。
  const dir = await mkdtemp(join(tmpdir(), "keiri-e2e-"));
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                `--user-data-dir=${dir}`, "--window-size=1280,1000",
                "--virtual-time-budget=20000", "--dump-dom", url];
  // **結果のPOSTが届いた時点でシーンは終わり**。Chromeの終了は待たない(2026-07-13 第15便)。
  // --headless=new --dump-dom の Chrome は**自分から終了しないことがある**(実測: 149系で
  // 全シーンが終了せず、毎回 60 秒の SIGKILL まで待っていた)。判定自体は1秒で済んでいるのに
  // **1シーン60秒 × 36シーン = 36分**かかり、**通しで走らせるのが現実的でなくなっていた**。
  // 全数実行を誰もやらなくなった結果が第14便の全損見逃し(社会保険料にシーンが無いことに
  // 7便気付かなかった)。**遅すぎる検査は、いずれ走らされなくなって存在しないのと同じになる**。
  const p = spawn(CHROME, args, { stdio: "ignore" });
  const exited = new Promise((r) => p.on("exit", r));
  try {
    await new Promise((ok, ng) => {
      const done = () => { clearTimeout(kill); onReceived = null; ok(); };
      const kill = setTimeout(done, 60_000);   // 何も返らないまま黙り込んだとき用
      onReceived = done;                       // 通常はこちらで抜ける
      p.on("exit", done);                      // 先に落ちたら received=null → 失敗として報告される
      p.on("error", (e) => { clearTimeout(kill); onReceived = null; ng(e); });
    });
  } finally {
    p.kill("SIGKILL");
    await exited;   // **死にきるまで待ってから消す**。死ぬ途中のChromeはまだプロファイルに
                    // 書き込んでいるので、先に消すと ENOTEMPTY で落ちる(実際に踏んだ)
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  const s = received || { error: "ハーネスから状態が返らなかった(描画前に落ちた可能性)" };
  const ok = !s.error && sc.expect(s);
  // 「正常条件で正しい答えが出た」シーンだけを網羅とみなす(下の coverage 参照)。
  // 配信失敗・遅延を再現するシーンは、壊れたツールでも通ってしまうので数えない
  const normal = !sc.data404 && !sc.holidays && !sc.slow;
  if (ok && normal && s.page) {
    if (!covered.has(s.page)) covered.set(s.page, []);
    covered.get(s.page).push(sc.name);
  }
  console.log(`${ok ? "✅" : "❌"} ${sc.name}`);
  if (!ok) {
    fails.push(sc.name);
    // 「期待と違う」だけでは直せない。実際に画面に何が出ていたかを必ず見せる
    console.error("   ↳ " + JSON.stringify(s, null, 2).split("\n").join("\n   "));
  }
}

server.close();

// ── 網羅チェック: 計算ツールを1つもE2Eで触っていない状態を許さない ──────────────
// 2026-07-13 第14便: 需要が最大の看板ツール(社会保険料)だけE2Eシーンが**1つも無く**、
// 「料率は届いているのに『読み込めませんでした』と言い続ける」全損を**本番で放置**していた。
// 他の7ツールにはシーンがあったので、抜けは「作り忘れ」でしか起こらない = 機械で塞ぐ。
//
// **失敗再現シーン(404/遅延)は網羅に数えない**。壊れたツールでも通るため:
// 実際 shaho_nodata は「常に読み込み失敗と言う」壊れた状態で**緑のまま**だった。
// 数えるのは「正常条件で、正しい答えを出した」シーンだけ。
if (!only) {
  const toolPages = [];
  for (const d of await readdir(join(ROOT, "docs"), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const idx = join(ROOT, "docs", d.name, "index.html");
    let html;
    try { html = await readFile(idx, "utf8"); } catch { continue; }
    // 計算ツール = assets/*_core.js を読み込んで計算しているページ(記事・about等は除外)
    if (/assets\/[a-z_]+_core\.js/.test(html)) toolPages.push(`/docs/${d.name}/`);
  }
  const uncovered = toolPages.filter((p) => !covered.has(p));
  if (uncovered.length) {
    console.error(`\n❌ E2Eシーンが無い計算ツール: ${uncovered.join(", ")}`);
    console.error("   正常条件で正しい答えが出ることを確かめるシーンを tools/e2e/harness.html に足すこと");
    fails.push(...uncovered.map((p) => `coverage:${p}`));
  } else {
    console.log(`\n📋 計算ツール ${toolPages.length}件すべてに正常系シーンあり`);
  }
}

if (fails.length) {
  console.error(`\n❌ 失敗: ${fails.join(", ")}`);
  process.exit(1);
}
console.log("\nall e2e scenes passed");
