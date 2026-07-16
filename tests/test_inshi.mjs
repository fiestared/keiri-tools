/**
 * 収入印紙・印紙税額判定コア（inshi_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値はコアを通さず、**国税庁ページに書かれている税額そのもの**で照合する。
 *   - No.7108 の worked example 2件（不動産6,000万円→30,000円／建設工事5,500万円→30,000円）
 *   - No.7140/No.7141 の一覧表の行（2026-07-17 curl生読みで逐語転記）
 *   - No.6925 の取扱い（消費税額等の区分記載→税抜で判定・免税事業者は税込）
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcInshi } from '../docs/assets/inshi_core.js';

const ASSETS = new URL('../docs/assets/', import.meta.url);
const D = JSON.parse(readFileSync(new URL('inshi_r07.json', ASSETS)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// ── 1. ★国税庁 No.7108 の worked example（外部オラクル・1円まで）──────────────────
t('No.7108例: 不動産の譲渡 6,000万円（建物4,000万＋定期借地権2,000万）→ 印紙税30,000円（軽減）', () => {
  const r = calcInshi({ doc: 'k1_fudosan', amount: 60000000 }, D);
  assert.strictEqual(r.tax, 30000, `${r.tax} ≠ 30,000`);
  assert.strictEqual(r.keigenApplied, true, '軽減措置が適用されること');
});
t('No.7108例: 建設工事の請負 5,500万円（建設5,000万＋設計500万）→ 印紙税30,000円（軽減）', () => {
  const r = calcInshi({ doc: 'k2_kensetsu', amount: 55000000 }, D);
  assert.strictEqual(r.tax, 30000, `${r.tax} ≠ 30,000`);
  assert.strictEqual(r.keigenApplied, true);
});

// ── 2. ★軽減は「不動産の譲渡」「建設工事の請負」だけ（急所2）────────────────────────
t('同じ1号でも消費貸借（金銭借用証書）6,000万円は本則 60,000円（軽減を当てない）', () => {
  const r = calcInshi({ doc: 'k1_other', amount: 60000000 }, D);
  assert.strictEqual(r.tax, 60000, `${r.tax} ≠ 60,000（5千万超1億以下・本則）`);
  assert.strictEqual(r.keigenApplied, false);
});
t('同じ2号でも建設工事以外の請負 5,500万円は本則 60,000円（軽減を当てない）', () => {
  const r = calcInshi({ doc: 'k2_other', amount: 55000000 }, D);
  assert.strictEqual(r.tax, 60000, `${r.tax} ≠ 60,000`);
  assert.strictEqual(r.keigenApplied, false);
});
t('軽減の適用下限: 不動産10万円ちょうどは軽減対象外＝本則200円、10万円超で軽減表', () => {
  const at = calcInshi({ doc: 'k1_fudosan', amount: 100000 }, D);
  assert.strictEqual(at.tax, 200, '10万円ちょうど=本則200円（1万以上10万以下）');
  assert.strictEqual(at.keigenApplied, false, '10万円ちょうどに軽減は無い（No.7108 注）');
  const over = calcInshi({ doc: 'k1_fudosan', amount: 300000 }, D);
  assert.strictEqual(over.tax, 200, '30万円=軽減表200円（10万超50万以下）');
  assert.strictEqual(over.keigenApplied, true);
});
t('軽減の適用下限: 建設工事250万円→軽減500円／建設以外の請負250万円→本則1,000円', () => {
  assert.strictEqual(calcInshi({ doc: 'k2_kensetsu', amount: 2500000 }, D).tax, 500);
  assert.strictEqual(calcInshi({ doc: 'k2_other', amount: 2500000 }, D).tax, 1000);
});
t('建設工事100万円ちょうど→軽減対象外＝本則200円（1万以上100万以下）', () => {
  const r = calcInshi({ doc: 'k2_kensetsu', amount: 1000000 }, D);
  assert.strictEqual(r.tax, 200);
  assert.strictEqual(r.keigenApplied, false);
});

// ── 3. ★17号（受取書・領収書）: 5万円境界と消費税（急所1・このツールの主役）──────────
t('領収書 49,999円 → 非課税／50,000円ちょうど → 200円（5万円「未満」が非課税）', () => {
  const under = calcInshi({ doc: 'k17_uriage', amount: 49999 }, D);
  assert.strictEqual(under.taxable, false, '49,999円は非課税');
  assert.strictEqual(under.tax, 0);
  const at = calcInshi({ doc: 'k17_uriage', amount: 50000 }, D);
  assert.strictEqual(at.tax, 200, '50,000円ちょうどは課税（5万円以上100万円以下=200円）');
});
t('★No.6925: 税込54,800円・うち消費税等4,981円の区分記載 → 税抜49,819円で判定＝非課税', () => {
  const r = calcInshi({ doc: 'k17_uriage', amount: 54800, taxPart: 4981 }, D);
  assert.strictEqual(r.judgeAmount, 49819, '判定金額は税抜49,819円');
  assert.strictEqual(r.usedTaxExclusion, true);
  assert.strictEqual(r.taxable, false, '5万円未満＝非課税');
});
t('★No.6925: 同じ54,800円でも区分記載が無ければ（消費税欄0）税込で判定＝200円', () => {
  const r = calcInshi({ doc: 'k17_uriage', amount: 54800 }, D);
  assert.strictEqual(r.tax, 200);
  assert.strictEqual(r.usedTaxExclusion, false);
});
t('★No.6925: 免税事業者は区分記載しても税込で判定＝200円', () => {
  const r = calcInshi({ doc: 'k17_uriage', amount: 54800, taxPart: 4981, menzei: true }, D);
  assert.strictEqual(r.tax, 200, '免税事業者は消費税額等を含めて判定');
  assert.strictEqual(r.usedTaxExclusion, false);
});
t('★No.6925の対象外の号（15号）では消費税額等を引かない（税込で判定）', () => {
  // 債権譲渡契約 10,500円・うち消費税等954円: 引けば1万円未満で非課税になってしまう
  const r = calcInshi({ doc: 'k15', amount: 10500, taxPart: 954 }, D);
  assert.strictEqual(r.tax, 200, '15号は税込10,500円で判定＝200円');
  assert.strictEqual(r.usedTaxExclusion, false);
});

// ── 4. 17号の金額階級（No.7141 逐語）と売上代金/以外の区分（急所3）───────────────────
t('領収書（売上代金）の階級: 100万以下200円／100万超400円／5千万超1億以下2万円／10億超20万円', () => {
  assert.strictEqual(calcInshi({ doc: 'k17_uriage', amount: 1000000 }, D).tax, 200);
  assert.strictEqual(calcInshi({ doc: 'k17_uriage', amount: 1000001 }, D).tax, 400);
  assert.strictEqual(calcInshi({ doc: 'k17_uriage', amount: 100000000 }, D).tax, 20000);
  assert.strictEqual(calcInshi({ doc: 'k17_uriage', amount: 1000000001 }, D).tax, 200000);
});
t('売上代金以外（借入金など）は5万円以上一律200円（1,000万円でも200円）', () => {
  assert.strictEqual(calcInshi({ doc: 'k17_other', amount: 10000000 }, D).tax, 200);
  assert.strictEqual(calcInshi({ doc: 'k17_other', amount: 49999 }, D).taxable, false);
});
t('★営業に関しない受取書は金額によらず非課税（急所4・No.7105）', () => {
  const r = calcInshi({ doc: 'k17_uriage', amount: 30000000, hieigyo: true }, D);
  assert.strictEqual(r.taxable, false);
  assert.strictEqual(r.tax, 0);
});

// ── 5. 1号・2号の本則階級（No.7140 逐語）────────────────────────────────────────
t('1号本則: 1万円未満非課税／1万〜10万 200円／50万超100万以下 1,000円／50億超 60万円', () => {
  assert.strictEqual(calcInshi({ doc: 'k1_other', amount: 9999 }, D).taxable, false);
  assert.strictEqual(calcInshi({ doc: 'k1_other', amount: 10000 }, D).tax, 200);
  assert.strictEqual(calcInshi({ doc: 'k1_other', amount: 1000000 }, D).tax, 1000);
  assert.strictEqual(calcInshi({ doc: 'k1_other', amount: 5000000001 }, D).tax, 600000);
});
t('2号本則: 300万超500万以下 2,000円／500万超1千万以下 10,000円', () => {
  assert.strictEqual(calcInshi({ doc: 'k2_other', amount: 5000000 }, D).tax, 2000);
  assert.strictEqual(calcInshi({ doc: 'k2_other', amount: 5000001 }, D).tax, 10000);
});

// ── 6. 3号（手形）: 非課税10万円未満・一覧払等の特例・記載なしは非課税 ──────────────────
t('手形: 10万円未満非課税／100万円 200円／3千万超5千万以下 10,000円', () => {
  assert.strictEqual(calcInshi({ doc: 'k3', amount: 99999 }, D).taxable, false);
  assert.strictEqual(calcInshi({ doc: 'k3', amount: 1000000 }, D).tax, 200);
  assert.strictEqual(calcInshi({ doc: 'k3', amount: 50000000 }, D).tax, 10000);
});
t('手形の一覧払等の特例: 5,000万円でも一律200円（10万円未満は非課税のまま）', () => {
  assert.strictEqual(calcInshi({ doc: 'k3', amount: 50000000, ichiranbarai: true }, D).tax, 200);
  assert.strictEqual(calcInshi({ doc: 'k3', amount: 99999, ichiranbarai: true }, D).taxable, false);
});
t('手形金額の記載のない手形は非課税（急所5・補充者が納税義務者になる注意を出す）', () => {
  const r = calcInshi({ doc: 'k3', noamount: true }, D);
  assert.strictEqual(r.taxable, false);
  assert.ok(r.notes.some((n) => /補充/.test(n)), '金額補充の注意');
});

// ── 7. 記載金額のない契約書・受取書は200円（急所5）──────────────────────────────
t('契約金額の記載のない1号・2号・15号・16号・17号 → 200円（0円ではない）', () => {
  for (const doc of ['k1_fudosan', 'k1_other', 'k2_kensetsu', 'k2_other', 'k15', 'k16', 'k17_uriage', 'k17_other']) {
    const r = calcInshi({ doc, noamount: true }, D);
    assert.strictEqual(r.tax, 200, `${doc} 記載なし=200円`);
  }
});

// ── 8. 4号（株券等）・15号・16号の階級（No.7140/7141 逐語）─────────────────────────
t('4号: 500万円以下 200円（非課税の下限なし）／1億円超 20,000円', () => {
  assert.strictEqual(calcInshi({ doc: 'k4', amount: 1000 }, D).tax, 200, '4号に非課税の下限は無い');
  assert.strictEqual(calcInshi({ doc: 'k4', amount: 100000001 }, D).tax, 20000);
});
t('15号: 1万円未満非課税・1万円以上200円／16号: 3千円未満非課税・3千円以上200円', () => {
  assert.strictEqual(calcInshi({ doc: 'k15', amount: 9999 }, D).taxable, false);
  assert.strictEqual(calcInshi({ doc: 'k15', amount: 10000 }, D).tax, 200);
  assert.strictEqual(calcInshi({ doc: 'k16', amount: 2999 }, D).taxable, false);
  assert.strictEqual(calcInshi({ doc: 'k16', amount: 3000 }, D).tax, 200);
});

// ── 9. 定額の号（5号〜14号）と通帳（18号〜20号・「1年ごとに」）────────────────────────
t('定額: 5号・6号=4万円／7号=4千円／8〜14号=200円', () => {
  assert.strictEqual(calcInshi({ doc: 'k5' }, D).tax, 40000);
  assert.strictEqual(calcInshi({ doc: 'k6' }, D).tax, 40000);
  assert.strictEqual(calcInshi({ doc: 'k7' }, D).tax, 4000);
  for (const doc of ['k8', 'k9', 'k10', 'k11', 'k12', 'k13', 'k14']) {
    assert.strictEqual(calcInshi({ doc }, D).tax, 200, `${doc}=200円`);
  }
});
t('通帳: 18号=200円/年・19号=400円/年・20号=4,000円/年（perYearを立てる）', () => {
  const r18 = calcInshi({ doc: 'k18' }, D);
  assert.strictEqual(r18.tax, 200); assert.strictEqual(r18.perYear, true);
  assert.strictEqual(calcInshi({ doc: 'k19' }, D).tax, 400);
  assert.strictEqual(calcInshi({ doc: 'k20' }, D).tax, 4000);
});

// ── 10. 単調性と軽減の恒常性 ──────────────────────────────────────────────────
t('単調性: 金額が増えれば印紙税は非減少（1号不動産・2号建設・17号売上代金）', () => {
  for (const doc of ['k1_fudosan', 'k2_kensetsu', 'k17_uriage']) {
    let prev = -1;
    for (const amt of [10000, 100000, 500000, 1000000, 3000000, 10000000, 60000000, 200000000, 2000000000, 9000000000]) {
      const r = calcInshi({ doc, amount: amt }, D);
      assert.ok(r.tax >= prev, `${doc} 税額が減った amt=${amt} (${prev}→${r.tax})`);
      prev = r.tax;
    }
  }
});
t('軽減は本則より高くならない（全金額帯で 軽減 ≤ 本則）', () => {
  for (const amt of [150000, 700000, 3000000, 8000000, 30000000, 80000000, 300000000, 800000000, 3000000000, 9000000000]) {
    const kf = calcInshi({ doc: 'k1_fudosan', amount: amt }, D).tax;
    const ho = calcInshi({ doc: 'k1_other', amount: amt }, D).tax;
    assert.ok(kf <= ho, `不動産軽減${kf} > 本則${ho} (amt=${amt})`);
  }
});

// ── 11. fail closed: データ・入力が無ければ throw（黙って答えない）───────────────────
t('fail closed: データ無し・文書未選択・金額0・消費税額等≧記載金額は throw', () => {
  assert.throws(() => calcInshi({ doc: 'k17_uriage', amount: 100000 }, null), /inshi_r07/);
  assert.throws(() => calcInshi({ doc: 'nonexistent', amount: 100000 }, D), /文書の種類/);
  assert.throws(() => calcInshi({ doc: 'k17_uriage', amount: 0 }, D), /入力してください/);
  assert.throws(() => calcInshi({ doc: 'k17_uriage', amount: 50000, taxPart: 50000 }, D), /消費税額等が記載金額以上/);
  assert.throws(() => calcInshi({ doc: 'k4', noamount: true }, D), /券面金額/);
});
t('fail closed: 17号以外に「営業に関しない」・3号以外に「一覧払」を渡すと throw', () => {
  assert.throws(() => calcInshi({ doc: 'k1_fudosan', amount: 100000, hieigyo: true }, D), /17号/);
  assert.throws(() => calcInshi({ doc: 'k17_uriage', amount: 100000, ichiranbarai: true }, D), /3号|約束手形/);
});

console.log(`\n${fail ? '❌' : '✓'} 収入印紙コア: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
