import assert from "node:assert";
import {
  grantDays, needsFiveDays, schedule, stageIndex, FULL_TABLE, PRO_TABLE,
  addMonthsClamped, currentGrant, elapsedMonths, todayISO,
} from "../docs/assets/yukyu_core.js";

// 一般労働者(週5日): 労基法39条の表どおり
assert.equal(grantDays(0.5, 5, 40).days, 10);
assert.equal(grantDays(1.5, 5, 40).days, 11);
assert.equal(grantDays(2.5, 5, 40).days, 12);
assert.equal(grantDays(3.5, 5, 40).days, 14);
assert.equal(grantDays(4.5, 5, 40).days, 16);
assert.equal(grantDays(5.5, 5, 40).days, 18);
assert.equal(grantDays(6.5, 5, 40).days, 20);
assert.equal(grantDays(10, 5, 40).days, 20);   // 6.5年以降は20日で頭打ち
assert.equal(grantDays(0.4, 5, 40).days, 0);   // 6ヶ月未満は付与なし

// 週30時間以上なら週4日でも「一般労働者」扱い(重要な判定)
assert.equal(grantDays(0.5, 4, 32).days, 10);
assert.equal(grantDays(0.5, 4, 32).type, "full");
// 週30時間未満・週4日 → 比例付与
assert.equal(grantDays(0.5, 4, 28).days, 7);
assert.equal(grantDays(0.5, 4, 28).type, "proportional");

// 比例付与の表(週3日・週1日)
assert.equal(grantDays(0.5, 3, 20).days, 5);
assert.equal(grantDays(6.5, 3, 20).days, 11);
assert.equal(grantDays(0.5, 1, 6).days, 1);
assert.equal(grantDays(6.5, 1, 6).days, 3);
assert.equal(grantDays(6.5, 2, 12).days, 7);

// 年5日の時季指定義務は「10日以上付与」が対象
assert.equal(needsFiveDays(10), true);
assert.equal(needsFiveDays(9), false);
// 比例付与でも10日以上なら対象(週4日・3.5年で10日)
assert.equal(grantDays(3.5, 4, 28).days, 10);
assert.equal(needsFiveDays(grantDays(3.5, 4, 28).days), true);

// 付与スケジュール: 入社6ヶ月後が初回
{
  const rows = schedule("2026-04-01", 5, 40, 3);
  assert.equal(rows[0].date, "2026-10-01");
  assert.equal(rows[0].days, 10);
  assert.equal(rows[0].mustTakeFive, true);
  assert.equal(rows[1].date, "2027-10-01");
  assert.equal(rows[1].days, 11);
}
// 段階インデックス
assert.equal(stageIndex(0.4), -1);
assert.equal(stageIndex(0.5), 0);
assert.equal(stageIndex(6.5), 6);
assert.equal(stageIndex(20), 6);

// ─────────────────────────────────────────────────────────────────────────────
// 月末入社の付与日（2026-07-13に実バグ。修正前は「2/31」がJSの繰り越しで3/3になっていた）
//
// 正: 応当する日がない月は**その月の末日**（民法143条2項ただし書き）。
//     8/31入社 → 2/28（閏年2/29） / 10/31入社 → 4/30 / 3/31入社 → 9/30
// 誤: JSの new Date(y, m+6, 31) は存在しない日を翌月へ繰り越す → 法定より**遅い**付与日になる
//     （＝年5日の取得義務の起算も遅れる。危険side）
// ─────────────────────────────────────────────────────────────────────────────
assert.deepEqual(addMonthsClamped("2026-08-31", 6), { date: "2027-02-28", clamped: true });
assert.deepEqual(addMonthsClamped("2027-08-31", 6), { date: "2028-02-29", clamped: true }); // 閏年
assert.deepEqual(addMonthsClamped("2026-08-30", 6), { date: "2027-02-28", clamped: true });
assert.deepEqual(addMonthsClamped("2026-08-29", 6), { date: "2027-02-28", clamped: true });
assert.deepEqual(addMonthsClamped("2026-10-31", 6), { date: "2027-04-30", clamped: true });
assert.deepEqual(addMonthsClamped("2026-03-31", 6), { date: "2026-09-30", clamped: true });
assert.deepEqual(addMonthsClamped("2026-04-01", 6), { date: "2026-10-01", clamped: false }); // 通常
assert.deepEqual(addMonthsClamped("2026-08-31", 18), { date: "2028-02-29", clamped: true });

// 独立オラクル: 全ての「31日入社」×全12ヶ月 → 付与日は必ず「6ヶ月後の月の末日」に収まる。
// （ここでは addMonthsClamped を使わず、月の日数を素朴に数え直して照合する）
const DAYS_IN = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
  31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
for (let year = 2026; year <= 2030; year++) {
  for (let m = 1; m <= 12; m++) {
    for (const day of [28, 29, 30, 31]) {
      if (day > DAYS_IN(year, m)) continue;
      const hire = `${year}-${String(m).padStart(2, "0")}-${day}`;
      const got = addMonthsClamped(hire, 6);
      const tm = ((m - 1 + 6) % 12) + 1;
      const ty = year + Math.floor((m - 1 + 6) / 12);
      const expectDay = Math.min(day, DAYS_IN(ty, tm));   // 応当日が無ければ末日
      const want = `${ty}-${String(tm).padStart(2, "0")}-${String(expectDay).padStart(2, "0")}`;
      assert.equal(got.date, want, `${hire} の6ヶ月後: ${got.date} ≠ ${want}`);
      // 付与日が入社日の翌月へ繰り越していないこと（＝バグの再発検知）
      assert.equal(got.date.slice(0, 7), `${ty}-${String(tm).padStart(2, "0")}`,
        `${hire}: 付与日が${tm}月から外へ繰り越した (${got.date})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 見出しと表が矛盾しないこと（修正前は月末入社で「10日付与済み」と「初回付与は予定」を同時表示）
// 不変条件: currentGrant.days は必ず「今日までに来た付与日」の行の日数と一致する
// ─────────────────────────────────────────────────────────────────────────────
for (const hire of ["2026-04-01", "2026-08-31", "2026-10-31", "2026-02-28", "2026-12-31"]) {
  for (const today of ["2026-09-30", "2027-02-28", "2027-03-01", "2027-04-30", "2030-06-15"]) {
    const g = currentGrant(hire, 5, 40, today);
    const past = g.rows.filter((r) => r.date <= today);
    const lastPast = past.length ? past[past.length - 1] : null;
    if (lastPast) assert.equal(g.days, lastPast.days, `${hire}/${today}: 見出し${g.days}日 vs 表${lastPast.days}日`);
    if (g.next) assert.ok(g.next.date > today, `${hire}/${today}: 次回付与が過去`);
    // 「0日」なら表に「今日までに来た付与日」が1行も無いこと
    if (g.days === 0) assert.equal(past.length, 0, `${hire}/${today}: 0日なのに付与済みの行がある`);
  }
}

// 付与日「当日」に、その日の付与が反映されること（タイムゾーンで狂わない）
// 修正前: 表側が new Date("2026-10-01") を使っており、JST(+9)では当日 00:00〜09:00 が
//         「まだ来ていない（予定）」と判定されていた（見出しは付与済みと表示 → 矛盾）
{
  const g = currentGrant("2026-04-01", 5, 40, "2026-10-01"); // 付与日ちょうど
  assert.equal(g.days, 10, "付与日当日に10日が付与されていない");
  assert.equal(g.grantDate, "2026-10-01");
  assert.equal(g.rows[0].date <= "2026-10-01", true, "付与日当日の行が「予定」のまま");
  const prev = currentGrant("2026-04-01", 5, 40, "2026-09-30"); // 前日は0日
  assert.equal(prev.days, 0);
}
// 月末入社でも当日に反映される
{
  const g = currentGrant("2026-08-31", 5, 40, "2027-02-28");
  assert.equal(g.days, 10, "8/31入社の初回付与日(2/28)に反映されていない");
  assert.equal(g.grantDate, "2027-02-28");
  assert.equal(currentGrant("2026-08-31", 5, 40, "2027-02-27").days, 0);
  assert.equal(g.clamped, true, "末日に丸めたことを申告していない");
}

// 勤続月数（末日クランプと整合）
assert.equal(elapsedMonths("2026-04-01", "2026-10-01"), 6);
assert.equal(elapsedMonths("2026-04-01", "2026-09-30"), 5);
assert.equal(elapsedMonths("2026-08-31", "2027-02-28"), 6);   // 応当日が無い月は末日で到達
assert.equal(elapsedMonths("2026-08-31", "2027-02-27"), 5);
assert.equal(todayISO(new Date(2026, 0, 5)), "2026-01-05");   // ゼロ埋め

// 長期勤続でも「次回の付与」が必ず出る（旧実装は8行固定で、7.5年超は次回が消えていた）
{
  const g = currentGrant("2000-04-01", 5, 40, "2026-07-13");
  assert.equal(g.days, 20);
  assert.ok(g.next, "長期勤続で次回の付与日が出ていない");
  assert.equal(g.next.date, "2026-10-01");
  assert.ok(g.rows.length <= 8, "表が8行を超えている");
}

console.log("all yukyu_core tests passed");
