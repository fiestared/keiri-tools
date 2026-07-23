// /column/nenmatsu-chosei-kanpukin/ の数値主張を、検証済みコアで再計算して機械照合する。
//
// この記事は「還付金の実数例」が主役なのに、2026-07-23まで専用テストが1つも無く、
// 金額はどこからも守られていなかった（denchoho記事と同じ構造要因）。
//
// オラクル＝記事の明示前提どおりの再計算:
//   東京都・協会けんぽ・40歳未満・賞与なし・月給=年収/12(切捨て)・
//   社会保険料控除は健保+厚年+子ども・子育て支援金のみ(雇用保険料を含めない簡略計算。
//   記事の脚注・figcaptionにこの前提を明示してある)。
//   月々の天引き=令和8年分月額表(甲欄)・年末調整=給与所得(年分別)−社保−基礎控除(年分別)、
//   1,000円未満切捨て→速算表→×102.1%→100円未満切捨て。
// 基礎控除の帯は juminzei_core.shotokuzeiKisoKojo(r7/r8) がオラクル
// （どちらも措法41条の16の2の現行版/R8-12-01版と逐語照合済み・2026-07-23）。
import { readFileSync } from 'node:fs';
import * as G from '../docs/assets/gensen_kyuyo_core.js';
import * as S from '../docs/assets/shaho_core.js';
import * as J from '../docs/assets/juminzei_core.js';
import { shotokuzei, seimeiHokenryoKojo } from '../docs/assets/setsuzei_core.js';

const HTML = readFileSync(new URL('../docs/column/nenmatsu-chosei-kanpukin/index.html', import.meta.url), 'utf8');
const table = JSON.parse(readFileSync(new URL('../docs/assets/gensen_getsugaku_r08.json', import.meta.url), 'utf8'));
const SR = JSON.parse(readFileSync(new URL('../docs/assets/shaho_rates_r08.json', import.meta.url), 'utf8'));
const D = JSON.parse(readFileSync(new URL('../docs/assets/juminzei_r08.json', import.meta.url), 'utf8'));
const SD = JSON.parse(readFileSync(new URL('../docs/assets/setsuzei_r08.json', import.meta.url), 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, name, detail = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const yen = (n) => n.toLocaleString('en-US'); // 12,220 形式
const strip = (s) => s.replace(/<[^>]+>/g, '');

// ── オラクル ──────────────────────────────────────────
const TOKYO = SR.kenko_rates['東京都'];
const KOYOU = SR.koyou.types.general;

function monthlyPack(annual, n, includeKoyou = false) {
  const monthly = Math.floor(annual / 12);
  const sh = S.calcMonthly(monthly, TOKYO, SR.kaigo_rate, 30, 18.3, SR.kosodate_rate);
  const ky = S.calcKoyou(monthly, KOYOU.total_permille, KOYOU.jigyo2_permille);
  const shakai = sh.selfTotal + (includeKoyou ? ky.self : 0);
  return { monthly, shakai, tax: G.kouTax(table, monthly - shakai, n) };
}
function nencho(annual, shakaiAnnual, zeisei, jinteki = 0) {
  const shotoku = zeisei === 'r8' ? J.kyuyoShotokuR8(annual, D) : J.kyuyoShotoku(annual, D);
  const kiso = zeisei === 'r8' ? J.shotokuzeiKisoKojo(shotoku, D, 'r8') : J.shotokuzeiKisoKojo(shotoku, D);
  const kazei = Math.floor(Math.max(0, shotoku - shakaiAnnual - kiso - jinteki) / 1000) * 1000;
  return Math.floor(shotokuzei(kazei, SD) * 1.021 / 100) * 100;
}
// 看板(年収500万・扶養0)
const m500 = monthlyPack(5_000_000, 0);
const withheld500 = m500.tax * 12;
const tax500r8 = nencho(5_000_000, m500.shakai * 12, 'r8');
const tax500r7 = nencho(5_000_000, m500.shakai * 12, 'r7');
// 雇用保険も控除に入れた場合(figcaptionの但し書きの数字)
const m500k = monthlyPack(5_000_000, 0, true);
const refund500k = m500k.tax * 12 - nencho(5_000_000, m500k.shakai * 12, 'r8');
const uplift500k = nencho(5_000_000, m500k.shakai * 12, 'r7') - nencho(5_000_000, m500k.shakai * 12, 'r8');

console.log('== A. 看板の実数例(年収500万) — 図と本文 ==');
ok(m500.tax === 12_220, '月々の天引き 12,220', `oracle=${m500.tax}`);
ok(withheld500 === 146_640, '年間天引き 146,640', `oracle=${withheld500}`);
ok(tax500r8 === 92_900, 'R8年税額 92,900', `oracle=${tax500r8}`);
ok(tax500r7 === 123_100, '改正なし年税額 123,100', `oracle=${tax500r7}`);
ok(withheld500 - tax500r8 === 53_740, '還付 53,740', `oracle=${withheld500 - tax500r8}`);
ok(withheld500 - tax500r7 === 23_540, '改正なし還付 23,540', `oracle=${withheld500 - tax500r7}`);
ok(tax500r7 - tax500r8 === 30_200, '上乗せ 30,200', `oracle=${tax500r7 - tax500r8}`);
ok(refund500k === 55_040, '雇用保険込の還付 55,040', `oracle=${refund500k}`);
ok(uplift500k === 28_900, '雇用保険込の上乗せ 28,900', `oracle=${uplift500k}`);

// 主張が載っている要素＝2つ目の図のfigcaption(53,740を含むもの)を名指し(規則3/5)
const figcaps = [...HTML.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)].map((m) => strip(m[1]));
const cap = figcaps.find((t) => t.includes('53,740'));
ok(!!cap, 'figcaption(53,740)が存在する');
if (cap) {
  for (const v of [53_740, 23_540, 30_200, 55_040, 28_900]) {
    ok(cap.includes(yen(v)), `figcaptionに ${yen(v)}`, '雇用保険の前提と両モデルの数字');
  }
  ok(cap.includes('雇用保険料は含めない'), 'figcaptionが社保の範囲(雇用保険を含めない)を明示する');
}
// meta description(規則9): 約53,700円/約30,200円 はオラクルの100円丸め
const meta = HTML.match(/<meta name="description" content="([^"]*)"/)[1];
ok(Math.round((withheld500 - tax500r8) / 100) * 100 === 53_700, '約53,700のオラクル一致');
ok(meta.includes('約53,700円'), 'meta descriptionの約53,700円');
ok(meta.includes('約30,200円'), 'meta descriptionの約30,200円');

console.log('== B. 基礎控除の帯表(新旧・コア照合) ==');
// 帯の値: [所得境界内の代表値, 旧, 新]
const bands = [
  [1_320_000, 950_000, 1_040_000],
  [3_360_000, 880_000, 1_040_000],
  [4_890_000, 680_000, 1_040_000],
  [6_550_000, 630_000, 670_000],
  [23_500_000, 580_000, 620_000],
];
for (const [s, oldV, newV] of bands) {
  ok(J.shotokuzeiKisoKojo(s, D) === oldV, `所得${s}の旧基礎控除=${oldV}`, `core=${J.shotokuzeiKisoKojo(s, D)}`);
  ok(J.shotokuzeiKisoKojo(s, D, 'r8') === newV, `所得${s}の新基礎控除=${newV}`, `core=${J.shotokuzeiKisoKojo(s, D, 'r8')}`);
}
// 帯表そのもの(data-tableで「合計所得金額」ヘッダの表)の行を照合
const tables = [...HTML.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)];
const bandTable = tables.find((t) => t[1].includes('合計所得金額') && t[1].includes('増加額'));
ok(!!bandTable, '帯表が存在する');
if (bandTable) {
  const rows = [...bandTable[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => strip(r[1]).replace(/\s+/g, ''));
  const expectRows = [
    ['132万円以下', '206万円以下', '95万円', '104万円', '+9万円'],
    ['132万円超336万円以下', '206万円超475万1,999円以下', '88万円', '+16万円'],
    ['336万円超489万円以下', '475万1,999円超665万5,556円以下', '68万円', '+36万円'],
    ['489万円超655万円以下', '665万5,556円超850万円以下', '63万円', '67万円', '+4万円'],
    ['655万円超2,350万円以下', '850万円超2,545万円以下', '58万円', '62万円', '+4万円'],
  ];
  for (const cells of expectRows) {
    const row = rows.find((r) => r.startsWith(cells[0]));
    ok(!!row && cells.every((c) => row.includes(c)), `帯表の行: ${cells[0]}`, row || '行なし');
  }
}
// 収入換算の境界をコアで再現(二分探索)
function maxIncomeWhere(fn, limit, lo, hi) {
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fn(mid) <= limit) lo = mid; else hi = mid - 1; }
  return lo;
}
const r8f = (x) => J.kyuyoShotokuR8(x, D);
const r7f = (x) => J.kyuyoShotoku(x, D);
ok(maxIncomeWhere(r8f, 1_320_000, 1_000_000, 3_000_000) === 2_060_000, '新法: 所得132万⇔収入206万', '');
ok(maxIncomeWhere(r8f, 3_360_000, 3_000_000, 6_000_000) === 4_751_999, '新法: 所得336万⇔収入475万1,999');
ok(maxIncomeWhere(r8f, 4_890_000, 6_000_000, 8_000_000) === 6_655_555, '新法: 所得489万⇔収入665万5,555(記事は超の境界665万5,556)');
ok(maxIncomeWhere(r8f, 6_550_000, 8_000_000, 9_000_000) === 8_500_000, '新法: 所得655万⇔収入850万');

// すき間帯(#kiso-sukima): 旧法は収入200万4,000円から所得が132万を超え、旧基礎控除88万(+16万)
ok(r7f(2_003_999) <= 1_320_000 && r7f(2_004_000) > 1_320_000, '旧法の132万境界は収入200万4,000円', `r7f(2004000)=${r7f(2_004_000)}`);
ok(J.shotokuzeiKisoKojo(r7f(2_004_000), D) === 880_000, 'すき間帯の旧基礎控除=88万', '');
ok(J.shotokuzeiKisoKojo(r8f(2_060_000), D, 'r8') === 1_040_000, 'すき間帯の新基礎控除=104万', '');
const sukima = HTML.match(/<span id="kiso-sukima">([\s\S]*?)<\/span>/);
ok(!!sukima, '#kiso-sukima 注記が存在する');
if (sukima) {
  const t = strip(sukima[1]);
  ok(t.includes('200万4,000円〜206万円'), 'すき間帯の範囲');
  ok(t.includes('88万円'), 'すき間帯の旧基礎控除88万円');
  ok(t.includes('+16万円'), 'すき間帯の増加+16万円');
}
// 令和10年分以後の縮小(99万/62万)は措法41の16の2 R8-12-01版の二号(37万・132万以下)から。
// 62万+37万=99万の骨格は新基礎控除62万(コア)と整合していること。
ok(J.shotokuzeiKisoKojo(23_500_000, D, 'r8') + 370_000 === 990_000, '令和10年分の99万=62万+37万の整合');
const shukusho = strip(HTML).match(/令和10年分以後は104万円・67万円の枠が縮小されます（132万円以下は99万円、それ以外は62万円）/);
ok(!!shukusho, '令和10年分の縮小(99万/62万)の記載');

console.log('== C. 年収別の上乗せ表 ==');
const upliftTable = tables.find((t) => t[1].includes('改正で増える還付額'));
ok(!!upliftTable, '上乗せ表が存在する');
if (upliftTable) {
  const rows = [...upliftTable[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => strip(r[1]).replace(/\s+/g, ''));
  const cases = [
    [2_000_000, '200万円', 150_000], [3_000_000, '300万円', 160_000], [4_000_000, '400万円', 160_000],
    [5_000_000, '500万円', 360_000], [6_000_000, '600万円', 360_000], [7_000_000, '700万円', 40_000],
    [8_000_000, '800万円', 40_000], [10_000_000, '1,000万円', 40_000],
  ];
  for (const [annual, label, kojoUp] of cases) {
    const m = monthlyPack(annual, 0);
    const up = nencho(annual, m.shakai * 12, 'r7') - nencho(annual, m.shakai * 12, 'r8');
    // 控除の増加額もコアで再現(給与所得の減少+基礎控除の増加)
    const s7 = r7f(annual), s8 = r8f(annual);
    const kUp = (s7 - s8) + (J.shotokuzeiKisoKojo(s8, D, 'r8') - J.shotokuzeiKisoKojo(s7, D));
    ok(kUp === kojoUp, `${label}の控除増加=${kojoUp / 10000}万`, `core=${kUp}`);
    const row = rows.find((r) => r.startsWith(label));
    ok(!!row && row.includes(`約${yen(up)}円`), `${label}の還付増=約${yen(up)}円`, row || '行なし');
    ok(!!row && row.includes(`+${kojoUp / 10000}万円`), `${label}の行に+${kojoUp / 10000}万円`);
  }
  // 脚注: 雇用保険を含めた場合の例(500万の行=約28,900円)
  ok(strip(HTML).includes('例: 年収500万円の行は約28,900円') && uplift500k === 28_900,
    '上乗せ表の脚注(雇用保険込28,900)がオラクルと一致');
}

console.log('== D. 追徴の実数例(年収600万) ==');
const m2 = monthlyPack(6_000_000, 2);
const m1 = monthlyPack(6_000_000, 1);
const fin0 = nencho(6_000_000, m2.shakai * 12, 'r8', 0);
const fin1 = nencho(6_000_000, m2.shakai * 12, 'r8', 380_000);
ok(m2.tax === 11_640, '甲欄2人の月税 11,640', `oracle=${m2.tax}`);
ok(fin0 === 152_400, '年末0人の税額 152,400', `oracle=${fin0}`);
ok(fin0 - m2.tax * 12 === 12_720, '追徴 12,720', `oracle=${fin0 - m2.tax * 12}`);
ok(m2.tax * 12 - fin1 === 26_080, '2人→1人の還付 26,080', `oracle=${m2.tax * 12 - fin1}`);
ok(m1.tax * 12 - fin0 === 26_160, '1人→0人の還付 26,160', `oracle=${m1.tax * 12 - fin0}`);
ok(fin0 - fin1 === 38_800, '扶養控除38万の税額換算 38,800', `oracle=${fin0 - fin1}`);
const tsuichoTable = tables.find((t) => t[1].includes('12月に精算される額'));
ok(!!tsuichoTable, '追徴表が存在する');
if (tsuichoTable) {
  const t = strip(tsuichoTable[1]).replace(/\s+/g, '');
  ok(t.includes('11,640円×12か月＝139,680円'), '追徴表: 11,640×12=139,680');
  ok(t.includes('152,400円'), '追徴表: 152,400');
  ok(t.includes('追徴12,720円'), '追徴表: 追徴12,720');
}
const kinkoCallout = [...HTML.matchAll(/<div class="callout">([\s\S]*?)<\/div>/g)]
  .map((m) => strip(m[1])).find((t) => t.includes('26,080'));
ok(!!kinkoCallout, '拮抗callout(26,080)が存在する');
if (kinkoCallout) {
  ok(kinkoCallout.includes('26,160円'), '拮抗callout: 26,160円');
  ok(kinkoCallout.includes('38,800円'), '拮抗callout: 38,800円');
}

console.log('== E. 生命保険料控除(令和8・9年分の6万円特例) ==');
// コア: 一般(新契約)8万円 → 特例なし4万/特例あり5万(帯ごと1.5倍・上限6万)
const seihoNashi = seimeiHokenryoKojo({ ippan_shin: 80_000 }, SD).shotoku.items.find((i) => i.key === 'ippan').amount;
const seihoAri = seimeiHokenryoKojo({ ippan_shin: 80_000, tokurei: true }, SD).shotoku.items.find((i) => i.key === 'ippan').amount;
const seihoCap = seimeiHokenryoKojo({ ippan_shin: 200_000, tokurei: true }, SD).shotoku.items.find((i) => i.key === 'ippan').amount;
ok(seihoNashi === 40_000, '一般新契約8万→特例なし4万', `core=${seihoNashi}`);
ok(seihoAri === 50_000, '一般新契約8万→特例あり5万', `core=${seihoAri}`);
ok(seihoCap === 60_000, '特例の上限6万', `core=${seihoCap}`);
const tokureiSpan = HTML.match(/<span id="seiho-tokurei">([\s\S]*?)<\/span>/);
ok(!!tokureiSpan, '#seiho-tokurei 注記が存在する');
if (tokureiSpan) {
  const t = strip(tokureiSpan[1]);
  ok(t.includes('上限6万円'), '特例の上限6万円');
  ok(t.includes('控除5万円'), '年8万円→控除5万円');
  ok(t.includes('41条の15の5'), '条文番号(措法41の15の5)');
  ok(tokureiSpan[1].includes('../../seimei-hoken-kojo/'), '生保シミュレーターへの導線');
}
// FAQ(可視側)の答えにも特例がある(JSON-LDは生成物なのでここでは見ない)
const faqSeiho = HTML.match(/<h3>Q\. 生命保険料を年8万円払いました。[\s\S]*?<\/h3>\s*<p>([\s\S]*?)<\/p>/);
ok(!!faqSeiho && strip(faqSeiho[1]).includes('年8万円の支払いなら控除は5万円'), 'FAQの答えに特例(5万円)');
// 計算式表の注にも特例
ok(strip(HTML).includes('令和8年分・令和9年分に限り上の式が1.5倍（上限6万円）'), '計算式表の注に特例');

console.log(`\n結果: ${pass} passed / ${fail} failed`);
if (fail > 0) process.exit(1);
