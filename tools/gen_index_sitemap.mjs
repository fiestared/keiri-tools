/**
 * sitemap.xml と コラム一覧(column/index.html の記事リスト) を、記事ファイルから生成する。
 *
 * なぜ生成にするか:
 * 記事を書くたびに「sitemap に足す」「一覧に足す」を手でやると、**必ずいつか忘れる**。
 * 忘れた記事は誰にも届かない(検索にも載らず、サイト内からも辿れない)。
 * このリポジトリは同じ理由でFAQのJSON-LDも生成方式にした。同じ規律を適用する。
 *
 *   node tools/gen_index_sitemap.mjs           生成
 *   node tools/gen_index_sitemap.mjs --check   差分があれば失敗(CI/テスト用)
 *
 * 記事側の正本:
 *   タイトル … <h1>
 *   日付     … JSON-LD の datePublished
 *   説明文   … <meta name="card-desc">(一覧カード用の短い惹句)。無ければ meta description
 * 並び順は下の ORDER。載っていない記事は日付降順で後ろに付く。
 *
 * 一覧は CATEGORIES ごとのセクションに分けて出す(48本を縦一列に並べても探せない)。
 * **カテゴリ内の並びは ORDER(検索需要順)のまま**。日付順にしない
 * (需要の大きい記事ほど上に出したいのであって、新しい記事を上に出したいのではない)。
 * CATEGORIES に無い記事は「その他」に入れたうえで名指しで警告する。
 * 黙って埋もれさせないため、未分類は test_article_structure.mjs が落とす。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const COLUMN = join(DOCS, "column");
const CHECK = process.argv.includes("--check");

/** 一覧の並び(検索需要の大きい順。ここに無い記事は日付降順で末尾) */
const ORDER = [
  "furusato-nozei-keisan",      // ふるさと納税 計算 85,023/月（ふるさと納税 シミュレーション 57,105 も同記事で受ける）
  "nenmatsu-chosei-kakikata",   // 年末調整 書き方 57,105/月
  "kogaku-ryoyohi",             // 高額療養費制度 38,281/月（限度額適用認定証 31,302 も同記事で受ける）
  "ikuji-kyugyo-kyufukin",      // 育児休業給付金 31,302/月
  "tedori-keisan",              // 手取り計算 25,591/月（手取り20万 9,390・手取り30万 7,656 も同記事で受ける）
  "shitsugyo-hoken-keisan",     // 失業保険 計算 25,591/月（失業保険 自己都合 25,591・失業保険 期間 11,464 も同記事で受ける）
  "saishushoku-teate",          // 再就職手当 25,591/月
  "koyou-hoken-kanyu-joken",    // 雇用保険 加入条件 25,591/月
  "rishokuhyo",                 // 離職票 25,591/月（離職票 書き方 2,284・離職票 いつもらえる 1,226 も同記事で受ける）
  "invoice-wakariyasuku",
  "shakai-hoken-kanyu-joken",
  "shakai-hokenryo-keisan",
  "taishokukin-zeikin",
  "gensen-choshuhyo-mikata",    // 源泉徴収票 見方 17,131/月
  "gensen-zeigakuhyo-mikata",   // 源泉徴収税額表 14,001/月
  "iryohi-kojo-ikura-kara",     // 医療費控除 いくらから 11,464/月（計算9,390・明細書7,656も同記事で受ける）
  "shussan-teate-kin",          // 出産手当金 11,464/月
  "shussan-ikuji-ichijikin",    // 出産育児一時金 11,464/月
  "koyou-hokenryo-ritsu",       // 雇用保険料率 11,464/月
  "shakai-hokenryo-kojo",       // 社会保険料控除 9,390/月
  "yukyu-fuyo-nissu",           // 有給休暇 付与日数 7,656/月
  "shobyo-teate-kin",           // 傷病手当金 6,260/月
  "zuiji-kaitei",               // 随時改定・月額変更届 4,652/月
  "kotei-zangyodai",            // 固定残業代 4,188/月
  "kenko-hoken-nini-keizoku",   // 健康保険 任意継続 4,188/月
  "tsukin-teate-hikazei",       // 通勤手当 非課税 2,791/月
  "furikomi-tesuryo-kanjo-kamoku", // 振込手数料 勘定科目 1,523/月
  "nenmatsu-chosei-itsumade",
  "denchoho-wakariyasuku",
  "kaigo-hokenryo-itsukara",
  "shogaku-genka-shokyaku",
  "nenshu-no-kabe",
  "shakai-hoken-fuyo-joken",
  "yukyu-kaitori",
  "juminzei-tokubetsu-choshu",
  "zangyodai-keisan",
  "invoice-2wari-tokurei",
  "fuyo-kojo-shinkokusho",
  "nenmatsu-chosei-kanpukin",
  "part-yukyu",
  "hoteichosho-goukeihyo",
  "kani-kazei",
  "shohizei-hasu-shori",
  "denchoho-kensaku-yoken",
  "hyojun-hoshu-gakuhyo",
  "shoyo-shakaihoken",
  "teiji-kettei",
  "kodomo-kosodate-shienkin",
  "yukyu-nen5ka",
  "eigyobi-kazoekata",
  "furikomi-tesuryo-hikaku",
  "senpou-futan-3hoshiki",
  "zengin-format-guide",
];

/**
 * 一覧のカテゴリ。ここに無い記事は「その他」送り + 警告 + テスト失敗。
 * 記事を書いたら ORDER と CATEGORIES の**両方**に登録する(片方だけだと一覧で埋もれる)。
 * カテゴリ内の並びは ORDER(需要順)が効くので、slugs の順序は意味を持たない。
 */
const CATEGORIES = [
  {
    id: "shakai-hoken",
    name: "社会保険・年金",
    desc: "加入の条件、保険料の決まり方(標準報酬月額・定時決定・随時改定)、扶養と年収の壁。",
    slugs: [
      "shakai-hoken-kanyu-joken", "shakai-hokenryo-keisan", "hyojun-hoshu-gakuhyo",
      "teiji-kettei", "zuiji-kaitei", "shoyo-shakaihoken", "kaigo-hokenryo-itsukara",
      "kodomo-kosodate-shienkin", "shakai-hoken-fuyo-joken", "nenshu-no-kabe",
      "koyou-hoken-kanyu-joken", "koyou-hokenryo-ritsu", "kenko-hoken-nini-keizoku",
    ],
  },
  {
    id: "nenmatsu-gensen",
    name: "年末調整・源泉徴収・控除",
    desc: "年末調整の書類の書き方と期限、源泉徴収票・税額表の読み方、医療費控除・ふるさと納税など各種控除と確定申告。",
    slugs: [
      "furusato-nozei-keisan",
      "nenmatsu-chosei-kakikata", "nenmatsu-chosei-itsumade", "nenmatsu-chosei-kanpukin",
      "fuyo-kojo-shinkokusho", "gensen-choshuhyo-mikata", "gensen-zeigakuhyo-mikata",
      "hoteichosho-goukeihyo", "shakai-hokenryo-kojo", "iryohi-kojo-ikura-kara",
      "taishokukin-zeikin",
    ],
  },
  {
    id: "kyuyo",
    name: "給与計算・手取り",
    desc: "額面から手取りまでの引かれ方、残業代・通勤手当・住民税の実務。",
    slugs: [
      "tedori-keisan", "zangyodai-keisan", "kotei-zangyodai", "tsukin-teate-hikazei",
      "juminzei-tokubetsu-choshu",
    ],
  },
  {
    id: "kyufu",
    name: "健康保険・雇用保険の給付",
    desc: "医療費が高額になったとき、病気・出産・育児で働けないとき、失業したときに受け取れるお金。",
    slugs: [
      "kogaku-ryoyohi", "shobyo-teate-kin", "shussan-teate-kin", "shussan-ikuji-ichijikin",
      "ikuji-kyugyo-kyufukin", "shitsugyo-hoken-keisan", "saishushoku-teate",
      "rishokuhyo",
    ],
  },
  {
    id: "yukyu",
    name: "有給休暇",
    desc: "付与日数の数え方、年5日の取得義務、パート・アルバイトの比例付与と買い取り。",
    slugs: ["yukyu-fuyo-nissu", "yukyu-nen5ka", "part-yukyu", "yukyu-kaitori"],
  },
  {
    id: "shohizei",
    name: "消費税・インボイス",
    desc: "インボイス制度の基本と2割特例・簡易課税、消費税の端数処理。",
    slugs: ["invoice-wakariyasuku", "invoice-2wari-tokurei", "kani-kazei", "shohizei-hasu-shori"],
  },
  {
    id: "denchoho",
    name: "電子帳簿保存法",
    desc: "電子取引データの保存義務と、検索要件を満たす索引簿・ファイル名のつけ方。",
    slugs: ["denchoho-wakariyasuku", "denchoho-kensaku-yoken"],
  },
  {
    id: "keiri",
    name: "経理・振込の実務",
    desc: "振込手数料の比較と勘定科目、先方負担の差引方式、全銀フォーマット、営業日と減価償却。",
    slugs: [
      "furikomi-tesuryo-hikaku", "furikomi-tesuryo-kanjo-kamoku", "senpou-futan-3hoshiki",
      "zengin-format-guide", "eigyobi-kazoekata", "shogaku-genka-shokyaku",
    ],
  },
];

/** sitemap に載せるツール・固定ページ(記事は自動で追加される) */
const STATIC_PAGES = [
  "", "furusato/", "shobyo/", "shussan/", "ikuji/", "papa-ikukyu/", "juminzei/", "shakai-hoken/", "gensen-choshu/", "kihonteate/", "taishokukin/", "zangyodai/", "shohizei/", "eigyobi/",
  "yukyu/", "denchoho-index/", "senpou-futan/", "zengin-kana/", "shiharai-site/",
  "ext/amazon-receipt/", "column/", "about/", "privacy/", "contact/",
];

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;");

const articles = [];
const skipped = [];
for (const slug of readdirSync(COLUMN)) {
  const f = join(COLUMN, slug, "index.html");
  if (!existsSync(f) || !statSync(join(COLUMN, slug)).isDirectory()) continue;
  // 書きかけ・公開してはいけない記事は .nopublish を置いて外す。
  // これが無いと、作業ツリーに残った記事(未コミット=本番に出ない)が sitemap と一覧に載り、
  // 404 へのリンクを公開してしまう(2026-07-13 第23便に実際に起きかけた)。
  if (existsSync(join(COLUMN, slug, ".nopublish"))) { skipped.push(slug); continue; }
  const html = readFileSync(f, "utf8");
  const title = strip(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const date = html.match(/"datePublished":\s*"(\d{4})-(\d{2})-(\d{2})"/);
  const desc = html.match(/<meta name="card-desc" content="([^"]*)"/)?.[1]
            ?? html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  if (!title || !date) {
    console.error(`✗ ${slug}: h1 か datePublished が読めない`);
    process.exit(1);
  }
  articles.push({ slug, title, desc, ymd: `${date[1]}.${date[2]}.${date[3]}`,
                  iso: `${date[1]}-${date[2]}-${date[3]}` });
}

articles.sort((a, b) => {
  const ia = ORDER.indexOf(a.slug), ib = ORDER.indexOf(b.slug);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return b.iso.localeCompare(a.iso);
});

// ---- sitemap.xml ----
// lastmod は「そのページが最後に変わった日」= gitのコミット日から採る。
// **生成日(今日)を全URLに押すと嘘になる**: 中身が変わっていない69本まで「今日更新した」と
// 名乗ることになり、Googleは lastmod が当てにならないと学習して**以後この値を無視する**
// (= 本当に更新した日を伝える手段を自分で捨てる)。
// 未コミット/未追跡のファイルだけは「今まさに変わっている」ので今日でよい(こちらも真)。
const git = (...a) => {
  try { return execFileSync("git", a, { cwd: DOCS, encoding: "utf8" }).trim(); }
  catch { return ""; }
};
const TODAY = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD
const root = git("rev-parse", "--show-toplevel");
// 作業ツリーで変更中のファイル(未追跡を含む)を1回で集める。git status の経路は root からの相対。
// ★`-uall` が要る: 既定の git status は**未追跡ディレクトリを1行に畳む**(`?? docs/juminzei/`)。
//   畳まれると dirty に入るのは**ディレクトリ**なので、`docs/juminzei/index.html` の照合が外れ、
//   git log にも履歴が無い(まだコミット前)ため **lastmod が丸ごと落ちる**。
//   = **新しく作ったページ**、つまり lastmod がいちばん要るページだけが黙って lastmod 無しで出る。
//   実際に /juminzei/ を lastmod 無しで本番へ出した(2026-07-14 第23便)。
const dirty = new Set(
  git("status", "--porcelain", "-uall", "--", DOCS).split("\n").filter(Boolean)
    .map((l) => l.slice(3).split(" -> ").pop().replace(/^"|"$/g, ""))
    .map((p) => join(root, p)),
);
const lastmodOf = (file) => {
  if (dirty.has(file)) return TODAY;
  return git("log", "-1", "--format=%cs", "--", file); // 履歴が無ければ "" → lastmod を出さない
};

const urls = [
  ...STATIC_PAGES.map((p) => ({ loc: `https://keiri-tools.com/${p}`, file: join(DOCS, p, "index.html") })),
  ...articles.map((a) => ({ loc: `https://keiri-tools.com/column/${a.slug}/`,
                            file: join(COLUMN, a.slug, "index.html") })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, file }) => {
  const d = lastmodOf(file);
  return `  <url><loc>${loc}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`;
}).join("\n")}
</urlset>
`;

// ---- column/index.html の記事リスト(カテゴリ別セクション) ----
// CATEGORIES の記述ミス(存在しない記事・同じ記事を2つのカテゴリに登録)は黙って通すと
// 「一覧に2回出る」「カテゴリの件数が合わない」になる。ここで落とす。
{
  const seen = new Map();
  for (const c of CATEGORIES) {
    for (const s of c.slugs) {
      if (seen.has(s)) {
        console.error(`✗ CATEGORIES: ${s} が「${seen.get(s)}」と「${c.name}」に重複登録`);
        process.exit(1);
      }
      seen.set(s, c.name);
    }
  }
}

const catOf = new Map();
for (const c of CATEGORIES) for (const s of c.slugs) catOf.set(s, c.id);
const uncategorized = articles.filter((a) => !catOf.has(a.slug));

// 記事カード。data-s = 「タイトル＋説明文」を小文字化したもの(クライアント側の絞り込み用)。
// 検索はブラウザの中だけで完結する — 入力を外部に送らない(このサイトの売り)。
const card = (a, indent) => `${indent}<a href="${a.slug}/" data-s="${esc((a.title + " " + a.desc).toLowerCase())}">
${indent}  <div class="p-date">${a.ymd}</div>
${indent}  <div>
${indent}    <div class="p-title">${esc(a.title)}</div>
${indent}    <div class="p-desc">${esc(a.desc)}</div>
${indent}  </div>
${indent}</a>`;

// カテゴリ内の並びは articles(=ORDER=需要順)のまま。日付順にはしない。
const groups = CATEGORIES.map((c) => ({
  id: c.id, name: c.name, desc: c.desc,
  items: articles.filter((a) => catOf.get(a.slug) === c.id),
})).filter((g) => g.items.length > 0);
if (uncategorized.length) {
  groups.push({
    id: "sonota", name: "その他",
    desc: "カテゴリ未設定の記事(gen_index_sitemap.mjs の CATEGORIES に登録してください)。",
    items: uncategorized,
  });
}

const catNav = groups.map((g) =>
  `    <a href="#cat-${g.id}">${esc(g.name)}<span>(${g.items.length})</span></a>`).join("\n");

const sections = groups.map((g) => `  <section class="cat" id="cat-${g.id}" data-cat>
    <h2>${esc(g.name)}<span class="cat-n">(${g.items.length})</span></h2>
    <p class="cat-desc">${esc(g.desc)}</p>
    <div class="post-list">
${g.items.map((a) => card(a, "      ")).join("\n")}
    </div>
  </section>`).join("\n");

const colBlock = `  <nav class="cat-nav" id="cat-nav">
${catNav}
  </nav>

${sections}`;

const colPath = join(COLUMN, "index.html");
let col = readFileSync(colPath, "utf8");
const OPEN = "<!-- GEN:COLUMN-INDEX -->";
const CLOSE = "<!-- /GEN:COLUMN-INDEX -->";
const cOpen = col.indexOf(OPEN);
const cClose = col.indexOf(CLOSE);
if (cOpen === -1 || cClose === -1) {
  console.error(`✗ column/index.html に ${OPEN} … ${CLOSE} が見つからない`);
  process.exit(1);
}
col = col.slice(0, cOpen + OPEN.length) + "\n" + colBlock + "\n" + col.slice(cClose);

const write = (path, next, label) => {
  const prev = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (prev === next) return false;
  if (CHECK) {
    console.error(`✗ ${label} が古い。node tools/gen_index_sitemap.mjs を流すこと`);
    process.exit(1);
  }
  writeFileSync(path, next);
  console.log(`  更新: ${label}`);
  return true;
};

// ---- トップページの「経理コラム」欄(上位6本だけ) ----
// 手打ちにしておくと、記事が増えても**古い低需要の記事が居座り続ける**(実際にそうなっていた)
const topPath = join(DOCS, "index.html");
let top = readFileSync(topPath, "utf8");
const topCards = articles.slice(0, 6).map((a) => `    <a href="column/${a.slug}/">
      <div class="p-date">${a.ymd}</div>
      <div>
        <div class="p-title">${esc(a.title)}</div>
        <div class="p-desc">${esc(a.desc)}</div>
      </div>
    </a>`).join("\n");
const tOpen = top.indexOf(`<div class="post-list">`);
const tStart = top.indexOf(">", tOpen) + 1;
const tEnd = top.indexOf("</div>\n</main>", tStart);
if (tOpen === -1 || tEnd === -1) {
  console.error("✗ index.html の post-list ブロックが見つからない");
  process.exit(1);
}
top = top.slice(0, tStart) + "\n" + topCards + "\n  " + top.slice(tEnd);

const a = write(join(DOCS, "sitemap.xml"), sitemap, "sitemap.xml");
const b = write(colPath, col, "column/index.html");
const c = write(topPath, top, "index.html（トップの新着6本）");
// 黙って落とさない。外した記事は必ず名指しで報告する(「全部載った」と誤読させない)
for (const slug of skipped) console.log(`  ⚠️  除外(.nopublish): ${slug} — sitemap・一覧に載せていない`);

// 未分類は「その他」に落ちて誰にも探されない。名指しで警告する
// (ORDER と同じで、登録忘れは黙って通ると気づけない。test_article_structure.mjs が落とす)
for (const a of uncategorized) {
  console.error(`  ⚠️  未分類: ${a.slug} — CATEGORIES に登録していないので「その他」に入れた`);
}
if (uncategorized.length) {
  console.error(`  → tools/gen_index_sitemap.mjs の CATEGORIES に ${uncategorized.length}本を割り当てること`);
}

const counts = groups.map((g) => `${g.name} ${g.items.length}`).join(" / ");
console.log(`✓ 記事 ${articles.length}本${a || b || c ? "" : "（変更なし）"}  [${counts}]`);
