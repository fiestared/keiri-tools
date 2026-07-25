/**
 * 壊しテスト: 地震保険料控除のコア・参照データ・ページに「ありそうな間違い」を注入し、
 * test_jishin_hoken_kojo.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷の実装で検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 * ★規則8: 「赤くなった」だけでは足りない。**狙った検査が落ちたか**まで見る。
 *   各壊しに expect（落ちるべき検査名の断片）を持たせ、別の検査が代わりに落ちた場合も
 *   「素通し」と同じ扱いで失敗させる。
 *
 * ★この壊しテストを書く過程で、検査側の粒度の穴が2つ見つかった（規則5）:
 *   ① muda-note 全体を名指ししていたが、前段の「いくら払っても控除額は増えません」が
 *      同じ語を含むため、核心の「1円も増えません」を消しても緑だった → muda-kyu を切り出した
 *   ② 旧長期の表全体に /15,000/ を当てていたが、帯の境目「5,000円超 15,000円以下」が
 *      代わりに当たるため、上限15,000円を書き換えても緑だった → 上限セルを名指しした
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CORE = new URL('../docs/assets/setsuzei_core.js', import.meta.url);
const DATA = new URL('../docs/assets/setsuzei_r08.json', import.meta.url);
const PAGE = new URL('../docs/jishin-hoken-kojo/index.html', import.meta.url);
const TEST = new URL('./test_jishin_hoken_kojo.mjs', import.meta.url);

const orig = { core: readFileSync(CORE, 'utf8'), data: readFileSync(DATA, 'utf8'), page: readFileSync(PAGE, 'utf8') };
const FILE = { core: 'setsuzei_core.js', data: 'setsuzei_r08.json', page: 'index.html' };

/** [名前, 対象, 置換前, 置換後, 落ちるべき検査の断片] */
const BREAKS = [
  // ── コア ────────────────────────────────────────────────────────────────
  ['★住民税を所得税と同じ帯で計算する（このツールの核心の誤り）', 'core',
   'return { shotoku: side(J.shotoku), jumin: side(J.jumin), year:',
   'return { shotoku: side(J.shotoku), jumin: side(J.shotoku), year:',
   '住民税の区分別控除額が条文オラクルと一致'],

  ['★合計の上限（5万円・2万5千円）を掛け忘れる', 'core',
   '      total: Math.min(sum, T.total_max),',
   '      total: sum,',
   '所得税の合計（上限5万円）が一致'],

  ['★旧長期損害保険料を無視する（地震分だけ数える）', 'core',
   '    const dKyu = kyuChoki > 0 ? seihoBand(kyuChoki, T.kyu_choki) : 0;',
   '    const dKyu = 0;',
   '所得税の区分別控除額が条文オラクルと一致'],

  ['★端数を切り捨てにする（申告書の脚注は切り上げ）', 'core',
   '      return Math.ceil(b.base + (x - b.minus) / b.div);',
   '      return Math.floor(b.base + (x - b.minus) / b.div);',
   '端数: 旧長期15,001円(所得税)は12,501円'],

  ['★ちょうど上限のときも「頭打ち」と申告する（>= にする）', 'core',
   '      capped: sum > T.total_max,',
   '      capped: sum >= T.total_max,',
   'capped: ちょうど上限50,000円は頭打ちではない'],

  ['★★一の契約の地震分と旧長期分を両取りする（法が禁じていること）', 'core',
   '  const asJishin = evaluate(base.jishin + bothJ, base.kyuChoki);',
   '  const asJishin = evaluate(base.jishin + bothJ, base.kyuChoki + bothK);',
   '選択あり: 地震として扱った場合の所得税控除'],

  ['★有利判定の向きを逆にする（不利な方を選ぶ）', 'core',
   '  const best = a >= b ? asJishin : asKyuChoki;',
   '  const best = a <= b ? asJishin : asKyuChoki;',
   '選択あり: bestの節税額がtaxSavingSplitと一致'],

  // ── データ ──────────────────────────────────────────────────────────────
  ['★データ: 住民税の地震分を「2分の1」から「全額」にする', 'data',
   '        { "upto": 50000, "base": 0, "minus": 0, "div": 2 },',
   '        { "upto": 50000, "base": 0, "minus": 0, "div": 1 },',
   'データ: 住民税の地震分は2分の1'],

  ['★データ: 所得税の合計上限 50,000円 を 40,000円 に取り違える', 'data',
   '      "total_max": 50000',
   '      "total_max": 40000',
   'データ: 所得税の合計上限'],

  ['★データ: 住民税の合計上限 25,000円 を 50,000円（所得税の額）にする', 'data',
   '      "total_max": 25000',
   '      "total_max": 50000',
   'データ: 住民税の合計上限'],

  ['★データ: 住民税の旧長期の帯を所得税と同じ刻み（1万円）にする', 'data',
   '        { "upto": 5000,  "base": 0,    "minus": 0,    "div": 1 },',
   '        { "upto": 10000, "base": 0,    "minus": 0,    "div": 1 },',
   '住民税の区分別控除額が条文オラクルと一致'],

  ['★データ: 所得税の旧長期の上限 15,000円 を 20,000円 にする', 'data',
   '        { "upto": null,  "flat": 15000 }',
   '        { "upto": null,  "flat": 20000 }',
   'カナリア: 所得税の旧長期の最終段＝上限'],

  ['★データ: 旧長期の要件から「始期が平成19年1月1日以後を除く」を落とす', 'data',
   ',\n      "保険期間または共済期間の始期が平成19年1月1日以後のものでないこと"',
   '',
   'データ: 旧長期の要件は5つ'],

  ['★データ: 未施行改正なしの照合記録（md5）を消す', 'data',
   'md5=e85a572349f7853ee902d148dc234161',
   'md5=(未確認)',
   'カナリア: 未施行改正なしの照合記録がデータにある'],

  ['★データ: 地方税法側の照合記録（md5）を消す', 'data',
   'c55868a3399ba7079344e3a2003149a8',
   '(未確認)',
   'カナリア: 地方税法側の照合記録がデータにある'],

  // ── ページ ──────────────────────────────────────────────────────────────
  ['★ページ: 住民税が「2分の1・上限25,000円」であるという主張を消す', 'page',
   '<b>住民税は「支払額の二分の一」で、上限は25,000円です。</b>',
   '<b>住民税も同じように計算します。</b>',
   'ページ: 住民税は2分の1と書いてある'],

  ['★ページ: 旧長期の所得税の上限（15,000円）を書き換える', 'page',
   '<td id="kyu-shotoku-max"><b>15,000円</b>（上限）</td>',
   '<td id="kyu-shotoku-max"><b>20,000円</b>（上限）</td>',
   'ページ: 旧長期の所得税の上限は15,000円'],

  ['★ページ: 旧長期の住民税の上限（10,000円）を書き換える', 'page',
   '<td rowspan="2" id="kyu-jumin-max"><b>10,000円</b>（上限）</td>',
   '<td rowspan="2" id="kyu-jumin-max"><b>15,000円</b>（上限）</td>',
   'ページ: 旧長期の住民税の上限は10,000円'],

  ['★ページ: 「旧長期を足しても1円も増えない」の主張を消す', 'page',
   '控除額は<b>1円も増えません</b>',
   '控除額が増えないこともあります',
   'ページ: 上限到達時は旧長期を足しても増えないと書いてある'],

  ['★ページ: 看板の節税額（11,689円）を書き換える', 'page',
   '住民税2,500円＝<b>11,689円</b>',
   '住民税2,500円＝<b>11,700円</b>',
   'ページ: 看板の節税額11,689円が出ている'],

  ['★ページ: 看板の所得税控除額（45,000円）を書き換える', 'page',
   '<span id="kanban-shotoku">30,000円＋15,000円＝<b>45,000円</b></span>',
   '<span id="kanban-shotoku">30,000円＋15,000円＝<b>50,000円</b></span>',
   'ページ: 看板の所得税控除額45,000円が出ている'],

  ['★ページ: 旧長期の要件の一覧から「始期」の1行を落とす', 'page',
   '<li>保険期間または共済期間の<b>始期</b>が平成19年1月1日以後のものでないこと</li>',
   '',
   'ページ: 始期が平成19年1月1日以後のものは対象外と書いてある'],

  ['★ページ: 住民税の根拠を削除された「5号の2」にする', 'page',
   '地方税法34条1項5号の3（道府県民税）・314条の2第1項5号の3（市町村民税）です。',
   '地方税法34条1項5号の2（道府県民税）です。',
   'ページ: 削除された5号の2を根拠にしていない'],

  ['★ページ: 年分をデータから描かず手書きに戻す', 'page',
   '<span id="year-from-data">',
   '<span>',
   'ページ: 年分をデータのキーで描いている'],
];

// ── ベースライン: 無傷の実装で検査が緑であること（規則2）────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'jishin-break-'));
const write = (k, s) => writeFileSync(join(dir, FILE[k]), s);
const run = () => {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'test_jishin_hoken_kojo.mjs')],
      { stdio: 'pipe', timeout: 300000, encoding: 'utf8' });
    return { green: true, out };
  } catch (e) {
    return { green: false, out: String(e.stdout || '') + String(e.stderr || '') };
  }
};

for (const k of Object.keys(FILE)) write(k, orig[k]);
writeFileSync(join(dir, 'test_jishin_hoken_kojo.mjs'),
  readFileSync(TEST, 'utf8')
    .replace('"../docs/assets/setsuzei_core.js"', '"./setsuzei_core.js"')
    .replace('new URL("../docs/assets/setsuzei_r08.json", import.meta.url)',
             'new URL("./setsuzei_r08.json", import.meta.url)')
    .replace('new URL("../docs/jishin-hoken-kojo/index.html", import.meta.url)',
             'new URL("./index.html", import.meta.url)'));

const base = run();
if (!base.green) {
  console.error('❌ ベースラインが赤: 無傷の実装で test_jishin_hoken_kojo.mjs が落ちている。');
  console.error(base.out.split('\n').slice(-12).join('\n'));
  console.error('壊しテストは実行できない（規則2）');
  process.exit(1);
}
console.log('✓ ベースライン確認: 無傷の実装で検査は緑');

let caught = 0, missed = 0, wrongCheck = 0;
for (const [name, target, before, after, expect] of BREAKS) {
  if (!orig[target].includes(before)) {
    // ★規則8: 素通しではなく「壊し方が外れた」。検査を緩める前にこちらを疑う。
    console.log(`❌ 壊し方が外れた（置換前の文字列が実ファイルに無い）: ${name}`);
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
