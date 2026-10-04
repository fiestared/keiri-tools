#!/usr/bin/env node
/**
 * 数字を書いた文に、その数字の条件が同じ文にあるかを機械で確かめる（2026-10-04 Masahiro「すぐにどちらとも入れて」）。
 *
 * ★なぜ要るか（2026-10-04 実測）: 執筆便の1周目の照合で、新しい記事への指摘の 6〜8割が「条件・限定の抜け」だった
 *   （基礎控除 99件中79・源泉徴収とは 122件中91・医療保険 165件中108・課税証明書 73件中44。数字の誤りは2〜6件）。
 *   台帳（claims/*.json）には条件・例外が書いてあるのに、本文で同じ主張を冒頭・表・図・FAQ・まとめと言い換えるたびに
 *   条件が落ち、照合（1単位＝1文ずつ、その文だけで正しいかを見る）が言い換えの数だけ指摘して、修正が10周かかった。
 *
 * 検査: 台帳の各主張に `must_with`（その数字と必ず同じ文に書く語。例 ["令和8年分", "合計所得金額"]）があれば、
 *   その主張の `numbers` のうち金額・率・人数などの数値（年分だけの語は除く）が出てくる確認単位（segment_claims の1単位）ごとに、
 *   must_with の語がすべて同じ単位にあるかを見る。無ければ落とす。
 *   語の一致は NFKC・空白除去で比べる。言い換えを許すときは "令和8年分|令和8・9年分" のように | で並べる（どれか1つでよい）。
 *   must_with が無い主張は検査しない（新しく書いた主張には書く: prompts/write.md）。
 *
 * 使い方: node tools/check_claim_scope.mjs <page.html> [--ledger claims/…json]   （複数ページ可）
 *   ledger を省くと docs/<x>/index.html → claims/<x>.json を読む。exit 1 で抜けあり。
 */
import { readFileSync, existsSync } from 'node:fs';
import { segmentClaims, normalize } from './segment_claims.mjs';

const args = process.argv.slice(2);
const pages = []; let ledgerArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ledger') ledgerArg = args[++i]; else pages.push(args[i]);
}
if (!pages.length) { console.error('usage: check_claim_scope.mjs <page.html> [--ledger file]'); process.exit(2); }

const ledgerFor = (page) => ledgerArg || page.replace(/^docs\//, 'claims/').replace(/\/index\.html$/, '.json');
// 年分・年度・日付だけの語は「数字」として拾わない（それ自体が条件の語になりがち）
const isQuantity = (t) => /[0-9０-９]/.test(t) && !/^(令和|平成)?[0-9０-９]+年(分|度)?$|^[0-9０-９]{4}年[0-9０-９]+月([0-9０-９]+日)?$/.test(normalize(t));

let bad = 0, checked = 0, skipped = 0;
for (const page of pages) {
  const lp = ledgerFor(page);
  if (!existsSync(lp)) { console.log(`- ${page}: 台帳 ${lp} が無い（検査なし）`); continue; }
  const ledger = JSON.parse(readFileSync(lp, 'utf8'));
  const units = segmentClaims(readFileSync(page, 'utf8'), page);
  for (const c of ledger.claims || []) {
    const must = (c.must_with || []).filter(Boolean);
    if (!must.length) { skipped++; continue; }
    const nums = (c.numbers || []).filter(isQuantity).map(normalize);
    if (!nums.length) continue;
    for (const u of units) {
      const t = normalize(u.text || '');
      if (!nums.some((n) => t.includes(n))) continue;
      checked++;
      const missing = must.filter((m) => !m.split('|').some((alt) => t.includes(normalize(alt))));
      if (missing.length) {
        bad++;
        console.log(`✗ ${page} ${u.id}（${u.kind}/${u.zone}）主張 ${c.id}: 「${missing.join('」「')}」が同じ文に無い — ${(u.text || '').slice(0, 80)}`);
      }
    }
  }
}
console.log(`check_claim_scope: 数字を含む単位 ${checked} を検査、条件の抜け ${bad}（must_with の無い主張 ${skipped} は対象外）`);
process.exit(bad ? 1 : 0);
