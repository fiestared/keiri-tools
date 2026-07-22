/**
 * 生命保険料控除（setsuzei_core.seimeiHokenryoKojo）の単体テスト。
 *
 * ★オラクルは「国税庁 令和8年分 給与所得者の保険料控除申告書」裏面の計算式Ⅰ・Ⅱ・Ⅲの書き方
 *   （支払額×1/2＋10,000円 …／80,001円以上は一律に40,000円）で独立に実装する。
 *   実装side は**条文の書き方**（「◯円と、合計額から△円を控除した金額のn分の1に相当する金額との
 *   合計額」＝ base+(x−minus)/div）で持っているので、2つは別の式の書き方になる。
 *   ここが揃わないと意味がない — 第3便(医療費控除)で「オラクル自身が実装と同じ速算式で書かれていて
 *   同じ誤りを共有していた」という素通しが実際に起きた。法の言い方をそのまま2通り持つこと。
 *
 * 一次情報:
 *   - 所得税法76条1項〜4項（e-Gov 令和8年12月1日施行版・逐語確認）
 *   - 地方税法314条の2第1項5号の2（同）
 *   - 租税特別措置法41条の15の5（年齢23歳未満の扶養親族を有する場合の生命保険料控除の特例）
 *   - 国税庁 令和8年分 給与所得者の保険料控除申告書（端数は切り上げ・計算式Ⅰ〜Ⅲ）
 */
import { readFileSync } from "node:fs";
import { seimeiHokenryoKojo } from "../docs/assets/setsuzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/setsuzei_r08.json", import.meta.url), "utf8"));

let ng = 0, n = 0;
const eq = (label, got, want) => {
  n++;
  if (got !== want) { ng++; console.error(`  NG ${label}: got ${got} / want ${want}`); }
};

// ── オラクル（申告書 裏面の計算式の書き方をそのまま） ───────────────────────────
const up = (x) => Math.ceil(x); // 1円未満の端数は切り上げ
// 計算式Ⅰ（新保険料等用）
const shikiI = (a) =>
  a <= 20000 ? a :
  a <= 40000 ? up(a * 1 / 2 + 10000) :
  a <= 80000 ? up(a * 1 / 4 + 20000) : 40000;
// 計算式Ⅱ（年齢23歳未満の扶養親族を有する場合の新保険料等用）
const shikiII = (a) =>
  a <= 30000 ? a :
  a <= 60000 ? up(a * 1 / 2 + 15000) :
  a <= 120000 ? up(a * 1 / 4 + 30000) : 60000;
// 計算式Ⅲ（旧保険料等用）
const shikiIII = (b) =>
  b <= 25000 ? b :
  b <= 50000 ? up(b * 1 / 2 + 12500) :
  b <= 100000 ? up(b * 1 / 4 + 25000) : 50000;
// 住民税（地方税法314条の2第1項5号の2。申告書の書き方に合わせて同じ形で書く）
const juminShin = (a) =>
  a <= 12000 ? a :
  a <= 32000 ? up(a * 1 / 2 + 6000) :
  a <= 56000 ? up(a * 1 / 4 + 14000) : 28000;
const juminKyu = (b) =>
  b <= 15000 ? b :
  b <= 40000 ? up(b * 1 / 2 + 7500) :
  b <= 70000 ? up(b * 1 / 4 + 17500) : 35000;

const calc = (input) => seimeiHokenryoKojo(input, D);
const cat = (r, side, key) => r[side].items.find((i) => i.key === key);

// ── 1. 各計算式の全数照合（1円刻み・境目の前後を含む） ────────────────────────
// 介護医療（新のみ・特例なし）を通して計算式Ⅰを、一般の旧のみを通して計算式Ⅲを見る。
for (let a = 0; a <= 130000; a++) {
  const r = calc({ kaigo: a });
  if (cat(r, "shotoku", "kaigo").amount !== shikiI(a)) {
    ng++; n++; console.error(`  NG 計算式Ⅰ a=${a}: got ${cat(r, "shotoku", "kaigo").amount} / want ${shikiI(a)}`);
    break;
  }
  if (cat(r, "jumin", "kaigo").amount !== juminShin(a)) {
    ng++; n++; console.error(`  NG 住民税(新) a=${a}: got ${cat(r, "jumin", "kaigo").amount} / want ${juminShin(a)}`);
    break;
  }
}
n += 2; console.log("  計算式Ⅰ・住民税(新) を 0〜130,000円 の1円刻みで全数照合");

for (let b = 0; b <= 130000; b++) {
  const r = calc({ ippan_kyu: b });
  if (cat(r, "shotoku", "ippan").amount !== shikiIII(b)) {
    ng++; n++; console.error(`  NG 計算式Ⅲ b=${b}: got ${cat(r, "shotoku", "ippan").amount} / want ${shikiIII(b)}`);
    break;
  }
  if (cat(r, "jumin", "ippan").amount !== juminKyu(b)) {
    ng++; n++; console.error(`  NG 住民税(旧) b=${b}: got ${cat(r, "jumin", "ippan").amount} / want ${juminKyu(b)}`);
    break;
  }
}
n += 2; console.log("  計算式Ⅲ・住民税(旧) を 0〜130,000円 の1円刻みで全数照合");

// 計算式Ⅱ（特例）— 一般の新契約だけに効く
for (let a = 0; a <= 130000; a++) {
  const r = calc({ ippan_shin: a, tokurei: true });
  if (cat(r, "shotoku", "ippan").amount !== shikiII(a)) {
    ng++; n++; console.error(`  NG 計算式Ⅱ a=${a}: got ${cat(r, "shotoku", "ippan").amount} / want ${shikiII(a)}`);
    break;
  }
  // ★住民税に特例は無い（地方税法に読替え規定が無い）。特例の帯で計算したら落ちる。
  if (cat(r, "jumin", "ippan").amount !== juminShin(a)) {
    ng++; n++; console.error(`  NG 住民税は特例なし a=${a}: got ${cat(r, "jumin", "ippan").amount} / want ${juminShin(a)}`);
    break;
  }
}
n += 2; console.log("  計算式Ⅱ(特例) を 0〜130,000円 の1円刻みで全数照合＋住民税に特例が及ばないことを固定");

// ── 2. 端数の切り上げ（切り捨て・四捨五入だと落ちる） ─────────────────────────
eq("新21,001円 → 20,501円(切り上げ)", cat(calc({ kaigo: 21001 }), "shotoku", "kaigo").amount, 20501);
eq("新40,001円 → 30,001円(切り上げ)", cat(calc({ kaigo: 40001 }), "shotoku", "kaigo").amount, 30001);
eq("新40,002円 → 30,001円(切り上げ)", cat(calc({ kaigo: 40002 }), "shotoku", "kaigo").amount, 30001);
eq("旧25,001円 → 25,001円(切り上げ)", cat(calc({ ippan_kyu: 25001 }), "shotoku", "ippan").amount, 25001);

// ── 3. 特例は「一般の新契約」だけ。介護医療・個人年金・旧契約には及ばない ───────
eq("特例あり: 介護医療10万は 40,000のまま", cat(calc({ kaigo: 100000, tokurei: true }), "shotoku", "kaigo").amount, 40000);
eq("特例あり: 個人年金(新)10万は 40,000のまま", cat(calc({ nenkin_shin: 100000, tokurei: true }), "shotoku", "nenkin").amount, 40000);
eq("特例あり: 一般(旧)15万は 50,000のまま", cat(calc({ ippan_kyu: 150000, tokurei: true }), "shotoku", "ippan").amount, 50000);
eq("特例なし: 一般(新)10万は 40,000", cat(calc({ ippan_shin: 100000 }), "shotoku", "ippan").amount, 40000);
eq("特例あり: 一般(新)10万は 55,000", cat(calc({ ippan_shin: 100000, tokurei: true }), "shotoku", "ippan").amount, 55000);

// ── 4. 新旧併用（所法76条1項1〜3号）— 旧のみ と 合算 の大きい方 ────────────────
// 国税庁No.1140の言い方: 旧の支払額が60,000円を**超える**なら旧のみ(最高5万)、60,000円以下なら合算(最高4万)。
{
  // 旧70,000（→旧のみ42,500）＋新80,000（→40,000）: 合算は上限40,000なので旧のみが勝つ
  const r = calc({ ippan_shin: 80000, ippan_kyu: 70000 });
  eq("併用 旧70,000超 → 旧のみ42,500", cat(r, "shotoku", "ippan").amount, 42500);
  eq("併用 旧70,000超 → method=kyu_only", cat(r, "shotoku", "ippan").method, "kyu_only");
}
{
  // 旧60,000（→旧のみ40,000）＋新80,000（→40,000）: 合算も40,000（上限）→ 同額なので合算を採る
  const r = calc({ ippan_shin: 80000, ippan_kyu: 60000 });
  eq("併用 旧ちょうど60,000 → 40,000", cat(r, "shotoku", "ippan").amount, 40000);
  eq("併用 旧ちょうど60,000 → method=heiyo", cat(r, "shotoku", "ippan").method, "heiyo");
}
{
  // 旧20,000（→20,000）＋新20,000（→20,000）: 合算40,000（上限ちょうど）
  const r = calc({ ippan_shin: 20000, ippan_kyu: 20000 });
  eq("併用 少額どうし → 合算40,000", cat(r, "shotoku", "ippan").amount, 40000);
}
{
  // ★特例あり: 合算の上限が60,000になるので、旧のみ(最高50,000)が勝つことは無くなる
  const r = calc({ ippan_shin: 120000, ippan_kyu: 120000, tokurei: true });
  eq("特例＋併用 → 合算上限60,000", cat(r, "shotoku", "ippan").amount, 60000);
  eq("特例＋併用 → method=heiyo", cat(r, "shotoku", "ippan").method, "heiyo");
  // ★住民税には特例が無いので、住民税側は「旧のみ35,000 > 合算の上限28,000」で**旧のみ**が勝つ。
  //   （所得税は特例で合算が有利になり、住民税は旧のみが有利 — 同じ入力で税ごとに採り方が変わる）
  eq("特例＋併用 住民税は旧のみ35,000", cat(r, "jumin", "ippan").amount, 35000);
  eq("特例＋併用 住民税は method=kyu_only", cat(r, "jumin", "ippan").method, "kyu_only");
}
// 住民税で「旧のみ」に切り替わる境目は旧42,000円（27,500+(x−40,000)/4 が 28,000 を超える点）。
// 所得税の60,000円とは違う — 税ごとに帯も上限も違うので、境目を所得税から借りてくると間違える。
eq("住民税 旧42,000 → 合算28,000", cat(calc({ ippan_shin: 60000, ippan_kyu: 42000 }), "jumin", "ippan").amount, 28000);
eq("住民税 旧42,001 → 旧のみ28,001", cat(calc({ ippan_shin: 60000, ippan_kyu: 42001 }), "jumin", "ippan").amount, 28001);

// ── 5. 合計の上限（所得税12万円・住民税7万円）— 特例でも変わらない ───────────────
{
  const r = calc({ ippan_shin: 100000, kaigo: 100000, nenkin_shin: 100000 });
  eq("3区分満額 所得税の合計 120,000", r.shotoku.total, 120000);
  // ★特例が無ければ 40,000×3＝120,000 が上限ちょうどで、頭打ちは**起きない**。
  //   capped は「上限で切られた」ことだけを名乗る（ちょうど到達を「切られた」と言わない）。
  eq("3区分満額 所得税は切られていない(ちょうど到達)", r.shotoku.capped, false);
  // 住民税は 28,000×3=84,000 → 上限70,000
  eq("3区分満額 住民税の合計 70,000", r.jumin.total, 70000);
  eq("3区分満額 住民税は上限に当たった", r.jumin.capped, true);
}
{
  // ★特例があっても合計の上限12万円は据え置き（所法76条4項は読替えの対象外）
  const r = calc({ ippan_shin: 150000, kaigo: 100000, nenkin_shin: 100000, tokurei: true });
  eq("特例あり 単純合計は140,000", r.shotoku.sum, 140000);
  eq("特例あり 合計は120,000で頭打ち", r.shotoku.total, 120000);
}
{
  // 上限に当たっていないときは capped=false（黙って上限を名乗らない）
  const r = calc({ ippan_shin: 20000 });
  eq("少額 合計20,000", r.shotoku.total, 20000);
  eq("少額 上限には当たっていない", r.shotoku.capped, false);
}

// ── 6. 入力なし・不正入力（NaNを素通しして合計をNaNにしない） ────────────────────
{
  const r = calc({});
  eq("未入力 所得税0", r.shotoku.total, 0);
  eq("未入力 住民税0", r.jumin.total, 0);
}
{
  const r = calc({ ippan_shin: "あ", kaigo: -5000, nenkin_shin: null });
  eq("不正入力でも0", r.shotoku.total, 0);
}

// ── 7. 参照データを渡さなければ計算しない（fail closed） ──────────────────────
{
  let threw = false;
  try { seimeiHokenryoKojo({ ippan_shin: 50000 }, null); } catch { threw = true; }
  eq("データ無しは例外(fail closed)", threw, true);
}

// ── 8. 代表例（画面に出す数値例と同じもの） ─────────────────────────────────
{
  // 一般(新)60,000＋介護医療40,000＋個人年金(新)80,000
  //   所得税: 35,000＋30,000＋40,000 = 105,000
  //   住民税: 28,000＋24,000＋28,000 = 80,000 → 上限70,000
  const r = calc({ ippan_shin: 60000, kaigo: 40000, nenkin_shin: 80000 });
  eq("代表例 所得税の控除 105,000", r.shotoku.total, 105000);
  eq("代表例 住民税の控除 70,000(上限)", r.jumin.total, 70000);
  eq("代表例 住民税の単純合計 80,000", r.jumin.sum, 80000);
}

console.log(ng === 0 ? `OK 生命保険料控除 ${n}項目` : `NG ${ng}/${n}`);
process.exit(ng === 0 ? 0 : 1);
