/**
 * 健康保険の任意継続と国民健康保険の「どちらが安いか」を比べるコア（DOM非依存・テスト対象）。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. **保険料は労使折半ではなく全額自己負担**（健康保険法161条1項「その全額を負担する」）。
 *     在職中の控除額を2倍する実装は、下の②に当たる人で必ず過大になる。
 *
 *  2. **標準報酬月額に上限がある**（47条: 退職時の額と全被保険者の平均額の**いずれか少ない額**）。
 *     ★上限は**毎年度動く**（平均が属する等級）。令和3年度は30万円・令和8年度は32万円。
 *     コードに書かず shaho_rates_r08.json の nini_keizoku から読む。
 *     ★健保組合は規約で「退職時の標準報酬月額」を使える（47条ただし書）ので、
 *     この上限は**協会けんぽの話**。組合健保の人に当てると過小に出る。
 *
 *  3. **厚生年金は続かない。** 任意継続で続くのは健康保険だけ（3条4項）。
 *     退職後は国民年金（第1号）に別途加入する。年金分を足した金額を「任意継続の保険料」として
 *     出すと過大になるし、逆に国保側だけ国民年金を足すと比較が不公平になる。
 *     → **このコアはどちらにも年金を含めない**（比較の土俵をそろえる）。
 *
 *  4. **子ども・子育て支援金（令和8年4月分〜）を落とさない。** 協会けんぽの額表は
 *     健康保険料とは別欄で出しており、任意継続はこれも全額負担する。
 *     健保料率だけで計算すると毎月ぶん過小になる。
 *
 *  5. **国保は会社都合退職なら軽減される**（国民健康保険法施行令29条の7の2:
 *     給与所得を**100分の30**として算定）。倒産・解雇・雇止めで辞めた人に軽減を当てないと、
 *     「任意継続の方が安い」という逆の結論が出る。判定は kokuho_core の judgeKeigen に任せる。
 *
 *  6. **料率は推測で埋めない。** 国保の料率は市町村がそれぞれ条例で定める（kokuho_core と同じ規律）。
 *     健保料率も都道府県別。**必ず引数で受け取る**。
 *
 * 端数: 料率は%で受けるが、小数の掛け算は誤差が出る（0.1+0.2!==0.3）。
 *       **料率を100倍した整数**にしてから掛け、最後に10000で割る。
 *       協会けんぽの額表（東京都・第23級320,000円）と一致することをテストで固定している。
 */

/** 介護保険第2号被保険者（40歳以上65歳未満）か。shaho_core と同じ判定を持つ */
export function kaigoApplies(age) {
  return age >= 40 && age < 65;
}

/**
 * 任意継続の保険料（月額・全額自己負担）。
 *
 * @param {object} input
 *   hyojunHoshu … 退職時の標準報酬月額（円）
 *   age         … 年齢（介護保険料の要否判定に使う）
 *   kenkoRate   … 健康保険料率(%)  都道府県別。呼び出し側が渡す
 *   kaigoRate   … 介護保険料率(%)  全国一律
 *   kosodateRate… 子ども・子育て支援金率(%)
 *   capYen      … 標準報酬月額の上限（円）。shaho_rates_r08.json の nini_keizoku.hyojun_cap_yen
 * @returns {{standard:number, capped:boolean, kaigo:boolean, kenko:number, kaigoAmt:number,
 *            kosodate:number, total:number}}
 */
export function calcNiniKeizoku(input) {
  const cap = Number(input.capYen);
  if (!(cap > 0)) throw new Error('capYen（標準報酬月額の上限）が渡されていません');
  const raw = Math.max(0, Math.floor(Number(input.hyojunHoshu) || 0));
  const standard = Math.min(raw, cap);
  const kaigo = kaigoApplies(Number(input.age));

  // ★料率は「%を100倍した整数」で持ち回る（9.85% → 985）。最後に 10000 で割る。
  const bp = (pct) => Math.round(Number(pct) * 100);
  const amt = (pct) => Math.floor((standard * bp(pct)) / 10000);

  const kenko = amt(input.kenkoRate);
  const kaigoAmt = kaigo ? amt(input.kaigoRate) : 0;
  const kosodate = amt(input.kosodateRate);

  return {
    standard,
    capped: raw > cap,
    kaigo,
    kenko, kaigoAmt, kosodate,
    total: kenko + kaigoAmt + kosodate,
  };
}

/**
 * 任意継続と国保を並べて、安い方を返す。
 * ★国保の額は kokuho_core で計算したものを**呼び出し側が渡す**（このコアは国保を計算しない）。
 *   国保の料率は市町村ごとに違い、ここで推測すると必ず誤る。
 *
 * @param {number} niniMonthly   任意継続の月額（calcNiniKeizoku().total）
 * @param {number} kokuhoYearly  国保の年額（kokuho_core の計算結果）
 * @returns {{niniYearly:number, kokuhoYearly:number, cheaper:'nini'|'kokuho'|'same', diffYearly:number}}
 */
export function compare(niniMonthly, kokuhoYearly) {
  const niniYearly = Math.floor(niniMonthly) * 12;
  const k = Math.floor(kokuhoYearly);
  const diff = Math.abs(niniYearly - k);
  return {
    niniYearly,
    kokuhoYearly: k,
    cheaper: niniYearly === k ? 'same' : (niniYearly < k ? 'nini' : 'kokuho'),
    diffYearly: diff,
  };
}
