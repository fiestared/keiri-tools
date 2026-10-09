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
 *   2026-10-09: 単位に局所文脈（segment_claims の context。表の表題・`data-review-context="before-table"|"after-table"` の段落・FAQ の設問と答え）が
 *   あれば、must_with の語は「同じ単位か、その文脈」にあればよい（tools/SEGMENTS.md）。離れた段落・記事の冒頭は数えない。
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

// ★2026-10-04〜05 の high 608件の分類: 「自分で計算した境界・差額・設例の誤り」（例: 境界 約196万6,667円 を「約203万円」）と
//   「例外がある主張の言い切り」（「全域で5万円下がる」「各帯の起点で計算した値」）が多かった。
//   - 台帳で `derived: true`（正本に書いてある数字ではなく、書き手が計算・推計した数字）の主張は `calc`（計算式とスクリプトの実行結果）が必須
//   - 数字を含む文の全称表現（全域・すべて・各〜・いずれも・必ず・常に・一律）は一覧に出す（落とさない。書き手が例外を確かめる）
const UNIVERSAL = /全域|すべての|全ての|全部の|各帯|各行|いずれも|必ず|常に|一律|どの[^、。]{0,6}でも/u;
let bad = 0, checked = 0, skipped = 0, nocalc = 0, universal = 0, missingMust = 0;
for (const page of pages) {
  const lp = ledgerFor(page);
  if (!existsSync(lp)) { console.log(`- ${page}: 台帳 ${lp} が無い（検査なし）`); continue; }
  const ledger = JSON.parse(readFileSync(lp, 'utf8'));
  const units = segmentClaims(readFileSync(page, 'utf8'), page);
  for (const c of ledger.claims || []) {
    if (c.derived === true && !(typeof c.calc === 'string' ? c.calc.trim() : (c.calc && Object.keys(c.calc).length))) {
      nocalc++; console.log(`✗ ${page} 主張 ${c.id}: derived（書き手が計算した数字）なのに calc（計算式と実行結果）が無い — ${(c.text || '').slice(0, 60)}`);
    }
  }
  for (const u of units) {
    const t = u.text || '';
    if (/[0-9０-９]/.test(t) && UNIVERSAL.test(t)) { universal++; console.log(`△ ${page} ${u.id}: 数字の文に全称表現「${t.match(UNIVERSAL)[0]}」— 例外が無いか正本で確かめる: ${t.slice(0, 70)}`); }
  }
  for (const c of ledger.claims || []) {
    const must = (c.must_with || []).filter(Boolean);
    // 2026-10-05: 数字（金額・率・期限）を含む主張は must_with 必須（台帳の checked が 2026-10-05 以後＝新しく書いた・見直した台帳）。
    //   国民年金保険料の記事で must_with が21主張中13にしか無く、無い主張で「4月開始24か月分」「休日は翌営業日」「端数処理」が落ちて high 34件
    if (!must.length) {
      if ((ledger.checked || '') >= '2026-10-05' && (c.numbers || []).some(isQuantity)) {
        missingMust++; console.log(`✗ ${page} 主張 ${c.id}: 数字があるのに must_with が無い — ${(c.text || '').slice(0, 60)}`);
      }
      skipped++; continue;
    }
    const nums = (c.numbers || []).filter(isQuantity).map(normalize);
    if (!nums.length) continue;
    for (const u of units) {
      const t = normalize(u.text || '');
      if (!nums.some((n) => t.includes(n))) continue;
      checked++;
      // 2026-10-09 局所文脈: 単位に添えた文脈（表の表題・印を付けた表の直前の説明／直後の注・FAQ の設問と答え）にある語は「書いてある」と数える。
      //   数字が出てくるかどうか（上の nums）は従来どおり単位の本文だけで見る。記事の別の場所の文は数えない
      const scope = t + normalize(u.context || '');
      const missing = must.filter((m) => !m.split('|').some((alt) => scope.includes(normalize(alt))));
      if (missing.length) {
        bad++;
        console.log(`✗ ${page} ${u.id}（${u.kind}/${u.zone}）主張 ${c.id}: 「${missing.join('」「')}」が同じ文に無い — ${(u.text || '').slice(0, 80)}`);
      }
    }
  }
}
console.log(`check_claim_scope: 数字を含む単位 ${checked} を検査、条件の抜け ${bad}・calc の無い derived ${nocalc}（must_with の無い主張 ${skipped} は対象外）・全称表現の確認 ${universal}（△は落とさない）`);
console.log(`  must_with の無い数字の主張（台帳 checked 2026-10-05 以後）: ${missingMust}`);
process.exit(bad || nocalc || missingMust ? 1 : 0);
