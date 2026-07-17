/**
 * 壊しテスト: 自動車税コア（jidoshazei_core.js）と参照データ（jidoshazei_r08.json）に
 * 「ありそうな間違い」を注入し、test_jidoshazei.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷のコアで検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 *
 * 注入する間違いは、すべて「このツールで実際に黙って誤答しうる」もの:
 *   - 新旧税率の境界を逆にする（新税率の車に旧税率を答える）
 *   - 重課をハイブリッドにも当てる（ハイブリッドに約15%多い税額＝最大の急所）
 *   - 月割を年額（重課）に当てる／端数を切上げにする／月数を1つずらす
 *   - 3月登録を0円でなく年額にする
 *   - データの税額を転記ミスさせる（新税率・重課・軽の各値）
 *   - fail closed を外す（データ無しでも計算する）
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CORE = new URL('../docs/assets/jidoshazei_core.js', import.meta.url);
const DATA = new URL('../docs/assets/jidoshazei_r08.json', import.meta.url);
const TEST = new URL('./test_jidoshazei.mjs', import.meta.url);
const orig = readFileSync(CORE, 'utf8');
const origData = readFileSync(DATA, 'utf8');
const testSrc = readFileSync(TEST, 'utf8');

/** [名前, 対象('core'|'data'), 置換前, 置換後] */
const BREAKS = [
  ['★登録車の新旧境界を逆にする（新税率の車に旧税率を答える）', 'core',
   "const rateType = firstReg >= P.boundary ? 'new' : 'old';",
   "const rateType = firstReg >= P.boundary ? 'old' : 'new';"],

  ['★重課をハイブリッド・電気にも当てる（対象外なのに約15%多く答える）', 'core',
   'if (!jyukaEligibleFuel || b.jyuka == null) {',
   'if (b.jyuka == null) {'],

  ['★ディーゼルの11年判定を消す（ガソリンと同じ13年扱いにする＝注記が変わる）', 'core',
   "const jyukaEligibleFuel = fuel === 'gasoline' || fuel === 'diesel';",
   "const jyukaEligibleFuel = fuel === 'gasoline';"],

  ['★月割を年額（重課適用後）に当てる（新車の月割を重課ベースで過大に）', 'core',
   'const amount = floorTo100(standard * months / 12);',
   'const amount = floorTo100(annual * months / 12);'],

  ['★月割の端数を切上げにする（100円未満切捨でなくなる）', 'core',
   'const v = Math.floor(Number(n) / 100) * 100;',
   'const v = Math.ceil(Number(n) / 100) * 100;'],

  ['★月割の月数を1つずらす（4月→11か月が狂う）', 'core',
   'return m >= 4 ? 15 - m : 3 - m;',
   'return m >= 4 ? 14 - m : 3 - m;'],

  ['★3月登録を0円でなく年額にする（かからない年度に課税する）', 'core',
   'if (months === 0) {',
   'if (false) {'],

  ['★軽自動車の新旧境界を逆にする', 'core',
   "const rateType = firstReg >= k.boundary ? 'new' : 'old';",
   "const rateType = firstReg >= k.boundary ? 'old' : 'new';"],

  ['★fail closed を外す（データ無しでも空データで計算に進む）', 'core',
   "if (!D || !D.passenger || !D.kei) throw new Error('参照データ（jidoshazei_r08.json）が渡されていません');",
   'D = D || { passenger: { brackets: [] }, kei: {} };'],

  // ── データ側の壊し（税額表の転記ミスの再現）─────────────────────────────
  ['★データ: 新1.5L超2L の新税率 36,000 を旧39,500に取り違える', 'data',
   '"new": 36000, "old": 39500, "jyuka": 45400',
   '"new": 39500, "old": 39500, "jyuka": 45400'],

  ['★データ: 2.5L超3L の重課 58,600 を標準50,000に取り違える', 'data',
   '"new": 50000, "old": 51000, "jyuka": 58600',
   '"new": 50000, "old": 51000, "jyuka": 50000'],

  ['★データ: 軽の新税率 10,800 を旧7,200に取り違える', 'data',
   '"new": 10800,',
   '"new": 7200,'],
];

// ── ベースライン: 無傷のコアで検査が緑であること（規則2。これが赤なら壊しは全部嘘）──
const dir = mkdtempSync(join(tmpdir(), 'jidoshazei-break-'));
const run = () => {
  try {
    execFileSync(process.execPath, [join(dir, 'test_jidoshazei.mjs')], { stdio: 'pipe', timeout: 60000 });
    return true; // 緑
  } catch { return false; } // 赤
};

writeFileSync(join(dir, 'jidoshazei_core.js'), orig);
writeFileSync(join(dir, 'jidoshazei_r08.json'), origData);
writeFileSync(join(dir, 'test_jidoshazei.mjs'),
  testSrc
    .replace("from '../docs/assets/jidoshazei_core.js'", "from './jidoshazei_core.js'")
    .replace("new URL('../docs/assets/', import.meta.url)", 'new URL(\'./\', import.meta.url)'));

if (!run()) {
  console.error('❌ ベースラインが赤: 無傷のコアで test_jidoshazei.mjs が落ちている。壊しテストは実行できない（規則2）');
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
  writeFileSync(join(dir, target === 'core' ? 'jidoshazei_core.js' : 'jidoshazei_r08.json'), broken);
  const green = run();
  // 元に戻す
  writeFileSync(join(dir, 'jidoshazei_core.js'), orig);
  writeFileSync(join(dir, 'jidoshazei_r08.json'), origData);
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
