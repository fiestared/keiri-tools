/**
 * /nenkin/ の静的ページと参照データの突き合わせ。
 *
 * ★なぜ要るのか: 「このツールが計算しない範囲」の一覧は、
 *   **データ（nenkin_r08.json の out_of_scope）と画面（#hani-list）の2箇所**にある。
 *   データ側は fail closed の判定に使われ、画面側は利用者への申告に使われる。
 *   手で2箇所を同期し続ける設計は必ず腐るので、**データを正本にして画面の網羅を機械で見る**。
 *
 *   腐り方は非対称で危険な向きがある:
 *     ・データにあるのに画面に無い → 利用者は「入れていない」ことを知らないまま金額を信じる
 *     ・画面にあるのにデータに無い → 申告だけして判定していない（もっと悪い）
 *   両方向を見る。
 *
 * 実行: node tests/test_nenkin_page.mjs
 */
import { readFileSync } from "node:fs";

const PAGE = readFileSync(new URL("../docs/nenkin/index.html", import.meta.url), "utf8");
const DATA = JSON.parse(readFileSync(new URL("../docs/assets/nenkin_r08.json", import.meta.url), "utf8"));

let pass = 0;
const fails = [];
const t = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`✅ ${name}`); }
  else { fails.push(`${name}${detail ? " — " + detail : ""}`); console.error(`❌ ${name}${detail ? " — " + detail : ""}`); }
};

/** id で名指しした要素の中身を取り出す。同じタグの入れ子を数えて閉じを探す
 *  （★`</b>` で切る素朴な抽出器は、中に <b> がある段落を途中で切って
 *   本文の大半を検査の外に落とす。2026-07-27に7件が同時に素通しした型）。 */
function element(html, id) {
  const open = new RegExp(`<(\\w+)([^>]*\\bid="${id}"[^>]*)>`);
  const m = html.match(open);
  if (!m) return null;
  const tag = m[1];
  let i = m.index + m[0].length;
  let depth = 1;
  const re = new RegExp(`</?${tag}\\b`, "g");
  re.lastIndex = i;
  let x;
  while ((x = re.exec(html))) {
    depth += x[0][1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(i, x.index);
  }
  return null;
}

const visible = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// ── §1 収録範囲外の一覧が、データの out_of_scope を漏れなく載せていること ──────
const list = element(PAGE, "hani-list");
t("§1 #hani-list が取り出せる", !!list);
const listText = visible(list);

for (const o of DATA.out_of_scope) {
  // ラベルは括弧付きの正式名なので、括弧の前までを錨にする（画面では言い回しが少し伸びる）。
  const anchor = o.label.replace(/（.*$/, "").trim();
  t(`§1 収録範囲外「${anchor}」が画面の一覧に載っている`,
    listText.includes(anchor),
    `データ out_of_scope.${o.key} にあるが #hani-list に無い＝利用者に申告していない`);
}

t(`§1 一覧の項目数がデータの件数と一致（${DATA.out_of_scope.length}件）`,
  (list.match(/<li>/g) || []).length === DATA.out_of_scope.length,
  `画面 ${(list.match(/<li>/g) || []).length}件 vs データ ${DATA.out_of_scope.length}件`);

// ── §2 コアが機械判定して金額を止める4件は、画面でもそう明記されていること ────
// （★「入れていない」だけでは、金額が出ないことまでは伝わらない）
for (const key of ["menjo_pre_h21", "kuriage_05", "kurisage_70", "kanyu_kano_tanshuku"]) {
  const o = DATA.out_of_scope.find((x) => x.key === key);
  const anchor = o.label.replace(/（.*$/, "").trim();
  const li = (list.match(/<li>[\s\S]*?<\/li>/g) || []).find((x) => visible(x).includes(anchor));
  t(`§2 「${anchor}」は金額を出さないことが画面に書かれている`,
    !!li && /金額を出しません|金額を出さずに申告/.test(visible(li)),
    "コアは ok:false で止めるのに、画面は『入れていない』としか言っていない");
}

// ── §3 ページに料率・満額を手書きしていないこと（データが正本） ────────────────
// 記事の本文は制度の説明として数字に触れてよいが、**入力欄と結果欄はデータから描く**。
// ここでは「script の中に満額の実額が直書きされていないこと」を見る。
// ★コメントは除いてから見る。**この検査は最初、自分が書いた注意書き
//   （「ページに 0.875 や 5.481 を手書きするな」というコメント）を直書きとして落とした**＝
//   商品ではなく検査の期待値が誤っていた側（規則1）。
//   しかも 7.125 のほうは偶然コメントに出ていなかっただけで**素通しの側にいた**ので、
//   コメントを剥がすと検査そのものも強くなる。
const script = PAGE.slice(PAGE.indexOf('<script type="module">'))
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
for (const m of DATA.kiso.mangaku_yen) {
  t(`§3 満額 ${m.yen} が script に直書きされていない`,
    !script.includes(String(m.yen)),
    "データを差し替えた年に画面だけが古い額を名乗る");
}
for (const j of DATA.kosei.joritsu) {
  t(`§3 乗率 ${j.rate_per_mille} が script に直書きされていない`,
    !script.includes(String(j.rate_per_mille)),
    "乗率はデータから描くこと");
}

// ── §4 FAQ の設問が JSON-LD と本文で一致していること（片方だけ直す事故を防ぐ） ──
const faqLd = PAGE.match(/"@type":\s*"Question",\s*\n\s*"name":\s*"([^"]+)"/g) || [];
const h3 = [...PAGE.matchAll(/<h3>(Q\.[^<]+)<\/h3>/g)].map((x) => x[1].trim());
t(`§4 FAQ の設問数が JSON-LD と本文で一致（${h3.length}件）`,
  faqLd.length === h3.length, `JSON-LD ${faqLd.length}件 vs 本文 ${h3.length}件`);

console.log(`\n${pass} 件成功 / ${fails.length} 件失敗`);
if (fails.length) process.exit(1);
