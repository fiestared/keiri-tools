/**
 * 積立投資の複利計算コア（DOM非依存・テスト対象）。
 *
 * ★このサイトは投資助言を行わない。ここでやるのは**利用者が入れた前提での算数**だけ。
 *   - 利回りは**利用者が入力する**（こちらが「S&P500なら年◯%」と置かない）
 *   - 商品を推薦しない・ポートフォリオを提案しない・結果を保存しない
 *   - 根拠: 金商法2条8項11号は「報酬を支払うことを約する契約（投資顧問契約）」が要件。
 *     無料の公開情報＋利用者入力のシミュレーターはこの定義に入らない（29条の登録は不要）。
 *     ★越えてはいけないのは①有料化・会員限定 ②個別銘柄の売買判断 ③DM等での個別対応。
 *     keiri-tools の税理士法52条対応（INQUIRY_POLICY）と同じ構造で運用する。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. **信託報酬は「年率」だが、実際は日割りで基準価額から引かれる。**
 *     年1回まとめて引くように計算すると、複利のかかり方が変わって額がずれる。
 *     ここでは**月次の複利**に直して毎月引く（実運用に近い側へ寄せる）。
 *
 *  2. **年率を12で割ってはいけない。** 年5%は月0.4167%ではない。
 *     複利なので月利 = (1+年利)^(1/12) − 1。12分割すると20年で数%ずれる。
 *
 *  3. **積立は「期初」か「期末」かで1か月分違う。** ここでは**期初**（その月の頭に買う）で統一し、
 *     どちらを採ったかを画面にも書く。黙って選ぶと他サイトと数字が合わない理由が分からなくなる。
 *
 *  4. **NISAの枠は「取得対価の額」で数える**（措法37条の14）。値上がりしても枠は減らない。
 *     時価で枠を数える実装は、上がった人ほど枠を過少に見せる。
 *
 *  5. **課税は「利益」にだけかかる。** 元本には課税されない。
 *     評価額全体に20.315%を掛ける実装は、税額を大きく過大に出す。
 */

/** 年率(%)から月利を出す。★12で割らない（複利） */
export function monthlyRate(annualPct) {
  return Math.pow(1 + Number(annualPct) / 100, 1 / 12) - 1;
}

/**
 * 毎月積立の将来価値（期初積立・月次複利）。
 * @param {object} input
 *   monthlyYen   … 毎月の積立額（円）
 *   years        … 積立年数
 *   annualPct    … 想定利回り（年率%・**利用者が入力する**）
 *   feePct       … 信託報酬（年率%）。運用から差し引く
 * @returns {{months:number, principal:number, gross:number, net:number, feeCost:number}}
 *   principal … 元本の累計 / gross … 信託報酬を引かない場合の評価額
 *   net … 信託報酬を引いた場合の評価額 / feeCost … その差額（信託報酬が削った額）
 */
export function simulate({ monthlyYen, years, annualPct, feePct = 0 }) {
  const m = Math.max(0, Math.floor(Number(monthlyYen) || 0));
  const n = Math.max(0, Math.round(Number(years) * 12));
  const rGross = monthlyRate(annualPct);
  // ★信託報酬は年率なので、月利に直してから引く（年1回まとめて引かない）
  const rNet = monthlyRate(Number(annualPct) - Number(feePct));

  let gross = 0, net = 0;
  for (let i = 0; i < n; i++) {
    gross = (gross + m) * (1 + rGross);   // ★期初に積み立ててから1か月ぶん増える
    net = (net + m) * (1 + rNet);
  }
  const principal = m * n;
  return {
    months: n,
    principal,
    gross: Math.floor(gross),
    net: Math.floor(net),
    feeCost: Math.floor(gross) - Math.floor(net),
  };
}

/**
 * 特定口座（課税）と NISA（非課税）の手取りの差。
 * ★税金は**利益にだけ**かかる。元本には かからない。
 */
export function afterTax(valueYen, principalYen, D) {
  const value = Math.floor(valueYen), principal = Math.floor(principalYen);
  const gain = Math.max(0, value - principal);
  // 20.315% = ×20315÷100000（小数の掛け算を避ける）
  const tax = Math.floor((gain * Math.round(D.kazei.goukei_pct * 1000)) / 100000);
  return { gain, tax, tokuteiKouza: value - tax, nisa: value, sagaku: tax };
}

/**
 * NISAの枠を使い切るまでの年数と、枠に対する位置。
 * ★枠は「取得対価の額」＝買った値段で数える（値上がりしても減らない・措法37条の14）。
 */
export function nisaRoom({ monthlyYen, years }, D) {
  const n = D.nisa;
  const yearly = Math.floor(Number(monthlyYen) || 0) * 12;
  const total = yearly * Math.max(0, Math.round(Number(years) || 0));
  const overYearly = yearly > n.tsumitate_nenkan_yen + n.seicho_nenkan_yen;
  const overTsumitate = yearly > n.tsumitate_nenkan_yen;
  // 生涯枠を使い切る年（毎年同じ額を積む前提。★端数の年は切り上げ＝その年に到達する）
  const yearsToFill = yearly > 0 ? Math.ceil(n.shogai_gendo_yen / yearly) : null;
  return {
    yearlyYen: yearly,
    totalYen: total,
    shogaiGendo: n.shogai_gendo_yen,
    usesShogai: Math.min(total, n.shogai_gendo_yen),
    overShogai: total > n.shogai_gendo_yen,
    overYearly,
    overTsumitate,
    yearsToFill,
  };
}

/**
 * 新NISAの今年の残り枠と、売却により翌年に再利用できる簿価を計算する。
 * ★枠は時価ではなく取得対価（簿価）で数える。
 * ★今年売った分は今年の枠へ戻さない。再利用できるのは翌年以後。
 */
export function nisaAllowance(input, D) {
  const n = D.nisa;
  const yen = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const usedTsumitateYear = yen(input.usedTsumitateYear);
  const usedSeichoYear = yen(input.usedSeichoYear);
  const heldTsumitateBook = yen(input.heldTsumitateBook);
  const heldSeichoBook = yen(input.heldSeichoBook);
  const soldTsumitateBook = yen(input.soldTsumitateBook);
  const soldSeichoBook = yen(input.soldSeichoBook);

  // 年初保有分に今年の購入分を足す。年間枠だけ引いて生涯枠へ足し忘れると、
  // 今年買った額だけ生涯残りを過大に出す。
  const currentTsumitateBook = heldTsumitateBook + usedTsumitateYear;
  const currentSeichoBook = heldSeichoBook + usedSeichoYear;
  const heldTotalBook = currentTsumitateBook + currentSeichoBook;
  const lifetimeRemaining = Math.max(0, n.shogai_gendo_yen - heldTotalBook);
  const seichoLifetimeRemaining = Math.max(0, n.seicho_shogai_gendo_yen - currentSeichoBook);
  const annualTsumitateRemaining = Math.max(0, n.tsumitate_nenkan_yen - usedTsumitateYear);
  const annualSeichoRemaining = Math.max(0, n.seicho_nenkan_yen - usedSeichoYear);

  const thisYearTsumitateRemaining = Math.min(annualTsumitateRemaining, lifetimeRemaining);
  const thisYearSeichoRemaining = Math.min(
    annualSeichoRemaining,
    lifetimeRemaining,
    seichoLifetimeRemaining,
  );

  const reusableTsumitate = Math.min(soldTsumitateBook, currentTsumitateBook);
  const reusableSeicho = Math.min(soldSeichoBook, currentSeichoBook);
  return {
    thisYearTsumitateRemaining,
    thisYearSeichoRemaining,
    thisYearTotalRemaining: Math.min(
      lifetimeRemaining,
      thisYearTsumitateRemaining + thisYearSeichoRemaining,
    ),
    lifetimeRemaining,
    seichoLifetimeRemaining,
    nextYearReusableBook: reusableTsumitate + reusableSeicho,
    nextYearReusableSeichoBook: reusableSeicho,
    exceedsAnnual: usedTsumitateYear > n.tsumitate_nenkan_yen || usedSeichoYear > n.seicho_nenkan_yen,
    exceedsLifetime: heldTotalBook > n.shogai_gendo_yen || currentSeichoBook > n.seicho_shogai_gendo_yen,
  };
}
