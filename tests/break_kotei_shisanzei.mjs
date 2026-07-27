/**
 * 壊しテスト: 固定資産税・都市計画税のコアとページに「ありそうな間違い」を注入し、
 * test_kotei_shisanzei.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷の実装で検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 * ★規則8: 「赤くなった」だけでは足りない。**狙った検査が落ちたか**まで見る。
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CORE = new URL('../docs/assets/kotei_shisanzei_core.js', import.meta.url);
const PAGE = new URL('../docs/kotei-shisanzei/index.html', import.meta.url);
const TEST = new URL('./test_kotei_shisanzei.mjs', import.meta.url);

const orig = { core: readFileSync(CORE, 'utf8'), page: readFileSync(PAGE, 'utf8') };
const FILE = { core: 'kotei_shisanzei_core.js', page: 'index.html' };

/** [名前, 対象, 置換前, 置換後, 落ちるべき検査の断片] */
const BREAKS = [
  // ── コア: このツールの4つの急所 ───────────────────────────────────────────
  ['★小規模住宅用地の200㎡を「1戸あたり」でなく一律にする（戸数を無視）', 'core',
   'const shoukiboM2 = Math.min(jutakuM2, SEIDO.shoukiboM2PerUnit * units);',
   'const shoukiboM2 = Math.min(jutakuM2, SEIDO.shoukiboM2PerUnit);',
   '§2 全域（720通り）で条文書き下しと一致'],

  ['★住宅用地の「床面積の10倍」の制限を外す（広い土地を全部特例にする）', 'core',
   'const jutakuM2 = floor > 0 ? Math.min(landArea, cap) : 0;',
   'const jutakuM2 = landArea;',
   '§2 全域（720通り）で条文書き下しと一致'],

  ['★都市計画税の特例に固定資産税の割合を使う（3分の1→6分の1・都計税が半分になる）', 'core',
   'shoukiboToshi: 1 / 3,',
   'shoukiboToshi: 1 / 6,',
   '§1 小規模の都市計画税の割合＝3分の1'],

  ['★一般住宅用地の都市計画税を3分の2でなく3分の1にする', 'core',
   'ippanToshi: 2 / 3,',
   'ippanToshi: 1 / 3,',
   '§1 一般の都市計画税の割合＝3分の2'],

  // ★壊し方は一意でなければならない（規則8）。都計税を無条件に半分にすると
  //   「新築あり／なし」の両方が同じだけ動くので、両者を比べる検査は発火しない。
  //   **新築の減額が出たときだけ**都計税から引く形に壊す。
  ['★新築住宅の減額を都市計画税にも及ぼす（法附則15条の6は固定資産税だけ）', 'core',
   'landKotei, landToshi, houseKoteiBefore, houseToshi, houseKotei,',
   'landKotei, landToshi, houseKoteiBefore, houseToshi: Math.max(0, houseToshi - genkaku), houseKotei,',
   '§4 新築減額でも都市計画税は変わらない'],

  ['★新築減額の120㎡の頭打ちを外す（床面積の全部を減額する）', 'core',
   'const capped = Math.min(livingArea, SEIDO.shinchikuCapM2);',
   'const capped = livingArea;',
   '§4 減額対象は120/200＝0.6'],

  ['★免税点の判定を「特例適用後の課税標準」でなく「評価額」で行う', 'core',
   'const landTaxable = land.koteiBase >= SEIDO.menzeitenLand;',
   'const landTaxable = yen(input.landValue) >= SEIDO.menzeitenLand;',
   '§5 30万円未満は課税されない'],

  ['★免税点未満の土地に都市計画税を課す（法702条の8を落とす）', 'core',
   'const landToshiBase = landTaxable ? truncTo(land.toshiBase, SEIDO.kazeiHyojunUnit) : 0;',
   'const landToshiBase = truncTo(land.toshiBase, SEIDO.kazeiHyojunUnit);',
   '§5 免税点未満なら都市計画税も0円'],

  ['★課税標準額の1,000円未満切捨てを落とす', 'core',
   'const landKoteiBase = landTaxable ? truncTo(land.koteiBase, SEIDO.kazeiHyojunUnit) : 0;',
   'const landKoteiBase = landTaxable ? land.koteiBase : 0;',
   '§4 固定の課税標準額（1,000円未満切捨て）'],

  ['★納期分割の端数を第1期に合算せず均等割りにする（法20条の4の2第6項）', 'core',
   'const first = amount - each * (t - 1);',
   'const first = each;',
   '§5 分割の合計は年税額と一致'],

  ['★床面積要件の下限40㎡を落として、小さすぎる家にも減額を出す', 'core',
   'if (f < SEIDO.shinchikuMinM2) {',
   'if (false) {',
   '§4 床面積30㎡は対象外'],

  ['★認定長期優良住宅の申告要件のフラグを落とす', 'core',
   "{ key: 'chouki', label: '認定長期優良住宅', years: 5, moushide: true, ne: '法附則15条の7第1項' },",
   "{ key: 'chouki', label: '認定長期優良住宅', years: 5, moushide: false, ne: '法附則15条の7第1項' },",
   '§1 申告要件は長期優良の2区分だけ'],

  // ── ページ: 主張そのものを消す（規則3〜5。要素を名指しできているか）────────
  ['★ページから「200㎡に住居の数を乗じて」の条文引用を消す', 'page',
   '200㎡に住居の数を乗じて得た面積',
   '200㎡',
   '§7 同要素が200㎡×戸数を主張'],

  ['★ページの「都市計画税は減額されません」を消す（新築減額の範囲の主張）', 'page',
   '<b>都市計画税は減額されません</b>（地方税法附則15条の6）',
   '（地方税法附則15条の6）',
   '§7 新築減額が固定資産税だけであることを名指しの要素が主張'],

  ['★長期優良の申告期限（1月31日）をページから消す', 'page',
   '<b>1月31日</b>までに',
   'までに',
   '§7 長期優良の申告要件が名指しの要素にある'],

  ['★負担調整措置の「前年度の課税標準額」という核心を消す', 'page',
   '<b>前年度の課税標準額</b>が分からないと決まりません',
   'が分からないと決まりません',
   '§7 負担調整措置の説明が名指しの要素にある'],

  ['★端数処理の「100円未満」をページから消す', 'page',
   '<b>確定した税額は100円未満を切り捨て</b>',
   '<b>確定した税額を切り捨て</b>',
   '§7 端数処理の主張が名指しの要素にある'],

  ['★ページの税率だけを1.4％から1.7％に書き換える（コアと食い違わせる）', 'page',
   '標準税率1.4％</b>（地方税法350条1項）',
   '標準税率1.7％</b>（地方税法350条1項）',
   '§7 本文の税率がコアと一致'],

  ['★GA4のローダーのidだけを壊す（gtag(config) 側には同じIDが残る）', 'page',
   'gtag/js?id=G-E742DSDHPD',
   'gtag/js?id=G-XXXXXXXXXX',
   '§7 GA4 のローダーが1文字列で入っている'],

  ['★canonical を別ページに向ける', 'page',
   'rel="canonical" href="https://keiri-tools.com/kotei-shisanzei/"',
   'rel="canonical" href="https://keiri-tools.com/sozokuzei/"',
   '§7 canonical が正しい'],
];

const dir = mkdtempSync(join(tmpdir(), 'break-kotei-'));
const write = (key, text) => writeFileSync(join(dir, FILE[key]), text);
const run = () => {
  try {
    const out = execFileSync('node', [join(dir, 'test_kotei_shisanzei.mjs')], { encoding: 'utf8' });
    return { green: true, out };
  } catch (e) {
    return { green: false, out: String(e.stdout || '') + String(e.stderr || '') };
  }
};

for (const k of Object.keys(FILE)) write(k, orig[k]);
writeFileSync(join(dir, 'test_kotei_shisanzei.mjs'),
  readFileSync(TEST, 'utf8')
    .replace('"../docs/assets/kotei_shisanzei_core.js"', '"./kotei_shisanzei_core.js"')
    .replace('new URL("../docs/kotei-shisanzei/index.html", import.meta.url)',
             'new URL("./index.html", import.meta.url)'));

const base = run();
if (!base.green) {
  console.error('❌ ベースラインが赤: 無傷の実装で test_kotei_shisanzei.mjs が落ちている。');
  console.error(base.out.split('\n').slice(-12).join('\n'));
  console.error('壊しテストは実行できない（規則2）');
  process.exit(1);
}
console.log('✓ ベースライン確認: 無傷の実装で検査は緑');

let caught = 0, missed = 0, wrongCheck = 0;
for (const [name, target, before, after, expect] of BREAKS) {
  if (!orig[target].includes(before)) {
    // ★規則8: 素通しではなく「壊し方が外れた」。検査を緩める前にこちらを疑う。
    console.log(`❌ 壊し方が外れた（置換前の文字列が実マークアップに無い）: ${name}`);
    missed++;
    continue;
  }
  write(target, orig[target].replace(before, after));
  const r = run();
  write(target, orig[target]);

  if (r.green) {
    console.log(`❌ 素通し: ${name}`);
    missed++;
  } else if (expect && !r.out.includes(expect)) {
    const reds = r.out.split('\n').filter((l) => l.includes('✗')).slice(0, 3).map((l) => l.trim());
    console.log(`❌ 別の検査が落ちた（狙い「${expect}」は発火せず）: ${name}`);
    for (const l of reds) console.log(`     実際に落ちた: ${l}`);
    wrongCheck++;
  } else {
    console.log(`✅ 捕捉: ${name}`);
    caught++;
  }
}

const bad = missed + wrongCheck;
console.log(`\n${bad ? '❌' : '✓'} 壊しテスト: ${caught}/${BREAKS.length} 捕捉` +
  (bad ? `（素通し ${missed} / 狙い違い ${wrongCheck}）` : ''));
process.exit(bad ? 1 : 0);
