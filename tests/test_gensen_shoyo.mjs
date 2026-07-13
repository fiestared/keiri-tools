/**
 * 賞与に対する源泉徴収税額（算出率の表・令和8年分）のテスト。
 *
 *   node tests/test_gensen_shoyo.mjs
 *
 * オラクルの取り方（ここが肝）:
 *  1. 令和8年分の「税額表の使い方」PDF(19-22.pdf)に**使用例**がある → 数値をそのまま固定
 *  2. タックスアンサー No.2523 にも計算例が3つあるが、**あれは令和7年分**
 *     （ページに「令和8年分以後の表は改正されています」と明記されている）。
 *     したがって **No.2523の数値を令和8年分のデータに当てて検算してはいけない**。
 *     そこで、月額表の税額を**外から注入**できるようにしてあるのを使い、
 *     No.2523が示している月額表の税額（令和7年分）を注入して**算式だけ**を検算する。
 *     （÷6の切捨て・+前月・−前月の税額・×6 が正しいか。表の中身とは独立に効く）
 *  3. 表そのものは BigInt の厳密計算を独立オラクルにして全数照合する
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  findRate, taxFromRate, calcShoyo, taxViaGetsugaku, getsugakuRequired, divisorFor,
} from '../docs/assets/gensen_shoyo_core.js';
import { kouTax, otsuTax } from '../docs/assets/gensen_kyuyo_core.js';

const table = JSON.parse(readFileSync(new URL('../docs/assets/gensen_shoyo_r08.json', import.meta.url)));
const getsugaku = JSON.parse(readFileSync(new URL('../docs/assets/gensen_getsugaku_r08.json', import.meta.url)));

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok ${name}`); };

// 本番と同じ月額表の引き方（例外計算で使う）
const monthlyTax = (amount, kubun) =>
  kubun === 'otsu' ? otsuTax(getsugaku, amount) : kouTax(getsugaku, amount, 0);

console.log('賞与 — 国税庁の使用例（令和8年分・使い方PDF 19-22.pdf）');

// 〔設例〕賞与554,000円 / 賞与から控除する社保85,593円 / 前月の普通給与(社保控除後)196,616円 / 扶養2人
// ① 甲欄・扶養2人の「143千円以上276千円未満」の行 → 2.042%
// ② (554,000 − 85,593) = 468,407円 × 2.042% = 9,564円（1円未満切捨て）
t('使用例: 率は2.042%、引いた行は143千円以上276千円未満', () => {
  const hit = findRate(table, 196_616, 2, 'kou');
  assert.equal(hit.ratePercent, 2.042);
  assert.deepEqual([hit.band.min, hit.band.max], [143, 276]);
});

t('使用例: 税額は9,564円', () => {
  const r = calcShoyo({
    table, shoyo: 554_000, shoyoIns: 85_593,
    zengetsu: 196_616, zengetsuIns: 0, zengetsuPaid: true,
    dependents: 2, kubun: 'kou', months: 6, monthlyTax,
  });
  assert.equal(r.method, 'rate');
  assert.equal(r.shoyoAfterIns, 468_407);
  assert.equal(r.ratePercent, 2.042);
  assert.equal(r.tax, 9_564);
});

console.log('\n賞与 — 月額表による例外計算（算式の検算・No.2523の計算例。令和7年分なので月額表の税額は注入する）');

// No.2523「前月の給与の10倍を超える賞与を支払う場合」（令和7年分）
//  (1) 前月中の給与(社保控除後) 166,531円
//  (2) 賞与(社保控除後・計算期間6か月) 1,668,062円 / 扶養1人
//  イ 1,668,062 ÷ 6 = 278,010円（1円未満切捨て）
//  ロ 278,010 + 166,531 = 444,541円
//  ハ 月額表 甲欄 444,541円・扶養1人 → 16,950円
//  ニ 月額表 甲欄 166,531円・扶養1人 → 1,930円
//  ホ (16,950 − 1,930) × 6 = 90,120円
t('10倍超の算式: ÷6→+前月→月額表→−前月税額→×6 で90,120円（月額表の値はNo.2523のものを注入）', () => {
  const r7 = { 444_541: 16_950, 166_531: 1_930 };
  const r = taxViaGetsugaku({
    shoyoAfterIns: 1_668_062,
    zengetsuAfterIns: 166_531,
    months: 6,
    monthlyTax: (a) => {
      assert.ok(a in r7, `月額表を引いた金額 ${a} が計算例と違う（算式がずれている）`);
      return r7[a];
    },
  });
  assert.equal(r.steps.perMonth, 278_010);   // イ（1円未満切捨て）
  assert.equal(r.steps.combined, 444_541);   // ロ
  assert.equal(r.tax, 90_120);               // ホ
});

// No.2523「前月に給与の支払がない場合」（令和7年分）
//  (1) 賞与(社保控除後・計算期間6か月) 769,300円 / 扶養1人
//  イ 769,300 ÷ 6 = 128,216円（1円未満切捨て）
//  ロ 月額表 甲欄 128,216円・扶養1人 → 530円
//  ハ 530 × 6 = 3,180円
t('前月なしの算式: ÷6→月額表→×6 で3,180円', () => {
  const r = taxViaGetsugaku({
    shoyoAfterIns: 769_300,
    zengetsuAfterIns: 0,
    months: 6,
    monthlyTax: (a) => {
      assert.equal(a, 128_216, '前月がないのに前月分を足している');
      return 530;
    },
  });
  assert.equal(r.steps.perMonth, 128_216);
  assert.equal(r.tax, 3_180);
});

t('計算期間が6か月を超えると12で割り12を掛ける', () => {
  assert.equal(divisorFor(6), 6);
  assert.equal(divisorFor(7), 12);
  assert.equal(divisorFor(12), 12);
  const r = taxViaGetsugaku({
    shoyoAfterIns: 1_200_000, zengetsuAfterIns: 0, months: 12,
    monthlyTax: (a) => { assert.equal(a, 100_000); return 1_000; },
  });
  assert.equal(r.tax, 12_000);
});

console.log('\n賞与 — 例外に入る条件（表の備考4）');

t('ちょうど10倍は表を使う。10倍を「超える」と月額表', () => {
  const base = {
    table, shoyoIns: 0, zengetsu: 200_000, zengetsuIns: 0, zengetsuPaid: true,
    dependents: 0, kubun: 'kou', months: 6, monthlyTax,
  };
  assert.equal(calcShoyo({ ...base, shoyo: 2_000_000 }).method, 'rate');       // ちょうど10倍
  assert.equal(calcShoyo({ ...base, shoyo: 2_000_001 }).method, 'getsugaku');  // 10倍超
});

t('前月の給与が社会保険料等以下（控除後0円以下）なら月額表', () => {
  const r = calcShoyo({
    table, shoyo: 500_000, shoyoIns: 0,
    zengetsu: 80_000, zengetsuIns: 80_000, zengetsuPaid: true,
    dependents: 0, kubun: 'kou', months: 6, monthlyTax,
  });
  assert.equal(r.method, 'getsugaku');
  assert.equal(r.reason, 'no_prev');
});

t('前月に給与の支払がない場合は、前月分を足さない', () => {
  const r = calcShoyo({
    table, shoyo: 600_000, shoyoIns: 0,
    zengetsu: 0, zengetsuIns: 0, zengetsuPaid: false,
    dependents: 0, kubun: 'kou', months: 6, monthlyTax,
  });
  assert.equal(r.method, 'getsugaku');
  assert.equal(r.steps.combined, r.steps.perMonth);
  assert.equal(r.steps.taxZengetsu, 0);
});

t('getsugakuRequired: 通常のケースでは null', () => {
  assert.equal(
    getsugakuRequired({ zengetsuPaid: true, zengetsuAfterIns: 300_000, shoyoAfterIns: 600_000 }),
    null,
  );
});

console.log('\n賞与 — 表の引き方（境界・7人以上・乙欄）');

t('「以上・未満」の境界: 143千円ちょうどは2.042%、142,999円は0%', () => {
  assert.equal(findRate(table, 143_000, 2, 'kou').ratePercent, 2.042);
  assert.equal(findRate(table, 142_999, 2, 'kou').ratePercent, 0);
  assert.equal(findRate(table, 276_000, 2, 'kou').ratePercent, 4.084); // 未満は次の行へ
});

t('率0%の行では税額も0円', () => {
  const r = calcShoyo({
    table, shoyo: 300_000, shoyoIns: 0, zengetsu: 100_000, zengetsuIns: 0, zengetsuPaid: true,
    dependents: 2, kubun: 'kou', months: 6, monthlyTax,
  });
  assert.equal(r.ratePercent, 0);
  assert.equal(r.tax, 0);
});

// ★月額表と混同しやすい点★
// 月額表は「7人」＋7人を超える1人ごとに1,610円控除。賞与の算出率の表は列が「**7人以上**」で、
// 7人超の控除は無い（表の見出し・備考のどちらにも無い）。
t('甲欄は「7人以上」— 8人でも10人でも7人と同じ率（1,610円控除は無い）', () => {
  const a = findRate(table, 500_000, 7, 'kou');
  const b = findRate(table, 500_000, 8, 'kou');
  const c = findRate(table, 500_000, 12, 'kou');
  assert.equal(a.rate, b.rate);
  assert.equal(a.rate, c.rate);
  const tax7 = calcShoyo({
    table, shoyo: 500_000, shoyoIns: 0, zengetsu: 500_000, zengetsuIns: 0, zengetsuPaid: true,
    dependents: 7, kubun: 'kou', months: 6, monthlyTax,
  }).tax;
  const tax9 = calcShoyo({
    table, shoyo: 500_000, shoyoIns: 0, zengetsu: 500_000, zengetsuIns: 0, zengetsuPaid: true,
    dependents: 9, kubun: 'kou', months: 6, monthlyTax,
  }).tax;
  assert.equal(tax7, tax9, '賞与の表に1,610円控除を持ち込んでいる');
});

t('乙欄は5段しか使わない（10.210/20.420/30.630/38.798/45.945%）', () => {
  const used = table.rows.filter((r) => r.otsu).map((r) => r.rate / table.rateScale);
  assert.deepEqual(used, [10.21, 20.42, 30.63, 38.798, 45.945]);
  assert.equal(findRate(table, 0, 0, 'otsu').ratePercent, 10.21);
  assert.equal(findRate(table, 223_999, 0, 'otsu').ratePercent, 10.21);
  assert.equal(findRate(table, 224_000, 0, 'otsu').ratePercent, 20.42);
  assert.equal(findRate(table, 1_118_000, 0, 'otsu').ratePercent, 45.945);
  assert.equal(findRate(table, 99_999_999, 0, 'otsu').ratePercent, 45.945);
});

t('乙欄は扶養親族等の数を見ない', () => {
  for (const d of [0, 3, 7, 20]) {
    assert.equal(findRate(table, 300_000, d, 'otsu').ratePercent, 30.63);
  }
});

console.log('\n賞与 — 表の構造（抽出が壊れていないこと。Python側とは独立に検算する）');

t('21行・率は0%から45.945%まで単調増加', () => {
  assert.equal(table.rows.length, 21);
  assert.equal(table.rows[0].rate, 0);
  assert.equal(table.rows.at(-1).rate, 45_945);
  for (let i = 1; i < table.rows.length; i++) {
    assert.ok(table.rows[i].rate > table.rows[i - 1].rate);
  }
});

t('どの扶養人数でも、帯が0円から上限なしまで隙間なく続く', () => {
  for (let d = 0; d <= 7; d++) {
    const col = table.rows.map((r) => r.kou[d]);
    assert.equal(col[0].min, null, `扶養${d}人: 先頭に下限がある`);
    assert.equal(col.at(-1).max, null, `扶養${d}人: 最終行に上限がある`);
    for (let i = 1; i < col.length; i++) {
      assert.equal(col[i].min, col[i - 1].max, `扶養${d}人: ${i}行目で帯が切れている`);
    }
  }
});

t('どんな前月給与・扶養人数でも必ず率が1つ引ける（穴が無い）', () => {
  for (let d = 0; d <= 8; d++) {
    for (const a of [0, 1, 81_999, 82_000, 500_000, 3_622_000, 9_999_999]) {
      assert.ok(findRate(table, a, d, 'kou'), `扶養${d}人・${a}円で引けない`);
      assert.ok(findRate(table, a, d, 'otsu'), `乙・${a}円で引けない`);
    }
  }
});

console.log('\n賞与 — 端数処理（浮動小数点で1円ずれないこと。第8便の教訓）');

// ★実在する危険な入力★ 賞与550,000円（社保控除後）に 22.462% を掛けると、真の答えは
// 123,541円ちょうど。率を小数(0.22462)で持つと 2進数で表せず、掛けた結果が真の値をわずかに
// 下回るため floor が **123,540円** を返す（1円少ない）。550,000円の賞与はごくありふれた額で、
// 「ちょうど割り切れる入力が最も危険」（第8便の教訓）がそのまま出る。
// → 率は整数（10万分率）で持ち、割り算は最後に1回だけ。
t('浮動小数点なら1円ずれる実入力を固定: 550,000円 × 22.462% = 123,541円', () => {
  assert.equal(taxFromRate(550_000, 22_462), 123_541);
  assert.equal(Math.floor(550_000 * (22_462 / 100_000)), 123_540); // 素朴な実装はこう間違える
});

t('BigIntの厳密計算を独立オラクルにして全数照合（21率 × 金額5,001通り = 105,021件）', () => {
  const rates = table.rows.map((r) => r.rate);
  let checked = 0;
  let naiveWrong = 0;
  for (const rate of rates) {
    // 0から1,000円刻み（切りのよい金額＝最も危険な入力を必ず含める。
    // 1円から始めると 550,000円 のような round number を素通りしてしまい、罠を見逃す）
    for (let A = 0; A <= 5_000_000; A += 1_000) {
      const exact = Number((BigInt(A) * BigInt(rate)) / 100000n);
      const got = taxFromRate(A, rate);
      assert.equal(got, exact, `${A}円 × ${rate / 1000}% : ${got} ≠ ${exact}`);
      // 素朴な浮動小数点実装なら何件ずれるかを数える（危険性の実測）
      if (Math.floor(A * (rate / 100000)) !== exact) naiveWrong++;
      checked++;
    }
  }
  assert.ok(naiveWrong > 0, '浮動小数点でもずれない＝この検査が罠を踏めていない');
  console.log(`     ${checked.toLocaleString()}件照合・ズレ0（浮動小数点なら ${naiveWrong}件 ずれる）`);
});

t('境界: ちょうど割り切れる金額でも切り捨てで1円減らさない', () => {
  // 50,000円 × 2.042% = 1,021円ちょうど
  assert.equal(taxFromRate(50_000, 2042), 1_021);
  // 100,000円 × 45.945% = 45,945円ちょうど
  assert.equal(taxFromRate(100_000, 45_945), 45_945);
});

t('賞与が0円・社会保険料等が賞与以上なら税額0円', () => {
  assert.equal(taxFromRate(0, 45_945), 0);
  const r = calcShoyo({
    table, shoyo: 100_000, shoyoIns: 120_000,
    zengetsu: 300_000, zengetsuIns: 0, zengetsuPaid: true,
    dependents: 0, kubun: 'kou', months: 6, monthlyTax,
  });
  assert.equal(r.shoyoAfterIns, 0);
  assert.equal(r.tax, 0);
});

console.log(`\n${n} tests passed`);
