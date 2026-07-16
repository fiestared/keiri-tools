/**
 * ボーナス手取り計算機コア（bonus_tedori_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値は bonus_tedori_core を通さずに固定した**定数**（手で積み上げた値）。
 *
 *   [賞与500,000・東京都・30歳・扶養0・前月額面300,000・一般の事業] の鎖:
 *     標準賞与額 500,000（1,000円未満切捨・上限未満）
 *     健保 500,000×9.85%÷2 = 24,625 ／ 支援金 500,000×0.23%÷2 = 575
 *     厚年 500,000×18.3%÷2 = 45,750 ／ 雇用 500,000×5/1000 = 2,500（実額にかかる）
 *     → 社会保険料(本人) 73,450
 *     前月の社保後給与 = 300,000 − 44,070 = 255,930
 *       （44,070 は tests/test_shaho_oracle.mjs が協会けんぽ公式額表で固定している値）
 *     算出率の表（令和8年分・甲欄・扶養0）: 94千円以上260千円未満 → **4.084%**
 *     税 = floor((500,000 − 73,450) × 4084 / 100000) = floor(17,420.30) = 17,420
 *     手取り = 500,000 − 73,450 − 17,420 = **409,130**
 *
 *   [同・45歳（介護保険あり）]:
 *     健保＋介護 500,000×(9.85+1.62)%÷2 = 28,675 → 社保 77,500
 *     前月社保後 = 300,000 − 46,500 = 253,500 → 同じ帯 4.084%
 *     税 = floor(422,500×4084/100000) = 17,254 → 手取り **405,246**
 *
 *   [10倍超の例外・前月額面100,000・賞与1,200,000・30歳]:
 *     前月社保 = 4,826+113+8,967+500 = 14,406 → 前月社保後 85,594
 *     賞与社保 = 59,100+1,380+109,800+6,000 = 176,280 → 賞与社保後 1,023,720
 *     1,023,720 > 85,594×10 → 月額表による例外（No.2523）
 *     ①1,023,720÷6 = 170,620 ②+85,594 = 256,214 ③月額表(甲・扶養0) = 6,320
 *       （6,320 は 254,000〜257,000 の行。test_tedori.mjs が同じ行を固定している）
 *     ④85,594 は月額表で0円 ⑤(6,320−0)×6 = **37,920**
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcBonusTedori } from '../docs/assets/bonus_tedori_core.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../docs/assets/${f}`, import.meta.url)));
const refs = {
  shahoRates: load('shaho_rates_r08.json'),
  shoyoTable: load('gensen_shoyo_r08.json'),
  gensenTable: load('gensen_getsugaku_r08.json'),
};

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

const base = { age: 30, prefecture: '東京都', dependents: 0, zengetsu: 300000 };

// ── 1. 看板の鎖（賞与50万・30歳）を1円まで再現 ──────────────────────────
t('賞与500,000・30歳・前月30万 → 社保73,450・率4.084%・税17,420・手取り409,130', () => {
  const r = calcBonusTedori({ ...base, bonus: 500000 }, refs);
  assert.strictEqual(r.shakaiHoken.standardBonus, 500000, '標準賞与額');
  assert.strictEqual(r.shakaiHoken.kenkoKaigo.self, 24625, '健保');
  assert.strictEqual(r.shakaiHoken.kosodate.self, 575, '支援金');
  assert.strictEqual(r.shakaiHoken.kosei.self, 45750, '厚年');
  assert.strictEqual(r.shakaiHoken.koyou.self, 2500, '雇用');
  assert.strictEqual(r.shakaiHoken.self, 73450, '社保合計');
  assert.strictEqual(r.zengetsuShaho, 44070, '前月の社保(公式額表の固定値)');
  assert.strictEqual(r.zengetsuAfterIns, 255930, '前月の社保後給与');
  assert.strictEqual(r.shoyo.method, 'rate', '通常の計算(算出率の表)');
  assert.strictEqual(r.shoyo.rate, 4084, '率 4.084%(10万分率)');
  assert.strictEqual(r.shotokuzei, 17420, '源泉所得税');
  assert.strictEqual(r.juminzei, 0, '住民税は賞与から天引きされない');
  assert.strictEqual(r.tedori, 409130, '手取り');
  assert.strictEqual(r.tedori, r.bonus - r.totalDeduction, '恒等式');
});

// ── 2. 介護保険（40〜64歳は健保と合算） ───────────────────────────────
t('賞与500,000・45歳 → 社保77,500・税17,254・手取り405,246', () => {
  const r = calcBonusTedori({ ...base, bonus: 500000, age: 45 }, refs);
  assert.strictEqual(r.shakaiHoken.kaigoApplies, true, '介護保険の対象');
  assert.strictEqual(r.shakaiHoken.kenkoKaigo.self, 28675, '健保＋介護');
  assert.strictEqual(r.shakaiHoken.self, 77500, '社保合計');
  assert.strictEqual(r.zengetsuAfterIns, 253500, '前月も介護保険で減る');
  assert.strictEqual(r.shotokuzei, 17254, '源泉所得税');
  assert.strictEqual(r.tedori, 405246, '手取り');
});

// ── 3. 雇用保険は標準賞与額ではなく**実額**にかかる ─────────────────────
t('賞与500,500 → 標準賞与額500,000だが雇用保険は500,500×5/1000=2,502', () => {
  const r = calcBonusTedori({ ...base, bonus: 500500 }, refs);
  assert.strictEqual(r.shakaiHoken.standardBonus, 500000, '1,000円未満切捨');
  assert.strictEqual(r.shakaiHoken.kenkoKaigo.self, 24625, '健保は標準賞与額ベース(500,000)');
  assert.strictEqual(r.shakaiHoken.koyou.self, 2502, '雇用は実額500,500×5/1000=2,502.5→50銭以下切捨');
});

// ── 4. 上限: 厚年は1回150万円・健保は年度累計573万円 ───────────────────
t('賞与2,000,000 → 厚年だけ150万円で頭打ち', () => {
  const r = calcBonusTedori({ ...base, bonus: 2000000 }, refs);
  assert.strictEqual(r.shakaiHoken.capped.kosei, true, '厚年は上限適用');
  assert.strictEqual(r.shakaiHoken.capped.kenko, false, '健保は573万円未満');
  assert.strictEqual(r.shakaiHoken.koseiStandard, 1500000, '厚年の標準賞与額');
  assert.strictEqual(r.shakaiHoken.kosei.self, 137250, '厚年 150万×18.3%÷2');
  assert.strictEqual(r.shakaiHoken.kenkoKaigo.self, 98500, '健保 200万×9.85%÷2');
});
t('年度累計500万円のあと賞与100万円 → 健保は残り73万円にだけかかる', () => {
  const r = calcBonusTedori({ ...base, bonus: 1000000, yearPaidKenko: 5000000 }, refs);
  assert.strictEqual(r.shakaiHoken.capped.kenko, true, '健保は年度上限適用');
  assert.strictEqual(r.shakaiHoken.kenkoStandard, 730000, '573万−500万=73万');
  assert.strictEqual(r.shakaiHoken.kenkoKaigo.self, 35952, '健保 73万×9.85%÷2=35,952.5→切捨');
  assert.strictEqual(r.shakaiHoken.kosei.self, 91500, '厚年は100万にそのまま(150万未満)');
});

// ── 5. 例外①: 前月に給与の支払がない → 月額表による計算 ─────────────────
t('前月給与なし・賞与300,000 → 月額表の例外・税0円・手取り255,930', () => {
  const r = calcBonusTedori({ ...base, bonus: 300000, zengetsuPaid: false }, refs);
  assert.strictEqual(r.shoyo.method, 'getsugaku', '算出率の表を使わない');
  assert.strictEqual(r.shoyo.reason, 'no_prev', '理由=前月給与なし');
  assert.strictEqual(r.shakaiHoken.self, 44070, '賞与30万の社保(標準賞与額30万)');
  assert.strictEqual(r.shoyo.steps.perMonth, 42655, '255,930÷6=42,655');
  assert.strictEqual(r.shotokuzei, 0, '月額表で88,000円未満は0円');
  assert.strictEqual(r.tedori, 255930, '手取り');
});

// ── 6. 例外②: 賞与(社保後)が前月給与(社保後)の10倍超 → 月額表による計算 ──
t('前月額面100,000・賞与1,200,000 → 10倍超の例外・税37,920', () => {
  const r = calcBonusTedori({ ...base, bonus: 1200000, zengetsu: 100000 }, refs);
  assert.strictEqual(r.zengetsuAfterIns, 85594, '前月社保後 100,000−14,406');
  assert.strictEqual(r.afterShaho, 1023720, '賞与社保後 1,200,000−176,280');
  assert.strictEqual(r.shoyo.method, 'getsugaku', '算出率の表を使わない');
  assert.strictEqual(r.shoyo.reason, 'over_10x', '理由=10倍超');
  assert.strictEqual(r.shoyo.steps.taxCombined, 6320, '月額表 256,214 → 6,320(検証済みの行)');
  assert.strictEqual(r.shotokuzei, 37920, '(6,320−0)×6');
  assert.strictEqual(r.tedori, 1200000 - 176280 - 37920, '手取り');
});

// ── 7. 計算期間6か月超は除数12（役員賞与・決算賞与など） ─────────────────
t('monthsOver6・前月給与なし → 除数12で月額表を引く', () => {
  const r = calcBonusTedori({ ...base, bonus: 300000, zengetsuPaid: false, monthsOver6: true }, refs);
  assert.strictEqual(r.shoyo.steps.divisor, 12, '除数12');
  assert.strictEqual(r.shoyo.steps.perMonth, 21327, '255,930÷12=21,327');
});

// ── 8. fail closed: 参照データが無ければ答えず throw ────────────────────
t('参照データ欠落は throw（黙って0円と答えない）', () => {
  for (const missing of ['shahoRates', 'shoyoTable', 'gensenTable']) {
    assert.throws(() => calcBonusTedori({ ...base, bonus: 500000 }, { ...refs, [missing]: null }),
      /参照データ/, `${missing} 欠落`);
  }
  assert.throws(() => calcBonusTedori({ ...base, bonus: 500000, prefecture: '存在しない県' }, refs),
    /健康保険料率/, '未知の都道府県');
});

// ── 9. 扶養親族等の数で率の列が変わる（同じ前月給与でも税が下がる） ─────────
t('扶養3人は扶養0人より税が安い（率の列が動く）', () => {
  const r0 = calcBonusTedori({ ...base, bonus: 500000, dependents: 0 }, refs);
  const r3 = calcBonusTedori({ ...base, bonus: 500000, dependents: 3 }, refs);
  assert.ok(r3.shotokuzei < r0.shotokuzei,
    `扶養3人 ${r3.shotokuzei} < 扶養0人 ${r0.shotokuzei} になっていない`);
  assert.strictEqual(r0.shakaiHoken.self, r3.shakaiHoken.self, '社保は扶養数で変わらない');
});

// ── 10. ページの計算例（#rei-box）とコアの出力の一致を固定 ─────────────────
// ツールページに数値の計算例を書いたので、データ改定時に**ページだけ古い数字が残る**
// 事故を機械で落とす（CLAUDE.md「記事の数値と実装の照合」）。
// 規則3: 本文全体ではなく、その主張が載っている要素(#rei-box)を名指しして照合する。
t('ページの計算例(#rei-box)がコアの出力と一致（賞与50万・東京・30歳・扶養0・前月30万）', () => {
  const html = readFileSync(new URL('../docs/bonus-tedori/index.html', import.meta.url), 'utf8');
  const m = html.match(/<div id="rei-box"[\s\S]*?<\/div>/);
  assert.ok(m, '#rei-box が存在する');
  const box = m[0].replace(/<[^>]+>/g, ' ');
  const r = calcBonusTedori({ ...base, bonus: 500000 }, refs);
  const fmt = (n) => n.toLocaleString('ja-JP');
  for (const [label, v] of [
    ['健保', r.shakaiHoken.kenkoKaigo.self], ['支援金', r.shakaiHoken.kosodate.self],
    ['厚年', r.shakaiHoken.kosei.self], ['雇用', r.shakaiHoken.koyou.self],
    ['社保合計', r.shakaiHoken.self], ['前月の社保', r.zengetsuShaho],
    ['前月社保後', r.zengetsuAfterIns], ['税', r.shotokuzei], ['手取り', r.tedori],
  ]) {
    assert.ok(box.includes(`${fmt(v)}円`), `${label} ${fmt(v)}円 が計算例に無い（ページが古い）`);
  }
  assert.ok(box.includes(`${r.shoyo.ratePercent.toFixed(3)}%`), '率がページと一致');
  assert.ok(box.includes(`${(r.tedoriRate * 100).toFixed(1)}%`), '手取り率がページと一致');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
