import assert from "node:assert";
import { readFileSync } from "node:fs";
import { calcZoyozei } from "../docs/assets/zoyozei_core.js";

// 記事「贈与税はいくらから」の速算表・早見表は zoyozei_r08.json / zoyozei_core.js と
// 同じ数字であることが売り。税制改正でデータを差し替えたとき、記事の数字だけが
// 取り残される(=読者に古い税額を見せる)のを防ぐ。
// 規則3: 「本文のどこかに在る」ではなく、その主張が載っている要素(表・summary-box・ol)を名指しする。

const D = JSON.parse(readFileSync(new URL("../docs/assets/zoyozei_r08.json", import.meta.url)));
const HTML = readFileSync(new URL("../docs/column/zoyozei-ikura/index.html", import.meta.url), "utf8");

/** マーカー間のHTMLを切り出す(見つからなければ落とす — 黙って空を返すと検査が消える) */
function slice(from, to) {
  const i = HTML.indexOf(from);
  assert.ok(i !== -1, `マーカーが見つからない: ${from}`);
  const j = HTML.indexOf(to, i + from.length); // from の後ろから探す(先頭から探すと手前の同名タグに当たる)
  assert.ok(j !== -1, `マーカーが見つからない: ${to} (${from} の後ろに無い)`);
  return HTML.slice(i, j);
}

const dedFmt = (n) => (n === 0 ? "0円" : `${n / 10000}万円`);

// --- 1. 速算表2本(特例/一般)が zoyozei_r08.json の brackets と一致すること ---
for (const [marker, end, key, name] of [
  ['id="tokurei-hyo"', 'id="ippan-hyo"', "tokurei", "特例税率"],
  ['id="ippan-hyo"', 'id="hayami"', "ippan", "一般税率"],
]) {
  const part = slice(marker, end);
  const rows = [...part.matchAll(/<tr><td>([^<]+)<\/td><td>(\d+)％<\/td><td>([^<]+)<\/td><\/tr>/g)]
    .map((m) => ({ label: m[1], rate: Number(m[2]), ded: m[3] }));
  const brackets = D[key].brackets;
  assert.equal(rows.length, brackets.length, `${name}の速算表: 記事${rows.length}行 ≠ データ${brackets.length}区分`);
  brackets.forEach((b, i) => {
    assert.equal(rows[i].label, b.label, `${name} 第${i + 1}区分のラベルが不一致`);
    assert.equal(rows[i].rate, b.rate_pct, `${name}「${b.label}」の税率が不一致`);
    assert.equal(rows[i].ded, dedFmt(b.deduction), `${name}「${b.label}」の控除額が不一致`);
  });
}

// --- 2. 早見表の全行が calcZoyozei(実装そのもの)の答えと一致すること ---
{
  const part = slice('id="hayami"', 'id="konzai"');
  const rows = [...part.matchAll(
    /<tr><td><b>([\d,]+)万円<\/b>(以下)?<\/td><td>([\d,]+)円<\/td><td>([\d,]+)円<\/td><\/tr>/g
  )].map((m) => ({
    total: Number(m[1].replace(/,/g, "")) * 10000,
    tokurei: Number(m[3].replace(/,/g, "")),
    ippan: Number(m[4].replace(/,/g, "")),
  }));
  assert.ok(rows.length >= 10, `早見表の読み取りが${rows.length}行しかない(正規表現がずれている)`);
  for (const r of rows) {
    assert.equal(calcZoyozei({ tokurei: r.total }, D).zei, r.tokurei,
      `早見表 ${r.total / 10000}万円の特例税率が実装と不一致`);
    assert.equal(calcZoyozei({ ippan: r.total }, D).zei, r.ippan,
      `早見表 ${r.total / 10000}万円の一般税率が実装と不一致`);
  }
}

// --- 3. 本文の計算例(記事の目玉)が実装と一致すること。要素を名指しする ---
{
  // 500万円の例は summary-box に載っている(No.4408の公式例)
  const box = slice("親から500万円もらった場合", "</div>");
  const tokurei = calcZoyozei({ tokurei: 5000000 }, D).zei; // 485,000
  const ippan = calcZoyozei({ ippan: 5000000 }, D).zei;     // 530,000
  assert.equal(tokurei, 485000, "実装の500万円特例が48.5万円でない(データが変わった?)");
  assert.ok(box.includes(`390万円 × 15％ − 10万円 ＝ 48万5,000円`), "summary-boxの特例500万円の式が実装と不一致");
  assert.equal(ippan, 530000, "実装の500万円一般が53万円でない(データが変わった?)");
  assert.ok(box.includes("53万円"), "summary-boxの一般500万円(53万円)が無い");

  // 混在の按分例(一般100万+特例400万=49万4,000円)は konzai の <ol> に載っている
  const konzai = slice('id="konzai"', 'id="kakaranai"');
  const mixed = calcZoyozei({ ippan: 1000000, tokurei: 4000000 }, D).zei;
  assert.equal(mixed, 494000, "実装の按分例(一般100万+特例400万)が49.4万円でない");
  assert.ok(konzai.includes("49万4,000円"), "按分例の答え(49万4,000円)が konzai セクションに無い");

  // 「父100万+祖父100万=9万円」の落とし穴例は kiso の callout に載っている
  const kiso = slice('id="kiso"', 'id="zeiritsu"');
  const futari = calcZoyozei({ tokurei: 2000000 }, D).zei;
  assert.equal(futari, 90000, "実装の200万円(特例)が9万円でない");
  const calloutStart = kiso.indexOf('<div class="callout">');
  assert.ok(calloutStart !== -1, "kiso セクションに callout が無い");
  const callout = kiso.slice(calloutStart, kiso.indexOf("</div>", calloutStart));
  assert.ok(callout.includes("贈与税は9万円"), "calloutの落とし穴例(9万円)が無い");
}

// --- 4. 基礎控除はデータが正本。記事のh1・リードの110万円がデータと一致すること ---
{
  assert.equal(D.kiso_kojo.amount, 1100000, "基礎控除データが110万円でない(記事全体の書き換えが要る)");
  const title = HTML.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(title.includes("110万円"), "titleに基礎控除(110万円)が無い");
}

console.log("all zoyozei article tests passed (速算表2本・早見表・計算例3件を実装と照合)");
