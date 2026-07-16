/**
 * トップの「経理で困ったら聞ける」質問欄の検査。
 *   node tests/test_qa.mjs
 *
 * 見るもの:
 *  1) qa_index.json が**全記事・全ツールを網羅**している(数と URL の両方)。
 *     記事/ツールの列挙は生成器を import せず、ここで独立に数える(生成器が壊れても気づける)。
 *  2) 代表的な**話し言葉**の質問が、期待する記事/ツールを上位に返す(＝同義語辞書が効いている)。
 *     落ちたら gen_qa_index.mjs の SYNONYMS を足す。
 *  3) 明らかに無関係な質問は matched:false になる(＝答えられない質問を記録するループが機能する)。
 *  4) node tools/gen_qa_index.mjs --check が緑(＝コミットされた索引が記事の現状と一致)。
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { search } from "../docs/assets/qa_search.js";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const COLUMN = join(DOCS, "column");
const EXCLUDE_TOP = new Set(["assets", "column", "ext", "about", "privacy", "contact"]);

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? "✅" : "❌"} ${msg}`); if (!c) fails++; };

const index = JSON.parse(readFileSync(join(DOCS, "assets", "qa_index.json"), "utf8"));
const byUrl = new Map(index.map((e) => [e.url, e]));

// ---- (1) 網羅: 記事とツールを独立に数える ----
const articleSlugs = readdirSync(COLUMN).filter((slug) => {
  const dir = join(COLUMN, slug);
  return statSync(dir).isDirectory() && existsSync(join(dir, "index.html"))
    && !existsSync(join(dir, ".nopublish"));
});
const toolDirs = readdirSync(DOCS).filter((name) => {
  if (EXCLUDE_TOP.has(name)) return false;
  const dir = join(DOCS, name);
  return statSync(dir).isDirectory() && existsSync(join(dir, "index.html"));
});

const gotArticles = index.filter((e) => e.type === "article");
const gotTools = index.filter((e) => e.type === "tool");
ok(gotArticles.length === articleSlugs.length,
   `記事の網羅: 索引 ${gotArticles.length}件 = 記事フォルダ ${articleSlugs.length}件`);
ok(gotTools.length === toolDirs.length,
   `ツールの網羅: 索引 ${gotTools.length}件 = ツールフォルダ ${toolDirs.length}件`);
for (const slug of articleSlugs) {
  ok(byUrl.has(`/column/${slug}/`), `記事 /column/${slug}/ が索引にある`);
}
for (const name of toolDirs) {
  ok(byUrl.has(`/${name}/`), `ツール /${name}/ が索引にある`);
}

// ---- 各エントリの形が仕様どおりか ----
for (const e of index) {
  const shapeOk = (e.type === "article" || e.type === "tool")
    && typeof e.url === "string" && e.url.startsWith("/")
    && typeof e.title === "string" && e.title.length > 0
    && typeof e.answer === "string" && e.answer.length > 0
    && typeof e.terms === "string" && e.terms.length > 0
    && (e.tool === null || typeof e.tool === "string");
  if (!shapeOk) ok(false, `エントリの形が不正: ${JSON.stringify(e).slice(0, 120)}`);
}
ok(index.every((e) => e.type !== "article" || e.tool),
   "全記事に関連ツール(tool-cta)が紐づいている");
ok(index.every((e) => e.type !== "tool" || e.tool === e.url),
   "全ツールの tool は自分自身(＝計算ツールCTAを出せる)");

// ---- (2) 話し言葉の質問 → 期待する記事/ツールが上位に ----
// 各行: [質問, [期待URLのいずれか1つが上位3件に入ればよい]]。
// ここに並ぶのは「利用者の言葉」で、記事の用語(賞与/雇用保険/額面…)とは違う。
// これが通る＝同義語辞書が橋渡しできている、ということ。
const QUERIES = [
  ["ボーナス 保険料", ["/column/shoyo-shakaihoken/", "/shakai-hoken/"]],   // ボーナス→賞与
  ["ボーナスの社会保険料はいくら引かれる？", ["/column/shoyo-shakaihoken/", "/shakai-hoken/", "/column/kaigo-hokenryo-itsukara/"]],
  ["ふるさと納税 いくらまで", ["/furusato/", "/column/furusato-nozei-keisan/"]],
  ["ふるさと納税の上限は？", ["/furusato/", "/column/furusato-nozei-keisan/"]],
  ["失業保険 いくら", ["/column/shitsugyo-hoken-keisan/", "/kihonteate/"]],
  ["有給 何日", ["/column/yukyu-fuyo-nissu/", "/column/part-yukyu/", "/yukyu/"]],
  // 旧: /column/tedori-keisan/ を期待していたが、2026-07-16 に /tedori/ 本体へ統合(.nopublish)。
  // いまの正解は手取り計算のツール2本(月給/賞与)のどちらか
  ["手取り 計算", ["/tedori/", "/bonus-tedori/"]],                          // 額面→手取り
  ["バイト 有給", ["/column/part-yukyu/", "/yukyu/"]],                     // バイト→アルバイト
  ["退職金 税金", ["/taishokukin/", "/column/taishokukin-zeikin/"]],
  ["インボイスってなに", ["/column/invoice-wakariyasuku/", "/column/invoice-2wari-tokurei/"]],
  ["電帳法 索引簿", ["/denchoho-index/", "/column/denchoho-kensaku-yoken/"]], // 電帳法→電子帳簿保存法
  ["産休 手当", ["/shussan/", "/column/shussan-teate-kin/"]],              // 産休→出産手当金
  ["育休 いくら", ["/column/ikuji-kyugyo-kyufukin/", "/papa-ikukyu/"]],     // 育休→育児休業
  ["住民税 いくら", ["/juminzei/", "/column/juminzei-tokubetsu-choshu/"]],
  ["医療費控除 いくらから", ["/column/iryohi-kojo-ikura-kara/"]],
  ["住宅ローン控除の計算", ["/jutaku/", "/column/nenmatsu-chosei-kakikata/"]],
  ["源泉徴収票の見方", ["/column/gensen-choshuhyo-mikata/"]],
  ["振込手数料 勘定科目", ["/column/furikomi-tesuryo-kanjo-kamoku/"]],
  ["カナ変換", ["/zengin-kana/", "/column/zengin-format-guide/"]],
  ["年収の壁", ["/column/nenshu-no-kabe/"]],
  ["みなし残業", ["/column/kotei-zangyodai/"]],                            // みなし残業→固定残業代
  ["出産一時金", ["/column/shussan-ikuji-ichijikin/"]],                    // 出産一時金→出産育児一時金
  ["交通費 非課税", ["/column/tsukin-teate-hikazei/"]],                    // 交通費→通勤手当
  ["残業代の計算", ["/zangyodai/", "/column/zangyodai-keisan/"]],
];
for (const [q, expect] of QUERIES) {
  const r = search(index, q);
  const urls = r.results.map((e) => e.url);
  const hit = expect.some((u) => urls.includes(u));
  ok(r.matched && hit,
     `「${q}」→ 上位に ${expect[0]} 等 [best=${r.best.toFixed(1)}] 実際=${urls.join(" ") || "(なし)"}`);
}

// ---- (3) 無関係な質問は matched:false(答えられない質問として記録される) ----
const NO_MATCH = ["今日の天気", "おすすめの映画", "旅行の予約", "宇宙旅行の予約方法", "カレーの作り方"];
for (const q of NO_MATCH) {
  const r = search(index, q);
  ok(!r.matched, `無関係「${q}」は matched:false [best=${r.best.toFixed(1)}]`);
}

// ---- (4) 生成器 --check(索引が記事の現状と一致しているか) ----
try {
  execFileSync("node", ["tools/gen_qa_index.mjs", "--check"],
    { cwd: join(DOCS, ".."), stdio: "pipe" });
  ok(true, "gen_qa_index.mjs --check が緑(索引は最新)");
} catch {
  ok(false, "gen_qa_index.mjs --check が失敗(node tools/gen_qa_index.mjs を流すこと)");
}

console.log(fails ? `\n❌ ${fails}件 失敗` : `\nall qa tests passed (記事${gotArticles.length}/ツール${gotTools.length})`);
process.exit(fails ? 1 : 0);
