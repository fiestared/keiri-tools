/**
 * 固定資産税・都市計画税の計算コアの検査。
 *
 * 守りたいのは、画面が正常に見えたまま黙って誤答する4つの急所:
 *   ① 小規模住宅用地の200㎡は「1戸あたり」（戸数を落とすと集合住宅で数倍の誤り）
 *   ② 住宅用地は家屋の床面積の10倍まで（広い土地で過小に答える）
 *   ③ 固定資産税と都市計画税で特例の割合が違う（都計税が半分になる）
 *   ④ 新築住宅の減額は固定資産税だけ・居住部分120㎡相当分まで
 *
 * 検査の作り:
 *   §1 定数の自己整合（条文の値そのもの）
 *   §2 条文書き下しオラクル（コアを見ずに独立実装して全域で突き合わせる）
 *   §3 外部オラクル（東京都主税局の計算例の数字を再現する）
 *   §4 手計算の鎖（看板例）
 *   §5 免税点・端数処理・納期分割
 *   §6 単調性（評価額・面積が増えて税額が減ることはない）
 *   §7 ページ要素の名指し照合（規則3〜5。主張が1回だけ現れる要素を名指しする）
 */
import { readFileSync } from "node:fs";
import {
  SEIDO, SHINCHIKU_KUBUN, calcLandBase, calcKoteiShisanzei,
  splitByTerms, truncTo, shinchikuEligibility,
} from "../docs/assets/kotei_shisanzei_core.js";

const PAGE = readFileSync(new URL("../docs/kotei-shisanzei/index.html", import.meta.url), "utf8");
/** タグを空白に置換した本文（属性値ごと消える点に注意して使う）。 */
const visible = PAGE.replace(/<[^>]+>/g, " ");

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);
const near = (name, got, want, tol) => ok(`${name}（got=${got} want=${want}）`, Math.abs(got - want) <= tol);

/** 既定の入力（各検査はここから必要な項目だけ差し替える）。 */
const base = {
  landValue: 18000000, landArea: 150, isResidential: true, units: 1,
  houseValue: 8000000, houseFloorArea: 100,
  shinchiku: "none", koteiRate: 1.4, toshiRate: 0.3,
};
const IN = (over) => ({ ...base, ...over });

// ────────────────────────────────────────────────────────────────────────────
// §1 定数の自己整合（条文の値）
// ────────────────────────────────────────────────────────────────────────────
eq("§1 固定資産税の標準税率（法350条1項）", SEIDO.koteiStandardRate, 1.4);
eq("§1 都市計画税の制限税率（法702条の4）", SEIDO.toshiMaxRate, 0.3);
eq("§1 小規模住宅用地の面積（法349条の3の2第2項）", SEIDO.shoukiboM2PerUnit, 200);
near("§1 小規模の固定資産税の割合＝6分の1", SEIDO.shoukiboKotei, 1 / 6, 1e-12);
near("§1 一般の固定資産税の割合＝3分の1", SEIDO.ippanKotei, 1 / 3, 1e-12);
near("§1 小規模の都市計画税の割合＝3分の1", SEIDO.shoukiboToshi, 1 / 3, 1e-12);
near("§1 一般の都市計画税の割合＝3分の2", SEIDO.ippanToshi, 2 / 3, 1e-12);
eq("§1 住宅用地は床面積の10倍まで（令52条の11）", SEIDO.floorAreaMultiplier, 10);
eq("§1 免税点 土地30万円（法351条）", SEIDO.menzeitenLand, 300000);
eq("§1 免税点 家屋20万円（法351条）", SEIDO.menzeitenHouse, 200000);
eq("§1 新築減額の上限120㎡（令附則12条4項2号）", SEIDO.shinchikuCapM2, 120);
eq("§1 課税標準額の切捨て単位（法20条の4の2第1項）", SEIDO.kazeiHyojunUnit, 1000);
eq("§1 確定税額の切捨て単位（同3項）", SEIDO.zeigakuUnit, 100);
// ★都市計画税の特例は固定資産税の「ちょうど2倍」の割合になっている（1/3 vs 1/6・2/3 vs 1/3）。
//   ここが崩れたら、どちらかの条文を取り違えている。
near("§1 都計の小規模は固定の2倍", SEIDO.shoukiboToshi / SEIDO.shoukiboKotei, 2, 1e-12);
near("§1 都計の一般は固定の2倍", SEIDO.ippanToshi / SEIDO.ippanKotei, 2, 1e-12);

// 新築の区分は4つ＋「該当しない」。年数は 3/5/5/7（法附則15条の6・15条の7）。
eq("§1 新築の区分は5つ（該当しないを含む）", SHINCHIKU_KUBUN.length, 5);
eq("§1 一般の新築住宅は3年度分", SHINCHIKU_KUBUN.find((k) => k.key === "ippan").years, 3);
eq("§1 中高層耐火建築物は5年度分", SHINCHIKU_KUBUN.find((k) => k.key === "chukoso").years, 5);
eq("§1 認定長期優良住宅は5年度分", SHINCHIKU_KUBUN.find((k) => k.key === "chouki").years, 5);
eq("§1 長期優良×中高層は7年度分", SHINCHIKU_KUBUN.find((k) => k.key === "chouki_chukoso").years, 7);
// ★申告要件があるのは長期優良の2つだけ（15条の7第3項）。15条の6には申告要件が無い。
ok("§1 申告要件は長期優良の2区分だけ",
  SHINCHIKU_KUBUN.filter((k) => k.moushide).map((k) => k.key).join(",") === "chouki,chouki_chukoso");

// ────────────────────────────────────────────────────────────────────────────
// §2 条文書き下しオラクル（コアと独立に実装して全域で突き合わせる）
// ────────────────────────────────────────────────────────────────────────────
/** 法349条の3の2・702条の3・令52条の11 をそのまま書き下したもの。 */
function oracleLand(landValue, landArea, isResidential, units, floor) {
  if (!isResidential || landArea <= 0) return { kotei: Math.floor(landValue), toshi: Math.floor(landValue) };
  const unitPrice = landValue / landArea;
  const jutaku = floor > 0 ? Math.min(landArea, floor * 10) : 0; // 床面積の10倍まで
  const hijutaku = landArea - jutaku;
  const shoukibo = Math.min(jutaku, 200 * units);                // 200㎡ × 住居の数
  const ippan = jutaku - shoukibo;
  return {
    kotei: Math.floor(unitPrice * (shoukibo / 6 + ippan / 3 + hijutaku)),
    toshi: Math.floor(unitPrice * (shoukibo / 3 + ippan * 2 / 3 + hijutaku)),
  };
}

{
  let mismatch = 0;
  for (const landValue of [0, 250000, 3000000, 18000000, 120000000]) {
    for (const landArea of [30, 150, 200, 201, 600, 1500]) {
      for (const units of [1, 2, 6]) {
        for (const floor of [0, 40, 100, 300]) {
          for (const isResidential of [true, false]) {
            const got = calcLandBase({ landValue, landArea, isResidential, units, houseFloorArea: floor });
            const want = oracleLand(landValue, landArea, isResidential, units, floor);
            // ★許容差1円: コアは「面積×(1/6)」、オラクルは「面積÷6」で書いており、
            //   2進浮動小数では最終桁が1円ずれることがある（制度の違いではない）。
            //   割合や条文を取り違えれば差は桁で出るので、1円の窓では隠れない。
            if (Math.abs(got.koteiBase - Math.max(0, want.kotei)) > 1) mismatch++;
            else if (got.koteiBase > 0 && Math.abs(got.toshiBase - Math.max(0, want.toshi)) > 1) mismatch++;
          }
        }
      }
    }
  }
  eq("§2 全域（720通り）で条文書き下しと一致", mismatch, 0);
}

// ★戸数を落とすオラクル（＝よくある実装の誤り）とは、集合住宅で必ず食い違うこと。
//   一致してしまうなら、コアが戸数を見ていない（検査がザルである）。
{
  const withUnits = calcLandBase({ landValue: 60000000, landArea: 600, isResidential: true, units: 6, houseFloorArea: 300 });
  const wrong = oracleLand(60000000, 600, true, 1, 300);
  ok("§2 戸数を1に落とすと課税標準が変わる（＝戸数を見ている）", withUnits.koteiBase !== Math.floor(wrong.kotei));
  eq("§2 6戸なら600㎡すべてが小規模住宅用地", withUnits.shoukiboM2, 600);
  eq("§2 6戸なら一般住宅用地は0㎡", withUnits.ippanM2, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// §3 外部オラクル（東京都主税局の計算例）
// ────────────────────────────────────────────────────────────────────────────
// 都主税局の小規模住宅用地の例: 都市計画税の課税標準額 15,000,000円 → 当初税額 45,000円（0.3％）。
// 評価額45,000,000円の小規模住宅用地なら課税標準は 1/3 = 15,000,000円 になるはず。
{
  const r = calcKoteiShisanzei(IN({
    landValue: 45000000, landArea: 150, units: 1, houseValue: 0, houseFloorArea: 100,
  }));
  eq("§3 都主税局の例 都計の課税標準額15,000,000円", r.landToshiBase, 15000000);
  eq("§3 都主税局の例 都計の当初税額45,000円", r.landToshi, 45000);
  // 同じ土地の固定資産税は 1/6 = 7,500,000円 → 1.4% = 105,000円
  eq("§3 同じ土地の固定の課税標準額7,500,000円", r.landKoteiBase, 7500000);
  eq("§3 同じ土地の固定資産税105,000円", r.landKotei, 105000);
}

// ────────────────────────────────────────────────────────────────────────────
// §4 手計算の鎖（看板例）
// ────────────────────────────────────────────────────────────────────────────
{
  // 土地1,800万円・150㎡（住宅1戸）→ 全部が小規模。固定 1,800万÷6=300万 → 42,000円
  //                                          都計 1,800万÷3=600万 → 18,000円
  // 家屋800万円・100㎡ → 固定 112,000円／都計 24,000円
  const r = calcKoteiShisanzei(IN({}));
  eq("§4 土地の固定資産税", r.landKotei, 42000);
  eq("§4 土地の都市計画税", r.landToshi, 18000);
  eq("§4 家屋の固定資産税", r.houseKotei, 112000);
  eq("§4 家屋の都市計画税", r.houseToshi, 24000);
  eq("§4 合計", r.total, 42000 + 18000 + 112000 + 24000);
  ok("§4 本則で計算したことを申告している", r.honsoku === true);
}

{
  // 200㎡を超える土地（1戸・300㎡・3,000万円 → 単価10万円/㎡）
  // 小規模200㎡: 2,000万÷6 = 3,333,333 ／ 一般100㎡: 1,000万÷3 = 3,333,333
  const r = calcKoteiShisanzei(IN({ landValue: 30000000, landArea: 300, houseFloorArea: 100, houseValue: 0 }));
  eq("§4 小規模は200㎡", r.land.shoukiboM2, 200);
  eq("§4 一般は100㎡", r.land.ippanM2, 100);
  eq("§4 固定の課税標準額（1,000円未満切捨て）", r.landKoteiBase, 6666000);
  eq("§4 固定資産税（100円未満切捨て）", r.landKotei, truncTo(6666000 * 0.014, 100));
}

{
  // 床面積の10倍の制限: 床面積40㎡の家に土地1,000㎡ → 住宅用地は400㎡だけ
  const r = calcKoteiShisanzei(IN({ landValue: 50000000, landArea: 1000, houseFloorArea: 40, houseValue: 0 }));
  eq("§4 住宅用地は床面積の10倍＝400㎡", r.land.jutakuM2, 400);
  eq("§4 残り600㎡は特例なし", r.land.hijutakuM2, 600);
  ok("§4 10倍で切られたことを申告している", r.land.cappedByFloorArea === true);
}

// 新築住宅の減額（固定資産税だけ・120㎡まで）
{
  const noRed = calcKoteiShisanzei(IN({ shinchiku: "none" }));
  const red = calcKoteiShisanzei(IN({ shinchiku: "ippan" }));
  eq("§4 新築減額 家屋の固定資産税が半分", red.houseKotei, noRed.houseKotei - Math.floor(noRed.houseKotei / 2));
  eq("§4 新築減額でも都市計画税は変わらない", red.houseToshi, noRed.houseToshi);
  eq("§4 新築減額でも土地の税額は変わらない", red.landKotei, noRed.landKotei);
  ok("§4 減額額が正の数", red.genkaku > 0);
}
{
  // 床面積200㎡（居住部分200㎡）→ 減額されるのは120/200＝60％分だけ
  const r = calcKoteiShisanzei(IN({ houseValue: 20000000, houseFloorArea: 200, shinchiku: "ippan" }));
  near("§4 減額対象は120/200＝0.6", r.shinchikuShare, 0.6, 1e-12);
  eq("§4 120㎡相当分の2分の1だけ減額", r.genkaku, Math.floor(r.houseKoteiBefore * 0.6 * 0.5));
  ok("§4 全額の半分より小さい", r.genkaku < r.houseKoteiBefore / 2);
}
{
  // 床面積要件（令附則12条3項1号）の外は減額しない。理由を必ず持たせる。
  const small = shinchikuEligibility("ippan", 30);
  ok("§4 床面積30㎡は対象外", small.ok === false && small.reason.includes("40"));
  const big = shinchikuEligibility("ippan", 300);
  ok("§4 床面積300㎡は対象外", big.ok === false && big.reason.includes("240"));
  const r = calcKoteiShisanzei(IN({ houseFloorArea: 300, shinchiku: "ippan" }));
  eq("§4 対象外なら減額0円", r.genkaku, 0);
  ok("§4 対象外の理由が空でない", r.shinchiku.reason.length > 0);
}

// ────────────────────────────────────────────────────────────────────────────
// §5 免税点・端数処理・納期分割
// ────────────────────────────────────────────────────────────────────────────
{
  // 特例適用「後」の課税標準額で判定する（法351条）。
  // 土地180万円・150㎡・住宅用地 → 1/6 = 30万円 ちょうど＝免税点以上（「満たない場合」課税されない）
  const just = calcKoteiShisanzei(IN({ landValue: 1800000, houseValue: 0 }));
  eq("§5 課税標準30万円ちょうどは課税される", just.landTaxable, true);
  const under = calcKoteiShisanzei(IN({ landValue: 1799994, houseValue: 0 }));
  eq("§5 30万円未満は課税されない", under.landTaxable, false);
  eq("§5 免税点未満なら固定資産税0円", under.landKotei, 0);
  eq("§5 免税点未満なら都市計画税も0円（法702条の8）", under.landToshi, 0);
  // ★特例前の評価額（179万円）は30万円を超えている＝「評価額で判定」する実装なら課税されてしまう
  ok("§5 判定に使うのは特例後の額（評価額ではない）", 1799994 > SEIDO.menzeitenLand);
}
{
  const r = calcKoteiShisanzei(IN({ landValue: 0, houseValue: 199999, houseFloorArea: 50 }));
  eq("§5 家屋20万円未満は課税されない", r.houseTaxable, false);
  eq("§5 家屋の税額0円", r.houseKotei, 0);
}
eq("§5 課税標準額は1,000円未満切捨て", truncTo(1234567, 1000), 1234000);
eq("§5 税額は100円未満切捨て", truncTo(12345, 100), 12300);
{
  // 法20条の4の2第6項: 1,000円未満の端数は最初の納期に合算する（均等割りしない）
  const s = splitByTerms(45600, 4);
  eq("§5 第2〜4期は1,000円単位", s.other, 11000);
  eq("§5 端数は第1期に合算", s.first, 45600 - 11000 * 3);
  eq("§5 分割の合計は年税額と一致", s.first + s.other * 3, 45600);
}

// ────────────────────────────────────────────────────────────────────────────
// §6 単調性（増えて減ることはない）
// ────────────────────────────────────────────────────────────────────────────
{
  let bad = 0;
  let prev = -1;
  for (const v of [0, 1000000, 5000000, 18000000, 50000000, 200000000]) {
    const r = calcKoteiShisanzei(IN({ landValue: v }));
    if (r.total < prev) bad++;
    prev = r.total;
  }
  eq("§6 評価額が増えて税額が減らない", bad, 0);
}
{
  // 戸数が増えると（小規模の枠が広がるので）税額は減るか同じ
  let bad = 0;
  let prev = Infinity;
  for (const u of [1, 2, 3, 6, 12]) {
    const r = calcKoteiShisanzei(IN({ landValue: 60000000, landArea: 600, units: u, houseFloorArea: 300, houseValue: 0 }));
    if (r.total > prev) bad++;
    prev = r.total;
  }
  eq("§6 戸数が増えて税額が増えない", bad, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// §7 ページ要素の名指し照合（規則3〜5）
// ────────────────────────────────────────────────────────────────────────────
/**
 * id を名指しして、その要素の中身（タグ剥がし後）を返す。
 * ★閉じタグを「(p|b|span|…) のどれか」で探すと、要素の中に <b> があるだけで
 *   そこで切れて主張の後半が消える（実際にこの検査で最初に踏んだ）。
 *   **id が載っているタグ名を取り、その閉じタグまで**を取る。
 */
const byId = (id) => {
  const m = PAGE.match(new RegExp(`<([a-z]+)[^>]*\\sid="${id}"[^>]*>`));
  if (!m) return null;
  const tag = m[1];
  const start = m.index + m[0].length;
  const end = PAGE.indexOf(`</${tag}>`, start);
  return end < 0 ? null : PAGE.slice(start, end).replace(/<[^>]+>/g, " ");
};

{
  // ① 戸数の主張（この主張が1回だけ現れる最小の要素まで下ろす）
  const t = byId("kosuu-jouban");
  ok("§7 戸数の条文引用が名指しの要素にあり「住居の数」を主張", t !== null && t.includes("住居の数"));
  ok("§7 同要素が200㎡×戸数を主張", t !== null && t.includes("200㎡に住居の数を乗じて"));
}
{
  // ② 床面積の10倍
  const t = byId("juubai-honbun");
  ok("§7 10倍の主張が名指しの要素にある", t !== null && t.includes("10倍"));
  ok("§7 同要素が施行令52条の11を出典に挙げている", t !== null && t.includes("52条の11"));
}
{
  // ③ 固定と都計で割合が違うこと（表の行を名指し）
  const tbl = byId("warai-table");
  ok("§7 割合の表に小規模の6分の1がある", tbl !== null && tbl.includes("6分の1"));
  ok("§7 割合の表に都計の3分の2がある", tbl !== null && tbl.includes("3分の2"));
}
{
  // ④ 新築減額は固定資産税だけ・120㎡まで
  const t = byId("shinchiku-kotei-nomi");
  ok("§7 新築減額が固定資産税だけであることを名指しの要素が主張",
    t !== null && t.includes("都市計画税は減額されません"));
  ok("§7 同要素が120㎡を主張", t !== null && t.includes("120㎡"));
  const m = byId("chouki-moushide");
  ok("§7 長期優良の申告要件が名指しの要素にある", m !== null && m.includes("1月31日"));
}
{
  // ⑤ 負担調整措置を範囲外だと申告している（黙って本則を答えとして出さない）
  const t = byId("futan-chosei");
  ok("§7 負担調整措置の説明が名指しの要素にある", t !== null && t.includes("前年度の課税標準額"));
  const h = byId("honsoku-caution");
  ok("§7 本則で計算する旨の警告が名指しの要素にある", h !== null && h.includes("本則"));
}
{
  // ⑥ 免税点・端数処理
  const t = byId("menzeiten-honbun");
  ok("§7 免税点の主張が名指しの要素にある", t !== null && t.includes("30万円") && t.includes("20万円"));
  const h = byId("hasuu");
  ok("§7 端数処理の主張が名指しの要素にある", h !== null && h.includes("1,000円未満") && h.includes("100円未満"));
}
{
  // ⑦ ページの数字がコアの定数と一致していること（手書きで食い違わせない）
  // ★規則3: 「本文のどこかに1.4％がある」で見てはいけない。FAQの答えにも例示にも同じ語があるので、
  //   税率の主張だけを壊しても素通しする（壊しテストで実際に素通しした）。要素を名指しする。
  const z = byId("zeiritsu-honbun");
  ok("§7 本文の税率がコアと一致（1.4％）", z !== null && z.includes(`標準税率${SEIDO.koteiStandardRate}％`));
  ok("§7 本文の制限税率がコアと一致（0.3％）", z !== null && z.includes(`制限税率${SEIDO.toshiMaxRate}％`));
  ok("§7 本文の新築期限がコアと一致", visible.includes(SEIDO.shinchikuKigen));
  const yoken = byId("shinchiku-yoken");
  ok("§7 床面積要件がコアの定数と一致",
    yoken !== null && yoken.includes(`${SEIDO.shinchikuMinM2}㎡以上${SEIDO.shinchikuMaxM2}㎡以下`));
}
{
  // ⑧ title と meta description（規則9。タグ剥がしでは属性値ごと消えて漏れる）
  const title = (PAGE.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  ok(`§7 title が60字以内（${title.length}字）`, title.length > 0 && title.length <= 60);
  ok("§7 title に固定資産税が入っている", /固定資産税/.test(title));
  const desc = (PAGE.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  ok("§7 meta description に戸数の話が入っている", desc.includes("住居1戸あたり"));
  ok("§7 meta description に120㎡が入っている", desc.includes("120㎡"));
}
{
  // ⑨ 計測タグと canonical（新規ページで最も落としやすい）
  ok("§7 GA4 のローダーが1文字列で入っている", PAGE.includes("gtag/js?id=G-E742DSDHPD"));
  ok("§7 AdSense スニペットがある", PAGE.includes("ca-pub-2635067516563578"));
  ok("§7 canonical が正しい", PAGE.includes('rel="canonical" href="https://keiri-tools.com/kotei-shisanzei/"'));
}

// ────────────────────────────────────────────────────────────────────────────
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
