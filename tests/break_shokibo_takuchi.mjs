/**
 * 壊しテスト: 小規模宅地等の特例のコア・参照データ・ページに「ありそうな間違い」を注入し、
 * test_shokibo_takuchi.mjs が **必ず落ちる** ことを確かめる。
 *
 * 規則2（ベースライン確認）: 壊す前に、無傷の実装で検査が緑になることを確かめる。
 * ★実装は壊さない。一時ディレクトリにコピーを作ってそれを壊す。
 *
 * ★規則8: 「赤くなった」だけでは足りない。**狙った検査が落ちたか**まで見る。
 *   各壊しに expect（落ちるべき検査名の断片）を持たせ、別の検査が代わりに落ちた場合も
 *   「素通し」と同じ扱いで失敗させる（前便で「赤くなったが第2カナリアは一度も発火していない」
 *   という取り違えを実際にやったため）。
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CORE = new URL('../docs/assets/shokibo_takuchi_core.js', import.meta.url);
const DATA = new URL('../docs/assets/shokibo_takuchi_r08.json', import.meta.url);
const PAGE = new URL('../docs/shokibo-takuchi/index.html', import.meta.url);
const TEST = new URL('./test_shokibo_takuchi.mjs', import.meta.url);

const orig = { core: readFileSync(CORE, 'utf8'), data: readFileSync(DATA, 'utf8'), page: readFileSync(PAGE, 'utf8') };
const FILE = { core: 'shokibo_takuchi_core.js', data: 'shokibo_takuchi_r08.json', page: 'index.html' };

/** [名前, 対象, 置換前, 置換後, 落ちるべき検査の断片] */
const BREAKS = [
  // ── コア: 限度面積の式そのものを取り違える（このツールの核心）─────────────────
  ['★案①（貸付を選ばない完全併用）を捨てて3号だけを使う＝730㎡が消える', 'core',
   'const best = b.reduction > a.reduction ? b : a;',
   'const best = b;',
   '§4 看板 減額の合計'],

  ['★案②（3号の按分式）を捨てて常に完全併用にする＝貸付が有利な人を取りこぼす', 'core',
   'const best = b.reduction > a.reduction ? b : a;',
   'const best = a;',
   '§4 逆向き 減額の合計'],

  ['★3号を「貸付を選ばなくても」適用する（c>0 の条件を落とす）＝730㎡が誰にも使えなくなる', 'core',
   'if (s.kashitsuke <= 0) {',
   'if (false) {',
   '§2 限度面積の判定がオラクルと一致'],

  ['★3号ロの係数（200/330）にイの係数（200/400）を使う＝居住用の枠が広がりすぎる', 'core',
   "{ key: 'jutaku', lot: lots.jutaku, cost: H.jutaku_coef[0] / H.jutaku_coef[1], pct: kJutaku.genzoku_pct }",
   "{ key: 'jutaku', lot: lots.jutaku, cost: H.jigyo_coef[0] / H.jigyo_coef[1], pct: kJutaku.genzoku_pct }",
   '§3 コアの配分がすべて条文の限度面積を満たす'],

  ['★枠の消費量を無視して「減額割合×単価」だけで優先順位を決める＝最適でなくなる', 'core',
   'eff: it.cost > 0 ? (it.lot.unit * (it.pct / 100)) / it.cost : 0,',
   'eff: it.lot.unit * (it.pct / 100),',
   '§3 コアの減額が全探索の最大値を下回らない'],

  ['★貪欲の順序を逆にする（枠あたりの減額額が小さい区分から使う）', 'core',
   'items.sort((a, b) => b.eff - a.eff);',
   'items.sort((a, b) => a.eff - b.eff);',
   '§3 コアの減額が全探索の最大値を下回らない'],

  ['★完全併用のクランプを外す（400・330を超えて選ばせる）', 'core',
   'jigyo: Math.min(lots.jigyo.area, kJigyo.limit_m2),',
   'jigyo: lots.jigyo.area,',
   '§3 コアの配分がすべて条文の限度面積を満たす'],

  ['★減額割合のかわりに算入割合を使う（80%減が20%減になる）', 'core',
   'return yen(lot.value * ratio * (genzokuPct / 100));',
   'return yen(lot.value * ratio * ((100 - genzokuPct) / 100));',
   '§4 看板 事業用の減額'],

  ['★円未満を切り上げにする（切捨てでなくなる）', 'core',
   'const v = Math.floor(Number(n));',
   'const v = Math.ceil(Number(n));',
   '§4 端数 減額は円未満切捨て'],

  // ── データ: 条文の数値の転記ミス ───────────────────────────────────────────
  ['★データ: 特定居住用の限度面積 330 を 200 に取り違える', 'data',
   '"limit_m2": 330,',
   '"limit_m2": 200,',
   '§1 特定居住用の限度面積（2項2号）'],

  ['★データ: 貸付事業用の減額割合 50 を 80 に取り違える（1項2号は百分の五十）', 'data',
   '"genzoku_pct": 50,\n      "sannyu_pct": 50,',
   '"genzoku_pct": 80,\n      "sannyu_pct": 50,',
   '§1 kashitsuke 算入＋減額＝100'],

  ['★データ: 3号ロの分母 330 を 400 に取り違える（条文の構造が壊れる）', 'data',
   '"jutaku_coef": [200, 330],',
   '"jutaku_coef": [200, 400],',
   '§1 3号ロの分母＝特定居住用の限度面積'],

  ['★データ: 完全併用の合計 730 を 630 に取り違える', 'data',
   '"kanzen_heiyo_total_m2": 730,',
   '"kanzen_heiyo_total_m2": 630,',
   '§1 完全併用の合計＝400＋330'],

  ['★データ: 見直し期限を過ぎた状態にする（カナリアが発火すること）', 'data',
   '"next_review": "2028-04-01",',
   '"next_review": "2020-01-01",',
   '§7 カナリア'],

  ['★データ: 家なき子の要件を1つ削る（配偶者がいないこと＝いちばん落としやすい）', 'data',
   '      "被相続人に配偶者がいないこと",\n',
   '',
   '§8 家なき子の要件はデータ上6つ'],

  ['★データ: 3年以内事業宅地等の15％基準を貸付側にも書いてしまう（例外の取り違え）', 'data',
   '"exception": "相続開始の日まで3年を超えて引き続き特定貸付事業（貸付事業のうち準事業以外のもの＝事業的規模の貸付け）を行っていた被相続人等のその特定貸付事業の用に供された宅地等は除外されない"',
   '"exception": "その事業に使っていた一定の資産の価額が宅地等の価額の15％以上である場合は除外されない"',
   '§8 貸付用の例外は特定貸付事業（15％基準ではない）'],

  // ── ページ: 主張だけが古くなる／消える ─────────────────────────────────────
  ['★ページ: 完全併用（730㎡）の主張を消す', 'page',
   '<b>合計730㎡まで完全に併用</b>',
   '<b>併用</b>',
   '§8 その要素が730を主張している'],

  ['★ページ: 按分式の枠200の主張を消す', 'page',
   '<b>事業用×200/400 ＋ 居住用×200/330 ＋ 貸付用 が200㎡以下</b>',
   '<b>別の式</b>',
   '§8 その要素が200の枠を主張している'],

  ['★ページ: 家なき子の一覧から「配偶者がいないこと」だけを消す（データとページが離れる）', 'page',
   '    <li>被相続人に配偶者がいないこと</li>\n',
   '',
   '§8 家なき子6要件がデータどおりページに載っている'],

  ['★ページ: 申告要件（7項）から「0円でも申告」の主張を消す', 'page',
   '<b>特例を使って相続税が0円になる場合も、期限内に申告して初めて0円が確定します</b>',
   '<b>申告してください</b>',
   '§8 その要素が「0円でも申告」と主張している'],

  ['★ページ: 事業用の3年縛りの15％基準を消す', 'page',
   'の<b>15％以上</b>である場合は',
   'の<b>相当割合</b>である場合は',
   '§8 事業用の3年縛りが名指しの要素にあり15％を主張'],

  ['★ページ: meta description から730を落とす（検索結果に出る主張＝規則9）', 'page',
   '合計730㎡を完全併用できますが',
   '完全併用できますが',
   '§8 meta description に730が入っている'],
];

// ── ベースライン: 無傷の実装で検査が緑であること（規則2）────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'shokibo-break-'));
const write = (k, s) => writeFileSync(join(dir, FILE[k]), s);
/** @returns {{green:boolean, out:string}} */
const run = () => {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'test_shokibo_takuchi.mjs')],
      { stdio: 'pipe', timeout: 300000, encoding: 'utf8' });
    return { green: true, out };
  } catch (e) {
    return { green: false, out: String(e.stdout || '') + String(e.stderr || '') };
  }
};

for (const k of Object.keys(FILE)) write(k, orig[k]);
writeFileSync(join(dir, 'test_shokibo_takuchi.mjs'),
  readFileSync(TEST, 'utf8')
    .replace('"../docs/assets/shokibo_takuchi_core.js"', '"./shokibo_takuchi_core.js"')
    .replace('new URL("../docs/assets/shokibo_takuchi_r08.json", import.meta.url)',
             'new URL("./shokibo_takuchi_r08.json", import.meta.url)')
    .replace('new URL("../docs/shokibo-takuchi/index.html", import.meta.url)',
             'new URL("./index.html", import.meta.url)'));

const base = run();
if (!base.green) {
  console.error('❌ ベースラインが赤: 無傷の実装で test_shokibo_takuchi.mjs が落ちている。');
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
    // 赤くはなったが、狙った検査ではない別の検査が落ちている
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
