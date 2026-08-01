// 再就職手当（就業促進手当）の計算コアの検査。
//
// 期待値の作り方（規則: オラクルは実装と別ルートで作る）:
//  - 上限額 …… **厚労省の公表値そのもの**（LL080731保01: 59歳以下 6,745円 / 60〜64歳 5,454円）を
//               外部オラクルとして直に置く。coreは条文の率(百分の五十)から導くので、
//               「条文の読み方」と「公表値」が一致することを毎回確かめている。
//  - 支給額 …… 条文の式をここに書き直して独立に計算する（core を通さない）。
//  - 境目 …… 三分の一・三分の二の**両側1日**を必ず見る。境目は等号の向きでしか壊れない。
import { readFileSync } from "fs";
import * as S from "../docs/assets/saishushoku_core.js";
import * as K from "../docs/assets/kihonteate_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/kihonteate_r07.json", import.meta.url), "utf8"));

let fail = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { console.log("  ✗ " + msg); fail++; } };

// ── 1. 上限額: 条文の率から導いた額が、厚労省の公表値と一致すること ──────────────
// これが合っている限り、毎年8月1日の改定にコード修正なしで追随できる。
ok(S.saishushokuCap(35, D) === 6745, `59歳以下の上限=${S.saishushokuCap(35, D)}（公表値6,745円）`);
ok(S.saishushokuCap(59, D) === 6745, `59歳の上限=${S.saishushokuCap(59, D)}（公表値6,745円）`);
ok(S.saishushokuCap(60, D) === 5454, `60歳の上限=${S.saishushokuCap(60, D)}（公表値5,454円）`);
ok(S.saishushokuCap(64, D) === 5454, `64歳の上限=${S.saishushokuCap(64, D)}（公表値5,454円）`);
// ★年齢の境目は60歳ちょうど。59歳と60歳で必ず変わる（区分を取り違えると黙って間違える）
ok(S.saishushokuCap(59, D) !== S.saishushokuCap(60, D), "59歳と60歳で上限が変わっていない");

// ── 2. 支給率: 三分の一・三分の二の境目を、両側1日ずつ見る ────────────────────
// 所定給付日数120日 → 3分の1=40日、3分の2=80日
ok(S.supportTenths(80, 120) === 7, "残80日(=3分の2ちょうど)は70%のはず（「以上」を「超」と読むと落ちる）");
ok(S.supportTenths(79, 120) === 6, "残79日(3分の2未満)は60%のはず");
ok(S.supportTenths(40, 120) === 6, "残40日(=3分の1ちょうど)は60%のはず（「以上」を「超」と読むと落ちる）");
ok(S.supportTenths(39, 120) === 0, "残39日(3分の1未満)は不支給のはず");
ok(S.supportTenths(120, 120) === 7, "満額残っていれば70%");
ok(S.supportTenths(0, 120) === 0, "残0日は不支給");

// ★割り切れない日数でこそ、整数比較でないと壊れる。
// 所定給付日数100日 → 3分の1=33.33…（34日以上必要）、3分の2=66.66…（67日以上必要）
ok(S.supportTenths(34, 100) === 6, "100日の3分の1は33.33…。34日は「以上」を満たす");
ok(S.supportTenths(33, 100) === 0, "33日は3分の1(33.33…)未満なので不支給");
ok(S.supportTenths(67, 100) === 7, "100日の3分の2は66.66…。67日は「以上」を満たす");
ok(S.supportTenths(66, 100) === 6, "66日は3分の2(66.66…)未満なので60%");

// 90日（もっとも多い所定給付日数）: 3分の1=30日、3分の2=60日
ok(S.supportTenths(30, 90) === 6, "90日の3分の1=30日ちょうどは支給される");
ok(S.supportTenths(29, 90) === 0, "90日で残29日は不支給");
ok(S.supportTenths(60, 90) === 7, "90日の3分の2=60日ちょうどは70%");

// ── 3. 支給額: 条文の式を独立に書いて照合 ────────────────────────────────
// 法56条の3第3項1号「基本手当日額 × 支給残日数 × 十分の六（3分の2以上なら十分の七）」
const INDEP = (daily, cap, rem, prescribed) => {
  const d = Math.min(daily, cap);
  const t = rem * 3 < prescribed ? 0 : rem * 3 >= prescribed * 2 ? 7 : 6;
  return t === 0 ? 0 : Math.floor((d * rem * t) / 10);
};

// 記事と同じ例: 35歳・月30万・勤続12年・自己都合 → 賃金日額10,000円 → 日額6,307円 / 120日
const w = K.wageDaily(300000 * 6);
const daily1 = K.benefitDaily(w, 35, D);
ok(daily1 === 6307, `前提の基本手当日額=${daily1}（6,307円のはず）`);
ok(daily1 < S.saishushokuCap(35, D), "この例は上限に当たらない前提（当たると別の検査になる）");

const allOK = Object.fromEntries(S.CONDITIONS.map((c) => [c.key, true]));
const run = (rem, prescribed = 120, age = 35, daily = daily1, cond = allOK, hasRestriction = false) =>
  S.calcSaishushoku({ daily, age, prescribed, remaining: rem, conditions: cond, hasRestriction }, D);

for (const rem of [120, 100, 80, 79, 60, 40, 39, 10]) {
  const got = run(rem).amount;
  const want = INDEP(daily1, 6745, rem, 120);
  ok(got === want, `残${rem}日の支給額 ${got} ≠ 独立計算 ${want}`);
}

// 記事に載っている実額（記事側の検査 test_saishushoku_article.mjs と同じ値になること）
ok(run(120).amount === 529788, `残120日×70% = ${run(120).amount}（529,788円）`);
ok(run(80).amount === 353192, `残80日×70% = ${run(80).amount}（353,192円）`);
ok(run(79).amount === 298951, `残79日×60% = ${run(79).amount}（298,951円）`);
ok(run(40).amount === 151368, `残40日×60% = ${run(40).amount}（151,368円）`);

// ── 4. ★上限が効く例（このツールの存在理由）────────────────────────────────
// 45歳・月給60万円・勤続20年以上・会社都合。基本手当日額は上限9,110円だが、
// 再就職手当の計算では6,745円で頭打ちになる。
// ★賃金日額は17条4項で頭打ちになる。ここを通さずに20,000円のまま日額にすると
//   45歳では存在しえない10,000円が出る（記事のオラクルが実際にそう間違えていた）。
const w2 = K.applyWageCaps(K.wageDaily(600000 * 6), 45, D).value;
ok(w2 === 18220, `45歳の賃金日額=${w2}（17条4項で18,220円に頭打ち）`);
const daily2 = K.benefitDaily(w2, 45, D);
ok(daily2 === 9110, `45歳・月60万の基本手当日額=${daily2}（上限9,110円に張り付く）`);
// 会社都合・勤続20年以上・45〜59歳＝23条1項で330日（最長）
const days2 = K.prescribedDays(45, "y20", "kaisha", false);
ok(days2 === 330, `所定給付日数=${days2}（330日）`);
const r2 = run(days2, days2, 45, daily2);
ok(r2.cappedApplied === true, "上限が適用されたことを申告していない");
ok(r2.dailyUsed === 6745, `計算に使った日額=${r2.dailyUsed}（6,745円のはず）`);
ok(r2.amount === 1558095, `上限適用後の額=${r2.amount}（記事の1,558,095円）`);
// 上限を知らずに基本手当日額のまま計算すると、いくら過大になるか
const naive = Math.floor((daily2 * days2 * 7) / 10);
ok(naive === 2104410, `上限を無視した額=${naive}`);
ok(naive - r2.amount === 546315, `過大分=${naive - r2.amount}`);

// 60〜64歳は上限が別（5,454円）。同じ条件でも下がる
const r3 = run(days2, days2, 60, daily2);
ok(r3.dailyUsed === 5454, `60歳の使用日額=${r3.dailyUsed}（5,454円）`);
ok(r3.amount < r2.amount, "60歳のほうが上限が低いのに額が減っていない");

// 上限に当たらない人は、上限適用を申告しないこと（誤警告を出さない）
ok(run(120).cappedApplied === false, "上限に当たらないのに『上限適用』と言っている");
ok(run(120).dailyUsed === daily1, "上限に当たらないのに日額が書き換わっている");

// ── 5. 要件を満たさないときは金額を出さない（fail closed）──────────────────
const oneMissing = { ...allOK, overOneYear: false };
const rMissing = run(120, 120, 35, daily1, oneMissing);
ok(rMissing.eligible === false, "要件が欠けているのに支給対象と判定している");
ok(rMissing.amount === 0, `要件が欠けているのに金額${rMissing.amount}を出している`);
ok(rMissing.unmet.length === 1 && rMissing.unmet[0].key === "overOneYear",
   "満たしていない要件を正しく名指しできていない");

// 未チェック（＝不明）を「満たしている」と読み替えないこと
const rEmpty = run(120, 120, 35, daily1, {});
ok(rEmpty.eligible === false, "要件を1つもチェックしていないのに支給対象と判定している");
ok(rEmpty.unmet.length === S.CONDITIONS.length, "未チェックの要件を数え落としている");

// 給付制限がある人だけ、紹介要件が1つ増える
const rRestricted = run(120, 120, 35, daily1, allOK, true);
ok(rRestricted.eligible === false, "給付制限ありのとき紹介要件を課していない");
ok(rRestricted.unmet.length === 1 && rRestricted.unmet[0].key === "introduced",
   "増える要件が『紹介による就職』になっていない");
const rRestrictedOK = run(120, 120, 35, daily1, { ...allOK, introduced: true }, true);
ok(rRestrictedOK.eligible === true, "紹介要件を満たしても支給対象にならない");
// ★給付制限が無い人に紹介要件を課してはいけない（余計な要件で「もらえない」と誤答する）
ok(run(120).eligible === true, "給付制限が無いのに紹介要件を課している");

// ── 6. 3分の1未満は、要件を全部満たしていても不支給 ──────────────────────
const rFew = run(39);
ok(rFew.tooFewDays === true, "3分の1未満であることを申告していない");
ok(rFew.eligible === false && rFew.amount === 0, "3分の1未満なのに金額を出している");
ok(rFew.needForAny === 40, `必要な残日数=${rFew.needForAny}（120日の3分の1=40日）`);

// ── 7. 3分の2の崖 ────────────────────────────────────────────────
const cl = S.cliffAt(daily1, 120);
ok(cl.threshold === 80, `70%の下限日数=${cl.threshold}（80日）`);
ok(cl.above === 353192 && cl.below === 298951, `崖の両側=${cl.above}/${cl.below}`);
ok(cl.gap === 54241, `崖=${cl.gap}（54,241円）`);
// ★1日待って基本手当を1日分(6,307円)よけいに受け取っても、差引で47,934円の損になる
ok(cl.netLoss === 47934, `差引の損=${cl.netLoss}（47,934円）`);
ok(cl.netLoss > 0, "崖のほうが基本手当1日分より小さい＝この例は崖として成立していない");

// 割り切れない日数でも崖の位置が正しいこと
const cl100 = S.cliffAt(daily1, 100);
ok(cl100.threshold === 67, `100日のときの70%下限=${cl100.threshold}（66.66…→67日）`);

// ── 8. 就業促進定着手当の上限（十分の二）────────────────────────────────
const rT = run(120);
ok(rT.teichakuCap === Math.floor((6307 * 120 * 2) / 10), `定着手当の上限=${rT.teichakuCap}`);
ok(rT.teichakuCap === 151368, `定着手当の上限=${rT.teichakuCap}（151,368円）`);
// 不支給の人には定着手当の上限も出さない（再就職手当が前提の給付なので）
ok(run(39).teichakuCap === 0, "不支給なのに定着手当の上限を出している");

// ── 9. 桁落ちしていないこと（率を小数で持つと1円落ちる）──────────────────
// 十分の七を 0.7 で計算すると 6307*120*0.7 = 529787.9999… → 切捨で529,787円になる。
ok(run(120).amount !== Math.floor(6307 * 120 * 0.7) || Math.floor(6307 * 120 * 0.7) === 529788,
   "小数で計算した値と一致してしまっている（整数演算になっていない疑い）");
// 実際に小数で計算すると落ちる組み合わせを直に置いて、coreが耐えていることを見る
ok(S.payAmount(6307, 120, 7) === 529788, "整数演算になっていない（529,788円が出ない）");

console.log(fail === 0 ? `✅ 再就職手当 ${checks}件 すべて一致` : `❌ ${fail}/${checks}件 不一致`);
process.exit(fail === 0 ? 0 : 1);
