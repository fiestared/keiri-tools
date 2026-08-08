/**
 * 法定福利費（会社が負担する社会保険料・労働保険料）のコア。
 *
 * ★保険料率そのものは shaho_rates_r08.json / rousai_r08.json が持ち、
 *   等級表と折半の丸めは shaho_core.js が持つ。ここでは**事業主負担分の集計**だけを行う。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. ★★**課税ベースが2種類ある。**
 *     健康保険・介護保険・厚生年金・子ども子育て拠出金 … **標準報酬月額**（等級表の額）
 *     雇用保険・労災保険                               … **賃金総額**（実際に払った額。
 *                                                        通勤手当・残業代を含む。徴収法11条1項）
 *     全部を標準報酬月額で計算する実装は、通勤手当の多い人の労働保険料を過少に出す。
 *
 *  2. ★**折半でないものが3つある。**
 *     ・**労災保険は全額事業主負担**（労働者から控除する規定が無い）
 *     ・**子ども・子育て拠出金も全額事業主負担**（子ども・子育て支援法69条・70条）
 *     ・**雇用保険は労使で率が違う**（事業主だけが「雇用保険二事業」分を負担する。徴収法31条1項1号）
 *     「全部折半」と書くと会社の負担を過少に見せる。
 *
 *  3. ★**労災保険率は業種で35倍違う。**（2.5／1000 〜 88／1000）
 *     「だいたい0.3%」のような一律の見積りは、建設・林業・鉱業で大きく外す。
 *
 *  4. **このコアはメリット制を反映しない。** 継続事業では収支率で労災保険率が
 *     最大±40%増減しうるが（徴収法12条3項）、適用の有無と増減率は個別に決まる。
 */

/** 1000分率を金額に。★端数は円未満切捨（合計してから納付額の丸めを行うのは会社側の処理） */
const permille = (base, sen) => Math.floor(Number(base) * Number(sen) / 1000);
const percent = (base, pct) => Math.floor(Number(base) * Number(pct) / 100);

/** 業種名から労災保険率（1000分率）を引く */
export function rousaiRate(shurui, R) {
  const hit = R.rates.find((x) => x.shurui === shurui);
  return hit ? hit.sen : null;
}

/**
 * 事業主が負担する月額を積み上げる。
 * @param {object} input
 *   hyojun   … 標準報酬月額（健保・厚年・子育て拠出金のベース）
 *   chingin  … 賃金総額（雇用・労災のベース。★実際に払った額）
 *   kenkoPct … 健康保険料率（%）。都道府県で違う
 *   kaigo    … 介護保険第2号被保険者（40歳以上65歳未満）か
 *   koyouType… 雇用保険の事業の種類キー（general / agri_sake / construction）
 *   rousaiSen… 労災保険率（1000分率）
 * @param {object} S shaho_rates_r08.json
 */
export function jigyonushiFutan({ hyojun, chingin, kenkoPct, kaigo = false, koyouType = 'general', rousaiSen }, S) {
  const h = Math.max(0, Math.floor(Number(hyojun) || 0));
  const c = Math.max(0, Math.floor(Number(chingin) || 0));

  // ── 標準報酬月額にかかるもの ─────────────────────────
  // 健康保険・介護保険・厚生年金は労使折半。事業主負担は全体の半分。
  const kenkoZen = percent(h, kenkoPct);
  const kenko = Math.floor(kenkoZen / 2);
  const kaigoZen = kaigo ? percent(h, S.kaigo_rate) : 0;
  const kaigoBun = Math.floor(kaigoZen / 2);
  const koseiZen = percent(h, S.kosei_nenkin_rate);
  const kosei = Math.floor(koseiZen / 2);
  // ★子ども・子育て拠出金は全額事業主負担（本人負担なし）
  const kosodate = percent(h, S.kosodate_rate);

  // ── 賃金総額にかかるもの ────────────────────────────
  // ★雇用保険は労使で率が違う（事業主は二事業分を上乗せ）
  const koyouT = S.koyou.types[koyouType] || S.koyou.types.general;
  const koyou = permille(c, koyouT.employer_permille);
  const koyouWorker = permille(c, koyouT.worker_permille);
  // ★労災保険は全額事業主負担
  const rousai = rousaiSen == null ? null : permille(c, rousaiSen);

  const total = kenko + kaigoBun + kosei + kosodate + koyou + (rousai || 0);

  return {
    hyojun: h, chingin: c,
    kenko, kaigo: kaigoBun, kosei, kosodate, koyou, rousai,
    total,
    // 本人が給与から引かれる分（対照。会社負担との差を見せるため）
    honninTotal: Math.floor(kenkoZen / 2) + Math.floor(kaigoZen / 2) + Math.floor(koseiZen / 2) + koyouWorker,
    // ★全額事業主負担のもの（折半だと思われがちな部分を名指しする）
    zengakuJigyonushi: kosodate + (rousai || 0),
    koyouWorker,
    koyouType: koyouT.label,
  };
}

/** 年額と、給与に対する割合（%）。★会社が実際に払う「人件費の上乗せ分」を見るため */
export function nenganAndRatio(r) {
  const nengan = r.total * 12;
  const ritsu = r.chingin > 0 ? r.total / r.chingin * 100 : 0;
  return { nengan, ritsu };
}
