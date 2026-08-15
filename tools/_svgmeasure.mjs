// 一時的な測定ハーネス（この便かぎり。git clean で消す）
// 記事のインラインSVGを実描画し、幾何を測る:
//   ① viewBox の外へ出た要素
//   ② text どうしの重なり
//   ③ stroke に未解決の CSS 変数（style.css が効いていない）
// ★申し送り608/616: HTTP配信にする（file:// は相対パスの挙動が違う）。
//   装置自身の健全性を印字する（CSS変数が解決できているかを自己申告）。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TARGET = process.argv[2] || "/column/kenko-shindan/";
const PORT = 18931;

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  try {
    const buf = await readFile(join(ROOT, "docs", p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(buf);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise(r => server.listen(PORT, r));

const profile = await mkdtemp(join(tmpdir(), "svgm-"));
const port = 19331;
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
], { stdio: "ignore" });

async function cdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const tabs = await r.json();
      const t = tabs.find(t => t.type === "page");
      if (t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("chrome did not come up");
}

const ws = new (await import("node:worker_threads")).Worker(`
  const { parentPort, workerData } = require("node:worker_threads");
`, { eval: true }); ws.terminate();

const wsUrl = await cdp();
const WebSocket = (await import("node:http")).default && globalThis.WebSocket;
const sock = new WebSocket(wsUrl);
await new Promise(r => sock.addEventListener("open", r));
let id = 0;
const pending = new Map();
sock.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; pending.set(i, res);
  sock.send(JSON.stringify({ id: i, method, params }));
});

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: `http://127.0.0.1:${PORT}${TARGET}` });
await new Promise(r => setTimeout(r, 2500));

const EXPR = `(() => {
  const out = { self: {}, svgs: [], ng: [] };
  const cs = getComputedStyle(document.documentElement);
  for (const v of ["--accent", "--sub", "--warn-line"]) out.self[v] = cs.getPropertyValue(v).trim();
  out.self.styleSheets = document.styleSheets.length;
  document.querySelectorAll("figure.figure svg").forEach((svg, si) => {
    const vb = svg.viewBox.baseVal;
    const rec = { i: si, viewBox: [vb.x, vb.y, vb.width, vb.height], texts: 0, outside: [], overlap: [], unresolvedStroke: [] };
    const sr = svg.getBoundingClientRect();
    const sx = sr.width / vb.width, sy = sr.height / vb.height;
    const boxes = [];
    svg.querySelectorAll("text").forEach(t => {
      rec.texts++;
      const b = t.getBBox();
      if (b.x < vb.x - 0.5 || b.y < vb.y - 0.5 || b.x + b.width > vb.x + vb.width + 0.5 || b.y + b.height > vb.y + vb.height + 0.5) {
        rec.outside.push({ text: t.textContent.slice(0, 24), x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) });
      }
      boxes.push({ t: t.textContent.slice(0, 24), x: b.x, y: b.y, w: b.width, h: b.height });
    });
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const A = boxes[a], B = boxes[b];
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (ox > 0.5 && oy > 0.5) rec.overlap.push({ a: A.t, b: B.t, ox: +ox.toFixed(1), oy: +oy.toFixed(1) });
    }
    svg.querySelectorAll("[stroke],[fill]").forEach(el => {
      for (const attr of ["stroke", "fill"]) {
        const raw = el.getAttribute(attr);
        if (!raw || !raw.startsWith("var(")) continue;
        const resolved = getComputedStyle(el)[attr];
        if (!resolved || resolved === "none" || resolved === "" ) rec.unresolvedStroke.push({ attr, raw });
      }
    });
    out.svgs.push(rec);
    if (rec.outside.length || rec.overlap.length || rec.unresolvedStroke.length) out.ng.push(si);
  });
  return JSON.stringify(out);
})()`;

const r = await send("Runtime.evaluate", { expression: EXPR, returnByValue: true });
const val = r.result?.result?.value;
if (!val) { console.error("測定に失敗（評価結果が空）"); process.exitCode = 2; }
else {
  const o = JSON.parse(val);
  const accent = o.self["--accent"];
  console.log(`装置の自己申告: --accent="${accent}" --sub="${o.self["--sub"]}" --warn-line="${o.self["--warn-line"]}" styleSheets=${o.self.styleSheets}`);
  if (!accent) { console.error("✘ CSS変数が解決できていない＝style.css が効いていない。測定を中止する"); process.exitCode = 2; }
  else {
    for (const s of o.svgs) {
      console.log(`SVG#${s.i} viewBox=${s.viewBox.join(" ")} text=${s.texts} はみ出し=${s.outside.length} 重なり=${s.overlap.length} 未解決stroke=${s.unresolvedStroke.length}`);
      for (const x of s.outside) console.log(`   ✘ はみ出し: "${x.text}" x=${x.x} y=${x.y} w=${x.w} h=${x.h}`);
      for (const x of s.overlap) console.log(`   ✘ 重なり: "${x.a}" × "${x.b}" (${x.ox}×${x.oy}px)`);
      for (const x of s.unresolvedStroke) console.log(`   ✘ 未解決: ${x.attr}=${x.raw}`);
    }
    console.log(o.ng.length ? `NG ${o.ng.length}件` : "NG 0件");
    if (o.ng.length) process.exitCode = 1;
  }
}
sock.close(); chrome.kill(); server.close(); await rm(profile, { recursive: true, force: true });
