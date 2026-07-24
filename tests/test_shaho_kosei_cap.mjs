/**
 * 厚生年金の標準報酬月額の上限(KOSEI_MAX)が「黙って腐らない」ようにする検査。
 *
 * ■ なぜ要るか(2026-07-25 第2便・4時=改正修正枠の水平展開で発見)
 *   07-24第7便の実害は「基準額をコードに直書きし、改正で動いたのに誰も気づかない」型だった
 *   (genka_core.js の `if (cost < 300000)`)。同じ型を全コアで洗ったところ、
 *   shaho_core.js の KOSEI_MAX = 650000 が**コードに直書き・データ結合なし・期限の記載なし**で残っていた。
 *
 *   そして厚生年金の上限は**既に立法済みで、段階的に上がることが決まっている**:
 *     現在        第32級 650,000円  (20条2項の政令改定で本則の上に追加)
 *     2027-09-01  第33級 680,000円
 *     2028-09-01  第34級 710,000円
 *     2029-09-01  第35級 750,000円
 *   根拠: 厚生年金保険法20条1項の等級表 / 令和七年法律第七十四号。
 *   e-Gov法令API v2 の law_revisions で未施行版を特定し、各版の20条を逐語抽出して確認済み(2026-07-25)。
 *
 *   今日の答えは正しい(650,000円は現行で正)。**壊れるのは2027-09-01**で、
 *   そのとき報酬月額665,000円以上の人の厚生年金保険料を月2,745円 過少に出す。
 *   → データを正本にし、カナリアで「直す期限」を機械に守らせる。
 *
 * ■ この検査が見るもの
 *   (1) データ⇔コアの結合: JSONの current と KOSEI_MAX/KOSEI_MIN が一致するか
 *   (2) 施行スケジュールが条文どおりか(逐語オラクル。等級・金額・報酬月額の下限)
 *   (3) カナリア: recheck_after を過ぎたら赤くする(＝次の改正修正枠が必ず拾う)
 *   (4) 上限・下限の挙動が実際にその額で頭打ちになるか
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KOSEI_MAX, KOSEI_MIN, KENKO_GRADES, koseiStandard } from "../docs/assets/shaho_core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  fs.readFileSync(path.join(here, "../docs/assets/shaho_rates_r08.json"), "utf8"),
);
const cap = data.kosei_grade_cap;
let n = 0;
const ok = (cond, msg) => {
  n++;
  assert.ok(cond, msg);
};

// ── (1) データ⇔コアの結合 ────────────────────────────────
ok(cap, "shaho_rates_r08.json に kosei_grade_cap が無い");
assert.strictEqual(KOSEI_MAX, cap.current, "KOSEI_MAX とデータの current がずれている");
n++;
assert.strictEqual(KOSEI_MIN, cap.kosei_min, "KOSEI_MIN とデータの kosei_min がずれている");
n++;

// 健保の最高等級もデータと一致していること(等級表はコード側にある)
const last = KENKO_GRADES[KENKO_GRADES.length - 1];
assert.strictEqual(last[0], cap.kenko_max_grade, "健保の最高等級がデータとずれている");
n++;
assert.strictEqual(last[1], cap.kenko_max, "健保の最高標準報酬月額がデータとずれている");
n++;

// 厚年の下限・上限は健保の等級表の実在の額であること(勝手な数ではない)
ok(KENKO_GRADES.some((g) => g[1] === KOSEI_MIN), "KOSEI_MIN が健保等級表に無い額");
ok(KENKO_GRADES.some((g) => g[1] === KOSEI_MAX), "KOSEI_MAX が健保等級表に無い額");

// ── (2) 施行スケジュールの逐語オラクル ──────────────────────
// e-Gov 20条から抜いた値をテスト側に独立に書き下す(データを見ずに書く＝データの写経にしない)
const ORACLE = [
  { from: "2027-09-01", grade: 33, standard: 680000, hoshu_from: 665000 },
  { from: "2028-09-01", grade: 34, standard: 710000, hoshu_from: 695000 },
  { from: "2029-09-01", grade: 35, standard: 750000, hoshu_from: 730000 },
];
assert.strictEqual(cap.scheduled.length, ORACLE.length, "施行スケジュールの件数が違う");
n++;
ORACLE.forEach((want, i) => {
  const got = cap.scheduled[i];
  assert.deepStrictEqual(
    { from: got.from, grade: got.grade, standard: got.standard, hoshu_from: got.hoshu_from },
    want,
    `施行スケジュール[${i}] が条文と違う`,
  );
  n++;
});
// 単調増加であること(等級・金額とも)
cap.scheduled.forEach((s, i) => {
  const prev = i === 0 ? cap.current : cap.scheduled[i - 1].standard;
  ok(s.standard > prev, `scheduled[${i}] の標準報酬月額が前段以下`);
  const prevG = i === 0 ? cap.current_grade : cap.scheduled[i - 1].grade;
  ok(s.grade === prevG + 1, `scheduled[${i}] の等級が連番でない`);
});

// ── (3) カナリア ─────────────────────────────────────────
// recheck_after を過ぎたら赤くする。これが「直し忘れ」を機械に守らせる唯一の仕掛け。
// テスト用の日付シーム: 壊しテストが「施行日を過ぎた世界」を再現するためだけに使う。
// (データの from を過去に書き換える壊し方だと逐語オラクルが先に落ちて、
//  第2カナリアが一度も発火しないまま「捕捉した」と見えてしまう＝規則8)
const today = process.env.SHAHO_CAP_TODAY || new Date().toISOString().slice(0, 10);
ok(
  today < cap.recheck_after,
  `【カナリア】厚生年金の標準報酬月額の上限を確認する期限(${cap.recheck_after})を過ぎた。\n` +
    `  現在のコードは上限 ${cap.current.toLocaleString()}円 で計算している。\n` +
    `  次の施行予定: ${cap.scheduled.map((s) => `${s.from} 第${s.grade}級 ${s.standard.toLocaleString()}円`).join(" / ")}\n` +
    `  → ${path.basename("shaho_rates_r08.json")} の expire_note の3分岐に従って直すこと。`,
);
// 次の施行日そのものも越えていないこと(recheck_after を延ばして誤魔化せないように二重で張る)
const nextFrom = cap.scheduled[0]?.from;
ok(
  !nextFrom || today < nextFrom,
  `【カナリア】${nextFrom} に第${cap.scheduled[0].grade}級 ${cap.scheduled[0].standard.toLocaleString()}円が施行済み。` +
    `KOSEI_MAX が ${cap.current.toLocaleString()}円 のままなので、報酬月額 ${cap.scheduled[0].hoshu_from.toLocaleString()}円 以上の人の` +
    `厚生年金保険料を過少に計算している。`,
);

// ── (4) 挙動 ─────────────────────────────────────────────
assert.strictEqual(koseiStandard(50000), KOSEI_MIN, "下限で頭打ちにならない");
n++;
assert.strictEqual(koseiStandard(KOSEI_MIN), KOSEI_MIN, "下限ちょうど");
n++;
assert.strictEqual(koseiStandard(9_000_000), KOSEI_MAX, "上限で頭打ちにならない");
n++;
// 上限の1つ下の等級は素通しされること(＝キャップが効きすぎていない。規則1の「通るべきものが通る」)
const belowCap = KENKO_GRADES.filter((g) => g[1] < KOSEI_MAX).pop();
assert.strictEqual(
  koseiStandard(belowCap[2] + 1),
  belowCap[1],
  "上限未満の等級までキャップが食い込んでいる",
);
n++;
// 上限に達する報酬月額の境界(現行: 635,000円以上が650,000円)
const capRow = KENKO_GRADES.find((g) => g[1] === KOSEI_MAX);
assert.strictEqual(koseiStandard(capRow[2]), KOSEI_MAX, "上限等級の下端");
n++;
assert.strictEqual(koseiStandard(capRow[2] - 1), belowCap[1], "上限等級の下端の1円下");
n++;

console.log(`✓ test_shaho_kosei_cap: ${n}項目 (次の確認期限 ${cap.recheck_after} / 次の施行 ${nextFrom})`);
