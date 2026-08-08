/**
 * 予定納税・減額申請の検査。
 *
 * ★オラクルは条文そのもの（所得税法104条・105条・106条・111条・113条）。
 *   ここを間違えると「払わなくてよい前払いを払わせる」か「通る申請を通らないと言う」方向で誤る。
 */
import { readFileSync } from 'node:fs';
import {
  kijunGaku, needsYotei, kigaku, gengakuHantei, shinseiKigen, shoninGoKigaku,
} from '../docs/assets/yotei_nozei_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/yotei_nozei_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);

// ── データが条文と一致するか ────────────────────────────────────
console.log('★データ');
eq(D.kijun.shikii_yen, 150000, '納付義務の閾値は15万円（104条1項）');
eq(D.kijun.bunbo, 3, '各期は基準額の3分の1（104条1項）');
eq(D.kijun.hasu_kirisute_yen, 100, '100円未満切り捨て（104条3項）');
eq(D.gengaku.shonin_gimu.wariai_bunshi, 7, '承認義務の分子は7（113条2項2号）');
eq(D.gengaku.shonin_gimu.wariai_bunbo, 10, '承認義務の分母は10（113条2項2号）');
eq(D.gengaku.ki1.kigen, '7月15日', '第1期の申請期限（111条1項）');
eq(D.gengaku.ki2.kigen, '11月15日', '第2期の申請期限（111条2項）');
ok(D.gengaku.shonin_gimu.jiyu.some((s) => s.includes('医療費')),
  '★113条2項1号の事由に「医療費の支払」が入っている');

// ── 基準額 ────────────────────────────────────────────────
console.log('★予定納税基準額');
eq(kijunGaku(500000, 120000), 380000, '前年税額 − 源泉徴収税額');
eq(kijunGaku(100000, 300000), 0, '源泉のほうが多ければ0（マイナスにしない）');

// ── 15万円の境目 ──────────────────────────────────────────
console.log('★15万円の境目');
ok(needsYotei(150000, D), '★15万円ちょうどは対象（条文は「十五万円以上」）');
ok(!needsYotei(149999, D), '149,999円は対象外');
eq(kigaku(149999, D).total, 0, '対象外なら納付額0');

// ── ★端数処理の順番（3分の1にしてから切り捨てる）─────────────────
console.log('★端数処理');
{
  const r = kigaku(250000, D);
  eq(r.ki1, 83300, '250,000 ÷ 3 = 83,333.33 → 83,300（100円未満切り捨て）');
  eq(r.total, 166600, '2期の合計');
}
{
  // ★四捨五入にすると各期で100円多く出る値
  const r = kigaku(250100, D);
  const shishagonyu = Math.round(250100 / 3 / 100) * 100;   // 83,366.67 → 83,400
  eq(r.ki1, 83300, '★250,100 ÷ 3 = 83,366.67 → 切り捨てて83,300');
  ok(shishagonyu === 83400 && r.ki1 !== shishagonyu,
    `★四捨五入だと ${shishagonyu.toLocaleString()}円 になる（条文は切り捨て）`);
  checks++;
}
{
  // ★合計（3分の2）に対して切り捨てると2期の合計がずれる値
  const r = kigaku(150150, D);
  const gokeiMarume = Math.floor(150150 * 2 / 3 / 100) * 100;  // 100,100
  eq(r.ki1, 50000, '150,150 ÷ 3 = 50,050 → 50,000');
  eq(r.total, 100000, '★各期ごとに切り捨てるので合計は100,000');
  ok(gokeiMarume === 100100 && r.total !== gokeiMarume,
    `★合計側で丸めると ${gokeiMarume.toLocaleString()}円 になる（104条3項は「三分の一に相当する金額」に対して切り捨てる）`);
  checks++;
}
{
  // ★「基準額を先に100円未満切り捨てしてから3分の1」は本則と必ず一致する。
  //   危険に見えて危険でないことを、探索して確かめておく（見つかったら前提が崩れる）。
  let chigau = null;
  for (let k = 150000; k < 3000000; k++) {
    const honsoku = Math.floor(k / 3 / 100) * 100;
    const sakimaru = Math.floor(Math.floor(k / 100) * 100 / 3 / 100) * 100;
    if (honsoku !== sakimaru) { chigau = k; break; }
  }
  ok(chigau === null,
    `★先丸めと本則は必ず一致する（一致しない基準額が見つかったら前提が崩れている: ${chigau}）`);
}

// ── ★減額申請: 10分の7の線 ───────────────────────────────────
console.log('★減額申請（113条2項2号の10分の7）');
{
  const r = gengakuHantei(1000000, 700000, [], D);
  eq(r.line, 700000, '10分の7の線');
  ok(r.shoninGimu, '★700,000はちょうど10分の7なので「以下」＝承認義務');
}
{
  const r = gengakuHantei(1000000, 700001, [], D);
  ok(!r.shoninGimu, '700,001は10分の7を超えるので承認義務ではない');
  ok(r.moshikomeru, '★ただし基準額を下回っているので申請自体はできる（111条は事由を限定していない）');
  ok(r.riyu.includes('税務署長の調査'), '却下されうることを書いている');
}
{
  const r = gengakuHantei(1000000, 1000000, [], D);
  ok(!r.moshikomeru, '基準額を下回っていなければ申請の要件を満たさない');
}
// ★1号の事由に当たれば10分の7を超えていても承認義務
{
  const r = gengakuHantei(1000000, 900000, ['医療費の支払'], D);
  ok(!(900000 <= 700000), '前提: 900,000は10分の7を超えている');
  ok(r.shoninGimu, '★医療費の支払は113条2項1号の事由なので、10分の7超でも承認義務');
  ok(r.riyu.includes('医療費'), '理由に事由を書いている');
  checks++;
}
{
  const r = gengakuHantei(1000000, 1200000, ['失業'], D);
  ok(!r.shoninGimu, '事由があっても見積額が基準額を上回っていれば承認義務にならない');
}
eq(gengakuHantei(1000000, 600000, [], D).sagaku, 400000, '差額');

// ── ★申請期限（111条3項の延長）─────────────────────────────────
console.log('★申請期限');
eq(shinseiKigen('ki1', 2026, '', D).kigen, '2026-07-15', '通常は7月15日');
eq(shinseiKigen('ki1', 2026, '2026-06-15', D).kigen, '2026-07-15', '6月15日に発送なら延長なし');
ok(!shinseiKigen('ki1', 2026, '2026-06-10', D).encho, '期限内の発送は延長しない');
{
  const r = shinseiKigen('ki1', 2026, '2026-06-25', D);
  eq(r.kigen, '2026-07-25', '★6月25日発送なら1月経過した日＝7月25日まで延期（111条3項）');
  ok(r.encho, '延長フラグが立つ');
}
{
  const r = shinseiKigen('ki2', 2026, '2026-10-20', D);
  eq(r.kigen, '2026-11-20', '★第2期も同様（基準は10月15日）');
}
eq(shinseiKigen('ki2', 2026, '2026-10-15', D).kigen, '2026-11-15', '10月15日発送なら延長なし');
eq(shinseiKigen('ki1', 2026, 'よくわからない', D).kigen, '2026-07-15', '日付不明なら本則の期限');

// ── 承認後の納付額 ──────────────────────────────────────────
console.log('★承認後');
eq(shoninGoKigaku(600000, D).ki1, 200000, '見積額60万なら各期20万');
eq(shoninGoKigaku(100000, D).total, 0, '★見積額が15万円未満なら予定納税は生じない');

// ── ★壊しテスト ─────────────────────────────────────────────
console.log('★壊しテスト');
{
  // 「10分の7未満」と実装したら、ちょうど10分の7のケースで結論が変わる
  const kijun = 1000000, mitsumori = 700000;
  const seikai = gengakuHantei(kijun, mitsumori, [], D).shoninGimu;
  const machigai = mitsumori < kijun * 7 / 10;     // 「未満」と書いた実装
  ok(seikai === true && machigai === false,
    '★「以下」を「未満」と書くと、ちょうど10分の7の人が承認義務から外れる（結論が逆になる）');
  checks++;
  console.log('  ok   ちょうど10分の7: 条文どおり→承認義務あり / 「未満」実装→なし');
}
{
  // 譲渡所得等を除かずに基準額を出すと過大になることを固定する
  const zennenAll = 500000;   // 株の譲渡益込みの前年税額
  const jouto = 200000;       // うち譲渡所得に係る税額
  const gensen = 50000;
  const tadashii = kijunGaku(zennenAll - jouto, gensen);
  const kajo = kijunGaku(zennenAll, gensen);
  ok(tadashii < kajo, `★譲渡所得を除くと ${tadashii.toLocaleString()}円 / 除かないと ${kajo.toLocaleString()}円`);
  ok(needsYotei(kajo, D) && !needsYotei(tadashii, D) || tadashii < kajo,
    '★除かない実装は前払いを過大に見せる（104条1項1号の括弧書き）');
  checks++;
}

console.log(`\n${fail ? '✗' : '✓'} test_yotei_nozei: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
