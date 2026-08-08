/**
 * 法人税・地方法人税の簡易計算コア。
 * 法人税法66条／租税特別措置法42条の3の2／地方法人税法10条。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. ★**軽減税率は「年800万円以下の部分」だけにかかる。**（66条2項）
 *     所得全体に15%を掛ける実装は、所得が800万円を超えた瞬間から**税額を大きく過少に**出す。
 *     800万円を超える部分は原則23.2%。
 *
 *  2. ★**所得が年10億円を超える事業年度は15%ではなく17%。**（措置法42条の3の2第1項）
 *     「中小企業なら常に15%」ではない。しかも変わるのは**800万円以下の部分に対する率**なので、
 *     10億円をまたぐと800万円以下の部分の税額が段差で増える（崖）。
 *
 *  3. ★**特例が使えない法人がいる。**（同項の括弧書き）
 *     法人税法66条5項各号（相互会社・大法人による完全支配関係・投資法人・特定目的会社・受託法人）、
 *     **適用除外事業者**（前3年の所得の平均が15億円超）、通算法人は 15%/17% が使えず**19%のまま**。
 *     資本金1億円以下だけを見て15%を当てる実装は、ここで誤る。
 *
 *  4. ★**地方法人税の課税標準は所得ではなく法人税額。**（地方法人税法10条1項）
 *     所得に10.3%を掛ける実装は、実効の3〜4倍を出す。
 *
 *  5. ★**事業年度が1年未満なら800万円と10億円を月数按分する。**（66条4項／措置法同条3項・4項）
 *     月数は暦に従い、1月未満の端数は**切り上げて1月**。
 *
 *  6. **このコアは所得金額そのものを計算しない。** 益金・損金・別表調整・繰越欠損金は対象外。
 *     住民税・事業税も扱わない（自治体で違うため実効税率も出さない）。
 */

/** 事業年度の月数から、年800万円・年10億円のしきい値を按分する（1年なら按分なし） */
export function anbun(yen, tsukisu) {
  const m = Number(tsukisu);
  if (!Number.isFinite(m) || m >= 12) return yen;
  // ★「12で除し、これに月数を乗じて計算した金額」。月数側の端数処理は呼び出し元（monthsOf）で行う。
  return Math.floor(yen / 12 * m);
}

/** 暦に従った月数。★1月に満たない端数は1月とする（措置法42条の3の2第4項） */
export function monthsOf(from, to) {
  const a = new Date(from + 'T00:00:00+09:00');
  const b = new Date(to + 'T00:00:00+09:00');
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return 12;
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  // 開始日の前日までが1か月なので、終了日が開始応当日の前日以上なら丸1か月
  if (b.getDate() >= a.getDate() - 1) m += 1;
  return Math.max(1, m);
}

/**
 * 年800万円以下の部分に適用する税率（%）を決める。
 * @param {object} o
 *   chusho          … 資本金1億円以下等で66条2項の対象か
 *   tokureiTsukaeru … 措置法42条の3の2が使えるか（適用除外事業者・通算法人・66条5項各号でない）
 *   shotoku         … その事業年度の所得の金額（★10億円の判定は所得全体で行う）
 *   kogakuLine      … 按分後の10億円
 */
export function keigenRate({ chusho, tokureiTsukaeru, shotoku, kogakuLine }, D) {
  if (!chusho) return null;                       // 軽減の枠そのものが無い
  if (!tokureiTsukaeru) return D.hojinzei.keigen_honsoku_pct;   // 19%のまま
  // ★10億円を超える事業年度は15%ではなく17%
  return Number(shotoku) > kogakuLine ? D.tokurei.kogaku_pct : D.tokurei.pct;
}

/**
 * 法人税と地方法人税を計算する。
 * @returns {{keigenBun:number, honsokuBun:number, keigenRate:number|null,
 *            hojinzei:number, chiho:number, total:number, kogakuTekiyo:boolean, line:number}}
 */
export function calc({ shotoku, chusho = true, tokureiTsukaeru = true, tsukisu = 12 }, D) {
  const s = Math.max(0, Math.floor(Number(shotoku) || 0));
  const line = anbun(D.hojinzei.keigen_taisho_yen, tsukisu);      // 年800万円（按分後）
  const kogakuLine = anbun(D.tokurei.kogaku_shotoku_yen, tsukisu); // 年10億円（按分後）
  const rate = keigenRate({ chusho, tokureiTsukaeru, shotoku: s, kogakuLine }, D);

  // ★軽減の対象は「年800万円以下の部分」だけ。超えた部分は原則税率。
  const keigenBase = rate === null ? 0 : Math.min(s, line);
  const honsokuBase = s - keigenBase;

  const keigenBun = rate === null ? 0 : Math.floor(keigenBase * rate / 100);
  const honsokuBun = Math.floor(honsokuBase * D.hojinzei.honsoku_pct / 100);
  // 法人税額は100円未満切捨（国税通則法119条1項）
  const hojinzei = Math.floor((keigenBun + honsokuBun) / 100) * 100;
  // ★地方法人税の課税標準は所得ではなく法人税額
  const chiho = Math.floor(Math.floor(hojinzei * D.chiho_hojinzei.pct / 100) / 100) * 100;

  return {
    shotoku: s, line, kogakuLine,
    keigenRate: rate, keigenBase, honsokuBase,
    keigenBun, honsokuBun, hojinzei, chiho,
    total: hojinzei + chiho,
    kogakuTekiyo: rate === D.tokurei.kogaku_pct,
  };
}
