import assert from "node:assert";
import {
  todayJst, parseMemos, addMemo, removeMemo, isRevisit, sortByNext, daysUntil,
} from "../docs/assets/tool_memo.js";

/* ---- parseMemos: 壊れた保存で計算を巻き添えにしない ---- */
assert.deepEqual(parseMemos(null), []);
assert.deepEqual(parseMemos(""), []);
assert.deepEqual(parseMemos("{壊れたJSON"), []);
assert.deepEqual(parseMemos('{"a":1}'), []);            // 配列でない
assert.deepEqual(parseMemos('[null,3,"x"]'), []);       // オブジェクトでない要素は落とす
assert.deepEqual(parseMemos('[{"hire":""}]'), []);      // hire が空は無効
assert.equal(parseMemos('[{"hire":"2025-04-01"}]').length, 1);

/* ---- addMemo: 同じ条件を増やさない・新しいものが先頭・上限で切る ---- */
const a = { hire: "2025-04-01", wdays: 5, whours: 40, savedAt: "2026-09-08" };
const b = { hire: "2024-10-01", wdays: 3, whours: 20, savedAt: "2026-09-08" };
assert.equal(addMemo([], a).length, 1);
assert.equal(addMemo([a], b)[0].hire, "2024-10-01");     // 新しいものが先頭
assert.equal(addMemo([a], b).length, 2);
assert.equal(addMemo([a], { ...a, savedAt: "2026-09-09" }).length, 1); // 同条件は重複しない
assert.equal(addMemo([a], { ...a, savedAt: "2026-09-09" })[0].savedAt, "2026-09-09"); // 上書きされる
// 型が違っても同条件とみなす（select の value は文字列で返る）
assert.equal(addMemo([a], { ...a, wdays: "5", whours: "40" }).length, 1);
assert.equal(addMemo(Array.from({ length: 30 }, (_, i) => ({ ...a, hire: `2020-01-${String(i % 28 + 1).padStart(2, "0")}` })), b, 30).length, 30);

/* ---- removeMemo ---- */
assert.deepEqual(removeMemo([a, b], 0), [b]);
assert.deepEqual(removeMemo([a, b], 1), [a]);
assert.deepEqual(removeMemo([a], 5), [a]);               // 範囲外は何も消さない

/* ---- isRevisit: ここが実験の計器。同日は false、別日だけ true ---- */
assert.equal(isRevisit([], "2026-09-08"), false);                                   // 保存が無い
assert.equal(isRevisit([{ hire: "x", savedAt: "2026-09-08" }], "2026-09-08"), false); // 同日
assert.equal(isRevisit([{ hire: "x", savedAt: "2026-09-07" }], "2026-09-08"), true);  // 別日
// 複数あるときは「最後に保存した日」で判定する（古い1件で誤って鳴らさない）
assert.equal(isRevisit([{ hire: "x", savedAt: "2026-09-01" }, { hire: "y", savedAt: "2026-09-08" }], "2026-09-08"), false);
assert.equal(isRevisit([{ hire: "x", savedAt: "2026-09-01" }, { hire: "y", savedAt: "2026-09-05" }], "2026-09-08"), true);
assert.equal(isRevisit([{ hire: "x" }], "2026-09-08"), false);                        // savedAt が無い＝鳴らさない
// 未来日（端末の時計がずれている）でも鳴らさない
assert.equal(isRevisit([{ hire: "x", savedAt: "2026-09-30" }], "2026-09-08"), false);

/* ---- sortByNext: 近い順・日付なしは末尾・同着は元の順 ---- */
const list = [{ hire: "A" }, { hire: "B" }, { hire: "C" }, { hire: "D" }];
const next = { A: "2026-10-01", B: "2026-09-10", C: "", D: "2026-10-01" };
assert.deepEqual(sortByNext(list, (m) => next[m.hire]).map((m) => m.hire), ["B", "A", "D", "C"]);

/* ---- daysUntil: 日付をまたぐ計算はUTC固定で行う（JSTの朝にずれない） ---- */
assert.equal(daysUntil("2026-09-10", "2026-09-08"), 2);
assert.equal(daysUntil("2026-09-08", "2026-09-08"), 0);
assert.equal(daysUntil("2026-09-01", "2026-09-08"), -7);
assert.equal(daysUntil("2027-01-01", "2026-12-31"), 1);   // 年またぎ
assert.equal(daysUntil("2028-03-01", "2028-02-28"), 2);   // うるう年（2028-02-29 を挟む）
assert.equal(daysUntil("bad", "2026-09-08"), null);

/* ---- todayJst: UTC ではなく JST を返す ---- */
// 2026-09-08 15:30 UTC = 2026-09-09 00:30 JST。UTC実装だと 09-08 になり、ここで落ちる
assert.equal(todayJst(new Date("2026-09-08T15:30:00Z")), "2026-09-09");
assert.equal(todayJst(new Date("2026-09-08T14:59:00Z")), "2026-09-08");

console.log("✓ test_tool_memo");
