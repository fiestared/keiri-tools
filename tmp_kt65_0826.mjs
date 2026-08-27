import { calcKihonteate, wageAgeBand, daysAgeBand } from "./docs/assets/kihonteate_core.js";
import { readFileSync } from "node:fs";
const D = JSON.parse(readFileSync("./docs/assets/kihonteate_r07.json", "utf8"));
for (const age of [59, 60, 64, 65, 66, 70]) {
  const r = calcKihonteate({ age, monthly: 300000, period: "y20", reason: "kaisha" }, D);
  const out = r.supported === false
    ? { supported: false, msg: r.message.slice(0, 36) }
    : { daily: r.daily, days: r.days, total: r.total, cap: r.cap };
  console.log(age, "wageBand=" + wageAgeBand(age), "daysBand=" + daysAgeBand(age), JSON.stringify(out));
}
