import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  parseISO, iso, diffDays, countDays, addBusinessDays, addDays, adjust, isClosed,
} from "../docs/assets/eigyobi_core.js";

const H = JSON.parse(readFileSync(new URL("../docs/assets/holidays_jp.json", import.meta.url)));
const d = parseISO;

// 日数の差
assert.equal(diffDays(d("2026-07-01"), d("2026-07-31")), 30);
assert.equal(diffDays(d("2026-12-31"), d("2027-01-01")), 1);  // 年またぎ
assert.equal(diffDays(d("2028-02-28"), d("2028-03-01")), 2);  // 閏年(2/29がある)

// 休業日の判定
assert.equal(isClosed(d("2026-07-11"), H), true);   // 土
assert.equal(isClosed(d("2026-07-12"), H), true);   // 日
assert.equal(isClosed(d("2026-07-13"), H), false);  // 月
assert.equal(isClosed(d("2026-07-20"), H), true);   // 海の日(祝)
// 土曜も営業する会社(sat:false)
assert.equal(isClosed(d("2026-07-11"), H, { sat: false }), false);
// 年末年始オプション
assert.equal(isClosed(d("2026-12-31"), H, { yearEnd: true }), true);
assert.equal(isClosed(d("2027-01-04"), H, { yearEnd: true }), false); // 月曜

// 期間の日数カウント（両端含む）
{
  const r = countDays(d("2026-07-01"), d("2026-07-31"), H);
  assert.equal(r.total, 31);
  assert.equal(r.business + r.closed, 31);
  // 7月の祝日は海の日(7/20)
  assert.equal(r.holidays.length, 1);
  assert.equal(r.holidays[0].date, "2026-07-20");
}
// 片端のみ（初日不算入・民法140条）。★数えないのは**開始日**であって終了日ではない
{
  const r = countDays(d("2026-07-01"), d("2026-07-31"), H, {}, false);
  assert.equal(r.total, 30);
  // 7/1(水)を数えず、7/31(金)は数える → 営業日は両端含む(22日)より1日少ない21日
  assert.equal(r.business, 21);
  assert.equal(r.closed, 9);
  // 終了日側の祝日(7/20 海の日)は落ちない
  assert.equal(r.holidays.length, 1);
  assert.equal(r.holidays[0].date, "2026-07-20");
}
// ★実測例(2026-07-19レビュー): 7/17(金)→7/20(月・海の日)。初日不算入なら
//   数えるのは 7/18(土)・7/19(日)・7/20(祝) の3日で、営業日は0日・海の日が一覧に載る。
//   旧実装(終了日除外)は 7/17(金)を営業日1日と数え、海の日を落としていた。
{
  const r = countDays(d("2026-07-17"), d("2026-07-20"), H, {}, false);
  assert.equal(r.total, 3);
  assert.equal(r.business, 0, "金曜開始でも初日不算入なら営業日0日");
  assert.equal(r.closed, 3);
  assert.equal(r.holidays.length, 1, "終了日の海の日が祝日リストに載る");
  assert.equal(r.holidays[0].name.includes("海の日") || r.holidays[0].date === "2026-07-20", true);
  assert.equal(r.holidays[0].date, "2026-07-20");
  // 曜日内訳too: 土1・日1・月1、金は数えない
  assert.deepEqual(r.weekdays, [1, 1, 0, 0, 0, 0, 1]);
}
// 対照: 両端含むなら4日・営業日は7/17(金)の1日
{
  const r = countDays(d("2026-07-17"), d("2026-07-20"), H);
  assert.equal(r.total, 4);
  assert.equal(r.business, 1);
}
// 同日で初日不算入なら0日
assert.equal(countDays(d("2026-07-17"), d("2026-07-17"), H, {}, false).total, 0);
// 逆順に渡しても壊れない
assert.equal(countDays(d("2026-07-31"), d("2026-07-01"), H).total, 31);
assert.equal(countDays(d("2026-07-31"), d("2026-07-01"), H, {}, false).total, 30);

// 営業日加算
// 2026-07-13(月) の3営業日後 → 7/14(火),7/15(水),7/16(木)
assert.equal(iso(addBusinessDays(d("2026-07-13"), 3, H)), "2026-07-16");
// 金曜から1営業日後は翌週の月曜(土日を飛ばす)
assert.equal(iso(addBusinessDays(d("2026-07-17"), 1, H)), "2026-07-21"); // 7/20が海の日
// 祝日を飛ばす: 7/17(金)の2営業日後 → 7/21(火),7/22(水)
assert.equal(iso(addBusinessDays(d("2026-07-17"), 2, H)), "2026-07-22");
// 0営業日: 休業日なら次の営業日へ
assert.equal(iso(addBusinessDays(d("2026-07-11"), 0, H)), "2026-07-13"); // 土→月
assert.equal(iso(addBusinessDays(d("2026-07-13"), 0, H)), "2026-07-13"); // 平日はそのまま
// マイナス(◯営業日前)
assert.equal(iso(addBusinessDays(d("2026-07-13"), -1, H)), "2026-07-10"); // 月→前の金

// 暦日加算
assert.equal(iso(addDays(d("2026-07-31"), 1)), "2026-08-01");
assert.equal(iso(addDays(d("2026-12-31"), 1)), "2027-01-01");

// 営業日調整（支払日が休業日のとき）
{
  const r1 = adjust(d("2026-08-01"), "prev", H);   // 土 → 前営業日 7/31(金)
  assert.equal(iso(r1), "2026-07-31");
  assert.equal(r1.moved, true);
  const r2 = adjust(d("2026-08-01"), "next", H);   // 土 → 翌営業日 8/3(月)
  assert.equal(iso(r2), "2026-08-03");
  const r3 = adjust(d("2026-07-13"), "prev", H);   // 平日は動かない
  assert.equal(r3.moved, false);
}
// 年末年始をまたぐ調整
{
  const r = adjust(d("2026-12-31"), "next", H, { yearEnd: true });
  assert.equal(iso(r), "2027-01-04");
}

console.log("all eigyobi_core tests passed");
