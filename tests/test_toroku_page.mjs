/**
 * /toroku-menkyozei/ の静的ページと参照データの突き合わせ。
 *
 * ★なぜ要るのか: このツールの急所は**期限が2つ別々にある**ことで、
 *   その2つの日付は **データ（toroku_jutaku_r08.json）と記事本文の2箇所**にある。
 *   データ側は計算の判定に使われ、本文側は読者への説明に使われる。
 *   手で2箇所を同期し続ける設計は必ず腐るので、**データを正本にして本文を機械で見る**。
 *
 *   腐り方は非対称で、危険な向きがある:
 *     ・データが延長されたのに本文が古い → 読者は「もう使えない」と誤解して諦める
 *     ・本文が新しいのにデータが古い → 計算が本則で出る（軽減を受けられる人に高い額を出す）
 *   どちらも「片方だけ直す」で起きるので、両方を1つの検査に縛る。
 *
 * 実行: node tests/test_toroku_page.mjs
 */
import { readFileSync } from "node:fs";

const PAGE = readFileSync(new URL("../docs/toroku-menkyozei/index.html", import.meta.url), "utf8");
const DATA = JSON.parse(readFileSync(new URL("../docs/assets/toroku_jutaku_r08.json", import.meta.url), "utf8"));

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
  const i = m.index + m[0].length;
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

// ── §1 script に期限・税率・要件を直書きしていないこと（データが正本） ──────────
// 記事の本文は制度の説明として数字に触れてよい（§2で逆にデータとの一致を見る）。
// ここで見るのは**画面を描くコード**が自分で数字を持っていないこと。
// ★コメント行は除いてから見る（自分の注意書きを「直書き」と誤判定するのは検査の誤り＝規則1。
//   2026-07-29 に /nenkin/ で実際にやった）。
const script = PAGE.slice(PAGE.indexOf('<script type="module">'))
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

const K = DATA.keigen, Y = DATA.yoken, M = DATA._meta;
const forbidden = [
  // 期限（ISO と和暦の両方。片方だけ直す事故を防ぐ）
  K.jutaku_kigen, K.jutaku_kigen_hyoji,
  K.tochi_baibai.kigen, K.tochi_baibai.kigen_hyoji,
  M.applies_from, M.applies_from_hyoji,
  // 中古の建築日の基準
  Y.chuko_kenchiku_kijun_bi, Y.chuko_kenchiku_kijun_hyoji,
  // 税率（生の小数）
  ...[
    DATA.honsoku.hozon.ritsu, DATA.honsoku.iten_sonota.ritsu, DATA.honsoku.teitoken.ritsu,
    K.tochi_baibai.ritsu, K.jutaku_hozon.ritsu, K.jutaku_iten.ritsu, K.jutaku_teitoken.ritsu,
    K.chouki_yuryo.iten_kodate_ritsu, K.tei_tanso.iten_ritsu, K.kaitori_hanbai.iten_ritsu,
  ].map(String),
];
for (const v of new Set(forbidden)) {
  // 数字は前後を非数字で挟んで見る（"0.001" が "0.0015" に当たって誤検出しないため）。
  const re = /^[\d.]+$/.test(v)
    ? new RegExp(`(^|[^\\d.])${v.replace(/\./g, "\\.")}([^\\d]|$)`)
    : null;
  const hit = re ? re.test(script) : script.includes(v);
  t(`§1 「${v}」が script に直書きされていない`, !hit,
    "データを差し替えた年に画面だけが古い値を名乗る");
}
// 逆向き（規則1）: データから描いていることの確認。描いていなければ§1は無意味に緑になる。
t("§1 script が期限をデータのキーから読んでいる",
  /kigen_hyoji/.test(script) && /applies_from_hyoji/.test(script));
t("§1 script が税率をデータのキーから読んでいる",
  /iten_kodate_ritsu/.test(script) && /jutaku_iten/.test(script));
t("§1 script が中古の基準日をデータのキーから読んでいる",
  /chuko_kenchiku_kijun_hyoji/.test(script));

// ── §2 記事本文の2つの期限が、データの期限と一致していること ────────────────
// ★主張が1回しか現れない最小の要素まで下ろして名指しする（規則5）。
const kigenHonbun = visible(element(PAGE, "kigen-honbun"));
t("§2 #kigen-honbun が取り出せる", !!kigenHonbun);
t(`§2 本文が土地の期限（${K.tochi_baibai.kigen_hyoji}）を正しく書いている`,
  kigenHonbun.includes(K.tochi_baibai.kigen_hyoji),
  `本文: ${kigenHonbun.slice(0, 120)}`);
t(`§2 本文が住宅の期限（${K.jutaku_kigen_hyoji}）を正しく書いている`,
  kigenHonbun.includes(K.jutaku_kigen_hyoji),
  `本文: ${kigenHonbun.slice(0, 120)}`);
// 2つが**別の日**であること自体が本文の主張なので、そこも縛る。
t("§2 データ上も2つの期限は別の日（同じになったら本文の『2年ずれ』が嘘になる）",
  K.tochi_baibai.kigen !== K.jutaku_kigen);
// hero（画面の一番上）にも両方出ていること。冒頭だけ古いという腐り方を防ぐ。
const hero = visible(element(PAGE, "hero-kigen"));
t("§2 hero が「期限は2つ」と申告している", /2つ/.test(hero || ""), `hero: ${hero}`);

// ★title と meta description の期限も、データと突き合わせる。
//   この2つは SEO のため静的HTMLに書くしかなく（CLAUDE.md）、test_year_staleness では
//   HISTORICAL_FACTS で免除している。**免除した分の保証をここで引き取る**——
//   免除は「チェックしない」ではなく「別のもっと厳しいチェックが見ている」でなければならない。
const eraYear = (hyoji) => (hyoji.match(/^令和\d+年/) || [""])[0];
const title = (PAGE.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
const desc = (PAGE.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
for (const [name, hyoji] of [["土地", K.tochi_baibai.kigen_hyoji], ["住宅", K.jutaku_kigen_hyoji]]) {
  const y = eraYear(hyoji);
  t(`§2 title が${name}の期限の年（${y}）をデータどおり書いている`,
    title.includes(y), `title: ${title}`);
  t(`§2 meta description が${name}の期限（${hyoji}）をデータどおり書いている`,
    desc.includes(hyoji), `description の先頭: ${desc.slice(0, 80)}`);
}

// ── §3 認定住宅の表が、データの税率と一致していること ──────────────────────
// ★長期優良の移転（一戸建て0.2%）と低炭素（一戸建てでも0.1%）の取り違えが、
//   この表と実装で別々に起こりうる。行を名指しして両方を縛る。
const ninteiTable = element(PAGE, "nintei-table");
t("§3 #nintei-table が取り出せる", !!ninteiTable);
const rows = (ninteiTable || "").match(/<tr>[\s\S]*?<\/tr>/g) || [];
const pctOf = (r) => (r * 100).toFixed(2).replace(/\.?0+$/, "") + "%";
const chokiRow = rows.find((r) => visible(r).includes("特定認定長期優良住宅"));
const tansoRow = rows.find((r) => visible(r).includes("認定低炭素住宅"));
t("§3 長期優良の行が特定できる", !!chokiRow);
t("§3 低炭素の行が特定できる", !!tansoRow);
// 一戸建ての移転は最後のセル。長期優良だけ 0.2%。
const lastCell = (row) => {
  const cells = (row || "").match(/<td>[\s\S]*?<\/td>/g) || [];
  return visible(cells[cells.length - 1]);
};
t(`§3 長期優良・一戸建ての移転が ${pctOf(K.chouki_yuryo.iten_kodate_ritsu)}`,
  lastCell(chokiRow) === pctOf(K.chouki_yuryo.iten_kodate_ritsu),
  `表: ${lastCell(chokiRow)} / データ: ${pctOf(K.chouki_yuryo.iten_kodate_ritsu)}`);
t(`§3 低炭素・一戸建ての移転が ${pctOf(K.tei_tanso.iten_ritsu)}`,
  lastCell(tansoRow) === pctOf(K.tei_tanso.iten_ritsu),
  `表: ${lastCell(tansoRow)} / データ: ${pctOf(K.tei_tanso.iten_ritsu)}`);
t("§3 データ上も両者は別の率（同じになったら表の対比が嘘になる）",
  K.chouki_yuryo.iten_kodate_ritsu !== K.tei_tanso.iten_ritsu);
// 「低炭素に一戸建ての区別が無い」ことも縛る（無いことを検査する）。
t("§3 低炭素に一戸建ての別税率がデータに無い",
  K.tei_tanso.iten_kodate_ritsu === undefined);

// ── §4 取得の原因の食い違い（競落）が本文で名指しされていること ────────────────
const geninHitaisho = visible(element(PAGE, "genin-hitaisho"));
t("§4 競落の食い違いが本文にある", /競落/.test(geninHitaisho || "") && /売買/.test(geninHitaisho || ""),
  "土地は1.5%が使えず建物は0.3%が使える、という非対称を書いていない");
// 画面の選択肢に、データが認める原因が両方出ていること（片方しか選べなければ判定できない）。
for (const g of Y.gen_in) {
  t(`§4 取得の原因「${g}」が選択肢にある`,
    new RegExp(`<option value="${g}"`).test(PAGE),
    "データが軽減を認める原因が画面から選べない＝利用者は自分の場合に辿り着けない");
}

// ── §5 相続は計算せず、別ツールへ案内していること ────────────────────────────
// ★見出しと理由は**別の要素**を読む（規則5）。最初この検査は見出しの <b> だけを名指しし、
//   税率は親の div に書かれていたので落ちた＝名指しの粒度が主張に届いていなかった側。
const sozoku = visible(element(PAGE, "sozoku-annai"));
const sozokuZeiritsu = visible(element(PAGE, "sozoku-zeiritsu"));
t("§5 相続は計算しないと本文で申告している", /計算しません/.test(sozoku || ""));
t("§5 相続の本則税率（1000分の4）を書いている", /1000分の4/.test(sozokuZeiritsu || ""));
t("§5 その他の移転（1000分の20）を当てると誤ることも書いている",
  /1000分の20/.test(sozokuZeiritsu || ""));
t("§5 相続登記の計算機へのリンクがある",
  /href="\.\.\/sozoku-toki-menkyozei\/"/.test(PAGE));

// ── §6 出典に、コアが根拠にしている法令が全部載っていること ────────────────────
const shutten = visible(element(PAGE, "shutten") ? PAGE.slice(PAGE.indexOf('<h2 id="shutten">')) : "");
for (const law of ["登録免許税法", "租税特別措置法", "租税特別措置法施行令", "国税通則法"]) {
  t(`§6 出典に「${law}」がある`, shutten.includes(law));
}
// ★国税庁の税額表は「期限が古い」ことまで書いてあること（オラクルとして使った一方で、
//   期限は信じていないという非対称を読者に伝える）。
t("§6 国税庁の税額表が古いままであることを出典で申告している",
  /令和7年4月1日現在/.test(shutten));

// ── §7 FAQ の設問が JSON-LD と本文で一致していること（片方だけ直す事故を防ぐ） ──
const faqLd = PAGE.match(/"@type":\s*"Question",\s*\n\s*"name":\s*"([^"]+)"/g) || [];
const h3 = [...PAGE.matchAll(/<h3>(Q\.[^<]+)<\/h3>/g)].map((x) => x[1].trim());
t(`§7 FAQ の設問数が JSON-LD と本文で一致（${h3.length}件）`,
  faqLd.length === h3.length && h3.length > 0, `JSON-LD ${faqLd.length}件 vs 本文 ${h3.length}件`);

console.log(`\n${pass} 件成功 / ${fails.length} 件失敗`);
if (fails.length) process.exit(1);
