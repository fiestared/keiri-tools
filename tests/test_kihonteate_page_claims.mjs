// test_kihonteate_page_claims.mjs — /kihonteate/ の本文に 2026-09-23 で足した主張を要素名指しで固定する。
//
// なぜ要るか:
//   このページは「上限額・下限額は毎年8月1日に変わります」と仕組みだけ書き、**実額はページに1つも無い**
//   状態だった（額は kihonteate_r07.json を非同期に読んで結果欄に出すだけ）。競合上位は実額表を持っており、
//   主対象語の1つが「基本手当日額」なので、静的HTMLに実額の表を置いた。
//   ★手書きの転記は、データを差し替えた年に**ページだけが古い額を名乗る**。CLAUDE.md「記事の数値と実装の照合」
//   のとおり、正本JSONとの一致を機械で固定する。
//
// 検査の書き方（CLAUDE.md 規則3・4・5）:
//   「本文のどこかに在る」では見ない。**その主張が1回しか現れない最小の要素**を、
//   主語のセル／id で一意に特定してから、その要素の中で数値・語を照合する。
//   表の行は「賃金日額の帯」「年齢」という主語セルで引く（find() の最初の一致に頼らない）。

import { readFileSync } from "node:fs";

const D = JSON.parse(readFileSync(new URL("../docs/assets/kihonteate_r07.json", import.meta.url), "utf8"));
const HTML = readFileSync(new URL("../docs/kihonteate/index.html", import.meta.url), "utf8");

const fails = [];
let checks = 0;
const ok = (label) => { checks++; console.log(`  ✓ ${label}`); };
const bad = (label, detail) => { checks++; fails.push(`${label} — ${detail}`); console.log(`  ✗ ${label} — ${detail}`); };

const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const yen = (n) => n.toLocaleString("en-US");

/** id を持つ要素の中身だけを取り出す（名指しが一意であることも確かめる） */
function byId(id) {
  const re = new RegExp(`<(h2|h3|p|span|div)[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</\\1>`, "g");
  const m = [...HTML.matchAll(re)];
  if (m.length !== 1) return { found: false, count: m.length, text: "" };
  return { found: true, count: 1, text: strip(m[0][2]) };
}

/** 主語セル（1列目）でテーブル行を一意に引く。粒度は <tr> ひとつ＝その主張が1回しか出ない最小の要素 */
function row(subject) {
  const rows = [...HTML.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((m) => m[1])
    .filter((r) => {
      const first = r.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/);
      return first && strip(first[1]) === subject;
    });
  if (rows.length !== 1) return { found: false, count: rows.length, text: "" };
  return { found: true, count: 1, text: strip(rows[0]) };
}

function rowHas(subject, parts) {
  const r = row(subject);
  if (!r.found) return bad(`表の行「${subject}」`, r.count === 0 ? "行が見つからない" : `${r.count}件に当たる（名指しが一意でない）`);
  const missing = parts.filter((p) => !r.text.includes(p));
  if (missing.length) return bad(`表の行「${subject}」`, `欠落: ${missing.join(" / ")}（実際: ${r.text}）`);
  ok(`表の行「${subject}」 ${parts.join(" ")}`);
}

/**
 * h3#id の**直後の <p> ひとつ**を引く。主張は見出しではなく本文の段落に載るので、
 * 名指しは「その主張が1回しか現れない最小の要素」＝この <p> まで下ろす（規則5）。
 * h3 の id はページ内で一意なので、この名指しも一意になる（規則4）。
 */
function pAfterH3(id) {
  const re = new RegExp(`<h3[^>]*\\sid="${id}"[^>]*>[\\s\\S]*?</h3>\\s*<p>([\\s\\S]*?)</p>`, "g");
  const m = [...HTML.matchAll(re)];
  if (m.length !== 1) return { found: false, count: m.length, text: "" };
  return { found: true, count: 1, text: strip(m[0][1]) };
}

function pHas(id, parts, label) {
  const e = pAfterH3(id);
  if (!e.found) return bad(label, e.count === 0 ? `h3#${id} 直後の <p> が無い` : `${e.count}件（一意でない）`);
  const missing = parts.filter((x) => !e.text.includes(x));
  if (missing.length) return bad(label, `h3#${id} の段落に欠落: ${missing.join(" / ")}`);
  ok(label);
}

function idHas(id, parts, label) {
  const e = byId(id);
  if (!e.found) return bad(label, e.count === 0 ? `#${id} が無い` : `#${id} が${e.count}件（一意でない）`);
  const missing = parts.filter((p) => !e.text.includes(p));
  if (missing.length) return bad(label, `#${id} に欠落: ${missing.join(" / ")}`);
  ok(label);
}

console.log("── 年齢別の上限額が kihonteate_r07.json と一致するか（年齢が主語） ──");
const BANDS = [
  ["上限・30歳未満", "under30"],
  ["上限・30歳以上45歳未満", "age30_44"],
  ["上限・45歳以上60歳未満", "age45_59"],
  ["上限・60歳以上65歳未満", "age60_64"],
];
for (const [subject, key] of BANDS) {
  rowHas(subject, [`${yen(D.chingin_nichigaku_max[key])}円`, `${yen(D.kihon_nichigaku_max[key])}円`]);
}
rowHas("下限（全年齢）", [`${yen(D.chingin_nichigaku_min)}円`, `${yen(D.kihon_nichigaku_min)}円`]);

console.log("── 給付率の帯が JSON の境目と一致するか（賃金日額の帯が主語） ──");
const MIN = yen(D.chingin_nichigaku_min);            // 3,203
const B80 = yen(D.band80_upper);                     // 5,480
const TAPER = yen(D.band_taper_upper);               // 13,490
const CAP = yen(D.chingin_nichigaku_max.age30_44);   // 16,540
rowHas(`${MIN}円未満`, [`${yen(D.kihon_nichigaku_min)}円`]);
rowHas(`${MIN}円以上 ${B80}円未満（月給 約9.6万〜16.4万円）`, ["80％", `${yen(D.kihon_nichigaku_min)}円`]);
rowHas(`${B80}円以上 ${TAPER}円以下（月給 約16.4万〜40.5万円）`, ["80％→50％へ逓減", "6,745円"]);
rowHas(`${TAPER}円超 ${CAP}円以下（月給 約40.5万〜49.6万円）`, ["50％", `${yen(D.kihon_nichigaku_max.age30_44)}円`]);
rowHas(`${CAP}円超（月給 約49.6万円超）`, [`${yen(D.kihon_nichigaku_max.age30_44)}円`]);

console.log("── 表が名乗る年が、データの年と一致するか ──");
idHas("joge-year", [D._meta.year], `帯の表の年表記が ${D._meta.year}（データの申告）`);

console.log("── 60〜64歳だけ帯の形が違うこと（逓減の上端と45％） ──");
{
  const seg = HTML.split('<h3 id="konnan-nissu">')[0].split('<h3 id="joge">')[1] || "";
  const t = strip(seg);
  const need = [`${yen(D.band_taper_upper_60_64)}円`, "45％"];
  const missing = need.filter((x) => !t.includes(x));
  if (missing.length) bad("60〜64歳の帯", `欠落: ${missing.join(" / ")}`);
  else ok(`60〜64歳の帯 ${yen(D.band_taper_upper_60_64)}円・45％`);
}

console.log("── 条文の額は今日の実額ではない、の callout（17条4項の出発点） ──");
{
  const m = [...HTML.matchAll(/<div class="callout">([\s\S]*?)<\/div>/g)]
    .map((x) => strip(x[1]))
    .filter((t) => t.includes("条文に書かれている上限額は、今日の実額ではありません"));
  if (m.length !== 1) bad("条文の額の callout", `${m.length}件（一意でない／無い）`);
  else {
    const need = ["13,370円", "14,850円", "16,340円", "15,590円", "2,460円", "17条4項", "18条"];
    const missing = need.filter((x) => !m[0].includes(x));
    if (missing.length) bad("条文の額の callout", `欠落: ${missing.join(" / ")}`);
    else ok("条文の額の callout 17条4項の4額＋下限2,460円＋18条の自動変更対象額");
  }
}

console.log("── 6か月の数え方（14条1項の11日）と賃金の範囲（17条1項の除外） ──");
pHas("rokkagetsu", ["11日以上", "17条1項", "14条1項", "飛ばして"],
  "h3 6か月は賃金支払基礎日数11日以上の月で数える");
pHas("chingin-hani", ["臨時に支払われる賃金", "3か月を超える期間ごとに支払われる賃金", "通勤手当", "残業代", "総支給額"],
  "h3 賞与は除き通勤手当・残業代は含む（17条1項の除外そのまま）");

console.log("── 就職困難者の所定給付日数（画面に選択肢があるのに数字が無かった） ──");
pHas("konnan-nissu", ["45歳未満", "150日", "300日", "45歳以上65歳未満", "360日"],
  "h3 就職困難者 150日／300日／360日");

console.log("── 待期は「通算7日」・認定は4週に1回で直前28日分 ──");
{
  const h2 = [...HTML.matchAll(/<h2 id="itsu">([\s\S]*?)<h2 /g)];
  const seg = HTML.split('<h2 id="zeikin">')[0].split('<h2 id="itsu">')[1] || "";
  const t = strip(seg);
  const need = ["21条", "通算", "4週間に1回", "28日", "15条2項", "15条3項", "15条4項", "15日未満"];
  const missing = need.filter((x) => !t.includes(x));
  if (missing.length) bad("いつ振り込まれるか", `欠落: ${missing.join(" / ")}`);
  else ok("待期は通算7日（21条）／認定は4週に1回・直前28日分（15条3項）／15条4項の例外");
  if (h2.length > 1) bad("h2#itsu", "一意でない");
}
// ★規則7: 「28日」は同じ節の中に2回出る（15条3項の引用と、1回の認定の分量）。
//   節を丸ごと見る網は片方を消しても緑になったので、主張が載る <p> を名指しする。
idHas("nintei-28", ["4週間に1回", "まとまるのは28日分", "待期の7日は、最初の認定日までの4週間の中で進みます", "おおむね1か月"],
  "p 1回の認定でまとまるのは28日分・初回入金まで1か月前後");

console.log("── 条文の逐語（blockquote に条文本文だけ。出典ラベルを同居させない） ──");
// ★地の文の鉤括弧で条文を名乗ると、算用数字・括弧書きの脱落で必ず非逐語になる
//   （ARTICLE_SPEC が4便連続の癖として戒めている）。条文は blockquote に置いて機械に照合させる。
{
  const bqs = [...HTML.matchAll(/<blockquote>([\s\S]*?)<\/blockquote>/g)].map((m) => strip(m[1]));
  const WANT = [
    ["12条（公課の禁止）", "租税その他の公課は、失業等給付として支給を受けた金銭を標準として課することができない。"],
    ["21条（待期）", "基本手当は、受給資格者が当該基本手当の受給資格に係る離職後最初に公共職業安定所に求職の申込みをした日以後において、失業している日（疾病又は負傷のため職業に就くことができない日を含む。）が通算して七日に満たない間は、支給しない。"],
  ];
  for (const [label, want] of WANT) {
    const hit = bqs.filter((b) => b === want);
    if (hit.length !== 1) bad(`${label}の blockquote`, `逐語一致が${hit.length}件`);
    else ok(`${label}を blockquote に逐語で置いている`);
  }
}
// ★21条は「七日」。地の文で算用数字に直した形を鉤括弧に入れ直していないか見る（near-miss の再発防止）
if (/「[^」]*通算して7日[^」]*」/.test(HTML)) bad("21条の鉤括弧", "地の文の鉤括弧で「通算して7日」と算用数字に書き換えている");
else ok("21条を算用数字にした鉤括弧が本文に無い");
idHas("zeikin", ["所得税", "住民税"], "h2 非課税の見出しが所得税・住民税を名指し");

console.log("── 19条の減額（3段階）と届出義務・不正受給の重さ ──");
{
  const seg = HTML.split('<h2 id="kunren">')[0].split('<h2 id="arubaito">')[1] || "";
  const t = strip(seg);
  const need = ["80％", "満額", "19条1項", "19条2項", "19条3項", "1,282円", "2倍", "ハローワークが決めます"];
  const missing = need.filter((x) => !t.includes(x));
  if (missing.length) bad("アルバイトの減額", `欠落: ${missing.join(" / ")}`);
  else ok("19条1項の3段階・2項で控除額が変わる・3項の届出義務・不正受給は2倍");
}
// ★規則7: 「19条3項」も節の中に条番号として残るので、届出義務の**逐語**が載る <p> を名指しする。
idHas("todokede",
  ["その収入の額その他の事項を公共職業安定所長に届け出なければならない", "2倍に相当する額以下の納付", "最大3倍"],
  "p 19条3項の届出義務の逐語と、不正受給が最大3倍になること");

console.log("── 訓練延長給付と技能習得手当（競合の計算ページに無い一段） ──");
{
  const seg = HTML.split('</section>\n\n<section class="faq">\n  <h2 id="faq">')[0].split('<h2 id="kunren">')[1] || "";
  const t = strip(seg);
  const need = ["指示", "訓練が終了する日まで", "日額500円", "20,000円", "42,500円", "10,700円", "傷病手当", "15日以上"];
  const missing = need.filter((x) => !t.includes(x));
  if (missing.length) bad("訓練延長給付・技能習得手当", `欠落: ${missing.join(" / ")}`);
  else ok("所長の指示で訓練終了日まで支給／受講手当500円・上限20,000円／通所手当42,500円／寄宿手当10,700円／傷病手当15日以上");
}

console.log("── 網の外に何が残るか（規則6）: 足した金額が全部どこかの名指しに入っているか ──");
{
  // 追記した節に出る「N,NNN円」を全部集め、上で名指し済みの額と突き合わせる。
  const start = HTML.indexOf('<h3 id="rokkagetsu">');
  const end = HTML.indexOf('<section class="faq">\n  <h2 id="faq">');
  const added = strip(HTML.slice(start, end));
  const found = new Set((added.match(/\d{1,3}(?:,\d{3})+/g) || []));
  const named = new Set([
    ...Object.values(D.chingin_nichigaku_max).map(yen),
    ...Object.values(D.kihon_nichigaku_max).map(yen),
    yen(D.chingin_nichigaku_min), yen(D.kihon_nichigaku_min),
    yen(D.band80_upper), yen(D.band_taper_upper), yen(D.band_taper_upper_60_64),
    "6,745", "4,383", "4,384",          // 逓減帯の上下端（LL080731保01 裏面）
    "13,370", "14,850", "16,340", "15,590", "2,460",  // 17条4項の条文額
    "1,282",                             // 19条1項1号の控除額（条文）
    "4,848", "6,640",                    // 60〜64歳の式の定数（参考1）
    "8,010",                             // 30〜59歳の逓減式の分母 13,490−5,480（LL080731保01 裏面 ※2）
    "20,000", "42,500", "10,700",        // 技能習得手当・寄宿手当
  ]);
  const orphan = [...found].filter((x) => !named.has(x));
  if (orphan.length) bad("金額の網", `名指しの外に残った額: ${orphan.join(" / ")}（検査に足すか本文から外すこと）`);
  else ok(`追記した節の金額 ${found.size}種すべてが名指しの中`);
}

console.log("");
if (fails.length) {
  console.log(`❌ test_kihonteate_page_claims: ${fails.length} 件の不一致 / ${checks} checks`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`✅ test_kihonteate_page_claims: ${checks} checks — 追記した主張を要素名指しで固定（額は kihonteate_r07.json が正本）`);
