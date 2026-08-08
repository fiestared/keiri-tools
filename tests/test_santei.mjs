/**
 * 算定基礎届（定時決定）の検査。
 *
 * ★オラクルは条文そのもの（健康保険法41条・43条／厚生年金保険法21条／健保則24条の2）。
 *   分母を3で固定すると等級が下がる方向で誤り、保険料を過少に見せる。
 */
import { readFileSync } from 'node:fs';
import {
  hitsuyoNissu, taishogai, teijiKettei, tekiyoKikan, zuijiNissuOK,
} from '../docs/assets/santei_core.js';
import { kenkoGrade, koseiStandard } from '../docs/assets/shaho_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/santei_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);
const M = (name, hoshu, nissu, zaiseki = true) => ({ name, hoshu, nissu, zaiseki });

// ── データが条文と一致するか ────────────────────────────────────
console.log('★データ');
eq(D.nissu.ippan, 17, '一般は17日（41条1項の括弧書き）');
eq(D.nissu.tanjikan, 11, '短時間労働者は11日（同・施行規則24条の2）');
eq(D.zuiji.nissu, 17, '随時改定も17日（43条1項）');
eq(D.zuiji.tsukisu, 3, '随時改定は3月間');
eq(D.taishogai.shutoku_from, '06-01', '対象外の始期（41条3項）');
eq(D.taishogai.shutoku_to, '07-01', '対象外の終期（41条3項）');
ok(D.nissu.tanjikan_teigi._note.includes('4分の3'),
  '★短時間労働者の定義に「4分の3未満」が書かれている（施行規則24条の2）');

// ── 必要日数 ──────────────────────────────────────────────
console.log('★必要日数');
eq(hitsuyoNissu(false, D), 17, '一般');
eq(hitsuyoNissu(true, D), 11, '短時間労働者');

// ── ★分母は残った月数（3で固定ではない）────────────────────────
console.log('★分母');
{
  const r = teijiKettei([M('4月', 300000, 20), M('5月', 300000, 20), M('6月', 300000, 20)], false, D);
  eq(r.tsukisu, 3, '3か月とも17日以上なら分母は3');
  eq(r.hoshuGetsugaku, 300000, '平均');
}
{
  // ★5月だけ日数不足。除いて「残った2か月」で割る
  const r = teijiKettei([M('4月', 300000, 20), M('5月', 100000, 10), M('6月', 300000, 20)], false, D);
  eq(r.tsukisu, 2, '★除いた後の月数で割る');
  eq(r.sokei, 600000, '対象月の合計（除いた月の報酬は足さない）');
  eq(r.hoshuGetsugaku, 300000, '★正しくは 600,000 ÷ 2 = 300,000');
  const bunbo3 = Math.floor((300000 + 100000 + 300000) / 3);
  ok(bunbo3 === 233333 && r.hoshuGetsugaku !== bunbo3,
    `★常に3で割ると ${bunbo3.toLocaleString()}円 になり、等級が下がる方向で誤る`);
  checks++;
  // 等級まで確かめる（誤ると保険料が変わる）
  const seikai = kenkoGrade(r.hoshuGetsugaku);
  const machigai = kenkoGrade(bunbo3);
  ok(seikai.grade !== machigai.grade,
    `★等級も変わる: 正 第${seikai.grade}級(${seikai.standard.toLocaleString()}) / 誤 第${machigai.grade}級(${machigai.standard.toLocaleString()})`);
  checks++;
}
{
  // ★短時間労働者なら11日で足りるので除かれない
  const months = [M('4月', 120000, 12), M('5月', 120000, 12), M('6月', 120000, 12)];
  eq(teijiKettei(months, true, D).tsukisu, 3, '短時間労働者は12日でも対象');
  eq(teijiKettei(months, false, D).tsukisu, 0, '一般なら12日は全月が除かれる');
}
{
  // 在籍していない月（継続して使用された期間に限る）
  const r = teijiKettei([M('4月', 0, 0, false), M('5月', 280000, 20), M('6月', 300000, 21)], false, D);
  eq(r.tsukisu, 2, '在籍していない月は対象にしない');
  eq(r.hoshuGetsugaku, 290000, '残り2か月の平均');
  ok(r.excluded.some((e) => e.riyu.includes('在籍')), '除外の理由を書いている');
}
{
  // ★全月が日数不足 → 金額を出さない
  const r = teijiKettei([M('4月', 80000, 5), M('5月', 80000, 6), M('6月', 80000, 4)], false, D);
  ok(r.sanshutsuFuka, '★全月が不足なら算出不可');
  eq(r.hoshuGetsugaku, null, '★0で割らず null を返す（保険者等が決定する領域）');
}

// ── ★17日ちょうどは含む ─────────────────────────────────────
console.log('★17日の境目');
eq(teijiKettei([M('4月', 300000, 17)], false, D).tsukisu, 1, '★17日ちょうどは対象（条文は「十七日未満…を除く」）');
eq(teijiKettei([M('4月', 300000, 16)], false, D).tsukisu, 0, '16日は除かれる');
eq(teijiKettei([M('4月', 120000, 11)], true, D).tsukisu, 1, '★短時間で11日ちょうどは対象');
eq(teijiKettei([M('4月', 120000, 10)], true, D).tsukisu, 0, '短時間で10日は除かれる');

// ── ★対象外（41条3項）───────────────────────────────────────
console.log('★定時決定の対象外');
ok(taishogai('2026-06-01', false, 2026, D).taishogai, '★6月1日ちょうどは対象外（両端を含む）');
ok(taishogai('2026-07-01', false, 2026, D).taishogai, '★7月1日ちょうども対象外');
ok(!taishogai('2026-05-31', false, 2026, D).taishogai, '5月31日取得は対象');
ok(!taishogai('2026-07-02', false, 2026, D).taishogai, '7月2日取得は…');
ok(taishogai('', true, 2026, D).taishogai, '★7〜9月から随時改定される人は対象外');
ok(taishogai('', true, 2026, D).riyu.includes('改定されるべき'),
  '★「改定されるべき」— 届け出ていなくても該当すれば外れる');
ok(!taishogai('', false, 2026, D).taishogai, '該当しなければ対象');

// ── 適用期間（41条2項）──────────────────────────────────────
console.log('★適用期間');
eq(tekiyoKikan(2026).from, '2026年9月', 'その年の9月から');
eq(tekiyoKikan(2026).to, '2027年8月', '翌年8月まで');

// ── ★随時改定は日数の使い方が逆（43条1項）────────────────────────
console.log('★随時改定との違い');
{
  const months = [M('4月', 400000, 20), M('5月', 400000, 15), M('6月', 400000, 20)];
  ok(!zuijiNissuOK(months, D).mitasu,
    '★随時改定は1か月でも17日未満なら要件を満たさない（除くのではない）');
  eq(zuijiNissuOK(months, D).kaketaTsuki.length, 1, '欠けた月を返す');
  // 同じ月で定時決定なら「除いて残り2か月で算定」になる — 結論が違う
  const t = teijiKettei(months, false, D);
  eq(t.tsukisu, 2, '★同じ入力でも定時決定は残り2か月で算定する');
  ok(zuijiNissuOK(months, D).mitasu === false && t.tsukisu > 0,
    '★同じ17日でも、随時改定は「不可」・定時決定は「算定できる」');
  checks++;
}
ok(zuijiNissuOK([M('4月', 400000, 17), M('5月', 400000, 17), M('6月', 400000, 17)], D).mitasu,
  '全月17日ちょうどなら要件を満たす');

// ── 等級への接続（shaho_core を使う。再実装しない）──────────────────
console.log('★等級');
{
  const r = teijiKettei([M('4月', 300000, 20), M('5月', 310000, 20), M('6月', 290000, 20)], false, D);
  eq(r.hoshuGetsugaku, 300000, '平均は300,000');
  const g = kenkoGrade(r.hoshuGetsugaku);
  eq(g.standard, 300000, '健保の標準報酬月額');
  eq(koseiStandard(r.hoshuGetsugaku), 300000, '厚年の標準報酬月額');
}
{
  // ★厚年は650,000で頭打ち（健保は上に続く）
  const r = teijiKettei([M('4月', 1000000, 20)], false, D);
  eq(koseiStandard(r.hoshuGetsugaku), 650000, '★厚年は650,000円で頭打ち');
  ok(kenkoGrade(r.hoshuGetsugaku).standard > 650000, '健保はその上の等級が続く');
}

// ── ★壊しテスト ─────────────────────────────────────────────
console.log('★壊しテスト');
{
  // 「17日以下を除く」と書いた実装は、17日ちょうどの月を落とす
  const months = [M('4月', 300000, 17), M('5月', 200000, 20), M('6月', 200000, 20)];
  const seikai = teijiKettei(months, false, D).hoshuGetsugaku;             // 3か月平均
  const machigai = Math.floor((200000 + 200000) / 2);                      // 17日を落とした場合
  ok(seikai === 233333 && machigai === 200000 && seikai !== machigai,
    `★「17日未満」を「17日以下」と書くと ${seikai.toLocaleString()} → ${machigai.toLocaleString()} に変わる`);
  checks++;
  console.log('  ok   17日ちょうど: 条文どおり→含む / 「以下」実装→落ちる');
}

console.log(`\n${fail ? '✗' : '✓'} test_santei: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
