#!/usr/bin/env node
/**
 * test_measurement_wiring.mjs の壊しテスト。
 * 規則2: 壊す前に「無傷が緑」を確かめる（常に赤の検査は何を壊しても赤＝嘘の満点を出す）。
 * 規則1: 落ちるべきものが落ちることと、通るべきものが通ることを両方見る。
 *
 * ファイルを一時的に書き換えるので、**必ず finally で復元する**。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const TEST = new URL("./test_measurement_wiring.mjs", import.meta.url).pathname;
const run = () => {
  try {
    execFileSync("node", [TEST], { encoding: "utf8", stdio: "pipe" });
    return true; // 緑
  } catch {
    return false; // 赤
  }
};

if (!run()) {
  console.error("✗ ベースラインが赤。壊しテストは無意味なので降りる（規則2）");
  process.exit(1);
}
console.log("✓ ベースライン: 無傷のページで検査が緑");

// 壊す対象: 通常のツールページ / 記事 / 免除されている embed の3系統
const CASES = [
  {
    name: "ツールページのGA4を消す",
    file: new URL("../docs/invoice-bangou/index.html", import.meta.url).pathname,
    mutate: (s) => s.replace("gtag/js?id=G-E742DSDHPD", "gtag/js?id=REMOVED"),
    expectRed: true,
  },
  {
    name: "ツールページのAdSenseを消す",
    file: new URL("../docs/inshi/index.html", import.meta.url).pathname,
    mutate: (s) => s.replaceAll("ca-pub-2635067516563578", "ca-pub-REMOVED"),
    expectRed: true,
  },
  {
    name: "記事のcanonicalを消す",
    file: new URL("../docs/column/part-yukyu/index.html", import.meta.url).pathname,
    mutate: (s) => s.replace('rel="canonical"', 'rel="not-canonical"'),
    expectRed: true,
  },
  {
    name: "免除中のembedのGA4を消しても緑のまま（正しいものを落とさない・規則1）",
    file: new URL("../docs/embed/inshi/index.html", import.meta.url).pathname,
    mutate: (s) => s.replace("<head>", "<head><!-- touched -->"),
    expectRed: false,
  },
];

let caught = 0;
const missed = [];
for (const c of CASES) {
  const orig = readFileSync(c.file, "utf8");
  const broken = c.mutate(orig);
  if (broken === orig) {
    console.error(`  ✗ 壊し方が外れた（文字列が一致せず無変更）: ${c.name}（規則8）`);
    missed.push(c.name);
    continue;
  }
  try {
    writeFileSync(c.file, broken);
    const green = run();
    const ok = c.expectRed ? !green : green;
    if (ok) {
      caught++;
      console.log(`  ✓ ${c.name} … ${c.expectRed ? "捕捉した" : "緑のまま（期待どおり）"}`);
    } else {
      missed.push(c.name);
      console.error(`  ✗ ${c.name} … ${c.expectRed ? "素通しした" : "誤って落とした"}`);
    }
  } finally {
    writeFileSync(c.file, orig); // 必ず戻す
  }
}

if (!run()) {
  console.error("✗ 復元後に検査が赤。ファイルが元に戻っていない");
  process.exit(1);
}
console.log(`\n壊し ${CASES.length}方向 / 期待どおり ${caught} / 取りこぼし ${missed.length}`);
if (missed.length) {
  console.error("✗ break_measurement_wiring: " + missed.join(", "));
  process.exit(1);
}
console.log("✅ break_measurement_wiring: 全方向を捕捉（復元も確認）");
