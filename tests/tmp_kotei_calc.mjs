// 固定残業代の記事に載せる数字を、商品側のコアと公式データから機械的に出す（手打ち禁止）
import { readFileSync } from 'node:fs';
import { calcMonthly } from '../docs/assets/shaho_core.js';

const rates = JSON.parse(readFileSync(new URL('../docs/assets/shaho_rates_r08.json', import.meta.url)));
const kenkoRate = rates.kenko_rates['東京都'];
const kaigoRate = rates.kaigo_rate;
console.log('東京の料率:', { kenkoRate, kaigoRate, kosei: rates.kosei_nenkin_rate, 年度: rates._meta.year });

// --- 前提（すべて一次情報）---
const MIN_WAGE_TOKYO = 1226; // 厚労省 令和7年度地域別最低賃金 全国一覧（令和7年10月3日発効・現行）
const MONTHLY_HOURS = 160;   // 所定労働時間（例）
const PAY_TOTAL = 200000;    // 月給（固定残業代込み）
const KOTEI = 40000;         // 固定残業代
const MINASHI_H = 30;        // みなし時間
const BASE = PAY_TOTAL - KOTEI;

console.log('\n=== 1. 最低賃金の判定（最賃法4条3項2号・最賃則1条2項1号: 固定残業代は算入しない）===');
const hourlyIncl = PAY_TOTAL / MONTHLY_HOURS;
const hourlyExcl = BASE / MONTHLY_HOURS;
console.log(`固定残業代を含めた見かけの時給: ${hourlyIncl}円`);
console.log(`最賃判定に使う時給(=基本給のみ): ${hourlyExcl}円`);
console.log(`東京の最低賃金 ${MIN_WAGE_TOKYO}円 → ${hourlyExcl < MIN_WAGE_TOKYO ? '★最賃割れ（違法）' : 'OK'}`);
const needBase = MIN_WAGE_TOKYO * MONTHLY_HOURS;
console.log(`最賃を満たすのに必要な基本給: ${needBase.toLocaleString()}円（不足 ${(needBase - BASE).toLocaleString()}円）`);

console.log('\n=== 2. 固定残業代がみなし時間分に足りているか（労基法37条: 25%以上）===');
const wageExcl = BASE / MONTHLY_HOURS;                 // 違法な基本給での単価
const need30_bad = Math.ceil(wageExcl * 1.25 * MINASHI_H);
console.log(`基本給16万のときの割増単価: ${wageExcl * 1.25}円 → ${MINASHI_H}時間分= ${need30_bad.toLocaleString()}円（固定残業代4万で足りる）`);
const wageOk = needBase / MONTHLY_HOURS;
const need30_ok = Math.ceil(wageOk * 1.25 * MINASHI_H);
const coveredH = KOTEI / (wageOk * 1.25);
console.log(`最賃を満たす基本給${needBase.toLocaleString()}円のときの割増単価: ${wageOk * 1.25}円`);
console.log(`→ ${MINASHI_H}時間分に必要なのは ${need30_ok.toLocaleString()}円。4万円では ${coveredH.toFixed(1)}時間分にしかならない`);

console.log('\n=== 3. 社会保険料（健保法3条5項: 固定残業代も「報酬」）東京・30歳 ===');
for (const [label, pay] of [['固定残業代あり 月給20万', PAY_TOTAL], ['基本給16万のみ', BASE]]) {
  const r = calcMonthly(pay, kenkoRate, kaigoRate, 30);
  console.log(`${label}: 標準報酬月額 ${r.standard.toLocaleString()}円 / 本人負担 ${Math.round(r.selfTotal).toLocaleString()}円`);
}
const a = calcMonthly(PAY_TOTAL, kenkoRate, kaigoRate, 30);
const b = calcMonthly(BASE, kenkoRate, kaigoRate, 30);
console.log(`差: 本人 月 ${Math.round(a.selfTotal - b.selfTotal).toLocaleString()}円 / 年 ${Math.round((a.selfTotal - b.selfTotal) * 12).toLocaleString()}円`);
