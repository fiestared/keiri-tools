/**
 * IndexNow で更新URLを Bing（および対応検索エンジン）へ即時通知する。
 *
 * なぜ: 新規ドメインは Google の索引が遅い。一方 Bing は IndexNow に対応し、ping した
 * URL を数時間〜で取りに来る。Bing の索引は ChatGPT検索/Copilot/DuckDuckGo にも供給されるので、
 * 「書いたら即 Bing に載る」導線になる。記事・ツールを push したらこれを流す。
 *
 *   node tools/indexnow.mjs <url|path> [...]   指定URL(またはdocs配下パス)を通知
 *   node tools/indexnow.mjs --auto             直近コミットで変わった docs/*.html を自動通知
 *   node tools/indexnow.mjs --auto --dry       送らず対象だけ表示（確認用）
 *
 * 鍵ファイル: docs/<KEY>.txt（サイトルートに公開・中身は鍵そのもの）。IndexNow がこの
 * keyLocation を読んで所有確認する。鍵を変えたら下の KEY と docs/<KEY>.txt の両方を直す。
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KEY = "98fe27aa897ce1e371f24ac71c7336eb";
const HOST = "keiri-tools.com";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/IndexNow";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const DRY = process.argv.includes("--dry");
const AUTO = process.argv.includes("--auto");

// docs 配下の index.html パス → 公開URL（/foo/index.html → https://host/foo/、docs/index.html → ルート）
function pathToUrl(p) {
  let rel = p.replace(/^.*docs\//, "").replace(/index\.html$/, "");
  if (!/^https?:\/\//.test(rel)) return `https://${HOST}/${rel}`;
  return rel;
}

let inputs = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (AUTO) {
  // 直近コミットで変わった docs 配下の index.html を拾う
  const out = execFileSync("git", ["show", "--name-only", "--pretty=format:", "HEAD"],
    { cwd: ROOT, encoding: "utf8" });
  inputs = out.split("\n").filter((l) => /^docs\/.*index\.html$/.test(l));
}

const urls = [...new Set(inputs.map((a) => {
  if (/^https?:\/\//.test(a)) return a;           // 完全URL
  if (a.includes("index.html") || a.startsWith("docs/") || existsSync(join(ROOT, a)))
    return pathToUrl(a);                           // リポ内パス
  return `https://${HOST}/${a.replace(/^\/+/, "")}`; // "foo/" のような相対
}))];

if (!urls.length) {
  console.error("通知するURLがありません。URL/パスを渡すか --auto を使ってください。");
  process.exit(1);
}

console.log(`IndexNow 通知先 ${urls.length}件:`);
for (const u of urls) console.log("  " + u);

if (DRY) { console.log("\n[--dry] 送信していません。"); process.exit(0); }

const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls };
const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
// IndexNow は 200/202 が受理。403=鍵不一致、422=URLとhost不一致 など。
console.log(`\nIndexNow 応答: HTTP ${res.status} ${res.statusText}`);
if (res.status === 200 || res.status === 202) {
  console.log("✓ 受理されました（反映はBing側の都合で数時間〜）。");
} else {
  const t = await res.text().catch(() => "");
  console.error(`✗ 受理されず: ${t.slice(0, 300)}`);
  process.exitCode = 1;
}
