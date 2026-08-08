/**
 * 法定福利費（事業主負担）の検査。
 *
 * ★オラクル: 労災保険率は徴収法施行規則 別表第1（e-Gov から機械抽出）、
 *   雇用保険率は shaho_rates_r08.json（厚労省の公表値。test_koyou_oracle が照合）、
 *   健保・介護・厚年・子育て拠出金は shaho_rates_r08.json。
 *   「全部折半」と書く実装は会社の負担を過少に見せる。
 */
import { readFileSync } from 'node:fs';
import { jigyonushiFutan, rousaiRate, nenganAndRatio } from '../docs/assets/hoteifukuri_core.js';

const R = JSON.parse(readFileSync(new URL('../docs/assets/rousai_r08.json', import.meta.url), 'utf8'));
const S = JSON.parse(readFileSync(new URL('../docs/assets/shaho_rates_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);

// ── 労災保険率のデータ（条文から機械抽出）────────────────────────
console.log('★労災保険率');
eq(R.rates.length, 53, '別表第1の業種数');
eq(rousaiRate('林業', R), 52, '林業は1000分の52');
eq(rousaiRate('その他の各種事業', R), 3, 'その他の各種事業は1000分の3');
eq(rousaiRate('金融業、保険業又は不動産業', R), 2.5, '金融・保険・不動産は1000分の2.5');
eq(rousaiRate('存在しない業種', R), null, '無い業種は null（勝手に既定値を当てない）');
{
  const sen = R.rates.map((x) => x.sen);
  eq(Math.min(...sen), 2.5, '最小');
  eq(Math.max(...sen), 88, '最大');
  ok(Math.max(...sen) / Math.min(...sen) > 30,
    `★業種で ${(Math.max(...sen) / Math.min(...sen)).toFixed(0)}倍 違う（一律の見積りは大きく外す）`);
  ok(R.rates.every((x) => x.shurui && x.sen > 0), '全行に業種名と率がある');
}

// ── ★全額事業主負担のもの ───────────────────────────────
console.log('★折半でないもの');
{
  const r = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85,
    kaigo: false, koyouType: 'general', rousaiSen: 3 }, S);
  // 子ども・子育て拠出金 300,000 × 0.23% = 690（全額事業主）
  eq(r.kosodate, 690, '★子ども・子育て拠出金は全額事業主（本人負担なし）');
  // 労災 300,000 × 3/1000 = 900（全額事業主）
  eq(r.rousai, 900, '★労災保険も全額事業主');
  eq(r.zengakuJigyonushi, 1590, '全額事業主負担の合計');
  // ★雇用保険は労使で率が違う
  eq(r.koyou, 2550, '事業主 300,000 × 8.5/1000');
  eq(r.koyouWorker, 1500, '本人 300,000 × 5/1000');
  ok(r.koyou > r.koyouWorker,
    `★雇用保険は折半でない（事業主 ${r.koyou} > 本人 ${r.koyouWorker}）。差は二事業分`);
  checks++;
}

// ── 折半のもの ─────────────────────────────────────
console.log('★折半のもの');
{
  const r = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85, rousaiSen: 3 }, S);
  eq(r.kenko, 14775, '健保 300,000×9.85%÷2');
  eq(r.kosei, 27450, '厚年 300,000×18.3%÷2');
  eq(r.kaigo, 0, '40歳未満なら介護なし');
}
{
  const r = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85, kaigo: true, rousaiSen: 3 }, S);
  eq(r.kaigo, 2430, '★40歳以上65歳未満は介護 300,000×1.62%÷2');
  const nashi = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85, rousaiSen: 3 }, S);
  ok(r.total - nashi.total === 2430, '介護のぶんだけ増える');
}

// ── ★課税ベースが2種類 ────────────────────────────────
console.log('★課税ベース');
{
  // 標準報酬月額30万・賃金総額32万（通勤手当2万）
  const r = jigyonushiFutan({ hyojun: 300000, chingin: 320000, kenkoPct: 9.85, rousaiSen: 3 }, S);
  eq(r.kenko, 14775, '健保は標準報酬月額で計算する（賃金総額ではない）');
  eq(r.koyou, 2720, '★雇用保険は賃金総額 320,000×8.5/1000');
  eq(r.rousai, 960, '★労災も賃金総額 320,000×3/1000');
  // 全部を標準報酬月額で計算する誤りとの差
  const zenbuHyojun = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85, rousaiSen: 3 }, S);
  ok(r.total > zenbuHyojun.total,
    `★労働保険まで標準報酬月額で計算すると ${(r.total - zenbuHyojun.total).toLocaleString()}円/月 過少になる`);
  checks++;
}

// ── ★業種で会社の負担が変わる ─────────────────────────────
console.log('★業種の効き');
{
  const base = { hyojun: 300000, chingin: 300000, kenkoPct: 9.85 };
  const sonota = jigyonushiFutan({ ...base, rousaiSen: rousaiRate('その他の各種事業', R) }, S);
  const ringyo = jigyonushiFutan({ ...base, rousaiSen: rousaiRate('林業', R) }, S);
  eq(sonota.rousai, 900, 'その他の各種事業 3/1000');
  eq(ringyo.rousai, 15600, '★林業 52/1000');
  ok(ringyo.total - sonota.total === 14700,
    `★同じ給与でも業種が違うと月 ${(ringyo.total - sonota.total).toLocaleString()}円 違う`);
  checks++;
}

// ── 雇用保険の事業の種類 ──────────────────────────────
console.log('★雇用保険の区分');
{
  const base = { hyojun: 300000, chingin: 300000, kenkoPct: 9.85, rousaiSen: 3 };
  const g = jigyonushiFutan({ ...base, koyouType: 'general' }, S);
  const k = jigyonushiFutan({ ...base, koyouType: 'construction' }, S);
  eq(g.koyou, 2550, '一般の事業 8.5/1000');
  eq(k.koyou, 3150, '★建設の事業 10.5/1000');
  ok(k.koyou > g.koyou, '建設のほうが高い');
  eq(jigyonushiFutan({ ...base, koyouType: 'よくわからない' }, S).koyou, 2550,
    '★未知の区分は一般の事業に倒す（勝手に高い率を当てない）');
}

// ── 合計と割合 ─────────────────────────────────────
console.log('★合計');
{
  const r = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85, rousaiSen: 3 }, S);
  eq(r.total, 14775 + 0 + 27450 + 690 + 2550 + 900, '積み上げ');
  const n = nenganAndRatio(r);
  eq(n.nengan, r.total * 12, '年額');
  ok(n.ritsu > 14 && n.ritsu < 17, `★給与の約${n.ritsu.toFixed(1)}%が会社の上乗せ負担`);
  // ★本人負担より会社負担のほうが大きい
  ok(r.total > r.honninTotal,
    `★会社 ${r.total.toLocaleString()}円 > 本人 ${r.honninTotal.toLocaleString()}円（折半だと思うと会社側を過少に見る）`);
  checks++;
}

// ── ★率が無いときは金額を出さない ───────────────────────────
console.log('★fail closed');
{
  const r = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85, rousaiSen: null }, S);
  eq(r.rousai, null, '★労災保険率が分からなければ null（0円と書かない）');
  eq(r.total, 14775 + 27450 + 690 + 2550, '労災を除いた合計');
}

// ── ★壊しテスト ─────────────────────────────────────────────
console.log('★壊しテスト');
{
  // 雇用保険を「折半」と書いた実装との差
  const r = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85, rousaiSen: 3 }, S);
  const orikan = Math.floor(300000 * S.koyou.types.general.total_permille / 1000 / 2);
  ok(orikan === 2025 && r.koyou === 2550 && r.koyou > orikan,
    `★雇用保険を折半にすると ${orikan}円（正しくは ${r.koyou}円）。二事業分を会社から落とす`);
  checks++;
  console.log('  ok   雇用保険: 条文どおり→8.5/1000 / 折半実装→6.75/1000');
}
{
  // 子育て拠出金を折半にする誤り
  const r = jigyonushiFutan({ hyojun: 300000, chingin: 300000, kenkoPct: 9.85, rousaiSen: 3 }, S);
  const han = Math.floor(690 / 2);
  ok(r.kosodate === 690 && han === 345,
    '★子ども・子育て拠出金を折半にすると会社負担が半分になる（本人負担は存在しない）');
  checks++;
}

console.log(`\n${fail ? '✗' : '✓'} test_hoteifukuri: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
