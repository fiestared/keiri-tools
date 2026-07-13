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
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const COLUMN = join(DOCS, "column");
const CHECK = process.argv.includes("--check");

/** 一覧の並び(検索需要の大きい順。ここに無い記事は日付降順で末尾) */
const ORDER = [
  "nenmatsu-chosei-kakikata",   // 年末調整 書き方 57,105/月
  "ikuji-kyugyo-kyufukin",      // 育児休業給付金 31,302/月
  "invoice-wakariyasuku",
  "shakai-hoken-kanyu-joken",
  "shakai-hokenryo-keisan",
  "taishokukin-zeikin",
  "gensen-choshuhyo-mikata",    // 源泉徴収票 見方 17,131/月
  "shussan-teate-kin",          // 出産手当金 11,464/月
  "shussan-ikuji-ichijikin",    // 出産育児一時金 11,464/月
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

/** sitemap に載せるツール・固定ページ(記事は自動で追加される) */
const STATIC_PAGES = [
  "", "shakai-hoken/", "gensen-choshu/", "shohizei/", "eigyobi/", "yukyu/",
  "denchoho-index/", "senpou-futan/", "zengin-kana/", "shiharai-site/",
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
const urls = [
  ...STATIC_PAGES.map((p) => `https://keiri-tools.com/${p}`),
  ...articles.map((a) => `https://keiri-tools.com/column/${a.slug}/`),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;

// ---- column/index.html の記事リスト ----
const cards = articles.map((a) => `    <a href="${a.slug}/">
      <div class="p-date">${a.ymd}</div>
      <div>
        <div class="p-title">${esc(a.title)}</div>
        <div class="p-desc">${esc(a.desc)}</div>
      </div>
    </a>`).join("\n");

const colPath = join(COLUMN, "index.html");
let col = readFileSync(colPath, "utf8");
const open = col.indexOf(`<div class="post-list"`);
const listStart = col.indexOf(">", open) + 1;
const listEnd = col.indexOf("</div>\n</main>", listStart);
if (open === -1 || listEnd === -1) {
  console.error("✗ column/index.html の post-list ブロックが見つからない");
  process.exit(1);
}
col = col.slice(0, listStart) + "\n" + cards + "\n  " + col.slice(listEnd);

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
console.log(`✓ 記事 ${articles.length}本${a || b || c ? "" : "（変更なし）"}`);
