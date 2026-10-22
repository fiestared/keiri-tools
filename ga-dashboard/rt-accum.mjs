// rt-accum.mjs — GA4 Realtime API の「直近30分・分ごとの件数」を、当日の累計へ積み上げる純ロジック。
//
// ★なぜ要るか（2026-10-12 Masahiro「ずっと0はありえない」）:
//   GA4 の runReport は当日ぶんを何時間も出さないことがある（10-12 は 14 時を過ぎても 0 行）。
//   同じ時刻に Realtime API は直近30分の session_start・page_view を返す。毎分取りに行って
//   分ごとに積めば、当日の速報になる。
// ★これは GA4 の sessions ではない。Realtime の session_start イベントの件数。数え方が違うので
//   確定値とは数件〜数%ずれる。画面でも別物として出す（日次の棒・比較には混ぜない）。
//
// 決めごと:
//   - 分のキーは JST の "YYYY-MM-DD" と "HH:MM" の文字列。計算は「JST の壁時計を分に直した整数」で行う
//     （JST に夏時間は無い。Date は年月日→通算分の換算にだけ使い、表示やキーに toISOString を使わない）。
//   - 同じ分は「これまでに見た最大値」で上書きする。同じ分を最大30回見るので、足すと30倍になる。
//     minutesAgo=0 は途中の分で、次の回に増える。遅れて届くヒットでも増える。
//   - 0 時をまたぐ分は前日の日付に入れる。
//   - 前回の取得から GAP_MIN 分以上あくと、その間の分は Realtime の窓（30分）から落ちて二度と取れない。
//     「欠け」として区間を残し、画面に出す。
//   - 持つのは直近 KEEP_DAYS 日ぶんだけ。
//
// このファイルは DOM も fs も fetch も使わない（test-rt-accum.mjs が node で直に検査する）。

export const WINDOW_MIN = 30;  // Realtime API が返す範囲（minutesAgo 0〜29）
export const GAP_MIN = 30;     // 前回の取得からこれ以上あくと欠けが出る（前回の minutesAgo=0 は途中の値のまま窓から落ちる）
export const KEEP_DAYS = 3;
export const EVENTS = { session_start: "s", page_view: "pv" };

const pad = (n) => String(n).padStart(2, "0");

/** JST の壁時計（"YYYY-MM-DD", "HH:MM"）→ 通算分。差と前後の比較にだけ使う */
export function toAbs(date, hm) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  return Date.UTC(y, mo - 1, d) / 60000 + h * 60 + mi;
}

/** 通算分 → { date: "YYYY-MM-DD", hm: "HH:MM" } */
export function fromAbs(abs) {
  const dt = new Date(abs * 60000);
  return {
    date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
    hm: `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`,
  };
}

export const emptyState = () => ({ version: 1, sites: {} });

/** 壊れた・古い形の保存データを受けても落ちないようにする。読めなければ空から始める */
export function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyState();
  if (!raw.sites || typeof raw.sites !== "object" || Array.isArray(raw.sites)) return emptyState();
  const out = emptyState();
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const isHm = (v) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
  for (const [key, site] of Object.entries(raw.sites)) {
    if (!site || typeof site !== "object") continue;
    const s = { lastFetch: null, days: {} };
    if (site.lastFetch && isDate(site.lastFetch.date) && isHm(site.lastFetch.hm)) {
      s.lastFetch = { date: site.lastFetch.date, hm: site.lastFetch.hm };
    }
    for (const [date, day] of Object.entries(site.days ?? {})) {
      if (!isDate(date) || !day || typeof day !== "object" || !isHm(day.start)) continue;
      const minutes = {};
      for (const [hm, v] of Object.entries(day.minutes ?? {})) {
        if (!isHm(hm) || !v || typeof v !== "object") continue;
        minutes[hm] = { s: Math.max(0, Number(v.s) || 0), pv: Math.max(0, Number(v.pv) || 0) };
      }
      const gaps = (Array.isArray(day.gaps) ? day.gaps : [])
        .filter((g) => g && isHm(g.from) && isHm(g.to) && g.from <= g.to)
        .map((g) => ({ from: g.from, to: g.to }));
      s.days[date] = { start: day.start, minutes, gaps };
    }
    // 日が1つも読めなかったのに lastFetch だけ残ると、次の回に「欠け」を記録する先が無い。空から始める
    if (!Object.keys(s.days).length) s.lastFetch = null;
    // クォータの実測（build.mjs が毎回書く。積み上げには使わない）はそのまま通す
    if (site.quota && typeof site.quota === "object" && !Array.isArray(site.quota)) s.quota = site.quota;
    out.sites[key] = s;
  }
  return out;
}

/**
 * 1回ぶんの取得を積み上げる。state は書き換えず、新しい state を返す。
 * @param {object} state  normalizeState 済みの保存データ
 * @param {string} siteKey
 * @param {{date:string, hm:string}} at  取得時刻（JST・分に切り捨て）
 * @param {{minutesAgo:number|string, s?:number, pv?:number}[]} rows  minutesAgo ごとの件数
 */
export function applyFetch(state, siteKey, at, rows) {
  const next = normalizeState(state);
  const site = (next.sites[siteKey] ??= { lastFetch: null, days: {} });
  const T = toAbs(at.date, at.hm);
  const winStart = T - (WINDOW_MIN - 1);
  const P = site.lastFetch ? toAbs(site.lastFetch.date, site.lastFetch.hm) : null;

  // 欠け: 前回 P の分は途中の値（minutesAgo=0）のまま。今回の窓は winStart から。
  //   P 〜 winStart-1 は数え切れていない。日付ごとに切って、その日に積み上げがあるときだけ残す
  //   （積み上げの無い日は「始めた時刻」が後ろへずれるだけで、欠けとしては出さない）。
  if (P !== null && T - P >= GAP_MIN) {
    let a = P;
    const end = winStart - 1;
    while (a <= end) {
      const { date } = fromAbs(a);
      const dayEnd = toAbs(date, "23:59");
      const b = Math.min(end, dayEnd);
      const day = site.days[date];
      if (day) addGap(day, fromAbs(a).hm, fromAbs(b).hm);
      a = b + 1;
    }
  }

  // その日の積み上げを始めた時刻 = その日で最初に窓に入った分
  const ensureDay = (abs) => {
    const { date } = fromAbs(abs);
    if (!site.days[date]) {
      const first = Math.max(winStart, toAbs(date, "00:00"));
      site.days[date] = { start: fromAbs(first).hm, minutes: {}, gaps: [] };
    }
    return site.days[date];
  };
  ensureDay(T); // 0件の回でも「始めた時刻」は記録する

  for (const r of rows ?? []) {
    const ago = Number(r.minutesAgo);
    if (!Number.isInteger(ago) || ago < 0 || ago >= WINDOW_MIN) continue;
    const abs = T - ago;
    const day = ensureDay(abs);
    const hm = fromAbs(abs).hm;
    const cur = day.minutes[hm] ?? { s: 0, pv: 0 };
    // ★加算しない。同じ分を最大30回見る
    day.minutes[hm] = {
      s: Math.max(cur.s, Math.max(0, Number(r.s) || 0)),
      pv: Math.max(cur.pv, Math.max(0, Number(r.pv) || 0)),
    };
  }

  // 時計が戻った回（P > T）では lastFetch を戻さない
  if (P === null || T >= P) site.lastFetch = { date: at.date, hm: at.hm };

  // 古い日付を捨てる（今日を含めて KEEP_DAYS 日）
  const oldest = fromAbs(toAbs(at.date, "00:00") - (KEEP_DAYS - 1) * 1440).date;
  for (const date of Object.keys(site.days)) if (date < oldest) delete site.days[date];
  return next;
}

function addGap(day, from, to) {
  if (to < day.start) return;                 // 積み上げを始める前は欠けではない
  const g = { from: from < day.start ? day.start : from, to };
  const all = [...day.gaps, g].sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : 0));
  const merged = [];
  for (const x of all) {
    const last = merged.at(-1);
    // 隣り合う・重なる区間は1つにする（"HH:MM" は文字列の大小がそのまま時刻の前後）
    if (last && toAbs("2000-01-01", x.from) <= toAbs("2000-01-01", last.to) + 1) {
      if (x.to > last.to) last.to = x.to;
    } else merged.push({ ...x });
  }
  day.gaps = merged;
}

/**
 * その日の速報。積み上げが無ければ null。
 * @returns {{s:number, pv:number, from:string, to:string, gaps:{from:string,to:string}[], gapMin:number}|null}
 *   to = その日の最後に取得した時刻（当日なら最後の取得時刻、過ぎた日は 23:59）
 */
export function summarize(state, siteKey, date) {
  const site = state?.sites?.[siteKey];
  const day = site?.days?.[date];
  if (!day) return null;
  let s = 0, pv = 0;
  for (const [hm, v] of Object.entries(day.minutes)) {
    if (hm < day.start) continue;
    s += v.s; pv += v.pv;
  }
  const last = site.lastFetch;
  const to = !last ? day.start : last.date === date ? last.hm : last.date > date ? "23:59" : day.start;
  const gapMin = day.gaps.reduce((a, g) => a + (toAbs(date, g.to) - toAbs(date, g.from) + 1), 0);
  return { s, pv, from: day.start, to, gaps: day.gaps.map((g) => ({ ...g })), gapMin };
}

/**
 * その日の分ごとの積み上げを時間帯 24 本に足す。積み上げが無ければ null。
 * ★未取得の時間帯は seen=false（0 と「来ていない」を混ぜない）。
 */
export function hoursOfDay(state, siteKey, date) {
  const sum = summarize(state, siteKey, date);
  if (!sum) return null;
  const day = state.sites[siteKey].days[date];
  const hours = Array(24).fill(0);
  const pv = Array(24).fill(0);
  const seen = Array(24).fill(false);
  for (const [hm, v] of Object.entries(day.minutes)) {
    if (hm < day.start) continue;
    const h = Number(hm.slice(0, 2));
    if (!Number.isInteger(h) || h < 0 || h > 23) continue;
    hours[h] += v.s;
    pv[h] += v.pv;
    seen[h] = true;
  }
  // summarize の pv（日合計の数）が配列を上書きしないよう、時間帯は hourPv
  return { ...sum, hours, hourPv: pv, seen };
}

/**
 * Realtime API の応答（次元 minutesAgo・eventName、指標 eventCount）を applyFetch の rows にする。
 * ★minutesAgo は "00"〜"29" の文字列で返る。件数 0 の分は行ごと返らない。
 */
export function rowsFromRealtime(resp) {
  const by = new Map();
  for (const r of resp?.rows ?? []) {
    const ago = Number(r.dimensionValues?.[0]?.value);
    const field = EVENTS[r.dimensionValues?.[1]?.value];
    if (!Number.isInteger(ago) || !field) continue;
    const cur = by.get(ago) ?? { minutesAgo: ago, s: 0, pv: 0 };
    cur[field] += Number(r.metricValues?.[0]?.value) || 0;
    by.set(ago, cur);
  }
  return [...by.values()].sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/**
 * 司令塔の見張り（keiri-commander tools/ga_rt_sample.mjs・10分ごと。logs/ga-rt/<日付>.json）の分ごとの値で、
 * その日の積み上げを置き換えた写しを返す（2026-10-21 Masahiro「見張りのやつ…そっちで数字変えて欲しい」）。
 * 10-19 は GA4 の確定 sessions 2,768 に対し、見張り 2,776・この積み上げ 2,868（11時台・14時台・20時台の
 * 30分ずつが多い。1分ごとの取得のどれかで分の割り当てがずれ、最大値で残った）。見張りは欠けの無い日で確定値と ±0.5%。
 * 置き換えるのは見張りの取得の窓（各取得時刻の 29分前〜その分）に入った分だけ。窓の分は見張りの値（無ければ 0）、
 * 窓の外（見張りの最後の取得より後など）は今の積み上げのまま。保存はしない（rt-accum.json は書き換えない）。
 */
export function overlaySampler(state, siteKey, date, sampler) {
  const next = normalizeState(state);
  const day = next.sites?.[siteKey]?.days?.[date];
  if (!day || !sampler || sampler.date !== date || !Array.isArray(sampler.fetches)) return next;
  const covered = new Set();
  for (const f of sampler.fetches) {
    const T = toAbs(date, f);
    for (let a = T - (WINDOW_MIN - 1); a <= T; a++) {
      const p = fromAbs(a);
      if (p.date === date) covered.add(p.hm);
    }
  }
  const sm = sampler.minutes || {};
  for (const hm of covered) {
    if (hm < day.start) continue;
    const v = sm[hm];
    day.minutes[hm] = { s: Math.max(0, Number(v?.ss) || 0), pv: Math.max(0, Number(v?.pv) || 0) };
  }
  // 見張りが埋めた分は欠けではない
  day.gaps = day.gaps.flatMap((g) => {
    const out = []; let from = null;
    for (let a = toAbs(date, g.from); a <= toAbs(date, g.to); a++) {
      const hm = fromAbs(a).hm;
      if (covered.has(hm)) { if (from) { out.push({ from, to: fromAbs(a - 1).hm }); from = null; } }
      else if (!from) from = hm;
    }
    if (from) out.push({ from, to: g.to });
    return out;
  });
  next.sampler = { ...(next.sampler || {}), [siteKey]: { date, last: sampler.fetches.at(-1) || null, minutes: covered.size } };
  return next;
}

/**
 * 司令塔の見張り（logs/ga-rt/<日付>.json）1日分だけから、時間帯 24 本と「HH:MM までの累計」を出す（前日・先週同曜日の比較用）。
 * 2026-10-22 Masahiro「こっちのリアルタイムの方にも前日・前週のやつだせる？」。
 * ★見張りの取得窓（各取得の直前 WINDOW_MIN 分）に入らなかった分は数えない。その時間帯は seen=false（0 と混ぜない）。
 * ★cumTo(hm) は 00:00〜hm の窓が全部見張りで埋まっているときだけ数を返す。欠けがあれば null（比べない）。
 * @returns {{date:string, hours:number[], hourPv:number[], seen:boolean[], cumTo:(hm:string)=>number|null}|null}
 */
export function samplerHours(sampler, date) {
  if (!sampler || sampler.date !== date || !Array.isArray(sampler.fetches) || !sampler.fetches.length) return null;
  const covered = new Set();
  for (const f of sampler.fetches) {
    const T = toAbs(date, f);
    for (let a = T - (WINDOW_MIN - 1); a <= T; a++) {
      const p = fromAbs(a);
      if (p.date === date) covered.add(p.hm);
    }
  }
  const sm = sampler.minutes || {};
  const hours = Array(24).fill(0), hourPv = Array(24).fill(0), seenMin = Array(24).fill(0);
  for (const hm of covered) {
    const h = Number(hm.slice(0, 2));
    hours[h] += Math.max(0, Number(sm[hm]?.ss) || 0);
    hourPv[h] += Math.max(0, Number(sm[hm]?.pv) || 0);
    seenMin[h]++;
  }
  // 時間帯の半分以上が見張りの窓に入っていれば描く（端の数分の欠けで1時間ぶんを消さない）
  const seen = seenMin.map((n) => n >= 30);
  const cumTo = (hm) => {
    let s = 0;
    for (let a = toAbs(date, "00:00"); a <= toAbs(date, hm); a++) {
      const m = fromAbs(a).hm;
      if (!covered.has(m)) return null;
      s += Math.max(0, Number(sm[m]?.ss) || 0);
    }
    return s;
  };
  return { date, hours, hourPv, seen, cumTo };
}
