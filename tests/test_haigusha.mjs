/**
 * 配偶者控除・配偶者特別控除（haigushaKojo / kyuyoToGokeiShotoku）のオラクル照合。
 *
 * 所得税: 国税庁No.1191（配偶者控除 2区分×3段）・No.1195（配偶者特別控除 9帯×3段）の
 *         「令和7年分以降」の表を**そのまま独立に書いて全数照合**する（計33値）。
 * 住民税: 地方税法314条の2第1項10号（配偶者控除 33/22/11万・老人38/26/13万）は条文の直書き値、
 *         10号の2（配偶者特別控除）は**条文の計算式そのもの**（≤100万→33万、100万超130万以下→
 *         38万−「93万1円を超える部分」の5万円刻み、>130万→3万、900万超の段は2/3・1/3の
 *         1万円未満切上げ）を独立実装してJSONの全帯・全段と照合する（期待値の二重管理でなく式で検算）。
 * 節税額: 速算表（国税庁No.2260）を手で当てた値で固定（test_fuyo と同じ流儀）。
 */
import { readFileSync } from "node:fs";
import { taxSavingSplit, haigushaKojo, kyuyoToGokeiShotoku } from "../docs/assets/setsuzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/setsuzei_r08.json", import.meta.url), "utf8"));
let fails = 0;
const eq = (got, want, msg) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✅" : "❌"} ${msg}${ok ? "" : `  期待 ${JSON.stringify(want)} / 実際 ${JSON.stringify(got)}`}`);
  if (!ok) fails++;
};

// ── 配偶者控除（所得税）: 国税庁No.1191の表の全数照合 ──
{
  const k = D.haigu.kojo;
  eq(k.ippan.shotoku, [380_000, 260_000, 130_000], "配偶者控除(所得税) 一般: 38/26/13万(No.1191)");
  eq(k.rojin.shotoku, [480_000, 320_000, 160_000], "配偶者控除(所得税) 老人: 48/32/16万(No.1191)");
  // 住民税: 地方税法314条の2①十イロハの直書き値
  eq(k.ippan.jumin, [330_000, 220_000, 110_000], "配偶者控除(住民税) 一般: 33/22/11万(地方税法314条の2①十)");
  eq(k.rojin.jumin, [380_000, 260_000, 130_000], "配偶者控除(住民税) 老人: 38/26/13万(同)");
  eq(D.haigu.income_limit, 580_000, "配偶者の所得要件58万円(令和7年分以後)");
  eq(D.haigu.income_limit_kyuyo, 1_230_000, "給与収入換算123万円(58万+給与所得控除の最低保障65万)");
  eq(D.haigu.tokubetsu_max, 1_330_000, "配偶者特別控除の上限133万円(No.1195)");
}

// ── 配偶者特別控除（所得税）: 国税庁No.1195「令和7年分以降」の表の全数照合（9帯×3段=27値） ──
{
  const NTA1195 = [
    // [over, upto, 900万以下, 900超950以下, 950超1000以下]
    [  580_000,   950_000, 380_000, 260_000, 130_000],
    [  950_000, 1_000_000, 360_000, 240_000, 120_000],
    [1_000_000, 1_050_000, 310_000, 210_000, 110_000],
    [1_050_000, 1_100_000, 260_000, 180_000,  90_000],
    [1_100_000, 1_150_000, 210_000, 140_000,  70_000],
    [1_150_000, 1_200_000, 160_000, 110_000,  60_000],
    [1_200_000, 1_250_000, 110_000,  80_000,  40_000],
    [1_250_000, 1_300_000,  60_000,  40_000,  20_000],
    [1_300_000, 1_330_000,  30_000,  20_000,  10_000],
  ];
  eq(D.haigu.tokubetsu_bands.length, 9, "配偶者特別控除: 9帯(No.1195)");
  NTA1195.forEach((row, i) => {
    const b = D.haigu.tokubetsu_bands[i];
    eq([b.over, b.upto, ...b.shotoku], row.slice(0, 5),
       `配特(所得税) 帯${i + 1} ${row[0] / 10000}万超${row[1] / 10000}万以下: ${row[2] / 10000}/${row[3] / 10000}/${row[4] / 10000}万`);
  });
}

// ── 配偶者特別控除（住民税）: 地方税法314条の2①十の2の**式**で全帯・全段を検算 ──
// イ(1) 配偶者所得≤100万 → 33万 / イ(2) 100万超130万以下 → 38万−(93万1円を超える部分の5万円刻み)
// / イ(3) 130万超 → 3万。ロ=イの2/3・ハ=イの1/3(いずれも1万円未満切上げ)。
{
  const band1 = (x) => {
    if (x <= 1_000_000) return 330_000;
    if (x > 1_300_000) return 30_000;
    const exceed = x - 930_001;               // 「93万1円を超える部分の金額」
    let v = 50_000 * Math.floor((exceed + 30_000) / 50_000) - 30_000; // 5万の整数倍−3万で exceed 以下の最大
    return 380_000 - v;
  };
  const ceil1man = (v, bunbo) => Math.ceil(v / (bunbo * 10_000)) * 10_000; // v/bunbo を1万円未満切上げ
  for (const [i, b] of D.haigu.tokubetsu_bands.entries()) {
    // 帯の中の代表点2つ(下端+1円・上端)で式の値が帯として一定で、JSONと一致すること
    for (const x of [b.over + 1, b.upto]) {
      const t1 = band1(x);
      const want = [t1, ceil1man(t1 * 2, 3), ceil1man(t1, 3)];
      eq(b.jumin, want, `配特(住民税) 帯${i + 1} x=${x.toLocaleString()}: 条文式 ${want.map(v => v / 10000).join("/")}万`);
    }
  }
}

// ── haigushaKojo: 種別と境界 ──
{
  const r = haigushaKojo({ honninShotoku: 6_000_000, haiguShotoku: 400_000 }, D);
  eq([r.type, r.shotoku, r.jumin], ["haigusha", 380_000, 330_000], "本人600万×配偶者所得40万: 配偶者控除38/33万");
}
{
  const r = haigushaKojo({ honninShotoku: 6_000_000, haiguShotoku: 400_000, rojin: true }, D);
  eq([r.type, r.shotoku, r.jumin], ["haigusha", 480_000, 380_000], "老人(70歳以上): 配偶者控除48/38万");
}
{
  const r = haigushaKojo({ honninShotoku: 9_000_001, haiguShotoku: 500_000, rojin: true }, D);
  eq([r.type, r.tier, r.shotoku, r.jumin], ["haigusha", 1, 320_000, 260_000], "本人900万超×老人: 32/26万(段2)");
}
{
  const r = haigushaKojo({ honninShotoku: 10_000_000, haiguShotoku: 580_000 }, D);
  eq([r.type, r.tier, r.shotoku, r.jumin], ["haigusha", 2, 130_000, 110_000], "本人ちょうど1,000万×配偶者58万: 13/11万(段3・両方とも境界の内側)");
}
{
  const r = haigushaKojo({ honninShotoku: 10_000_001, haiguShotoku: 400_000 }, D);
  eq([r.type, r.reason, r.shotoku + r.jumin], ["none", "honnin_over", 0], "本人1,000万超: 適用なし(理由を申告)");
}
{
  const r = haigushaKojo({ honninShotoku: 6_000_000, haiguShotoku: 580_001 }, D);
  eq([r.type, r.shotoku, r.jumin], ["tokubetsu", 380_000, 330_000], "配偶者58万+1円: 配特へ切替(38/33万・住民税は33万)");
}
{
  const r = haigushaKojo({ honninShotoku: 6_000_000, haiguShotoku: 1_050_000 }, D);
  eq([r.type, r.shotoku, r.jumin], ["tokubetsu", 310_000, 310_000], "配偶者105万: 配特31/31万");
}
{
  const a = haigushaKojo({ honninShotoku: 6_000_000, haiguShotoku: 1_000_000, rojin: true }, D);
  const b = haigushaKojo({ honninShotoku: 6_000_000, haiguShotoku: 1_000_000, rojin: false }, D);
  eq([a.type, a.shotoku, a.jumin, a.shotoku === b.shotoku && a.jumin === b.jumin],
     ["tokubetsu", 360_000, 330_000, true], "配特の帯では老人区分は無関係(36/33万)");
}
{
  const r = haigushaKojo({ honninShotoku: 9_800_000, haiguShotoku: 1_330_000 }, D);
  eq([r.type, r.shotoku, r.jumin], ["tokubetsu", 10_000, 10_000], "本人段3×配偶者ちょうど133万: 1/1万");
}
{
  const r = haigushaKojo({ honninShotoku: 6_000_000, haiguShotoku: 1_330_001 }, D);
  eq([r.type, r.reason], ["none", "haigu_over"], "配偶者133万超: 適用なし(理由を申告)");
}

// ── kyuyoToGokeiShotoku: 給与収入→合計所得(収入190万円以下のみ・No.1410の定額65万) ──
eq(kyuyoToGokeiShotoku(1_000_000, D), { ok: true, shotoku: 350_000 }, "給与100万 → 所得35万");
eq(kyuyoToGokeiShotoku(1_230_000, D), { ok: true, shotoku: 580_000 }, "給与123万 → 所得58万(配偶者控除の上限ちょうど)");
eq(kyuyoToGokeiShotoku(1_230_001, D), { ok: true, shotoku: 580_001 }, "給与123万+1円 → 配特の帯へ");
eq(kyuyoToGokeiShotoku(1_600_000, D), { ok: true, shotoku: 950_000 }, "給与160万 → 所得95万(配特38万の帯の上限)");
eq(kyuyoToGokeiShotoku(1_900_000, D), { ok: true, shotoku: 1_250_000 }, "給与190万 → 所得125万(定額65万の上限)");
eq(kyuyoToGokeiShotoku(1_900_001, D), { ok: false, reason: "over_limit" }, "給与190万超 → 換算しない(fail closed)");
eq(kyuyoToGokeiShotoku(500_000, D), { ok: true, shotoku: 0 }, "給与50万 → 所得0(マイナスにしない)");

// ── 節税額（速算表を手で当てた独立オラクル・taxSavingSplitとの結合） ──
// E2Eシーンのオラクル: 本人所得区分≤900万・配偶者給与170万(→所得105万・配特31/31万)・課税所得500万
//   before 5,000,000×20%−427,500 = 572,500 / after shotokuzei(4,690,000) = 510,500 → 所得税減62,000
//   復興 floor(62,000×2.1%) = 1,302 / 住民 31万×10% = 31,000 → 合計 94,302
{
  const conv = kyuyoToGokeiShotoku(1_700_000, D);
  const k = haigushaKojo({ honninShotoku: 9_000_000, haiguShotoku: conv.shotoku }, D);
  eq([k.type, k.shotoku, k.jumin], ["tokubetsu", 310_000, 310_000], "E2E前段: 給与170万→所得105万→配特31/31万");
  const r = taxSavingSplit({ kazeiShotoku: 5_000_000, shotokuKojo: k.shotoku, juminKojo: k.jumin }, D);
  eq([r.shotokuGen, r.fukkoGen, r.juminGen, r.total], [62_000, 1_302, 31_000, 94_302],
     "E2Eオラクル: 課税所得500万×配特31/31万 → 節税94,302");
}
// 配偶者控除(一般38/33)・課税所得500万 → 110,596(test_fuyoの一般1人と同額になるのが正しい)
{
  const k = haigushaKojo({ honninShotoku: 8_000_000, haiguShotoku: 0 }, D);
  const r = taxSavingSplit({ kazeiShotoku: 5_000_000, shotokuKojo: k.shotoku, juminKojo: k.jumin }, D);
  eq(r.total, 110_596, "配偶者控除38/33万×課税所得500万: 節税110,596");
}
// 老人配偶者(48/38)・課税所得300万: before 202,500 / after shotokuzei(2,520,000)=154,500 → 48,000
{
  const k = haigushaKojo({ honninShotoku: 5_000_000, haiguShotoku: 300_000, rojin: true }, D);
  const r = taxSavingSplit({ kazeiShotoku: 3_000_000, shotokuKojo: k.shotoku, juminKojo: k.jumin }, D);
  eq([r.shotokuGen, r.fukkoGen, r.juminGen, r.total], [48_000, 1_008, 38_000, 87_008],
     "老人配偶者48/38万×課税所得300万: 節税87,008");
}

// ── ページの「課税所得別の例」表の数値を固定（記事の数値と実装の照合） ──
const pageExample = (kazei, haiguShotoku) => {
  const k = haigushaKojo({ honninShotoku: 9_000_000, haiguShotoku }, D);
  return taxSavingSplit({ kazeiShotoku: kazei, shotokuKojo: k.shotoku, juminKojo: k.jumin }, D).total;
};
eq(pageExample(3_000_000, 0), 71_798, "例表: 300万×配偶者控除(38/33) = 71,798");
eq(pageExample(5_000_000, 0), 110_596, "例表: 500万×配偶者控除(38/33) = 110,596");
eq(pageExample(7_000_000, 0), 112_127, "例表: 700万×配偶者控除(38/33) = 112,127");
eq(pageExample(3_000_000, 1_050_000), 62_651, "例表: 300万×配特105万(31/31) = 62,651");
eq(pageExample(5_000_000, 1_050_000), 94_302, "例表: 500万×配特105万(31/31) = 94,302");
eq(pageExample(7_000_000, 1_050_000), 95_833, "例表: 700万×配特105万(31/31) = 95,833");

console.log(fails ? `\n❌ ${fails}件 失敗` : "\nall haigusha checks passed");
process.exit(fails ? 1 : 0);
