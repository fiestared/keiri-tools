import assert from "node:assert";
import { readFileSync } from "node:fs";
import { calcSozokuzei, kisoKojo } from "../docs/assets/sozokuzei_core.js";

// 記事「相続税はいくらから」の基礎控除表・速算表・早見表は sozokuzei_r08.json /
// sozokuzei_core.js と同じ数字であることが売り。税制改正でデータを差し替えたとき、
// 記事の数字だけが取り残される(=読者に古い税額を見せる)のを防ぐ。
// 規則3: 「本文のどこかに在る」ではなく、その主張が載っている要素(表・summary-box)を名指しする。

const D = JSON.parse(readFileSync(new URL("../docs/assets/sozokuzei_r08.json", import.meta.url)));
const HTML = readFileSync(new URL("../docs/column/sozokuzei-ikura/index.html", import.meta.url), "utf8");

/** マーカー間のHTMLを切り出す(見つからなければ落とす — 黙って空を返すと検査が消える) */
function slice(from, to) {
  const i = HTML.indexOf(from);
  assert.ok(i !== -1, `マーカーが見つからない: ${from}`);
  const j = HTML.indexOf(to, i + from.length); // from の後ろから探す(先頭から探すと手前の同名タグに当たる)
  assert.ok(j !== -1, `マーカーが見つからない: ${to} (${from} の後ろに無い)`);
  return HTML.slice(i, j);
}

/** 「4,000万円」「1億円」「1億5,000万円」を円に変換(読めない表記は落とす) */
function jpToYen(label) {
  const m = label.match(/^(?:(\d+)億)?(?:([\d,]+)万)?円$/);
  assert.ok(m && (m[1] || m[2]), `金額ラベルが読めない: ${label}`);
  return (Number(m[1] || 0) * 1e8) + (Number((m[2] || "0").replace(/,/g, "")) * 1e4);
}

// --- 1. 基礎控除表(1〜4人)が kisoKojo(実装そのもの)と一致すること ---
{
  const part = slice('id="kiso"', 'id="seimi"');
  const rows = [...part.matchAll(/<tr><td><b>(\d)人<\/b>[^<]*<\/td><td>([\d,]+)万円<\/td><\/tr>/g)]
    .map((m) => ({ n: Number(m[1]), kiso: Number(m[2].replace(/,/g, "")) * 1e4 }));
  assert.equal(rows.length, 4, `基礎控除表の読み取りが${rows.length}行(4行のはず。正規表現がずれている)`);
  for (const r of rows) {
    assert.equal(r.kiso, kisoKojo(r.n, D), `基礎控除表 ${r.n}人の額が実装と不一致`);
  }
  // 記事の核心「3,000万円＋600万円×人数」の定数もデータと照合(summary-boxを名指し)
  assert.equal(D.kiso_kojo.teigaku, 30000000, "基礎控除の定額がデータで3,000万円でない(記事全体の書き換えが要る)");
  assert.equal(D.kiso_kojo.per_houtei_sozokunin, 6000000, "基礎控除の人数比例額がデータで600万円でない");
  const box = slice("基礎控除額 ＝ 3,000万円", "</div>");
  assert.ok(box.includes("600万円 × 法定相続人の数"), "summary-boxの基礎控除の式が欠けている");
}

// --- 2. 速算表8区分が sozokuzei_r08.json の brackets と一致すること ---
{
  const part = slice('id="sokusan-hyo"', "</table>");
  const dedFmt = (n) => (n === 0 ? "0円" : `${(n / 1e4).toLocaleString("en-US")}万円`);
  const rows = [...part.matchAll(/<tr><td>([^<]+)<\/td><td>(\d+)％<\/td><td>([^<]+)<\/td><\/tr>/g)]
    .map((m) => ({ label: m[1], rate: Number(m[2]), ded: m[3] }));
  const brackets = D.sokusanhyo.brackets;
  assert.equal(rows.length, brackets.length, `速算表: 記事${rows.length}行 ≠ データ${brackets.length}区分`);
  brackets.forEach((b, i) => {
    assert.equal(rows[i].label, b.label, `速算表 第${i + 1}区分のラベルが不一致`);
    assert.equal(rows[i].rate, b.rate_pct, `速算表「${b.label}」の税率が不一致`);
    assert.equal(rows[i].ded, dedFmt(b.deduction), `速算表「${b.label}」の控除額が不一致`);
  });
}

// --- 3. 早見表の全行×4構成が calcSozokuzei(実装そのもの)の答えと一致すること ---
{
  const part = slice('id="hayami"', 'id="haigusha"');
  const FAMS = [
    { hasSpouse: true, numChildrenReal: 1 },   // 配偶者と子1人
    { hasSpouse: true, numChildrenReal: 2 },   // 配偶者と子2人
    { hasSpouse: false, numChildrenReal: 1 },  // 子1人だけ
    { hasSpouse: false, numChildrenReal: 2 },  // 子2人だけ
  ];
  const rows = [...part.matchAll(
    /<tr><td><b>([^<]+)<\/b><\/td><td>([\d,]+)円<\/td><td>([\d,]+)円<\/td><td>([\d,]+)円<\/td><td>([\d,]+)円<\/td><\/tr>/g
  )].map((m) => ({
    isan: jpToYen(m[1]),
    vals: [m[2], m[3], m[4], m[5]].map((s) => Number(s.replace(/,/g, ""))),
  }));
  assert.ok(rows.length >= 8, `早見表の読み取りが${rows.length}行しかない(正規表現がずれている)`);
  for (const r of rows) {
    FAMS.forEach((f, k) => {
      const got = calcSozokuzei({ isanTotal: r.isan, ...f }, D).jishitsuFutan;
      assert.equal(got, r.vals[k],
        `早見表 遺産${r.isan / 1e4}万円・構成${k + 1}列目が実装と不一致(記事${r.vals[k]} ≠ 実装${got})`);
    });
  }
}

// --- 4. 本文の計算例(記事の目玉=国税庁No.4155の例)が実装と一致すること。要素を名指しする ---
{
  const ex = calcSozokuzei({ isanTotal: 200000000, hasSpouse: true, numChildrenReal: 2 }, D);
  // 実装が国税庁の worked example を再現していること(外部オラクル)
  assert.equal(ex.kiso, 48000000, "実装の基礎控除(妻+子2)が4,800万円でない");
  assert.equal(ex.kazeiIsan, 152000000, "実装の課税遺産総額(遺産2億)が1億5,200万円でない");
  assert.equal(ex.sogaku, 27000000, "実装の相続税の総額(遺産2億・妻+子2)が2,700万円でない(データが変わった?)");
  assert.equal(ex.jishitsuFutan, 13500000, "実装の実際の納税額(遺産2億・妻+子2)が1,350万円でない");

  // その数字が summary-box に載っていること
  const box = slice("正味の遺産額2億円・妻と子2人の場合", "</div>");
  for (const s of ["1,580万円", "560万円", "2,700万円", "675万円×2人 ＝ 合計1,350万円"]) {
    assert.ok(box.includes(s), `summary-boxの計算例に「${s}」が無い`);
  }

  // 図解(figure)も同じ例を描いている(2,700万円と1,350万円)
  const fig = slice('<figure class="figure">', "</figure>");
  assert.ok(fig.includes("2,700万円"), "図解に相続税の総額(2,700万円)が無い");
  assert.ok(fig.includes("1,350万円"), "図解に実際の納税額(1,350万円)が無い");

  // 早見表の本文注記「遺産1億円: 配偶者と子2人315万円 / 子1人だけ1,220万円」も実装と照合
  const hayami = slice('id="hayami"', 'id="haigusha"');
  assert.equal(calcSozokuzei({ isanTotal: 100000000, hasSpouse: true, numChildrenReal: 2 }, D).jishitsuFutan,
    3150000, "実装の遺産1億円(配偶者と子2人)が315万円でない");
  assert.equal(calcSozokuzei({ isanTotal: 100000000, hasSpouse: false, numChildrenReal: 1 }, D).jishitsuFutan,
    12200000, "実装の遺産1億円(子1人だけ)が1,220万円でない");
  assert.ok(hayami.includes("配偶者と子2人で315万円"), "早見表の本文注記(315万円)が無い");
  assert.ok(hayami.includes("子1人だけなら1,220万円"), "早見表の本文注記(1,220万円)が無い");
}

// --- 5. titleの「3,600万円」(いくらからの答え)が実装と一致すること ---
{
  assert.equal(kisoKojo(1, D), 36000000, "実装の基礎控除(1人)が3,600万円でない(titleの書き換えが要る)");
  const title = HTML.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(title.includes("3,600万円"), "titleに最低ライン(3,600万円)が無い");
}

console.log("all sozokuzei article tests passed (基礎控除表・速算表・早見表8行×4構成・計算例を実装と照合)");
