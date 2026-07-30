/**
 * 不動産の売買・新築に係る登録免許税の計算コアの検査。
 *
 * 守りたいのは、画面が正常に見えたまま黙って誤答する急所:
 *   ① 抵当権設定の課税標準は「債権金額」であって不動産の評価額ではない
 *   ② 税率が違う登記は別々に端数処理する（合算して1回で丸めない）
 *   ③ 住宅用家屋の軽減が使える原因は「売買・競落」だけ（贈与・交換は本則2%）
 *   ④ 長期優良の移転だけ一戸建ては0.2%／低炭素にはその区別が無い
 *   ⑤ 長期優良・低炭素は「建築後使用されたことのない」ものに限る（中古は0.3%まで）
 *   ⑥ 最低税額1,000円の判定は100円未満を切り捨てる「前」の額で行う
 *
 * 検査の作り:
 *   §1 データJSONの定数が条文の値と一致する（自己整合）
 *   §2 外部オラクル（国税庁 No.7191 の税額表を再現する）
 *   §3 端数処理の鎖（境界値・最低税額）
 *   §4 軽減の可否判定（要件ごとに、通る側と落ちる側の対で見る）
 *   §5 認定住宅の税率（長期優良と低炭素の差を同条件の対で見る）
 *   §6 抵当権の課税標準（評価額と債権金額が別物であることを固定する）
 *   §7 税率別の端数処理（合算して丸めると答えが変わることを固定する）
 *   §8 単調性（評価額が増えて税額が減ることはない）
 */
import { readFileSync } from "node:fs";
import {
  calcTorokuJutaku, jutakuKeigenOk, tatemonoRitsu, zeigakuFrom, kigenHantei,
} from "../docs/assets/toroku_jutaku_core.js";

const DATA = JSON.parse(
  readFileSync(new URL("../docs/assets/toroku_jutaku_r08.json", import.meta.url), "utf8")
);

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);

/** 住宅用家屋の軽減が全部通る既定の入力。各検査はここから1項目だけ差し替える。 */
const base = {
  kojinKyoju: true,
  yukamenseki: 80,
  genin: "売買",
  tokiMadeMonths: 3,
  chuko: false,
  taishinTekigo: false,
  kenchikuBi: "",
  tokiShurui: "iten",
  nintei: "none",
  kodate: true,
  kaitoriHanbai: false,
};

// ── §1 データJSONの定数が条文の値と一致する ────────────────────
eq("§1 本則 所有権保存 0.4%", DATA.honsoku.hozon.ritsu, 0.004);
eq("§1 本則 その他移転 2%", DATA.honsoku.iten_sonota.ritsu, 0.02);
eq("§1 本則 抵当権設定 0.4%", DATA.honsoku.teitoken.ritsu, 0.004);
eq("§1 措法72条 土地の売買 1.5%", DATA.keigen.tochi_baibai.ritsu, 0.015);
eq("§1 措法72条の2 住宅保存 0.15%", DATA.keigen.jutaku_hozon.ritsu, 0.0015);
eq("§1 措法73条 住宅移転 0.3%", DATA.keigen.jutaku_iten.ritsu, 0.003);
eq("§1 措法75条 抵当権 0.1%", DATA.keigen.jutaku_teitoken.ritsu, 0.001);
eq("§1 措法74条 長期優良 保存 0.1%", DATA.keigen.chouki_yuryo.hozon_ritsu, 0.001);
eq("§1 措法74条2項 長期優良 移転 0.1%", DATA.keigen.chouki_yuryo.iten_ritsu, 0.001);
eq("§1 措法74条2項かっこ書き 一戸建て移転 0.2%", DATA.keigen.chouki_yuryo.iten_kodate_ritsu, 0.002);
eq("§1 措法74条の2 低炭素 保存 0.1%", DATA.keigen.tei_tanso.hozon_ritsu, 0.001);
eq("§1 措法74条の2第2項 低炭素 移転 0.1%", DATA.keigen.tei_tanso.iten_ritsu, 0.001);
eq("§1 措法74条の3 買取再販 0.1%", DATA.keigen.kaitori_hanbai.iten_ritsu, 0.001);
eq("§1 床面積要件 50平方メートル", DATA.yoken.yukamenseki_min, 50);
eq("§1 中古の建築日基準 昭和57年1月1日", DATA.yoken.chuko_kenchiku_kijun_bi, "1982-01-01");
eq("§1 登記の期限 1年", DATA.yoken.toki_kigen_months, 12);

// ★期限が2つあることを固定する（同じ日だと思い込むと令和9年4月以降の土地を2%と誤る）。
eq("§1 住宅用家屋の軽減の期限", DATA.keigen.jutaku_kigen, "2027-03-31");
eq("§1 土地の売買の軽減の期限（令和8年法律12号で延長）", DATA.keigen.tochi_baibai.kigen, "2029-03-31");
ok("§1 土地の期限は住宅の期限より後（別制度であることの構造的な確認）",
  DATA.keigen.tochi_baibai.kigen > DATA.keigen.jutaku_kigen);

// ★低炭素には一戸建ての区別が「無い」ことを固定する（無いことも検査する）。
ok("§1 低炭素に一戸建ての別税率が無い",
  DATA.keigen.tei_tanso.iten_kodate_ritsu === undefined);

// 取得原因は売買と競落の2つだけ（措令42条3項）。増えても減っても落ちる。
eq("§1 軽減が使える原因は2つ", DATA.yoken.gen_in.length, 2);
ok("§1 原因は売買と競落", DATA.yoken.gen_in.includes("売買") && DATA.yoken.gen_in.includes("競落"));

// ── §2 外部オラクル（国税庁 No.7191 の税額表を再現する） ──────────
// 国税庁タックスアンサー No.7191「登録免許税の税額表」の各行を、コアの出す税率で再現する。
// ★同ページは「令和7年4月1日現在法令等」で、土地の軽減の期限だけ令和8年3月31日のまま古い
//   （令和8年法律12号で令和11年3月31日まで延長済み＝tmp_menkyo_72_diff_0730.py で版比較して確認）。
//   税率そのものは全行一致するので、税率のオラクルとしては有効。
const oracle = (inp) => tatemonoRitsu({ ...base, ...inp }, DATA).ritsu;
eq("§2 NTA 住宅用家屋の保存 1000分の1.5", oracle({ tokiShurui: "hozon" }), 0.0015);
eq("§2 NTA 住宅用家屋の移転 1000分の3", oracle({ tokiShurui: "iten" }), 0.003);
eq("§2 NTA 長期優良の保存 1000分の1",
  oracle({ tokiShurui: "hozon", nintei: "chouki" }), 0.001);
eq("§2 NTA 長期優良の移転（一戸建て）1000分の2",
  oracle({ tokiShurui: "iten", nintei: "chouki", kodate: true }), 0.002);
eq("§2 NTA 長期優良の移転（一戸建て以外）1000分の1",
  oracle({ tokiShurui: "iten", nintei: "chouki", kodate: false }), 0.001);
eq("§2 NTA 低炭素の保存 1000分の1",
  oracle({ tokiShurui: "hozon", nintei: "teitanso" }), 0.001);
eq("§2 NTA 低炭素の移転 1000分の1（一戸建てでも）",
  oracle({ tokiShurui: "iten", nintei: "teitanso", kodate: true }), 0.001);
eq("§2 NTA 買取再販の移転 1000分の1",
  oracle({ tokiShurui: "iten", chuko: true, taishinTekigo: true, kaitoriHanbai: true }), 0.001);
eq("§2 NTA 本則 建物の保存 1000分の4（軽減なし）",
  oracle({ tokiShurui: "hozon", kojinKyoju: false }), 0.004);
eq("§2 NTA 本則 建物の売買移転 1000分の20（軽減なし）",
  oracle({ tokiShurui: "iten", kojinKyoju: false }), 0.02);

// ── §3 端数処理の鎖 ────────────────────────────────────
const H = DATA.hasu;
// 課税標準 12,345,678 → 12,345,000（1,000円未満切捨て）→ ×0.3% = 37,035 → 37,000（100円未満切捨て）
{
  const r = zeigakuFrom(12345678, 0.003, H);
  eq("§3 課税標準の1,000円未満切捨て", r.kazeiHyojun, 12345000);
  eq("§3 税額の100円未満切捨て", r.zeigaku, 37000);
}
// 課税標準が1,000円未満 → 1,000円とみなす（登免税法15条）
{
  const r = zeigakuFrom(800, 0.02, H);
  eq("§3 課税標準が1,000円未満なら1,000円", r.kazeiHyojun, 1000);
  eq("§3 その場合の税額は最低税額1,000円", r.zeigaku, 1000);
}
// ★最低税額1,000円の判定は切り捨てる前の額で行う（急所⑥）。
// 課税標準 500,000 × 0.15% = 750 → 1,000円未満なので税額は1,000円（750を切り捨てて700にしない）
{
  const r = zeigakuFrom(500000, 0.0015, H);
  eq("§3 税率適用後が1,000円未満なら税額1,000円", r.zeigaku, 1000);
}
// 境界: 課税標準 666,667 × 0.15% = 1,000.0005 → 1,000円（切捨て後もちょうど1,000）
{
  const r = zeigakuFrom(667000, 0.0015, H);
  eq("§3 境界（1,000円をわずかに超える）", r.zeigaku, 1000);
}
// 入力が0なら税額も0（1,000円を出さない＝登記しないものに課税しない）
{
  const r = zeigakuFrom(0, 0.02, H);
  eq("§3 課税標準0なら税額0", r.zeigaku, 0);
}

// ── §4 軽減の可否判定（通る側と落ちる側の対） ──────────────────
ok("§4 既定の条件では軽減が通る", jutakuKeigenOk(base, DATA).ok);
ok("§4 床面積49.9平方メートルで落ちる",
  !jutakuKeigenOk({ ...base, yukamenseki: 49.9 }, DATA).ok);
ok("§4 床面積ちょうど50平方メートルは通る（以上なので境界は通る側）",
  jutakuKeigenOk({ ...base, yukamenseki: 50 }, DATA).ok);
ok("§4 贈与で落ちる（措令42条3項＝原因は売買・競落だけ）",
  !jutakuKeigenOk({ ...base, genin: "贈与" }, DATA).ok);
ok("§4 競落は通る", jutakuKeigenOk({ ...base, genin: "競落" }, DATA).ok);
ok("§4 法人・非居住で落ちる",
  !jutakuKeigenOk({ ...base, kojinKyoju: false }, DATA).ok);
ok("§4 取得から13か月で落ちる",
  !jutakuKeigenOk({ ...base, tokiMadeMonths: 13 }, DATA).ok);
ok("§4 取得から12か月ちょうどは通る",
  jutakuKeigenOk({ ...base, tokiMadeMonths: 12 }, DATA).ok);
// 中古の耐震要件（急所⑦＝築年数ではなく建築日で判定する）
ok("§4 中古・昭和56年12月31日建築で落ちる",
  !jutakuKeigenOk({ ...base, chuko: true, kenchikuBi: "1981-12-31" }, DATA).ok);
ok("§4 中古・昭和57年1月1日建築は通る",
  jutakuKeigenOk({ ...base, chuko: true, kenchikuBi: "1982-01-01" }, DATA).ok);
ok("§4 中古・古くても耐震基準適合の証明があれば通る",
  jutakuKeigenOk({ ...base, chuko: true, kenchikuBi: "1970-05-01", taishinTekigo: true }, DATA).ok);
ok("§4 中古で建築日が未入力なら判定できないとして落ちる（黙って通さない）",
  !jutakuKeigenOk({ ...base, chuko: true, kenchikuBi: "" }, DATA).ok);
// ★理由は全部返す（1つ直しても次で落ちる、を避ける）
eq("§4 要件を3つ落とすと理由も3つ返る",
  jutakuKeigenOk({ ...base, yukamenseki: 30, genin: "贈与", kojinKyoju: false }, DATA).riyu.length, 3);

// ── §5 認定住宅の税率（長期優良と低炭素を同条件の対で見る） ─────────
// ★急所④: 移転登記で一戸建てのとき、長期優良は0.2%・低炭素は0.1%。ここが入れ替わると黙って誤る。
{
  const chouki = tatemonoRitsu({ ...base, nintei: "chouki", kodate: true }, DATA).ritsu;
  const tanso = tatemonoRitsu({ ...base, nintei: "teitanso", kodate: true }, DATA).ritsu;
  eq("§5 一戸建ての移転 長期優良は0.2%", chouki, 0.002);
  eq("§5 一戸建ての移転 低炭素は0.1%", tanso, 0.001);
  ok("§5 同条件で長期優良のほうが高い（両者を同じ表で扱う実装を落とす）", chouki > tanso);
}
// 保存登記には一戸建ての区別が無い（長期優良も0.1%）
eq("§5 一戸建ての保存 長期優良は0.1%",
  tatemonoRitsu({ ...base, tokiShurui: "hozon", nintei: "chouki", kodate: true }, DATA).ritsu, 0.001);
// ★急所⑤: 中古の長期優良住宅は特例の対象外＝住宅用家屋の0.3%まで
eq("§5 中古の長期優良は0.3%（特例は新築・未使用に限る）",
  tatemonoRitsu({ ...base, nintei: "chouki", chuko: true, taishinTekigo: true }, DATA).ritsu, 0.003);
eq("§5 中古の低炭素も0.3%",
  tatemonoRitsu({ ...base, nintei: "teitanso", chuko: true, taishinTekigo: true }, DATA).ritsu, 0.003);
// 買取再販は中古の移転のみ（新築や保存には対応する特例が無い）
eq("§5 買取再販は中古の移転で0.1%",
  tatemonoRitsu({ ...base, chuko: true, taishinTekigo: true, kaitoriHanbai: true }, DATA).ritsu, 0.001);
eq("§5 買取再販フラグがあっても新築の保存は0.15%（74条の3は移転のみ）",
  tatemonoRitsu({ ...base, tokiShurui: "hozon", kaitoriHanbai: true }, DATA).ritsu, 0.0015);

// ── §6 抵当権の課税標準は債権金額（急所①） ──────────────────
{
  // 評価額2,000万円の家に、借入3,000万円の抵当権。抵当権は借入額で計算する。
  const r = calcTorokuJutaku({
    ...base, tatemonoKagaku: 20000000, saikenGaku: 30000000,
  }, DATA);
  const t = r.meisai.find((m) => m.key === "teitoken");
  eq("§6 抵当権の課税標準は債権金額（評価額ではない）", t.kazeiHyojun, 30000000);
  eq("§6 抵当権の税額 3,000万円×0.1%", t.zeigaku, 30000);
  // 評価額を変えても抵当権の税額は動かない（結びつけて実装していないことの確認）
  const r2 = calcTorokuJutaku({
    ...base, tatemonoKagaku: 5000000, saikenGaku: 30000000,
  }, DATA);
  eq("§6 評価額を変えても抵当権の税額は不変",
    r2.meisai.find((m) => m.key === "teitoken").zeigaku, 30000);
}
// 軽減が使えないと抵当権は本則0.4%
{
  const r = calcTorokuJutaku({
    ...base, kojinKyoju: false, tatemonoKagaku: 20000000, saikenGaku: 30000000,
  }, DATA);
  eq("§6 軽減なしの抵当権は0.4%",
    r.meisai.find((m) => m.key === "teitoken").zeigaku, 120000);
}

// ── §7 税率別に端数処理する（急所②） ────────────────────────
{
  // 土地1,234,567（1.5%）＋建物1,234,567（0.3%）を別々に処理する。
  // 別々: 土地 1,234,000×1.5%=18,510→18,500 ／ 建物 1,234,000×0.3%=3,702→3,700 ＝ 22,200
  // 合算して1回で丸めると別の額になる（＝この検査が落ちる）。
  const r = calcTorokuJutaku({
    ...base, tochiKagaku: 1234567, tochiGenin: "売買",
    tatemonoKagaku: 1234567, tokiShurui: "iten",
  }, DATA);
  const tochi = r.meisai.find((m) => m.key === "tochi");
  const tate = r.meisai.find((m) => m.key === "tatemono");
  eq("§7 土地の税額（1.5%・別処理）", tochi.zeigaku, 18500);
  eq("§7 建物の税額（0.3%・別処理）", tate.zeigaku, 3700);
  eq("§7 合計は各明細の和", r.gokei, 22200);
}
// 持分は課税標準に先に掛ける（登免税法10条2項）
{
  const r = calcTorokuJutaku({
    ...base, tochiKagaku: 20000000, tochiMochibun: 0.5, tochiGenin: "売買",
  }, DATA);
  eq("§7 持分2分の1の課税標準", r.meisai[0].kazeiHyojun, 10000000);
  eq("§7 持分2分の1の税額", r.meisai[0].zeigaku, 150000);
}

// ── §8 単調性・fail closed ─────────────────────────────
{
  let prev = -1;
  let mono = true;
  for (let v = 1000000; v <= 60000000; v += 500000) {
    const r = calcTorokuJutaku({ ...base, tatemonoKagaku: v }, DATA);
    if (r.gokei < prev) mono = false;
    prev = r.gokei;
  }
  ok("§8 評価額が増えて税額が減ることはない", mono);
}
ok("§8 データが無ければ計算しない（fail closed）",
  calcTorokuJutaku({ ...base, tatemonoKagaku: 1000000 }, null).ok === false);
ok("§8 入力が空なら計算しない",
  calcTorokuJutaku({ ...base }, DATA).ok === false);

// ── 実額の看板例（手計算の鎖） ─────────────────────────────
{
  // 新築の建売住宅を購入: 土地評価額1,500万円・建物認定価格1,000万円・ローン3,500万円
  // 土地 15,000,000×1.5% = 225,000
  // 建物（保存・住宅用家屋）10,000,000×0.15% = 15,000
  // 抵当権 35,000,000×0.1% = 35,000  → 合計 275,000
  const r = calcTorokuJutaku({
    ...base, tochiKagaku: 15000000, tochiGenin: "売買",
    tatemonoKagaku: 10000000, tokiShurui: "hozon", saikenGaku: 35000000,
  }, DATA);
  eq("看板例 土地", r.meisai.find((m) => m.key === "tochi").zeigaku, 225000);
  eq("看板例 建物（保存）", r.meisai.find((m) => m.key === "tatemono").zeigaku, 15000);
  eq("看板例 抵当権", r.meisai.find((m) => m.key === "teitoken").zeigaku, 35000);
  eq("看板例 合計", r.gokei, 275000);
}
{
  // ★同じ物件を「贈与で取得した」場合＝軽減が全部落ちる（措令42条3項）。
  // 土地 15,000,000×2% = 300,000 ／ 建物 10,000,000×0.4%(保存本則) = 40,000 → 340,000
  const r = calcTorokuJutaku({
    ...base, genin: "贈与", tochiKagaku: 15000000, tochiGenin: "贈与",
    tatemonoKagaku: 10000000, tokiShurui: "hozon",
  }, DATA);
  eq("看板例（贈与）土地は本則2%", r.meisai.find((m) => m.key === "tochi").zeigaku, 300000);
  eq("看板例（贈与）建物は本則0.4%", r.meisai.find((m) => m.key === "tatemono").zeigaku, 40000);
}

// ── §9 登記を受ける日と2つの期限（急所⑥） ────────────────────
// ★ここが守るのは「期限を過ぎた日の登記に、今日の軽減税率をそのまま当てない」こと。
//   軽減を受けられない人に「軽減されます」と答えるのが最も危険な向き（データの next_review_reason）。
{
  const K = DATA.keigen;
  // 境界の対: 住宅用家屋の軽減の最終日と、その翌日。
  eq("§9 住宅の期限の当日は軽減が使える",
    kigenHantei(K.jutaku_kigen, DATA).jutakuKeigen, true);
  eq("§9 その翌日は使えるか分からない（false＝未定の申告）",
    kigenHantei("2027-04-01", DATA).jutakuKeigen, false);
  // 土地の期限は2年長い＝住宅の期限を過ぎても土地の計算は続けられる。
  ok("§9 住宅の期限翌日でも判定そのものは成立する（土地は生きている）",
    kigenHantei("2027-04-01", DATA).ok);
  ok("§9 土地の期限の当日は成立する", kigenHantei(K.tochi_baibai.kigen, DATA).ok);
  ok("§9 土地の期限翌日は何も出さない", !kigenHantei("2029-04-01", DATA).ok);
  // 収録範囲の下端。
  ok("§9 収録開始日は通る", kigenHantei(DATA._meta.applies_from, DATA).ok);
  ok("§9 収録開始日より前は出さない", !kigenHantei("2026-03-31", DATA).ok);
  ok("§9 日付が空なら計算しない", !kigenHantei("", DATA).ok);
}
{
  // 期限後（2027-04-01）に、建物と抵当権だけ出せず土地は出せる。
  const r = calcTorokuJutaku({
    ...base, tokiBi: "2027-04-01",
    tochiKagaku: 15000000, tochiGenin: "売買",
    tatemonoKagaku: 10000000, saikenGaku: 35000000,
  }, DATA);
  ok("§9 期限後でも土地は計算できる", r.ok && r.meisai.length === 1);
  eq("§9 期限後の土地の税額（1.5%は令和11年3月31日まで）",
    r.meisai[0].zeigaku, 225000);
  ok("§9 期限後は一部だけであることを申告する", r.bubun === true);
  eq("§9 出せない項目が2つ（建物・抵当権）", r.kigenGai.length, 2);
  ok("§9 期限が別の制度であることを断り書きに出す",
    /土地の売買の軽減は令和11年3月31日/.test(r.kigenGaiRiyu));
}
{
  // ★対: 同じ日でも「軽減の要件を満たしていない人」は本則なので答えが決まる。
  const r = calcTorokuJutaku({
    ...base, tokiBi: "2027-04-01", genin: "贈与",
    tatemonoKagaku: 10000000, tochiKagaku: 0,
  }, DATA);
  ok("§9 期限後でも軽減の要件を満たさない建物は本則で計算できる", r.ok);
  eq("§9 その税額は本則2%", r.meisai[0].zeigaku, 200000);
  ok("§9 その場合は一部だけの申告をしない", !r.bubun);
}
{
  // 建物だけを期限後に入れた＝出せるものが1つも無い → 金額を1円も出さない。
  const r = calcTorokuJutaku({
    ...base, tokiBi: "2027-04-01", tatemonoKagaku: 10000000,
  }, DATA);
  ok("§9 出せるものが無ければ計算結果を返さない", r.ok === false && r.hanigai === true);
  ok("§9 その理由は期限であって入力不足ではない", /適用期限/.test(r.riyu));
}
{
  // 収録範囲外の日は、入力が揃っていても1円も出さない。
  const r = calcTorokuJutaku({
    ...base, tokiBi: "2026-03-31", tochiKagaku: 15000000, tochiGenin: "売買",
  }, DATA);
  ok("§9 収録範囲より前の日は計算しない", r.ok === false && r.hanigai === true);
}
// ★相続・遺贈は本則の税率そのものが別（0.4%）なので、当てずに断る。
{
  const r = calcTorokuJutaku({
    ...base, genin: "相続", tatemonoKagaku: 10000000, tochiKagaku: 15000000, tochiGenin: "相続",
  }, DATA);
  ok("§9 相続は計算しない（1000分の20を当てると5倍になる）", r.ok === false && r.hanigai === true);
  eq("§9 相続は専用ツールへ案内する", r.betsuTool, "/sozoku-toki-menkyozei/");
  ok("§9 断る理由に税率が別であることを書く", /1000分の4/.test(r.riyu));
}
// 対: 贈与は本則2%が正しいので、断らずに計算する（相続と混同すると使える人を止める）。
ok("§9 贈与は断らずに計算する",
  calcTorokuJutaku({ ...base, genin: "贈与", tatemonoKagaku: 10000000 }, DATA).ok === true);

// 期限を渡さない従来の呼び出しは、これまでどおり軽減が使える前提で計算する。
{
  const r = calcTorokuJutaku({ ...base, tochiKagaku: 15000000, tochiGenin: "売買" }, DATA);
  eq("§9 tokiBi を渡さない呼び出しは従来どおり", r.meisai[0].zeigaku, 225000);
}

// ── 結果 ─────────────────────────────────────────────
if (fails.length) {
  console.error(`FAIL ${fails.length}件 / ${pass + fails.length}件`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`ok  test_toroku_jutaku  ${pass}件`);
