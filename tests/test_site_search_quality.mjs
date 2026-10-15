/**
 * サイト内検索（ヘッダの検索・トップの質問欄）の**順位の品質**を、固定した正解セットで測って下限を守る。
 *   node tests/test_site_search_quality.mjs          下限の検査
 *   SHOW=30 node tests/test_site_search_quality.mjs  外れを30件表示（直すときに見る）
 *
 * 正解セット: tests/fixtures/site_search_gold.json（作り方は tools/search_gold/build.mjs の冒頭）
 *   - src=gsc   Google 検索で実際に打たれた語と、その語で Google が出した keiri-tools のページ（Clef-flash で検めた）
 *   - src=hand  読み（げんせん）・略語（社保・年調）・誤字（シュミレーション）・言い換えの仕様
 *   - src=ga4-site-search  サイト内検索で実際に打たれた語（2026-07〜10）
 *   split=test だけで測る。split=train は索引に焼き込んだ語なので、測ると水増しになる。
 *
 * 見るもの:
 *   (1) 群ごとの hit@1 / hit@3 / MRR が下限以上（画面に出るのは matched のときだけなので、matched:false は外れと数える）
 *   (2) 焼き込みの漏れが無い: tools/search_queries_gsc.json に split=test の語が入っていない
 *   (3) 正解のページが索引に在る（記事を消した・改名したら、ここで気づく）
 *   (4) 無関係な語に答えない（無関係 59語のうち matched は 2語以下）
 *   (5) 索引の重さの予算（qa_index.json 1,050,000B・gzip 200,000B 以下。開いたときに読むので、太ると初回の検索が遅れる）
 *
 * 下限の根拠（2026-10-14 実測。改善前 → 改善後）:
 *   GSC test 726語: hit@1 0.640→0.802 / hit@3 0.747→0.894 / MRR 0.696→0.850
 *   下限はそれぞれ改善後から 2〜3pt 下に置く（記事が増えて IDF が動く揺れは 1pt 前後だった）。
 *   ★落ちたら、まず SHOW で外れを見る。正解セットのほうが古い（記事の統合・改名）こともある（規則1）。
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { search, normalize } from "../docs/assets/qa_search.js";

const ROOT = new URL("../", import.meta.url).pathname;
const raw = readFileSync(ROOT + "docs/assets/qa_index.json");
const index = JSON.parse(raw);
const byUrl = new Map(index.map((e) => [e.url, e]));
const gold = JSON.parse(readFileSync(ROOT + "tests/fixtures/site_search_gold.json", "utf8")).queries;
const baked = JSON.parse(readFileSync(ROOT + "tools/search_queries_gsc.json", "utf8")).queries;

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? "✅" : "❌"} ${msg}`); if (!c) fails++; };

const FLOORS = {
  gsc: { n: 600, hit1: 0.78, hit3: 0.87, mrr: 0.83 },
  hand: { n: 150, hit1: 0.95, hit3: 0.98, mrr: 0.96 },
  "ga4-site-search": { n: 8, hit1: 0.8, hit3: 0.9, mrr: 0.85 },
};

// (3) 正解のページが索引に在る
const missing = gold.filter((g) => ![g.gold, ...(g.alt || [])].every((u) => byUrl.has(u)));
ok(missing.length === 0, `正解のページが全部索引に在る${missing.length ? `（無い: ${missing.slice(0, 5).map((g) => g.q + "→" + g.gold).join(", ")}）` : ""}`);

// (2) 焼き込みの漏れ
const compact = (q) => normalize(q).replace(/ /g, "");
// 見るのは GSC の評価語だけ。hand（読み・略語の仕様）は tools/search_aliases.json の keys で満たしてよい語なので対象外
const testKeys = new Set(gold.filter((g) => g.split === "test" && g.src === "gsc").map((g) => compact(g.q)));
const leaked = baked.filter((b) => testKeys.has(compact(b.q)));
ok(leaked.length === 0, `索引に焼いた GSC の語に評価用（split=test）の語が無い${leaked.length ? `（漏れ: ${leaked.slice(0, 5).map((b) => b.q).join(", ")}）` : ""}`);

// (1) 群ごとの順位
const groups = {};
const misses = [];
for (const g of gold.filter((x) => x.split === "test")) {
  const want = new Set([g.gold, ...(g.alt || [])]);
  const r = search(index, g.q, 8);
  const urls = r.matched ? r.results.map((e) => e.url) : [];
  const rank = urls.findIndex((u) => want.has(u));
  (groups[g.src] ??= []).push(rank);
  if (rank !== 0) misses.push({ src: g.src, q: g.q, want: g.gold, rank, got: urls.slice(0, 3) });
}
for (const [src, f] of Object.entries(FLOORS)) {
  const a = groups[src] || [];
  const n = a.length;
  const m = {
    hit1: a.filter((r) => r === 0).length / n,
    hit3: a.filter((r) => r >= 0 && r < 3).length / n,
    mrr: a.reduce((s, r) => s + (r >= 0 ? 1 / (r + 1) : 0), 0) / n,
  };
  const fmt = (x) => x.toFixed(3);
  ok(n >= f.n, `${src}: 評価の語が ${n}語（${f.n}語以上。正解セットが壊れていないか）`);
  ok(m.hit1 >= f.hit1 && m.hit3 >= f.hit3 && m.mrr >= f.mrr,
    `${src}: hit@1 ${fmt(m.hit1)}（下限 ${f.hit1}）/ hit@3 ${fmt(m.hit3)}（${f.hit3}）/ MRR ${fmt(m.mrr)}（${f.mrr}）`);
}
if (process.env.SHOW) for (const m of misses.slice(0, +process.env.SHOW)) console.log("   外れ", JSON.stringify(m));

// (1b) 仕組みごとの名指し（★全体の下限は1つの仕組みを外しても緑のままだった＝規則3。2026-10-14 に1つずつ外して確かめた）
//   各行の語は「その仕組みを外すと1位から落ちる」ことを実測で確かめたもの。正解は fixture の行を引く（ここに URL を二重に持たない）。
const PINNED = [
  ["誤字（シュミレーション）", "遺留分 計算 シュミレーション"],
  ["誤字（シュミレーション）", "傷病手当金 計算 シュミレーション"],
  ["添え語（数字・単位）", "4000cc 自動車 税"],
  ["添え語（年）", "確定申告 いつまで 2026"],
  ["添え語（金額）", "月収180万手取り"],
  ["空白で切られた語", "仮 払 消費 税 資産"],
  ["空白で切られた語", "源泉 徴収 簿 書き方"],
  ["計算ツールを先に", "地震 保険 料 控除 計算"],
  ["計算ツールを先に", "生命保険料控除 計算"],
  ["読み（keys）", "げんせん"],
  ["読み（keys）", "ねんちょう"],
  ["略語（keys）", "社保"],
  ["略語（keys）", "年調"],
];
const goldOf = new Map(gold.map((g) => [g.q, g]));
for (const [why, q] of PINNED) {
  const g = goldOf.get(q);
  if (!g) { ok(false, `名指し「${q}」が正解セットに無い（fixture を作り直したら、ここも見直す）`); continue; }
  const r = search(index, q, 8);
  const top = r.matched ? r.results[0]?.url : null;
  ok([g.gold, ...(g.alt || [])].includes(top), `${why}: 「${q}」の1位が ${g.gold}（実際: ${top || "(該当なし)"}）`);
}
// ひらがなだけの語は全部の字を被覆の分母にする（外すと「ありがとう」が登録免許税の計算機を返した）
{ const r = search(index, "ありがとう", 3); ok(!r.matched, `ひらがなだけの無関係な語「ありがとう」に答えない（実際: ${r.results.map((e) => e.url).join(" ") || "(なし)"}）`); }

// (4) 無関係な語
const NEGATIVE = ["今日の天気", "おすすめの映画", "旅行の予約", "宇宙旅行の予約方法", "カレーの作り方", "カレーの作り方の方法",
  "おすすめの映画の見方", "引っ越しの方法を教えて", "英会話の勉強の方法", "筋トレの効果的なやり方", "ダイエットの方法を教えてください",
  "引っ越しの見積もりの取り方", "スマホの機種変更の方法", "車の保険の選び方", "犬のしつけの仕方", "ゲームの攻略方法", "髪型の変え方",
  "家の掃除のコツ", "結婚式の準備の進め方", "資格の勉強時間の目安", "野球の試合の結果を教えて", "恋愛の相談にのってください",
  "英語の勉強のやり方を知りたい", "ラーメンのおいしい店の探し方", "東京 天気 明日", "大阪 ラーメン おすすめ", "2026年 ワールドカップ 日程",
  "iphone 17 値段", "ポケモン 攻略", "京都 紅葉 見頃", "新幹線 予約 方法", "ディズニー チケット 値段", "猫 餌 おすすめ", "ユニクロ セール いつ",
  "北海道 旅行 3泊", "パソコン 選び方", "カメラ 比較 2026", "Netflix おすすめ 映画", "ガンダム プラモデル", "プロ野球 順位", "子供 習い事 人気",
  "ワイン 選び方", "キャンプ 道具 一覧", "ヨガ 効果", "転職 面接 質問", "寿司 美味しい店 銀座", "AirPods 充電", "エアコン 掃除 やり方",
  "梅干し 作り方", "マラソン 練習 メニュー", "ピアノ 独学", "ゴルフ スコア 100切り", "洗濯機 おすすめ 2026", "スニーカー サイズ 選び方",
  "韓国 旅行 費用", "ハワイ 物価", "花粉症 薬 市販", "歯医者 痛くない", "髪 ブリーチ 自分で"];
const fp = NEGATIVE.filter((q) => search(index, q, 3).matched);
ok(fp.length <= 2, `無関係な ${NEGATIVE.length}語のうち答えてしまうのは ${fp.length}語（2語以下）${fp.length ? `: ${fp.join(" / ")}` : ""}`);

// (5) 重さ
const gz = gzipSync(raw).length;
ok(raw.length <= 1_050_000 && gz <= 200_000, `qa_index.json ${raw.length.toLocaleString()}B・gzip ${gz.toLocaleString()}B（1,050,000B・200,000B 以下）`);

console.log(fails ? `\n❌ ${fails}件 失敗` : "\nsite search quality ok");
process.exit(fails ? 1 : 0);
