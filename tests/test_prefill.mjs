import assert from "node:assert";
import { readNumberParam, handoffUrl, MAX_ACCEPTED } from "../docs/assets/prefill.js";

// 受け取ってよいもの
assert.equal(readNumberParam("?kazei=3130000", "kazei"), 3130000);
assert.equal(readNumberParam("kazei=0", "kazei"), 0);
assert.equal(readNumberParam("?a=1&kazei=1,234,000", "kazei"), 1234000, "カンマ区切りは許容する");

// ★URLは誰でも書き換えられる。おかしい値は黙って無視する（入力欄に流し込まない）
for (const bad of ["?kazei=-1", "?kazei=abc", "?kazei=1e9", "?kazei=1.5", "?kazei=", "?kazei=<script>", "?other=1", ""]) {
  assert.equal(readNumberParam(bad, "kazei"), null, `拒否すべき: ${bad}`);
}
// 桁が異常なものも受け取らない
assert.equal(readNumberParam(`?kazei=${MAX_ACCEPTED + 1}`, "kazei"), null);
assert.equal(readNumberParam(`?kazei=${MAX_ACCEPTED}`, "kazei"), MAX_ACCEPTED);

// 渡す側
assert.equal(handoffUrl("/ideco-setsuzei/", 3130000), "/ideco-setsuzei/?kazei=3130000");
assert.equal(handoffUrl("/ideco-setsuzei/", 3130000.4), "/ideco-setsuzei/?kazei=3130000", "端数は丸める");
assert.equal(handoffUrl("/ideco-setsuzei/", -5), "/ideco-setsuzei/", "負なら付けない");
assert.equal(handoffUrl("/x/", 1000, "kaiyaku-kazei"), "/x/?kaiyaku-kazei=1000");

console.log("✓ ツール間の値の受け渡し OK");
