/**
 * 給与所得の源泉徴収票の金額欄（①〜④）を埋めるためのコア。
 *
 * ★給与所得の計算そのものは juminzei_core.js の kyuyoShotokuR8 / kyuyoShotoku が持つ。
 *   ここでは再実装しない（別表第五と措法29条の4の両方を2箇所に持つと片方だけ腐る）。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. ★★**令和8年分・令和9年分の②欄は別表第五で引かない。**（措置法29条の4第4項）
 *     支払金額が**220万円未満**の人は、所得税法190条2号（別表第五を含む）に
 *     **かかわらず**、措置法29条の4を適用した給与所得の金額を②欄に書く。
 *     去年と同じ気持ちで別表第五を引くと、この帯の人だけ②欄が狂う
 *     （実測: 支払金額170万で 特例960,000 vs 別表第五1,050,000 の90,000円差、
 *      支払金額70万で 特例0 vs 別表第五50,000）。
 *     ★**下限は無い。** 1項が「収入金額が二百二十万円以下である場合」と書いており、
 *     収入が74万円未満なら控除は収入相当額（＝所得0）。下限を置くと低い側で狂う。
 *
 *  2. ★**②欄は「年末調整をした人」だけ埋める。**（所得税法226条・規則93条）
 *     乙欄の人、年の中途で退職した人、年末調整をしなかった人は
 *     ②③欄が**空欄**になり、④欄には毎月徴収した税額の合計が入る。
 *     年末調整をしていないのに②欄を埋めると、受け取った側が確定申告で誤る。
 *
 *  3. ★**④欄は「毎月天引きした合計」ではない。**
 *     年末調整をした人の④欄は**年調後の年税額**（復興特別所得税を含む・100円未満切捨）。
 *     過不足は12月（または翌1月）の給与で精算されるので、月々の合計とは一致しない。
 *
 *  4. ★**③欄には基礎控除も入る。**
 *     「所得控除の額の合計額」なので、社会保険料等・生命保険料・地震保険料・扶養控除に加えて
 *     基礎控除も合算する。基礎控除を落とす誤りは、③欄を小さく＝税額を過大に見せる。
 *
 *  5. **このコアは年税額を計算しない。** 税額表・住宅ローン控除・定額減税は扱わない。
 */

/**
 * ②「給与所得控除後の金額」。
 * @param {number} shiharai 支払金額（①欄）
 * @param {boolean} nenmatsuChosei 年末調整をしたか
 * @param {object} D juminzei_r08.json
 * @param {function} kyuyoShotokuR8 juminzei_core.js の同名関数（★再実装しない）
 * @returns {{value:number|null, kubun:string, tokureiTaisho:boolean}}
 *   年末調整をしていなければ value は null（＝空欄。0円と書かない）
 */
export function kojoGoNoGaku(shiharai, nenmatsuChosei, D, kyuyoShotokuR8) {
  if (!nenmatsuChosei) {
    return { value: null, kubun: '年末調整をしていないため空欄', tokureiTaisho: false };
  }
  const s = Math.max(0, Math.floor(Number(shiharai) || 0));
  const K = D.kyuyo_shotoku_r8;
  // ★措置法29条の4第1項は「収入金額が二百二十万円以下である場合」に効くので、
  //   **下限は無い**（収入が74万円未満なら控除は収入相当額＝所得0）。
  //   下限を69.1万円などに置くと、それ未満の人だけ別表第五で引くことになり、
  //   収入70万の②欄が0でなく5万円になる（＝特例が効いていない）。
  //   220万円ちょうどは特例でも別表第五でも146万円で一致するので、そこから委譲する。
  const tokureiTaisho = s < K.hyo5_from;
  return {
    value: kyuyoShotokuR8(s, D),
    kubun: tokureiTaisho
      ? '措置法29条の4（令和8年分・令和9年分の特例）で計算した金額'
      : '所得税法別表第五（または28条の速算式）で計算した金額',
    tokureiTaisho,
  };
}

/** ③「所得控除の額の合計額」。★基礎控除を落とさない */
export function shotokuKojoGokei({ shakai = 0, seimei = 0, jishin = 0, jinteki = 0, kiso = 0 }, nenmatsuChosei) {
  if (!nenmatsuChosei) return { value: null, uchiwake: null };
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const uchiwake = {
    shakai: n(shakai), seimei: n(seimei), jishin: n(jishin), jinteki: n(jinteki), kiso: n(kiso),
  };
  return {
    value: Object.values(uchiwake).reduce((a, b) => a + b, 0),
    uchiwake,
  };
}

/**
 * ②−③（課税される所得金額の手前）。★マイナスにしない。
 * 年税額そのものは税額表と各種税額控除が要るので、このコアでは出さない。
 */
export function kazeiTaishoMae(kojoGo, kojoGokei) {
  if (kojoGo == null || kojoGokei == null) return null;
  return Math.max(0, kojoGo - kojoGokei);
}

/**
 * 記入の整合チェック。★「値が入っているのに矛盾している」形を名指しする。
 * @returns {Array<{level:'error'|'warn', text:string}>}
 */
export function checkKinyu({ shiharai, nenmatsuChosei, kojoGo, kojoGokei, gensenZeigaku }) {
  const out = [];
  const s = Number(shiharai) || 0;
  if (!nenmatsuChosei) {
    if (kojoGo != null || kojoGokei != null) {
      out.push({ level: 'error', text: '年末調整をしていないのに②③欄に金額が入っています。所得税法226条の様式では、年末調整をしなかった人の②③欄は空欄です（受け取った側が確定申告で二重に控除しかねません）。' });
    }
    out.push({ level: 'warn', text: '年末調整をしていない場合、④欄には毎月徴収した税額の合計を書きます（年調後の年税額ではありません）。' });
    return out;
  }
  if (kojoGo != null && kojoGo > s) {
    out.push({ level: 'error', text: '②欄が①欄より大きくなっています。②は①から給与所得控除を引いた後の金額なので、①を超えることはありません。' });
  }
  if (kojoGokei != null && kojoGo != null && kojoGokei > kojoGo) {
    out.push({ level: 'warn', text: '③欄が②欄を超えています。控除しきれない場合は課税所得が0になるだけで誤りとは限りませんが、③の内訳をご確認ください。' });
  }
  const z = Number(gensenZeigaku);
  if (Number.isFinite(z) && z > 0 && z % 100 !== 0) {
    out.push({ level: 'warn', text: '④欄に100円未満の端数があります。年調後の年税額は100円未満を切り捨てます（国税通則法119条1項）。' });
  }
  return out;
}
