import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  lastDayOfMonth, resolveDay, isBankHoliday, adjustBusinessDay, schedule,
  coverageMaxYear, toICS, icsText,
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

// ── 祝日データの守備範囲(2026-07-13追加) ────────────────────────────────────
// 収録年を超えた日付は「祝日を知らないまま営業日と答える」ため、必ず beyondData で申告する。
// 実害の例: 2028年の祝日が未収録だと 2028-05-05(こどもの日・金)を「振込可」と断言してしまう
assert.equal(coverageMaxYear(HOLIDAYS), 2027);
assert.equal(coverageMaxYear({}), -Infinity); // 読み込み失敗時は全行が概算扱いになる

rows = schedule({ closing: "末", offsetMonths: 1, payday: 5, adjust: "prev" }, 2027, 5, 12, HOLIDAYS);
const kodomo = rows.find((r) => r.rawPayIso === "2028-05-05");
assert.equal(kodomo.beyondData, true, "収録年外なのに概算フラグが立っていない");
assert.equal(rows.find((r) => r.rawPayIso === "2027-06-05").beyondData, false); // 収録内は通常表示

// データ読み込み失敗(空)なら、全行を概算として申告する(黙って土日だけで答えない)
assert.ok(schedule({ closing: "末", offsetMonths: 1, payday: 5, adjust: "prev" }, 2026, 7, 12, {})
  .every((r) => r.beyondData));

// カナリア: 祝日データが「今日から6ヶ月先」より手前で尽きるなら落とす。
// 落ちたら内閣府CSV(https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv)から翌年分を
// holidays_jp.json に追記すること。ユーザーは beyondData の断り書きで守られているが、
// 断り書きを常態にしないための締切として置く。
const now = new Date();
const horizon = new Date(now.getFullYear(), now.getMonth() + 6, 1);
assert.ok(
  new Date(coverageMaxYear(HOLIDAYS), 11, 31) >= horizon,
  `祝日データが尽きかけている(収録は${coverageMaxYear(HOLIDAYS)}年まで)。内閣府CSVから翌年分を追加すること`
);

// ── ICSのエスケープ ────────────────────────────────────────────────────────
// 取引先名は自由入力。改行を素通しすると任意のICSプロパティを注入できる
assert.equal(icsText("A;B,C\\D"), "A\\;B\\,C\\\\D");
const ics = toICS([{ payIso: "2026-08-05", periodFrom: "2026-07-01", periodTo: "2026-07-31" }],
  "株式会社ヤマダ\nSUMMARY:注入");
assert.ok(!/\r\nSUMMARY:注入/.test(ics), "ICSに改行が素通しされている(プロパティ注入)");
assert.ok(ics.includes("SUMMARY:支払日: 株式会社ヤマダ\\nSUMMARY:注入"));

console.log("all payday_core tests passed");
