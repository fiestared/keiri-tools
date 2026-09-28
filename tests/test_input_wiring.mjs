// test_input_wiring.mjs — 計算機の入力欄が答えを動かしているかの関門（2026-09-28 昇格）。
// 本体は tools/check_input_wiring.mjs（実ブラウザで全計算機の入力欄を1つずつ動かす。約14分）。
// ★昇格の経緯: 初回は候補53件（誤検知が大半）→ 仕分けで道具の誤検知45件を直し、正しく動かない7件を理由つきで許可し、
//   本物の配線漏れ1件（国民年金の免除で控除がいつも0円扱い。入力欄の id 変更にページが追随していなかった）を直して、候補0件になった。
//   gbrain implementation/keiri-input-wiring-triage-2026-09-28。1ページだけ: WIRING_ONLY=<dir>
import { spawnSync } from "node:child_process";
const r = spawnSync(process.execPath, [new URL("../tools/check_input_wiring.mjs", import.meta.url).pathname],
  { stdio: "inherit", env: { ...process.env, WIRING_STRICT: "1" } });
process.exit(r.status ?? 1);
