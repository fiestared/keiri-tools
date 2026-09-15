/**
 * test_nav_experiment.mjs が「落ちるべきものを落とす」か確かめる（CLAUDE.md 規則2: 先に無傷が緑であることを見る）。
 * node tests/break_nav_experiment.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNavExperiment } from "../tools/nav_experiment.mjs";
import { checkPages, checkTableFix, checkCss } from "./test_nav_experiment.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const COLUMN = join(ROOT, "docs/column");
const exp = loadNavExperiment();
const pages = new Map();
for (const d of readdirSync(COLUMN, { withFileTypes: true })) {
  const f = join(COLUMN, d.name, "index.html");
  if (d.isDirectory() && existsSync(f)) pages.set(d.name, readFileSync(f, "utf8"));
}
const read = (m) => (s) => m.get(s) || "";
const CSS = readFileSync(join(ROOT, "docs/assets/style.css"), "utf8");

const base = [...checkPages(pages, exp), ...checkTableFix(read(pages), CSS), ...checkCss(CSS)];
if (base.length) { console.error(`✗ 無傷の状態で既に赤い（壊しテストの意味が無い）:\n  ${base.join("\n  ")}`); process.exit(1); }

const T0 = exp.treatment[0];
const C0 = exp.control[0];
const cases = [
  ["次に読むが対照へリンク", (m) => m.set(T0, m.get(T0).replace(/(<!--next-read:S-->[\s\S]*?<a class="tool-card" href=")[^"]*"/, `$1../${C0}/"`))],
  ["次に読むが保護対象へリンク", (m) => m.set(T0, m.get(T0).replace(/(<!--next-read:S-->[\s\S]*?<a class="tool-card" href=")[^"]*"/, '$1../furikomi-tesuryo-hikaku/"'))],
  ["次に読むを手作り関連の前へ戻した", (m) => {
    const h = m.get(T0); const blk = h.match(/\n  <!--next-read:S-->[\s\S]*?<!--next-read:E-->/)[0];
    const out = h.replace(blk, ""); m.set(T0, out.replace('<section class="related"', blk.trim() + "\n" + '<section class="related"'));
  }],
  ["右レールの関連を消した", (m) => m.set(T0, m.get(T0).replace(/<!--rail-next:S-->[\s\S]*?<!--rail-next:E-->/, ""))],
  ["右レールを目次から離した", (m) => m.set(T0, m.get(T0).replace(/<\/nav>(<!--rail-next:S-->)/, "</nav> $1"))],
  ["右レールが自分へリンク", (m) => m.set(T0, m.get(T0).replace(/(<!--rail-next:S-->[\s\S]*?<a href=")[^"]*"/, `$1../${T0}/"`))],
  ["対照に実験の印が紛れた", (m) => m.set(C0, m.get(C0).replace('<section class="next-read">', '<section class="next-read" data-nav-exp="t">'))],
  ["目印の形が崩れた", (m) => m.set(T0, m.get(T0).replace("<!--next-read:E-->", "<!--next-read:E"))],
  ["次に読むから対象の印を外した", (m) => m.set(T0, m.get(T0).replace('<section class="next-read" data-nav-exp="t">', '<section class="next-read">'))],
  ["記事内に <style> を足した", (m) => m.set(T0, m.get(T0).replace("<!--next-read:E-->", "<!--next-read:E--><style>.x{}</style>"))],
];
const tableCases = [
  ["標準報酬の全行表示を消した", (m) => m.set("hyojun-hoshu-gakuhyo", m.get("hyojun-hoshu-gakuhyo").replace('id="hyou-expand"', 'id="x"'))],
  ["全銀のリンクを表から離した", (m) => m.set("zengin-format-guide", m.get("zengin-format-guide").replace(/(<\/table>\n)(  <!--nav-exp:table-link S-->)/, "$1<p>x</p>\n$2"))],
  ["全銀のリンク先を変えた", (m) => m.set("zengin-format-guide", m.get("zengin-format-guide").replace(/(<!--nav-exp:table-link S-->[\s\S]*?)\.\.\/\.\.\/zengin-kana\//, "$1../../eigyobi/"))],
];

let missed = 0;
for (const [name, mutate] of [...cases, ...tableCases]) {
  const m = new Map(pages);
  const before = [...m.values()].join("");
  mutate(m);
  if ([...m.values()].join("") === before) { console.error(`  ⚠️ 壊し方が外れた（何も変わっていない）: ${name}`); missed++; continue; }
  const errs = [...checkPages(m, exp), ...checkTableFix(read(m), CSS), ...checkCss(CSS)];
  if (errs.length) console.log(`  ✓ 捕捉: ${name}（${errs[0]}）`);
  else { console.error(`  ✗ 素通し: ${name}`); missed++; }
}
if (missed) { console.error(`✗ ${missed}件を捕捉できなかった`); process.exit(1); }
console.log(`✓ 壊しテスト ${cases.length + tableCases.length}件すべて捕捉`);

// CSS 側の壊し（style.css は1枚なので文字列で壊して checkTableFix / checkCss に渡す）
const cssCases = [
  ["印刷で表を枠の高さに戻した", CSS.replace(".table-cue ~ .scroll-wrap { max-height: none !important;", ".table-cue ~ .scroll-wrap { max-height: 640px !important;")],
  ["1200px未満でも右レールの関連を出した", CSS.replace("@media (max-width: 1199.98px) { .rail-next { display: none; } }", "")],
  ["右レールの関連の見た目を消した", CSS.replace(".rail-next { background: #fff;", ".rail-next { background: none;")],
];
let cssMissed = 0;
for (const [name, css] of cssCases) {
  if (css === CSS) { console.error(`  ⚠️ 壊し方が外れた: ${name}`); cssMissed++; continue; }
  const errs = [...checkTableFix(read(pages), css), ...checkCss(css)];
  if (errs.length) console.log(`  ✓ 捕捉: ${name}（${errs[0]}）`); else { console.error(`  ✗ 素通し: ${name}`); cssMissed++; }
}
if (cssMissed) { console.error(`✗ CSS の壊し ${cssMissed}件を捕捉できなかった`); process.exit(1); }
console.log(`✓ CSS の壊しテスト ${cssCases.length}件すべて捕捉`);
