import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  lastDayOfMonth, resolveDay, isBankHoliday, adjustBusinessDay, schedule,
} from "../docs/assets/payday_core.js";

const HOLIDAYS = JSON.parse(
  readFileSync(new URL("../docs/assets/holidays_jp.json", import.meta.url)));

// 月末日
assert.equal(lastDayOfMonth(2026, 2), 28);
assert.equal(lastDayOfMonth(2028, 2), 29); // 閏年
assert.equal(resolveDay(2026, 2, 30), 28); // 30日締めの2月

// 銀行休業日: 土日・祝・年末年始
assert.equal(isBankHoliday(2026, 7, 11, HOLIDAYS), true);  // 土
assert.equal(isBankHoliday(2026, 7, 13, HOLIDAYS), false); // 月
assert.equal(isBankHoliday(2026, 7, 20, HOLIDAYS), true);  // 海の日(祝)
assert.equal(isBankHoliday(2026, 12, 31, HOLIDAYS), true);
assert.equal(isBankHoliday(2027, 1, 2, HOLIDAYS), true);

// 営業日調整: 2026-08-01(土) -> 前営業日 7/31(金), 翌営業日 8/3(月)
assert.deepEqual(adjustBusinessDay(2026, 8, 1, "prev", HOLIDAYS),
  { y: 2026, m: 7, d: 31, moved: true });
assert.deepEqual(adjustBusinessDay(2026, 8, 1, "next", HOLIDAYS),
  { y: 2026, m: 8, d: 3, moved: true });
// 年末年始またぎ: 2026-12-31 -> 翌営業日は2027-01-04(月)
assert.deepEqual(adjustBusinessDay(2026, 12, 31, "next", HOLIDAYS),
  { y: 2027, m: 1, d: 4, moved: true });

// 月末締め翌月末払い(前営業日調整): 2026年7月分 -> 締め7/31, 支払8/31(月・平日)
let rows = schedule({ closing: "末", offsetMonths: 1, payday: "末", adjust: "prev" },
  2026, 7, 3, HOLIDAYS);
assert.equal(rows[0].periodFrom, "2026-07-01");
assert.equal(rows[0].periodTo, "2026-07-31");
assert.equal(rows[0].payIso, "2026-08-31");
// 8月分 -> 支払9/30(水)
assert.equal(rows[1].payIso, "2026-09-30");
// 9月分 -> 支払10/31(土) -> 前営業日10/30(金)
assert.equal(rows[2].rawPayIso, "2026-10-31");
assert.equal(rows[2].payIso, "2026-10-30");
assert.equal(rows[2].moved, true);

// 20日締め翌月10日払い: 2026年8月分 -> 締め期間7/21〜8/20, 支払9/10(木)
rows = schedule({ closing: 20, offsetMonths: 1, payday: 10, adjust: "prev" },
  2026, 8, 1, HOLIDAYS);
assert.equal(rows[0].periodFrom, "2026-07-21");
assert.equal(rows[0].periodTo, "2026-08-20");
assert.equal(rows[0].payIso, "2026-09-10");

// 月末締め翌々月5日払い: 2026年10月分 -> 支払12/5(土) -> 前営業日12/4(金)
rows = schedule({ closing: "末", offsetMonths: 2, payday: 5, adjust: "prev" },
  2026, 10, 1, HOLIDAYS);
assert.equal(rows[0].rawPayIso, "2026-12-05");
assert.equal(rows[0].payIso, "2026-12-04");

// 12月末締め翌月4日払いの年始調整: 支払2027-01-04(月,平日) は移動なし
rows = schedule({ closing: "末", offsetMonths: 1, payday: 4, adjust: "next" },
  2026, 12, 1, HOLIDAYS);
assert.equal(rows[0].payIso, "2027-01-04");
assert.equal(rows[0].moved, false);

console.log("all payday_core tests passed");
