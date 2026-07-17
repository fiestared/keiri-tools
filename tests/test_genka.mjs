/**
 * 減価償却コア（genka_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値はコアの都合でなく、国税庁が公表した計算例そのもの（取得価額100万円・耐用年数10年）で照合する。
 *   - 定額法: 各年10万円・10年目99,999円（No.2106／別表第八）
 *   - 200%定率法（平成24年4月1日以後取得）: 1年目200,000…6年目65,536、7年目に償却保証額65,520円を
 *     下回り改定取得価額262,144×0.250＝65,536に切替、10年目65,535（1円残す）。
 *     （出典: 法人の減価償却制度の改正に関するQ&A・耐用年数省令別表第十）
 *   - 250%定率法（平成19年4月1日〜平成24年3月31日取得）: 償却率0.250・改定0.334・保証0.04448（別表第九）。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcGenka, floorYen, usedMonthsFromStart } from '../docs/assets/genka_core.js';

const ASSETS = new URL('../docs/assets/', import.meta.url);
const D = JSON.parse(readFileSync(new URL('genka_rates.json', ASSETS)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// 100万円・耐用年数10年・1月取得（通年）を各方法で
const teigaku = calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01' }, D);
const t200 = calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2015-01' }, D); // 200%
const t250 = calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2010-01' }, D); // 250%（1月取得＝通年）

// ── 1. ★定額法（別表第八の公表例）─────────────────────────────────────────────────
t('定額法 n10 100万: 1〜9年目=100,000 / 10年目=99,999 / 合計999,999 / 期末1円', () => {
  const dep = teigaku.schedule.map((r) => r.dep);
  assert.strictEqual(teigaku.rate, 0.100);
  for (let y = 0; y < 9; y++) assert.strictEqual(dep[y], 100000, `year${y + 1}`);
  assert.strictEqual(dep[9], 99999, 'year10 備忘1円');
  assert.strictEqual(teigaku.totalYears, 10);
  assert.strictEqual(teigaku.totalDep, 999999);
  assert.strictEqual(teigaku.schedule[9].closeBook, 1);
});

// ── 2. ★200%定率法（別表第十の公表例・償却保証額切替を逐語照合）────────────────────
t('200%定率法 n10 100万: 償却率0.200/改定0.250/保証0.06552・保証額65,520', () => {
  assert.strictEqual(t200.rate, 0.200);
  assert.strictEqual(t200.kaiteiRate, 0.250);
  assert.strictEqual(t200.hoshoRate, 0.06552);
  assert.strictEqual(t200.hoshoGaku, 65520);
  assert.ok(/200%/.test(t200.eraLabel), '200%のera表示');
});
t('200%定率法 n10 100万: 公表スケジュール（1年目200,000…7年目切替65,536…10年目65,535）', () => {
  const want = [200000, 160000, 128000, 102400, 81920, 65536, 65536, 65536, 65536, 65535];
  const dep = t200.schedule.map((r) => r.dep);
  assert.deepStrictEqual(dep, want);
  const openBook = t200.schedule.map((r) => r.openBook);
  assert.deepStrictEqual(openBook, [1000000, 800000, 640000, 512000, 409600, 327680, 262144, 196608, 131072, 65536]);
  assert.strictEqual(t200.totalDep, 999999);
  assert.strictEqual(t200.schedule[9].closeBook, 1, '10年目末は備忘1円');
});
t('200%定率法: 7年目に改定取得価額×改定償却率へ切替（毎年同額65,536）', () => {
  // 7・8・9年目が同額＝改定取得価額262,144×0.250
  assert.strictEqual(t200.schedule[6].dep, 65536);
  assert.strictEqual(t200.schedule[7].dep, 65536);
  assert.strictEqual(t200.schedule[8].dep, 65536);
});

// ── 3. ★250%定率法（平成24年3月以前取得＝別表第九）──────────────────────────────────
t('250%定率法 n10: 償却率0.250/改定0.334/保証0.04448・1年目=250,000・era表示250%', () => {
  assert.strictEqual(t250.rate, 0.250);
  assert.strictEqual(t250.kaiteiRate, 0.334);
  assert.strictEqual(t250.hoshoRate, 0.04448);
  assert.strictEqual(t250.schedule[0].dep, 250000);
  assert.ok(/250%/.test(t250.eraLabel));
  assert.strictEqual(t250.totalDep, 999999);
  assert.strictEqual(t250.schedule[t250.totalYears - 1].closeBook, 1);
  // ★端数は切り捨て（4年目 421,875×0.25=105,468.75→105,468。切上げなら105,469）
  assert.deepStrictEqual(t250.schedule.slice(0, 4).map((r) => r.dep), [250000, 187500, 140625, 105468]);
});
t('★同じ耐用年数でも取得時期で率が変わる（急所1）: 200%(0.200)≠250%(0.250)', () => {
  assert.notStrictEqual(t200.rate, t250.rate);
  assert.ok(t250.schedule[0].dep > t200.schedule[0].dep, '250%の初年度の方が大きい');
});

// ── 4. ★初年度の月割（急所4）──────────────────────────────────────────────────────
t('定額法 4月取得（9か月）: 1年目=75,000・以降100,000・11年目まで延び・合計999,999', () => {
  const r = calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-04' }, D);
  assert.strictEqual(r.usedMonths, 9);
  assert.strictEqual(r.schedule[0].dep, 75000); // 100,000×9/12
  assert.strictEqual(r.schedule[1].dep, 100000);
  assert.strictEqual(r.totalDep, 999999);
  assert.ok(r.totalYears === 11, `月割で1年延びる（${r.totalYears}）`);
});
t('月数: 1月→12 / 4月→9 / 12月→1', () => {
  assert.strictEqual(usedMonthsFromStart(1), 12);
  assert.strictEqual(usedMonthsFromStart(4), 9);
  assert.strictEqual(usedMonthsFromStart(12), 1);
});

// ── 5. ★備忘価額1円（急所3）── 取得価額を変えても最終年の期末は必ず1円 ─────────────────
t('備忘1円: 取得価額を変えても最終年末=1円・合計=取得価額−1', () => {
  for (const cost of [123456, 500000, 2000000, 30000]) {
    const r = calcGenka({ method: 'teiritsu', cost, life: 8, acqYm: '2016-01' }, D);
    assert.strictEqual(r.schedule[r.totalYears - 1].closeBook, 1, `cost=${cost} 期末1円`);
    assert.strictEqual(r.totalDep, cost - 1, `cost=${cost} 合計=cost-1`);
  }
});

// ── 6. ★事業専用割合（家事按分）── 必要経費は割合分・帳簿価額は全額で減る ─────────────
t('事業専用割合60%: 必要経費=償却費×60%・帳簿価額は全額で減る', () => {
  const r = calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01', bizRatio: 60 }, D);
  assert.strictEqual(r.firstYearDep, 100000, '償却費は全額');
  assert.strictEqual(r.firstYearExpense, 60000, '必要経費は60%');
  assert.strictEqual(r.schedule[0].closeBook, 900000, '帳簿価額は全額100,000引く');
});

// ── 7. 端数切り捨て（急所6）── floorYen ─────────────────────────────────────────────
t('floorYen: 円未満切り捨て・負とNaNは0', () => {
  assert.strictEqual(floorYen(52428.8), 52428);
  assert.strictEqual(floorYen(100000), 100000);
  assert.strictEqual(floorYen(-5), 0);
  assert.strictEqual(floorYen(NaN), 0);
});

// ── 8. ★取得時期の適用表分岐（急所1）───────────────────────────────────────────────
t('定率法 era境界: 2012-04=200% / 2012-03=250%', () => {
  const a = calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2012-04' }, D);
  const b = calcGenka({ method: 'teiritsu', cost: 1000000, life: 10, acqYm: '2012-03' }, D);
  assert.strictEqual(a.rate, 0.200); assert.ok(/200%/.test(a.eraLabel));
  assert.strictEqual(b.rate, 0.250); assert.ok(/250%/.test(b.eraLabel));
});

// ── 9. fail closed: 黙って答えない（旧法・範囲外・不正入力）─────────────────────────────
t('fail closed: 平成19年3月以前取得は対象外', () => {
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2007-03' }, D), /対象外/);
});
t('fail closed: 耐用年数<2・>50・取得年月なし・取得価額0・方法未選択・データ無しは throw', () => {
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 1, acqYm: '2015-01' }, D), /耐用年数/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 51, acqYm: '2015-01' }, D), /耐用年数/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '' }, D), /取得/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 0, life: 10, acqYm: '2015-01' }, D), /取得価額/);
  assert.throws(() => calcGenka({ method: 'x', cost: 1000000, life: 10, acqYm: '2015-01' }, D), /償却方法/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01' }, null), /genka_rates/);
  assert.throws(() => calcGenka({ method: 'teigaku', cost: 1000000, life: 10, acqYm: '2015-01', bizRatio: 0 }, D), /事業専用割合/);
});

// ── 10. 定率法は定額法より初年度が大きい（加速償却の性質）──────────────────────────────
t('定率法の初年度償却費 > 定額法（加速償却）', () => {
  assert.ok(t200.firstYearDep > teigaku.firstYearDep, '200%>定額');
});

// ── 11. データ整合: 全区分で償却率が式（定額=切上げ1/n・定率=四捨五入k/n）に一致 ──────────
t('全耐用年数2〜50: 償却率が国税庁の式と一致（機械照合）', () => {
  const ceil3 = (x) => Math.ceil(Math.round(x * 1e6) / 1000) / 1000;
  const round3 = (x) => Math.floor(x * 1000 + 0.5) / 1000;
  for (let n = 2; n <= 50; n++) {
    if (n >= 3) assert.strictEqual(D.teigaku_rate[String(n)], ceil3(1 / n), `定額 n=${n}`);
    if (n >= 3) {
      assert.strictEqual(D.teiritsu_200[String(n)].rate, round3(2.0 / n), `200 n=${n}`);
      assert.strictEqual(D.teiritsu_250[String(n)].rate, round3(2.5 / n), `250 n=${n}`);
    }
  }
});

console.log(`\n${fail ? '❌' : '✓'} 減価償却コア: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
