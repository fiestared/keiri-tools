/**
 * 役員社宅の「賃貸料相当額」を計算するコア（DOM非依存・テスト対象）。
 *
 * 根拠: 所得税基本通達36-40・36-41（国税庁 No.2600）。数値は shataku_r08.json に置き、
 * ここには書かない（改定でコードを触らずに済ませる）。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. **小規模の(2)は「坪あたり12円」。** 12円 × 総床面積㎡ ÷ 3.3 であって、
 *     ㎡あたり12円ではない。㎡で掛けると3.3倍になる。
 *
 *  2. **借上社宅は「家賃の50%」と「固定資産税ベースの額」の多い方。**（36-40）
 *     「50%を払えばよい」と覚えている人が多いが、固定資産税ベースが上回れば
 *     そちらが賃貸料相当額になる。50%だけで組むと過小に出て、差額が給与課税される。
 *
 *  3. **非小規模の自社所有は「年額の12分の1」。** イ+ロ は年額なので、
 *     12で割らずに月額として出すと12倍になる。
 *
 *  4. **法定耐用年数30年超は 12% ではなく 10%。**（36-40 ただし書）
 *     小規模かどうかの床面積の閾値（132㎡／99㎡）も30年で分かれるので、
 *     耐用年数は2箇所に効く。片方だけ見ると両方ずれる。
 *
 *  5. ★**判定はしない。** 豪華社宅かどうかは床面積だけでは決まらず、取得価額・内外装・
 *     設備を総合勘案する（No.2600 注2）。小規模かどうかも区分所有だと共用部分のあん分が要る。
 *     **このコアは「入力した条件での計算例」を返すだけで、区分の当てはめを断定しない。**
 *     （keiri-tools の既定方針: 「有利な方を提示」ではなく「計算例」。資格法の線と同じ）
 *
 * 端数: 円未満は切り捨てで持ち回り、最後に合計する。％は小数なので、
 *       0.2% は ×2÷1000 のように整数で扱って誤差を出さない。
 */

/** 小規模な住宅にあたる床面積の上限（㎡）。耐用年数で変わる */
export function shokiboMensekiMax(taiyoNensu, D) {
  const h = D.shokibo_hantei;
  return Number(taiyoNensu) > 30 ? h.taiyo_nensu_30_cho_menseki_max : h.taiyo_nensu_30_ika_menseki_max;
}

/**
 * 床面積から「小規模な住宅の要件（床面積）を満たすか」だけを返す。
 * ★これは**床面積の要件だけ**の判定で、区分所有の共用部分のあん分は含まない。
 */
export function meetsShokiboMenseki(mensekiM2, taiyoNensu, D) {
  return Number(mensekiM2) <= shokiboMensekiMax(taiyoNensu, D);
}

/** 小規模な住宅の賃貸料相当額（月額）。36-41 */
export function calcShokibo({ tatemonoKazeiHyojun, shikichiKazeiHyojun, mensekiM2 }, D) {
  const s = D.shokibo;
  // ★0.2% = ×2÷1000。小数の掛け算を避ける
  const a = Math.floor((Number(tatemonoKazeiHyojun) || 0) * 2 / 1000);
  const b = Math.floor((Number(mensekiM2) || 0) * s.yuka_menseki_per_tsubo_yen / s.tsubo_heihoubeitoru);
  const c = Math.floor((Number(shikichiKazeiHyojun) || 0) * 22 / 10000);
  return { tatemono: a, yuka: b, shikichi: c, total: a + b + c };
}

/** 小規模でない・自社所有の賃貸料相当額（月額）。36-40 */
export function calcHiShokiboJisha({ tatemonoKazeiHyojun, shikichiKazeiHyojun, taiyoNensu }, D) {
  const h = D.hi_shokibo_jisha;
  const pct = Number(taiyoNensu) > 30 ? h.tatemono_pct_taiyo_nensu_30_cho : h.tatemono_pct;
  const i = Math.floor((Number(tatemonoKazeiHyojun) || 0) * pct / 100);   // 年額
  const ro = Math.floor((Number(shikichiKazeiHyojun) || 0) * h.shikichi_pct / 100); // 年額
  const yearly = i + ro;
  return { tatemonoYearly: i, shikichiYearly: ro, yearly, total: Math.floor(yearly / 12), tatemonoPct: pct };
}

/**
 * 小規模でない・借上の賃貸料相当額（月額）。36-40
 * ★会社が払う家賃の50% と 自社所有の場合の計算額 の**多い方**。
 */
export function calcHiShokiboKarikage(input, D) {
  const jisha = calcHiShokiboJisha(input, D);
  const half = Math.floor((Number(input.kaishaShiharaiYachin) || 0)
    * D.hi_shokibo_karikage.shiharai_yachin_pct / 100);
  const total = Math.max(jisha.total, half);
  return {
    jishaKijun: jisha.total,
    yachinHalf: half,
    total,
    adopted: total === half && half >= jisha.total ? 'yachin_half' : 'kotei_shisanzei',
  };
}

/**
 * 役員から実際に受け取っている家賃との差額（＝給与課税される額・月額）。
 * ★No.2600「給与として課税される範囲」。無償なら賃貸料相当額の全額。
 */
export function kazeiSagaku(chinTaiRyoSotoGaku, uketoriYachin) {
  const diff = Math.floor(chinTaiRyoSotoGaku) - Math.floor(Number(uketoriYachin) || 0);
  return diff > 0 ? diff : 0;
}
