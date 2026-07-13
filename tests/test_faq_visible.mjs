/**
 * FAQ構造化データ(JSON-LD)が、本文に見えている内容と一致することを強制する。
 *
 * Googleの要件(FAQPage):
 *   "The full question text and the full answer text must be visible to the user."
 *   → **設問だけでなく、答えの全文もページ上に見えていること**。
 *
 * なぜ機械で見るか(2026-07-13の実話):
 *   第1便で「JSON-LDのFAQ設問 ⊆ 本文のh3 を以後確認する」と散文で書いたが、
 *   機械チェックを作らなかったので守られず、第8便に11ページ31件の違反が見つかった。
 *   しかもそのとき見ていたのは設問だけで、**答えの全文はどのページにも存在しなかった**
 *   (JSON-LDが、ページのどこにも無い文章を構造化データとして申告していた)。
 *   可視コンテンツの無いFAQマークアップはリッチリザルト対象外で、手動対策の対象になりうる。
 *
 * 直し方(第9便):
 *   本文を正本にして JSON-LD は `node tools/gen_faq_jsonld.mjs` で生成する。
 *   人が触るのは本文だけ。このテストは、生成物と本文が一致していることを独立に検算する。
 *
 * **このテストは意図的に tools/gen_faq_jsonld.mjs を import しない。**
 *   同じ抽出関数で照合すると、抽出側がバグったとき両方が同じように間違って合格する
 *   (第3便・第6便の教訓: 検算のオラクルは被検体と別実装にする)。
 *   ここでは「h3の文言」「ページの可視テキスト」を独自に取り直して突き合わせる。
 */
import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

/** タグを剥がし、空白を完全に潰して比較する(改行・インデントの違いを無視するため) */
const squash = (s) =>
  s.replace(/<[^>]+>/g, "")
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
   .replace(/\s+/g, "").trim();

/**
 * 日本語の文中に紛れ込んだ英単語を落とす。
 * 実際に2件出た: JSON-LDの「6か月continuous勤務し」、および本便の修正中に私が入れた
 * 「週30時間以上working働いていれば」。どちらも生成AIが日本語に英語を混ぜた痕跡で、
 * 検索結果にそのまま出る。
 *
 * 「小文字の英単語が日本語に直接くっついている」ものだけを見る。
 * **大文字で始まる語の途中を拾わないこと**(前後の英字を除外しないと
 *  「Excelファイル」が "xcel"+"フ" で誤検知する。実際にした)。
 * 3文字以下(.ics 等)と固有名詞(Excel/Google/Numbers)は通る。
 */
const STRAY_LATIN =
  /[ぁ-んァ-ヶ一-龯][a-z]{4,}(?![A-Za-z])|(?<![A-Za-z])[a-z]{4,}[ぁ-んァ-ヶ一-龯]/;

let pages = 0, questions = 0;
const problems = [];

for (const file of htmlFiles(DOCS)) {
  const html = readFileSync(file, "utf8");
  const rel = file.slice(DOCS.length);

  const faq = [];
  for (const [, body] of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  )) {
    let data;
    try { data = JSON.parse(body); } catch (e) {
      problems.push(`${rel}: JSON-LDがパースできない (${e.message})`);
      continue;
    }
    for (const node of data["@graph"] || [data]) {
      if (node["@type"] !== "FAQPage") continue;
      for (const q of node.mainEntity || []) faq.push(q);
    }
  }
  if (faq.length === 0) continue;
  pages++;

  // 独自に取り直す: 本文のh3の文言と、ページ全体の可視テキスト(script/styleを除く)
  const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => squash(m[1]));
  const visible = squash(
    html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")
  );

  for (const q of faq) {
    questions++;
    const name = q.name ?? "";
    const answer = q.acceptedAnswer?.text ?? "";

    if (!answer) {
      problems.push(`${rel}: 「${name}」に acceptedAnswer.text がありません`);
      continue;
    }
    // ① 設問が本文の見出し(h3)として見えているか
    if (!h3s.includes(squash(name))) {
      problems.push(
        `${rel}: FAQの設問が本文の<h3>にありません\n      設問: 「${name}」\n` +
        `      本文のh3: ${h3s.map((h) => `「${h}」`).join(" ") || "(なし)"}`
      );
    }
    // ② 答えの「全文」が本文に見えているか ← 第8便までノーチェックだった箇所
    if (!visible.includes(squash(answer))) {
      problems.push(
        `${rel}: FAQの答えの全文が本文に見えていません(構造化データにしか無い)\n` +
        `      設問: 「${name}」\n      答え: 「${answer.slice(0, 60)}…」`
      );
    }
    // ③ 日本語に英単語が紛れていないか
    for (const [label, text] of [["設問", name], ["答え", answer]]) {
      const hit = text.match(STRAY_LATIN);
      if (hit) problems.push(`${rel}: ${label}に英単語が紛れています: 「…${hit[0]}…」\n      設問: 「${name}」`);
    }
  }
}

if (problems.length) {
  console.error("FAQ構造化データと本文が一致していません:\n\n  " + problems.join("\n\n  ") + "\n");
  console.error("対処: 本文の「よくある質問」ブロック(h3+p)を直し、");
  console.error("      node tools/gen_faq_jsonld.mjs でJSON-LDを生成し直してください。\n");
  process.exit(1);
}

assert.ok(pages > 0, "FAQを持つページが1つも見つからない(このテスト自体が壊れている可能性)");
console.log(`test_faq_visible: ${pages}ページ / 設問${questions}件 — 設問・答えとも本文に可視 ✔`);
