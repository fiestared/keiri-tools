/**
 * `tests/test_toroku_jutaku.mjs` の壊しテスト。
 *
 * 78件が初回から全部緑だったので、**検査が本物を捕まえられるのか**を確かめる
 * （CLAUDE.md 規則1・規則2。緑は「正しい」の証拠ではなく「この網では何も引っかからなかった」の意味）。
 *
 * 壊し方は、登録免許税の計算で実際に出回っている誤りをそのまま再現する:
 *   1. 抵当権の課税標準を不動産の評価額にする（正しくは債権金額＝借入額）
 *   2. 税率の違う登記を合算してから1回だけ端数処理する
 *   3. 贈与・交換でも住宅用家屋の軽減を通す（原因は売買・競落だけ）
 *   4. 長期優良と低炭素の「一戸建て0.2%」を取り違える
 *   5. 一戸建ての区別を保存登記にも広げる（区別があるのは移転だけ）
 *   6. 中古の長期優良住宅にも0.1%を当てる（特例は新築・未使用に限る）
 *   7. 最低税額1,000円の判定を、100円未満を切り捨てた「後」の額で行う
 *   8. 課税標準の最低額1,000円（登免税法15条）を落とす
 *   9. 中古の建築日の基準を昭和57年からずらす
 *  10. 床面積の境界を「50平方メートル超」にする（正しくは以上）
 *  11. 持分を課税標準に掛け忘れる
 *  12. 土地の軽減の期限を住宅用家屋と同じ令和9年3月31日にする（実際は令和11年3月31日）
 *
 * 実行: node tests/break_toroku_jutaku.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(root, 'docs', 'assets', 'toroku_jutaku_core.js');
const DATA = join(root, 'docs', 'assets', 'toroku_jutaku_r08.json');
const run = () => spawnSync(process.execPath, ['tests/test_toroku_jutaku.mjs'], { cwd: root, encoding: 'utf8' });

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
t('ベースライン: 無傷の状態で test_toroku_jutaku が緑', true);

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

// ── 1. 抵当権の課税標準を評価額にする ──────────────────────────────────────
breakCore('1. 抵当権の課税標準を建物の評価額にする（正しくは債権金額）',
  '    const r = zeigakuFrom(saiken, ritsu, H);',
  '    const r = zeigakuFrom(tateKagaku || saiken, ritsu, H);');

// ── 2. 税率の違う登記を合算してから丸める ─────────────────────────────────
breakCore('2. 税額の100円未満切捨てをやめる（税率別の端数処理が消える）',
  '  let zeigaku = truncTo(zeiritsuGo, H.zeigaku_kirisute);',
  '  let zeigaku = zeiritsuGo;');

// ── 3. 贈与・交換でも軽減を通す ───────────────────────────────────────────
breakCore('3. 取得の原因を見ない（贈与でも住宅用家屋の軽減を通す）',
  '  if (!Y.gen_in.includes(j.genin)) {',
  '  if (false) {');

// ── 4. 長期優良と低炭素の「一戸建て0.2%」を取り違える ───────────────────────
breakData('4. 低炭素の移転にも一戸建て0.2%があることにする',
  '"iten_hyoji": "1000分の1（0.1%）",\n      "_note": "長期優良住宅と違い',
  '"iten_hyoji": "1000分の1（0.1%）",\n      "iten_kodate_ritsu": 0.002,\n      "_note": "長期優良住宅と違い');

// ── 5. 一戸建ての区別を保存登記にも広げる ─────────────────────────────────
breakCore('5. 長期優良の保存登記にも一戸建て0.2%を当てる（区別があるのは移転だけ）',
  '    if (hozon) {\n      return { ritsu: C.hozon_ritsu, hyoji: C.hozon_hyoji, konkyo: "租税特別措置法74条1項（特定認定長期優良住宅・保存）" };\n    }',
  '    if (hozon) {\n      return { ritsu: j.kodate ? C.iten_kodate_ritsu : C.hozon_ritsu, hyoji: C.hozon_hyoji, konkyo: "租税特別措置法74条1項（特定認定長期優良住宅・保存）" };\n    }');

// ── 6. 中古の認定住宅にも0.1%を当てる ─────────────────────────────────────
breakCore('6. 中古の長期優良住宅にも特例を当てる（新築・未使用に限られる）',
  '  const shinchikuKei = !j.chuko;',
  '  const shinchikuKei = true;');

// ── 7. 最低税額の判定を切捨ての「後」で行う ────────────────────────────────
breakCore('7. 最低税額1,000円の判定を100円未満切捨ての後の額で行う',
  '  if (kazeiHyojun > 0 && zeiritsuGo < H.zeigaku_min) zeigaku = H.zeigaku_min;',
  '  if (kazeiHyojun > 0 && zeigaku < H.zeigaku_min && zeigaku > 0) zeigaku = H.zeigaku_min;');

// ── 8. 課税標準の最低額1,000円を落とす ────────────────────────────────────
breakCore('8. 課税標準が1,000円未満のとき1,000円とみなす規定を落とす（登免税法15条）',
  '  if (raw > 0 && kazeiHyojun < H.kazei_hyojun_min) kazeiHyojun = H.kazei_hyojun_min;',
  '  if (false) kazeiHyojun = H.kazei_hyojun_min;');

// ── 9. 中古の建築日の基準をずらす ─────────────────────────────────────────
breakData('9. 中古の建築日の基準を昭和57年から1年ずらす',
  '"chuko_kenchiku_kijun_bi": "1982-01-01"',
  '"chuko_kenchiku_kijun_bi": "1983-01-01"');

// ── 10. 床面積の境界を「超」にする ────────────────────────────────────────
breakCore('10. 床面積の境界を50平方メートル超にする（正しくは以上）',
  '  if (menseki < Y.yukamenseki_min) {',
  '  if (menseki <= Y.yukamenseki_min) {');

// ── 11. 持分を掛け忘れる ──────────────────────────────────────────────────
breakCore('11. 土地の持分を課税標準に掛け忘れる（登免税法10条2項）',
  '  const tochiKagaku = nz(inp.tochiKagaku) * (inp.tochiMochibun == null ? 1 : nz(inp.tochiMochibun));',
  '  const tochiKagaku = nz(inp.tochiKagaku);');

// ── 12. 土地の軽減の期限を住宅用家屋と同じにする ───────────────────────────
// ★これが今回いちばん出回っている誤り。国税庁のタックスアンサー（令和7年4月1日現在）も
//   まだ「令和8年3月31日まで」のままで、令和8年法律12号の延長が反映されていない。
breakData('12. 土地の軽減の期限を令和9年3月31日にする（実際は令和11年3月31日）',
  '"kigen": "2029-03-31"',
  '"kigen": "2027-03-31"');

// ── 13〜16. 登記を受ける日と2つの期限 ──────────────────────────────────────
// ★どれも「軽減を受けられない人に『軽減されます』と答える」向きの誤り。
breakCore('13. 期限の当日を「軽減なし」にする（条文は「まで」＝当日を含む）',
  'return { ok: true, jutakuKeigen: tokiBi <= K.jutaku_kigen };',
  'return { ok: true, jutakuKeigen: tokiBi < K.jutaku_kigen };');

breakCore('14. 期限を無視して常に軽減を当てる（いちばん危険な向き）',
  'return { ok: true, jutakuKeigen: tokiBi <= K.jutaku_kigen };',
  'return { ok: true, jutakuKeigen: true };');

// ★逆向きの誤り。期限後は「軽減が使えたはずの人」だけ答えが決まらない。
//   要件を満たさない人は本則（期限のない税率）なので、その日でも答えは出せる。
breakCore('15. 期限後は本則の人まで「出せない」にする（過剰な fail closed）',
  '    if (keigenHantei.ok && !jutakuKeigenKa) {',
  '    if (!jutakuKeigenKa) {');

breakCore('16. 土地の期限（令和11年3月31日）を過ぎても計算する',
  '  if (tokiBi > K.tochi_baibai.kigen) {',
  '  if (false) {');

// ── 17. 相続を「軽減の使えない移転」として2%で計算する ────────────────────────
breakCore('17. 相続に「その他の移転」1000分の20を当てる（正しくは1000分の4の別制度）',
  '  if (inp.genin === "相続" || inp.tochiGenin === "相続") {',
  '  if (false) {');

// ── 結果 ──────────────────────────────────────────────────────────────
console.log(`\n${pass}/${pass + fail} 捕捉`);
if (fail) process.exit(1);
