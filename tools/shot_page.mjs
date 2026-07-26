/**
 * ページを http:// で開いてヘッドレスChromeで撮る（インラインSVGの目視確認用）。
 *
 *   node tools/shot_page.mjs <page> <out.png> [width] [height]
 *   例: node tools/shot_page.mjs fudosan-jouto/ /tmp/jouto.png 820 1600
 *
 * なぜ http:// か: file:// では ESモジュールが動かず、参照データから描く選択肢・表・
 * 既定値が出ないため「空の画面」を撮ってしまう。
 * ★--user-data-dir を必ず渡す: 省略すると既にログイン中のChromeのプロファイルを掴もうとして
 *   無言でハングする（実際に2回踏んだ）。
 */
import { spawnSync } from "node:child_process";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const docs = join(root, "docs");
const [page, out, w = "820", h = "1600"] = process.argv.slice(2);
if (!page || !out) {
  console.error("usage: node tools/shot_page.mjs <page> <out.png> [w] [h]");
  process.exit(2);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  try {
    const buf = await readFile(join(docs, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const profile = await mkdtemp(join(tmpdir(), "shot-chrome-"));
const r = spawnSync(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--user-data-dir=${profile}`,          // ★これが無いと既存プロファイルを掴んでハングする
  "--virtual-time-budget=5000",
  `--screenshot=${resolve(out)}`, `--window-size=${w},${h}`,
  `http://127.0.0.1:${port}/${page}`,
], { encoding: "utf8", timeout: 90000 });
server.close();
console.log(r.status === 0 ? `✓ ${out}` : `✗ 失敗 (status=${r.status})\n${(r.stderr || "").slice(-800)}`);
process.exit(r.status ?? 1);
