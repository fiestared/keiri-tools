/**
 * 1280px で、**節見出しとその節の中身が同じ幅**であることを全ページで確かめる。
 *
 *   node tests/test_section_width.mjs
 *
 * ★なぜ要るか（2026-08-27 実測）:
 *   版面を広げたとき `main > .post-list` をシェル幅の指定に入れ忘れ、
 *   **トップの「新着コラム」だけ 672px** で残った（他は 1120px）。
 *   直前の見出し「コラム」は 1120px なので、見出しの右端と中身の右端が 448px ずれていた。
 *   ★左端は 80px で揃っていたので、test_left_edge は**素通りさせた**。
 *     「左端が1本」だけでは足りない。**節の器と中身の幅が合っているか**も見る。
 *
 * ★通常ページでは右端そのものを一律に揃えない。672px と 1120px の混在は設計として正しい。
 *   ただし `.hub-page` は一覧・説明・コラムを一続きの版面として見せるため、直下要素を同幅にする。
 */
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const DOCS = join(ROOT, 'docs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8938;
const WIDTH = 1280;
const TOL = 2;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };

if (!existsSync(CHROME)) { console.log('↷ Chrome が無いので測定を飛ばします'); process.exit(0); }

async function collect() {
  const out = ['/'];
  for (const d of await readdir(DOCS, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === 'assets' || d.name === 'embed') continue;
    if (existsSync(join(DOCS, d.name, 'index.html'))) out.push(`/${d.name}/`);
  }
  for (const d of await readdir(join(DOCS, 'column'), { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(join(DOCS, 'column', d.name, 'index.html'))) out.push(`/column/${d.name}/`);
  }
  return out;
}
const list = await collect();
const results = [];
let idx = 0, done;
const finished = new Promise((r) => { done = r; });

// 節見出し(.section-head)の直後の兄弟が「その節の中身」。幅が食い違っていたら報告する。
// ★中身が短いテキスト1行だけ（Xで共有リンクなど）のときは器ではないので数えない。
const INJECT = (next) => `<script>
(function(){
  function W(el){ return Math.round(el.getBoundingClientRect().width); }
  var out = [];
  document.querySelectorAll('main > .section-head').forEach(function(h){
    var body = h.nextElementSibling;
    while (body && (body.getBoundingClientRect().height === 0)) body = body.nextElementSibling;
    if (!body) return;
    if (body.getBoundingClientRect().height < 60) return;   // 器と呼べない高さは対象外
    var wh = W(h), wb = W(body);
    if (Math.abs(wh - wb) > ${TOL}) {
      out.push({ head: (h.textContent||'').trim().slice(0, 18), hw: wh,
                 body: body.tagName.toLowerCase() + (body.className ? '.' + String(body.className).trim().split(/\\s+/)[0] : ''), bw: wb });
    }
  });
  var hub = document.querySelector('main.hub-page');
  if (hub) {
    var style = getComputedStyle(hub);
    var expected = Math.round(hub.getBoundingClientRect().width
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    Array.from(hub.children).forEach(function(el){
      if (el.getBoundingClientRect().height === 0) return;
      var width = W(el);
      if (Math.abs(width - expected) > ${TOL}) {
        out.push({ head: 'ハブページ全体', hw: expected,
                   body: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\\s+/)[0] : ''), bw: width });
      }
    });
  }
  fetch('/__m', { method:'POST', body: JSON.stringify({ path: location.pathname, bad: out }) })
    .then(function(){ ${next ? `location.href = ${JSON.stringify(next)};` : `fetch('/__done',{method:'POST'});`} });
})();
</script>`;

function stripBeacons(html) {
  return html.replace(/(<script[^>]*\ssrc=")(https?:)?\/\/(www\.googletagmanager\.com|pagead2\.googlesyndication\.com)\/[^"]*(")/gi,
    (_m, a, _p, _h, z) => a + 'data:text/javascript,' + z);
}
const server = createServer(async (req, res) => {
  if (req.url === '/__m' && req.method === 'POST') {
    let b = ''; for await (const c of req) b += c;
    try { results.push(JSON.parse(b)); } catch { /* 壊れた報告は捨てる */ }
    res.writeHead(200); res.end('ok'); return;
  }
  if (req.url === '/__done') { res.writeHead(200); res.end('ok'); done(); return; }
  let p = decodeURIComponent(req.url.split('?')[0]);
  const isPage = p.endsWith('/');
  if (isPage) p += 'index.html';
  try {
    const buf = await readFile(join(DOCS, p));
    if (isPage) { idx++; res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(stripBeacons(buf.toString('utf8')) + INJECT(list[idx] || null)); }
    else { res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(buf); }
  } catch { res.writeHead(404); res.end('nf'); }
});
const listened = await new Promise((ok) => {
  server.once('error', (e) => ok({ err: e }));
  server.listen(PORT, '127.0.0.1', () => ok({ err: null }));
});
if (listened.err) {
  console.log(`↷ ローカルHTTPを立てられないので測定を飛ばします（${listened.err.code}）。`);
  console.log('   ★これは「幅が揃っている」という意味ではない。測っていないだけ。');
  process.exit(0);
}
const profile = await mkdtemp(join(tmpdir(), 'secwidth-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, `--window-size=${WIDTH},900`, `http://localhost:${PORT}${list[0]}`], { stdio: 'ignore' });
const timeout = setTimeout(() => done(), 1000 * 60 * 10);
await finished; clearTimeout(timeout);
chrome.kill(); server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});

const bad = results.filter((r) => r.bad && r.bad.length);
const seen = new Set(results.map((r) => r.path));
const missed = list.filter((p) => !seen.has(p));
if (bad.length || missed.length > list.length * 0.1) {
  if (bad.length) {
    console.error(`✗ 節見出しと中身の幅が食い違うページ ${bad.length}件（測定 ${results.length}/${list.length}）:`);
    for (const b of bad.slice(0, 12)) {
      console.error(`  - ${b.path}`);
      for (const x of b.bad) console.error(`      「${x.head}」 見出し ${x.hw}px ／ 中身 ${x.body} ${x.bw}px`);
    }
    console.error('\n  節の器と中身は同じ幅にする（672px か 1120px のどちらかに揃える）。');
    console.error('  docs/assets/style.css の `main > .section-head, …` の並びに入れ忘れが無いか確かめること。');
  }
  if (missed.length > list.length * 0.1) console.error(`✗ 測定できなかったページが ${missed.length}件。測定の仕組みを疑うこと。`);
  process.exit(1);
}
console.log(`✓ 節見出しと中身の幅は一致（${results.length}ページ・${WIDTH}px）`);
