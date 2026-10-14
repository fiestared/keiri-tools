/**
 * 就業促進定着手当（雇用保険の就業促進手当のうち、再就職後に賃金が下がった人への上乗せ）の計算ロジック。
 * DOM非依存・テスト対象。
 *
 * 一次ソース（curl で生テキストを読んで実装した）:
 * - 雇用保険法56条の3第3項（かっこ書き「…十分の二を乗じて得た数を乗じて得た額を限度として…」）
 * - 雇用保険業務取扱要領 57261〜57264（就職促進給付・R8.8版 https://www.mhlw.go.jp/content/001730830.pdf）
 *     57263 みなし賃金日額は「就職した日以降の最初の賃金締切日の翌日から6か月に達する日以降の最初の
 *           賃金締切日までの期間について、法第17条の規定を適用した場合に算定されることとなる賃金日額の
 *           算定方法と同様の方法により行う」。就職日が締切日の翌日なら就職日から6か月。
 *     57264 額＝（算定基礎賃金日額 − みなし賃金日額）× みなし賃金日額の算定に係る期間の賃金支払基礎日数。
 *           上限＝基本手当日額（再就職手当の支給に係る基本手当日額・上限あり）× 再就職手当の支給前の
 *           支給残日数 × 10分の2（令和7年4月1日前の就職は10分の4、給付率10分の7なら10分の3）。
 *           1円未満切捨て。
 *     57262 算定基礎賃金日額が下限額の場合は支給しない。
 * - 雇用保険業務取扱要領 50603・50615（第5〜第8 https://www.mhlw.go.jp/content/001689749.pdf）
 *     日給者は「賃金総額÷労働日数×100分の70」と「÷180」の大きい方。
 *     端数は「各項の計算は小数点以下第3位を四捨五入し…第2位まで」「最後の段階で小数点以下を切捨て」。
 * - ハローワーク リーフレット LL080801保03（https://www.hellowork.mhlw.go.jp/doc/syuugyousokushin.pdf）
 *     月給は「6か月間の賃金の合計額÷180」、日給・時給は (a)÷180 と (b)÷基礎日数×70% の高い方。
 *     賃金支払基礎日数は「月給制は暦日数、日給月給はその基礎となる日数、日給制・時給制は労働日数」。
 *     みなし賃金日額・離職前の賃金日額は、賃金日額の上限額・下限額で頭打ち／底上げ。
 * - 公表例（1円照合の基準）: 和歌山労働局「受給資格者のしおり」
 *     https://jsite.mhlw.go.jp/wakayama-roudoukyoku/content/contents/001277222.pdf
 *     （10,000円 − 9,500円）× 183日 ＝ 91,500円、上限 6,307円 × 90日 × 20% ＝ 113,526円 → 91,500円。
 *     ★6,307円はこの例の人の基本手当日額で、上限額ではない（上限は年度で 6,395／6,570／6,745円）。
 *
 * ★ この実装で間違えやすい事実:
 *   1. 金額は「6か月の賃金の合計」でなく**1日あたりの差 × 賃金支払基礎日数**。月給制は暦日数（183日など）。
 *   2. 6か月は**就職日からではなく、就職後最初の締切日の翌日から**（就職日が締切日の翌日なら就職日から）。
 *   3. 上限・下限額は毎年8月1日に変わる。このツールは**就職日が属する適用期間の額**を使う
 *      （上限は「再就職手当の支給に係る基本手当日額」＝再就職手当と同じ額。要領57264）。
 *      適用期間のデータが無い就職日は計算しない（現行の額で黙って計算しない）。
 */
import { saishushokuCap } from "./saishushoku_core.js";

/** 令和7年4月1日以後の就職だけを扱う（それより前は上限の率が違う） */
export const START = "2025-04-01";

// ---------- 日付（YYYY-MM-DD 文字列。TZ に依存させないため UTC で数える） ----------
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parse = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > lastDay(y, mo)) return null;
  return { y, m: mo, d };
};
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const serial = ({ y, m, d }) => Date.UTC(y, m - 1, d) / 86400000;
const fromSerial = (n) => {
  const t = new Date(n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const str = (o) => ymd(o.y, o.m, o.d);

/** その月の締切日。closing は 1〜28 の日、または 31（＝末日） */
function closingOf(y, m, closing) {
  return { y, m, d: closing >= 29 ? lastDay(y, m) : closing };
}
const addMonth = (y, m, k) => {
  const t = (m - 1) + k;
  return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 + 1 };
};

/** d 以後（d を含む）の最初の締切日 */
function nextClosing(d, closing) {
  const c = closingOf(d.y, d.m, closing);
  if (serial(c) >= serial(d)) return c;
  const n = addMonth(d.y, d.m, 1);
  return closingOf(n.y, n.m, closing);
}

/**
 * みなし賃金日額の対象になる6か月（要領57263）。
 * @param {string} shushoku 就職日 YYYY-MM-DD
 * @param {number} closing 賃金締切日（1〜28、または 31＝末日）
 * @returns {{start:string,end:string,calendarDays:number,months:{from:string,to:string,days:number}[]}|null}
 */
export function wagePeriod(shushoku, closing) {
  const j = parse(shushoku);
  if (!j || !(closing >= 1 && closing <= 31) || (closing > 28 && closing !== 31)) return null;
  const prev = fromSerial(serial(j) - 1);
  // 就職日の前日が締切日 ＝ 就職日が締切日の翌日 → 就職日から数える
  const prevIsClosing = serial(closingOf(prev.y, prev.m, closing)) === serial(prev);
  const start = prevIsClosing ? j : fromSerial(serial(nextClosing(j, closing)) + 1);
  const months = [];
  let from = start;
  for (let i = 0; i < 6; i++) {
    const to = nextClosing(from, closing);
    months.push({ from: str(from), to: str(to), days: serial(to) - serial(from) + 1 });
    from = fromSerial(serial(to) + 1);
  }
  const end = parse(months[5].to);
  return { start: str(start), end: str(end), calendarDays: serial(end) - serial(start) + 1, months };
}

// ---------- 適用期間（上限・下限額）の選択 ----------
const bandOf = (age) => (age < 30 ? "under30" : age < 45 ? "age30_44" : age < 60 ? "age45_59" : "age60_64");

/**
 * 就職日に適用されていた賃金日額の上限・下限額と、再就職手当の基本手当日額の上限。
 * @param {string} date 就職日
 * @param {number} age 離職時の年齢
 * @param {object} D kihonteate_r07.json（現在の適用期間の正本）
 * @param {object} H teichaku_history.json（過去の適用期間）
 * @returns {{ok:true,label:string,from:string,to:string,min:number,max:number,saiCap:number,current:boolean}|{ok:false,reason:string}}
 */
export function limitsFor(date, age, D, H) {
  if (!parse(date)) return { ok: false, reason: "date" };
  if (date < START) return { ok: false, reason: "before_start" };
  const band = bandOf(age);
  const curFrom = D._meta.applies_from;
  const next = D._meta.next_revision;
  if (date >= curFrom) {
    if (next && date >= next) return { ok: false, reason: "beyond_data" };
    const to = next ? str(fromSerial(serial(parse(next)) - 1)) : "";
    return {
      ok: true, current: true, from: curFrom, to,
      label: D._meta.label,
      min: D.chingin_nichigaku_min,
      max: D.chingin_nichigaku_max[band],
      saiCap: saishushokuCap(age, D),
    };
  }
  const p = (H.periods || []).find((x) => x.from <= date && date <= x.to);
  if (!p) return { ok: false, reason: "no_period" };
  const senior = age >= 60 && age < 65;
  return {
    ok: true, current: false, from: p.from, to: p.to, label: p.label,
    min: p.chingin_nichigaku_min,
    max: p.chingin_nichigaku_max[band],
    saiCap: senior ? p.sai_cap_60_64 : p.sai_cap,
  };
}

// ---------- みなし賃金日額 ----------
/** 「小数点以下第3位を四捨五入し第2位まで」を銭（1/100円）の整数で返す。num/den は正の整数 */
const roundCents = (num, den) => Math.floor((Math.floor((num * 1000) / den) + 5) / 10);

/**
 * 再就職後6か月間の賃金の1日分の額（みなし賃金日額）。上限・下限をかける前の値。
 * @param {"getsukyu"|"nikkyu_gekkyu"|"nikkyu"} type 月給／日給月給／日給・時給
 * @param {number} total 6か月の賃金の合計（総支給・3か月を超える期間ごとの賃金を除く）
 * @param {number} baseDays 6か月の賃金支払基礎日数（日給・時給なら労働日数）
 * @returns {{raw:number,w1Cents:number,w2Cents:number|null,usedMinimum:boolean}}
 */
export function minashiRaw(type, total, baseDays) {
  const w1Cents = roundCents(total, 180);
  let w2Cents = null;
  if (type === "nikkyu" && baseDays > 0) {
    const perDayCents = roundCents(total, baseDays);
    // perDay × 70/100 を、さらに第3位で四捨五入（各項の計算ごとに丸める）
    w2Cents = Math.floor((perDayCents * 7 + 5) / 10);
  }
  const usedMinimum = w2Cents !== null && w2Cents > w1Cents;
  const cents = usedMinimum ? w2Cents : w1Cents;
  return { raw: Math.floor(cents / 100), w1Cents, w2Cents, usedMinimum };
}

/**
 * 就業促進定着手当の総合計算。
 *
 * @param {object} input
 *  - age: 離職時の年齢
 *  - shushoku: 就職日（YYYY-MM-DD）
 *  - closing: 賃金締切日（1〜28、31＝末日）
 *  - zenNichigaku: 離職前の賃金日額（受給資格者証に記載の賃金日額）
 *  - kihonDaily: 基本手当日額
 *  - remaining: 再就職手当を受ける前の支給残日数（就職日の前日時点）
 *  - type: "getsukyu"（月給）／"nikkyu_gekkyu"（日給月給）／"nikkyu"（日給・時給）
 *  - wages: 6か月それぞれの賃金（円）
 *  - baseDays: 賃金支払基礎日数の合計（月給なら省略可＝暦日数を使う）
 * @param {object} D kihonteate_r07.json
 * @param {object} H teichaku_history.json
 */
export function calcTeichaku(input, D, H) {
  const { age, shushoku, closing, zenNichigaku, kihonDaily, remaining, type, wages = [] } = input;
  const lim = limitsFor(shushoku, age, D, H);
  if (!lim.ok) return { ok: false, reason: lim.reason };
  const period = wagePeriod(shushoku, closing);
  if (!period) return { ok: false, reason: "closing" };

  const total = wages.reduce((a, b) => a + b, 0);
  const baseDays = type === "getsukyu" ? period.calendarDays : input.baseDays;
  const m = minashiRaw(type, total, baseDays);

  // 離職前・再就職後とも、賃金日額の上限・下限で頭打ち／底上げ（リーフレット＊1・注）
  const clamp = (v) => Math.min(Math.max(v, lim.min), lim.max);
  const zen = clamp(zenNichigaku);
  const minashi = clamp(m.raw);
  const zenAtMin = zen === lim.min; // 要領57262(ハ): 算定基礎賃金日額が下限額なら支給しない

  const dailyUsed = Math.min(kihonDaily, lim.saiCap);
  // 上限 ＝ 基本手当日額 × 支給残日数 × 10分の2（整数のまま掛けて最後に割る＝桁落ちしない）
  const cap = Math.floor((dailyUsed * remaining * 2) / 10);

  const diff = Math.max(0, zen - minashi);
  const gross = diff * baseDays;
  const amount = zenAtMin ? 0 : Math.min(gross, cap);

  return {
    ok: true,
    limits: lim,
    period,
    baseDays,
    total,
    minashi: { ...m, clamped: minashi, raisedToMin: m.raw < lim.min, cappedAtMax: m.raw > lim.max },
    zen: { input: zenNichigaku, clamped: zen, raisedToMin: zenNichigaku < lim.min, cappedAtMax: zenNichigaku > lim.max },
    zenAtMin,
    diff,
    gross,
    dailyUsed,
    dailyCapped: kihonDaily > lim.saiCap,
    remaining,
    cap,
    capApplied: !zenAtMin && gross > cap,
    notLower: !zenAtMin && diff === 0,
    amount,
  };
}
