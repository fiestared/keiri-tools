// 住民税非課税世帯の判定（/hikazei-setai/）のコア検証。
//
// オラクルは2つ。どちらもコアの式とは**別の形**で書く（同じ式を書き写すと検算にならない）。
//
//  ① 国税庁の「公的年金等に係る雑所得の速算表」（収入×率 − 控除額）
//     … コアは条文の形（イ＋ロ、最低保障で下支え）で計算している。**式の形が違う**ので、
//        全域で一致すれば読み違えていないと分かる（CLAUDE.md「外部オラクルで裏取りする」）。
//  ② 非課税限度額（基本額×人数＋10万＋加算額）を法文の順に素朴に書き下したもの
//     … コアは juminzei_core の hikazeiHantei に委ねているので、こちらで独立に組む。
//
// ★特に見張っているのは:
//   - 65歳以上の最低保障110万円（措法41条の15の3）を落とすこと＝年金世帯を丸ごと誤判定する
//   - 扶養に入れる所得の上限を旧48万円のまま使うこと
//   - 扶養の付け方を1通りに決め打ちして、非課税になる付け方を見落とすこと
//   - 子の所得で世帯が壊れるのに、未成年の135万円特例（295条1項2号）を落とすこと
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const D = JSON.parse(readFileSync(join(docs, "assets", "hikazei_setai_r08.json"), "utf8"));
const J = JSON.parse(readFileSync(join(docs, "assets", "juminzei_r08.json"), "utf8"));
const { calcHikazeiSetai, kokyoNenkinKojo, nenkinZatsuShotoku, choseiKojoNenkinKyuyo, nenkinBorder } =
  await import(join(docs, "assets", "hikazei_setai_core.js"));
const { kyuyoShotoku } = await import(join(docs, "assets", "juminzei_core.js"));

let pass = 0, fail = 0;
// ★落ちたときのメッセージに節番号を前置する。壊しテスト（break_hikazei_setai.mjs）は
//   「狙った検査が落ちたか」を出力の文字列一致で見るので、節見出し（"── §2 …"）と
//   区別できる形（"§2 …"）で出す必要がある。見出しと同じ文字列を使うと、
//   見出しは常に出力されるため**何を壊しても一致してしまう**（＝嘘の満点）。
let cur = "";
const ok = (c, msg) => { if (c) { pass++; } else { fail++; console.log(`❌ ${cur} ${msg}`); } };
const eq = (a, b, msg) => ok(a === b, `${msg}: ${a} ≠ ${b}`);
const sec = (s) => { cur = s.split(" ")[0]; console.log(`\n── ${s}`); };

// ───────────────────────────────────────────────────────────────────
// オラクル①: 国税庁「公的年金等に係る雑所得の速算表」（公的年金等以外の合計所得1,000万円以下）
// https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm
// ★コアの「イ＋ロ・最低保障」とは式の形が違う。
const ntaHayami = (shunyu, is65) => {
  const s = shunyu;
  if (is65) {
    if (s < 3300000) return Math.max(0, s - 1100000);
  } else {
    if (s < 1300000) return Math.max(0, s - 600000);
  }
  if (s < 4100000) return Math.max(0, s * 0.75 - 275000);
  if (s < 7700000) return Math.max(0, s * 0.85 - 685000);
  if (s < 10000000) return Math.max(0, s * 0.95 - 1455000);
  return Math.max(0, s - 1955000);
};

// オラクル②: 均等割の非課税限度額を法文の順に素朴に書き下す
//   施行令47条の3第1号 ＋ 施行規則9条の21第2項（級地倍率）
const KIHON = { 1: 350000, 2: 315000, 3: 280000 };
const KASAN = { 1: 210000, 2: 189000, 3: 168000 };
const limitOracle = (kyuchi, fuyoNinzu) =>
  KIHON[kyuchi] * (1 + fuyoNinzu) + 100000 + (fuyoNinzu > 0 ? KASAN[kyuchi] : 0);

const one = (m, kyuchi = 1) =>
  calcHikazeiSetai({ kyuchi, members: [m] }, D, J);

// ───────────────────────────────────────────────────────────────────
sec("§1 公的年金等控除 — 国税庁の速算表と全域で一致する（1,000円刻み・0〜1,500万円）");
{
  let mismatch65 = 0, mismatchU65 = 0, first65 = null, firstU65 = null;
  for (let s = 0; s <= 15000000; s += 1000) {
    const g65 = nenkinZatsuShotoku(s, 70, 0, D);
    const o65 = ntaHayami(s, true);
    if (g65 !== o65) { mismatch65++; if (!first65) first65 = [s, g65, o65]; }
    const gU = nenkinZatsuShotoku(s, 64, 0, D);
    const oU = ntaHayami(s, false);
    if (gU !== oU) { mismatchU65++; if (!firstU65) firstU65 = [s, gU, oU]; }
  }
  eq(mismatch65, 0, `65歳以上 15,001点で速算表と不一致 ${mismatch65}件 初回=${JSON.stringify(first65)}`);
  eq(mismatchU65, 0, `65歳未満 15,001点で速算表と不一致 ${mismatchU65}件 初回=${JSON.stringify(firstU65)}`);
}

sec("§2 最低保障額の読替え（措法41条の15の3第1項）— 65歳で110万円に切り替わる");
{
  // 収入がごく少ないときは最低保障がそのまま控除額になる
  eq(kokyoNenkinKojo(500000, 70, 0, D), 1100000, "65歳以上の最低保障");
  eq(kokyoNenkinKojo(500000, 64, 0, D), 600000, "65歳未満の最低保障");
  // ★年齢は「その年12月31日」の年齢（同条4項）。64歳と65歳で答えが反転する
  //   ここで 155万−60万＝95万 と書くのは誤り。65歳未満の最低保障60万円が効くのは収入130万円
  //   未満までで、それを超えると本則の「イ40万＋ロ25%」の方が大きくなる（速算表の
  //   130万〜410万の行＝収入×75%−27.5万に一致する）。§1が全域で速算表と突き合わせている。
  eq(nenkinZatsuShotoku(1550000, 64, 0, D), 887500, "64歳・年金155万円の雑所得（収入×75%−27.5万）");
  eq(nenkinZatsuShotoku(1550000, 65, 0, D), 450000, "65歳・年金155万円の雑所得（最低保障110万）");
  eq(nenkinZatsuShotoku(1200000, 64, 0, D), 600000, "64歳・年金120万円（最低保障60万が効く帯）");
  eq(nenkinZatsuShotoku(1200000, 65, 0, D), 100000, "65歳・年金120万円（最低保障110万）");
  // 年齢不明は安全側（65歳未満＝控除が小さい方）に倒す
  eq(nenkinZatsuShotoku(1550000, null, 0, D), 887500, "年齢未入力は65歳未満として扱う");
  // 以外の合計所得が1,000万円/2,000万円を超えると最低保障が下がる（イも下がる）
  eq(kokyoNenkinKojo(500000, 70, 10000000, D), 1100000, "以外所得ちょうど1,000万は1号のまま");
  eq(kokyoNenkinKojo(500000, 70, 10000001, D), 1000000, "以外所得1,000万超は2号（65歳以上100万）");
  eq(kokyoNenkinKojo(500000, 70, 20000001, D), 900000, "以外所得2,000万超は3号（65歳以上90万）");
  eq(kokyoNenkinKojo(500000, 64, 10000001, D), 500000, "同・65歳未満は50万");
  eq(kokyoNenkinKojo(500000, 64, 20000001, D), 400000, "同・65歳未満は40万");
}

sec("§3 有名な境界 — 1級地の単身が非課税でいられる上限");
{
  // 均等割の限度額は 35万＋10万＝45万円（1級地・扶養なし）
  eq(limitOracle(1, 0), 450000, "オラクル: 1級地・単身の限度額");
  const r155 = one({ label: "本人", age: 70, nenkinShunyu: 1550000 });
  eq(r155.rows[0].kintouLimit, 450000, "コアの限度額");
  eq(r155.rows[0].goukeiShotoku, 450000, "年金155万円の合計所得");
  ok(r155.setaiHikazei, "65歳以上・年金155万円ちょうどは非課税");
  ok(!one({ label: "本人", age: 70, nenkinShunyu: 1560000 }).setaiHikazei,
    "65歳以上・年金156万円は課税");
  ok(one({ label: "本人", age: 64, nenkinShunyu: 1050000 }).setaiHikazei,
    "65歳未満・年金105万円は非課税");
  ok(!one({ label: "本人", age: 64, nenkinShunyu: 1060000 }).setaiHikazei,
    "65歳未満・年金106万円は課税");
  // 給与だけの単身。給与所得控除の最低保障が65万円なので 45万＋65万＝110万円
  eq(kyuyoShotoku(1100000, J), 450000, "給与110万円の給与所得");
  ok(one({ label: "本人", age: 30, kyuyoShunyu: 1100000 }).setaiHikazei, "給与110万円は非課税");
  ok(!one({ label: "本人", age: 30, kyuyoShunyu: 1110000 }).setaiHikazei, "給与111万円は課税");
}

sec("§4 級地で限度額が変わる（施行規則9条の21第2項の1.0/0.9/0.8）");
{
  for (const k of [1, 2, 3]) {
    const r = one({ label: "本人", age: 70, nenkinShunyu: 1000000 }, k);
    eq(r.rows[0].kintouLimit, limitOracle(k, 0), `${k}級地・単身の限度額`);
  }
  // 2級地は41.5万円 → 年金151.5万円まで非課税
  ok(one({ label: "本人", age: 70, nenkinShunyu: 1515000 }, 2).setaiHikazei, "2級地・年金151.5万円");
  ok(!one({ label: "本人", age: 70, nenkinShunyu: 1516000 }, 2).setaiHikazei, "2級地・年金151.6万円");
  // 3級地は38万円 → 年金148万円まで
  ok(one({ label: "本人", age: 70, nenkinShunyu: 1480000 }, 3).setaiHikazei, "3級地・年金148万円");
  ok(!one({ label: "本人", age: 70, nenkinShunyu: 1490000 }, 3).setaiHikazei, "3級地・年金149万円");
}

sec("§5 扶養がいると加算額が乗る（高齢夫婦2人世帯）");
{
  eq(limitOracle(1, 1), 1010000, "オラクル: 1級地・扶養1人の限度額");
  // 夫が年金211万円・妻は年金0。妻は同一生計配偶者になれる（合計所得0 ≦ 58万円）
  const r = calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "夫", zokugara: "self", age: 70, nenkinShunyu: 2110000 },
      { label: "妻", zokugara: "spouse", age: 68, nenkinShunyu: 0 },
    ],
  }, D, J);
  eq(r.rows[0].kintouLimit, 1010000, "夫の限度額（妻を扶養に数える）");
  eq(r.rows[0].goukeiShotoku, 1010000, "夫の合計所得");
  ok(r.setaiHikazei, "夫の年金211万円ちょうどは非課税世帯");
  const over = calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "夫", zokugara: "self", age: 70, nenkinShunyu: 2120000 },
      { label: "妻", zokugara: "spouse", age: 68, nenkinShunyu: 0 },
    ],
  }, D, J);
  ok(!over.setaiHikazei, "夫の年金212万円は課税");
  eq(over.rows[0].chokaGaku, 10000, "あといくら下げれば非課税か");
}

sec("§6 ★子のアルバイト代が世帯の非課税を壊す（未成年なら壊れない）");
{
  const base = (childAge, childKyuyo) => calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "父", zokugara: "self", age: 45, kyuyoShunyu: 1500000 },
      { label: "子", zokugara: "child", age: childAge, kyuyoShunyu: childKyuyo },
    ],
  }, D, J);
  // 給与115万円 → 給与所得50万円。扶養（58万円以下）には入れるが、本人の限度額は45万円
  eq(kyuyoShotoku(1150000, J), 500000, "給与115万円の給与所得");
  const dai = base(19, 1150000);
  eq(dai.rows[1].goukeiShotoku, 500000, "19歳の子の合計所得");
  ok(!dai.rows[1].hikazei, "19歳の子は自分が均等割課税");
  ok(!dai.setaiHikazei, "→ 世帯は非課税世帯にならない");
  ok(dai.rows[0].hikazei, "父（限度額101万・所得85万）は非課税のまま");
  // 同じ収入でも未成年（18歳未満）なら合計所得135万円以下で非課税（地税295条1項2号）
  const ko = base(17, 1150000);
  ok(ko.rows[1].jonrei295, "17歳は295条1項2号（未成年）で非課税");
  ok(ko.setaiHikazei, "→ 同じ収入でも世帯は非課税");
  // 135万円という額そのものを固定する（125万円などに取り違えたら落ちる境界）。
  //   給与200万円 → 給与所得132万円。135万円以下なので未成年は非課税、
  //   135万円を125万円に取り違えると同じ人が課税に転ぶ。
  eq(kyuyoShotoku(2000000, J), 1320000, "給与200万円の給与所得");
  const kyokai = base(17, 2000000);
  ok(kyokai.rows[1].jonrei295, "17歳・合計所得132万円は135万円以下なので非課税");
  ok(kyokai.rows[1].hikazei, "→ 子は均等割非課税（135万円を125万円に取り違えたら転ぶ）");
  // ★世帯は非課税にならない。子の合計所得132万円は扶養の上限58万円を超えるので、
  //   父は子を扶養に数えられず限度額45万円のまま（給与所得85万円）＝父が課税になる。
  ok(!kyokai.rows[0].hikazei, "父は子を扶養に数えられないので課税");
  ok(!kyokai.setaiHikazei, "→ 世帯は非課税ではない");
  // 未成年でも135万円を超えれば課税になる
  const takai = base(17, 2500000);
  ok(takai.rows[1].goukeiShotoku > 1350000, "給与250万円は合計所得135万円超");
  ok(!takai.rows[1].jonrei295, "→ 未成年でも295条1項2号は効かない");
  ok(!takai.rows[1].hikazei, "→ 未成年でも課税");
}

sec("§7 ★扶養の付け方で世帯の判定が変わる（決め打ちでは外す）");
{
  // 夫の合計所得100万・妻60万・子2人（1級地）
  //   子2人を夫にまとめる → 夫の限度額136万で非課税だが、妻は限度額45万で課税 → 世帯課税
  //   子を1人ずつ分ける   → 夫も妻も限度額101万 → どちらも非課税 → 世帯非課税
  const r = calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "夫", zokugara: "self", age: 50, sonotaShotoku: 1000000 },
      { label: "妻", zokugara: "other", age: 48, sonotaShotoku: 600000 },
      { label: "子A", zokugara: "child", age: 10 },
      { label: "子B", zokugara: "child", age: 8 },
    ],
  }, D, J);
  ok(r.setaiHikazei, "付け替えれば非課税世帯になる");
  ok(r.fuyoTsukekaeDeKawaru, "★『所得が多い人にまとめる』決め打ちでは課税になると分かる");
  eq(r.rows[0].kintouLimit, 1010000, "夫の限度額（子1人を扶養）");
  eq(r.rows[1].kintouLimit, 1010000, "妻の限度額（子1人を扶養）");
  // どう付けても課税になるケースでは fuyoTsukekaeDeKawaru は立たない
  const dame = calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "夫", zokugara: "self", age: 50, sonotaShotoku: 2000000 },
      { label: "妻", zokugara: "spouse", age: 48, sonotaShotoku: 600000 },
    ],
  }, D, J);
  ok(!dame.setaiHikazei, "妻の所得60万＞45万でどう付けても課税");
  ok(!dame.fuyoTsukekaeDeKawaru, "付け替えの提案は出さない");
  // 妻が58万円以下なら夫の扶養に入れて、妻自身も45万円以下なので世帯非課税
  const okc = calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "夫", zokugara: "self", age: 50, sonotaShotoku: 1000000 },
      { label: "妻", zokugara: "spouse", age: 48, sonotaShotoku: 400000 },
    ],
  }, D, J);
  ok(okc.setaiHikazei, "妻の所得40万なら世帯非課税");
  // ★互いに扶養し合うことはしない（同じ人を二重に数えないための fail closed の仮定）。
  //   夫婦とも合計所得50万円（＞限度額45万・≦扶養の上限58万）。互いを扶養に数えられるなら
  //   両方の限度額が101万円になって世帯非課税になるが、このツールはそれを認めない。
  const gojo = calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "夫", zokugara: "self", age: 70, sonotaShotoku: 500000 },
      { label: "妻", zokugara: "spouse", age: 68, sonotaShotoku: 500000 },
    ],
  }, D, J);
  ok(!gojo.setaiHikazei, "★互いを扶養に数えることはしない（安全側に倒す）");
  ok(gojo.rows.filter((r) => !r.hikazei).length === 1, "片方だけが扶養する形が最善");
}

sec("§8 扶養に入れる所得の上限は58万円（旧48万円ではない）");
{
  eq(D.fuyo_yoken.goukei_shotoku_ika, 580000, "参照データの上限");
  // 妻の合計所得55万円。48万円のままなら扶養に数えられず、夫の限度額が45万円になって課税に転ぶ
  const mk = (wife) => calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "夫", zokugara: "self", age: 50, sonotaShotoku: 1000000 },
      { label: "妻", zokugara: "spouse", age: 48, sonotaShotoku: wife },
    ],
  }, D, J);
  eq(mk(550000).rows[0].kintouLimit, 1010000, "妻の所得55万円 → 夫は扶養1人で101万円");
  eq(mk(580000).rows[0].kintouLimit, 1010000, "妻の所得58万円ちょうども扶養に入る");
  eq(mk(590000).rows[0].kintouLimit, 450000, "妻の所得59万円は扶養に入れない");
}

sec("§9 所得金額調整控除（措法41条の3の11第2項・給与と年金の両方がある人）");
{
  eq(choseiKojoNenkinKyuyo(0, 500000, D), 0, "給与がなければ効かない");
  eq(choseiKojoNenkinKyuyo(500000, 0, D), 0, "年金がなければ効かない");
  eq(choseiKojoNenkinKyuyo(50000, 40000, D), 0, "合計が10万円以下なら効かない");
  eq(choseiKojoNenkinKyuyo(60000, 60000, D), 20000, "合計12万円 → 2万円");
  eq(choseiKojoNenkinKyuyo(500000, 500000, D), 100000, "両方10万円超 → 上限10万円");
  // 65歳以上・年金160万円（雑所得50万）＋給与70万円（給与所得5万）
  //   調整控除 = min(5万,10万)+min(50万,10万)-10万 = 0円（給与所得5万＋年金10万=15万>10万 → 5万+10万-10万=5万）
  const r = one({ label: "本人", age: 70, nenkinShunyu: 1600000, kyuyoShunyu: 700000 });
  eq(r.rows[0].kyuyoShotoku, 50000, "給与70万円の給与所得");
  eq(r.rows[0].nenkinShotoku, 500000, "年金160万円の雑所得");
  eq(r.rows[0].choseiKojo, 50000, "所得金額調整控除");
  eq(r.rows[0].goukeiShotoku, 500000, "合計所得（5万＋50万−5万）");
}

sec("§10 年金だけの人が非課税でいられる上限を逆算する（画面の目安）");
{
  eq(nenkinBorder(70, 1, 0, false, D, J).shunyuMax, 1550000, "1級地・単身・65歳以上");
  eq(nenkinBorder(64, 1, 0, false, D, J).shunyuMax, 1050000, "1級地・単身・65歳未満");
  eq(nenkinBorder(70, 1, 0, true, D, J).shunyuMax, 2110000, "1級地・夫婦（配偶者を扶養）");
  eq(nenkinBorder(70, 3, 0, false, D, J).shunyuMax, 1480000, "3級地・単身・65歳以上");
  // 逆算の結果が本当に非課税かを、本物の判定で検算する（式を二重に持たない）
  for (const [age, kyuchi] of [[70, 1], [64, 1], [70, 2], [70, 3], [64, 3]]) {
    const b = nenkinBorder(age, kyuchi, 0, false, D, J);
    ok(one({ label: "本人", age, nenkinShunyu: b.shunyuMax }, kyuchi).setaiHikazei,
      `逆算値ちょうどは非課税 (age=${age} 級地=${kyuchi})`);
    ok(!one({ label: "本人", age, nenkinShunyu: b.shunyuMax + 1 }, kyuchi).setaiHikazei,
      `逆算値+1円は課税 (age=${age} 級地=${kyuchi})`);
  }
}

sec("§11 fail closed — 参照データが無ければ計算しない");
{
  let threw = 0;
  // ★「何か例外が出た」では足りない。参照データ欠落は**明示のガード**で止めること
  //   （落ちる場所によっては TypeError で偶然止まるだけになり、ガードを外しても検査が緑になる）。
  for (const [d, j] of [[null, J], [D, null]]) {
    try {
      calcHikazeiSetai({ members: [{}] }, d, j);
    } catch (e) {
      if (String(e.message).includes("参照データ")) threw++;
      else console.log(`  （明示のガードでなく ${e.constructor.name} で止まっている: ${e.message}）`);
    }
  }
  try { calcHikazeiSetai({ members: [] }, D, J); } catch { threw++; }
  try {
    calcHikazeiSetai({ members: new Array(D.hantei.max_members + 1).fill({}) }, D, J);
  } catch { threw++; }
  eq(threw, 4, "データ欠落・世帯0人・人数超過で必ず throw する");
  // 負の入力・文字列・NaN を素通しして NaN を答えにしない
  const r = one({ label: "本人", age: 70, nenkinShunyu: -100, kyuyoShunyu: "abc", sonotaShotoku: NaN });
  eq(r.rows[0].goukeiShotoku, 0, "不正な入力は0として扱う");
  ok(r.setaiHikazei, "所得0は非課税");
}

sec("§12 世帯全員が非課税でなければ非課税世帯ではない（所得割ではなく均等割で見る）");
{
  eq(D.hantei.kijun, "kintouwari", "判定の基準は均等割");
  // 所得割は非課税だが均等割は課税、という帯（所得割の加算32万＞均等割の加算21万）でも
  // 非課税世帯にはならない
  const r = calcHikazeiSetai({
    kyuchi: 1,
    members: [
      { label: "本人", zokugara: "self", age: 40, sonotaShotoku: 1100000 },
      { label: "子", zokugara: "child", age: 5 },
    ],
  }, D, J);
  eq(r.rows[0].kintouLimit, 1010000, "均等割の限度額（35万×2＋10万＋21万）");
  ok(!r.rows[0].hikazei, "合計所得110万は均等割の限度額を超える");
  ok(!r.setaiHikazei, "→ 非課税世帯ではない（所得割の限度額は112万で非課税でも）");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
