// test_check_claims.mjs — 主張の台帳の関門（tools/check_claims.mjs）そのものを守る。
// CLAUDE.md 規則1・2: 「落ちるべきものが落ちる」と「通るべきものが通る」を両方見る。
// 壊しケースの前に、無傷の台帳が緑であること（ベースライン）を確かめ、赤なら即座に降りる。
import assert from "node:assert/strict";
import { checkPage, claimText, findNumbers, findAbsolutes, ledgerPath } from "../tools/check_claims.mjs";

const HTML = `<!doctype html><html><head><title>年収106万円の壁</title>
<meta name="description" content="令和8年分の月8.8万円の基準を解説"></head><body>
<nav>ツール 1,000円</nav>
<p class="article-meta">公開日: <time>2026年9月1日</time></p>
<p>週20時間以上・月8.8万円以上なら加入します。原則として学生は対象外です。</p>
<table><tr><td>3万円未満</td><td>550円</td></tr></table>
<section class="related"><p>別の記事: 130万円の壁</p></section>
</body></html>`;

const good = () => ({
  page: "docs/column/test/index.html",
  claims: [
    { id: "c01", text: "短時間労働者の加入要件", numbers: ["20時間", "8.8万円", "106万円", "令和8年分"], applies: "令和8年分",
      source_url: "https://www.mhlw.go.jp/stf/tekiyoukakudai.html", source_quote: "週の所定労働時間が20時間以上であること",
      exceptions: "学生は原則対象外（休学・夜間等は対象）を本文に記載" },
    { id: "c02", text: "振込手数料の例", numbers: ["3万円", "550円"], applies: "2026年9月時点の料金表",
      source_url: "https://www.example-bank.co.jp/fee", source_quote: "3万円未満 550円（税込）",
      exceptions: "無し: 料金表に例外の注記なし" },
  ],
  absolutes: [{ phrase: "原則", context: "原則として学生は対象外", reviewed: "昼間学生以外（休学中・夜間・定時制）を本文に書いた" }],
});

// ── 抽出の性質（通るべきものが通る）──
const text = claimText(HTML);
const nums = findNumbers(text);
assert.ok(nums.has("8.8万円") && nums.has("550円") && nums.has("3万円") && nums.has("106万円") && nums.has("令和8年分"), `拾うべき数字: ${[...nums]}`);
assert.ok(!nums.has("1,000円"), "nav の数字を主張として拾っている");
assert.ok(!nums.has("130万円"), "関連記事（section.related）の数字を拾っている");
assert.ok(![...nums].some((n) => n.startsWith("2026年9月")), "公開日（article-meta）を主張として拾っている");
assert.deepEqual(findAbsolutes("原則として学生は対象外").map((a) => a.phrase), ["原則"]);
assert.equal(ledgerPath("docs/column/furikomi-tesuryo-hikaku/index.html"), "claims/column/furikomi-tesuryo-hikaku.json");
assert.equal(ledgerPath("docs/yukyu/index.html"), "claims/yukyu.json");

// ── ベースライン: 無傷の台帳は緑（ここが赤なら、下の壊しケースは全部嘘の満点になる）──
// example-bank は許可ドメインではないので、ベースライン用に go.jp へ差し替える
const base = good(); base.claims[1].source_url = "https://www.fsa.go.jp/fee";
const baseErr = checkPage({ html: HTML, ledger: base, page: "p" });
if (baseErr.length) { console.error("ベースラインが赤。壊しテストを中止:", baseErr); process.exit(1); }

// ── 壊しケース（落ちるべきものが落ちる）。各ケースは1か所だけ壊す ──
const cases = [
  ["台帳が無い", (l) => null, /台帳/],
  ["数字を台帳から1つ落とす", (l) => { l.claims[1].numbers = ["3万円"]; return l; }, /「550円」/],
  ["一次資料でないドメイン", (l) => { l.claims[0].source_url = "https://www.freee.co.jp/kb/"; return l; }, /許可ドメイン/],
  ["逐語の引用が空", (l) => { l.claims[0].source_quote = ""; return l; }, /source_quote/],
  ["例外を確かめた記録が無い", (l) => { delete l.claims[0].exceptions; return l; }, /exceptions/],
  ["金額なのに適用年が無い", (l) => { l.claims[1].applies = ""; return l; }, /applies/],
  ["『原則』の見直し記録が無い", (l) => { l.absolutes = []; return l; }, /言い切り「原則」/],
  ["見直し記録の文脈が別の文", (l) => { l.absolutes[0].context = "原則として全員が対象"; return l; }, /言い切り「原則」/],
];
let caught = 0;
for (const [name, breakIt, expect] of cases) {
  const l = breakIt(structuredClone(base));
  const errs = checkPage({ html: HTML, ledger: l, page: "p" });
  assert.ok(errs.some((e) => expect.test(e)), `壊し「${name}」を捕まえられない: ${JSON.stringify(errs)}`);
  caught++;
}

// ── 計算機のページ: tool_cases が2件未満なら赤、2件あれば緑 ──
const TOOL = HTML.replace("</body>", '<script type="module" src="../assets/kabe_core.js"></script></body>');
assert.ok(checkPage({ html: TOOL, ledger: base, page: "p" }).some((e) => /tool_cases/.test(e)), "計算機なのに tool_cases 無しで通った");
const withCases = structuredClone(base);
withCases.tool_cases = [
  { input: { monthly: 88000 }, expected: "加入", source_url: "https://www.mhlw.go.jp/x", note: "境界値" },
  { input: { monthly: 87999 }, expected: "対象外", source_url: "https://www.mhlw.go.jp/x", note: "境界値の1円下" },
];
assert.deepEqual(checkPage({ html: TOOL, ledger: withCases, page: "p" }), [], "tool_cases 2件で緑にならない");

// ── 足した行だけを要求するモード（既存ページの網羅）: 足した行に無い数字は要求しない ──
const partial = { claims: [base.claims[1]], absolutes: [] };
assert.deepEqual(checkPage({ html: HTML, ledger: partial, requiredText: claimText("<p>3万円未満は550円</p>"), page: "p" }), []);
assert.ok(checkPage({ html: HTML, ledger: partial, requiredText: claimText("<p>月8.8万円</p>"), page: "p" }).some((e) => /8\.8万円/.test(e)));

// 生成器が更新日だけ書き換えた既存ページ（足した行に数字も言い切りも無い）は、台帳が無くても通す。数字があれば台帳を要求する
assert.deepEqual(checkPage({ html: HTML, ledger: null, requiredText: claimText('<script type="application/ld+json">{"dateModified":"2026-09-28"}</script>'), page: "p" }), []);
assert.ok(checkPage({ html: HTML, ledger: null, requiredText: claimText("<p>月8.8万円</p>"), page: "p" }).some((e) => /台帳/.test(e)));

console.log(`✓ test_check_claims: 抽出の性質 / ベースライン緑 / 壊し ${caught}/${cases.length} 捕捉 / 計算機の tool_cases / 足した行モード`);
