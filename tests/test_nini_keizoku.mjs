/**
 * 任意継続コアの検査。
 *
 * ★外部オラクル: 協会けんぽ「令和8年度 保険料額表（東京都）」の実額と一致することを固定する。
 *   第23級 320,000円 → 健康保険の全額 31,520円／介護を含む全額 36,704円／
 *   子ども・子育て支援金の全額 736円。任意継続はこれらの**全額**を負担する（健保法161条1項）。
 *   ＝ 40歳未満は 31,520+736 = 32,256円、40〜64歳は 36,704+736 = 37,440円。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { calcNiniKeizoku, compare, kaigoApplies } from '../docs/assets/nini_keizoku_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/shaho_rates_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (cond, msg) => { checks++; if (!cond) { console.log('  ✗ ' + msg); fail++; } };
const eq = (a, b, msg) => ok(a === b, `${msg}（期待 ${b} / 実際 ${a}）`);

// 東京都の令和8年度料率（データから引く。ベタ書きしない）
const TOKYO = D.kenko_rates['東京都'];
const KAIGO = D.kaigo_rate;
const KOSODATE = D.kosodate_rate;
const CAP = D.nini_keizoku.hyojun_cap_yen;

console.log(`前提: 東京都 健保${TOKYO}% / 介護${KAIGO}% / 支援金${KOSODATE}% / 上限${CAP.toLocaleString()}円`);
eq(TOKYO, 9.85, 'データの東京都の健保料率が協会けんぽの額表と違う');
eq(KAIGO, 1.62, 'データの介護保険料率が違う');
eq(KOSODATE, 0.23, 'データの子ども・子育て支援金率が違う');
eq(CAP, 320000, 'データの任意継続の標準報酬月額の上限が違う');

// ── ★オラクル: 上限に当たった人（協会けんぽの実額）────────────────────
{
  const r = calcNiniKeizoku({ hyojunHoshu: 500000, age: 35, kenkoRate: TOKYO, kaigoRate: KAIGO, kosodateRate: KOSODATE, capYen: CAP });
  eq(r.standard, 320000, '上限が効いていない');
  ok(r.capped, '上限に当たったのに capped が false');
  eq(r.kenko, 31520, '健康保険の全額が協会けんぽの額表と違う');
  eq(r.kaigoAmt, 0, '40歳未満なのに介護保険料が出ている');
  eq(r.kosodate, 736, '子ども・子育て支援金の全額が額表と違う');
  eq(r.total, 32256, '★40歳未満の任意継続の月額が額表と違う');
}
{
  const r = calcNiniKeizoku({ hyojunHoshu: 500000, age: 45, kenkoRate: TOKYO, kaigoRate: KAIGO, kosodateRate: KOSODATE, capYen: CAP });
  ok(r.kaigo, '40〜64歳なのに介護保険第2号と判定されていない');
  eq(r.kenko + r.kaigoAmt, 36704, '健保＋介護の全額が額表（36,704円）と違う');
  eq(r.total, 37440, '★40〜64歳の任意継続の月額が額表と違う');
}

// ── 上限に当たらない人は「在職中の2倍」になる ──────────────────────
{
  const r = calcNiniKeizoku({ hyojunHoshu: 200000, age: 30, kenkoRate: TOKYO, kaigoRate: KAIGO, kosodateRate: KOSODATE, capYen: CAP });
  eq(r.standard, 200000, '上限未満なのに丸められている');
  ok(!r.capped, '上限未満なのに capped が true');
  // 在職中の本人負担は折半なので、全額はその2倍
  eq(r.total, Math.floor(200000 * 985 / 10000) + Math.floor(200000 * 23 / 10000),
    '上限未満の月額が料率どおりでない');
}

// ── 介護保険の年齢境界（shaho_core と同じ判定であること）────────────────
console.log('★介護保険の年齢境界');
eq(kaigoApplies(39), false, '39歳で介護保険第2号になっている');
eq(kaigoApplies(40), true, '40歳が介護保険第2号でない');
eq(kaigoApplies(64), true, '64歳が介護保険第2号でない');
eq(kaigoApplies(65), false, '65歳がまだ介護保険第2号になっている');

// ── 料率を渡し忘れたら落ちる（fail closed）──────────────────────────
console.log('★推測で埋めない');
try { calcNiniKeizoku({ hyojunHoshu: 300000, age: 30, kenkoRate: TOKYO, kaigoRate: KAIGO, kosodateRate: KOSODATE }); fail++; console.log('  ✗ capYen 無しでも計算してしまう'); }
catch { checks++; console.log('  ok   capYen が無ければ例外（推測で埋めない）'); }

// ── 比較 ────────────────────────────────────────────────────
console.log('★比較');
{
  const c = compare(32256, 32256 * 12);
  eq(c.cheaper, 'same', '同額なのに same でない');
  eq(c.diffYearly, 0, '同額なのに差が出ている');
}
{
  // 任意継続 32,256×12 = 387,072 円 < 国保 500,000 円 → 任意継続が安い
  const c = compare(32256, 500000);
  eq(c.niniYearly, 387072, '任意継続の年額が月額×12でない');
  eq(c.cheaper, 'nini', '任意継続の方が安いのに国保と答えている');
  eq(c.diffYearly, 112928, '差額が合わない');
}
{
  // 逆向きも見る（片方だけ通って「比較できている」と誤認しないため）
  const c = compare(50000, 300000);   // 任意継続 600,000 円 > 国保 300,000 円
  eq(c.cheaper, 'kokuho', '国保の方が安いのに任意継続と答えている');
  eq(c.diffYearly, 300000, '差額が合わない');
}

// ── ★壊しテスト: 上限を無視すると額表と合わなくなること ─────────────────
console.log('★壊しテスト');
{
  const broken = (h) => Math.floor(h * 985 / 10000) + Math.floor(h * 23 / 10000);  // 上限を当てない旧実装
  ok(broken(500000) !== 32256,
    '上限を当てない実装でも同じ額になる（この検査は上限を見ていない）');
  console.log(`  ok   上限を無視すると ${broken(500000).toLocaleString()}円（正 32,256円）＝検査は効いている`);
  checks++;
}

console.log(`\n${fail ? '✗' : '✓'} test_nini_keizoku: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
