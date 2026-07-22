/**
 * 青色申告特別控除（措法25条の2）の単体テスト。
 *
 * ★オラクルは「実装の式」ではなく**条文・国税庁 No.2072 の書き方**で持つ。
 *   実装は「区分表を上から見て要件を満たす最初のものを採る」形だが、
 *   ここでは条文の項ごとの要件を素直に if で書き下して照合する（独立実装）。
 */
import { readFileSync } from 'node:fs';
import { aoiroKojo, taxSaving } from '../docs/assets/setsuzei_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/setsuzei_r08.json', import.meta.url), 'utf8'));

let fail = 0, n = 0;
const eq = (got, want, msg) => {
  n++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.error(`NG ${msg}\n   got=${g}\n  want=${w}`); fail++; }
};

// ---- オラクル: 条文の書き方で控除額を出す（実装を見ずに書く） ----
// 措法25条の2: 1項=10万円(不動産・事業・山林)/3項=55万円(不動産・事業、事業を営む・複式簿記・期限内)
//              4項=65万円へ読替え(優良電子帳簿 or e-Tax)/所法67条1項(現金主義)適用者は3項の対象外
function oracle({ jigyo = 0, fudosan = 0, sanrin = 0,
                  jigyoteki = false, fukushiki = false, kigennai = false,
                  etaxOrYuryo = false, genkinShugi = false }) {
  const p = (v) => (v > 0 ? Math.floor(v) : 0);            // 黒字のみ（損益通算前）
  const cap55 = p(fudosan) + p(jigyo);                      // 3項の限度（山林を含まない）
  const cap10 = p(fudosan) + p(jigyo) + p(sanrin);          // 1項の限度（山林を含む）
  const kou3 = jigyoteki && fukushiki && kigennai && !genkinShugi;
  if (kou3 && etaxOrYuryo) return { key: '65', amount: 650000, cap: cap55, deduction: Math.min(650000, cap55) };
  if (kou3)                return { key: '55', amount: 550000, cap: cap55, deduction: Math.min(550000, cap55) };
  return { key: '10', amount: 100000, cap: cap10, deduction: Math.min(100000, cap10) };
}

const check = (input, msg) => {
  const o = oracle(input);
  const r = aoiroKojo(input, D);
  eq({ key: r.key, amount: r.amount, cap: r.cap, deduction: r.deduction }, o, msg);
};

// ---- 1. 区分の判定（要件の全組み合わせを網羅） ----
const base = { jigyo: 5000000 };
for (const jigyoteki of [false, true])
  for (const fukushiki of [false, true])
    for (const kigennai of [false, true])
      for (const etaxOrYuryo of [false, true])
        for (const genkinShugi of [false, true])
          check({ ...base, jigyoteki, fukushiki, kigennai, etaxOrYuryo, genkinShugi },
            `区分 jigyoteki=${jigyoteki} fukushiki=${fukushiki} kigennai=${kigennai} etax=${etaxOrYuryo} genkin=${genkinShugi}`);

// ---- 2. 所得が控除額より小さいと所得の額が限度（措法25条の2 1項2号・3項2号） ----
const full = { jigyoteki: true, fukushiki: true, kigennai: true, etaxOrYuryo: true };
check({ ...full, jigyo: 300000 }, '所得30万円 < 65万円 → 限度は30万円');
check({ ...full, jigyo: 650000 }, '所得ちょうど65万円');
check({ ...full, jigyo: 649999 }, '所得65万円の1円手前');
check({ jigyo: 50000 }, '10万円区分・所得5万円 → 限度は5万円');
eq(aoiroKojo({ ...full, jigyo: 300000 }, D).capped, true, '限度で切られたことを申告する');
eq(aoiroKojo({ ...full, jigyo: 5000000 }, D).capped, false, '満額なら capped=false');

// ---- 3. ★赤字は「無いもの」として合計する（損益通算前・No.2072 注2） ----
// 事業所得が赤字でも不動産所得の黒字から満額引ける（相殺すると控除を過少に出す）。
check({ ...full, jigyo: -2000000, fudosan: 3000000 }, '事業▲200万・不動産+300万 → 限度は300万（相殺しない）');
eq(aoiroKojo({ ...full, jigyo: -2000000, fudosan: 3000000 }, D).deduction, 650000,
   '赤字を相殺せず65万円満額');
check({ ...full, jigyo: -2000000, fudosan: 400000 }, '事業▲200万・不動産+40万 → 限度は40万');

// ---- 4. ★山林所得は10万円区分だけの対象（1項にあり3項に無い） ----
check({ ...full, sanrin: 3000000 }, '山林所得だけ・要件充足でも65万の限度は0円');
eq(aoiroKojo({ ...full, sanrin: 3000000 }, D).deduction, 0,
   '山林所得しか無ければ65万円区分の限度は0円');
check({ sanrin: 3000000 }, '山林所得だけ・10万円区分なら限度は300万→10万円');
eq(aoiroKojo({ sanrin: 3000000 }, D).deduction, 100000, '10万円区分は山林所得から引ける');

// ---- 5. あと何が足りないか（missing）と、届いたときの増分 ----
const r55 = aoiroKojo({ ...full, etaxOrYuryo: false, jigyo: 5000000 }, D);
eq(r55.key, '55', '55万円区分');
eq(r55.missing, ['etax_or_yuryo'], '65万円に足りないのは e-Tax/優良電子帳簿だけ');
eq(r55.nextGain, 100000, '65万円に届けば控除は10万円増える');

const r10 = aoiroKojo({ jigyoteki: true, fukushiki: false, kigennai: false, jigyo: 5000000 }, D);
eq(r10.key, '10', '複式簿記も期限内申告も無ければ10万円');
eq(r10.missing, ['fukushiki', 'kigennai'], '55万円に足りないもの2つを申告');
eq(r10.nextGain, 450000, '55万円に届けば控除は45万円増える');

const rGenkin = aoiroKojo({ ...full, genkinShugi: true, jigyo: 5000000 }, D);
eq(rGenkin.key, '10', '現金主義の特例を選ぶと10万円のみ');
eq(rGenkin.missing.includes('genkin_shugi'), true, '理由に現金主義を挙げる');

// ---- 6. 住民税にも同額が流入する（地方税法32条2項） ----
eq(D.aoiro.juminzei_same_amount, true, '住民税は同額（人的控除と違う）');
// taxSaving は所得税・住民税で同額の前提なので、青色申告特別控除にそのまま使える。
const t = taxSaving({ kazeiShotoku: 5000000, annualDeduction: 650000 }, D);
// 課税所得500万→433.5万。速算表: 500万×20%-427,500=572,500 / 4,350,000×20%-427,500=442,500
eq(t.taxBefore, 572500, '所得税(控除前) 課税所得500万');
eq(t.taxAfter, 442500, '所得税(控除後) 課税所得435万');
eq(t.shotokuGen, 130000, '所得税の減少');
eq(t.fukkoGen, 2730, '復興特別所得税の減少(2.1%)');
eq(t.juminGen, 65000, '住民税の減少(10%)');
eq(t.total, 197730, '65万円控除・課税所得500万の節税額');

// 55万→65万の差(10万円)がいくらの得になるか（画面の主張と一致させる）
const a55 = taxSaving({ kazeiShotoku: 5000000, annualDeduction: 550000 }, D);
// 10万円 × (所得税20% + 復興0.42% + 住民税10%) = 30,420円
eq(t.total - a55.total, 30420, '55万→65万の10万円差は年30,420円の節税');

// ---- 7. 令和8年分であること・令和9年分の予告データ ----
eq(D.aoiro.year, '令和8年分', '令和8年分のデータ');
eq(D.aoiro.kubun.map((k) => k.amount), [650000, 550000, 100000], '令和8年分は65/55/10万円');
eq(D.aoiro.next_regime.amounts, { top: 750000, standard: 650000, base: 100000 },
   '令和9年分以後は75/65/10万円');
eq(D.aoiro.next_regime.shoukibo_shikiichi, 10000000, '令和9年分以後の1,000万円基準');

// ---- 8. 参照データが無ければ例外（fail closed。黙って0円と答えない） ----
let threw = false;
try { aoiroKojo({ jigyo: 1000000 }, {}); } catch { threw = true; }
eq(threw, true, '参照データが無ければ例外');

console.log(fail === 0 ? `OK ${n} checks` : `FAILED ${fail}/${n}`);
process.exit(fail === 0 ? 0 : 1);
