/**
 * 残業代（割増賃金）計算機の単体テスト。
 *
 * ★ここでいちばん効いている検査は「外部オラクル」＝ **労働基準法施行規則20条**。
 *   規則20条は「時間外と深夜が重なったときの割増率」を**条文が直接、数字で書いている**:
 *       時間外 × 深夜   … 五割以上   (50%)
 *       60時間超 × 深夜 … 七割五分以上 (75%)
 *       休日   × 深夜   … 六割以上   (60%)
 *   この実装は、**深夜の上乗せ25%を時間外の段（25%か50%か）と独立に足し合わせて**求める。
 *   足し算の結果が上の3つと一致するということは、**その読み方が正しい**ことを条文が保証している。
 *   （自分の期待値どうしを比べても、実装と期待値が同じ勘違いをしていたら緑になる ── gbrain §26）
 *
 * 条文はすべて e-Gov 法令API v2 の生テキストで確認済み:
 *   労基法37条1項＋平成6年政令第5号 … 時間外 二割五分 / 休日 三割五分
 *   労基法37条1項ただし書           … 1か月60時間を超えた「延長して労働させた時間」は 五割以上
 *   労基法37条4項                   … 深夜(22時〜5時) 二割五分以上
 *   労基法37条5項＋労基則21条        … 基礎から除ける賃金は7つの限定列挙
 *   労基則19条1項4号                … 月給の1時間単価は「1年間における1月平均所定労働時間数」で除す
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  calcZangyodai, combinedPremiumPct, monthlyScheduledHours, toMinutes, roundYen,
} from "../docs/assets/zangyodai_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/zangyodai_rates.json", import.meta.url)));
let n = 0;
const eq = (a, b, msg) => { assert.strictEqual(a, b, `${msg}: ${a} ≠ ${b}`); n++; };
const near = (a, b, msg, tol = 1e-6) => {
  assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} ≠ ${b}`); n++;
};

// ===== 0. ★★外部オラクル：労働局が“実額で”公表している計算例 =====
// 自分の期待値どうしを比べても、実装と期待値が同じ勘違いをしていたら緑になる（gbrain §26）。
// だから **厚生労働省（都道府県労働局）が円単位で公表している計算例** をそのまま固定する。
{
  // ── 神奈川労働局／川崎北労働基準監督署「割増賃金の計算方法」 ────────────────
  //   https://jsite.mhlw.go.jp/kanagawa-roudoukyoku/content/contents/001107232.pdf
  //   「①(365-125)×8÷12＝160、②240,000÷160＝1,500」
  //   「1時間あたりの賃金額が1,500円の労働者に、13時から23時まで(うち休憩1時間)労働させた場合、
  //     22時から23時までは時間外労働かつ深夜労働となるため、
  //     1,500(時間給)×1.5(時間外労働1.25＋深夜労働0.25)＝2,250円支払わなければなりません。」
  //
  // ★この 2,250円 が、この実装の設計そのものを裏書きしている:
  //   同じ1時間を「時間外1時間」と「深夜1時間」に**重ねて数え**、深夜は**上乗せ25%だけ**を足す。
  //   もし深夜を125%で計算していたら 1,875+1,875=3,750円 になり、労働局の公表額と合わない。
  const k = calcZangyodai({ base: 240000, annualHolidays: 125, dailyHours: 8,
                            overtimeHours: 1, holidayHours: 0, nightHours: 1, fixedAmount: 0 }, D);
  near(k.monthlyHours, 160, "★神奈川労働局: (365−125)×8÷12 ＝ 160時間");
  near(k.hourlyRate, 1500, "★神奈川労働局: 240,000 ÷ 160 ＝ 1,500円");
  eq(k.breakdown.overtime.amount, 1875, "★神奈川労働局: 時間外1時間 1,500×1.25 ＝ 1,875円");
  eq(k.breakdown.night.amount, 375, "★神奈川労働局: 深夜の上乗せ 1,500×0.25 ＝ 375円");
  eq(k.total, 2250,
    "★★神奈川労働局が公表している実額: 時間外かつ深夜の1時間は 1,500×1.5 ＝ 2,250円");

  // ── 東京労働局「しっかりマスター 労働基準法 割増賃金編」p.3 ────────────────
  //   https://jsite.mhlw.go.jp/tokyo-roudoukyoku/content/contents/000501860.pdf
  //   基本給235,000＋精皆勤手当8,000＝243,000（家族手当20,000・通勤手当15,000は**除外**）
  //   「（365−122）× 8 ／ 12 ＝162」「243,000 ÷ 162 ＝1,500円」
  //
  // ★この例は「除外できるのは7つだけ」を実額で示している:
  //   **精皆勤手当8,000円は基礎に算入されている**（除外リストに無いから）。
  //   もし精皆勤手当まで除いて235,000÷162で計算すれば1,450.6円になり、労働局の1,500円と合わない。
  const t = calcZangyodai({ base: 243000, annualHolidays: 122, dailyHours: 8,
                            overtimeHours: 0, holidayHours: 0, nightHours: 0, fixedAmount: 0 }, D);
  near(t.monthlyHours, 162, "★東京労働局: (365−122)×8÷12 ＝ 162時間");
  near(t.hourlyRate, 1500,
    "★★東京労働局が公表している実額: 243,000 ÷ 162 ＝ 1,500円（精皆勤手当は基礎に算入する）");
}

// ===== 1. ★外部オラクル：労基則20条が書いている「重なったときの割増率」 =====
// 実装は 25+25 / 50+25 / 35+25 と**足して**求める。条文の数字と一致しなければ読み方が誤っている。
{
  eq(combinedPremiumPct("overtime", true, D), 50,
    "★★労基則20条1項: 時間外が深夜に及ぶとき「五割以上」＝ 25(時間外) + 25(深夜)");
  eq(combinedPremiumPct("overtime_over60", true, D), 75,
    "★★労基則20条1項かっこ書き: 60時間超が深夜に及ぶとき「七割五分以上」＝ 50 + 25");
  eq(combinedPremiumPct("holiday", true, D), 60,
    "★★労基則20条2項: 休日労働が深夜に及ぶとき「六割以上」＝ 35(休日) + 25(深夜)");

  // 重ならないときは、政令・法の率そのもの
  eq(combinedPremiumPct("overtime", false, D), 25, "労基法37条1項＋平成6年政令第5号: 時間外は二割五分");
  eq(combinedPremiumPct("overtime_over60", false, D), 50, "労基法37条1項ただし書: 60時間超は五割");
  eq(combinedPremiumPct("holiday", false, D), 35, "労基法37条1項＋平成6年政令第5号: 休日は三割五分");
  eq(combinedPremiumPct("night_only", false, D), 25, "労基法37条4項: 深夜は二割五分");
}

// ── 基準ケース（以下の検査で使い回す）────────────────────────────────
// 月給30万円（割増賃金の基礎となる賃金）・年間所定休日120日・1日8時間
//   → 所定労働日 245日 / 月平均 163.333…時間 / 単価 1,836.7346…円
function BC(over) {
  return { base: 300000, annualHolidays: 120, dailyHours: 8,
           overtimeHours: 0, holidayHours: 0, nightHours: 0, fixedAmount: 0, ...over };
}
const BASE_CASE = BC({ overtimeHours: 20 });

// ===== 2. 1時間あたりの単価（労基則19条1項4号） =====
// 月給 ÷「1年間における1月平均所定労働時間数」。**その月の所定労働時間で割らない**
// （その月で割ると、営業日の少ない月ほど単価が上がり、月ごとに残業代が変わってしまう）。
{
  // 年間所定休日120日・1日8時間 → (365−120)×8÷12 = 163.333…時間
  near(monthlyScheduledHours(120, 8, D), (245 * 8) / 12, "月平均所定労働時間 = (365−120)×8÷12");
  const r = calcZangyodai(BASE_CASE, D);
  near(r.monthlyHours, (245 * 8) / 12, "月平均所定労働時間が結果に載る");
  near(r.hourlyRate, 300000 / ((245 * 8) / 12), "単価 = 月給 ÷ 月平均所定労働時間 = 1,836.73…円");
}

// ===== 3. 各層の金額（手で検算できる値を固定する） =====
{
  // 時間外20時間: 1,836.7346… × 20 × 1.25 = 45,918.367… → 45,918円（50銭未満切捨）
  const r = calcZangyodai(BC({ overtimeHours: 20 }), D);
  eq(r.breakdown.overtime.amount, 45918, "時間外20時間 → 45,918円（単価×20×125%・50銭未満切捨）");
  eq(r.breakdown.overtime.pct, 125, "時間外に支払うのは125%（上乗せ25% ＋ 労働そのものの対価100%）");
  eq(r.total, 45918, "総額＝内訳の合計");

  // ★所定労働時間内の深夜は「上乗せ25%だけ」。対価100%は月給に既に入っている。
  //   ここを125%で計算すると、月給制の人の深夜手当を**5倍**に見積もる。
  const night = calcZangyodai(BC({ nightHours: 10 }), D);
  eq(night.breakdown.night.pct, 25, "★深夜の上乗せは25%だけ（125%ではない）");
  eq(night.breakdown.night.amount, 4592, "深夜10時間 → 4,592円（単価×10×25%・50銭以上切上げ）");

  // 休日8時間: 1,836.7346… × 8 × 1.35 = 19,836.73… → 19,837円
  const hol = calcZangyodai(BC({ holidayHours: 8 }), D);
  eq(hol.breakdown.holiday.pct, 135, "休日に支払うのは135%");
  eq(hol.breakdown.holiday.amount, 19837, "休日8時間 → 19,837円");
}

// ===== 4. ★60時間の線に、法定休日の労働は入らない（労基法37条1項ただし書） =====
// ただし書が数えるのは「当該**延長して**労働させた時間」＝時間外労働。休日労働は「延長」ではない。
{
  // 時間外55時間＋休日16時間＝計71時間働いても、**60時間超の50%は1円も発生しない**
  const r = calcZangyodai(BC({ overtimeHours: 55, holidayHours: 16 }), D);
  eq(r.over60Hours, 0, "★休日労働16時間は60時間の線に入らない（時間外は55時間のまま）");
  eq(r.hasOver60, false, "★時間外55時間＋休日16時間では50%の割増は発生しない");
  eq(r.breakdown.overtime_over60.amount, 0, "60時間超の層は0円");

  // 時間外70時間 → 60時間までが25%、超えた10時間が50%
  const o = calcZangyodai(BC({ overtimeHours: 70 }), D);
  eq(o.over60Hours, 10, "時間外70時間 → 60時間を超えた10時間");
  eq(o.breakdown.overtime.hours, 60, "60時間までは25%の層");
  eq(o.breakdown.overtime_over60.hours, 10, "超えた10時間は50%の層");
  eq(o.breakdown.overtime_over60.pct, 150, "60時間超に支払うのは150%");
  // 60時間: 1,836.7346…×60×1.25 = 137,755.10… → 137,755円
  eq(o.breakdown.overtime.amount, 137755, "60時間まで → 137,755円");
  // 10時間:  1,836.7346…×10×1.50 =  27,551.02… →  27,551円
  eq(o.breakdown.overtime_over60.amount, 27551, "60時間超の10時間 → 27,551円（150%）");
  eq(o.total, 137755 + 27551, "総額＝内訳の合計");

  // ちょうど60時間では、まだ50%は発生しない（「超えた場合」だから）
  const j = calcZangyodai(BC({ overtimeHours: 60 }), D);
  eq(j.hasOver60, false, "★ちょうど60時間では50%は発生しない（条文は「六十時間を超えた場合」）");
  eq(j.breakdown.overtime_over60.amount, 0, "ちょうど60時間 → 50%の層は0円");

  // ★25%のまま払われていたときの不足額 = 上乗せ25%分 = 150%で払った額の 1/6（1/3ではない）
  //   150%: 27,551円 / 125%: 22,959円 → 差 4,592円
  eq(o.over60Extra, 4592, "★60時間超を25%のままで払うと4,592円不足する（上乗せ25%分）");
  eq(o.over60Extra * 6 - o.breakdown.overtime_over60.amount <= 1, true,
    "★不足額は150%で払った額のおよそ1/6（1/3と取り違えると倍額を主張してしまう）");
  eq(j.over60Extra, 0, "60時間を超えていなければ不足額は0円");
}

// ===== 5. ★内訳の合計は、必ず総額に一致する（端数処理は区分ごと・基発150号） =====
// 利用者は必ず内訳を縦に足して確かめる。ここで1円ずれると、画面が嘘をついたことになる。
{
  const cases = [
    BC({ overtimeHours: 20 }),
    BC({ overtimeHours: 70, holidayHours: 8, nightHours: 15 }),
    BC({ overtimeHours: 1, holidayHours: 1, nightHours: 1 }),
    BC({ overtimeHours: 0.5, nightHours: 2.5 }),
    BC({ overtimeHours: 45.5, holidayHours: 7.5, nightHours: 12.5 }),
    BC({ base: 213456, annualHolidays: 105, dailyHours: 7.5, overtimeHours: 33, nightHours: 9 }),
    BC({ base: 187000, annualHolidays: 125, dailyHours: 7, overtimeHours: 61, holidayHours: 3 }),
  ];
  for (const c of cases) {
    const r = calcZangyodai(c, D);
    const sum = Object.values(r.breakdown).reduce((a, b) => a + b.amount, 0);
    eq(r.total, sum,
      `★内訳の合計＝総額（時間外${c.overtimeHours}h・休日${c.holidayHours}h・深夜${c.nightHours}h）`);
    eq(Number.isInteger(r.total), true, "総額は整数（1円未満の端数は残さない）");
  }
}

// ===== 6. 固定残業代（みなし残業）は、超えた分の差額を必ず払う =====
{
  // 固定残業代3万円をもらっているが、実際の残業代は45,918円 → 差額15,918円は別に払う必要がある
  const r = calcZangyodai(BC({ overtimeHours: 20, fixedAmount: 30000 }), D);
  eq(r.total, 45918, "実際の割増賃金は45,918円");
  eq(r.fixed, 30000, "固定残業代は30,000円");
  eq(r.shortfall, 15918, "★差額15,918円は、固定残業代とは別に支払わなければならない");
  eq(r.fixedIsShort, true, "★固定残業代が足りていないことを申告する");

  // 固定残業代のほうが多ければ差額は0（返金は不要）
  const e = calcZangyodai(BC({ overtimeHours: 5, fixedAmount: 30000 }), D);
  eq(e.shortfall, 0, "実際の残業代が固定残業代の範囲に収まっていれば差額は0円");
  eq(e.fixedIsShort, false, "足りているときは警告しない");
}

// ===== 7. 端数処理（50銭未満切捨・50銭以上切上げ／基発150号） =====
{
  eq(roundYen(1, 2), 1, "0.5円 → 1円（50銭以上切上げ）");
  eq(roundYen(49, 100), 0, "0.49円 → 0円（50銭未満切捨）");
  eq(roundYen(3, 2), 2, "1.5円 → 2円");
  eq(roundYen(100, 1), 100, "端数がなければそのまま");
  eq(toMinutes(0.5), 30, "0.5時間は30分");
  eq(toMinutes(-3), 0, "負の時間は0として扱う");
}

// ===== 8. fail closed：単価が定義できない入力には答えない =====
{
  eq(calcZangyodai(BC({ base: 0, overtimeHours: 20 }), D), null, "月給0円 → 答えない");
  eq(calcZangyodai(BC({ dailyHours: 0, overtimeHours: 20 }), D), null, "1日の所定労働時間0 → 答えない");
  eq(calcZangyodai(BC({ annualHolidays: 365, overtimeHours: 20 }), D), null,
    "年間所定休日365日（所定労働日が0日）→ 答えない");
}

// ===== 9. 除外できる手当は7つの限定列挙（労基法37条5項＋労基則21条） =====
// 実装が持つデータが条文どおりであることを固定する（役職手当・資格手当・皆勤手当は**入らない**）。
{
  const names = D.excluded_allowances.items.map((x) => x.name);
  eq(names.length, 7, "★基礎から除ける賃金は7つだけ（限定列挙）");
  for (const must of ["家族手当", "通勤手当", "別居手当", "子女教育手当", "住宅手当",
                      "臨時に支払われた賃金", "1か月を超える期間ごとに支払われる賃金（賞与など）"]) {
    eq(names.includes(must), true, `除外できる賃金に「${must}」が入っている`);
  }
  for (const mustNot of ["役職手当", "資格手当", "皆勤手当", "精勤手当", "地域手当"]) {
    eq(names.includes(mustNot), false,
      `★「${mustNot}」は除外できない（どんな名前でも基礎に算入する）`);
  }
}

console.log(`ok test_zangyodai.mjs (${n} checks)`);
