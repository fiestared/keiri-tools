// 年末調整 calcNencho（docs/assets/nencho_core.js）と /nenmatsu-chosei/ のテスト。
//
// オラクルは実装の式ではなく、**国税庁が公表した計算例と表**（令和8年分）:
//  ① 『令和8年分 年末調整のしかた』57〜59頁の設例（最後の給与の税額計算を省略する場合）
//     給与8,970,000円 → 年調年税額41,400円・超過額115,270円。所得金額調整控除・生保の23歳未満特例・
//     旧長期損害保険料・配偶者控除・特定親族特別控除・扶養（特定・同居老親等＋障害者）・住宅ローン控除を
//     全部通る。途中の欄（⑨⑩⑪⑮⑯⑰⑱⑲⑳㉑㉒㉓㉕㉖）も1円まで照合する。
//  ② 同 設例PDF 203（最後の給与の税額計算を省略しない場合）
//     給与4,390,000円 → 年調年税額26,100円・超過額25,745円。基礎控除104万円（489万円以下）を通る。
//  ③ 同 47〜54頁「給与所得控除後の給与等の金額の表」全1,103行（tests/fixtures に PDF から抽出）
//  ④ 同 36〜38頁の例（給与7,654,321円→5,788,888円／所得金額調整控除 8,765,432円→26,544円／
//     速算表 2,696,000円→172,100円）
//  ⑤ 所得税法84条の2第1項（特定親族特別控除）の**算式を書き下した独立実装**と、データの表を全域照合
//  ⑥ 『令和8年分 給与所得の源泉徴収票等の法定調書の作成と提出の手引』13〜15頁の記載例1
//     （給与9,620,000円 → 年調年税額206,000円・超過額166,460円）。源泉徴収簿の⑨〜㉗と、
//     源泉徴収票の各欄（支払金額・給与所得控除後の金額（調整控除後）・所得控除の額の合計額・源泉徴収税額 ほか）を照合
//     https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/02.pdf
//  ⑦ 『源泉所得税の改正のあらまし』（令和8年4月）1〜2頁の境目（給与だけの場合の収入金額の換算）
//     https://www.nta.go.jp/publication/pamph/gensen/2026kaisei.pdf
// 一次資料: https://www.nta.go.jp/publication/pamph/gensen/nencho2026/01.htm
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { calcNencho, choseiKojoGaku, tokuteiShinzokuKojo, sanshutsuZeigaku, kisaiRan, kekkaYoyaku } from "../docs/assets/nencho_core.js";
import { kyuyoShotokuR8 } from "../docs/assets/juminzei_core.js";

const rd = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const J = rd("../docs/assets/juminzei_r08.json");
const S = rd("../docs/assets/setsuzei_r08.json");
const N = rd("../docs/assets/nencho_r08.json");
const HYO = rd("./fixtures/nencho_kyuyo_hyo_r08.json");
const refs = { J, S, N };

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  try { assert.deepEqual(got, want); pass++; }
  catch { fail++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const ok = (name, cond) => eq(name, !!cond, true);

// ── ① 設例（省略する場合）57〜59頁 ─────────────────────────────────────
const SETTEI_A = {
  kyuyo: 8970000, choshu: 156670, shaho: 1386102,
  seiho: { ippan_shin: 80000, ippan_kyu: 35000, kaigo: 80000, nenkin_shin: 30000, nenkin_kyu: 90000 },
  jishin: { jishin: 42000, kyuChoki: 14800 },
  haigu: { ari: true, gokei: 500000, rojin: false, shogai: "none" },
  // 一般の控除対象扶養親族1人（年齢は設例に無いので23〜69歳で置く。特定扶養親族がいるので23歳未満の判定は変わらない）
  fuyo: { ippan2369: 1, tokutei: 1, dokyoRojin: 1 },
  fuyoShogai: { ippan: 1 },        // 老人扶養親族（同居老親等かつ一般の障害者）
  tokuteiShinzoku: [1000000],      // 給与所得の金額100万円
  jutaku: 76500,
};
{
  const r = calcNencho(SETTEI_A, refs);
  eq("設例A ok", r.ok, true);
  eq("設例A ⑨ 給与所得控除後", r.kojoGo, 7020000);
  eq("設例A ⑩ 所得金額調整控除", r.chosei, 47000);
  eq("設例A ⑪ 調整控除後", r.choseiGo, 6973000);
  eq("設例A ⑫ 社会保険料等", r.kojo.shaho, 1386102);
  eq("設例A ⑮ 生命保険料（23歳未満特例で一般6万）", r.kojo.seiho, 120000);
  eq("設例A ⑯ 地震保険料", r.kojo.jishin, 50000);
  eq("設例A ⑰ 配偶者控除", r.kojo.haigu, 380000);
  eq("設例A ⑱ 特定親族特別控除", r.kojo.tokutei, 410000);
  eq("設例A ⑲ 扶養控除等", r.kojo.fuyoTou, 1860000);
  eq("設例A ⑳ 基礎控除（655万超）", r.kojo.kiso, 620000);
  eq("設例A ㉑ 所得控除合計", r.kojo.gokei, 4826102);
  eq("設例A ㉒ 課税給与所得", r.kazei, 2146000);
  eq("設例A ㉓ 算出所得税額", r.sanshutsu, 117100);
  eq("設例A ㉔ 住宅ローン控除", r.jutaku, 76500);
  eq("設例A ㉕ 年調所得税額", r.nenchoShotoku, 40600);
  eq("設例A ㉖ 年調年税額", r.nenzei, 41400);
  eq("設例A ㉗ 超過額", r.kanpu, 115270);
  eq("設例A 不足額なし", r.fusoku, 0);
  // 生保の内訳（58頁: 一般60,000＋介護40,000＋個人年金47,500＝147,500→120,000）
  ok("設例A 生保は特例適用", r.seihoTokurei);
}
// ★特例が効かない（23歳未満の扶養親族がいない）と一般の生命保険料の控除額が変わることを確かめる＝
//   特例の判定が実際に結果を動かしている（判定を常に偽にする誤りを落とせる網か）
{
  const r = calcNencho({ ...SETTEI_A, fuyo: { ippan2369: 2, dokyoRojin: 1 } }, refs);
  ok("23歳未満なし → 所得金額調整控除なし", r.chosei === 0);
}

// ── ② 設例（省略しない場合）PDF 203 ───────────────────────────────────
{
  const r = calcNencho({
    kyuyo: 4390000, choshu: 51845, shaho: 641525,
    seiho: { ippan_kyu: 50200, nenkin_shin: 56000 },
    jishin: { jishin: 45000 },
    haigu: { ari: true, gokei: 0 },
    fuyo: { ippan2369: 1 },
  }, refs);
  eq("設例B ⑨", r.kojoGo, 3070400);
  eq("設例B ⑩ 調整控除なし", r.chosei, 0);
  eq("設例B ⑮ 生保", r.kojo.seiho, 71550);
  eq("設例B ⑯ 地震", r.kojo.jishin, 45000);
  eq("設例B ⑰ 配偶者", r.kojo.haigu, 380000);
  eq("設例B ⑲ 扶養", r.kojo.fuyoTou, 380000);
  eq("設例B ⑳ 基礎控除104万", r.kojo.kiso, 1040000);
  eq("設例B ㉑", r.kojo.gokei, 2558075);
  eq("設例B ㉒", r.kazei, 512000);
  eq("設例B ㉓", r.sanshutsu, 25600);
  eq("設例B ㉖", r.nenzei, 26100);
  eq("設例B ㉗ 超過額", r.kanpu, 25745);
}

// ── ③ 給与所得控除後の給与等の金額の表 全行 ──────────────────────────
{
  ok("表の行数（1,103行）", HYO.rows.length === 1103);
  let bad = 0;
  for (const [a, b, c] of HYO.rows) {
    if (kyuyoShotokuR8(a, J) !== c || kyuyoShotokuR8(b - 1, J) !== c) bad++;
  }
  eq("表の全行が一致", bad, 0);
  eq("741,000円未満は0", kyuyoShotokuR8(740999, J), 0);
  eq("741,000円は1,000円", kyuyoShotokuR8(741000, J), 1000);
  eq("2,190,999円は収入−74万", kyuyoShotokuR8(2190999, J), 1450999);
  eq("例 7,654,321円（×90%−110万・1円未満切捨て）", kyuyoShotokuR8(7654321, J), 5788888);
  eq("850万超（−195万）", kyuyoShotokuR8(8970000, J), 7020000);
  eq("2,000万円", kyuyoShotokuR8(20000000, J), 18050000);
}

// ── ④ 所得金額調整控除・速算表の例 ─────────────────────────────────
eq("所得金額調整控除 例 8,765,432円→26,544円（切上げ）", choseiKojoGaku(8765432, true, N), 26544);
eq("所得金額調整控除 850万ちょうどは0", choseiKojoGaku(8500000, true, N), 0);
eq("所得金額調整控除 1,000万超は上限15万", choseiKojoGaku(15000000, true, N), 150000);
eq("所得金額調整控除 対象外は0", choseiKojoGaku(9000000, false, N), 0);
eq("速算表 例 2,696,000円→172,100円", sanshutsuZeigaku(2696000, N), 172100);
eq("速算表 1,950,000円（5%の上端）", sanshutsuZeigaku(1950000, N), 97500);
eq("速算表 18,050,000円（40%）", sanshutsuZeigaku(18050000, N), 4424000);

// ── ⑤ 特定親族特別控除: 84条の2第1項の算式（独立実装）とデータの表を全域照合 ────
function tokuteiByStatute(x) {
  if (x <= 620000 || x > 1230000) return null;          // 62万円以下は扶養親族、123万円超は対象外
  if (x <= 850000) return 630000;                        // 一号
  if (x <= 1150000) {                                    // 二号
    const m = (x - 840001) * 2;
    // 「十万円の整数倍の金額から八万円を控除した金額でないときは、…で当該乗じた金額に満たないもののうち最も多い金額」
    let k = 0;
    if ((m + 80000) % 100000 === 0) k = m;
    else k = Math.floor((m + 80000) / 100000) * 100000 - 80000;
    return 630000 - k;
  }
  if (x <= 1200000) return 60000;                        // 三号
  return 30000;                                          // 四号
}
{
  let bad = 0, first = null;
  for (let x = 600000; x <= 1250000; x++) {
    if (tokuteiShinzokuKojo(x, N) !== tokuteiByStatute(x)) { bad++; first ??= x; }
  }
  eq(`特定親族 表＝条文の算式（60万〜125万を1円刻み）${first != null ? " 最初の不一致 " + first : ""}`, bad, 0);
  eq("特定親族 設例の100万円→41万円", tokuteiShinzokuKojo(1000000, N), 410000);
}

// ── 境界・申告すべきこと ─────────────────────────────────────────────
{
  const r = calcNencho({ kyuyo: 20000001, choshu: 0 }, refs);
  ok("2,000万円超は年末調整の対象外", !r.ok && r.reason === "over_20m");
}
{
  // 住宅ローン控除が算出所得税額を超える → 年調所得税額0、引ききれない分は切捨て（源泉徴収票の可能額欄へ）
  const r = calcNencho({ kyuyo: 4390000, choshu: 51845, shaho: 641525, jutaku: 300000 }, refs);
  ok("住宅ローン 年調所得税額0", r.nenchoShotoku === 0 && r.nenzei === 0);
  ok("住宅ローン 引ききれない分", r.jutakuKirisute === 300000 - r.sanshutsu && r.jutakuKirisute > 0);
  eq("住宅ローン 徴収税額が全額超過額", r.kanpu, 51845);
}
{
  // 不足額: 徴収が少ない
  const r = calcNencho({ kyuyo: 6000000, choshu: 100000, shaho: 900000 }, refs);
  // 給与所得 4,360,000（表）・基礎控除 104万（合計所得489万以下）・課税 2,420,000 → 144,500 → ×1.021=147,534.5→147,500
  eq("不足 給与所得", r.kojoGo, 4360000);
  eq("不足 課税", r.kazei, 2420000);
  eq("不足 算出", r.sanshutsu, 144500);
  eq("不足 年税", r.nenzei, 147500);
  eq("不足額", r.fusoku, 47500);
  eq("不足 還付0", r.kanpu, 0);
}
{
  // ★16〜18歳の子は「一般の控除対象扶養親族」だが23歳未満 → 生保特例と所得金額調整控除が効く
  const base = { kyuyo: 9000000, choshu: 0, seiho: { ippan_shin: 120000 } };
  const a = calcNencho({ ...base, fuyo: { ippan1618: 1 } }, refs);
  const b = calcNencho({ ...base, fuyo: { ippan2369: 1 } }, refs);
  eq("16〜18歳 → 生保 一般6万", a.kojo.seiho, 60000);
  eq("23〜69歳 → 生保 一般4万", b.kojo.seiho, 40000);
  eq("16〜18歳 → 所得金額調整控除 5万", a.chosei, 50000);
  eq("23〜69歳 → 所得金額調整控除なし", b.chosei, 0);
  eq("扶養控除は同じ38万", [a.kojo.fuyo, b.kojo.fuyo], [380000, 380000]);
  // 年少（16歳未満）は扶養控除0だが23歳未満の判定には入る
  const c = calcNencho({ ...base, fuyo: { nensho: 1 } }, refs);
  eq("年少 → 扶養控除0", c.kojo.fuyo, 0);
  eq("年少 → 所得金額調整控除 5万", c.chosei, 50000);
  // ★特定親族（19〜22歳・62万円超）は扶養親族ではない → 判定に数えない
  const d = calcNencho({ ...base, tokuteiShinzoku: [900000] }, refs);
  eq("特定親族だけ → 調整控除なし", d.chosei, 0);
  eq("特定親族だけ → 生保特例なし", d.kojo.seiho, 40000);
}
{
  // 配偶者の障害者控除は同一生計配偶者（62万円以下）だけ。本人が1,000万円超でも受けられる
  const hi = calcNencho({ kyuyo: 13000000, choshu: 0, haigu: { ari: true, gokei: 0, shogai: "tokubetsu" } }, refs);
  eq("本人1,000万超 配偶者控除0", hi.kojo.haigu, 0);
  eq("本人1,000万超でも配偶者の特別障害者控除40万", hi.kojo.shogai, 400000);
  ok("配偶者が特別障害者 → 所得金額調整控除の対象", hi.chosei === 150000);
  const lo = calcNencho({ kyuyo: 5000000, choshu: 0, haigu: { ari: true, gokei: 900000, shogai: "ippan" } }, refs);
  eq("配偶者62万超 → 障害者控除なし", lo.kojo.shogai, 0);
  ok("配偶者62万超 → 配偶者特別控除はある", lo.kojo.haigu === 380000);
  ok("配偶者62万超の障害者 → 申告する", lo.notes.some((t) => /同一生計配偶者/.test(t)));
}
{
  // 寡婦・ひとり親は合計所得500万円以下
  const k1 = calcNencho({ kyuyo: 6000000, choshu: 0, honnin: { kafu: "hitorioya" } }, refs);
  eq("ひとり親 35万（合計所得436万）", k1.kojo.kafu, 350000);
  const k2 = calcNencho({ kyuyo: 7000000, choshu: 0, honnin: { kafu: "hitorioya" } }, refs);
  eq("ひとり親 合計所得500万超は0", k2.kojo.kafu, 0);
  ok("ひとり親 500万超を申告", k2.notes.some((t) => /500万円/.test(t)));
}
{
  // 給与以外の所得は課税給与所得に足さないが、合計所得金額（基礎控除の段）には足す
  const a = calcNencho({ kyuyo: 6000000, choshu: 0, shaho: 900000 }, refs);
  const b = calcNencho({ kyuyo: 6000000, choshu: 0, shaho: 900000, otherIncome: 600000 }, refs);
  eq("他の所得なし 基礎控除104万", a.kojo.kiso, 1040000);
  eq("他の所得60万 → 合計所得496万 → 基礎控除67万", b.kojo.kiso, 670000);
  ok("他の所得は課税給与所得に足さない（基礎控除の差だけ増える）", b.kazei - a.kazei === 370000);
  ok("他の所得20万超 → 確定申告を申告", b.notes.some((t) => /確定申告/.test(t)));
}
{
  // 特定親族の範囲外の入力は答えずに直させる
  const r = calcNencho({ kyuyo: 5000000, choshu: 0, tokuteiShinzoku: [500000] }, refs);
  ok("特定親族 62万以下 → エラー", !r.ok && r.errors.some((t) => /特定扶養親族/.test(t)));
}

// ── 照合1周目（sol 6.1）の high を固定する ───────────────────────────
{
  // 設例B: 超過額25,745円のうち、最後の給与で徴収すべき6,963円に充当し、18,782円を還付（設例PDF203の15）
  const r = calcNencho({
    kyuyo: 4390000, choshu: 51845, shaho: 641525, lastTax: 6963,
    seiho: { ippan_kyu: 50200, nenkin_shin: 56000 }, jishin: { jishin: 45000 },
    haigu: { ari: true, gokei: 0 }, fuyo: { ippan2369: 1 },
  }, refs);
  eq("設例B 超過額", r.kanpu, 25745);
  eq("設例B 充当", r.juto, 6963);
  eq("設例B 本人に還付", r.kanpuGaku, 18782);
}
{
  // 他の勤務先の給与は合計所得金額に入る（年調の課税標準には入らない）: 主600万＋従100万
  const a = calcNencho({ kyuyo: 6000000, choshu: 0, otherKyuyo: 1000000 }, refs);
  eq("従たる給与 → 合計所得520万（全給与700万の給与所得）", a.gokei, 5200000);
  eq("従たる給与 → 基礎控除67万", a.kojo.kiso, 670000);
  eq("従たる給与 → 課税は主たる給与だけ", a.kojoGo, 4360000);
  // 損益通算後の赤字: 給与700万・事業損失50万 → 合計所得470万 → 基礎控除104万
  const b = calcNencho({ kyuyo: 7000000, choshu: 0, otherIncome: -500000 }, refs);
  eq("赤字の通算 → 合計所得470万", b.gokei, 4700000);
  eq("赤字の通算 → 基礎控除104万", b.kojo.kiso, 1040000);
  // 給与600万＋公的年金の雑所得60万 → 41条の3の11第2項で10万円を引いて486万 → 基礎控除104万
  const c = calcNencho({ kyuyo: 6000000, choshu: 0, nenkinZatsu: 600000 }, refs);
  eq("年金あり → 2項の調整10万", c.allChosei2, 100000);
  eq("年金あり → 合計所得486万", c.gokei, 4860000);
  eq("年金あり → 基礎控除104万", c.kojo.kiso, 1040000);
  // 配偶者が扶養控除を受ける16歳の子: 扶養控除は付けないが、調整控除・生保特例は効く
  const d = calcNencho({ kyuyo: 9000000, choshu: 0, seiho: { ippan_shin: 120000 }, fuyoOther: { under23: 1 } }, refs);
  eq("他の人が扶養する子 → 扶養控除0", d.kojo.fuyo, 0);
  eq("他の人が扶養する子 → 調整控除5万", d.chosei, 50000);
  eq("他の人が扶養する子 → 生保6万", d.kojo.seiho, 60000);
}

{
  // 超過額が未徴収の税額より小さい → 還付0・最後の給与で差額を天引き（年末調整のしかた40頁〔注意事項〕1）
  const base = calcNencho({ kyuyo: 3000000, choshu: 0 }, refs);
  const r = calcNencho({ kyuyo: 3000000, choshu: base.nenzei + 5000, lastTax: 10000 }, refs);
  eq("超過5,000・未徴収10,000 → 還付0", r.kanpuGaku, 0);
  eq("超過5,000・未徴収10,000 → 最後に5,000天引き", r.lastChoshu, 5000);
}

{
  // 未払給与の未徴収税額は、最後の給与ではなく未払給与の支払時に徴収する（40頁〔注意事項〕2）
  const base = calcNencho({ kyuyo: 3000000, choshu: 0 }, refs);
  const r = calcNencho({ kyuyo: 3000000, choshu: base.nenzei + 7000, miharaiTax: 10000 }, refs);
  eq("未払 充当7,000", r.jutoMiharai, 7000);
  eq("未払 還付0", r.kanpuGaku, 0);
  eq("未払 最後の給与の徴収なし", r.lastChoshu, 0);
  eq("未払 支払時に3,000", r.miharaiChoshu, 3000);
}

{
  // 特定支出控除は合計所得金額の判定にだけ効く: 給与600万・その他60万・特定支出10万 → 486万 → 基礎控除104万
  const r = calcNencho({ kyuyo: 6000000, choshu: 0, shaho: 900000, otherIncome: 600000, tokushitsu: 100000 }, refs);
  eq("特定支出 → 合計所得486万", r.gokei, 4860000);
  eq("特定支出 → 基礎控除104万", r.kojo.kiso, 1040000);
  eq("特定支出 → 年調年税額147,500", r.nenzei, 147500);
}

// ── ⑥ 法定調書の手引 記載例1（年末調整を行った一般の受給者）──────────────
// 入力は手引13〜15頁の源泉徴収簿・保険料控除申告書・配偶者控除等申告書・特定親族特別控除申告書・
// 扶養控除等申告書から。国税次郎は平成21年2月2日生（令和8年12月31日に17歳＝16〜18歳）、
// 国税孝男は昭和15年生で同居老親等、障害者（一般）は扶養親族に1人、国税三郎は16歳未満。
// ★地震保険料の支払額は手引に載っていない。地震保険料の控除額⑯44,800円から、旧長期損害保険料19,600円の
//   控除額14,800円（19,600×1/2＋5,000）を引いた30,000円を地震保険料として入れる（5万円以下は全額控除なので一意）。
const KISAI_1 = {
  kyuyo: 9620000, choshu: 372460, shaho: 1483023, shahoShinkoku: 176460,
  seiho: { ippan_shin: 24000, ippan_kyu: 36000, kaigo: 48000, nenkin_shin: 53000, nenkin_kyu: 72000 },
  jishin: { jishin: 30000, kyuChoki: 19600 },
  haigu: { ari: true, gokei: 400000, rojin: false, shogai: "none" },
  fuyo: { ippan1618: 1, dokyoRojin: 1, nensho: 1 },
  fuyoShogai: { ippan: 1 },
  tokuteiShinzoku: [950000],
};
{
  const r = calcNencho(KISAI_1, refs);
  eq("記載例1 ok", r.ok, true);
  eq("記載例1 ⑨", r.kojoGo, 7670000);
  eq("記載例1 ⑩ 所得金額調整控除", r.chosei, 112000);
  eq("記載例1 ⑪ 調整控除後", r.choseiGo, 7558000);
  eq("記載例1 ⑫＋⑬＋⑭ 社会保険料等", r.kojo.shaho, 1659483);
  eq("記載例1 ⑮ 生命保険料（特例で上限12万）", r.kojo.seiho, 120000);
  eq("記載例1 ⑯ 地震保険料", r.kojo.jishin, 44800);
  eq("記載例1 ⑰ 配偶者控除", r.kojo.haigu, 380000);
  eq("記載例1 ⑱ 特定親族特別控除（95万→51万）", r.kojo.tokutei, 510000);
  eq("記載例1 ⑲ 扶養控除等（38万＋58万＋27万）", r.kojo.fuyoTou, 1230000);
  eq("記載例1 ⑳ 基礎控除", r.kojo.kiso, 620000);
  eq("記載例1 ㉑ 所得控除合計", r.kojo.gokei, 4564283);
  eq("記載例1 ㉒ 課税給与所得", r.kazei, 2993000);
  eq("記載例1 ㉓ 算出所得税額", r.sanshutsu, 201800);
  eq("記載例1 ㉕ 年調所得税額", r.nenchoShotoku, 201800);
  eq("記載例1 ㉖ 年調年税額", r.nenzei, 206000);
  eq("記載例1 ㉗ 超過額", r.kanpu, 166460);
  eq("記載例1 ㉚ 差引還付する金額", r.kanpuGaku, 166460);

  // 源泉徴収票の欄（手引15頁の見本の値）
  const hyo = Object.fromEntries(kisaiRan(r).filter((x) => x.hyo).map((x) => [x.hyo, x.value]));
  eq("記載例1 票: 欄の集合", Object.keys(hyo).sort(), [
    "住宅借入金等特別控除の額", "基礎控除の額", "所得控除の額の合計額", "所得金額調整控除額",
    "源泉徴収税額", "特定親族特別控除の額", "生命保険料の控除額", "社会保険料等の金額",
    "給与所得控除後の金額（調整控除後）", "支払金額", "地震保険料の控除額", "配偶者（特別）控除の額"].sort());
  eq("記載例1 票: 支払金額", hyo["支払金額"], 9620000);
  eq("記載例1 票: 給与所得控除後の金額（調整控除後）", hyo["給与所得控除後の金額（調整控除後）"], 7558000);
  eq("記載例1 票: 所得控除の額の合計額", hyo["所得控除の額の合計額"], 4564283);
  eq("記載例1 票: 源泉徴収税額＝年調年税額（天引きの合計ではない）", hyo["源泉徴収税額"], 206000);
  eq("記載例1 票: 配偶者（特別）控除の額", hyo["配偶者（特別）控除の額"], 380000);
  eq("記載例1 票: 特定親族特別控除の額", hyo["特定親族特別控除の額"], 510000);
  eq("記載例1 票: 社会保険料等の金額", hyo["社会保険料等の金額"], 1659483);
  eq("記載例1 票: 生命保険料の控除額", hyo["生命保険料の控除額"], 120000);
  eq("記載例1 票: 地震保険料の控除額", hyo["地震保険料の控除額"], 44800);
  eq("記載例1 票: 基礎控除の額", hyo["基礎控除の額"], 620000);
  eq("記載例1 票: 所得金額調整控除額", hyo["所得金額調整控除額"], 112000);
  ok("記載例1 票: 源泉徴収税額は徴収税額の合計と違う（取り違えを落とす）", hyo["源泉徴収税額"] !== r.choshu);
  // 源泉徴収簿の欄番号（年末調整のしかた57頁）
  const bo = Object.fromEntries(kisaiRan(r).map((x) => [x.bo, x.value]));
  eq("記載例1 簿: ⑦⑧⑪㉑㉖㉗", [bo["⑦"], bo["⑧"], bo["⑪"], bo["㉑"], bo["㉖"], bo["㉗"]],
     [9620000, 372460, 7558000, 4564283, 206000, 166460]);
  const y = kekkaYoyaku(r, N);
  eq("記載例1 要約", [y.year, y.nenzei, y.choshu, y.kubun, y.sagaku], ["令和8年分", 206000, 372460, "kanpu", 166460]);
  ok("要約: 改正の適用をデータから申告", /令和8年12月1日施行/.test(y.kaisei) && /令和8年分以後/.test(y.kaisei));
}
// 設例A（年末調整のしかた57頁）でも票の欄を照合: 住宅借入金等特別控除の額は㉔の76,500円
{
  const r = calcNencho(SETTEI_A, refs);
  const hyo = Object.fromEntries(kisaiRan(r).filter((x) => x.hyo).map((x) => [x.hyo, x.value]));
  eq("設例A 票: 支払金額・調整控除後・控除合計・源泉徴収税額・住宅",
    [hyo["支払金額"], hyo["給与所得控除後の金額（調整控除後）"], hyo["所得控除の額の合計額"], hyo["源泉徴収税額"], hyo["住宅借入金等特別控除の額"]],
    [8970000, 6973000, 4826102, 41400, 76500]);
  // 住宅ローン控除が算出所得税額を超えるときは、票には算出所得税額を限度に書く（手引⑰の注）
  const big = calcNencho({ kyuyo: 4390000, choshu: 51845, shaho: 641525, jutaku: 300000 }, refs);
  const hb = Object.fromEntries(kisaiRan(big).filter((x) => x.hyo).map((x) => [x.hyo, x.value]));
  eq("票: 住宅借入金等特別控除の額は算出所得税額が限度", hb["住宅借入金等特別控除の額"], big.sanshutsu);
  // 不足のときは区分が不足・差額は不足額
  const f = kekkaYoyaku(calcNencho({ kyuyo: 6000000, choshu: 100000, shaho: 900000 }, refs), N);
  eq("要約: 不足", [f.kubun, f.sagaku, f.nenzei], ["fusoku", 47500, 147500]);
}

// ── ⑦ 改正のあらまし（令和8年4月）の境目 ──────────────────────────────
// 基礎控除: 合計所得489万円以下＝104万（給与だけなら665万5,556円以下）／655万円以下＝67万（850万円以下）
{
  const kiso = (kyuyo) => calcNencho({ kyuyo, choshu: 0 }, refs).kojo.kiso;
  eq("あらまし 給与6,655,556円 → 基礎控除104万", kiso(6655556), 1040000);
  eq("あらまし 給与6,655,557円 → 基礎控除67万", kiso(6655557), 670000);
  eq("あらまし 給与8,500,000円 → 基礎控除67万", kiso(8500000), 670000);
  eq("あらまし 給与8,500,001円 → 基礎控除62万", kiso(8500001), 620000);
  // 1頁ハ: 令和8・9年分の給与所得の金額（69万1,000円以上220万円未満）
  eq("あらまし ハ 691,000円 → なし(0)", kyuyoShotokuR8(691000, J), 0);
  eq("あらまし ハ 741,000円 → 収入−74万", kyuyoShotokuR8(741000, J), 1000);
  eq("あらまし ハ 2,190,999円 → 収入−74万", kyuyoShotokuR8(2190999, J), 1450999);
  eq("あらまし ハ 2,191,000円 → 145万1,000円", kyuyoShotokuR8(2191000, J), 1451000);
  eq("あらまし ハ 2,192,999円 → 145万1,000円", kyuyoShotokuR8(2192999, J), 1451000);
  eq("あらまし ハ 2,193,000円 → 145万3,000円", kyuyoShotokuR8(2193000, J), 1453000);
  eq("あらまし ハ 2,196,000円 → 145万6,000円", kyuyoShotokuR8(2196000, J), 1456000);
  eq("あらまし ハ 2,199,999円 → 145万6,000円", kyuyoShotokuR8(2199999, J), 1456000);
  // 2頁⑶ 所得要件の給与換算（扶養62万＝136万／特定親族123万＝197万／配偶者特別133万＝207万／勤労学生89万＝163万）
  eq("あらまし 給与136万 → 所得62万", kyuyoShotokuR8(1360000, J), 620000);
  eq("あらまし 給与197万 → 所得123万", kyuyoShotokuR8(1970000, J), 1230000);
  eq("あらまし 給与207万 → 所得133万", kyuyoShotokuR8(2070000, J), 1330000);
  eq("あらまし 給与163万 → 所得89万", kyuyoShotokuR8(1630000, J), 890000);
}

// ── 壊しテスト（規則2: 無傷が緑であることは上で確かめ済み）──
{
  const N2 = JSON.parse(JSON.stringify(N)); N2.nenzei.rate_num = 1000;
  const r = calcNencho(SETTEI_A, { J, S, N: N2 });
  ok("壊し: 復興特別所得税（102.1%）を落とすと設例Aの年調年税額が変わる", r.nenzei !== 41400);
  const N3 = JSON.parse(JSON.stringify(N)); N3.chosei_kojo.rounding = "floor"; N3.chosei_kojo.max = 140000;
  ok("壊し: 調整控除の上限を変えると1,000万超の値が変わる", choseiKojoGaku(12000000, true, N3) !== 150000);
}

// ── ページ（年度はデータから描く・必須の配線）──
{
  const html = readFileSync(new URL("../docs/nenmatsu-chosei/index.html", import.meta.url), "utf8");
  ok("page: nencho_core を読む", /assets\/nencho_core\.js/.test(html));
  ok("page: 3つの参照データを await", /await\s+Promise\.all\(\[jReady, sReady, nReady\]\)/.test(html));
  ok("page: 読み込み失敗を申告", /読み込めませんでした/.test(html));
  ok("page: 年分はデータから（_meta.year を使う）", /_meta\?*\.year|_meta\.year/.test(html));
  ok("page: 欄の対応は core の kisaiRan から描く", /kisaiRan\(r\)/.test(html));
  ok("page: 要約は core の kekkaYoyaku から描く", /kekkaYoyaku\(r, N\)/.test(html));
}

console.log(`test_nencho: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
