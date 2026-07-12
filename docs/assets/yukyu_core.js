/**
 * 年次有給休暇の付与日数の計算（DOM非依存・テスト対象）。
 *
 * 一次ソース（労働基準法39条・厚生労働省リーフレット）:
 * - 一般労働者（週5日以上 または 週30時間以上）: 6ヶ月continuousで10日、以後1年ごとに増加、最大20日
 * - 比例付与（週4日以下 かつ 週30時間未満）: 所定労働日数に応じて按分
 * - 出勤率8割以上が要件（8割未満の年は付与されないが、勤続年数のカウントは進む）
 * - 年5日の時季指定義務: 10日以上付与された労働者が対象
 * - 時効2年（付与日から2年で消滅）
 */

/** 一般労働者（週5日以上または週30時間以上）: 勤続年数 → 付与日数 */
export const FULL_TABLE = [
  { years: 0.5, days: 10 },
  { years: 1.5, days: 11 },
  { years: 2.5, days: 12 },
  { years: 3.5, days: 14 },
  { years: 4.5, days: 16 },
  { years: 5.5, days: 18 },
  { years: 6.5, days: 20 },  // 以降は20日で固定
];

/**
 * 比例付与の表（週30時間未満）。
 * key = 週所定労働日数、値 = 勤続0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5年 の付与日数
 */
export const PRO_TABLE = {
  4: [7, 8, 9, 10, 12, 13, 15],
  3: [5, 6, 6, 8, 9, 10, 11],
  2: [3, 4, 4, 5, 6, 6, 7],
  1: [1, 2, 2, 2, 3, 3, 3],
};

/** 年間所定労働日数から週所定労働日数を推定（週日数が不明な場合の判定に使う） */
export const YEARLY_RANGES = [
  { weekly: 4, min: 169, max: 216 },
  { weekly: 3, min: 121, max: 168 },
  { weekly: 2, min: 73, max: 120 },
  { weekly: 1, min: 48, max: 72 },
];

export const STAGES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5];

/** 勤続年数（年）→ 段階のインデックス（0〜6）。6.5年以上は6で頭打ち */
export function stageIndex(years) {
  let idx = -1;
  for (let i = 0; i < STAGES.length; i++) {
    if (years >= STAGES[i]) idx = i;
  }
  return Math.min(idx, STAGES.length - 1);
}

/**
 * 付与日数を求める。
 * @param {number} years 勤続年数（年。0.5 = 6ヶ月）
 * @param {number} weeklyDays 週所定労働日数
 * @param {number} weeklyHours 週所定労働時間
 * @returns {{days:number, type:string, stage:number|null, needsWork8:boolean}}
 */
export function grantDays(years, weeklyDays, weeklyHours) {
  const idx = stageIndex(years);
  if (idx < 0) {
    return { days: 0, type: "not_yet", stage: null, needsWork8: false };
  }
  // 一般労働者: 週5日以上 または 週30時間以上
  const isFull = weeklyDays >= 5 || weeklyHours >= 30;
  if (isFull) {
    return { days: FULL_TABLE[idx].days, type: "full", stage: STAGES[idx], needsWork8: true };
  }
  const row = PRO_TABLE[Math.max(1, Math.min(4, Math.floor(weeklyDays)))];
  return { days: row[idx], type: "proportional", stage: STAGES[idx], needsWork8: true };
}

/** 年5日の時季指定義務の対象か（その年に10日以上付与された労働者） */
export function needsFiveDays(grantedDays) {
  return grantedDays >= 10;
}

/** 入社日から見た「次の付与日」と、そこまでの各段階の付与日数 */
export function schedule(hireISO, weeklyDays, weeklyHours, count = 8) {
  const [y, m, d] = hireISO.split("-").map(Number);
  const rows = [];
  for (let i = 0; i < count && i < STAGES.length + 3; i++) {
    const years = 0.5 + i;   // 6ヶ月, 1年6ヶ月, ...
    const months = Math.round(years * 12);
    const t = new Date(y, m - 1 + months, d);
    const g = grantDays(years, weeklyDays, weeklyHours);
    rows.push({
      date: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`,
      years,
      days: g.days,
      mustTakeFive: needsFiveDays(g.days),
    });
  }
  return rows;
}
