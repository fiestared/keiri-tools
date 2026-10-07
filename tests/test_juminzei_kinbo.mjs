/**
 * 所得割の非課税限度額を「わずかに超えた」人の減額（地方税法附則3条の3第2項・第5項）の検査。
 *
 * 2026-10-08 に見つかった誤答: juminzei_core.calc にこの減額が無く、
 * 配偶者あり・社会保険料0円・給与1,770,001円（令和7年分）で所得割31,000円を出していた（正しくは0円）。
 *
 * ★期待値はコアを使わず、条文の算式から独立に計算する（このファイルは calc 以外をコアから import しない）:
 *   第5項（市町村）: 限度額 L が「総所得金額等 A −（市の所得割 S ＋ 県の所得割 D）」を超えるとき、
 *     超える金額 ×  S/(S＋D) を市の所得割から控除。第2項（道府県）は D/(S＋D) で同じ。
 *   L = 35万円×(本人＋同一生計配偶者＋扶養親族〔16歳未満を含む〕)＋10万円＋（配偶者・扶養がいれば）32万円
 *   S・D = 税率（6%・4%）× 課税総所得金額 − 調整控除（3%・2%）。確定金額は100円未満切捨（20条の4の2）。
 * ★壊しテスト: 減額を外したコア（限度額を −∞ にして適用条件を偽にする）で同じ検査を回し、赤になることを確かめる。
 *   壊す前に、無傷のコアで検査が緑であることを先に確かめる（CLAUDE.md 規則2）。
 * ★ページの計算例（<p id="kinbo-rei">）の数字を、その段落を名指しして照合する（規則3）。
 */
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const D = JSON.parse(readFileSync(new URL('docs/assets/juminzei_r08.json', ROOT), 'utf8'));

let checks = 0, failed = 0;
const fails = [];
function eq(actual, expected, label) {
  checks++;
  if (actual !== expected) { failed++; fails.push(`  ✗ ${label}  期待 ${expected} / 実際 ${actual}`); }
}

// ── 独立実装（条文の数字を直書き） ──────────────────────────────
// 給与所得（このファイルが扱う範囲だけを条文から直書き）:
//   令和7年分: 収入190万円未満は最低保障65万円（所得税法28条3項）。190万円以上360万円未満は
//     別表第五（28条4項）＝収入を4,000円刻みの区分の下限額 A に丸め A×70%−8万円。
//   令和8年分: 収入219万円以下は74万円（措法29条の4）。それ以外はこの検査では扱わない。
const LIMIT = { r7: 3_599_999, r8: 2_190_000 };
function kyuyoShotokuIndep(shunyu, zeisei) {
  if (zeisei === 'r8') {
    if (shunyu > LIMIT.r8) throw new Error('独立実装の範囲外');
    return Math.max(0, shunyu - 740_000);
  }
  if (shunyu > LIMIT.r7) throw new Error('独立実装の範囲外');
  if (shunyu < 1_900_000) return Math.max(0, shunyu - 650_000);
  const A = Math.floor(shunyu / 4000) * 4000;
  return A * 70 / 100 - 80_000;
}
// 人的控除（住民税）と人的控除差（調整控除）。配偶者は一般（本人の合計所得900万円以下）。
const JINTEKI = { kiso: 430_000, haigusha: 330_000, ippan: 330_000, tokutei: 450_000, nensho: 0 };
const SA = { kiso: 50_000, haigusha: 50_000, ippan: 50_000, tokutei: 180_000, nensho: 0 };

// 税率（×1000。4.025% → 4025）は自治体ごとの条例の率なので、ここだけ参照データの値を入力として使う。
// 指定都市は調整控除の配分も 4%:1%（37条・314条の6のかっこ書き）。
const RATES = {
  hyojun: { s: 6000, d: 4000, shitei: false },
  kanagawa: { s: 6000, d: 4025, shitei: false },
  yokohama: { s: 8000, d: 2025, shitei: true },
  kobe: { s: 8000, d: 2000, shitei: true },
};
for (const [k, v] of Object.entries(RATES)) {
  const j = D.kintouwari.jichitai.find((x) => x.key === k);
  if (!j || j.shichoson_pct_x1000 !== v.s || j.dofuken_pct_x1000 !== v.d || !!j.shitei !== v.shitei) {
    throw new Error(`検査の前提の税率が参照データと違う: ${k}`);
  }
}

function expectIndep({ shunyu, shakai, fam, zeisei, jichitai = 'hyojun' }) {
  const R = RATES[jichitai];
  const A = kyuyoShotokuIndep(shunyu, zeisei);
  const hai = fam.haigusha ? 1 : 0;
  const n = { ippan: fam.fuyoIppan || 0, tokutei: fam.fuyoTokutei || 0, nensho: fam.fuyoNensho || 0 };
  const dep = n.ippan + n.tokutei + n.nensho;
  const L = 350_000 * (1 + hai + dep) + 100_000 + (hai + dep > 0 ? 320_000 : 0);
  if (A <= L) return { total: 0, S: 0, D: 0, applied: false, A, L };
  const kojo = JINTEKI.kiso + shakai + hai * JINTEKI.haigusha
    + n.ippan * JINTEKI.ippan + n.tokutei * JINTEKI.tokutei;
  const kazei = Math.floor(Math.max(0, A - kojo) / 1000) * 1000;
  const sa = SA.kiso + hai * SA.haigusha + n.ippan * SA.ippan + n.tokutei * SA.tokutei;
  // 調整控除（課税総所得200万円以下）: min(人的控除差, 課税総所得) × 5%（市3%・県2%／指定都市は4%・1%）
  const base = Math.min(sa, kazei);
  const cS = Math.floor(base * (R.shitei ? 4 : 3) / 100);
  const cD = Math.floor(base * (R.shitei ? 1 : 2) / 100);
  // 所得割の額を「円×100000」の整数で持つ（4.025% の小数を落とさない）。BigInt で桁あふれを避ける
  const S5 = BigInt(Math.max(0, kazei * R.s - cS * 100_000));
  const D5 = BigInt(Math.max(0, kazei * R.d - cD * 100_000));
  const sum = S5 + D5;
  const over = BigInt(A - L);
  if (sum > 0n && over * 100_000n < sum) {
    // 超える金額 x = L − (A − sum)。控除後 S − x·S/sum ＝ S×(A−L)/sum（有理数のまま）。100円未満を切り捨てる。
    const S = Number((S5 * over) / (sum * 100n)) * 100;
    const Dd = Number((D5 * over) / (sum * 100n)) * 100;
    return { total: S + Dd, S, D: Dd, applied: true, A, L };
  }
  const S = Number(S5 / 10_000_000n) * 100, Dd = Number(D5 / 10_000_000n) * 100;
  return { total: S + Dd, S, D: Dd, applied: false, A, L };
}

const FAMILIES = [
  ['独身', {}],
  ['配偶者', { haigusha: 'ippan' }],
  ['配偶者＋16歳未満1人', { haigusha: 'ippan', fuyoNensho: 1 }],
  ['配偶者＋一般扶養1＋16歳未満1', { haigusha: 'ippan', fuyoIppan: 1, fuyoNensho: 1 }],
  ['16歳未満2人（配偶者なし・ひとり親でない）', { fuyoNensho: 2 }],
  ['配偶者＋特定扶養1', { haigusha: 'ippan', fuyoTokutei: 1 }],
];

/** 与えられた calc で、検査を全部走らせて「失敗件数」を返す（壊しテストでも同じ関数を使う） */
function runSuite(calc, { quiet = false } = {}) {
  const before = failed;
  let appliedSeen = 0;
  for (const jichitai of Object.keys(RATES)) for (const zeisei of [undefined, 'r8']) {
    for (const [label, fam] of FAMILIES) {
      for (const shakai of [0, 30_000, 120_000]) {
        const family = { haigusha: fam.haigusha || 'none', ...fam };
        // 限度額の直下から上へ。給与収入で 1円刻みの境界前後＋1,000円刻みの帯を見る
        const ded = zeisei === 'r8' ? 740_000 : 650_000;
        const hai = fam.haigusha ? 1 : 0;
        const dep = (fam.fuyoIppan || 0) + (fam.fuyoTokutei || 0) + (fam.fuyoNensho || 0);
        const L = 350_000 * (1 + hai + dep) + 100_000 + (hai + dep > 0 ? 320_000 : 0);
        const lim = LIMIT[zeisei || 'r7'];
        // 別表第五の帯（190万円以上）では給与所得が4,000円刻みなので、境界は「所得 > L」になる最初の区分
        let edge = L + ded;  // 総所得金額等 = L となる給与収入（最低保障の帯）
        if (zeisei !== 'r8' && edge >= 1_900_000) {
          edge = 1_900_000;
          while (kyuyoShotokuIndep(edge, zeisei) <= L) edge += 4000;
          edge -= 1;  // 直前の区分の最後の1円（所得 ≤ L）から見る
        }
        if (edge > lim) continue;
        const pts = [edge - 1, edge, edge + 1, edge + 2, edge + 99, edge + 100, edge + 101, edge + 4000, edge + 4001];
        for (let k = edge + 1000; k <= Math.min(lim, edge + 200_000); k += 1000) pts.push(k);
        for (const k of pts) {
          if (k > lim) continue;
          const e = expectIndep({ shunyu: k, shakai, fam, zeisei, jichitai });
          const r = calc({ kyuyoShunyu: k, shakaiHoken: shakai, family, zeisei, jichitai }, D);
          const tag = `${jichitai} ${zeisei || 'r7'} ${label} 社保${shakai} 給与${k}`;
          eq(r.shotokuwariJissai, e.total, `${tag} 所得割`);
          eq(r.shotokuwariJissaiShichoson, e.S, `${tag} 市`);
          eq(r.shotokuwariJissaiDofuken, e.D, `${tag} 県`);
          eq(r.kinboChosei.applied, e.applied, `${tag} 減額の適用`);
          if (e.applied) appliedSeen++;
        }
      }
    }
  }
  // 名指しの固定値（gbrain keiri-tools/juminzei-hayami-2026-10-07 で見つかった例）
  const fixed = [
    [{ kyuyoShunyu: 1_770_001, shakaiHoken: 0, family: { haigusha: 'ippan' } }, 0, 31_000],
    [{ kyuyoShunyu: 1_800_000, shakaiHoken: 0, family: { haigusha: 'ippan' } }, 30_000, 34_000],
    [{ kyuyoShunyu: 1_100_001, shakaiHoken: 0, family: {} }, 0, 1_000],
    [{ kyuyoShunyu: 1_860_001, shakaiHoken: 0, family: { haigusha: 'ippan' }, zeisei: 'r8' }, 0, 31_000],
    [{ kyuyoShunyu: 1_880_000, shakaiHoken: 0, family: { haigusha: 'ippan' }, zeisei: 'r8' }, 20_000, 33_000],
  ];
  // 超過課税（神奈川県 4.025%）で按分の前に1円未満を落とすと100円ずれる例（sol 6.1 r1 の M1）。
  //   1,863,236円: 市18,780・県12,610.75、A−L=3,236 → 市1,935.98…→1,900／県1,300.01…→1,300
  //   1,867,856円: 市4,600・県3,100（途中で丸めると市4,700）
  for (const [k, ws, wd] of [[1_863_236, 1_900, 1_300], [1_867_856, 4_600, 3_100]]) {
    const r = calc({ kyuyoShunyu: k, shakaiHoken: 0, family: { haigusha: 'ippan' }, zeisei: 'r8', jichitai: 'kanagawa' }, D);
    eq(r.shotokuwariJissaiShichoson, ws, `神奈川 給与${k} 市（按分まで小数を保つ）`);
    eq(r.shotokuwariJissaiDofuken, wd, `神奈川 給与${k} 県（按分まで小数を保つ）`);
  }
  for (const [inp, want, beforeWant] of fixed) {
    const r = calc(inp, D);
    const tag = `固定例 ${inp.zeisei || 'r7'} 給与${inp.kyuyoShunyu}`;
    eq(r.shotokuwariJissai, want, `${tag} 減額後の所得割`);
    eq(r.kinboChosei.beforeShichoson + r.kinboChosei.beforeDofuken, beforeWant, `${tag} 減額前の所得割`);
  }
  // 減額は均等割・森林環境税に触れない（1,770,001円・配偶者: 均等割4,000＋森林1,000）
  eq(calc({ kyuyoShunyu: 1_770_001, shakaiHoken: 0, family: { haigusha: 'ippan' } }, D).juminzeiTotal, 5_000, '1,770,001円の住民税合計（均等割＋森林環境税のみ）');
  // ふるさと納税の20%上限の基礎（35条・37条を適用した額。附則3条の3の減額はこの列挙に無い）は減額で動かさない（37条の2第11項）
  eq(calc({ kyuyoShunyu: 1_770_001, shakaiHoken: 0, family: { haigusha: 'ippan' } }, D).shotokuwari, 31_000, '特例控除上限の基礎は減額前');
  eq(appliedSeen > 50, true, `減額が効く点を十分に通った（${appliedSeen}点）`);
  if (!quiet) return failed - before;
  return failed - before;
}

// ── 0. 関数単体: 積が 2^53 を超える引数でも有理数どおり（sol 6.1 r2 の low） ──
async function unitBig(mod) {
  // sol r2 の再現: 県の厳密値はちょうど 891,300円。Number の積（3.09e17）だと 891,200円に落ちていた
  const r = mod.hikazeiKinboChosei(37_009_940, 34_790_000, 207_600_000_000, 139_265_625_000);
  eq(r.shichoson, 1_328_600, '大きな引数 市');
  eq(r.dofuken, 891_300, '大きな引数 県（ちょうど100円の境界）');
  const r2 = mod.hikazeiKinboChosei(1_090_000, 1_000_000, 6_000_000_000_007, 4_000_000_000_009);
  const S2 = 6_000_000_000_007n, D2 = 4_000_000_000_009n, s2 = S2 + D2;
  eq(r2.shichoson, Number((S2 * 90_000n) / (s2 * 100n)) * 100, '大きな引数2 市');
  eq(r2.dofuken, Number((D2 * 90_000n) / (s2 * 100n)) * 100, '大きな引数2 県');
}

// ── 1. 無傷のコア ─────────────────────────────────────────────
const real = await import(new URL('docs/assets/juminzei_core.js', ROOT));
await unitBig(real);
const realFails = runSuite(real.calc);

// ── 2. ページの計算例を名指しで照合 ─────────────────────────────
{
  const html = readFileSync(new URL('docs/juminzei/index.html', ROOT), 'utf8');
  const m = html.match(/<p id="kinbo-rei">([\s\S]*?)<\/p>/);
  eq(!!m, true, 'ページに <p id="kinbo-rei"> がある');
  const t = m ? m[1].replace(/<[^>]+>/g, '') : '';
  const r1 = real.calc({ kyuyoShunyu: 1_860_001, shakaiHoken: 0, family: { haigusha: 'ippan' }, zeisei: 'r8' }, D);
  const r2 = real.calc({ kyuyoShunyu: 1_880_000, shakaiHoken: 0, family: { haigusha: 'ippan' }, zeisei: 'r8' }, D);
  const y = (n) => n.toLocaleString('en-US') + '円';
  const want = [
    `給与収入が1,860,001円`, `総所得金額等が${y(r1.goukeiShotoku)}`, `非課税限度額${y(r1.hikazei.shotokuLimit)}`,
    `減額がなければ所得割は${y(r1.kinboChosei.beforeShichoson + r1.kinboChosei.beforeDofuken)}`,
    `減額後は100円未満切捨てで${y(r1.shotokuwariJissai)}`, `の${y(r1.kintouwari.total)}はかかります`,
    `給与収入1,880,000円なら、減額前の${y(r2.kinboChosei.beforeShichoson + r2.kinboChosei.beforeDofuken)}が${y(r2.shotokuwariJissai)}になります`,
  ];
  for (const w of want) eq(t.includes(w), true, `計算例の段落に「${w}」`);
  eq(r1.goukeiShotoku - r1.hikazei.shotokuLimit, 1, '計算例は限度額を1円超える');
}

// ── 3. 壊しテスト（無傷が緑のときだけ） ──────────────────────────
//   ①減額そのものを外す ②按分の前に1円未満を落とす ③市と県の按分を逆にする ④按分前に100円で丸める
const CALL = 'hikazeiKinboChosei(goukei, hikazei.shotokuLimit, exactS1e5, exactD1e5)';
const BREAKS = [
  ['減額を外す', CALL, 'hikazeiKinboChosei(goukei, -1e15, exactS1e5, exactD1e5)'],
  ['按分前に1円未満を切捨て', CALL, 'hikazeiKinboChosei(goukei, hikazei.shotokuLimit, rawJissaiS * 100000, rawJissaiD * 100000)'],
  ['市と県の按分を逆に', 'shichoson: q(s),\n    dofuken: q(d),', 'shichoson: q(d),\n    dofuken: q(s),'],
  ['按分前に100円で丸め', CALL, 'hikazeiKinboChosei(goukei, hikazei.shotokuLimit, Math.floor(exactS1e5 / 1e7) * 1e7, Math.floor(exactD1e5 / 1e7) * 1e7)'],
];
if (realFails === 0 && failed === 0) {
  const src = readFileSync(new URL('docs/assets/juminzei_core.js', ROOT), 'utf8');
  for (const [name, needle, repl] of BREAKS) {
    const dir = mkdtempSync(join(tmpdir(), 'kinbo-break-'));
    try {
      if (src.split(needle).length !== 2) throw new Error(`壊し方が外れた（${name}: 置換対象が一意でない）`);
      writeFileSync(join(dir, 'juminzei_core.js'), src.replace(needle, repl));
      copyFileSync(new URL('docs/assets/shaho_core.js', ROOT), join(dir, 'shaho_core.js'));
      const broken = await import(pathToFileURL(join(dir, 'juminzei_core.js')).href);
      const saved = { checks, failed, n: fails.length };
      const brokenFails = runSuite(broken.calc, { quiet: true });
      checks = saved.checks; failed = saved.failed; fails.length = saved.n;  // 壊した側の失敗は数えない
      checks++;
      if (brokenFails > 0) console.log(`  壊しテスト「${name}」: ${brokenFails} 件が赤（期待どおり）`);
      else { failed++; fails.push(`  ✗ 壊しテスト「${name}」でも緑（検査が効いていない）`); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
} else {
  console.error('  無傷のコアで赤なので壊しテストは行わない');
}

if (failed) {
  console.error(fails.slice(0, 40).join('\n'));
  console.error(`✗ ${failed}/${checks} 件失敗`);
  process.exit(1);
}
console.log(`✓ 附則3条の3（非課税限度額付近の減額）: ${checks} 件OK`);
