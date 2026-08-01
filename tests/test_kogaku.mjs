// 高額療養費（70歳未満）の計算コアの検査。
//
// 期待値の作り方（規則: オラクルは実装と別ルートで作る）:
//  - 限度額 …… **協会けんぽが公表している計算例と、自サイトの記事が掲げている数字**を
//               外部オラクルとして直に置く（87,430円・171,820円・84,390円の差）。
//               core は JSON の base/threshold/rate から導くので、
//               「条文の読み方」と「公表された計算例」が一致することを毎回確かめている。
//  - 端数 …… 50銭の**両側**を必ず見る。四捨五入は等号の向きでしか壊れない。
//  - 境目 …… 標準報酬月額の 28万 / 53万 / 83万 と、世帯合算の 21,000円を**両側1円**で見る。
//  - 1%の起点 …… 医療費が起点**未満**の月を必ず見る（条文の読替えを落とすと限度額が基準額より
//                低く出る。実装を素直に書くと必ず踏む穴）。
import { readFileSync } from "fs";
import * as K from "../docs/assets/kogaku_core.js";
import { kenkoGrade } from "../docs/assets/shaho_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/kogaku_r08.json", import.meta.url), "utf8"));

let fail = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { console.log("  ✗ " + msg); fail++; } };

const one = (medical, ratio = 0.3) => [{ medical, ratio }];
const run = (o) => K.calcKogaku({ ageGroup: "under70", items: one(1000000), ...o }, D);

// ── 1. データが条文の12個の額を持っていること（JSONの差し替え事故の網）────────────
// 出典: 施行令42条1項（八万百円・二十五万二千六百円・十六万七千四百円・五万七千六百円・三万五千四百円、
//       多数回 十四万百円・九万三千円・四万四千四百円・二万四千六百円、
//       1%起点 二十六万七千円・八十四万二千円・五十五万八千円）
const byKey = Object.fromEntries(D.kubun.map((k) => [k.key, k]));
ok(byKey.a.base === 252600 && byKey.a.threshold === 842000 && byKey.a.tasukai === 140100, "区分アの3値が条文と違う");
ok(byKey.i.base === 167400 && byKey.i.threshold === 558000 && byKey.i.tasukai === 93000, "区分イの3値が条文と違う");
ok(byKey.u.base === 80100 && byKey.u.threshold === 267000 && byKey.u.tasukai === 44400, "区分ウの3値が条文と違う");
ok(byKey.e.base === 57600 && byKey.e.tasukai === 44400, "区分エの2値が条文と違う");
ok(byKey.o.base === 35400 && byKey.o.tasukai === 24600, "区分オの2値が条文と違う");
ok(D.gassan_min === 21000, "世帯合算の下限が21,000円でない（41条1項1号かっこ書き）");
// 区分エとウの多数回該当が同額であること（記事の目玉。片方を直して片方を忘れる事故の網）
ok(byKey.e.tasukai === byKey.u.tasukai, "区分ウとエの多数回該当額は同じ44,400円のはず");

// ── 2. 外部オラクル: 協会けんぽ／記事の公表計算例を1円まで再現する ───────────────
// 区分ウ・医療費100万円 → 80,100 +(1,000,000−267,000)×1% = 80,100+7,330 = 87,430円
ok(run({ standardMonthly: 300000 }).limit === 87430,
   `区分ウ・医療費100万の限度額=${run({ standardMonthly: 300000 }).limit}（公表例 87,430円）`);
// 区分イ・医療費100万円 → 167,400 +(1,000,000−558,000)×1% = 167,400+4,420 = 171,820円
ok(run({ standardMonthly: 530000 }).limit === 171820,
   `区分イ・医療費100万の限度額=${run({ standardMonthly: 530000 }).limit}（公表例 171,820円）`);
// 記事の目玉「報酬月額1円差で84,390円変わる」が実装で再現すること
const uLimit = run({ standardMonthly: 500000 }).limit;
const iLimit = run({ standardMonthly: 530000 }).limit;
ok(iLimit - uLimit === 84390, `等級1つの差=${iLimit - uLimit}円（記事の主張 84,390円）`);
// 区分ア・医療費100万円 → 252,600 +(1,000,000−842,000)×1% = 252,600+1,580 = 254,180円
ok(run({ standardMonthly: 830000 }).limit === 254180, "区分ア・医療費100万の限度額が254,180円でない");

// ── 3. ★1%の起点は「下限としての読替え」。医療費が起点未満でも基準額を下回らない ────
// 条文「その額が二十六万七千円に満たないときは、二十六万七千円」。
// 素直に (医療費−267,000)×1% と書くと 100,000円の月に 80,100−1,670=78,430円 と低く出る。
const small = K.calcKogaku({ ageGroup: "under70", standardMonthly: 300000, items: one(100000) }, D);
ok(small.limit === 80100, `医療費10万円の月の限度額=${small.limit}（80,100円ちょうどのはず。1%部分は0以上）`);
ok(K.limitFor(byKey.u, 0, false) === 80100, "医療費0でも基準額を下回ってはいけない");
ok(K.limitFor(byKey.u, 266999, false) === 80100, "起点の1円手前で1%部分がマイナスになっている");
ok(K.limitFor(byKey.u, 267000, false) === 80100, "起点ちょうどは1%部分0");
ok(K.limitFor(byKey.u, 267100, false) === 80101, "起点+100円で1%部分が1円（80,101円）にならない");

// ── 4. 端数は四捨五入（50銭の両側）──────────────────────────────────
// 50銭ちょうどは切り上げ、50銭未満は切り捨て（施行令42条1項各号かっこ書き）
ok(K.roundPercentPart(7330.49) === 7330, "50銭未満が切り上がっている");
ok(K.roundPercentPart(7330.50) === 7331, "50銭ちょうどが切り上がっていない（「以上」を「超」と読んでいる）");
ok(K.roundPercentPart(7330.51) === 7331, "50銭超が切り上がっていない");
// 医療費が50円単位のとき1%は必ず0.5刻みになる → 実データで両側を踏む
ok(K.limitFor(byKey.u, 267050, false) === 80101, "1%=0.50円が切り上がっていない（80,101円のはず）");
ok(K.limitFor(byKey.u, 267049, false) === 80100, "1%=0.49円が切り上がってしまっている");

// ── 5. 区分の境目を両側1円で見る（標準報酬月額。年収ではない）────────────────
const kub = (std, hikazei = false) => K.classify({ standardMonthly: std, hikazei }, D).key;
ok(kub(829999) === "i", "標報829,999円は区分イのはず");
ok(kub(830000) === "a", "標報830,000円ちょうどは区分ア（「以上」）のはず");
ok(kub(529999) === "u", "標報529,999円は区分ウのはず");
ok(kub(530000) === "i", "標報530,000円ちょうどは区分イのはず");
ok(kub(279999) === "e", "標報279,999円は区分エのはず");
ok(kub(280000) === "u", "標報280,000円ちょうどは区分ウのはず");
// ★区分オは区分エより優先する（4号が「次号に掲げる者を除く」と書いている）
ok(kub(200000, true) === "o", "非課税なのに区分エになっている（オが優先のはず）");
ok(kub(900000, true) === "o", "非課税なのに区分アになっている（オが優先のはず）");
// 標準報酬月額が無いまま黙って区分ウに落とさないこと
ok(K.classify({ standardMonthly: null, hikazei: false }, D) === null, "標報不明を黙って区分に落としている");
ok(run({ standardMonthly: null }).determined === false, "標報不明なのに額を出している");

// ── 6. 等級表と噛み合っていること（記事の 514,999 / 515,000 の1円差）────────────
// shaho_core の等級表を通す＝等級表を二重実装していないことの確認でもある
ok(kenkoGrade(514999).standard === 500000, "報酬月額514,999円は標準報酬月額50万（第30級）のはず");
ok(kenkoGrade(515000).standard === 530000, "報酬月額515,000円は標準報酬月額53万（第31級）のはず");
ok(kub(kenkoGrade(514999).standard) === "u", "報酬月額514,999円は区分ウのはず");
ok(kub(kenkoGrade(515000).standard) === "i", "報酬月額515,000円は区分イのはず");
// 記事が「80万円台の等級は存在しない」と書いている（区分イの上限が実質79万）
ok(kenkoGrade(800000).standard === 790000, "報酬月額80万円は標準報酬月額79万（第39級）のはず");

// ── 7. 世帯合算は21,000円**未満**を1円も拾わない（両側1円）──────────────────
// 自己負担21,000円ちょうど = 医療費70,000円×3割
const g = (meds) => K.calcKogaku(
  { ageGroup: "under70", standardMonthly: 300000, items: meds.map((m) => ({ medical: m, ratio: 0.3 })) }, D);
ok(g([70000]).counted.length === 1, "自己負担21,000円ちょうどが合算されていない（「以上」のはず）");
ok(g([69990]).counted.length === 0, "自己負担20,997円が合算されてしまっている");
// 記事の例: 家族3人が別の病院で20,000円ずつ → 合算される額は0円
const three = g([66666, 66666, 66666]);
ok(three.totalSelf === 0, `別々の病院で約20,000円ずつ×3の合算額=${three.totalSelf}（0円のはず）`);
ok(three.refund === 0, "合算対象が無いのに支給額が出ている");
ok(three.excludedSelf > 0, "対象外の自己負担が記録されていない（画面で説明できない）");

// ── 8. ★合算対象から外れた行は、医療費の側にも入れない（限度額が過大になる）───────
// 100万円(自己負担30万・対象) + 5万円(自己負担1.5万・対象外)
const mix = g([1000000, 50000]);
ok(mix.totalMedical === 1000000, `1%の基礎になる医療費=${mix.totalMedical}（対象外の5万円を混ぜてはいけない）`);
ok(mix.totalSelf === 300000, "対象外の自己負担を合算額に混ぜている");
ok(mix.limit === 87430, "対象外を混ぜたせいで限度額がずれている");
ok(mix.refund === 300000 - 87430, "支給額が合わない");
// ★逆向き: 合算対象が増えたら限度額も上がること（自己負担だけ足して医療費を据え置く実装の網）
const two = g([1000000, 1000000]);
ok(two.totalMedical === 2000000, "2件の合算で医療費が合計されていない");
ok(two.limit === 80100 + 17330, `2件合算の限度額=${two.limit}（80,100+(200万−26.7万)×1%=97,430円のはず）`);
ok(two.limit > mix.limit, "合算対象が増えたのに限度額が上がっていない（1%の基礎を据え置いている）");

// ── 9. 多数回該当（直近12か月で4回目から）───────────────────────────
const t = (std, hikazei = false) =>
  K.calcKogaku({ ageGroup: "under70", standardMonthly: std, hikazei, tasukai: true, items: one(1000000) }, D);
ok(t(300000).limit === 44400, "区分ウの多数回該当が44,400円でない");
ok(t(200000).limit === 44400, "区分エの多数回該当が44,400円でない");
ok(t(830000).limit === 140100, "区分アの多数回該当が140,100円でない");
ok(t(530000).limit === 93000, "区分イの多数回該当が93,000円でない");
ok(t(200000, true).limit === 24600, "区分オの多数回該当が24,600円でない");
// 多数回該当は定額（医療費が増えても1%が乗らない）
ok(K.calcKogaku({ ageGroup: "under70", standardMonthly: 300000, tasukai: true, items: one(9000000) }, D).limit === 44400,
   "多数回該当に1%部分が乗ってしまっている");
// 通常月と多数回の**両方**を画面に出せること（比較が記事の目玉）
const cmp = run({ standardMonthly: 300000 });
ok(cmp.limitNormal === 87430 && cmp.limitIfTasukai === 44400, "通常月と多数回の両方を返していない");

// ── 10. ★70歳以上は額を出さない（fail closed）──────────────────────────
const old = K.calcKogaku({ ageGroup: "over70", standardMonthly: 300000, items: one(1000000) }, D);
ok(old.supported === false, "70歳以上に70歳未満の表で答えてしまっている");
ok(old.limit === undefined, "70歳以上なのに限度額を返している");
ok(/70歳以上/.test(old.message), "70歳以上であることを利用者に申告していない");

// ── 11. 支給額と、最後に残る負担 ──────────────────────────────────
const r = run({ standardMonthly: 300000 });
ok(r.totalSelf === 300000, "窓口負担3割が30万円になっていない");
ok(r.refund === 212570, `支給額=${r.refund}（300,000−87,430=212,570円のはず）`);
ok(r.finalBurden === 87430, "最後に残る負担が限度額と一致しない");
// 限度額に届かない月は支給されない（負の支給額を出さない）
const under = K.calcKogaku({ ageGroup: "under70", standardMonthly: 300000, items: one(200000) }, D);
ok(under.refund === 0, `限度額未満の月の支給額=${under.refund}（0円のはず。負の額を出さない）`);
ok(under.finalBurden === 60000, "限度額未満の月は窓口負担がそのまま残るはず");
// 合算対象外がある月は、その分だけ手元の負担が増える
ok(mix.finalBurden === 87430 + 15000, "合算対象外の自己負担が手元の負担に足されていない");

console.log(fail === 0 ? `✅ 高額療養費 ${checks}件 すべて一致` : `❌ ${fail}/${checks}件 不一致`);
process.exit(fail === 0 ? 0 : 1);
