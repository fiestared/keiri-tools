#!/usr/bin/env node
/**
 * サイト内検索の正解セット作り ②と④。
 *
 *   node tools/search_gold/build.mjs prep  <work>            gsc_qp.json → forclef.json（Clef に聞く候補）
 *   node tools/search_gold/build.mjs merge <work> <clef_out.jsonl>...
 *        → tests/fixtures/site_search_gold.json（正解セット。split=test は評価専用）
 *        → tools/search_queries_gsc.json（split=train の語。索引に焼き込む）
 *
 * 正解の決め方（2026-10-14 初版。gbrain implementation/keiri-site-search-quality-2026-10-14）:
 *   - 起点は GSC の「その語で Google が出した keiri-tools のページ」（クリック数→表示回数→平均順位の順で1つ）。
 *     Google の順位と実際の読者の着地を、意図の代わりに使う。トップ（/）とコラム一覧（/column/）は除く。
 *   - それを Clef-flash に「最初に開くべきページはどれか」を候補5件から選ばせて検める（judge_clef.py）。
 *       一致（Clef の1位＝GSC・確率0.4以上）            → 正解＝GSC
 *       不一致（Clef が別ページを0.4以上・表示2回以上） → 正解＝GSC、別解（alt）＝Clef の選択（どちらも1位で可）
 *       　〃（表示1回）                                  → Clef が0.6以上なら同上、0.4〜0.6 なら GSC だけ
 *       Clef が「どれも違う」0.5以上                     → 表示2回以上は GSC のまま残す／1回は捨てる
 *       迷い（1位が0.4未満）                             → 表示2回以上は GSC（2位が0.3以上なら別解）／1回は捨てる
 *   - 人の目で見て Clef の選択が明らかに誤りのもの（VETO）・語として意味を成さないもの（DROP）を外す。
 *   - 法令の条文を貼った語（e-gov）・URL・CSV名・基準価額の日付つきは、人がサイト内検索で打つ語ではないので捨てる。
 *   - train / test は「空白を除いた語」の md5 の偶奇で半々に分ける（同じ語の表記ゆれが両側に割れないように）。
 *   - GSC 以外（手で書いた読み・略語・誤字の語、GA4 のサイト内検索の実際の語）は fixture の既存行を保つ。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { search, normalize } from "../../docs/assets/qa_search.js";

const ROOT = new URL("../../", import.meta.url).pathname;
const FIXTURE = join(ROOT, "tests/fixtures/site_search_gold.json");
const GSC_OUT = join(ROOT, "tools/search_queries_gsc.json");
const index = JSON.parse(readFileSync(join(ROOT, "docs/assets/qa_index.json"), "utf8"));
const byUrl = new Map(index.map((e) => [e.url, e]));
// 検索と同じ正規化（NFKC・誤字の直し）で揃える。「シュミレーション」と「シミュレーション」が train と test に割れると漏れになる
const compact = (q) => normalize(q).replace(/ /g, "");
const md5 = (s) => createHash("md5").update(s).digest("hex");
const NOT_HUMAN = (q) => /^[\/%+"]|e-gov|基準価額|\.csv|https?:|www\./i.test(q);

const VETO = new Set(["産前 産後 休暇 手当 計算", "保険 税金 計算", "源泉徴収票 住民税控除額 欄", "償却保証額", "年間休日 計算ツール",
  "年末 調整 特定 扶養 親族", "区分ア 年収", "41-26", "計算方法知りたい", "手数料の比較", "特定 役務 の 提供", "全額 所得 控除",
  "控除シミュレーション", "日 当 勘定 科目", "産休 お金 計算", "所得税 表 年収", "休日 日数 計算", "ふるさと納税 社会保険料", "ふるさと 納税 年収 手取り"]);
const DROP = new Set(["確定申告 時期 2026", "オルカン 評価額"]);
const MANUAL = { "圧縮 積立金 勘定科目": "/column/assyuku-kicho-houshiki/" };
const EXTRA_ALT = [[/定着/, "/saishushoku/", "/teichaku/"]]; // GSC が再就職手当に出していた定着手当の語は、定着手当ツールも正解

const [cmd, work, ...rest] = process.argv.slice(2);
if (cmd === "prep") {
  const rows = JSON.parse(readFileSync(join(work, "gsc_qp.json"), "utf8"));
  const byQ = new Map();
  for (const x of rows) {
    const [q, page] = x.keys;
    const p = page.replace("https://keiri-tools.com", "").replace(/[#?].*$/, "");
    if (NOT_HUMAN(q) || !byUrl.has(p)) continue;
    const k = compact(q);
    if (!byQ.has(k)) byQ.set(k, { q, imp: 0, clicks: 0, pages: new Map() });
    const o = byQ.get(k);
    o.imp += x.impressions; o.clicks += x.clicks;
    const pp = o.pages.get(p) || { c: 0, i: 0, posw: 0 };
    pp.c += x.clicks; pp.i += x.impressions; pp.posw += x.position * x.impressions;
    o.pages.set(p, pp);
  }
  const out = [];
  for (const o of byQ.values()) {
    const ps = [...o.pages].sort((a, b) => b[1].c - a[1].c || b[1].i - a[1].i || a[1].posw / a[1].i - b[1].posw / b[1].i).map((x) => x[0]);
    const top = search(index, o.q, 3).results.map((e) => e.url);
    const cands = [...new Set([ps[0], ...ps.slice(1, 3), ...top])].slice(0, 5)
      .map((u) => ({ u, t: (byUrl.get(u).type === "tool" ? "[ツール] " : "[記事] ") + byUrl.get(u).title.slice(0, 48) }))
      .sort((a, b) => md5(o.q + a.u).localeCompare(md5(o.q + b.u)));
    out.push({ q: o.q, gsc: ps[0], imp: Math.max(o.imp, o.clicks > 0 ? 2 : 0), cands });
  }
  out.sort((a, b) => b.imp - a.imp);
  writeFileSync(join(work, "forclef.json"), JSON.stringify(out, null, 1));
  console.log(`✓ forclef.json ${out.length}語（表示2回以上 ${out.filter((x) => x.imp >= 2).length}）`);
} else if (cmd === "merge") {
  const impOf = new Map();
  for (const f of ["forclef.json", "forclef1.json"]) if (existsSync(join(work, f))) for (const x of JSON.parse(readFileSync(join(work, f), "utf8"))) impOf.set(x.q, x.imp);
  const judged = rest.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l)));
  const gsc = [];
  for (const r of judged) {
    const q = r.q;
    if (NOT_HUMAN(q) || DROP.has(q) || !byUrl.has(r.gsc)) continue;
    const imp = r.imp ?? impOf.get(q) ?? 1;
    const ent = Object.entries(r.probs).sort((a, b) => b[1] - a[1]);
    const [bu, bp] = ent[0];
    let row = null;
    if (MANUAL[q]) row = { gold: MANUAL[q], basis: "manual" };
    else if (bu === r.gsc && bp >= 0.4) row = { gold: r.gsc, basis: "gsc+clef" };
    else if (r.none >= 0.5) row = imp >= 2 ? { gold: r.gsc, basis: "gsc(clef-none)" } : null;
    else if (bu !== r.gsc && bp >= 0.4) {
      if (VETO.has(q)) row = imp >= 2 ? { gold: r.gsc, basis: "gsc(clef-veto)" } : null;
      else if (imp >= 2 || bp >= 0.6) row = { gold: r.gsc, alt: [bu], basis: "gsc|clef" };
      else if ((r.probs[r.gsc] || 0) >= 0.2) row = { gold: r.gsc, basis: "gsc(clef-other)" };
    } else if (imp >= 2) {
      const second = ent.find(([u, p]) => u !== r.gsc && p >= 0.3);
      row = { gold: r.gsc, ...(second ? { alt: [second[0]] } : {}), basis: "gsc(clef-low)" };
    }
    if (!row) continue;
    for (const [re, g, a] of EXTRA_ALT) if (re.test(q) && row.gold === g) row.alt = [...new Set([...(row.alt || []), a])];
    gsc.push({ q, ...row, src: "gsc", imp, split: parseInt(md5(compact(q)).slice(0, 8), 16) % 2 ? "test" : "train" });
  }
  gsc.sort((a, b) => b.imp - a.imp);
  const seen = new Set();
  const keep = gsc.filter((x) => { const k = compact(x.q); if (seen.has(k)) return false; seen.add(k); return true; });
  const prev = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, "utf8")).queries : [];
  const others = prev.filter((x) => x.src !== "gsc");
  const queries = [...keep, ...others];
  for (const x of queries) for (const u of [x.gold, ...(x.alt || [])]) if (!byUrl.has(u)) { console.error(`✗ ${x.q}: ${u} が索引に無い`); process.exit(1); }
  writeFileSync(FIXTURE, JSON.stringify({
    _doc: "サイト内検索の正解セット。split=test は tests/test_site_search_quality.mjs の評価専用（索引に焼き込まない）。split=train は tools/search_queries_gsc.json に写して索引に焼く。作り方は tools/search_gold/build.mjs の冒頭。src: gsc＝Google 検索の実際の語と着地ページ（Clef-flash で検めた）／hand＝読み・略語・誤字・言い換え（手で書いた仕様）／ga4-site-search＝サイト内検索で実際に打たれた語。alt があれば、alt のページが1位でも正解。",
    built: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
    queries,
  }, null, 0).replace(/\},\{/g, "},\n{") + "\n");
  const train = keep.filter((x) => x.split === "train");
  writeFileSync(GSC_OUT, JSON.stringify({
    _doc: "Google 検索（GSC）で実際に打たれた語と、その語で表示されたページ。Clef-flash で「最初に開くべきページか」を検めて残したもの（tools/search_gold/build.mjs）。正解セットの split=train の分だけ。strong=true は GSC と Clef が一致した語で、空白を除いた完全一致なら1位にする。それ以外は部分一致の言い換えとして効く。",
    queries: train.map((x) => ({ q: x.q, url: x.gold, strong: x.basis === "gsc+clef" })),
  }, null, 0).replace(/\},\{/g, "},\n{") + "\n");
  const n = (f) => queries.filter(f).length;
  console.log(`✓ 正解セット ${queries.length}語（GSC test ${n((x) => x.src === "gsc" && x.split === "test")}・train ${train.length}・手/GA4 ${others.length}）`);
} else {
  console.error("使い方: build.mjs prep <work> | build.mjs merge <work> <clef_out.jsonl>...");
  process.exit(2);
}
