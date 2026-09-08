/**
 * /yukyu/ の「この端末に覚えておく」の**配線**を実ブラウザで確かめる。
 *
 *   node tests/test_yukyu_memo_page.mjs
 *
 * ★なぜ純ロジックのテストで足りないか:
 *   tests/test_tool_memo.mjs は isRevisit() 等の関数を見ているだけで、
 *   「**ページがその関数を実際に呼んでいるか**」を見ていない。
 *   実験の判定は GA4 の tool_revisit 件数だけで行うので、
 *   配線が外れたまま緑になると **数字が0のまま「効果なし」と誤判定する**。
 *   ここが外れると実験そのものが嘘になるため、ブラウザで固定する。
 *
 * ★イベントの捕まえ方: ページ内の GA4 スニペットは gtag() を dataLayer に積む。
 *   配信時に gtag.js の src を潰しているので**送信はされず、積まれた記録だけが残る**。
 *   これを読めば、注入なしで発火を確認できる。
 * ★file:// では開かない（モジュールJSが読めない）。必ず HTTP 越し。
 */
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DOCS = join(ROOT, "docs");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 375;
const KEY = "yukyu_memo_v1";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const DEAD = "data:text/javascript,";
const stripBeacons = (h) => h.replace(
  /(<script[^>]*\ssrc=")(https?:)?\/\/(www\.googletagmanager\.com|pagead2\.googlesyndication\.com)\/[^"]*(")/gi,
  (_m, a, _p, _h, z) => a + DEAD + z);

/** 保存の中身を変えて3通り試す。savedAt が「今日より前」のときだけ tool_revisit が鳴るはず */
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
const CASES = [
  { name: "別日に戻ってきた", seed: [{ hire: "2024-04-01", wdays: 5, whours: 40, savedAt: yesterday }], card: true, revisit: true },
  { name: "同じ日の再訪", seed: [{ hire: "2024-04-01", wdays: 5, whours: 40, savedAt: today }], card: true, revisit: false },
  { name: "保存が無い", seed: null, card: false, revisit: false },
  // ★保存する側。ここが外れると実験は1件もデータを生まないのに「効果なし」と読めてしまう
  { name: "計算して保存する", seed: null, card: true, revisit: false, act: "save" },
];

// 1件だけ試す: ONLY="計算して保存する" node tests/test_yukyu_memo_page.mjs
if (process.env.ONLY) {
  const keep = CASES.filter((c) => c.name === process.env.ONLY);
  CASES.length = 0; CASES.push(...keep);
}

const T0 = Date.now();
let idx = 0, received = [], done;
const finished = new Promise((r) => { done = r; });

const FRAME = (i) => {
  const c = CASES[i];
  const seed = c.seed
    ? `try{localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(c.seed))})}catch(e){}`
    : `try{localStorage.removeItem(${JSON.stringify(KEY)})}catch(e){}`;
  return `<!doctype html><meta charset="utf-8">
<style>*{box-sizing:border-box}html,body{margin:0}iframe{display:block;border:0;width:${WIDTH}px;height:900px}</style>
<script>${seed}</script>
<iframe id="f" src="/yukyu/"></iframe><script>
f.onload=function(){setTimeout(function(){
  var w=f.contentWindow, d=f.contentDocument;
  var err='';
  try{ ${c.act === "save" ? `d.getElementById('calc').click(); d.getElementById('memo-save').click();` : ``} }catch(e){err=String(e&&e.message||e)}
  var card=d.getElementById('memo-card');
  var vis=!!card && w.getComputedStyle(card).display!=='none';
  var dl=w.dataLayer||[];
  var ev=[];for(var i=0;i<dl.length;i++){var a=dl[i];if(a&&a[0]==='event')ev.push(a[1]);}
  w.scrollTo(9999,0);var x=w.scrollX;w.scrollTo(0,0);
  var rows=card?card.querySelectorAll('[data-load]').length:0;
  var stored=0;try{stored=JSON.parse(w.localStorage.getItem(${JSON.stringify(KEY)})||'[]').length}catch(e){}
  var txt=card?(card.textContent||'').replace(/\\s+/g,' '):'';
  fetch('/__m',{method:'POST',body:JSON.stringify({name:${JSON.stringify(c.name)},vis:vis,ev:ev,x:x,rows:rows,txt:txt,stored:stored,err:err})}).then(function(){
    ${i + 1 < CASES.length ? `location.href='/__frame?i=${i + 1}'` : `fetch('/__done',{method:'POST'})`};
  });
},250)};
</script>`;
};

if (process.env.DUMP) { console.log(FRAME(Number(process.env.DUMP))); process.exit(0); }

const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__m") {
    let b = ""; for await (const c of req) b += c;
    received.push(JSON.parse(b));
    if (process.env.VERBOSE) console.log(`  ${Date.now() - T0}ms 受信: ${received[received.length - 1].name}`);
    res.end("ok"); return;
  }
  if (u.pathname === "/__done") { res.end("ok"); done(); return; }
  if (u.pathname === "/__frame") { res.setHeader("content-type", "text/html"); res.end(FRAME(Number(u.searchParams.get("i")) || 0)); return; }
  let p = join(DOCS, u.pathname);
  if (u.pathname.endsWith("/")) p = join(p, "index.html");
  try {
    let body = await readFile(p);
    const ext = extname(p);
    if (ext === ".html") body = Buffer.from(stripBeacons(body.toString("utf8")));
    res.setHeader("content-type", (MIME[ext] || "application/octet-stream") + "; charset=utf-8");
    res.end(body);
  } catch { res.statusCode = 404; res.end("nf"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const dir = await mkdtemp(join(tmpdir(), "keiri-memo-"));
const p = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    // ★--virtual-time-budget / --dump-dom は使わない。結果はページからのPOSTで受け取るので
  //   DOMのダンプは要らず、仮想時間の予算は**4件目のナビゲーションを黙って落とした**
  //   （3件で必ず止まり、予算を20倍にしても3件のままだった。2026-09-08 に切り分け済み）。
  `--user-data-dir=${dir}`, "--window-size=1280,1000",
  `http://127.0.0.1:${port}/__frame?i=0`], { stdio: "ignore" });
const exited = new Promise((r) => p.on("exit", r));
await Promise.race([finished, new Promise((r) => setTimeout(r, 240_000))]);
p.kill("SIGKILL"); await exited; await rm(dir, { recursive: true, force: true, maxRetries: 5 });
server.close();

/* ---- 判定 ---- */
const bad = [];
if (received.length !== CASES.length) bad.push(`${CASES.length}件中 ${received.length}件しか返らなかった（描画前に落ちた可能性）`);
for (const r of received) if (r.err) bad.push(`「${r.name}」: ページ内で例外 — ${r.err}`);
for (const c of CASES) {
  const r = received.find((x) => x.name === c.name);
  if (!r) { bad.push(`「${c.name}」が返らなかった`); continue; }
  if (r.vis !== c.card) bad.push(`「${c.name}」: 保存リストの表示が ${r.vis}（期待 ${c.card}）`);
  const fired = r.ev.includes("tool_revisit");
  if (fired !== c.revisit) bad.push(`「${c.name}」: tool_revisit の発火が ${fired}（期待 ${c.revisit}）— 実験の計器が壊れている`);
  if (r.x !== 0) bad.push(`「${c.name}」: ${WIDTH}px で ${r.x}px 横に動く`);
  if (c.card && c.seed && r.rows !== c.seed.length) bad.push(`「${c.name}」: 行数 ${r.rows}（期待 ${c.seed.length}）`);
  if (c.card && !/次回付与/.test(r.txt)) bad.push(`「${c.name}」: 次回付与日が描画されていない（core の呼び出しが外れている）`);
  if (c.act === "save") {
    if (!r.ev.includes("tool_save")) bad.push(`「${c.name}」: tool_save が鳴っていない — 保存の計器が壊れている`);
    if (r.stored !== 1) bad.push(`「${c.name}」: localStorage の保存件数が ${r.stored}（期待 1）`);
  }
}
if (bad.length) { console.error("✗ /yukyu/ 保存機能の配線:\n  - " + bad.join("\n  - ")); process.exit(1); }
console.log(`✓ test_yukyu_memo_page（${CASES.length}件: 表示・tool_revisit の発火/非発火・${WIDTH}px 横あふれ）`);
