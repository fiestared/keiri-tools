// test_stale_values_rules.mjs — 古い値の拒否リスト（test_stale_values）の判定ルールそのものを守る。
// 規則1: 古い値は捕まえ（落ちるべきもの）、新旧の比較・改定日前・予定納税は通す（通るべきもの）を両方見る。
import { staleHits, futureTenseHits } from "./test_stale_values.mjs";
import { readFileSync } from "node:fs";
const C = JSON.parse(readFileSync(new URL("./stale_values.json", import.meta.url)));
const E = Object.fromEntries(C.entries.map((e) => [e.id, e]));
const t = (s, id, day = "2026-09-28") => staleHits(s, E[id], "p", day).length;
const r = [
  ["旧上限をそのまま書く→捕まえる", t("育児休業給付金の上限額は月額16,110円です。", "ikukyu-cap-16110") === 1],
  ["新旧を並べる→通す", t("育児休業給付金の上限は16,110円から16,540円に上がりました。", "ikukyu-cap-16110") === 0],
  ["改定日より前の日付で見る→通す", t("育児休業給付金の上限額は月額16,110円です。", "ikukyu-cap-16110", "2026-07-31") === 0],
  ["令和8年分に58万円→捕まえる", t("令和8年分の扶養親族の所得要件は58万円以下です。", "fuyo-shotoku-58man-r8") === 1],
  ["令和7年分と比べる→通す", t("所得要件は令和7年分は58万円以下、令和8年分は62万円以下です。", "fuyo-shotoku-58man-r8") === 0],
  ["過ぎた日付の未来形→捕まえる", futureTenseHits("令和8年9月1日に様式の改正が施行されます。", C.future_tense, "p", "2026-09-28").length === 1],
  ["これからの日付の未来形→通す", futureTenseHits("2027年4月1日から始まります。", C.future_tense, "p", "2026-09-28").length === 0],
  ["予定だった（過去の話）→通す", futureTenseHits("2026年3月31日——つまりこの法律は、5か月前に失効する予定だったのです。", C.future_tense, "p", "2026-09-28").length === 0],
  ["予定納税→通す", futureTenseHits("令和8年7月31日（金） 申告所得税 予定納税", C.future_tense, "p", "2026-09-28").length === 0],
];
const bad = r.filter(([, ok]) => !ok);
if (bad.length) { console.error(bad.map(([n]) => "✗ " + n).join("\n")); process.exit(1); }
console.log(`✓ test_stale_values_rules: ${r.length}ケース（捕まえる4・通す5）`);
