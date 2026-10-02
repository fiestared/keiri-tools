import assertR11 from 'node:assert/strict';
/**
 * 年収の壁コア（kabe_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値は kabe_core を通さずに固定した**定数**にする。これらは公開済みの記事
 *   「年収の壁 早見表」(/column/nenshu-no-kabe/) が本文に載せている値そのもので、
 *   記事は「当サイトの社会保険料計算ロジックで実際に計算すると」と断って次を示している:
 *     年収129万円（扶養内・社会保険料ゼロ）→ 手取り 1,290,000
 *     年収131万円（社会保険に加入）→ 本人負担 187,296円 → 手取り 1,122,704
 *     元の水準（1,290,000）に戻るのは 年収 1,505,000 まで働いたとき
 *   187,296 は 標準報酬月額110,000 の本人負担 月15,608円 ×12 に一致する
 *   （健保5,417 + 子育て支援金126 + 厚年10,065 = 15,608。雇用保険は含めない）。
 *   合成（壁判定・社保・掃引）が1つでも狂えば、この定数に一致しなくなる。
 *
 * 一次情報（壁の金額そのもの）: 日本年金機構（被扶養者130万/180万・適用拡大の賃金要件は令和8年10月撤廃）
 *   https://www.nenkin.go.jp/service/kounen/tekiyo/hihokensha1/20141202.html
 *   https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcKabe, shakaiHokenAnnual, wallAmount, WALL_TYPES } from '../docs/assets/kabe_core.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../docs/assets/${f}`, import.meta.url)));
const S = load('shaho_rates_r08.json');
const K = load('kabe_thresholds_r08.json');
const refs = { thresholds: K, shahoRates: S };

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// ★日付を固定する（賃金要件は 2026-09-30 まで。撤廃前の挙動はこの日付で見る。CLAUDE.md: 今日に依存するテストは実行日で落ちる）
const PRE = '2026-09-30', POST = '2026-10-01';
const base = { age: 30, prefecture: '東京都', wallType: 'hifuyousha', asOf: PRE };

// ── 1. 社会保険料(本人・年額)が記事の 187,296円 を1円まで再現する（独立オラクル） ────
t('社保(年): 年収131万・東京都・30歳 → 187,296円（記事の値）', () => {
  const sh = shakaiHokenAnnual(1310000, 30, S.kenko_rates['東京都'], S);
  assert.strictEqual(sh.annual, 187296, `社保年額 ${sh.annual} ≠ 187,296`);
  assert.strictEqual(sh.monthly, 15608, `社保月額 ${sh.monthly} ≠ 15,608`);
  assert.strictEqual(sh.standard, 110000, '標準報酬月額110,000');
  assert.strictEqual(sh.kaigoApplies, false, '30歳は介護なし');
});

// ── 2. 記事の壁の3点（129万→0 / 131万→加入 / 130万＝底）を再現 ────────────────
t('年収129万（扶養内）→ 社保0・手取り1,290,000', () => {
  const r = calcKabe({ ...base, annual: 1290000 }, refs);
  assert.strictEqual(r.wall, 1300000, '壁は130万');
  assert.strictEqual(r.joins, false, '129万は扶養内（未加入）');
  assert.strictEqual(r.shahoAnnual, 0, '扶養内は社保0');
  assert.strictEqual(r.tedori, 1290000, '手取り＝年収');
  assert.strictEqual(r.reference, 1290000, '基準手取りは入力額');
});
t('年収131万（加入）→ 社保187,296・手取り1,122,704（記事の見出し）', () => {
  const r = calcKabe({ ...base, annual: 1310000 }, refs);
  assert.strictEqual(r.joins, true, '131万は加入');
  assert.strictEqual(r.shahoAnnual, 187296, '社保年額');
  assert.strictEqual(r.tedori, 1122704, '手取り＝1,310,000−187,296');
});
t('年収130万ちょうどは加入側（130万"未満"が扶養）＝壁の底', () => {
  const r = calcKabe({ ...base, annual: 1300000 }, refs);
  assert.strictEqual(r.joins, true, '130万ちょうどは加入');
  assert.strictEqual(r.shahoAnnual, 187296, '社保年額');
  assert.strictEqual(r.tedori, 1112704, '手取り＝1,300,000−187,296');
  assert.strictEqual(r.bottomTedori, 1112704, '壁の底＝130万加入時の手取り');
});

// ── 3. 回復年収：手取りが元(1,290,000)に戻る最小の年収＝1,505,000（記事の値） ────
t('回復年収: 129万の手取りに戻るのは年収1,505,000', () => {
  const r = calcKabe({ ...base, annual: 1290000 }, refs);
  assert.strictEqual(r.recovery, 1505000, `回復年収 ${r.recovery} ≠ 1,505,000`);
  assert.strictEqual(r.recoveryGap, 215000, '余分に稼ぐ額＝1,505,000−1,290,000');
  // 回復点の手取りは基準以上・その1,000円手前は基準未満（＝“最小”であることの確認）
  const atRecovery = r.recovery - shakaiHokenAnnual(r.recovery, 30, S.kenko_rates['東京都'], S).annual;
  const justBefore = (r.recovery - 1000) - shakaiHokenAnnual(r.recovery - 1000, 30, S.kenko_rates['東京都'], S).annual;
  assert.ok(atRecovery >= 1290000, `回復点の手取り ${atRecovery} ≥ 1,290,000`);
  assert.ok(justBefore < 1290000, `1,000円手前 ${justBefore} < 1,290,000（最小である）`);
});

// ── 3b. ★回復年収の定義（2026-07-19レビューで強化）: 回復年収**以後**に手取りが基準を
//        割る年収は無い。「◯◯円以上を目指す」という画面の助言が等級境界の凹みで
//        偽にならないことを、掃引範囲の全点で確かめる。
//        あわせて「最初に基準以上になった点」（旧定義）と一致すること＝定義変更で
//        記事オラクル(1,505,000円)が動いていないことも固定する。
t('回復年収の以後に基準割れの年収は無い・旧定義と同値（オラクル不変）', () => {
  const combos = [];
  // 130万壁×30歳は全47都道府県（料率で等級境界の凹み方が変わる）
  for (const pref of Object.keys(S.kenko_rates)) combos.push({ pref, age: 30, wallType: 'hifuyousha' });
  // 介護あり(45)・適用拡大(106万)・60歳以上(180万壁)は代表3県
  for (const pref of ['東京都', '新潟県', '佐賀県']) {
    combos.push({ pref, age: 45, wallType: 'hifuyousha' });
    combos.push({ pref, age: 30, wallType: 'tekiyoKakudai' });
    combos.push({ pref, age: 45, wallType: 'tekiyoKakudai' });
    combos.push({ pref, age: 62, wallType: 'hifuyousha' });
  }
  for (const { pref, age, wallType } of combos) {
    const rate = S.kenko_rates[pref];
    // 基準がいちばん高い入力（壁−1円）＝いちばん破れやすい条件で見る
    const r = calcKabe({ annual: wallAmount(K, wallType, age, PRE) - 1, age, prefecture: pref, wallType, asOf: PRE }, refs);
    assert.ok(r.recovery != null, `${pref}/${age}/${wallType}: 回復年収が出ない`);
    let firstCross = null;
    for (let a = r.wall; a <= r.wall + 4000000; a += 1000) {
      const td = a - shakaiHokenAnnual(a, age, rate, S).annual;
      if (td >= r.reference && firstCross == null) firstCross = a;
      if (a >= r.recovery) {
        assert.ok(td >= r.reference,
          `${pref}/${age}/${wallType}: 回復年収${r.recovery}以後の年収${a}で手取り${td}が基準${r.reference}を割る`);
      }
    }
    assert.strictEqual(r.recovery, firstCross,
      `${pref}/${age}/${wallType}: 令和8年度データでは旧定義（最初の交差点）と一致するはず`);
  }
});

// ── 4. 壁を超えると手取りは実際に下がる（逆転が起きている） ──────────────────
t('壁の手前の手取り > 壁の底の手取り（逆転が実在する）', () => {
  const r = calcKabe({ ...base, annual: 1290000 }, refs);
  assert.ok(r.reference > r.bottomTedori, `手前 ${r.reference} > 底 ${r.bottomTedori}`);
  assert.strictEqual(r.maxLoss, 1290000 - 1112704, '最大の落差＝177,296');
});

// ── 5. 恒等式：加入者は 年収 = 手取り + 社会保険料 ─────────────────────────
t('恒等式: 年収 = 手取り + 社保（加入時）', () => {
  for (const annual of [1300000, 1500000, 2000000, 3000000]) {
    const r = calcKabe({ ...base, annual }, refs);
    assert.strictEqual(r.tedori + r.shahoAnnual, annual, `annual=${annual}`);
    assert.strictEqual(r.tedori, annual - r.shahoAnnual);
  }
});

// ── 6. 適用拡大の壁（約106万）— hifuyousha より低い位置で加入 ──────────────
t('wallType tekiyoKakudai: 壁は106万・105万は未加入/106万は加入', () => {
  assert.strictEqual(wallAmount(K, 'tekiyoKakudai', 30, PRE), 1056000, '月8.8万円×12=105.6万円');
  const below = calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 1050000 }, refs);
  const above = calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 1060000 }, refs);
  assert.strictEqual(below.joins, false, '105万は未加入');
  assert.strictEqual(below.tedori, 1050000, '未加入は手取り＝年収');
  assert.strictEqual(above.joins, true, '106万は加入');
  assert.ok(above.tedori < 1060000, '加入で手取りが年収未満');
  // 適用拡大の壁は被扶養者の壁より低い（早く加入する）
  assert.ok(wallAmount(K, 'tekiyoKakudai', 30, PRE) < wallAmount(K, 'hifuyousha', 30));
});

// ── 7. 60歳以上は被扶養者の壁が180万に上がる ─────────────────────────
t('60歳以上: 被扶養者の壁は180万（130万では加入しない）', () => {
  assert.strictEqual(wallAmount(K, 'hifuyousha', 60), 1800000, '60歳以上は180万');
  const r = calcKabe({ ...base, age: 62, annual: 1500000 }, refs);
  assert.strictEqual(r.wall, 1800000, '壁は180万');
  assert.strictEqual(r.joins, false, '年収150万は180万未満で扶養内');
  assert.strictEqual(r.tedori, 1500000, '扶養内は社保0');
});

// ── 8. 介護保険（40〜64歳）が乗ると社保が増える（＝手取りが減る） ──────────
t('40歳は介護保険が乗り、30歳より社保が高い', () => {
  const r30 = calcKabe({ ...base, age: 30, annual: 1500000 }, refs);
  const r40 = calcKabe({ ...base, age: 40, annual: 1500000 }, refs);
  assert.strictEqual(r30.shaho.kaigoApplies, false, '30歳は介護なし');
  assert.strictEqual(r40.shaho.kaigoApplies, true, '40歳は介護あり');
  assert.ok(r40.shahoAnnual > r30.shahoAnnual, '介護保険ぶん社保が高い');
  assert.ok(r40.tedori < r30.tedori, '手取りは40歳のほうが低い');
});

// ── 9. fail closed: 参照データが無ければ黙って答えず throw する ──────────────
t('参照データ欠落は throw（黙って0で答えない）', () => {
  assert.throws(() => calcKabe({ ...base, annual: 1500000 }, { shahoRates: S }), /kabe_thresholds/);
  assert.throws(() => calcKabe({ ...base, annual: 1500000 }, { thresholds: K }), /shaho_rates/);
  assert.throws(() => shakaiHokenAnnual(1500000, 30, undefined, S), /健康保険料率/);
});

// ── 10. 未収録の都道府県は NaN を答えず throw（知らないことは知らないと言う） ──
t('未知の都道府県は throw', () => {
  assert.throws(() => calcKabe({ ...base, annual: 1500000, prefecture: '外国' }, refs), /健康保険料率/);
});

// ── 11. wallType 未指定/不正は既定で被扶養者(130万)にフォールバック ──────────
t('wallType 不正は 130万 にフォールバック（黙って106万にしない）', () => {
  const r = calcKabe({ ...base, wallType: 'なにか', annual: 1290000 }, refs);
  assert.strictEqual(r.wall, 1300000, '既定は130万');
  assert.ok(WALL_TYPES.includes('hifuyousha') && WALL_TYPES.includes('tekiyoKakudai'));
});

console.log(`\n${fail ? '❌' : '✓'} 年収の壁コア: ${pass} passed, ${fail} failed`);
// r8: 日本年金機構の月額8.8万円。賞与等なし・均等月給の年換算。
assert.equal(calcKabe({...base,wallType:'tekiyoKakudai',annual:1055999},refs).joins,false);
assert.equal(calcKabe({...base,wallType:'tekiyoKakudai',annual:1056000},refs).joins,true);
assert.equal(calcKabe({...base,wallType:'tekiyoKakudai',annual:1059999},refs).joins,true);
// ── 2026-10-01 の賃金要件の撤廃（厚生年金保険法12条5号・健康保険法3条。令和7年法律第74号）──
// 撤廃前（9/30）は月8.8万円の壁があり、撤廃後（10/1）は年収にかかわらず加入。被扶養者の130万円は変わらない
assert.equal(wallAmount(K, 'tekiyoKakudai', 30, PRE), 1056000, '9/30 は賃金要件あり');
assert.equal(wallAmount(K, 'tekiyoKakudai', 30, POST), 0, '10/1 からは金額の壁なし');
assert.equal(calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 900000, asOf: PRE }, refs).joins, false, '9/30・年90万は加入しない');
{
  const r = calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 900000, asOf: POST }, refs);
  assert.equal(r.joins, true, '10/1・年90万でも加入（週20時間以上などを満たす前提の選択肢）');
  assert.equal(r.wageRequirementAbolished, true);
  assert.ok(r.shahoAnnual > 0 && r.tedori === 900000 - r.shahoAnnual);
  assert.equal(r.recovery, null, '壁が無いので回復年収は定義しない');
}
assert.equal(wallAmount(K, 'hifuyousha', 30, POST), 1300000, '被扶養者の130万円は撤廃の対象外');
assert.equal(calcKabe({ ...base, annual: 1290000, asOf: POST }, refs).joins, false, '10/1 以後も被扶養者の判定は130万円のまま');
// 日付の形が壊れていたら今日の日付を使う（黙って撤廃前に固定しない）
assert.equal(calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 900000, asOf: 'あした' }, refs).asOf.length, 10);
// 撤廃後: 月8.8万円×12（105.6万円）を下回る入力には注意を出す（最低賃金以上で週20時間以上なら月8.8万円以上になる＝厚労省。判定は変えない）
assert.equal(calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 1055999, asOf: POST }, refs).belowFormerWageLine, true, '105万5,999円は下回る');
assert.equal(calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 1056000, asOf: POST }, refs).belowFormerWageLine, false, '105.6万円ちょうどは下回らない');
assert.equal(calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 1056000, asOf: POST }, refs).formerWageLine, 1056000);
assert.equal(calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 0, asOf: POST }, refs).belowFormerWageLine, false, '年収0は注意を出さない（未入力扱い）');
// 独立オラクル（協会けんぽ東京 令和8年度の額表）: 年90万＝月7.5万→健保 第3級 78,000円（3,841.5→3,841）＋支援金 89.7→90＋厚年 下限88,000円（8,052）＝月11,983円
assert.equal(calcKabe({ ...base, wallType: 'tekiyoKakudai', annual: 900000, asOf: POST }, refs).shahoAnnual, 143796, '年90万の本人負担は143,796円');
// データが撤廃日を持っていること（ページに手書きしない）。今日（2026-10-02 以後）は既定の日付で撤廃後になる
assert.equal(K.shakaiHoken.tekiyoKakudai.chinginYokenUntil, '2026-09-30');
assert.equal(calcKabe({ age: 30, prefecture: '東京都', wallType: 'tekiyoKakudai', annual: 900000 }, refs).wageRequirementAbolished, true, '日付を渡さなければ今日の日付で撤廃後');
assert.equal(K.shakaiHoken.tekiyoKakudaiYouken.length, 4, '撤廃後の要件は4つ');
assert.ok(!K.shakaiHoken.tekiyoKakudaiYouken.some((y) => /8\.8万/.test(y.label)), '現行の要件一覧に賃金要件を残さない');
console.log('✓ 2026-10-01 の賃金要件の撤廃: 撤廃前（9/30）・撤廃後（10/1）・被扶養者は不変・月8.8万円未満の注意');

// r11: 日本年金機構・後期高齢者医療の被保険者となったら被扶養者非該当。
assertR11.throws(()=>calcKabe({...base,age:75,annual:1790000},refs),/75歳/,'r11 75歳からは計算対象外');
assertR11.doesNotThrow(()=>calcKabe({...base,age:74,annual:1790000},refs));

process.exit(fail ? 1 : 0);

