/**
 * docs/assets/qa_index.json を、コラムの各記事と docs 直下の各ツールから生成する。
 *
 * これはトップの「経理で困ったら聞ける」質問欄が引く索引。**答えは必ず検証済みの既存記事・
 * ツールから返す**ので、LLM を呼ばない(課金なし・嘘なし・自律)。質問マッチャーの純ロジックは
 * docs/assets/qa_search.js。
 *
 *   node tools/gen_qa_index.mjs           生成
 *   node tools/gen_qa_index.mjs --check   差分があれば失敗(CI/テスト用)
 *
 * 各エントリ:
 *   { type:"article"|"tool", url, title, answer, tool:"/<slug>/"|null, terms }
 *   - article の answer は <meta name="description">(結論ファーストで書かれている)。
 *   - article の tool は本文最初の class="tool-cta" の href(関連ツールへの導線)。
 *   - terms は title + answer + 同義語 + カテゴリ を小文字連結した検索用文字列。
 *
 * ★同義語辞書(下の SYNONYMS): 利用者の話し言葉と記事の用語の橋渡し。
 *   「ボーナス→賞与」「バイト→アルバイト」等、記事の title/desc に出る語に対応する話し言葉を
 *   terms に足す。これで利用者が実際に使う言葉で検索してもヒットする。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const COLUMN = join(DOCS, "column");
const OUT = join(DOCS, "assets", "qa_index.json");
const CHECK = process.argv.includes("--check");

// docs 直下でツールとして扱わないディレクトリ(素材・記事・固定ページ・拡張)。
// embed = 他サイト設置用ウィジェット群(noindex・sitemap外)。質問箱の答えとして出す面ではない
const EXCLUDE_TOP = new Set(["assets", "column", "ext", "about", "privacy", "contact", "embed"]);

const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/**
 * 同義語辞書。when(記事/ツールの用語)のどれかが title+answer に含まれていたら、
 * add(利用者の話し言葉)を terms に足す。**話し言葉→正式用語の一方向**の橋渡し。
 * (記事は正式用語で書かれているので、利用者の口語を足せば検索が届く)
 */
const SYNONYMS = [
  { when: ["賞与"], add: ["ボーナス"] },
  { when: ["アルバイト", "パート"], add: ["バイト"] },
  { when: ["控除", "天引き", "差し引", "差引"], add: ["引かれる", "引かれ", "天引き", "差し引かれる", "引く"] },
  { when: ["計算", "シミュレーション", "いくら"], add: ["いくら", "どのくらい", "いくらぐらい", "金額", "目安"] },
  { when: ["ふるさと納税"], add: ["寄付", "ふるさと", "納税"] },
  { when: ["上限", "限度額"], add: ["いくらまで", "上限", "限度額"] },
  { when: ["雇用保険", "基本手当", "失業"], add: ["失業保険", "失業手当", "失業給付", "失業"] },
  { when: ["出産手当金", "産前", "産後"], add: ["産休", "産前産後", "出産で休"] },
  { when: ["育児休業"], add: ["育休", "産休明け", "育児休暇"] },
  { when: ["手取り", "額面"], add: ["手取り", "額面", "てどり", "給料 いくら残る"] },
  { when: ["健康保険"], add: ["保険証", "健保"] },
  { when: ["社会保険"], add: ["社保", "社会保険"] },
  { when: ["残業", "割増賃金"], add: ["残業", "時間外", "ざんぎょう", "サービス残業"] },
  { when: ["有給", "年次有給"], add: ["有給", "有休", "年休", "有給休暇"] },
  { when: ["退職金", "退職所得"], add: ["退職金", "退職", "たいしょくきん"] },
  { when: ["住民税"], add: ["市民税", "区民税", "県民税", "市県民税"] },
  { when: ["源泉徴収"], add: ["源泉", "源泉税"] },
  { when: ["医療費控除"], add: ["医療費", "確定申告 医療費"] },
  { when: ["相続税", "相続"], add: ["相続税", "相続", "遺産", "遺産相続", "相続 いくら", "基礎控除"] },
  { when: ["高額療養費"], add: ["高額医療", "医療費が高額", "限度額適用認定証"] },
  { when: ["インボイス", "適格請求書"], add: ["インボイス", "適格請求書", "消費税 請求書"] },
  { when: ["電子帳簿保存", "電帳"], add: ["電帳法", "電子取引", "でんちょうほう", "電子保存"] },
  { when: ["振込手数料"], add: ["振込料", "ふりこみ手数料", "振込 手数料"] },
  { when: ["標準報酬月額"], add: ["等級", "標準報酬"] },
  { when: ["年末調整"], add: ["年調", "年末調整"] },
  { when: ["通勤手当"], add: ["交通費", "通勤費"] },
  { when: ["傷病手当金"], add: ["傷病手当", "病気で休", "病気 手当", "けがで休"] },
  { when: ["再就職手当"], add: ["再就職", "早期就職"] },
  { when: ["離職票"], add: ["離職", "退職 書類"] },
  { when: ["固定残業"], add: ["みなし残業", "みなし"] },
  { when: ["介護保険"], add: ["介護保険料", "40歳 保険料"] },
  { when: ["任意継続"], add: ["任継", "退職後 健康保険"] },
  { when: ["減価償却"], add: ["償却", "少額 資産", "一括償却"] },
  { when: ["住宅ローン控除", "住宅借入金"], add: ["住宅ローン減税", "ローン控除", "住宅ローン"] },
  { when: ["消費税"], add: ["税込", "税抜", "消費税"] },
  { when: ["端数"], add: ["端数", "切り捨て", "切り上げ", "四捨五入"] },
  { when: ["営業日", "日数計算"], add: ["営業日", "何日", "日数"] },
  { when: ["扶養"], add: ["扶養", "扶養に入る", "年収の壁"] },
  { when: ["出産育児一時金"], add: ["出産一時金", "出産費用", "50万"] },
  { when: ["カナ", "全銀"], add: ["振込 名義", "半角カナ", "カナ変換"] },
];

/** gen_index_sitemap.mjs の CATEGORIES から slug→カテゴリ名を拾う(単一の正本を再利用)。 */
function loadCategories() {
  const map = new Map();
  try {
    const src = readFileSync(join(DOCS, "..", "tools", "gen_index_sitemap.mjs"), "utf8");
    const s = src.indexOf("const CATEGORIES");
    const e = src.indexOf("const STATIC_PAGES");
    if (s === -1 || e === -1) return map;
    const region = src.slice(s, e);
    for (const block of region.split(/\bid:/).slice(1)) {
      const name = block.match(/name:\s*"([^"]+)"/)?.[1];
      const slugsSrc = block.match(/slugs:\s*\[([\s\S]*?)\]/)?.[1] || "";
      const slugs = [...slugsSrc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      if (name) for (const sl of slugs) map.set(sl, name);
    }
  } catch { /* 拾えなければカテゴリは付けない(terms の補助情報にすぎない) */ }
  return map;
}

/** title + answer に同義語 when が含まれていたら add を集める。 */
function synonymsFor(base) {
  const extra = [];
  for (const { when, add } of SYNONYMS) {
    if (when.some((w) => base.includes(w))) extra.push(...add);
  }
  return extra;
}

/** terms 文字列を組み立てる(小文字化・重複や記号は search 側の正規化と揃える)。 */
const buildTerms = (...parts) =>
  parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim();

const catOf = loadCategories();
const entries = [];

// ---- 記事 ----
for (const slug of readdirSync(COLUMN)) {
  const dir = join(COLUMN, slug);
  const f = join(dir, "index.html");
  if (!existsSync(f) || !statSync(dir).isDirectory()) continue;
  if (existsSync(join(dir, ".nopublish"))) continue; // 未公開は索引に載せない
  const html = readFileSync(f, "utf8");
  const title = strip(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const answer = strip(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
  if (!title || !answer) {
    console.error(`✗ ${slug}: h1 か meta description が読めない`);
    process.exit(1);
  }
  // 本文最初の tool-cta の href(class/href の順序どちらでも拾う)を関連ツールにする。
  const ctaTag = html.match(/<a\b[^>]*\btool-cta\b[^>]*>/)?.[0];
  const ctaHref = ctaTag?.match(/href="([^"]+)"/)?.[1] ?? null;
  const tool = ctaHref ? ctaHref.replace(/^(\.\.\/)+/, "/") : null;
  const category = catOf.get(slug) || "";
  const base = `${title} ${answer}`;
  const terms = buildTerms(title, answer, category, ...synonymsFor(base));
  entries.push({ type: "article", url: `/column/${slug}/`, title, answer, tool, terms });
}

// ---- ツール ----
for (const name of readdirSync(DOCS)) {
  if (EXCLUDE_TOP.has(name)) continue;
  const dir = join(DOCS, name);
  const f = join(dir, "index.html");
  if (!existsSync(f) || !statSync(dir).isDirectory()) continue;
  const html = readFileSync(f, "utf8");
  const rawTitle = strip(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
  const title = rawTitle.split(/[｜|]/)[0].trim() || rawTitle; // 「◯◯計算機｜…」の頭を表示名に
  const answer = strip(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
  if (!title || !answer) {
    console.error(`✗ tool ${name}: title か meta description が読めない`);
    process.exit(1);
  }
  const url = `/${name}/`;
  const base = `${rawTitle} ${answer}`;
  const terms = buildTerms(rawTitle, answer, ...synonymsFor(base));
  // ツールは自分自身が「計算ツール」なので tool にも自分を入れ、CTA を出せるようにする。
  entries.push({ type: "tool", url, title, answer, tool: url, terms });
}

// --check の安定のため url で決定的に並べる(索引の順序はマッチングに影響しない)。
entries.sort((a, b) => a.url.localeCompare(b.url));

const json = JSON.stringify(entries, null, 2) + "\n";
const prev = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
const articleN = entries.filter((e) => e.type === "article").length;
const toolN = entries.filter((e) => e.type === "tool").length;

if (prev === json) {
  console.log(`✓ qa_index.json は最新(記事 ${articleN} / ツール ${toolN} = ${entries.length}件)`);
} else if (CHECK) {
  console.error("✗ qa_index.json が古い。node tools/gen_qa_index.mjs を流すこと");
  process.exit(1);
} else {
  writeFileSync(OUT, json);
  console.log(`✓ qa_index.json を生成(記事 ${articleN} / ツール ${toolN} = ${entries.length}件)`);
}
