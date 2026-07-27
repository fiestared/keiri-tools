/**
 * 減価償却コアの検査。
 *
 * ★中心は「外部オラクル照合」: 自分の算数ではなく、国税庁が公表している計算例の数値を
 *   1円まで再現できるかで見る（CLAUDE.md「記事の目玉は外部オラクルで裏取りする」）。
 *   - 国税庁 No.2106 具体例: 取得価額100万円・耐用年数10年
 *       定額法 = 毎年100,000円
 *       定率法 = 1年目200,000円 / 償却保証額65,520円 / 7年目は改定取得価額262,144円×0.250=65,536円
 *   - 国税庁 No.5404 具体例: 法定30年・経過10年 → 簡便法22年
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcShokyaku, chukoTaiyoNensu, SEIDO } from '../docs/assets/genka_shokyaku_core.js';

const rates = JSON.parse(readFileSync(new URL('../docs/assets/shokyaku_rates_r08.json', import.meta.url), 'utf8'));
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok', name); };

console.log('# 償却率表（別表第八・別表第十）');

ok('別表第八・第十とも耐用年数2〜100年が欠けていない', () => {
  for (let y = 2; y <= 100; y++) {
    assert.ok(String(y) in rates.teigaku, '定額法 ' + y + '年が無い');
    assert.ok(String(y) in rates.teiritsu_200, '定率法 ' + y + '年が無い');
  }
});

ok('国税庁が公表している代表値と一致する（別表第八・第十）', () => {
  // No.2106 の具体例と、耐用年数表の周知の値
  assert.strictEqual(rates.teigaku['10'], 0.100);
  assert.deepStrictEqual(rates.teiritsu_200['10'], { rate: 0.200, revised: 0.250, guarantee: 0.06552 });
  assert.deepStrictEqual(rates.teiritsu_200['5'], { rate: 0.400, revised: 0.500, guarantee: 0.10800 });
  assert.deepStrictEqual(rates.teiritsu_200['4'], { rate: 0.500, revised: 1.000, guarantee: 0.12499 });
});

ok('耐用年数2年の定率法は改定償却率・保証率が存在しない（0で埋めていない）', () => {
  assert.strictEqual(rates.teiritsu_200['2'].rate, 1.000);
  assert.strictEqual(rates.teiritsu_200['2'].revised, null);
  assert.strictEqual(rates.teiritsu_200['2'].guarantee, null);
});

console.log('# 定額法（国税庁 No.2106 具体例）');

ok('100万円・10年・定額法 → 毎年100,000円で、10年目に1円だけ残る', () => {
  const r = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 10, method: 'teigaku', rates });
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.rows.length, 10);
  for (let i = 0; i < 9; i++) assert.strictEqual(r.rows[i].shokyaku, 100000, (i + 1) + '年目');
  assert.strictEqual(r.rows[9].shokyaku, 99999);          // 備忘価額1円を残す
  assert.strictEqual(r.rows[9].kimatsuBoka, SEIDO.bibouKagaku);
  assert.strictEqual(r.total, 999999);
});

ok('無形固定資産は1円を残さず取得価額まで償却する', () => {
  const r = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 10, method: 'teigaku', rates, assetKind: 'mukei' });
  assert.strictEqual(r.total, 1000000);
  assert.strictEqual(r.rows[9].kimatsuBoka, 0);
  assert.strictEqual(r.rows[9].shokyaku, 100000);
});

ok('年の中途で使い始めた年は月割になる（No.2106 注1）', () => {
  const r = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 10, method: 'teigaku', rates, firstYearMonths: 3 });
  assert.strictEqual(r.rows[0].shokyaku, 25000);          // 100,000 × 3/12
  assert.strictEqual(r.rows[1].shokyaku, 100000);
  // 初年度が減った分だけ償却が後ろにずれる＝年数が1年増える
  assert.strictEqual(r.rows.length, 11);
  assert.strictEqual(r.total, 999999);
});

console.log('# 定率法（200%定率法・国税庁 No.2106 具体例）');

ok('100万円・10年・定率法 → 公表例の1年目・償却保証額・改定取得価額・7年目を1円まで再現', () => {
  const r = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 10, method: 'teiritsu', rates });
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.shokyakuHoshouGaku, 65520);        // 1,000,000 × 0.06552
  assert.strictEqual(r.rows[0].shokyaku, 200000);         // 1年目
  assert.strictEqual(r.kaiteiShutokuKagaku, 262144);      // 改定取得価額（7年目の期首残高）
  assert.strictEqual(r.rows[6].shokyaku, 65536);          // 7年目 = 262,144 × 0.250
  assert.strictEqual(r.rows[6].kaitei, true);
  // 2〜6年目は 未償却残高×0.200
  assert.deepStrictEqual(r.rows.slice(0, 6).map(x => x.shokyaku),
    [200000, 160000, 128000, 102400, 81920, 65536]);
  // 7年目以降は同額（改定取得価額×改定償却率）で、最後だけ1円残す
  assert.deepStrictEqual(r.rows.slice(6).map(x => x.shokyaku), [65536, 65536, 65536, 65535]);
  assert.strictEqual(r.rows[9].kimatsuBoka, 1);
  assert.strictEqual(r.total, 999999);
});

ok('改定取得価額は最初に満たなくなった年で固定される（毎年取り直さない）', () => {
  const r = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 10, method: 'teiritsu', rates });
  const after = r.rows.filter(x => x.kaitei);
  // 取り直していたら償却費が毎年減る。全部同額（最終年の1円調整を除く）であることを見る。
  const amounts = after.map(x => x.shokyaku);
  assert.strictEqual(new Set(amounts.slice(0, -1)).size, 1, '改定後の償却費が一定でない: ' + amounts);
});

ok('耐用年数2年の定率法は切替が起きず、初年度で償却しきる', () => {
  const r = calcShokyaku({ shutokuKagaku: 500000, taiyoNensu: 2, method: 'teiritsu', rates });
  assert.strictEqual(r.shokyakuHoshouGaku, null);
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.rows[0].shokyaku, 499999);
  assert.strictEqual(r.rows[0].kaitei, false);
});

ok('定率法の初年度月割は、償却保証額の判定を早めない（急所4）', () => {
  const full = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 10, method: 'teiritsu', rates });
  const half = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 10, method: 'teiritsu', rates, firstYearMonths: 6 });
  // 初年度は年額200,000の半分
  assert.strictEqual(half.rows[0].shokyaku, 100000);
  // 改定に切り替わる年は、月割で前倒しになってはいけない（残高が多い分むしろ後ろにずれる）
  const fullSwitch = full.rows.findIndex(x => x.kaitei);
  const halfSwitch = half.rows.findIndex(x => x.kaitei);
  assert.ok(halfSwitch >= fullSwitch, '月割で切替が前倒しになった: ' + halfSwitch + ' < ' + fullSwitch);
  assert.strictEqual(half.total, 999999);
});

ok('償却の累計は必ず 取得価額−備忘価額 に一致する（どの耐用年数でも償却しきる）', () => {
  for (const y of [2, 3, 4, 5, 6, 8, 10, 15, 22, 38, 47, 50, 100]) {
    for (const m of ['teigaku', 'teiritsu']) {
      const r = calcShokyaku({ shutokuKagaku: 1234567, taiyoNensu: y, method: m, rates });
      assert.ok(r.ok, m + ' ' + y + '年: ' + r.error);
      assert.strictEqual(r.total, 1234566, m + ' ' + y + '年の累計が合わない');
      assert.strictEqual(r.rows[r.rows.length - 1].kimatsuBoka, 1, m + ' ' + y + '年の期末簿価');
      assert.ok(r.rows.every(x => x.shokyaku >= 0), m + ' ' + y + '年に負の償却費');
    }
  }
});

console.log('# fail closed（黙って答えない）');

ok('償却率データが未着なら計算しない', () => {
  const r = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 10, method: 'teigaku', rates: null });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /読み込め/);
});

ok('収録範囲外の耐用年数は beyondData を立てて答えない', () => {
  const r = calcShokyaku({ shutokuKagaku: 1000000, taiyoNensu: 101, method: 'teigaku', rates });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.beyondData, true);
});

ok('不正な入力（0円・1年・月数13）は理由を返す', () => {
  assert.match(calcShokyaku({ shutokuKagaku: 0, taiyoNensu: 10, method: 'teigaku', rates }).error, /取得価額/);
  assert.match(calcShokyaku({ shutokuKagaku: 100, taiyoNensu: 1, method: 'teigaku', rates }).error, /耐用年数/);
  assert.match(calcShokyaku({ shutokuKagaku: 100, taiyoNensu: 10, method: 'teigaku', rates, firstYearMonths: 13 }).error, /月数/);
});

console.log('# 中古資産の簡便法（国税庁 No.5404）');

ok('法定30年・経過10年 → 22年（公表例）', () => {
  assert.strictEqual(chukoTaiyoNensu(30, 10).years, 22);
});

ok('法定耐用年数の全部を経過 → 法定×20%、1年未満は切捨て', () => {
  assert.strictEqual(chukoTaiyoNensu(6, 6).years, 2);      // 6×0.2=1.2 → 1 → 下限2
  assert.strictEqual(chukoTaiyoNensu(30, 40).years, 6);    // 30×0.2=6
  assert.strictEqual(chukoTaiyoNensu(47, 50).years, 9);    // 47×0.2=9.4 → 9
});

ok('一部経過は (法定−経過)+経過×20% を切り捨てる', () => {
  assert.strictEqual(chukoTaiyoNensu(6, 3).years, 3);      // 3+0.6=3.6 → 3
  assert.strictEqual(chukoTaiyoNensu(22, 5).years, 18);    // 17+1=18
});

ok('2年未満は2年に切り上がる（下限）', () => {
  const r = chukoTaiyoNensu(4, 4);                          // 4×0.2=0.8 → 0 → 2
  assert.strictEqual(r.years, 2);
  assert.strictEqual(r.steps.floored, true);
});

ok('資本的支出が取得価額の50%超なら簡便法は使えないと申告する（耐令3条1項ただし書）', () => {
  const r = chukoTaiyoNensu(6, 3, { shihontekiShishutsu: 600000, shutokuKagaku: 1000000 });
  assert.strictEqual(r.unavailable, true);
  assert.strictEqual(r.years, null);
  assert.match(r.reason, /50%/);
  // ちょうど50%は「超える」ではないので使える
  assert.strictEqual(chukoTaiyoNensu(6, 3, { shihontekiShishutsu: 500000, shutokuKagaku: 1000000 }).years, 3);
});

console.log('\n' + n + ' 件すべて緑');
