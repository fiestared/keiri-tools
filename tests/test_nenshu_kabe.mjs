/**
 * 「年収の壁」の金額が、国税庁の公表値から導けるものと一致しているかを機械で見る。
 *
 * 落とすべきもの(2026-07-22に本番から取り除いた誤り):
 *   所得税がかかり始める給与収入を「74万 + 99万 = 173万円」と書き、さらに
 *   「『178万円の壁』ではない」と否定するcalloutまで置いていた。
 *   原因は**区分表そのもの**で、令和8年分に実在しない区分(合計所得132万円以下→99万円)が
 *   フィクスチャに入っていた。不動点(下記)は自己整合を見るだけなので、
 *   **存在しない区分でも自己整合してしまえば、もっともらしい嘘を返す**。
 *   条文(措法41の16の2第1項)の逐語:
 *     一 令和八年分及び令和九年分 … イ 合計所得489万円以下→42万円 ／ ロ 489万円超→5万円
 *     二 令和十年分以後 … 三十七万円（この号は合計所得132万円以下の場合にだけ適用）
 *   → 99万円(62万+37万)と「132万円以下」は**令和10年分以後の姿**。令和8年分は489万円以下なら
 *     一律104万円なので、正しい壁は 74万 + 104万 = **178万円**。
 *
 * 教訓は2つ:
 *   ①「**その金額にいる本人が実際に使える区分**で計算せよ」(不動点。区分の自己整合を見る)
 *   ② 不動点は**区分表が正しいことを前提にしている**。表が間違っていれば黙って通る。
 *     → 表そのものを、条文から作られた**本番の参照データと機械で突き合わせる**(下の照合)。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const D = JSON.parse(readFileSync(join(here, 'fixtures/kiso_kojo_r08.json'), 'utf8'));

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✅ ${msg}`);
  else { console.error(`  ❌ ${msg}`); failed++; }
};

/** 合計所得金額に適用される基礎控除額(区分表を引く) */
function kisoKojo(year, gokeiShotoku) {
  for (const b of D.kiso_kojo_bands[year]) {
    if (gokeiShotoku <= b.gokei_shotoku_max) return b.amount;
  }
  return 0;
}

/**
 * 所得税がかかり始める給与収入(課税最低限)を、区分表から独立に求める。
 * 給与所得 = 給与収入 - 最低保障(この収入帯では最低保障が適用される)
 * 課税所得 = 給与所得 - 基礎控除(給与所得の区分) = 0 となる給与収入。
 * 求めた額で区分を引き直し、使った控除額と一致することを確かめる(不動点=区分の自己整合)。
 */
function kazeiSaiteigen(year) {
  const hosho = D.kyuyo_shotoku_kojo_saitei_hosho[year];
  for (const b of D.kiso_kojo_bands[year]) {
    const kabe = hosho + b.amount;          // この区分の控除額で壁を仮置き
    const shotoku = kabe - hosho;           // その人の合計所得金額(=給与所得)
    if (kisoKojo(year, shotoku) === b.amount) return kabe;  // 本当にその区分に入るか
  }
  throw new Error(`${year}: 自己整合する区分が無い`);
}

console.log('課税最低限を区分表から導く（不動点で区分の自己整合を検算）');
const kabe06 = kazeiSaiteigen('r06');
const kabe07 = kazeiSaiteigen('r07');
const kabe08 = kazeiSaiteigen('r08');
ok(kabe06 === 1030000, `令和6年分: ${kabe06.toLocaleString()}円 (期待 1,030,000 = 旧「103万円の壁」)`);
ok(kabe07 === 1600000, `令和7年分: ${kabe07.toLocaleString()}円 (期待 1,600,000 = 「160万円の壁」)`);
ok(kabe08 === 1780000, `令和8年分: ${kabe08.toLocaleString()}円 (期待 1,780,000 = 74万+104万)`);

/**
 * ★区分表そのものを、条文から作った本番の参照データと突き合わせる。
 * 2026-07-22の誤りは「表に実在しない区分がある」ことが原因で、不動点では捕まらなかった。
 * この照合があれば、本番データ(e-Gov逐語)を入れた時点で食い違いとして落ちていた。
 */
console.log('\n区分表が本番の参照データ（条文から作成）と一致しているか');
const PROD = JSON.parse(readFileSync(join(here, '..', 'docs/assets/juminzei_r08.json'), 'utf8'));
const prodBands = PROD.shotokuzei_kiso_kojo_r8.brackets
  .filter(b => b.upto !== null)                       // 最後の「上限なし=0円」はフィクスチャに持たない
  .map(b => ({ gokei_shotoku_max: b.upto, amount: b.amount }));
ok(
  JSON.stringify(prodBands) === JSON.stringify(D.kiso_kojo_bands.r08),
  `令和8年分の基礎控除の区分表が本番データと一致\n     本番: ${JSON.stringify(prodBands)}\n     検査: ${JSON.stringify(D.kiso_kojo_bands.r08)}`,
);
// 令和8年分に「99万円」の区分は無い（それは令和10年分以後の姿）
ok(!D.kiso_kojo_bands.r08.some(b => b.amount === 990000), '令和8年分の区分表に99万円が無い');
ok(D.kiso_kojo_bands.r10.some(b => b.gokei_shotoku_max === 1320000 && b.amount === 990000),
   '99万円(=62万+37万)は令和10年分以後・合計所得132万円以下の区分として持っている');
// 令和10年分以後の形で令和8年分の壁を計算すると173万円になる（＝本番に出ていた誤り）
const wrong08 = D.kyuyo_shotoku_kojo_saitei_hosho.r08 + 990000;
ok(wrong08 === 1730000, `令和10年分以後の区分を令和8年分に当てると ${wrong08.toLocaleString()}円 (=本番に出ていた誤り)`);
ok(kabe08 !== wrong08, '正しい導き方は、その誤りと一致しない');

// 合計所得金額の要件 → 給与収入換算(最低保障を足すだけ。こちらは区分の問題が無い)
const hosho08 = D.kyuyo_shotoku_kojo_saitei_hosho.r08;
const Y = D.shotoku_yoken_r08;
const kabeFuyo = Y.doitsu_seikei_haigusha_fuyo_shinzoku + hosho08;
const kabeGensen = Y.gensen_kojo_taisho_haigusha + hosho08;
const kabeTokubetsuZero = Y.haigusha_tokubetsu_kojo_zero + hosho08;
console.log('\n配偶者・扶養の壁（給与収入換算）');
ok(kabeFuyo === 1360000, `配偶者控除・扶養親族の上限: ${kabeFuyo.toLocaleString()}円 (期待 1,360,000)`);
ok(kabeGensen === 1690000, `配偶者特別控除が減り始める: ${kabeGensen.toLocaleString()}円 (期待 1,690,000)`);
ok(kabeTokubetsuZero === 2070000, `配偶者特別控除がゼロ: ${kabeTokubetsuZero.toLocaleString()}円 (期待 2,070,000)`);

// 記事が、導いた金額を書いているか（手打ちの転記ズレ・古い数字の残留を落とす）
console.log('\n記事の記載と一致しているか');
const man = (yen) => `${yen / 10000}万円`;
const pages = [
  'docs/column/nenshu-no-kabe/index.html',
  'docs/column/fuyo-kojo-shinkokusho/index.html',
];
for (const rel of pages) {
  const html = readFileSync(join(here, '..', rel), 'utf8');
  const name = rel.split('/')[2];
  ok(html.includes(man(kabe08)), `${name}: 正しい壁「${man(kabe08)}」を記載している`);

  // 「173万円」は、令和10年分以後の話として書く文脈でだけ許す。令和8年分の壁として
  // 提示していたら落とす。行(<tr>)ごと・見出しごとに見る。セルの位置で見ると、
  // 間に別の列(令和7年分など)が挟まったページを見逃す(実際に fuyo-kojo-shinkokusho を見逃しかけた)。
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  // ★find() ではなく filter()。「所得税がかかり始める」と書いた行は1ページに複数ある
  //   (早見表の行と、令和6/7/8年分を並べた比較表の行)。find() は最初の一致しか返さないので、
  //   比較表の行を173万円に戻しても早見表の行を見て緑のままだった(2026-07-22の壊しテストで発覚)。
  //   → 該当する行を**全部**見る。行が増えても順番が変わっても効く。
  const wallRows = rows.filter(r => /所得税がかかり始める/.test(r));
  const headings = html.match(/<h[23][^>]*>[^<]*<\/h[23]>/g) || [];
  ok(wallRows.length >= 1, `${name}: 壁を述べている行を ${wallRows.length} 件見つけた`);
  const asWall =
    wallRows.some(r => r.includes(man(wrong08))) ||
    headings.some(h => h.includes('もうありません') && h.includes(man(wrong08)));
  ok(!asWall, `${name}: 誤り「${man(wrong08)}」を令和8年分の壁として提示していない`);
  // 壁を述べている行は、どれも正しい額を載せていること（列が増えても行で見る）
  ok(wallRows.every(r => r.includes(man(kabe08))),
     `${name}: 壁を述べている行(${wallRows.length}件)が全て「${man(kabe08)}」を載せている`);
}

/**
 * 数直線の図解(インラインSVG)は座標を手で置くので、ラベルだけ直して**点が動いていない**事故が起きる。
 * 目盛り(100万・200万のグリッド線)から一次式を復元し、各ラベルの点が正しい位置にあるかを機械で見る。
 * 独立オラクル: 軸のグリッド線(被検体の点とは別の要素)。
 */
console.log('\n数直線SVGの目盛り位置（軸のスケールから検算）');
const kabeHtml = readFileSync(join(here, '..', 'docs/column/nenshu-no-kabe/index.html'), 'utf8');
const svg = kabeHtml.match(/<svg viewBox="0 0 740 240"[\s\S]*?<\/svg>/)[0];

// 軸ラベル(100万/200万)の x からスケールを復元
const axis = [...svg.matchAll(/<text class="fg-mute" x="([\d.]+)"[^>]*>(\d+)万<\/text>/g)]
  .map(m => ({ x: parseFloat(m[1]), man: parseInt(m[2], 10) }));
const a0 = axis.find(a => a.man === 100), a1 = axis.find(a => a.man === 200);
const scale = (man) => a0.x + (man - a0.man) * (a1.x - a0.x) / (a1.man - a0.man);

// 壁の点(circle)と、その直後のラベル(text)の対応を取る
const marks = [...svg.matchAll(/<circle cx="([\d.]+)"[^>]*\/>\s*<text[^>]*>(\d+)万円<\/text>/g)]
  .map(m => ({ cx: parseFloat(m[1]), man: parseInt(m[2], 10) }));
ok(marks.length >= 6, `点とラベルの対応を ${marks.length} 件抽出した`);
for (const mk of marks) {
  const want = scale(mk.man);
  ok(Math.abs(mk.cx - want) < 0.6, `${mk.man}万円の点: cx=${mk.cx} (軸から計算すると ${want.toFixed(1)})`);
}
ok(marks.some(m => m.man === 178), '数直線に178万円の点がある');
ok(!marks.some(m => m.man === 173), '数直線に173万円の点が残っていない');

console.log(failed === 0 ? '\nall green' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
