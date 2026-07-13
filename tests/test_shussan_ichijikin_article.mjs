// 記事「出産育児一時金」の数字・条文引用を機械照合する。
//
// 規律（CLAUDE.md）:
//  - 存在確認(includes)ではなく「集合の一致」で見る。過不足の両方を落とす
//  - 表記の系統ごとに別の網を張る。網の外に何が残るかを数える
//    → この記事は和風表記が濃い（48万8千円・1万2千円）ので **「N万M千円」専用の網**を張る。
//      「3,000万円」は 万円 の網にも カンマ円 の網にも構造上入らないので **専用の網**を張る。
//  - ★網は「値の過不足」には強いが、**同じ値が複数箇所に出る主張の位置ずれ**には無力（第3便）。
//    この記事の核心（22週 / 28週）は本文・図・表・FAQ・出典の全部に出るので、
//    **網では守れない**。要素を名指しして、その中を見る（下の「名指し」節）。
//  - 要素の名指しは「一意」でなければ効かない。表の行は**主語セル**で特定する
//  - ★「無いこと」が主張になっている箇所がある（101条に任意継続の除外が無い）。
//    存在ではなく **不在** を検査する
//  - 正しさの根拠は自分の算数でなく一次情報に置く
//    → 産科医療補償制度の公表値（準備一時金600万＋分割金120万×20回）から総額3,000万円を再現する
import fs from 'node:fs';

const FILE = process.env.ARTICLE_FILE || 'docs/column/shussan-ikuji-ichijikin/index.html';
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

// ───────── 前提（一次情報。ここだけが手打ちを許される） ─────────
// 健康保険法施行令36条: 政令が定める額と、加算の上限
const SEIREI_GAKU = 488000;      // 四十八万八千円
const KASAN_JOGEN = 30000;       // 三万円を超えない範囲内
// 産科医療補償制度（日本医療機能評価機構）の公表値
const KAKEKIN = 12000;           // 2022年以降の掛金（1分娩あたり）
const KAKEKIN_2015 = 16000;      // 2015〜2021年
const KAKEKIN_2009 = 30000;      // 2009〜2014年
const JUNBI = 600;               // 準備一時金 600万円（1回）
const BUNKATSU = 120;            // 補償分割金 120万円／年
const BUNKATSU_KAI = 20;         // 20回
const WEEK_KASAN = 22;           // 掛金＝一時金の上乗せの対象になる境目
const WEEK_HOSHO = 28;           // 補償の対象になる境目（健保則86条の2）

// ───────── 導出（記事の数字はここから来る。手打ちしない） ─────────
const SHIKYU = SEIREI_GAKU + KAKEKIN;          // 500,000 → 50万円
const FUTAGO = SHIKYU * 2;                     // 1,000,000 → 100万円
const ZURE = WEEK_HOSHO - WEEK_KASAN;          // 6週
const HOSHO_SOGAKU = JUNBI + BUNKATSU * BUNKATSU_KAI;  // 3,000万円
const JOGEN_MADE = SEIREI_GAKU + KASAN_JOGEN;  // 518,000 → 加算の枠を使い切れば51万8千円まで有りうる

// ★外部オラクル: 制度の公表値だけから、記事が言う金額が再現できるか
if (SHIKYU !== 500000) fail(`オラクル不一致: 48.8万＋1.2万が50万円にならない → ${SHIKYU}`);
else ok('外部オラクル: 政令の488,000円＋掛金12,000円＝500,000円（＝記事の「50万円」）');
if (HOSHO_SOGAKU !== 3000) fail(`オラクル不一致: 600万＋120万×20回が3,000万円にならない → ${HOSHO_SOGAKU}`);
else ok('外部オラクル: 準備一時金600万＋分割金120万×20回＝総額3,000万円');
if (KAKEKIN > KASAN_JOGEN) fail('掛金が政令の加算上限（3万円）を超えている');
else ok(`加算12,000円は政令の枠（3万円を超えない範囲内）に収まる`);

// ───────── 抽出 ─────────
const title = (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
const cardDesc = (html.match(/<meta name="card-desc" content="([^"]*)"/) || [, ''])[1];
// JSON-LD(FAQPage)は本文から生成されるので、二重に数えないよう本文だけを対象にする
const body = html.slice(html.indexOf('<article>'));
if (body.length < 5000) fail('抽出に失敗（<article>が読めていない）');
// ★網から除外する領域を「名指しで」1つだけ置く: <section class="related"> の関連カード。
//   ここに載る数字（例「上限32万円」）は **他の記事の主張** であって、この記事の主張ではない。
//   期待集合に混ぜると、他の記事の数字をこの記事のテストが抱えることになる（腐る）。
//   除外がそのまま盲点にならないよう、下で「関連カードが4本あること」を別に検査する。
const relatedRe = /<section class="related">[\s\S]*?<\/section>/;
const related = (body.match(relatedRe) || [, ''])[0];
const bodyNoRelated = body.replace(relatedRe, ' ');
const plain = bodyNoRelated.replace(/<[^>]+>/g, ' ');
// title / meta description は検索結果に出る＝公開された主張なので検査対象に入れる（第1便）
const text = [title, desc, cardDesc, plain].join(' ');
if (!/48万8千円/.test(text)) fail('抽出に失敗（本文が読めていない）');

// ───────── 網（表記の系統ごとに別々に張る） ─────────
// A: 「N万M千円」— この記事の主要表記。48万8千円 / 1万2千円 / 1万6千円
const manSen = new Set((text.match(/(\d+)万(\d+)千円/g) || [])
  .map(s => { const m = s.match(/(\d+)万(\d+)千円/); return Number(m[1]) * 10000 + Number(m[2]) * 1000; }));
// B: 「N万円」— カンマ付き(3,000万円)と「N万M千円」は構造上ここに入らないので除く
const man = new Set((text.match(/(?<![\d,.])(\d+(?:\.\d+)?)万円/g) || []).map(s => parseFloat(s)));
// C: 「N,NNN万円」— 3,000万円。Bにも下のDにも入らない（網の外になるので専用の網を張る）
const manComma = new Set((text.match(/(\d{1,3}(?:,\d{3})+)万円/g) || [])
  .map(s => Number(s.replace(/[,万円]/g, ''))));
// D: カンマ区切りの円（万を挟まないもの）— 12,000円 / 16,000円 / 30,000円
const yen = new Set((text.match(/(?<![\d,])(\d{1,3}(?:,\d{3})+)円/g) || [])
  .map(s => Number(s.replace(/[,円]/g, ''))));
// E: 週 — この記事の核心。22 / 28 / 27 / 32（旧基準）/ 6（ずれ）
const weeks = new Set((text.match(/(\d+)週/g) || []).map(s => parseInt(s, 10)));
// F: 日 — 日付を先に除去する（「2023年4月1日」の"1日"を日数と誤認して正しい記事を落とすため）
const noDate = text
  .replace(/\d{4}年\d+月\d+日/g, ' ')
  .replace(/令和\d+年\d+月\d+日/g, ' ')
  .replace(/\d+月\d+日/g, ' ')
  .replace(/\d{4}年\d+月/g, ' ');
const days = new Set((noDate.match(/(\d+)日/g) || []).map(s => parseInt(s, 10)));
// G: か月
const months = new Set((text.match(/(\d+)か月/g) || []).map(s => parseInt(s, 10)));
// H: 回
const kai = new Set((text.match(/(\d+)回/g) || []).map(s => parseInt(s, 10)));

const EXPECT_MAN_SEN = new Set([
  SEIREI_GAKU,   // 48万8千円（政令36条の額）
  KAKEKIN,       // 1万2千円（加算＝掛金）
  KAKEKIN_2015,  // 1万6千円（2015〜2021年の掛金）
  JOGEN_MADE,    // 51万8千円（加算の枠3万円を使い切った場合の理論上の上限）
]);
const EXPECT_MAN = new Set([
  SHIKYU / 10000,        // 50万円
  FUTAGO / 10000,        // 100万円（双子）
  SEIREI_GAKU / 10000,   // 48.8万円（表・title・descの小数表記）
  KAKEKIN / 10000,       // 1.2万円（図2の中の表記。本文の「1万2千円」と同じ量の別表記）
  KASAN_JOGEN / 10000,   // 3万円（加算の上限。2009〜2014年の掛金も同じ3万円）
  JUNBI,                 // 600万円（準備一時金）
  BUNKATSU,              // 120万円（補償分割金）
  40, 10, 55, 5,         // 差額の例: 費用40万→差額10万 ／ 費用55万→自己負担5万
]);
const EXPECT_MAN_COMMA = new Set([HOSHO_SOGAKU]);   // 3,000万円（補償の総額）
const EXPECT_YEN = new Set([KAKEKIN, KAKEKIN_2015, KAKEKIN_2009]);  // 12,000 / 16,000 / 30,000（出典）
const EXPECT_WEEKS = new Set([
  WEEK_KASAN,       // 22週（上乗せの境目）
  WEEK_HOSHO,       // 28週（補償の境目）
  27,               // 「22週から27週の間」
  32,               // 2015〜2021年の旧基準（在胎32週以上）
  ZURE,             // 6週ずれている
]);
const EXPECT_DAYS = new Set([85]);                  // 妊娠85日（4か月）
const EXPECT_MONTHS = new Set([
  6,   // 資格喪失後6か月以内（106条）
  3,   // 差額の申請書は出産後おおむね3か月後
  2,   // 受取代理は出産予定日まで2か月以内
  1,   // 出産費貸付は予定日まで1か月以内
  4,   // 妊娠4か月（＝85日）／妊娠4か月以上
]);
const EXPECT_KAI = new Set([1, BUNKATSU_KAI]);      // 支給は1回のみ／準備一時金1回／分割金20回

const cmp = (name, got, want) => {
  const extra = [...got].filter(v => !want.has(v));
  const miss = [...want].filter(v => !got.has(v));
  if (extra.length || miss.length) {
    fail(`${name}の集合が不一致` +
      (extra.length ? ` / 記事にあるが期待にない: ${extra.join(', ')}` : '') +
      (miss.length ? ` / 期待したが記事にない: ${miss.join(', ')}` : ''));
  } else ok(`${name}の集合が一致（${[...want].sort((a, b) => a - b).join(', ')}）`);
};
cmp('「N万M千円」', manSen, EXPECT_MAN_SEN);
cmp('「N万円」', man, EXPECT_MAN);
cmp('「N,NNN万円」', manComma, EXPECT_MAN_COMMA);
cmp('カンマ区切りの円', yen, EXPECT_YEN);
cmp('週', weeks, EXPECT_WEEKS);
cmp('日数', days, EXPECT_DAYS);
cmp('か月', months, EXPECT_MONTHS);
cmp('回', kai, EXPECT_KAI);

// ───────── 名指し（網では守れない主張。要素を一意に特定して中を見る） ─────────
// 網は「記事のどこかに22と28がある」しか見ていない。22と28が入れ替わっても、
// 集合には両方残るので緑のままになりうる。→ 主張が載っている要素そのものを見る。

const rows = [...body.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(m => m[0]);
const quotes = [...body.matchAll(/<blockquote>[\s\S]*?<\/blockquote>/g)].map(m => m[0]);
const callouts = [...body.matchAll(/<div class="callout">[\s\S]*?<\/div>/g)].map(m => m[0]);
const figs = [...body.matchAll(/<figure class="figure">[\s\S]*?<\/figure>/g)].map(m => m[0]);
if (rows.length < 8) fail(`表の行が読めていない（${rows.length}行）`);
if (quotes.length < 4) fail(`blockquoteが読めていない（${quotes.length}件）`);
if (callouts.length < 4) fail(`calloutが読めていない（${callouts.length}件）`);
if (figs.length !== 2) fail(`図解が2つない（${figs.length}件）`);
else ok(`要素を抽出（表${rows.length}行・引用${quotes.length}・callout${callouts.length}・図${figs.length}）`);

// ★1. 金額表: 50万円の行は「22週以降」でなければならない（28週ではない）
const row50 = rows.find(r => /50万円/.test(r));
if (!row50) fail('金額表に50万円の行が無い');
else if (!/22週以降/.test(row50)) fail('★50万円の行が「在胎22週以降」を条件にしていない（上乗せの境目は22週）');
else if (/28週/.test(row50)) fail('★50万円の行に28週が現れている（28週は補償の境目であって、金額の境目ではない）');
else ok('50万円の行の条件は「在胎22週以降」（28週ではない）');

// ★2. 金額表: 48万8千円になる行は「22週に達しなかった」と「未加入」の2つ
const row488 = rows.filter(r => /48万8千円/.test(r));
if (row488.length !== 2) fail(`48万8千円の行が2つない（${row488.length}行）`);
else if (!row488.some(r => /22週に達しなかった/.test(r))) fail('48万8千円の行に「22週に達しなかった」が無い');
else if (!row488.some(r => /加入していない/.test(r))) fail('48万8千円の行に「加入していない医療機関」が無い');
else ok('48万8千円になるのは「22週未満」と「未加入機関」の2行');

// ★3. 施行令36条の引用: 政令の額は48万8千円で、加算は「3万円を超えない範囲内」
const q36 = quotes.find(q => /第三十六条/.test(q));
if (!q36) fail('施行令36条の引用が無い');
else if (!/四十八万八千円/.test(q36)) fail('★36条の引用に「四十八万八千円」が無い（政令の額）');
else if (!/三万円を超えない範囲内/.test(q36)) fail('★36条の引用に「三万円を超えない範囲内」が無い（加算の枠）');
else if (/五十万円/.test(q36)) fail('★36条の引用に「五十万円」が現れている（政令に50万円は書かれていない）');
else ok('施行令36条の引用＝四十八万八千円＋「三万円を超えない範囲内」の加算（50万円は無い）');

// ★4. 101条の引用: 任意継続の除外が「無い」ことが主張。不在を検査する
const q101 = quotes.find(q => /第百一条/.test(q));
if (!q101) fail('健保法101条の引用が無い');
else if (/任意継続被保険者を除く/.test(q101)) fail('★101条の引用に「任意継続被保険者を除く」が現れている（101条にこのかっこ書きは無い。記事の柱が壊れる）');
else if (!/被保険者が出産したときは/.test(q101)) fail('101条の引用が条文どおりでない');
else ok('101条の引用に任意継続の除外が無い（＝任意継続でも一時金が出る根拠）');

// ★5. 99条の引用: 除外のかっこ書きがあり、102条1項にも及ぶ
const q99 = quotes.find(q => /第九十九条/.test(q));
if (!q99) fail('健保法99条の引用が無い');
else if (!/任意継続被保険者を除く/.test(q99)) fail('★99条の引用に「任意継続被保険者を除く」が無い（除外の根拠）');
else if (!/第百二条第一項において同じ/.test(q99)) fail('★99条の引用に「第百二条第一項において同じ」が無い（出産手当金へ除外が及ぶ根拠）');
else ok('99条1項の引用＝除外のかっこ書き＋「第百二条第一項において同じ」');

// ★6. 106条の引用: 6月以内
const q106 = quotes.find(q => /第百六条/.test(q));
if (!q106) fail('健保法106条の引用が無い');
else if (!/六月以内/.test(q106)) fail('★106条の引用に「六月以内」が無い');
else ok('106条の引用＝資格喪失日後「六月以内」の出産');

// ★7. 104条のcallout: 定義が104条にあり、任意継続を除き、106条に飛ぶ
const c104 = callouts.find(c => /104条/.test(c) && /106条/.test(c));
if (!c104) fail('104条の遠隔定義を説明するcalloutが無い');
else if (!/任意継続被保険者又は共済組合の組合員である被保険者を除く/.test(c104))
  fail('★104条のcalloutに「任意継続被保険者又は共済組合の組合員である被保険者を除く」が無い');
else if (!/第百六条において/.test(c104)) fail('★104条のcalloutに「第百六条において」が無い（定義が飛ぶ根拠）');
else if (!/算入されません/.test(c104)) fail('★104条のcalloutが「算入されない」と言い切っていない');
else ok('104条のcallout＝任意継続を除く定義が106条へ飛ぶ（＝任継期間は1年に算入されない）');

// ★8. 任意継続の可否表: 主語セルで一意に特定する（「名指しは一意であれ」）
const rowOf = (subject) => rows.find(r => new RegExp(`<td><b>${subject}</b></td>`).test(r));
{
  const r1 = rowOf('出産育児一時金');
  const r2 = rowOf('出産手当金');
  const r3 = rowOf('傷病手当金');
  if (!r1 || !r2 || !r3) fail('任意継続の可否表の3行を主語セルで特定できない');
  else if (!/<b>受け取れる<\/b>/.test(r1)) fail('★出産育児一時金の行が「受け取れる」になっていない');
  else if (!/<b>受け取れない<\/b>/.test(r2)) fail('★出産手当金の行が「受け取れない」になっていない');
  else if (!/<b>受け取れない<\/b>/.test(r3)) fail('★傷病手当金の行が「受け取れない」になっていない');
  else if (!/101条/.test(r1) || !/無い/.test(r1)) fail('★出産育児一時金の行の根拠が「101条・除外が無い」になっていない');
  else ok('任意継続の可否表＝一時金○（101条）／出産手当金×／傷病手当金×（主語セルで特定）');
}

// ★9. 補償要件のリスト: 28週以上
const ulHosho = (body.match(/<ul>[\s\S]*?在胎週数[\s\S]*?<\/ul>/) || [, ''])[0];
if (!ulHosho) fail('補償要件のリストが無い');
else if (!new RegExp(`<b>在胎週数が${WEEK_HOSHO}週以上</b>`).test(ulHosho))
  fail(`★補償要件のリストが「在胎週数が${WEEK_HOSHO}週以上」になっていない（補償の境目）`);
else if (/22週/.test(ulHosho)) fail('★補償要件のリストに22週が現れている（22週は掛金の境目であって補償の境目ではない）');
else ok(`補償要件のリスト＝「在胎週数が${WEEK_HOSHO}週以上」（22週ではない）`);

// ★10. 産科医療補償制度の引用: 制度の対象は22週以降（＋死産を含む）
const qSanka = quotes.find(q => /妊産婦の意向を問わず/.test(q));
if (!qSanka) fail('産科医療補償制度Q&Aの引用が無い');
else if (!new RegExp(`<b>${WEEK_KASAN}週以降の分娩を制度の対象</b>`).test(qSanka))
  fail(`★制度の対象が「${WEEK_KASAN}週以降の分娩」になっていない`);
else if (!/死産を含みます/.test(qSanka)) fail('★引用に「死産を含みます」が無い（死産でも掛金・一時金の対象）');
else ok('産科医療補償制度の引用＝22週以降の分娩が制度の対象（死産を含む）');

// ★11. 図2の結論: 22〜27週は上乗せは付くが補償には入らない（記事の核心）
const fig2 = figs.find(f => /3つの別々の境目|3つの境目/.test(f));
if (!fig2) fail('週数の図（3つの境目）が無い');
else if (!/22週〜27週で出産した場合は、②は付くが③には入らない/.test(fig2))
  fail('★図2の結論文（22週〜27週は②は付くが③には入らない）が壊れている');
else ok('図2の結論＝22〜27週は上乗せは付くが補償の対象外');

// ★12. 施行規則86条の2: 二十八週以上（漢数字の引用）
//   ⚠️ ここを `body.includes('在胎週数が二十八週以上')` で書いて素通しした（壊しテストが捕捉）。
//   同じ文言が **出典の<li>にも再掲** されているので、本文の引用を二十二週に壊しても集合には残る。
//   → 「記事の出典・FAQは本文の主張を必ず再掲する」（CLAUDE.md）。**引用の<b>要素そのもの**を名指しする。
const bQuote86 = new RegExp(
  `<b>「令第三十六条第一号の厚生労働省令で定める基準は、出生した時点における在胎週数が二十八週以上であることとする。」</b>`);
if (!/86条の2/.test(body)) fail('施行規則86条の2の条番号が無い');
else if (!bQuote86.test(body)) fail('★施行規則86条の2の引用（本文の<b>要素）が「在胎週数が二十八週以上」になっていない');
else ok('施行規則86条の2の引用＝「在胎週数が二十八週以上」（本文の引用要素を名指し）');

// ★13. ずれの言明: 6週ずれていること
if (!new RegExp(`<b>${ZURE}週ずれています。</b>`).test(body))
  fail(`★「${ZURE}週ずれています」の言明が無い（22週と28週の差）`);
else ok(`「${ZURE}週ずれています」と明言している`);

// ★14. 差額のcallout: 費用40万円 → 差額10万円・3か月後
const cSagaku = callouts.find(c => /差額/.test(c) && /40万円/.test(c));
if (!cSagaku) fail('差額のcalloutが無い');
else if (!/<b>10万円<\/b>/.test(cSagaku)) fail('★差額のcalloutが「10万円」になっていない（50万－40万）');
else if (!/<b>3か月後<\/b>/.test(cSagaku)) fail('★差額のcalloutに「3か月後」が無い');
else if (!/申請/.test(cSagaku)) fail('★差額のcalloutが「申請が必要」と言っていない');
else ok('差額のcallout＝費用40万円なら差額10万円・3か月後に申請書・申請が必要');

// ★15. 85日のcallout: 死産・流産・人工妊娠中絶を含む
//   ⚠️ calloutを名指ししただけでは足りず素通しした（壊しテストが捕捉）。
//   **calloutの見出し<b>が、本文の主張をそのまま言い換えて含む**ため、
//   中の<p>から「人工妊娠中絶」を消しても、見出しに残っていて緑になった。
//   → 名指しの粒度を下げ、**主張が1回しか現れない最小の要素**（給付対象を列挙している一文）で見る。
const c85 = callouts.find(c => /85日/.test(c));
if (!c85) fail('妊娠85日のcalloutが無い');
else if (!/<b>妊娠85日（4か月）以降<\/b>の生産（早産）・<b>死産（流産）<\/b>・<b>人工妊娠中絶<\/b>/.test(c85))
  fail('★85日のcalloutの列挙（85日以降の生産・死産（流産）・人工妊娠中絶）が壊れている');
else if (!/生きて生まれたかどうかは要件ではありません/.test(c85))
  fail('★85日のcalloutが「生きて生まれたことは要件でない」と言い切っていない');
else ok('85日のcallout＝生産・死産（流産）・人工妊娠中絶を列挙（列挙の一文を名指し）');

// ★16. 受取代理は出産予定日まで2か月以内
const rowUketori = rows.find(r => /受取代理制度/.test(r));
if (!rowUketori) fail('受取代理制度の行が無い');
else if (!/<b>出産予定日まで2か月以内<\/b>/.test(rowUketori))
  fail('★受取代理の行が「出産予定日まで2か月以内」になっていない');
else ok('受取代理の行＝出産予定日まで2か月以内・届出をした医療機関のみ');

// ★17. 網から除外した関連カードが、盲点にならないことを確かめる（除外は名指しで、かつ検査つき）
{
  const cards = [...related.matchAll(/<a class="tool-card" href="([^"]+)"/g)].map(m => m[1]);
  const want = ['../../shakai-hoken/', '../shussan-teate-kin/', '../ikuji-kyugyo-kyufukin/', '../kenko-hoken-nini-keizoku/'];
  const miss = want.filter(w => !cards.includes(w));
  if (cards.length !== 4 || miss.length)
    fail(`関連カードが4本そろっていない（${cards.length}本${miss.length ? ' / 欠け: ' + miss.join(', ') : ''}）`);
  else ok('関連カード4本（社保計算機・出産手当金・育休給付・任意継続）— 網から除外した領域を別途検査');
}

console.log(ng ? `\n✗ 記事「出産育児一時金」: ${ng}件の不一致` : '\n✓ 記事「出産育児一時金」の数字・条文引用 OK');
process.exit(ng ? 1 : 0);
