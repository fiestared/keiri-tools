/**
 * 医療費控除コア（iryohi_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値は iryohi_core を通さずに、**条文の式から手で積んだ定数**で照合する。
 *   これは公開済みの記事「医療費控除はいくらから？いくら戻る？」(/column/iryohi-kojo-ikura-kara/) と
 *   test_iryohi_kojo_article.mjs が別に守っている値そのもの（＝独立実装で二重に固定する）。
 *
 *   足切り＝min(総所得金額等×5%, 10万円)（所法73条1項）。控除額＝min(max(0,(医療費−補填)−足切り),200万)。
 *   軽減額＝所得税(控除額×限界税率) ＋ 復興(所得税×2.1%) ＋ 住民税(控除額×10%)。
 *
 *   ★年収→総所得金額等 は juminzei_core の kyuyoShotoku（別表第五）で出る。下の (年収→総所得→足切り) は
 *     すべて別表第五の刻み境界（4,000円で割り切れる）なので、記事の速算式表とも一致する検証点を選んだ。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcIryohi, ashikiriGaku, iryohiKojo, selfmedKojo, keigenGaku, rateFromKazei } from '../docs/assets/iryohi_core.js';

const ASSETS = new URL('../docs/assets/', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(f, ASSETS)));
const I = load('iryohi_r08.json');
const D = load('juminzei_r08.json');
const refs = { iryohiData: I, juminzeiData: D };

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// ── 1. 足切りの表（年収 → 総所得金額等 → 足切り）。★5%側が効く低所得を含む ──────────
// 別表第五の刻み境界の年収を選んだので、記事の表の値とも一致する（独立オラクル）。
// ★令和8年分（zeisei:'r8'・措法29条の4＝最低保障74万円）と令和7年分までを**両方**固定する。
//   改正が効くのは給与収入220万円未満だけ（220万円以上は別表第五が改正前と完全一致）なので、
//   250万・300万・500万は r7 と r8 で同じ値になるのが正しい。ここが食い違ったら委譲が壊れている。
const ASHI = [
  // shunyu,     r7: 総所得/足切り,        r8: 総所得/足切り,        capped(r8)
  { shunyu: 1600000, soto: 950000,  ashi: 47500,  sotoR8: 860000,  ashiR8: 43000,  capped: false },
  { shunyu: 2000000, soto: 1320000, ashi: 66000,  sotoR8: 1260000, ashiR8: 63000,  capped: false },
  { shunyu: 2500000, soto: 1670000, ashi: 83500,  sotoR8: 1670000, ashiR8: 83500,  capped: false },
  { shunyu: 3000000, soto: 2020000, ashi: 100000, sotoR8: 2020000, ashiR8: 100000, capped: true },
  { shunyu: 5000000, soto: 3560000, ashi: 100000, sotoR8: 3560000, ashiR8: 100000, capped: true },
];
for (const a of ASHI) {
  t(`足切り[令和7年分まで] 年収${a.shunyu} → 総所得${a.soto} → 足切り${a.ashi}`, () => {
    const r = calcIryohi({ iryohi: 500000, kyuyoShunyu: a.shunyu, shotokuzeiRate: 10 }, refs);
    assert.strictEqual(r.sotoShotoku, a.soto, `総所得 ${r.sotoShotoku} ≠ ${a.soto}`);
    assert.strictEqual(r.ashikiri, a.ashi, `足切り ${r.ashikiri} ≠ ${a.ashi}`);
  });
  t(`足切り[令和8年分] 年収${a.shunyu} → 総所得${a.sotoR8} → 足切り${a.ashiR8}${a.capped ? '(10万で頭打ち)' : '(5%側)'}`, () => {
    const r = calcIryohi({ iryohi: 500000, kyuyoShunyu: a.shunyu, zeisei: 'r8', shotokuzeiRate: 10 }, refs);
    assert.strictEqual(r.sotoShotoku, a.sotoR8, `総所得 ${r.sotoShotoku} ≠ ${a.sotoR8}`);
    assert.strictEqual(r.ashikiri, a.ashiR8, `足切り ${r.ashikiri} ≠ ${a.ashiR8}`);
    assert.strictEqual(r.ashikiriCapped, a.capped, '10万円で頭打ちか');
  });
}
// ★改正の向きを固定する: 収入220万円未満は「足切りが下がる＝控除額が増える」側にしか動かない。
//   逆向き（R7のほうが有利）になったら実装か表のどちらかが壊れている。
t('令和8年分は収入220万円未満の足切りが必ず下がる（＝控除額が増える）', () => {
  for (const shunyu of [800000, 1200000, 1600000, 2000000, 2190000]) {
    const r7 = calcIryohi({ iryohi: 500000, kyuyoShunyu: shunyu, shotokuzeiRate: 10 }, refs);
    const r8 = calcIryohi({ iryohi: 500000, kyuyoShunyu: shunyu, zeisei: 'r8', shotokuzeiRate: 10 }, refs);
    assert.ok(r8.ashikiri < r7.ashikiri, `年収${shunyu}: R8足切り${r8.ashikiri} は R7${r7.ashikiri} より小さいはず`);
    assert.ok(r8.normal.kojo > r7.normal.kojo, `年収${shunyu}: R8の控除額が増えるはず`);
  }
});
t('令和8年分でも収入220万円以上は令和7年分と完全に一致する（別表第五は不変）', () => {
  for (const shunyu of [2200000, 2500000, 2970000, 3000000, 5000000, 8000000]) {
    const r7 = calcIryohi({ iryohi: 500000, kyuyoShunyu: shunyu, shotokuzeiRate: 10 }, refs);
    const r8 = calcIryohi({ iryohi: 500000, kyuyoShunyu: shunyu, zeisei: 'r8', shotokuzeiRate: 10 }, refs);
    assert.strictEqual(r8.sotoShotoku, r7.sotoShotoku, `年収${shunyu}: 総所得が一致しない`);
  }
});

// ── 2. 看板の答え: 医療費30万・補填0・年収500万（足切り10万）→ 控除額20万・還付40,420（税率10%） ──
t('医療費30万・補填0・年収500万 → 控除額20万', () => {
  const r = calcIryohi({ iryohi: 300000, hoten: 0, kyuyoShunyu: 5000000, shotokuzeiRate: 10 }, refs);
  assert.strictEqual(r.normal.kojo, 200000, `控除額 ${r.normal.kojo} ≠ 200000`);
});
t('控除額20万・税率10% → 所得税20,000＋復興420＋住民税20,000 = 40,420', () => {
  const r = calcIryohi({ iryohi: 300000, hoten: 0, kyuyoShunyu: 5000000, shotokuzeiRate: 10 }, refs);
  const k = r.normal.keigen;
  assert.strictEqual(k.shotokuzei, 20000, '所得税の軽減');
  assert.strictEqual(k.fukko, 420, '復興特別所得税(2.1%)');
  assert.strictEqual(k.jumin, 20000, '住民税の軽減(10%)');
  assert.strictEqual(k.total, 40420, '軽減額の合計');
});
t('控除額20万・税率20% → 軽減額 60,840', () => {
  const r = calcIryohi({ iryohi: 300000, hoten: 0, kyuyoShunyu: 5000000, shotokuzeiRate: 20 }, refs);
  assert.strictEqual(r.normal.keigen.total, 60840, `税率20%の軽減 ${r.normal.keigen.total} ≠ 60840`);
});

// ── 3. ★低所得の主役: 医療費6万・年収160万 → 足切り43,000 → 控除額17,000（10万未満でも使える） ──
// ★これは記事とツールのFAQに載せている数値例そのもの。画面の文言と実装をここで固定する。
t('医療費6万・年収160万[令和8年分] → 控除額17,000（10万円は下限ではない）', () => {
  const r = calcIryohi({ iryohi: 60000, kyuyoShunyu: 1600000, zeisei: 'r8', shotokuzeiRate: 5 }, refs);
  assert.strictEqual(r.sotoShotoku, 860000, '総所得は 160万 − 74万 = 86万（措法29条の4）');
  assert.strictEqual(r.ashikiri, 43000, '足切りは5%側（43,000）');
  assert.strictEqual(r.normal.kojo, 17000, '控除額 = 60,000 − 43,000');
});

// ── 4. ★補填金は「その給付の目的となった医療費」を限度に引く（No.1125） ──────────────
t('補填ひも付き: 医療費27万(入院15万+通院12万)・入院給付20万 → 控除額20,000（総額から引く誤りなら0）', () => {
  // ひも付き対象=入院費15万 → 引くのは min(20万,15万)=15万 → 27万−15万=12万 −足切り10万 = 20,000
  const r = calcIryohi({ iryohi: 270000, hoten: 200000, hotenTaisho: 150000, kyuyoShunyu: 5000000, shotokuzeiRate: 10 }, refs);
  assert.strictEqual(r.normal.netHoten, 150000, '補填はひも付き医療費15万を限度に引く');
  assert.strictEqual(r.normal.kojo, 20000, '控除額20,000');
});
t('補填ひも付きを渡さない（保守側）: 総額27万から補填20万を引く → 控除額0', () => {
  const r = calcIryohi({ iryohi: 270000, hoten: 200000, kyuyoShunyu: 5000000, shotokuzeiRate: 10 }, refs);
  assert.strictEqual(r.normal.netHoten, 200000, 'ひも付き不明なら医療費全体から引く');
  assert.strictEqual(r.normal.kojo, 0, '控除額0（引き方で結論が変わる）');
});

// ── 5. 控除額の上限200万円 ────────────────────────────────────────────────
t('医療費300万・補填0・高所得 → 控除額は200万円で頭打ち', () => {
  const r = calcIryohi({ iryohi: 3000000, hoten: 0, kyuyoShunyu: 8000000, shotokuzeiRate: 33 }, refs);
  assert.strictEqual(r.normal.kojo, 2000000, '200万円上限');
  assert.strictEqual(r.normal.capped, true, '上限に張り付いたと申告');
});

// ── 6. セルフメディケーション税制（12,000円超・88,000円限度）と、通常との選択 ──────────
t('セルフメディ: 購入3万 → 控除額18,000 / 購入20万 → 88,000で頭打ち', () => {
  assert.strictEqual(selfmedKojo(30000, I).kojo, 18000, '30,000 − 12,000');
  assert.strictEqual(selfmedKojo(200000, I).kojo, 88000, '88,000で頭打ち');
  assert.strictEqual(selfmedKojo(10000, I).kojo, 0, '12,000以下は0');
});
t('★通常とセルフメディは選択: セルフメディの控除額が大きければ selfmed を推奨', () => {
  // 医療費11万(足切り10万で控除1万) vs セルフメディ購入10万(控除88,000) → selfmed
  const r = calcIryohi({ iryohi: 110000, kyuyoShunyu: 5000000, selfmedPurchase: 100000, shotokuzeiRate: 10 }, refs);
  assert.strictEqual(r.normal.kojo, 10000, '通常控除は1万');
  assert.strictEqual(r.selfmed.kojo, 88000, 'セルフメディは88,000');
  assert.strictEqual(r.recommended, 'selfmed', '大きい方（セルフメディ）を推奨');
});
t('医療費が大きければ通常を推奨', () => {
  const r = calcIryohi({ iryohi: 500000, kyuyoShunyu: 5000000, selfmedPurchase: 30000, shotokuzeiRate: 10 }, refs);
  assert.strictEqual(r.recommended, 'normal', '通常控除の方が大きい');
});

// ── 7. 速算表: 課税所得帯 → 限界税率（No.2260・7区分） ───────────────────────
t('速算表: 課税所得の帯ごとに正しい限界税率を引く', () => {
  assert.strictEqual(rateFromKazei(1950000, I), 5, '195万以下=5%');
  assert.strictEqual(rateFromKazei(2000000, I), 10, '195万超=10%');
  assert.strictEqual(rateFromKazei(6950000, I), 20, '695万以下=20%');
  assert.strictEqual(rateFromKazei(9000000, I), 23, '900万以下=23%');
  assert.strictEqual(rateFromKazei(18000000, I), 33, '1,800万以下=33%');
  assert.strictEqual(rateFromKazei(40000000, I), 40, '4,000万以下=40%');
  assert.strictEqual(rateFromKazei(50000000, I), 45, '4,000万超=45%');
});

// ── 8. ★税率が選ばれていなければ軽減額は null（黙って0円で答えない・控除額は出す） ──────
t('税率未選択（速算表に無い率）→ keigen は null・控除額は計算する', () => {
  const r = calcIryohi({ iryohi: 300000, kyuyoShunyu: 5000000 }, refs); // shotokuzeiRate 無し
  assert.strictEqual(r.rateValid, false, '税率は未選択');
  assert.strictEqual(r.normal.kojo, 200000, '控除額は税率が無くても出る');
  assert.strictEqual(r.normal.keigen, null, '軽減額は null（0円で嘘をつかない）');
  const r7 = calcIryohi({ iryohi: 300000, kyuyoShunyu: 5000000, shotokuzeiRate: 7 }, refs); // 7%は速算表に無い
  assert.strictEqual(r7.rateValid, false, '7%は速算表に無い');
  assert.strictEqual(r7.normal.keigen, null, '速算表に無い率は無効');
});

// ── 9. 総所得金額等を直接指定できる（給与以外の所得がある人）。年収より優先 ──────────
t('総所得金額等の直接指定が年収より優先される', () => {
  const r = calcIryohi({ iryohi: 300000, kyuyoShunyu: 5000000, sotoShotoku: 1000000, shotokuzeiRate: 10 }, refs);
  assert.strictEqual(r.sotoShotoku, 1000000, '直接指定が優先');
  assert.strictEqual(r.ashikiri, 50000, '総所得100万 → 足切り5%=50,000');
  // 直接指定なら juminzei データが無くても計算できる
  const r2 = calcIryohi({ iryohi: 300000, sotoShotoku: 1000000, shotokuzeiRate: 10 }, { iryohiData: I });
  assert.strictEqual(r2.ashikiri, 50000, 'juminzei無しでも直接指定なら計算できる');
});

// ── 10. fail closed: 参照データ・所得が無ければ黙って答えず throw ─────────────────
t('参照データ・所得の欠落は throw（黙って過大な控除額を出さない）', () => {
  assert.throws(() => calcIryohi({ iryohi: 300000, kyuyoShunyu: 5000000 }, {}), /iryohi_r08/);
  // 年収も総所得も無い → 足切りが0になって控除額を過大に出すので throw
  assert.throws(() => calcIryohi({ iryohi: 300000 }, refs), /総所得金額等（または給与収入）/);
  // 年収から換算するのに juminzei データが無い → throw
  assert.throws(() => calcIryohi({ iryohi: 300000, kyuyoShunyu: 5000000 }, { iryohiData: I }), /juminzei_r08/);
});

// ── 11. 単調性: 足切りは総所得が増えると増える（10万で頭打ち）。控除額は補填が増えると減る ──
t('単調性: 足切りは非減少で10万円で頭打ち', () => {
  let prev = -1;
  for (const soto of [0, 500000, 1000000, 1999999, 2000000, 5000000]) {
    const a = ashikiriGaku(soto, I);
    assert.ok(a >= prev, `足切りが減った soto=${soto}`);
    assert.ok(a <= 100000, '10万円を超えない');
    prev = a;
  }
});

// ── 12. iryohiKojo 単体: 足切りを直接与えたときの控除額（上限・下限の境界） ──────────
t('iryohiKojo: 補填で医療費を下回っても控除額は0未満にならない', () => {
  const r = iryohiKojo(50000, 80000, null, 5000000, I); // 補填が医療費を上回る
  assert.strictEqual(r.netIryohi, 0, '医療費−補填は0で止まる');
  assert.strictEqual(r.kojo, 0, '控除額0');
});
t('keigenGaku: 課税所得を跨がない範囲で控除額×率×(1+2.1%)＋10%', () => {
  const k = keigenGaku(100000, 23, I); // 控除10万・税率23%
  assert.strictEqual(k.shotokuzei, 23000);
  assert.strictEqual(k.fukko, 483); // round(23000*2.1%)=483
  assert.strictEqual(k.jumin, 10000);
  assert.strictEqual(k.total, 33483);
});

console.log(`\n${fail ? '❌' : '✓'} 医療費控除コア: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
