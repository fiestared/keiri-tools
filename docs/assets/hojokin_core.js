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

export const AMOUNT_PLACEHOLDER = 9999999999;
export const PAGE_SIZE = 60;

export const PURPOSES = [
  { value: '設備整備・IT導入をしたい', label: '設備・IT導入', slug: 'setsubi' },
  { value: '新たな事業を行いたい', label: '新規事業', slug: 'shinjigyo' },
  { value: '販路拡大・海外展開をしたい', label: '販路拡大・海外展開', slug: 'hanro' },
  { value: '雇用・職場環境を改善したい', label: '雇用・職場環境', slug: 'koyo' },
  { value: 'エコ・SDGs活動支援がほしい', label: 'エコ・SDGs', slug: 'eco' },
  { value: '研究開発・実証事業を行いたい', label: '研究開発・実証', slug: 'kenkyu' },
  { value: '安全・防災対策支援がほしい', label: '安全・防災', slug: 'bosai' },
  { value: '人材育成を行いたい', label: '人材育成', slug: 'jinzai' },
  { value: '資金繰りを改善したい', label: '資金繰り', slug: 'shikin' },
  { value: 'まちづくり・地域振興支援がほしい', label: 'まちづくり・地域振興', slug: 'machi' },
  { value: 'イベント・事業運営支援がほしい', label: 'イベント・事業運営', slug: 'event' },
  { value: '災害（自然災害、感染症等）支援がほしい', label: '災害支援', slug: 'saigai' },
  { value: '事業を引き継ぎたい', label: '事業承継', slug: 'shokei' },
  { value: '教育・子育て・少子化支援がほしい', label: '教育・子育て', slug: 'kyoiku' },
  { value: 'スポーツ・文化支援がほしい', label: 'スポーツ・文化', slug: 'sports' },
];

export const PREF_GROUPS = [
  { block: '北海道地方', label: '北海道', prefs: [['01', '北海道']] },
  { block: '東北地方', label: '東北', prefs: [['02', '青森県'], ['03', '岩手県'], ['04', '宮城県'], ['05', '秋田県'], ['06', '山形県'], ['07', '福島県']] },
  { block: '関東・甲信越地方', label: '関東・甲信越', prefs: [['08', '茨城県'], ['09', '栃木県'], ['10', '群馬県'], ['11', '埼玉県'], ['12', '千葉県'], ['13', '東京都'], ['14', '神奈川県'], ['15', '新潟県'], ['19', '山梨県'], ['20', '長野県']] },
  { block: '東海・北陸地方', label: '東海・北陸', prefs: [['16', '富山県'], ['17', '石川県'], ['18', '福井県'], ['21', '岐阜県'], ['22', '静岡県'], ['23', '愛知県'], ['24', '三重県']] },
  { block: '近畿地方', label: '近畿', prefs: [['25', '滋賀県'], ['26', '京都府'], ['27', '大阪府'], ['28', '兵庫県'], ['29', '奈良県'], ['30', '和歌山県']] },
  { block: '中国地方', label: '中国', prefs: [['31', '鳥取県'], ['32', '島根県'], ['33', '岡山県'], ['34', '広島県'], ['35', '山口県']] },
  { block: '四国地方', label: '四国', prefs: [['36', '徳島県'], ['37', '香川県'], ['38', '愛媛県'], ['39', '高知県']] },
  { block: '九州・沖縄地方', label: '九州・沖縄', prefs: [['40', '福岡県'], ['41', '佐賀県'], ['42', '長崎県'], ['43', '熊本県'], ['44', '大分県'], ['45', '宮崎県'], ['46', '鹿児島県'], ['47', '沖縄県']] },
].map((g) => ({ ...g, prefs: g.prefs.map(([code, name]) => ({ code, name })) }));

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

export function fmtAmount(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0 || v === AMOUNT_PLACEHOLDER) return null;
  let text;
  if (v >= 100000000) {
    const units = v % 100000000 === 0 ? v / 100000000 : Math.floor(v / 10000000) / 10;
    text = `${units.toLocaleString('ja-JP')}億円`;
  } else if (v >= 10000 && v % 10000 === 0) {
    text = `${(v / 10000).toLocaleString('ja-JP')}万円`;
  } else {
    text = `${v.toLocaleString('ja-JP')}円`;
  }
  return { text, budget: v >= 1000000000 };
}

export function areaLabel(value) {
  const areas = String(value || '').split('/').map((x) => x.trim()).filter(Boolean);
  if (!areas.length) return '地域の記載なし';
  if (areas.includes('全国')) return '全国';
  if (areas.length >= 4) return `${areas[0]}など${areas.length}地域`;
  return areas.join('・');
}

export function descOf(row) {
  let s = String(row.summary || '').trim();
  if (s.startsWith('■')) s = s.slice(1).replace(/^(目的・概要|事業の概要|事業概要|概要|目的)/, '');
  s = s.split('■')[0].trim();
  if (!s || /^https?:\/\//.test(s) || s.startsWith('参照ホームページ')) {
    return String(row.subsidy_catch_phrase || '').trim();
  }
  return s;
}

export function fmtDeadline(row, today = new Date()) {
  const end = parseDt(row.acceptance_end_datetime);
  const n = daysLeft(row, today);
  if (!end || n === null) return { text: '締切の記載なし', cls: '' };
  const date = `${end.getMonth() + 1}/${end.getDate()}(${'日月火水木金土'[end.getDay()]})`;
  if (n === 0) return { text: `本日 ${date}締切`, cls: 'hj-soon' };
  return { text: `${date}まで・あと${n}日`, cls: n <= 7 ? 'hj-near' : '' };
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
      const areas = String(r.target_area_search || '').split('/').map((x) => x.trim());
      if (f.area === '全国') {
        if (!areas.includes('全国')) return false;
      } else {
        const group = PREF_GROUPS.find((g) => g.prefs.some((p) => p.name === f.area));
        const local = areas.includes(f.area) || (group && areas.includes(group.block));
        const national = areas.includes('全国') && f.includeNational !== false;
        if (!local && !national) return false;
      }
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
      if (!Number.isFinite(v) || v === AMOUNT_PLACEHOLDER || v < Number(f.minAmount)) return false;
    }
    if (f.keyword) {
      const k = String(f.keyword).trim();
      const haystack = [r.title, r.subsidy_catch_phrase, r.summary].map((x) => String(x || ''));
      if (k && !haystack.some((x) => x.includes(k))) return false;
    }
    if (f.purpose) {
      const purposes = String(r.use_purpose || '').split('/').map((x) => x.trim());
      if (!purposes.includes(f.purpose)) return false;
    }
    return true;
  });
}

/** 並べ替え。既定は締切が近い順（★これが競合に無い。多くは掲載日順しか持たない） */
export function sortRows(rows, how = 'deadline', today = new Date()) {
  const a = [...rows];
  if (how === 'amount') {
    const amount = (r) => Number(r.subsidy_max_limit) === AMOUNT_PLACEHOLDER ? 0 : (Number(r.subsidy_max_limit) || 0);
    return a.sort((x, y) => amount(y) - amount(x));
  }
  if (how === 'new') {
    return a.sort((x, y) => {
      const dx = parseDt(x.acceptance_start_datetime), dy = parseDt(y.acceptance_start_datetime);
      if (!dx && !dy) return sortRows([x, y], 'deadline', today)[0] === x ? -1 : 1;
      if (!dx) return 1;
      if (!dy) return -1;
      if (dx.getTime() !== dy.getTime()) return dy - dx;
      return (daysLeft(x, today) ?? Infinity) - (daysLeft(y, today) ?? Infinity);
    });
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

/** 取得時刻を人が読む形にする。`2026-08-26T02:10:52+09:00` → `2026-08-26 02:10`
 *
 * ★なぜ在るか（2026-08-26）: このページは取得時刻を **ISO のまま**画面に出していた
 *   （「2日前に取得したデータです（2026-08-23T07:54:51+09:00）」）。
 *   `T` とオフセットは機械のための表記で、読み手には読みづらいだけ。
 *   ★同じ値を data-captured 属性に持たせるのは今まで通りで良い（あれは機械が読む）。
 *   画面に出す時だけこれを通す。
 */
export function capturedLabel(s) {
  const d = parseDt(s);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
