// 所得税の計算（確定申告） calcShotokuzei（docs/assets/shotokuzei_core.js）と /shotokuzei/ のテスト。
//
// オラクルは実装の式ではなく、**国税庁が公表した計算例と、別の手続きで公表された令和8年分の設例**:
//  ① 国税庁『令和7年分 確定申告の手引き』手順4・手順3・手順2の設例（端数処理と式の形は令和8年分も同じ）
//     - 課税される所得金額: 8,170,400 − 5,210,312 = 2,960,088 → 2,960,000（千円未満切捨て）→ 税額 198,500
//     - 復興特別所得税: 基準所得税額 176,500 × 0.021 = 3,706（1円未満切捨て）
//     - 寄附金控除: 寄附 265,000・所得金額の合計 8,170,400 → 263,000
//     - 一時所得: 収入 2,500,000 − 支出 1,640,000 = 860,000 → 特別控除 500,000 → 360,000 → ×0.5 = 180,000
//  ② 国税庁『令和8年分 年末調整のしかた』57〜59頁の設例A・設例PDF203の設例B（令和8年分の年調年税額）。
//     給与だけの人が年末調整と同じ控除で確定申告すると、源泉徴収税額＝年調年税額なら第3期分は0円になる
//     （年調年税額は×102.1%の後に100円未満切捨て、確定申告は申告納税額の黒字を100円未満切捨て）。
//  ③ 国税庁 タックスアンサー No.1600 の公的年金等控除額の速算表（65歳以上・65歳未満、以外の所得1,000万円以下）
//     を独立に書き下した式。
// 一次資料: https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/index.htm
//           https://www.nta.go.jp/publication/pamph/gensen/nencho2026/01.htm
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { calcShotokuzei, ichijiShotoku, kifukinKojo, fukkoZei, nozeiHasu } from "../docs/assets/shotokuzei_core.js";
import { calcNencho } from "../docs/assets/nencho_core.js";
import { shotokuzei as zeigakuSokusan } from "../docs/assets/setsuzei_core.js";

const rd = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const J = rd("../docs/assets/juminzei_r08.json");
const S = rd("../docs/assets/setsuzei_r08.json");
const N = rd("../docs/assets/nencho_r08.json");
const H = rd("../docs/assets/hikazei_setai_r08.json");
const I = rd("../docs/assets/iryohi_r08.json");
const K = rd("../docs/assets/shotokuzei_r08.json");
const refs = { J, S, N, H, I, K };

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  try { assert.deepEqual(got, want); pass++; }
  catch { fail++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const ok = (name, cond) => eq(name, !!cond, true);

// ── ① 確定申告の手引きの設例 ─────────────────────────────────────────
{
  // 課税される所得金額と税額（手順4）
  const kazei = Math.floor((8170400 - 5210312) / K.hasu.kazei_unit) * K.hasu.kazei_unit;
  eq("手引き: 課税される所得金額 2,960,000", kazei, 2960000);
  eq("手引き: 税額 198,500", zeigakuSokusan(kazei, S), 198500);
  eq("手引き: 復興特別所得税 176,500×2.1% = 3,706", fukkoZei(176500, K), 3706);
  eq("手引き: 寄附金控除 263,000", kifukinKojo(265000, 8170400, K), 263000);
  eq("手引き: 一時所得の金額 360,000", ichijiShotoku(2500000, 1640000, K), 360000);
  // 一時所得だけの人 → 所得金額の合計は 180,000（2分の1）
  const r = calcShotokuzei({ ichiji: { shunyu: 2500000, shishutsu: 1640000 } }, refs);
  eq("手引き: 一時所得の2分の1 180,000 が所得金額の合計に入る", r.sotoShotoku, 180000);
  eq("一時所得だけ 180,000 は基礎控除104万円で課税0", r.kazei, 0);
}

// 一時所得: 特別控除は残額が50万円未満なら残額（所法34条3項）、赤字は0
eq("一時所得 残額40万 → 0", ichijiShotoku(1400000, 1000000, K), 0);
eq("一時所得 残額50万ちょうど → 0", ichijiShotoku(1500000, 1000000, K), 0);
eq("一時所得 残額50万+1 → 1", ichijiShotoku(1500001, 1000000, K), 1);
eq("一時所得 赤字 → 0", ichijiShotoku(100000, 300000, K), 0);
eq("一時所得の2分の1は1円未満切捨て（残額50万+3円 → 3円 → 1円）", calcShotokuzei({ ichiji: { shunyu: 500003 } }, refs).shotoku.ichijiHalf, 1);

// 寄附金控除: 40%の限度・2,000円の足切り
eq("寄附金: 2,000円ちょうどは0", kifukinKojo(2000, 5000000, K), 0);
eq("寄附金: 2,001円は1", kifukinKojo(2001, 5000000, K), 1);
eq("寄附金: 所得の40%で頭打ち（所得100万→40万−2,000）", kifukinKojo(1000000, 1000000, K), 398000);

// 端数処理（申告納税額・第3期分）
eq("申告納税額 黒字 12,399 → 12,300", nozeiHasu(12399, K), 12300);
eq("申告納税額 黒字 99 → 0", nozeiHasu(99, K), 0);
eq("申告納税額 赤字 −12,399 → そのまま", nozeiHasu(-12399, K), -12399);

// ── ② 年末調整の設例と、確定申告の計算を突き合わせる ───────────────────────
const SETTEI_A = {
  kyuyo: 8970000, shaho: 1386102,
  seiho: { ippan_shin: 80000, ippan_kyu: 35000, kaigo: 80000, nenkin_shin: 30000, nenkin_kyu: 90000 },
  jishin: { jishin: 42000, kyuChoki: 14800 },
  haigu: { ari: true, gokei: 500000, rojin: false, shogai: "none" },
  fuyo: { ippan2369: 1, tokutei: 1, dokyoRojin: 1 }, fuyoShogai: { ippan: 1 },
  tokuteiShinzoku: [1000000], jutaku: 76500,
};
{
  const r = calcShotokuzei({ ...SETTEI_A, gensen: 41400 }, refs);
  ok("設例A: ok", r.ok);
  eq("設例A: 給与所得控除後 7,020,000", r.shotoku.kyuyoKojoGo, 7020000);
  eq("設例A: 所得金額調整控除 47,000", r.shotoku.chosei1, 47000);
  eq("設例A: 所得金額の合計 6,973,000", r.sotoShotoku, 6973000);
  eq("設例A: 所得控除の合計 4,826,102（年調と同じ）", r.kojo.gokei, 4826102);
  eq("設例A: 課税される所得金額 2,146,000", r.kazei, 2146000);
  eq("設例A: 税額 117,100", r.zeigaku, 117100);
  eq("設例A: 基準所得税額 40,600（住宅ローン控除76,500後）", r.kijun, 40600);
  eq("設例A: 復興特別所得税 852", r.fukko, 852);
  eq("設例A: 所得税及び復興特別所得税の額 41,452", r.zeigakuGokei, 41452);
  eq("設例A: 源泉徴収税額＝年調年税額41,400なら申告納税額0", r.shinkoku, 0);
  eq("設例A: 第3期分0", r.daisanki, 0);
  // 医療費30万円を足すと課税所得が下がり、還付が出る（総所得6,973,000の5%は10万円超→足切り10万円）
  const m = calcShotokuzei({ ...SETTEI_A, gensen: 41400, iryohi: { mode: "tsujo", shiharai: 300000 } }, refs);
  eq("設例A+医療費30万: 医療費控除 200,000", m.kojo.iryohi, 200000);
  eq("設例A+医療費30万: 課税所得 1,946,000", m.kazei, 1946000);
  // 1,946,000×5% = 97,300 − 76,500 = 20,800 → 復興 436 → 21,236 − 41,400 = −20,164（還付・1円単位）
  eq("設例A+医療費30万: 還付 20,164", m.kanpu, 20164);
}
{
  const B = { kyuyo: 4390000, shaho: 641525, seiho: { ippan_kyu: 50200, nenkin_shin: 56000 },
              jishin: { jishin: 45000 }, haigu: { ari: true, gokei: 0 }, fuyo: { ippan2369: 1 } };
  const r = calcShotokuzei({ ...B, gensen: 26100 }, refs);
  eq("設例B: 基礎控除104万円", r.kojo.kiso, 1040000);
  eq("設例B: 課税される所得金額 512,000", r.kazei, 512000);
  eq("設例B: 所得税及び復興特別所得税の額 26,137", r.zeigakuGokei, 26137);
  eq("設例B: 源泉＝年調年税額26,100なら第3期分0", r.daisanki, 0);
  const y = calcShotokuzei({ ...B, gensen: 0, yotei: 20000 }, refs);
  eq("設例B: 源泉0・予定納税20,000 → 申告納税額26,100", y.shinkoku, 26100);
  eq("設例B: 源泉0・予定納税20,000 → 納める税金6,100", y.nozei, 6100);
  const y2 = calcShotokuzei({ ...B, gensen: 0, yotei: 30000 }, refs);
  eq("設例B: 予定納税30,000 → 還付3,900", y2.kanpu, 3900);
}

// 給与だけの人の総当たり: 確定申告の第3期分は、源泉＝年調年税額なら必ず0（年末調整と同じ正本で計算している）
{
  let bad = 0, n = 0;
  for (let kyuyo = 500000; kyuyo <= 20000000; kyuyo += 37123) {
    for (const shaho of [0, Math.floor(kyuyo * 0.15)]) {
      for (const fam of [{}, { haigu: { ari: true, gokei: 0 }, fuyo: { nensho: 1, tokutei: 1 } }]) {
        const base = { kyuyo, shaho, ...fam };
        const nc = calcNencho({ ...base, choshu: 0 }, { J, S, N });
        if (!nc.ok) continue;
        const r = calcShotokuzei({ ...base, gensen: nc.nenzei }, refs);
        n++;
        if (r.daisanki !== 0 || r.kazei !== nc.kazei) { bad++; if (bad < 4) console.log("   mismatch", kyuyo, shaho, nc.nenzei, r.zeigakuGokei, r.daisanki); }
      }
    }
  }
  eq(`年調との総当たり ${n}件で第3期分0・課税所得一致`, bad, 0);
}

// ── ③ 公的年金等控除（No.1600 の速算表を独立に書き下す。以外の所得1,000万円以下）──
const nenkinKojoOracle = (s, is65) => {
  if (is65) {
    if (s < 3300000) return Math.min(s, 1100000);
    if (s < 4100000) return s - Math.floor(s * 0.75 - 275000);
    if (s < 7700000) return s - Math.floor(s * 0.85 - 685000);
    if (s < 10000000) return s - Math.floor(s * 0.95 - 1455000);
    return Math.min(s, 1955000);
  }
  if (s < 1300000) return Math.min(s, 600000);
  if (s < 4100000) return s - Math.floor(s * 0.75 - 275000);
  if (s < 7700000) return s - Math.floor(s * 0.85 - 685000);
  if (s < 10000000) return s - Math.floor(s * 0.95 - 1455000);
  return Math.min(s, 1955000);
};
{
  let bad = 0;
  for (let s = 100000; s <= 12000000; s += 9973) {
    for (const is65 of [true, false]) {
      const r = calcShotokuzei({ nenkin: { shunyu: s, age65: is65 } }, refs);
      const want = Math.max(0, s - nenkinKojoOracle(s, is65));
      if (r.shotoku.nenkinZatsu !== want) { bad++; if (bad < 4) console.log("   nenkin", s, is65, r.shotoku.nenkinZatsu, want); }
    }
  }
  eq("公的年金等の雑所得（No.1600 速算表と総当たり）", bad, 0);
}
// 65歳以上・年金200万円 → 90万円。給与300万円と両方 → 所得金額調整控除2項 10万円
{
  const r = calcShotokuzei({ kyuyo: 3000000, nenkin: { shunyu: 2000000, age65: true } }, refs);
  eq("給与300万: 給与所得控除後 2,020,000", r.shotoku.kyuyoKojoGo, 2020000);
  eq("年金200万(65歳以上): 雑所得 900,000", r.shotoku.nenkinZatsu, 900000);
  eq("給与と年金の両方: 所得金額調整控除2項 100,000", r.shotoku.chosei2, 100000);
  eq("給与所得 1,920,000", r.shotoku.kyuyoShotoku, 1920000);
  eq("所得金額の合計 2,820,000", r.sotoShotoku, 2820000);
}
// 2項は「給与所得控除後（1項の前）10万上限＋年金雑所得10万上限−10万」。年金雑所得5万なら5万
eq("2項: 給与所得控除後200万・年金雑所得5万 → 5万",
   calcShotokuzei({ kyuyo: 3000000, nenkin: { shunyu: 650000, age65: false } }, refs).shotoku.chosei2, 50000);
// ★以外の合計所得金額に一時所得の2分の1と給与所得（1項の後）が入る: 1,000万円の境で控除が変わる
{
  // 事業所得 1,000万ちょうど → 区分1（最低110万）／1,000万+1 → 区分2（最低100万）
  const a = calcShotokuzei({ jigyo: 10000000, nenkin: { shunyu: 1000000, age65: true } }, refs);
  const b = calcShotokuzei({ jigyo: 10000001, nenkin: { shunyu: 1000000, age65: true } }, refs);
  eq("以外の所得1,000万円ちょうど: 年金100万は雑所得0", a.shotoku.nenkinZatsu, 0);
  eq("以外の所得1,000万円+1: 年金100万は雑所得0（最低100万）", b.shotoku.nenkinZatsu, 0);
  const c = calcShotokuzei({ jigyo: 10000001, nenkin: { shunyu: 1050000, age65: true } }, refs);
  eq("以外の所得1,000万円+1: 年金105万は雑所得50,000", c.shotoku.nenkinZatsu, 50000);
  const d = calcShotokuzei({ jigyo: 9900000, ichiji: { shunyu: 700002 }, nenkin: { shunyu: 1050000, age65: true } }, refs);
  eq("一時所得の2分の1（100,001）で以外の所得が1,000万円超 → 雑所得50,000", d.shotoku.nenkinZatsu, 50000);
}

// ── 医療費控除・セルフメディケーション ──
{
  // 給与200万: 給与所得 1,260,000（74万控除）→ 5% = 63,000 が足切り
  const r = calcShotokuzei({ kyuyo: 2000000, iryohi: { mode: "tsujo", shiharai: 100000 } }, refs);
  eq("給与200万: 所得金額の合計 1,260,000", r.sotoShotoku, 1260000);
  eq("医療費10万: 足切り63,000 → 控除37,000", r.kojo.iryohi, 37000);
  const s = calcShotokuzei({ kyuyo: 2000000, iryohi: { mode: "selfmed", selfmed: 50000, shiharai: 100000 } }, refs);
  eq("セルフメディ5万 → 38,000", s.kojo.iryohi, 38000);
  ok("選ばなかった方が大きいと注記する", s.notes.some((t) => /通常の医療費控除を選ぶと/.test(t)) === false && s.kojo.iryohiAlt === 37000);
  const s2 = calcShotokuzei({ kyuyo: 2000000, iryohi: { mode: "selfmed", selfmed: 20000, shiharai: 100000 } }, refs);
  ok("セルフメディ8,000 < 通常37,000 → 注記", s2.notes.some((t) => /通常の医療費控除を選ぶと控除額が37,000円/.test(t)));
  eq("補填金は医療費から引く", calcShotokuzei({ kyuyo: 5000000, iryohi: { mode: "tsujo", shiharai: 300000, hoten: 150000 } }, refs).kojo.iryohi, 50000);
}

// ── 住宅借入金等特別控除: 税額を超える分は切り捨て（所得税から引ききれない） ──
{
  const r = calcShotokuzei({ kyuyo: 4000000, shaho: 600000, jutaku: 300000, gensen: 50000 }, refs);
  eq("住宅ローン控除: 基準所得税額は0", r.kijun, 0);
  ok("住宅ローン控除: 引ききれない額を注記", r.jutakuKirisute > 0 && r.notes.some((t) => /引ききれません/.test(t)));
  eq("住宅ローン控除: 源泉50,000が全額還付", r.kanpu, 50000);
}

// ── 断る入力 ──
ok("事業所得の赤字は断る", !calcShotokuzei({ kyuyo: 5000000, jigyo: -100000 }, refs).ok);
ok("不動産所得の赤字は断る", !calcShotokuzei({ kyuyo: 5000000, fudosan: -1 }, refs).ok);
ok("雑所得の赤字は断る", !calcShotokuzei({ nenkin: { shunyu: 3000000 }, zatsu: -1 }, refs).ok);
ok("収入が何も無いときは断る", !calcShotokuzei({}, refs).ok);
let threw = false; try { calcShotokuzei({ kyuyo: 1 }, { J, S, N, H, I }); } catch { threw = true; }
ok("参照データが欠けたら答えない（fail closed）", threw);

// 高額: 課税所得4,000万円超は45%（年末調整の速算表には無い段）
{
  const r = calcShotokuzei({ jigyo: 50000000 }, refs);
  eq("事業所得5,000万: 基礎控除0（2,500万超）", r.kojo.kiso, 0);
  eq("事業所得5,000万: 税額 50,000,000×45%−4,796,000", r.zeigaku, 17704000);
  eq("事業所得5,000万: 復興 371,784", r.fukko, 371784);
}

// ── 壊しテスト（データを壊すと答えが動く＝データが本当に効いている）──
{
  const K2 = JSON.parse(JSON.stringify(K)); K2.fukko.rate_num = 11;
  ok("壊し: 復興の税率を1.1%にすると3,706ではなくなる", fukkoZei(176500, K2) !== 3706);
  const K3 = JSON.parse(JSON.stringify(K)); K3.ichiji.bunbo = 1;
  ok("壊し: 一時所得の2分の1をやめると180,000ではなくなる", calcShotokuzei({ ichiji: { shunyu: 2500000, shishutsu: 1640000 } }, { ...refs, K: K3 }).sotoShotoku !== 180000);
  const K4 = JSON.parse(JSON.stringify(K)); K4.kifukin.gendo_pct = 30;
  ok("壊し: 寄附金の限度40%を30%にすると頭打ちが変わる", kifukinKojo(1000000, 1000000, K4) !== 398000);
}

// ── ページ（年度はデータから描く・必須の配線）──
{
  const html = readFileSync(new URL("../docs/shotokuzei/index.html", import.meta.url), "utf8");
  ok("page: shotokuzei_core を読む", /assets\/shotokuzei_core\.js/.test(html));
  ok("page: 6つの参照データを await", /await\s+Promise\.all\(\[jReady, sReady, nReady, hReady, iReady, kReady\]\)/.test(html));
  ok("page: 読み込み失敗を申告", /読み込めませんでした/.test(html));
  ok("page: 年分はデータから（_meta.year を使う）", /K\._meta\.year/.test(html));
  // 速算表（静的な表）の行がデータ（setsuzei_r08 の brackets）と一致する
  const rows = [...html.matchAll(/<tr><td>([\d,]+)円(?:〜([\d,]+)円|以上)<\/td><td>×(\d+)%(?:−([\d,]+)円)?<\/td><\/tr>/g)];
  eq("page: 速算表は7行", rows.length, 7);
  rows.forEach((m, idx) => {
    const b = S.shotokuzei_brackets[idx];
    const upto = m[2] ? Number(m[2].replace(/,/g, "")) : null;
    eq(`page: 速算表${idx + 1}行目の上限`, upto, b.upto);
    eq(`page: 速算表${idx + 1}行目の税率`, Number(m[3]) / 100, b.rate);
    eq(`page: 速算表${idx + 1}行目の控除額`, m[4] ? Number(m[4].replace(/,/g, "")) : 0, b.deduct);
  });
}

console.log(`test_shotokuzei: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
