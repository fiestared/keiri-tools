#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const MAP = JSON.parse(readFileSync(join(ROOT, "tools/domain_bridge_map.json"), "utf8"));
const CHECK = process.argv.includes("--check");
const DRY = process.argv.includes("--dry");
const S = "<!--domain-bridge:S-->";
const E = "<!--domain-bridge:E-->";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

function rel(path, target) {
  const depth = path.split("/").length;
  return "../".repeat(depth) + target.replace(/^\/+/, "") + "/";
}

function cards(page) {
  const income = page.variant === "income";
  return [
    {
      domain: "shisan", href: rel(page.path, "toushi"), tag: "個人のお金・資産形成",
      title: income ? "毎月いくら積み立てられるか、手取りから逆算" : "NISAの残り枠・iDeCo一時金の出口の税金",
      desc: income ? "積立額と信託報酬の差、売却時の税金まで。銘柄のおすすめはありません。" : "銘柄のおすすめはありません。制度と税金だけを、ブラウザ内で計算します。"
    },
    {
      domain: "hojokin", href: rel(page.path, "hojokin"), tag: "補助金・事業支援",
      title: "いま公募中の補助金を、締切が近い順で検索",
      desc: "都道府県・従業員数・上限額で絞り込み。登録不要・営業の連絡はしません。"
    }
  ];
}

function block(page) {
  const body = cards(page).map((c) => `    <a class="db-card" data-domain="${c.domain}" href="${c.href}">\n` +
    `      <span class="db-tag">${esc(c.tag)}</span>\n      <b>${esc(c.title)}</b>\n` +
    `      <span class="db-desc">${esc(c.desc)}</span>\n    </a>`).join("\n");
  return `${S}\n<section class="domain-bridge" data-bridge="article-end" data-from="${page.from_domain}" aria-labelledby="domain-bridge-title">\n` +
    `  <h2 id="domain-bridge-title">制度と税金の、別の計算</h2>\n  <div class="db-grid">\n${body}\n  </div>\n</section>\n${E}\n`;
}

function insert(html, page, b) {
  const re = /<!--domain-bridge:S-->[\s\S]*?<!--domain-bridge:E-->\n?/;
  if (re.test(html)) return html.replace(re, b);
  const mainStart = html.indexOf("<main");
  const mainEnd = html.lastIndexOf("</main>");
  if (mainStart < 0 || mainEnd < 0) throw new Error(`${page.path}: main が無い`);
  let at = html.indexOf('<section class="faq rel-block">', mainStart);
  if (at < 0 || at > mainEnd) at = html.indexOf("<!-- x-share:auto -->", mainStart);
  if (at < 0 || at > mainEnd) at = mainEnd;
  if (page.path.startsWith("column/")) {
    const articleEnd = html.lastIndexOf("</article>", mainEnd);
    if (articleEnd < 0 || at < articleEnd) throw new Error(`${page.path}: 橋を article の外へ置けない`);
  }
  return html.slice(0, at) + b + html.slice(at);
}

let changed = 0;
for (const page of MAP.pages) {
  const fp = join(DOCS, page.path, "index.html");
  if (!existsSync(fp)) throw new Error(`${page.path}: index.html が無い`);
  const html = readFileSync(fp, "utf8");
  const next = insert(html, page, block(page));
  if (next === html) continue;
  changed++;
  if (!CHECK && !DRY) writeFileSync(fp, next);
}
if (CHECK && changed) { console.error(`✗ 領域橋が最新でない: ${changed}ページ`); process.exit(1); }
if (DRY) console.log(`[--dry] ${changed}ページが対象`);
else console.log(changed ? `✓ 領域橋を更新: ${changed}ページ` : "✓ 領域橋は最新");
