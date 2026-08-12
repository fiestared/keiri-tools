/**
 * 公募中の補助金を絞り込み・並べ替えするコア（データは jGrants 公開API から）。
 *
 * ★このツールが黙って誤答しやすい急所:
 *
 *  1. ★★**締切を過ぎたものを「公募中」として見せない。**
 *     データは取得時点のスナップショットで、締切は毎日過ぎていく。実測で
 *     **30日以内に締切を迎えるものが全体の約17%**あり、放置すると「もう出せない補助金」を
 *     出せるかのように見せることになる。→ 表示のたびに**今日**と突き合わせて締切超過を外す。
 *     ★競合の実例: 補助金ポータルは総登録6万件に対し公募中5,916件（約10%）で、
 *       終了案件に「公募中」バッジが残る綻びがある（2026-08-11 調査）。
 *
 *  2. ★**データの鮮度そのものを画面に出す。**
 *     いつ取得したデータかを隠すと、利用者は「今日の状態」だと思う。
 *     取得から日が経っていたら、件数より先にそれを言う（STALE_DAYS）。
 *
 *  3. ★**出典表示は規約上の義務。**（jGrants Web-API利用規約）
 *     二次利用は可能だが、出典の表示と、編集・加工した旨の明示が要る。
 *     → SOURCE_NOTICE をページが必ず出す（tests/test_hojokin.mjs が強制する）。
 *
 *  4. ★**網羅を約束しない。** API は keyword 必須で「全件」を要求できないため、
 *     語彙の和集合で近似している。「すべての補助金」と書かない。
 *
 *  5. **このコアは「あなたが使えるか」を判定しない。** 対象要件の当てはめは
 *     公募要領を読んで決まる。ここでは条件での絞り込みだけを行う。
 */

/** データが古いと見なす日数。これを超えたらページは件数より先に鮮度を告げる */
export const STALE_DAYS = 3;

/** ★規約上の義務。文言はデータ側（_meta.attribution）を正とし、無いときだけこれを使う */
export const SOURCE_NOTICE = '出典：Jグランツ（編集・加工しています）';

/** "2026-08-31T08:00:00.000Z" → Date。壊れていれば null（勝手に今日にしない） */
export function parseDt(s) {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** 締切までの残り日数。null は「締切の記載が無い」＝日数で切れない */
export function daysLeft(row, today) {
  const end = parseDt(row.acceptance_end_datetime);
  if (!end) return null;
  const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d1 = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((d1 - d0) / 86400000);
}

/**
 * ★まだ応募できるか。締切を過ぎたものは公募中として扱わない。
 * 締切の記載が無いものは**落とさない**（記載漏れで消すと、実在する補助金が見えなくなる）。
 */
export function isOpen(row, today) {
  const n = daysLeft(row, today);
  if (n === null) return true;
  return n >= 0;
}

/** 受付がまだ始まっていないか（開始前のものは「予告」として区別する） */
export function notStarted(row, today) {
  const start = parseDt(row.acceptance_start_datetime);
  if (!start) return false;
  return start.getTime() > today.getTime();
}

/** 従業員数の表記（"300名以下" など）から上限人数を読む。読めなければ null */
export function employeeCap(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s*名以下/);
  return m ? Number(m[1]) : null;
}

/**
 * 絞り込み。★指定が無い条件は絞らない（空の指定を「該当なし」にしない）。
 * @param {object} f
 *   area      … 都道府県名。'全国' を選んだときは全国のみ
 *   employees … 自社の従業員数。これ以下の上限が付いた補助金だけに絞る
 *   maxDays   … 締切まで何日以内か
 *   keyword   … タイトルへの部分一致
 *   minAmount … 補助上限額がこの額以上
 */
export function filterRows(rows, f = {}, today = new Date()) {
  return rows.filter((r) => {
    if (!isOpen(r, today)) return false;
    if (f.area) {
      // ★target_area_search は "茨城県 / 栃木県 / …" のように複数を含むことがある。
      //   完全一致で見ると、その補助金が対象の県で拾えない。
      const a = String(r.target_area_search || '');
      if (a !== '全国' && !a.split('/').map((x) => x.trim()).includes(f.area)) return false;
    }
    if (f.employees != null && f.employees !== '') {
      const cap = employeeCap(r.target_number_of_employees);
      // ★上限の記載が無いものは落とさない（「制限なし」の可能性がある）
      if (cap !== null && Number(f.employees) > cap) return false;
    }
    if (f.maxDays != null && f.maxDays !== '') {
      const n = daysLeft(r, today);
      if (n === null || n > Number(f.maxDays)) return false;
    }
    if (f.minAmount != null && f.minAmount !== '') {
      const v = Number(r.subsidy_max_limit);
      if (!Number.isFinite(v) || v < Number(f.minAmount)) return false;
    }
    if (f.keyword) {
      const k = String(f.keyword).trim();
      if (k && !String(r.title || '').includes(k)) return false;
    }
    return true;
  });
}

/** 並べ替え。既定は締切が近い順（★これが競合に無い。多くは掲載日順しか持たない） */
export function sortRows(rows, how = 'deadline', today = new Date()) {
  const a = [...rows];
  if (how === 'amount') {
    return a.sort((x, y) => (Number(y.subsidy_max_limit) || 0) - (Number(x.subsidy_max_limit) || 0));
  }
  return a.sort((x, y) => {
    const dx = daysLeft(x, today), dy = daysLeft(y, today);
    // ★締切の記載が無いものは最後に置く（先頭に来ると「今日締切」に見える）
    if (dx === null && dy === null) return 0;
    if (dx === null) return 1;
    if (dy === null) return -1;
    return dx - dy;
  });
}

/** データの鮮度。★古ければ件数より先にこれを言う */
export function freshness(meta, today = new Date()) {
  const cap = parseDt(meta && meta.captured_jst);
  if (!cap) return { days: null, stale: true, text: '取得日時が分からないデータです' };
  const days = Math.floor((today - cap) / 86400000);
  return {
    days,
    stale: days >= STALE_DAYS,
    text: days <= 0 ? '今日取得したデータです' : `${days}日前に取得したデータです`,
  };
}

/** 都道府県の選択肢。★"A / B / C" をばらして重複を除く */
export function areaOptions(rows) {
  const s = new Set();
  for (const r of rows) {
    for (const a of String(r.target_area_search || '').split('/')) {
      const t = a.trim();
      if (t) s.add(t);
    }
  }
  // 「全国」を先頭に、あとは五十音でなく元の並び（都道府県コード順は持っていない）
  const all = [...s].filter((x) => x !== '全国').sort();
  return s.has('全国') ? ['全国', ...all] : all;
}
