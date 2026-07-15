/**
 * 出産手当金の単体テスト。
 *
 * ★額の算式は傷病手当金と同じ（102条2項が99条2項を準用）なので、日額のオラクルは
 *   協会けんぽの公表計算例をそのまま使う（自分の期待値で自分を採点しない・gbrain §26）:
 *     A. 協会けんぽ「出産手当金」計算例 … 支給開始日以前12月の標準報酬平均 30万円 → 日額 **6,667円**
 *        産前42＋産後56＝98日 → **653,366円**（gbrain hr/shussan-teate-kin）
 *     B. 協会けんぽ 計算例 … 平均17万円 → 5,670円 → **3,780円/日**（傷病手当金と同一算式の裏取り）
 *
 * ★期間のオラクル（102条1項）: 出産日が予定日より **遅れた日数はそのまま給付が増える**。
 *   標準報酬30万（日額6,667）で **10日遅れ＝+66,670円 / 10日早い＝−66,670円**（gbrain）。
 *   → 総日数 98 ± 10 を、日額×日数で突き合わせる。
 *
 * ★待期3日は無い（102条2項は99条1項を準用しない）。−3日していないことを固定する。
 */
import { readFileSync } from 'node:fs';
import {
  calcShussan, shussanKikan, daysBetween, addDays,
  SANZEN_TANTAI, SANZEN_TATAI, SANGO_DAYS,
} from '../docs/assets/shussan_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/shobyo_r08.json', import.meta.url), 'utf8'));

let checks = 0, failed = 0;
function eq(actual, expected, label) {
  checks++;
  if (actual !== expected) {
    failed++;
    console.error(`  ✗ ${label}\n      期待: ${expected}\n      実際: ${actual}`);
  }
}
function ok(cond, label) {
  checks++;
  if (!cond) { failed++; console.error(`  ✗ ${label}`); }
}
function throws(fn, label) {
  checks++;
  try { fn(); failed++; console.error(`  ✗ ${label}（例外が投げられなかった）`); }
  catch { /* ok */ }
}

// ── 日付ヘルパ ─────────────────────────────────────────────────────────
eq(daysBetween('2026-04-01', '2026-04-11'), 10, 'daysBetween: 10日後');
eq(daysBetween('2026-04-11', '2026-04-01'), -10, 'daysBetween: 符号（早い）');
eq(daysBetween('2026-02-28', '2026-03-01'), 1, 'daysBetween: 月またぎ（2026は平年）');
eq(addDays('2026-01-31', 1), '2026-02-01', 'addDays: 月末+1');
eq(addDays('2026-03-01', -1), '2026-02-28', 'addDays: 月頭−1');

// ── 支給期間（102条1項） ───────────────────────────────────────────────
// オンタイム・単胎: 産前42＋産後56＝98日
{
  const k = shussanKikan('2026-06-01', '2026-06-01', false);
  eq(k.sanzen, 42, '単胎オンタイム 産前42');
  eq(k.sango, 56, '産後56');
  eq(k.days, 98, '単胎オンタイム 合計98日');
  eq(k.delay, 0, 'delay=0（予定日どおり）');
  // 支給開始日＝予定日の41日前（産前42日の初日）
  eq(k.startDate, addDays('2026-06-01', -(SANZEN_TANTAI - 1)), '支給開始日＝予定日−41');
  eq(k.startDate, '2026-04-21', '支給開始日 実値');
  eq(k.endDate, '2026-07-27', '支給終了日＝出産日+56');
}
// 多胎: 産前98＋産後56＝154日
{
  const k = shussanKikan('2026-06-01', '2026-06-01', true);
  eq(k.sanzen, 98, '多胎 産前98');
  eq(k.days, 154, '多胎 合計154日');
  eq(k.startDate, addDays('2026-06-01', -(SANZEN_TATAI - 1)), '多胎 支給開始日＝予定日−97');
}
// 遅れ: 出産日が予定日より10日後 → 産前が10日延びる（合計108日）
{
  const k = shussanKikan('2026-06-01', '2026-06-11', false);
  eq(k.delay, 10, '10日遅れ delay=10');
  eq(k.sanzen, 52, '10日遅れ 産前52');
  eq(k.days, 108, '10日遅れ 合計108日');
}
// 早い: 出産日が予定日より10日前 → 産前が10日縮む（合計88日）
{
  const k = shussanKikan('2026-06-01', '2026-05-22', false);
  eq(k.delay, -10, '10日早い delay=-10');
  eq(k.sanzen, 32, '10日早い 産前32');
  eq(k.days, 88, '10日早い 合計88日');
}
// 出産日 未入力 → 予定日で見込み（98日・estimated）
{
  const k = shussanKikan('2026-06-01', undefined, false);
  eq(k.days, 98, '出産日未入力は予定日で98日');
  ok(k.shussanbiEstimated === true, '出産日未入力は見込みフラグ');
}
// 定数の値
eq(SANZEN_TANTAI, 42, 'SANZEN_TANTAI'); eq(SANZEN_TATAI, 98, 'SANZEN_TATAI'); eq(SANGO_DAYS, 56, 'SANGO_DAYS');

// ── 額のオラクル（協会けんぽ公表・99条2項と同一算式） ──────────────────
// A. 標準報酬30万（12月以上）→ 日額6,667 → 98日で653,366円
{
  const r = calcShussan({ yoteibi: '2026-06-01', shussanbi: '2026-06-01', monthly: 300000, months: 12 }, D);
  ok(r.eligible, 'A: 支給対象');
  eq(r.rule, 'full', 'A: 12月以上ルール');
  eq(r.nichigaku, 6667, 'A: 日額6,667（協会けんぽ）');
  eq(r.days, 98, 'A: 98日');
  eq(r.total, 653366, 'A: 合計653,366円（gbrain公表）');
  // ★待期3日を引いていない（98日ちょうど。傷病手当金なら95日相当になってしまう）
  eq(r.total, 6667 * 98, 'A: 待期控除なし');
}
// B. 平均17万 → 3,780/日（丸めの向きの裏取り。standards で厳密に）
{
  const r = calcShussan({
    yoteibi: '2026-06-01', shussanbi: '2026-06-01',
    standards: new Array(12).fill(170000),
  }, D);
  eq(r.nichigaku, 3780, 'B: 日額3,780（協会けんぽ計算例）');
}

// ── 遅れ/早いが給付額に効く（±66,670円） ─────────────────────────────
{
  const base = calcShussan({ yoteibi: '2026-06-01', shussanbi: '2026-06-01', monthly: 300000, months: 12 }, D).total;
  const late = calcShussan({ yoteibi: '2026-06-01', shussanbi: '2026-06-11', monthly: 300000, months: 12 }, D).total;
  const early = calcShussan({ yoteibi: '2026-06-01', shussanbi: '2026-05-22', monthly: 300000, months: 12 }, D).total;
  eq(late - base, 66670, '10日遅れ＝+66,670円');
  eq(base - early, 66670, '10日早い＝−66,670円');
}
// 多胎 154日
{
  const r = calcShussan({ yoteibi: '2026-06-01', shussanbi: '2026-06-01', monthly: 300000, months: 12, tatai: true }, D);
  eq(r.days, 154, '多胎154日');
  eq(r.total, 6667 * 154, '多胎 合計');
}

// ── 12月未満の二号頭打ち（32万円・shobyo と同じ参照データ） ───────────
{
  // 高月給・被保険者6月 → 自分の平均は高いが二号（32万）で頭打ち
  const r = calcShussan({
    yoteibi: '2026-06-01', shussanbi: '2026-06-01', monthly: 980000, months: 6,
  }, D);
  eq(r.rule, 'short', '12月未満ルール');
  ok(r.capped, '二号（32万）で頭打ち');
  // 32万 → 標準報酬32万 → ÷30=10,670 → ×2/3=7,113
  eq(r.nichigaku, 7113, '二号頭打ち日額7,113（令和7年4月以降・32万）');
}

// ── 報酬との調整（108条2項・差額支給） ────────────────────────────────
{
  // 日額6,667。産休中の報酬日額4,000 → 差額2,667のみ
  const r = calcShussan({
    yoteibi: '2026-06-01', shussanbi: '2026-06-01', monthly: 300000, months: 12,
    hoshuNichigaku: 4000,
  }, D);
  eq(r.paidNichigaku, 2667, '108条2項: 報酬との差額のみ（6,667−4,000）');
  eq(r.total, 2667 * 98, '108条2項: 差額×98日');
}
{
  // 報酬日額が手当金日額以上 → 全額不支給
  const r = calcShussan({
    yoteibi: '2026-06-01', shussanbi: '2026-06-01', monthly: 300000, months: 12,
    hoshuNichigaku: 7000,
  }, D);
  eq(r.paidNichigaku, 0, '108条2項: 報酬≥手当金なら不支給');
  eq(r.total, 0, '108条2項: 合計0');
  ok(r.chosei.zero, '全額不支給フラグ');
}

// ── 任意継続・104条継続給付（傷病手当金と同じ罠） ─────────────────────
{
  // 任意継続だが退職後の継続給付でない → 不支給
  const r = calcShussan({ yoteibi: '2026-06-01', monthly: 300000, months: 12, ninnikeizoku: true }, D);
  ok(!r.eligible, '任意継続（新規）は不支給');
  eq(r.reason, 'ninnikeizoku', '理由: 任意継続');
  eq(r.total, 0, '任意継続 合計0');
}
{
  // 任意継続＋退職後の継続給付＋1年以上 → 104条で支給される
  const r = calcShussan({
    yoteibi: '2026-06-01', shussanbi: '2026-06-01', monthly: 300000, months: 12,
    ninnikeizoku: true, taishokugo: true,
  }, D);
  ok(r.eligible, '104条継続給付は支給される');
  ok(r.via104, 'via104フラグ');
  eq(r.total, 653366, '104条 継続給付でも通常額');
}
{
  // 任意継続＋継続給付だが被保険者1年未満 → 104条不成立で不支給
  const r = calcShussan({
    yoteibi: '2026-06-01', monthly: 300000, months: 8,
    ninnikeizoku: true, taishokugo: true,
  }, D);
  ok(!r.eligible, '1年未満は104条不成立で不支給');
  eq(r.reason, 'keizoku_under1y', '理由: 継続給付1年未満');
}

// ── fail closed / 入力バリデーション ─────────────────────────────────
throws(() => calcShussan({ yoteibi: '2026-06-01', monthly: 300000 }, null), '参照データ無しは例外');
throws(() => calcShussan({ monthly: 300000 }, D), '出産予定日なしは例外');
throws(() => calcShussan({ yoteibi: '2026-06-01', months: 12 }, D), '月給も標準報酬もなしは例外');
throws(() => shussanKikan('2026/06/01', undefined, false), '不正な日付フォーマットは例外');

// ── まとめ ─────────────────────────────────────────────────────────
if (failed) {
  console.error(`\n出産手当金: ${failed} 件失敗 / ${checks} checks`);
  process.exit(1);
} else {
  console.log(`出産手当金: 全 ${checks} checks 緑`);
}
