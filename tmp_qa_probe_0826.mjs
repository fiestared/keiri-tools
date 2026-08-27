import { readFileSync } from "node:fs";
import { search } from "./docs/assets/qa_search.js";
const index = JSON.parse(readFileSync("./docs/assets/qa_index.json", "utf8"));
const r = search(index, "資格の勉強時間の目安");
console.log("matched:", r.matched, "best:", r.best);
console.log("hits:", JSON.stringify((r.hits || r.results || []).slice(0, 3), null, 1).slice(0, 900));
