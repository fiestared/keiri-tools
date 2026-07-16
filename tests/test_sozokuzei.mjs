/**
 * 相続税コア（sozokuzei_core.js）の単体テスト。
 *
 * ★オラクルの独立性（CLAUDE.md 一次情報の読み方）:
 *   期待値は sozokuzei_core を通さず、**条文の式から手で積んだ定数**で照合する。
 *   headline の4値（下の HAYAMIHYO）は、世に広く公開されている**相続税の早見表**の値そのもの
 *   （配偶者あり・子2人／配偶者なし・子）。別々の資料が同じ額に噛み合えば、読み違えていないと分かる。
 *
 *   計算（相法15・16・18・19条の2）:
 *     基礎控除 = 3,000万 + 600万×法定相続人の数
 *     課税遺産総額 = 課税価格合計 − 基礎控除
 *     各法定相続人の法定相続分に応ずる取得金額（1,000円未満切捨）に速算表 → 合計（100円未満切捨）= 相続税の総額
 *     配偶者が法定相続分を取得 → 配偶者は税額軽減で0／兄弟姉妹は2割加算
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcSozokuzei, houteiSozokunin, kisoKojo, sokusanZei, houteiBun } from '../docs/assets/sozokuzei_core.js';

const ASSETS = new URL('../docs/assets/', import.meta.url);
const D = JSON.parse(readFileSync(new URL('sozokuzei_r08.json', ASSETS)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// ── 1. ★公開されている相続税の早見表と1円まで一致（外部オラクル）─────────────────
// [遺産(円), 配偶者, 実子, 相続税の総額, 実際の納税額(配偶者が法定相続分取得)]
const HAYAMIHYO = [
  // 1億・配偶者あり・子2人 → 総額630万 / 実質315万（配偶者0 + 子315万）
  { isan: 100000000, spouse: true,  kids: 2, sogaku: 6300000,  jishitsu: 3150000 },
  // 2億・配偶者あり・子2人 → 総額2,700万 / 実質1,350万
  { isan: 200000000, spouse: true,  kids: 2, sogaku: 27000000, jishitsu: 13500000 },
  // 1億・配偶者なし・子2人 → 総額770万（=実質。軽減も加算も無い）
  { isan: 100000000, spouse: false, kids: 2, sogaku: 7700000,  jishitsu: 7700000 },
  // 1億・配偶者なし・子1人 → 総額1,220万
  { isan: 100000000, spouse: false, kids: 1, sogaku: 12200000, jishitsu: 12200000 },
];
for (const h of HAYAMIHYO) {
  t(`早見表 遺産${h.isan/100000000}億・配偶者${h.spouse ? 'あり' : 'なし'}・子${h.kids}人 → 総額${h.sogaku} / 実質${h.jishitsu}`, () => {
    const r = calcSozokuzei({ isanTotal: h.isan, hasSpouse: h.spouse, numChildrenReal: h.kids }, D);
    assert.strictEqual(r.sogaku, h.sogaku, `相続税の総額 ${r.sogaku} ≠ ${h.sogaku}`);
    assert.strictEqual(r.jishitsuFutan, h.jishitsu, `実際の納税額 ${r.jishitsuFutan} ≠ ${h.jishitsu}`);
  });
}

// ── 2. ★兄弟姉妹が相続人 → 2割加算（相法18条）。総額770万・実質924万 ────────────────
t('兄弟姉妹2人・1億（配偶者/子/親なし）→ 総額770万・実質924万（2割加算）', () => {
  const r = calcSozokuzei({ isanTotal: 100000000, hasSpouse: false, numSiblings: 2 }, D);
  assert.strictEqual(r.sogaku, 7700000, `総額 ${r.sogaku}`);
  assert.strictEqual(r.niwariKasan, true, '兄弟姉妹は2割加算の対象');
  // 各人 385万 × 1.2 = 462万、2人で924万
  assert.strictEqual(r.jishitsuFutan, 9240000, `実質 ${r.jishitsuFutan} ≠ 9,240,000（2割加算後）`);
});

// ── 3. ★配偶者のみ（子・親・兄弟なし）→ 配偶者の税額軽減で実質0（総額は出る）─────────
t('配偶者のみ・1億 → 総額1,220万・実質0（配偶者は法定相続分＝全部を1.6億まで非課税）', () => {
  const r = calcSozokuzei({ isanTotal: 100000000, hasSpouse: true }, D);
  assert.strictEqual(r.houteiCount, 1, '法定相続人は配偶者1人');
  assert.strictEqual(r.sogaku, 12200000, '総額（基礎控除3,600万）');
  assert.strictEqual(r.jishitsuFutan, 0, '配偶者の税額軽減で0');
});

// ── 4. ★配偶者＋親（子なし）→ 法定相続分 2/3 : 1/3（親は2割加算なし）─────────────────
t('配偶者＋親2人・1億 → 総額6,666,400（2/3:1/3の按分＋速算表）・親は2割加算なし', () => {
  const r = calcSozokuzei({ isanTotal: 100000000, hasSpouse: true, numParents: 2 }, D);
  assert.strictEqual(r.houteiCount, 3, '配偶者＋親2人');
  assert.strictEqual(r.sogaku, 6666400, `総額 ${r.sogaku} ≠ 6,666,400`);
  assert.strictEqual(r.niwariKasan, false, '親（直系尊属）は2割加算の対象外');
});

// ── 5. ★養子の算入制限（相法15条3項）─────────────────────────────────────────
t('養子制限: 実子1＋養子3 → 法定相続人は「実子1＋養子1」＝2人（養子は1人まで）', () => {
  const s = houteiSozokunin({ hasSpouse: false, numChildrenReal: 1, numChildrenAdopted: 3 }, D);
  assert.strictEqual(s.blood.n, 2, '実子1＋養子1＝2');
  assert.strictEqual(s.count, 2, '法定相続人の数');
  assert.strictEqual(kisoKojo(s.count, D), 30000000 + 6000000 * 2, '基礎控除は2人ぶん');
});
t('養子制限: 実子0＋養子3 → 法定相続人は養子2人まで', () => {
  const s = houteiSozokunin({ hasSpouse: false, numChildrenReal: 0, numChildrenAdopted: 3 }, D);
  assert.strictEqual(s.blood.n, 2, '実子なしなら養子は2人まで');
});
t('養子を無制限に数えると基礎控除が過大（制限の逆をやると別の額）', () => {
  // 制限後2人 → 基礎控除4,200万。もし養子3人を全部数えたら4人→5,400万（過大）になる。差を固定。
  const s = houteiSozokunin({ hasSpouse: false, numChildrenReal: 1, numChildrenAdopted: 3 }, D);
  assert.notStrictEqual(kisoKojo(s.count, D), 30000000 + 6000000 * 4);
});

// ── 6. ★基礎控除以下は相続税0（相法15条・急所6）───────────────────────────────
t('遺産4,800万・配偶者＋子2人（基礎控除4,800万）→ ちょうど基礎控除 → 税額0', () => {
  const r = calcSozokuzei({ isanTotal: 48000000, hasSpouse: true, numChildrenReal: 2 }, D);
  assert.strictEqual(r.belowKiso, true, '基礎控除以下');
  assert.strictEqual(r.sogaku, 0, '相続税の総額0');
  assert.strictEqual(r.jishitsuFutan, 0, '実質0');
});
t('遺産3,600万・子1人のみ（基礎控除3,600万）→ 税額0', () => {
  const r = calcSozokuzei({ isanTotal: 36000000, hasSpouse: false, numChildrenReal: 1 }, D);
  assert.strictEqual(r.sogaku, 0, '基礎控除ちょうどで0');
});

// ── 7. 速算表の帯の境界（相法16条・No.4155・8区分）────────────────────────────
t('速算表: 各帯の境界で正しい税率・控除額', () => {
  assert.strictEqual(sokusanZei(10000000, D).rate_pct, 10, '1,000万ちょうど=10%');
  assert.strictEqual(sokusanZei(10000001, D).rate_pct, 15, '1,000万超=15%');
  assert.strictEqual(sokusanZei(30000000, D).rate_pct, 15, '3,000万以下=15%');
  assert.strictEqual(sokusanZei(50000000, D).rate_pct, 20, '5,000万以下=20%');
  assert.strictEqual(sokusanZei(100000000, D).rate_pct, 30, '1億以下=30%');
  assert.strictEqual(sokusanZei(200000000, D).rate_pct, 40, '2億以下=40%');
  assert.strictEqual(sokusanZei(300000000, D).rate_pct, 45, '3億以下=45%');
  assert.strictEqual(sokusanZei(600000000, D).rate_pct, 50, '6億以下=50%');
  assert.strictEqual(sokusanZei(600000001, D).rate_pct, 55, '6億超=55%');
  // 速算表の具体額: 3,000万円 → 3,000万×15% − 50万 = 400万
  assert.strictEqual(sokusanZei(30000000, D).zei, 4000000, '3,000万→400万');
  // 6億超の例: 7億 → 7億×55% − 7,200万 = 3億1,300万
  assert.strictEqual(sokusanZei(700000000, D).zei, 313000000, '7億→3億1,300万');
});

// ── 8. 法定相続分（民法900条）─────────────────────────────────────────────────
t('法定相続分: 配偶者と子/親/兄弟で配偶者側が 1/2・2/3・3/4', () => {
  assert.deepStrictEqual(houteiBun({ spouse: true, blood: { kind: 'child', n: 2 } }).spouse, [1, 2], '配偶者と子→1/2');
  assert.deepStrictEqual(houteiBun({ spouse: true, blood: { kind: 'parent', n: 2 } }).spouse, [2, 3], '配偶者と親→2/3');
  assert.deepStrictEqual(houteiBun({ spouse: true, blood: { kind: 'sibling', n: 3 } }).spouse, [3, 4], '配偶者と兄弟→3/4');
  assert.deepStrictEqual(houteiBun({ spouse: false, blood: { kind: 'child', n: 4 } }).blood, [1, 4], '配偶者なし→血族が等分');
});

// ── 9. 相続の順位（民法887〜890条）: 子がいれば親・兄弟は相続人にならない ─────────────
t('順位: 子がいれば親・兄弟の入力は無視される（第1順位が優先）', () => {
  const s = houteiSozokunin({ hasSpouse: true, numChildrenReal: 1, numParents: 2, numSiblings: 3 }, D);
  assert.strictEqual(s.blood.kind, 'child', '子が第1順位');
  assert.strictEqual(s.count, 2, '配偶者＋子1（親・兄弟は数えない）');
});
t('順位: 子がいなければ親、親もいなければ兄弟', () => {
  assert.strictEqual(houteiSozokunin({ hasSpouse: false, numParents: 1, numSiblings: 3 }, D).blood.kind, 'parent', '子なし→親');
  assert.strictEqual(houteiSozokunin({ hasSpouse: false, numSiblings: 3 }, D).blood.kind, 'sibling', '子・親なし→兄弟');
});

// ── 10. 単調性: 遺産が増えれば相続税の総額は非減少 ──────────────────────────────
t('単調性: 遺産が増えると総額は非減少', () => {
  let prev = -1;
  for (const isan of [40000000, 50000000, 100000000, 300000000, 1000000000]) {
    const r = calcSozokuzei({ isanTotal: isan, hasSpouse: true, numChildrenReal: 2 }, D);
    assert.ok(r.sogaku >= prev, `総額が減った isan=${isan}`);
    prev = r.sogaku;
  }
});

// ── 11. fail closed: 参照データ・相続人・遺産が無ければ throw（黙って答えない）──────────
t('fail closed: データ無し・相続人無し・遺産0/負は throw', () => {
  assert.throws(() => calcSozokuzei({ isanTotal: 100000000, hasSpouse: true }, null), /sozokuzei_r08/);
  assert.throws(() => calcSozokuzei({ isanTotal: 100000000 }, D), /法定相続人がいません/); // 誰も入力なし
  assert.throws(() => calcSozokuzei({ isanTotal: 0, hasSpouse: true, numChildrenReal: 1 }, D), /遺産総額/);
});

console.log(`\n${fail ? '❌' : '✓'} 相続税コア: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
