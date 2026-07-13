/**
 * 「年収の壁」の金額が、国税庁の公表値から導けるものと一致しているかを機械で見る。
 *
 * 落とすべきもの(2026-07-13に実際に本番へ出ていた誤り):
 *   所得税がかかり始める給与収入を「給与所得控除の最低保障74万円 + 基礎控除104万円 = 178万円」と
 *   計算していた。だが104万円が使えるのは合計所得金額が132万円を**超える**人(給与収入206万円超)で、
 *   年収178万円の人の合計所得金額は104万円 → 適用される基礎控除は99万円(132万円以下の区分)。
 *   正しい壁は 74万 + 99万 = 173万円。
 *
 * 一般化すると「**その金額にいる本人が実際に使える区分**で計算せよ」ということ。
 * 区分の下限より低い所得の人に、その区分の控除額を当てはめてはいけない。
 * → 求めた壁の額から合計所得金額を計算し直し、**使った区分に本当に入るか**を検算する(不動点)。
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
ok(kabe08 === 1730000, `令和8年分: ${kabe08.toLocaleString()}円 (期待 1,730,000 = 74万+99万)`);

// 誤った導き方(区分の自己整合を見ない)だと178万円になる。これが実際に出ていた誤り。
const naive08 = D.kyuyo_shotoku_kojo_saitei_hosho.r08 + Math.max(...D.kiso_kojo_bands.r08.map(b => b.amount));
ok(naive08 === 1780000, `控除額の最大値を使う誤った導き方だと ${naive08.toLocaleString()}円 になる(=本番に出ていた誤り)`);
ok(kabe08 !== naive08, '正しい導き方は、その誤りと一致しない');

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

  // 「178万円」は、誤りとして否定する文脈(callout)でだけ許す。壁として提示していたら落とす。
  // 行(<tr>)ごと・見出しごとに見る。セルの位置で見ると、間に別の列(令和7年分など)が挟まった
  // ページを見逃す(実際に fuyo-kojo-shinkokusho を見逃しかけた)。
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const wallRow = rows.find(r => /所得税がかかり始める/.test(r));
  const headings = html.match(/<h[23][^>]*>[^<]*<\/h[23]>/g) || [];
  const asWall =
    (wallRow && wallRow.includes(man(naive08))) ||
    headings.some(h => h.includes('もうありません') && h.includes(man(naive08)));
  ok(!asWall, `${name}: 誤り「${man(naive08)}」を壁として提示していない`);
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
ok(marks.some(m => m.man === 173), '数直線に173万円の点がある');
ok(!marks.some(m => m.man === 178), '数直線に178万円の点が残っていない');

console.log(failed === 0 ? '\nall green' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
