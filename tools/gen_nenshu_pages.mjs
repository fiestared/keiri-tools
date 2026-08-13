/**
 * 年収別のページを生成する（手取り25本 + 住民税25本 = 50本）。
 *
 * なぜ作るか（2026-08-05 の競合リサーチ）:
 * 新規ドメインの keisanbox.jp が、年収別の静的ページ群で「住民税 計算」等に露出していた。
 * 検索は「年収500万 手取り」のように**具体的な数字つき**で来るのに、
 * 当サイトは計算機1本で受けていて、その語で受ける面が無かった。
 *
 * ★薄いページを量産しない。1ページごとに**実際に違う答え**を載せる:
 *   - その年収の手取り／住民税を、計算コアからその場で算出する
 *   - **前後の年収との差**（50万円増えると手取りはいくら増えるか）を出す。ここが1ページ1答え
 *   - 内訳（所得税・住民税・健康保険・厚生年金・雇用保険）まで出す
 * 数字はこのファイルにベタ書きしない。すべて docs/assets の計算コアから計算する。
 *
 *   node tools/gen_nenshu_pages.mjs           生成
 *   node tools/gen_nenshu_pages.mjs --check   差分があれば失敗（CI/テスト用）
 *
 * 前提（ページにも明記する）: 東京都・40歳・独身・扶養なし・給与収入のみ・
 * 社会保険料は協会けんぽ東京都の料率による概算。令和8年分の所得。
 */
// ★ナビは tools/gen_nav.mjs が唯一の出所。ここに直書きすると、この生成器を
//   流すたびにナビが古い形へ戻る（X導線で同じ事故が起きている。下のコメント参照）。
import { buildHeader } from './gen_nav.mjs';

// ★年収別ページはすべて nenshu/<slug>/ で深さが同じなので、ナビは1つで足りる。
//   代表の slug で作る（現在地の印は「ツール」も「コラム」も付かない階層）。
const NENSHU_HEADER = buildHeader('nenshu/x');
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");

const { calc, shakaiHokenGaisan } = await import(join(DOCS, "assets/juminzei_core.js"));
const D = JSON.parse(readFileSync(join(DOCS, "assets/juminzei_r08.json"), "utf8"));
const S = JSON.parse(readFileSync(join(DOCS, "assets/shaho_rates_r08.json"), "utf8"));

const AGE = 40, KEN = "東京都", JICHITAI = "tokyo23", KYUCHI = "1";
/** 年収200万〜800万を25万円刻み（25点）。検索される帯に合わせている */
const INCOMES = Array.from({ length: 25 }, (_, i) => 2_000_000 + i * 250_000);

const yen = (n) => Math.round(n).toLocaleString("ja-JP");
const man = (n) => `${n / 10000}万円`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** その年収の実額を計算する。★数字の出所はここだけ */
function figures(shunyu) {
  const g = shakaiHokenGaisan(shunyu, AGE, KEN, S);
  const r = calc({
    kyuyoShunyu: shunyu, shakaiHoken: g.total, family: { haigusha: "none" },
    jichitai: JICHITAI, kyuchi: KYUCHI, zeisei: "r8",
  }, D);
  return {
    shunyu,
    shakai: g.total, kenkoKaigo: g.kenkoKaigoKosodate, kosei: g.kosei, koyou: g.koyou,
    juminzei: r.juminzeiTotal, shotokuwari: r.shotokuwariJissai, kintouwari: r.kintouwari.total,
    kyuyoShotoku: r.kyuyoShotoku, kazei: r.kazeiSoShotoku,
    hikazei: r.hikazei.kintouwariHikazei && r.hikazei.shotokuwariHikazei,
  };
}

const rows = INCOMES.map(figures);
const byIncome = new Map(rows.map((f) => [f.shunyu, f]));

/**
 * @param noindex **Googleにだけ**索引させないか。個別50ページは true、一覧は false。
 *
 * ★なぜ Google だけ外すか（2026-08-06）
 *   このディレクトリは同一テンプレで数字だけが違う50ページで、Googleの
 *   「スケールされたコンテンツの悪用」の型に当てはまる。2026-07-22 の AdSense 却下
 *   （有用性の低いコンテンツ）で挙がった原因のひとつがこのパターンだった。
 *   ★実測(GSC 2026-07-06〜08-03): **この50ページは1ページも表示を獲得していない。**
 *     Googleは既にクロールしたうえで索引していない＝Google向けには何も生んでいない。
 *     外しても失うものが無い一方、審査では不利に働く。
 *   ★Bingは主要な流入元（keiri-tools の流入はBing主力）なので絶対に止めない。
 *     だから `robots` ではなく `googlebot` 指定。**robots 全体に noindex を付けないこと。**
 *   ★一覧（/nenshu/）は残す。50行を1枚で比較できる実データのページで、薄い個別ページとは別物。
 *     ここを一緒に外すと、このディレクトリで唯一Googleに出す価値のあるページまで消える。
 *
 *   厚くする／1ページに統合する等で価値が出せたら、この指定を消して再度Googleに出す。
 */
const HEAD = (title, desc, canonical, noindex = true) => `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<!-- favicon:auto -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="googlebot" content="noindex, follow">' : ""}
<link rel="stylesheet" href="../../assets/style.css">
<link rel="canonical" href="${canonical}">
<!-- Google Analytics (GA4) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-E742DSDHPD"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-E742DSDHPD');
</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2635067516563578"
     crossorigin="anonymous"></script>
</head>
<body>
${NENSHU_HEADER}
<main>`;

// ★X への導線をここに持つ（2026-08-06）。
//   元は無く、`tools/gen_x_link.mjs` を後から流して足す運用になっていた。
//   そのため**このファイルを再生成するたびに導線が消え、test_x_link が赤になる**。
//   実測: 生成 → test_x_link 緑 → 再生成 → 赤、を確認して直した。
//   x-link:auto の印は gen_x_link.mjs が「既に入っている」と判定するための目印なので必ず残す
//   （消すと二重に挿入される）。
const FOOT = `</main>
<footer class="site"><div><a href="/about/">運営者</a>／<a href="/privacy/">プライバシー</a>／<a href="/contact/">お問い合わせ</a></div><div class="copy">© 税金・経理・補助金ツールズ</div>
  <!-- x-link:auto --><div style="margin-top:6px;font-size:12px;color:var(--sub)">法改定は施行日に反映しています。更新の通知 → <a href="https://x.com/keiri_tools" rel="me noopener" style="color:var(--sub)">@keiri_tools</a></div>
</footer>
</body>
</html>
`;

/** 前後の年収との差。★1ページ1答えの核 */
function neighbours(f) {
  const prev = byIncome.get(f.shunyu - 250_000);
  const next = byIncome.get(f.shunyu + 250_000);
  return { prev, next };
}

function tedoriOf(f) {
  // このページで言う「手取り」は 年収 −（社会保険料＋住民税）。所得税は別ツールで扱う旨を明記する
  return f.shunyu - f.shakai - f.juminzei;
}

function pageTedori(f) {
  const { prev, next } = neighbours(f);
  const t = tedoriOf(f);
  const title = `年収${man(f.shunyu)}の手取りは？住民税と社会保険料の内訳（東京都・独身）`;
  const desc = `年収${man(f.shunyu)}（東京都・40歳・独身）の社会保険料は約${yen(f.shakai)}円、住民税は${yen(f.juminzei)}円。`
    + `差し引くと約${yen(t)}円です。${next ? `年収が25万円増えると手取りは${yen(tedoriOf(next) - t)}円増えます。` : ""}内訳と計算根拠つき。`;
  const canonical = `https://keiri-tools.com/nenshu/${f.shunyu / 10000}man-tedori/`;
  return HEAD(title, desc, canonical) + `
<nav class="breadcrumb">ホーム › 年収別 › 年収${man(f.shunyu)}の手取り</nav>
<article>
<h1>年収${man(f.shunyu)}の手取りはいくら？</h1>
<p class="article-meta">令和8年分の所得・東京都・40歳・独身（扶養なし）・給与収入のみで計算／数字は当サイトの計算コアから算出</p>

<p>年収${man(f.shunyu)}（東京都・40歳・独身）の場合、<b>社会保険料が約${yen(f.shakai)}円</b>、<b>住民税が${yen(f.juminzei)}円</b>です。
年収からこの2つを引くと<b>約${yen(t)}円</b>になります（所得税は別途かかります）。</p>

<table>
<tr><th>項目</th><th style="text-align:right">年額</th></tr>
<tr><td>給与収入</td><td style="text-align:right">${yen(f.shunyu)}円</td></tr>
<tr><td>健康保険・介護保険・子ども子育て拠出</td><td style="text-align:right">− ${yen(f.kenkoKaigo)}円</td></tr>
<tr><td>厚生年金</td><td style="text-align:right">− ${yen(f.kosei)}円</td></tr>
<tr><td>雇用保険</td><td style="text-align:right">− ${yen(f.koyou)}円</td></tr>
<tr><td>住民税（所得割＋均等割・森林環境税）</td><td style="text-align:right">− ${yen(f.juminzei)}円</td></tr>
<tr style="font-weight:700"><td>差引</td><td style="text-align:right">${yen(t)}円</td></tr>
</table>
<p class="note">所得税はこの表に含めていません（扶養や各種控除で人により大きく変わるためです）。所得税まで含めた手取りは<a href="../../tedori/">手取り計算機</a>で計算できます。</p>

<h2>年収が25万円増えると、手取りはいくら増えるか</h2>
${next ? `<p>年収を${man(f.shunyu)}から<b>${man(next.shunyu)}</b>に上げると、上の差引額は
<b>${yen(tedoriOf(next) - t)}円</b>増えます（増えた年収25万円のうち、<b>${yen(250_000 - (tedoriOf(next) - t))}円</b>が
社会保険料と住民税の増加分です）。</p>` : `<p>この表の上限のため、次の年収との比較は省略します。</p>`}
${prev ? `<p>逆に${man(prev.shunyu)}と比べると、差引額は<b>${yen(t - tedoriOf(prev))}円</b>多くなっています。</p>` : ""}

<table>
<tr><th>年収</th><th style="text-align:right">社会保険料</th><th style="text-align:right">住民税</th><th style="text-align:right">差引</th></tr>
${[prev, f, next].filter(Boolean).map((x) => `<tr${x.shunyu === f.shunyu ? ' style="font-weight:700;background:#eef6f3"' : ""}><td>${man(x.shunyu)}</td><td style="text-align:right">${yen(x.shakai)}円</td><td style="text-align:right">${yen(x.juminzei)}円</td><td style="text-align:right">${yen(tedoriOf(x))}円</td></tr>`).join("\n")}
</table>

<a class="tool-cta" href="../../tedori/">自分の条件（扶養・年齢・都道府県）で手取りを計算する</a>

<h2>この計算の前提</h2>
<ul>
<li>東京都・40歳・独身（扶養なし）・給与収入のみ・賞与なしとして年収を12等分</li>
<li>社会保険料は協会けんぽ東京都の料率による<b>概算</b>です。実際は標準報酬月額の等級で決まります</li>
<li>住民税は令和8年分の所得にもとづく計算（＝令和9年度に納める住民税）。均等割は標準税率</li>
<li>所得税は含めていません</li>
</ul>

<section class="related">
<div class="tool-grid">
<a class="tool-card" href="../../tedori/"><b>手取り計算機</b><span>所得税まで含めて計算します</span></a>
<a class="tool-card" href="../../juminzei/"><b>住民税 計算機</b><span>所得割・均等割の内訳を出します</span></a>
<a class="tool-card" href="../${f.shunyu / 10000}man-juminzei/"><b>年収${man(f.shunyu)}の住民税</b><span>住民税だけを詳しく</span></a>
</div>
</section>

<p class="note">この計算は一般的な条件による目安であり、個別の税額を保証するものではありません。実際の金額はお住まいの市区町村・勤務先の給与担当にご確認ください。</p>
</article>
` + FOOT;
}

function pageJuminzei(f) {
  const { prev, next } = neighbours(f);
  const title = `年収${man(f.shunyu)}の住民税はいくら？所得割と均等割の内訳（東京都・独身）`;
  const desc = `年収${man(f.shunyu)}（東京都・40歳・独身）の住民税は年${yen(f.juminzei)}円、月あたり約${yen(f.juminzei / 12)}円。`
    + `所得割${yen(f.shotokuwari)}円＋均等割${yen(f.kintouwari)}円の内訳と、課税所得の求め方まで。`;
  const canonical = `https://keiri-tools.com/nenshu/${f.shunyu / 10000}man-juminzei/`;
  return HEAD(title, desc, canonical) + `
<nav class="breadcrumb">ホーム › 年収別 › 年収${man(f.shunyu)}の住民税</nav>
<article>
<h1>年収${man(f.shunyu)}の住民税はいくら？</h1>
<p class="article-meta">令和8年分の所得にもとづく計算（＝令和9年度に納める住民税）／東京都23区・40歳・独身（扶養なし）／数字は当サイトの計算コアから算出</p>

${f.hikazei
  ? `<p>年収${man(f.shunyu)}（東京都23区・独身）は<b>住民税が非課税</b >です。所得が非課税限度額以下のため、所得割・均等割ともにかかりません。</p>`
  : `<p>年収${man(f.shunyu)}（東京都23区・40歳・独身）の住民税は、<b>年 ${yen(f.juminzei)}円</b>です。月あたりにすると約 ${yen(f.juminzei / 12)}円になります。</p>`}

<table>
<tr><th>項目</th><th style="text-align:right">金額</th></tr>
<tr><td>給与収入</td><td style="text-align:right">${yen(f.shunyu)}円</td></tr>
<tr><td>給与所得（給与所得控除後）</td><td style="text-align:right">${yen(f.kyuyoShotoku)}円</td></tr>
<tr><td>社会保険料控除（概算）</td><td style="text-align:right">− ${yen(f.shakai)}円</td></tr>
<tr><td>課税総所得（住民税）</td><td style="text-align:right">${yen(f.kazei)}円</td></tr>
<tr><td>所得割</td><td style="text-align:right">${yen(f.shotokuwari)}円</td></tr>
<tr><td>均等割・森林環境税</td><td style="text-align:right">${yen(f.kintouwari)}円</td></tr>
<tr style="font-weight:700"><td>住民税の年額</td><td style="text-align:right">${yen(f.juminzei)}円</td></tr>
</table>

<h2>前後の年収と比べる</h2>
<table>
<tr><th>年収</th><th style="text-align:right">課税総所得</th><th style="text-align:right">住民税</th></tr>
${[prev, f, next].filter(Boolean).map((x) => `<tr${x.shunyu === f.shunyu ? ' style="font-weight:700;background:#eef6f3"' : ""}><td>${man(x.shunyu)}</td><td style="text-align:right">${yen(x.kazei)}円</td><td style="text-align:right">${yen(x.juminzei)}円</td></tr>`).join("\n")}
</table>
${next ? `<p>年収が25万円増えると、住民税は<b>${yen(next.juminzei - f.juminzei)}円</b>増えます。住民税の所得割は原則10%なので、増えた課税所得のおよそ1割が住民税の増加になります。</p>` : ""}

<a class="tool-cta" href="../../juminzei/">自分の条件（扶養・自治体・社会保険料の実額）で住民税を計算する</a>

<h2>この計算の前提</h2>
<ul>
<li>東京都23区（1級地）・40歳・独身（扶養なし）・給与収入のみ</li>
<li>社会保険料は協会けんぽ東京都の料率による<b>概算</b>。源泉徴収票の「社会保険料等の金額」を使うと正確になります</li>
<li>住民税の税率は標準税率（市町村民税6%・道府県民税4%）。超過課税のある自治体では数百円変わります</li>
<li>令和8年分の所得にもとづく計算です（住民税は前年の所得で決まるため、納めるのは令和9年度）</li>
</ul>

<section class="related">
<div class="tool-grid">
<a class="tool-card" href="../../juminzei/"><b>住民税 計算機</b><span>自治体・家族構成を指定して計算</span></a>
<a class="tool-card" href="../${f.shunyu / 10000}man-tedori/"><b>年収${man(f.shunyu)}の手取り</b><span>社会保険料まで含めた差引額</span></a>
<a class="tool-card" href="../../column/juminzei-hikazei-border/"><b>非課税のボーダー</b><span>1円超えるといくら損するか</span></a>
</div>
</section>

<p class="note">この計算は一般的な条件による目安であり、個別の税額を保証するものではありません。実際の税額は市区町村から届く通知書でご確認ください。</p>
</article>
` + FOOT;
}

let written = 0;
const slugs = [];
for (const f of rows) {
  for (const [suffix, html] of [["tedori", pageTedori(f)], ["juminzei", pageJuminzei(f)]]) {
    const slug = `${f.shunyu / 10000}man-${suffix}`;
    slugs.push(slug);
    const dir = join(DOCS, "nenshu", slug);
    const file = join(dir, "index.html");
    const before = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (before === html) continue;
    if (CHECK) { console.error(`✗ 年収別ページが最新ではない: nenshu/${slug}/`); process.exit(1); }
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, html);
    written++;
  }
}

// 一覧ページ（回遊とクロールの入口。sitemap にも載せる）
const indexHtml = HEAD(
  "年収別の手取り・住民税の早見表｜税金・経理・補助金ツールズ",
  "年収200万円から800万円まで25万円刻みで、手取り（社会保険料・住民税を引いた額）と住民税の内訳を計算しました。東京都・40歳・独身の条件で、前後の年収との差も出しています。",
  "https://keiri-tools.com/nenshu/",
  false,   // ★一覧はGoogleにも出す（50行を1枚で比較できる実データ。薄い個別ページとは別物）
).replace('href="../../', 'href="../').replace(/href="\.\.\/\.\.\//g, 'href="../') + `
<nav class="breadcrumb">ホーム › 年収別</nav>
<article>
<h1>年収別の手取り・住民税</h1>
<p class="article-meta">令和8年分の所得・東京都・40歳・独身（扶養なし）・給与収入のみで計算</p>
<p>年収200万円から800万円まで25万円刻みで、<b>社会保険料と住民税を引いた差引額</b>と<b>住民税の内訳</b>を計算しました。数字はすべて当サイトの計算コアから算出しています。</p>
<div class="scroll-wrap">
<table>
<tr><th>年収</th><th style="text-align:right">社会保険料</th><th style="text-align:right">住民税</th><th style="text-align:right">差引</th><th>ページ</th></tr>
${rows.map((f) => `<tr><td>${man(f.shunyu)}</td><td style="text-align:right">${yen(f.shakai)}円</td><td style="text-align:right">${yen(f.juminzei)}円</td><td style="text-align:right">${yen(tedoriOf(f))}円</td><td><a href="${f.shunyu / 10000}man-tedori/">手取り</a>／<a href="${f.shunyu / 10000}man-juminzei/">住民税</a></td></tr>`).join("\n")}
</table>
</div>
<p class="note">所得税は含めていません（扶養や控除で人により変わるため）。所得税まで含めた計算は<a href="../tedori/">手取り計算機</a>をお使いください。</p>
</article>
` + FOOT;
const idxFile = join(DOCS, "nenshu", "index.html");
if (!existsSync(idxFile) || readFileSync(idxFile, "utf8") !== indexHtml) {
  if (CHECK) { console.error("✗ 年収別の一覧が最新ではない"); process.exit(1); }
  mkdirSync(join(DOCS, "nenshu"), { recursive: true });
  writeFileSync(idxFile, indexHtml);
  written++;
}

console.log(CHECK ? "✓ 年収別ページは最新" : `✓ 年収別ページを生成: ${written}ファイル（${slugs.length}ページ＋一覧）`);
