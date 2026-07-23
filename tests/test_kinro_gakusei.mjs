// 勤労学生控除 kinroGakuseiHantei と /kinro-gakusei/ ページのテスト。
//
// オラクルは実装の式ではなく**条文を判定順そのまま書き下した独立実装**:
//  - 定義: 所得税法2条1項32号。現行版(85万円)とR8-12-01施行版(89万円)を逐語比較し、
//    差分は合計所得要件のみ(2026-07-24取得)。適用年分は令和8年法律12号 附則2条
//    「勤労学生の定義等に関する経過措置」=令和8年分以後。
//  - 額: 所法82条=27万円(両版md5一致)。住民税は地方税法34条1項9号・314条の2第1項9号=26万円
//    (現行版と2027-01-01施行版で一致)。34条9項・314条の2第9項が所法32号を準用。
//    オラクルは**額を定数で持つ**(参照データを見ない)ので、データ側の改変も捕まえる。
//  - ★このツールの看板の主張「要件を満たす人の所得税は控除がなくても0円」は、
//    基礎控除104万円(shotokuzei_kiso_kojo_r8)≧要件89万円というデータの大小関係に依存する。
//    その関係をここで固定する(データが変わったら記事ごと見直しになる)。
//  - 住民税の効き目(最大26,500円など)は juminzei_core.calc との結合で確かめ、
//    ページの例表・FAQ・meta descriptionの数値もこの計算から照合する(規則9)。
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { kinroGakuseiHantei } from "../docs/assets/setsuzei_core.js";
import { calc, kyuyoShotokuR8, shotokuzeiKisoKojo, hikazeiHantei } from "../docs/assets/juminzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/setsuzei_r08.json", import.meta.url)));
const J = JSON.parse(readFileSync(new URL("../docs/assets/juminzei_r08.json", import.meta.url)));
const HTML = readFileSync(new URL("../docs/kinro-gakusei/index.html", import.meta.url), "utf8");

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  try { assert.deepEqual(got, want); pass++; }
  catch { fail++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const ok = (name, cond) => eq(name, !!cond, true);

// ---- オラクル(条文の書き下し・独立実装) ------------------------------------
// 額・限度は条文の定数(参照データを見ない)。
const O_KOJO = { shotoku: 270_000, jumin: 260_000 }; // 所法82条 / 地税34条1項9号・314条の2第1項9号
const O_LIMIT = 890_000;   // 2条1項32号「合計所得金額が八十九万円以下」(R8-12-01版・令和8年分以後)
const O_HIKINRO = 100_000; // 同「給与所得等以外の所得に係る部分の金額が十万円以下」

function oracle(input) {
  // 柱書き「次に掲げる者で」= イ(1条校)/ロ(専修学校・各種学校)/ハ(認定職業訓練)以外は対象外
  if (!["ichijo", "senshu", "kunren"].includes(input.school)) return { type: "none" };
  // 「自己の勤労に基づいて得た…給与所得等を有するもの」
  // (給与収入74.1万円未満は措法29条の4で給与所得なし=所得0なら「有する」に当たらない読み。
  //  ページはこの場合「対象外」でなく「出番なし(税額0円)」と表示する)
  if ((input.kinroShotoku || 0) <= 0) return { type: "none" };
  // 「合計所得金額が八十九万円以下」
  if ((input.kinroShotoku || 0) + (input.hikinroShotoku || 0) > O_LIMIT) return { type: "none" };
  // 「給与所得等以外の所得に係る部分の金額が十万円以下」
  if ((input.hikinroShotoku || 0) > O_HIKINRO) return { type: "none" };
  return { type: "ok", ...O_KOJO };
}

// ---- 1. 全組み合わせ総当たり ----------------------------------------------
// 4学校 × 14勤労所得 × 8非勤労所得 = 448通り。89万・10万の両側1円を含める。
const SCHOOLS = ["ichijo", "senshu", "kunren", "none"];
const KINRO = [0, 1, 100_000, 500_000, 759_999, 760_000, 789_999, 790_000, 790_001,
               889_999, 890_000, 890_001, 1_000_000, 4_000_000];
const HIKINRO = [0, 1, 50_000, 99_999, 100_000, 100_001, 150_000, 1_000_000];

let combos = 0, comboFails = 0;
for (const school of SCHOOLS) for (const kinroShotoku of KINRO) for (const hikinroShotoku of HIKINRO) {
  const input = { school, kinroShotoku, hikinroShotoku };
  const want = oracle(input);
  const got = kinroGakuseiHantei(input, D);
  combos++;
  const same = got.type === want.type &&
    (want.type === "none" || (got.shotoku === want.shotoku && got.jumin === want.jumin));
  if (!same) {
    comboFails++;
    if (comboFails <= 5) console.log(`  ✗ 総当たり ${JSON.stringify(input)}: got ${got.type}/${got.shotoku} want ${want.type}/${want.shotoku ?? ""}`);
  }
}
eq(`総当たり ${combos}通り(オラクル=条文書き下し)`, comboFails, 0);

// ---- 2. 境界の名指し(判定順・理由コード) -----------------------------------
eq("学生でない → not_student", kinroGakuseiHantei({ school: "none", kinroShotoku: 500_000, hikinroShotoku: 0 }, D).reason, "not_student");
eq("勤労所得0 → no_kinro", kinroGakuseiHantei({ school: "ichijo", kinroShotoku: 0, hikinroShotoku: 50_000 }, D).reason, "no_kinro");
eq("合計89万ちょうど → ok", kinroGakuseiHantei({ school: "ichijo", kinroShotoku: 890_000, hikinroShotoku: 0 }, D).type, "ok");
eq("合計89万+1円 → income_over", kinroGakuseiHantei({ school: "ichijo", kinroShotoku: 890_001, hikinroShotoku: 0 }, D).reason, "income_over");
eq("非勤労10万ちょうど → ok", kinroGakuseiHantei({ school: "ichijo", kinroShotoku: 500_000, hikinroShotoku: 100_000 }, D).type, "ok");
eq("非勤労10万+1円 → hikinro_over", kinroGakuseiHantei({ school: "ichijo", kinroShotoku: 500_000, hikinroShotoku: 100_001 }, D).reason, "hikinro_over");
// 判定順: 89万超と10万超の両方に当たるときは条文の順(合計所得が先)
eq("89万超かつ10万超 → income_overが先", kinroGakuseiHantei({ school: "ichijo", kinroShotoku: 800_000, hikinroShotoku: 200_000 }, D).reason, "income_over");
// courseNote: ロ・ハだけ立つ(課程要件の申告)
ok("専修学校は courseNote", kinroGakuseiHantei({ school: "senshu", kinroShotoku: 500_000, hikinroShotoku: 0 }, D).courseNote);
ok("認定職業訓練は courseNote", kinroGakuseiHantei({ school: "kunren", kinroShotoku: 500_000, hikinroShotoku: 0 }, D).courseNote);
ok("1条校は courseNote なし", !kinroGakuseiHantei({ school: "ichijo", kinroShotoku: 500_000, hikinroShotoku: 0 }, D).courseNote);
// データ欠落は例外(fail closed)
ok("データ欠落で例外", (() => { try { kinroGakuseiHantei({ school: "ichijo", kinroShotoku: 1 }, {}); return false; } catch { return true; } })());

// ---- 3. 給与収入163万円⇔合計所得89万円の換算(juminzei_coreとの結合) --------
eq("給与163万円 → 所得89万円ちょうど", kyuyoShotokuR8(1_630_000, J), 890_000);
eq("給与163万1円 → 89万円超", kyuyoShotokuR8(1_630_001, J) > 890_000, true);
// 二分探索: 対象になる最大の給与収入は163万円ちょうど
{
  let lo = 0, hi = 3_000_000;
  while (lo < hi) {
    const m = Math.floor((lo + hi + 1) / 2);
    if (kyuyoShotokuR8(m, J) <= O_LIMIT) lo = m; else hi = m - 1;
  }
  eq("対象になる最大の給与収入(二分探索)", lo, 1_630_000);
}
// ページ・データの「163万円」はこの換算から導かれている
eq("データのincome_limit+定額控除74万 = 163万", D.kinro_gakusei.income_limit + J.kyuyo_shotoku_r8.flat_kojo, 1_630_000);

// ---- 4. ★看板の主張「所得税では効かない」のデータ結合 -----------------------
// 要件(合計所得89万円以下)の全域で、令和8年分の基礎控除が合計所得以上 → 課税所得0。
{
  let broken = -1;
  for (let g = 0; g <= D.kinro_gakusei.income_limit; g += 1_000) {
    if (shotokuzeiKisoKojo(g, J, "r8") < g) { broken = g; break; }
  }
  eq("合計所得0〜89万円の全点で基礎控除R8≧合計所得(所得税0の根拠)", broken, -1);
  eq("基礎控除R8(合計所得89万円) = 104万円", shotokuzeiKisoKojo(890_000, J, "r8"), 1_040_000);
  // 図解の「178万円で所得税がかかり始める」= 基礎控除104万+定額控除74万
  eq("178万円ライン = 基礎控除104万+74万", 1_040_000 + J.kyuyo_shotoku_r8.flat_kojo, 1_780_000);
  // 要件の上限89万円は、基礎控除104万円より15万円内側(図解の主張)
  eq("104万−89万 = 15万円(図解の注記)", 1_040_000 - D.kinro_gakusei.income_limit, 150_000);
}

// ---- 5. 住民税の効き目(juminzei_core.calcとの結合) --------------------------
// ページの例表・FAQ・meta descriptionの数値の正本。
const jt = (shunyu, kinro, opts = {}) => calc({
  kyuyoShunyu: shunyu, sonotaShotoku: opts.sonota || 0, shakaiHoken: opts.shaho || 0,
  family: { kinroGakusei: kinro, honninMiseinen: !!opts.miseinen },
  zeisei: "r8", kyuchi: 1,
}, J);
const rows = [1_300_000, 1_430_000, 1_500_000, 1_630_000].map((s) => {
  const off = jt(s, false), on = jt(s, true);
  return { s, off: off.juminzeiTotal, on: on.juminzeiTotal, saving: off.juminzeiTotal - on.juminzeiTotal };
});
eq("例表: 130万円", rows[0], { s: 1_300_000, off: 15_500, on: 5_000, saving: 10_500 });
eq("例表: 143万円", rows[1], { s: 1_430_000, off: 28_500, on: 5_000, saving: 23_500 });
eq("例表: 150万円", rows[2], { s: 1_500_000, off: 35_500, on: 9_000, saving: 26_500 });
eq("例表: 163万円", rows[3], { s: 1_630_000, off: 48_500, on: 22_000, saving: 26_500 });
// 143万円ちょうどは所得割0(均等割5,000円だけが残る)
eq("143万円で所得割0", jt(1_430_000, true).shotokuwariJissai, 0);
// 「最大26,500円」: 対象の全給与域(74.1万〜163万)で 26,500円を超えないこと
{
  let max = 0;
  for (let s = 750_000; s <= 1_630_000; s += 10_000) {
    const d = jt(s, false).juminzeiTotal - jt(s, true).juminzeiTotal;
    if (d > max) max = d;
  }
  eq("住民税の効き目の最大(1万円刻み全点) = 26,500円", max, 26_500);
}
// 非課税ライン: 成年単身は給与119万円まで住民税0(勤労学生控除の出番なし)
eq("給与119万円 → 住民税0", jt(1_190_000, false).juminzeiTotal, 0);
ok("給与119万1円 → 課税", jt(1_190_001, false).juminzeiTotal > 0);
// 45万円ライン(所得割・均等割の非課税限度額)+74万円 = 119万円の導出
{
  const hk = hikazeiHantei(450_000, 450_000, {}, "1", J);
  ok("単身の非課税限度額45万円", hk.kintouwariHikazei && hk.shotokuwariHikazei && hk.shotokuLimit === 450_000);
  eq("119万円ライン = 45万+74万", 450_000 + J.kyuyo_shotoku_r8.flat_kojo, 1_190_000);
}
// 未成年: 給与163万円(所得89万≦135万)で住民税0(295条1項2号)
{
  const m = jt(1_630_000, false, { miseinen: true });
  ok("未成年163万円 → 非課税(jonrei295)", m.hikazei.jonrei295 && m.juminzeiTotal === 0);
  eq("未成年の209万円ライン = 135万+74万", J.hikazei.shogaisha_goukei_limit + J.kyuyo_shotoku_r8.flat_kojo, 2_090_000);
  const m2 = jt(2_100_000, false, { miseinen: true });
  ok("未成年210万円 → 非課税でない", !m2.hikazei.jonrei295 && m2.juminzeiTotal > 0);
}

// ---- 6. データの内部整合 -----------------------------------------------------
eq("控除額(データ) 所得税27万", D.kinro_gakusei.kojo.shotoku, O_KOJO.shotoku);
eq("控除額(データ) 住民税26万", D.kinro_gakusei.kojo.jumin, O_KOJO.jumin);
eq("所得要件(データ) 89万", D.kinro_gakusei.income_limit, O_LIMIT);
eq("非勤労限度(データ) 10万", D.kinro_gakusei.hikinro_limit, O_HIKINRO);
// juminzei_r08側の勤労学生控除26万円・調整控除の差1万円と食い違わないこと
eq("juminzei_r08の勤労学生控除も26万", J.shotoku_kojo.kinro_gakusei, 260_000);
eq("人的控除差(勤労学生) 1万円(27万−26万)", J.jinteki_kojo_sa.kinro_gakusei, 10_000);
eq("年分の表記", D.kinro_gakusei.year, "令和8年分");
eq("住民税の年度の表記", D.kinro_gakusei.jumin_nendo, "令和9年度分");

// ---- 7. ページの主張の照合(規則3: 要素を名指しする) --------------------------
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// 7-1. 例表(#jumin-rei)の行を名指しし、行ごとにcalcの値と照合する
{
  const m = HTML.match(/<table id="jumin-rei">([\s\S]*?)<\/table>/);
  ok("例表#jumin-reiがある", !!m);
  if (m) {
    const trs = [...m[1].matchAll(/<tr><td>([\s\S]*?)<\/tr>/g)].map((t) => strip(t[0]));
    const wantRows = [
      { label: "119万円以下", nums: ["0円", "0円", "0円"] },
      { label: "130万円", nums: ["15,500円", "5,000円", "10,500円"] },
      { label: "143万円", nums: ["28,500円", "5,000円", "23,500円"] },
      { label: "150万円", nums: ["35,500円", "9,000円", "26,500円"] },
      { label: "163万円", nums: ["48,500円", "22,000円", "26,500円"] },
    ];
    for (const w of wantRows) {
      const row = trs.find((t) => t.includes(w.label));
      ok(`例表の行「${w.label}」がある`, !!row);
      if (row) for (const n of w.nums) ok(`例表「${w.label}」に ${n}`, row.includes(n));
    }
    // 例表の数値がcalcと一致していること(上のeqで固定済みだが、行のラベルと組で照合)
    eq("例表130万の値=calc", [rows[0].off, rows[0].on, rows[0].saving], [15_500, 5_000, 10_500]);
  }
}

// 7-2. 看板callout(#muko-callout): 89万<104万の関係と「0円」の主張
{
  const m = HTML.match(/<div class="callout" id="muko-callout">([\s\S]*?)<\/div>/);
  ok("所得税0のcalloutがある", !!m);
  if (m) {
    const t = strip(m[1]);
    ok("calloutに89万円", t.includes("89万円"));
    ok("calloutに基礎控除104万円", t.includes("基礎控除104万円"));
    ok("calloutに所得税が0円", t.includes("所得税が0円"));
    ok("calloutに『控除がなくても』", t.includes("控除がなくても"));
  }
}

// 7-3. 図解のfigcaption: 3つのラインの導出式
{
  const m = HTML.match(/<figcaption>([\s\S]*?)<\/figcaption>/);
  ok("figcaptionがある", !!m);
  if (m) {
    const t = strip(m[1]);
    ok("figcaption 119万円＝45万+74万", t.includes("119万円＝住民税非課税ライン45万円＋給与所得控除74万円"));
    ok("figcaption 163万円＝89万+74万", t.includes("163万円＝要件89万円＋74万円"));
    ok("figcaption 178万円＝104万+74万", t.includes("178万円＝基礎控除104万円＋74万円"));
  }
}

// 7-4. title / meta description(規則9: 検索結果に出る主張)
{
  const title = (HTML.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  ok("titleに163万円", title.includes("163万円"));
  const desc = (HTML.match(/<meta name="description" content="([\s\S]*?)">/) || [])[1] || "";
  ok("meta descに89万円", desc.includes("89万円"));
  ok("meta descに163万円", desc.includes("163万円"));
  ok("meta descに26,500円", desc.includes("26,500円"));
  ok("meta descに104万円", desc.includes("104万円"));
}

// 7-5. FAQの数値の主張(h3を名指し)
{
  const faq = (h3) => {
    const m = HTML.match(new RegExp(`<h3>${h3}</h3>\\s*<p>([\\s\\S]*?)</p>`));
    return m ? strip(m[1]) : "";
  };
  const imi = faq("所得税が減らないなら、申告する意味はありますか？");
  ok("FAQ(意味)に26,500円", imi.includes("26,500円"));
  ok("FAQ(意味)に143万円", imi.includes("143万円"));
  ok("FAQ(意味)に119万円", imi.includes("119万円"));
  ok("FAQ(意味)に209万円", imi.includes("209万円"));
  const kakemochi = faq("バイトをかけもちしています。年収はいくらまでなら対象ですか？");
  ok("FAQ(かけもち)に163万円", kakemochi.includes("163万円"));
  ok("FAQ(かけもち)に89万円", kakemochi.includes("89万円"));
  ok("FAQ(かけもち)に74万円", kakemochi.includes("74万円"));
  const oya = faq("勤労学生控除を使うと、親の扶養から外れますか？");
  ok("FAQ(親)に62万円", oya.includes("62万円"));
  ok("FAQ(親)に136万円", oya.includes("136万円"));
  // 62万円+74万円=136万円の導出(扶養親族の所得要件はhitorioyaのfuyo_income_limitが正本)
  eq("136万円 = 62万+74万", D.hitorioya.fuyo_income_limit + J.kyuyo_shotoku_r8.flat_kojo, 1_360_000);
}

// 7-6. 改正の主張(callout): 85万→89万・令和8年分以後・附則2条
{
  const m = HTML.match(/<h2 id="kaisei">[\s\S]*?<div class="callout">([\s\S]*?)<\/div>/);
  ok("改正calloutがある", !!m);
  if (m) {
    const t = strip(m[1]);
    ok("改正calloutに85万円以下から89万円以下", t.includes("85万円以下から89万円以下"));
    ok("改正calloutに附則2条", t.includes("附則2条"));
    ok("改正calloutに令和8年分以後", t.includes("令和8年分以後"));
    ok("改正calloutに更正の請求", t.includes("更正の請求"));
  }
}

console.log(`test_kinro_gakusei: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
