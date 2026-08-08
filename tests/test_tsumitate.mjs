/**
 * 積立の複利計算コアの検査。
 *
 * ★オラクルは**独立に組んだ手計算**（コアの実装を呼ばずに、テスト側で別式で出す）。
 *   同じ関数で検算すると、実装がバグったとき両方が同じように間違って合格する
 *   （このリポジトリの規則: 検算のオラクルは被検体と別実装にする）。
 */
import { readFileSync } from 'node:fs';
import { simulate, monthlyRate, afterTax, nisaRoom } from '../docs/assets/tsumitate_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/tsumitate_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}（期待 ${b}±${tol} / 実際 ${a}）`);

// ── データが条文と一致するか ────────────────────────────────────
console.log('★データ（措置法37条の14）');
eq(D.nisa.shogai_gendo_yen, 18000000, '生涯投資枠');
eq(D.nisa.seicho_shogai_gendo_yen, 12000000, '成長投資枠の生涯上限');
eq(D.nisa.tsumitate_nenkan_yen, 1200000, 'つみたて投資枠の年間');
eq(D.nisa.seicho_nenkan_yen, 2400000, '成長投資枠の年間');
eq(D.kazei.goukei_pct, 20.315, '特定口座の合計税率');

// ── ★月利は12で割らない ─────────────────────────────────────
console.log('★月利の出し方');
{
  const r = monthlyRate(5);
  // 独立オラクル: (1.05)^(1/12) - 1
  near(r, Math.pow(1.05, 1 / 12) - 1, 1e-12, '年5%の月利');
  ok(Math.abs(r - 0.05 / 12) > 1e-5, '★12で割った値と一致してしまっている（複利になっていない）');
  console.log(`  ok   年5% → 月${(r * 100).toFixed(5)}%（12分割なら ${(5 / 12).toFixed(5)}%）`);
  checks++;
}

// ── 積立の将来価値（独立オラクルで検算）────────────────────────────
console.log('★積立の将来価値');
{
  // 独立オラクル: 期初積立・月次複利の閉じた式
  //   FV = m * ((1+r)^n - 1) / r * (1+r)
  const m = 30000, yrs = 20, pct = 5;
  const r = Math.pow(1 + pct / 100, 1 / 12) - 1, n = yrs * 12;
  const expect = Math.floor(m * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
  const s = simulate({ monthlyYen: m, years: yrs, annualPct: pct, feePct: 0 });
  eq(s.months, 240, '月数');
  eq(s.principal, 7200000, '元本の累計');
  near(s.gross, expect, 2, '★評価額が閉じた式と一致する（期初積立・月次複利）');
  console.log(`  ok   月3万・20年・年5% → 元本720万 / 評価額 ${s.gross.toLocaleString()}円`);
  checks++;
}

// ── ★信託報酬の差が効くこと（このセクションの柱）──────────────────
console.log('★信託報酬');
{
  const base = { monthlyYen: 30000, years: 20, annualPct: 5 };
  const cheap = simulate({ ...base, feePct: 0.09 });
  const pricey = simulate({ ...base, feePct: 0.5 });
  ok(cheap.net > pricey.net, '信託報酬が低いほうが手元に多く残る');
  ok(cheap.feeCost < pricey.feeCost, '信託報酬が低いほうが削られる額も小さい');
  const diff = cheap.net - pricey.net;
  ok(diff > 100000, `★0.09%と0.5%の差が20年で10万円を超える（実際 ${diff.toLocaleString()}円）`);
  console.log(`  ok   0.09% → ${cheap.net.toLocaleString()}円 / 0.5% → ${pricey.net.toLocaleString()}円（差 ${diff.toLocaleString()}円）`);
  checks += 3;
  // 信託報酬0なら gross と net は一致する
  const z = simulate({ ...base, feePct: 0 });
  eq(z.gross, z.net, '信託報酬0なら差が出ない');
  eq(z.feeCost, 0, '信託報酬0なら削られない');
}

// ── ★税金は「利益」にだけかかる ────────────────────────────────
console.log('★課税');
{
  const t = afterTax(10000000, 7200000, D);
  eq(t.gain, 2800000, '利益＝評価額−元本');
  // 独立オラクル: 2,800,000 × 20.315% = 568,820
  eq(t.tax, 568820, '★税額は利益にだけかかる');
  eq(t.tokuteiKouza, 10000000 - 568820, '特定口座の手取り');
  eq(t.nisa, 10000000, 'NISAは非課税なので評価額そのまま');
  // 評価額全体に掛ける誤りだと 2,031,500 になる
  ok(t.tax !== Math.floor(10000000 * 0.20315),
    '★評価額全体に課税してしまっている（元本にも税がかかっている）');
  checks++;
  console.log(`  ok   評価額1,000万・元本720万 → 税 ${t.tax.toLocaleString()}円（全体課税なら ${Math.floor(10000000 * 0.20315).toLocaleString()}円）`);
}
{
  const t = afterTax(5000000, 7200000, D);
  eq(t.gain, 0, '含み損なら利益は0');
  eq(t.tax, 0, '含み損なら課税されない');
}

// ── NISAの枠（★取得対価で数える）────────────────────────────────
console.log('★NISAの枠');
{
  const r = nisaRoom({ monthlyYen: 100000, years: 20 }, D);
  eq(r.yearlyYen, 1200000, '年間の積立額');
  eq(r.yearsToFill, 15, '★月10万なら生涯枠1,800万は15年で埋まる');
  ok(r.overShogai, '20年続けると生涯枠を超える');
  ok(!r.overTsumitate, '年120万はつみたて投資枠の上限ちょうどで超えない');
}
{
  const r = nisaRoom({ monthlyYen: 200000, years: 10 }, D);
  ok(r.overTsumitate, '月20万＝年240万はつみたて投資枠を超える');
  ok(!r.overYearly, '年360万の合計枠は超えない');
}

// ── ★壊しテスト: よくある間違い方をすると値が変わること ────────────────
console.log('★壊しテスト');
{
  const m = 30000, n = 240;
  const wrongR = 0.05 / 12;                      // 12で割った場合
  let v = 0; for (let i = 0; i < n; i++) v = (v + m) * (1 + wrongR);
  const right = simulate({ monthlyYen: m, years: 20, annualPct: 5 }).gross;
  ok(Math.abs(Math.floor(v) - right) > 10000,
    `12分割の誤りが検出できる（12分割 ${Math.floor(v).toLocaleString()} / 正 ${right.toLocaleString()}）`);
  console.log(`  ok   12で割ると ${Math.floor(v).toLocaleString()}円（正 ${right.toLocaleString()}円）＝差 ${(Math.floor(v) - right).toLocaleString()}円`);
  checks++;
}

console.log(`\n${fail ? '✗' : '✓'} test_tsumitate: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
