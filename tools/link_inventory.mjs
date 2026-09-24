import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://keiri-tools.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["assets", "embed"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name === "index.html") out.push(path);
  }
  return out;
}

export function pageUrl(file, docs) {
  const rel = relative(docs, dirname(file)).split("\\").join("/");
  return rel ? `/${rel}/` : "/";
}

export function normalizeInternalHref(href, sourceUrl) {
  let url;
  try { url = new URL(href, `${SITE}${sourceUrl}`); } catch { return null; }
  if (url.origin !== SITE) return null;
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { path = url.pathname; }
  path = path.replace(/\/index\.html$/, "/").replace(/\/{2,}/g, "/");
  if (!path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path)) path += "/";
  return path;
}

function markerAt(main, offset) {
  const before = main.slice(0, offset);
  const tokens = [...before.matchAll(/<!--\s*(\/?GEN:[A-Z0-9_-]+|(?:next-read|rel|domain-bridge):[SE])\s*-->/gi)];
  const stack = [];
  for (const token of tokens) {
    const value = token[1];
    const closing = value.startsWith("/GEN:") || /:E$/i.test(value);
    if (closing) stack.pop();
    else stack.push(value);
  }
  return stack.at(-1) ?? null;
}

export function classifyLink(sourceUrl, main, offset) {
  const marker = markerAt(main, offset);
  if (marker && /PINNED/i.test(marker)) return { type: "category_fixed_slot", marker };
  if (sourceUrl === "/column/" || (marker && /^GEN:/i.test(marker))) return { type: "list", marker };
  if (/^\/column\/[^/]+\/$/.test(sourceUrl) && !marker) return { type: "body", marker: null };
  return { type: "other", marker };
}

export function buildInventory(docs) {
  const files = walk(docs).sort();
  const publicPages = new Map();
  const excluded = [];
  for (const file of files) {
    const url = pageUrl(file, docs);
    const html = readFileSync(file, "utf8");
    const reason = existsSync(join(dirname(file), ".nopublish")) ? "nopublish"
      : /<meta[^>]+(?:name=["']robots["'][^>]+content=["'][^"']*noindex|content=["'][^"']*noindex[^>]+name=["']robots["'])/i.test(html) ? "noindex"
      : null;
    if (reason) excluded.push({ url, reason });
    else publicPages.set(url, { file, html });
  }

  const inbound = new Map([...publicPages].map(([url]) => [url, []]));
  const links = [];
  for (const [source, page] of publicPages) {
    const match = page.html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (!match) continue;
    const main = match[1];
    for (const anchor of main.matchAll(/<a\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>/gi)) {
      const target = normalizeInternalHref(anchor[3], source);
      if (!target || target === source || !publicPages.has(target)) continue;
      const position = classifyLink(source, main, anchor.index);
      const attrs = `${anchor[1]} ${anchor[4]}`;
      const row = {
        source,
        target,
        href: anchor[3],
        line: main.slice(0, anchor.index).split("\n").length,
        offset: anchor.index,
        element: "a",
        class: attrs.match(/\bclass\s*=\s*["']([^"']*)/i)?.[1] ?? null,
        type: position.type,
        marker: position.marker,
      };
      links.push(row);
      inbound.get(target).push(row);
    }
  }

  const pages = [...publicPages].map(([url]) => {
    const rows = inbound.get(url);
    const counts = Object.fromEntries(["body", "list", "category_fixed_slot", "other"].map(
      (type) => [type, rows.filter((row) => row.type === type).length]
    ));
    let reachability = "orphan";
    if (counts.body) reachability = "body_linked";
    else if (counts.category_fixed_slot) reachability = "category_fixed_slot_only";
    else if (counts.list) reachability = "list_only";
    else if (counts.other) reachability = "other_only";
    const distinctionReason = reachability === "body_linked" ? "At least one contextual article-body link exists."
      : reachability === "list_only" ? "The legacy orphan test passes, but no contextual article-body link exists; at least one inbound link is from a listing."
      : reachability === "category_fixed_slot_only" ? "The legacy orphan test passes, but no contextual article-body or listing link exists; at least one inbound link is from a pinned category slot."
      : reachability === "other_only" ? "The legacy orphan test passes, but every inbound link is from another generated/main region."
      : "No qualifying link inside main; the legacy orphan test also treats this page as orphaned.";
    return {
      url,
      inbound_count: rows.length,
      legacy_orphan_status: rows.length ? "linked" : "orphan",
      counts,
      reachability,
      distinction_reason: distinctionReason,
    };
  }).sort((a, b) => a.url.localeCompare(b.url));

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    definitions: {
      source_scope: "All indexable index.html pages under docs; header/footer are excluded by scanning main only.",
      body: "A link in an article main body outside generated markers.",
      list: "A link from /column/ or inside a GEN block other than PINNED.",
      category_fixed_slot: "A link inside a GEN:*PINNED fixed category slot.",
      other: "Any other link inside main, including generated related-link blocks.",
    },
    summary: {
      public_pages: pages.length,
      links: links.length,
      excluded_pages: excluded.length,
      by_reachability: Object.fromEntries(["body_linked", "list_only", "category_fixed_slot_only", "other_only", "orphan"].map(
        (kind) => [kind, pages.filter((page) => page.reachability === kind).length]
      )),
    },
    excluded_pages: excluded.sort((a, b) => a.url.localeCompare(b.url)),
    pages,
    links: links.sort((a, b) => a.target.localeCompare(b.target) || a.source.localeCompare(b.source) || a.offset - b.offset),
  };
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const docs = resolve(arg("--docs", join(ROOT, "docs")));
  const output = arg("--output", null);
  const result = buildInventory(docs);
  const json = JSON.stringify(result, null, 2) + "\n";
  if (output) writeFileSync(resolve(output), json);
  else process.stdout.write(json);
}
