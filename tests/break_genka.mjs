/**
 * 壊しテスト: 減価償却コア（genka_core.js）と参照データ（genka_rates.json）に
 * 「ありそうな間違い」を注入し、test_genka.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷のコアで検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 *
 * 注入する間違いは、すべて「このツールで実際に黙って誤答しうる」もの:
 *   - 定率法の償却保証額の切替を消す（償却が終わらず毎年少なく誤答）
 *   - 備忘価額1円を残さない（帳簿価額が0まで落ちる）
 *   - 初年度の月割を消す／月数を1つずらす（年の中途取得で過大）
 *   - 取得時期の適用表分岐を逆にする（200%と250%を取り違え）
 *   - 旧法(平成19年3月以前)の fail closed を外す（旧法に新法を当てる）
 *   - 端数を切上げにする／保証額の浮動小数誤差対策を戻す（65,520が65,519に）
 *   - データの償却率・保証率・改定償却率を転記ミスさせる
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CORE = new URL('../docs/assets/genka_core.js', import.meta.url);
const DATA = new URL('../docs/assets/genka_rates.json', import.meta.url);
const TEST = new URL('./test_genka.mjs', import.meta.url);
const orig = readFileSync(CORE, 'utf8');
const origData = readFileSync(DATA, 'utf8');
const testSrc = readFileSync(TEST, 'utf8');

/** [名前, 対象('core'|'data'), 置換前, 置換後] */
const BREAKS = [
  ['★定率法の償却保証額の切替を消す（償却が終わらず毎年少なく誤答＝核心）', 'core',
   'if (canSwitch && chosei < hoshoGaku) {',
   'if (false) {'],

  ['★備忘価額1円を残さない（有形の帳簿価額が0まで落ちる）', 'core',
   'if (dep > book - residual) dep = book - residual;',
   'if (dep > book) dep = book;'],

  // ── 資産の種類による償却の限度額（所令134条1項2号イ／ロ）─────────────────────
  ['★無形固定資産にも1円を残す（＝この便で直したバグそのもの。ソフトウエアに永久に1円が残る）', 'core',
   '    residual: 0,\n    kon: \'所令134条1項2号ロ\',\n    // 所令120条の2第1項4号',
   '    residual: 1,\n    kon: \'所令134条1項2号ロ\',\n    // 所令120条の2第1項4号'],

  ['★坑道にも1円を残す（134条1項2号ロは「坑道及び…無形固定資産」＝坑道も0円まで）', 'core',
   '    residual: 0,\n    kon: \'所令134条1項2号ロ\',\n    // 坑道は鉱業用減価償却資産',
   '    residual: 1,\n    kon: \'所令134条1項2号ロ\',\n    // 坑道は鉱業用減価償却資産'],

  ['★資産の種類を無視して常に有形として扱う（選択肢が飾りになる）', 'core',
   'const residual = AT.residual;',
   'const residual = 1;'],

  ['★無形固定資産に定率法を許してしまう（所令120条の2第1項4号は定額法のみ）', 'core',
   'if (i.method === \'teiritsu\' && !AT.teiritsuOk) {',
   'if (false) {'],

  ['★坑道の定率法まで止めてしまう（正しい入力を拒否する向きの誤り）', 'core',
   '    // 坑道は鉱業用減価償却資産（所令120条の2第1項3号ロ）＝定率法も選べる\n    teiritsuOk: true,',
   '    // 坑道は鉱業用減価償却資産（所令120条の2第1項3号ロ）＝定率法も選べる\n    teiritsuOk: false,'],

  // ── 中古資産の簡便法（耐令3条）─────────────────────────────────────────
  ['★簡便法の割合 20% を 30% にする（見積耐用年数が長くなる＝毎年の償却費が過少）', 'core',
   'const truncated = Math.floor(rawMonths5 / 60);',
   'const truncated = Math.floor((rawMonths5 * 3 / 2) / 60);'],

  ['★簡便法の一部経過の式から「経過年数×20%」の加算を落とす（22年→20年に短縮＝過大償却）', 'core',
   ': (houteiMonths - keikaTotalMonths) * 5 + keikaTotalMonths;',
   ': (houteiMonths - keikaTotalMonths) * 5;'],

  ['★簡便法の全部経過（イ）と一部経過（ロ）の分岐を逆にする', 'core',
   'const zenbu = keikaTotalMonths >= houteiMonths;',
   'const zenbu = keikaTotalMonths < houteiMonths;'],

  ['★簡便法の端数を切上げにする（耐令3条5項は「切り捨てる」・13年が14年に）', 'core',
   'const truncated = Math.floor(rawMonths5 / 60);',
   'const truncated = Math.ceil(rawMonths5 / 60);'],

  ['★簡便法の下限2年（2号かっこ書き）を外す（法定4年の全部経過が0年になる）', 'core',
   'const years = Math.max(2, truncated);',
   'const years = truncated;'],

  ['★★経過年数の「月」を切り捨てる（築10年3か月が10年扱い＝13年が14年に。耐令3条5項に反する）', 'core',
   'const keikaTotalMonths = ky * 12 + km;',
   'const keikaTotalMonths = ky * 12;'],

  ['★★ただし書（資本的支出>取得価額の50%）を外す（使えない人に短い耐用年数を答えて過大償却させる）', 'core',
   'if (cost > 0 && shishutsu * 2 > cost) {',
   'if (false) {'],

  ['★ただし書の境界を「50%以上」にする（ちょうど50%の人が使えるのに断られる）', 'core',
   'if (cost > 0 && shishutsu * 2 > cost) {',
   'if (cost > 0 && shishutsu * 2 >= cost) {'],

  ['★初年度の月割を消す（年の中途取得を年額まるまるで過大に）', 'core',
   'if (year === 1 && usedMonths < 12) dep = floorYen(dep * usedMonths / 12);',
   'if (false) dep = floorYen(dep * usedMonths / 12);'],

  ['★初年度の月数を1つずらす（1月→12か月が狂う）', 'core',
   'return 13 - m;',
   'return 12 - m;'],

  ['★取得時期の適用表分岐を逆にする（200%と250%を取り違える）', 'core',
   'const is200 = acqYm >= B.teiritsu200_start;',
   'const is200 = acqYm < B.teiritsu200_start;'],

  ['★旧法(平成19年3月以前)の fail closed を外す（旧法に新法を当てる）', 'core',
   'if (acqYm < B.shin_start) {',
   'if (false) {'],

  ['★端数を切上げにする（1円未満切り捨てでなくなる）', 'core',
   'const v = Math.floor((Number(base) * num) / scale);',
   'const v = Math.ceil((Number(base) * num) / scale);'],

  ['★保証額の浮動小数対策を戻す（1,000,000×0.06552が65,519に化ける）', 'core',
   'applyRate(cost, hoshoRate, 100000)',
   'floorYen(cost * hoshoRate)'],

  // ── データ側の壊し（償却率表の転記ミスの再現）─────────────────────────────
  ['★データ: 定額法 耐用年数10年の償却率 0.100 を 0.15 に取り違える', 'data',
   '"10": 0.1,',
   '"10": 0.15,'],

  ['★データ: 200%定率法 n10 の保証率 0.06552 を 0.05 に取り違える', 'data',
   '"hosho": 0.06552',
   '"hosho": 0.05'],

  ['★データ: 250%定率法 n10 の保証率 0.04448 を 0.09 に取り違える', 'data',
   '"hosho": 0.04448',
   '"hosho": 0.09'],

  ['★データ: 200%定率法 n10 の改定償却率 0.250 を 0.5 に取り違える', 'data',
   '"rate": 0.2,\n      "kaitei": 0.25,',
   '"rate": 0.2,\n      "kaitei": 0.5,'],
];

// ── ベースライン: 無傷のコアで検査が緑であること（規則2）──────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'genka-break-'));
const run = () => {
  try {
    execFileSync(process.execPath, [join(dir, 'test_genka.mjs')], { stdio: 'pipe', timeout: 60000 });
    return true;
  } catch { return false; }
};

writeFileSync(join(dir, 'genka_core.js'), orig);
writeFileSync(join(dir, 'genka_rates.json'), origData);
writeFileSync(join(dir, 'test_genka.mjs'),
  testSrc
    .replace("from '../docs/assets/genka_core.js'", "from './genka_core.js'")
    .replace("new URL('../docs/assets/', import.meta.url)", 'new URL(\'./\', import.meta.url)'));

if (!run()) {
  console.error('❌ ベースラインが赤: 無傷のコアで test_genka.mjs が落ちている。壊しテストは実行できない（規則2）');
  process.exit(1);
}
console.log('✓ ベースライン確認: 無傷のコアで検査は緑');

let caught = 0, missed = 0;
for (const [name, target, before, after] of BREAKS) {
  const src = target === 'core' ? orig : origData;
  if (!src.includes(before)) {
    console.log(`❌ 壊し方が外れた（置換前の文字列が見つからない）: ${name}`);
    missed++;
    continue;
  }
  const broken = src.replace(before, after);
  writeFileSync(join(dir, target === 'core' ? 'genka_core.js' : 'genka_rates.json'), broken);
  const green = run();
  writeFileSync(join(dir, 'genka_core.js'), orig);
  writeFileSync(join(dir, 'genka_rates.json'), origData);
  if (green) {
    console.log(`❌ 素通し: ${name}`);
    missed++;
  } else {
    console.log(`✅ 捕捉: ${name}`);
    caught++;
  }
}

console.log(`\n${missed ? '❌' : '✓'} 壊しテスト: ${caught}/${BREAKS.length} 捕捉`);
process.exit(missed ? 1 : 0);
