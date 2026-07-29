/**
 * 最低賃金の47都道府県一覧を、saitei_chingin_r07.json から **静的HTMLとして焼き込む**。
 *
 * なぜ焼くか（2026-07-28にAI TIMESで実測した教訓の適用）:
 *   このサイトのツールは計算機なので JS 描画で構わない。**入力が無ければ答えも無い**からだ。
 *   しかし「47都道府県の最低賃金一覧」は入力のいらない**事実の表＝コンテンツ**で、
 *   「東京 最低賃金」「大阪 最低賃金 いくら」のようなクエリで拾われるべき本体そのもの。
 *   これを fetch で描くと、**JavaScriptを実行しないクローラには存在しない**。
 *   （実測: GPTBot/ClaudeBot/PerplexityBot/bingbot はいずれもJSを実行しない。
 *     aitimes.jp では同じ作りで、照合済み要約158件が丸ごと不可視になっていた）
 *   しかも当サイトの流入は9割がBingで、BingインデックスはCopilot/ChatGPT Searchの供給元。
 *   ⇒ 計算機部分はJSのまま、**事実の表だけ静的化**する。
 *
 *   node tools/gen_saitei_table.mjs          生成(冪等)
 *   node tools/gen_saitei_table.mjs --check  差分があれば失敗(テスト用)
 *
 * JSONが正本・HTMLは生成物。データを差し替えたら必ずこれを流す。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "docs/saitei-chingin/index.html");
const DATA = join(ROOT, "docs/assets/saitei_chingin_r07.json");
const CHECK = process.argv.includes("--check");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function fill(html, name, inner) {
  const re = new RegExp(`(<!--${name}:S-->)[\\s\\S]*?(<!--${name}:E-->)`);
  if (!re.test(html)) { console.error(`✗ マーカー ${name} が無い（組版が壊れている）`); process.exit(1); }
  return html.replace(re, (_, s, e) => s + inner + e);
}

const D = JSON.parse(readFileSync(DATA, "utf8"));
const rows = D.prefectures || [];
if (rows.length !== 47) { console.error(`✗ 都道府県が ${rows.length} 件（47件でない）`); process.exit(1); }
const m = D._meta, na = m.national_average;

const table = `<table style="width:100%;border-collapse:collapse;font-size:14px">
<thead><tr>
<th style="text-align:left;padding:6px;border-bottom:2px solid var(--line)">都道府県</th>
<th style="text-align:right;padding:6px;border-bottom:2px solid var(--line)">時間額</th>
<th style="text-align:right;padding:6px;border-bottom:2px solid var(--line)">引上げ</th>
<th style="text-align:left;padding:6px;border-bottom:2px solid var(--line)">発効日</th>
</tr></thead><tbody>
${rows.map((p) => `<tr>` +
  `<td style="padding:6px;border-bottom:1px solid var(--line)">${esc(p.full)}の最低賃金</td>` +
  `<td style="padding:6px;border-bottom:1px solid var(--line);text-align:right"><b>${p.wage}</b>円 <span style="color:var(--sub);font-size:12px">(${p.prev})</span></td>` +
  `<td style="padding:6px;border-bottom:1px solid var(--line);text-align:right">+${p.up}円 <span style="color:var(--sub);font-size:12px">+${p.rate}%</span></td>` +
  `<td style="padding:6px;border-bottom:1px solid var(--line)">${esc(p.effective_wa)}</td></tr>`).join("\n")}
</tbody></table>`;

const hi = rows.reduce((a, b) => (b.wage > a.wage ? b : a));
const lo = rows.reduce((a, b) => (b.wage < a.wage ? b : a));
const note = `全国加重平均は<b>${na.wage}円</b>（改定前${na.prev}円・+${na.up}円／+${na.rate}%）。` +
  `最高は${esc(hi.full)}の${hi.wage}円、最低は${lo.wage}円で、その差は<b>${hi.wage - lo.wage}円</b>です。` +
  `金額は${esc(m.year)}のもので、${esc(m.checked)}に厚生労働省の公式一覧と照合しました。`;

let html = readFileSync(PAGE, "utf8");
const before = html;
html = fill(html, "saitei:table", table);
html = fill(html, "saitei:note", note);

if (CHECK) {
  if (html !== before) {
    console.error("✗ 最低賃金の一覧HTMLがデータと不一致。node tools/gen_saitei_table.mjs を実行してコミット");
    process.exit(1);
  }
  console.log("✓ 最低賃金の一覧HTMLは最新"); process.exit(0);
}
if (html !== before) { writeFileSync(PAGE, html); console.log(`✓ 最低賃金の一覧を静的化: ${rows.length}件（${m.year}）`); }
else console.log("変更なし（既に最新）");
