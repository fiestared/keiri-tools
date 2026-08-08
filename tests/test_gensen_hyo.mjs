/**
 * 源泉徴収票の金額欄（①〜④）の検査。
 *
 * ★オラクル: 措置法29条の4（令和8年12月1日施行版で逐語確認済み）と
 *   所得税法190条2号・別表第五。給与所得の計算は juminzei_core に委譲しているので、
 *   ここでは**委譲が正しく効いているか**と**空欄の扱い**を固定する。
 */
import { readFileSync } from 'node:fs';
import { kojoGoNoGaku, shotokuKojoGokei, kazeiTaishoMae, checkKinyu } from '../docs/assets/gensen_hyo_core.js';
import { kyuyoShotokuR8, kyuyoShotoku } from '../docs/assets/juminzei_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/juminzei_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);

// ── ★令和8年・9年の特例が効く帯 ────────────────────────────
console.log('★措置法29条の4の帯');
{
  // 支払金額170万 → 1,700,000 − 740,000 = 960,000
  const r = kojoGoNoGaku(1700000, true, D, kyuyoShotokuR8);
  eq(r.value, 960000, '★収入170万の②欄は 収入−74万円');
  ok(r.tokureiTaisho, '特例の帯に入っている');
  ok(r.kubun.includes('措置法29条の4'), 'どの規定で計算したかを名乗る');
  // ★別表第五で引いた場合と違うこと（去年と同じ気持ちで引くと狂う）
  const beppyo5 = kyuyoShotoku(1700000, D);
  ok(beppyo5 !== r.value,
    `★別表第五だと ${beppyo5.toLocaleString()}円（特例だと ${r.value.toLocaleString()}円）＝${Math.abs(beppyo5 - r.value).toLocaleString()}円の差`);
  checks++;
}
{
  // ★74.1万円未満は給与所得なし（1項の「収入が74万円に満たない場合は収入相当額」＋2項1号）
  const r = kojoGoNoGaku(700000, true, D, kyuyoShotokuR8);
  eq(r.value, 0, '★収入70万の②欄は0（措置法29条の4）');
  ok(r.tokureiTaisho, '★特例は収入220万円以下すべてに効く（下限は無い）');
  // ★別表第五で引くと0にならない ＝ 下限を置く実装はここで狂う
  const beppyo5 = kyuyoShotoku(700000, D);
  ok(beppyo5 !== 0,
    `★別表第五だと ${beppyo5.toLocaleString()}円 になる（特例なら0）。下限を置く実装はこの人を誤る`);
  checks++;
}
{
  // ★量子化3帯
  eq(kojoGoNoGaku(2192000, true, D, kyuyoShotokuR8).value, 1451000, '★219.1万〜219.3万は145.1万で固定');
  eq(kojoGoNoGaku(2194000, true, D, kyuyoShotokuR8).value, 1453000, '★219.3万〜219.6万は145.3万');
  eq(kojoGoNoGaku(2198000, true, D, kyuyoShotokuR8).value, 1456000, '★219.6万〜220万は145.6万');
}
{
  // ★220万円ちょうどからは別表第五へ委譲（境界が連続すること）
  const r = kojoGoNoGaku(2200000, true, D, kyuyoShotokuR8);
  ok(!r.tokureiTaisho, '220万円ちょうどは特例の帯の外');
  eq(r.value, 1460000, '★定額控除74万でも別表第五でも146万円（境界は連続）');
  ok(r.kubun.includes('別表第五'), 'どの規定で計算したかを名乗る');
}
{
  // 特例の帯の外（高い側）
  const r = kojoGoNoGaku(6000000, true, D, kyuyoShotokuR8);
  ok(!r.tokureiTaisho, '600万は特例の帯の外');
  eq(r.value, kyuyoShotoku(6000000, D), '別表第五に委譲している（再実装していない）');
}
{
  // 69.1万未満
  const r = kojoGoNoGaku(600000, true, D, kyuyoShotokuR8);
  eq(r.value, 0, '69.1万未満は0');
}

// ── ★年末調整をしていない人は空欄 ───────────────────────────
console.log('★空欄の扱い');
{
  const r = kojoGoNoGaku(3000000, false, D, kyuyoShotokuR8);
  eq(r.value, null, '★年末調整をしていなければ②欄は null（0円と書かない）');
  ok(r.kubun.includes('空欄'), '空欄であることを名乗る');
}
{
  const r = shotokuKojoGokei({ shakai: 400000, kiso: 580000 }, false);
  eq(r.value, null, '★③欄も空欄');
  eq(r.uchiwake, null, '内訳も出さない');
}

// ── ③欄（★基礎控除を落とさない）──────────────────────────
console.log('★所得控除の合計');
{
  const r = shotokuKojoGokei({ shakai: 450000, seimei: 40000, jishin: 20000, jinteki: 380000, kiso: 580000 }, true);
  eq(r.value, 1470000, '合計');
  eq(r.uchiwake.kiso, 580000, '★基礎控除が内訳に入っている');
  const kisoNashi = shotokuKojoGokei({ shakai: 450000, seimei: 40000, jishin: 20000, jinteki: 380000, kiso: 0 }, true);
  ok(r.value - kisoNashi.value === 580000,
    '★基礎控除を落とすと③欄が58万円小さくなる＝税額を過大に見せる');
  checks++;
}
eq(shotokuKojoGokei({}, true).value, 0, '何も入れなければ0');

// ── ②−③ ────────────────────────────────────────────
console.log('★②−③');
eq(kazeiTaishoMae(2000000, 1470000), 530000, '差');
eq(kazeiTaishoMae(1000000, 1470000), 0, '★マイナスにしない');
eq(kazeiTaishoMae(null, 1470000), null, '②が空欄なら null');
eq(kazeiTaishoMae(2000000, null), null, '③が空欄なら null');

// ── ★記入の整合チェック ────────────────────────────────
console.log('★整合チェック');
{
  const w = checkKinyu({ shiharai: 3000000, nenmatsuChosei: false, kojoGo: 2000000, kojoGokei: 1000000 });
  ok(w.some((x) => x.level === 'error' && x.text.includes('年末調整をしていないのに')),
    '★年末調整なしで②③に金額があればエラー');
}
{
  const w = checkKinyu({ shiharai: 3000000, nenmatsuChosei: false, kojoGo: null, kojoGokei: null });
  ok(!w.some((x) => x.level === 'error'), '空欄ならエラーにしない');
  ok(w.some((x) => x.text.includes('毎月徴収した税額の合計')),
    '★④欄が月々の合計になることを注意する');
}
{
  const w = checkKinyu({ shiharai: 1000000, nenmatsuChosei: true, kojoGo: 1200000, kojoGokei: 500000 });
  ok(w.some((x) => x.level === 'error' && x.text.includes('②欄が①欄より大きく')),
    '★②が①を超えたらエラー');
}
{
  const w = checkKinyu({ shiharai: 3000000, nenmatsuChosei: true, kojoGo: 2000000, kojoGokei: 1000000, gensenZeigaku: 50350 });
  ok(w.some((x) => x.text.includes('100円未満')), '★④欄の100円未満の端数を指摘する');
}
{
  const w = checkKinyu({ shiharai: 3000000, nenmatsuChosei: true, kojoGo: 2000000, kojoGokei: 1000000, gensenZeigaku: 50300 });
  ok(!w.some((x) => x.text.includes('100円未満')), '100円単位なら指摘しない');
}
{
  const w = checkKinyu({ shiharai: 3000000, nenmatsuChosei: true, kojoGo: 2000000, kojoGokei: 2500000 });
  ok(w.some((x) => x.level === 'warn' && x.text.includes('③欄が②欄を超え')),
    '③が②を超えたら警告（誤りとは限らないので error にしない）');
}

// ── ★壊しテスト ─────────────────────────────────────────────
console.log('★壊しテスト');
{
  // 令和8年分なのに別表第五で引いた場合、170万の人の②欄が変わる
  const seikai = kojoGoNoGaku(1700000, true, D, kyuyoShotokuR8).value;
  const machigai = kyuyoShotoku(1700000, D);
  ok(seikai === 960000 && seikai !== machigai,
    `★特例(${seikai.toLocaleString()})と別表第五(${machigai.toLocaleString()})で②欄が違う`);
  checks++;
  console.log(`  ok   支払金額170万: 措置法29条の4→${seikai.toLocaleString()} / 別表第五→${machigai.toLocaleString()}`);
}
{
  // 年末調整をしていない人の②欄を「0」と書く誤り（null との違い）
  const r = kojoGoNoGaku(3000000, false, D, kyuyoShotokuR8);
  ok(r.value === null && r.value !== 0,
    '★空欄(null)と0円は別物。0と書くと「所得が0だった」という別の意味になる');
  checks++;
}

console.log(`\n${fail ? '✗' : '✓'} test_gensen_hyo: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
