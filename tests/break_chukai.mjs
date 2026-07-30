/**
 * `tests/test_chukai.mjs` の壊しテスト。
 *
 * 85件が初回から全部緑だったので、**検査が本物を捕まえられるのか**を確かめる
 * （CLAUDE.md 規則1・規則2。緑は「正しい」の証拠ではなく「この網では何も引っかからなかった」の意味）。
 *
 * 壊し方は、仲介手数料の計算で実際に出回っている誤りをそのまま再現する:
 *   1. 代金の額から消費税等相当額を除かない（新築・業者売主で上限を過大に出す）
 *   2. 税込の割合で出した額に、さらに1.1を掛ける（消費税の二重計上）
 *   3. 速算式「3%＋6万円」を税込の割合と加算額で書く（本体と税込の取り違え）
 *   4. 上限額の端数を切り上げる（「〜以内」の上限を1円超える）
 *   5. 区分の境界を「200万円未満」にする（告示は「以下」）
 *   6. 代理で、相手方からも媒介報酬を受ける場合の制限（第三ただし書）を告げない
 *   7. 低廉な空家等の特例を、合意の有無にかかわらず自動で適用する
 *   8. 低廉な空家等の対象を、消費税を含んだ総額で判定する
 *   9. 低廉な空家等の上限を30万円（1.1倍を掛け忘れ）にする
 *  10. 低廉な空家等の対象を令和6年改正前の400万円のままにする
 *  11. 貸借の居住用で、承諾がなくても一方から1.1か月分受け取れることにする
 *  12. 貸借で、承諾があれば双方の合計も2.2か月分になることにする
 *  13. 権利金の特例（第六）を居住用の建物にも適用する
 *  14. 非居住用の借賃から消費税等相当額を除かない
 *  15. 施行日（令和6年7月1日）より前でも計算する
 *
 * 実行: node tests/break_chukai.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(root, 'docs', 'assets', 'chukai_core.js');
const DATA = join(root, 'docs', 'assets', 'chukai_r08.json');
const run = () => spawnSync(process.execPath, ['tests/test_chukai.mjs'], { cwd: root, encoding: 'utf8' });

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
t('ベースライン: 無傷の状態で test_chukai が緑', true);

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

// ── 1. 代金の額から消費税を除かない ───────────────────────────────────────
breakCore('1. 代金の額から消費税等相当額を除かない（税込総額で計算する）',
  '  const zei = shohizeiBun(tatemono, DATA);',
  '  const zei = 0;');

// ── 2. 消費税の二重計上 ──────────────────────────────────────────────────
breakCore('2. 税込の割合で出した額に、さらに1.1を掛ける',
  '    zeikomi += taisho * b.ritsu;',
  '    zeikomi += taisho * b.ritsu * 1.1;');

// ── 3. 速算式を税込の割合で書く ──────────────────────────────────────────
breakCore('3. 速算式を「3.3%＋6.6万円」で本体として計算する',
  '  const hontai = yen(gaku * s.ritsu_hontai + s.kasan_hontai);',
  '  const hontai = yen(gaku * 0.033 + 66000);');

// ── 4. 上限の端数を切り上げる ────────────────────────────────────────────
breakCore('4. 上限額の円未満を切り上げる（「〜以内」を超える）',
  'const yen = (v) => Math.floor(v + 1e-6);',
  'const yen = (v) => Math.ceil(v);');

// ── 5. 区分の境界を「未満」にする ────────────────────────────────────────
breakCore('5. 区分の境界を「200万円未満」にする（告示は「以下」）',
  '    const taisho = Math.max(0, Math.min(gaku, ue) - b.koeru); // この区分に入る金額',
  '    const taisho = Math.max(0, Math.min(gaku, ue - 1) - b.koeru); // この区分に入る金額');

// ── 6. 代理のただし書を告げない ──────────────────────────────────────────
breakCore('6. 代理で、相手方からも媒介報酬を受ける場合の制限を告げない',
  '    if (input.aiteHoshu) {',
  '    if (false) {');

// ── 7. 空家特例を合意なしで自動適用する ──────────────────────────────────
breakCore('7. 低廉な空家等の特例を、合意の有無にかかわらず適用する',
  '  const akiyaTekiyo = !!input.akiyaTekiyo && akiyaTaisho && A.status === "active";',
  '  const akiyaTekiyo = akiyaTaisho && A.status === "active";');

// ── 8. 空家特例の対象を税込総額で判定する ────────────────────────────────
breakCore('8. 低廉な空家等の対象を、消費税を含んだ総額で判定する',
  '  const akiyaTaisho = d.daikin <= A.jogen_kagaku;',
  '  const akiyaTaisho = d.sogaku <= A.jogen_kagaku;');

// ── 9. 空家特例の上限に1.1を掛け忘れる ──────────────────────────────────
breakData('9. 低廉な空家等の上限を30万円（1.1倍の掛け忘れ）にする',
  '"jogen_hoshu": 330000,',
  '"jogen_hoshu": 300000,');

// ── 10. 空家特例の対象を改正前の400万円のままにする ─────────────────────
breakData('10. 低廉な空家等の対象を令和6年改正前の400万円のままにする',
  '"jogen_kagaku": 8000000,',
  '"jogen_kagaku": 4000000,');

// ── 11. 居住用で承諾なしでも1.1か月分 ───────────────────────────────────
breakCore('11. 居住用で、承諾がなくても一方から1.1か月分受け取れることにする',
  '    ippo = yen(yachin * T.kyojuyo_ippo_bairitsu);',
  '    ippo = gokei;');

// ── 12. 承諾があれば合計も2.2か月分 ─────────────────────────────────────
breakCore('12. 承諾があれば双方の合計も2.2か月分になることにする',
  '  const gokei = yen(yachin * T.gokei_bairitsu);',
  '  const gokei = yen(yachin * (input.shodaku ? 2.2 : T.gokei_bairitsu));');

// ── 13. 権利金の特例を居住用にも適用する ────────────────────────────────
breakCore('13. 権利金の特例（第六）を居住用の建物にも適用する',
  '    if (isKyojuyo && DATA.kenrikin.kyojuyo_jogai) {',
  '    if (false) {');

// ── 14. 非居住用の借賃から消費税を除かない ──────────────────────────────
breakCore('14. 非居住用の借賃から消費税等相当額を除かない',
  '  const shohizei = isKyojuyo ? 0 : shohizeiBun(zeikomiYachin, DATA);',
  '  const shohizei = 0;');

// ── 15. 施行日ガードを外す ──────────────────────────────────────────────
breakCore('15. 施行日（令和6年7月1日）より前でも計算する',
  '  if (String(hidzuke) < from) return { ok: false, from };',
  '  if (false) return { ok: false, from };');

console.log(`\nbreak_chukai: ${pass} 捕捉 / ${fail} すり抜け`);
if (fail) process.exit(1);
