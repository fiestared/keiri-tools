import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { search } from "./docs/assets/qa_search.js";

const now = JSON.parse(readFileSync("./docs/assets/qa_index.json", "utf8"));
const before = JSON.parse(execSync("git show HEAD:docs/assets/qa_index.json", { maxBuffer: 1 << 28 }).toString());

const Q = "資格の勉強時間の目安";
for (const [label, idx] of [["HEAD(変更前)", before], ["いま", now]]) {
  const r = search(idx, Q);
  const n = (idx.docs || idx.items || idx).length;
  console.log(label, "件数=", n, "matched=", r.matched, "best=", r.best.toFixed(3));
}
