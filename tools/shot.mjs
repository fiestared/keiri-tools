/**
 * ヘッドレスChromeでページを実描画してPNGに落とす（図解SVGの目視確認用）。
 *   node tools/shot.mjs <ページのパス(docs/からの相対)> <出力PNG> [幅] [高さ]
 * インラインSVGは座標を手で置くので、描かないと「宙に浮いた線」に気づけない。
 */
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = join(resolve(fileURLToPath(new URL("../", import.meta.url))));
const [page, out, w = "760", h = "3200"] = process.argv.slice(2);
if (!page || !out) { console.error("usage: node tools/shot.mjs <docs相対パス> <out.png> [幅] [高さ]"); process.exit(2); }

const url = "file://" + join(root, "docs", page);
const r = spawnSync(CHROME, [
  "--headless", "--disable-gpu", "--hide-scrollbars",
  `--screenshot=${resolve(out)}`, `--window-size=${w},${h}`, url,
], { encoding: "utf8" });
console.log(r.status === 0 ? `✓ ${out}` : `✗ 失敗 (${r.status})\n${r.stderr}`);
process.exit(r.status ?? 1);
