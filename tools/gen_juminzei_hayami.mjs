/**
 * 住民税の早見表（年収別・令和8年度）を、正本 JSON から生成する。
 *
 * 正本（手で数字を書かない）:
 *   - docs/assets/juminzei_hayami_r08.json … 前提（地域・年齢・社会保険の料率・年収の刻み・家族構成）
 *   - docs/assets/juminzei_r08.json        … 住民税の税率・控除・非課税限度額（/juminzei/ 計算機と同じ正本）
 *   - docs/assets/shaho_rates_r08.json     … 協会けんぽの都道府県料率（令和7年度の率 = kenko_rates_prev）
 * 計算は docs/assets/juminzei_core.js の calc（既定＝令和7年分の所得＝令和8年度の住民税）に任せる。
 * 同じ計算を2つ作らない。tests/test_juminzei_hayami.mjs は core を使わずに独立に計算し直して一致を固定する。
 *
 * 生成するもの（docs/column/juminzei-hayamihyo/index.html の <!--jh:*:S-->〜<!--jh:*:E--> の中身と CSV）:
 *   lead    … 冒頭の結論（年収300万・500万・700万円の独身の年額）
 *   table   … 年収別の早見表（独身・配偶者あり。年額と特別徴収の月額）
 *   figure  … 年収と住民税の折れ線（インラインSVG）
 *   rei     … 計算の流れ（年収500万円・独身）
 *   hikazei … 非課税になる年収の上限（独身・配偶者あり）
 *   dataset … Dataset の JSON-LD
 *   CSV     … juminzei-hayamihyo-r08.csv（UTF-8 BOM・CRLF）
 *
 *   node tools/gen_juminzei_hayami.mjs          生成（冪等）
 *   node tools/gen_juminzei_hayami.mjs --check  差分があれば失敗
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calc } from "../docs/assets/juminzei_core.js";
import { calcMonthly, calcKoyou } from "../docs/assets/shaho_core.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SLUG = "juminzei-hayamihyo";
export const PAGE = join(ROOT, `docs/column/${SLUG}/index.html`);
export const CSV_NAME = "juminzei-hayamihyo-r08.csv";
export const CSV = join(ROOT, `docs/column/${SLUG}/${CSV_NAME}`);
const URL_PAGE = `https://keiri-tools.com/column/${SLUG}/`;
const CHECK = process.argv.includes("--check");

export function loadData() {
  const rd = (p) => JSON.parse(readFileSync(join(ROOT, "docs/assets", p), "utf8"));
  return { H: rd("juminzei_hayami_r08.json"), D: rd("juminzei_r08.json"), S: rd("shaho_rates_r08.json") };
}

const n = (v) => v.toLocaleString("ja-JP");
const man = (y) => (y % 10000 === 0 ? `${n(y / 10000)}万円` : `${n(y)}円`);
const tok = (v) => `<span class="numeric-token">${v}</span>`;

export function incomes(H) {
  const out = [];
  for (const r of H.incomes) for (let y = r.from; y <= r.to; y += r.step) out.push(y);
  return out;
}

/** 前提の社会保険料（本人負担・年額）。賞与なし・年収を12等分した月給で標準報酬月額を決め、12か月分。雇用保険は年収×労働者負担率。 */
export function shakaiHoken(y, H, S) {
  const P = H.premise;
  const rate = S[P.kenko_rate_key][P.ken];
  if (rate !== P.kenko_rate_pct) throw new Error(`前提の健康保険料率 ${P.kenko_rate_pct}% が料率データ ${rate}% と不一致`);
  const m = calcMonthly(Math.floor(y / 12), rate, S.kaigo_rate, P.age, P.kosei_rate_pct, 0);
  if (m.kaigoApplies) throw new Error("前提の年齢で介護保険料がかかる（40歳未満を前提にしている）");
  const k = calcKoyou(y, P.koyou.total_permille, P.koyou.jigyo2_permille);
  if (k.workerPermille !== P.koyou.worker_permille) throw new Error("雇用保険の労働者負担率が前提と不一致");
  return { total: (m.kenkoKaigo.self + m.kosei.self) * 12 + k.self, kenko: m.kenkoKaigo.self * 12, kosei: m.kosei.self * 12, koyou: k.self, standard: m.standard };
}

/** 特別徴収の月割（地方税法321条の5第1項・20条の4の2第6項・第8項）。均等割相当額以下なら月割しない。 */
export function tokuchoMonthly(total, shotokuwari) {
  if (total === 0) return { monthly: 0, june: 0, lump: false };
  if (shotokuwari === 0) return { monthly: null, june: total, lump: true };
  const monthly = Math.floor(total / 12 / 100) * 100;
  return { monthly, june: total - monthly * 11, lump: false };
}

export function compute(H, D, S) {
  const P = H.premise;
  return incomes(H).map((y) => {
    const sh = shakaiHoken(y, H, S);
    const fam = {};
    for (const f of H.families) {
      const r = calc({ kyuyoShunyu: y, shakaiHoken: sh.total, family: f.family, jichitai: P.jichitai, kyuchi: P.kyuchi }, D);
      if (r.year !== H._meta.shotoku_year) throw new Error(`core の年分 ${r.year} が前提 ${H._meta.shotoku_year} と不一致`);
      fam[f.key] = { r, total: r.juminzeiTotal, shotokuwari: r.shotokuwariJissai, kintou: r.kintouwari.total, ...tokuchoMonthly(r.juminzeiTotal, r.shotokuwariJissai) };
    }
    return { y, sh, fam };
  });
}

/** 非課税（均等割・所得割とも0円）になる給与収入の上限を1円単位で探す（給与所得は収入に対して単調）。 */
export function hikazeiLimit(H, D, S, family, which) {
  const P = H.premise;
  const ok = (y) => {
    const r = calc({ kyuyoShunyu: y, shakaiHoken: 0, family, jichitai: P.jichitai, kyuchi: P.kyuchi }, D);
    return which === "kintou" ? r.hikazei.kintouwariHikazei : r.hikazei.shotokuwariHikazei;
  };
  let lo = 0, hi = 5_000_000;
  if (!ok(lo) || ok(hi)) throw new Error("非課税の上限の探索範囲が不正");
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) lo = mid; else hi = mid; }
  return lo;
}

export function build(H, D, S) {
  const m = H._meta, P = H.premise;
  const rows = compute(H, D, S);
  const fams = H.families;
  const get = (y) => rows.find((x) => x.y === y);

  const cell = (v) => v === null ? "—" : tok(n(v) + "円");
  // 2026-10-08 UI/UX: 答え（家族構成ごとの年額・月額）を2列目から並べ、前提の社会保険料は最後の列へ。
  // 1列目（年収）は横に送っても残す。600px以下は「独身／配偶者あり」で列を絞ると表が枠に収まり、見出し行がページに付く。
  const col = (i) => i === 0 ? "a" : "b";
  const table = `<div class="col-switch" role="group" aria-label="スマホで表示する列"><span>表示する列</span>${fams.map((f, i) => `<label><input type="radio" name="jh-cols" value="${col(i)}"${i === 0 ? " checked" : ""}>${f.short}</label>`).join("")}<label><input type="radio" name="jh-cols" value="all">すべての列</label></div><div class="scroll-wrap"><table class="juminzei-hayami sticky-first">
<caption>年収別の住民税（${m.nendo}・${P.area_label}・給与収入のみ・40歳未満・協会けんぽ）</caption>
<thead><tr><th scope="col">給与収入（年収）</th>${fams.map((f, i) => `<th scope="col" class="num" data-col="${col(i)}" data-answer>${f.short}・年額</th><th scope="col" class="num" data-col="${col(i)}" data-answer>${f.short}・月額</th>`).join("")}<th scope="col" class="num" data-col="x">社会保険料（前提）</th></tr></thead>
<tbody>
${rows.map((x) => `<tr data-nenshu="${x.y}"><th scope="row" style="white-space:nowrap">${tok(man(x.y))}</th>${fams.map((f, i) => { const c = x.fam[f.key]; return `<td class="num" data-col="${col(i)}">${cell(c.total)}</td><td class="num" data-col="${col(i)}">${cell(c.monthly)}</td>`; }).join("")}<td class="num" data-col="x">${cell(x.sh.total)}</td></tr>`).join("\n")}
</tbody></table></div>`;

  // ---- lead ----
  const s = (y) => get(y).fam.single;
  const lead = `<p data-jh="lead"><b>${m.nendo}（${m.shotoku_year}＝${m.shotoku_calendar}の所得にかかり、${m.chosyu}に納める分）の住民税は、${P.area_label}に住む独身・給与収入だけの会社員なら、年収300万円で年${n(s(3000000).total)}円、年収500万円で年${n(s(5000000).total)}円、年収700万円で年${n(s(7000000).total)}円です。</b>` +
    `いずれも、所得割（標準税率10％）と均等割（市区町村民税3,000円・都道府県民税1,000円）に、国税の森林環境税1,000円を足した額で、社会保険料は協会けんぽ東京都支部の40歳未満の会社員として概算しています。</p>`;

  // ---- 計算例（年収500万円・独身） ----
  const e = get(5000000), er = e.fam.single.r;
  const rei = `<div class="scroll-wrap"><table data-jh="rei">
<caption>年収500万円・独身の${m.nendo}住民税の計算（${P.area_label}・前提は表と同じ）</caption>
<thead><tr><th scope="col">段階</th><th scope="col" class="num">金額</th><th scope="col">計算</th></tr></thead>
<tbody>
<tr><th scope="row">給与所得</th><td class="num">${tok(n(er.kyuyoShotoku) + "円")}</td><td>給与収入5,000,000円を4,000円未満切捨てた額×80%−440,000円（所得税法の別表第五の区分）</td></tr>
<tr><th scope="row">社会保険料控除</th><td class="num">${tok(n(e.sh.total) + "円")}</td><td>健康保険${n(e.sh.kenko)}円＋厚生年金${n(e.sh.kosei)}円＋雇用保険${n(e.sh.koyou)}円（標準報酬月額${n(e.sh.standard)}円）</td></tr>
<tr><th scope="row">基礎控除</th><td class="num">${tok(n(er.kisoKojo) + "円")}</td><td>住民税の基礎控除（合計所得金額2,400万円以下）</td></tr>
<tr><th scope="row">課税総所得金額</th><td class="num">${tok(n(er.kazeiSoShotoku) + "円")}</td><td>${n(er.goukeiShotoku)}円−${n(e.sh.total)}円−${n(er.kisoKojo)}円の1,000円未満切捨て</td></tr>
<tr><th scope="row">所得割（区民税）</th><td class="num">${tok(n(er.shotokuwariJissaiShichoson) + "円")}</td><td>課税総所得金額×6%−調整控除${n(er.choseiKojo.shichoson)}円（100円未満切捨て）</td></tr>
<tr><th scope="row">所得割（都民税）</th><td class="num">${tok(n(er.shotokuwariJissaiDofuken) + "円")}</td><td>課税総所得金額×4%−調整控除${n(er.choseiKojo.dofuken)}円（100円未満切捨て）</td></tr>
<tr><th scope="row">均等割＋森林環境税</th><td class="num">${tok(n(er.kintouwari.total) + "円")}</td><td>区民税${n(er.kintouwari.shichoson)}円＋都民税${n(er.kintouwari.dofuken)}円＋森林環境税${n(er.kintouwari.shinrin)}円</td></tr>
<tr><th scope="row">年税額</th><td class="num">${tok(n(er.juminzeiTotal) + "円")}</td><td>特別徴収なら7月〜翌年5月は月${n(e.fam.single.monthly)}円、6月は${n(e.fam.single.june)}円</td></tr>
</tbody></table></div>`;

  // ---- 非課税ライン ----
  const fam = Object.fromEntries(fams.map((f) => [f.key, f.family]));
  const hs = hikazeiLimit(H, D, S, fam.single, "kintou");
  const hk = hikazeiLimit(H, D, S, fam.haigusha, "kintou");
  const hsh = hikazeiLimit(H, D, S, fam.haigusha, "shotoku");
  const hikazei = `<div class="scroll-wrap"><table data-jh="hikazei">
<caption>住民税が非課税になる給与収入の上限（${m.nendo}・${P.area_label}などの1級地・給与収入のみ）</caption>
<thead><tr><th scope="col">家族</th><th scope="col" class="num">均等割・所得割とも非課税</th><th scope="col" class="num">所得割だけ非課税</th></tr></thead>
<tbody>
<tr><th scope="row">独身（扶養なし）</th><td class="num">${tok(n(hs) + "円以下")}</td><td class="num">（独身は同じ上限）</td></tr>
<tr><th scope="row">配偶者あり（配偶者の収入なし・子なし）</th><td class="num">${tok(n(hk) + "円以下")}</td><td class="num">${tok(n(hsh) + "円以下")}</td></tr>
</tbody></table></div>`;

  // ---- figure（独身・配偶者ありの年額。100万〜1,000万円） ----
  const W = 420, Hh = 250, x0 = 46, x1 = 404, y0 = 210, y1 = 20;
  const pts = rows.filter((x) => x.y <= 10_000_000);
  const maxV = Math.ceil(Math.max(...pts.map((x) => x.fam.single.total)) / 100000) * 100000;
  const X = (y) => (x0 + (y - 1_000_000) / 9_000_000 * (x1 - x0)).toFixed(1);
  const Y = (v) => (y0 - v / maxV * (y0 - y1)).toFixed(1);
  const line = (k, stroke, dash) => `<polyline fill="none" stroke="${stroke}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ""} points="${pts.map((x) => `${X(x.y)},${Y(x.fam[k].total)}`).join(" ")}"/>`;
  const xt = [1, 3, 5, 7, 10].map((v) => `<line x1="${X(v * 1e6)}" y1="${y0}" x2="${X(v * 1e6)}" y2="${y0 + 5}" stroke="currentColor"/><text x="${X(v * 1e6)}" y="${y0 + 19}" font-size="12" text-anchor="middle" fill="currentColor">${v * 100}万</text>`).join("");
  const yt = []; for (let v = 0; v <= maxV; v += 200000) yt.push(`<line x1="${x0}" y1="${Y(v)}" x2="${x1}" y2="${Y(v)}" stroke="var(--sub)" stroke-opacity="0.25"/><text x="${x0 - 5}" y="${Number(Y(v)) + 4}" font-size="12" text-anchor="end" fill="currentColor">${v / 10000}万</text>`);
  const p5 = get(5000000).fam.single.total, p10 = get(10000000).fam.single.total;
  const svg = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-labelledby="jh-fig-t" style="width:100%;height:auto;max-width:640px">
<title id="jh-fig-t">年収と${m.nendo}の住民税（年額）の関係</title>
${yt.join("")}<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="currentColor"/>${xt}
${line("single", "var(--accent)")}${line("haigusha", "var(--sub)", "6 4")}
<circle cx="${X(5e6)}" cy="${Y(p5)}" r="4" fill="var(--accent)"/><text x="${Number(X(5e6)) - 6}" y="${Number(Y(p5)) - 9}" font-size="12" text-anchor="end" fill="currentColor">500万円 ${n(p5)}円</text>
<circle cx="${X(1e7)}" cy="${Y(p10)}" r="4" fill="var(--accent)"/><text x="${Number(X(1e7)) - 8}" y="${Number(Y(p10)) + 4}" font-size="12" text-anchor="end" fill="currentColor">1,000万円 ${n(p10)}円</text>
<line x1="${x0 + 8}" y1="${y1 + 6}" x2="${x0 + 30}" y2="${y1 + 6}" stroke="var(--accent)" stroke-width="2.5"/><text x="${x0 + 35}" y="${y1 + 10}" font-size="12" fill="currentColor">独身</text>
<line x1="${x0 + 8}" y1="${y1 + 24}" x2="${x0 + 30}" y2="${y1 + 24}" stroke="var(--sub)" stroke-width="2.5" stroke-dasharray="6 4"/><text x="${x0 + 35}" y="${y1 + 28}" font-size="12" fill="currentColor">配偶者あり</text>
<text x="${x1}" y="${Hh - 4}" font-size="11" text-anchor="end" fill="var(--sub)">給与収入（年収）</text>
</svg>`;

  // ---- 独身と配偶者ありの差（所得割がかかる行だけ。連続する同じ差を1つの帯にまとめる） ----
  const runs = [];
  for (const x of rows) {
    if (x.fam.single.shotokuwari === 0 || (x.fam.haigusha.shotokuwari === 0 && x.fam.single.total !== x.fam.haigusha.total)) continue;
    const d = x.fam.single.total - x.fam.haigusha.total;
    const last = runs[runs.length - 1];
    if (last && last.d === d) last.to = x.y; else runs.push({ d, from: x.y, to: x.y });
  }
  const rangeTxt = (r) => r.from === r.to ? `${man(r.from)}の行` : (r.to === rows[rows.length - 1].y ? `${man(r.from)}以上の行` : `${man(r.from).replace("万円", "万")}〜${man(r.to)}の行`);
  const diff = `<p data-jh="diff">令和8年度の住民税（前提は表と同じ）で、独身と配偶者あり（配偶者の収入なし）の年額の差は、給与収入${runs.map((r) => `${rangeTxt(r)}で${n(r.d)}円`).join("、")}です。</p>`;

  // ---- Dataset JSON-LD ----
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `年収別 住民税 早見表（${m.nendo}・${P.area_label}・給与収入のみ）`,
    description: `${m.nendo}（${m.shotoku_year}の所得）の個人住民税（所得割・均等割）と森林環境税の合計額を、給与収入100万円から2,000万円まで年収別に計算した表。前提は${P.area_label}に住む40歳未満の会社員で、給与収入のみ・賞与なし、社会保険は協会けんぽ東京都支部の令和7年度の健康保険料率9.91%と厚生年金保険料率18.3%、雇用保険は一般の事業の労働者負担5.5/1,000で概算。独身と配偶者あり（配偶者の収入なし）の2通り。特別徴収の月額つき。`,
    url: URL_PAGE,
    inLanguage: "ja",
    spatialCoverage: "日本（東京都特別区。標準税率の自治体）",
    temporalCoverage: "2026-06/2027-05",
    isBasedOn: m.sources.chihozei,
    creator: { "@type": "Person", name: "Masahiro Yasu", url: "https://keiri-tools.com/about/" },
    publisher: { "@type": "Organization", name: "税金・経理・補助金ツールズ", url: "https://keiri-tools.com/" },
    distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: URL_PAGE + CSV_NAME }],
  };
  const datasetTag = `<script type="application/ld+json">\n${JSON.stringify(dataset, null, 2)}\n</script>`;

  // ---- CSV ----
  const head = ["給与収入(円)", "社会保険料_前提(円)", "うち健康保険(円)", "うち厚生年金(円)", "うち雇用保険(円)"];
  for (const f of fams) head.push(`${f.short}_給与所得(円)`, `${f.short}_課税総所得金額(円)`, `${f.short}_所得割(円)`, `${f.short}_均等割と森林環境税(円)`, `${f.short}_年額(円)`, `${f.short}_特別徴収7月〜翌5月の月額(円)`, `${f.short}_特別徴収6月(円)`);
  head.push("年度", "前提");
  const premiseText = `${P.area_label}・給与収入のみ・賞与なし・40歳未満・協会けんぽ東京都9.91%・厚生年金18.3%・雇用保険5.5/1000（いずれも令和7年度）`;
  const lines = [head.join(",")];
  for (const x of rows) {
    const c = [x.y, x.sh.total, x.sh.kenko, x.sh.kosei, x.sh.koyou];
    for (const f of fams) { const v = x.fam[f.key]; c.push(v.r.kyuyoShotoku, v.r.kazeiSoShotoku, v.shotokuwari, v.kintou, v.total, v.monthly === null ? "" : v.monthly, v.june); }
    c.push(m.nendo, premiseText);
    lines.push(c.join(","));
  }
  const csv = "﻿" + lines.join("\r\n") + "\r\n";

  return { table, lead, rei, hikazei, svg, datasetTag, csv, diff, runs, rows, limits: { hs, hk, hsh } };
}

function fill(html, name, inner) {
  const re = new RegExp(`(<!--jh:${name}:S-->)[\\s\\S]*?(<!--jh:${name}:E-->)`);
  if (!re.test(html)) throw new Error(`マーカー jh:${name} が無い`);
  return html.replace(re, (_, s, e) => s + inner + e);
}

export function render(html, data) {
  const b = build(data.H, data.D, data.S);
  const parts = { table: b.table, lead: b.lead, rei: b.rei, hikazei: b.hikazei, figure: b.svg, dataset: b.datasetTag, diff: b.diff };
  for (const k of Object.keys(parts)) html = fill(html, k, parts[k]);
  return { html, csv: b.csv };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = loadData();
  const before = readFileSync(PAGE, "utf8");
  const { html, csv } = render(before, data);
  const csvBefore = existsSync(CSV) ? readFileSync(CSV, "utf8") : "";
  if (CHECK) {
    const bad = [html !== before && "index.html", csv !== csvBefore && CSV_NAME].filter(Boolean);
    if (bad.length) { console.error(`✗ 住民税の早見表が正本JSONと不一致（${bad.join("・")}）。node tools/gen_juminzei_hayami.mjs を実行してコミット`); process.exit(1); }
    console.log("✓ 住民税の早見表（HTML・CSV）は正本JSONと一致"); process.exit(0);
  }
  if (html !== before) writeFileSync(PAGE, html);
  if (csv !== csvBefore) writeFileSync(CSV, csv);
  console.log(html !== before || csv !== csvBefore ? `✓ 早見表を生成（${data.H._meta.nendo}）` : "変更なし（既に最新）");
}
