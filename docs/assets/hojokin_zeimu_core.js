/**
 * 補助金の経理・税務（圧縮記帳）のコア。法人税法42条・43条・44条。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. ★★**分かれ目は「返還を要しないことが期末までに確定したか」。**
 *     補助金をもらったかどうかではない。
 *       確定した   … 42条 → 圧縮記帳
 *       していない … 43条 → **特別勘定**（圧縮記帳ではない）
 *       あとで確定 … 44条 → その確定した日の属する事業年度に圧縮記帳
 *     「補助金をもらった＝圧縮記帳」と実装すると、未確定の年度に圧縮してしまう。
 *
 *  2. ★**圧縮限度額は固定資産の取得価額を超えられない。**
 *     帳簿価額を減額する処理なので、価額より大きくは減らせない。
 *     補助金の額をそのまま限度額にすると、取得価額より補助金が大きいときに破綻する。
 *
 *  3. ★**圧縮記帳は非課税の制度ではない。**（法人税法22条2項）
 *     補助金は益金に入る。圧縮記帳は同額を損金に立てて**課税を繰り延べる**だけで、
 *     圧縮後の価額で減価償却するぶん、後の年度に課税される。
 *     「税金がかからなくなる」と書くのは嘘になる。
 *
 *  4. ★**直接減額方式と積立金方式で、以後の減価償却費が変わる。**
 *     直接減額は簿価が下がるので償却費も下がる。積立金方式は簿価が下がらないので
 *     償却費は変わらず、積立金の取崩しで申告調整する。税額の総額は同じでも
 *     損益計算書の見え方が違う。
 *
 *  5. **このコアは判定しない。** どの分岐に当たるか・補助金が対象かは事実認定による。
 *     入力された前提での計算だけを返す。消費税の仕入控除税額の返還額も計算しない
 *     （交付要綱と実際の申告内容によるため）。
 */

/** 分岐の判定に使うキー */
export const BUNKI = {
  KAKUTEI: 'kakutei_zumi',      // 42条: 期末までに返還不要が確定
  MIKAKUTEI: 'mikakutei',       // 43条: 未確定 → 特別勘定
  ATODE: 'ato_de_kakutei',      // 44条: 特別勘定を持っていて後で確定
};

/**
 * どの条文で処理するかを返す。
 * @param {object} o
 *   kakuteiZumi   … 返還を要しないことが期末までに確定したか
 *   shutokuZumi   … 交付の目的に適合した固定資産を期末までに取得・改良したか
 *   tokubetsuArii … すでに特別勘定を設けているか
 */
export function bunki({ kakuteiZumi, shutokuZumi, tokubetsuArii = false }, D) {
  const b = D.bunki;
  if (tokubetsuArii && kakuteiZumi) {
    return { key: BUNKI.ATODE, ...b.ato_de_kakutei };
  }
  if (!kakuteiZumi) {
    return { key: BUNKI.MIKAKUTEI, ...b.mikakutei };
  }
  if (!shutokuZumi) {
    // ★確定していても、対象の固定資産を取得していなければ42条の圧縮記帳はできない
    return {
      key: BUNKI.MIKAKUTEI,
      jobun: b.mikakutei.jobun,
      youken: b.mikakutei.youken,
      shori: b.mikakutei.shori,
      _note: '返還不要は確定していますが、交付の目的に適合した固定資産をまだ取得・改良していないため、42条の圧縮記帳はできません。',
    };
  }
  return { key: BUNKI.KAKUTEI, ...b.kakutei_zumi };
}

/**
 * 圧縮限度額。★取得価額を超えない（帳簿価額を減額する処理だから）。
 * @returns {{gendo:number, capped:boolean}} capped=true なら取得価額で頭打ちになった
 */
export function assyukuGendo(hojokin, shutokuKagaku) {
  const h = Math.max(0, Math.floor(Number(hojokin) || 0));
  const s = Math.max(0, Math.floor(Number(shutokuKagaku) || 0));
  return { gendo: Math.min(h, s), capped: h > s };
}

/**
 * 圧縮記帳をした場合の、圧縮後の取得価額と当期の減価償却費。
 * ★直接減額方式は簿価が下がるので償却費も下がる。積立金方式は簿価が変わらない。
 * @param {'chokusetsu'|'tsumitate'} houshiki
 * @param {number} shoukyakuRitsu 定額法の償却率（例: 耐用年数10年なら 0.100）
 * @param {number} tsukisu 事業供用からの月数（1年なら12）
 */
export function shoukyaku({ shutokuKagaku, gendo, houshiki, shoukyakuRitsu, tsukisu = 12 }, ) {
  const s = Math.max(0, Math.floor(Number(shutokuKagaku) || 0));
  const g = Math.max(0, Math.floor(Number(gendo) || 0));
  const r = Number(shoukyakuRitsu) || 0;
  const m = Math.min(12, Math.max(0, Number(tsukisu) || 0));
  // ★償却の基礎になる価額が方式で違う。ここが2方式の実質的な差。
  const base = houshiki === 'chokusetsu' ? Math.max(0, s - g) : s;
  return {
    base,
    // 定額法・月割り（1円未満切捨）
    genka: Math.floor(base * r * m / 12),
    kaikeiBoka: houshiki === 'chokusetsu' ? Math.max(0, s - g) : s,
  };
}

/** 仕訳の骨（★金額はコアが計算した値をそのまま使う。文言に数字を埋め込まない） */
export function shiwake({ bunkiKey, hojokin, gendo, houshiki }) {
  const h = Math.floor(Number(hojokin) || 0);
  const g = Math.floor(Number(gendo) || 0);
  const rows = [];
  rows.push({ when: '交付決定・入金', dr: '現金預金', drAmt: h, cr: '国庫補助金収入（特別利益）', crAmt: h,
    note: '★補助金は益金に入ります（法人税法22条2項）。圧縮記帳は非課税にする制度ではありません。' });
  if (bunkiKey === BUNKI.MIKAKUTEI) {
    rows.push({ when: '期末（返還不要が未確定）', dr: '国庫補助金等特別勘定繰入額', drAmt: h,
      cr: '国庫補助金等特別勘定', crAmt: h,
      note: '★返還を要しないことが期末までに確定していないので、圧縮記帳ではなく特別勘定です（43条1項）。' });
    return rows;
  }
  if (houshiki === 'chokusetsu') {
    rows.push({ when: '圧縮記帳（直接減額方式）', dr: '固定資産圧縮損', drAmt: g, cr: '（対象の固定資産）', crAmt: g,
      note: '★帳簿価額を直接減らすので、以後の減価償却費も下がります。' });
  } else {
    rows.push({ when: '圧縮記帳（積立金方式）', dr: '繰越利益剰余金', drAmt: g, cr: '圧縮積立金', crAmt: g,
      note: '★剰余金の処分で積み立てます。帳簿価額は下がらないので減価償却費は変わらず、積立金の取崩しで申告調整します。' });
  }
  if (bunkiKey === BUNKI.ATODE) {
    rows.push({ when: '同時に特別勘定を取り崩す', dr: '国庫補助金等特別勘定', drAmt: h,
      cr: '国庫補助金等特別勘定戻入額', crAmt: h,
      note: '返還を要しないことが確定したので取り崩します（43条2項）。' });
  }
  return rows;
}
