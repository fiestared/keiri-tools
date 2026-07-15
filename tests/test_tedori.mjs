/**
 * 手取り計算機コア（tedori_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値は tedori_core を通さずに固定した**定数**にする。特に 'none' モードの4点は、
 *   公開済みの記事「手取りの計算方法」(/column/tedori-keisan/) が本文の早見表に載せ、
 *   test_tedori_article.mjs / break_tedori.mjs が別に守っている値そのもの。
 *   合成（額面−社保−所得税−住民税）が1つでも狂えば、この定数に一致しなくなる。
 *
 *   [東京都・30歳・扶養0・住民税を除く] の手取り（記事の早見表と一致）:
 *     額面200,000 → 167,350 (83.7%)   額面250,000 → 207,086 (82.8%)
 *     額面300,000 → 249,610 (83.2%)   額面500,000 → 408,690 (81.7%)
 *
 *   内わけ（額面300,000・東京都・30歳・扶養0）:
 *     社会保険料(本人) 44,070 ＝ 健保14,775 + 支援金345 + 厚年27,450 + 雇用1,500
 *       （協会けんぽ東京 令和8年度の保険料額表と一致。tests/test_shaho_oracle.mjs が別に固定）
 *     社保控除後 255,930 → 源泉所得税(甲・扶養0) 6,320（国税庁 月額表 254,000〜257,000 の行・扶養0列）
 *     手取り(住民税除く) 249,610
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcTedori, shakaiHokenMonthly } from '../docs/assets/tedori_core.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../docs/assets/${f}`, import.meta.url)));
const S = load('shaho_rates_r08.json');
const T = load('gensen_getsugaku_r08.json');
const D = load('juminzei_r08.json');
const refs = { shahoRates: S, gensenTable: T, juminzeiData: D };

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

const base = { age: 30, prefecture: '東京都', dependents: 0, juminzeiMode: 'none' };

// ── 1. 'none' モードが記事の早見表を1円まで再現する（独立オラクル） ──────────
const HAYAMI = [
  { gross: 200000, tedori: 167350, rate: 83.7 },
  { gross: 250000, tedori: 207086, rate: 82.8 },
  { gross: 300000, tedori: 249610, rate: 83.2 },
  { gross: 500000, tedori: 408690, rate: 81.7 },
];
for (const h of HAYAMI) {
  t(`早見表 額面${h.gross} → 手取り${h.tedori}(${h.rate}%)`, () => {
    const r = calcTedori({ ...base, gross: h.gross }, refs);
    assert.strictEqual(r.tedori, h.tedori, `手取り ${r.tedori} ≠ ${h.tedori}`);
    assert.strictEqual(r.juminzeiMonthly, 0, 'none なら住民税0');
    assert.strictEqual((r.tedoriRate * 100).toFixed(1), h.rate.toFixed(1), '手取り率');
  });
}

// ── 2. 内わけ（額面300,000）が既知の一次情報値と一致 ────────────────────
t('内わけ: 社保44,070 / 社保控除後255,930 / 所得税6,320', () => {
  const r = calcTedori({ ...base, gross: 300000 }, refs);
  assert.strictEqual(r.shakaiHoken.self, 44070, '社保(本人)');
  assert.strictEqual(r.shakaiHoken.grade, 22, '健保 第22級');
  assert.strictEqual(r.shakaiHoken.standard, 300000, '標準報酬月額');
  assert.strictEqual(r.afterShaho, 255930, '社保控除後');
  assert.strictEqual(r.shotokuzei, 6320, '源泉所得税(甲・扶養0)');
  assert.strictEqual(r.totalDeduction, 44070 + 6320, '控除合計(住民税除)');
});

// ── 3. manual モード: 給与明細の住民税をそのまま引く ──────────────────
t('manual: 額面300,000・住民税(月)10,000 → 手取り239,610', () => {
  const r = calcTedori({ ...base, gross: 300000, juminzeiMode: 'manual', juminzeiManual: 10000 }, refs);
  assert.strictEqual(r.juminzeiMonthly, 10000, '住民税は入力値をそのまま');
  assert.strictEqual(r.tedori, 239610, '手取り = 249,610 − 10,000');
  assert.strictEqual(r.tedori, 300000 - r.totalDeduction, '恒等式');
});

// ── 4. estimate モード: この年収が前年も続いたと仮定した住民税（前年ベース） ──
// juminzei_core の検証済みの鎖（年収360万・社保52.8万・独身 → 住民税150,600円）が出力する額。
t('estimate: 額面300,000・独身 → 住民税(年)150,600・手取り237,060', () => {
  const r = calcTedori({ ...base, gross: 300000, juminzeiMode: 'estimate' }, refs);
  assert.strictEqual(r.juminzeiAnnual, 150600, '住民税(年・概算)');
  assert.strictEqual(r.juminzeiMonthly, 12550, '住民税(月・概算)=年÷12四捨五入');
  assert.strictEqual(r.tedori, 237060, '手取り = 249,610 − 12,550');
  // 記事が qualitatively 言う「住民税で月1〜2万円少なくなる」帯に入っていること
  assert.ok(r.juminzeiMonthly >= 10000 && r.juminzeiMonthly <= 20000, '月1〜2万円の帯');
});

// ── 5. 扶養が増えると所得税も住民税(概算)も下がる（単調性） ───────────────
t('扶養0→2で所得税が下がる（甲欄）', () => {
  const r0 = calcTedori({ ...base, gross: 300000, dependents: 0 }, refs);
  const r2 = calcTedori({ ...base, gross: 300000, dependents: 2 }, refs);
  assert.ok(r2.shotokuzei < r0.shotokuzei, `扶養2の所得税 ${r2.shotokuzei} < 扶養0 ${r0.shotokuzei}`);
  assert.strictEqual(r2.dependents, 2, '扶養親族等の数が渡る');
  const e0 = calcTedori({ ...base, gross: 300000, dependents: 0, juminzeiMode: 'estimate' }, refs);
  const e2 = calcTedori({ ...base, gross: 300000, dependents: 2, juminzeiMode: 'estimate' }, refs);
  assert.ok(e2.juminzeiAnnual < e0.juminzeiAnnual, '扶養が増えると住民税(概算)も下がる');
});

// ── 6. 介護保険（40〜64歳）が乗ると手取りが減る ────────────────────────
t('40歳は介護保険が乗り、30歳より社保が高い', () => {
  const r30 = calcTedori({ ...base, gross: 300000, age: 30 }, refs);
  const r40 = calcTedori({ ...base, gross: 300000, age: 40 }, refs);
  assert.strictEqual(r30.shakaiHoken.kaigoApplies, false, '30歳は介護なし');
  assert.strictEqual(r40.shakaiHoken.kaigoApplies, true, '40歳は介護あり');
  assert.ok(r40.shakaiHoken.self > r30.shakaiHoken.self, '介護保険ぶん社保が高い');
});

// ── 7. 手取りの恒等式（あらゆる入力で 額面 = 手取り + 控除合計） ───────────
t('恒等式: 額面 = 手取り + 社保 + 所得税 + 住民税', () => {
  for (const gross of [180000, 300000, 620000, 1000000]) {
    for (const mode of ['none', 'estimate', 'manual']) {
      const r = calcTedori({ ...base, gross, age: 45, dependents: 1, juminzeiMode: mode, juminzeiManual: 8000 }, refs);
      assert.strictEqual(
        r.tedori + r.shakaiHoken.self + r.shotokuzei + r.juminzeiMonthly, gross,
        `gross=${gross} mode=${mode}`);
    }
  }
});

// ── 8. fail closed: 必要な参照データが無ければ黙って答えず throw する ─────────
t('参照データ欠落は throw（黙って0で答えない）', () => {
  assert.throws(() => calcTedori({ ...base, gross: 300000 }, { gensenTable: T }), /shaho_rates/);
  assert.throws(() => calcTedori({ ...base, gross: 300000 }, { shahoRates: S }), /gensen/);
  // estimate は住民税データが要る（none/manual なら要らない）
  assert.throws(
    () => calcTedori({ ...base, gross: 300000, juminzeiMode: 'estimate' }, { shahoRates: S, gensenTable: T }),
    /juminzei/);
  // none モードは juminzei データ無しでも計算できる
  const r = calcTedori({ ...base, gross: 300000, juminzeiMode: 'none' }, { shahoRates: S, gensenTable: T });
  assert.strictEqual(r.tedori, 249610);
});

// ── 9. 未収録の都道府県は NaN を答えず throw（知らないことは知らないと言う） ──
t('未知の都道府県は throw（NaNで手取りを出さない）', () => {
  assert.throws(() => calcTedori({ ...base, gross: 300000, prefecture: '外国' }, refs), /健康保険料率/);
  assert.throws(() => shakaiHokenMonthly(300000, 30, undefined, 'general', S), /健康保険料率/);
});

console.log(`\n${fail ? '❌' : '✓'} 手取りコア: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
