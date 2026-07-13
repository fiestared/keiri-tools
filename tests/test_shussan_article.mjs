// 記事「出産手当金」の数字・条文引用を機械照合する。
//
// 規律（CLAUDE.md）:
//  - 存在確認(includes)ではなく「集合の一致」で見る。過不足の両方を落とす
//  - 表記の系統ごとに別の網を張る（カンマ区切り金額 / 万円 / % / 日数）。網の外を数える
//  - 日数の網は、日付（令和8年7月31日など）を先に除去してから数える
//  - 要素の名指しは「一意」でなければ効かない。表の行は主語セルで特定する
//  - title と meta description も検査対象（タグ剥がしで消えるため個別に連結する）
//  - 正しさの根拠は自分の算数ではなく一次情報に置く（協会けんぽの公式計算例で先に検算する）
import fs from 'node:fs';
import { KENKO_GRADES, calcMonthly } from '../docs/assets/shaho_core.js';
import { kouTax } from '../docs/assets/gensen_kyuyo_core.js';

const FILE = 'docs/column/shussan-teate-kin/index.html';
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

// ───────── 前提（一次情報。ここだけが手打ちを許される） ─────────
const RATES = JSON.parse(fs.readFileSync('docs/assets/shaho_rates_r08.json', 'utf8'));
const TOKYO_KENKO = RATES.kenko_rates['東京都'];
const SANZEN = 42;        // 健保法102条1項: 産前42日
const SANZEN_TATAI = 98;  // 同 多胎98日
const SANGO = 56;         // 同 産後56日
const CAP_UNDER12M = 320000;   // 協会けんぽ: 支給開始日が令和7年4月1日以降は32万円
const IKUKYU_CAP_MONTH = 323811; // 育児休業給付の支給上限額（令和8年7月31日まで）
const GROSS = 300000;     // 手取り比較の前提: 月給30万円・東京・30歳・扶養0

// ───────── 導出（条文どおりの算式。記事の数字はここから来る） ─────────
// 健保法99条2項（102条2項が準用）: ÷30 は10円未満四捨五入 → ×2/3 は1円未満四捨五入
const daily = smr => Math.round((Math.round(smr / 30 / 10) * 10) * 2 / 3);
const per30 = smr => Math.round(smr / 30 / 10) * 10;

// ★外部オラクル: 実装が協会けんぽの公式計算例を再現することを先に確かめる
// （支給開始日 令和8年2月15日 / 16万円×6か月・18万円×6か月 → 平均17万円 → 5,670円 → 3,780円）
{
  const avg = (160000 * 6 + 180000 * 6) / 12;
  if (avg !== 170000) fail(`公式例の平均額が17万円にならない: ${avg}`);
  else if (per30(avg) !== 5670) fail(`公式例 ÷30 が5,670円にならない: ${per30(avg)}`);
  else if (daily(avg) !== 3780) fail(`公式例の日額が3,780円にならない: ${daily(avg)}`);
  else ok('外部オラクル: 協会けんぽの公式計算例（17万円→5,670円→3,780円）を再現');
}

const TOP_GRADE = KENKO_GRADES[KENKO_GRADES.length - 1][1]; // 第50級 1,390,000円
if (TOP_GRADE !== 1390000) fail(`健保の最高等級が139万円でない: ${TOP_GRADE}`);

const D30 = daily(300000);        // 6,667円
const D_CAP = daily(CAP_UNDER12M); // 7,113円
const D_TOP = daily(TOP_GRADE);   // 30,887円
const D_ORACLE = daily(170000);   // 3,780円

// 社会保険料（本人負担）と所得税は、記事の数字を手打ちせずツール本体に計算させる
const shaho = calcMonthly(GROSS, TOKYO_KENKO, RATES.kaigo_rate, 30, RATES.kosei_nenkin_rate, RATES.kosodate_rate);
const SELF_SHAHO = shaho.selfTotal;                 // 42,570円
const TAX_TABLE = JSON.parse(fs.readFileSync('docs/assets/gensen_getsugaku_r08.json', 'utf8'));
const TAX = kouTax(TAX_TABLE, GROSS - SELF_SHAHO, 0); // 6,430円
const TEDORI_NORMAL = GROSS - SELF_SHAHO - TAX;      // 251,000円
const TEDORI_SANKYU = D30 * 30;                      // 200,010円

// 記事に登場してよい「カンマ区切りの金額」の集合（前提 ∪ 導出）
const EXPECT_YEN = new Set([
  per30(170000), D_ORACLE, D_ORACLE * (SANZEN + SANGO),        // 5,670 / 3,780 / 370,440
  per30(300000), D30, D30 * (SANZEN + SANGO),                  // 10,000 / 6,667 / 653,366
  per30(CAP_UNDER12M), D_CAP, D_CAP * (SANZEN + SANGO),        // 10,670 / 7,113 / 697,074
  per30(TOP_GRADE), D_TOP, D_TOP * (SANZEN + SANGO),           // 46,330 / 30,887 / 3,026,926
  D30 * (SANZEN + 10 + SANGO),                                 // 720,036（10日遅れ・108日）
  D30 * (SANZEN - 10 + SANGO),                                 // 586,696（10日早い・88日）
  D30 * 10,                                                    // 66,670（10日分の差）
  D30 * (SANZEN_TATAI + SANGO),                                // 1,026,718（多胎154日）
  3000, D30 - 3000, 7000,                                      // 給与併給の例（3,000 / 3,667 / 7,000）
  SELF_SHAHO, TAX, TEDORI_NORMAL, TEDORI_SANKYU, GROSS,        // 手取り比較
  IKUKYU_CAP_MONTH, Math.floor(IKUKYU_CAP_MONTH / 30),         // 323,811 / 10,793（育休の上限）
  Math.floor(170000 / 30),  // 5,666（公式例で「5,666.67…→5,670円」と丸める前を見せている）
]);

// ───────── 抽出 ─────────
// title と meta description は、タグ剥がしで属性ごと消えるので個別に拾って連結する
const title = (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
const cardDesc = (html.match(/<meta name="card-desc" content="([^"]*)"/) || [, ''])[1];
// JSON-LD（FAQPage）は本文から生成されるので、二重に数えないよう本文だけを対象にする
const body = html.slice(html.indexOf('<article>'));
const plain = body.replace(/<[^>]+>/g, ' ');
const text = [title, desc, cardDesc, plain].join(' ');
if (!/6,667/.test(text)) fail('抽出に失敗（本文が読めていない）');

// ① カンマ区切りの金額
const yen = new Set((text.match(/\d{1,3}(?:,\d{3})+/g) || []).map(s => Number(s.replace(/,/g, ''))));
// ② 万円表記（カンマを含まないので①の網には入らない）
const man = new Set((text.match(/(\d+(?:\.\d+)?)万円/g) || []).map(s => parseFloat(s)));
// ③ パーセント
const pct = new Set((text.match(/(\d+(?:\.\d+)?)%/g) || []).map(s => parseFloat(s)));
// ④ 日数（★日付を先に除去する。「令和8年7月31日」の"31日"を日数と誤認するため）
const noDate = text
  .replace(/令和\d+年\d+月\d+日/g, ' ')
  .replace(/\d{4}年\d+月\d+日/g, ' ')
  .replace(/令和\d+年\d+月/g, ' ')
  .replace(/令和\d+年\d+月〜令和\d+年\d+月/g, ' ');
const days = new Set((noDate.match(/(\d+)日/g) || []).map(s => parseInt(s, 10)));

const EXPECT_MAN = new Set([
  16, 18, 17,          // 公式例の標準報酬月額と平均
  30,                  // 月給30万円
  32,                  // 12か月未満の上限
  139,                 // 最高等級
  50,                  // 「月給50万円で入社3か月目」の例
  21,                  // 「月額換算で約21万円」
]);
const EXPECT_PCT = new Set([
  66.7,   // 額面比（2/3）
  79.7,   // 手取り比
  67, 50, // 育児休業給付の給付率
  13,     // 関連カード（育児休業給付金の記事）の説明文「67%＋13%」。この記事の主張ではないが本文に出る
  9.85, 0.23, 18.3, // 東京都の料率（令和8年度）
]);
const EXPECT_DAYS = new Set([
  SANZEN, SANGO, SANZEN + SANGO,          // 42 / 56 / 98
  SANZEN_TATAI, SANZEN_TATAI + SANGO,     // 98 / 154
  SANZEN + 10 + SANGO, SANZEN + 10,       // 108 / 52
  SANZEN - 10 + SANGO, SANZEN - 10,       // 88 / 32
  10,   // ずれの日数
  1,    // 「1日あたり」「1日6,667円」
  30,   // 「30日分」
  3, 4, // 傷病手当金の待期3日・4日目
  57,   // 産後57日目
  181,  // 育休の181日目から50%
]);

const cmp = (name, got, want) => {
  const extra = [...got].filter(v => !want.has(v));
  const missing = [...want].filter(v => !got.has(v));
  if (extra.length) fail(`${name}: 記事にあるが期待に無い → ${extra.join(', ')}`);
  if (missing.length) fail(`${name}: 期待したが記事に無い → ${missing.join(', ')}`);
  if (!extra.length && !missing.length) ok(`${name}: ${got.size}件が完全一致`);
};
cmp('金額（カンマ区切り）', yen, EXPECT_YEN);
cmp('万円表記', man, EXPECT_MAN);
cmp('パーセント', pct, EXPECT_PCT);
cmp('日数', days, EXPECT_DAYS);

// ───────── 要素の名指し（集合に入らない主張は、載っている要素を一意に特定して見る） ─────────
// 条文の引用は「引用ブロックの中」を見る。本文一致では、同じ語が解説文にもあるため素通しする
const quotes = [...body.matchAll(/<blockquote class="callout">([\s\S]*?)<\/blockquote>/g)].map(m => m[1]);
if (quotes.length !== 2) fail(`条文の引用ブロックが2つでない: ${quotes.length}`);

const q102 = quotes.find(q => /第102条第1項/.test(q));
if (!q102) fail('102条の引用ブロックが見つからない');
else {
  // 支給期間は条文の漢数字。ここが汚染されると記事の背骨が折れる
  for (const kanji of ['四十二日', '九十八日', '五十六日', '労務に服さなかった期間']) {
    if (!q102.includes(kanji)) fail(`102条の引用から「${kanji}」が消えている`);
  }
  if (!/出産の日が出産の予定日後であるときは、出産の予定日/.test(q102))
    fail('102条の引用から、記事の核心であるかっこ書き（予定日後→予定日に読み替え）が消えている');
  ok('102条の引用ブロック: 支給期間の漢数字とかっこ書きが原文どおり');
}

const q99 = quotes.find(q => /第99条第1項/.test(q));
if (!q99) fail('99条の引用ブロックが見つからない');
else {
  // 「任意継続では受け取れない」根拠は、離れた99条の準用指示。ここが記事の独自の一段
  if (!q99.includes('任意継続被保険者を除く')) fail('99条の引用から「任意継続被保険者を除く」が消えている');
  if (!q99.includes('第百二条第一項において同じ'))
    fail('99条の引用から「第百二条第一項において同じ」が消えている（この一文が無いと102条に効く根拠を失う）');
  ok('99条の引用ブロック: 「第百二条第一項において同じ」が原文どおり');
}

// 表の行は「主語のセル」で一意に特定する（第1便の教訓: 一意でない名指しは別の行に当たる）
const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
const rowBySubject = re => rows.find(r => {
  const first = (r.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/) || [, ''])[1].replace(/<[^>]+>/g, '');
  return re.test(first);
});
const checkRow = (label, re, musts) => {
  const row = rowBySubject(re);
  if (!row) { fail(`${label}: 行が見つからない`); return; }
  const t = row.replace(/<[^>]+>/g, ' ');
  const miss = musts.filter(m => !t.includes(m));
  if (miss.length) fail(`${label}: 行に ${miss.join(' / ')} が無い（行の中身: ${t.trim().replace(/\s+/g, ' ')}）`);
  else ok(`${label}: 行が正しい`);
};
// ずれの表（記事の中心的な主張。遅れ→増える / 早い→減る）
checkRow('予定日どおり', /^予定日どおりに出産$/, ['42日', '56日', '98日', '653,366']);
checkRow('10日遅れ', /^10日遅れて出産$/, ['52日', '56日', '108日', '720,036']);
checkRow('10日早い', /^10日早く出産$/, ['32日', '56日', '88日', '586,696']);
// 早見表（標準報酬月額を主語に）
checkRow('早見表17万円', /^17万円/, ['5,670', '3,780', '370,440']);
checkRow('早見表30万円', /^30万円$/, ['10,000', '6,667', '653,366']);
checkRow('早見表32万円', /^32万円/, ['10,670', '7,113', '697,074']);
checkRow('早見表139万円', /^139万円/, ['46,330', '30,887', '3,026,926']);
// 育休との比較（上限の非対称＝「産後57日目の崖」の根拠）
checkRow('上限の比較', /^上限$/, ['30,887', '323,811']);
// 手取り比較
checkRow('手取り', /^手元に残る額$/, ['251,000', '200,010']);

// 「遅れると増える／早いと減る」の向きが反転していないこと（数字が揃っていても向きが逆なら嘘になる）
const zure = body.slice(body.indexOf('id="zure"'), body.indexOf('id="morenai"'));
if (!/遅れた期間についても出産手当金が支給されます/.test(zure))
  fail('協会けんぽの明示（遅れた期間も支給される）が本文から消えている');
if (!/遅れた分は損ではなく、そのまま給付が増えます/.test(zure)) fail('「遅れると増える」の断定が消えている');
if (!/総額は10日分少なくなります/.test(zure)) fail('「早いと減る」の断定が消えている');
const dPos = zure.indexOf('10日遅れて出産'), ePos = zure.indexOf('10日早く出産');
if (!(dPos > 0 && ePos > dPos)) fail('ずれの表の行の順序が想定と違う（遅れ→早いの順で書いている）');
else ok('ずれの向き: 「遅れ＝増える」「早い＝減る」が本文で断定されている');

// 待期3日が「無い」という主張（傷病手当金との違い。準用の範囲が根拠）
// ★本文一致で見てはいけない。同じ文がFAQの答えにもあるため、calloutを「1項と2項」に改ざんしても
//   本文のどこかに正しい文が残って緑になる（第19便と同型の再発を、壊しテストで検出した）
{
  const callouts = [...body.matchAll(/<div class="callout">([\s\S]*?)<\/div>/g)].map(m => m[1]);
  const c = callouts.filter(x => /待期3日/.test(x));
  if (c.length !== 1) fail(`待期のcalloutが一意に特定できない: ${c.length}件`);
  else {
    const t = c[0];
    if (!/準用しているのは<b>99条の2項と3項だけ<\/b>/.test(t))
      fail('待期のcallout: 「準用は99条の2項と3項だけ」という根拠が改ざん・削除されている');
    else if (!/待期を定めた1項は準用されていません/.test(t))
      fail('待期のcallout: 「1項（待期）は準用されない」が消えている');
    else ok('待期3日が無い根拠（準用の範囲）が、その主張を載せたcallout内にある');
  }
}

// 任意継続が除外される根拠（99条のかっこ書きが102条に及ぶ）を、解説側でも一意に確かめる
{
  const sec = body.slice(body.indexOf('id="morenai"'), body.indexOf('id="taishoku"'));
  if (!/「<b>第百二条第一項において同じ<\/b>」——この一文が/.test(sec))
    fail('任意継続の節: 「第百二条第一項において同じ」が記事の核心として名指しされていない');
  else ok('任意継続の節: 99条のかっこ書きが102条に及ぶ、という核心が本文にある');
}

console.log(ng === 0 ? '\n✓ 出産手当金の記事 OK' : `\n✗ ${ng}件`);
process.exit(ng ? 1 : 0);
