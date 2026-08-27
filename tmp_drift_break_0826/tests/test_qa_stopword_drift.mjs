/**
 * QA検索の「被覆の分子から外す語」の門が、索引の成長で跨がれていないかを測る。
 *
 * ★ なぜ要るか（2026-08-26 の実害）:
 *   `qa_search.js` の COVERAGE_STOPWORD_DF_RATIO は「索引の N% を超えて出る語は
 *   話題を特定しない」という門で、**分母が索引の件数**。ところが生成器 gen_qa_index.mjs が
 *   撒く同義語（いくら／どのくらい／いくらぐらい／金額／目安）は「計算」を含むページにしか
 *   付かないので、**記事が増えるほど割合は下がり続ける**。
 *   ＝ この門は放っておくと**必ず下から跨がれる向き**にドリフトする。
 *
 *   実際に跨がれた: 記事を1本足して索引が 374→375 になった瞬間、`目安` が
 *   40.11% → 40.00% に落ちて `> 0.4` が false になり、
 *   「資格の勉強時間の目安」→ /santei/ が門を通った（best 0.000 → 7.330）。
 *   ★ **375本目が何の記事であっても同じことが起きた**＝記事側に原因は無い。
 *
 *   test_qa.mjs の無関係クエリ検査は「跨がれた後」に赤くなる。それは正しく働いたが、
 *   赤くなった便は**原因が自分の記事だと誤解しやすい**（実際そう見えた）。
 *   この検査は**跨がれる前に**、余裕がどれだけ残っているかを数字で出す。
 *
 * ★ 規則6（網の外に何が残るか）: ここが見ているのは「撒かれる同義語」だけ。
 *   本文にある内容語（計算・期限・税率）は qa_search の条件①で守られるので、
 *   この門の値を下げても落ちない。**その①が生きていること自体も下で確かめる。**
 */
import { readFileSync } from "node:fs";
import assert from "node:assert";

const idx = JSON.parse(readFileSync(new URL("../docs/assets/qa_index.json", import.meta.url), "utf8"));
const src = readFileSync(new URL("../docs/assets/qa_search.js", import.meta.url), "utf8");

const m = src.match(/const COVERAGE_STOPWORD_DF_RATIO = ([\d.]+);/);
assert.ok(m, "COVERAGE_STOPWORD_DF_RATIO を qa_search.js から読めなかった（名前が変わった？）");
const RATIO = parseFloat(m[1]);

const docs = idx.docs || idx.items || idx;
const N = docs.length;
assert.ok(N > 100, `索引が小さすぎる（${N}件）。読み取りが壊れている可能性がある`);

/** gen_qa_index.mjs が「計算」系ページに撒く口語同義語。qa_search.js の docstring が名指ししているもの。 */
const SPRAYED = ["いくら", "どのくらい", "いくらぐらい", "金額", "目安"];
/** 本文にある内容語＝条件①で守られる側。門を下げても落ちてはいけない。 */
const BODY_WORDS = ["計算", "期限", "税率"];

const dfRatio = (t) => docs.filter((d) => (d.terms || "").includes(t)).length / N;
const inBody = (t) => docs.filter((d) => ((d.title || "") + (d.answer || "")).includes(t)).length;

/** 門から何ポイント余裕があるか。★ここが 0 に近づくのがドリフト。 */
const MIN_MARGIN_PT = 5.0;

let n = 0;
console.log(`索引 ${N}件 / COVERAGE_STOPWORD_DF_RATIO = ${RATIO}（${(RATIO * 100).toFixed(1)}%）`);
console.log("--- 撒かれる同義語（門より上に居てほしい側）---");
for (const t of SPRAYED) {
  const r = dfRatio(t);
  const marginPt = (r - RATIO) * 100;
  console.log(`  ${t}\t df=${(r * 100).toFixed(2)}%\t 余裕=${marginPt >= 0 ? "+" : ""}${marginPt.toFixed(2)}pt\t 本文にある記事=${inBody(t)}`);
  assert.ok(
    r > RATIO,
    `★門を跨がれた: 「${t}」の df は ${(r * 100).toFixed(2)}% で、門 ${(RATIO * 100).toFixed(1)}% を下回っている。\n` +
      `  ＝ この語が被覆の分子に戻り、中身が1語も合っていない質問が通るようになる。\n` +
      `  直し方は記事を消すことではなく、COVERAGE_STOPWORD_DF_RATIO を下げて再較正すること。\n` +
      `  （記事は増え続けるので、この割合は下がり続ける。上げてはいけない）`,
  );
  assert.ok(
    marginPt >= MIN_MARGIN_PT,
    `★門に近づいている: 「${t}」の df は ${(r * 100).toFixed(2)}% で、門まで ${marginPt.toFixed(2)}pt しかない。\n` +
      `  ${MIN_MARGIN_PT}pt を切ったら再較正どき。放置すると、次に書く記事が原因に見える形で test_qa.mjs が赤くなる。`,
  );
  n += 2;
}

console.log("--- 本文の内容語（条件①で守られている側）---");
for (const t of BODY_WORDS) {
  const body = inBody(t);
  console.log(`  ${t}\t df=${(dfRatio(t) * 100).toFixed(2)}%\t 本文にある記事=${body}`);
  assert.ok(
    body > 0,
    `「${t}」が本文に1件も無い。条件①（本文に無いこと）で守られなくなるので、` +
      `門を下げると被覆から落ちて「手取り 計算」のような本物の質問が答えられなくなる`,
  );
  n++;
}

console.log(`✅ test_qa_stopword_drift: ${n} checks（門は跨がれていない）`);
