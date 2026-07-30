/**
 * 不動産の仲介手数料（宅建業者が受け取れる報酬の上限）の計算コアの検査。
 *
 * 守りたいのは、画面が正常に見えたまま黙って誤答する急所:
 *   ① 代金の額に消費税等相当額を含めない（新築・業者売主で上限を過大に出す）
 *   ② 「3%＋6万円」は本体（税抜）＝告示の表は税込率。二重に1.1を掛けない
 *   ③ 代理は「常に2倍」ではない（相手方からの媒介報酬との合計も2倍以内）
 *   ④ 低廉な空家等の特例は「800万円以下なら33万円」ではない（合意が要る／800万円ちょうどでは上がらない）
 *   ⑤ 貸借の1.1か月分は「双方の合計」。居住用は承諾がなければ一方から0.55か月分まで
 *   ⑥ 権利金の特例は居住用の建物には使えない
 *
 * 検査の作り:
 *   §1 データJSONの定数が告示の値と一致する（自己整合）
 *   §2 外部オラクル（国土交通省の公表資料の上限額＝200万/400万/800万で本体10万/18万/30万）
 *   §3 速算式と区分合計の一致（全域スイープ）
 *   §4 消費税等相当額の除外（同じ総額で、建物に消費税が乗る場合と乗らない場合の対で見る）
 *   §5 代理（第三）とただし書
 *   §6 低廉な空家等（境界・合意の有無を対で見る）
 *   §7 貸借（合計と一方・居住用と非居住用・承諾の有無・権利金）
 *   §8 fail closed（期間外・未入力・データなし）
 *   §9 単調性（代金が増えて上限が減ることはない）
 */
import { readFileSync } from "node:fs";
import {
  calc, calcBaibai, calcTaishaku, baibaiKijun, baibaiSokusan, daikinNuki, shohizeiBun,
} from "../docs/assets/chukai_core.js";

const DATA = JSON.parse(
  readFileSync(new URL("../docs/assets/chukai_r08.json", import.meta.url), "utf8")
);

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);

const HI = "2026-07-30"; // 収録期間内の日付
const baibai = (over = {}) =>
  calcBaibai({ sogakuZeikomi: 30000000, tatemonoZeikomi: 0, tachiba: "baikai", hidzuke: HI, ...over }, DATA);
const taishaku = (over = {}) =>
  calcTaishaku({ yachinZeikomi: 100000, isKyojuyo: true, tachiba: "baikai", hidzuke: HI, ...over }, DATA);

// ───────────────────────── §1 データJSONの定数が告示の値と一致する
{
  const b = DATA.baibai.bands;
  eq("§1 区分は3つ", b.length, 3);
  eq("§1 第1区分の上限は200万円", b[0].ika, 2000000);
  eq("§1 第1区分は5.5%", b[0].ritsu, 0.055);
  eq("§1 第2区分は200万円超400万円以下", `${b[1].koeru}-${b[1].ika}`, "2000000-4000000");
  eq("§1 第2区分は4.4%", b[1].ritsu, 0.044);
  eq("§1 第3区分は400万円超で上限なし", b[2].ika, null);
  eq("§1 第3区分は3.3%", b[2].ritsu, 0.033);
  eq("§1 代理は2倍（第三）", DATA.dairi.bai, 2);
  eq("§1 低廉な空家等の対象は800万円以下（第七）", DATA.akiya.jogen_kagaku, 8000000);
  eq("§1 低廉な空家等の上限は30万円の1.1倍＝33万円", DATA.akiya.jogen_hoshu, 330000);
  eq("§1 30万円×1.1が33万円であること", Math.round(DATA.akiya.jogen_hoshu_hontai * 1.1), 330000);
  eq("§1 貸借の合計は1.1倍（第四）", DATA.taishaku.gokei_bairitsu, 1.1);
  eq("§1 居住用の一方は0.55倍（第四後段）", DATA.taishaku.kyojuyo_ippo_bairitsu, 0.55);
  eq("§1 権利金の特例は居住用を除く（第六）", DATA.kenrikin.kyojuyo_jogai, true);
  eq("§1 収録開始日は令和6年7月1日（改正告示の施行日）", DATA._meta.applies_from, "2024-07-01");
  ok("§1 収録範囲外が理由つきで列挙されている",
    Array.isArray(DATA.out_of_scope) && DATA.out_of_scope.length >= 3 &&
    DATA.out_of_scope.every((o) => o.name && o.riyu && o.riyu.length > 30));
  ok("§1 長期の空家等が範囲外として名指しされている",
    DATA.out_of_scope.some((o) => o.key === "choki_akiya_taishaku"));
  ok("§1 免税事業者が範囲外として名指しされている",
    DATA.out_of_scope.some((o) => o.key === "menzei_jigyosha"));
}

// ───────────────────────── §2 外部オラクル
// 国土交通省「空き家等に係る媒介報酬規制の見直し」の上限額グラフに公表された3点:
//   物件価格 200万円 → 10万円×1.1 ／ 400万円 → 18万円×1.1 ／ 800万円 → 30万円×1.1
// 自分の算数ではなく、国が公表した金額で区分計算が正しいことを固定する。
{
  const oracle = [
    { daikin: 2000000, hontai: 100000, zeikomi: 110000 },
    { daikin: 4000000, hontai: 180000, zeikomi: 198000 },
    { daikin: 8000000, hontai: 300000, zeikomi: 330000 },
  ];
  for (const o of oracle) {
    const r = baibaiKijun(o.daikin, DATA);
    eq(`§2 代金${o.daikin / 10000}万円の本体（国交省公表）`, r.hontai, o.hontai);
    eq(`§2 代金${o.daikin / 10000}万円の税込（国交省公表）`, r.zeikomi, o.zeikomi);
  }
  // ★800万円ちょうどで、原則の計算額と低廉な空家等の特例の上限が一致する（告示の設計）。
  eq("§2 800万円では原則の額＝特例の上限（33万円）",
    baibaiKijun(8000000, DATA).zeikomi, DATA.akiya.jogen_hoshu);
}

// ───────────────────────── §3 速算式と区分合計の一致（全域スイープ）
{
  let mismatch = 0;
  for (let d = 4010000; d <= 200000000; d += 10000) {
    const kubun = baibaiKijun(d, DATA);
    const s = baibaiSokusan(d, DATA);
    if (!s || s.hontai !== kubun.hontai) mismatch++;
  }
  eq("§3 400万円超の全域で 3%＋6万円＝区分合計（本体）", mismatch, 0);
  eq("§3 400万円以下では速算式を使わない", baibaiSokusan(4000000, DATA), null);
  // ②二重課税の防止: 税込率で出した額に、さらに1.1を掛けていないこと。
  const r = baibaiKijun(30000000, DATA);
  eq("§3 3,000万円の本体は96万円", r.hontai, 960000);
  eq("§3 3,000万円の税込は105.6万円（96万×1.1）", r.zeikomi, 1056000);
  ok("§3 税込が本体の1.1倍を超えない", r.zeikomi <= Math.ceil(r.hontai * 1.1));
}

// ───────────────────────── §4 消費税等相当額の除外
// 同じ総額4,000万円でも、建物2,200万円に消費税が含まれる（業者売主・新築）なら
// 代金の額は3,800万円になり、上限は66,000円下がる。
{
  eq("§4 税込2,200万円に含まれる消費税は200万円", shohizeiBun(22000000, DATA), 2000000);
  const d = daikinNuki(40000000, 22000000, DATA);
  eq("§4 総額4,000万円・建物税込2,200万円の代金の額は3,800万円", d.daikin, 38000000);

  const kojin = baibai({ sogakuZeikomi: 40000000, tatemonoZeikomi: 0 });      // 個人間売買（消費税なし）
  const gyosha = baibai({ sogakuZeikomi: 40000000, tatemonoZeikomi: 22000000 }); // 業者売主（建物に消費税）
  eq("§4 消費税なしの上限", kojin.jogen, 1386000);
  eq("§4 建物に消費税があるときの上限", gyosha.jogen, 1320000);
  ok("§4 消費税を除くと上限は下がる（過大請求の向きを固定）", gyosha.jogen < kojin.jogen);
  eq("§4 差は66,000円", kojin.jogen - gyosha.jogen, 66000);
  ok("§4 消費税を除いたことが画面の注意書きに出る",
    gyosha.chuui.some((c) => c.includes("消費税") && c.includes("除いた")));
  // 土地だけ（建物0）なら総額がそのまま代金の額。
  eq("§4 土地のみは総額＝代金の額", daikinNuki(10000000, 0, DATA).daikin, 10000000);
  // 建物価格が総額を超える入力は総額でクランプする（負の代金を作らない）。
  eq("§4 建物価格が総額超でも代金は0以上", daikinNuki(10000000, 99999999, DATA).daikin >= 0, true);
}

// ───────────────────────── §5 代理（第三）
{
  const b = baibai({ tachiba: "baikai" });
  const d = baibai({ tachiba: "dairi" });
  eq("§5 代理の上限は媒介の2倍", d.jogen, b.jogen * 2);
  eq("§5 3,000万円の代理は211.2万円", d.jogen, 2112000);
  ok("§5 相手方からも報酬を受けるときは合計2倍の制限を告げる",
    baibai({ tachiba: "dairi", aiteHoshu: true }).chuui.some((c) => c.includes("2倍") && c.includes("超えてはなり")));
  ok("§5 相手方から満額受けた場合の残りを金額で示す",
    baibai({ tachiba: "dairi", aiteHoshu: true }).chuui.some((c) => c.includes("1,056,000円までです")));
}

// ───────────────────────── §6 低廉な空家等の特例（第七・第八）
{
  // 500万円: 原則 200万×5.5%+200万×4.4%+100万×3.3% = 110,000+88,000+33,000 = 231,000
  const gensoku = baibai({ sogakuZeikomi: 5000000 });
  eq("§6 500万円の原則の上限", gensoku.jogen, 231000);
  ok("§6 800万円以下なら特例の対象だと知らせる", gensoku.akiyaTaisho === true);
  ok("§6 合意していなければ上限は上がらない",
    gensoku.jogen === 231000 && gensoku.akiyaTekiyo === false);

  const tokurei = baibai({ sogakuZeikomi: 5000000, akiyaTekiyo: true });
  eq("§6 特例に合意していれば33万円まで", tokurei.jogen, 330000);
  ok("§6 特例でも「合意が必要」と告げる",
    tokurei.chuui.some((c) => c.includes("説明") && c.includes("合意")));
  eq("§6 特例の代理は33万円の2倍", baibai({ sogakuZeikomi: 5000000, akiyaTekiyo: true, tachiba: "dairi" }).jogen, 660000);

  // ④境界: 800万円ちょうどでは原則＝特例なので上がらない。801万円は対象外。
  eq("§6 800万円ちょうどは特例を使っても33万円のまま",
    baibai({ sogakuZeikomi: 8000000, akiyaTekiyo: true }).jogen, 330000);
  eq("§6 800万円ちょうどの原則の額も33万円", baibai({ sogakuZeikomi: 8000000 }).jogen, 330000);
  const koeru = baibai({ sogakuZeikomi: 8010000, akiyaTekiyo: true });
  ok("§6 800万円超は特例の対象外", koeru.akiyaTaisho === false && koeru.akiyaTekiyo === false);
  eq("§6 801万円の上限は原則どおり", koeru.jogen, baibaiKijun(8010000, DATA).zeikomi);
  // ★税込総額が800万円を超えていても、消費税を除いた代金が800万円以下なら特例の対象。
  const zeikomiOver = baibai({ sogakuZeikomi: 8500000, tatemonoZeikomi: 5500000, akiyaTekiyo: true });
  ok("§6 消費税を除いた代金で800万円以下を判定する", zeikomiOver.akiyaTekiyo === true);
}

// ───────────────────────── §7 貸借（第四・第五・第六）
{
  // 家賃10万円（居住用＝非課税）
  const kyoju = taishaku({ yachinZeikomi: 100000, isKyojuyo: true });
  eq("§7 居住用の双方合計の上限は11万円", kyoju.gokeiJogen, 110000);
  eq("§7 承諾がなければ一方からは5.5万円まで", kyoju.ippoJogen, 55000);
  ok("§7 0.55倍になる理由を画面に出す", kyoju.ippoRiyu.includes("0.55"));

  const shodaku = taishaku({ yachinZeikomi: 100000, isKyojuyo: true, shodaku: true });
  eq("§7 承諾があれば一方から11万円まで", shodaku.ippoJogen, 110000);
  eq("§7 承諾があっても双方合計は11万円のまま", shodaku.gokeiJogen, 110000);
  ok("§7 承諾は「依頼を受けるにあたって」得るものだと告げる",
    shodaku.chuui.some((c) => c.includes("媒介の依頼を受けるにあたって")));

  // 非居住用（店舗）は借賃が税込で払われているので税抜に直す。
  const tenpo = taishaku({ yachinZeikomi: 110000, isKyojuyo: false });
  eq("§7 店舗の税込11万円の借賃は税抜10万円", tenpo.yachin, 100000);
  eq("§7 店舗の合計上限は11万円（税抜10万×1.1）", tenpo.gokeiJogen, 110000);
  eq("§7 非居住用は一方からでも合計まで受け取れる", tenpo.ippoJogen, 110000);
  ok("§7 賃料から消費税を除いたことを告げる",
    tenpo.chuui.some((c) => c.includes("消費税") && c.includes("除いた")));

  // 権利金の特例（第六）: 店舗、権利金300万円 → 200万×5.5%+100万×4.4% = 110,000+44,000 = 154,000
  const kenri = taishaku({ yachinZeikomi: 110000, isKyojuyo: false, kenrikin: 3000000 });
  eq("§7 権利金300万円を売買代金とみなすと15.4万円", kenri.kenrikin.jogen, 154000);
  eq("§7 高い方（権利金基準）が上限になる", kenri.ippoJogen, 154000);
  // 税込50万円の店舗家賃＝税抜454,545円 → 合計上限 500,000円。
  // 権利金100万円は 200万円以下なので5.5%＝55,000円にしかならず、借賃基準を下回る。
  const kenriLow = taishaku({ yachinZeikomi: 500000, isKyojuyo: false, kenrikin: 1000000 });
  eq("§7 権利金基準(55,000円)が借賃基準を下回るなら借賃基準のまま", kenriLow.ippoJogen, 500000);
  eq("§7 その場合も権利金基準の額は計算して見せる", kenriLow.kenrikin.jogen, 55000);
  // ⑥居住用に権利金の特例を使わない（最も危険な向き）
  const kenriKyoju = taishaku({ yachinZeikomi: 100000, isKyojuyo: true, kenrikin: 3000000 });
  eq("§7 居住用は権利金の特例を使わない（上限は0.55か月分のまま）", kenriKyoju.ippoJogen, 55000);
  eq("§7 居住用では権利金の計算結果を持たない", kenriKyoju.kenrikin, null);
  ok("§7 居住用に使えないことを画面に出す",
    kenriKyoju.chuui.some((c) => c.includes("居住用") && c.includes("使えません")));

  // 貸借の代理（第五）
  const dairi = taishaku({ yachinZeikomi: 100000, isKyojuyo: true, tachiba: "dairi" });
  eq("§7 貸借の代理も1.1か月分（売買と違い2倍にならない）", dairi.gokeiJogen, 110000);
  ok("§7 代理でも合計1.1か月分の制限を告げる",
    dairi.chuui.some((c) => c.includes("第五") || c.includes("1.1か月分")));
}
function yenOf(v) { return Math.floor(v + 1e-6); }

// ───────────────────────── §8 fail closed
{
  const mae = baibai({ hidzuke: "2024-06-30" });
  ok("§8 令和6年7月1日より前は金額を出さない", mae.ok === false && mae.code === "kikan_gai");
  ok("§8 施行日当日は計算できる", baibai({ hidzuke: "2024-07-01" }).ok === true);
  const mae2 = calcTaishaku({ yachinZeikomi: 100000, hidzuke: "2024-06-30" }, DATA);
  ok("§8 貸借でも期間外は金額を出さない", mae2.ok === false && mae2.code === "kikan_gai");

  ok("§8 代金未入力では金額を出さない", baibai({ sogakuZeikomi: 0 }).ok === false);
  ok("§8 借賃未入力では金額を出さない", taishaku({ yachinZeikomi: 0 }).ok === false);
  ok("§8 データが無ければ計算しない（fail closed）",
    calc({ sogakuZeikomi: 30000000 }, null).ok === false);
  ok("§8 データなしの理由が読み込み失敗だと分かる",
    calc({ sogakuZeikomi: 30000000 }, null).riyu.includes("読み込め"));
  // 入口の振り分け
  eq("§8 torihiki=taishaku は貸借へ振り分ける",
    calc({ torihiki: "taishaku", yachinZeikomi: 100000, isKyojuyo: true, hidzuke: HI }, DATA).shurui, "taishaku");
  eq("§8 既定は売買", calc({ sogakuZeikomi: 30000000, hidzuke: HI }, DATA).shurui, "baibai");
}

// ───────────────────────── §9 単調性
{
  let bad = 0;
  let prev = -1;
  for (let d = 100000; d <= 100000000; d += 100000) {
    const j = baibaiKijun(d, DATA).zeikomi;
    if (j < prev) bad++;
    prev = j;
  }
  eq("§9 代金が増えて上限が減ることはない", bad, 0);
  // 区分の境界で飛びが無い（連続している）
  const a = baibaiKijun(1999999, DATA).zeikomi;
  const b = baibaiKijun(2000001, DATA).zeikomi;
  ok("§9 200万円の境界で不連続な飛びが無い", b - a < 100);
  const c = baibaiKijun(3999999, DATA).zeikomi;
  const e = baibaiKijun(4000001, DATA).zeikomi;
  ok("§9 400万円の境界で不連続な飛びが無い", e - c < 100);
}

console.log(`test_chukai: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
