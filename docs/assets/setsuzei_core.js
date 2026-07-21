/**
 * 所得控除による節税額のコアロジック（DOM非依存・テスト対象）。
 *
 * iDeCo・小規模企業共済・倒産防止共済 など「掛金の全額が所得控除になる」制度は、
 * 節税額の出し方が共通:
 *   節税額 ＝ 所得税の減少（速算表の差）＋ 復興特別所得税の減少 ＋ 住民税の減少
 *
 * ★所得税は速算表（国税庁 No.2260）で**超過累進**を厳密に扱う（単純に「掛金×税率」だと
 *   控除で税率ブラケットをまたぐ人の額がずれる）。住民税所得割は一律10%として概算する
 *   （住民税は課税所得の算定が所得税と少し違うので、掛金×10%の概算にとどめる）。
 *
 * 参照データ（setsuzei_r08.json）を呼び出し側が渡す。ページに税率・上限を手書きしない。
 */

/** 円に丸める（floor・0未満/非数は0）。NaN を素通しすると節税額が丸ごと NaN になる。 */
const yen0 = (n) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/**
 * 課税所得（所得税）に対する所得税額（復興特別所得税を含まない）。
 * 課税所得は1,000円未満切捨て（通則）。速算表で税率×課税所得−控除額。
 * @param {number} kazeiShotoku 課税される所得金額（円）
 * @param {object} D setsuzei_r08.json
 */
export function shotokuzei(kazeiShotoku, D) {
  if (!D || !Array.isArray(D.shotokuzei_brackets)) {
    throw new Error('参照データ（setsuzei_r08.json）が渡されていません');
  }
  const x = Math.floor(Math.max(0, Number(kazeiShotoku) || 0) / 1000) * 1000; // 千円未満切捨て
  if (x <= 0) return 0;
  for (const b of D.shotokuzei_brackets) {
    if (b.upto == null || x <= b.upto) {
      return Math.floor(x * b.rate - b.deduct);
    }
  }
  return 0; // 到達しない（最後の bracket は upto:null）
}

/**
 * 「掛金の全額が所得控除」の制度の節税額。
 * @param input {
 *   kazeiShotoku,   // 控除前の課税所得（所得税ベース。年収でなく課税所得）
 *   annualDeduction // 年間の掛金（＝所得控除額）
 * }
 * @param D setsuzei_r08.json
 * @returns { shotokuGen, fukkoGen, juminGen, total, effectiveRate, taxBefore, taxAfter,
 *            usedDeduction, kazeiShotoku, year }
 */
export function taxSaving(input, D) {
  if (!D) throw new Error('参照データ（setsuzei_r08.json）が渡されていません');
  const kazei = yen0(input.kazeiShotoku);
  const deduction = yen0(input.annualDeduction);

  // 控除は課税所得を下回る範囲でしか効かない（課税所得0の人は節税額0）。
  const used = Math.min(deduction, kazei);

  const taxBefore = shotokuzei(kazei, D);
  const taxAfter = shotokuzei(kazei - deduction, D); // 速算表の差＝超過累進を厳密に反映
  const shotokuGen = Math.max(0, taxBefore - taxAfter);                 // 所得税の減少
  const fukkoGen = Math.floor(shotokuGen * (D.fukko_rate || 0));        // 復興特別所得税の減少(2.1%)
  const juminGen = Math.floor(used * (D.juminzei_shotokuwari_rate || 0)); // 住民税の減少(概算・一律10%)
  const total = shotokuGen + fukkoGen + juminGen;

  return {
    kazeiShotoku: kazei,
    usedDeduction: used,
    taxBefore, taxAfter,
    shotokuGen, fukkoGen, juminGen,
    total,
    effectiveRate: deduction > 0 ? total / deduction : 0, // 掛金に対する節税率
    year: D._meta?.year || '',
  };
}

/**
 * 年間掛金（月額×12）から節税額を出すヘルパ。上限の超過は beyondLimit で申告（黙って丸めない）。
 * @param input { kazeiShotoku, monthly, annualLimit }
 */
export function taxSavingByMonthly(input, D) {
  const monthly = yen0(input.monthly);
  const limit = Number(input.annualLimit) || null;
  const annual = monthly * 12;
  const beyondLimit = limit != null && annual > limit;
  const r = taxSaving({ kazeiShotoku: input.kazeiShotoku, annualDeduction: annual }, D);
  return { ...r, monthly, annual, annualLimit: limit, beyondLimit };
}
