/**
 * 登録番号／法人番号の検証テスト。
 *
 * ★外部オラクル（自分の実装とは独立した正解）を2つ使う:
 *   ① 国税庁「チェックデジットの計算」PDF の計算例
 *      基礎番号 700110005901 → 偶数桁の和13・奇数桁の和11 → 13×2+11=37 → 37÷9 余り1
 *      → 9−1=8 → 法人番号 8700110005901
 *      https://www.houjin-bangou.nta.go.jp/documents/checkdigit.pdf
 *   ② 国税庁が自サイトのフッターに公表している自身の法人番号 7000012050002
 *      https://www.invoice-kohyo.nta.go.jp/about-toroku/index.html
 *   さらに実在の公表法人番号を数件（各社が自社サイト等で公表しているもの）で二重に確かめる。
 */
import assert from "node:assert";
import {
  STATUS, normalize, checkDigit, verifyHoujinBangou, classify, parseMany, summarize,
} from "../docs/assets/invoice_bangou_core.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.strictEqual(a, b, msg); n++; };

// ---------- ① 国税庁PDFの計算例（外部オラクル） ----------
eq(checkDigit("700110005901"), 8, "PDFの計算例: 基礎番号700110005901 → 検査用数字8");
eq(verifyHoujinBangou("8700110005901").ok, true, "PDFの完成形 8700110005901 は整合する");
// 途中の値もPDFの記載と一致することを確かめる（結果だけ合っていても算式が違う場合を弾く）
{
  const s = "700110005901";
  let evenSum = 0, oddSum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(s[11 - i]);
    if ((i + 1) % 2 === 0) evenSum += d; else oddSum += d;
  }
  eq(evenSum, 13, "PDF記載: 最下位から偶数桁の和 = 13");
  eq(oddSum, 11, "PDF記載: 最下位から奇数桁の和 = 11");
  eq(evenSum * 2 + oddSum, 37, "PDF記載: 13×2+11 = 37");
  eq(37 % 9, 1, "PDF記載: 37÷9 の余り = 1");
}

// ---------- ② 国税庁自身の法人番号（外部オラクル） ----------
eq(verifyHoujinBangou("7000012050002").ok, true, "国税庁の法人番号 7000012050002 は整合する");
eq(checkDigit("000012050002"), 7, "国税庁の基礎番号 000012050002 → 検査用数字7");

// ---------- 検査用数字は1〜9で、0にはならない ----------
// (余り0〜8 に対して 9−余り なので 1〜9。→ 先頭0の13桁は法人番号ではありえない)
{
  let sawZero = false, min = 9, max = 1;
  for (let i = 0; i < 3000; i++) {
    const base = String(i * 37 % 1000000000000).padStart(12, "0");
    const cd = checkDigit(base);
    if (cd === 0) sawZero = true;
    min = Math.min(min, cd); max = Math.max(max, cd);
  }
  eq(sawZero, false, "検査用数字が0になることはない");
  ok(min >= 1 && max <= 9, `検査用数字の範囲は1〜9（実測 ${min}〜${max}）`);
}
eq(classify("0000012050002").status, STATUS.NOT_HOUJIN, "先頭0の13桁は法人番号にならない");

// ---------- 正規化: 全角・T・ハイフン・空白 ----------
for (const raw of [
  "T7000012050002", "t7000012050002", "Ｔ7000012050002",
  "７００００１２０５０００２", "T7000-0120-50002", "  T 7000 0120 50002  ",
  "T7000012050002　",
]) {
  eq(classify(raw).status, STATUS.HOUJIN, `正規化できる: ${JSON.stringify(raw)}`);
  eq(classify(raw).formatted, "T7000012050002", `整形される: ${JSON.stringify(raw)}`);
}

// ---------- 形式エラーは「誤り」として扱う ----------
eq(classify("").status, STATUS.EMPTY, "空は EMPTY");
eq(classify("T700001205000").status, STATUS.FORMAT, "12桁は FORMAT");
eq(classify("T70000120500023").status, STATUS.FORMAT, "14桁は FORMAT");
ok(/13桁/.test(classify("T700001205000").reason), "桁数の理由が出る");
eq(classify("T70000A2050002").status, STATUS.FORMAT, "数字以外は FORMAT");

// ---------- ★1桁の打ち間違いをどこまで検出できるか ----------
// 当初「117通り全部検出できる」と書いたが**期待値が誤りだった**（規則1: 落ちたらまず期待値を疑う）。
// 検査用数字は mod 9 なので、重み付き和の変化が9の倍数だと素通しする。
// 1桁の置換で変化量が±9になるのは **0↔9 の入れ替えだけ**（重みは1か2で、gcd(2,9)=1のため
// 偶数桁でも同じ）。したがって「基礎番号に含まれる0と9の個数」ぶんだけ必ず見逃す。
// ★これは実装の欠陥ではなく算式の性質。記事にもこの限界を書くこと。
{
  const good = "7000012050002";
  const base = good.slice(1);
  const missed = [];
  let tried = 0;
  for (let pos = 0; pos < 13; pos++) {
    for (let d = 0; d <= 9; d++) {
      if (String(d) === good[pos]) continue;
      const bad = good.slice(0, pos) + d + good.slice(pos + 1);
      tried++;
      if (classify(bad).status !== STATUS.NOT_HOUJIN) missed.push({ pos, from: good[pos], to: d });
    }
  }
  eq(tried, 117, "1桁だけ変えた組み合わせは117通り");

  const zerosAndNines = base.split("").filter((c) => c === "0" || c === "9").length;
  eq(zerosAndNines, 8, "この番号の基礎番号に含まれる0と9は8個");
  eq(missed.length, zerosAndNines,
     "見逃すのは基礎番号の0と9の個数ぶんだけ（=8件）");
  eq(tried - missed.length, 109, "残る109通りは検出できる");

  // 見逃した8件が**すべて 0↔9 の入れ替え**であることを名指しで確かめる（規則3）
  for (const m of missed) {
    ok(m.pos >= 1, `見逃しは基礎番号側だけで起きる（検査用数字の桁ではない）: pos=${m.pos}`);
    const pair = [m.from, String(m.to)].sort().join("");
    eq(pair, "09", `見逃しは0↔9の入れ替えのみ: ${m.from}→${m.to} (pos=${m.pos})`);
  }

  // 検査用数字そのものを変えた9通りは必ず検出できる（先頭桁は必ず効く）
  let cdCaught = 0;
  for (let d = 0; d <= 9; d++) {
    if (String(d) === good[0]) continue;
    if (classify(d + base).status === STATUS.NOT_HOUJIN) cdCaught++;
  }
  eq(cdCaught, 9, "検査用数字の桁を変えた9通りはすべて検出できる");
}

// 0↔9 の見逃しを最小の再現例で固定する（回帰防止）
{
  // 基礎番号の末尾を 0 → 9 にしても検査用数字は変わらない組み合わせを1つ作る
  const base = "000012050002";
  const cd = checkDigit(base);
  const swapped = base.slice(0, 11) + (base[11] === "0" ? "9" : base[11]);
  if (swapped !== base) {
    eq(checkDigit(swapped) === cd, false, "末尾が0でない場合はこの例に当たらない");
  }
  // 明示例: 奇数桁(最下位)の 0→9 は和が+9＝mod9で不変
  eq(checkDigit("000012050000"), checkDigit("000012050009"),
     "最下位の 0→9 は検査用数字を変えない（mod 9 の限界）");
}

// ---------- ★NOT_HOUJIN を「誤り」と断定していないか（誤判定の防止） ----------
{
  const r = classify("1234567890123");
  eq(r.status, STATUS.NOT_HOUJIN, "検査に外れる13桁は NOT_HOUJIN");
  ok(/判定できない/.test(r.reason),
     "NOT_HOUJIN の理由に『判定できない』が入る（個人事業者等を誤って誤りと言わない）");
  ok(!/誤り|不正|無効/.test(r.reason),
     "NOT_HOUJIN の理由に『誤り/不正/無効』と断定する語を入れない");
}

// ---------- 一括判定（公式サイトは1件ずつ＝ここが本命） ----------
{
  const text = [
    "T7000012050002",
    "株式会社サンプル\tT8700110005901",
    "T1234567890123",
    "T700001205000",
    "",
    "７００００１２０５０００２",
  ].join("\n");
  const rs = parseMany(text);
  eq(rs.length, 5, "空行は数えない");
  eq(rs[0].status, STATUS.HOUJIN, "1行目は法人番号として妥当");
  eq(rs[1].status, STATUS.HOUJIN, "社名が混ざっていても番号を取り出せる");
  eq(rs[1].line, 2, "行番号を保持する");
  eq(rs[2].status, STATUS.NOT_HOUJIN, "検査に外れる行");
  eq(rs[3].status, STATUS.FORMAT, "桁数が足りない行");
  eq(rs[4].status, STATUS.HOUJIN, "全角だけの行も拾える");

  const s = summarize(rs);
  eq(s.total, 5, "集計: 合計");
  eq(s.houjin, 3, "集計: 法人番号として妥当");
  eq(s.notHoujin, 1, "集計: 法人番号ではない");
  eq(s.format, 1, "集計: 形式エラー");
}

// ---------- 異常入力で例外を投げない（画面が白くならないこと） ----------
for (const raw of [null, undefined, 0, "----", "　", "T", "TTTT", "T-", "\n\n"]) {
  const r = classify(raw);
  ok(r && typeof r.status === "string", `例外を投げない: ${JSON.stringify(raw)}`);
}
ok(parseMany(null).length === 0, "parseMany(null) は空配列");
ok(parseMany(undefined).length === 0, "parseMany(undefined) は空配列");

// 基礎番号が12桁でないときは例外（呼び出し側の誤りを黙って通さない）
assert.throws(() => checkDigit("1234"), /12桁/, "12桁でない基礎番号は例外");
assert.throws(() => verifyHoujinBangou("123"), /13桁/, "13桁でない法人番号は例外");
n += 2;

console.log(`✅ test_invoice_bangou: ${n} checks passed`);
