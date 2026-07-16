/**
 * 贈与税コア（zoyozei_core.js・暦年課税）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値は zoyozei_core を通さず、**国税庁 No.4408 の worked example と、世に広く公開されている
 *   贈与税の早見表の値**で照合する。別々の資料が同じ額に噛み合えば、読み違えていないと分かる。
 *
 *   計算（相法21条の5・21条の7／措法70条の2の5／No.4408）:
 *     基礎控除後の課税価格 ＝ その年に受けた贈与財産の合計額 − 110万円
 *     贈与税額 ＝ 基礎控除後の課税価格 × 税率 − 控除額（一般/特例の速算表）／100円未満切り捨て
 *     一般＋特例の混在 ＝ 合計を基に全額一般/全額特例で計算し、価額の割合で按分して合計
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcZoyozei, sokusanZoyo } from '../docs/assets/zoyozei_core.js';

const ASSETS = new URL('../docs/assets/', import.meta.url);
const D = JSON.parse(readFileSync(new URL('zoyozei_r08.json', ASSETS)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// ── 1. ★国税庁 No.4408 の worked example と1円まで一致（外部オラクル）──────────────────
// 一般500万 → (500−110)=390万 ×20% −25万 = 53万円 ／ 特例500万 → 390万 ×15% −10万 = 48.5万円
t('No.4408例: 一般贈与500万円 → 53万円', () => {
  const r = calcZoyozei({ ippan: 5000000 }, D);
  assert.strictEqual(r.mode, 'ippan');
  assert.strictEqual(r.zei, 530000, `一般500万 ${r.zei} ≠ 530,000`);
});
t('No.4408例: 特例贈与500万円 → 48.5万円', () => {
  const r = calcZoyozei({ tokurei: 5000000 }, D);
  assert.strictEqual(r.mode, 'tokurei');
  assert.strictEqual(r.zei, 485000, `特例500万 ${r.zei} ≠ 485,000`);
});
// ★混在（一般100万＋特例400万）→ ①53万×100/500=10.6万 ＋ ②48.5万×400/500=38.8万 ＝ 49.4万円
t('No.4408例: 混在 一般100万＋特例400万 → 49.4万円（按分）', () => {
  const r = calcZoyozei({ ippan: 1000000, tokurei: 4000000 }, D);
  assert.strictEqual(r.mode, 'mixed');
  assert.strictEqual(r.total, 5000000, '合計500万');
  assert.strictEqual(r.zei, 494000, `混在 ${r.zei} ≠ 494,000`);
  // 内訳: 全額一般の税額53万・全額特例の税額48.5万
  assert.strictEqual(Math.round(r.breakdown.general.zei), 530000, '全額一般の税額53万');
  assert.strictEqual(Math.round(r.breakdown.special.zei), 485000, '全額特例の税額48.5万');
});

// ── 2. 公開されている贈与税の早見表と一致（外部オラクル・複数資料が噛み合う）──────────────
// [一般/特例, 贈与額(円), 税額(円)]
const HAYAMIHYO = [
  ['tokurei', 3000000,  190000],  // 特例300万 →(300−110)=190万 ≤200万 10% = 19万
  ['tokurei', 10000000, 1770000], // 特例1000万 →890万 ×30% −90万 = 177万
  ['tokurei', 15000000, 3660000], // 特例1500万 →1390万 ×40% −190万 = 366万
  ['ippan',   3000000,  190000],  // 一般300万 →190万 ≤200万 10% = 19万
  ['ippan',   10000000, 2310000], // 一般1000万 →890万 ×40% −125万 = 231万
  ['ippan',   6100000,  850000],  // 一般610万 →(610−110)=500万 ×30% −65万 = 85万
];
for (const [kind, amt, expected] of HAYAMIHYO) {
  t(`早見表 ${kind} 贈与${amt/10000}万 → ${expected}`, () => {
    const r = calcZoyozei(kind === 'ippan' ? { ippan: amt } : { tokurei: amt }, D);
    assert.strictEqual(r.zei, expected, `${kind} ${amt} → ${r.zei} ≠ ${expected}`);
  });
}

// ── 3. ★基礎控除110万円は合計から1回だけ（急所2）─────────────────────────────────────
t('基礎控除110万は合計から1回: 一般60万＋特例60万＝合計120万 → 課税10万・税額1万', () => {
  // 合計120万 −110万 = 10万（1回だけ）。もし各60万から110万を引けば0円（過少）。
  const r = calcZoyozei({ ippan: 600000, tokurei: 600000 }, D);
  assert.strictEqual(r.total, 1200000, '合計120万');
  assert.strictEqual(r.baseAfter, 100000, '基礎控除後10万（110万は1回だけ）');
  // 混在10万: ①10万×10%=1万×(60/120)=5000 ②10万×10%=1万×(60/120)=5000 → 1万
  assert.strictEqual(r.zei, 10000, `合計120万 → ${r.zei} ≠ 10,000`);
});

// ── 4. ★合計110万円以下は非課税（急所5）───────────────────────────────────────────
t('合計110万ちょうど → 非課税・税額0', () => {
  const r = calcZoyozei({ tokurei: 1100000 }, D);
  assert.strictEqual(r.below, true, '110万以下');
  assert.strictEqual(r.zei, 0, '非課税');
});
t('合計110万以下（一般50万＋特例50万＝100万）→ 非課税', () => {
  const r = calcZoyozei({ ippan: 500000, tokurei: 500000 }, D);
  assert.strictEqual(r.below, true);
  assert.strictEqual(r.zei, 0);
});
t('合計110万超（111万）→ 課税される', () => {
  const r = calcZoyozei({ tokurei: 1110000 }, D);
  assert.strictEqual(r.below, false, '110万超は課税');
  assert.strictEqual(r.baseAfter, 10000, '基礎控除後1万');
});

// ── 5. ★一般税率と特例税率で税額が違う（取り違え防止・急所1）──────────────────────────
t('同額でも 一般 と 特例 で税額が異なる（1000万）', () => {
  const g = calcZoyozei({ ippan: 10000000 }, D).zei;   // 231万
  const s = calcZoyozei({ tokurei: 10000000 }, D).zei; // 177万
  assert.strictEqual(g, 2310000, '一般1000万=231万');
  assert.strictEqual(s, 1770000, '特例1000万=177万');
  assert.ok(g > s, '一般のほうが特例より重い（同じ帯でも税率・控除額が違う）');
});

// ── 6. 速算表の帯の境界（No.4408・各8区分）─────────────────────────────────────────
t('一般速算表: 各帯の境界で正しい税率・控除額', () => {
  // 基礎控除後の課税価格を直接与える
  assert.strictEqual(sokusanZoyo(2000000, D.ippan).rate_pct, 10, '200万ちょうど=10%');
  assert.strictEqual(sokusanZoyo(2000001, D.ippan).rate_pct, 15, '200万超=15%');
  assert.strictEqual(sokusanZoyo(3000000, D.ippan).rate_pct, 15, '300万以下=15%');
  assert.strictEqual(sokusanZoyo(4000000, D.ippan).rate_pct, 20, '400万以下=20%');
  assert.strictEqual(sokusanZoyo(6000000, D.ippan).rate_pct, 30, '600万以下=30%');
  assert.strictEqual(sokusanZoyo(10000000, D.ippan).rate_pct, 40, '1,000万以下=40%');
  assert.strictEqual(sokusanZoyo(15000000, D.ippan).rate_pct, 45, '1,500万以下=45%');
  assert.strictEqual(sokusanZoyo(30000000, D.ippan).rate_pct, 50, '3,000万以下=50%');
  assert.strictEqual(sokusanZoyo(30000001, D.ippan).rate_pct, 55, '3,000万超=55%');
});
t('特例速算表: 各帯の境界で正しい税率・控除額（一般と帯が違う）', () => {
  assert.strictEqual(sokusanZoyo(2000000, D.tokurei).rate_pct, 10, '200万以下=10%');
  assert.strictEqual(sokusanZoyo(4000000, D.tokurei).rate_pct, 15, '400万以下=15%');
  assert.strictEqual(sokusanZoyo(6000000, D.tokurei).rate_pct, 20, '600万以下=20%');
  assert.strictEqual(sokusanZoyo(10000000, D.tokurei).rate_pct, 30, '1,000万以下=30%');
  assert.strictEqual(sokusanZoyo(15000000, D.tokurei).rate_pct, 40, '1,500万以下=40%');
  assert.strictEqual(sokusanZoyo(30000000, D.tokurei).rate_pct, 45, '3,000万以下=45%');
  assert.strictEqual(sokusanZoyo(45000000, D.tokurei).rate_pct, 50, '4,500万以下=50%');
  assert.strictEqual(sokusanZoyo(45000001, D.tokurei).rate_pct, 55, '4,500万超=55%');
  // 具体額: 特例4,500万（基礎控除後）→ 4,500万×50%−415万 = 2,250−415 = 1,835万
  assert.strictEqual(sokusanZoyo(45000000, D.tokurei).zei, 18350000, '特例4,500万→1,835万');
});

// ── 7. 単調性: 贈与額が増えれば税額は非減少 ────────────────────────────────────────
t('単調性: 贈与額が増えると税額は非減少（一般・特例とも）', () => {
  for (const kind of ['ippan', 'tokurei']) {
    let prev = -1;
    for (const amt of [1100000, 2000000, 5000000, 10000000, 50000000, 100000000]) {
      const r = calcZoyozei(kind === 'ippan' ? { ippan: amt } : { tokurei: amt }, D);
      assert.ok(r.zei >= prev, `${kind} 税額が減った amt=${amt}`);
      prev = r.zei;
    }
  }
});

// ── 8. fail closed: 参照データ・入力が無ければ throw（黙って答えない）──────────────────
t('fail closed: データ無し・贈与0/負は throw', () => {
  assert.throws(() => calcZoyozei({ ippan: 5000000 }, null), /zoyozei_r08/);
  assert.throws(() => calcZoyozei({}, D), /合計額を入力/); // 何も入力なし
  assert.throws(() => calcZoyozei({ ippan: 0, tokurei: 0 }, D), /合計額を入力/);
});

console.log(`\n${fail ? '❌' : '✓'} 贈与税コア: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
