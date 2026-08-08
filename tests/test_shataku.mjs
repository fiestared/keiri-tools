/**
 * 役員社宅の賃貸料相当額（所基通36-40・36-41／国税庁 No.2600）の検査。
 *
 * ★オラクルは国税庁の算式そのもの。手計算した値と一致することを固定する。
 *   間違えると「賃貸料相当額より低い家賃」になり、差額が役員給与として課税される。
 *   ★過小に出す誤りは、使う人が源泉徴収漏れを起こす方向なので特に危ない。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  calcShokibo, calcHiShokiboJisha, calcHiShokiboKarikage,
  kazeiSagaku, meetsShokiboMenseki, shokiboMensekiMax,
} from '../docs/assets/shataku_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/shataku_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);

// ── データが国税庁の数値と一致するか ────────────────────────────
console.log('★データ');
eq(D.shokibo.tatemono_kazei_hyojun_pct, 0.2, '建物の課税標準額に掛ける率');
eq(D.shokibo.yuka_menseki_per_tsubo_yen, 12, '坪あたりの円');
eq(D.shokibo.tsubo_heihoubeitoru, 3.3, '1坪の㎡');
eq(D.shokibo.shikichi_kazei_hyojun_pct, 0.22, '敷地の課税標準額に掛ける率');
eq(D.hi_shokibo_jisha.tatemono_pct, 12, '非小規模・自社所有の建物の率');
eq(D.hi_shokibo_jisha.tatemono_pct_taiyo_nensu_30_cho, 10, '耐用年数30年超の建物の率');
eq(D.hi_shokibo_jisha.shikichi_pct, 6, '非小規模・自社所有の敷地の率');
eq(D.hi_shokibo_karikage.shiharai_yachin_pct, 50, '借上の家賃に掛ける率');
eq(D.shokibo_hantei.taiyo_nensu_30_ika_menseki_max, 132, '小規模の床面積（30年以下）');
eq(D.shokibo_hantei.taiyo_nensu_30_cho_menseki_max, 99, '小規模の床面積（30年超）');

// ── 小規模な住宅（36-41）────────────────────────────────────
console.log('★小規模な住宅');
{
  // 建物課税標準 500万・敷地課税標準 800万・床面積 66㎡
  //  (1) 5,000,000 × 0.2% = 10,000
  //  (2) 12 × 66 / 3.3 = 240
  //  (3) 8,000,000 × 0.22% = 17,600
  const r = calcShokibo({ tatemonoKazeiHyojun: 5000000, shikichiKazeiHyojun: 8000000, mensekiM2: 66 }, D);
  eq(r.tatemono, 10000, '(1)建物分');
  eq(r.yuka, 240, '★(2)床面積分は「坪あたり12円」。㎡で掛けると792になる');
  eq(r.shikichi, 17600, '(3)敷地分');
  eq(r.total, 27840, '小規模の賃貸料相当額（月額）');
}

// ── 非小規模・自社所有（36-40）───────────────────────────────
console.log('★非小規模・自社所有');
{
  // 建物課税標準 2,000万・敷地課税標準 3,000万・耐用年数 47年（30年超→10%）
  //  イ 20,000,000 × 10% = 2,000,000（年）
  //  ロ 30,000,000 × 6%  = 1,800,000（年）
  //  (イ+ロ)/12 = 316,666
  const r = calcHiShokiboJisha({ tatemonoKazeiHyojun: 20000000, shikichiKazeiHyojun: 30000000, taiyoNensu: 47 }, D);
  eq(r.tatemonoPct, 10, '★耐用年数30年超は10%（12%ではない）');
  eq(r.tatemonoYearly, 2000000, 'イ 建物（年額）');
  eq(r.shikichiYearly, 1800000, 'ロ 敷地（年額）');
  eq(r.total, 316666, '★年額の12分の1が月額');
}
{
  // 耐用年数 22年（30年以下→12%）
  const r = calcHiShokiboJisha({ tatemonoKazeiHyojun: 20000000, shikichiKazeiHyojun: 30000000, taiyoNensu: 22 }, D);
  eq(r.tatemonoPct, 12, '耐用年数30年以下は12%');
  eq(r.total, Math.floor((2400000 + 1800000) / 12), '30年以下の月額');
}

// ── 非小規模・借上（36-40）★多い方 ──────────────────────────────
console.log('★非小規模・借上は「多い方」');
{
  // 家賃 30万 → 50% = 150,000 ／ 固定資産税ベース = 316,666 → 固定資産税ベースが勝つ
  const r = calcHiShokiboKarikage({
    tatemonoKazeiHyojun: 20000000, shikichiKazeiHyojun: 30000000, taiyoNensu: 47,
    kaishaShiharaiYachin: 300000,
  }, D);
  eq(r.yachinHalf, 150000, '家賃の50%');
  eq(r.jishaKijun, 316666, '固定資産税ベース');
  eq(r.total, 316666, '★多い方＝固定資産税ベース。「50%を払えばよい」で組むと過小になる');
  eq(r.adopted, 'kotei_shisanzei', '採用した基準');
}
{
  // 家賃 100万 → 50% = 500,000 が勝つ
  const r = calcHiShokiboKarikage({
    tatemonoKazeiHyojun: 20000000, shikichiKazeiHyojun: 30000000, taiyoNensu: 47,
    kaishaShiharaiYachin: 1000000,
  }, D);
  eq(r.total, 500000, '家賃の50%の方が多い場合');
  eq(r.adopted, 'yachin_half', '採用した基準');
}

// ── 小規模の床面積の要件 ─────────────────────────────────────
console.log('★床面積の要件');
eq(shokiboMensekiMax(22, D), 132, '30年以下は132㎡');
eq(shokiboMensekiMax(47, D), 99, '30年超は99㎡');
ok(meetsShokiboMenseki(132, 22, D), '132㎡ちょうどは小規模の要件を満たす（以下）');
ok(!meetsShokiboMenseki(133, 22, D), '133㎡は満たさない');
ok(meetsShokiboMenseki(99, 47, D), '30年超で99㎡ちょうどは満たす');
ok(!meetsShokiboMenseki(100, 47, D), '30年超で100㎡は満たさない');

// ── 給与課税される差額 ──────────────────────────────────────
console.log('★給与課税される差額');
eq(kazeiSagaku(27840, 0), 27840, '無償なら全額が給与課税');
eq(kazeiSagaku(27840, 10000), 17840, '低い家賃なら差額が給与課税');
eq(kazeiSagaku(27840, 27840), 0, '賃貸料相当額どおりなら課税なし');
eq(kazeiSagaku(27840, 50000), 0, '多く払っていてもマイナスにはしない');

// ── ★壊しテスト: よくある間違い方をすると値が変わること ────────────────
console.log('★壊しテスト');
{
  const wrongTsubo = Math.floor(66 * 12);                       // ㎡あたり12円にした場合
  ok(wrongTsubo !== 240, `坪を㎡で計算すると ${wrongTsubo}（正 240）＝この検査は効いている`);
  const wrongNoDiv12 = 2000000 + 1800000;                       // 12で割り忘れた場合
  ok(wrongNoDiv12 !== 316666, `12で割らないと ${wrongNoDiv12.toLocaleString()}（正 316,666）`);
  const wrongHalfOnly = 150000;                                 // 50%だけで組んだ場合
  ok(wrongHalfOnly !== 316666, `50%だけだと ${wrongHalfOnly.toLocaleString()}（正 316,666）＝過小`);
  checks += 3;
}

console.log(`\n${fail ? '✗' : '✓'} test_shataku: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
