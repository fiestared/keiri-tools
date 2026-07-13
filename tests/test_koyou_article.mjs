// 記事「雇用保険料率」の数字・条文引用・端数規則を機械照合する。
//
// 規律（CLAUDE.md）:
//  - 存在確認(includes)ではなく「集合の一致」で見る。過不足の両方を落とす
//  - 表記の系統ごとに別の網を張る。網の外に何が残るかを数える
//    → この記事は **1000分率(X/1,000)** が主役なので、カンマ金額の網とは**別の網**を張る。
//      「13.5/1,000」は カンマ金額の網(/\d{1,3}(,\d{3})+/) に「1,000」として入ってしまうため、
//      **千分率を先に剥がしてから**金額を数える（剥がさないと料率の1,000が金額に化ける）
//  - ★網は「値の過不足」には強いが、**同じ値が複数箇所に出る主張の位置ずれ**には無力。
//    この記事の最大の危険は **端数規則の「以下/未満」の取り違え** で、これは網では絶対に守れない
//    （源泉控除の行と現金払いの行を**入れ替えても、集合には同じ語が残る**）。
//    → 端数表は **支払い方のセルで行を特定**し、その行の中だけを見る（名指しの粒度）
//  - 要素の名指しは「一意」でなければ効かない。表の行は**主語セル**で特定する
//  - 正しさの根拠は自分の算数でなく一次情報に置く
//    → ★外部オラクル: 厚労省が公表した2値（雇用保険率・二事業率）だけから、
//      徴収法31条1項1号の式で**公表の労働者負担率が3業種すべて再現する**ことを確かめる
import fs from 'node:fs';
import { calcKoyou, koyouRates } from '../docs/assets/shaho_core.js';

const FILE = process.env.ARTICLE_FILE || 'docs/column/koyou-hokenryo-ritsu/index.html';
const RATES = JSON.parse(fs.readFileSync('docs/assets/shaho_rates_r08.json', 'utf8'));
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

// ───────── 前提（一次情報。ここだけが手打ちを許される） ─────────
// 厚生労働省「令和8年度 雇用保険料率のご案内」(LL080312保01) の公表値
const MHLW = {
  general:      { label: '一般の事業',          total: 13.5, jigyo2: 3.5, worker: 5,   employer: 8.5,  r7total: 14.5, r7worker: 5.5, r7employer: 9 },
  agri_sake:    { label: '農林水産・清酒製造',   total: 15.5, jigyo2: 3.5, worker: 6,   employer: 9.5,  r7total: 16.5, r7worker: 6.5, r7employer: 10 },
  construction: { label: '建設の事業',          total: 16.5, jigyo2: 4.5, worker: 6,   employer: 10.5, r7total: 17.5, r7worker: 6.5, r7employer: 11 },
};
// 厚労省「雇用保険被保険者からの雇用保険料の控除方法」の端数規則
const HASU_GENSEN = { under: '50銭以下', over: '50銭1厘以上' };  // 賃金から源泉控除する場合
const HASU_GENKIN = { under: '50銭未満', over: '50銭以上' };     // 事業主へ現金で支払う場合
// 健保・厚年の上限（この記事は「雇用保険にはこれが無い」と主張するので前提として要る）
const KOSEI_SHOYO_JOGEN = '150万円';   // 厚年 賞与1回あたり
const KENPO_SHOYO_JOGEN = '573万円';   // 健保 年度累計

// ───────── ★外部オラクル: 公表2値から労働者負担率が導出できるか ─────────
// 徴収法31条1項1号: (雇用保険率 − 二事業分) ÷ 2 = 労働者負担
// 二事業率(12条6項)は「二事業費充当徴収保険率 ÷ 雇用保険率」= 比率 なので、雇用保険率が約分で消える
for (const [key, m] of Object.entries(MHLW)) {
  const r = koyouRates(m.total, m.jigyo2);
  if (r.workerPermille !== m.worker) fail(`外部オラクル不一致[${m.label}]: (${m.total}−${m.jigyo2})÷2 = ${r.workerPermille} ≠ 公表 ${m.worker}`);
  else if (r.employerPermille !== m.employer) fail(`外部オラクル不一致[${m.label}]: 事業主 ${r.employerPermille} ≠ 公表 ${m.employer}`);
  else ok(`外部オラクル[${m.label}]: (${m.total}−${m.jigyo2})÷2 = ${m.worker}/1,000・事業主 ${m.employer}/1,000 が公表値と一致`);
  // 実装(rates JSON)も同じ値を持っているか（記事とツールの二重化を防ぐ）
  const t = RATES.koyou.types[key];
  if (!t || t.total_permille !== m.total || t.jigyo2_permille !== m.jigyo2 || t.worker_permille !== m.worker) {
    fail(`rates JSON が厚労省公表値と食い違う[${m.label}]`);
  }
}

// ───────── 導出（記事の数字はここから来る。手打ちしない） ─────────
const G = MHLW.general;
const calc = w => calcKoyou(w, G.total, G.jigyo2);
const CASES = [200000, 300000, 500000, 3000000];      // 計算例の表に出る賃金
const TSUKIN = 305000;                                 // 通勤手当込み（同じ等級・違う保険料）
const YEAR_WAGE = 300000 * 12 + 500000 * 2;            // 460万円
const YEAR_SELF = calc(300000).self * 12 + calc(500000).self * 2;                       // 23,000
const YEAR_SELF_R7 = Math.round(300000 * G.r7worker / 1000) * 12 + Math.round(500000 * G.r7worker / 1000) * 2; // 25,300
const YEAR_DIFF = YEAR_SELF_R7 - YEAR_SELF;            // 2,300
const HANPA_WAGE = 100100;                             // ちょうど50銭になる賃金
const HANPA_RAW = HANPA_WAGE * G.worker / 1000;        // 500.5
const HANPA_GENSEN = calc(HANPA_WAGE).self;            // 天引き: 50銭以下 → 切捨 = 500
const HANPA_GENKIN = Math.ceil(HANPA_RAW);             // 現金: 50銭以上 → 切上 = 501
if (HANPA_RAW !== 500.5) fail(`端数の例が「ちょうど50銭」になっていない → ${HANPA_RAW}`);
else if (HANPA_GENSEN !== 500 || HANPA_GENKIN !== 501) fail(`端数の分岐が再現しない: 天引き${HANPA_GENSEN} / 現金${HANPA_GENKIN}`);
else ok(`外部オラクル: ${HANPA_WAGE.toLocaleString()}円×${G.worker}/1,000 = ${HANPA_RAW}（ちょうど50銭）→ 天引き${HANPA_GENSEN}円 / 現金${HANPA_GENKIN}円`);
// 同じ等級（第22級=30万円）でも賃金総額が違えば保険料が違う
const SAME_GRADE_DIFF = calc(TSUKIN).self - calc(300000).self;   // 25円
if (SAME_GRADE_DIFF !== 25) fail(`同一等級の差が25円にならない → ${SAME_GRADE_DIFF}`);

// ───────── 抽出 ─────────
const title = (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
const cardDesc = (html.match(/<meta name="card-desc" content="([^"]*)"/) || [, ''])[1];
// JSON-LD(FAQPage)は本文から生成されるので、二重に数えないよう本文だけを対象にする
const body = html.slice(html.indexOf('<article>'));
if (body.length < 5000) fail('抽出に失敗（<article>が読めていない）');
// 関連カード（他の記事の主張。この記事の期待集合に混ぜない）は名指しで除外し、別に本数を見る
const relatedRe = /<section class="related">[\s\S]*?<\/section>/;
const relatedHtml = (body.match(relatedRe) || [, ''])[0] || '';
const cards = (relatedHtml.match(/class="tool-card"/g) || []).length;
if (cards !== 4) fail(`関連カードが4本でない（${cards}本）。除外領域が盲点になっていないか確認`);
else ok('関連カード4本（網からの除外領域は、この範囲だけ）');

// タグ剥がしは空白を生む（`= <b>5</b>` → `=  5`）。**空白を潰してから**比較しないと、
// 正しい記事を落とす検査になる（実際にこれで導出表の3行が誤って赤になった）。
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
// title と meta description も「公開された主張」なので数える（タグ剥がしで消えるため明示的に連結）
const textRaw = strip(body.replace(relatedRe, ' ')) + ' ' + title + ' ' + desc + ' ' + cardDesc;

// ───────── 網1: 1000分率（この記事の主役） ─────────
// 先に千分率を剥がしてから金額を数える（そうしないと「13.5/1,000」の 1,000 が金額に化ける）
const permilleRe = /(\d+(?:\.\d+)?)\/1,000/g;
const foundPermille = new Set();
let mm;
while ((mm = permilleRe.exec(textRaw)) !== null) foundPermille.add(Number(mm[1]));
const expectPermille = new Set();
for (const m of Object.values(MHLW)) {
  expectPermille.add(m.total); expectPermille.add(m.worker); expectPermille.add(m.employer);
  expectPermille.add(m.r7total); expectPermille.add(m.r7worker); expectPermille.add(m.r7employer);
}
expectPermille.add(G.jigyo2);              // 3.5（二事業・一般）
expectPermille.add(MHLW.construction.jigyo2); // 4.5（二事業・建設）
expectPermille.add(10);                    // 失業等給付・育休給付の部分（13.5 − 3.5）
expectPermille.add(4); expectPermille.add(12);  // 12条5項の弾力条項の範囲（千分の四〜千分の十二）
const extraP = [...foundPermille].filter(v => !expectPermille.has(v));
const missP = [...expectPermille].filter(v => !foundPermille.has(v));
if (extraP.length) fail(`千分率に見覚えのない値: ${extraP.join(', ')}（一次情報にない率を書いていないか）`);
else ok(`千分率の網: 記事に出る ${foundPermille.size} 個の率がすべて一次情報から導ける`);
if (missP.length) console.log(`    （未出現の率: ${missP.join(', ')}）`);

// ───────── 網2: カンマ区切りの金額（千分率を剥がしたあとで数える） ─────────
const textNoPermille = textRaw.replace(/\d+(?:\.\d+)?\/1,000/g, ' ');
const foundYen = new Set((textNoPermille.match(/\d{1,3}(?:,\d{3})+/g) || []).map(s => Number(s.replace(/,/g, ''))));
const expectYen = new Set();
for (const w of CASES) {
  const r = calc(w);
  expectYen.add(w); expectYen.add(r.self); expectYen.add(r.company); expectYen.add(Math.round(r.total));
}
expectYen.add(TSUKIN); expectYen.add(calc(TSUKIN).self);         // 305,000 / 1,525
expectYen.add(calc(300000).self); expectYen.add(calc(300000).company); expectYen.add(Math.round(calc(300000).total));
expectYen.add(YEAR_SELF); expectYen.add(YEAR_SELF_R7); expectYen.add(YEAR_DIFF);
expectYen.add(HANPA_WAGE);                                        // 100,100
expectYen.add(1000); expectYen.add(1500); expectYen.add(2500);    // 1,000円/1,500円/2,500円（本文の言及）
const extraY = [...foundYen].filter(v => !expectYen.has(v));
if (extraY.length) fail(`カンマ金額に、coreから導けない数: ${extraY.map(v => v.toLocaleString()).join(', ')}`);
else ok(`カンマ金額の網: 記事の ${foundYen.size} 個の数がすべて core の計算結果か前提から導ける`);

// ───────── 名指し① 料率表：業種の行を「事業の種類」セルで特定する ─────────
const rows = body.match(/<tr>[\s\S]*?<\/tr>/g) || [];
const rowFor = (label, guard) => rows.find(r => strip(r).includes(label) && (!guard || guard(r)));
for (const m of Object.values(MHLW)) {
  const row = rowFor(m.label, r => /\/1,000/.test(r));
  if (!row) { fail(`料率表に「${m.label}」の行が無い`); continue; }
  const t = strip(row);
  const want = [`${m.worker}/1,000`, `${m.employer}/1,000`, `${m.total}/1,000`,
                `${m.r7worker}/1,000`, `${m.r7employer}/1,000`, `${m.r7total}/1,000`];
  const missing = want.filter(w => !t.includes(w));
  if (missing.length) fail(`料率表[${m.label}]の行に無い: ${missing.join(' / ')}`);
  else ok(`料率表[${m.label}]の行: 労働者${m.worker} 事業主${m.employer} 合計${m.total}（令7も併記）`);
  // 労働者と事業主が同じ値（＝折半だと誤記）になっていないこと
  if (m.worker === m.employer) fail(`[${m.label}] 労働者と事業主が同額になっている（折半ではない）`);
}

// ───────── 名指し② 導出表：各業種の式が (total − jigyo2) ÷ 2 = worker になっているか ─────────
for (const m of Object.values(MHLW)) {
  const row = rows.find(r => strip(r).includes(`(${m.total} − ${m.jigyo2}) ÷ 2`));
  if (!row) { fail(`導出表に「(${m.total} − ${m.jigyo2}) ÷ 2」の行が無い`); continue; }
  const t = strip(row);
  if (!t.includes(`= ${m.worker}`)) fail(`導出表[${m.label}]: 式の答えが ${m.worker} になっていない`);
  else if (!t.includes(`${m.worker}/1,000`)) fail(`導出表[${m.label}]: 公表値の列が ${m.worker}/1,000 でない`);
  else ok(`導出表[${m.label}]: (${m.total} − ${m.jigyo2}) ÷ 2 = ${m.worker} と公表値が並んでいる`);
}

// ───────── 名指し③ 計算例表：賃金セルで行を特定し、core の値と一致するか ─────────
const exRows = [
  ['月給 20万円', 200000], ['月給 30万円', 300000], ['月給 50万円', 500000],
  ['賞与 50万円', 500000], ['賞与 300万円', 3000000],
];
for (const [label, wage] of exRows) {
  const row = rowFor(label);
  if (!row) { fail(`計算例表に「${label}」の行が無い`); continue; }
  const t = strip(row);
  const r = calc(wage);
  const want = [r.self, r.company, Math.round(r.total)].map(v => v.toLocaleString() + '円');
  const missing = want.filter(w => !t.includes(w));
  if (missing.length) fail(`計算例[${label}]の行に無い: ${missing.join(' / ')}（core は ${want.join(' / ')}）`);
  else ok(`計算例[${label}]: 本人${want[0]} 会社${want[1]} 合計${want[2]}（core と一致）`);
}

// ───────── 名指し④ ★端数表：支払い方のセルで行を特定する（網では絶対に守れない） ─────────
// 「以下/未満」「以上/1厘以上」の取り違えは、記事全体では同じ語が残るので集合一致では捕まらない。
// 源泉控除の行と現金払いの行を**入れ替えても緑**になる検査を書いてはいけない。
const gensenRow = rows.find(r => strip(r).includes('源泉控除する場合'));
const genkinRow = rows.find(r => strip(r).includes('現金で支払う場合'));
if (!gensenRow) fail('端数表に「源泉控除する場合」の行が無い');
else {
  const t = strip(gensenRow);
  if (!t.includes(HASU_GENSEN.under) || !t.includes('切り捨て')) fail(`端数表[源泉控除]: 「${HASU_GENSEN.under}なら切り捨て」になっていない`);
  else if (!t.includes(HASU_GENSEN.over)) fail(`端数表[源泉控除]: 「${HASU_GENSEN.over}」が無い`);
  else if (t.includes(HASU_GENKIN.under) || t.includes('50銭以上')) fail('端数表[源泉控除]の行に、現金払いの規則（50銭未満／50銭以上）が混入している');
  else ok(`端数表[源泉控除]: ${HASU_GENSEN.under}→切り捨て / ${HASU_GENSEN.over}→切り上げ`);
}
if (!genkinRow) fail('端数表に「現金で支払う場合」の行が無い');
else {
  const t = strip(genkinRow);
  if (!t.includes(HASU_GENKIN.under) || !t.includes('切り捨て')) fail(`端数表[現金払い]: 「${HASU_GENKIN.under}なら切り捨て」になっていない`);
  else if (!t.includes(HASU_GENKIN.over) || !t.includes('切り上げ')) fail(`端数表[現金払い]: 「${HASU_GENKIN.over}なら切り上げ」になっていない`);
  else if (t.includes('50銭1厘以上')) fail('端数表[現金払い]の行に、源泉控除の規則（50銭1厘以上）が混入している');
  else ok(`端数表[現金払い]: ${HASU_GENKIN.under}→切り捨て / ${HASU_GENKIN.over}→切り上げ`);
}
// ちょうど50銭の例（summary-box）。天引きと現金の答えが入れ替わっていないこと
const boxes = body.match(/<div class="summary-box">[\s\S]*?<\/div>/g) || [];
const hanpaBox = boxes.find(b => strip(b).includes(HANPA_WAGE.toLocaleString()));
if (!hanpaBox) fail('ちょうど50銭の計算例（summary-box）が無い');
else {
  const t = strip(hanpaBox);
  if (!t.includes(`${HANPA_RAW}円`)) fail(`50銭の例: ${HANPA_RAW}円 が無い`);
  // 「天引き…500円」「現金…501円」の対応が正しいか（行ごとに切って見る）
  const tenbiki = t.split('・').find(s => s.includes('天引き')) || '';
  const genkin  = t.split('・').find(s => s.includes('現金で支払う')) || '';
  if (!tenbiki.includes(`${HANPA_GENSEN}円`) || !tenbiki.includes('切り捨て')) fail(`50銭の例: 天引きの答えが「切り捨てて${HANPA_GENSEN}円」でない → "${tenbiki.trim()}"`);
  else if (!genkin.includes(`${HANPA_GENKIN}円`) || !genkin.includes('切り上げ')) fail(`50銭の例: 現金払いの答えが「切り上げて${HANPA_GENKIN}円」でない → "${genkin.trim()}"`);
  else ok(`50銭の例: 天引き→切り捨て${HANPA_GENSEN}円 / 現金→切り上げ${HANPA_GENKIN}円（入れ替わっていない）`);
}

// ───────── 名指し⑤ 同一等級でも保険料が違う（callout） ─────────
const callouts = body.match(/<div class="callout">[\s\S]*?<\/div>\s*<\/div>|<div class="callout">[\s\S]*?<\/div>/g) || [];
const gradeCallout = callouts.find(c => strip(c).includes('同じ等級'));
if (!gradeCallout) fail('「同じ等級の2人でも雇用保険料は違う」の callout が無い');
else {
  const t = strip(gradeCallout);
  const want = ['1,500円', '1,525円', `${SAME_GRADE_DIFF}円`, '第22級'];
  const missing = want.filter(w => !t.includes(w));
  if (missing.length) fail(`同一等級の callout に無い: ${missing.join(' / ')}`);
  else ok(`同一等級の callout: 1,500円 と 1,525円 で ${SAME_GRADE_DIFF}円 違う（第22級で同額なのは健保・厚年）`);
}

// ───────── 名指し⑥ 比較表：計算のもとが「賃金総額」で、標準報酬月額でないこと ─────────
const baseRow = rowFor('計算のもと');
if (!baseRow) fail('健保・厚年との比較表に「計算のもと」の行が無い');
else {
  const t = strip(baseRow);
  if (!t.includes('標準報酬月額')) fail('比較表[計算のもと]: 健保・厚年側が標準報酬月額になっていない');
  else if (!t.includes('賃金総額')) fail('★比較表[計算のもと]: 雇用保険側が「賃金総額」になっていない（記事の核心）');
  else ok('比較表[計算のもと]: 健保・厚年＝標準報酬月額 ⇔ 雇用保険＝賃金総額');
}
// 賞与の上限：健保573万・厚年150万が「あり」の側にあり、雇用保険は「なし」であること
const shoyoRow = rowFor('賞与の上限');
if (!shoyoRow) fail('比較表に「賞与の上限」の行が無い');
else {
  const t = strip(shoyoRow);
  if (!t.includes(KOSEI_SHOYO_JOGEN) || !t.includes(KENPO_SHOYO_JOGEN)) fail(`比較表[賞与の上限]: 健保${KENPO_SHOYO_JOGEN}／厚年${KOSEI_SHOYO_JOGEN} が無い`);
  else if (!/なし/.test(t)) fail('★比較表[賞与の上限]: 雇用保険が「なし」になっていない（記事の核心）');
  else ok(`比較表[賞与の上限]: 健保${KENPO_SHOYO_JOGEN}／厚年${KOSEI_SHOYO_JOGEN} ⇔ 雇用保険は なし`);
}

// ───────── 名指し⑦ 条文の引用（blockquote）。核心の語が引用の中にあること ─────────
const quotes = body.match(/<blockquote>[\s\S]*?<\/blockquote>/g) || [];
const q31 = quotes.find(q => strip(q).includes('31条1項1号'));
const q12 = quotes.find(q => strip(q).includes('12条6項'));
const q11 = quotes.find(q => strip(q).includes('11条1項'));
if (!q31) fail('徴収法31条1項1号の引用（blockquote）が無い');
else {
  const t = strip(q31);
  if (!t.includes('二分の一')) fail('★31条の引用から「二分の一」が消えている（折半の根拠そのもの）');
  else if (!t.includes('減じた額')) fail('★31条の引用から「減じた額」が消えている（引いてから折半、の根拠）');
  else if (!t.includes('二事業率')) fail('31条の引用に「二事業率」が無い');
  else ok('31条1項1号の引用: 「減じた額の二分の一」＋「二事業率」が引用の中にある');
}
if (!q12) fail('徴収法12条6項の引用（blockquote）が無い');
else {
  const t = strip(q12);
  // ★ここが記事の背骨: 二事業率は「率そのもの」ではなく「雇用保険率で除して得た率」＝比率
  if (!t.includes('雇用保険率で除して得た率')) fail('★12条6項の引用から「雇用保険率で除して得た率」が消えている（二事業率が比率である根拠＝記事の背骨）');
  else ok('12条6項の引用: 二事業率＝「二事業費充当徴収保険率を雇用保険率で除して得た率」');
}
if (!q11) fail('徴収法11条1項の引用（blockquote）が無い');
else {
  const t = strip(q11);
  if (!t.includes('賃金総額')) fail('★11条1項の引用から「賃金総額」が消えている');
  else if (t.includes('標準報酬月額')) fail('11条1項の引用に「標準報酬月額」が混入している（条文にその語は無い）');
  else ok('11条1項の引用: 「賃金総額に……保険料率を乗じて得た額」');
}

// ───────── 不在の検査: 現行の徴収法に年齢による免除規定は「無い」 ─────────
// この記事は "無いこと" を主張しているので、存在ではなく不在の主張が保たれているかを見る
const menjoH3 = (body.match(/<h3>[^<]*免除[^<]*<\/h3>[\s\S]*?(?=<h3|<h2)/) || [''])[0];
if (!menjoH3) fail('「64歳以上は免除」の節が無い');
else {
  const t = strip(menjoH3);
  if (!/規定は一つもありません|規定はありません/.test(t)) fail('★免除の節: 「現行法に免除規定は無い」という不在の主張が消えている');
  else if (!t.includes('64歳')) fail('免除の節に「64歳」が無い');
  else ok('免除の節: 現行の徴収法に年齢による免除規定は無い、と明示している');
}

// ───────── ツール導線・年度の明記 ─────────
if (!/href="\.\.\/\.\.\/shakai-hoken\/"/.test(body)) fail('社会保険料計算ツールへの導線が無い');
else ok('ツール導線: /shakai-hoken/ へのCTAがある');
const yearInData = RATES.koyou.applies_from;   // "2026-04"
if (yearInData !== '2026-04') fail(`rates JSON の雇用保険 applies_from が 2026-04 でない（${yearInData}）。記事の「令和8年度」と食い違う`);
else ok('年度: rates JSON の適用開始（2026-04）と記事の令和8年度が一致');

console.log(ng === 0 ? '\n✓ 記事「雇用保険料率」の照合 OK' : `\n✗ ${ng}件の不一致`);
process.exit(ng === 0 ? 0 : 1);
