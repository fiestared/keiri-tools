/**
 * `tests/test_nenkin.mjs` の壊しテスト。
 *
 * 87件が初回から全部緑だったので、**検査が本物を捕まえられるのか**を確かめる
 * （CLAUDE.md 規則1・規則2。緑は「正しい」の証拠ではなく「この網では何も引っかからなかった」の意味）。
 *
 * 壊し方は、年金額の計算で実際に出回っている誤りをそのまま再現する:
 *   1. 免除期間に率を掛けるだけで、号ごとの上限（27条ただし書）を見ない
 *   2. 号の上限を「率を掛けたあとの月数」で消費する（もとの月数ではなく）
 *   3. 全額免除にも超過分の号があることにする（27条8号には無い）
 *   4. 合算した月数の480上限を落とす
 *   5. 満額を1つしか持たない（生年月日で2つある）
 *   6. 報酬比例を5.481の乗率だけで通す（平成15年3月以前は7.125）
 *   7. 繰上げ・繰下げを付加年金に掛けない
 *   8. 繰下げの120月上限を落とす（76歳以降が青天井になる）
 *   9. 繰上げにも120月の上限を入れる（繰上げには上限の定めが無い）
 *  10. 端数を四捨五入でなく切捨てにする
 *  11. 収録範囲外でも黙って金額を返す（fail closed をやめる）
 *  12. 繰上げの0.5%経過措置の境界日を1日ずらす
 *  13. 免除の率を1つ間違える（半額免除を4分の3でなく2分の1に）
 *
 * 実行: node tests/break_nenkin.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(root, 'docs', 'assets', 'nenkin_core.js');
const DATA = join(root, 'docs', 'assets', 'nenkin_r08.json');
const run = () => spawnSync(process.execPath, ['tests/test_nenkin.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

const coreSrc = readFileSync(CORE, 'utf8');
const dataSrc = readFileSync(DATA, 'utf8');
const restore = () => { writeFileSync(CORE, coreSrc); writeFileSync(DATA, dataSrc); };

// ── ベースライン（規則2: 常に赤い検査は何を壊しても赤くなり、嘘の満点を出す）──────
const base = run();
if (base.status !== 0) {
  console.log('❌ ベースラインが赤。壊しテストは意味を成さないので中止する。');
  console.log((base.stdout || '') + (base.stderr || ''));
  process.exit(1);
}
t('ベースライン: 無傷の状態で test_nenkin が緑', true);

/** 一意に特定できる文字列だけを壊す（規則8: 壊し方も一意でなければならない）。 */
function breakFile(label, path, src, name, from, to) {
  if (!src.includes(from)) {
    t(name, false, `壊し対象の文字列が${label}に無い（壊せていない）: ${from}`);
    return;
  }
  const count = src.split(from).length - 1;
  if (count !== 1) {
    t(name, false, `壊し対象が${count}箇所にあり一意でない: ${from}`);
    return;
  }
  try {
    writeFileSync(path, src.replace(from, to));
    const r = run();
    t(name, r.status !== 0, '壊したのに緑のまま＝この誤りは検査をすり抜ける');
  } finally { restore(); }
}
const breakCore = (name, from, to) => breakFile('コア', CORE, coreSrc, name, from, to);
const breakData = (name, from, to) => breakFile('データ', DATA, dataSrc, name, from, to);

// ── 1. 号ごとの上限を見ない（率を掛けるだけ）────────────────────────────────
breakCore('1. 免除に率を掛けるだけで号の上限を見ない',
  'const room = Math.max(0, limit - used);',
  'const room = Infinity;');

// ── 2. 上限を「率を掛けたあとの月数」で消費する ──────────────────────────────
breakCore('2. 号の上限を採用後の月数で消費する（もとの月数ではなく）',
  '    used += raw;\n    breakdown.push({',
  '    used += add;\n    breakdown.push({');

// ── 3. 全額免除にも超過分の号があることにする ────────────────────────────────
breakData('3. 全額免除に超過分の率を与える（27条8号には無い）',
  '"rate": 0.5,\n        "excess_rate": null,',
  '"rate": 0.5,\n        "excess_rate": 0.25,');

// ── 4. 合算した月数の480上限を落とす ─────────────────────────────────────────
breakCore('4. 合算月数の480上限を落とす',
  '  const capped = credited > limit;\n  if (capped) credited = limit;',
  '  const capped = false;');

// ── 5. 満額を1つしか持たない ────────────────────────────────────────────────
breakCore('5. 生年月日にかかわらず新規裁定の満額を使う',
  "if (typeof birthDate === 'string' && birthDate && birthDate <= kisai.born_to) {",
  'if (false) {');

// ── 6. 報酬比例を5.481だけで通す ────────────────────────────────────────────
breakData('6. 平成15年3月以前の乗率も5.481にする',
  '"rate_per_mille": 7.125,',
  '"rate_per_mille": 5.481,');

// ── 7. 繰上げ・繰下げを付加年金に掛けない ────────────────────────────────────
breakCore('7. 付加年金に増額率・減額率を掛けない',
  'const fukaAdj = roundYen(fuka * adjust.factor);',
  'const fukaAdj = fuka;');

// ── 8. 繰下げの120月上限を落とす ────────────────────────────────────────────
breakCore('8. 繰下げの120月上限を落とす（76歳以降が青天井）',
  'const months = Math.min(m, data.kurisage.max_months);',
  'const months = m;');

// ── 9. 繰上げにも上限を入れる（繰上げには上限の定めが無い）────────────────────
breakCore('9. 繰上げにも120月の上限を入れる',
  '    const months = -m;',
  '    const months = Math.min(-m, 60);');

// ── 10. 端数を切捨てにする ──────────────────────────────────────────────────
breakCore('10. 端数処理を四捨五入から切捨てにする',
  'return Math.floor(n + 0.5);',
  'return Math.floor(n);');

// ── 11. 収録範囲外でも金額を返す ────────────────────────────────────────────
breakCore('11. 収録範囲外でも黙って金額を返す（fail closed をやめる）',
  '  if (outOfScope.length > 0) {\n    return { ok: false, outOfScope };\n  }',
  '  if (false) { return { ok: false, outOfScope }; }');

// ── 12. 経過措置の境界日を1日ずらす ─────────────────────────────────────────
breakData('12. 繰上げ0.5%の経過措置の境界を1日ずらす',
  '"born_to": "1962-04-01",',
  '"born_to": "1962-03-31",');

// ── 13. 免除の率を1つ間違える ───────────────────────────────────────────────
breakData('13. 半額免除の率を4分の3でなく2分の1にする',
  '"rate": 0.75,\n        "excess_rate": 0.25,',
  '"rate": 0.5,\n        "excess_rate": 0.25,');

// ── 14. 満額の実額を改定率と食い違わせる（オラクルが効いているか）──────────────
breakData('14. 満額の実額だけを100円動かす（改定率オラクルが捕まえるか）',
  '"yen": 847300,',
  '"yen": 847400,');

// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${pass}/${pass + fail} 件の壊しを検査が捕捉`);
process.exit(fail ? 1 : 0);
