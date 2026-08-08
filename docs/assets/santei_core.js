/**
 * 算定基礎届（標準報酬月額の定時決定）のコア。
 * 健康保険法41条／厚生年金保険法21条／健康保険法施行規則24条の2。
 *
 * ★等級表そのものは shaho_core.js の KENKO_GRADES / kenkoGrade / koseiStandard が持つ。
 *   ここでは再実装しない（片方だけ直る事故を避ける）。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. ★**分母は3で固定ではない。**（41条1項）
 *     条文は「報酬支払の基礎となった日数が十七日…未満である月があるときは、その月を除く」
 *     とした上で「その期間の月数で除して得た額」と書いている。
 *     17日未満の月を除いた**残りの月数**で割る。常に3で割る実装は、
 *     日数の足りない月がある人の報酬月額を**低く**出す（等級が下がる方向で誤る）。
 *
 *  2. ★**定時決定と随時改定で17日の使い方が逆。**
 *     定時決定（41条1項）… 17日未満の月を「除く」
 *     随時改定（43条1項）… 「各月とも、報酬支払の基礎となつた日数が、十七日以上でなければならない」
 *     同じ17日でも、片方は除外条件、もう片方は要件。混ぜると随時改定の判定が甘くなる。
 *
 *  3. ★**11日が使えるのは「短時間労働者」で、呼び方ではなく所定労働時間で決まる。**
 *     施行規則24条の2 — 1週間の所定労働時間が通常の労働者の4分の3未満、または
 *     1か月の所定労働日数が通常の労働者の4分の3未満の者。
 *     「パート」と呼ばれていても4分の3以上なら17日。
 *
 *  4. ★**6月1日〜7月1日に資格取得した人は、その年は対象外。**（41条3項）
 *     7月〜9月のいずれかの月から随時改定され「るべき」被保険者も対象外。
 *     「べき」なので、届け出ていなくても該当すれば外れる。
 *
 *  5. **このコアは保険者算定（年間平均等）を判定しない。** 個別の事情と保険者の判断による。
 */

/** 短時間労働者かどうかで、報酬支払基礎日数の必要日数を返す（41条1項の括弧書き） */
export function hitsuyoNissu(isTanjikan, D) {
  return isTanjikan ? D.nissu.tanjikan : D.nissu.ippan;
}

/**
 * 定時決定の対象外か（41条3項）。
 * @param {string} shutokuBi 資格取得日 "YYYY-MM-DD"（空なら判定しない）
 * @param {boolean} zuijiKaitei 7〜9月のいずれかから随時改定される（べき）か
 * @param {number} year 対象の年
 */
export function taishogai(shutokuBi, zuijiKaitei, year, D) {
  if (zuijiKaitei) {
    return { taishogai: true, riyu: '7月から9月までのいずれかの月から標準報酬月額を改定される（改定されるべき）ため、その年に限り定時決定の対象外です（41条3項）。' };
  }
  const t = Date.parse(shutokuBi ? `${shutokuBi}T00:00:00+09:00` : '');
  if (Number.isFinite(t)) {
    const from = Date.parse(`${year}-${D.taishogai.shutoku_from}T00:00:00+09:00`);
    const to = Date.parse(`${year}-${D.taishogai.shutoku_to}T00:00:00+09:00`);
    // ★条文は「六月一日から七月一日までの間に…資格を取得した者」＝両端を含む
    if (t >= from && t <= to) {
      return { taishogai: true, riyu: `${year}年6月1日から7月1日までの間に資格を取得しているため、その年に限り定時決定の対象外です（41条3項）。資格取得時に決定した標準報酬月額が翌年8月まで続きます。` };
    }
  }
  return { taishogai: false, riyu: '' };
}

/**
 * 定時決定の計算。
 * @param {Array<{name:string, hoshu:number, nissu:number, zaiseki:boolean}>} months 4月・5月・6月
 * @param {boolean} isTanjikan 短時間労働者か
 * @returns {{hitsuyo:number, used:Array, excluded:Array, sokei:number, tsukisu:number,
 *            hoshuGetsugaku:number|null, sanshutsuFuka:boolean}}
 */
export function teijiKettei(months, isTanjikan, D) {
  const hitsuyo = hitsuyoNissu(isTanjikan, D);
  const used = [], excluded = [];
  for (const m of months) {
    // ★「その事業所で継続して使用された期間に限る」（41条1項）— 在籍していない月はそもそも対象外
    if (m.zaiseki === false) { excluded.push({ ...m, riyu: '在籍していない月（継続して使用された期間に限る）' }); continue; }
    if (Number(m.nissu) < hitsuyo) { excluded.push({ ...m, riyu: `支払基礎日数が${hitsuyo}日未満` }); continue; }
    used.push(m);
  }
  const sokei = used.reduce((a, m) => a + (Number(m.hoshu) || 0), 0);
  const tsukisu = used.length;
  return {
    hitsuyo, used, excluded, sokei, tsukisu,
    // ★分母は残った月数。0なら金額を出さない（保険者等が決定する領域）
    hoshuGetsugaku: tsukisu > 0 ? Math.floor(sokei / tsukisu) : null,
    sanshutsuFuka: tsukisu === 0,
  };
}

/** 適用期間（41条2項）。その年の9月から翌年8月まで */
export function tekiyoKikan(year) {
  return { from: `${year}年9月`, to: `${Number(year) + 1}年8月` };
}

/**
 * 随時改定の日数要件（43条1項）。★定時決定と逆で、全月が17日以上でなければならない。
 * @returns {{mitasu:boolean, kaketaTsuki:Array}}
 */
export function zuijiNissuOK(months, D) {
  const kaketa = months.filter((m) => Number(m.nissu) < D.zuiji.nissu);
  return { mitasu: kaketa.length === 0, kaketaTsuki: kaketa };
}
