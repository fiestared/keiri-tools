/**
 * 自動車税（種別割）判定コア（jidoshazei_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値はコアを通さず、**主税局・市の税額表に載っている税額そのもの**で照合する。
 *   - 東京都主税局『自動車税』税率表: 自家用乗用車の新税率（令和元10/1以後）・旧税率（令和元9/30以前）
 *   - 東京都主税局『自動車税グリーン化税制月割税額表（重課）』: 13年超の重課年額（1カ年分の列）
 *   - 東京都主税局 月割税額表: 月割の各列（外部オラクル。コアの端数処理を独立に照合）
 *   - 大阪市『軽自動車税の税率（年額）』: 軽自家用乗用 新10,800／旧7,200／重課12,900
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcJidoshazei, prorationMonths } from '../docs/assets/jidoshazei_core.js';

const ASSETS = new URL('../docs/assets/', import.meta.url);
const D = JSON.parse(readFileSync(new URL('jidoshazei_r08.json', ASSETS)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

const P = (o) => calcJidoshazei({ vehicle: 'passenger', firstReg: '2021-05', fuel: 'gasoline', ...o }, D);

// ── 1. ★新税率（令和元10/1以後 初度登録）— 東京都の税率表 逐語 ───────────────────
t('新税率: 1.5L超2L以下=36,000／2.5L超3L以下=50,000／6L超=110,000／電気=25,000', () => {
  assert.strictEqual(P({ cc: 'le2000' }).annual, 36000);
  assert.strictEqual(P({ cc: 'le3000' }).annual, 50000);
  assert.strictEqual(P({ cc: 'gt6000' }).annual, 110000);
  assert.strictEqual(P({ cc: 'ev', fuel: 'ev_other' }).annual, 25000);
});
t('新税率 全11区分が税率表と一致', () => {
  const want = { ev: 25000, le1000: 25000, le1500: 30500, le2000: 36000, le2500: 43500,
    le3000: 50000, le3500: 57000, le4000: 65500, le4500: 75500, le6000: 87000, gt6000: 110000 };
  for (const [cc, v] of Object.entries(want)) assert.strictEqual(P({ cc }).annual, v, `新 ${cc}=${v}`);
});

// ── 2. ★旧税率（令和元9/30以前 初度登録）— 同じ排気量でも税額が違う（急所1）──────────
t('旧税率: 1.5L超2L以下=39,500（新36,000と別）／2L超2.5L=45,000／6L超=111,000', () => {
  const old = (cc) => calcJidoshazei({ vehicle: 'passenger', cc, firstReg: '2015-06', fuel: 'gasoline' }, D);
  assert.strictEqual(old('le2000').annual, 39500);
  assert.strictEqual(old('le2000').rateType, 'old');
  assert.strictEqual(old('le2500').annual, 45000);
  assert.strictEqual(old('gt6000').annual, 111000);
});
t('新旧の境界: 2019-10は新税率・2019-09は旧税率', () => {
  const at = calcJidoshazei({ vehicle: 'passenger', cc: 'le2000', firstReg: '2019-10', fuel: 'gasoline' }, D);
  const before = calcJidoshazei({ vehicle: 'passenger', cc: 'le2000', firstReg: '2019-09', fuel: 'gasoline' }, D);
  assert.strictEqual(at.rateType, 'new'); assert.strictEqual(at.annual, 36000);
  assert.strictEqual(before.rateType, 'old'); assert.strictEqual(before.annual, 39500);
});

// ── 3. ★13年超の重課（東京都 重課税額表の 1カ年分 列 逐語）──────────────────────────
t('重課: 旧1.5L超2L(39,500)→45,400／2.5L超3L(51,000)→58,600／6L超(111,000)→127,600', () => {
  const j = (cc) => calcJidoshazei({ vehicle: 'passenger', cc, firstReg: '2010-06', fuel: 'gasoline', jyuka: true }, D);
  assert.strictEqual(j('le2000').annual, 45400); assert.strictEqual(j('le2000').isJyuka, true);
  assert.strictEqual(j('le3000').annual, 58600);
  assert.strictEqual(j('gt6000').annual, 127600);
});
t('重課 全区分（電気を除く10区分）が重課税額表と一致', () => {
  const want = { le1000: 33900, le1500: 39600, le2000: 45400, le2500: 51700, le3000: 58600,
    le3500: 66700, le4000: 76400, le4500: 87900, le6000: 101200, gt6000: 127600 };
  for (const [cc, v] of Object.entries(want)) {
    const r = calcJidoshazei({ vehicle: 'passenger', cc, firstReg: '2008-01', fuel: 'gasoline', jyuka: true }, D);
    assert.strictEqual(r.annual, v, `重課 ${cc}=${v}`);
  }
});

// ── 4. ★重課はハイブリッド・電気を対象外にする（急所2・最大の急所）──────────────────
t('★13年超でもハイブリッドは重課対象外＝標準税率のまま（jyukaBlocked）', () => {
  const r = calcJidoshazei({ vehicle: 'passenger', cc: 'le2000', firstReg: '2010-06', fuel: 'hybrid', jyuka: true }, D);
  assert.strictEqual(r.annual, 39500, 'ハイブリッドは重課せず旧標準39,500');
  assert.strictEqual(r.isJyuka, false);
  assert.strictEqual(r.jyukaBlocked, true);
});
t('★電気自動車は重課対象外（区分evは燃料に依らず重課しない）', () => {
  const r = calcJidoshazei({ vehicle: 'passenger', cc: 'ev', firstReg: '2010-06', fuel: 'gasoline', jyuka: true }, D);
  assert.strictEqual(r.annual, 29500, '旧電気=29,500・重課なし');
  assert.strictEqual(r.isJyuka, false);
});
t('★ディーゼルは11年超で重課（ガソリンの13年と別）', () => {
  const r = calcJidoshazei({ vehicle: 'passenger', cc: 'le2000', firstReg: '2012-06', fuel: 'diesel', jyuka: true }, D);
  assert.strictEqual(r.annual, 45400); assert.strictEqual(r.isJyuka, true);
  assert.ok(r.notes.some((n) => /11年/.test(n)), 'ディーゼルは11年の注記');
});

// ── 5. ★月割（東京都 月割税額表 各列を外部オラクルに）──────────────────────────────
t('月割 月数: 4月→11 / 8月→7 / 12月→3 / 1月→2 / 2月→1 / 3月→0', () => {
  assert.strictEqual(prorationMonths(4), 11);
  assert.strictEqual(prorationMonths(8), 7);
  assert.strictEqual(prorationMonths(12), 3);
  assert.strictEqual(prorationMonths(1), 2);
  assert.strictEqual(prorationMonths(2), 1);
  assert.strictEqual(prorationMonths(3), 0);
});
t('月割額: 新1.5L超2L(36,000) 4月登録=33,000 / 8月=21,000 / 2月=3,000', () => {
  const p = (m) => P({ cc: 'le2000', prorateMonth: m }).proration.amount;
  assert.strictEqual(p(4), 33000);   // 36,000×11/12
  assert.strictEqual(p(8), 21000);   // 36,000×7/12
  assert.strictEqual(p(2), 3000);    // 36,000×1/12
});
t('★月割の100円未満切捨: 新2.5L超(43,500) 8月登録(7か月)=25,300（43,500×7/12=25,375→切捨）', () => {
  const r = P({ cc: 'le2500', prorateMonth: 8 });
  assert.strictEqual(r.proration.months, 7);
  assert.strictEqual(r.proration.amount, 25300);
  assert.strictEqual(r.dueThisYear, 25300, '月割がある年度は月割額が納付額');
});
t('★3月登録はその年度0円（翌年度から年額）', () => {
  const r = P({ cc: 'le2000', prorateMonth: 3 });
  assert.strictEqual(r.proration.amount, 0);
  assert.strictEqual(r.dueThisYear, 0);
  assert.ok(r.notes.some((n) => /その年度分.*かかりません/.test(n)), '3月登録はその年度分がかからない旨の注記');
});
t('月割は標準税率に対して行う（重課年数でも新車の初年度は標準で月割）', () => {
  // 初度登録が今年度＝新車なので重課にはならない。月割は標準税率ベース
  const r = P({ cc: 'le2000', prorateMonth: 6, jyuka: true });
  // 6月→9か月。36,000×9/12=27,000
  assert.strictEqual(r.proration.amount, 27000);
});

// ── 6. ★軽自動車（自家用乗用・大阪市の税率）──────────────────────────────────────
const K = (o) => calcJidoshazei({ vehicle: 'kei', firstReg: '2020-05', fuel: 'gasoline', ...o }, D);
t('軽 新税率10,800（H27.4.1以後）／旧7,200（以前）／重課12,900', () => {
  assert.strictEqual(K({}).annual, 10800);
  assert.strictEqual(calcJidoshazei({ vehicle: 'kei', firstReg: '2014-06', fuel: 'gasoline' }, D).annual, 7200);
  assert.strictEqual(K({ jyuka: true }).annual, 12900);
  assert.strictEqual(K({ jyuka: true }).isJyuka, true);
});
t('軽の新旧境界: 2015-04は新10,800・2015-03は旧7,200', () => {
  assert.strictEqual(calcJidoshazei({ vehicle: 'kei', firstReg: '2015-04', fuel: 'gasoline' }, D).annual, 10800);
  assert.strictEqual(calcJidoshazei({ vehicle: 'kei', firstReg: '2015-03', fuel: 'gasoline' }, D).annual, 7200);
});
t('★軽のハイブリッド・電気は重課対象外', () => {
  const r = K({ jyuka: true, fuel: 'hybrid' });
  assert.strictEqual(r.annual, 10800); assert.strictEqual(r.jyukaBlocked, true);
});
t('★軽自動車税に月割はない（prorateMonthを渡してもproration=null・注記を出す）', () => {
  const r = K({ prorateMonth: 6 });
  assert.strictEqual(r.proration, null);
  assert.strictEqual(r.dueThisYear, 10800);
  assert.ok(r.notes.some((n) => /月割はありません/.test(n)));
});

// ── 7. 名称・区分の申告（画面に出す文言の素） ──────────────────────────────────────
t('登録車は都道府県税・軽は市区町村税を taxKind で申告', () => {
  assert.ok(/都道府県税/.test(P({ cc: 'le2000' }).taxKind));
  assert.ok(/市区町村税/.test(K({}).taxKind));
});

// ── 8. fail closed: データ・入力が無ければ throw（黙って答えない）───────────────────
t('fail closed: データ無し・車種未選択・排気量未選択・初度登録年月なしは throw', () => {
  assert.throws(() => calcJidoshazei({ vehicle: 'passenger', cc: 'le2000', firstReg: '2021-05' }, null), /jidoshazei_r08/);
  assert.throws(() => calcJidoshazei({ vehicle: 'x', cc: 'le2000', firstReg: '2021-05' }, D), /車種/);
  assert.throws(() => calcJidoshazei({ vehicle: 'passenger', firstReg: '2021-05', fuel: 'gasoline' }, D), /総排気量/);
  assert.throws(() => calcJidoshazei({ vehicle: 'passenger', cc: 'le2000', firstReg: '', fuel: 'gasoline' }, D), /初度登録/);
});

// ── 9. 単調性: 排気量が上がれば税額は非減少（新・旧・重課）────────────────────────────
t('単調性: 排気量が上がれば年額は非減少（新税率・旧税率・重課）', () => {
  const order = ['le1000', 'le1500', 'le2000', 'le2500', 'le3000', 'le3500', 'le4000', 'le4500', 'le6000', 'gt6000'];
  for (const [reg, jyuka] of [['2021-05', false], ['2015-06', false], ['2008-01', true]]) {
    let prev = -1;
    for (const cc of order) {
      const r = calcJidoshazei({ vehicle: 'passenger', cc, firstReg: reg, fuel: 'gasoline', jyuka }, D);
      assert.ok(r.annual >= prev, `${reg} j=${jyuka} 逆転 ${cc} (${prev}→${r.annual})`);
      prev = r.annual;
    }
  }
});

console.log(`\n${fail ? '❌' : '✓'} 自動車税コア: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
