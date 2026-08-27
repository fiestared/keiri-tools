import { readFileSync } from "node:fs";
const idx = JSON.parse(readFileSync("./docs/assets/qa_index.json", "utf8"));
const docs = idx.docs || idx.items || idx;
// gen_qa_index が撒く口語同義語の行（qa_search.js の docstring が名指ししているもの）
const SPRAYED = ["いくら", "どのくらい", "いくらぐらい", "金額", "目安"];
const BODY_WORDS = ["計算", "書き方", "手続き", "期限", "税率"];
function stat(t) {
  let inTerms = 0, inBody = 0;
  for (const d of docs) {
    if ((d.terms || "").includes(t)) inTerms++;
    if (((d.title || "") + (d.answer || "")).includes(t)) inBody++;
  }
  return { t, ratio: inTerms / docs.length, inBody };
}
console.log("件数", docs.length, "／ 現行の門 COVERAGE_STOPWORD_DF_RATIO = 0.4\n");
console.log("--- 生成器が撒く同義語（本文に無ければ被覆から外したい側）---");
for (const t of SPRAYED) {
  const s = stat(t);
  console.log(`  ${t}\t df=${(s.ratio * 100).toFixed(2)}%\t 本文にある記事=${s.inBody}`);
}
console.log("--- 本文の内容語（外してはいけない側）---");
for (const t of BODY_WORDS) {
  const s = stat(t);
  console.log(`  ${t}\t df=${(s.ratio * 100).toFixed(2)}%\t 本文にある記事=${s.inBody}`);
}
