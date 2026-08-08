/**
 * 予定納税額と減額申請の判定コア（所得税法104条・105条・106条・111条・113条）。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. ★**端数は「各期の3分の1」に対して切り捨てる。四捨五入ではない。**（104条3項）
 *     条文は「予定納税基準額の三分の一に相当する金額に百円未満の端数があるときは、
 *     その端数を切り捨てる」と書いている。効くのは次の2つ:
 *       ・四捨五入にすると各期で100円多く出る（例: 基準額250,100円 → 83,300 が正しく、四捨五入だと83,400）
 *       ・合計（3分の2）に対して切り捨てると2期の合計がずれる
 *         （例: 基準額150,150円 → 50,000×2＝100,000 が正しく、合計側で丸めると100,100）
 *     ★なお「基準額を先に100円未満切り捨てしてから3分の1にする」誤りは、
 *       結果が本則と**必ず一致する**（100の倍数の開区間に300の倍数は入らないため）。
 *       ここは危険に見えて危険でないので、検査もしていない。
 *
 *  2. ★**予定納税基準額には譲渡所得・一時所得・雑所得・臨時所得を入れない。**（104条1項1号）
 *     「これらの金額がなかつたものとみなして計算した額」と括弧書きにある。
 *     前年にたまたま株を売った・満期保険金を受け取った人の基準額を、そのまま
 *     前年の税額で計算すると**過大に**出る（払わなくてよい前払いを払わせる方向で誤る）。
 *
 *  3. ★**減額申請が「通る」条件は10分の7以下。**（113条2項2号）
 *     見積額が基準額の10分の7**以下**なら税務署長は承認「しなければならない」＝義務。
 *     『申請できます』とだけ書く解説が多いが、条文には承認が義務になる線が引いてある。
 *     ★113条2項1号の事由（廃業・休業・転換・失業・災害・盗難・横領・**医療費の支払**）に
 *     当たる場合は、10分の7以下でなくても承認が義務。
 *
 *  4. ★**通知が遅れると申請期限も延びる。**（111条3項）
 *     通知書面が6月15日（第2期は10月15日）までに発せられなかった場合、申請期限は
 *     通知が発せられた日から1月を経過した日まで延期される。7月15日で固定ではない。
 *
 *  5. **このコアは「申請すべきか」を答えない。** 見積額そのものは本人の見込みで決まる。
 *     入力された前提での判定だけを返す。
 */

/** 予定納税基準額。★譲渡・一時・雑・臨時の所得に係る税額は除いた額を渡すこと（104条1項1号） */
export function kijunGaku(zennenZeigaku, gensenZeigaku) {
  return Math.max(0, Math.floor(Number(zennenZeigaku) || 0) - Math.floor(Number(gensenZeigaku) || 0));
}

/** 予定納税の義務があるか（基準額が15万円以上。★15万円ちょうどは対象） */
export function needsYotei(kijun, D) {
  return Number(kijun) >= D.kijun.shikii_yen;
}

/**
 * 各期の予定納税額。
 * ★3分の1にしてから100円未満を切り捨てる（104条3項）。基準額を先に丸めない。
 */
export function kigaku(kijun, D) {
  const k = Number(kijun) || 0;
  if (!needsYotei(k, D)) return { ki1: 0, ki2: 0, total: 0 };
  const unit = D.kijun.hasu_kirisute_yen;
  const each = Math.floor(k / D.kijun.bunbo / unit) * unit;
  return { ki1: each, ki2: each, total: each * 2 };
}

/**
 * 減額申請の判定。
 * @param {number} kijun    予定納税基準額（第2期のみの申請で第1期に承認済みなら、その見積額）
 * @param {number} mitsumori 申告納税見積額（本人の見込み）
 * @param {string[]} jiyu   該当する113条2項1号の事由（廃業・失業・医療費の支払 など）
 * @returns {{sagaku:number, wariai:number, shoninGimu:boolean, riyu:string, moshikomeru:boolean}}
 */
export function gengakuHantei(kijun, mitsumori, jiyu, D) {
  const k = Number(kijun) || 0;
  const m = Number(mitsumori) || 0;
  const g = D.gengaku.shonin_gimu;
  // ★10分の7「以下」。基準額×7/10 と比較する（割合を先に丸めない）
  const line = k * g.wariai_bunshi / g.wariai_bunbo;
  const byWariai = k > 0 && m <= line;
  const byJiyu = Array.isArray(jiyu) && jiyu.length > 0 && m < k;
  const shoninGimu = byWariai || byJiyu;
  let riyu;
  if (byJiyu && byWariai) {
    riyu = `113条2項1号の事由（${jiyu.join('・')}）に該当し、かつ見積額が基準額の10分の7以下です。`;
  } else if (byJiyu) {
    riyu = `113条2項1号の事由（${jiyu.join('・')}）に該当し、見積額が基準額に満たない見込みです。`;
  } else if (byWariai) {
    riyu = '見積額が基準額の10分の7以下です（113条2項2号）。';
  } else if (m < k) {
    riyu = '見積額は基準額を下回っていますが、10分の7以下ではなく、1号の事由にも該当していません。'
         + '申請そのものはできますが、承認は税務署長の調査による判断になります（113条1項）。';
  } else {
    riyu = '見積額が基準額を下回っていないため、減額申請の要件（111条）を満たしません。';
  }
  return {
    sagaku: Math.max(0, k - m),
    wariai: k > 0 ? m / k : 0,
    line: Math.floor(line),
    shoninGimu,
    // ★「申請できる」のは見積額が基準額に満たないと見込まれる場合（111条1項・2項）
    moshikomeru: m < k,
    riyu,
  };
}

/**
 * 申請期限。★通知が遅れた場合は「通知が発せられた日から1月を経過した日」まで延びる（111条3項）。
 * @param {'ki1'|'ki2'} ki
 * @param {number} year 西暦
 * @param {string} tsuchiHassoBi 通知書面が発せられた日（"YYYY-MM-DD"）。不明なら空文字
 * @returns {{kigen:string, encho:boolean, genkyo:string}}
 */
export function shinseiKigen(ki, year, tsuchiHassoBi, D) {
  const g = D.gengaku[ki];
  const e = D.gengaku.kigen_encho;
  const y = Number(year);
  const honsoku = `${y}-${ki === 'ki1' ? '07-15' : '11-15'}`;
  const hassoKigen = Date.parse(`${y}-${ki === 'ki1' ? '06-15' : '10-15'}T00:00:00+09:00`);
  const hasso = Date.parse(tsuchiHassoBi ? `${tsuchiHassoBi}T00:00:00+09:00` : '');
  if (!Number.isFinite(hasso) || hasso <= hassoKigen) {
    return { kigen: honsoku, encho: false, genkyo: g.genkyo };
  }
  // ★「発せられた日から起算して1月を経過した日」＝翌月の同日
  const d = new Date(hasso);
  d.setMonth(d.getMonth() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    kigen: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    encho: true,
    genkyo: g.genkyo,
  };
}

/** 承認された場合の各期の予定納税額（見積額を基準額と読み替えて計算する。113条3項） */
export function shoninGoKigaku(mitsumori, D) {
  return kigaku(mitsumori, D);
}
