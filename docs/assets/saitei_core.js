/**
 * 最低賃金の判定コア（DOM非依存・テスト対象）。
 *
 * 出すもの: 都道府県と自分の賃金から、地域別最低賃金を下回っていないかを判定し、
 *   下回っている場合の不足額（時給・月・年）を出す。
 *
 * ★★このツールが黙って誤答しやすい急所:
 *
 *  1. **月給制は「時間額に換算してから」比べる（最低賃金法施行規則2条）。**
 *     月給 ÷ 1か月平均所定労働時間 で時間額にする。1か月平均所定労働時間は
 *     「年間所定労働日数 × 1日の所定労働時間 ÷ 12」であって、単純な「月の暦日数×8」ではない。
 *     ここを間違えると、実際は違反なのに「クリア」と出す。**安全側に倒さず正しく出す**。
 *
 *  2. **最低賃金に算入しない賃金がある（最低賃金法4条3項・施行規則1条）。**
 *     ①臨時に支払われる賃金（結婚手当など）②1か月を超える期間ごとに支払われる賃金（賞与など）
 *     ③時間外・休日・深夜の割増賃金 ④精皆勤手当・通勤手当・家族手当。
 *     **残業代や通勤手当を足した額で比べると、違反を見逃す。** 入力段階で除外させる。
 *
 *  3. **発効日をまたぐ月がある。** 令和7年度は発効日が都道府県ごとにバラバラで、
 *     2025-10-01〜2026-03-31 と半年も開いている。「今日時点で有効な額」を出すには
 *     発効日と判定日を比べる必要がある。発効前なら改定前の額が有効。
 *
 *  4. **端数処理。** 月給からの時間額換算は円未満を切り捨てず、**そのまま比較**する
 *     （切り捨てると、わずかに下回っているケースを「ちょうど」と誤判定する）。
 *     表示のときだけ丸める。
 *
 *  5. **特定（産業別）最低賃金は別にある。** 地域別より高い産業別最低賃金が適用される
 *     場合がある。このツールは地域別のみを扱う旨を画面で明示する（誤って「クリア」と
 *     言い切らない）。
 */

const PREFECTURES = new Set("北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split(" "));
const nonempty = v => typeof v === "string" && v.trim().length > 0;
function validDate(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y,m,d] = v.split("-").map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31][m-1];
}
const validPref = p => p && PREFECTURES.has(p.pref) && nonempty(p.full) && nonempty(p.region)
  && Number.isSafeInteger(p.wage) && p.wage > 0 && Number.isSafeInteger(p.prev) && p.prev > 0
  && Number.isSafeInteger(p.up) && p.up === p.wage - p.prev && Number.isFinite(p.rate)
  && validDate(p.effective) && nonempty(p.effective_wa);

/** fetchのHTTP成功だけでは不足。空・欠損・重複も読み込み失敗として扱う。 */
export function validateSaiteiData(D) {
  const m = D?._meta, n = D?.next_revision;
  if (!Array.isArray(D?.prefectures) || D.prefectures.length !== 47
      || new Set(D.prefectures.map(p => p?.pref)).size !== 47 || !D.prefectures.every(validPref)
      || !nonempty(m?.year) || !validDate(m?.checked) || !nonempty(m?.source_url)
      || !Number.isSafeInteger(m?.national_average?.wage) || m.national_average.wage <= 0
      || !nonempty(n?.status) || !nonempty(n?.headline) || !nonempty(n?.detail)
      || !nonempty(n?.source_url) || !nonempty(n?.source)) {
    return { ok: false, error: "最低賃金のデータを読み込めませんでした。再読み込みしてください。" };
  }
  return { ok: true };
}

// 入力文字列の十進精度を保ち、整数の分子・分母へ変換する。指数表記も扱う。
function decimal(v) {
  if (!["number", "string"].includes(typeof v)) return null;
  const text = String(v).trim(), value = Number(text);
  if (!Number.isFinite(value) || !(value > 0) || value > Number.MAX_SAFE_INTEGER || text.length > 400) return null;
  const m = text.replace(/^\+?\./, "0.").match(/^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!m) return null;
  const scale = (m[2] || "").length - Number(m[3] || 0);
  if (Math.abs(scale) > 400) return null;
  const digits = BigInt(m[1] + (m[2] || ""));
  return scale >= 0 ? { n: digits, d: 10n ** BigInt(scale) } : { n: digits * 10n ** BigInt(-scale), d: 1n };
}
// BigIntの巨大な分母を先にNumberへ変換するとInfinityになるため、比を指数表記で返す。
function ratioNumber(n, d) {
  if (n === 0n) return 0;
  const sign = n < 0n ? -1 : 1, a = (n < 0n ? -n : n).toString(), b = d.toString();
  const aHead = a.slice(0, 16), bHead = b.slice(0, 16);
  return sign * Number(String(Number(aHead) / Number(bHead)) + "e" + (a.length-aHead.length-b.length+bHead.length));
}
function annualHours(days, hours) {
  const d = decimal(days), h = decimal(hours);
  if (!d || !h || d.n > 366n*d.d || h.n > 24n*h.d) return null;
  return { n: d.n*h.n, d: d.d*h.d };
}
/** 年間日数は0超366以下、1日時間は0超24以下。計算結果も有限の正値を要求。 */
export function monthlyHours(daysPerYear, hoursPerDay) {
  const a = annualHours(daysPerYear, hoursPerDay);
  if (!a) return null;
  const h = ratioNumber(a.n, a.d*12n);
  return Number.isFinite(h) && h > 0 ? h : null;
}

/** 判定日時点で有効な最低賃金額を返す。 */
export function effectiveWage(pref, onDate) {
  if (!validPref(pref) || (onDate != null && onDate !== "" && !validDate(onDate))) return null;
  if (!onDate || onDate >= pref.effective) return { wage: pref.wage, applied: "current", effective: pref.effective };
  return { wage: pref.prev, applied: "previous", effective: pref.effective };
}

/**
 * 最低賃金を満たしているか判定する。
 *
 * input:
 *   prefCode  … 都道府県名（データの pref と一致する短い名前。例 "東京"）
 *   wageType  … "hourly" | "monthly"
 *   amount    … 時給、または月給（※急所2の除外後の金額）
 *   daysPerYear, hoursPerDay … 月給制のときだけ使う
 *   onDate    … 判定日 "YYYY-MM-DD"（省略時は発効日を考慮せず現行額で判定）
 * D … saitei_chingin_r08.json
 */
export function judgeSaitei(input, D) {
  const dataCheck = validateSaiteiData(D);
  if (!dataCheck.ok) return dataCheck;
  if (!input || !["hourly", "monthly"].includes(input.wageType)) return { ok: false, error: "時給か月給を選んでください。" };
  const notes = [];
  const pref = D.prefectures.find((p) => p.pref === input.prefCode);
  if (!pref) return { ok: false, error: "都道府県が選ばれていません。" };

  const eff = effectiveWage(pref, input.onDate);
  if (!eff) return { ok: false, error: "有効な判定日を入力してください。" };
  if (eff.applied === "previous") {
    // ★年度名をここに直書きしない（2026-09-22 に実害）。
    //   「令和7年度額」と固定で書いてあったため、データを令和8年度に差し替えた瞬間に
    //   **数字は正しいのに年度名だけ1年古い**文が出た。構文エラーにならず、
    //   判定結果も正しいので、読まないと気づけない。年度はデータから読む。
    const y = D._meta && D._meta.year ? D._meta.year : "改定後";
    notes.push(`${pref.full}の${y}額（${pref.wage}円）の発効日は${pref.effective_wa}です。判定日はそれより前のため、改定前の${pref.prev}円で判定しました。`);
  }
  const minWage = eff.wage;

  const amount = decimal(input.amount);
  if (!amount) return { ok: false, error: "賃金額を入力してください。" };

  const isMonthly = input.wageType === "monthly";
  const hasHours = isMonthly || (input.daysPerYear != null && input.daysPerYear !== "") || (input.hoursPerDay != null && input.hoursPerDay !== "");
  const annual = hasHours ? annualHours(input.daysPerYear, input.hoursPerDay) : null;
  const hoursForMonth = hasHours ? monthlyHours(input.daysPerYear, input.hoursPerDay) : null;
  if (hasHours && (annual == null || hoursForMonth == null)) return { ok: false, error: "年間所定労働日数は0超366以下、1日の所定労働時間は0超24以下で入力してください。" };
  const hours = isMonthly ? hoursForMonth : null;
  // 月給×12 と 最低賃金×年間所定時間を共通の整数単位で比較する。
  // 時間額への浮動小数変換は表示専用であり、等額の判定には使わない。
  const hourlyN = isMonthly ? amount.n * 12n * annual.d : amount.n;
  const hourlyD = isMonthly ? amount.d * annual.n : amount.d;
  const gapN = hourlyN - BigInt(minWage) * hourlyD;
  const clears = gapN >= 0n;
  const hourly = ratioNumber(hourlyN, hourlyD), diff = ratioNumber(gapN, hourlyD);
  const shortPerHour = clears ? 0 : -diff;
  const shortPerMonth = !annual ? null : clears ? 0 : ratioNumber(-gapN * annual.n, hourlyD * annual.d * 12n);
  const shortPerYear = shortPerMonth == null ? null : shortPerMonth * 12;
  const hourlyRounded = Number(hourly.toFixed(2));
  if (![hourly, hourlyRounded, diff, shortPerHour, shortPerMonth, shortPerYear].every(v => v == null || Number.isFinite(v))
      || !(hourly > 0) || (gapN !== 0n && diff === 0)) {
    return { ok: false, error: "この賃金額・所定労働時間では計算できません。入力値を確認してください。" };
  }
  if (isMonthly) notes.push(`1か月平均所定労働時間は ${input.daysPerYear}日 × ${input.hoursPerDay}時間 ÷ 12 = ${round1(hours)}時間 として計算しました。`);

  return {
    ok: true,
    pref: pref.full,
    minWage,
    appliedPrevious: eff.applied === "previous",
    effective: pref.effective,
    effectiveWa: pref.effective_wa,
    hourly,                                   // 生の値（丸めない）
    hourlyRounded,
    monthlyHours: hours,
    clears,
    diff,
    shortPerHour,
    shortPerMonth,
    shortPerYear,
    notes,
  };
}

const round1 = (v) => Math.round(v * 10) / 10;

/** 全国順位（高い順・同額は同順位）。 */
export function rankOf(prefCode, D) {
  if (!validateSaiteiData(D).ok) return null;
  const list = (D.prefectures || []).slice().sort((a, b) => b.wage - a.wage);
  const me = list.find((p) => p.pref === prefCode);
  if (!me) return null;
  return { rank: list.filter((p) => p.wage > me.wage).length + 1, total: list.length, wage: me.wage };
}

/** 全国最高・最低との差。 */
export function spread(D) {
  if (!validateSaiteiData(D).ok) return null;
  const list = (D.prefectures || []);
  if (!list.length) return null;
  const hi = list.reduce((a, b) => (b.wage > a.wage ? b : a));
  const lo = list.reduce((a, b) => (b.wage < a.wage ? b : a));
  return { hi, lo, gap: hi.wage - lo.wage };
}
