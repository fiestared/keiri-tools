/**
 * 償却率表（genka_rates.json）を**独立した第二の出典**で照合するオラクルテスト。
 *
 * ★なぜ要るのか（2026-07-28）:
 *   本番 `/genka/` が使う `docs/assets/genka_rates.json` は、国税庁のタックスアンサー No.2106 添付
 *   『減価償却資産の償却率等表』**PDF を pdftotext で機械転記**して作った（2026-07-17）。
 *   転記元が1つしか無いあいだは、**読み違えても気づく経路が無い**（表は 耐用年数2〜50年 ×
 *   定額法1列 + 定率法200% 3列 = 196個の数値で、目視では守れない）。
 *
 *   そこで **e-Gov法令API v2 から耐用年数省令（昭和40年大蔵省令15号）の別表第八・別表第十を
 *   直接抽出したもの**を第二の出典として持ち、両者の一致を機械で固定する。
 *   - 出典A（本番データ）: 国税庁 No.2106 添付PDF → `docs/assets/genka_rates.json`
 *   - 出典B（オラクル）  : 耐用年数省令 別表第八・第十 → `tests/fixtures/shokyaku_rates_r08.json`
 *     （リビジョン 340M50000040015_20260522_508M60000040029。生成器 `tools/parse_shokyaku_tables.py`）
 *
 *   PDFの組版から取った値と、法令XMLの表から取った値が**別々の経路で一致する**なら、
 *   どちらか一方の読み違えは起きていない。片方だけを直したときにもここが落ちる。
 *
 * ★このテストが見ていないもの（網の外・CLAUDE.md 規則6）:
 *   - **定率法250%（別表第九）はオラクル側に無い**。出典Bは平成24年4月1日以後取得（別表第十）だけを
 *     抽出しており、平成19年4月1日〜平成24年3月31日取得に使う別表第九は照合できていない。
 *     ここは今も出典が1つ（No.2106添付PDF）＝**未照合**であることを明示しておく。
 *   - 耐用年数51〜100年。オラクルは100年まで持つが、本番は50年までしか扱わない（max_life）。
 *     本番の収録範囲を超える分は「本番に無いこと」を確認するだけで、値の照合はしない。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const LIVE = JSON.parse(readFileSync(new URL('../docs/assets/genka_rates.json', import.meta.url)));
const ORACLE = JSON.parse(readFileSync(new URL('fixtures/shokyaku_rates_r08.json', import.meta.url)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// ── 前提: 両者が期待する形をしていること（形が変わったら照合が空振りする）──────────────
t('出典A（本番）と出典B（オラクル）の両方に表がある', () => {
  assert.ok(LIVE.teigaku_rate && LIVE.teiritsu_200, '本番 genka_rates.json の表が無い');
  assert.ok(ORACLE.teigaku && ORACLE.teiritsu_200, 'オラクル fixture の表が無い');
});

const liveYears = Object.keys(LIVE.teigaku_rate).map(Number).sort((a, b) => a - b);
const oracleYears = Object.keys(ORACLE.teigaku).map(Number).sort((a, b) => a - b);
const overlap = liveYears.filter((y) => oracleYears.includes(y));

// ★空振り防止（規則2）: 照合対象が0件でも「全部一致」と言えてしまうので、母数を先に固定する。
t('照合する耐用年数が 2〜50年の49通り そろっている（母数の固定）', () => {
  assert.strictEqual(overlap.length, 49, `重なりが ${overlap.length} 通りしかない`);
  assert.strictEqual(overlap[0], 2, '2年から始まっていない');
  assert.strictEqual(overlap[overlap.length - 1], 50, '50年で終わっていない');
});

// ── 1. 定額法の償却率（別表第八）─────────────────────────────────────────────────
t('定額法 償却率 49個が 出典A（No.2106 PDF）と 出典B（別表第八）で一致', () => {
  const ng = [];
  for (const y of overlap) {
    const a = LIVE.teigaku_rate[String(y)];
    const b = ORACLE.teigaku[String(y)];
    if (a !== b) ng.push(`${y}年: 本番 ${a} ≠ 省令 ${b}`);
  }
  assert.strictEqual(ng.length, 0, '\n   ' + ng.join('\n   '));
});

// ── 2. 定率法200%の 償却率・改定償却率・保証率（別表第十）───────────────────────────
for (const [liveKey, oracleKey, label] of [
  ['rate', 'rate', '償却率'],
  ['kaitei', 'revised', '改定償却率'],
  ['hosho', 'guarantee', '保証率'],
]) {
  t(`定率法200% ${label} 49個が 出典A と 出典B（別表第十）で一致`, () => {
    const ng = [];
    for (const y of overlap) {
      const a = LIVE.teiritsu_200[String(y)][liveKey];
      const b = ORACLE.teiritsu_200[String(y)][oracleKey];
      if (a !== b) ng.push(`${y}年: 本番 ${a} ≠ 省令 ${b}`);
    }
    assert.strictEqual(ng.length, 0, '\n   ' + ng.join('\n   '));
  });
}

// ── 3. 耐用年数2年に改定償却率・保証率が「無い」ことも、両方の出典で一致 ──────────────
// 別表第十の2年の欄は「―」＝値が存在しない（償却率1.000で初年度に償却しきるため改定の余地がない）。
// ここを0で埋めると「保証額0円＝切替が起きない」と偶然同じ挙動になり、理由が消える。
t('耐用年数2年は 改定償却率・保証率が両出典とも null（0で埋めていない）', () => {
  assert.strictEqual(LIVE.teiritsu_200['2'].kaitei, null, '本番の2年 改定償却率が null でない');
  assert.strictEqual(LIVE.teiritsu_200['2'].hosho, null, '本番の2年 保証率が null でない');
  assert.strictEqual(ORACLE.teiritsu_200['2'].revised, null, 'オラクルの2年 改定償却率が null でない');
  assert.strictEqual(ORACLE.teiritsu_200['2'].guarantee, null, 'オラクルの2年 保証率が null でない');
  assert.strictEqual(LIVE.teiritsu_200['2'].rate, 1.0, '本番の2年 償却率が 1.000 でない');
});

// ── 4. 本番の収録範囲（max_life）を超える耐用年数は、本番側に無い ───────────────────
t('本番は max_life（50年）までで、51年以上は収録していない', () => {
  assert.strictEqual(LIVE.max_life, 50, 'max_life が 50 でない');
  for (const y of [51, 60, 100]) {
    assert.ok(!(String(y) in LIVE.teigaku_rate), `本番に ${y}年 が入っている（max_life と矛盾）`);
    assert.ok(String(y) in ORACLE.teigaku, `オラクルに ${y}年 が無い（抽出漏れ）`);
  }
});

// ── 5. 未照合の範囲を明示する（黙って「全部照合済み」に見せない）────────────────────
t('★定率法250%（別表第九）はオラクルに無く未照合であることを明示', () => {
  assert.ok(LIVE.teiritsu_250, '本番に250%の表が無い');
  assert.ok(!('teiritsu_250' in ORACLE), 'オラクルに250%が入った。入れたならこのテストに照合を足すこと');
});

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
