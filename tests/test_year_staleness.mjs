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
  { file: "haigusha-kojo/index.html", snippet: "令和8年度改正で引き上げ",
    reason: "★配偶者の所得要件58万→62万に引き上げた改正の固有名＝制度の事実(hero。jutakuの" +
            "『令和8年度税制改正』と同型)。データを差し替えても『令和8年度改正で引き上げられた』は真のまま。" +
            "どの年分で計算したかは setsuzei_r08.json の _meta.year から結果欄に描いている" },
  { file: "seimei-hoken-kojo/index.html", snippet: "令和8年分・令和9年分",
    reason: "★租税特別措置法41条の15の5が『令和八年分又は令和九年分』と条文に書いている適用年分そのもの＝" +
            "制度の事実(e-Gov 令和8年12月1日施行版で逐語確認)。特例が効くのはこの2年分だけ、というのが" +
            "この規定の内容なので、参照データを差し替えても真であり続ける。むしろ機械置換すると" +
            "『令和9年分にも効く』という条文の内容そのものを書き換えて嘘にする。" +
            "どの年分の速算表で計算したかは setsuzei_r08.json の _meta.year から結果欄に描いている" },
  { file: "index.html", snippet: "（令和8年分・令和9年分）",
    reason: "同上(トップのツールカードの説明文)。措法41条の15の5の適用年分＝制度の事実" },
  { file: "hitorioya-kojo/index.html", snippet: "令和2年分",
    reason: "★ひとり親控除の創設・寡夫控除の廃止・未婚を含む制度への組み替えが行われた改正の" +
            "年分の固有名＝制度の事実。データを令和9年分に差し替えても『令和2年分の改正で作られた』" +
            "は真のまま。どの年分で計算したかは setsuzei_r08.json の hitorioya.year から結果欄に描いている" },
  { file: "aoiro-kojo/index.html", snippet: "令和9年分",
    reason: "★令和8年3月31日法律第12号 附則33条が『新租税特別措置法第二十五条の二の規定は、" +
            "令和九年分以後の所得税について適用し、令和八年分以前の所得税については、なお従前の例による』と" +
            "定めている適用開始年分そのもの＝制度の事実(e-Gov 2027-01-01施行版の附則で逐語確認)。" +
            "『75万円が使えるのは令和9年分から/令和8年分は65・55・10万円のまま』がこの規定の内容なので、" +
            "参照データを差し替えても真であり続ける。むしろ機械置換すると" +
            "『今年から75万円が使える』という逆向きの嘘になる(第6便の年収の壁と同型の事故)。" +
            "どの年分で計算したかは setsuzei_r08.json の aoiro.year / _meta.year から結果欄と出典注記に描いている" },
  { file: "index.html", snippet: "令和9年分からの75万円・55万円廃止",
    reason: "同上(トップのツールカードの説明文)。措法25条の2の改正の適用開始年分＝制度の事実" },
  { file: "tosan-boshi-kyosai/index.html", snippet: "令和6年",
    reason: "★倒産防止共済の再加入2年ルールは『令和6年3月30日法律第8号 附則30条』が" +
            "『令和6年10月1日以後に解除があった場合』と適用時期を定めている改正の固有名と施行時期" +
            "そのもの＝制度の事実(e-Gov現行版の附則で逐語確認)。令和9年になっても" +
            "『令和6年10月1日以後の解約から適用』は真であり続ける。むしろ機械置換すると" +
            "適用開始時期を書き換えて『最近の解約には適用されない』式の嘘になる。" +
            "どの年分の税率で計算したかは setsuzei_r08.json の _meta.year から結果欄に描いている" },
  { file: "index.html", snippet: "令和6年10月からの再加入2年ルール",
    reason: "同上(トップのツールカードの説明文)。措法28条2項の適用開始時期＝制度の事実" },
  { file: "kihonteate/index.html", snippet: "令和9年3月31日",
    reason: "★雇用保険法附則4条の暫定措置(雇止め→特定受給資格者みなし)の法定期限そのもの＝制度の事実" +
            "(2026-07-24にe-Gov現行版と未施行版2028-10-01の両方で本文md5一致を逐語確認)。" +
            "このページのデータ年(令和7年=日額の適用年)とは別の軸の日付で、日額データを令和8年8月版に" +
            "差し替えても期限は真のまま。機械置換すると法定期限を書き換えて嘘にする。" +
            "この日付は kihonteate_r07.json の fusoku4_zantei.kigen_wareki が正本で、" +
            "test_kihonteate_zantei.mjs がページ・記事・coreとの一致とrecheck_afterカナリアを守っている" },
  { file: "shakai-hoken/index.html", snippet: "子ども・子育て支援金（令和8年4月から新設）",
    reason: "新設された時期そのものが事実。令和9年度になっても『令和8年4月に新設』は真" },
  { file: "shakai-hoken/index.html", snippet: "令和8年（2026年）4月分から、",
    reason: "徴収開始時期の事実。将来の年度の料率表に差し替えても変わらない" },
  { file: "shakai-hoken/index.html", snippet: "子ども・子育て支援金は令和8年4月分から",
    reason: "同上(結果欄の注記。JSのテンプレートリテラルから描かれている)" },
  // about は本文全体が <article> なので stripArticleBody で丸ごと免除される
  // (旧: 令和8年4月新設の個別免除は、article免除の導入で不要になった)。
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
  { file: "jutaku/index.html", snippet: "令和4年以降に居住の用に供した場合",
    reason: "★国税庁タックスアンサー No.1211-1 の正式名称そのもの＝出典の識別情報（制度の事実）。" +
            "「住宅の新築等をし、令和4年以降に居住の用に供した場合（住宅借入金等特別控除）」という" +
            "文書名は、令和8年分の借入限度額データに差し替えても変わらない（この regime が令和4年入居分から" +
            "始まったことは事実）。ページが『どの年で計算したか』の年号は全てJS（eraLabel）でデータから" +
            "描いており、静的HTMLに令和N年を手書きしていない。" },
  { file: "furusato/index.html", snippet: "令和20年度",
    reason: "★特例控除額の割合の読替え(地方税法附則5条の6)が適用される期間そのもの＝制度の事実。" +
            "『平成26年度から令和20年度まで84.895%等に読み替える』は、令和9年分の料率JSONに" +
            "差し替えても真であり続ける(むしろ令和21年度に本則へ戻ることを読者に伝える記述)。" +
            "このページが『どの年のデータで計算したか』は _meta.year から描いており、手書きしていない" },
  { file: "kabe/index.html", snippet: "令和8年10月に撤廃予定",
    reason: "★賃金要件(月8.8万＝約106万円)が撤廃される時期そのもの＝制度の事実(令和7年 年金制度改正法で" +
            "予定された施行時期。料率データを差し替えても『令和8年10月に撤廃予定』は真)。" +
            "一次情報: 日本年金機構 tanjikan『この要件は令和8年10月に撤廃予定です』。" +
            "手取りの計算に使う料率の年は協会けんぽ shaho_rates の _meta.year から描いている" },
  { file: "iryohi/index.html", snippet: "令和8年12月31日まで",
    reason: "★セルフメディケーション税制（措置法41条の17）の適用期限そのもの＝制度の事実。" +
            "令和9年になっても『令和8年12月31日まで適用だった』は真であり続ける（延長されれば法改正なので" +
            "ページも差し替える）。どの年分のデータで計算したかは iryohi_r08.json の _meta.year から src-note に描いており、" +
            "手書きしていない。同じ期限は selfmed.valid_until にもデータとして持たせている" },
  { file: "zoyozei/index.html", snippet: "令和4年4月1日以後",
    reason: "★贈与税の特例税率の年齢要件『18歳』が適用される起点そのもの＝制度の事実。" +
            "令和4年3月31日以前の贈与は『20歳』（措法70条の2の5・令和4年4月1日施行）。" +
            "令和9年分の速算表データに差し替えても『令和4年4月1日以後は18歳』は真であり続ける。" },
  { file: "zoyozei/index.html", snippet: "令和6年からの年110万円",
    reason: "★相続時精算課税に年110万円の基礎控除が新設された時期そのもの＝制度の事実" +
            "（令和5年度改正・令和6年1月1日以後の贈与から）。暦年課税の速算表データを差し替えても『令和6年から』は真。" },
  { file: "kabe/index.html", snippet: "令和7年 年金制度改正法",
    reason: "★『106万円の壁』を撤廃した法改正の年そのもの＝制度の事実(厚労省。年が変わっても" +
            "『令和7年の年金制度改正法』は真であり続ける出典の識別情報)" },
  { file: "jutaku/index.html", snippet: "令和8年度税制改正",
    reason: "★住宅ローン控除を令和12年入居まで5年延長し中古のルールを再編した改正の固有名＝制度の事実" +
            "(kabe の『令和7年 年金制度改正法』と同型)。令和9年分のデータに差し替えても" +
            "『令和8年度税制改正で延長された』は真であり続ける。どの年で計算したかの年号は" +
            "eraLabel（JS）と _meta.year から描いており、補助的な年は西暦で書く規律にしている" },
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

// ツール本体化(#1)で、ツールページの計算機の下に**解説記事の中身を <article> で埋め込む**ように
// なった(例: /tedori/)。<article> の中は column/ と同じく制度の沿革・改正履歴・他年度との比較を
// 語る(令和2年政令、令和7年度→令和8年度の料率比較など)ので、column/ を対象外にしたのと同じ理由で
// **<article> の中は年チェックの対象外**にする。**計算に使ったデータの年の申告は JS が結果欄に
// 描いており(<article>の外)、そちらは引き続き厳格にチェックされる**ので、嘘の申告は防げる。
// (埋め込んだ早見表の手書き数字の鮮度は、記事と同じく test_fee_article 型の照合で別途担保する)
function stripArticleBody(html) {
  return html.replace(/<article[\s\S]*?<\/article>/gi, "");
}

// JSON-LD(application/ld+json)は**利用者に見えない機械可読の写し**で、中身は本文(FAQ等)の
// 言い換え。可視の本文側は既にチェック(または<article>で免除)されているので、写しをもう一度
// 突き合わせると二重になり、しかも本文がgen_faq_jsonldで生成した歴史的事実(令和2年政令 等)を
// **head の JSON-LD が抱えるため <article> 免除をすり抜けて誤検知する**。写しは外す。
// ⚠️ 外すのは ld+json だけ。**結果欄を描く <script type="module"> は外さない**(可視文字列を描くため)。
function stripLdJson(html) {
  return html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
}

const years = await dataYears();
const pages = await walk(DOCS);
const problems = [];
const usedExemptions = new Set();
const rawByRel = new Map(); // 免除の生死判定用(article/ld+json に在って strip 後に消える文言のため)

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
  rawByRel.set(rel, raw);
  const html = stripLdJson(stripArticleBody(stripArticleCards(stripComments(raw))));

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
  if (usedExemptions.has(h.file + "|" + h.snippet)) continue;
  // 年チェックでは使われなかったが、文言が生きている場合がある:
  // ツール本体化で静的な制度事実が <article> の中へ移ると strip 後の html には現れないが、
  // 記述自体は残っている。raw に在れば「腐った免除」ではないので見逃す(genuine な文言変更のみ落とす)。
  const raw = rawByRel.get(h.file);
  if (raw && raw.includes(h.snippet)) continue;
  problems.push(`HISTORICAL_FACTS が当たらない: ${h.file} 「${h.snippet}」` +
                `(文言が変わったか、記述が消えた。リストを直すこと)`);
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
