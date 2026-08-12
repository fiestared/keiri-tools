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
  // 手数料(550円) > 請求額(300円) → マイナスの振込額を黙って出さず、警告を出すこと
  { name: "senpou_fee_over", expect: (s) =>
      /振込額がマイナスになります/.test(s.result) && /当方負担/.test(s.result) },
  // 最低賃金: 47都道府県が描かれ、時給1,100円(東京1,226円)が「下回っている」と出ること
  { name: "saitei_hourly", expect: (s) =>
      s.options > 45 && /1226/.test(s.prefBox) && /下回っています/.test(s.out) &&
      /126/.test(s.out) && s.tableRows === 47 && /答申/.test(s.nextBox) },
  // 月給196,000円(240日×8h)は東京の最低賃金割れ。「上回っています」と出たら換算の分母が誤り
  { name: "saitei_monthly", expect: (s) =>
      /下回っています/.test(s.out) && !/上回っています/.test(s.out) && /160時間/.test(s.out) },
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
  // ★厚年の上限(650,000円)に張り付く帯。公式額表と1円まで一致することに加え、
  //   上限であることと**2027-09以降の段階的引上げ**を画面が申告しているか。
  //   注記の額はデータ(kosei_grade_cap)から描いているので、データを差し替えれば注記も動く
  //   ＝ページに650,000を手書きしていないことの確認でもある
  { name: "shaho_cap", expect: (s) =>
      s.self === s.expected && s.self === 98758 && !s.failed &&
      s.capNote && s.capNote.showsCap && s.capNote.showsSchedule && s.capNote.saysCurrent },

  // ★健保の年度累計573万円上限。ページが calcBonus に年度累計を渡していないと、
  //   core が正しくてもここだけが落ちる(単体テストでは緑のまま通ってしまう型のバグ)。
  //   既払500万 → 健保の残枠73万。賞与300万の本人負担は 174,041 + 雇用保険15,000 = 189,041円。
  //   渡し忘れていた頃は 303,450円(114,409円の過大)を出していた。
  { name: "shaho_bonus_yearcap", expect: (s) =>
      s.bonusSelf === s.expectedBonusSelf && s.bonusSelf === 189041 && !s.failed },
  // 対照シーン: 初回賞与なら上限に当たらず満額。上の値と必ず違う額になる
  { name: "shaho_bonus_first", expect: (s) =>
      s.bonusSelf === s.expectedBonusSelf && s.bonusSelf === 303450 && !s.failed },

  // ── 失業保険(基本手当) ──────────────────────────────────────────────────
  // 35歳・月30万・勤続12年・自己都合 → 賃金日額10,000円 → 日額6,307円 × 120日 = 756,840円
  { name: "kihonteate", expect: (s) =>
      s.daily === s.expectedDaily && s.daily === 6307 && s.days === 120 &&
      s.total === 6307 * 120 && s.showsRestriction && !s.failed },
  // ★離職理由で変わるのは**日数と給付制限だけ**。日額は1円も変わらない
  { name: "kihonteate_kaisha", expect: (s) =>
      s.daily === s.expectedDaily && s.daily === 6307 && s.days === 240 &&
      s.total === 6307 * 240 && s.showsNoRestriction && !s.failed },
  // 上限額が配信できないときは、額を出さずに断る(fail closed)
  { name: "kihonteate_nodata", data404: "kihonteate_r07.json",
    expect: (s) => s.failed && s.daily === null && s.total === null },

  // ── 再就職手当(就業促進手当) ────────────────────────────────────────────
  // 35歳・月30万・勤続12年・自己都合 → 日額6,307円/120日。残90日は3分の2(80日)以上なので70%。
  // 6,307 × 90 × 7/10 = 397,341円。定着手当の上限は同じ日額×残日数×2/10 = 113,526円。
  { name: "saishushoku", expect: (s) =>
      s.amount === 397341 && s.amount === s.expectedAmount &&
      s.dailyUsed === 6307 && s.dailyUsed === s.expectedDailyUsed &&
      s.prescribed === 120 && s.rate === 70 &&
      s.teichaku === 113526 && s.saysNotCapped && !s.saysCapped && !s.failed },
  // ★上限が効く例＝このツールの存在理由。45歳・月60万・会社都合・勤続20年以上(330日)。
  //   基本手当日額9,110円が**6,745円で頭打ち**になり、1,558,095円。上限を無視すると2,104,410円。
  //   ★同時に「給付制限が無い人に紹介要件を課していない」ことの検査でもある
  //   (会社都合なので cond-introduced は無効のまま＝チェックせずに金額が出ること)。
  { name: "saishushoku_cap", expect: (s) =>
      s.amount === 1558095 && s.amount === s.expectedAmount &&
      s.dailyUsed === 6745 && s.dailyUsed === s.expectedDailyUsed &&
      s.prescribed === 330 && s.rate === 70 &&
      s.saysCapped && !s.failed },
  // ★支給残日数が3分の1未満(120日の3分の1=40日に対し39日) → 1円も出さない。
  //   金額を出してしまう実装なら amount が拾えるので、null であることが検査になる。
  { name: "saishushoku_toofew", expect: (s) =>
      s.saysTooFew && s.amount === null && s.rate === null && !s.failed },
  // ★要件を1つもチェックしていない = 不明。「満たしている」と読み替えて確定させないこと。
  { name: "saishushoku_unmet", expect: (s) =>
      s.saysUnmet && s.amount === null && !s.failed },
  // 上限額が配信できないときは、額を出さずに断る(fail closed)
  { name: "saishushoku_nodata", data404: "kihonteate_r07.json",
    expect: (s) => s.failed && s.amount === null && s.dailyUsed === null },

  // ── 高額療養費 ────────────────────────────────────────────────────────
  // ★期待値は**協会けんぽ／自サイトの記事が公表している実額**。区分ウ・医療費100万 → 87,430円。
  //   基準額80,100・起点26.7万・1%・50銭の四捨五入の**どれか1つでも間違っていたらこの額にならない**。
  { name: "kogaku", expect: (s) =>
      s.kubun === "ウ" && s.declaredStd === 300000 &&
      s.limit === 87430 && s.limit === s.expectedLimit &&
      s.refund === 212570 && s.refund === s.expectedRefund &&
      s.totalSelf === 300000 && s.finalBurden === 87430 &&
      s.manyLimit === 44400 && s.excludedCount === null && !s.failed },
  // ★世帯合算の21,000円未満は1円も拾わない。**外れた行は医療費の側にも入れない**
  //   (入れると限度額が87,930円になり支給額が500円過大)。画面が外れた行を名指しすること。
  { name: "kogaku_gassan", expect: (s) =>
      s.totalMedical === 1000000 && s.totalMedical === s.expectedMedical &&
      s.limit === 87430 && s.limit === s.expectedLimit &&
      s.excludedCount === 1 && s.excludedSelf === 15000 &&
      s.finalBurden === 87430 + 15000 && !s.failed },
  // ★1%の起点の読替え。医療費10万の月でも限度額は80,100円ちょうど(78,430円ではない)
  { name: "kogaku_small", expect: (s) =>
      s.limit === 80100 && s.limit === s.expectedLimit &&
      s.totalSelf === 30000 && s.refund === 0 && !s.failed },
  // ★令和9年8月からの13区分。標報44万は旧5区分だと区分ウ(92,940円)に落ちるので、
  //   境界を流用したままなら limit が 92,940 になってここで落ちる。正しくは 116,720円。
  //   ★enacted:false の表なので、画面が「予定」と断っていること(断らなければ予定額が確定額の顔で出る)。
  { name: "kogaku_r0908", expect: (s) =>
      s.declaredStd === 440000 &&
      s.kubunLabel13 === "標報44万〜50万円" && s.kubun === null &&
      s.limit === 116720 && s.limit === s.expectedLimit &&
      s.refund === 300000 - 116720 && s.refund === s.expectedRefund &&
      s.finalBurden === 116720 && s.manyLimit === 44400 &&
      s.annualCap === 530000 && s.annualCap === s.expectedAnnualCap &&
      s.saysPlanned && !s.failed },
  // ★70歳以上の目玉: 外来(通院)だけの人に**世帯上限を当てない**。一般区分・自己負担3万円 →
  //   外来上限22,000円で頭打ち → 8,000円戻る。世帯上限61,500円を当てると「支給0円」と答える。
  //   足切り21,000円が70歳未満だけの規律であることも画面が言っていること。
  { name: "kogaku_over70", expect: (s) =>
      s.kubunLabel === "一般" && s.gairaiLimit === 22000 && s.gairaiLimit === s.expectedGairaiLimit &&
      s.limit === 61500 && s.limit === s.expectedLimit &&
      s.refund === 8000 && s.refund === s.expectedRefund &&
      s.finalBurden === 22000 && s.finalBurden === s.expectedBurden &&
      s.totalSelf === 30000 && s.saysNoFloor &&
      /令和8年8月/.test(s.tableLabel || "") && !s.failed },
  // ★二段階の両方が効く: ①外来8,000 ＋ ②世帯20,500 ＝ 28,500円。内訳を画面に出すこと
  //   (出さないと、外来だけで戻った分が世帯上限のせいに見える)。
  { name: "kogaku_over70_nyuin", expect: (s) =>
      s.gairaiRefund === 8000 && s.gairaiRefund === s.expectedGairaiRefund &&
      s.householdRefund === 20500 && s.householdRefund === s.expectedHouseholdRefund &&
      s.refund === 28500 && s.refund === s.expectedRefund &&
      s.finalBurden === 61500 && s.finalBurden === s.expectedBurden && !s.failed },
  // ★外来上限は個人ごと。本人3万＋配偶者3万 → 各自22,000で頭打ち → 世帯44,000(<61,500)。
  //   世帯でまとめて1回だけ当てると戻る額が過大になる。ここは世帯上限が効かないので、
  //   ①を落とすと**支給0円**になる = 二段階の順序そのものの錠前。
  { name: "kogaku_over70_kojin", expect: (s) =>
      s.refund === 16000 && s.refund === s.expectedRefund &&
      s.finalBurden === 44000 && s.finalBurden === s.expectedBurden &&
      s.totalSelf === 60000 && s.totalSelf < s.limit && !s.failed },
  // ★現役並みには外来特例が無い(41条の2ただし書)。85,800＋(100万−28.6万)×1% = 92,940円
  { name: "kogaku_over70_geneki", expect: (s) =>
      s.kubunLabel === "現役並みⅠ" && s.gairaiLimit === null && s.saysGenekinamiNoGairai &&
      s.limit === 92940 && s.limit === s.expectedLimit &&
      s.refund === 207060 && s.refund === s.expectedRefund && !s.failed },
  // ★低所得者Ⅰに多数回該当は無い。黙って据え置かず画面で申告する(限度額は15,700円のまま)
  { name: "kogaku_over70_teisho1", expect: (s) =>
      s.kubunLabel === "低所得者Ⅰ" && s.limit === 15700 && s.limit === s.expectedLimit &&
      s.saysNoTasukai && s.gairaiLimit === 8000 && !s.failed },
  // ★一般で標報15万円以下 → 世帯の年間上限が41万円。標報の入力欄を隠すと辿り着けなくなる箇所
  { name: "kogaku_over70_nenkan", expect: (s) =>
      s.declaredStd !== null && s.declaredStd <= 150000 &&
      s.hAnnual === 410000 && s.hAnnual === s.expectedHAnnual &&
      s.gAnnual === 216000 && s.limit === 61500 && !s.failed },
  // ★7月診療分は旧表(外来18,000／世帯57,600)。新表を当てると 12,000円 が 8,000円 になる
  { name: "kogaku_over70_old", expect: (s) =>
      s.gairaiLimit === 18000 && s.gairaiLimit === s.expectedGairaiLimit &&
      s.limit === 57600 && s.limit === s.expectedLimit &&
      s.refund === 12000 && s.refund === s.expectedRefund &&
      s.gAnnual === 144000 && s.hAnnual === null &&
      /令和8年7月/.test(s.tableLabel || "") && !s.failed },
  // 限度額の表が配信できないときは、額を出さずに断る(fail closed)
  { name: "kogaku_nodata", data404: "kogaku_r08.json",
    expect: (s) => s.failed && s.limit === null && s.refund === null },
  // ★令和8年8月診療分から限度額が上がる(厚労省・協会けんぽが公表)。診療年月で表を選び分けること。
  //   旧表のままだと87,430円が出る。**5,510円 低い誤答**なので、ここは実額で固定する。
  //   あわせて、年間上限53万円(8月〜翌7月・あとから申請して償還払い)を画面が出していること
  //   ——年間上限は月額の限度額を下げないので、92,940円が下がっていないことも同時に見る。
  { name: "kogaku_r0808", expect: (s) =>
      s.kubun === "ウ" && s.limit === 92940 && s.limit === s.expectedLimit &&
      s.refund === 207060 && s.refund === s.expectedRefund &&
      /令和8年8月/.test(s.tableLabel || "") &&
      s.annualCap === 530000 && s.annualCap === s.expectedAnnualCap &&
      s.annualPeriod === "2026年8月 診療分 〜 2027年7月 診療分" &&
      s.saysRetrospective && !s.failed },
  // ★収録範囲(supported_through)の外は額を出さずに断る。令和9年8月の表には終期が公表されて
  //   いないので、実装の1年先で切ってある。近い期間の表で代用した額を出さないこと。
  { name: "kogaku_period", expect: (s) =>
      s.saysPeriod && s.limit === null && s.refund === null &&
      s.kubun === null && s.kubunLabel13 === null && !s.failed },

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
  //   2026年寄附＝令和9年度住民税＝**令和8年分の所得**なので令和8年度改正を適用した値
  //   (2026-07-21修正。改正前の62,283円は3,625円過大＝利用者に自腹を切らせる危険側だった)。
  //   年収500万・独身・社保70万 → 所得割240,500円 → 限度額**58,658円**。
  //   基礎控除104万(62万+加算42万)で所得税率が5%帯へ下がり割合が84.895%になる。
  //   **58,658円が出ること自体が「令和8年度改正＋附則5条の6の読替えが両方効いている」証明**。
  { name: "furusato", expect: (s) =>
      s.gendo === 58658 && s.shotokuwari === 240500 && s.showsRitsu && !s.failed },
  // ★限度額ちょうど寄附すると自己負担は2,000円に収まる。これは限度額の定義そのもので、
  //   給与所得・調整控除・割合・20%上限・端数のどれか1つでも狂うとこの額にならない
  //   (この入力では1,999円。市・県別々の1円未満切上げで最大2円多く戻る＝2,000円は超えない)
  { name: "furusato_gendo", expect: (s) => s.gendo === 58658 && s.jikoFutan === 1999 && !s.failed },
  // ★超えた分は自腹。8万円寄附 → 自己負担は2,000円ではなく20,119円になることを画面が言う
  { name: "furusato_over", expect: (s) =>
      s.jikoFutan === 20119 && s.showsOver && !s.failed },
  // ★社保が空欄なら年収から概算し、**その金額と前提を画面に出す**(黙って勝手な社保で答えない)
  { name: "furusato_gaisan", expect: (s) =>
      s.gendo === 57174 && s.showsGaisan && !s.failed },
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
  // ★★同型の実バグ2号(2026-07-19レビュー): 本人が障害者・給与190万(給与所得125万≦135万)は
  //   地税295条1項2号で住民税が非課税＝限度額0円。ページが honninShogai を配線していなかったので
  //   「本人である」に印を付けても正の限度額を出していた。coreは正しくページの配線が欠けていた
  { name: "furusato_honnin_shogai", expect: (s) =>
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
  // ★★年少扶養（16歳未満）は扶養控除が0円でも**非課税限度額の人数に入る**。
  //   収入170万・扶養1人 → 措法29条の4（令和8・9年は給与所得控除が定額74万円）で
  //   給与所得 1,700,000−740,000＝960,000。1級地・扶養1人の均等割の非課税限度額
  //   1,010,000円以下なので**まるごと非課税**になる。
  //   ★2026-08-08: 措法29条の4（令和8年法律第12号・令和8年12月1日施行）が
  //     データに入って所得が下がり、この結論が「均等割のみ5,000円」から
  //     「非課税0円」へ変わった。条文を e-Gov の将来施行版で実読して確認済み。
  { name: "juminzei_nensho", expect: (s) =>
      s.total === 0 && s.hikazei && s.kintouGendo === "1,010,000" && !s.failed },
  // ↑の対照。同じ収入でも子がいなければ非課税限度額が下がり、31,500円(=所得割26,500+均等割5,000)。
  // **この2シーンの差31,500円が「扶養控除0円なのに効く」ことの証明**(片方だけでは何も言えない)
  { name: "juminzei_nensho_nashi", expect: (s) =>
      s.total === 31500 && s.shotokuwari === 26500 && s.kintouwari === 5000 &&
      !s.hikazei && !s.failed },
  // ★「均等割だけかかる」帯。上の nensho が非課税に変わったことで、
  //   この経路を見るシーンが無くなったので足した（収入180万・扶養1人 → 所得1,060,000。
  //   均等割の限度額1,010,000は超え、所得割の限度額1,120,000は超えない）。
  { name: "juminzei_kintou_nomi", expect: (s) =>
      s.total === 5000 && s.shotokuwari === 0 && s.kintouwari === 5000 &&
      s.showsKintouOnly && !s.hikazei && !s.failed },
  // ★超過課税。横浜市は市3,900+県1,300+森林環境税1,000 = **6,200円**(横浜市の公表額と一致)。
  //   所得割は指定都市の8%:2% に神奈川県の超過課税(+0.025%)が乗る → 241,107円
  { name: "juminzei_yokohama", expect: (s) =>
      s.total === 247307 && s.shotokuwari === 241107 && s.kintouwari === 6200 && !s.failed },
  // ★ひとり親の父/母(2026-07-19レビュー)。控除30万円は同じでも人的控除差が母5万/父1万なので、
  //   調整控除を通じて住民税が2,000円違う。ページが一律「母」で配線していた(父の住民税が過小)。
  //   期待値の鎖は harness.html のシーン定義のコメントに全部書いた
  { name: "juminzei_hitorioya_haha", expect: (s) =>
      s.total === 143000 && s.shotokuwari === 138000 && !s.failed },
  { name: "juminzei_hitorioya_chichi", expect: (s) =>
      s.total === 145000 && s.shotokuwari === 140000 && !s.failed },
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
  // ★★低所得の主役: 年収160万・医療費6万 → 足切り43,000(5%側)・控除額17,000。「10万円は下限ではない」。
  //   足切りを一律10万に実装していたら控除額0になってここで落ちる（記事の目玉の逆）。
  //   ★このシーンは令和8年分(措法29条の4・最低保障74万)の錠前も兼ねる: ページが zeisei:"r8" を
  //     渡さなくなると総所得が95万に戻り足切り47,500・控除12,500になって落ちる（R7規則への黙った後退を捕まえる）。
  { name: "iryohi_lowincome", expect: (s) =>
      s.ashikiri === 43000 && s.kojo === 17000 && !s.failed },
  // ★通常とセルフメディは選択 → 控除額の大きい②を推奨。控除額88,000。
  //   ★足切り12,000・上限88,000の**表示**がデータ由来であることも固定する（2026-07-25 第5便）。
  //     ページに直書きしていると、データを差し替えた日に計算と表示が食い違う。
  { name: "iryohi_selfmed", expect: (s) =>
      s.selfmedKojo === 88000 && s.recommendsSelf && !s.failed
      && s.selfmedFloorShown === 12000 && s.selfmedCapShown === 88000 },
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

  // ── 生前贈与シミュレーター (/seizen-zoyo/) ─────────────────────────
  // ★手計算の鎖は tests/test_seizen_zoyo.mjs S1: 1億・配偶者＋子2・110万×10年×2人・相続まで3年
  //   → 何もしない315万 / 暦年2,413,600(7年加算450万/人・うち帯4年分は100万控除) / 精算課税1,625,000(加算ゼロ)。
  //   「窓の仕分け→加算つき相続税→判定」の配線が1段でも狂えば落ちる。
  { name: "seizen_zoyo", expect: (s) =>
      s.base === 3150000 && s.rek === 2413600 && s.sei === 1625000 &&
      s.best === "相続時精算課税で贈与" && s.showsYear && !s.failed },
  { name: "seizen_zoyo_slow", slow: true, expect: (s) =>
      s.base === 3150000 && s.sei === 1625000 && !s.failed },
  // ★最後の贈与から8年→7年加算圏外: 暦年が精算課税と同額1,625,000まで下がる(gapの配線を検出)。
  { name: "seizen_zoyo_gap8", expect: (s) =>
      s.rek === 1625000 && s.sei === 1625000 && !s.failed },
  // ★贈与者60歳未満 → 精算課税は「選択できません」を明言(相法21条の9)・暦年の数字は出す。
  { name: "seizen_zoyo_no60", expect: (s) =>
      s.seiUnavailable && s.sei === null && s.rek === 2413600 && !s.failed },
  // 参照データ配信不可 → 比較を出さずに断る(fail closed)。
  { name: "seizen_zoyo_nodata", data404: "seizen_zoyo_r08.json",
    expect: (s) => s.failed && s.base === null },

  // ── 相続登記の登録免許税 (/sozoku-toki-menkyozei/) ───────────────────
  // ★手計算の鎖は tests/test_toroku_menkyo.mjs S1: 土地12,345,678＋建物5,678,901
  //   → 課税標準18,024,000 → ×0.4%=72,096 → 100円未満切捨て 72,000円。
  //   「行の読み取り→持分→免税判定→2段の端数処理→描画」の配線が1段でも狂えば落ちる。
  // ★初期表示も検査する: 入力行と申請予定日はページ内スクリプトが作るので、
  //   スクショ(file://)では見えず「空の画面」を出していても気づけない。
  { name: "toroku_menkyo", expect: (s) =>
      s.tax === 72000 && s.base === 18024000 && s.exemptCount === null &&
      s.defaultRows === 2 && s.defaultValsFilled &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.defaultApplyDate) &&
      s.showsYear && !s.failed },
  { name: "toroku_menkyo_slow", slow: true, expect: (s) =>
      s.tax === 72000 && s.base === 18024000 && !s.failed },
  // ★免税は1筆ごと判定（措法84条の2の2第2項）: 90万×3筆＝合計270万でも全部免税＝0円。
  //   合計で判定する実装なら 10,800円 になって落ちる。
  { name: "toroku_menkyo_menzei", expect: (s) =>
      s.tax === 0 && s.exemptCount === 3 && s.allExempt && !s.failed },
  // ★持分1/2（登免法10条2項）: 3,000万→課税標準1,500万・60,000円（全体で計算したら120,000円）。
  { name: "toroku_menkyo_mochibun", expect: (s) =>
      s.tax === 60000 && s.base === 15000000 && !s.failed },
  // ★最低税額（登免法19条）: 建物20万→800円だが1,000円。切捨てで0円にしない。
  { name: "toroku_menkyo_saitei", expect: (s) =>
      s.tax === 1000 && s.minApplied && !s.failed },
  // ★申請義務の期限（令和3年法律24号 附則5条6項）: 施行日前に知った→施行日起算で2027-04-01。
  { name: "toroku_menkyo_kigen", expect: (s) =>
      s.deadline === "2027-04-01" && s.usedShikoBi && s.tax === 20000 && !s.failed },
  // ★免税措置の期限後は免税判定しない（期限切れなのに「免税」と答えるのが最も危険な向き）。
  { name: "toroku_menkyo_expired", expect: (s) =>
      s.tax === 2000 && s.expired && s.exemptCount === null && !s.failed },
  // 参照データ配信不可 → 税額を出さずに断る（fail closed）。
  { name: "toroku_menkyo_nodata", data404: "toroku_menkyo_r08.json",
    expect: (s) => s.failed && s.tax === null },

  // ── 不動産売却の税金 (/fudosan-jouto/) ───────────────────────────────
  // ★手計算の鎖は tests/test_jouto.mjs §1・§3・§9: 2021-05-01取得→2026-07-15譲渡。
  //   2026-01-01時点で4年7か月＝短期。建物1,500万木造の減価償却2,092,500 →
  //   取得費32,907,500 → 譲渡所得15,392,500 → 課税15,392,000 → 合計6,099,849。
  //   「1月1日で数える」を落として譲渡日で数えると長期になり、税額がおよそ半分になって落ちる。
  { name: "jouto", expect: (s) =>
      s.goukei === 6099849 && s.kazei === 15392000 &&
      s.shotokuZei === 4617600 && s.juminZei === 1385280 &&
      s.tanki && !s.choki && s.kurikoshi &&
      /4年7か月/.test(s.kikanHyoji) &&
      s.kozoOptions >= 7 && s.defaultJoutoKagaku > 0 && s.defaultShutokuBi &&
      s.showsYear && !s.failed },
  { name: "jouto_slow", slow: true, expect: (s) =>
      s.goukei === 6099849 && s.kazei === 15392000 && !s.failed },
  // ★外部オラクル（国税庁 No.3208 の公表値）: 所得税600万・住民税200万に1円一致すること。
  { name: "jouto_choki", expect: (s) =>
      s.kazei === 40000000 && s.shotokuZei === 6000000 && s.juminZei === 2000000 &&
      s.goukei === 8126000 && s.choki && !s.tanki && !s.kurikoshi && !s.failed },
  // ★軽減税率: 6,000万の判定は3,000万控除の【後】。全額が10%＝600万・住民税4%＝240万。
  { name: "jouto_keigen", expect: (s) =>
      s.kazei === 60000000 && s.kojo === 30000000 &&
      s.shotokuZei === 6000000 && s.juminZei === 2400000 && s.keigen && !s.failed },
  // ★3,000万円控除は短期にも効く（長期でないと使えない、は誤り）。
  { name: "jouto_tanki_kojo", expect: (s) =>
      s.tanki && s.kojo === 30000000 && s.kazei === 10000000 &&
      s.shotokuZei === 3000000 && s.juminZei === 900000 && !s.failed },
  // ★空き家×相続人3人以上 → 控除2,000万（3,000万のままなら課税額が1,000万少なくなって落ちる）。
  { name: "jouto_akiya3", expect: (s) =>
      s.kojo === 20000000 && s.kazei === 50000000 && !s.failed },
  // ★対価1億円超 → 特例そのものが使えない。理由を画面に出す。
  { name: "jouto_akiya_1oku", expect: (s) =>
      s.kojo === null && /1億円を超えている/.test(s.akiyaBlocked) && !s.failed },
  // ★概算取得費5%: 5,000万×5%＝250万が取得費。
  //   課税＝50,000,000−2,500,000（概算）−1,700,000（譲渡費用）＝45,800,000。
  { name: "jouto_gaisan", expect: (s) =>
      s.gaisan && s.kazei === 45800000 &&
      s.shotokuZei === 13740000 && s.juminZei === 4122000 && !s.failed },
  // ★95%上限: 46年経過の木造 → 減価償却は取得価額の95%で頭打ちになり、その旨を表示する。
  { name: "jouto_gendo", expect: (s) =>
      /95%が限度なので頭打ち/.test(s.shokyakuNote) && s.choki && !s.failed },
  // 参照データ配信不可 → 税額を出さずに断る（fail closed）。
  { name: "jouto_nodata", data404: "jouto_r08.json",
    expect: (s) => s.failed && s.goukei === null && s.kazei === null },

  // ── 住民税非課税世帯 (/hikazei-setai/) ────────────────────────────────
  // ★手計算の鎖は tests/test_hikazei_setai.mjs §5: 夫70歳 年金180万＋妻68歳 年金78万
  //   → 夫の合計所得70万（公的年金等控除110万を引く）・限度額101万（妻を扶養）→ 世帯非課税。
  //   「世帯人数の読み取り→年齢と収入→公的年金等控除→扶養の探索→世帯の判定→表の描画」の
  //   配線が1段でも狂えば落ちる。既定の入力行が世帯人数どおりに見えていることも見る。
  { name: "hikazei_setai", expect: (s) =>
      s.hikazei && !s.kazei && s.rows.length === 2 &&
      s.rows[0].shotoku === 700000 && s.rows[0].limit === 1010000 && s.rows[0].hantei === "非課税" &&
      s.rows[1].shotoku === 0 && s.rows[1].hantei === "非課税" &&
      s.border65 === 1550000 && s.borderU65 === 1050000 &&
      s.defaultNenkin > 0 && s.defaultAge > 0 && s.visibleRows === 2 && !s.failed },
  { name: "hikazei_setai_slow", slow: true, expect: (s) =>
      s.hikazei && s.rows[0].shotoku === 700000 && !s.failed },

  // ── インボイス登録番号チェック (/invoice-bangou/) ──────────────────────────
  // ★このツールの本命は一括処理。6行貼って6行描けることを行数で見る
  //   （1件だけ描いて残りを黙って捨てる事故が最も痛い）。
  //   内訳: 桁が合う3件（国税庁の法人番号／PDFの計算例／全角の同一番号）、
  //   法人番号ではない1件、形式の誤り1件（12桁）、空行は数えない。
  { name: "invoice_bangou", expect: (s) =>
      s.total === 5 && s.rows.length === 5 &&
      s.houjin === 3 && s.notHoujin === 1 && s.format === 1 &&
      s.rows[0].formatted === "T7000012050002" &&
      s.rows[1].line === 2 && s.rows[1].formatted === "T8700110005901" &&
      s.hasJitsuzaiNote && s.hasKojinHint &&
      // ★個人事業者の番号を「誤り」と断定していないこと（断定語が無いこと）
      /別の体系/.test(s.kojinHintText) && !/誤りです|不正です|無効です/.test(s.kojinHintText) },
  { name: "invoice_bangou_slow", slow: true, expect: (s) =>
      s.total === 5 && s.houjin === 3 },
  // ★空で押しても白い画面にしない
  { name: "invoice_bangou_empty", expect: (s) => s.empty && !s.total },
  // ★先頭0の13桁は法人番号になりえない（検査用数字は1〜9）。断定はしない
  { name: "invoice_bangou_zero", expect: (s) =>
      s.total === 1 && s.notHoujin === 1 && s.houjin === 0 && s.hasKojinHint },
  // ★境界: 年金155万ちょうど＝合計所得45万＝限度額45万 → 非課税（等号を含むこと）。
  { name: "hikazei_setai_155", expect: (s) =>
      s.hikazei && s.rows.length === 1 && s.visibleRows === 1 &&
      s.rows[0].shotoku === 450000 && s.rows[0].limit === 450000 && !s.failed },
  // ★1万円上は課税。超過額1万円まで描けていること。
  { name: "hikazei_setai_156", expect: (s) =>
      s.kazei && !s.hikazei && s.rows[0].shotoku === 460000 && s.rows[0].choka === 10000 && !s.failed },
  // ★65歳未満は最低保障60万 → 同じ155万でも合計所得887,500円で課税（50万円の差が効く）。
  { name: "hikazei_setai_64", expect: (s) =>
      s.kazei && s.rows[0].shotoku === 887500 && s.borderU65 === 1050000 && !s.failed },
  // ★3級地は限度額38万・年金148万まで。1級地の値を使い回していたら落ちる。
  { name: "hikazei_setai_kyuchi3", expect: (s) =>
      s.hikazei && s.rows[0].limit === 380000 && s.border65 === 1480000 && !s.failed },
  // ★子のアルバイト: 19歳の子が自分で課税 → 世帯は非課税でない（父は非課税のまま）。
  { name: "hikazei_setai_kodomo", expect: (s) =>
      s.kazei && s.rows[1].hantei === "課税" && s.rows[1].shotoku === 500000 &&
      s.rows[0].hantei === "非課税" && !s.failed },
  // ★同じ収入で17歳なら295条1項2号 → 限度額欄は「—」になり世帯非課税に反転する。
  { name: "hikazei_setai_miseinen", expect: (s) =>
      s.hikazei && s.j295 && s.rows[1].limit === null && s.rows[1].hantei === "非課税" && !s.failed },
  // ★扶養の付け替え: 子を1人ずつ分けて両親とも限度額101万 → 世帯非課税＋付け替えの案内が出る。
  { name: "hikazei_setai_tsukekae", expect: (s) =>
      s.hikazei && s.tsukekae && s.rows.length === 4 && s.visibleRows === 4 &&
      s.rows[0].limit === 1010000 && s.rows[1].limit === 1010000 && !s.failed },
  // 参照データ配信不可 → 「非課税世帯にあたります」と答えずに断る（2ファイルとも別々に確かめる）。
  { name: "hikazei_setai_nodata", data404: "hikazei_setai_r08.json",
    expect: (s) => s.failed && !s.hikazei && s.rows.length === 0 },
  { name: "hikazei_setai_nodata2", data404: "juminzei_r08.json",
    expect: (s) => s.failed && !s.hikazei && s.rows.length === 0 },

  // ── 遺留分 (/iryubun/) ───────────────────────────────────────────────
  // ★手計算の鎖は tests/test_iryubun.mjs §6: 遺産1億・配偶者＋子2人
  //   → 総体的遺留分1/2 → 子の個別的遺留分1/8 → 1,250万円。
  //   「家族構成の読み取り→割合→金額→侵害額の3項目→描画」の配線が1段でも狂えば落ちる。
  // ★法定相続分(1/4)と遺留分(1/8)を別の欄に描いていること＝混同したら落ちる。
  { name: "iryubun", expect: (s) =>
      s.santei === 100000000 && s.shingai === 12500000 && s.sotai === "2分の1" &&
      s.rows.length === 2 &&
      s.rows[1].houtei === "4分の1" && s.rows[1].iryubun === "8分の1" &&
      s.rows[0].houtei === "2分の1" && s.rows[0].iryubun === "4分の1" &&
      s.defaultIsan > 0 && /^\d{4}-\d{2}-\d{2}$/.test(s.defaultKaishi) && !s.failed },
  { name: "iryubun_slow", slow: true, expect: (s) =>
      s.santei === 100000000 && s.shingai === 12500000 && !s.failed },
  // ★兄弟姉妹は法定相続分を持つが遺留分は「なし」（1042条1項柱書）。
  //   両方を同じ値で描く実装なら、ここで houtei と iryubun が一致して落ちる。
  { name: "iryubun_kyodai", expect: (s) =>
      s.rows[0].iryubun === "8分の3" && s.kyodaiRow &&
      s.kyodaiRow.houtei === "8分の1" && s.kyodaiRow.iryubun === "なし" &&
      s.kyodaiRow.yen === "なし" && s.meNashi && !s.failed },
  // ★兄弟姉妹だけが相続人 → 遺留分を持つ人が一人もいないと明言する。
  { name: "iryubun_kyodai_only", expect: (s) =>
      s.daremoNashi && s.meNashi && !s.failed },
  // ★贈与の算入（1044条3項）: 遺産6,000万＋特別受益4,000万 → 基礎財産1億・遺留分1,250万。
  //   贈与を足さない配線なら 750万 になって落ちる。
  { name: "iryubun_zoyo", expect: (s) =>
      s.santei === 100000000 && s.shingai === 12500000 && !s.failed },
  // ★1046条2項: 1,250万 −500万 −1,000万 ＋300万 = 50万円（3号だけが加算）。
  { name: "iryubun_shingai", expect: (s) =>
      s.shingai === 500000 && !s.failed },
  // ★施行日前の相続は計算しない（fail closed）。旧条番号1028条を案内すること。
  { name: "iryubun_kyuho", expect: (s) =>
      s.kyuho && s.kyuhoJojo && s.shingai === null && s.santei === null && !s.failed },
  // ★直系尊属のみ（1042条1項1号）: 総体的遺留分3分の1・父母1人あたり1/6。
  //   配偶者がいる場合と同じ2分の1で描いたら落ちる。
  { name: "iryubun_sonzoku", expect: (s) =>
      s.sotai === "3分の1" && s.rows[0].iryubun === "6分の1" &&
      s.shingai === 16666666 && !s.failed },
  // ★時効の目安（1048条）: 知った日2026-05-10＋1年／相続開始2026-04-01＋10年。
  { name: "iryubun_kigen", expect: (s) =>
      s.kigen === "2027-05-10" && s.kigen10 === "2036-04-01" && !s.failed },
  // 参照データ配信不可 → 遺留分を出さずに断る（fail closed）。
  { name: "iryubun_nodata", data404: "iryubun_r08.json",
    expect: (s) => s.failed && s.shingai === null },

  // ── 地震保険料控除 (/jishin-hoken-kojo/) ─────────────────────────────
  // ★手計算の鎖は tests/test_jishin_hoken_kojo.mjs §7: 地震30,000＋旧長期24,000・課税所得400万
  //   → 所得税45,000／住民税は35,000が上限25,000で頭打ち → 節税額11,689円。
  //   住民税を所得税と同じ式（全額・上限5万円）で描く実装なら juminKojo=45,000 で落ちる。
  { name: "jishin_hoken", expect: (s) =>
      s.shotokuKojo === 45000 && s.juminKojo === 25000 &&
      s.shotokuGen === 9000 && s.fukkoGen === 189 && s.juminGen === 2500 &&
      s.setsuzei === 11689 &&
      s.uchiwakeJishinShotoku === 30000 && s.uchiwakeJishinJumin === 15000 &&
      s.srcHasYear && s.srcHasMax && !s.failed },
  { name: "jishin_hoken_slow", slow: true, expect: (s) =>
      s.shotokuKojo === 45000 && s.juminKojo === 25000 && s.setsuzei === 11689 && !s.failed },
  // ★地震だけで上限（50,000）に達している → 旧長期を足しても増えないことを申告する。
  { name: "jishin_hoken_cap", expect: (s) =>
      s.shotokuKojo === 50000 && s.juminKojo === 25000 && s.capNote && !s.failed },
  // ★旧長期だけ20,000円 → 所得税15,000／住民税10,000（住民税の帯は5,000・15,000刻み）。
  { name: "jishin_hoken_kyu", expect: (s) =>
      s.shotokuKojo === 15000 && s.juminKojo === 10000 && !s.failed },
  // ★端数は切り上げ（保険料控除申告書の脚注）。切り捨て実装なら12,500になって落ちる。
  { name: "jishin_hoken_hasu", expect: (s) =>
      s.uchiwakeKyuShotoku === 12501 && !s.failed },
  // ★一の契約が両方に該当 → 有利な方（旧長期15,000＞地震8,000）を選び、差額を出す。
  { name: "jishin_hoken_choice", expect: (s) =>
      s.choiceShown && s.choiceLabel === "旧長期損害保険料" &&
      s.shotokuKojo === 15000 && s.choiceDiff > 0 && !s.failed },
  // 入力が空 → 答えずに促す
  { name: "jishin_hoken_empty", expect: (s) => s.noInput && s.setsuzei === null },
  // 参照データ配信不可 → 控除額を出さずに断る（fail closed）
  { name: "jishin_hoken_nodata", data404: "setsuzei_r08.json",
    expect: (s) => s.failed && s.setsuzei === null },

  // ── 小規模宅地等の特例 (/shokibo-takuchi/) ───────────────────────────
  // ★手計算の鎖は tests/test_shokibo_takuchi.mjs §4: 事業用400平方メートル8,000万
  //   ＋自宅330平方メートル9,900万＋貸付200平方メートル1億
  //   → 貸付を選ばず 400＋330＝730平方メートル を完全併用 → 6,400万＋7,920万＝1億4,320万円。
  //   3号の按分式を常に使う実装なら 7,920万円 になって落ちる（限度面積の式の取り違え）。
  { name: "shokibo_takuchi", expect: (s) =>
      s.reduction === 143200000 && s.before === 279000000 && s.after === 135800000 &&
      s.genkakuJigyo === 64000000 && s.genkakuJutaku === 79200000 &&
      /完全併用/.test(s.pattern || "") &&
      s.hikakuA === 143200000 && s.hikakuB === 79200000 &&
      /64,000,000|6,400万/.test(s.judge || "") &&
      // 法の列挙が実際に画面に出ていること（家なき子6要件・取得者4類型・老人ホーム2条件）
      s.ienakikoCount === 6 && s.ienakikoHasHaigusha &&
      s.shutokushaRows === 4 && s.homeConds === 2 &&
      s.defaultJutakuArea > 0 && s.defaultJutakuValue > 0 && !s.failed },
  { name: "shokibo_takuchi_slow", slow: true, expect: (s) =>
      s.reduction === 143200000 && s.hikakuA === 143200000 && !s.failed },
  // ★逆向き: 貸付の単価が高ければ貸付を選んだ方が得（自宅100平方メートル2,000万＋貸付200平方メートル1億2,000万）
  //   → 貸付200平方メートルで枠を使い切り6,000万円。自宅を常に優先する実装なら1,600万円で落ちる。
  { name: "shokibo_takuchi_kashitsuke", expect: (s) =>
      s.reduction === 60000000 && s.genkakuKashitsuke === 60000000 && s.genkakuJutaku === 0 &&
      /按分式/.test(s.pattern || "") &&
      s.hikakuA === 16000000 && s.hikakuB === 60000000 && !s.failed },
  // ★2項3号の按分がちょうど枠200になる混在: 自宅165＋貸付100 → 2,640万＋2,500万＝5,140万円。
  { name: "shokibo_takuchi_anbun", expect: (s) =>
      s.reduction === 51400000 && s.genkakuJutaku === 26400000 && s.genkakuKashitsuke === 25000000 &&
      /200/.test(s.body) && !s.failed },
  // ★貸付を持っていない人には2案の比較表を出さない（存在しない選択肢を見せない）。
  { name: "shokibo_takuchi_nokashi", expect: (s) =>
      s.reduction === 24000000 && s.hikakuA === null && s.hikakuB === null &&
      /完全併用/.test(s.pattern || "") && !s.failed },
  // ★入力なし → 0円と答えず入力を促す（fail closed）。
  { name: "shokibo_takuchi_empty", expect: (s) =>
      s.noInput && s.reduction === null && !s.failed },
  // 参照データ配信不可 → 減額額を出さずに断る（fail closed）。
  { name: "shokibo_takuchi_nodata", data404: "shokibo_takuchi_r08.json",
    expect: (s) => s.failed && s.reduction === null },

  // ── 固定資産税・都市計画税 (/kotei-shisanzei/) ───────────────────────
  // ★手計算の鎖は tests/test_kotei_shisanzei.mjs §4:
  //   土地1,800万・150平方メートル（住宅1戸）＝固定42,000＋都計18,000／
  //   家屋800万・100平方メートル＝固定112,000＋都計24,000 → 合計196,000円。
  //   都市計画税の特例を固定資産税と同じ6分の1で計算する実装なら土地の都計税が9,000円になって落ちる。
  { name: "kotei_shisanzei", expect: (s) =>
      s.total === 196000 && s.koteiTotal === 154000 && s.toshiTotal === 42000 &&
      s.term1 === 49000 &&
      // 新築の区分の列挙が画面に出ていること（該当しない＋4区分）
      s.shinchikuOptions.length === 5 &&
      s.shinchikuOptions.includes("chouki_chukoso") &&
      // 税率の既定値はコアの定数から描かれている（ページの手書きではない）
      s.rateDefaults.kotei === 1.4 && s.rateDefaults.toshi === 0.3 &&
      s.defaultLandValue > 0 && !s.noInput },
  // ★戸数: 6戸のアパートは200平方メートル×6戸＝1,200平方メートルまで6分の1（一律200で切ると233,300円）
  { name: "kotei_shisanzei_apart", expect: (s) =>
      s.koteiTotal === 140000 && s.toshiTotal === 60000 &&
      s.rows.some((r) => r.join(" ").includes("600㎡")) },
  // ★新築住宅の減額は固定資産税だけ（家屋 112,000→56,000／都計24,000は据え置き）
  { name: "kotei_shisanzei_shinchiku", expect: (s) =>
      s.koteiTotal === 98000 && s.toshiTotal === 42000 &&
      /56,000/.test(s.genkaku || "") && /都市計画税は減額されません/.test(s.body) },
  // ★床面積の10倍で切られたことを画面で申告する
  { name: "kotei_shisanzei_juubai", expect: (s) =>
      /400㎡/.test(s.juubaiNote || "") && /600㎡/.test(s.juubaiNote || "") },
  // ★市街化区域外は都市計画税0円（固定資産税だけが残る）
  { name: "kotei_shisanzei_shigaika", expect: (s) =>
      s.toshiTotal === 0 && s.koteiTotal === 154000 && s.total === 154000 },
  // ★入力なし → 0円と答えず入力を促す（fail closed）
  { name: "kotei_shisanzei_empty", expect: (s) => s.noInput && s.total === null },

  // ── 不動産取得税 (/fudosan-shutoku/) ─────────────────────────────────
  // ★手計算の鎖は tests/test_fudosan_shutoku.mjs §3:
  //   宅地1,200万・150平方メートル＋新築住宅1,500万・100平方メートル（2026-07-01取得）
  //   → 家屋90,000円／土地は減額240,000円が税額180,000円を上回り0円 → 合計90,000円。
  //   減額の単価に宅地1/2の読替えを忘れた実装なら減額が480,000円になって落ちる。
  { name: "fudosan_shutoku", expect: (s) =>
      s.total === 90000 && s.houseTax === 90000 && s.landTax === 0 &&
      /240,000/.test(s.genkaku || "") &&
      // 宅地1/2の読替えを画面で申告していること（見出しではなく申告文の要素を読む）
      /1\/2読替え後/.test(s.genkakuHanbun || "") &&
      // 家屋の区分の列挙が画面に出ていること（土地だけ＋新築＋中古＋住宅以外）
      s.kindOptions.length === 4 && s.kindOptions.includes("hijutaku") &&
      // 取得日のヒントはコアの定数から描かれている（ページの手書きではない）
      /16万|160,000/.test(s.dateHint) && /40㎡/.test(s.dateHint) &&
      !s.noInput },
  // ★令和8年度改正の境界: 45平方メートルは改正前なら控除なし＝450,000円
  { name: "fudosan_shutoku_kaiseimae", expect: (s) =>
      s.houseTax === 450000 && /50㎡以上/.test(s.dateHint) && /100,000|10万/.test(s.dateHint) },
  // ★同じ45平方メートルでも改正後は1,200万円の控除が付く＝90,000円
  { name: "fudosan_shutoku_kaiseigo", expect: (s) =>
      s.houseTax === 90000 && /40㎡以上/.test(s.dateHint) },
  // ★住宅以外の家屋は4％（1,500万×4％＝600,000円）。一律3％なら450,000円で落ちる
  { name: "fudosan_shutoku_hijutaku", expect: (s) => s.houseTax === 600000 },
  // ★収録範囲外 → 家屋の税額を出さず、合計も金額にしない（fail closed）
  { name: "fudosan_shutoku_hanigai", expect: (s) =>
      s.total === null && /出せません/.test(s.uncomputable || "") &&
      /2017-04-01/.test(s.uncomputableRiyu || "") &&
      // 土地の計算は範囲内なので出る
      s.landTax !== null },
  // ★入力なし → 0円と答えず入力を促す（fail closed）
  { name: "fudosan_shutoku_empty", expect: (s) => s.noInput && s.total === null },

  // ── 国民健康保険料 (/kokuho/) ────────────────────────────────────────
  // ★手計算の鎖は tests/test_kokuho.mjs §4（同じ世帯・同じ架空料率）。
  //   医療380,600／後期支援120,250／介護85,400／子育て11,710 → 合計597,960円。
  //   介護分を全員に賦課する実装、子育て分の均等割を18歳未満にも掛ける実装は落ちる。
  { name: "kokuho", expect: (s) =>
      s.total === 597960 && s.iryo === 380600 && s.shien === 120250 &&
      s.kaigo === 85400 && s.kosodate === 11710 &&
      // 軽減なし側であることを名指し（対の片方）
      /軽減には該当しません/.test(s.keigenName || "") &&
      // 年齢の区切りはコアから描かれている（ページの手書きではない）
      /40〜64歳/.test(s.ageHint) && /6歳以下/.test(s.ageHint) && /18歳以下/.test(s.ageHint) &&
      // ★選んだ人数の分だけ世帯員の行が見えていること（余りは消えていること）。
      //   値を id で読むだけの検査は「8行すべて出たまま」を検出しない
      s.visibleRows === s.memberCount &&
      !s.noRates && !s.failed },
  // ★対（同じ4人世帯で所得だけ0）→ 7割軽減・80,700円。
  //   所得を core に渡していない実装は、上の kokuho もこれと同じ軽減を出して落ちる。
  { name: "kokuho_keigen", expect: (s) =>
      s.total === 80700 && s.iryo === 52500 &&
      /7割軽減/.test(s.keigenName || "") &&
      // 「所得割は軽減されない」は見出しとは別の要素に載っている（規則5）
      /所得割は軽減されません/.test(s.keigenTaisho || "") },
  // ★擬制世帯主の所得500万は判定所得に入る → 軽減なし・85,000円
  { name: "kokuho_gisei", expect: (s) =>
      s.total === 85000 && /軽減には該当しません/.test(s.keigenName || "") },
  // ★その対（擬制世帯主なし）→ 7割軽減・25,500円。渡し忘れ実装は両方25,500になって落ちる
  { name: "kokuho_gisei_nashi", expect: (s) =>
      s.total === 25500 && /7割軽減/.test(s.keigenName || "") &&
      // 1人世帯なら見えている世帯員の行も1つだけ（8行出たままの見た目の壊れを落とす）
      s.visibleRows === 1 },
  // ★特定同一世帯所属者を人数に算入すると2割軽減に入る（単独なら軽減なし）
  { name: "kokuho_tokutei", expect: (s) =>
      s.total === 204960 && /2割軽減/.test(s.keigenName || "") },
  // ★料率が空 → 0円と答えず入力を促す（推測で埋めない設計が画面まで通っている）
  { name: "kokuho_norates", expect: (s) =>
      s.total === null && /料率を入力してください/.test(s.noRates || "") },
  // ★参照データ配信不可 → 金額を出さずに断る（fail closed）
  { name: "kokuho_nodata", data404: "kokuho_r08.json", expect: (s) =>
      s.failed && s.total === null },

  // ── 老齢年金の受給見込額 (/nenkin/) ──────────────────────────────────
  // ★手計算の鎖は harness.html の同名シーンのコメント（コアを通さず出した期待値）。
  //   基礎656,658／付加12,000／厚生654,426 → 合計1,323,084円・月額110,257円。
  { name: "nenkin", expect: (s) =>
      s.total === 1323084 && s.monthly === 110257 &&
      s.kiso === 656658 && s.fuka === 12000 && s.kosei === 654426 &&
      // 本来の受給開始（対の片方）であることを名指し
      /本来の受給開始/.test(s.adjustName || "") &&
      // 免除区分の行と乗率はデータから描かれている（ページの手書きではない）
      s.monthRows === 5 && s.preRate === "7.125" && s.postRate === "5.481" &&
      // 満額は新規裁定（昭和31年4月2日以後生まれ）side
      /昭和31年4月2日以後/.test(s.mangakuLabel || "") &&
      !s.noInput && !s.failed },
  // ★繰上げ60歳＝24%減。付加年金も0.76倍されること（据え置き実装は fuka 12,000 のままで落ちる）。
  { name: "nenkin_kuriage", expect: (s) =>
      s.total === 1005544 && s.kiso === 499060 && s.fuka === 9120 && s.kosei === 497364 &&
      /繰上げ/.test(s.adjustName || "") && /24%/.test(s.adjustRate || "") &&
      // 「付加年金にもかかる」は見出しとは別の要素に載っている（規則5）
      /付加年金/.test(s.adjustFuka || "") },
  // ★繰下げ75歳＝84%増（120月の上限にちょうど当たる）。頭打ちの申告が出ること。
  { name: "nenkin_kurisage", expect: (s) =>
      s.total === 2434475 && s.kiso === 1208251 && s.fuka === 22080 && s.kosei === 1204144 &&
      /繰下げ/.test(s.adjustName || "") && /84%/.test(s.adjustRate || "") &&
      /120月で頭打ち/.test(s.adjustCapped || "") },
  // ★★「か月」欄の既定値でない側（70歳6か月＝66月）。か月を捨てる実装は1,878,779円で落ちる。
  //   上限にも当たらないので、頭打ちの申告が**出ていないこと**もここで固定する。
  { name: "nenkin_kurisage_tsuki", expect: (s) =>
      s.total === 1934349 && s.kiso === 960034 && s.fuka === 17544 && s.kosei === 956771 &&
      /46\.2%/.test(s.adjustRate || "") && /66か月/.test(s.adjustName || "") &&
      s.adjustCapped === null },
  // ★★号ごとの上限の急所。上限の基準を「率を掛けたあとの月数」にした実装は845,053円で落ちる。
  { name: "nenkin_menjo_jogen", expect: (s) =>
      s.total === 798757 && s.kiso === 798757 && s.fuka === 0 && s.kosei === 0 &&
      /452\.5月/.test(s.credited || "") &&
      // 「上限の基準は前の号のもとの月数」は結果欄の別要素で申告している
      /もとの月数/.test(s.menjoNote || "") },
  // ★既裁定の満額（844,900円）を使う対。満額を1つしか持たない実装は847,300円で落ちる。
  { name: "nenkin_kisai", expect: (s) =>
      s.total === 844900 && s.kiso === 844900 &&
      /昭和31年4月1日以前/.test(s.mangakuLabel || "") &&
      /480月/.test(s.credited || "") },
  // ★その対（同じ生年月日で繰上げ）→ 収録範囲外なので1円も出さない（fail closed）。
  //   0.4%で黙って計算する実装は642,124円を出して落ちる。
  { name: "nenkin_hanigai", expect: (s) =>
      s.total === null && /出せません/.test(s.outOfScope || "") &&
      /昭和37年4月1日以前/.test(s.outOfScopeList || "") },
  // ★平成21年3月以前の免除期間 → 反映率が違うので金額を出さない（fail closed）。
  { name: "nenkin_preh21", expect: (s) =>
      s.total === null && /出せません/.test(s.outOfScope || "") &&
      /平成21年3月以前/.test(s.outOfScopeList || "") },
  // ★月数が1つも無い → 0円と答えず入力を促す（fail closed）。
  { name: "nenkin_noinput", expect: (s) =>
      s.total === null && /月数を入力してください/.test(s.noInput || "") },
  // ★受給開始が範囲外（76歳）→ 制度上請求できないので金額を出さない。
  { name: "nenkin_hanmugai", expect: (s) =>
      s.total === null && /範囲で入れてください/.test(s.outOfRange || "") },
  // ★参照データ配信不可 → 金額を出さずに断る（fail closed）。
  { name: "nenkin_nodata", data404: "nenkin_r08.json", expect: (s) =>
      s.failed && s.total === null },

  // ── 仲介手数料 (/chukai-tesuryo/) ────────────────────────────────────
  // ★手計算の鎖は harness.html の同名シーンのコメント（コアを通さず告示の割合から出した期待値）。
  { name: "chukai", expect: (s) =>
      s.jogen === 1056000 && s.kijunGokei === 1056000 && s.daikin === 30000000 &&
      s.rows === 4 && /96万|960,000/.test(s.sokusan || "") &&
      // 「上限であって料金表ではない」は毎回出る（画面の言葉も実装の一部）
      /上限額です/.test(s.jogenNote || "") && !s.failed },
  // ★★建物の消費税の対（総額は同じ4,000万円）。
  { name: "chukai_kojin", expect: (s) => s.jogen === 1386000 && s.daikin === 40000000 },
  { name: "chukai_shohizei", expect: (s) =>
      s.jogen === 1320000 && s.daikin === 38000000 },
  // ★代理は媒介の2倍。
  { name: "chukai_dairi", expect: (s) => s.jogen === 2112000 && s.kijunGokei === 1056000 },
  // ★★低廉な空家等の特例の対。合意がなければ上がらない。
  { name: "chukai_akiya_nashi", expect: (s) => s.jogen === 231000 },
  { name: "chukai_akiya", expect: (s) => s.jogen === 330000 && s.kijunGokei === 231000 },
  // ★★賃貸（居住用）。合計と一方は別の額で、別の要素に出ている。
  { name: "chukai_chintai", expect: (s) =>
      s.gokeiJogen === 110000 && s.ippoJogen === 55000 && s.jogen === 55000 &&
      /0\.55/.test(s.ippoRiyu || "") },
  { name: "chukai_chintai_shodaku", expect: (s) =>
      s.gokeiJogen === 110000 && s.ippoJogen === 110000 },
  // ★店舗は借賃から消費税を除く（税込11万→税抜10万）。
  { name: "chukai_tenpo", expect: (s) =>
      s.yachinNuki === 100000 && s.gokeiJogen === 110000 && s.ippoJogen === 110000 },
  // ★★権利金の特例が借賃基準を上回る。
  { name: "chukai_kenrikin", expect: (s) =>
      s.ippoJogen === 154000 && /154,000/.test(s.kenrikinNote || "") },
  // ★改正前の契約 → 1円も出さない。理由が「範囲外」の要素に出る。
  { name: "chukai_kako", expect: (s) =>
      s.jogen === null && /令和6年7月1日/.test(s.kikanGai || "") && s.miNyuryoku === null },
  // ★入力が空 → 0円と答えず入力を促す。「範囲外」と混ざっていないこと。
  { name: "chukai_noinput", expect: (s) =>
      s.jogen === null && /入力してください/.test(s.miNyuryoku || "") && s.kikanGai === null },
  // ★参照データ配信不可 → 金額を出さずに断る（fail closed）。
  { name: "chukai_nodata", data404: "chukai_r08.json", expect: (s) =>
      s.failed && s.jogen === null && s.loadFailed !== null },

  // ── 遺族年金 (/izoku/) ──────────────────────────────────────────────────
  // ★手計算の鎖は harness.html の同名シーンのコメント（コアを通さず条文から出した期待値）。
  { name: "izoku", expect: (s) =>
      s.total === 1704868 && s.gokei === 1704868 && s.monthly === 142072 &&
      s.kiso === 1334900 && s.kosei === 369968 && s.chukorei === 0 &&
      // 短期要件なのでみなしが立ち、その申告が出ている（額を見ても分からないため）
      /300月とみなして/.test(s.minashi || "") && s.minashiNashi === null &&
      // 子がいるあいだ加算が止まる理由は、0円という数字では伝わらない
      /支給停止/.test(s.ckKiso || "") &&
      // 年度はデータから描かれている（ページの手書きではない）
      /令和8年度/.test(s.nendo || "") && s.hanigai === 7 &&
      /概算額/.test(s.gaisanNote || "") && !s.failed },
  // ★★子の有無の対。子0人で遺族基礎が消え、中高齢寡婦加算が立つ。
  { name: "izoku_konashi", expect: (s) =>
      s.total === 1005468 && s.kiso === 0 && s.kosei === 369968 && s.chukorei === 635500 &&
      /支給されません/.test(s.kisoNashi || "") &&
      // 加算が付いているので「付きません」の要素は出ない
      s.ckKiso === null && s.ckAge === null && s.ckNotWife === null },
  // ★★300月みなしの対。長期要件は実月数のまま＝2.5分の1になる。
  { name: "izoku_choki", expect: (s) =>
      s.total === 147987 && s.kosei === 147987 && s.chukorei === 0 &&
      s.minashi === null && /実際の\s*120月/.test((s.minashiNashi || "").replace(/\s+/g, " ")) &&
      /240月/.test(s.ckChokiMonths || "") },
  // その対: 長期要件でも240月あれば加算が付く。
  { name: "izoku_choki_240", expect: (s) =>
      s.total === 931474 && s.kosei === 295974 && s.chukorei === 635500 &&
      s.ckChokiMonths === null },
  // ★子の加算の段（3人目は81,300円）。全員を243,800円で足す実装は落ちる。
  { name: "izoku_ko3", expect: (s) =>
      // 内訳の行: 遺族基礎／うち1・2人目／うち3人目以降／遺族厚生／中高齢寡婦／合計 ＝ 6行
      s.total === 1786168 && s.kiso === 1416200 && s.rows === 6 },
  // ★夫には中高齢寡婦加算が付かない。落ちた門が名指しで出ていること。
  { name: "izoku_otto", expect: (s) =>
      s.total === 369968 && s.chukorei === 0 &&
      /妻/.test(s.ckNotWife || "") && s.ckChokiMonths === null && s.ckAge === null },
  // ★★65歳以降の併給。2号が選ばれ、上乗せ額が別の要素に出ている。
  { name: "izoku_65", expect: (s) =>
      s.total === 396645 && s.kosei === 396645 && s.uwanose === 96645 &&
      s.heikyuGo2 !== null && s.heikyuGo1 === null &&
      // 65歳になったので中高齢寡婦加算は年齢の門で落ちる
      /40歳以上65歳未満/.test(s.ckAge || "") },
  // ★加入も子も0 → 0円と答えず入力を促す（fail closed）。
  { name: "izoku_noinput", expect: (s) =>
      s.total === null && /入力してください/.test(s.miNyuryoku || "") },
  // ★参照データ配信不可 → 金額を出さずに断る（fail closed）。
  { name: "izoku_nodata", data404: "izoku_r08.json", expect: (s) =>
      s.failed && s.total === null && s.loadFailed !== null },

  // ── 源泉徴収票③の検算 (/column/gensen-choshuhyo-mikata/) ──────────────────
  // ★手計算の鎖は harness.html の同名シーンのコメント（コアを通さず票の欄から積んだ期待値）。
  { name: "gensen_kojo", expect: (s) =>
      s.accounted === 2780000 && s.san === 2780000 && s.remainder === 0 &&
      s.matched !== null && s.overshoot === null && s.explains === null && s.unexplained === null &&
      // 年分はデータから描かれている（ページの手書きではない）
      /令和7年分/.test(s.nendo || "") && !s.failed },
  // ★★票に金額が出ない控除の対。差額35万をひとり親控除で説明できること。
  { name: "gensen_kojo_hitorioya", expect: (s) =>
      s.remainder === 350000 && s.matched === null && s.explains !== null &&
      s.explainCount === 1 && /ひとり親/.test(s.explains || "") && s.unexplained === null },
  // ★★最重要: ③より多く積んだときにマイナスを0へ丸めず、「合っています」と答えないこと。
  { name: "gensen_kojo_overshoot", expect: (s) =>
      s.remainder === -200000 && s.overshoot !== null && s.matched === null &&
      s.explains === null &&
      // 住宅ローン控除・所得金額調整控除の2つを名指しで案内する
      /jutaku/.test(s.notes || "") && /chosei/.test(s.notes || "") },
  // ★③未入力 → 0円と答えず入力を促す（fail closed）。
  { name: "gensen_kojo_nosan", expect: (s) =>
      s.remainder === null && s.matched === null && /入れてください/.test(s.miNyuryoku || "") },
  // ★参照データ配信不可 → 合否を答えない（fail closed）。
  { name: "gensen_kojo_nodata", data404: "gensen_kojo_r07.json", expect: (s) =>
      s.failed && s.remainder === null && s.matched === null && s.loadFailed !== null },

  // ── 在職老齢年金 (/zaishoku/) ────────────────────────────────────────────
  // ★手計算の鎖は harness.html の同名シーンのコメント（コアを通さず条文から出した期待値）。
  { name: "zaishoku", expect: (s) =>
      s.kihon === 100000 && s.sohoshu === 600000 && s.goukei === 700000 &&
      s.teishiGetsu === 25000 && s.shikyuGetsu === 75000 && s.shikyuNen === 900000 &&
      // 老齢基礎年金は1円も止まらない（847,300 ÷ 12 = 70,608 に丸め）
      s.kisoGetsu === 70608 && s.total === 1747300 &&
      // 一部停止であって全額停止ではない
      s.ichibu !== null && s.zengaku === null && s.nashiKanai === null && s.nashiTaishoku === null &&
      // 基準額・年度はデータから描かれている（ページの手書きではない）
      s.kijun === 650000 && /令和8年度/.test(s.nendo || "") &&
      // ★改正比較が本計算と同じ入力から描かれている（現行行が見出しと一致すること）
      s.curTotal === 1747300 && s.oldTotal === 907300 && s.oldTeishi === 1140000 &&
      /840,000/.test(s.zoka || "") && s.henkaNashi === null &&
      s.hanigai === 5 && /概算額/.test(s.gaisanNote || "") && !s.failed },
  // ★★賞与の対。賞与を落とすと合計が 600,000 になり1円も止まらない。
  { name: "zaishoku_shoyo_nashi", expect: (s) =>
      s.sohoshu === 500000 && s.goukei === 600000 && s.teishiGetsu === 0 &&
      s.shikyuNen === 1200000 && s.total === 2047300 &&
      /超えていない/.test(s.nashiKanai || "") && s.ichibu === null && s.zengaku === null },
  // ★境界: ちょうど65万は「超える」に当たらないので全額支給。改正前なら年84万止まっていた。
  { name: "zaishoku_choudo", expect: (s) =>
      s.goukei === 650000 && s.teishiGetsu === 0 && s.total === 2047300 &&
      s.nashiKanai !== null && s.oldTeishi === 840000 && s.oldTotal === 1207300 &&
      /840,000/.test(s.zoka || "") },
  // ★★全額支給停止の頭打ち。負の年金額を出さず、加給年金も一緒に止まる。
  { name: "zaishoku_zengaku", expect: (s) =>
      s.shikyuGetsu === 0 && s.shikyuNen === 0 && s.teishiGetsu === 50000 &&
      // 式が出す支給停止基準額（月70万）が本文に出ていて、頭打ちだと分かる
      /700,000/.test(s.zengaku || "") && s.ichibu === null &&
      // 加給年金も止まる／老齢基礎年金だけが残る
      s.kakyuTeishi !== null && s.kakyuShikyu === null && s.total === 847300 },
  // ★加給年金は判定に入れない（停止額は看板と同じ）が、受取総額には足される。
  { name: "zaishoku_kakyu", expect: (s) =>
      s.teishiGetsu === 25000 && s.shikyuNen === 900000 && s.total === 2155400 &&
      s.kakyuShikyu !== null && s.kakyuTeishi === null },
  // ★★働き方の対。退職済みなら同じ収入でも1円も止まらない。
  { name: "zaishoku_taishoku", expect: (s) =>
      s.teishiGetsu === 0 && s.shikyuNen === 1200000 && s.total === 2047300 &&
      /在職していない/.test(s.nashiTaishoku || "") && s.nashiKanai === null &&
      // 改正前後で差が出ない（そもそも止まっていない）
      s.oldTotal === 2047300 && s.henkaNashi !== null && s.zoka === null },
  // ★70歳以上で適用事業所勤務は対象（46条1項かっこ書）。看板と同じだけ止まる。
  { name: "zaishoku_over70", expect: (s) =>
      s.teishiGetsu === 25000 && s.shikyuNen === 900000 && s.nashiTaishoku === null },
  // ★老齢厚生年金が0 → 0円と答えず入力を促す（fail closed）。
  { name: "zaishoku_noinput", expect: (s) =>
      s.shikyuNen === null && s.total === null && /入力してください/.test(s.miNyuryoku || "") },
  // ★参照データ配信不可 → 金額を出さずに断る（fail closed）。
  { name: "zaishoku_nodata", data404: "zaishoku_r08.json", expect: (s) =>
      s.failed && s.total === null && s.loadFailed !== null },

  // ── 不動産の登録免許税 (/toroku-menkyozei/) ──────────────────────────
  // ★手計算の鎖は harness.html の同名シーンのコメント（コアを通さず条文の税率から出した期待値）。
  { name: "toroku", expect: (s) =>
      s.total === 290000 && s.tochi === 225000 && s.tatemono === 30000 && s.teitoken === 35000 &&
      s.rows === 3 &&
      // 期限は2つともデータから描かれている（ページの手書きではない）
      /令和9年3月31日/.test(s.kigenJutaku || "") && /令和11年3月31日/.test(s.kigenTochi || "") &&
      /昭和57年1月1日/.test(s.chukoKijun || "") &&
      // 軽減が通っているので「本則で計算した」の断り書きは出ない
      s.keigenNashi === null && s.bubun === null && !s.failed },
  // 保存登記＝建物0.15%。単体テストの看板例と同じ275,000円になる。
  { name: "toroku_hozon", expect: (s) =>
      s.total === 275000 && s.tochi === 225000 && s.tatemono === 15000 && s.teitoken === 35000 },
  // ★対: 贈与は軽減が全部落ちる。理由が名指しで出ていること（規則5＝見出しと別の要素）。
  { name: "toroku_zoyo", expect: (s) =>
      s.total === 640000 && s.tochi === 300000 && s.tatemono === 200000 && s.teitoken === 140000 &&
      /本則/.test(s.keigenNashi || "") && /売買・競落/.test(s.keigenRiyu || "") },
  // ★★競落＝建物だけ軽減。土地と建物で結論が分かれることを別要素で申告している。
  { name: "toroku_keiraku", expect: (s) =>
      s.total === 365000 && s.tochi === 300000 && s.tatemono === 30000 && s.teitoken === 35000 &&
      /土地は本則/.test(s.keirakuNote || "") &&
      // 建物の軽減は通っているので「軽減なし」は出ない
      s.keigenNashi === null },
  // ★★長期優良（一戸建ての移転）は0.2%。
  { name: "toroku_chouki_kodate", expect: (s) =>
      s.total === 20000 && s.tatemono === 20000 && s.rows === 1 },
  // ★★その対。低炭素は同条件でも0.1%（かっこ書きが無い）。
  { name: "toroku_teitanso_kodate", expect: (s) =>
      s.total === 10000 && s.tatemono === 10000 && s.rows === 1 },
  // ★中古の建築日の対。昭和56年は軽減が落ちる。
  { name: "toroku_chuko_s56", expect: (s) =>
      s.total === 200000 && s.tatemono === 200000 && /昭和57年1月1日/.test(s.keigenRiyu || "") },
  // 昭和57年1月1日ちょうどは通る（境界は「以後」）。
  { name: "toroku_chuko_s57", expect: (s) =>
      s.total === 30000 && s.tatemono === 30000 && s.keigenNashi === null },
  // ★★抵当権の課税標準は債権金額。評価額を渡す実装は合計80,000で落ちる。
  { name: "toroku_saiken", expect: (s) =>
      s.total === 90000 && s.tatemono === 60000 && s.teitoken === 30000 &&
      /債権金額/.test(s.saikenBase || "") },
  // ★持分（既定値でない側）。渡し忘れる実装は300,000で落ちる。
  { name: "toroku_mochibun", expect: (s) =>
      s.total === 150000 && s.tochi === 150000 && s.rows === 1 },
  // ★登記までの月数（既定値でない側）。渡し忘れる実装は30,000で落ちる。
  { name: "toroku_1nen_choka", expect: (s) =>
      s.total === 200000 && s.tatemono === 200000 && /12か月/.test(s.keigenRiyu || "") },
  // ★★期限の境界の対。最終日は通る（条文の「まで」は当日を含む）。
  { name: "toroku_kigen_kyokai", expect: (s) =>
      s.total === 290000 && s.tatemono === 30000 && s.bubun === null },
  // その翌日は建物と抵当権を出さない。★tokiBi を渡し忘れる実装は290,000を出して落ちる。
  { name: "toroku_kigen_gai", expect: (s) =>
      s.total === 225000 && s.tochi === 225000 && s.tatemono === null && s.teitoken === null &&
      s.rows === 1 && /一部だけ/.test(s.bubun || "") &&
      // 「期限が別の制度」であることは見出しと別の要素に載っている
      /令和11年3月31日/.test(s.bubunRiyu || "") },
  // ★同じ日でも土地だけなら一部ではない（全部出せている）。
  { name: "toroku_kigen_tochi", expect: (s) =>
      s.total === 225000 && s.rows === 1 && s.bubun === null && s.outOfScope === null },
  // ★収録範囲より前の日 → 1円も出さない。
  { name: "toroku_kako", expect: (s) =>
      s.total === null && /出せません/.test(s.outOfScope || "") &&
      /令和8年4月1日/.test(s.outOfScopeRiyu || "") },
  // ★相続は税率が別（0.4%）→ 計算せず案内する。2%を当てる実装は640,000を出して落ちる。
  { name: "toroku_sozoku", expect: (s) =>
      s.total === null && /出せません/.test(s.outOfScope || "") &&
      /1000分の4/.test(s.outOfScopeRiyu || "") },
  // ★入力が空 → 0円と答えず入力を促す。理由はコアの文言なので別要素で読む（規則5）。
  { name: "toroku_noinput", expect: (s) =>
      s.total === null && /入力してください/.test(s.noInputRiyu || "") &&
      // 「データが読めなかった」と混ざっていないこと（原因を取り違えると利用者の次の一手が変わる）
      !s.failed && s.loadFailed === null },
  // ★参照データ配信不可 → 金額を出さずに断る（fail closed）。
  //   ★入力不足と**別の要素**で申告する（同じ文言に丸めると、原因の違いが利用者に伝わらない）。
  { name: "toroku_nodata", data404: "toroku_jutaku_r08.json", expect: (s) =>
      s.failed && s.total === null && s.loadFailed !== null && s.noInput === null },

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
  // ★35万円・令和8年4月取得＝改正後の少額特例(40万円未満)の対象。案内が結果に出ること。
  //   （改正前のコードは cost<300000 で閉じており、この人に特例の存在を一度も告げなかった）
  { name: "genka_shogaku", expect: (s) =>
      s.body.includes("少額減価償却資産の特例") && s.body.includes("40万円未満") &&
      s.body.includes("令和11年3月31日") && s.firstYear === 65625 && !s.failed },
  // ★同じ35万円でも令和8年3月取得は旧基準(30万円未満)で対象外。案内を出さない（旧取得に新基準を持ち込まない）。
  { name: "genka_shogaku_kyu", expect: (s) =>
      !s.body.includes("少額減価償却資産の特例") && s.firstYear === 72916 && !s.failed },
  // ★資産の種類で償却の限度額が変わる（所令134条1項2号）。無形固定資産＝1円を残さず0円まで。
  //   100万・5年の定額法なら合計1,000,000（有形の999,999ではない）・最終年の期末帳簿価額0円。
  { name: "genka_mukei", expect: (s) =>
      s.total === 1000000 && s.lastCloseBook === 0 && s.body.includes("1円を残しません") && !s.failed },
  // ★対照: 同条件の有形は 999,999・1円が残る（画面が種類を無視していたらこの対で割れる）。
  { name: "genka_yukei_taisho", expect: (s) =>
      s.total === 999999 && s.lastCloseBook === 1 && !s.body.includes("1円を残しません") && !s.failed },
  // ★無形固定資産に定率法は選べない（所令120条の2第1項4号）→ 黙って計算せず断る。
  { name: "genka_mukei_teiritsu", expect: (s) =>
      s.rejected && s.firstYear === null && !s.failed },

  // ── 中古資産の簡便法 (/genka/) ────────────────────────────────────────
  // ★独立オラクル=国税庁 No.5404 の公表例: 法定30年・経過10年 → 22年。
  { name: "genka_chuko", expect: (s) => s.years === 22 && !s.rejected },
  // ★経過年数は月まで数える（耐令3条5項）: 法定22年・築10年3か月 → 13年（月を捨てると14年）。
  { name: "genka_chuko_tsuki", expect: (s) => s.years === 13 && !s.rejected },
  // ★2年に満たないときは2年（法定4年・全部経過＝0.8年）。
  { name: "genka_chuko_min2", expect: (s) => s.years === 2 && !s.rejected },
  // ★ただし書（資本的支出>取得価額の50%）→ 年数を出さずに断る。使えない人に短い年数を答えない。
  { name: "genka_chuko_shihonteki", expect: (s) =>
      s.rejected && s.years === null && s.body.includes("再取得価額") },

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
      s.daily === 16540 && s.unit1 === 332454 && s.ikujiTotal === 1961478 &&
      s.showsCap && !s.failed },
  // 参照データが配信できないときは、金額を出さずに断る(fail closed)。
  // ★黙って答えると、上限に張りつく人に**上限を無視した高い額**を信じさせる(月30万円以上ずれる)
  { name: "ikuji_nodata", data404: "kihonteate_r07.json",
    expect: (s) => s.failed && s.total === null },

  // ───────── 報酬・料金の源泉徴収(/gensen-choshu/ 上半分) 所法204条・所基通204-2 ─────────
  // ★このページで**E2Eが1つも無かった**部分(2026-07-26 新設)。給与・賞与だけを見ていたので、
  //   実務でいちばん間違える「消費税を区分すると対象額が変わる」経路が未検査だった。
  // 区分あり: 税抜100,000が対象 → 100,000 × 10.21% = 10,210円
  { name: "gensen_houshu", expect: (s) =>
      s.target === 100000 && s.tax === 10210 && s.total === 110000 && s.shohizeiLabel === "10%" },
  // ★区分なし: 税込110,000が対象 → 110,000 × 10.21% = 11,231円。
  //   **消費税率(RATE_SHOHIZEI)が計算に効いている唯一の経路**。率を0にすればここが10,210円に落ちる。
  { name: "gensen_houshu_inc", expect: (s) =>
      s.target === 110000 && s.tax === 11231 && s.shohizei === 10000 && s.shohizeiLabel === "10%" },
  // 消費税なし(不課税・免税): 100,000が対象。消費税の行そのものを出さない
  { name: "gensen_houshu_none", expect: (s) =>
      s.target === 100000 && s.tax === 10210 && s.shohizeiLabel === null && s.shohizei === null },

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
  // ★★自分13日・配偶者10日・免除なし。**「あと1日で18,200円乗る」と言ってはいけない**。
  //   shienKyufu は自分の日数を先に見るので reason は own_days になるが、
  //   自分だけ14日にしても**配偶者が14日未満なので13%は0円のまま**（1項3号）。
  //   2026-07-26まで本番はここで「あと1日 休業を延ばすと13%（約¥18,200）がまるごと乗ります」と
  //   案内していた。産後パパ育休を1日延ばすのは職場調整を伴う実際の決断なので、
  //   **金額の誤差ではなく「意味のない行動を促す」誤り**。
  //   ★showsCliffHint が **false であること**まで見る（新しい文言を足しただけで
  //     古い誤った案内が残っていたら、両方出て利用者はどちらを信じるか分からない）。
  { name: "papa_13days_no_exempt", expect: (s) =>
      s.shusshoji === 87100 && s.shien === 0 && s.total === 87100 &&
      s.showsOwnDaysReason && s.showsCliffBlocked && !s.showsCliffHint && !s.failed },
  // ★28日で頭打ち(61条の8第2項2号)＋上限に張りつく人(月給60万 → 16,110円)。
  //   67%: 16,110×28×0.67 = **302,223円** / 13%: 16,110×28×0.13 = **58,640円**(どちらも厚労省の公表値)
  //   40日と入力しても支給は28日 → 180日枠を食うのも28日なので残り**152日**
  { name: "papa_cap", expect: (s) =>
      s.daily === 16540 && s.shusshoji === 310290 && s.shien === 60205 && s.total === 370495 &&
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

  // ── 節税シミュレーター(setsuzei_core)。期待値は tests/ と同じ速算表の手計算オラクル ──
  // iDeCo: 課税所得300万・会社員(企業年金なし)・月23,000 → 年55,779(所得税27,600+住民27,600+復興579)
  { name: "ideco", expect: (s) =>
      s.total === 55779 && s.shotokuGen === 27600 && s.juminGen === 27600 && !s.failed },
  // 小規模企業共済: 課税所得500万・月70,000 → 年255,528(復興3,528+住民84,000 → 所得税168,000も一意に決まる)
  { name: "shokibo", expect: (s) =>
      s.total === 255528 && s.fukkoGen === 3528 && s.juminGen === 84000 && !s.failed },
  // 扶養控除: 課税所得500万・一般1+特定1 → 控除 所得税101万/住民税78万・節税284,242。
  // ★住民税の減少は78,000(住民税側の控除×10%)。所得税側の101万×10%=101,000に化けたら落ちる
  { name: "fuyo", expect: (s) =>
      s.total === 284242 && s.shotokuGen === 202000 && s.juminGen === 78000 &&
      s.kojoShotoku === 1010000 && s.kojoJumin === 780000 && !s.failed },
  // 配偶者控除・配偶者特別控除: 本人900万以下・配偶者給与150万(→所得76万=150万−74万・配特帯1=38万/33万)・
  // 課税所得500万 → 節税110,596。★住民税の減少は33,000(住民税側の控除×10%)。38,000に化けたら落ちる
  { name: "haigusha", expect: (s) =>
      s.total === 110596 && s.shotokuGen === 76000 && s.juminGen === 33000 &&
      s.kojoShotoku === 380000 && s.kojoJumin === 330000 && s.isTokubetsu && !s.failed },
  // 生命保険料控除: 一般(新6万+旧7万)・介護4万・年金(新8万)・23歳未満の扶養親族あり・課税所得500万。
  // 所得税=一般60,000(特例つき合算)+介護30,000+年金40,000=130,000 → 上限120,000
  // 住民税=一般35,000(★旧のみが勝つ)+介護24,000+年金28,000=87,000 → 上限70,000 → 節税31,504
  { name: "seiho", expect: (s) =>
      s.kojoShotoku === 120000 && s.kojoJumin === 70000 && s.total === 31504 &&
      s.juminGen === 7000 && s.showsSplitMethod && s.showsJuminCap && !s.failed },
  // 青色申告特別控除: 事業所得500万・事業/複式簿記/期限内はOK・e-Tax未 → 55万円の区分。
  // 節税167,310(所得税110,000+復興2,310+住民55,000)。★住民税は控除と同額55万×10%=55,000
  // (人的控除と違い所得税・住民税で額が変わらない — 地方税法32条2項)。
  // e-Taxに届いたときの増分30,420円が画面に出ていることも固定する。
  { name: "aoiro", expect: (s) =>
      s.kojo === 550000 && s.total === 167310 && s.juminGen === 55000 &&
      s.showsMissing && s.showsGain && !s.failed },
  // 倒産防止共済: 課税所得500万・月10万・40か月・任意解約・解約年も同所得。
  // 入口の累計節税1,216,800(3年×365,040＋121,680)・支給率100%で手当金400万・掛け捨て0でも、
  // 解約年に400万が乗って増税1,279,591 → 差引−62,791の**逆ざや**(このツールの核心)が画面に出ていること。
  { name: "tosan", expect: (s) =>
      s.setsuzei === 1216800 && s.teate === 4000000 && s.rate100 &&
      s.showsZouzei && s.showsGyakuzaya && !s.failed },
  // ひとり親控除: 未婚の母・子(所得62万以下)あり・給与収入300万→合計所得202万・課税所得150万。
  // 未婚でもひとり親35万/30万。節税47,867(17,500+367+30,000)。非課税ラインは67万円超え=参考表示。
  { name: "hitorioya", expect: (s) =>
      s.label === "ひとり親控除" && s.total === 47867 && s.juminGen === 30000 &&
      s.gokei === 2020000 && s.overLine === 670000 && !s.hikazei && !s.failed },
  // ★非課税135万円: 給与収入190万→所得116万 → 「住民税は全額かかりません」calloutが出て、
  // 節税額は所得税側だけ(6,126)・住民税の行は「—（下の注）」(非課税なのに合算する型を許さない)。
  { name: "hitorioya_hikazei", expect: (s) =>
      s.label === "ひとり親控除" && s.hikazei && s.total === 6126 &&
      s.juminDash && s.showsNoJuminNote && !s.failed },
  // 寡婦: 死別・子なし(扶養親族不要=30号ロ)・合計所得の直接入力モード・課税所得250万 → 53,567。
  { name: "hitorioya_kafu", expect: (s) =>
      s.label === "寡婦控除" && s.total === 53567 && s.juminGen === 26000 && !s.failed },
  // 事実婚(住民票の未届記載) → 子がいても対象外。理由の名指しが画面に出ること。
  { name: "hitorioya_jijitsukon", expect: (s) =>
      s.label === "対象外" && /未届/.test(s.reason) && !s.failed },
  // 勤労学生控除: 大学生・給与150万 → 対象。所得税0→0(もともと0円callout)・
  // 住民税35,500→9,000(▲26,500)・所得76万>62万で親の扶養から外れている旨。
  { name: "kinro_gakusei", expect: (s) =>
      s.hantei === "ok" && s.zeroCallout && s.zeroRow &&
      s.juminOff === 35500 && s.juminOn === 9000 && s.saving === 26500 &&
      s.oyaHazure && !s.courseNote && !s.failed },
  // ★未成年163万: 対象だが住民税もともと非課税(135万) → 0→0・出番なしcallout。
  { name: "kinro_gakusei_miseinen", expect: (s) =>
      s.hantei === "ok" && s.hikazeiMiseinen && s.zeroCallout &&
      s.juminOff === 0 && s.juminOn === 0 && s.saving == null && !s.failed },
  // 専修学校140万: 対象+課程要件・証明書noteが必ず出る。住民税25,500→5,000(▲20,500)。
  { name: "kinro_gakusei_senshu", expect: (s) =>
      s.hantei === "ok" && s.courseNote &&
      s.juminOff === 25500 && s.juminOn === 5000 && s.saving === 20500 && !s.failed },
  // 給与170万(所得96万>89万) → 対象外。163万円のラインと178万円の案内が理由に出ること。
  { name: "kinro_gakusei_over", expect: (s) =>
      s.hantei === "none" && /163万円以下/.test(s.reason) && /178万円/.test(s.reason) && !s.failed },

  // ── 国民年金の免除・納付猶予 (/kokunen-menjo/) ───────────────────────
  // 正常系: 前年所得60万・単身・30歳。基準67万を下回るので全額免除、納める額は0円。
  // ★expectedAvailable は harness 側の独立実装（施行令の条文から手で起こした基準額）。
  { name: "kokunen", expect: (s) =>
      s.best === "全額免除" && s.monthlyPay === 0 &&
      s.available.includes("全額免除") &&
      s.available.length === s.expectedAvailable.length &&
      s.expectedAvailable.every((x) => s.available.includes(x)) &&
      s.nenkinDiff > 0 && !s.failed && !s.noneMatched },

  // ★看板その1: 本人の所得0でも、世帯主(親)が300万なら全額免除も一部免除も落ちる。
  //   納付猶予だけが通る（世帯主を見ないため）。区分ごとに見る人の範囲を揃えていたらここで落ちる。
  { name: "kokunen_setainushi", expect: (s) =>
      s.best === "納付猶予" && s.monthlyPay === 0 &&
      !s.available.includes("全額免除") && !s.available.includes("4分の3免除") &&
      s.available.includes("納付猶予") &&
      s.expectedAvailable.every((x) => s.available.includes(x)) &&
      // どの人が落としたのかを画面が名指ししていること
      s.blamesSetainushi &&
      // 納付猶予は年金額に反映されない＝そう断っていること（全額免除の1/2と混同させない）
      s.saysNoReflect && !s.failed },

  // ★看板その2: 全額免除だけ社会保険料控除を引かない（施行令6条の11）。
  //   所得70万・社保控除20万 → 全額免除は該当せず、4分の3免除が最上位になる。
  //   6区分に一律で控除を引く実装なら best が「全額免除」になってここで落ちる。
  { name: "kokunen_kojo", expect: (s) =>
      s.best === "4分の3免除" && s.monthlyPay === 4480 &&
      !s.available.includes("全額免除") &&
      s.available.includes("4分の3免除") &&
      s.expectedAvailable.every((x) => s.available.includes(x)) && !s.failed },

  // ★学生は免除・納付猶予の対象外。世帯主が900万でも学生納付特例は本人だけで判定する。
  { name: "kokunen_gakusei", expect: (s) =>
      s.best === "学生納付特例" && s.monthlyPay === 0 &&
      s.available.length === 1 && s.available[0] === "学生納付特例" &&
      s.saysNoReflect && !s.failed },

  // 基準額のデータが配信できないときは、判定を出さずに断る（fail closed）
  { name: "kokunen_nodata", data404: "kokunen_menjo_r08.json",
    expect: (s) => s.failed && s.best === null },
  // ─── 予定納税の減額申請（所得税法104条・111条・113条）───
  // 基準額400,000 → 各期 400,000÷3=133,333.33 → ★100円未満切捨で133,300（104条3項）
  // 見積250,000は基準額の62.5%＝10分の7(280,000)以下 → ★承認義務（113条2項2号）
  { name: "yotei_nozei", expect: (s) =>
      s.kijun === 400000 && s.ki1 === 133300 && s.ki2 === 133300 &&
      s.line === 280000 && s.hantei === "承認が義務づけられます" &&
      s.kigen === "2026-07-15" && !s.encho && !s.nashi && !s.failed },
  // ★見積281,000は70.25%＝10分の7を「超える」。申請はできるが承認は義務ではない。
  //   ここが「以下」と「未満」の境目を守っているかの本番（281,000 vs 280,000）。
  { name: "yotei_nozei_nanawari_gai", expect: (s) =>
      s.line === 280000 && s.hantei === "申請はできます（承認は税務署長の判断）" && !s.failed },
  // ★★同じ281,000でも、医療費の支払(113条2項1号)なら承認義務に変わる。
  //   1号を実装していない/事由を無視する版は上と同じ答えを返して落ちる。
  { name: "yotei_nozei_iryohi", expect: (s) =>
      s.hantei === "承認が義務づけられます" && s.iryohi && !s.failed },
  // ★通知が6/25発送 → 申請期限は7/15ではなく「1月を経過した日」＝7/25（111条3項）
  { name: "yotei_nozei_encho", expect: (s) =>
      s.kigen === "2026-07-25" && s.encho && !s.failed },
  // 基準額100,000は15万円未満 → 予定納税は生じない（104条1項）
  { name: "yotei_nozei_nashi", expect: (s) =>
      s.nashi && s.kijun === 100000 && s.ki1 === null && !s.failed },

  // ─── 算定基礎届（健康保険法41条／厚生年金保険法21条）───
  // ★★このツールの看板。5月は10日で除かれ、600,000÷**2**＝300,000（第22級）。
  //   常に3で割る実装は 233,333（第19級）を出す＝等級が1つ下がる。比較行も出ること。
  { name: "santei", expect: (s) =>
      s.hoshu === 300000 && s.tsukisu === 2 && s.hitsuyo === 17 &&
      s.kenkoGrade === 22 && s.kenko === 300000 &&
      s.hikaku === 233333 && s.saysGradeChanges &&
      // ★同じ入力でも随時改定なら要件を満たさないことを名指ししている（43条1項）
      s.saysZuijiNG &&
      s.kikan === "2026年9月 〜 2027年8月" && !s.fuka && !s.taishogai && !s.failed },
  // 全月17日以上 → 分母3。700,000÷3＝233,333 → 第19級240,000。
  // ★報酬月額と標準報酬月額が違う値になる唯一のシーン（両者を取り違える実装をここで殺す）。
  { name: "santei_zengetsu", expect: (s) =>
      s.hoshu === 233333 && s.tsukisu === 3 && s.kenko === 240000 && s.kenkoGrade === 19 &&
      s.hikaku === null && !s.saysGradeChanges && !s.failed },
  // ★短時間労働者は11日でよい（施行規則24条の2）。12日の月が除かれず3か月とも使う。
  { name: "santei_tanjikan", expect: (s) =>
      s.hitsuyo === 11 && s.tsukisu === 3 && s.hoshu === 120000 && s.kenko === 118000 && !s.failed },
  // ★★同じ12日でも一般なら全月が除かれる。17日/11日を取り違える実装はここで落ちる。
  { name: "santei_nissu_fusoku", expect: (s) =>
      s.hitsuyo === 17 && s.fuka && s.hoshu === null && !s.failed },
  // ★6月15日に資格取得 → その年は定時決定の対象外（41条3項）。金額を出さないこと。
  { name: "santei_taishogai", expect: (s) =>
      s.taishogai && s.hoshu === null && !s.failed },

  // ─── 法人税・地方法人税（法人税法66条／措置法42条の3の2／地方法人税法10条）───
  // ★★このツールの看板。所得2,000万 → 800万×15%＋1,200万×23.2%＝3,984,000。
  //   所得全体に15%を掛ける実装は3,000,000＝984,000円の過少。比較行も出ること。
  //   地方法人税は 3,984,000×10.3%＝410,300（所得に掛けると2,060,000で5倍の過大）。
  { name: "hojinzei", expect: (s) =>
      s.keigenRate === 15 && s.hojinzei === 3984000 && s.chiho === 410300 &&
      s.total === 4394300 && s.hikaku === 3000000 && !s.kogaku && !s.failed },
  // ★10億円「ちょうど」は15%のまま（条文は「年十億円を超える」）
  { name: "hojinzei_10oku_choudo", expect: (s) =>
      s.keigenRate === 15 && !s.kogaku && !s.failed },
  // ★★1円超えると17%。800万円以下の部分だけが 1,200,000→1,360,000 に増える（差160,000）
  { name: "hojinzei_10oku_koe", expect: (s) =>
      s.keigenRate === 17 && s.kogaku && s.hojinzei === 231504000 && !s.failed },
  // ★特例が使えない法人は19%のまま（15%を当てる実装はここで落ちる）
  { name: "hojinzei_tokurei_nashi", expect: (s) =>
      s.keigenRate === 19 && s.hojinzei === 1520000 && s.chiho === 156500 && !s.failed },
  // 資本金1億円超 → 軽減の枠そのものが無く、全額23.2%
  { name: "hojinzei_daihojin", expect: (s) =>
      s.keigenNashi && s.keigenRate === null && s.hojinzei === 1856000 && !s.failed },
  // ★事業年度6か月 → 軽減の枠400万円・高額の線5億円。按分しない実装は1,200,000で落ちる
  { name: "hojinzei_6kagetsu", expect: (s) =>
      s.hojinzei === 1528000 && /¥4,000,000/.test(s.anbun || "") &&
      /¥500,000,000/.test(s.anbun || "") && !s.failed },

  // ─── 法定福利費（徴収法施行規則 別表第1／厚労省の公表料率）───
  // ★★このツールの看板。標報30万・賃金32万（通勤手当2万）・東京・その他の各種事業。
  //   健保 300,000×9.85%÷2＝14,775／厚年 300,000×18.3%÷2＝27,450 は**標準報酬月額**、
  //   雇用 320,000×8.5/1000＝2,720／労災 320,000×3/1000＝960 は**賃金総額**。
  //   ★全部を標準報酬月額でやる実装は雇用2,550・労災900になって落ちる。
  //   ★子育て拠出金690と労災960は全額事業主（合計1,650）。
  //   ★選択肢はデータから作る（53業種・8分類・47都道府県）。HTMLに書き写した実装は数がずれる。
  { name: "hotei_fukuri", expect: (s) =>
      s.gyoshuCount === 53 && s.optgroupCount === 8 && s.kenCount === 47 &&
      s.kenko === 14775 && s.kosei === 27450 && s.kosodate === 690 &&
      s.koyouBun === 2720 && s.rousai === 960 && s.total === 46595 &&
      s.zengaku === 1650 && s.kaigoBun === 0 &&
      s.saysZengaku && s.saysOrikanNot && !s.failed },
  // ★★同じ給与でも林業（52/1000）なら労災が960→16,640。会社負担は月15,680円増える。
  //   労災率を一律で持つ実装（「だいたい0.3%」）はここで落ちる。
  { name: "hotei_fukuri_ringyo", expect: (s) =>
      s.rousai === 16640 && s.total === 62275 && s.zengaku === 17330 &&
      // 本人が引かれる額は業種で変わらない（労災は全額事業主だから）
      s.honnin === 43825 && !s.failed },
  // ★40歳以上65歳未満は介護 300,000×1.62%÷2＝2,430 が労使とも乗る
  { name: "hotei_fukuri_kaigo", expect: (s) =>
      s.kaigoBun === 2430 && s.total === 49025 && s.honnin === 46255 && !s.failed },
  // ★建設の事業は雇用保険の事業主負担が10.5/1000（320,000×10.5/1000＝3,360）。
  //   雇用保険を一般の事業で固定する実装は2,720で落ちる。
  { name: "hotei_fukuri_kensetsu", expect: (s) =>
      s.koyouBun === 3360 && s.rousai === 3840 && s.total === 50115 && !s.failed },
  // ─── 源泉徴収票の書き方（措置法29条の4／所得税法190条・226条・別表第五）───
  // ★★このツールの看板。支払170万 → 1,700,000−740,000＝960,000。
  //   別表第五で引くと1,050,000で90,000円の差。去年と同じ気持ちで引くとこの帯だけ狂う。
  { name: "gensen_hyo", expect: (s) =>
      s.ni === 960000 && s.tokurei && s.hikaku === 1050000 &&
      s.san === 830000 && s.nokori === 130000 && !s.failed },
  // ★★支払70万でも特例が効く（1項は「220万円以下」で下限が無い）。②欄は0。
  //   「69.1万円以上から」と下限を置く実装は、ここで別表第五の50,000を出して落ちる。
  { name: "gensen_hyo_teigaku", expect: (s) =>
      s.ni === 0 && s.tokurei && s.hikaku === 50000 && !s.failed },
  // 支払300万は特例の帯の外 → 別表第五（比較行は出さない）
  { name: "gensen_hyo_beppyo5", expect: (s) =>
      s.ni === 2020000 && !s.tokurei && s.hikaku === null &&
      /別表第五/.test(s.kubun || "") && !s.failed },
  // ★★年末調整をしていない人の②③欄は「空欄」。**0円ではない**（0と書くと別の意味になる）
  { name: "gensen_hyo_kuran", expect: (s) =>
      s.ni === "空欄" && s.san === "空欄" && s.nokori === "空欄" &&
      /毎月徴収した税額の合計/.test(s.warns || "") && !s.failed },
  // ★④欄の100円未満の端数を指摘する（国税通則法119条1項）
  { name: "gensen_hyo_hasu", expect: (s) =>
      /100円未満/.test(s.warns || "") && !s.failed },

  // ─── 補助金の検索（jGrants 公開API）───
  // ★★件数をベタ書きしない。データは毎日変わる（締切が過ぎ、掃引で入れ替わる）。
  //   固定すると、明日には赤くなる検査になり、誰も直さなくなる。
  //   ここで固定するのは**不変条件**だけ:
  //     ・締切を過ぎたものが1件も出ていない（minDay >= 0）＝このツールの看板
  //     ・締切順に並んでいる
  //     ・出典表示と編集・加工の明示（jGrants Web-API利用規約の義務）
  //     ・網羅を約束していないと書いてある（API が全件取得に対応していないため）
  //     ・データの鮮度を画面に出している
  { name: "hojokin", expect: (s) =>
      s.count > 0 && s.items > 0 && s.items <= 60 && s.areaOptions > 10 &&
      s.minDay >= 0 && s.sorted &&
      s.attribution && s.henshu && s.saysNotExhaustive && s.freshness && !s.failed },
  // ★都道府県で絞っても「全国」の補助金は残る。0件になったら絞りすぎか実装の誤り。
  //   件数は全体より減るが、全国分があるので相当数が残るはず。
  { name: "hojokin_area", expect: (s) =>
      s.count > 0 && s.minDay >= 0 && s.sorted && s.attribution && !s.failed },
  // ★7日以内で絞ったら、表示されている残り日数が全部7日以内であること
  { name: "hojokin_soon", expect: (s) =>
      s.days.filter((d) => d !== null).every((d) => d >= 0 && d <= 7) &&
      s.sorted && s.attribution && !s.failed },
  // 条件に合わないときは0件。★それでも出典表示と鮮度は出し続ける
  { name: "hojokin_zero", expect: (s) =>
      s.count === 0 && s.items === 0 && s.attribution && s.freshness && !s.failed },

  // ─── 補助金の経理・税務（法人税法42条・43条・44条）───
  // ★★分かれ目は「返還を要しないことが期末までに確定したか」。
  //   補助金3,000,000・取得価額10,000,000・償却率0.1・12か月。
  { name: "hojokin_zeimu", expect: (s) =>
      s.jobun === "法人税法42条1項" && s.gendo === 3000000 &&
      s.genka === 700000 &&                       // ★直接減額は圧縮後700万で償却
      s.assyukuShiwake && !s.tokubetsuShiwake && !s.tsumitateShiwake &&
      s.saysKurinobe && !s.failed },               // ★課税の繰延べだと言っている
  // ★同じ条件でも積立金方式なら簿価が下がらないので償却費は1,000,000（差300,000）
  { name: "hojokin_zeimu_tsumitate", expect: (s) =>
      s.jobun === "法人税法42条1項" && s.genka === 1000000 &&
      s.tsumitateShiwake && !s.assyukuShiwake && !s.failed },
  // ★★返還不要が未確定 → 43条の特別勘定。**圧縮記帳の仕訳を出してはいけない**。
  //   「補助金をもらった＝圧縮記帳」と実装するとここで落ちる。
  { name: "hojokin_zeimu_mikakutei", expect: (s) =>
      s.jobun === "法人税法43条1項" && s.gendo === null &&
      s.tokubetsuShiwake && !s.assyukuShiwake && !s.tsumitateShiwake && !s.failed },
  // ★確定していても、対象の固定資産を取得していなければ42条では処理できない
  { name: "hojokin_zeimu_mishutoku", expect: (s) =>
      s.jobun === "法人税法43条1項" && s.gendo === null && !s.assyukuShiwake && !s.failed },
  // ★特別勘定を持っていて確定 → 44条。特別勘定の取崩しと圧縮記帳が両方出る
  { name: "hojokin_zeimu_atode", expect: (s) =>
      s.jobun === "法人税法44条1項" && s.gendo === 3000000 &&
      s.tokubetsuShiwake && s.assyukuShiwake && !s.failed },
  // ★補助金12,000,000 > 取得価額10,000,000 → 取得価額で頭打ち（帳簿価額を負にできない）
  { name: "hojokin_zeimu_capped", expect: (s) =>
      s.gendo === 10000000 && s.capped && s.genka === 0 && !s.failed },
  // ─── 役員社宅の賃貸料相当額（所得税基本通達36-40〜36-41）───
  { name: "yakuin_shataku", expect: (s) =>
      s.total === 64327 && s.kazei === 34327 && !s.kazeiNashi && !s.failed },
  // ★賃貸料相当額以上を受け取っていれば給与課税は生じない（このツールの結論そのもの）
  { name: "yakuin_shataku_kazei_nashi", expect: (s) =>
      s.total === 64327 && s.kazei === 0 && s.kazeiNashi && !s.failed },
];

// ── /embed/ ウィジェットのパリティ検証(2026-07-20) ─────────────────────────────
// 27本の埋め込みウィジェットは docs/ 直下しか走査しない下の網羅チェックに**構造的に**
// 入らず、結果ボックス全損(§46)の型が起きても検出できなかった。シーンは本体ページと
// 同じ入力を与え、**利用者に見えている見出し値(.big)が本体と一致する**ことを固定する。
// オラクルは本体 — 本体は上の各シーンが一次情報(公式額表・条文)と照合済みなので、
// 期待値をもう一組持たない(二重管理は必ず腐る)。
const EMBED_TOOLS = [
  "bonus-tedori", "eigyobi", "furusato", "fuyo-kojo", "genka", "gensen-choshu",
  "haigusha-kojo", "ideco-setsuzei", "ikuji", "inshi",
  "iryohi", "jidoshazei", "juminzei", "jutaku", "kabe", "kihonteate", "papa-ikukyu",
  "senpou-futan", "shakai-hoken", "shiharai-site", "shobyo", "shohizei", "shokibo-kyosai",
  "shussan", "sozokuzei", "taishokukin", "tedori", "yukyu", "zangyodai", "zengin-kana", "zoyozei",
];
// ★2026-08-03: 以前は「先頭の見出し1つ」しか比べておらず、次の3種を素通ししていた(全て実測):
//   ① 2本目以降の .big が丸ごと無検査  … shakai-hoken の賞与を ¥189,041→¥189,042 にしても緑
//   ② 同じ要素の中の2つ目の金額が無検査 … taishokukin の（税金 ¥628,222）を +1 しても緑
//   ③ 飾りの数字を値と取り違えて空回り  … jutaku は「1年あたり」の"1"を比べていたので、
//                                        ¥315,000→¥315,001 にしても緑("1"==="1")
// → 可視 .big **全部**の、¥で名指しした金額**全部**を順序どおり突き合わせる(harness の valsOf)。
//   個数の不一致も赤にする(embed が見出しを1本落とす = §46 全損の型そのもの)。
for (const t of EMBED_TOOLS)
  SCENES.push({ name: `embed_${t}`, expect: (s) => {
    // 先頭値の縮退ガードは従来どおり(全損時に 0 や空で緑にしない)
    if (s.mainVal == null || s.mainVal === "" || s.mainVal === "0") return false;
    const a = s.mainVals, b = s.embedVals;
    // 値が1つも取れていないなら、それ自体を赤にする。**「0件だから相違なし」で満点を出さない**
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0) return false;
    return a.length === b.length && a.every((v, i) => v === b[i]);
  } });

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

// 絞り込みは環境変数でも引数でも指定できる（環境変数を前置きできないシェル向け）。
const only = process.env.E2E_ONLY || process.argv[2];
const fails = [];
const covered = new Map(); // ページ → 正常条件で駆動したシーン名

// 末尾に * を付けると前方一致（1つのツールのシーンだけまとめて回すため）。
// 例: node tools/e2e/e2e.mjs 'jouto*' → jouto / jouto_slow / jouto_choki … を全部
const match = (name) => !only || (only.endsWith("*") ? name.startsWith(only.slice(0, -1)) : name === only);
for (const sc of SCENES.filter((s) => match(s.name))) {
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
  // E2E_DUMP=1 で成功時も状態を見る(緑が「何を読んで緑なのか」を確かめる用)
  if (ok && process.env.E2E_DUMP)
    console.log("   ↳ " + JSON.stringify(s, null, 2).split("\n").join("\n   "));
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
  // docs直下に加えて docs/embed 配下(2階層目)も走査する。27ウィジェットは1階層の走査では
  // **構造的に網の外**で、結果ボックス全損(§46)の型が起きても検出できなかった(2026-07-20)
  for (const base of ["docs", "docs/embed"]) {
    for (const d of await readdir(join(ROOT, base), { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const idx = join(ROOT, base, d.name, "index.html");
      let html;
      try { html = await readFile(idx, "utf8"); } catch { continue; }
      // 計算ツール = assets/*_core.js を読み込んで計算しているページ(記事・about等は除外)
      if (/assets\/[a-z_]+_core\.js/.test(html)) toolPages.push(`/${base}/${d.name}/`);
    }
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
