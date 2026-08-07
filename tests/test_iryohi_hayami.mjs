/**
 * /iryohi/ の「早見表」と「確定申告での出し方」を検査する。
 *
 * なぜ要るか: 早見表は**計算機と同じ答え**を名乗っている。手打ちの転記なので、
 * 料率JSONを差し替えた日に**表だけ古い数字が残る**（CLAUDE.md「記事の数値と実装の照合」）。
 * → 表の1列目（入力）から core で計算し直し、残りの列が一致することを固定する。
 *   表の行が自分の入力を持っているので、どのセルを書き換えても落ちる。
 *
 * 規則3/4/5: 主張は id で要素を名指しし、その主張が1回しか現れない最小の要素まで下ろす。
 * 確定申告の節は国税庁No.1120（令和7年4月1日現在法令等）の逐語確認に基づく。
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calcIryohi } from "../docs/assets/iryohi_core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(here, "../docs/iryohi/index.html");
const html = fs.readFileSync(PAGE, "utf8");
const I = JSON.parse(fs.readFileSync(path.join(here, "../docs/assets/iryohi_r08.json"), "utf8"));
const D = JSON.parse(fs.readFileSync(path.join(here, "../docs/assets/juminzei_r08.json"), "utf8"));
const refs = { iryohiData: I, juminzeiData: D };

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const num = (s) => Number(String(s).replace(/[¥,\s]/g, ""));

/** id で名指しした要素の中身を取り出す（規則3: 本文全体の正規表現で見ない）。 */
function elem(id, tag) {
  const re = new RegExp(`<${tag}[^>]*id="${id}"[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = html.match(re);
  assert.ok(m, `#${id}（${tag}）がページに無い`);
  return m[1];
}
const visible = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** tbody の行を [セル文字列...] の配列にする。 */
function rows(tableId) {
  const t = elem(tableId, "table");
  const body = t.match(/<tbody>([\s\S]*?)<\/tbody>/);
  assert.ok(body, `#${tableId} に tbody が無い`);
  return [...body[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => visible(c[1])));
}

// ── 表① 年収500万円・所得税率10% ────────────────────────────────
{
  const r = rows("hayami-iryohi");
  // ★この表の存在理由＝「ちょうど10万円は0円」を見せること。行数より先に見る
  //   （先に行数で落とすと、目玉の行を消したとき「なぜ落ちたか」が伝わらない）。
  const seen = new Set(r.map((cells) => num(cells[0])));
  ok(seen.has(100000), "表①に『医療費10万円ちょうど』の行が無い（この表の目玉）");
  ok(seen.has(120000), "表①に『医療費12万円』の行が無い（0円との対比が消える）");
  ok(r.length >= 7, `表①の行が少ない（${r.length}行）`);
  for (const cells of r) {
    ok(cells.length === 3, `表①の列数が3でない: ${cells.join("|")}`);
    const iryohi = num(cells[0]);
    ok(iryohi > 0, `表①の1列目が金額でない: ${cells[0]}`);
    const c = calcIryohi(
      { iryohi, hoten: 0, kyuyoShunyu: 5000000, zeisei: "r8", shotokuzeiRate: 10 }, refs);
    ok(cells[1] === yen(c.normal.kojo),
      `表① 医療費${cells[0]}の控除額が実装と違う: 表=${cells[1]} 実装=${yen(c.normal.kojo)}`);
    ok(cells[2] === yen(c.normal.keigen.total),
      `表① 医療費${cells[0]}の戻る額が実装と違う: 表=${cells[2]} 実装=${yen(c.normal.keigen.total)}`);
  }
}

// ── 表② 医療費10万円・年収別（足切りの5%側） ──────────────────────
{
  const r = rows("hayami-nenshu");
  // 5%側と10万円側の**両方**が載っていないと「切り替わる」という主張が見えない。
  // 行数より先に見る（行を消したとき「何が消えたか」を伝えるため）。
  const bands = r.map((cells) => calcIryohi(
    { iryohi: 100000, hoten: 0, kyuyoShunyu: num(cells[0]), zeisei: "r8", shotokuzeiRate: 5 }, refs));
  ok(bands.some((c) => !c.ashikiriCapped), "表②に足切りが5%側の行が無い（低所得ほど効くという主張が消える）");
  ok(bands.some((c) => c.ashikiriCapped), "表②に足切りが10万円側の行が無い（切り替わりが見えない）");
  ok(r.length >= 5, `表②の行が少ない（${r.length}行）`);
  for (const cells of r) {
    ok(cells.length === 6, `表②の列数が6でない: ${cells.join("|")}`);
    const shunyu = num(cells[0]);
    ok(shunyu > 0, `表②の1列目が年収でない: ${cells[0]}`);
    const c = calcIryohi(
      { iryohi: 100000, hoten: 0, kyuyoShunyu: shunyu, zeisei: "r8", shotokuzeiRate: 5 }, refs);
    ok(cells[1] === yen(c.sotoShotoku),
      `表② 年収${cells[0]}の総所得が実装と違う: 表=${cells[1]} 実装=${yen(c.sotoShotoku)}`);
    ok(cells[2] === yen(c.ashikiri),
      `表② 年収${cells[0]}の足切りが実装と違う: 表=${cells[2]} 実装=${yen(c.ashikiri)}`);
    ok(cells[3] === yen(c.normal.kojo),
      `表② 年収${cells[0]}の控除額が実装と違う: 表=${cells[3]} 実装=${yen(c.normal.kojo)}`);
    ok(cells[4] === yen(c.normal.keigen.total),
      `表② 年収${cells[0]}の戻る額が実装と違う: 表=${cells[4]} 実装=${yen(c.normal.keigen.total)}`);
    ok(cells[5] === yen(c.normal.keigen.jumin),
      `表② 年収${cells[0]}の住民税分が実装と違う: 表=${cells[5]} 実装=${yen(c.normal.keigen.jumin)}`);
  }
}

// ── 「ちょうど10万円は0円」の急所（規則5: 主張が1回しか出ない最小要素）────
{
  const v = visible(elem("juman-choudo", "div"));
  ok(/控除額0円/.test(v), "#juman-choudo が『控除額0円』を言っていない");
  ok(/超えた分から効きはじめる線/.test(v), "#juman-choudo が『10万円は超えた分から効く線』を言っていない");
  // 対比に出す12万円の戻り額も実装から検算する（手打ちの数字を残さない）
  const c12 = calcIryohi(
    { iryohi: 120000, hoten: 0, kyuyoShunyu: 5000000, zeisei: "r8", shotokuzeiRate: 10 }, refs);
  ok(v.includes(yen(c12.normal.keigen.total)),
    `#juman-choudo の12万円の戻り額が実装と違う（実装=${yen(c12.normal.keigen.total)}）`);
}

// ── 結論ファーストのリード（検索者が最初に読む1文）────────────────
{
  const v = visible(elem("lead-answer", "p"));
  ok(/医療費 − 補填金 − 足切り/.test(v), "#lead-answer に戻る額の式が無い");
  ok(/所得税率 ＋ 10%/.test(v), "#lead-answer に住民税10%を含む式が無い");
}

// ── 確定申告の節（国税庁No.1120の逐語確認に基づく）──────────────
{
  const v = visible(elem("meisaisho", "p"));
  ok(/医療費控除の明細書/.test(v), "#meisaisho が『医療費控除の明細書』を言っていない");
  ok(/領収書そのものの添付・提示は不要/.test(v), "#meisaisho が『領収書の添付・提示は不要』を言っていない");
  // ★2026-08-07: 年数をベタ書き（/確定申告期限等から5年/）していた。データが改正で
  //   変わったとき、本文と検査が**一緒に古くなって気づけない**（検査が独立した外部オラクルでなくなる）。
  //   iryohi_r08.json の meisaisho_hozon_years から取る。
  ok(new RegExp(`確定申告期限等から${I.iryohi_kojo.meisaisho_hozon_years}年を経過する日`).test(v),
    "#meisaisho の保存期間の起算・年数がNo.1120と違う");
}
{
  const v = visible(elem("tsuchi", "p"));
  ok(/簡略化/.test(v), "#tsuchi が医療費通知による『簡略化』を言っていない");
  ok(/市販薬・通院の交通費・自由診療/.test(v), "#tsuchi が通知に載らない分の書き足しを言っていない");
}
{
  const v = visible(elem("gensen-futen", "p"));
  ok(/平成31年4月1日以後/.test(v), "#gensen-futen の施行日がNo.1120と違う");
  ok(/添付・提示は不要/.test(v), "#gensen-futen が『添付・提示は不要』を言っていない");
}
{
  const v = visible(elem("shukei-form", "p"));
  ok(/セルフメディケーション税制を使う場合は、この集計フォームは利用できません/.test(v),
    "#shukei-form が『セルフメディケーションでは集計フォームを使えない』を言っていない");
}
{
  const v = visible(elem("kojo-cap-note", "div"));
  const cap = I.iryohi_kojo.kojo_cap;
  ok(v.includes("最高" + (cap / 10000) + "万円"),
    `#kojo-cap-note の控除の上限がデータ（${cap}円）と違う`);
  ok(/翌年1月1日から5年間/.test(v), "#kojo-cap-note が還付申告の5年を言っていない");
}

// ── 明細書に添える領収書の保存期間 ────────────────────────────────
// ★2026-08-07 追加。壊しテストが「5年 → 3年」の書き換えを**素通しする**と
//   報告していた（11/12捕捉）。金額はすべて照合していたのに、**何年保存するか**を
//   誰も見ていなかった。ここを短く誤ると、読者は税務署の確認より前に領収書を捨てる
//   （＝控除を否認されうる。金額の誤りより実害が大きい種類の間違い）。
// ★年数はデータ（iryohi_r08.json の meisaisho_hozon_years）に持たせた。
//   本文にベタ書きしたままだと、改正時に本文だけが古くなり、誰も気づけない。
{
  const v = visible(elem("meisaisho", "p"));
  const y = I.iryohi_kojo.meisaisho_hozon_years;
  ok(Number.isInteger(y) && y > 0, `データに meisaisho_hozon_years が無い（保存期間を検証できない）`);
  ok(new RegExp(`確定申告期限等から${y}年を経過する日までの間`).test(v),
    `#meisaisho の「確定申告期限等から◯年」がデータ（${y}年）と違う`);
  ok(new RegExp(`領収書は${y}年間保存`).test(v),
    `#meisaisho の「領収書は◯年間保存」がデータ（${y}年）と違う`);
  // ★2箇所が食い違ったまま両方データと合わない、を防ぐ（片方だけ直す事故が起こりやすい）
  const nums = [...v.matchAll(/(\d+)年/g)].map((m) => +m[1]);
  ok(nums.length >= 2 && nums.every((n) => n === y),
    `#meisaisho に ${y} 以外の年数が混ざっている: ${nums.join(', ')}`);

  // ★head の JSON-LD（FAQ構造化データ）も見る。
  //   2026-08-07 に判明: 同じ文言が **head の JSON-LD と本文の2箇所**にあり、
  //   壊しテストの置換（indexOf＝最初の1件）は **JSON-LD の方**に当たっていた。
  //   そして **JSON-LD を見ている検査が1つも無かった**。
  //   構造化データは検索結果のリッチリザルトに出る＝**本文より先に読まれることがある**。
  //   本文だけ正しくても、そこが嘘なら読者は嘘を読む。
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join(' ');
  const ldHits = [...ld.matchAll(/確定申告期限等から(\d+)年/g)].map((m) => +m[1]);
  ok(ldHits.length > 0, 'JSON-LD に「確定申告期限等から◯年」の記述が無い（本文と対で持つべき）');
  ok(ldHits.every((n) => n === y),
    `JSON-LD の保存期間がデータ（${y}年）と違う: ${ldHits.join(', ')}年`);
}

console.log(`✓ test_iryohi_hayami: ${checks} checks`);
