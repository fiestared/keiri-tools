/**
 * 源泉徴収票「③所得控除の額の合計額」検算コアの検査。
 *
 * このツールが黙って誤答する向きは1つに絞れる:
 *   **合っていないのに「合っています」と答える**（＝利用者が票の誤りを見逃す）。
 * よってマイナスの差額を0に丸めないこと、③未入力で0円と答えないこと、
 * 法律上ありえない控除の組み合わせで残差を説明しないことを重点的に固定する。
 *
 * 検査の作り:
 *   §1 データの自己整合（金額が条文どおり・区分の重複が無い）
 *   §2 印字欄の合計（欠けた欄を0として扱い、勝手に補完しない）
 *   §3 人数→金額（内書きの区分が独立に効く・負や小数の人数を弾く）
 *   §4 残差の説明（排他の組み合わせを出さない・少ない控除数から示す）
 *   §5 手計算の鎖（看板例を票の欄から手で積み上げた額と突き合わせる）
 *   §6 マイナスの差額（住宅ローン控除・所得金額調整控除を足した誤りを潰さない）
 *   §7 fail closed（データ無し・③未入力）
 *   §8 国税庁タックスアンサーの明文との照合（額の逐語）
 *   §9 データ⇔ページの結合（票の欄名と金額がページ上に同じ値で出ている）
 */
import { readFileSync } from "node:fs";
import { checkSanKojo, printedTotal, countsToYen, explainRemainder } from "../docs/assets/gensen_kojo_check_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/gensen_kojo_r07.json", import.meta.url)));
const PAGE = readFileSync(new URL("../docs/column/gensen-choshuhyo-mikata/index.html", import.meta.url), "utf8");
const visible = PAGE.replace(/<[^>]+>/g, " ");

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);
const throws = (name, fn) => { try { fn(); fails.push(`${name}（例外が飛ばなかった）`); } catch { pass++; } };

const A = (group, key) => D[group].kubun.find((k) => k.key === key).amount;

// ───────────────────────────── §1 データの自己整合
{
  eq("§1 扶養控除 一般", A("fuyo", "ippan"), 380000);
  eq("§1 扶養控除 特定", A("fuyo", "tokutei"), 630000);
  eq("§1 扶養控除 老人", A("fuyo", "rojin"), 480000);
  eq("§1 扶養控除 同居老親等", A("fuyo", "dokyo_rojin"), 580000);
  eq("§1 障害者控除 一般", A("shogaisha", "shogaisha"), 270000);
  eq("§1 障害者控除 特別", A("shogaisha", "tokubetsu"), 400000);
  eq("§1 障害者控除 同居特別", A("shogaisha", "dokyo_tokubetsu"), 750000);

  // 同居加算の関係（79条・84条の構造。逆転していたら区分の取り違え）
  ok("§1 同居老親等 > 老人", A("fuyo", "dokyo_rojin") > A("fuyo", "rojin"));
  ok("§1 同居特別障害者 > 特別障害者 > 障害者",
    A("shogaisha", "dokyo_tokubetsu") > A("shogaisha", "tokubetsu") &&
    A("shogaisha", "tokubetsu") > A("shogaisha", "shogaisha"));

  // key の重複が無い（重複すると人数が二重に効く）
  const keys = [...D.fuyo.kubun, ...D.shogaisha.kubun, ...D.hyoji_nashi.kubun].map((k) => k.key);
  eq("§1 区分キーが一意", new Set(keys).size, keys.length);

  // ★住宅借入金等特別控除をデータに持っていないこと（持つと③に足せてしまう＝設計上の禁止）
  ok("§1 住宅ローン控除をデータに持たない", !JSON.stringify(D.hyoji_nashi).includes("住宅"));

  ok("§1 _meta に年分と出典と次回見直しがある",
    !!D._meta.year && !!D._meta.source && !!D._meta.next_review);
}

// ───────────────────────────── §2 印字欄の合計
{
  const p = printedTotal({ shakaiHoken: 750000, seimeiHoken: 40000, jishinHoken: 20000, kisoKojo: 580000 });
  eq("§2 印字4欄の合計", p.total, 1390000);
  eq("§2 未入力の欄は0で並ぶ（欄そのものは消さない）", p.items.length, 6);
  eq("§2 未入力の欄の額は0", p.items.find((i) => i.key === "haigusha").amount, 0);
  eq("§2 空オブジェクトの合計は0", printedTotal({}).total, 0);
  // 文字列で来ても数として読む（フォーム入力は文字列）
  eq("§2 文字列入力", printedTotal({ shakaiHoken: "750000" }).total, 750000);
  // 非数を勝手に大きい数にしない
  eq("§2 非数は0", printedTotal({ shakaiHoken: "あ" }).total, 0);
}

// ───────────────────────────── §3 人数→金額
{
  eq("§3 一般1人", countsToYen({ ippan: 1 }, D).total, 380000);
  eq("§3 特定2人", countsToYen({ tokutei: 2 }, D).total, 1260000);
  // 内書きの区分は独立に受け取る（老人1＋同居老親等1＝別々の2人ぶん）
  eq("§3 老人1＋同居老親等1", countsToYen({ rojin: 1, dokyo_rojin: 1 }, D).total, 480000 + 580000);
  eq("§3 扶養と障害者の合算", countsToYen({ ippan: 1, tokubetsu: 1 }, D).total, 380000 + 400000);
  eq("§3 負の人数は0", countsToYen({ ippan: -3 }, D).total, 0);
  eq("§3 小数の人数は切り捨て", countsToYen({ ippan: 1.9 }, D).total, 380000);
  eq("§3 人数0の区分は明細に出さない", countsToYen({ ippan: 1, tokutei: 0 }, D).items.length, 1);
  throws("§3 データ無しでは計算しない", () => countsToYen({ ippan: 1 }, null));
}

// ───────────────────────────── §4 残差の説明
{
  const one = explainRemainder(350000, D);
  eq("§4 35万はひとり親で説明できる", one[0].keys.join(), "hitorioya");

  // ★27万は「寡婦」「勤労学生」「本人が障害者」の3通りある。1つに決めつけない
  const k27 = explainRemainder(270000, D).filter((h) => h.keys.length === 1).map((h) => h.keys[0]).sort();
  eq("§4 27万の単独解は3通り", k27.join(), "honnin_shogaisha,kafu,kinro_gakusei");

  // ★排他: 寡婦(27万)＋ひとり親(35万)=62万 は法律上ありえない（80条柱書き）
  ok("§4 寡婦＋ひとり親の組を出さない",
    explainRemainder(620000, D).every((h) => !(h.keys.includes("kafu") && h.keys.includes("hitorioya"))));
  // ★排他: 本人の障害者(27万)＋特別障害者(40万)=67万 もありえない（79条）
  ok("§4 本人の障害者＋特別障害者の組を出さない",
    explainRemainder(670000, D).every(
      (h) => !(h.keys.includes("honnin_shogaisha") && h.keys.includes("honnin_tokubetsu_shogaisha"))));

  // 併用できる組は出す（ひとり親35万＋本人が特別障害者40万＝75万）
  ok("§4 ひとり親＋本人特別障害者は出す",
    explainRemainder(750000, D).some((h) => h.keys.includes("hitorioya") && h.keys.includes("honnin_tokubetsu_shogaisha")));

  // 少ない控除数から示す
  const many = explainRemainder(620000, D);
  ok("§4 控除数の少ない解が先", many.length === 0 || many[0].keys.length <= many[many.length - 1].keys.length);

  eq("§4 説明できない額は0件", explainRemainder(12345, D).length, 0);
  eq("§4 残差0は0件（説明不要）", explainRemainder(0, D).length, 0);
}

// ───────────────────────────── §5 手計算の鎖（看板例）
{
  // 票の欄:
  //   社会保険料等 750,000 ／ 生命保険料 40,000 ／ 地震保険料 20,000
  //   配偶者(特別)控除 380,000 ／ 基礎控除 580,000
  //   控除対象扶養親族の数: 特定1人・その他1人
  //   ③所得控除の額の合計額 3,140,000
  // 手計算: 750,000+40,000+20,000+380,000+580,000 = 1,770,000（印字ぶん）
  //         630,000（特定1）+380,000（一般1）      = 1,010,000（人数ぶん）
  //         合計 2,780,000 → ③との差 360,000 … 説明できない＝票か入力に誤りがある
  const r1 = checkSanKojo({
    san: 3140000,
    printed: { shakaiHoken: 750000, seimeiHoken: 40000, jishinHoken: 20000, haigusha: 380000, kisoKojo: 580000 },
    counts: { tokutei: 1, ippan: 1 },
  }, D);
  eq("§5 印字ぶんの合計", r1.printed.total, 1770000);
  eq("§5 人数ぶんの合計", r1.counted.total, 1010000);
  eq("§5 差額", r1.remainder, 360000);
  ok("§5 説明できないので matched にしない", !r1.matched);
  ok("§5 説明できない旨を申告する", r1.notes.some((n) => n.key === "unexplained"));

  // 同じ票で③が 2,780,000 なら、ぴったり合う
  const r2 = checkSanKojo({
    san: 2780000,
    printed: { shakaiHoken: 750000, seimeiHoken: 40000, jishinHoken: 20000, haigusha: 380000, kisoKojo: 580000 },
    counts: { tokutei: 1, ippan: 1 },
  }, D);
  ok("§5 一致すれば matched", r2.matched);
  eq("§5 一致時の差額は0", r2.remainder, 0);
  eq("§5 一致時は説明候補を出さない", r2.explains.length, 0);

  // ★ひとり親（票に出ない）を含む票: 差額35万がひとり親で説明できる
  const r3 = checkSanKojo({
    san: 2780000 + 350000,
    printed: { shakaiHoken: 750000, seimeiHoken: 40000, jishinHoken: 20000, haigusha: 380000, kisoKojo: 580000 },
    counts: { tokutei: 1, ippan: 1 },
  }, D);
  ok("§5 差額をひとり親で説明する", r3.explains.some((e) => e.keys.join() === "hitorioya"));
  ok("§5 説明できたので unexplained を出さない", !r3.notes.some((n) => n.key === "unexplained"));
}

// ───────────────────────────── §6 マイナスの差額（最重要）
{
  // 住宅借入金等特別控除 200,000 を③に足してしまった票
  const r = checkSanKojo({
    san: 2780000,
    printed: { shakaiHoken: 750000, seimeiHoken: 40000, jishinHoken: 20000, haigusha: 380000, kisoKojo: 580000 + 200000 },
    counts: { tokutei: 1, ippan: 1 },
  }, D);
  eq("§6 マイナスの差額を0に丸めない", r.remainder, -200000);
  ok("§6 overshoot を立てる", r.overshoot);
  ok("§6 matched にしない（合っていると答えない）", !r.matched);
  eq("§6 マイナス側では説明候補を出さない", r.explains.length, 0);
  ok("§6 住宅ローン控除の注意を出す", r.notes.some((n) => n.key === "jutaku"));
  ok("§6 所得金額調整控除の注意を出す", r.notes.some((n) => n.key === "chosei"));
}

// ───────────────────────────── §7 fail closed
{
  throws("§7 データ無しでは計算しない", () => checkSanKojo({ san: 100 }, null));
  throws("§7 hyoji_nashi 欠落でも計算しない", () => checkSanKojo({ san: 100 }, { fuyo: D.fuyo }));

  const z = checkSanKojo({ san: 0, printed: { shakaiHoken: 750000 }, counts: {} }, D);
  ok("§7 ③未入力では ok=false", !z.ok);
  eq("§7 ③未入力では差額を0円と答えない", z.reason, "no_san");
  ok("§7 ③未入力では matched にしない", !z.matched);

  // 基礎控除が空欄なら年末調整をしていない旨を申告する
  const k = checkSanKojo({ san: 1000000, printed: { shakaiHoken: 750000 }, counts: {} }, D);
  ok("§7 基礎控除0の注意を出す", k.notes.some((n) => n.key === "kiso"));
  ok("§7 年分を返す", k.year === D._meta.year && !!k.year);
}

// ───────────────────────────── §8 国税庁の明文との照合
{
  // タックスアンサー No.1180 / No.1160 / No.1170 / No.1171 / No.1175（2026-08-01 に curl で逐語確認）
  const nta = { ippan: 380000, tokutei: 630000, rojin: 480000, dokyo_rojin: 580000 };
  for (const [k, v] of Object.entries(nta)) eq(`§8 No.1180 ${k}`, A("fuyo", k), v);
  eq("§8 No.1160 障害者", A("shogaisha", "shogaisha"), 270000);
  eq("§8 No.1160 特別障害者", A("shogaisha", "tokubetsu"), 400000);
  eq("§8 No.1160 同居特別障害者", A("shogaisha", "dokyo_tokubetsu"), 750000);
  const H = (key) => D.hyoji_nashi.kubun.find((k) => k.key === key).amount;
  eq("§8 No.1170 寡婦", H("kafu"), 270000);
  eq("§8 No.1171 ひとり親", H("hitorioya"), 350000);
  eq("§8 No.1175 勤労学生", H("kinro_gakusei"), 270000);
  ok("§8 出典に条文と No. が書いてある",
    /所得税法84条/.test(D._meta.source) && /No\.1180/.test(D._meta.source));
}

// ───────────────────────────── §9 データ⇔ページの結合
{
  ok("§9 ページがコアを読み込んでいる", PAGE.includes("gensen_kojo_check_core.js"));
  ok("§9 ページが参照データを読み込んでいる", PAGE.includes("gensen_kojo_r07.json"));
  // 金額はページ本文にも同じ値で出ている（食い違うと片方が嘘になる）
  for (const k of [...D.fuyo.kubun, ...D.shogaisha.kubun]) {
    const yen = k.amount.toLocaleString("ja-JP");
    ok(`§9 ページに ${k.label} ${yen}円 が出ている`, visible.includes(yen));
  }
  // ★③に入らないものをページが明示している（このツールの一番の急所）
  ok("§9 住宅ローン控除は③に入らないとページに書いてある",
    /住宅借入金等特別控除[^。]*③(に|には)(は)?入(っていま|りま)せん|③には含まれません/.test(visible.replace(/\s+/g, "")));
  ok("§9 年分がページに出ている", visible.includes(D._meta.year));
}

console.log(`test_gensen_kojo_check: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log("  FAIL " + f); process.exit(1); }
