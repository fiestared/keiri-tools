/**
 * 協会けんぽの都道府県別 保険料率の一覧（早見表）を、shaho_rates_r08.json から生成する。
 *
 * 生成するもの（JSON が正本・以下はすべて生成物。手で書かない）:
 *   - docs/column/kyokai-kenpo-ryoritsu-ichiran/index.html の <!--kenpo:*:S-->〜<!--kenpo:*:E--> の中身
 *       table   … 47都道府県の表（健康保険料率・前年度比・介護込み・折半後の本人負担）
 *       summary … 最高・最低・差、引下げ・据置・引上げの件数、下げ幅の最大
 *       figure  … 47都道府県の分布（インラインSVG）
 *       dataset … Dataset の JSON-LD（CSV の配布先・年度・出典）
 *   - docs/column/kyokai-kenpo-ryoritsu-ichiran/kyokai-kenpo-ryoritsu-r08.csv
 *
 * なぜ静的に焼くか: 一覧は入力のいらない事実の表で、引用されること自体が目的。
 * JS で描くと、JS を実行しないクローラ（bingbot・GPTBot など）には表が存在しない（gen_saitei_table.mjs と同じ理由）。
 *
 * 率は浮動小数で足し引きしない。0.01% 単位の整数（9.85% → 985）に直してから計算し、表示で戻す。
 *
 *   node tools/gen_kenpo_ichiran.mjs          生成（冪等）
 *   node tools/gen_kenpo_ichiran.mjs --check  差分があれば失敗（tests/test_kenpo_ichiran.mjs が呼ぶ）
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SLUG = "kyokai-kenpo-ryoritsu-ichiran";
export const PAGE = join(ROOT, `docs/column/${SLUG}/index.html`);
export const CSV_NAME = "kyokai-kenpo-ryoritsu-r08.csv";
export const CSV = join(ROOT, `docs/column/${SLUG}/${CSV_NAME}`);
export const DATA = join(ROOT, "docs/assets/shaho_rates_r08.json");
const URL_PAGE = `https://keiri-tools.com/column/${SLUG}/`;
const CHECK = process.argv.includes("--check");

/** 9.85 → 985（0.01% 単位の整数）。小数第3位以下を持つ値が来たら止める */
export const toBp = (x) => {
  const v = Math.round(x * 100);
  if (Math.abs(v - x * 100) > 1e-6) throw new Error(`率 ${x} が 0.01% 単位でない`);
  return v;
};
/** 0.01% 単位の整数 → "9.85"。折半は 0.005% 単位になるので half=true で小数3桁 */
export const fmt = (bp, half = false) => half ? (bp / 200).toFixed(3) : (bp / 100).toFixed(2);
export const fmtDiff = (bp) => bp === 0 ? "±0.00" : (bp > 0 ? "+" : "−") + (Math.abs(bp) / 100).toFixed(2);

// gen_layout_markup.mjs と同じ組版（表の数値を numeric-token で包み、数値列の見出しに num）。ここで揃えないと、
// あちらが包み直して本生成器の --check が赤になり、互いに書き換え合う。
const tok = (v) => `<span class="numeric-token">${v}%</span>`;

export function build(D) {
  const m = D._meta;
  const prefs = Object.keys(D.kenko_rates);
  if (prefs.length !== 47) throw new Error(`都道府県が ${prefs.length} 件（47件でない）`);
  for (const p of prefs) if (!(p in D.kenko_rates_prev)) throw new Error(`${p} の前年度の率が無い`);
  const kaigo = toBp(D.kaigo_rate), shien = toBp(D.kosodate_rate);
  const rows = prefs.map((p) => {
    const r = toBp(D.kenko_rates[p]), prev = toBp(D.kenko_rates_prev[p]);
    return { p, r, prev, diff: r - prev, withKaigo: r + kaigo };
  });
  const prevYear = m.year.replace(/令和(\d+)年度/, (_, n) => `令和${Number(n) - 1}年度`);
  const ym = (s) => { const [y, mo] = s.split("-").map(Number); return `令和${y - 2018}年${mo}月分`; };
  const rateFrom = ym(m.rate_applies_from), shienFrom = ym(m.kosodate_applies_from);

  // ---- table ----
  // 2026-10-08 UI/UX: 答え（料率とその本人負担）を左から並べ、前年との増減は最後の列へ。1列目（都道府県）は横に送っても残す
  const table = `<div class="scroll-wrap"><table class="kenpo-ichiran sticky-first">
<caption>協会けんぽの都道府県別 保険料率（${m.year}・一般被保険者は${rateFrom}から）</caption>
<thead><tr><th scope="col">都道府県</th><th scope="col" class="num" data-answer>健康保険料率</th><th scope="col" class="num" data-answer>本人負担（折半）40歳未満</th><th scope="col" class="num">40〜64歳（介護保険料率${fmt(kaigo)}%込み）</th><th scope="col" class="num">本人負担（折半）40〜64歳</th><th scope="col" class="num">${prevYear}からの増減</th></tr></thead>
<tbody>
${rows.map((x) => `<tr data-pref="${x.p}"><th scope="row" style="white-space:nowrap">${x.p}</th><td class="num">${tok(fmt(x.r))}</td><td class="num">${tok(fmt(x.r, true))}</td><td class="num">${tok(fmt(x.withKaigo))}</td><td class="num">${tok(fmt(x.withKaigo, true))}</td><td class="num">${fmtDiff(x.diff)}</td></tr>`).join("\n")}
</tbody></table></div>`;

  // ---- summary ----
  const hi = Math.max(...rows.map((x) => x.r)), lo = Math.min(...rows.map((x) => x.r));
  const names = (v, key = "r") => rows.filter((x) => x[key] === v).map((x) => x.p).join("・");
  const down = rows.filter((x) => x.diff < 0).length, same = rows.filter((x) => x.diff === 0).length, up = rows.filter((x) => x.diff > 0).length;
  const maxDown = Math.min(...rows.map((x) => x.diff));
  const md = rows.filter((x) => x.diff === maxDown);
  const summary = `<p data-kenpo="summary">${m.year}の協会けんぽの健康保険料率（一般被保険者・${rateFrom}から）は、` +
    `<b>最も高いのが${names(hi)}の${fmt(hi)}%</b>、<b>最も低いのが${names(lo)}の${fmt(lo)}%</b>で、その差は${fmtDiff(hi - lo).replace("+", "")}ポイントです。</p>\n` +
    `<p data-kenpo="change">${prevYear}と比べると、47都道府県のうち<b>引下げが${down}</b>、<b>据置が${same}</b>、<b>引上げが${up}</b>です。` +
    `下げ幅が最も大きいのは${md.map((x) => `${x.p}（${fmt(x.prev)}% → ${fmt(x.r)}%）`).join("・")}の${(Math.abs(maxDown) / 100).toFixed(2)}ポイントです。</p>\n` +
    `<p data-kenpo="band">47都道府県のうち${rows.filter((x) => x.r >= 950 && x.r <= 1010).length}が9.50%以上10.10%以下に入ります。` +
    `最高と最低の差${((hi - lo) / 100).toFixed(2)}ポイントは、標準報酬月額300,000円なら健康保険料の全額で月${(300000 * (hi - lo) / 10000).toLocaleString("ja-JP")}円、` +
    `折半後の本人負担で月${(300000 * (hi - lo) / 20000).toLocaleString("ja-JP")}円の違いです（40歳未満・${rateFrom}以降で、子ども・子育て支援金を除く）。</p>`;

  // ---- figure (分布) ----
  const W = 420, H = 178, x0 = 24, x1 = 396, lo0 = Math.floor(lo / 10) * 10, hi0 = Math.ceil(hi / 10) * 10;
  const X = (bp) => (x0 + (bp - lo0) / (hi0 - lo0) * (x1 - x0)).toFixed(1);
  const counts = new Map();
  const dots = [...rows].sort((a, b) => a.r - b.r || a.p.localeCompare(b.p)).map((x) => {
    const k = counts.get(x.r) || 0; counts.set(x.r, k + 1);
    return `<circle cx="${X(x.r)}" cy="${(120 - k * 9).toFixed(1)}" r="4" fill="var(--accent)" fill-opacity="0.75"><title>${x.p} ${fmt(x.r)}%</title></circle>`;
  }).join("");
  const ticks = [];
  for (let t = lo0; t <= hi0; t += 20) ticks.push(`<line x1="${X(t)}" y1="128" x2="${X(t)}" y2="134" stroke="currentColor"/><text x="${X(t)}" y="150" font-size="11" text-anchor="middle" fill="currentColor">${fmt(t)}</text>`);
  const tokyo = rows.find((x) => x.p === "東京都");
  const label = (bp, txt, y, anchor) => `<line x1="${X(bp)}" y1="${y + 6}" x2="${X(bp)}" y2="128" stroke="var(--sub)" stroke-dasharray="3 3"/><text x="${X(bp)}" y="${y}" font-size="13" text-anchor="${anchor}" fill="currentColor">${txt}</text>`;
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="kenpo-fig-t" style="width:100%;height:auto;max-width:640px">
<title id="kenpo-fig-t">${m.year}の協会けんぽ健康保険料率の分布（47都道府県）</title>
<line x1="${x0}" y1="128" x2="${x1}" y2="128" stroke="currentColor"/>${ticks.join("")}${dots}
${label(lo, `最低 ${names(lo)} ${fmt(lo)}%`, 30, "start")}${label(hi, `最高 ${names(hi)} ${fmt(hi)}%`, 30, "end")}${label(tokyo.r, `東京都 ${fmt(tokyo.r)}%`, 52, "middle")}
<text x="${x1}" y="172" font-size="11" text-anchor="end" fill="var(--sub)">健康保険料率（%）</text>
</svg>`;

  // ---- 計算例（東京都・標準報酬月額30万円）。協会けんぽ東京支部の保険料額表の折半額と一致することを test が外部オラクルで固定する ----
  const STD = 300000;
  const yen = (bp, half) => { const v = STD * bp / 10000 / (half ? 2 : 1); return v.toLocaleString("ja-JP", { minimumFractionDigits: 0, maximumFractionDigits: 1 }); };
  const rei = `<p data-kenpo="rei">協会けんぽ東京都支部の一般被保険者で標準報酬月額が300,000円の人なら、${rateFrom}以降の健康保険料（全額）は300,000円×${fmt(tokyo.r)}%＝${yen(tokyo.r)}円で、本人負担（折半額）は<b>${yen(tokyo.r, true)}円</b>です。` +
    `東京都支部で40〜64歳の介護保険第2号被保険者なら300,000円×${fmt(tokyo.withKaigo)}%＝${yen(tokyo.withKaigo)}円で、折半額は<b>${yen(tokyo.withKaigo, true)}円</b>です。` +
    `${shienFrom}以降は、年齢にかかわらず子ども・子育て支援金300,000円×${fmt(shien)}%＝${yen(shien)}円（折半額${yen(shien, true)}円）が加わります。</p>`;

  // ---- Dataset JSON-LD ----
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `協会けんぽ 都道府県別 健康保険料率・介護保険料率（${m.year}）`,
    description: `全国健康保険協会（協会けんぽ）が公表した${m.year}の都道府県単位保険料率（健康保険料率）47都道府県分と${prevYear}の率、全国一律の介護保険料率${fmt(kaigo)}%・子ども・子育て支援金率${fmt(shien)}%、労使折半後の本人負担率をまとめた表。一般被保険者の健康保険料率・介護保険料率は${rateFrom}から、子ども・子育て支援金率は${shienFrom}から適用。`,
    url: URL_PAGE,
    inLanguage: "ja",
    spatialCoverage: "日本（47都道府県）",
    temporalCoverage: `${m.rate_applies_from}/..`,
    isBasedOn: m.url,
    creator: { "@type": "Person", name: "Masahiro Yasu", url: "https://keiri-tools.com/about/" },
    publisher: { "@type": "Organization", name: "税金・経理・補助金ツールズ", url: "https://keiri-tools.com/" },
    distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: URL_PAGE + CSV_NAME }],
  };
  const datasetTag = `<script type="application/ld+json">\n${JSON.stringify(dataset, null, 2)}\n</script>`;

  // ---- CSV（Excel で文字化けしないよう BOM 付き UTF-8・CRLF） ----
  const head = ["都道府県（協会けんぽ一般被保険者）", `健康保険料率_${m.year}(%)`, `健康保険料率_${prevYear}(%)`, "増減(ポイント)", "介護保険料率(%)", "子ども・子育て支援金率(%)",
    `40歳未満_合計_${shienFrom}以降_支援金込み(%)`, `40〜64歳_合計_${shienFrom}以降_支援金込み(%)`, `40歳未満_本人負担_${shienFrom}以降_支援金込み(%)`, `40〜64歳_本人負担_${shienFrom}以降_支援金込み(%)`, "健康保険料率・介護保険料率の適用開始", "子ども・子育て支援金率の適用開始", "出典"];
  const lines = [head.join(",")];
  for (const x of rows) {
    const t1 = x.r + shien, t2 = x.withKaigo + shien;
    lines.push([x.p, fmt(x.r), fmt(x.prev), fmtDiff(x.diff).replace("−", "-").replace("±", ""), fmt(kaigo), fmt(shien),
      fmt(t1), fmt(t2), fmt(t1, true), fmt(t2, true), rateFrom, shienFrom, m.url].join(","));
  }
  const csv = "﻿" + lines.join("\r\n") + "\r\n";

  return { table, summary, svg, datasetTag, csv, rei, rows, kaigo, shien };
}

function fill(html, name, inner) {
  const re = new RegExp(`(<!--kenpo:${name}:S-->)[\\s\\S]*?(<!--kenpo:${name}:E-->)`);
  if (!re.test(html)) throw new Error(`マーカー kenpo:${name} が無い（組版が壊れている）`);
  return html.replace(re, (_, s, e) => s + inner + e);
}

export function render(html, D) {
  const b = build(D);
  for (const k of ["table", "summary", "figure", "dataset", "rei"]) {
    html = fill(html, k, { table: b.table, summary: b.summary, figure: b.svg, dataset: b.datasetTag, rei: b.rei }[k]);
  }
  return { html, csv: b.csv };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const D = JSON.parse(readFileSync(DATA, "utf8"));
  const before = readFileSync(PAGE, "utf8");
  const { html, csv } = render(before, D);
  const csvBefore = existsSync(CSV) ? readFileSync(CSV, "utf8") : "";
  if (CHECK) {
    const bad = [html !== before && "index.html", csv !== csvBefore && CSV_NAME].filter(Boolean);
    if (bad.length) { console.error(`✗ 健康保険料率の一覧が正本JSONと不一致（${bad.join("・")}）。node tools/gen_kenpo_ichiran.mjs を実行してコミット`); process.exit(1); }
    console.log("✓ 健康保険料率の一覧（HTML・CSV）は正本JSONと一致"); process.exit(0);
  }
  if (html !== before) writeFileSync(PAGE, html);
  if (csv !== csvBefore) writeFileSync(CSV, csv);
  console.log(html !== before || csv !== csvBefore ? `✓ 一覧を生成: 47件（${D._meta.year}）` : "変更なし（既に最新）");
}
