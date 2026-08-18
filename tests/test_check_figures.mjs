/**
 * tools/check_figures.py が「発火すべき所で発火し、しない所で発火しない」ことを固定する。
 *
 * なぜ要るか(2026-08-19): この幾何検査は毎便 /tmp に書き捨てられており、同じバグを
 * 毎回作り直していた。実際の書き捨て版は属性名の正規表現が `(\w+)="..."` で、
 * **`text-anchor` と `font-size` はハイフンを含むので一度もマッチしていなかった**
 * ＝ 全テキストが anchor=start / font-size=13 として測られていた。
 * 指摘0件でも、それは「欠陥が無い」ではなく「測っていない」だった。
 *
 * ★ここで一番大事なのは**発火しないケース**(t2/t4/t5)。
 *   発火する側だけ検査すると「常に発火する壊れた検査」を緑で通してしまう。
 */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = join(root, "tools", "check_figures.py");
/** check_figures.py は指摘があると exit 1 を返す。stdout は常に読む。 */
function run(args, cwd) {
  try {
    return execFileSync("python3", args, { encoding: "utf8", cwd });
  } catch (e) {
    if (e.stdout == null) throw e;   // 本当に起動できなかった場合は落とす
    return e.stdout;
  }
}

const base = mkdtempSync(join(tmpdir(), "figcheck-"));

const CASES = [
  // [名前, HTML, 種別, 発火すべきか]
  ["rect が viewBox を明確に超える", `<svg viewBox="0 0 640 200"><rect x="10" y="10" width="900" height="20"/></svg>`, "exact", true],
  // ★実在の形(shitsugyo-hoken-keisan fig1)。transform を解釈できないと誤検知になる
  ["translate で viewBox 内に収まる", `<svg viewBox="0 0 720 300"><rect x="540" y="176" width="240" height="76" transform="translate(-60,0)"/></svg>`, "exact", false],
  ["translate で逆にはみ出す", `<svg viewBox="0 0 720 300"><rect x="540" y="176" width="240" height="76" transform="translate(60,0)"/></svg>`, "exact", true],
  ["text 同士が重なる", `<svg viewBox="0 0 640 200"><text x="320" y="50" font-size="13" text-anchor="middle">あいうえお</text><text x="322" y="50" font-size="13" text-anchor="middle">かきくけこ</text></svg>`, "estimate", true],
  // rotate は解釈できないので検査対象から外す(座標だけで測ると誤検知)
  ["rotate は検査しない", `<svg viewBox="0 0 640 200"><rect x="10" y="10" width="900" height="20" transform="rotate(15)"/></svg>`, "exact", false],
  // ★text-anchor を読めていないと、この2件は逆の結果になる
  ["text-anchor=end は右端に収まる", `<svg viewBox="0 0 640 200"><text x="639" y="50" font-size="13" text-anchor="end">あいうえおかきくけこ</text></svg>`, "estimate", false],
  ["text-anchor 既定(start)は右へはみ出す", `<svg viewBox="0 0 640 200"><text x="600" y="50" font-size="13">あいうえおかきくけこ</text></svg>`, "estimate", true],
];

let n = 0;
for (const [name, html, kind, shouldFire] of CASES) {
  const dir = join(base, `c${n++}`);
  mkdirSync(dir, { recursive: true });
  const f = join(dir, "index.html");
  writeFileSync(f, html, "utf8");
  // ★指摘があると exit 1 なので throw する。stdout を必ず読むこと(握り潰すと検査が死ぬ)
  const out = run([TOOL, f]);
  const hits = out.split("\n").filter((l) => l.trim().startsWith(`[${kind}]`)).length;
  if (shouldFire) assert.ok(hits > 0, `「${name}」で [${kind}] が発火しなかった`);
  else assert.strictEqual(hits, 0, `「${name}」で [${kind}] が誤って発火した:\n${out}`);
}

// 本番の記事全体で [exact] が0件であること(算術で確定するものだけ。estimate は候補なので数えない)
const all = run([TOOL, "--exact"], root);
const m = all.match(/\[exact\]\s*(\d+)件/);
assert.ok(m, "集計行が読めない");
assert.strictEqual(m[1], "0", `docs/ に [exact] の幾何違反がある:\n${all}`);

console.log(`✓ check_figures: ${CASES.length}ケース(発火4/非発火3) + docs全体の[exact]0件`);
