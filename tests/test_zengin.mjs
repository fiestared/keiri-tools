import assert from "node:assert";
import { normalize, normalizeBatch } from "../docs/assets/zengin_core.js";

const n = (s) => normalize(s).output;

// 法人略語: 位置による形式(第四北越PDF/SMBC FAQの規則)
assert.equal(n("株式会社ヤマダ"), "ｶ)ﾔﾏﾀﾞ");            // 先頭
assert.equal(n("ヤマダ株式会社"), "ﾔﾏﾀﾞ(ｶ");            // 末尾
assert.equal(n("ヤマダ株式会社トウキョウ営業所"), "ﾔﾏﾀﾞ(ｶ)ﾄｳｷﾖｳ(ｴｲ"); // 中間+営業所末尾
assert.equal(n("有限会社スズキ"), "ﾕ)ｽｽﾞｷ");
assert.equal(n("合同会社アオゾラ"), "ﾄﾞ)ｱｵｿﾞﾗ");
// 漢字が残る名義 → 略語は変換されつつ警告(読みはツールでは判断しない)
{
  const r = normalize("株式会社山田");
  assert.equal(r.output, "ｶ)山田");
  assert.equal(r.ok, false);
  assert.ok(r.warnings.some((w) => w.includes("使用できない文字")));
}
assert.equal(n("NPO法人ハナサキ"), "ﾄｸﾋ)ﾊﾅｻｷ");
assert.equal(n("税理士法人アオイ"), "ｾﾞｲ)ｱｵｲ");

// 事業略語は括弧なし
assert.equal(n("ヤマダ健康保険組合"), "ﾔﾏﾀﾞｹﾝﾎﾟ");
assert.equal(n("セイカツ協同組合"), "ｾｲｶﾂｷﾖｳｸﾐ");

// ひらがな→半角カナ、小文字→大文字、長音→ハイフン、中黒→ピリオド
assert.equal(n("きゃっしゅふろー"), "ｷﾔﾂｼﾕﾌﾛ-");
assert.equal(n("スーパー・マーケット"), "ｽ-ﾊﾟ-.ﾏ-ｹﾂﾄ");
assert.equal(n("ヴェルディ"), "ｳﾞｴﾙﾃﾞｲ");

// ヲ→オ(警告つき)
{
  const r = normalize("カヲル");
  assert.equal(r.output, "ｶｵﾙ");
  assert.ok(r.warnings.some((w) => w.includes("ヲ")));
}

// 英数字: 全角→半角、小文字→大文字
assert.equal(n("ａｂｃ１２３"), "ABC123");
assert.equal(n("abcショウジ"), "ABCｼﾖｳｼﾞ");

// 半角小文字カナの補正
assert.equal(n("ｷｬﾉﾝ"), "ｷﾔﾉﾝ");

// 括弧・記号
assert.equal(n("ヤマダ（カ）"), "ﾔﾏﾀﾞ(ｶ)");

// 漢字残り → ok=false
{
  const r = normalize("山田商事");
  assert.equal(r.ok, false);
  assert.ok(r.warnings.length >= 1);
}

// 文字数チェック
{
  const long = "ア".repeat(31);
  const r = normalize(long);
  assert.equal(r.length, 31);
  assert.equal(r.ok, false);
  assert.ok(r.warnings.some((w) => w.includes("上限")));
}

// バッチ
{
  const rs = normalizeBatch("株式会社ヤマダ\n\nたなかしょうてん\n");
  assert.equal(rs.length, 2);
  assert.equal(rs[0].output, "ｶ)ﾔﾏﾀﾞ");
  assert.equal(rs[1].output, "ﾀﾅｶｼﾖｳﾃﾝ");
}

console.log("all zengin_core tests passed");
