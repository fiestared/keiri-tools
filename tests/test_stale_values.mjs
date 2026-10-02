// test_stale_values.mjs — 改定で古くなった値・未来形のまま過ぎた日付を、配信中のページから落とす（誤りの型 C の予防。2026-09-28）。
// ★なぜ: 記事レビューで「改定後なのに旧額のまま」（育休の上限 16,110円、健保組合の平均額 38万円、高額療養費の旧額）と
//   「日付が過ぎても『予定』のまま」が繰り返し出た（gbrain keiri-tools/article-error-patterns の C）。
//   改定は記事の外で起きるので、書いた人は気づけない。**旧値を登録しておけば、改定日を過ぎた瞬間から機械が拾う。**
// 規則1（落ちるべきもの／通るべきもの）: 「令和7年分は58万円、令和8年分は62万円」のような比較は正しい記事なので、
//   allow_near（過去・旧・比較の語）が近くにあれば通す。ページ全体が旧値を過去として説明する場合は allow_pages に理由つきで書く。
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { claimText } from "../tools/check_claims.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const CFG = JSON.parse(readFileSync(new URL("./stale_values.json", import.meta.url)));
const today = process.env.STALE_TODAY ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const files = execSync("git ls-files 'docs/**/index.html' 'docs/index.html'", { cwd: ROOT, encoding: "utf8" }).trim().split("\n")
  .filter((f) => !/^docs\/(embed|assets)\//.test(f));

// テストから直接呼べるように、判定は純関数にしておく
// ★allow_scope（2026-10-02 照合の所見 F8-b）: 許可語（まで・撤廃…）と correct は、**値と同じ文の中**にあるときだけ効かせる。
//   既定（window 全体）だと、120字以内の別の文に「まで」があるだけで、元の誤文を戻しても緑だった。
//   "sentence" = 文の区切りは「。！」（「？」では切らない＝設問は直後の答えと合わせて読む。FAQ の正しい答えを落とさない）。"line" = 改行も区切り（見出し・カード・表のセルを隣と混ぜない）。window を超えては広げない。
//   全角かっこの中の「。」は区切りにしない（「月8.8万円（＝適用拡大の賃金要件。2026年9月30日まで。）」は1つの文として読む）。
//   context（何の話か）は既定では window 全体で見る（文に主語が無くても拾うため）。context_scope: "sentence" を付けた行だけ、
//   context も同じ文の中で見る（「106万円」のように呼び名として頻出する値を、近くの無関係な語で落とさないため＝規則1）。
const maskParens = (t) => t.replace(/（[^（）]{0,300}）/g, (s) => s.replace(/[。！]/g, "、"));
export function sentenceAround(text, start, end, window, scope = "sentence") {
  const t = maskParens(text), stop = scope === "line" ? /[。！\n]/ : /[。！]/;
  const lo = Math.max(0, start - window), hi = Math.min(t.length, end + window);
  let a = start, b = end;
  while (a > lo && !stop.test(t[a - 1])) a--;
  while (b < hi && !stop.test(t[b])) b++;
  return text.slice(a, b);
}
export function staleHits(text, entry, page, day) {
  if (day < entry.stale_from || entry.allow_pages?.[page]) return [];
  const out = [], v = new RegExp(entry.value, "g"), ctx = new RegExp(entry.context), allow = new RegExp(entry.allow_near);
  for (const m of text.matchAll(v)) {
    const w = text.slice(Math.max(0, m.index - entry.window), m.index + m[0].length + entry.window);
    const near = entry.allow_scope ? sentenceAround(text, m.index, m.index + m[0].length, entry.window, entry.allow_scope) : w;
    const comparison = entry.correct && near.includes(entry.correct);   // 新旧を並べて書いた比較は正しい記事
    const about = entry.context_scope === "sentence" ? near : w;
    if (ctx.test(about) && !allow.test(near) && !comparison) out.push(w.replace(/\s+/g, " ").trim());
  }
  return out;
}
// ★claimText が見ない場所（2026-10-02 照合の所見 F8-c）。claimText は head（title・meta description 以外）と関連カードを外すので、
//   「記事の外に写した文」（JSON-LD の description・FAQ、og:description、tool-card／rel-list／次に読むの説明文）と、
//   ページ内スクリプトが描く結果の注記は、旧値のまま残っても緑だった（トップのツールカード・/kabe/ の JSON-LD・
//   配偶者控除の結果の注記が「106万円の壁」を現行の要件として書いたまま公開されていた）。
//   1件ずつ別の断片として返す（window が隣のカードへまたがらないように）。
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").trim();
export function extraPieces(html) {
  const out = [];
  const head = (html.match(/<head\b[\s\S]*?<\/head>/i) || [""])[0];
  for (const m of head.matchAll(/<meta\s+property="og:(?:title|description)"\s+content="([^"]*)"/gi)) out.push(m[1]);
  for (const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1]); } catch { out.push(m[1]); continue; }
    const walk = (o, k) => {
      if (typeof o === "string") { if (/^(description|text|name|headline)$/.test(k)) out.push(o); }
      else if (Array.isArray(o)) o.forEach((x) => walk(x, k));
      // FAQ は設問と答えを1つの断片にする（設問だけ切り出すと、答えにある許可語・正しい値が見えず、正しいページを落とす＝規則1）
      else if (o && typeof o === "object" && o["@type"] === "Question") out.push(`${o.name ?? ""} ${o.acceptedAnswer?.text ?? ""}`);
      else if (o && typeof o === "object") for (const [kk, vv] of Object.entries(o)) walk(vv, kk);
    };
    walk(j, "");
  }
  const body = html.replace(/<head\b[\s\S]*?<\/head>/i, " ");
  // 関連カード: a.tool-card／ul.rel-list の li／div.desc・p-desc（一覧・トップのカードの説明文）
  for (const m of body.matchAll(/<a\b[^>]*class="[^"]*\btool-card\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) out.push(strip(m[1]));
  for (const u of body.matchAll(/<ul\b[^>]*class="[^"]*\brel-list\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi))
    for (const m of u[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) out.push(strip(m[1]));
  for (const m of body.matchAll(/<div\b[^>]*class="[^"]*\b(?:desc|p-desc)\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)) out.push(strip(m[1]));
  // ページ内スクリプトが描く文（結果の注記）。${…} は値なので空白に、タグは外す
  for (const m of body.matchAll(/<script\b(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi))
    if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(m[1])) out.push(strip(m[1]
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")   // コメントは画面に出ない（URL の // は残す）
      .replace(/\$\{[^}]*\}/g, " ")));
  return out.map((s) => toHalfLocal(s)).filter(Boolean);
}
const toHalfLocal = (s) => s.replace(/[０-９．，]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const toISO = (y, mo, d) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export function futureTenseHits(text, cfg, page, day) {
  if (cfg.allow_pages?.[page] || cfg.known_issues?.[page]) return [];
  const out = [];
  for (const m of text.matchAll(new RegExp(cfg.pattern, "g"))) {
    const y = m[2] ? 2018 + Number(m[2]) : Number(m[1].slice(0, 4));
    const iso = toISO(y, Number(m[3]), Number(m[4]));
    if (iso < day) out.push(`${iso}: ${m[0].replace(/\s+/g, " ")}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = [];
  for (const f of files) {
    const html = readFileSync(ROOT + f, "utf8"), text = claimText(html);
    for (const e of CFG.entries) for (const w of staleHits(text, e, f, today)) errors.push(`${f}: 古い値「${e.value.replace(/\\/g, "")}」（${e.id}: ${e.reason}）… ${w}`);
    for (const w of futureTenseHits(text, CFG.future_tense, f, today)) errors.push(`${f}: 日付が過ぎたのに未来形のまま … ${w}`);
    for (const piece of extraPieces(html)) for (const e of CFG.entries) for (const w of staleHits(piece, e, f, today))
      errors.push(`${f}: 古い値「${e.value.replace(/\\/g, "")}」（${e.id}: ${e.reason}）［head・関連カード・ページ内スクリプト］… ${w}`);
  }
  for (const [p, why] of Object.entries(CFG.future_tense.known_issues ?? {})) console.log(`⚠ 既知・直す予定: ${p} — ${why}`);
  if (errors.length) { console.error(errors.map((e) => "✗ " + e).join("\n") + `\n★ ${errors.length}件。直すか、過去として書かれているなら allow_near／allow_pages に理由つきで足す（tests/stale_values.json）`); process.exit(1); }
  console.log(`✓ test_stale_values: ${files.length}ページ × 旧値${CFG.entries.length}件＋未来形の過去日付（基準日 ${today}）`);
}
