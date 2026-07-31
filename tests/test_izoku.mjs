/**
 * 遺族年金（国民年金法38条・39条1項／厚生年金保険法60条1項・62条1項・65条）の検査。
 *
 * 守りたいのは、画面が正常に見えたまま黙って誤る次の6つ:
 *   ① 300月みなしは**短期要件のときだけ**（長期要件に効かせると加入の短い人を過大に出す）
 *   ② 子の加算は「2人まで」が高い額で、3人目から下がる（全員を高い額で足すと過大）
 *   ③ 18歳年度末までの子がいないと遺族基礎年金は出ない（子のない妻の額が倍近くずれる）
 *   ④ 中高齢寡婦加算は遺族基礎年金を受けているあいだ支給停止（厚年法65条。足すと過大）
 *   ⑤ 中高齢寡婦加算は長期要件だと被保険者期間240月以上が要る（62条1項かっこ書）
 *   ⑥ 端数が2種類ある（基礎・加算は100円単位／報酬比例から出す厚生は1円単位）
 *
 * §1 データの自己整合
 * §2 ★外部オラクル（令和7年度の公表額を同じ式・同じ丸めで再現できるか）
 * §3 子の加算の段（2人まで／3人目以降）
 * §4 300月みなしが効く要件・効かない要件
 * §5 中高齢寡婦加算の4つの門
 * §6 65歳以降の併給（厚年法60条1項2号）
 * §7 端数処理
 * §8 単調性・全域スイープ
 * §9 収録範囲外の申告（fail closed）
 */
import { readFileSync } from "node:fs";
import {
  calcKiso, calcKosei, calcChukoreikafu, calcHeikyu65, calcIzoku, roundYen, round100,
} from "../docs/assets/izoku_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/izoku_r08.json", import.meta.url)));

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);

const KASAN = (key) => D.kiso.kasan.find((k) => k.key === key);
const YOKEN = (key) => D.kosei.yoken.find((y) => y.key === key);

// 標準的な入力（各テストで必要な項目だけ上書きする）
const base = {
  koCount: 0, isWife: true, age: 45, yokenKey: "tanki",
  preAvgYen: 0, preMonths: 0, postAvgYen: 300000, postMonths: 120, ownRoureiYen: 0,
};

// ── §1 データの自己整合 ─────────────────────────────────────────────────────
eq("§1 遺族基礎年金の本則額は78万900円", D.kiso.hongaku_yen, 780900);
eq("§1 子の加算（1・2人目）の本則額は22万4700円", KASAN("ko_1_2").hongaku_yen, 224700);
eq("§1 子の加算（3人目以降）の本則額は7万4900円", KASAN("ko_3plus").hongaku_yen, 74900);
eq("§1 高い額が適用されるのは2人まで", KASAN("ko_1_2").max_count, 2);
eq("§1 遺族厚生年金は4分の3", D.kosei.ritsu, 0.75);
eq("§1 短期要件の最低月数は300", YOKEN("tanki").minimum_months, 300);
ok("§1 ★長期要件には最低月数の定めが無い（null であること）",
  YOKEN("choki").minimum_months === null);
eq("§1 中高齢寡婦加算は遺族基礎年金の4分の3", D.chukoreikafu.ratio, 0.75);
eq("§1 中高齢寡婦加算は40歳から", D.chukoreikafu.age_from, 40);
eq("§1 中高齢寡婦加算は65歳まで", D.chukoreikafu.age_to, 65);
eq("§1 長期要件の240月制限", D.chukoreikafu.choki_minimum_months, 240);
eq("§1 60条1項2号イは3分の2", D.kosei.heikyu_65.ratio_izoku, 2 / 3);
eq("§1 60条1項2号ロは2分の1", D.kosei.heikyu_65.ratio_rourei, 0.5);
ok("§1 収録範囲外は7件すべて理由つきで列挙されている",
  D.out_of_scope.length === 7 && D.out_of_scope.every((o) => o.key && o.label && o.why));

// ── §2 ★外部オラクル ────────────────────────────────────────────────────────
// 令和8年度の額は「本則額×改定率」を100円単位に丸めたもの。
// **同じ式・同じ丸めに令和7年度の改定率(1.065)を通すと、公表されている令和7年度の額に
// なるか**を独立に確かめる。4つとも1円まで一致すれば、条文の読み方と端数処理が正しい。
const R7 = 1.065;
const R8 = D.kaiteiritsu.value;
eq("§2 令和8年度の改定率は1.085", R8, 1.085);

eq("§2 基本額 780,900×1.085 が data と一致", round100(780900 * R8), D.kiso.yen);
eq("§2 加算1・2人目 224,700×1.085 が data と一致", round100(224700 * R8), KASAN("ko_1_2").yen);
eq("§2 加算3人目以降 74,900×1.085 が data と一致", round100(74900 * R8), KASAN("ko_3plus").yen);
eq("§2 中高齢寡婦加算 基本額×3/4 が data と一致",
  round100(D.kiso.yen * D.chukoreikafu.ratio), D.chukoreikafu.yen);

// ★オラクル本体: 令和7年度の公表額（日本年金機構）を再現する
eq("§2 ★オラクル 遺族基礎 基本額(R7公表 831,700)", round100(780900 * R7), 831700);
eq("§2 ★オラクル 子の加算 1・2人目(R7公表 239,300)", round100(224700 * R7), 239300);
eq("§2 ★オラクル 子の加算 3人目以降(R7公表 79,800)", round100(74900 * R7), 79800);
eq("§2 ★オラクル 中高齢寡婦加算(R7公表 623,800)", round100(round100(780900 * R7) * 0.75), 623800);

// ── §3 子の加算の段 ─────────────────────────────────────────────────────────
const K = (n) => calcKiso(n, D);
ok("§3 ★子が0人なら遺族基礎年金は出ない（配偶者に支給されない）",
  K(0).yen === 0 && K(0).eligible === false);
eq("§3 子1人 = 基本額+243,800", K(1).yen, D.kiso.yen + 243800);
eq("§3 子2人 = 基本額+243,800×2", K(2).yen, D.kiso.yen + 243800 * 2);
eq("§3 子3人 = 基本額+243,800×2+81,300", K(3).yen, D.kiso.yen + 243800 * 2 + 81300);
eq("§3 子5人 = 基本額+243,800×2+81,300×3", K(5).yen, D.kiso.yen + 243800 * 2 + 81300 * 3);
// ★誤実装（全員を高い額で足す）と答えが変わることを固定する
ok("§3 ★3人目は2人目より安い（全員を224,700円で足す誤実装と必ず食い違う）",
  K(3).yen - K(2).yen < K(2).yen - K(1).yen);
eq("§3 3人目の増分は81,300", K(3).yen - K(2).yen, 81300);
eq("§3 2人目の増分は243,800", K(2).yen - K(1).yen, 243800);

// ── §4 300月みなし ─────────────────────────────────────────────────────────
const kosei = (over) => calcKosei({ ...base, ...over }, D);
// 加入120月・平均標準報酬額30万（平成15年4月以後のみ）
const short = kosei({ yokenKey: "tanki", postMonths: 120 });
const shortChoki = kosei({ yokenKey: "choki", postMonths: 120 });
ok("§4 短期要件は300月みなしが立つ", short.minimumApplied === true && short.countedMonths === 300);
ok("§4 ★長期要件は300月みなしが立たない（実月数のまま）",
  shortChoki.minimumApplied === false && shortChoki.countedMonths === 120);
ok("§4 ★同じ加入期間でも短期要件のほうが高い（みなしの有無が効いている）",
  short.yen > shortChoki.yen);
eq("§4 短期要件は実月数の2.5倍(300/120)になる", short.yen, roundYen(shortChoki.yen / 120 * 300 * 1) === short.yen ? short.yen : -1);
// 300月を超えていればみなしは効かない
const long = kosei({ yokenKey: "tanki", postMonths: 400 });
ok("§4 300月を超える加入にはみなしが効かない",
  long.minimumApplied === false && long.countedMonths === 400);
// 手計算オラクル: 300,000 × 5.481/1000 × 300 × 3/4
eq("§4 短期要件の額は手計算と一致",
  short.yen, roundYen(roundYen(300000 * 5.481 / 1000 * 300) * 0.75));
// 平成15年3月以前の乗率が別に効く
const mixed = kosei({ preAvgYen: 300000, preMonths: 100, postAvgYen: 300000, postMonths: 200, yokenKey: "choki" });
ok("§4 ★平成15年3月以前は7.125/1000で計算される（同じ平均額でも単価が高い）",
  mixed.yen > roundYen(roundYen(300000 * 5.481 / 1000 * 300) * 0.75));

// ── §5 中高齢寡婦加算の4つの門 ──────────────────────────────────────────────
const CK = (over) => calcChukoreikafu(
  { isWife: true, age: 45, receivesKiso: false, yokenKey: "tanki", months: 120, ...over }, D);
eq("§5 妻・45歳・子なし・短期要件なら加算される", CK({}).yen, D.chukoreikafu.yen);
ok("§5 ★夫には加算されない", CK({ isWife: false }).yen === 0 && CK({ isWife: false }).reasonKey === "not_wife");
ok("§5 39歳には加算されない", CK({ age: 39 }).yen === 0 && CK({ age: 39 }).reasonKey === "age");
ok("§5 65歳になったら加算は終わる", CK({ age: 65 }).yen === 0 && CK({ age: 65 }).reasonKey === "age");
eq("§5 64歳までは加算される", CK({ age: 64 }).yen, D.chukoreikafu.yen);
ok("§5 ★遺族基礎年金を受けているあいだは支給停止（厚年法65条）",
  CK({ receivesKiso: true }).yen === 0 && CK({ receivesKiso: true }).reasonKey === "kiso");
ok("§5 ★長期要件で240月未満なら加算されない",
  CK({ yokenKey: "choki", months: 239 }).yen === 0
  && CK({ yokenKey: "choki", months: 239 }).reasonKey === "choki_months");
eq("§5 長期要件でも240月あれば加算される", CK({ yokenKey: "choki", months: 240 }).yen, D.chukoreikafu.yen);
ok("§5 ★短期要件には240月の制限が無い（120月でも加算される）",
  CK({ yokenKey: "tanki", months: 120 }).yen === D.chukoreikafu.yen);
// 落ちたときは必ず理由が出る（黙って0にしない）
for (const over of [{ isWife: false }, { age: 39 }, { receivesKiso: true }, { yokenKey: "choki", months: 1 }]) {
  const r = CK(over);
  ok(`§5 加算されないときは理由が出る（${JSON.stringify(over)}）`,
    r.eligible === false && typeof r.reason === "string" && r.reason.length > 10);
}

// ── §6 65歳以降の併給（60条1項2号） ─────────────────────────────────────────
const H = (go1, own, kiso) => calcHeikyu65(go1, own, kiso, D);
ok("§6 自分の老齢厚生年金が無ければ1号の額のまま",
  H(1000000, 0, false).chosenKey === "go1" && H(1000000, 0, false).yen === 1000000);
ok("§6 ★遺族基礎年金を受けるときは1号の額（60条1項ただし書）",
  H(1000000, 900000, true).chosenKey === "go1" && H(1000000, 900000, true).applied === false);
// 自分の老齢厚生年金が大きいほど2号が有利になる
const big = H(1000000, 1200000, false);
eq("§6 2号 = 1号×2/3 + 自分の老齢×1/2", big.go2Yen, roundYen(1000000 * (2 / 3) + 1200000 * 0.5));
ok("§6 ★自分の老齢厚生年金が大きいと2号が選ばれる", big.chosenKey === "go2" && big.yen === big.go2Yen);
ok("§6 いずれか多い額になっている", big.yen === Math.max(big.go1Yen, big.go2Yen));
const small = H(1000000, 100000, false);
ok("§6 自分の老齢厚生年金が小さければ1号が選ばれる", small.chosenKey === "go1");
ok("§6 上乗せ額は（選ばれた額−自分の老齢厚生年金）で負にならない",
  big.uwanoseYen === big.yen - 1200000 && H(100000, 900000, false).uwanoseYen >= 0);

// ── §7 端数処理 ─────────────────────────────────────────────────────────────
eq("§7 100円丸め 49円は切捨て", round100(1000049), 1000000);
eq("§7 100円丸め 50円は切上げ", round100(1000050), 1000100);
eq("§7 100円丸め 99円は切上げ", round100(1000099), 1000100);
eq("§7 100円丸め ちょうどは動かない", round100(1000000), 1000000);
eq("§7 1円丸め 0.5は切上げ", roundYen(100.5), 101);
eq("§7 1円丸め 0.49は切捨て", roundYen(100.49), 100);
ok("§7 ★すべての額が整数（円未満を画面に出さない）", [
  calcIzoku({ ...base, koCount: 2 }, D).totalYen,
  calcIzoku({ ...base, koCount: 0 }, D).totalYen,
  calcIzoku({ ...base, koCount: 0, yokenKey: "choki", postMonths: 300 }, D).totalYen,
].every(Number.isInteger));

// ── §8 単調性・全域スイープ ─────────────────────────────────────────────────
// 子が増えれば遺族基礎年金は必ず増える（減らない）
let prev = -1, monoOk = true;
for (let n = 0; n <= 10; n++) { const v = K(n).yen; if (v < prev) monoOk = false; prev = v; }
ok("§8 子の人数に対して遺族基礎年金は非減少", monoOk);
// 加入月数が増えれば遺族厚生年金は減らない
prev = -1; monoOk = true;
for (let m = 0; m <= 480; m += 12) {
  const v = kosei({ yokenKey: "choki", postMonths: m }).yen;
  if (v < prev) monoOk = false; prev = v;
}
ok("§8 加入月数に対して遺族厚生年金は非減少（長期要件）", monoOk);
// 全域で NaN / 負 / 非整数が出ない
let bad = null;
for (let n = 0; n <= 6 && !bad; n++) {
  for (const age of [25, 39, 40, 55, 64, 65, 70]) {
    for (const yokenKey of ["tanki", "choki"]) {
      for (const m of [0, 60, 240, 300, 480]) {
        const r = calcIzoku({ ...base, koCount: n, age, yokenKey, postMonths: m }, D);
        if (!Number.isFinite(r.totalYen) || r.totalYen < 0 || !Number.isInteger(r.totalYen)) {
          bad = { n, age, yokenKey, m, total: r.totalYen };
        }
      }
    }
  }
}
ok(`§8 全域スイープで NaN・負・非整数が出ない${bad ? `（${JSON.stringify(bad)}）` : ""}`, bad === null);
// 未入力・不正入力でも落ちない
const empty = calcIzoku({}, D);
ok("§8 空の入力でも 0円で返る（NaN を画面に出さない）",
  empty.totalYen === 0 && Number.isInteger(empty.totalYen));
const neg = calcIzoku({ ...base, koCount: -3, postMonths: -10, postAvgYen: -1, age: -5 }, D);
ok("§8 負の入力でも 0円で返る", neg.totalYen === 0);

// ── §9 収録範囲外の申告 ─────────────────────────────────────────────────────
const keys = D.out_of_scope.map((o) => o.key);
for (const k of ["kaisei_r10", "ko_jishin", "kafu_nenkin", "keikateki_kafu",
  "wakai_tsuma_5nen", "seikei_iji", "shogai_heikyu"]) {
  ok(`§9 収録範囲外に ${k} が申告されている`, keys.includes(k));
}
ok("§9 ★令和10年4月施行の改正（男女差解消・5年有期化）が申告されている",
  D.out_of_scope.find((o) => o.key === "kaisei_r10").why.includes("令和10年4月"));

// ── 合算の組み立て（画面はこの1つの結果から描く） ──────────────────────────
const withKo = calcIzoku({ ...base, koCount: 2, age: 42 }, D);
ok("★子がいるあいだは 遺族基礎+遺族厚生 で、中高齢寡婦加算は付かない",
  withKo.kiso.yen > 0 && withKo.chukorei.yen === 0
  && withKo.totalYen === withKo.kiso.yen + withKo.koseiYen);
const noKo = calcIzoku({ ...base, koCount: 0, age: 42 }, D);
ok("★子がいなくなると 遺族厚生+中高齢寡婦加算 になる",
  noKo.kiso.yen === 0 && noKo.chukorei.yen === D.chukoreikafu.yen
  && noKo.totalYen === noKo.koseiYen + D.chukoreikafu.yen);
eq("月額は年額の12分の1（切捨て）", noKo.monthlyYen, Math.floor(noKo.totalYen / 12));

// ── 結果 ────────────────────────────────────────────────────────────────────
console.log(`test_izoku: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
