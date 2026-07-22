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

/**
 * 所得税と住民税で控除額が異なる所得控除（扶養控除・配偶者控除など「人的控除」）の節税額。
 * 扶養控除は所得税38万円に対し住民税33万円のように別額なので、taxSaving（同額前提）を使うと
 * 住民税の減少を過大に出す。こちらは両方の控除額を受け取る。
 * @param input { kazeiShotoku, shotokuKojo(所得税の控除額), juminKojo(住民税の控除額) }
 */
export function taxSavingSplit(input, D) {
  if (!D) throw new Error('参照データ（setsuzei_r08.json）が渡されていません');
  const kazei = yen0(input.kazeiShotoku);
  const sKojo = yen0(input.shotokuKojo);
  const jKojo = yen0(input.juminKojo);

  // 控除は課税所得を下回る範囲でしか効かない（住民税側も同じ概算の考え方でクランプする）。
  const usedShotoku = Math.min(sKojo, kazei);
  const usedJumin = Math.min(jKojo, kazei);

  const taxBefore = shotokuzei(kazei, D);
  const taxAfter = shotokuzei(kazei - sKojo, D); // 速算表の差＝超過累進を厳密に反映
  const shotokuGen = Math.max(0, taxBefore - taxAfter);
  const fukkoGen = Math.floor(shotokuGen * (D.fukko_rate || 0));
  const juminGen = Math.floor(usedJumin * (D.juminzei_shotokuwari_rate || 0));
  const total = shotokuGen + fukkoGen + juminGen;

  return {
    kazeiShotoku: kazei,
    shotokuKojo: sKojo, juminKojo: jKojo,
    usedShotoku, usedJumin,
    taxBefore, taxAfter,
    shotokuGen, fukkoGen, juminGen,
    total,
    year: D._meta?.year || '',
  };
}

/**
 * 配偶者控除・配偶者特別控除: 本人の合計所得金額・配偶者の合計所得金額・配偶者の年齢(70歳以上か)から
 * 所得税・住民税それぞれの控除額を出す（額の表は参照データが正本。ページに手書きしない）。
 * 本人1,000万円超・配偶者133万円超は「適用なし」を type で申告する（黙って0で答えない）。
 * @param input { honninShotoku(本人の合計所得金額), haiguShotoku(配偶者の合計所得金額), rojin(70歳以上か) }
 * @returns { type: 'haigusha'|'tokubetsu'|'none', reason?, tier, tierLabel, shotoku, jumin, bandLabel }
 */
export function haigushaKojo(input, D) {
  if (!D?.haigu?.honnin_tiers) throw new Error('参照データ（setsuzei_r08.json の haigu）が渡されていません');
  const H = D.haigu;
  const honnin = yen0(input.honninShotoku);
  const haigu = yen0(input.haiguShotoku);
  const rojin = !!input.rojin;
  const tier = H.honnin_tiers.findIndex((t) => honnin <= t.upto);
  if (tier < 0) {
    return { type: 'none', reason: 'honnin_over', tier: null, tierLabel: '', shotoku: 0, jumin: 0, bandLabel: '' };
  }
  const tierLabel = H.honnin_tiers[tier].label;
  if (haigu <= H.income_limit) {
    const k = rojin ? H.kojo.rojin : H.kojo.ippan;
    return { type: 'haigusha', rojin, tier, tierLabel,
             shotoku: k.shotoku[tier], jumin: k.jumin[tier], bandLabel: k.label };
  }
  const band = H.tokubetsu_bands.find((b) => haigu > b.over && haigu <= b.upto);
  if (!band) {
    return { type: 'none', reason: 'haigu_over', tier, tierLabel, shotoku: 0, jumin: 0, bandLabel: '' };
  }
  return { type: 'tokubetsu', tier, tierLabel,
           shotoku: band.shotoku[tier], jumin: band.jumin[tier], bandLabel: band.label };
}

/**
 * 給与収入だけの人の合計所得金額への換算。令和8・9年分は措法29条の4（給与所得控除の
 * 最低控除額等の特例）により収入220万円以下の給与所得控除が定額74万円。収入74.1万円未満は
 * 給与所得なし（同条2項1号）、74.1万円以上219.1万円未満は「収入−74万円」（同2号）。
 * 参照データの kyuyo_kojo_min_limit（219万円）以下だけ換算し、超えたら換算しない（fail closed —
 * 219.1万円以上220万円未満は量子化帯・220万円超は控除が収入で変わるため、このデータでは答えられない）。
 * @returns { ok: true, shotoku } | { ok: false, reason: 'over_limit' }
 */
export function kyuyoToGokeiShotoku(shunyu, D) {
  if (!D?.haigu) throw new Error('参照データ（setsuzei_r08.json の haigu）が渡されていません');
  const s = yen0(shunyu);
  if (s > D.haigu.kyuyo_kojo_min_limit) return { ok: false, reason: 'over_limit' };
  if (s < (D.haigu.kyuyo_kojo_zero_below ?? 0)) return { ok: true, shotoku: 0 };
  return { ok: true, shotoku: Math.max(0, s - D.haigu.kyuyo_kojo_min) };
}

/**
 * 生命保険料控除の1区分ぶんの控除額（帯の表は参照データが正本）。
 * 帯は条文の書き方（「◯円と、合計額から△円を控除した金額のn分の1に相当する金額との合計額」）を
 * そのまま base + (x − minus) / div で持つ。1円未満の端数は**切り上げ**
 * （国税庁 令和8年分 給与所得者の保険料控除申告書の注記）。
 */
function seihoBand(x, bands) {
  for (const b of bands) {
    if (b.upto == null || x <= b.upto) {
      if (b.flat != null) return b.flat;
      return Math.ceil(b.base + (x - b.minus) / b.div);
    }
  }
  return 0;
}

/**
 * 生命保険料控除の1区分（一般／介護医療／個人年金）の控除額。
 * 新契約・旧契約の両方を払っている場合は、条文どおり「旧のみで計算した額」と
 * 「新＋旧の合算（上限あり）」の**大きい方**を採る（所法76条1項1〜3号）。
 * @param T その税（所得税 or 住民税）の帯データ
 * @param useTokurei 措法41条の15の5（年齢23歳未満の扶養親族がいる場合の一般の特例）を使うか
 */
function seihoCategory(shin, kyu, T, useTokurei) {
  const bandsShin = useTokurei && T.shin_tokurei ? T.shin_tokurei : T.shin;
  const heiyoMax = useTokurei && T.heiyo_max_tokurei != null ? T.heiyo_max_tokurei : T.heiyo_max;
  const dShin = shin > 0 ? seihoBand(shin, bandsShin) : 0;
  const dKyu = kyu > 0 ? seihoBand(kyu, T.kyu) : 0;

  if (shin > 0 && kyu > 0) {
    const heiyo = Math.min(dShin + dKyu, heiyoMax);
    // 旧契約だけで計算した方が大きくなることがある（旧の上限5万円 > 合算の上限4万円）。
    if (dKyu > heiyo) return { amount: dKyu, method: 'kyu_only', shin: dShin, kyu: dKyu };
    return { amount: heiyo, method: 'heiyo', shin: dShin, kyu: dKyu };
  }
  if (kyu > 0) return { amount: dKyu, method: 'kyu_only', shin: 0, kyu: dKyu };
  if (shin > 0) return { amount: dShin, method: 'shin_only', shin: dShin, kyu: 0 };
  return { amount: 0, method: 'none', shin: 0, kyu: 0 };
}

/**
 * 生命保険料控除（所得税法76条／地方税法314条の2第1項5号の2・5号の3）。
 * 3区分（一般・介護医療・個人年金）それぞれの新契約・旧契約の年間支払保険料から、
 * 所得税・住民税の控除額を出す。介護医療は新制度のみ（旧契約の区分が無い）。
 *
 * ★年齢23歳未満の扶養親族がいる場合、令和8年分・令和9年分に限り**一般の新契約だけ**
 *   帯の表が1.5倍になる（措法41条の15の5。上限4万円→6万円）。住民税に同じ特例は無い。
 *   合計の上限（所得税12万円・住民税7万円）は特例でも変わらない。
 *
 * @param input {
 *   ippan_shin, ippan_kyu, kaigo, nenkin_shin, nenkin_kyu, // 年間支払保険料（円）
 *   tokurei // 年齢23歳未満の扶養親族がいるか
 * }
 * @returns { shotoku:{items,sum,total,capped}, jumin:{...}, tokureiApplied, year }
 */
export function seimeiHokenryoKojo(input, D) {
  if (!D?.seiho?.shotoku) throw new Error('参照データ（setsuzei_r08.json の seiho）が渡されていません');
  const S = D.seiho;
  const tokurei = !!input?.tokurei;

  const pays = {
    ippan: { shin: yen0(input?.ippan_shin), kyu: yen0(input?.ippan_kyu) },
    kaigo: { shin: yen0(input?.kaigo), kyu: 0 },
    nenkin: { shin: yen0(input?.nenkin_shin), kyu: yen0(input?.nenkin_kyu) },
  };

  const side = (T) => {
    const items = S.kubun.map((k) => {
      const p = pays[k.key];
      const r = seihoCategory(p.shin, p.kyu, T, tokurei && !!k.tokurei);
      return { key: k.key, label: k.label, paidShin: p.shin, paidKyu: p.kyu, ...r };
    });
    const sum = items.reduce((a, i) => a + i.amount, 0);
    const total = Math.min(sum, T.total_max);
    return { items, sum, total, capped: sum > T.total_max, totalMax: T.total_max };
  };

  return {
    shotoku: side(S.shotoku),
    jumin: side(S.jumin),
    tokureiApplied: tokurei,
    year: D._meta?.year || '',
  };
}

/**
 * 扶養控除: 区分ごとの人数から所得税・住民税の控除額合計を出す（区分の額は参照データが正本）。
 * @param counts { ippan, tokutei, rojin, dokyo_rojin } 各区分の人数
 * @returns { shotoku, jumin, count, items: [{key,label,n,shotoku,jumin}] }
 */
export function fuyoKojoTotal(counts, D) {
  if (!D?.fuyo?.kubun) throw new Error('参照データ（setsuzei_r08.json の fuyo）が渡されていません');
  let shotoku = 0, jumin = 0, count = 0;
  const items = [];
  for (const k of D.fuyo.kubun) {
    const n = Math.floor(Number(counts?.[k.key]));
    const nn = Number.isFinite(n) && n > 0 ? n : 0;
    if (!nn) continue;
    shotoku += k.shotoku * nn;
    jumin += k.jumin * nn;
    count += nn;
    items.push({ key: k.key, label: k.label, n: nn, shotoku: k.shotoku * nn, jumin: k.jumin * nn });
  }
  return { shotoku, jumin, count, items };
}
