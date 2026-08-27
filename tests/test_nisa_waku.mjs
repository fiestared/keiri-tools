import { readFileSync } from 'node:fs';
import { nisaAllowance } from '../docs/assets/tsumitate_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/tsumitate_r08.json', import.meta.url), 'utf8'));
let checks = 0;
let failed = 0;
const eq = (actual, expected, label) => {
  checks++;
  if (actual !== expected) {
    failed++;
    console.error(`  ✗ ${label}: 期待 ${expected} / 実際 ${actual}`);
  }
};

console.log('★NISAの残り枠（取得対価で計算）');
{
  const r = nisaAllowance({
    usedTsumitateYear: 600000,
    usedSeichoYear: 1000000,
    heldTsumitateBook: 3000000,
    heldSeichoBook: 4000000,
    soldTsumitateBook: 200000,
    soldSeichoBook: 800000,
  }, D);
  eq(r.thisYearTsumitateRemaining, 600000, 'つみたて年間枠の残り');
  eq(r.thisYearSeichoRemaining, 1400000, '成長年間枠の残り');
  eq(r.thisYearTotalRemaining, 2000000, '今年使える合計');
  eq(r.lifetimeRemaining, 9400000, '年初簿価に今年の購入を足した生涯枠の残り');
  eq(r.seichoLifetimeRemaining, 7000000, '年初簿価に今年の購入を足した成長投資枠の生涯残り');
  eq(r.nextYearReusableBook, 1000000, '売却簿価は翌年に再利用');
  eq(r.nextYearReusableSeichoBook, 800000, '成長枠の再利用額');
}

console.log('★生涯枠が年間枠より先に効く');
{
  const r = nisaAllowance({
    usedTsumitateYear: 0,
    heldTsumitateBook: 5900000,
    heldSeichoBook: 11900000,
    usedSeichoYear: 100000,
  }, D);
  eq(r.lifetimeRemaining, 100000, '生涯枠残り10万円');
  eq(r.seichoLifetimeRemaining, 0, '成長投資枠は満額');
  eq(r.thisYearTsumitateRemaining, 100000, 'つみたては生涯残りまで');
  eq(r.thisYearSeichoRemaining, 0, '成長は生涯上限で0円');
  eq(r.thisYearTotalRemaining, 100000, '合計も10万円');
}

console.log('★売却額は時価でなく簿価、同年には戻らない');
{
  const r = nisaAllowance({
    usedTsumitateYear: 1200000,
    usedSeichoYear: 2400000,
    heldTsumitateBook: 6000000,
    heldSeichoBook: 10000000,
    soldTsumitateBook: 500000,
    soldSeichoBook: 1000000,
  }, D);
  eq(r.thisYearTotalRemaining, 0, '年間枠を使い切った年は売っても0円');
  eq(r.nextYearReusableBook, 1500000, '翌年に戻るのは売却簿価150万円');
}

console.log(`\n${failed ? '✗' : '✓'} test_nisa_waku: ${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
