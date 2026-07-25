/**
 * 小規模宅地等の特例（措法69条の4）の検査。
 *
 * 守りたいのは「限度面積の式が、貸付事業用宅地等を選ぶかどうかで入れ替わること」（2項1号2号 vs 3号）と、
 * 「枠の配分が最大の減額になっていること」の2つ。どちらも黙って間違えても画面は正常に見える。
 *
 * 検査の作り:
 *   §1 データの自己整合（算入割合＋減額割合＝100・限度面積・按分係数）
 *   §2 条文書き下しオラクル（2項1号〜3号を独立に実装して、コアの選択が適法かを判定）
 *   §3 全域照合（面積・評価額を格子状に振り、全探索の最大値をコアが下回らないこと）
 *   §4 手計算の鎖（看板例。貸付を選ぶと730平方メートルの完全併用が消える）
 *   §5 単調性（面積・評価額が増えて減額が減ることはない）
 *   §6 国税庁 No.4124 の明文との照合（730平方メートル・各区分の限度面積と割合）
 *   §7 データ⇔ページの結合とカナリア
 *   §8 ページ要素の名指し照合（主張が1回だけ現れる要素を名指しする）
 */
import { readFileSync } from "node:fs";
import { calcShokibo, checkGendoMenseki } from "../docs/assets/shokibo_takuchi_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/shokibo_takuchi_r08.json", import.meta.url)));
const PAGE = readFileSync(new URL("../docs/shokibo-takuchi/index.html", import.meta.url), "utf8");
/** タグを空白に置換した本文（属性値ごと消える点に注意して使う）。 */
const visible = PAGE.replace(/<[^>]+>/g, " ");

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);
const near = (name, got, want, tol) => ok(`${name}（got=${got} want=${want}）`, Math.abs(got - want) <= tol);

const K = (key) => D.kubun.find((k) => k.key === key);
const lot = (area, value) => ({ area, value });

// ────────────────────────────────────────────────────────────────────────────
// §1 データの自己整合
// ────────────────────────────────────────────────────────────────────────────
// ★条文は「課税価格に算入すべき価額は…百分の二十（五十）を乗じて計算した金額」と書いている。
//   画面が使うのは減額割合80％・50％なので、両方を持たせたうえで和が100であることを固定する
//   （片方だけ直して整合が崩れると、算入割合と減額割合が別々の嘘をつく）。
for (const k of D.kubun) {
  eq(`§1 ${k.key} 算入＋減額＝100`, k.sannyu_pct + k.genzoku_pct, 100);
  ok(`§1 ${k.key} 限度面積が正の数`, typeof k.limit_m2 === "number" && k.limit_m2 > 0);
}
eq("§1 特定事業用等の限度面積（2項1号）", K("jigyo").limit_m2, 400);
eq("§1 特定居住用の限度面積（2項2号）", K("jutaku").limit_m2, 330);
eq("§1 貸付事業用の限度面積（2項3号）", K("kashitsuke").limit_m2, 200);
eq("§1 特定事業用等の減額割合（1項1号 百分の二十）", K("jigyo").genzoku_pct, 80);
eq("§1 特定居住用の減額割合（1項1号 百分の二十）", K("jutaku").genzoku_pct, 80);
eq("§1 貸付事業用の減額割合（1項2号 百分の五十）", K("kashitsuke").genzoku_pct, 50);
eq("§1 按分の予算（2項3号 二百平方メートル）", D.heiyo.budget_m2, 200);
ok("§1 2項3号イの係数は400分の200", D.heiyo.jigyo_coef[0] === 200 && D.heiyo.jigyo_coef[1] === 400);
ok("§1 2項3号ロの係数は330分の200", D.heiyo.jutaku_coef[0] === 200 && D.heiyo.jutaku_coef[1] === 330);
// ★係数の分母は、その区分の限度面積と一致していなければならない（条文の構造そのもの）。
eq("§1 3号イの分母＝特定事業用等の限度面積", D.heiyo.jigyo_coef[1], K("jigyo").limit_m2);
eq("§1 3号ロの分母＝特定居住用の限度面積", D.heiyo.jutaku_coef[1], K("jutaku").limit_m2);
eq("§1 3号イ・ロの分子＝貸付事業用の限度面積", D.heiyo.jigyo_coef[0], K("kashitsuke").limit_m2);
eq("§1 完全併用の合計＝400＋330", D.heiyo.kanzen_heiyo_total_m2, K("jigyo").limit_m2 + K("jutaku").limit_m2);

// ────────────────────────────────────────────────────────────────────────────
// §2 条文書き下しオラクル（措法69条の4第2項を、コアを見ずに独立実装する）
// ────────────────────────────────────────────────────────────────────────────
/**
 * 2項の限度面積要件を条文の文言どおりに判定する（コアの checkGendoMenseki とは独立の実装）。
 *   1号 特定事業用等宅地等 …… 面積の合計が400平方メートル以下
 *   2号 特定居住用宅地等 …… 面積の合計が330平方メートル以下
 *   3号 貸付事業用宅地等 …… イ（特定事業用等×400分の200）＋ロ（特定居住用×330分の200）＋ハ（貸付）が200以下
 * ★3号は「貸付事業用宅地等である選択特例対象宅地等」がある場合の要件なので、
 *   貸付を1平方メートルも選ばなければ発動しない。
 */
function oracleFeasible(a, b, c) {
  const E = 1e-9;
  if (c > 0) return a * (200 / 400) + b * (200 / 330) + c <= 200 + E;
  return a <= 400 + E && b <= 330 + E;
}
/** 減額額を条文どおりに出す（価額×選択割合×減額割合、円未満切捨て）。 */
function oracleGenkaku(lots, a, b, c) {
  const f = (l, sel, pct) => (l.area > 0 && sel > 0 ? Math.floor(l.value * Math.min(sel / l.area, 1) * pct / 100) : 0);
  return f(lots.jigyo, a, 80) + f(lots.jutaku, b, 80) + f(lots.kashitsuke, c, 50);
}

// オラクルとコアの判定が一致すること（境界を含めて総当たり）
{
  let mismatch = 0, n = 0;
  for (const a of [0, 1, 199, 200, 399.999, 400, 400.001, 500]) {
    for (const b of [0, 1, 329.999, 330, 330.001, 400]) {
      for (const c of [0, 0.001, 100, 199.999, 200, 200.001]) {
        n++;
        const mine = oracleFeasible(a, b, c);
        const core = checkGendoMenseki({ jigyo: a, jutaku: b, kashitsuke: c }, D).ok;
        if (mine !== core) mismatch++;
      }
    }
  }
  eq(`§2 限度面積の判定がオラクルと一致（${n}通り）`, mismatch, 0);
}
// ★境界そのもの: 400＋330＝730 は「貸付を選ばなければ」適法、貸付を1平方メートル足すと違法になる。
ok("§2 730平方メートルは貸付を選ばなければ適法", checkGendoMenseki({ jigyo: 400, jutaku: 330, kashitsuke: 0 }, D).ok);
ok("§2 730平方メートルに貸付1平方メートルを足すと不適法",
  !checkGendoMenseki({ jigyo: 400, jutaku: 330, kashitsuke: 1 }, D).ok);
ok("§2 貸付200ちょうどは適法", checkGendoMenseki({ jigyo: 0, jutaku: 0, kashitsuke: 200 }, D).ok);
ok("§2 貸付200.001は不適法", !checkGendoMenseki({ jigyo: 0, jutaku: 0, kashitsuke: 200.001 }, D).ok);
// ★3号の式は1号・2号を含む: 事業用401は3号の下では枠を超える（401×0.5＝200.5＞200）。
ok("§2 3号の下で事業用401は不適法", !checkGendoMenseki({ jigyo: 401, jutaku: 0, kashitsuke: 0.001 }, D).ok);

// ────────────────────────────────────────────────────────────────────────────
// §3 全域照合 — コアの配分が「適法」かつ「全探索の最大値以上」であること
// ────────────────────────────────────────────────────────────────────────────
// ★最適化は黙って間違える典型（もっともらしい配分を出すが最大ではない）。
//   粗い格子で全探索した最大値を下回らないことを、面積・単価を振って確かめる。
{
  const AREAS = [0, 50, 120, 200, 330, 400, 600];
  const UNITS = [0, 50000, 200000, 300000, 600000, 1000000];
  let cases = 0, infeasible = 0, suboptimal = 0, worstGap = 0;
  const STEP = 10; // 格子の刻み（平方メートル）

  for (const aA of AREAS) for (const aB of [0, 100, 330, 500]) for (const aC of [0, 80, 200, 400]) {
    for (const uA of [200000, 600000]) for (const uB of UNITS) for (const uC of [100000, 500000, 1000000]) {
      const lots = {
        jigyo: lot(aA, aA * uA),
        jutaku: lot(aB, aB * uB),
        kashitsuke: lot(aC, aC * uC),
      };
      if (aA + aB + aC === 0) continue;
      const r = calcShokibo(lots, D);
      if (!r.ok) continue;
      cases++;

      // (1) コアが選んだ配分は条文の限度面積要件を満たしているか（オラクルで独立に判定）
      const s = r.select;
      if (!oracleFeasible(s.jigyo, s.jutaku, s.kashitsuke)) infeasible++;

      // (2) 格子全探索の最大値を下回っていないか
      let bestGrid = 0;
      for (let a = 0; a <= Math.min(aA, 400); a += STEP) {
        for (let b = 0; b <= Math.min(aB, 330); b += STEP) {
          for (let c = 0; c <= Math.min(aC, 200); c += STEP) {
            if (!oracleFeasible(a, b, c)) continue;
            const g = oracleGenkaku(lots, a, b, c);
            if (g > bestGrid) bestGrid = g;
          }
        }
      }
      // 端（面積いっぱい）は格子から漏れるので、端の組み合わせも足して比べる
      for (const a of [Math.min(aA, 400), 0]) for (const b of [Math.min(aB, 330), 0]) for (const c of [Math.min(aC, 200), 0]) {
        if (!oracleFeasible(a, b, c)) continue;
        const g = oracleGenkaku(lots, a, b, c);
        if (g > bestGrid) bestGrid = g;
      }
      if (r.reduction < bestGrid - 1) { suboptimal++; worstGap = Math.max(worstGap, bestGrid - r.reduction); }
    }
  }
  ok(`§3 全域照合を実行した（${cases}通り。0件なら網が張れていない）`, cases > 200);
  eq("§3 コアの配分がすべて条文の限度面積を満たす", infeasible, 0);
  eq(`§3 コアの減額が全探索の最大値を下回らない（最大差 ¥${worstGap}）`, suboptimal, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// §4 手計算の鎖（看板例）
// ────────────────────────────────────────────────────────────────────────────
// ★看板: 事業用400平方メートル8,000万円（単価20万円）＋自宅330平方メートル9,900万円（単価30万円）
//   ＋貸付200平方メートル1億円（単価50万円）
//   案①貸付を選ばない → 400＋330＝730平方メートルを完全併用
//        6,400万円（8,000万×80％）＋7,920万円（9,900万×80％）＝1億4,320万円
//   案②貸付を選ぶ（3号） → 枠200。枠あたりの減額額は 自宅39.6万 ＞ 事業32万 ＞ 貸付25万 なので
//        自宅330平方メートル（330×200/330＝200＝枠を使い切る）だけが選ばれ 7,920万円
//   → 差 6,400万円。「貸付も特例に入れよう」とすると6,400万円損する。
{
  const lots = {
    jigyo: lot(400, 80000000),
    jutaku: lot(330, 99000000),
    kashitsuke: lot(200, 100000000),
  };
  const r = calcShokibo(lots, D);
  eq("§4 看板 特例前の合計評価額", r.totalValue, 279000000);
  eq("§4 看板 有利なのは貸付を選ばない案", r.pattern, "no_rental");
  eq("§4 看板 事業用の減額", r.breakdown.jigyo, 64000000);
  eq("§4 看板 自宅の減額", r.breakdown.jutaku, 79200000);
  eq("§4 看板 貸付の減額は0（選ばない）", r.breakdown.kashitsuke, 0);
  eq("§4 看板 減額の合計", r.reduction, 143200000);
  eq("§4 看板 特例適用後の価額", r.afterValue, 135800000);
  eq("§4 看板 選択面積の合計は730平方メートル", r.select.jigyo + r.select.jutaku, 730);
  eq("§4 看板 貸付を選ぶ案の減額", r.scenarios.withRental.reduction, 79200000);
  eq("§4 看板 貸付を選ぶことで失う額", r.kashitsukeCost, 64000000);
  ok("§4 看板 選んだ配分は条文の限度面積を満たす", r.check.ok);
  eq("§4 看板 適用された限度面積のルール", r.check.rule, "no_rental");
}
// ★逆向き: 単価の高い貸付は「選んだ方が得」になることもある（自宅を優先すればよいわけではない）。
//   自宅100平方メートル2,000万円（単価20万円）＋貸付200平方メートル1億2,000万円（単価60万円）
//   案① 自宅100だけ → 1,600万円
//   案② 枠200。枠あたり 貸付30万 ＞ 自宅26.4万 → 貸付200平方メートルで枠を使い切る → 6,000万円
{
  const lots = { jigyo: lot(0, 0), jutaku: lot(100, 20000000), kashitsuke: lot(200, 120000000) };
  const r = calcShokibo(lots, D);
  eq("§4 逆向き 有利なのは貸付を選ぶ案", r.pattern, "with_rental");
  eq("§4 逆向き 減額の合計", r.reduction, 60000000);
  eq("§4 逆向き 貸付の選択面積", r.select.kashitsuke, 200);
  eq("§4 逆向き 自宅の選択面積は0", r.select.jutaku, 0);
  eq("§4 逆向き 貸付を選ばない案の減額", r.scenarios.noRental.reduction, 16000000);
  ok("§4 逆向き 選んだ配分は条文の限度面積を満たす", r.check.ok);
  eq("§4 逆向き 適用された限度面積のルール", r.check.rule, "with_rental");
}
// ★併用の中身が混ざる例: 自宅165平方メートル（枠の半分＝100)＋貸付100平方メートル
//   自宅165×200/330＝100、貸付100×1＝100 → 合計200でちょうど枠に収まる。
{
  const lots = { jigyo: lot(0, 0), jutaku: lot(165, 33000000), kashitsuke: lot(100, 50000000) };
  const r = calcShokibo(lots, D);
  // 自宅の枠あたり減額 = 20万×0.8÷(200/330) = 26.4万 ／ 貸付 = 50万×0.5 = 25万 → 自宅が先
  eq("§4 混在 自宅を全部選ぶ", r.select.jutaku, 165);
  eq("§4 混在 残りの枠100を貸付に使う", Math.round(r.select.kashitsuke), 100);
  near("§4 混在 3号の式の値はちょうど200", r.check.value, 200, 1e-6);
  eq("§4 混在 減額＝自宅2,640万＋貸付2,500万", r.reduction, 26400000 + 25000000);
}
// ★端数（円未満切捨て）: 面積が限度を超えると割合按分になり、円未満の端数が出る。
//   自宅700㎡・評価額1,000万円 → 選べるのは330㎡だけ
//   → 10,000,000 × 330/700 × 80％ ＝ 3,771,428.571… → 切捨てて 3,771,428円。
//   ★この検査が無いと、すべての期待値が整数円になり、切上げに変えても検査が緑のままになる
//     （実際に壊しテストで素通しした。端数の出る例を1つ持つまで、丸めは守られていなかった）。
{
  const r = calcShokibo({ jigyo: lot(0, 0), jutaku: lot(700, 10000000), kashitsuke: lot(0, 0) }, D);
  eq("§4 端数 選べるのは330㎡だけ", r.select.jutaku, 330);
  eq("§4 端数 減額は円未満切捨て（切上げなら3,771,429）", r.reduction, 3771428);
  ok("§4 端数 切上げの値ではない", r.reduction !== 3771429);
}
// ★面積が限度に満たない場合は全部選べる（枠を余らせる）。
{
  const r = calcShokibo({ jigyo: lot(0, 0), jutaku: lot(100, 30000000), kashitsuke: lot(0, 0) }, D);
  eq("§4 小面積 自宅100平方メートルを全部選ぶ", r.select.jutaku, 100);
  eq("§4 小面積 減額＝3,000万×80％", r.reduction, 24000000);
  eq("§4 小面積 貸付がないので完全併用ルール", r.pattern, "no_rental");
}
// ★入力なし → 計算しない（0円と答えない）。
{
  const r = calcShokibo({ jigyo: lot(0, 0), jutaku: lot(0, 0), kashitsuke: lot(0, 0) }, D);
  eq("§4 入力なしは計算しない", r.ok, false);
  eq("§4 入力なしの理由", r.reason, "no_input");
}
// ★参照データなしは例外（黙って0で計算しない）。
{
  let threw = false;
  try { calcShokibo({ jutaku: lot(100, 10000000) }, null); } catch { threw = true; }
  ok("§4 参照データなしは例外", threw);
}

// ────────────────────────────────────────────────────────────────────────────
// §5 単調性
// ────────────────────────────────────────────────────────────────────────────
// ★評価額が増えて減額が減ることはない／面積が増えて減額が減ることもない（非減少）。
{
  let bad = 0, n = 0;
  for (let area = 10; area <= 500; area += 20) {
    for (let unit = 50000; unit <= 800000; unit += 150000) {
      const r1 = calcShokibo({ jigyo: lot(0, 0), jutaku: lot(area, area * unit), kashitsuke: lot(150, 150 * 300000) }, D);
      const r2 = calcShokibo({ jigyo: lot(0, 0), jutaku: lot(area + 20, (area + 20) * unit), kashitsuke: lot(150, 150 * 300000) }, D);
      const r3 = calcShokibo({ jigyo: lot(0, 0), jutaku: lot(area, area * (unit + 50000)), kashitsuke: lot(150, 150 * 300000) }, D);
      n += 2;
      if (r2.reduction < r1.reduction - 1) bad++;
      if (r3.reduction < r1.reduction - 1) bad++;
    }
  }
  eq(`§5 減額は面積・評価額に対して非減少（${n}件）`, bad, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// §6 国税庁 No.4124 の明文との照合（外部オラクル）
// ────────────────────────────────────────────────────────────────────────────
// ★国税庁の表は「（①＋②）≦400㎡・⑥≦330㎡・両方を選択する場合は合計730㎡」と明記している。
//   実装がこの730を再現すること（貸付なしのとき）。
{
  const r = calcShokibo({ jigyo: lot(500, 500 * 300000), jutaku: lot(500, 500 * 300000), kashitsuke: lot(0, 0) }, D);
  eq("§6 貸付なしのとき事業用は400で頭打ち", r.select.jigyo, 400);
  eq("§6 貸付なしのとき自宅は330で頭打ち", r.select.jutaku, 330);
  eq("§6 選択面積の合計は国税庁の明文どおり730", r.select.jigyo + r.select.jutaku, 730);
}
// ★国税庁の式「（①＋②）×200/400＋⑥×200/330＋（③＋④＋⑤）≦200㎡」を、貸付ありのケースで再現。
{
  const r = calcShokibo({ jigyo: lot(500, 500 * 300000), jutaku: lot(500, 500 * 300000), kashitsuke: lot(500, 500 * 900000) }, D);
  ok("§6 貸付ありの選択は3号の式を満たす", r.check.ok);
  near("§6 3号の式の値は枠200を超えない", Math.min(r.check.value, 200), 200, 1e-6);
}

// ────────────────────────────────────────────────────────────────────────────
// §7 データ⇔ページの結合とカナリア
// ────────────────────────────────────────────────────────────────────────────
// ★ページに書いた数値がデータと食い違ったら落とす（片方だけ直す事故を防ぐ）。
ok("§7 ページに400平方メートルがデータどおり出る", visible.includes(`${K("jigyo").limit_m2}平方メートル`) || visible.includes(`${K("jigyo").limit_m2}m`) || visible.includes(`${K("jigyo").limit_m2}㎡`));
ok("§7 ページに330平方メートルがデータどおり出る", visible.includes(`${K("jutaku").limit_m2}㎡`));
ok("§7 ページに200平方メートルがデータどおり出る", visible.includes(`${K("kashitsuke").limit_m2}㎡`));
ok("§7 ページに完全併用の730が出る", visible.includes(`${D.heiyo.kanzen_heiyo_total_m2}㎡`));
// ★カナリア: 見直し期限を過ぎたら赤くする（条文のmd5を取り直させる）。
{
  const today = process.env.SHOKIBO_TODAY || new Date().toISOString().slice(0, 10);
  ok(`§7 カナリア: next_review（${D._meta.next_review}）を過ぎていない。過ぎたら措法69条の4のmd5を取り直す`,
    today <= D._meta.next_review);
  ok("§7 next_review_reason に再取得の条件が書いてある", /md5/.test(D._meta.next_review_reason));
}
// ★この特例には適用期限がない。データが期限を持ち出したら、それは条文にない限定なので落とす。
ok("§7 適用期限を持たない（恒久措置）", !/"kigen"|"expire"/.test(JSON.stringify(D)));

// ────────────────────────────────────────────────────────────────────────────
// §8 ページ要素の名指し照合（規則3・5: 主張が1回だけ現れる最小の要素を名指しする）
// ────────────────────────────────────────────────────────────────────────────
/**
 * id を持つ要素の中身を取り出す（本文全体への正規表現は素通しするので使わない）。
 * ★入れ子のタグを数えて閉じタグまで進むこと。最初の `</` で切る素朴な実装は
 *   `<p id="x">…<b>強調</b>…</p>` の <b> の手前で止まり、主張の本体を読み落とす
 *   （＝検査が弱いのではなく、検査が要素を読めていない。実際にこれで5件の偽陽性を出した）。
 */
const byId = (id) => {
  const open = PAGE.match(new RegExp(`<([a-z0-9]+)([^>]*\\sid="${id}")[^>]*>`, "i"));
  if (!open) return null;
  const tag = open[1];
  let i = open.index + open[0].length;
  let depth = 1;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = i;
  let m;
  while ((m = re.exec(PAGE))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return PAGE.slice(i, m.index).replace(/<[^>]+>/g, " ");
  }
  return null;
};
// ★抽出器そのものの自己検査（規則2: 検査が常に null を返すなら、何を壊しても赤にならない）。
{
  const t = byId("heiyo-kanzen");
  ok("§8 抽出器が入れ子のタグを越えて要素の末尾まで読める",
    t !== null && t.includes("独立の枠") && t.includes("完全に併用") && t.includes("2項1号"));
}
// ★このツールの中心的な主張は「貸付を選ぶと730の完全併用が消える」。
//   この主張が本文で1回だけ現れる要素を名指しする（calloutの見出しごと名指しすると素通しする）。
{
  const t = byId("heiyo-kanzen");
  ok("§8 完全併用の主張が名指しの要素にある", t !== null);
  ok("§8 その要素が730を主張している", t !== null && t.includes("730"));
}
{
  const t = byId("heiyo-anbun");
  ok("§8 按分式の主張が名指しの要素にある", t !== null);
  ok("§8 その要素が200の枠を主張している", t !== null && t.includes("200"));
}
{
  const t = byId("shinkoku-hitsuyo");
  ok("§8 申告要件（7項）の主張が名指しの要素にある", t !== null);
  ok("§8 その要素が「0円でも申告」と主張している", t !== null && /0円/.test(t) && /申告/.test(t));
}
// ★家なき子の要件は6つ（条文のロは3つしか掲げていない）。数を機械で固定する。
{
  const ienakiko = D.yoken.jutaku_shutokusha.find((x) => x.key === "ienakiko");
  eq("§8 家なき子の要件はデータ上6つ", ienakiko.sub.length, 6);
  eq("§8 特定居住用の取得者の類型は4つ", D.yoken.jutaku_shutokusha.length, 4);
  // ★法の列挙は静的HTMLに置いてある（実行時描画にすると
  //   tests/test_enumeration_completeness.mjs の保護から黙って外れるため）。
  //   その代わり「静的HTML＝データ正本」をここで1文字ずつ固定し、2箇所が離れて腐るのを防ぐ。
  const listBox = byId("ienakiko-list");
  ok("§8 家なき子の一覧が名指しの要素として実在する", listBox !== null);
  let missing = 0;
  for (const s of ienakiko.sub) if (!listBox || !listBox.includes(s)) missing++;
  eq("§8 家なき子6要件がデータどおりページに載っている", missing, 0);
  eq("§8 一覧の項目数もデータと一致", (PAGE.match(/<ol id="ienakiko-list">([\s\S]*?)<\/ol>/) || ["", ""])[1].split("<li>").length - 1, ienakiko.sub.length);

  const shutokuBox = byId("jutaku-shutokusha");
  ok("§8 取得者の一覧が名指しの要素として実在する", shutokuBox !== null);
  let missing2 = 0;
  for (const s of D.yoken.jutaku_shutokusha) if (!shutokuBox || !shutokuBox.includes(s.name)) missing2++;
  eq("§8 取得者4類型がデータどおりページに載っている", missing2, 0);

  const homeBox = byId("home-list");
  let missing3 = 0;
  for (const s of D.yoken.roujin_home.jouken) if (!homeBox || !homeBox.includes(s)) missing3++;
  eq("§8 老人ホームの条件がデータどおりページに載っている", missing3, 0);
  ok("§8 空き家を貸すと対象外になることを書いている",
    (byId("home-jogai") || "").includes("事業の用"));

  // ★「など」「その他」で列挙を丸めていないこと（丸めた先にいちばん多い利用者が隠れる）
  for (const s of ienakiko.sub) {
    ok(`§8 家なき子の要件が「など」で丸められていない: ${s.slice(0, 12)}…`, !/など$|その他$/.test(s.trim()));
  }
  // ★「配偶者がいないこと」は家なき子で最も見落とされる要件。名指しで固定する。
  ok("§8 家なき子の要件に「被相続人に配偶者がいないこと」がある",
    listBox !== null && listBox.includes("被相続人に配偶者がいないこと"));
}
// ★3年縛りは事業用・貸付用で別のルール（年数は同じ3年だが例外が違う）。取り違えを落とす。
{
  eq("§8 3年以内事業宅地等の年数", D.yoken.sannen_jigyo.years, 3);
  eq("§8 3年以内貸付宅地等の年数", D.yoken.sannen_kashitsuke.years, 3);
  eq("§8 事業用の除外の例外は15％基準", D.yoken.sannen_jigyo.exception_pct, 15);
  ok("§8 貸付用の例外は特定貸付事業（15％基準ではない）",
    /特定貸付事業/.test(D.yoken.sannen_kashitsuke.exception) && !/15/.test(D.yoken.sannen_kashitsuke.exception));
  const t = byId("sannen-jigyo");
  ok("§8 事業用の3年縛りが名指しの要素にあり15％を主張", t !== null && t.includes("15"));
  const u = byId("sannen-kashitsuke");
  ok("§8 貸付用の3年縛りが名指しの要素にあり特定貸付事業を主張", u !== null && u.includes("特定貸付事業"));
}
// ★title と meta description も検査対象（規則9。タグ剥がしでは属性値ごと消えて漏れる）
{
  const title = (PAGE.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  ok(`§8 title が60字以内（${title.length}字）`, title.length > 0 && title.length <= 60);
  ok("§8 title に区分名が入っている", /小規模宅地/.test(title));
  const desc = (PAGE.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  ok("§8 meta description に330が入っている", desc.includes("330"));
  ok("§8 meta description に730が入っている", desc.includes("730"));
}

// ────────────────────────────────────────────────────────────────────────────
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
