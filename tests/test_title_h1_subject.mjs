/**
 * `<title>` と `<h1>` が**同じ主題を名乗っている**ことを機械で強制する。
 *
 * なぜ必要か（2026-08-08 に実際に起きた事故）:
 *   `/column/zengin-format-guide/` は
 *     title: 「全銀フォーマットとは｜作り方と120バイトのレコードレイアウト…」
 *     h1  : 「振込名義の書き方ガイド｜全銀フォーマットの使用可能文字と法人略語」
 *   と**別の主題を名乗っていた**。08-02 の改稿(047cde5)が「タイトルを構造先行へ」と称して
 *   **title だけ直し、h1 をページ作成時のまま置いていった**（`+<h1` の出現は履歴上1回のみ）。
 *   結果、h1 は実測5表示しかない「振込名義」（しかも既に1〜4位で勝っている）を向き、
 *   **144表示ある「全銀フォーマット」の側を向いていなかった**。そのクエリは順位を失った。
 *
 * ★この壊れ方の質が悪いのは**静かなこと**: 見た目は正常、テストも全緑、
 *   本文の論点も足りている（実SERPで数えた結果、記事側の論点は上位と同等だった）。
 *   気づくには実SERPを読んで title と h1 を突き合わせるしかなく、発見まで数ヶ月かかった。
 *   → 人ではなく機械が落とす。
 *
 * 検査のしかた:
 *   `｜` `|` `【` `[` より前を「主題」とみなし（このサイトの見出しは全部この形）、
 *   title の主題と h1 の主題の**文字バイグラム重なり**を測る。
 *   語をトークンに割る方式は使えない（「振込名義カナ変換ツール」が1トークンになり、
 *   同じ主題なのに重なり0と誤判定する。実際そうなって偽陽性を4件出した）。
 *
 * 閾値: 0.25。実測の分布は
 *   事故当時の zengin = 0.00 ／ 正常ページの最小 = 0.56（/embed/）
 *   で**間に大きな空きがある**ので、両側に余裕を取ってこの値。
 *
 *   node tests/test_title_h1_subject.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const THRESHOLD = 0.25;

// 免除。**黙って外すと「全ページが揃っている」と誤読される**ので、必ず理由つきで名指しする。
const EXEMPT = {
  "/": "トップだけは title=ブランド名『経理ミニツールズ』・h1=タグライン『税金・給与・社会保険の計算を、さっと片づける。』という別の型。" +
       "ブランド名とタグラインが別の語なのは意図であって、主題の食い違いではない。",
};

/** 主題（区切り記号より前）を取り出す */
const subject = (s) => s.split(/[｜|【[]/)[0].trim();

/** 助詞・記号を落として文字バイグラム集合にする（語の切れ目に依存しない比較） */
const bigrams = (s) => {
  const t = s.replace(/[\s、。・（）()]/g, "").replace(/[のをにはがと]/g, "");
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};

const overlap = (a, b) => {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return null;
  let n = 0;
  for (const g of A) if (B.has(g)) n++;
  return n / Math.min(A.size, B.size);
};

const strip = (m) => (m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "");

/** docs 配下の index.html を全部集める */
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name === "index.html") pages.push(p);
  }
})(DOCS);

const fails = [];
let checked = 0, skippedNoindex = 0;

for (const file of pages) {
  const html = readFileSync(file, "utf8");
  const rel = "/" + relative(DOCS, file).replace(/index\.html$/, "");
  const url = rel === "/" ? "/" : rel;

  // noindex は検索結果に出ない＝主題の一致を要求する理由が無い
  if (/<meta[^>]*name=["'](?:robots|googlebot)["'][^>]*noindex/i.test(html)) { skippedNoindex++; continue; }
  if (EXEMPT[url]) continue;

  const title = strip(html.match(/<title>(.*?)<\/title>/s));
  const h1 = strip(html.match(/<h1[^>]*>(.*?)<\/h1>/s));
  if (!title) { fails.push(`${url}: <title> が空`); continue; }
  if (!h1) { fails.push(`${url}: <h1> が無い`); continue; }

  checked++;
  const ov = overlap(subject(title), subject(h1));
  if (ov === null) { fails.push(`${url}: 主題が短すぎて比較できない`); continue; }
  if (ov < THRESHOLD) {
    fails.push(
      `${url}: title と h1 が別の主題を名乗っている（重なり ${ov.toFixed(2)} < ${THRESHOLD}）\n` +
      `      title: ${subject(title)}\n` +
      `      h1   : ${subject(h1)}`
    );
  }
}

// 読み取り本数のassert（CLAUDE.md 規則2の系）。
// walk が壊れて0件になると「違反0件」と区別がつかず、検査が黙って死ぬ。
if (checked < 50) {
  console.error(`✗ 検査対象が ${checked}ページしかない（検査が壊れている。docs の走査を確認）`);
  process.exit(1);
}

for (const [url, why] of Object.entries(EXEMPT)) console.log(`  ⚠️  免除: ${url} — ${why}`);

if (fails.length) {
  console.error(`✗ title と h1 の主題が食い違うページ ${fails.length}件（対象 ${checked}ページ）`);
  for (const f of fails) console.error("  - " + f);
  console.error("\n  直し方: 客がいる方の主題に h1 を合わせる。");
  console.error("  ★ただし既に上位を取れている語を h1 から落とさないこと（裾のクリックを失う）。");
  process.exit(1);
}
console.log(`✓ title と h1 は同じ主題を名乗っている（${checked}ページ／noindex ${skippedNoindex}ページは対象外）`);
