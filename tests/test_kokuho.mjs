/**
 * 国民健康保険料（税）の賦課計算（国民健康保険法施行令29条の7）の検査。
 *
 * 守りたいのは、画面が正常に見えたまま黙って誤る次の8つ:
 *   ① 賦課区分が4つ（令和8年度に子ども・子育て支援金分が新設された）
 *   ② 賦課限度額は区分ごとに個別（合計に1本の上限ではない）
 *   ③ 軽減がかかるのは均等割・平等割だけ（所得割は軽減されない）
 *   ④ 軽減の判定所得は基礎控除43万円を引く「前」
 *   ⑤ 判定所得・人数に世帯主と特定同一世帯所属者が入る
 *   ⑥ 給与所得者等の加算は「2以上」のときだけ
 *   ⑦ 未就学児の5割減額は軽減の「後」に当てる
 *   ⑧ 子ども・子育て支援金分の均等割は18歳以上だけ
 *
 * 検査の作り:
 *   §1 データの自己整合（区分・限度額・軽減の段階）
 *   §2 軽減判定の条文書き下しオラクル（独立実装との全域照合）
 *   §3 限度額が区分ごとに効く（合計にだけ当てる実装と答えが変わる例を固定）
 *   §4 手計算の鎖（看板例を1円まで）
 *   §5 単調性（所得・人数が増えて保険料が減らない）
 *   §6 急所の名指し（区分ごとの対象者・軽減の対象・順序）
 *   §7 fail closed（データ未読込で計算しない）
 */
import { readFileSync } from "node:fs";
import { calcKokuho, judgeKeigen, classifyByAge } from "../docs/assets/kokuho_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/kokuho_r08.json", import.meta.url)));

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);

const K = (key) => D.kubun.find((k) => k.key === key);

/** 検査用の架空の料率（実在自治体の値ではない＝出典のない数字を本番データに混ぜないため）。 */
const RATES = {
  iryo: { shotokuwari: 8.0, kintouwari: 50000, heitouwari: 0 },
  shien: { shotokuwari: 2.5, kintouwari: 16000, heitouwari: 0 },
  kaigo: { shotokuwari: 2.0, kintouwari: 17000, heitouwari: 0 },
  kosodate: { shotokuwari: 0.3, kintouwari: 2000, heitouwari: 0 },
};

const member = (o) => ({
  shotoku: 0, kaigo2: false, mishugakuji: false, under18: false, kyuyoShotokusha: false, ...o,
});

// ────────────────────────────────────────────────────────────────────────────
// §1 データの自己整合
// ────────────────────────────────────────────────────────────────────────────
// ★令和8年度に賦課区分が3→4になった。3のままのデータを配ると新設分がまるごと落ちるので、
//   「4つあること」と「子ども・子育て支援金分が在ること」を別々に固定する。
eq("§1 賦課区分は4つ", D.kubun.length, 4);
for (const key of ["iryo", "shien", "kaigo", "kosodate"]) {
  ok(`§1 区分 ${key} が在る`, !!K(key));
}
eq("§1 子ども・子育て支援金分は令和8年度の新設", K("kosodate").new_in_r08, true);

eq("§1 医療分の限度額", K("iryo").genkoku_yen, 670000);
eq("§1 後期高齢者支援金等分の限度額", K("shien").genkoku_yen, 260000);
eq("§1 介護分の限度額", K("kaigo").genkoku_yen, 170000);
eq("§1 子ども・子育て支援金分の限度額", K("kosodate").genkoku_yen, 30000);

// ★合計113万は4つの上限の単純合計であって条文の数字ではない。データが自分で辻褄を保つ。
eq("§1 限度額の合計はデータの4区分の和と一致",
  D.genkoku_total_yen, D.kubun.reduce((s, k) => s + k.genkoku_yen, 0));

eq("§1 基礎控除は43万円（地方税法314条の2第2項1号）", D.kiso_kojo_yen, 430000);
eq("§1 軽減判定の基準額も43万円", D.keigen.base_yen, 430000);
// ★同額だが役割が別（片方だけ改正されうる）。データで別々に持っていることを固定する。
ok("§1 基礎控除と軽減判定の基準額は別のキーで持つ",
  Object.prototype.hasOwnProperty.call(D, "kiso_kojo_yen")
  && Object.prototype.hasOwnProperty.call(D.keigen, "base_yen"));

eq("§1 軽減は3段階", D.keigen.dankai.length, 3);
eq("§1 7割軽減の加算は0円", D.keigen.dankai[0].per_head_add_yen, 0);
eq("§1 5割軽減の1人あたり加算は31万円", D.keigen.dankai[1].per_head_add_yen, 310000);
eq("§1 2割軽減の1人あたり加算は57万円", D.keigen.dankai[2].per_head_add_yen, 570000);
// 軽減率は下がり、閾値は上がる（条文の並び順そのもの）
for (let i = 1; i < D.keigen.dankai.length; i++) {
  ok(`§1 軽減率は段階が進むほど小さい（${i}）`,
    D.keigen.dankai[i].rate_pct < D.keigen.dankai[i - 1].rate_pct);
  ok(`§1 判定の加算は段階が進むほど大きい（${i}）`,
    D.keigen.dankai[i].per_head_add_yen > D.keigen.dankai[i - 1].per_head_add_yen);
}

eq("§1 未就学児の減額は5割", D.mishugakuji.genzoku_rate_pct, 50);
eq("§1 18歳未満の子ども・子育て支援金分均等割は全額減額", D.juhachi_miman.genzoku_rate_pct, 100);
eq("§1 産前産後の免除は4か月（多胎6か月）", `${D.sanzengosan.months_single}/${D.sanzengosan.months_multiple}`, "4/6");

// ────────────────────────────────────────────────────────────────────────────
// §2 軽減判定の条文書き下しオラクル
// ────────────────────────────────────────────────────────────────────────────
// 令29条の7第6項1号〜3号をコアとは独立に書き下し、全域で突き合わせる。
function oracleKeigen(shotokuList, kyuyoCount, headcount) {
  const total = shotokuList.reduce((s, v) => s + v, 0);
  const base = 430000 + Math.max(0, kyuyoCount - 1) * 100000;
  if (total <= base) return 70;
  if (total <= base + headcount * 310000) return 50;
  if (total <= base + headcount * 570000) return 20;
  return 0;
}

let sweep = 0;
let sweepBad = 0;
for (let n = 1; n <= 5; n++) {
  for (let kyuyo = 0; kyuyo <= n; kyuyo++) {
    for (let shotoku = 0; shotoku <= 4000000; shotoku += 50000) {
      const members = [];
      for (let i = 0; i < n; i++) {
        members.push(member({
          shotoku: i === 0 ? shotoku : 0,
          kyuyoShotokusha: i < kyuyo,
        }));
      }
      const got = judgeKeigen({ members, rates: RATES }, D).rate_pct;
      const want = oracleKeigen([shotoku], kyuyo, n);
      sweep++;
      if (got !== want) sweepBad++;
    }
  }
}
eq(`§2 軽減判定の全域照合（${sweep}通り）で不一致`, sweepBad, 0);

// ★給与所得者等が1人以下なら加算はゼロ（急所6）。人数×10万にすると単身給与所得者で甘くなる。
eq("§2 給与所得者等0人の基準額",
  judgeKeigen({ members: [member({ shotoku: 0 })], rates: RATES }, D).base, 430000);
eq("§2 給与所得者等1人でも基準額は据え置き",
  judgeKeigen({ members: [member({ shotoku: 0, kyuyoShotokusha: true })], rates: RATES }, D).base, 430000);
eq("§2 給与所得者等2人で+10万円",
  judgeKeigen({
    members: [member({ kyuyoShotokusha: true }), member({ kyuyoShotokusha: true })], rates: RATES,
  }, D).base, 530000);

// ★特定同一世帯所属者は人数にも所得にも入る（急所5）。
{
  const base = { members: [member({ shotoku: 1000000 })], rates: RATES };
  const without = judgeKeigen(base, D);
  const withTokutei = judgeKeigen({ ...base, tokuteiDouitsu: [{ shotoku: 0 }] }, D);
  eq("§2 特定同一世帯所属者を数えると人数が増える", withTokutei.headcount, without.headcount + 1);
  ok("§2 特定同一世帯所属者の分だけ判定が緩む（1人増＝閾値+31万/57万）",
    withTokutei.thresholds[1].threshold === without.thresholds[1].threshold + 310000);
}
{
  // 所得のある特定同一世帯所属者は判定所得を押し上げる（軽減を外す向き）
  const j = judgeKeigen({
    members: [member({ shotoku: 0 })], tokuteiDouitsu: [{ shotoku: 2000000 }], rates: RATES,
  }, D);
  eq("§2 特定同一世帯所属者の所得は判定所得に入る", j.hanteiShotoku, 2000000);
}
// ★擬制世帯主（世帯主が被保険者でない）の所得も判定に入る（急所5）。
{
  const j = judgeKeigen({
    members: [member({ shotoku: 0 })],
    setainushiIsHihokensha: false, setainushiShotoku: 5000000, rates: RATES,
  }, D);
  eq("§2 擬制世帯主の所得は判定所得に入る", j.hanteiShotoku, 5000000);
  eq("§2 擬制世帯主がいても軽減は外れる（所得が高いので）", j.rate_pct, 0);
}

// ★判定所得は基礎控除を引く「前」（急所4）。引いた額を渡すと1段階甘くなることを固定する。
{
  const j = judgeKeigen({ members: [member({ shotoku: 430000 })], rates: RATES }, D);
  eq("§2 判定所得は控除前の総所得金額等そのもの", j.hanteiShotoku, 430000);
  eq("§2 43万円ちょうどは7割軽減（以下＝境界を含む）", j.rate_pct, 70);
  const j2 = judgeKeigen({ members: [member({ shotoku: 430001 })], rates: RATES }, D);
  eq("§2 43万円+1円で7割軽減から外れる", j2.rate_pct, 50);
}

// ────────────────────────────────────────────────────────────────────────────
// §3 限度額は区分ごとに個別に効く（急所2）
// ────────────────────────────────────────────────────────────────────────────
// 医療分だけが上限に張り付き、合計は113万に届かない所得を選ぶ。
// 「合計にだけ上限を当てる」実装はこの世帯で答えが変わる（＝この検査が壊れる）。
{
  const r = calcKokuho({
    members: [member({ shotoku: 9000000 })], rates: RATES,
  }, D);
  eq("§3 医療分は限度額に張り付く", r.kubun.find((k) => k.key === "iryo").amount, 670000);
  eq("§3 医療分は上限適用フラグが立つ", r.kubun.find((k) => k.key === "iryo").capped, true);
  eq("§3 後期支援分は限度額未満なので張り付かない", r.kubun.find((k) => k.key === "shien").capped, false);
  eq("§3 子育て分も限度額未満", r.kubun.find((k) => k.key === "kosodate").capped, false);

  const sumBeforeCap = r.kubun.reduce((s, k) => s + k.beforeCap, 0);
  ok("§3 上限前の合計は113万円未満（＝合計にだけ上限を当てる実装では上限が働かない）",
    sumBeforeCap < D.genkoku_total_yen);
  ok("§3 区分ごとに上限を当てた合計の方が小さい（両実装の答えが違う）",
    r.total < sumBeforeCap);
  eq("§3 その差は医療分の超過分ちょうど",
    sumBeforeCap - r.total,
    r.kubun.find((k) => k.key === "iryo").beforeCap - 670000);
}

// 全区分が張り付けば合計は限度額の合計に一致する
{
  const r = calcKokuho({
    members: [member({ shotoku: 30000000, kaigo2: true })], rates: RATES,
  }, D);
  eq("§3 全区分が上限なら合計は113万円", r.total, D.genkoku_total_yen);
}

// ────────────────────────────────────────────────────────────────────────────
// §4 手計算の鎖（看板例・1円まで）
// ────────────────────────────────────────────────────────────────────────────
// 世帯: 世帯主45歳（給与・総所得金額等300万）／配偶者42歳（所得0）／子5歳（未就学児）／子16歳
// 軽減判定: 判定所得300万 > 43万+4人×57万=271万 → 軽減なし
{
  const members = [
    member({ shotoku: 3000000, kaigo2: true, kyuyoShotokusha: true }),
    member({ shotoku: 0, kaigo2: true }),
    member({ shotoku: 0, mishugakuji: true, under18: true }),
    member({ shotoku: 0, under18: true }),
  ];
  const r = calcKokuho({ members, rates: RATES }, D);
  eq("§4 軽減なし（判定所得300万 > 271万）", r.keigen.rate_pct, 0);
  eq("§4 判定の人数は4人", r.keigen.headcount, 4);

  const iryo = r.kubun.find((k) => k.key === "iryo");
  // 所得割 (300万−43万)×8% = 205,600 ／ 均等割 5万×3人 + 5万×50%（未就学児）= 175,000
  eq("§4 医療分の所得割", iryo.shotokuwari, 205600);
  eq("§4 医療分の均等割（未就学児1人は半額）", iryo.kintouwari, 175000);
  eq("§4 医療分の未就学児減額", iryo.mishugakujiGenzoku, 25000);
  eq("§4 医療分の計", iryo.amount, 380600);

  const shien = r.kubun.find((k) => k.key === "shien");
  eq("§4 後期支援分の計", shien.amount, 64250 + 56000);

  // ★介護分は40歳以上65歳未満の2人だけ（子2人は所得割にも均等割にも入らない）
  const kaigo = r.kubun.find((k) => k.key === "kaigo");
  eq("§4 介護分の均等割は2人分", kaigo.kintouwariCount, 2);
  eq("§4 介護分の計", kaigo.amount, 51400 + 34000);

  // ★子育て分の均等割は18歳以上の2人だけ（所得割は全員が対象）
  const kosodate = r.kubun.find((k) => k.key === "kosodate");
  eq("§4 子育て分の均等割は18歳以上の2人分", kosodate.kintouwariCount, 2);
  eq("§4 子育て分の計", kosodate.amount, 7710 + 4000);

  eq("§4 世帯の年間保険料の合計", r.total, 380600 + 120250 + 85400 + 11710);
}

// ────────────────────────────────────────────────────────────────────────────
// §5 単調性
// ────────────────────────────────────────────────────────────────────────────
{
  let prev = -1;
  let bad = 0;
  for (let shotoku = 0; shotoku <= 12000000; shotoku += 100000) {
    const r = calcKokuho({ members: [member({ shotoku, kaigo2: true })], rates: RATES }, D);
    if (r.total < prev) bad++;
    prev = r.total;
  }
  eq("§5 所得が増えて保険料が減ることはない", bad, 0);
}
{
  // 人数が増えて（所得は同じ）保険料が減ることはない。均等割が積み上がるため。
  let prev = -1;
  let bad = 0;
  for (let n = 1; n <= 6; n++) {
    const members = [];
    for (let i = 0; i < n; i++) members.push(member({ shotoku: i === 0 ? 5000000 : 0 }));
    const r = calcKokuho({ members, rates: RATES }, D);
    if (r.total < prev) bad++;
    prev = r.total;
  }
  eq("§5 人数が増えて保険料が減ることはない", bad, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// §6 急所の名指し
// ────────────────────────────────────────────────────────────────────────────
// ③ 軽減は均等割・平等割だけ。所得割は軽減されない。
{
  const members = [member({ shotoku: 400000 })]; // 7割軽減に入る所得
  const rates = { ...RATES, iryo: { shotokuwari: 8.0, kintouwari: 50000, heitouwari: 20000 } };
  const r = calcKokuho({ members, rates }, D);
  eq("§6 7割軽減に入っている", r.keigen.rate_pct, 70);
  const iryo = r.kubun.find((k) => k.key === "iryo");
  // 所得割 = (40万−43万)→0円。軽減の有無に関係なく所得割の率は据え置き。
  eq("§6 所得割は基礎控除で0円になる（軽減とは無関係）", iryo.shotokuwari, 0);
  eq("§6 均等割は7割軽減後（5万×30%）", iryo.kintouwari, 15000);
  eq("§6 平等割も7割軽減後（2万×30%）", iryo.heitouwari, 6000);
}
{
  // 所得割が0にならない額で、軽減が所得割に及んでいないことを直接示す
  const rates = { iryo: { shotokuwari: 10, kintouwari: 100000, heitouwari: 0 } };
  const noKeigen = calcKokuho({ members: [member({ shotoku: 3000000 })], rates }, D);
  const withKeigen = calcKokuho({ members: [member({ shotoku: 500000 })], rates }, D);
  eq("§6 軽減世帯でも所得割は率どおり（(50万−43万)×10%）",
    withKeigen.kubun.find((k) => k.key === "iryo").shotokuwari, 7000);
  eq("§6 非軽減世帯の所得割も率どおり（(300万−43万)×10%）",
    noKeigen.kubun.find((k) => k.key === "iryo").shotokuwari, 257000);
}

// ⑦ 未就学児の5割減額は軽減の「後」（急所7）。
// 7割軽減世帯の未就学児1人: 5万 → 軽減後1.5万 → 半額7,500円。
// 順序を逆にすると 5万→2.5万→軽減後7,500円 で同じに見えるが、
// 平等割が入ると差が出る。ここでは減額額そのものを固定して順序を名指しする。
{
  const rates = { iryo: { shotokuwari: 0, kintouwari: 50000, heitouwari: 0 } };
  const r = calcKokuho({ members: [member({ shotoku: 0, mishugakuji: true, under18: true })], rates }, D);
  eq("§6 7割軽減に入っている（所得0）", r.keigen.rate_pct, 70);
  const iryo = r.kubun.find((k) => k.key === "iryo");
  eq("§6 未就学児の減額は軽減後の額の5割（5万→1.5万→7,500円）", iryo.mishugakujiGenzoku, 7500);
  eq("§6 未就学児の均等割は7,500円", iryo.kintouwari, 7500);
}

// ⑧ 子育て分の均等割は18歳以上だけ（急所8）。
{
  const rates = { kosodate: { shotokuwari: 0, kintouwari: 2000, heitouwari: 0 } };
  const child = calcKokuho({ members: [member({ under18: true })], rates }, D);
  eq("§6 18歳未満だけの世帯は子育て分の均等割が0人", child.kubun.find((k) => k.key === "kosodate").kintouwariCount, 0);
  eq("§6 18歳未満だけの世帯は子育て分の均等割が0円", child.kubun.find((k) => k.key === "kosodate").kintouwari, 0);
  const adult = calcKokuho({ members: [member({ under18: false })], rates }, D);
  eq("§6 18歳以上は子育て分の均等割を負担する", adult.kubun.find((k) => k.key === "kosodate").kintouwariCount, 1);
}

// ⑨ 介護分は40歳以上65歳未満だけ（急所9）。
{
  const rates = { kaigo: { shotokuwari: 2.0, kintouwari: 17000, heitouwari: 0 } };
  const young = calcKokuho({ members: [member({ shotoku: 3000000, kaigo2: false })], rates }, D);
  eq("§6 40歳未満は介護分の所得割0", young.kubun.find((k) => k.key === "kaigo").shotokuwari, 0);
  eq("§6 40歳未満は介護分の均等割0", young.kubun.find((k) => k.key === "kaigo").kintouwari, 0);
  const mid = calcKokuho({ members: [member({ shotoku: 3000000, kaigo2: true })], rates }, D);
  eq("§6 40〜64歳は介護分を負担する", mid.kubun.find((k) => k.key === "kaigo").amount, 51400 + 17000);
}

// 年齢からの区分（境界を名指し）
eq("§6 39歳は介護第2号でない", classifyByAge(39).kaigo2, false);
eq("§6 40歳は介護第2号", classifyByAge(40).kaigo2, true);
eq("§6 64歳は介護第2号", classifyByAge(64).kaigo2, true);
eq("§6 65歳は介護第2号でない", classifyByAge(65).kaigo2, false);
eq("§6 6歳は未就学児（年度末年齢）", classifyByAge(6).mishugakuji, true);
eq("§6 7歳は未就学児でない", classifyByAge(7).mishugakuji, false);
eq("§6 18歳は18歳未満扱い（年度末年齢）", classifyByAge(18).under18, true);
eq("§6 19歳は18歳以上", classifyByAge(19).under18, false);

// 平等割は、その区分に均等割の対象者がいなければかからない
{
  const rates = { kaigo: { shotokuwari: 0, kintouwari: 17000, heitouwari: 8000 } };
  const r = calcKokuho({ members: [member({ kaigo2: false })], rates }, D);
  eq("§6 介護第2号がいない世帯に介護分の平等割はかからない",
    r.kubun.find((k) => k.key === "kaigo").heitouwari, 0);
}

// 基礎控除は人ごとに引く（世帯合計から1回だけ引くと多人数世帯で過大になる）
{
  const rates = { iryo: { shotokuwari: 10, kintouwari: 0, heitouwari: 0 } };
  const r = calcKokuho({
    members: [member({ shotoku: 1000000 }), member({ shotoku: 1000000 })], rates,
  }, D);
  // (100万−43万)×2 ×10% = 114,000。世帯合計から1回引くと (200万−43万)×10% = 157,000。
  eq("§6 基礎控除は被保険者ごとに引く", r.kubun.find((k) => k.key === "iryo").shotokuwari, 114000);
}

// ────────────────────────────────────────────────────────────────────────────
// §7 fail closed
// ────────────────────────────────────────────────────────────────────────────
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
ok("§7 データ未読込では計算しない（null）", throws(() => calcKokuho({ members: [] }, null)));
ok("§7 区分が空なら計算しない", throws(() => calcKokuho({ members: [] }, { kubun: [], keigen: D.keigen, kiso_kojo_yen: 430000 })));
ok("§7 軽減データが空なら計算しない", throws(() => calcKokuho({ members: [] }, { kubun: D.kubun, kiso_kojo_yen: 430000 })));
ok("§7 基礎控除が空なら計算しない", throws(() => calcKokuho({ members: [] }, { kubun: D.kubun, keigen: D.keigen })));
// 料率が渡されなければ0円（推測で埋めない）
{
  const r = calcKokuho({ members: [member({ shotoku: 5000000 })] }, D);
  eq("§7 料率未入力なら0円（推測で埋めない）", r.total, 0);
}

// ────────────────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`✗ test_kokuho: ${fails.length} 件失敗 / ${pass} 件成功`);
  for (const f of fails) console.error("   - " + f);
  process.exit(1);
}
console.log(`✓ test_kokuho: ${pass} 件すべて成功`);
