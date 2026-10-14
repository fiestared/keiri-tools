// test-rt-accum.mjs — 速報（Realtime の積み上げ）の純ロジックの検査。依存ゼロ。
//   node ga-dashboard/test-rt-accum.mjs
//
// ★「通るべきものが通る」と「落ちるべきものが落ちる」を両方見る。
//   後半の壊しテストは、間違った実装（加算する・0時またぎを当日に入れる・欠けを見ない・古い日を捨てない）を
//   同じ入力に通し、正しい期待値と一致しないことを確かめる。期待値が緩くて何でも通る検査になっていないかの確認。
import assert from "node:assert/strict";
import {
  applyFetch, summarize, hoursOfDay, emptyState, normalizeState, rowsFromRealtime, toAbs, fromAbs,
  WINDOW_MIN, GAP_MIN, KEEP_DAYS,
} from "./rt-accum.mjs";

const K = "site";
const at = (date, hm) => ({ date, hm });
const run = (fetches, st = emptyState()) => fetches.reduce((s, [a, rows]) => applyFetch(s, K, a, rows), st);

// ---- 時刻の換算（JST の壁時計を文字列のまま扱う） ----
assert.deepEqual(fromAbs(toAbs("2026-10-12", "00:05") - 10), { date: "2026-10-11", hm: "23:55" });
assert.deepEqual(fromAbs(toAbs("2026-12-31", "23:59") + 1), { date: "2027-01-01", hm: "00:00" });
assert.deepEqual(fromAbs(toAbs("2026-03-01", "00:00") - 1), { date: "2026-02-28", hm: "23:59" });
assert.equal(WINDOW_MIN, 30); assert.equal(GAP_MIN, 30); assert.equal(KEEP_DAYS, 3);

// ---- 1. 同じ分は最大値で上書き（加算しない） ----
// 14:10 の分を 14:10（途中 2件）→ 14:11（3件）→ 14:12（3件）と3回見る。正しい答えは 3
const sameMinute = [
  [at("2026-10-12", "14:10"), [{ minutesAgo: 0, s: 2, pv: 2 }]],
  [at("2026-10-12", "14:11"), [{ minutesAgo: 1, s: 3, pv: 4 }, { minutesAgo: 0, s: 1, pv: 1 }]],
  [at("2026-10-12", "14:12"), [{ minutesAgo: 2, s: 3, pv: 4 }, { minutesAgo: 1, s: 1, pv: 2 }]],
];
{
  const st = run(sameMinute);
  assert.deepEqual(st.sites[K].days["2026-10-12"].minutes["14:10"], { s: 3, pv: 4 });
  assert.deepEqual(st.sites[K].days["2026-10-12"].minutes["14:11"], { s: 1, pv: 2 });
  const sum = summarize(st, K, "2026-10-12");
  assert.equal(sum.s, 4); assert.equal(sum.pv, 6);
  assert.equal(sum.from, "13:41");   // 最初の取得 14:10 − 29分
  assert.equal(sum.to, "14:12");
  assert.deepEqual(sum.gaps, []);
  {
    const h = hoursOfDay(st, K, "2026-10-12");
    assert.equal(h.hours[14], 4); assert.equal(h.hourPv[14], 6); assert.equal(h.seen[14], true);
    assert.equal(h.seen[12], false); assert.equal(h.hours[12], 0);
    assert.equal(h.s, 4); assert.equal(h.pv, 6);
    assert.equal(typeof h.pv, "number"); assert.equal(Array.isArray(h.hourPv), true);
  }
  // 後の回で値が小さく返っても減らさない（Realtime は遅れて増えることはあっても、見た最大値を保つ）
  const st2 = applyFetch(st, K, at("2026-10-12", "14:13"), [{ minutesAgo: 3, s: 1, pv: 1 }]);
  assert.deepEqual(st2.sites[K].days["2026-10-12"].minutes["14:10"], { s: 3, pv: 4 });
  // 元の state を書き換えていない
  assert.equal(st.sites[K].lastFetch.hm, "14:12");
}

// ---- 2. 0時またぎは前日の日付に入れる ----
const midnight = [
  [at("2026-10-12", "23:50"), [{ minutesAgo: 0, s: 1, pv: 1 }]],
  [at("2026-10-13", "00:05"), [
    { minutesAgo: 0, s: 2, pv: 2 },    // 00:05 → 13日
    { minutesAgo: 5, s: 4, pv: 5 },    // 00:00 → 13日
    { minutesAgo: 6, s: 7, pv: 8 },    // 23:59 → 12日
    { minutesAgo: 15, s: 1, pv: 3 },   // 23:50 → 12日（同じ分・最大値）
  ]],
];
{
  const st = run(midnight);
  const d12 = summarize(st, K, "2026-10-12"), d13 = summarize(st, K, "2026-10-13");
  assert.equal(d12.s, 8); assert.equal(d12.pv, 11);   // 23:50 の 1 と 23:59 の 7
  assert.equal(d13.s, 6); assert.equal(d13.pv, 7);
  assert.equal(d13.from, "00:00");   // 途切れずに日付が変わった日は 0:00 から
  assert.equal(d13.to, "00:05");
  assert.equal(d12.to, "23:59");     // 過ぎた日は 23:59 まで
  assert.equal(d12.from, "23:21");
  assert.deepEqual(d12.gaps, []); assert.deepEqual(d13.gaps, []);
}

// ---- 3. 欠けの検出 ----
{
  // 29分あき: 前回の分（10:00）は今回の minutesAgo=29 でまだ取れる → 欠けなし
  const ok = run([[at("2026-10-12", "10:00"), []], [at("2026-10-12", "10:29"), []]]);
  assert.deepEqual(summarize(ok, K, "2026-10-12").gaps, []);
  // 30分あき: 前回の分（10:00）は途中の値のまま窓から落ちた → 10:00 の1分が欠け
  const edge = run([[at("2026-10-12", "10:00"), []], [at("2026-10-12", "10:30"), []]]);
  assert.deepEqual(summarize(edge, K, "2026-10-12").gaps, [{ from: "10:00", to: "10:00" }]);
  assert.equal(summarize(edge, K, "2026-10-12").gapMin, 1);
  // 2時間あき: 10:00〜11:30 が欠け（今回の窓は 11:31〜12:00）
  const big = run([[at("2026-10-12", "10:00"), []], [at("2026-10-12", "12:00"), []]]);
  const s = summarize(big, K, "2026-10-12");
  assert.deepEqual(s.gaps, [{ from: "10:00", to: "11:30" }]);
  assert.equal(s.gapMin, 91);
  assert.equal(s.from, "09:31");
  // 欠けが2回あれば2区間
  const two = run([[at("2026-10-12", "13:00"), []], [at("2026-10-12", "15:00"), []]], big);
  assert.deepEqual(summarize(two, K, "2026-10-12").gaps, [{ from: "10:00", to: "11:30" }, { from: "12:00", to: "12:30" }, { from: "13:00", to: "14:30" }]);
  // 夜をまたいで止まった: 前日は 23:00〜23:59 が欠け。当日は「始めた時刻」が 07:31 になる（欠けとしては出さない）
  const night = run([[at("2026-10-12", "23:00"), []], [at("2026-10-13", "08:00"), []]]);
  assert.deepEqual(summarize(night, K, "2026-10-12").gaps, [{ from: "23:00", to: "23:59" }]);
  assert.equal(summarize(night, K, "2026-10-13").from, "07:31");
  assert.deepEqual(summarize(night, K, "2026-10-13").gaps, []);
  // 同じ分に2回走っても欠けは出ない。時計が戻っても lastFetch は戻さない
  const twice = run([[at("2026-10-12", "10:00"), []], [at("2026-10-12", "10:00"), []], [at("2026-10-12", "09:50"), []]]);
  assert.deepEqual(summarize(twice, K, "2026-10-12").gaps, []);
  assert.equal(twice.sites[K].lastFetch.hm, "10:00");
}

// ---- 4. 直近3日だけ持つ ----
const fourDays = ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"].map((d) => [at(d, "12:00"), [{ minutesAgo: 1, s: 1, pv: 1 }]]);
{
  const st = run(fourDays);
  assert.deepEqual(Object.keys(st.sites[K].days).sort(), ["2026-10-11", "2026-10-12", "2026-10-13"]);
  assert.equal(summarize(st, K, "2026-10-10"), null);
  assert.equal(summarize(st, K, "2026-10-12").s, 1);
}

// ---- 5. サイトは別々に積む。無い日・無いサイトは null ----
{
  let st = applyFetch(emptyState(), "a", at("2026-10-12", "09:00"), [{ minutesAgo: 0, s: 5, pv: 6 }]);
  st = applyFetch(st, "b", at("2026-10-12", "09:00"), [{ minutesAgo: 0, s: 1, pv: 1 }]);
  assert.equal(summarize(st, "a", "2026-10-12").s, 5);
  assert.equal(summarize(st, "b", "2026-10-12").s, 1);
  assert.equal(summarize(st, "c", "2026-10-12"), null);
  assert.equal(summarize(st, "a", "2026-10-11"), null);
  assert.equal(summarize(null, "a", "2026-10-12"), null);
}

// ---- 6. 壊れた保存データでも落ちない ----
for (const bad of [null, undefined, 1, "x", [], {}, { sites: [] }, { sites: { [K]: null } }, { sites: { [K]: { days: { "bad": {} }, lastFetch: { date: "x" } } } },
  { sites: { [K]: { lastFetch: { date: "2026-10-12", hm: "10:00" }, days: { "2026-10-12": { start: "nope", minutes: { "10:00": { s: "x" } } } } } } }]) {
  const st = applyFetch(normalizeState(bad), K, at("2026-10-12", "14:00"), [{ minutesAgo: 0, s: 1, pv: 1 }, { minutesAgo: 99, s: 9, pv: 9 }, { minutesAgo: "x", s: 9, pv: 9 }]);
  const s = summarize(st, K, "2026-10-12");
  assert.equal(s.s, 1);              // 範囲外・数でない minutesAgo は数えない
  assert.equal(s.from, "13:31");
  assert.deepEqual(s.gaps, []);      // 読めなかった保存データから欠けを作らない
}

// ---- 7. Realtime API の応答の読み取り ----
{
  const resp = { rows: [
    { dimensionValues: [{ value: "08" }, { value: "page_view" }], metricValues: [{ value: "3" }] },
    { dimensionValues: [{ value: "08" }, { value: "session_start" }], metricValues: [{ value: "2" }] },
    { dimensionValues: [{ value: "00" }, { value: "page_view" }], metricValues: [{ value: "1" }] },
    { dimensionValues: [{ value: "03" }, { value: "scroll" }], metricValues: [{ value: "9" }] },   // 対象外のイベント
  ] };
  assert.deepEqual(rowsFromRealtime(resp), [{ minutesAgo: 0, s: 0, pv: 1 }, { minutesAgo: 8, s: 2, pv: 3 }]);
  assert.deepEqual(rowsFromRealtime({}), []);
  assert.deepEqual(rowsFromRealtime(null), []);
}

// ---- 壊しテスト: 間違った実装は、上と同じ入力で正しい期待値にならない ----
// 先に無傷が緑であること（上の 1〜4 が通っていること）を前提にしている。ここへ来た時点で無傷は緑。
{
  // (a) 最大値でなく加算する実装 → 同じ分を3回見ると 2+3+3=8 になり、正解 3 と食い違う
  const addInstead = (fetches) => {
    const m = {};
    for (const [a, rows] of fetches) for (const r of rows) {
      const k = fromAbs(toAbs(a.date, a.hm) - r.minutesAgo);
      m[`${k.date} ${k.hm}`] = (m[`${k.date} ${k.hm}`] ?? 0) + r.s;
    }
    return m;
  };
  const wrong = addInstead(sameMinute)["2026-10-12 14:10"];
  assert.equal(wrong, 8);
  assert.notEqual(wrong, run(sameMinute).sites[K].days["2026-10-12"].minutes["14:10"].s);

  // (b) 0時またぎを取得日の日付に入れる実装 → 13日が 6 ではなく 14 になる
  const sameDay = (fetches, date) => {
    const m = {};
    for (const [a, rows] of fetches) for (const r of rows) {
      if (a.date !== date) continue;
      const hm = fromAbs(toAbs(a.date, a.hm) - r.minutesAgo).hm;
      m[hm] = Math.max(m[hm] ?? 0, r.s);
    }
    return Object.values(m).reduce((x, y) => x + y, 0);
  };
  assert.equal(sameDay(midnight, "2026-10-13"), 14);
  assert.notEqual(sameDay(midnight, "2026-10-13"), summarize(run(midnight), K, "2026-10-13").s);

  // (c) 欠けを見ない実装（gaps を常に空で返す）なら、2時間あきの期待値と食い違う
  const big = run([[at("2026-10-12", "10:00"), []], [at("2026-10-12", "12:00"), []]]);
  assert.notDeepEqual([], summarize(big, K, "2026-10-12").gaps);
  // 境界を 31 分にずらした実装は 3 の edge（30分あき＝10:00 の1分が欠け）で落ちる。
  // 29 分にずらしても結果は変わらない（29分あきでは欠けの区間が空になる）ので、検査では区別しない。
  // ★rt-accum.mjs そのものを書き換えた確認（2026-10-12）: 加算・0時またぎを当日へ・欠けを見ない・境界31・捨てない・4日持つ
  //   の6通りで、この検査は全部赤になった。

  // (d) 古い日を捨てない実装なら 4日ぶん残る
  const keepAll = new Set(fourDays.map(([a]) => a.date));
  assert.equal(keepAll.size, 4);
  assert.notEqual(keepAll.size, Object.keys(run(fourDays).sites[K].days).length);
}

console.log("PASS: rt-accum（最大値で上書き・0時またぎ・欠けの検出・3日で捨てる・壊れた保存データ・応答の読み取り・壊しテスト）");
