/**
 * 社会保険料（健康保険・介護保険・子ども子育て支援金・厚生年金）の計算ロジック。DOM非依存・テスト対象。
 *
 * 一次ソース:
 * - 協会けんぽ「都道府県毎の保険料率」令和8年度
 * - 協会けんぽ「令和8年3月分（4月納付分）からの健康保険・厚生年金保険の保険料額表」(東京支部PDF)
 *   → tests/fixtures/kyoukaikenpo_tokyo_r08.json に全50等級を機械抽出して保存し、
 *     tests/test_shaho_oracle.mjs で本ファイルの計算結果と全数照合している
 *
 * 実務の要点:
 * - 保険料は「標準報酬月額 × 料率」。実際の給与額そのものには掛けない
 * - 労使折半（本人負担は1/2）。端数は円未満を50銭以下切捨・50銭超切上（納入告知書の通例）
 * - **介護保険料(1.62%)は健康保険料と合算した1本の料率で控除する**（40〜64歳のみ）。
 *   公式の保険料額表が「介護保険第2号に該当する場合」を合算列(例: 東京 11.47%)で示しているため、
 *   健保と介護を別々に端数処理すると額表と1円ずれることがある
 * - **子ども・子育て支援金(0.23%・全国一律)は令和8年4月分から**。額表では独立した列で、
 *   年齢に関係なく全員にかかり、労使折半（例: 標準報酬58,000円なら全額133.4円・折半66.7円）
 * - 賞与は「標準賞与額」（1,000円未満切捨）に同じ料率。健保は年度累計573万円、厚年は1回150万円が上限
 */

/** 健康保険の標準報酬月額 等級表（第1〜50級）: [等級, 標準報酬月額, 報酬月額の下限, 報酬月額の上限] */
export const KENKO_GRADES = [
  [1, 58000, 0, 63000], [2, 68000, 63000, 73000], [3, 78000, 73000, 83000],
  [4, 88000, 83000, 93000], [5, 98000, 93000, 101000], [6, 104000, 101000, 107000],
  [7, 110000, 107000, 114000], [8, 118000, 114000, 122000], [9, 126000, 122000, 130000],
  [10, 134000, 130000, 138000], [11, 142000, 138000, 146000], [12, 150000, 146000, 155000],
  [13, 160000, 155000, 165000], [14, 170000, 165000, 175000], [15, 180000, 175000, 185000],
  [16, 190000, 185000, 195000], [17, 200000, 195000, 210000], [18, 220000, 210000, 230000],
  [19, 240000, 230000, 250000], [20, 260000, 250000, 270000], [21, 280000, 270000, 290000],
  [22, 300000, 290000, 310000], [23, 320000, 310000, 330000], [24, 340000, 330000, 350000],
  [25, 360000, 350000, 370000], [26, 380000, 370000, 395000], [27, 410000, 395000, 425000],
  [28, 440000, 425000, 455000], [29, 470000, 455000, 485000], [30, 500000, 485000, 515000],
  [31, 530000, 515000, 545000], [32, 560000, 545000, 575000], [33, 590000, 575000, 605000],
  [34, 620000, 605000, 635000], [35, 650000, 635000, 665000], [36, 680000, 665000, 695000],
  [37, 710000, 695000, 730000], [38, 750000, 730000, 770000], [39, 790000, 770000, 810000],
  [40, 830000, 810000, 855000], [41, 880000, 855000, 905000], [42, 930000, 905000, 955000],
  [43, 980000, 955000, 1005000], [44, 1030000, 1005000, 1055000],
  [45, 1090000, 1055000, 1115000], [46, 1150000, 1115000, 1175000],
  [47, 1210000, 1175000, 1235000], [48, 1270000, 1235000, 1295000],
  [49, 1330000, 1295000, 1355000], [50, 1390000, 1355000, Infinity],
];

/**
 * 厚生年金の等級表（第1〜32級）。健康保険の第4級(88,000)が厚年の第1級、
 * 健康保険の第35級(650,000)が厚年の第32級で頭打ちになる（公式額表で全数確認済み）。
 */
export const KOSEI_MIN = 88000;
export const KOSEI_MAX = 650000;

export const KAIGO_AGE_FROM = 40;
export const KAIGO_AGE_TO = 65; // 65歳到達で徴収終了（介護保険第1号被保険者へ）

/** 賞与の上限 */
export const BONUS_KENKO_YEAR_CAP = 5730000; // 健保: 年度累計573万円
export const BONUS_KOSEI_PER_CAP = 1500000;  // 厚年: 1回あたり150万円

/** 報酬月額から健康保険の標準報酬月額（等級）を求める */
export function kenkoGrade(monthly) {
  for (const [grade, std, lo, hi] of KENKO_GRADES) {
    if (monthly >= lo && monthly < hi) return { grade, standard: std };
  }
  const last = KENKO_GRADES[KENKO_GRADES.length - 1];
  return { grade: last[0], standard: last[1] };
}

/** 厚生年金の標準報酬月額（健保の等級表を使い、88,000〜650,000で頭打ち） */
export function koseiStandard(monthly) {
  const { standard } = kenkoGrade(monthly);
  if (standard < KOSEI_MIN) return KOSEI_MIN;
  if (standard > KOSEI_MAX) return KOSEI_MAX;
  return standard;
}

/**
 * 保険料の端数処理。労使折半で円未満が出た場合、
 * 被保険者負担分は50銭以下切捨・50銭超切上（納入告知書の通例）。
 */
export function roundHalf(v) {
  const int = Math.floor(v);
  const frac = v - int;
  return frac > 0.5 ? int + 1 : int;
}

export function kaigoApplies(age) {
  return age >= KAIGO_AGE_FROM && age < KAIGO_AGE_TO;
}

/**
 * 保険料の1項目を組み立てる。
 * total/half は銭（小数）のまま保持する（公式の保険料額表と直接照合できるようにするため）。
 * self は端数処理後の実際の控除額（円）。
 */
function component(rate, base) {
  const total = base * (rate / 100);
  const half = total / 2;
  const self = roundHalf(half);
  return { rate, base, total, half, self, company: Math.round(total) - self };
}

/**
 * 月額保険料を計算する。
 * @param {number} monthly  報酬月額（円）
 * @param {number} kenkoRate 健康保険料率(%) 都道府県別
 * @param {number} kaigoRate 介護保険料率(%) 全国一律
 * @param {number} age 年齢
 * @param {number} koseiRate 厚生年金保険料率(%) 既定18.3
 * @param {number} kosodateRate 子ども・子育て支援金率(%) 既定0.23（令和8年4月分〜）
 */
export function calcMonthly(monthly, kenkoRate, kaigoRate, age, koseiRate = 18.3,
                            kosodateRate = 0.23) {
  const { grade, standard } = kenkoGrade(monthly);
  const koseiStd = koseiStandard(monthly);
  const kaigo = kaigoApplies(age);

  // 健保と介護は合算した料率で控除する（公式額表の「介護保険第2号に該当する場合」列）
  const kenkoKaigoRate = kenkoRate + (kaigo ? kaigoRate : 0);
  const kenkoKaigo = component(kenkoKaigoRate, standard);
  const kosodate = component(kosodateRate, standard);
  const kosei = component(koseiRate, koseiStd);

  return {
    grade, standard, koseiStandard: koseiStd, kaigoApplies: kaigo,
    // 表示用の内訳（端数処理前）。控除額の正は kenkoKaigo 側
    kenkoRate, kaigoRate: kaigo ? kaigoRate : 0,
    kenkoKaigo, kosodate, kosei,
    selfTotal: kenkoKaigo.self + kosodate.self + kosei.self,
    companyTotal: kenkoKaigo.company + kosodate.company + kosei.company,
  };
}

/**
 * 賞与の保険料を計算する。標準賞与額は1,000円未満切捨。
 * 子ども・子育て支援金も健保と同じ標準賞与額にかかる。
 * @param {number} yearPaidKenko 当年度に既に支払った標準賞与額の累計（健保の573万円上限判定用）
 */
export function calcBonus(bonus, kenkoRate, kaigoRate, age, koseiRate = 18.3,
                          yearPaidKenko = 0, kosodateRate = 0.23) {
  const std = Math.floor(bonus / 1000) * 1000;
  const kenkoRemain = Math.max(0, BONUS_KENKO_YEAR_CAP - yearPaidKenko);
  const kenkoStd = Math.min(std, kenkoRemain);          // 健保: 年度累計573万円が上限
  const koseiStd = Math.min(std, BONUS_KOSEI_PER_CAP);  // 厚年: 1回あたり150万円が上限
  const kaigo = kaigoApplies(age);

  const kenkoKaigo = component(kenkoRate + (kaigo ? kaigoRate : 0), kenkoStd);
  const kosodate = component(kosodateRate, kenkoStd);
  const kosei = component(koseiRate, koseiStd);

  return {
    standardBonus: std, kenkoStandard: kenkoStd, koseiStandard: koseiStd, kaigoApplies: kaigo,
    capped: { kenko: kenkoStd < std, kosei: koseiStd < std },
    kenkoKaigo, kosodate, kosei,
    selfTotal: kenkoKaigo.self + kosodate.self + kosei.self,
    companyTotal: kenkoKaigo.company + kosodate.company + kosei.company,
  };
}
