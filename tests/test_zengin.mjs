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

// ---- 全銀の文字表に無いカナ(2026-07-13追加) ----
// 一次ソース(但馬信金 zengin_moji.pdf)のカタカナ一覧は ｱ〜ﾜﾝ のみ。ヰ・ヱ・ヵ・ヶ は半角に無い。
// 以前はこれらが変換されずに残り、「漢字は読みをカナで入力してください」という
// 直しようのない助言が出ていた(ヱビス/ヰセキ は実在の名義)。
assert.equal(n("ヱビス"), "ｴﾋﾞｽ");
assert.equal(n("ヰセキ"), "ｲｾｷ");
assert.equal(n("株式会社ヱスビーショクヒン"), "ｶ)ｴｽﾋﾞ-ｼﾖｸﾋﾝ");
assert.equal(n("ゐのうえ"), "ｲﾉｳｴ");        // ひらがな旧かな経由
assert.equal(n("マルヶイ"), "ﾏﾙｹｲ");        // ヶ は小書きケ → ケ
assert.equal(n("ヵブト"), "ｶﾌﾞﾄ");
{
  const r = normalize("ヱビス");
  assert.equal(r.ok, true, "ヰ/ヱ は変換できるので ok=true でなければならない");
  assert.ok(r.warnings.some((w) => w.includes("ヰ")), "置き換えたことを申告すること");
}

// ---- ワ行の濁音 ヷヸヹヺ (2026-07-19レビュー: 警告文言の是正) ----
// 半角カナ表に無く機械的には変換できない(名義の登録表記は口座側で決まる)ので ok=false のまま。
// ただし以前は「受取人名で使える記号は ( ) - . と半角スペースだけです」という**記号向け**の
// 説明が出ていた — ヷ は記号ではなくカナなので、直しようのない助言だった。
for (const name of ["ヷタナベ", "ヸセキ", "ヹビス", "ヺロシ"]) {
  const r = normalize(name);
  assert.equal(r.ok, false, `${name} は機械的に変換できないので ok=false`);
  const w = r.warnings.join(" ");
  assert.ok(w.includes("ワ行の濁音"), `${name}: ワ行の濁音であることを名指しして説明する`);
  assert.ok(w.includes("通帳・銀行"), `${name}: 口座名義の登録表記の確認を促す`);
  assert.ok(!w.includes("使える記号は"), `${name}: 記号向けの説明を出さない(カナは記号ではない)`);
}
{
  // 記号とヷが混在したら、それぞれに合った説明が別々に出る(混ぜて1つの説明にしない)
  const r = normalize("ヷタナベ/ショウテン");
  const w = r.warnings.join(" ");
  assert.ok(w.includes("ワ行の濁音") && w.includes("使える記号は"), "カナと記号で説明を分ける");
}

// ---- 記号: 受取人名フィールドの許可集合は ( ) - . の4種類だけ ----
// 全銀協「使用文字一覧」注1: 「口座名等で使用できる文字は、カナ(ヲと小文字を除く)、濁点、(中略)、
// 記号4種類(( ) -〔ハイフン〕 .〔ピリオド〕)のみである」。
// 銀行が配る「全銀仕様データレコード使用可能文字」表には / ¥ ｢｣ も載っているが、それは
// **レコード全体の文字集合**であって受取人名フィールドの許可集合ではない。
// この2階層を混同して許可を広げかけた(2026-07-13)。広げないことをここで固定する。
assert.equal(normalize("ｴｰﾋﾞｰ/ｼｰ").ok, false, "スラッシュは受取人名では使えない");
assert.equal(normalize("ABC¥ﾊﾞﾘﾕ-").ok, false, "円マークは受取人名では使えない");
assert.equal(normalize("｢ﾔﾏﾀﾞ｣ｼﾖｳﾃﾝ").ok, false, "かぎ括弧は受取人名では使えない");
assert.equal(normalize("ABC,LTD").ok, false, "カンマは受取人名では使えない");
assert.equal(normalize("ﾔﾏﾀﾞ(ｶ").ok, true, "丸括弧は使える");
assert.equal(normalize("ｴｽ.ﾋﾞ-").ok, true, "ピリオド・ハイフンは使える");
{
  // 長音ｰ(U+FF70)はハイフン-(U+002D)と別物。一次ソースが名指しで注意している
  const r = normalize("ｺｰﾎﾟﾚｰｼﾖﾝ");
  assert.equal(r.output, "ｺ-ﾎﾟﾚ-ｼﾖﾝ", "半角長音もハイフンへ倒すこと");
  assert.ok(!r.output.includes("ｰ"), "出力に長音ｰが残ってはいけない");
}
{
  // 記号が残ったときに「漢字はカナで」と言わない(直しようのない助言だった)
  const w = normalize("ABC,LTD").warnings.join(" ");
  assert.ok(w.includes("記号"), "記号の残存は記号として説明すること");
  assert.ok(!w.includes("漢字は読みを"), "記号なのに漢字の助言を出さないこと");
}

// ---- 出力は必ず受取人名の許可集合に収まる(ok=true のとき) ----
// 「変換できた」と言い切った出力に許可外文字が混ざっていないかを機械で担保する。
const ALLOWED_RE = /^[ｱ-ﾝﾞﾟA-Z0-9()\-. ]*$/;
for (const s of ["株式会社ヴィレッジヴァンガード", "ヱビス", "ヲノ ヨーコ", "ジャックポット",
                 "株式会社エヌ・ティ・ティ・ドコモ", "株式会社Ｇｏｏｄ", "マルヶイ"]) {
  const r = normalize(s);
  assert.equal(r.ok, true, `${s} は変換できるはず`);
  assert.ok(ALLOWED_RE.test(r.output), `ok=true なのに許可外文字が出た: ${s} -> ${r.output}`);
}

// ---- 冪等性: 正規化済みの名義を再投入しても壊れない ----
for (const s of ["株式会社ヤマダ", "ヤマダ株式会社", "株式会社ABCコーポレーション", "ヱビス"]) {
  const a = normalize(s).output;
  assert.equal(normalize(a).output, a, `冪等でない: ${s}`);
}
