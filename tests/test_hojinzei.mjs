/**
 * 法人税・地方法人税の検査。
 *
 * ★オラクルは条文（法人税法66条／措置法42条の3の2／地方法人税法10条）。
 *   軽減税率を所得全体に掛ける誤りは、税額を**過少に**見せる方向で効く。
 */
import { readFileSync } from 'node:fs';
import { calc, keigenRate, anbun, monthsOf } from '../docs/assets/hojinzei_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/hojinzei_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);

// ── データが条文と一致するか ────────────────────────────────────
console.log('★データ');
eq(D.hojinzei.honsoku_pct, 23.2, '原則23.2%（66条1項）');
eq(D.hojinzei.keigen_honsoku_pct, 19, '中小の800万円以下は19%（66条2項）');
eq(D.hojinzei.keigen_taisho_yen, 8000000, '軽減の対象は年800万円以下');
eq(D.tokurei.pct, 15, '措置法の特例は15%');
eq(D.tokurei.kogaku_pct, 17, '★所得10億円超は17%');
eq(D.tokurei.kogaku_shotoku_yen, 1000000000, '★10億円');
eq(D.chiho_hojinzei.pct, 10.3, '地方法人税10.3%（地方法人税法10条1項）');
eq(D.tokurei.tekiyo_jogai.tekiyo_jogai_jigyosha_heikin_yen, 1500000000, '適用除外事業者は前3年平均15億円超');

// ── ★軽減は「800万円以下の部分」だけ ────────────────────────────
console.log('★軽減の範囲');
{
  const r = calc({ shotoku: 8000000 }, D);
  eq(r.keigenBase, 8000000, '800万円ちょうどは全額が軽減の対象');
  eq(r.honsokuBase, 0, '超える部分なし');
  eq(r.keigenBun, 1200000, '8,000,000 × 15% = 1,200,000');
  eq(r.hojinzei, 1200000, '法人税額');
}
{
  const r = calc({ shotoku: 20000000 }, D);
  eq(r.keigenBase, 8000000, '★800万円までが軽減');
  eq(r.honsokuBase, 12000000, '★残り1,200万円は原則税率');
  eq(r.keigenBun, 1200000, '800万×15%');
  eq(r.honsokuBun, 2784000, '1,200万×23.2%');
  eq(r.hojinzei, 3984000, '合計');
  // ★所得全体に15%を掛ける誤りとの差
  const zenbu15 = Math.floor(20000000 * 0.15);
  ok(zenbu15 === 3000000 && r.hojinzei > zenbu15,
    `★所得全体に15%を掛けると ${zenbu15.toLocaleString()}円（実際は ${r.hojinzei.toLocaleString()}円）＝984,000円の過少`);
  checks++;
}

// ── ★10億円の崖（15% → 17%）───────────────────────────────────
console.log('★10億円の崖');
{
  const just = calc({ shotoku: 1000000000 }, D);
  const over = calc({ shotoku: 1000000001 }, D);
  eq(just.keigenRate, 15, '★10億円ちょうどは15%（条文は「年十億円を超える」）');
  eq(over.keigenRate, 17, '★1円超えると17%');
  ok(over.keigenBun - just.keigenBun === 160000,
    `★800万円以下の部分の税額が ${(over.keigenBun - just.keigenBun).toLocaleString()}円 増える（800万×2%）`);
  checks++;
  ok(over.kogakuTekiyo && !just.kogakuTekiyo, '高額のフラグが立つ');
}

// ── ★特例が使えない法人は19%のまま ────────────────────────────
console.log('★適用除外');
{
  const r = calc({ shotoku: 8000000, tokureiTsukaeru: false }, D);
  eq(r.keigenRate, 19, '★適用除外事業者・通算法人・66条5項各号は19%のまま');
  eq(r.keigenBun, 1520000, '800万×19%');
  const tokurei = calc({ shotoku: 8000000 }, D);
  ok(r.hojinzei > tokurei.hojinzei,
    `★特例が使えないと ${(r.hojinzei - tokurei.hojinzei).toLocaleString()}円 高い`);
  checks++;
}
{
  // 中小でない（資本金1億円超）→ 軽減の枠そのものが無い
  const r = calc({ shotoku: 8000000, chusho: false }, D);
  eq(r.keigenRate, null, '軽減の枠が無い');
  eq(r.keigenBase, 0, '全額が原則税率');
  eq(r.honsokuBun, 1856000, '800万×23.2%');
}

// ── ★地方法人税の課税標準は法人税額 ────────────────────────────
console.log('★地方法人税');
{
  const r = calc({ shotoku: 8000000 }, D);
  eq(r.hojinzei, 1200000, '法人税額');
  eq(r.chiho, 123600, '★1,200,000 × 10.3% = 123,600（所得に掛けるのではない）');
  const shotokuNi = Math.floor(8000000 * 0.103);
  ok(shotokuNi === 824000 && r.chiho !== shotokuNi,
    `★所得に10.3%を掛けると ${shotokuNi.toLocaleString()}円 になる（6.7倍の過大）`);
  checks++;
  eq(r.total, 1323600, '国税の合計');
}

// ── ★事業年度が1年未満なら按分 ──────────────────────────────────
console.log('★月数按分');
eq(anbun(8000000, 12), 8000000, '12か月なら按分しない');
eq(anbun(8000000, 6), 4000000, '6か月なら400万円');
eq(anbun(1000000000, 6), 500000000, '10億円も按分する');
{
  const r = calc({ shotoku: 8000000, tsukisu: 6 }, D);
  eq(r.line, 4000000, '★6か月なら軽減の枠は400万円');
  eq(r.keigenBase, 4000000, '400万円までが軽減');
  eq(r.honsokuBase, 4000000, '★残り400万円は原則税率');
  const anbunNashi = calc({ shotoku: 8000000, tsukisu: 12 }, D);
  ok(r.hojinzei > anbunNashi.hojinzei,
    `★按分しない実装は ${(r.hojinzei - anbunNashi.hojinzei).toLocaleString()}円 過少に出る`);
  checks++;
}

// ── 月数の数え方（★1月未満の端数は切り上げ）─────────────────────
console.log('★月数');
eq(monthsOf('2026-04-01', '2027-03-31'), 12, '4/1〜翌3/31は12か月');
eq(monthsOf('2026-04-01', '2026-09-30'), 6, '4/1〜9/30は6か月');
eq(monthsOf('2026-04-01', '2026-04-15'), 1, '★半月でも1月（端数切り上げ）');
eq(monthsOf('2026-04-01', '2026-10-15'), 7, '★6か月半は7か月');

// ── 端数処理 ────────────────────────────────────────────────
console.log('★端数');
{
  const r = calc({ shotoku: 8000001 }, D);
  // 8,000,000×15% + 1×23.2% = 1,200,000 + 0 = 1,200,000
  eq(r.hojinzei % 100, 0, '法人税額は100円未満切捨');
  eq(r.chiho % 100, 0, '地方法人税額も100円未満切捨');
}

// ── ★壊しテスト ─────────────────────────────────────────────
console.log('★壊しテスト');
{
  // 「10億円以上」と書いた実装は、10億円ちょうどの法人を17%にしてしまう
  const D2 = JSON.parse(JSON.stringify(D));
  const seikai = keigenRate({ chusho: true, tokureiTsukaeru: true, shotoku: 1000000000, kogakuLine: 1000000000 }, D2);
  const machigai = 1000000000 >= 1000000000 ? D2.tokurei.kogaku_pct : D2.tokurei.pct;
  ok(seikai === 15 && machigai === 17,
    '★「超える」を「以上」と書くと、10億円ちょうどの事業年度が17%になる（結論が変わる）');
  checks++;
  console.log('  ok   10億円ちょうど: 条文どおり→15% / 「以上」実装→17%');
}
{
  // 軽減率を800万円「超」の部分にも当てる誤り
  const s = 20000000;
  const seikai = calc({ shotoku: s }, D).hojinzei;
  const machigai = Math.floor(Math.floor(s * 0.15) / 100) * 100;
  ok(seikai !== machigai && seikai > machigai,
    `★全額15%だと ${machigai.toLocaleString()}円（正しくは ${seikai.toLocaleString()}円）`);
  checks++;
}

console.log(`\n${fail ? '✗' : '✓'} test_hojinzei: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
