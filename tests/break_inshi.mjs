/**
 * 壊しテスト: 収入印紙コア（inshi_core.js）と参照データ（inshi_r07.json）に
 * 「ありそうな間違い」を注入し、test_inshi.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷のコアで検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 *
 * 注入する間違いは、すべて「このツールで実際に黙って誤答しうる」もの:
 *   - 5万円境界を「以下」にずらす（50,000円ちょうどの領収書を非課税にする）
 *   - 消費税の区分記載でも税込のまま判定する（No.6925を落とす）
 *   - 免税事業者でも税抜で判定する（No.6925の逆撃ち）
 *   - 軽減表を当てない／全部に当てる（不動産・建設以外にも軽減）
 *   - 階級の境界「以下」を「未満」にずらす
 *   - 記載なし文書を0円にする
 *   - 軽減表の税額をデータごと壊す（30,000→10,000）
 *   - fail closed を外す（データ無しでも計算する）
 */
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CORE = new URL('../docs/assets/inshi_core.js', import.meta.url);
const DATA = new URL('../docs/assets/inshi_r07.json', import.meta.url);
const TEST = new URL('./test_inshi.mjs', import.meta.url);
const orig = readFileSync(CORE, 'utf8');
const origData = readFileSync(DATA, 'utf8');
const testSrc = readFileSync(TEST, 'utf8');

/** [名前, 対象('core'|'data'), 置換前, 置換後] */
const BREAKS = [
  ['★非課税の下限「未満」を「以下」にする（50,000円ちょうどの領収書を非課税と誤答）', 'core',
   'judgeAmount < doc.hikazei_under',
   'judgeAmount <= doc.hikazei_under'],

  ['★消費税の区分記載でも税抜にしない（税込54,800円の領収書に200円と誤答）', 'core',
   'judgeAmount = amount - taxPart;\n      usedTaxExclusion = true;',
   'usedTaxExclusion = true;'],

  ['★免税事業者でも税抜で判定する（No.6925の逆＝非課税と誤答）', 'core',
   '} else if (i.menzei) {',
   '} else if (false) {'],

  ['★軽減措置を当てない（不動産6,000万円に本則60,000円と誤答＝2倍取らせる）', 'core',
   'if (doc.keigen && judgeAmount > doc.keigen.over) {',
   'if (false) {'],

  ['★軽減の下限を無視する（10万円ちょうどの不動産契約に軽減を当てる）', 'core',
   'if (doc.keigen && judgeAmount > doc.keigen.over) {',
   'if (doc.keigen) {'],

  ['★階級の「以下」を「未満」にずらす（100万円ちょうどの領収書を400円と誤答）', 'core',
   'if (b.upto === null || b.upto === undefined || amount <= b.upto) return b;',
   'if (b.upto === null || b.upto === undefined || amount < b.upto) return b;'],

  ['★記載金額のない文書を0円にする（1号・2号・17号の記載なしは200円）', 'core',
   'return { ...base, tax: doc.noamount, taxable: true, bracketLabel:',
   'return { ...base, tax: 0, taxable: false, bracketLabel:'],

  ['★営業に関しない受取書にも課税する（非課税を落とす）', 'core',
   "notes.push('営業に関しない受取書",
   "return { ...base, tax: 200, taxable: true }; notes.push('営業に関しない受取書"],

  ['★fail closed を外す（データ無しでも空データで計算に進む）', 'core',
   "if (!D || !D.docs) throw new Error('参照データ（inshi_r07.json）が渡されていません');",
   'D = D || { docs: {} };'],

  // ── データ側の壊し（JSONの逐語転記ミスの再現）─────────────────────────────
  ['★データ: 軽減表の5,000万超1億以下を30,000→10,000に壊す（NTA例30,000円で捕捉）', 'data',
   '{ "upto": 100000000, "tax": 30000, "label": "5,000万円を超え1億円以下" },\n          { "upto": 500000000, "tax": 60000, "label": "1億円を超え5億円以下" },\n          { "upto": 1000000000, "tax": 160000, "label": "5億円を超え10億円以下" },\n          { "upto": 5000000000, "tax": 320000, "label": "10億円を超え50億円以下" },\n          { "upto": null, "tax": 480000, "label": "50億円を超えるもの" }\n        ]\n      }\n    },\n    "k1_other"',
   '{ "upto": 100000000, "tax": 10000, "label": "5,000万円を超え1億円以下" },\n          { "upto": 500000000, "tax": 60000, "label": "1億円を超え5億円以下" },\n          { "upto": 1000000000, "tax": 160000, "label": "5億円を超え10億円以下" },\n          { "upto": 5000000000, "tax": 320000, "label": "10億円を超え50億円以下" },\n          { "upto": null, "tax": 480000, "label": "50億円を超えるもの" }\n        ]\n      }\n    },\n    "k1_other"'],

  ['★データ: 17号の非課税下限5万円を3万円に壊す（49,999円非課税で捕捉）', 'data',
   '"hikazei_under": 50000, "noamount": 200,\n      "_note": "★営業に関しないものは金額によらず非課税',
   '"hikazei_under": 30000, "noamount": 200,\n      "_note": "★営業に関しないものは金額によらず非課税'],

  ['★データ: 手形の一覧払特例200円を400円に壊す', 'data',
   '"ichiranbarai": { "hikazei_under": 100000, "tax": 200 }',
   '"ichiranbarai": { "hikazei_under": 100000, "tax": 400 }'],
];

// ── ベースライン: 無傷のコアで検査が緑であること（規則2。これが赤なら壊しは全部嘘）──
const dir = mkdtempSync(join(tmpdir(), 'inshi-break-'));
const run = () => {
  try {
    execFileSync(process.execPath, [join(dir, 'test_inshi.mjs')], { stdio: 'pipe', timeout: 60000 });
    return true; // 緑
  } catch { return false; } // 赤
};

// テストのimport先を一時ディレクトリのコピーへ向ける
writeFileSync(join(dir, 'inshi_core.js'), orig);
writeFileSync(join(dir, 'inshi_r07.json'), origData);
writeFileSync(join(dir, 'test_inshi.mjs'),
  testSrc
    .replace("from '../docs/assets/inshi_core.js'", "from './inshi_core.js'")
    .replace("new URL('../docs/assets/', import.meta.url)", 'new URL(\'./\', import.meta.url)'));

if (!run()) {
  console.error('❌ ベースラインが赤: 無傷のコアで test_inshi.mjs が落ちている。壊しテストは実行できない（規則2）');
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
  writeFileSync(join(dir, target === 'core' ? 'inshi_core.js' : 'inshi_r07.json'), broken);
  const green = run();
  // 元に戻す
  writeFileSync(join(dir, 'inshi_core.js'), orig);
  writeFileSync(join(dir, 'inshi_r07.json'), origData);
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
