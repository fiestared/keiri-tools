// ひとり親控除・寡婦控除 hitorioyaKafu のテスト。
//
// オラクルは実装の式ではなく**条文を判定順そのまま書き下した独立実装**:
//  - 定義: 所得税法2条1項30号(寡婦)・31号(ひとり親)。e-Govの現行版とR8-12-01施行版で
//    条文md5完全一致を確認済み(2026-07-23逐語取得)。
//  - 額: 81条=35万円・80条=27万円。住民税は地方税法34条1項8号の2(30万円)・8号(26万円)。
//    オラクルは**額を定数で持つ**(参照データを見ない)ので、データ側の改変も捕まえる。
//  - 子の要件62万円: 所令11条の2第2項(R8-12-01施行版)。令和8年政令93号 附則2条で
//    令和8年分以後に適用。
//  - 事実婚: 規則1条の3・1条の4(住民票の「未届の夫・妻」)。
// さらに節税額のシナリオは速算表から**手計算した定数**でも固定する(第三の網)。
// 住民税非課税135万円(地税24条の5・295条)は juminzei_core.hikazeiHantei との結合で確かめる。
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { hitorioyaKafu, taxSavingSplit } from "../docs/assets/setsuzei_core.js";
import { kyuyoShotokuR8, hikazeiHantei, shotokuzeiKisoKojo } from "../docs/assets/juminzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/setsuzei_r08.json", import.meta.url)));
const J = JSON.parse(readFileSync(new URL("../docs/assets/juminzei_r08.json", import.meta.url)));
const HTML = readFileSync(new URL("../docs/hitorioya-kojo/index.html", import.meta.url), "utf8");

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  try { assert.deepEqual(got, want); pass++; }
  catch { fail++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const ok = (name, cond) => eq(name, !!cond, true);

// ---- オラクル(条文の書き下し・独立実装) ------------------------------------

// 額は条文の定数(参照データを見ない): 81条=35万 / 80条=27万 / 地税34条1項8号の2=30万 / 8号=26万
const ORACLE_AMOUNTS = {
  hitorioya: { shotoku: 350_000, jumin: 300_000 },
  kafu: { shotoku: 270_000, jumin: 260_000 },
};
const ORACLE_LIMIT = 5_000_000; // 30号イ(2)・31号ロ

function oracleHantei(input) {
  // 30号・31号とも「現に婚姻をしていない者」等が前提。婚姻中は入口で外れる。
  if (input.marital === "kikon") return { type: "none" };
  // 30号イ(3)・31号ハ: 事実婚の相手(規則1条の3・1条の4)がいれば対象外
  if (input.jijitsukon) return { type: "none" };
  // 30号イ(2)・31号ロ: 合計所得金額500万円以下
  if (input.gokeiShotoku > ORACLE_LIMIT) return { type: "none" };
  // 31号イ: 生計を一にする子(所令11条の2第2項=62万円以下・他の者の同一生計配偶者/扶養親族でない)
  // → 未婚・離婚・死別・生死不明のすべてが対象。性別を問わない
  if (input.child === "qualified") return { type: "hitorioya", ...ORACLE_AMOUNTS.hitorioya };
  // 30号柱書き: 寡婦は「ひとり親に該当しないもの」。条文が「夫と離婚」「夫と死別」= 女性のみ
  if (input.sex !== "female") return { type: "none" };
  // 30号イ: 離婚型は「扶養親族を有すること」が要件
  if (input.marital === "rikon") {
    return input.otherFuyo ? { type: "kafu", ...ORACLE_AMOUNTS.kafu } : { type: "none" };
  }
  // 30号ロ: 死別・夫の生死不明(所令11条)は扶養親族不要
  if (input.marital === "shibetsu" || input.marital === "fumei") {
    return { type: "kafu", ...ORACLE_AMOUNTS.kafu };
  }
  // 未婚(結婚したことがない)は30号のどの型にも当たらない
  return { type: "none" };
}

// ---- 1. 全組み合わせ総当たり ----------------------------------------------
// 2性別 × 5婚姻 × 2事実婚 × 3子 × 2扶養 × 6所得 = 720通り。
// 所得は500万円の両側1円と非課税135万円の両側1円を含める。
const SEXES = ["female", "male"];
const MARITALS = ["mikon", "rikon", "shibetsu", "fumei", "kikon"];
const CHILDREN = ["none", "qualified", "not_qualified"];
const INCOMES = [0, 1_350_000, 1_350_001, 4_999_999, 5_000_000, 5_000_001];

let combos = 0, comboFails = 0;
for (const sex of SEXES) for (const marital of MARITALS)
for (const jijitsukon of [false, true]) for (const child of CHILDREN)
for (const otherFuyo of [false, true]) for (const gokeiShotoku of INCOMES) {
  const input = { sex, marital, jijitsukon, child, otherFuyo, gokeiShotoku };
  const want = oracleHantei(input);
  const got = hitorioyaKafu(input, D);
  combos++;
  const same = got.type === want.type &&
    (want.type === "none" || (got.shotoku === want.shotoku && got.jumin === want.jumin));
  if (!same) {
    comboFails++;
    if (comboFails <= 5) console.log(`  ✗ 総当たり ${JSON.stringify(input)}: got ${got.type}/${got.shotoku}/${got.jumin} want ${want.type}/${want.shotoku ?? 0}/${want.jumin ?? 0}`);
  }
}
eq(`総当たり ${combos}通り 全一致`, comboFails, 0);

// ---- 2. 名指しの判定シナリオ(型と理由) -------------------------------------
const s1 = hitorioyaKafu({ sex: "female", marital: "rikon", jijitsukon: false, child: "qualified", otherFuyo: false, gokeiShotoku: 2_020_000 }, D);
eq("離婚シングルマザー(子あり) → ひとり親", [s1.type, s1.shotoku, s1.jumin], ["hitorioya", 350_000, 300_000]);

const s2 = hitorioyaKafu({ sex: "male", marital: "mikon", jijitsukon: false, child: "qualified", otherFuyo: false, gokeiShotoku: 3_000_000 }, D);
eq("未婚の父 → ひとり親(性別・未婚を問わない)", s2.type, "hitorioya");

const s3 = hitorioyaKafu({ sex: "female", marital: "shibetsu", jijitsukon: false, child: "none", otherFuyo: false, gokeiShotoku: 3_000_000 }, D);
eq("死別・子なし・扶養なし女性 → 寡婦(30号ロ=扶養不要)", [s3.type, s3.shotoku, s3.jumin], ["kafu", 270_000, 260_000]);

const s4 = hitorioyaKafu({ sex: "male", marital: "shibetsu", jijitsukon: false, child: "none", otherFuyo: false, gokeiShotoku: 3_000_000 }, D);
eq("死別・子なし男性 → 対象外(寡婦は女性のみ)", s4.type, "none");

const s5 = hitorioyaKafu({ sex: "female", marital: "rikon", jijitsukon: false, child: "not_qualified", otherFuyo: false, gokeiShotoku: 2_000_000 }, D);
eq("★子を別れた夫の扶養に入れている離婚母(他に扶養なし) → どちらも対象外", [s5.type, s5.reason], ["none", "rikon_no_fuyo"]);

const s6 = hitorioyaKafu({ sex: "female", marital: "rikon", jijitsukon: false, child: "not_qualified", otherFuyo: true, gokeiShotoku: 2_000_000 }, D);
eq("同上だが母親(扶養親族)を養っている → 寡婦", s6.type, "kafu");

const s7 = hitorioyaKafu({ sex: "female", marital: "shibetsu", jijitsukon: false, child: "qualified", otherFuyo: false, gokeiShotoku: 2_000_000 }, D);
eq("死別+子あり → 寡婦でなくひとり親(30号柱書き)", s7.type, "hitorioya");

const s8 = hitorioyaKafu({ sex: "female", marital: "mikon", jijitsukon: false, child: "none", otherFuyo: true, gokeiShotoku: 1_000_000 }, D);
eq("未婚・子なし(扶養親族あり) → 対象外(寡婦は離婚・死別・生死不明のみ)", s8.type, "none");

const s9 = hitorioyaKafu({ sex: "female", marital: "rikon", jijitsukon: true, child: "qualified", otherFuyo: false, gokeiShotoku: 1_000_000 }, D);
eq("事実婚の相手あり → 対象外", [s9.type, s9.reason], ["none", "jijitsukon"]);

const s10 = hitorioyaKafu({ sex: "female", marital: "fumei", jijitsukon: false, child: "none", otherFuyo: false, gokeiShotoku: 4_000_000 }, D);
eq("夫が生死不明(政令列挙)・子なし → 寡婦", s10.type, "kafu");

// 500万円ちょうどは受けられる(「以下」)。1円超えたら全額対象外
eq("合計所得500万円ちょうど → ひとり親",
  hitorioyaKafu({ sex: "female", marital: "rikon", jijitsukon: false, child: "qualified", otherFuyo: false, gokeiShotoku: 5_000_000 }, D).type, "hitorioya");
eq("合計所得500万1円 → 対象外",
  hitorioyaKafu({ sex: "female", marital: "rikon", jijitsukon: false, child: "qualified", otherFuyo: false, gokeiShotoku: 5_000_001 }, D).reason, "income_over");

// 参照データ無しは黙って答えない
ok("データ無しで throw", (() => { try { hitorioyaKafu({}, null); return false; } catch { return true; } })());

// ---- 3. 節税額シナリオ(速算表からの手計算定数=第三の網) ---------------------
// 課税所得150万(5%帯): ひとり親 17,500+367+30,000=47,867 / 寡婦 13,500+283+26,000=39,783
// 課税所得250万(10%帯): ひとり親 35,000+735+30,000=65,735 / 寡婦 27,000+567+26,000=53,567
// 課税所得400万(20%帯): ひとり親 70,000+1,470+30,000=101,470 / 寡婦 54,000+1,134+26,000=81,134
const SAVING_CASES = [
  { kazei: 1_500_000, type: "hitorioya", total: 47_867, shotokuGen: 17_500, fukkoGen: 367, juminGen: 30_000 },
  { kazei: 1_500_000, type: "kafu", total: 39_783, shotokuGen: 13_500, fukkoGen: 283, juminGen: 26_000 },
  { kazei: 2_500_000, type: "hitorioya", total: 65_735, shotokuGen: 35_000, fukkoGen: 735, juminGen: 30_000 },
  { kazei: 2_500_000, type: "kafu", total: 53_567, shotokuGen: 27_000, fukkoGen: 567, juminGen: 26_000 },
  { kazei: 4_000_000, type: "hitorioya", total: 101_470, shotokuGen: 70_000, fukkoGen: 1_470, juminGen: 30_000 },
  { kazei: 4_000_000, type: "kafu", total: 81_134, shotokuGen: 54_000, fukkoGen: 1_134, juminGen: 26_000 },
];
for (const c of SAVING_CASES) {
  const k = ORACLE_AMOUNTS[c.type];
  const t = taxSavingSplit({ kazeiShotoku: c.kazei, shotokuKojo: k.shotoku, juminKojo: k.jumin }, D);
  eq(`節税額 課税所得${c.kazei / 10_000}万・${c.type}`,
    [t.total, t.shotokuGen, t.fukkoGen, t.juminGen],
    [c.total, c.shotokuGen, c.fukkoGen, c.juminGen]);
}

// ---- 4. 給与収入→合計所得の境界(令和8年分・コアで機械確認) -----------------
// ページ・記事が主張する境界: 子62万円⇔給与136万円 / 非課税135万円⇔給与209万円 /
// 本人500万円⇔給与677万7,777円
eq("給与136万円 → 所得62万円(子の上限ちょうど)", kyuyoShotokuR8(1_360_000, J), 620_000);
eq("給与136万1円 → 62万円超", kyuyoShotokuR8(1_360_001, J) > 620_000, true);
eq("給与190万円 → 所得116万円(記事の例)", kyuyoShotokuR8(1_900_000, J), 1_160_000);
eq("給与209万円 → 所得135万円(非課税ラインちょうど)", kyuyoShotokuR8(2_090_000, J), 1_350_000);
eq("給与209万1円 → 135万円超", kyuyoShotokuR8(2_090_001, J) > 1_350_000, true);
eq("給与300万円 → 所得202万円(E2Eシーン)", kyuyoShotokuR8(3_000_000, J), 2_020_000);
eq("給与677万7,777円 → 所得500万円ちょうど", kyuyoShotokuR8(6_777_777, J), 5_000_000);
eq("給与677万7,778円 → 500万円超", kyuyoShotokuR8(6_777_778, J) > 5_000_000, true);

// ---- 5. 住民税非課税135万円(hikazeiHanteiとの結合) --------------------------
eq("非課税の正本データ=135万円", J.hikazei.shogaisha_goukei_limit, 1_350_000);
ok("ひとり親(母)・合計所得135万円ちょうど → 非課税",
  hikazeiHantei(1_350_000, 1_350_000, { hitorioyaHaha: true }, "1", J).jonrei295);
ok("ひとり親(母)・135万1円 → 非課税でない",
  !hikazeiHantei(1_350_001, 1_350_001, { hitorioyaHaha: true }, "1", J).jonrei295);
ok("ひとり親(父)・135万円 → 非課税",
  hikazeiHantei(1_350_000, 1_350_000, { hitorioyaChichi: true }, "1", J).jonrei295);
ok("寡婦・135万円 → 非課税",
  hikazeiHantei(1_350_000, 1_350_000, { kafu: true }, "1", J).jonrei295);
ok("該当なし(独身等)・所得100万円 → 135万円特例は効かない",
  !hikazeiHantei(1_000_000, 1_000_000, {}, "1", J).jonrei295);

// ---- 6. ページの数値主張の照合(記事表・例をコアで再計算) --------------------
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
const num = (s) => Number(String(s).replace(/[,，]/g, ""));

// 節税額の例の表: 行を課税所得のセルで名指しして、6つの合計値と内訳を照合(規則3・4)
for (const c of [
  { man: 150, rate: "5%" }, { man: 250, rate: "10%" }, { man: 400, rate: "20%" },
]) {
  const row = HTML.match(new RegExp(`<tr><td><b>${c.man}万円</b>（税率${c.rate}）</td>(.*?)</tr>`, "s"));
  ok(`例の表 ${c.man}万円の行が存在`, row);
  if (!row) continue;
  const h = taxSavingSplit({ kazeiShotoku: c.man * 10_000, shotokuKojo: 350_000, juminKojo: 300_000 }, D);
  const k = taxSavingSplit({ kazeiShotoku: c.man * 10_000, shotokuKojo: 270_000, juminKojo: 260_000 }, D);
  const cells = [...row[1].matchAll(/<td>(.*?)<\/td>/gs)].map((m) => strip(m[1]));
  // cells: [ひとり親内訳, ひとり親合計, 寡婦内訳, 寡婦合計]
  ok(`表 ${c.man}万 ひとり親内訳`, cells[0].includes(h.shotokuGen.toLocaleString("ja-JP")) &&
    cells[0].includes(h.fukkoGen.toLocaleString("ja-JP")) && cells[0].includes(h.juminGen.toLocaleString("ja-JP")));
  eq(`表 ${c.man}万 ひとり親合計`, num(cells[1].match(/([\d,]+)円/)?.[1]), h.total);
  ok(`表 ${c.man}万 寡婦内訳`, cells[2].includes(k.shotokuGen.toLocaleString("ja-JP")) &&
    cells[2].includes(k.fukkoGen.toLocaleString("ja-JP")) && cells[2].includes(k.juminGen.toLocaleString("ja-JP")));
  eq(`表 ${c.man}万 寡婦合計`, num(cells[3].match(/([\d,]+)円/)?.[1]), k.total);
}

// 年収190万円の例(noteを名指し): 給与所得116万・基礎控除104万・控除なしなら所得税6,126円
{
  const note = HTML.match(/<div class="note">\s*<b>年収190万円のシングルマザーは、所得税も住民税も0円になります。<\/b>(.*?)<\/div>/s);
  ok("190万円の例のnoteが存在", note);
  if (note) {
    const t = strip(note[1]);
    const shotoku = kyuyoShotokuR8(1_900_000, J);
    eq("例: 給与所得116万円", shotoku, 1_160_000);
    const kiso = shotokuzeiKisoKojo(shotoku, J, "r8");
    eq("例: 基礎控除104万円(R8)", kiso, 1_040_000);
    ok("noteに116万円", t.includes("116万円"));
    ok("noteに104万円", t.includes("104万円"));
    // 課税所得0(116万<104万+35万)を機械で確認
    ok("課税所得が0になる", shotoku - kiso - 350_000 <= 0);
    // ひとり親控除なしなら: (116万-104万)=12万 → 5%=6,000円 + 復興126円 = 6,126円
    const zei = Math.floor(120_000 * 0.05);
    eq("例: 控除なしの所得税6,126円", zei + Math.floor(zei * 0.021), 6_126);
    ok("noteに6,126円", t.includes("6,126円"));
    // 住民税非課税(116万≦135万)
    ok("例: 非課税に該当", hikazeiHantei(shotoku, shotoku, { hitorioyaHaha: true }, "1", J).jonrei295);
  }
}

// 本文の境界の主張(677万7,777円/209万円/136万円/62万円)が本文に存在し、コアの境界と一致する
ok("本文に677万7,777円(500万円の給与換算)", HTML.includes("677万7,777円"));
ok("本文に209万円(非課税の給与換算)", HTML.includes("209万円"));
ok("本文に136万円(子の給与換算)", HTML.includes("136万円"));

// データとオラクル定数の一致(データ改変の検出)
eq("データの額=条文の額", [
  D.hitorioya.kojo.hitorioya.shotoku, D.hitorioya.kojo.hitorioya.jumin,
  D.hitorioya.kojo.kafu.shotoku, D.hitorioya.kojo.kafu.jumin,
  D.hitorioya.income_limit, D.hitorioya.child_income_limit, D.hitorioya.fuyo_income_limit,
], [350_000, 300_000, 270_000, 260_000, 5_000_000, 620_000, 620_000]);

// 子の給与換算136万円=62万円+定額控除74万円がデータから導けること(ページの導出と同じ式)
eq("child 62万+flat 74万 = 136万", D.hitorioya.child_income_limit + J.kyuyo_shotoku_r8.flat_kojo, 1_360_000);
// 非課税の給与換算209万円=135万円+74万円
eq("hikazei 135万+flat 74万 = 209万", J.hikazei.shogaisha_goukei_limit + J.kyuyo_shotoku_r8.flat_kojo, 2_090_000);

console.log(`\ntest_hitorioya: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
