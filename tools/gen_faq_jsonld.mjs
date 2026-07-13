/**
 * FAQ構造化データ(JSON-LD)を、本文の「よくある質問」ブロックから生成する。
 *
 * なぜ生成にするか:
 * 2026-07-13(第8便)に、JSON-LDのFAQ設問が本文とは別の文言で書かれている違反を
 * サイト全体で31件検出した。設問だけでなく**答えの全文も本文に存在しなかった**
 * (JSON-LDが、ページのどこにも無い文章を構造化データとして申告していた)。
 * Googleの要件は「設問と回答の全文が利用者に見えていること」なので、これは
 * リッチリザルト対象外・手動対策の対象になりうる。
 *
 * 手で2箇所を同期し続けるのは破綻する(実際に破綻した)ので、
 * **本文を正本にして JSON-LD を生成する**。人が触るのは本文だけ。
 *   生成: node tools/gen_faq_jsonld.mjs        (--check で差分があれば失敗)
 *   検査: node tests/test_faq_visible.mjs      (本文とJSON-LDの一致を強制)
 *
 * 本文側の約束:
 *   FAQブロックの開始 = 見出し文言が「よくある質問」の <h2>、または <h2 data-faq>。
 *   (data-faq は、見出しを「よくある質問」以外にしたいページ用。例: 消費税の端数処理のルール)
 *   そこに続く <h3>設問</h3><p>答え</p> の並びがFAQ。
 *   次の <h2> / <section> / </section> / </main> までを1ブロックとみなす。
 *   答えは h3 の直後の <p> 1つだけ(表やcalloutはFAQに入れない
 *   — Googleが acceptedAnswer に許可するタグに table は含まれない)。
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

/** タグを剥がして可視テキストにする */
export const visibleText = (s) =>
  s.replace(/<[^>]+>/g, "")
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
   .replace(/\s+/g, " ").trim();

/** 本文の「よくある質問」ブロックから Q&A を取り出す(本文が正本) */
export function extractFaq(html) {
  const h2 = html.match(/<h2[^>]*\sdata-faq[^>]*>[\s\S]*?<\/h2>|<h2[^>]*>\s*よくある質問\s*<\/h2>/);
  if (!h2) return null;
  const start = h2.index + h2[0].length;
  const rest = html.slice(start);
  // ブロックの終わり = 次の見出し/セクション境界
  const end = rest.search(/<h2[\s>]|<section[\s>]|<\/section>|<\/main>/);
  const block = end === -1 ? rest : rest.slice(0, end);

  const pairs = [];
  for (const m of block.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/g)) {
    pairs.push({ q: visibleText(m[1]), a: visibleText(m[2]) });
  }
  return pairs;
}

const faqNode = (pairs) => ({
  "@type": "FAQPage",
  mainEntity: pairs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

let changed = 0;
const problems = [];

for (const file of htmlFiles(DOCS)) {
  let html = readFileSync(file, "utf8");
  const rel = file.slice(DOCS.length);

  const blocks = [...html.matchAll(
    /(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g
  )];

  for (const [whole, open, body, close] of blocks) {
    let data;
    try { data = JSON.parse(body); } catch { continue; }
    // FAQPageは2つの形で現れる: @graph配列の一員か、トップレベル単体("@context"を持つ)。
    // **単体のときに配列要素を差し替えると data 本体は変わらない**ので、必ず対象を
    // その場で書き換える(こうすれば @context もキー順も保たれる)。
    const target = (data["@graph"] || [data]).find((n) => n["@type"] === "FAQPage");
    if (!target) continue;

    const pairs = extractFaq(html);
    if (!pairs || pairs.length === 0) {
      problems.push(
        `${rel}: FAQPageのJSON-LDがあるのに、本文に「よくある質問」ブロック(h3+p)がありません。\n` +
        `      → 本文にQ&Aを書くか、FAQPageのJSON-LDを消してください。`
      );
      continue;
    }

    // 生成: FAQPageの mainEntity だけを本文から作り直す(他のノード/キーは触らない)
    const built = faqNode(pairs).mainEntity;
    if (JSON.stringify(target.mainEntity) === JSON.stringify(built)) continue;
    target.mainEntity = built;

    const json = JSON.stringify(data, null, 2);
    html = html.replace(whole, `${open}\n${json}\n${close}`);
    writeFileSync(file, html);
    changed++;
    console.log(`  更新: ${rel} (設問${pairs.length}件)`);
  }
}

if (problems.length) {
  console.error("\nFAQ構造化データを生成できません:\n\n  " + problems.join("\n\n  ") + "\n");
  process.exit(1);
}

if (CHECK && changed) {
  console.error(
    `\n本文とJSON-LDがズレています(${changed}ページ)。\n` +
    `対処: node tools/gen_faq_jsonld.mjs を実行してコミットしてください。\n`
  );
  process.exit(1);
}

console.log(changed ? `gen_faq_jsonld: ${changed}ページ更新` : "gen_faq_jsonld: 差分なし");
