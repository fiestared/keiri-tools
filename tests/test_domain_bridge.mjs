#!/usr/bin/env node
import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const MAP = JSON.parse(readFileSync(join(ROOT, "tools/domain_bridge_map.json"), "utf8"));
let n = 0;
const ok = (v, m) => { n++; assert.ok(v, m); };

function target(pagePath, href) {
  const clean = href.split("#")[0];
  if (!clean) return join(DOCS, pagePath, "index.html");
  return normalize(join(DOCS, pagePath, clean, "index.html"));
}

for (const page of MAP.pages) {
  const fp = join(DOCS, page.path, "index.html");
  const html = readFileSync(fp, "utf8");
  ok((html.match(/<!--domain-bridge:S-->/g) || []).length === 1, `${page.path}: 開始マーカー`);
  ok((html.match(/<!--domain-bridge:E-->/g) || []).length === 1, `${page.path}: 終了マーカー`);
  const s = html.indexOf("<!--domain-bridge:S-->");
  const e = html.indexOf("<!--domain-bridge:E-->");
  const mainEnd = html.lastIndexOf("</main>");
  ok(s >= 0 && s < e && e < mainEnd, `${page.path}: 橋はmain内`);
  if (page.path.startsWith("column/")) ok(s > html.lastIndexOf("</article>"), `${page.path}: article外`);
  const x = html.indexOf("<!-- x-share:auto -->");
  if (x >= 0) ok(s < x, `${page.path}: X共有より前`);
  const block = html.slice(s, e);
  for (const m of block.matchAll(/<a[^>]+data-domain="(keiri|shisan|hojokin)"[^>]+href="([^"]+)"/g)) {
    ok(existsSync(target(page.path, m[2])), `${page.path}: リンク先 ${m[2]}`);
  }
  ok((block.match(/data-domain=/g) || []).length === 2, `${page.path}: 2領域カード`);
  ok(!/id="domain-bridge-title"[\s\S]*id="domain-bridge-title"/.test(html), `${page.path}: id重複なし`);
}

const top = readFileSync(join(DOCS, "index.html"), "utf8");
ok(/<nav class="domain-nav" data-bridge="top-strip" data-from="\(top\)"[^>]+aria-label=/.test(top), "トップの計測属性");
ok((top.match(/class="db-card"/g) || []).length >= 3, "トップ3領域");

const toushi = readFileSync(join(DOCS, "toushi/index.html"), "utf8");
ok(/class="domain-bridge" data-bridge="hub-out" data-from="shisan"/.test(toushi), "資産形成の逆橋");
ok(/data-domain="keiri"/.test(toushi), "資産形成のクリック配線");

const hojokin = readFileSync(join(DOCS, "hojokin/index.html"), "utf8");
ok(/class="faq domain-bridge"[^>]+data-bridge="hub-out" data-from="hojokin"/.test(hojokin), "補助金の逆橋");
ok(/data-domain="keiri" href="\.\.\/hojokin-zeimu\/"/.test(hojokin), "補助金のクリック配線");

for (const slug of ["furikomi-tesuryo-hikaku", "part-yukyu", "zengin-format-guide"]) {
  const bad = new RegExp(`rel-block[\\s\\S]*?column/${slug}/`);
  ok(!bad.test(hojokin), `/hojokin/ の関連解説を ${slug} で汚染しない`);
  const hz = readFileSync(join(DOCS, "hojokin-zeimu/index.html"), "utf8");
  ok(!bad.test(hz), `/hojokin-zeimu/ を ${slug} で汚染しない`);
}

const track = readFileSync(join(DOCS, "assets/track.js"), "utf8");
ok(track.includes('"domain_exposure:" + bridge'), "placement別の露出キー");
ok(track.includes("intersectionRatio >= 0.5") && track.includes("}, 1000)"), "50%を1秒");
console.log(`✓ test_domain_bridge: ${n}条件`);
