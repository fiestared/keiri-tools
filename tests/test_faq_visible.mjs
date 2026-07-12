/**
 * FAQ構造化データ(JSON-LD)の設問が、本文にも可視の見出し(h3)として存在することを強制する。
 *
 * なぜ機械で見るか:
 * 2026-07-13(第1便)に、JSON-LDにだけ書いて本文のh3化を忘れたFAQ設問が1件混入した。
 * 可視コンテンツの無いFAQマークアップは Google のガイドライン違反で、
 * リッチリザルト対象外・手動対策の対象になりうる。
 * 「公開前に目で確認する」と散文で書いても守られない(祝日バグで実証済み)ので、
 * ここで落とす。新しいページのFAQがh3化されていなければ、このテストが落ちる。
 *
 * Googleの要件: "The full question text and the full answer text must be visible to the user."
 * → 設問は h3 の文言と完全一致していること。
 */
import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;

/**
 * 既知の負債(2026-07-13に本テストを入れた時点で違反していたページ)。
 * これらは「よくある質問」の見出しとJSON-LDの設問が別々に書かれてしまっている。
 * ラチェット: ここに載っていないページの違反は即失敗 = 新しいページは二度と汚せない。
 * 直したらこのリストから消す(直ったのに載ったままでも失敗する = リストが腐らない)。
 */
const KNOWN_DEBT = new Set([
  "senpou-futan/index.html",
  "zengin-kana/index.html",
  "shiharai-site/index.html",
  "shakai-hoken/index.html",
  "gensen-choshu/index.html",
  "eigyobi/index.html",
  "yukyu/index.html",
  "denchoho-index/index.html",
  "column/senpou-futan-3hoshiki/index.html",
  "column/zengin-format-guide/index.html",
]);

/** docs/ 配下の *.html を再帰的に集める */
function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

/** タグを剥がして、比較用に空白を潰す */
const plain = (s) =>
  s.replace(/<[^>]+>/g, "")
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
   .replace(/\s+/g, "").trim();

let pagesWithFaq = 0;
let questionsChecked = 0;
const problems = [];

for (const file of htmlFiles(DOCS)) {
  const html = readFileSync(file, "utf8");
  const rel = file.slice(DOCS.length);

  // JSON-LD を全部取り出す
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  const questions = [];
  for (const [, body] of blocks) {
    let data;
    try { data = JSON.parse(body); } catch (e) {
      problems.push(`${rel}: JSON-LDがパースできない (${e.message})`);
      continue;
    }
    const nodes = data["@graph"] || [data];
    for (const node of nodes) {
      if (node["@type"] !== "FAQPage") continue;
      for (const q of node.mainEntity || []) questions.push(q.name);
    }
  }
  if (questions.length === 0) continue;
  pagesWithFaq++;

  // 本文の見出し(h2/h3)を集める。FAQ設問は h3 で置くのが本サイトの型
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) => plain(m[1]));
  // 本文全体(scriptを除く)の可視テキスト = 答えが本文にあるかの確認用
  const visible = plain(html.replace(/<script[\s\S]*?<\/script>/g, ""));

  for (const q of questions) {
    questionsChecked++;
    const want = plain(q);
    if (!headings.includes(want)) {
      problems.push(
        `${rel}: FAQ設問が本文の見出しに無い\n      設問: 「${q}」\n` +
        `      本文の見出し: ${headings.map((h) => `「${h}」`).join(" ") || "(なし)"}`
      );
    }
    // 設問が見出しにあっても、答えが本文に無ければ意味がない(最低限の存在確認)
    if (!visible.includes(want)) {
      problems.push(`${rel}: FAQ設問が本文の可視テキストに無い: 「${q}」`);
    }
  }
}

// ラチェット: 負債リストに無いページの違反だけを落とす
const dirty = new Set(problems.map((p) => p.split(":")[0]));
const fresh = problems.filter((p) => !KNOWN_DEBT.has(p.split(":")[0]));

if (fresh.length) {
  console.error("FAQ構造化データの設問が本文に見えていません:\n\n  " + fresh.join("\n\n  ") + "\n");
  console.error("対処: JSON-LDの設問と同じ文言の <h3> を本文に置き、その直後に答えを書く。");
  process.exit(1);
}

// 直したのに負債リストに残っている = リストが腐っている。これも落とす
const stale = [...KNOWN_DEBT].filter((p) => !dirty.has(p));
if (stale.length) {
  console.error(`負債リストが古いです。直っているのに KNOWN_DEBT に残っています:\n  ${stale.join("\n  ")}`);
  console.error("対処: tests/test_faq_visible.mjs の KNOWN_DEBT から消してください。");
  process.exit(1);
}

assert.ok(pagesWithFaq > 0, "FAQを持つページが1つも見つからない(このテスト自体が壊れている可能性)");
console.log(`test_faq_visible: ${pagesWithFaq}ページ / 設問${questionsChecked}件 チェック`);
if (dirty.size) {
  console.log(`  ⚠︎ 既知の負債 ${dirty.size}ページ (Googleのリッチリザルト対象外の恐れ。順次h3化して KNOWN_DEBT から消す)`);
}
