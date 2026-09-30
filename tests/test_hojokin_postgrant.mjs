#!/usr/bin/env node
/**
 * /hojokin/ の一覧に「新規に応募できないもの」が混ざっていないか。
 *
 *   node tests/test_hojokin_postgrant.mjs
 *
 * ★なぜ要るか（2026-09-30 UI/UXレビュー #9）:
 *   381件の一覧に、交付後の「仕入控除税額報告」の様式が5件（うち2件は題が「×」始まり）、
 *   事業完了後の「状況報告」「事業完了後申請」、採択後の「中止届」「変更届」、練習用ダミーが
 *   新しい補助金の顔をして並んでいた。既存の test_hojokin は「（交付申請等）|撤回届」しか見ていなかった。
 *
 * ★2段で見る:
 *   ① データ: 公開JSONの subsidies に該当する行が無いこと（生成器を使わず、この検査の独自の網で見る）
 *   ② 規則: 取り込み器 tools/fetch_jgrants.py の junk_reason が、落とすべきものを落とし、
 *      **残すべきものを残す**こと（CLAUDE.md 規則1: 両方向）。定時ジョブ（update_hojokin.sh）は
 *      毎回この関数を通して書き出すので、②が緑なら将来の取得にも同じ規則が掛かる。
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

// ── ① データ ─────────────────────────────────────────────────────────
console.log('★公開データ（docs/assets/hojokin_jgrants.json）');
const D = JSON.parse(readFileSync(ROOT + 'docs/assets/hojokin_jgrants.json', 'utf8'));
const S = D.subsidies;
const head = (r) => `${r.subsidy_catch_phrase || ''} ${(r.summary || '').slice(0, 120)}`;
const NETS = [
  ['題の先頭が「×」', (r) => /^[\s　]*[×✕✖╳]/.test(r.title)],
  ['仕入控除税額報告', (r) => /仕入控除税額/.test(r.title) || /仕入控除税額報告用/.test(head(r))],
  ['状況報告', (r) => /状況報告/.test(r.title) || /状況報告用/.test(head(r))],
  ['事業完了後の手続き', (r) => /事業完了後/.test(r.title) || /完了後[^。]{0,20}手続き用/.test(head(r))],
  ['採択後の届出（中止届・変更届など）', (r) => /(撤回|中止|変更|廃止|辞退)届/.test(r.title)],
  ['練習用ダミー', (r) => /練習用/.test(r.title) || /実際に補助金が支払われることはありません/.test(head(r))],
];
for (const [name, hit] of NETS) {
  const bad = S.filter(hit);
  ok(bad.length === 0, `一覧に「${name}」が無い${bad.length ? `（${bad.length}件: ${bad.slice(0, 3).map((r) => r.title).join(' / ')}）` : ''}`);
}
const ex = D._meta.excluded || [];
ok(ex.every((e) => e.id && e.title && typeof e.reason === 'string' && e.reason.length > 0),
  `除外した行は全て理由を申告している（${ex.length}件）`);
ok(D._meta.count === S.length, `_meta.count が一覧の件数と一致（${D._meta.count} / ${S.length}）`);
const ids = new Set(S.map((r) => r.id));
ok(ex.every((e) => !ids.has(e.id)), '除外した行が一覧にも残っていない');

// ── ② 取り込み規則 ────────────────────────────────────────────────────
console.log('★取り込み規則（tools/fetch_jgrants.py の junk_reason）');
const row = (title, extra = {}) => ({ id: 'x', title, subsidy_catch_phrase: null, summary: null, ...extra });
const DROP = [
  row('×令和６年度勤務環境改善医師派遣等推進事業【仕入控除税額報告】'),
  row('　×令和６年度地域医療勤務環境改善体制整備特別事業'),
  row('令和５年度病院勤務者勤務環境改善事業【仕入控除税額報告】'),
  row('令和６年度○○事業', { summary: '【本申請フォームは、仕入控除税額報告用です】■目的・概要…' }),
  row('令和８年_設備投資_事業化状況報告'),
  row('デジタル技術活用推進助成金に係る状況報告等について'),
  row('○○助成事業について', { subsidy_catch_phrase: '○○助成事業の完了後の活用状況報告用のページです。' }),
  row('令和８年_設備投資_事業完了後申請'),
  row('危機管理対策促進事業_各種申請', { subsidy_catch_phrase: '事業完了後（助成金受け取り後）の各種手続き用のページです。' }),
  row('女性活躍情報公開促進奨励金　中止届'),
  row('女性の活躍推進に向けた職場環境改善奨励金　変更届'),
  row('女性活躍情報公開促進奨励金　撤回届'),
  row('［第十三回］事業再構築補助金（交付申請等）'),
  row('申請練習用補助金【補助金の支払いはありません】'),
];
const KEEP = [
  row('令和８年度ＡＩ×データ知財取得支援助成事業【第２回申請】'),                 // 題の途中の×
  row('今治市設備投資奨励金', { subsidy_catch_phrase: '年間各年度1,000万円を上限に×3年間にわたって交付します。' }),
  row('【令和８年度】INPIT外国出願補助金（中間手続補助）'),                        // 中間手続の費用を補助する公募
  row('令和8年度【2年目申請用】ES（社員満足度）向上による若手人材確保・定着事業助成金'),
  row('【追加募集】神奈川県障害福祉サービス事業所等に対するサービス継続支援事業補助金',
    { summary: '【申請にあたっての注意事項】 こちらは、追加募集用の申請フォームとなります。' }),
  row('岡崎ものづくり支援補助金（知的財産権取得事業）', { subsidy_catch_phrase: '特許出願・審査請求をサポートします' }),
  row('ものづくり補助金', { summary: 'x'.repeat(130) + '採択後は実績報告と状況報告が必要です。' }), // 概要の奥の説明文
  row('東京都若者世代職場定着促進助成金（令和８年度第５回申請受付）',
    { summary: '≪ 交付申請受付期間は 令和８年９月１日 8時30分～９月30日 です ≫' }),
];
const py = spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, 'tools')
from fetch_jgrants import junk_reason
print(json.dumps([junk_reason(r) for r in json.load(sys.stdin)], ensure_ascii=False))
`], { cwd: ROOT, input: JSON.stringify([...DROP, ...KEEP]), encoding: 'utf8' });
ok(py.status === 0, `junk_reason を呼べる${py.status ? `（${py.stderr.trim().split('\n').pop()}）` : ''}`);
const got = py.status === 0 ? JSON.parse(py.stdout) : [];
DROP.forEach((r, i) => ok(typeof got[i] === 'string' && got[i].length > 0, `落とす: ${r.title}${got[i] ? ` → ${got[i]}` : ''}`));
KEEP.forEach((r, i) => ok(got[DROP.length + i] === null, `残す: ${r.title}`));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
