/**
 * 扶養控除の節税額（taxSavingSplit / fuyoKojoTotal）のオラクル照合。
 *
 * 控除額は一次照合済みの条文値を独立に書く:
 *   所得税: 一般38万・特定63万・老人48万・同居老親等58万（所法84条＋措法41の16。
 *           令和8年12月施行の改正法(令和8年法12号)の条文と逐語一致＝令和8年分の変更なし）
 *   住民税: 一般33万・特定45万・老人38万・同居老親等45万（地方税法314条の2①十一・④）
 * 節税額は「速算表(国税庁No.2260)を手で当てた差＋復興2.1%＋住民税控除×10%」を手計算で固定する。
 * ★扶養控除は所得税と住民税で控除額が違う — taxSaving(同額前提)で住民税を出すと過大になる。
 */
import { readFileSync } from "node:fs";
import { taxSavingSplit, fuyoKojoTotal } from "../docs/assets/setsuzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/setsuzei_r08.json", import.meta.url), "utf8"));
let fails = 0;
const eq = (got, want, msg) => {
  const ok = got === want;
  console.log(`${ok ? "✅" : "❌"} ${msg}${ok ? "" : `  期待 ${want} / 実際 ${got}`}`);
  if (!ok) fails++;
};

// ── 控除額の正本(JSON)が条文値と一致していること（区分×所得税/住民税の8値を全数照合） ──
{
  const k = Object.fromEntries(D.fuyo.kubun.map((x) => [x.key, x]));
  eq(k.ippan.shotoku, 380_000, "一般: 所得税38万(所法84条)");
  eq(k.ippan.jumin, 330_000, "一般: 住民税33万(地方税法314条の2①十一)");
  eq(k.tokutei.shotoku, 630_000, "特定: 所得税63万(所法84条)");
  eq(k.tokutei.jumin, 450_000, "特定: 住民税45万(地方税法314条の2①十一)");
  eq(k.rojin.shotoku, 480_000, "老人: 所得税48万(所法84条)");
  eq(k.rojin.jumin, 380_000, "老人: 住民税38万(地方税法314条の2①十一)");
  eq(k.dokyo_rojin.shotoku, 580_000, "同居老親等: 所得税58万(48万+措法41の16の10万加算)");
  eq(k.dokyo_rojin.jumin, 450_000, "同居老親等: 住民税45万(地方税法314条の2④)");
  eq(D.fuyo.income_limit, 620_000, "扶養親族の所得要件62万円(所法2条①34号・令和8年12月1日施行版で逐語確認・令和8年分以後)");
  eq(D.fuyo.income_limit_kyuyo, 1_360_000, "給与収入換算136万円(62万+給与所得控除74万=措法29条の4・令和8・9年分)");
}

// ── fuyoKojoTotal: 区分×人数の合算 ──
{
  const r = fuyoKojoTotal({ ippan: 1 }, D);
  eq(r.shotoku, 380_000, "一般1人: 所得税控除38万");
  eq(r.jumin, 330_000, "一般1人: 住民税控除33万");
  eq(r.count, 1, "一般1人: 人数1");
}
{
  const r = fuyoKojoTotal({ ippan: 2, dokyo_rojin: 1 }, D);
  eq(r.shotoku, 1_340_000, "一般2+同居老親1: 所得税控除 38万×2+58万 = 134万");
  eq(r.jumin, 1_110_000, "一般2+同居老親1: 住民税控除 33万×2+45万 = 111万");
  eq(r.count, 3, "一般2+同居老親1: 人数3");
}
{
  const r = fuyoKojoTotal({ ippan: -1, tokutei: NaN }, D);
  eq(r.shotoku, 0, "負数・NaNの人数は0扱い(NaNを素通しして節税額をNaNにしない)");
  eq(r.count, 0, "負数・NaNの人数: 人数0");
}

// ── taxSavingSplit: 節税額（速算表を手で当てた独立オラクル） ──
// 課税所得500万・一般1人(38万/33万):
//   before 5,000,000×20%−427,500 = 572,500 / after shotokuzei(4,620,000) = 496,500 → 所得税減76,000
{
  const r = taxSavingSplit({ kazeiShotoku: 5_000_000, shotokuKojo: 380_000, juminKojo: 330_000 }, D);
  eq(r.shotokuGen, 76_000, "500万×一般1: 所得税減 76,000");
  eq(r.fukkoGen, 1_596, "500万×一般1: 復興 floor(76,000×2.1%) = 1,596");
  eq(r.juminGen, 33_000, "500万×一般1: 住民税減 33万×10% = 33,000(38万×10%ではない)");
  eq(r.total, 110_596, "500万×一般1: 節税額合計 110,596");
}
// ブラケットまたぎ: 課税所得340万・特定1人(63万/45万)。20%帯→10%帯へまたぐ。
//   before 3,400,000×20%−427,500 = 252,500 / after shotokuzei(2,770,000) = 179,500 → 73,000
//   （「63万×20% = 126,000」と答えたら誤り。速算表の差でしか出ない）
{
  const r = taxSavingSplit({ kazeiShotoku: 3_400_000, shotokuKojo: 630_000, juminKojo: 450_000 }, D);
  eq(r.shotokuGen, 73_000, "340万×特定1(またぎ): 所得税減 73,000(63万×20%=126,000ではない)");
  eq(r.fukkoGen, 1_533, "340万×特定1: 復興 floor(73,000×2.1%) = 1,533");
  eq(r.juminGen, 45_000, "340万×特定1: 住民税減 45,000");
  eq(r.total, 119_533, "340万×特定1: 節税額合計 119,533");
}
// 複数区分: 課税所得800万・一般1+同居老親1(96万/78万)
//   before 8,000,000×23%−636,000 = 1,204,000 / after shotokuzei(7,040,000) = 983,200 → 220,800
{
  const t = fuyoKojoTotal({ ippan: 1, dokyo_rojin: 1 }, D);
  const r = taxSavingSplit({ kazeiShotoku: 8_000_000, shotokuKojo: t.shotoku, juminKojo: t.jumin }, D);
  eq(r.shotokuGen, 220_800, "800万×一般1+同居老親1: 所得税減 220,800");
  eq(r.fukkoGen, 4_636, "800万×一般1+同居老親1: 復興 floor(220,800×2.1%) = 4,636");
  eq(r.juminGen, 78_000, "800万×一般1+同居老親1: 住民税減 78,000");
  eq(r.total, 303_436, "800万×一般1+同居老親1: 節税額合計 303,436");
}
// E2Eシーンと同じ入力: 課税所得500万・一般1+特定1(101万/78万)
//   before 572,500 / after shotokuzei(3,990,000) = 370,500 → 202,000
{
  const t = fuyoKojoTotal({ ippan: 1, tokutei: 1 }, D);
  const r = taxSavingSplit({ kazeiShotoku: 5_000_000, shotokuKojo: t.shotoku, juminKojo: t.jumin }, D);
  eq(r.total, 284_242, "500万×一般1+特定1: 節税額合計 284,242(E2Eシーンのオラクル)");
}
// 課税所得0 → 節税額0
{
  const r = taxSavingSplit({ kazeiShotoku: 0, shotokuKojo: 380_000, juminKojo: 330_000 }, D);
  eq(r.total, 0, "課税所得0 → 節税額0");
}
// 低所得クランプ: 課税所得30万・特定1人 → 控除は課税所得の範囲でしか効かない
//   所得税 before 15,000 → after 0 = 15,000 / 住民税 min(45万,30万)×10% = 30,000
{
  const r = taxSavingSplit({ kazeiShotoku: 300_000, shotokuKojo: 630_000, juminKojo: 450_000 }, D);
  eq(r.usedShotoku, 300_000, "低所得: 使える所得税控除は課税所得まで(30万)");
  eq(r.usedJumin, 300_000, "低所得: 住民税側も課税所得まででクランプ");
  eq(r.shotokuGen, 15_000, "低所得: 所得税減 15,000");
  eq(r.juminGen, 30_000, "低所得: 住民税減 30,000(45万×10%ではない)");
  eq(r.total, 45_315, "低所得: 節税額合計 45,315");
}

// ── ページの「課税所得別の例」表の数値を固定（記事の数値と実装の照合。表が正本JSONとずれたら赤） ──
const pageExample = (kazei, counts) => {
  const t = fuyoKojoTotal(counts, D);
  return taxSavingSplit({ kazeiShotoku: kazei, shotokuKojo: t.shotoku, juminKojo: t.jumin }, D).total;
};
eq(pageExample(2_000_000, { ippan: 1 }), 54_951, "例表: 200万×一般1 = 54,951");
eq(pageExample(3_000_000, { ippan: 1 }), 71_798, "例表: 300万×一般1 = 71,798");
eq(pageExample(5_000_000, { ippan: 1 }), 110_596, "例表: 500万×一般1 = 110,596");
eq(pageExample(7_000_000, { ippan: 1 }), 112_127, "例表: 700万×一般1 = 112,127");
eq(pageExample(9_000_000, { ippan: 1 }), 122_235, "例表: 900万×一般1 = 122,235");
eq(pageExample(3_000_000, { tokutei: 1 }), 109_323, "例表: 300万×特定1 = 109,323");
eq(pageExample(5_000_000, { tokutei: 1 }), 173_646, "例表: 500万×特定1 = 173,646");
eq(pageExample(4_000_000, { dokyo_rojin: 1 }), 163_436, "例表: 400万×同居老親1 = 163,436");

console.log(fails ? `\n❌ ${fails}件 失敗` : "\nall fuyo checks passed");
process.exit(fails ? 1 : 0);
