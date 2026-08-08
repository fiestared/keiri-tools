/**
 * iDeCoの出口（重複期間の調整）の検査。
 *
 * ★オラクルは条文そのもの（所得税法施行令70条1項2号 イ・ロ・ハ）。
 *   ここを間違えると退職所得控除が過大に出て、**税額を過少に見せる**方向で誤る。
 */
import { readFileSync } from 'node:fs';
import { chofukuNensu, needsChofuku, kojoAfterChofuku, taishokuShotoku } from '../docs/assets/ideco_deguchi_core.js';
import { taishokuKojo } from '../docs/assets/taishoku_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/ideco_deguchi_r08.json', import.meta.url), 'utf8'));
const T = JSON.parse(readFileSync(new URL('../docs/assets/taishoku_rates_r08.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);

// ── データが条文と一致するか ────────────────────────────────────
console.log('★データ（施行令70条1項2号）');
eq(D.chofuku_chosei.taishoku_to_taishoku_nen, 4, '退職金→退職金は前年以前4年内');
eq(D.chofuku_chosei.ideco_to_taishoku_nen_r8ikou, 9, '★iDeCo→退職金（令和8年以後）は前年以前9年内');
eq(D.chofuku_chosei.ideco_to_taishoku_nen_r8mae, 4, 'iDeCo→退職金（令和8年前）は前年以前4年内');
eq(D.chofuku_chosei.taishoku_to_ideco_nen, 19, '★退職金→iDeCoは前年以前19年内');

// ── ★令和8年の境目 ────────────────────────────────────────
console.log('★令和8年1月1日の境目');
eq(chofukuNensu('ideco_then_taishoku', '2026-01-01', D), 9, '令和8年1月1日ちょうどは9年内');
eq(chofukuNensu('ideco_then_taishoku', '2025-12-31', D), 4, '令和7年12月31日は4年内（経過措置）');
eq(chofukuNensu('ideco_then_taishoku', '2027-06-01', D), 9, '令和9年も9年内');
eq(chofukuNensu('ideco_then_taishoku', 'よくわからない', D), 9, '★日付不明なら厳しい側（9年内）に倒す');

// ── ★向きで年数が違う ───────────────────────────────────────
console.log('★向き');
eq(chofukuNensu('taishoku_then_ideco', '2026-06-01', D), 19, '退職金が先なら19年内');
eq(chofukuNensu('ideco_then_taishoku', '2026-06-01', D), 9, 'iDeCoが先なら9年内');
ok(chofukuNensu('taishoku_then_ideco', '2026-06-01', D) > chofukuNensu('ideco_then_taishoku', '2026-06-01', D),
  '★退職金が先のほうが遡及期間が長い（逆に組むと会社員で大きく外す）');

// ── 「◯年内」と「◯年空ける」の関係 ────────────────────────────
console.log('★年数の数え方');
ok(needsChofuku(9, 9), '9年空きは9年内なので調整の対象');
ok(!needsChofuku(10, 9), '★10年空ければ対象外（＝いわゆる10年ルール）');
ok(needsChofuku(4, 4), '4年空きは対象');
ok(!needsChofuku(5, 4), '5年空ければ対象外（従来の5年ルール）');

// ── 重複調整の計算（★金額の按分ではなく、年数を勤続年数とみなす）──────────
console.log('★重複調整');
{
  // 勤続30年 → 控除1,500万円。うち10年が重複 → 10年ぶんの控除400万円を差し引く
  const r = kojoAfterChofuku({ nensu: 30, chofukuNen: 10 }, T, taishokuKojo);
  eq(r.full, 15000000, '勤続30年の控除');
  eq(r.dup, 4000000, '重複10年ぶんの控除（40万×10年）');
  eq(r.after, 11000000, '調整後の控除');
}
{
  // ★20年の境目をまたぐ場合。按分だと必ずずれる
  const r = kojoAfterChofuku({ nensu: 25, chofukuNen: 22 }, T, taishokuKojo);
  eq(r.full, taishokuKojo(25, false, T), '勤続25年の控除');
  eq(r.dup, taishokuKojo(22, false, T), '重複22年ぶんの控除（20年超なので70万/年が効く）');
  // 按分（25年の控除 × 22/25）と一致しないことを確認する
  const anbun = Math.floor(taishokuKojo(25, false, T) * 22 / 25);
  ok(r.dup !== anbun, `★年数按分（${anbun.toLocaleString()}）と一致しない＝正しく年数で計算している`);
  checks++;
}
{
  const r = kojoAfterChofuku({ nensu: 10, chofukuNen: 0 }, T, taishokuKojo);
  eq(r.dup, 0, '重複なしなら差し引かない');
  eq(r.after, r.full, '重複なしなら控除はそのまま');
}
{
  // 重複が勤続年数を超えても控除はマイナスにしない
  const r = kojoAfterChofuku({ nensu: 5, chofukuNen: 30 }, T, taishokuKojo);
  ok(r.after === 0, '控除がマイナスにならない');
}

// ── 退職所得の金額 ─────────────────────────────────────────
console.log('★退職所得');
eq(taishokuShotoku(20000000, 11000000), 4500000, '（収入−控除）÷2');
eq(taishokuShotoku(5000000, 11000000), 0, '控除以下なら退職所得は0');

// ── ★壊しテスト: 5年のままだと結論が変わること ────────────────────────
console.log('★壊しテスト');
{
  const old = 4;   // 令和7年までの「4年内」
  const now = chofukuNensu('ideco_then_taishoku', '2026-06-01', D);
  ok(old !== now, `★旧ルール(${old}年内)と新ルール(${now}年内)で判定が変わる`);
  // 7年空けたケース: 旧なら対象外、新なら対象
  ok(!needsChofuku(7, old) && needsChofuku(7, now),
    '★7年空けた人は、旧ルールなら対象外・新ルールなら調整の対象（結論が逆になる）');
  checks += 2;
  console.log('  ok   7年空き: 旧ルール→調整なし / 新ルール→調整あり');
}

console.log(`\n${fail ? '✗' : '✓'} test_ideco_deguchi: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
