import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInventory, normalizeInternalHref } from "../tools/link_inventory.mjs";
import { cleanupOnExit } from "../tools/tmp_cleanup.mjs";

assert.equal(normalizeInternalHref("../target/#part", "/column/source/"), "/column/target/");
assert.equal(normalizeInternalHref("https://keiri-tools.com/column/target/index.html", "/"), "/column/target/");
assert.equal(normalizeInternalHref("https://example.com/column/target/", "/"), null);

const docs = cleanupOnExit(mkdtempSync(join(tmpdir(), "link-inventory-")));
function page(path, body, extraHead = "") {
  const dir = join(docs, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), `<html><head>${extraHead}</head><body><header><a href=\"/column/target/\">header</a></header><main>${body}</main><footer><a href=\"/column/target/\">footer</a></footer></body></html>`);
}
page("column", `<a href="target/">list</a>`);
page("toushi", `<!-- GEN:TOUSHI-PINNED --><a href="../column/target/#x">fixed</a><!-- /GEN:TOUSHI-PINNED -->`);
page("column/source", `<p><a class="context" href="https://keiri-tools.com/column/target/">body</a></p><a href="./">self</a>`);
page("column/target", `<p>target</p>`);
page("column/noindex", `<a href="../target/">excluded</a>`, `<meta name="robots" content="noindex">`);
page("column/draft", `<a href="../target/">excluded</a>`);
writeFileSync(join(docs, "column/draft/.nopublish"), "");

const result = buildInventory(docs);
const target = result.pages.find((row) => row.url === "/column/target/");
assert.deepEqual(target.counts, { body: 1, list: 1, category_fixed_slot: 1, other: 0 });
assert.equal(target.reachability, "body_linked");
assert.equal(target.legacy_orphan_status, "linked");
assert.match(target.distinction_reason, /contextual article-body/);
assert.equal(result.links.length, 3, "header/footer/noindex/nopublish/self must be excluded");
assert.ok(result.links.every((row) => row.line >= 1 && Number.isInteger(row.offset)));
assert.deepEqual(result.excluded_pages.map((row) => row.reason).sort(), ["noindex", "nopublish"]);

console.log("✓ link inventory normalizes URLs and separates body/list/fixed links");
