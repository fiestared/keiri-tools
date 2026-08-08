/**
 * iDeCoの出口（一時金で受け取ったときの退職所得控除）を計算するコア。
 *
 * ★退職所得控除そのものは taishoku_core.js が持っている。ここでは**重複期間の調整**だけを扱う。
 *   同じ算式を2箇所に持たない（片方だけ直る事故を避ける）。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. ★**令和8年1月1日以後の iDeCo一時金は「10年ルール」。**（施行令70条1項2号ロ）
 *     従来は「前年以前4年内」＝5年空ければよかったが、令和8年以後に支払を受けるものは
 *     **前年以前9年内**＝10年空けないと重複調整される。
 *     世に出回っている「iDeCoは5年空ければよい」は令和7年までの話。
 *     ★令和8年1月1日**前**に支払を受けたものは4年内のまま（同ロ(2)の経過措置）。
 *
 *  2. ★**向きで年数が違う。**
 *     iDeCo一時金 → あとで退職金: 前年以前 **9年内**（令和8年以後）
 *     退職金 → あとで iDeCo一時金: 前年以前 **19年内**（施行令70条1項2号ハ）
 *     同じ年数だと思って組むと、退職金を先に受け取る人（普通の会社員）で大きく外す。
 *
 *  3. **重複するのは「期間」であって「金額」ではない。**
 *     重複部分の年数を勤続年数とみなして計算した控除額を、控除額から差し引く。
 *     金額を按分する実装は、勤続年数20年の境目（40万→70万）をまたぐと必ずずれる。
 *
 *  4. ★**このコアは「いつ受け取るべきか」を答えない。** 期間の当てはめは個別事情
 *     （就業規則・受給資格・加入者期間）に依存する。入力された前提での計算例だけを返す。
 */

/** 重複調整の対象になる遡及年数（条文の「その年の前年以前◯年内」）を返す */
export function chofukuNensu(order, paidOn, D) {
  const c = D.chofuku_chosei;
  if (order === 'taishoku_then_ideco') return c.taishoku_to_ideco_nen;      // 19年内
  if (order === 'taishoku_then_taishoku') return c.taishoku_to_taishoku_nen; // 4年内
  // iDeCo一時金を先に受け取り、あとで退職金 → 支払日で分かれる
  const kijun = Date.parse(c.ideco_shinkyu_kijunbi);
  const paid = Date.parse(paidOn);
  if (!Number.isFinite(paid)) return c.ideco_to_taishoku_nen_r8ikou;         // 不明なら厳しい側
  return paid >= kijun ? c.ideco_to_taishoku_nen_r8ikou : c.ideco_to_taishoku_nen_r8mae;
}

/**
 * 前の受取から何年空いているかで、重複調整の対象になるかを判定する。
 * ★条文は「その年の前年以前◯年内」なので、**空き年数が ◯+1 以上**なら対象外。
 * @param {number} akiNen 前の受取の年から今回の受取の年までの差（年）
 */
export function needsChofuku(akiNen, nensu) {
  return Number(akiNen) <= Number(nensu);
}

/**
 * 重複調整後の退職所得控除額。
 * @param {object} input
 *   nensu       … 今回の勤続年数（iDeCoなら加入者期間）
 *   chofukuNen  … 前の受取と重複している期間（年）。0なら調整なし
 *   disabled    … 障害による退職か
 * @param {object} T taishoku_rates_r08.json
 * @param {function} taishokuKojo taishoku_core.js の taishokuKojo（★同じ算式を再実装しない）
 */
export function kojoAfterChofuku({ nensu, chofukuNen = 0, disabled = false }, T, taishokuKojo) {
  const full = taishokuKojo(Number(nensu), disabled, T);
  const dup = Number(chofukuNen) > 0 ? taishokuKojo(Number(chofukuNen), false, T) : 0;
  // ★重複部分は「その年数を勤続年数とみなして計算した金額」を差し引く（金額の按分ではない）
  const after = Math.max(0, full - dup);
  return { full, dup, after };
}

/** 退職所得の金額（控除後を2分の1にする。★短期・役員等の特例は taishoku_core 側の管轄） */
export function taishokuShotoku(shunyu, kojo) {
  const over = Math.max(0, Math.floor(shunyu) - Math.floor(kojo));
  return Math.floor(over / 2);
}
