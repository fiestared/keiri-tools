/**
 * 1280px（デスクトップ）で、**ページ内の左端が1本に揃っている**ことを全ページで確かめる。
 *
 *   node tests/test_left_edge.mjs
 *
 * ★なぜ要るか（2026-08-27 実測）:
 *   版面を 1120px シェルに広げたとき、`main > *` の既定を「672px 中央寄せ」にして
 *   左寄せをトップとコラム一覧だけの特例にした。その結果**同じページに左端が2つ**できた。
 *     /hojokin/ … h1・タブは 80px から、絞り込みカードと結果カードは 304px から
 *   目視でしか気づけず、指摘されるまで 3回デプロイして 3回とも見落とした。
 *   「右端が揃っているか」ではなく **左端が1本か** を見るのが要点
 *   （右端は 672 と 1120 が混在してよい。左端が割れると壊れて見える）。
 *
 * ★測るのは main 直下の要素だけ。入れ子の中身は親の位置に従うので数えない。
 * ★共通ヘッダーはページ本文とは別の1120pxシェル。ページを移動しても位置が動かないことを
 *   全ページ横断で確かめる（本文が672pxのページでもヘッダーを狭めない）。
 * ★file:// では開かない（モジュールJSが読めず「全ページ壊れている」ように見える）。HTTP 越しに開く。
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
const PORT = 8937;
const WIDTH = 1280;
const TOL = 2;               // 2px までは同じ左端とみなす（丸め誤差）
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

const INJECT = (next) => `<script>
(function(){
  function L(el){ return Math.round(el.getBoundingClientRect().left); }
  var edges = {};
  var brand = document.querySelector('header.site .brand');
  var m = document.querySelector('main');
  if (m) Array.prototype.forEach.call(m.children, function(el){
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;           // 非表示は数えない
    if (getComputedStyle(el).position === 'fixed') return;  // 固定目次は別枠
    var k = L(el);
    var name = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : '');
    (edges[k] = edges[k] || []).push(name);
  });
  fetch('/__m', { method:'POST', body: JSON.stringify({ path: location.pathname, edges: edges, header: brand ? L(brand) : null }) })
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
  console.log('   ★これは「左端が揃っている」という意味ではない。測っていないだけ。');
  process.exit(0);
}
const profile = await mkdtemp(join(tmpdir(), 'leftedge-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, `--window-size=${WIDTH},900`, `http://localhost:${PORT}${list[0]}`], { stdio: 'ignore' });
const timeout = setTimeout(() => done(), 1000 * 60 * 10);
await finished; clearTimeout(timeout);
chrome.kill(); server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});

const bad = [];
for (const r of results) {
  const keys = Object.keys(r.edges).map(Number).sort((a, b) => a - b);
  const groups = [];
  for (const k of keys) {
    const g = groups.find((x) => Math.abs(x.k - k) <= TOL);
    if (g) g.names.push(...r.edges[k]); else groups.push({ k, names: [...r.edges[k]] });
  }
  if (groups.length > 1) bad.push({ path: r.path, groups });
}
const headerEdges = [...new Set(results.map((r) => r.header).filter((x) => x !== null))];
const seen = new Set(results.map((r) => r.path));
const missed = list.filter((p) => !seen.has(p));

if (bad.length || headerEdges.length > 1 || missed.length > list.length * 0.1) {
  if (headerEdges.length > 1) {
    console.error(`✗ 共通ヘッダーの左端がページ間で動いている: ${headerEdges.join(', ')}px`);
  }
  if (bad.length) {
    console.error(`✗ ${WIDTH}px で左端が割れているページ ${bad.length}件（測定 ${results.length}/${list.length}）:`);
    for (const b of bad.slice(0, 12)) {
      console.error(`  - ${b.path}`);
      for (const g of b.groups) console.error(`      ${String(g.k).padStart(5)}px : ${[...new Set(g.names)].slice(0, 6).join(', ')}`);
    }
    if (bad.length > 12) console.error(`  … ほか ${bad.length - 12}件`);
    console.error('\n  main 直下の要素は左端を1本に揃える（幅は 672px か 1120px、寄せは常に左）。');
    console.error('  docs/assets/style.css の `main > *` の margin と max-width を確かめること。');
  }
  if (missed.length > list.length * 0.1) {
    console.error(`✗ 測定できなかったページが ${missed.length}件（全${list.length}）。測定の仕組みを疑うこと。`);
  }
  process.exit(1);
}
console.log(`✓ 左端は1本に揃っている（${results.length}ページ・${WIDTH}px）`);
