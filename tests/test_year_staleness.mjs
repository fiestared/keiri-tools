// test_year_staleness.mjs — 「令和N年度/年分」の手書きがデータと食い違う状態を落とす。
//
// なぜ要るか(2026-07-13 第12〜15便の宿題):
//   料率表・税額表は**毎年差し替える**。そのとき assets/*.json だけを新年度に替えると、
//   ページに手書きした「令和8年分の税額表を引いて計算します」が**残る**。
//   計算は新年度の表でやっているのに、**画面だけが古い年を名乗る** = 利用者に嘘をつく。
//   結果と出典の表示はデータ側(`year` / `_meta.year`)から描くようにしたが(第14便)、
//   **title・meta description・JSON-LD・本文の説明**は静的HTMLに書くしかない(SEOのため)。
//   → 自動で書き換えられない代わりに、**食い違ったら機械で落とす**。
//
// ★この検査の肝: 「制度の事実」と「使ったデータの申告」を区別すること
//   - **使ったデータの申告**(例:「令和8年分の税額表を引いて計算します」)
//     … データを差し替えたら**嘘になる**。データの年と一致していなければ落とす
//   - **制度の事実**(例:「子ども・子育て支援金は令和8年4月に新設された」)
//     … 何年経っても**真のまま**。年号を機械置換すると**歴史を書き換えて嘘にする**
//   区別せずに一括置換すると後者を壊すので、後者は HISTORICAL_FACTS に**理由つきで**免除する
//   (第12便の PRESENTATION_ONLY と同じ方式)。免除は**文言ごと**なので、文が書き換わったら
//   免除が外れて落ちる(=腐らない。fail closed)。

import { readFile, readdir } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DOCS = join(ROOT, "docs");

// 「制度の事実」= 年が変わっても真であり続ける記述。機械置換の対象にしてはいけない。
// snippet はページに**そのまま含まれる**文字列。文言を変えたら免除が外れて落ちる。
const HISTORICAL_FACTS = [
  { file: "shakai-hoken/index.html", snippet: "子ども・子育て支援金（令和8年4月から新設）",
    reason: "新設された時期そのものが事実。令和9年度になっても『令和8年4月に新設』は真" },
  { file: "shakai-hoken/index.html", snippet: "令和8年（2026年）4月分から、",
    reason: "徴収開始時期の事実。将来の年度の料率表に差し替えても変わらない" },
  { file: "shakai-hoken/index.html", snippet: "子ども・子育て支援金は令和8年4月分から",
    reason: "同上(結果欄の注記。JSのテンプレートリテラルから描かれている)" },
  { file: "about/index.html", snippet: "令和8年（2026年）4月分から新設された",
    reason: "同上(新設時期の事実)。about は料率データを読まないが、事実なので書いてよい" },
  { file: "juminzei/index.html", snippet: "令和5年度で終了",
    reason: "★復興財源による均等割の上乗せ(市500円+県500円)が終わった年度そのもの＝制度の事実。" +
            "根拠法(平成23年法律第118号2条)が『平成26年度から平成35年度まで』と年度で区切っており、" +
            "令和9年度の料率JSONに差し替えても『令和5年度で終了した』は真であり続ける。" +
            "むしろ機械置換すると歴史を書き換えて嘘になる(『復興税1,000円が今もかかる』は誤り)" },
  { file: "juminzei/index.html", snippet: "令和5年度分で終わりました",
    reason: "同上(FAQ・JSON-LDでの言い換え)。終了年度は事実であってデータの申告ではない" },
  { file: "juminzei/index.html", snippet: "令和6年度分からは",
    reason: "★森林環境税(国税1,000円)の徴収が始まった年度そのもの＝制度の事実" +
            "(森林環境税法附則2条が『令和6年度以後の年度分から』と定める)。" +
            "このページが『どの年のデータで計算したか』は _meta.year から描いており、手書きしていない" },
  { file: "shobyo/index.html", snippet: "事務連絡（令和3年11月10日・支給期間の通算）",
    reason: "★厚生労働省保険局保険課が事務連絡を発出した日そのもの＝出典の識別情報（制度の事実）。" +
            "『支給期間は暦に従って1年6月間で計算する』と示した文書の日付であり、" +
            "参照データを差し替えても『令和3年11月10日に出された』は真であり続ける。" +
            "このページが『どの年度のデータで計算したか』は _meta.fiscal_year から描いており、手書きしていない" },
  { file: "furusato/index.html", snippet: "令和20年度",
    reason: "★特例控除額の割合の読替え(地方税法附則5条の6)が適用される期間そのもの＝制度の事実。" +
            "『平成26年度から令和20年度まで84.895%等に読み替える』は、令和9年分の料率JSONに" +
            "差し替えても真であり続ける(むしろ令和21年度に本則へ戻ることを読者に伝える記述)。" +
            "このページが『どの年のデータで計算したか』は _meta.year から描いており、手書きしていない" },
];

// column/ は対象外。記事は制度の沿革・改正履歴を語るので「その年でなければならない」記述が
// 大半で、ツールページと同じ規律は当てはまらない(誤検知だらけになる)。
// 記事の数字の鮮度は別問題として扱う。
const SKIP_DIRS = ["column", "assets", "ext", "e2e"];

const ERA = /令和\s*(\d+)\s*年(度|分)?/g;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.includes(e.name)) continue;
      out.push(...await walk(p));
    } else if (e.name === "index.html") out.push(p);
  }
  return out;
}

// データファイルが自分で名乗っている年(正本)
async function dataYears() {
  const map = new Map();
  const adir = join(DOCS, "assets");
  for (const f of await readdir(adir)) {
    if (!f.endsWith(".json")) continue;
    let d;
    try { d = JSON.parse(await readFile(join(adir, f), "utf8")); } catch { continue; }
    const y = d?.year ?? d?._meta?.year;
    if (typeof y === "string" && /令和/.test(y)) map.set(f, y);
  }
  return map;
}

// JS の**コメント**に書いた年号で落ちても意味がない(「令和8年度と手書きするな」という
// 注意書き自体が落ちる)。ので**コメント行だけ**を外す。
//
// ⚠️ <script> ブロックごと外してはいけない: 結果欄の注記はテンプレートリテラルで
// **JS から描かれている**(「※ 子ども・子育て支援金は令和8年4月分から」)。
// ブロックごと外すと、**利用者に見えている文字列が検査から丸ごと漏れる**。
// 消すのは行頭が // か * の行だけ(URL 中の // を巻き込まないため行頭に限定する)。
function stripComments(html) {
  return html.replace(/^[ \t]*(?:\/\/|\*|\/\*).*$/gm, "");
}

// トップとコラム一覧に並ぶ**記事カード**(.p-title / .p-desc)は `gen_index_sitemap.mjs` が
// 記事から生成したもので、中身は**記事自身のタイトル・説明**。
// これを料率データの年と突き合わせると、「令和8年度の社会保険料」という**正しい題の記事**を
// データ差し替えのたびに落とす = 正しい商品を壊す検査になる(過去5回やった罠)。
// 記事の鮮度は記事側の問題なので、ここでは見ない。手書きの**ツールカード**だけを見る。
function stripArticleCards(html) {
  return html.replace(/<div class="p-(?:title|desc)">[\s\S]*?<\/div>/gi, "");
}

const years = await dataYears();
const pages = await walk(DOCS);
const problems = [];
const usedExemptions = new Set();

// その年号が「免除された文」の中にあるか。**位置**で見る。
// (文字列を含むかだけで見ると、同じ「令和8年」を含む免除が複数あるとき**先頭の1件が
//  全部に当たってしまい**、残りが「当たらない」と誤報される。実際にやった)
function exemptionAt(rel, html, at, lit) {
  for (const h of HISTORICAL_FACTS) {
    if (h.file !== rel) continue;
    for (let s = html.indexOf(h.snippet); s !== -1; s = html.indexOf(h.snippet, s + 1)) {
      if (s <= at && at + lit.length <= s + h.snippet.length) return h;
    }
  }
  return null;
}

for (const page of pages) {
  const rel = relative(DOCS, page);
  const raw = await readFile(page, "utf8");
  const html = stripArticleCards(stripComments(raw));

  // このページが fetch している年つきデータ = 名乗ってよい年
  const fetched = [...raw.matchAll(/assets\/([\w.-]+\.json)/g)].map((m) => m[1]);
  let allowed = new Set(fetched.map((f) => years.get(f)).filter(Boolean));

  // トップは全ツールを宣伝するので、全データの年を名乗れる
  if (rel === "index.html") allowed = new Set(years.values());

  for (const m of html.matchAll(ERA)) {
    const lit = m[0];
    // 制度の事実(新設された時期など)は、データを差し替えても真のまま。
    // ページがデータを読んでいるかに関わらず免除する(about ページのような解説にも要る)
    const ex = exemptionAt(rel, html, m.index, lit);
    if (ex) { usedExemptions.add(ex.file + "|" + ex.snippet); continue; }

    if (!allowed.size) {
      // 年つきデータを使っていないのに年を名乗っている = 誰も更新しないので必ず腐る
      problems.push(`${rel}: 「${lit}」と書いているが、年つきの参照データを読んでいない` +
                    `(制度の事実なら HISTORICAL_FACTS へ。データの申告ならデータに年を持たせる)`);
      continue;
    }
    if (![...allowed].some((a) => a.replace(/\s/g, "") === lit.replace(/\s/g, ""))) {
      problems.push(`${rel}: 「${lit}」がデータの年と食い違う` +
                    `(このページのデータ: ${[...allowed].join(" / ")})`);
    }
  }
}

// 免除リストが腐っていないか(直したのに残っている / 文言が変わって当たらない)
for (const h of HISTORICAL_FACTS) {
  if (!usedExemptions.has(h.file + "|" + h.snippet)) {
    problems.push(`HISTORICAL_FACTS が当たらない: ${h.file} 「${h.snippet}」` +
                  `(文言が変わったか、記述が消えた。リストを直すこと)`);
  }
}

if (problems.length) {
  console.error("❌ 年度表記がデータと食い違っています:\n");
  for (const p of problems) console.error("  - " + p);
  console.error(`\n  データが名乗っている年: ${[...years].map(([f, y]) => `${f}=${y}`).join(", ")}`);
  console.error(`\n  「制度の事実」(年が変わっても真)なら HISTORICAL_FACTS に理由つきで足す。`);
  console.error(`  「使ったデータの申告」なら、データの年に合わせて書き直す。`);
  process.exit(1);
}
console.log(`✅ 年度表記 ${pages.length}ページ: データの年と一致 ` +
            `(${[...years.values()].join(" / ")}、免除 ${HISTORICAL_FACTS.length}件)`);
