/**
 * test_shaho_kosei_cap.mjs の壊しテスト。
 * 規則2: 壊す前に「無傷が緑」を確かめる(常に赤い検査は何を壊しても赤＝嘘の満点)。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "../docs/assets/shaho_rates_r08.json");
const CORE = path.join(here, "../docs/assets/shaho_core.js");
const TEST = path.join(here, "test_shaho_kosei_cap.mjs");

const run = (env = {}) => {
  try {
    execFileSync("node", [TEST], { stdio: "pipe", env: { ...process.env, ...env } });
    return { green: true, out: "" };
  } catch (e) {
    return { green: false, out: String(e.stdout || "") + String(e.stderr || "") };
  }
};

const origData = fs.readFileSync(DATA, "utf8");
const origCore = fs.readFileSync(CORE, "utf8");
const restore = () => {
  fs.writeFileSync(DATA, origData);
  fs.writeFileSync(CORE, origCore);
};

// ── ベースライン(規則2) ──
const base = run();
if (!base.green) {
  console.error("✗ ベースラインが赤。壊しテストは実施しない(嘘の満点を避ける)");
  console.error(base.out.slice(0, 800));
  process.exit(1);
}
console.log("✓ ベースライン緑");

const cases = [
  {
    name: "① データの current を680,000に(コアだけ据え置き)",
    apply: () => {
      const d = JSON.parse(origData);
      d.kosei_grade_cap.current = 680000;
      fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
    },
  },
  {
    name: "② コアの KOSEI_MAX を680,000に(データだけ据え置き)",
    apply: () => fs.writeFileSync(CORE, origCore.replace("KOSEI_MAX = 650000", "KOSEI_MAX = 680000")),
  },
  {
    name: "③ scheduled[0] の金額を700,000へ(条文と食い違わせる)",
    apply: () => {
      const d = JSON.parse(origData);
      d.kosei_grade_cap.scheduled[0].standard = 700000;
      fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
    },
  },
  {
    name: "④ scheduled[0] の等級を34へ(連番を壊す)",
    apply: () => {
      const d = JSON.parse(origData);
      d.kosei_grade_cap.scheduled[0].grade = 34;
      fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
    },
  },
  {
    name: "⑤ recheck_after を過去日に(カナリア)",
    apply: () => {
      const d = JSON.parse(origData);
      d.kosei_grade_cap.recheck_after = "2020-01-01";
      fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
    },
  },
  {
    // recheck_after を遠い未来へ延ばして黙らせても、施行日を過ぎたら第2カナリアが鳴ること。
    // ★データの from を過去に書き換える壊し方では逐語オラクルが先に落ちてしまい、
    //   第2カナリアが一度も発火しない(規則8: 素通しでなく「壊し方が外れている」の逆で、
    //   別の検査が当たって"捕捉した"と誤認する)。→ 日付シームで「2027-09-02の世界」を再現する。
    name: "⑥ recheck_after を2099年へ延ばす + 施行日を過ぎた世界(二重カナリア)",
    apply: () => {
      const d = JSON.parse(origData);
      d.kosei_grade_cap.recheck_after = "2099-01-01";
      fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
    },
    env: { SHAHO_CAP_TODAY: "2027-09-02" },
    expect: /第33級|過少/,
  },
  {
    name: "⑦ コアの上限クランプを削除(実害そのものの再現)",
    apply: () =>
      fs.writeFileSync(
        CORE,
        origCore.replace("if (standard > KOSEI_MAX) return KOSEI_MAX;", ""),
      ),
  },
  {
    name: "⑧ データの kosei_min を98,000に",
    apply: () => {
      const d = JSON.parse(origData);
      d.kosei_grade_cap.kosei_min = 98000;
      fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
    },
  },
];

let caught = 0;
let wrongAssertion = 0;
for (const c of cases) {
  restore();
  c.apply();
  const r = run(c.env || {});
  restore();
  if (r.green) {
    console.error(`✗ 素通し: ${c.name}`);
    continue;
  }
  const first = r.out.split("\n").find((l) => /AssertionError|Error|【カナリア】/.test(l)) || "";
  // ★「赤くなった」だけで満足しない。**狙った検査が落ちたのか**を確かめる(規則8)。
  //   別の検査が先に当たっていたら、狙った検査は一度も発火していない。
  if (c.expect && !c.expect.test(r.out)) {
    console.error(`✗ 別の検査が当たった(狙った検査は未発火): ${c.name}`);
    console.error(`     └ ${first.trim().slice(0, 140)}`);
    wrongAssertion++;
    continue;
  }
  caught++;
  console.log(`✓ 捕捉: ${c.name}`);
  if (first) console.log(`     └ ${first.trim().slice(0, 130)}`);
}
restore();

// 規則1: 通るべきものが通る。日付シームを入れたせいで常に緑/常に赤になっていないこと。
const seamGreen = run({ SHAHO_CAP_TODAY: "2026-07-25" });
const seamRed = run({ SHAHO_CAP_TODAY: "2027-09-02" });
console.log(
  `\n[規則1] シーム健全性: 2026-07-25→${seamGreen.green ? "緑" : "赤"} / 2027-09-02→${seamRed.green ? "緑" : "赤"}`,
);
const seamOk = seamGreen.green && !seamRed.green;
if (!seamOk) console.error("✗ 日付シームが機能していない(常に緑か常に赤)");

console.log(`\n${caught}/${cases.length} 方向を捕捉${wrongAssertion ? ` (別検査ヒット ${wrongAssertion}件)` : ""}`);
process.exit(caught === cases.length && seamOk ? 0 : 1);
