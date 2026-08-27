import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function dfOf(idx, term) {
  const docs = idx.docs || idx.items || idx;
  let n = 0;
  for (const d of docs) if ((d.terms || "").includes(term)) n++;
  return { n, total: docs.length, ratio: n / docs.length };
}
const now = JSON.parse(readFileSync("./docs/assets/qa_index.json", "utf8"));
const before = JSON.parse(execSync("git show HEAD:docs/assets/qa_index.json", { maxBuffer: 1 << 28 }).toString());
for (const t of ["目安", "資格", "時間"]) {
  const a = dfOf(before, t), b = dfOf(now, t);
  console.log(t, "HEAD:", a.n + "/" + a.total, (a.ratio * 100).toFixed(2) + "%",
    "→ いま:", b.n + "/" + b.total, (b.ratio * 100).toFixed(2) + "%");
}
