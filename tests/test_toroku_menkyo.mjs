// 相続登記の登録免許税計算機（/sozoku-toki-menkyozei/）のコア検証。
//
// オラクルは「条文を条ごとに書き下した独立実装」（コアのアルゴリズムを見ずに、法文の順に素朴に書く）:
//   ① 各不動産の価額 × 持分割合          … 登録免許税法10条1項・2項
//   ② 少額の土地（100万円以下）は除外     … 措法84条の2の2第2項（土地のみ・1筆ごと）
//   ③ 残りを合計 → 1,000円未満切捨て      … 国税通則法118条1項
//      合計が1,000円未満なら1,000円        … 登録免許税法15条
//   ④ ×1000分の4                          … 別表第一 第一号（二）イ
//   ⑤ 1,000円未満なら1,000円              … 登録免許税法19条（切捨て前の額で判定）
//      そうでなければ100円未満切捨て       … 国税通則法119条1項
// これをコアと全域（評価額×持分×件数の組合せ）で突き合わせ、さらに手計算で固定した
// シナリオと、法務局・国税庁の資料に載る境界値で殴る。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const D = JSON.parse(readFileSync(join(docs, "assets", "toroku_menkyo_r08.json"), "utf8"));
const { calcTorokuMenkyozei, calcGimuKigen, addYearsClamped, daysInMonth, isDateStr } =
  await import(join(docs, "assets", "toroku_menkyo_core.js"));

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const okv = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (okv) { pass++; } else { fail++; console.error(`✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`); }
};
const ok = (label, cond) => eq(label, !!cond, true);

// ════════════════════════════════════════════════════════════════════
// 0. 参照データが条文の数字と一致していること（データ改変を最初に落とす）
// ════════════════════════════════════════════════════════════════════
eq("data: 相続による移転の税率は1000分の4（別表第一 第一号（二）イ）", D.zeiritsu.sozoku_iten, 0.004);
eq("data: 所有権の保存の税率は1000分の4（別表第一 第一号（一））", D.zeiritsu.hozon, 0.004);
eq("data: その他の原因による移転は1000分の20（別表第一 第一号（二）ハ）", D.zeiritsu.sonota_iten, 0.02);
eq("data: 課税標準は1,000円未満切捨て（通則法118条1項）", D.hasu.kazei_hyojun_kirisute, 1000);
eq("data: 課税標準の下限は1,000円（登録免許税法15条）", D.hasu.kazei_hyojun_min, 1000);
eq("data: 税額は100円未満切捨て（通則法119条1項）", D.hasu.zeigaku_kirisute, 100);
eq("data: 定率課税の最低税額は1,000円（登録免許税法19条）", D.hasu.zeigaku_min, 1000);
eq("data: 少額土地の免税は100万円以下（措法84条の2の2第2項）", D.menzei.shogaku.limit, 1000000);
eq("data: 少額土地の免税の対象は土地のみ", D.menzei.shogaku.target, "土地のみ");
eq("data: 免税措置の期限は令和9年3月31日（措法84条の2の2）", D.menzei.kigen, "2027-03-31");
eq("data: 申請義務の施行日は令和6年4月1日（令和3年法律24号 附則1条2号）", D.gimuka.shiko_bi, "2024-04-01");
eq("data: 申請義務の期間は3年（不登法76条の2第1項）", D.gimuka.kigen_years, 3);
eq("data: 過料は10万円以下（不登法164条1項）", D.gimuka.karyo_max, 100000);

// ★カナリア: 免税措置の期限が来たら、このテストが赤くなって点検を強制する。
//   （期限後も「免税です」と答え続けるのが、このツールで最も危険な向きの嘘）
const today = new Date().toISOString().slice(0, 10);
ok(`カナリア: 免税措置の再点検期限 ${D.menzei.recheck_after} を過ぎていない`
   + `（過ぎたら令和9年度税制改正で延長されたか確認し menzei.kigen / status を更新すること）`,
   today <= D.menzei.recheck_after);

// ════════════════════════════════════════════════════════════════════
// 1. 条文書き下しオラクル（コアとは独立の素朴な実装）
// ════════════════════════════════════════════════════════════════════
function oracle(properties, applyDate) {
  const LIMIT = 1000000;             // 措法84条の2の2第2項
  const KIGEN = "2027-03-31";        // 同上・適用期限
  const menzeiOk = applyDate == null || applyDate <= KIGEN;
  let sum = 0;
  let taxable = 0, exempt = 0;
  for (const p of properties) {
    const full = Math.floor(p.value) > 0 ? Math.floor(p.value) : 0;
    const ratio = p.shareDen > 0 ? p.shareNum / p.shareDen : 1;
    const v = Math.floor(full * ratio);                       // 登免法10条2項
    const isLand = p.kind !== "building";
    if (menzeiOk && isLand && v > 0 && v <= LIMIT) { exempt++; continue; }  // 措法84の2の2②
    if (v > 0) { taxable++; sum += v; }
  }
  let base = 0;
  if (sum > 0) {
    const fl = Math.floor(sum / 1000) * 1000;                 // 通則法118条1項
    base = fl > 0 ? fl : 1000;                                // 登免法15条
  }
  let tax = 0;
  if (base > 0) {
    const raw = base * 0.004;                                 // 別表第一 一（二）イ
    tax = raw < 1000 ? 1000 : Math.floor(raw / 100) * 100;    // 登免法19条 / 通則法119条1項
  }
  return { base, tax, taxable, exempt };
}

const run = (props, applyDate) =>
  calcTorokuMenkyozei({ properties: props, applyDate }, D);

// ════════════════════════════════════════════════════════════════════
// 2. 手計算で固定したシナリオ（オラクルとコアの両方が同じ間違いをしていないか）
// ════════════════════════════════════════════════════════════════════
// S1: 土地1,234万5,678円（全部）＋建物567万8,901円（全部）
//     合計 18,024,579 → 1,000円未満切捨て 18,024,000 → ×0.004 = 72,096 → 100円未満切捨て 72,000
{
  const r = run([
    { kind: "land", value: 12345678, shareNum: 1, shareDen: 1 },
    { kind: "building", value: 5678901, shareNum: 1, shareDen: 1 },
  ]);
  eq("S1 手計算: 持分適用後の合計", r.sumRaw, 18024579);
  eq("S1 手計算: 課税標準（1,000円未満切捨て）", r.kazeiHyojun, 18024000);
  eq("S1 手計算: 登録免許税（72,096→100円未満切捨て）", r.tax, 72000);
  eq("S1 免税件数は0", r.exemptCount, 0);
  eq("S1 最低税額は働いていない", r.minApplied, false);
}

// S2: 持分2分の1（登免法10条2項）。土地3,000万円の1/2 = 1,500万円
//     →15,000,000 → ×0.004 = 60,000 → 60,000円
{
  const r = run([{ kind: "land", value: 30000000, shareNum: 1, shareDen: 2 }]);
  eq("S2 手計算: 持分1/2の課税標準", r.kazeiHyojun, 15000000);
  eq("S2 手計算: 登録免許税", r.tax, 60000);
  // ★持分を無視すると倍額になる（この差が出ることを固定する）
  const full = run([{ kind: "land", value: 30000000, shareNum: 1, shareDen: 1 }]);
  eq("S2 対照: 持分を無視した場合は倍額", full.tax, 120000);
}

// S3: ★少額の土地の免税（措法84条の2の2第2項）。土地80万円は免税・建物80万円は課税。
//     建物のみ課税標準 800,000 → ×0.004 = 3,200 → 3,200円
{
  const r = run([
    { kind: "land", value: 800000, shareNum: 1, shareDen: 1 },
    { kind: "building", value: 800000, shareNum: 1, shareDen: 1 },
  ]);
  eq("S3 免税は土地1件だけ（建物は対象外）", r.exemptCount, 1);
  // ★ ?. で受ける: 免税0件のとき [0].kind が TypeError になると**テストがそこで死んで
  //   以降の全域照合が一度も走らない**（壊しテストで「赤2件」しか出ず、網が効いていないように見えた）。
  eq("S3 免税になったのは土地", r.items.filter((i) => i.exempt)[0]?.kind ?? null, "land");
  eq("S3 課税標準は建物だけ", r.kazeiHyojun, 800000);
  eq("S3 登録免許税", r.tax, 3200);
}

// S4: ★免税判定は1筆ごと（申請全体の合計ではない）。90万円の土地3筆 → 合計270万円でも全部免税＝0円
{
  const r = run([
    { kind: "land", value: 900000, shareNum: 1, shareDen: 1 },
    { kind: "land", value: 900000, shareNum: 1, shareDen: 1 },
    { kind: "land", value: 900000, shareNum: 1, shareDen: 1 },
  ]);
  eq("S4 3筆とも免税", r.exemptCount, 3);
  eq("S4 課税標準は0", r.kazeiHyojun, 0);
  eq("S4 登録免許税は0円（最低税額1,000円は課税される登記の話）", r.tax, 0);
  eq("S4 全部免税のフラグ", r.allExempt, true);
}

// S5: ★境界。100万円ちょうどは免税（「100万円以下」）／100万1円は課税
{
  const just = run([{ kind: "land", value: 1000000, shareNum: 1, shareDen: 1 }]);
  eq("S5 100万円ちょうどは免税", just.exemptCount, 1);
  eq("S5 100万円ちょうどの税額は0円", just.tax, 0);
  const over = run([{ kind: "land", value: 1000001, shareNum: 1, shareDen: 1 }]);
  eq("S5 100万1円は課税", over.exemptCount, 0);
  eq("S5 100万1円の課税標準（1,000円未満切捨て）", over.kazeiHyojun, 1000000);
  eq("S5 100万1円の税額（4,000円）", over.tax, 4000);
}

// S6: ★持分適用後で免税判定する（登免法10条2項）。全体400万円の1/4 = 100万円 → 免税
{
  const r = run([{ kind: "land", value: 4000000, shareNum: 1, shareDen: 4 }]);
  eq("S6 持分適用後100万円ちょうど → 免税", r.exemptCount, 1);
  eq("S6 税額0円", r.tax, 0);
  const r2 = run([{ kind: "land", value: 4000000, shareNum: 1, shareDen: 3 }]);
  eq("S6 対照: 1/3なら1,333,333円で課税", r2.kazeiHyojun, 1333000);
  eq("S6 対照: 税額 5,332→100円未満切捨て", r2.tax, 5300);
}

// S7: ★最低税額（登免法19条）。建物20万円 → 20万×0.004 = 800 < 1,000 → 1,000円
{
  const r = run([{ kind: "building", value: 200000, shareNum: 1, shareDen: 1 }]);
  eq("S7 課税標準", r.kazeiHyojun, 200000);
  eq("S7 税率適用後は800円", r.rawTax, 800);
  eq("S7 最低税額1,000円が働く", r.tax, 1000);
  eq("S7 minAppliedフラグ", r.minApplied, true);
}

// S8: ★最低税額の境界。課税標準250,000 → ちょうど1,000円 / 249,000 → 996円 → 1,000円
{
  eq("S8 課税標準25万円ちょうど → 1,000円", run([{ kind: "building", value: 250000, shareNum: 1, shareDen: 1 }]).tax, 1000);
  const r = run([{ kind: "building", value: 249000, shareNum: 1, shareDen: 1 }]);
  eq("S8 課税標準24万9千円 → 996円だが最低税額で1,000円", r.tax, 1000);
  ok("S8 24万9千円では最低税額が働いている", r.minApplied);
  ok("S8 25万円ちょうどでは最低税額は働いていない", !run([{ kind: "building", value: 250000, shareNum: 1, shareDen: 1 }]).minApplied);
}

// S9: ★課税標準の下限（登免法15条）。建物800円 → 切り捨てると0だが1,000円とする → 税額1,000円
{
  const r = run([{ kind: "building", value: 800, shareNum: 1, shareDen: 1 }]);
  eq("S9 課税標準は1,000円（登免法15条・切り捨てて0にしない）", r.kazeiHyojun, 1000);
  eq("S9 税額は最低の1,000円", r.tax, 1000);
}

// S10: ★免税措置の期限（措法84条の2の2）。期限内は免税・期限後は免税判定しない
{
  const inTime = run([{ kind: "land", value: 500000, shareNum: 1, shareDen: 1 }], "2027-03-31");
  eq("S10 令和9年3月31日は期限内 → 免税", inTime.exemptCount, 1);
  eq("S10 期限内の税額は0円", inTime.tax, 0);
  const late = run([{ kind: "land", value: 500000, shareNum: 1, shareDen: 1 }], "2027-04-01");
  eq("S10 令和9年4月1日は期限後 → 免税判定しない", late.exemptCount, 0);
  eq("S10 期限後は課税される（50万×0.004=2,000）", late.tax, 2000);
  ok("S10 期限後は menzeiExpired を立てて申告する", late.menzeiExpired);
  ok("S10 期限内は menzeiActive", inTime.menzeiActive);
}

// ════════════════════════════════════════════════════════════════════
// 3. 全域照合（評価額 × 持分 × 種別 の組合せをオラクルと突き合わせる）
// ════════════════════════════════════════════════════════════════════
{
  const values = [0, 1, 800, 999, 1000, 1001, 99999, 200000, 249000, 249999, 250000,
    999999, 1000000, 1000001, 1234567, 3000000, 12345678, 98765432, 250000000];
  const shares = [[1, 1], [1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [1, 6], [5, 6], [1, 100], [99, 100]];
  const kinds = ["land", "building"];
  let n = 0;
  for (const v of values) for (const [sn, sd] of shares) for (const k of kinds) {
    const props = [{ kind: k, value: v, shareNum: sn, shareDen: sd }];
    const got = run(props);
    const want = oracle(props, null);
    eq(`全域1件 ${k} ${v}円 ${sn}/${sd} 課税標準`, got.kazeiHyojun, want.base);
    eq(`全域1件 ${k} ${v}円 ${sn}/${sd} 税額`, got.tax, want.tax);
    eq(`全域1件 ${k} ${v}円 ${sn}/${sd} 免税件数`, got.exemptCount, want.exempt);
    n++;
  }
  console.log(`  （全域1件: ${n}通り）`);
}

// 複数件の組合せ（免税の混在・端数の積み上がり）
{
  const values = [0, 999, 250000, 999999, 1000000, 1000001, 4567890, 33333333];
  const kinds = ["land", "building"];
  let n = 0;
  for (const a of values) for (const b of values) for (const ka of kinds) for (const kb of kinds) {
    const props = [
      { kind: ka, value: a, shareNum: 1, shareDen: 1 },
      { kind: kb, value: b, shareNum: 2, shareDen: 3 },
    ];
    const got = run(props);
    const want = oracle(props, null);
    eq(`全域2件 ${ka}${a}+${kb}${b} 課税標準`, got.kazeiHyojun, want.base);
    eq(`全域2件 ${ka}${a}+${kb}${b} 税額`, got.tax, want.tax);
    eq(`全域2件 ${ka}${a}+${kb}${b} 免税件数`, got.exemptCount, want.exempt);
    n++;
  }
  console.log(`  （全域2件: ${n}通り）`);
}

// 適用日を振って期限の門も全域で見る
{
  const dates = ["2026-01-01", "2027-03-30", "2027-03-31", "2027-04-01", "2030-12-31"];
  for (const d of dates) for (const v of [500000, 1000000, 1000001, 5000000]) {
    const props = [{ kind: "land", value: v, shareNum: 1, shareDen: 1 }];
    const got = run(props, d);
    const want = oracle(props, d);
    eq(`期限 ${d} ${v}円 税額`, got.tax, want.tax);
    eq(`期限 ${d} ${v}円 免税件数`, got.exemptCount, want.exempt);
  }
}

// ════════════════════════════════════════════════════════════════════
// 4. 単調性（正しい商品が満たすべき性質）
// ════════════════════════════════════════════════════════════════════
{
  // 免税帯（土地100万円以下）を除けば、評価額が増えれば税額は減らない
  let prev = -1, bad = 0;
  for (let v = 1000001; v <= 50000000; v += 137717) {
    const t = run([{ kind: "land", value: v, shareNum: 1, shareDen: 1 }]).tax;
    if (t < prev) bad++;
    prev = t;
  }
  eq("単調性: 課税帯では評価額が増えて税額が減ることはない", bad, 0);
}
{
  // 持分が大きいほど税額は減らない（同一物件・課税帯）
  let bad = 0;
  for (let n = 1; n <= 10; n++) {
    const t = run([{ kind: "building", value: 30000000, shareNum: n, shareDen: 10 }]).tax;
    const t2 = run([{ kind: "building", value: 30000000, shareNum: n + 1 > 10 ? 10 : n + 1, shareDen: 10 }]).tax;
    if (t2 < t) bad++;
  }
  eq("単調性: 持分が大きいほど税額は減らない", bad, 0);
}

// ════════════════════════════════════════════════════════════════════
// 5. 申請義務の期限（不登法76条の2／令和3年法律24号 附則5条6項）
// ════════════════════════════════════════════════════════════════════
eq("期限: 施行日後に知った → 知った日から3年", calcGimuKigen("2026-05-10", D).deadline, "2029-05-10");
ok("期限: 施行日後は読み替えを使っていない", !calcGimuKigen("2026-05-10", D).usedShikoBi);
// ★施行日前に開始した相続は「知った日又は施行日のいずれか遅い日」から起算（附則5条6項）
eq("期限: 施行日前に知った → 施行日から3年（令和9年4月1日）", calcGimuKigen("2010-08-15", D).deadline, "2027-04-01");
ok("期限: 施行日前は読み替えを使う", calcGimuKigen("2010-08-15", D).usedShikoBi);
eq("期限: 施行日ちょうどに知った → 施行日から3年", calcGimuKigen("2024-04-01", D).deadline, "2027-04-01");
ok("期限: 施行日ちょうどは読み替え不要", !calcGimuKigen("2024-04-01", D).usedShikoBi);
eq("期限: 施行日の前日に知った → 施行日起算", calcGimuKigen("2024-03-31", D).start, "2024-04-01");
// うるう日の応当日（民法143条2項ただし書＝応当日がない月は末日）
eq("期限: 2024-02-29 の3年後は 2027-02-28（応当日なし→末日）", addYearsClamped("2024-02-29", 3), "2027-02-28");
eq("期限: 2028-02-29 の3年後は 2031-02-28", addYearsClamped("2028-02-29", 3), "2031-02-28");
eq("期限: 2025-02-28 の3年後は 2028-02-28（うるう年でも日付は動かない）", addYearsClamped("2025-02-28", 3), "2028-02-28");
eq("daysInMonth: 2024年2月は29日", daysInMonth(2024, 2), 29);
eq("daysInMonth: 2100年2月は28日（100年ルール）", daysInMonth(2100, 2), 28);
eq("daysInMonth: 2000年2月は29日（400年ルール）", daysInMonth(2000, 2), 29);
ok("isDateStr: 存在しない日付を弾く", !isDateStr("2026-02-30"));
ok("isDateStr: 13月を弾く", !isDateStr("2026-13-01"));
ok("isDateStr: 妥当な日付を通す", isDateStr("2026-07-24"));
eq("期限: 不正な日付は null", calcGimuKigen("2026-02-30", D), null);

// ════════════════════════════════════════════════════════════════════
// 6. 入力の頑健性（fail closed）
// ════════════════════════════════════════════════════════════════════
{
  eq("空の入力は税額0円", run([]).tax, 0);
  eq("空の入力は hasAnyValue=false", run([]).hasAnyValue, false);
  eq("評価額0円だけなら税額0円", run([{ kind: "land", value: 0, shareNum: 1, shareDen: 1 }]).tax, 0);
  eq("マイナスの評価額は0として扱う", run([{ kind: "building", value: -5000000, shareNum: 1, shareDen: 1 }]).tax, 0);
  // 持分が不正（分母0・分子>分母）なら1/1として扱い、そのことを申告する
  const bad = run([{ kind: "building", value: 10000000, shareNum: 3, shareDen: 0 }]);
  eq("持分の分母0 → 全部として計算", bad.kazeiHyojun, 10000000);
  ok("持分が不正なことを申告する", bad.items[0].invalidShare);
  let threw = false;
  try { calcTorokuMenkyozei({ properties: [] }, null); } catch (e) { threw = /参照データ/.test(e.message); }
  ok("参照データが無ければ例外（fail closed）", threw);
}

console.log(`\ntest_toroku_menkyo: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
