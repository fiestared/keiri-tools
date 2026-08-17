/**
 * 375px（スマホ）で**ページ全体が横スクロールしない**ことを、全ページで確かめる。
 *
 *   node tests/test_no_hscroll.mjs
 *
 * ★なぜ要るか（2026-08-13 実測）:
 *   レビューで **17ページが横に溢れている**ことが分かった。原因は出典リストの
 *   長いURLと法令ID（例 `340AC0000000034_20260723_508AC0000000064`）で、
 *   折り返せずにページ全体を横に伸ばしていた。実測値:
 *     /column/hojokin-shiwake/ … 478px ／ /column/kogaku-ryoyohi/ … 680px
 *   スマホで本文を読むと**横に動いてしまい、読み進められない**。
 *   ★型・リンク・文字数の検査は全部緑のまま、この破綻を通していた。
 *
 * ★判定は「documentElement.scrollWidth」ではなく **実際に横に動くか** で見る。
 *   `overflow-x:auto` の内側にある要素は scrollWidth や getBoundingClientRect では
 *   画面外に見えるが、それは**意図した図の横スクロール**であってページの破綻ではない
 *   （`.figure.fig-wide` は「縮めると図中の文字が5〜7pxになるので原寸で横スクロールさせる」
 *    という既存の設計）。取り違えると、正しい実装を「壊れている」と誤判定する。
 *   → `window.scrollTo(9999,0)` 後の `window.scrollX` が 0 かで見る。
 *
 * ★ブラウザは tools/e2e と同じ **headless Chrome を直接** 使う（playwright を足さない）。
 *   ページ側に測定スクリプトを注入し、自分で次のURLへ遷移させて1周させる。
 *   ★file:// では開かない。モジュールJSが読めず「全ページ壊れている」ように見える
 *   （2026-08-13 に実際に踏んだ）。必ず HTTP 越しに開く。
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
const PORT = 8931;
const WIDTH = 375;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };

if (!existsSync(CHROME)) {
  console.log('↷ Chrome が見つからないので測定を飛ばします（' + CHROME + '）');
  process.exit(0);
}

async function collect() {
  const out = ['/'];
  for (const d of await readdir(DOCS, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === 'assets' || d.name === 'embed') continue; // 埋め込みは他サイトの幅に従う
    if (existsSync(join(DOCS, d.name, 'index.html'))) out.push(`/${d.name}/`);
  }
  for (const d of await readdir(join(DOCS, 'column'), { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(join(DOCS, 'column', d.name, 'index.html'))) out.push(`/column/${d.name}/`);
  }
  return out;
}

const list = await collect();
const results = [];
let idx = 0;
let done;
const finished = new Promise((r) => { done = r; });

// ★測定→報告→次へ、をページ側で回す。Chrome は1つだけ起動する
const INJECT = (next) => `<script>
(function(){
  window.scrollTo(9999,0); var x = window.scrollX; window.scrollTo(0,0);
  var body = JSON.stringify({ path: location.pathname, x: x, sw: document.documentElement.scrollWidth });
  fetch('/__m', { method:'POST', body: body }).then(function(){
    ${next ? `location.href = ${JSON.stringify(next)};` : `fetch('/__done',{method:'POST'});`}
  });
})();
</script>`;

/**
 * 外部の計測ビーコンを配信時に潰す。
 *
 * ★なぜ要るか（2026-08-17 実測）:
 *   この検査は**全305ページをブラウザで開く**。HTMLをそのまま配信していたので
 *   **ページのGA4タグが発火し、GA4に hostName=localhost として入っていた**。
 *   2026-08-14 は実測 keiri-tools.com 71PV に対し **localhost 450PV**。
 *   セッションは1件しか増えないが**PVが6倍に膨らみ**、PV基準の見積もり（AdSenseの
 *   期待収益など）が壊れる。「検査が本番の計器を汚す」型。
 *
 * ★本番のHTMLは触らない。**配信するときだけ**書き換える。
 * ★gtag.js が読めなければ `gtag()` は dataLayer に積むだけで送信しない。
 *   だから src を潰すだけで足り、インラインの設定は消さなくてよい。
 */
const BEACON_HOSTS = [
  'www.googletagmanager.com',        // GA4
  'pagead2.googlesyndication.com',   // AdSense
];
// ★差し替え先は **data: URL**（中身が空のJS）。
//   最初 `//127.0.0.1:0/__blocked/` に差し替えたが、**ポート0は接続の扱いが特殊**で
//   e2e の jouto シーンが落ちた（変更なしでは通る、を実測して切り分けた）。
//   data: なら**ネットワークに一切出ず、即座に空で読み込まれる**ので副作用が無い。
const DEAD_SRC = "data:text/javascript,";
function stripBeacons(html) {
  return html.replace(
    /(<script[^>]*\ssrc=")(https?:)?\/\/(www\.googletagmanager\.com|pagead2\.googlesyndication\.com)\/[^"]*(")/gi,
    (_m, a, _p, _h, z) => a + DEAD_SRC + z,
  );
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
    const type = MIME[extname(p)] || 'application/octet-stream';
    if (isPage) {
      idx++;
      const html = stripBeacons(buf.toString('utf8')) + INJECT(list[idx] || null);
      res.writeHead(200, { 'Content-Type': type }); res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': type }); res.end(buf);
    }
  } catch { res.writeHead(404); res.end('nf'); }
});

// ★listen できない環境（サンドボックス等）では**測らずに降りる**。
//   2026-08-14: codex の検査環境で EPERM になり、テスト一式が赤になった。
//   測れないことと壊れていることは別物なので、赤にせず「測っていない」と申告する。
const listened = await new Promise((ok) => {
  server.once('error', (e) => ok({ err: e }));
  server.listen(PORT, '127.0.0.1', () => ok({ err: null }));
});
if (listened.err) {
  console.log(`↷ ローカルHTTPを立てられないので測定を飛ばします（${listened.err.code}）。`);
  console.log('   ★これは「横スクロールが無い」という意味ではない。測っていないだけ。');
  process.exit(0);
}
const profile = await mkdtemp(join(tmpdir(), 'hscroll-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, `--window-size=${WIDTH},800`,
  `http://localhost:${PORT}${list[0]}`,
], { stdio: 'ignore' });

const timeout = setTimeout(() => done(), 1000 * 60 * 8);
await finished;
clearTimeout(timeout);
chrome.kill();
server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});

const bad = results.filter((r) => r.x > 0);
const seen = new Set(results.map((r) => r.path));
const missed = list.filter((p) => !seen.has(p));

if (bad.length || missed.length > list.length * 0.1) {
  if (bad.length) {
    console.error(`✗ ${WIDTH}px で横スクロールするページ ${bad.length}件（測定 ${results.length}/${list.length}）:`);
    for (const b of bad) console.error(`  - ${b.path} … ${b.x}px 横に動く（scrollWidth=${b.sw}）`);
    console.error('\n  長いURL・法令IDが折り返せていないことが多い。');
    console.error('  docs/assets/style.css の `main { overflow-wrap: break-word }` の適用範囲を確かめること。');
  }
  // ★測れなかったページが多い＝測定自体が壊れている。緑で通さない
  if (missed.length > list.length * 0.1) {
    console.error(`✗ 測定できなかったページが ${missed.length}件（全${list.length}）。測定の仕組みを疑うこと。`);
    for (const m of missed.slice(0, 5)) console.error(`  - ${m}`);
  }
  process.exit(1);
}
console.log(`✓ 横スクロールなし（${results.length}ページ・${WIDTH}px）`);
