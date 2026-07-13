// 記事「健康保険の任意継続」の数字・条文引用を機械照合する。
//
// 規律（CLAUDE.md）:
//  - 存在確認(includes)ではなく「集合の一致」で見る。過不足の両方を落とす
//  - 表記の系統ごとに別の網を張る。網の外に何が残るかを数える
//    → この記事の主張の核心は「倍率」なので、金額/万円/%/日数に加えて **倍の網**を張る
//  - 要素の名指しは「一意」でなければ効かない。表の行は主語セルで特定する
//  - 条文の引用は blockquote/callout を名指しして中を見る（本文一致では FAQ に素通しする）
//  - title と meta description も検査対象（タグ剥がしで属性ごと消えるため個別に連結する）
//  - 正しさの根拠は自分の算数ではなく一次情報に置く
//    → 協会けんぽ「令和8年度 保険料額表（東京都）」第23級の全額を外部オラクルにする
import fs from 'node:fs';
import { calcMonthly } from '../docs/assets/shaho_core.js';

// ARTICLE_FILE で対象を差し替えられる（壊しテスト tests/break_nini.mjs が使う）
const FILE = process.env.ARTICLE_FILE || 'docs/column/kenko-hoken-nini-keizoku/index.html';
const html = fs.readFileSync(FILE, 'utf8');
let ng = 0;
const fail = m => { console.error('  ✗ ' + m); ng++; };
const ok = m => console.log('  ✓ ' + m);

// ───────── 前提（一次情報。ここだけが手打ちを許される） ─────────
const RATES = JSON.parse(fs.readFileSync('docs/assets/shaho_rates_r08.json', 'utf8'));
const KENKO = RATES.kenko_rates['東京都'];   // 9.85%
const KAIGO = RATES.kaigo_rate;              // 1.62%
const KOSODATE = RATES.kosodate_rate;        // 0.23%

// 協会けんぽ「令和8年度の任意継続被保険者の標準報酬月額の上限について」
const CAP = 320000;        // 上限＝第23級 32万円
const HEIKIN = 318100;     // 令和7年9月30日時点の全被保険者の平均標準報酬月額

// ★外部オラクル: 協会けんぽ「令和8年度 保険料額表（東京都）」第23級（320,000円）の全額
//   健康保険 31,520.0 ／ 介護保険を含む 36,704.0 ／ 子ども・子育て支援金 736.0
//   実装（料率JSON）がこの3つを再現できることを、記事を見る前に確かめる。
const r1 = (rate) => Math.round(CAP * rate / 100 * 10) / 10;
const OR_KENKO = r1(KENKO);              // 31,520.0
const OR_KENKO_KAIGO = r1(KENKO + KAIGO); // 36,704.0
const OR_KOSODATE = r1(KOSODATE);        // 736.0
{
  if (OR_KENKO !== 31520) fail(`オラクル不一致: 健保の全額が31,520.0にならない → ${OR_KENKO}`);
  else if (OR_KENKO_KAIGO !== 36704) fail(`オラクル不一致: 健保+介護の全額が36,704.0にならない → ${OR_KENKO_KAIGO}`);
  else if (OR_KOSODATE !== 736) fail(`オラクル不一致: 子育て支援金の全額が736.0にならない → ${OR_KOSODATE}`);
  else ok('外部オラクル: 協会けんぽ公式額表 第23級の全額（31,520.0／36,704.0／736.0）を再現');
}

// ───────── 導出（記事の数字はすべてここから来る。手打ちしない） ─────────
// 任意継続＝全額自己負担（健保法161条1項ただし書）。厚生年金は含まない
const nini = (std, kaigo) => Math.round(std * (KENKO + (kaigo ? KAIGO : 0) + KOSODATE) / 100);
// 在職中の自己負担（折半）。任意継続に厚年は無いので、健保＋子育てだけで比べる
const zaishoku = (monthly, age) => {
  const m = calcMonthly(monthly, KENKO, KAIGO, age, RATES.kosei_nenkin_rate, KOSODATE);
  return { std: m.standard, self: m.kenkoKaigo.self + m.kosodate.self };
};
const NINI_UNDER40 = nini(CAP, false);   // 32,256円
const NINI_40TO64  = nini(CAP, true);    // 37,440円
const GYAKUTEN = CAP * 2;                // 640,000円（逆転点。料率が約分されて消えるので上限の2倍）

// 倍率表の3行（東京都・40歳未満）
const CASES = [300000, 440000, 650000].map(m => {
  const z = zaishoku(m, 38);
  const n = nini(Math.min(z.std, CAP), false);
  return { monthly: m, std: z.std, self: z.self, nini: n, ratio: (n / z.self) };
});
const [C30, C44, C65] = CASES;
const r2 = v => v.toFixed(2);

if (C30.ratio !== 2) fail(`上限以下の倍率がちょうど2.00にならない → ${C30.ratio}`);
else ok('上限以下（標準報酬月額30万円）はちょうど2.00倍');
if (!(C65.nini < C65.self)) fail('標準報酬月額65万円で任意継続が在職中より安くならない');
else ok(`標準報酬月額65万円で逆転（在職 ${C65.self}円 > 任継 ${C65.nini}円）`);

// ───────── 抽出 ─────────
const title = (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
const cardDesc = (html.match(/<meta name="card-desc" content="([^"]*)"/) || [, ''])[1];
// JSON-LD（FAQPage）は本文から生成されるので、二重に数えないよう本文だけを対象にする
const body = html.slice(html.indexOf('<article>'));
const plain = body.replace(/<[^>]+>/g, ' ');
const text = [title, desc, cardDesc, plain].join(' ');
if (!/32,256/.test(text)) fail('抽出に失敗（本文が読めていない）');

// ───────── 網（表記の系統ごとに別々に張る） ─────────
const yen = new Set((text.match(/\d{1,3}(?:,\d{3})+/g) || []).map(s => Number(s.replace(/,/g, ''))));
const man = new Set((text.match(/(\d+(?:\.\d+)?)万円/g) || []).map(s => parseFloat(s)));
const pct = new Set((text.match(/(\d+(?:\.\d+)?)[%％]/g) || []).map(s => parseFloat(s)));
const bai = new Set((text.match(/(\d+(?:\.\d+)?)倍/g) || []).map(s => parseFloat(s)));
// 日数は日付を先に除去する（「2028年3月31日」の"31日"を日数と誤認して正しい記事を落とすため）
// ★年の付かない「前年9月30日時点」も日付。年で始まる形だけを剥がすと "30日" が日数として残る
const noDate = text
  .replace(/\d{4}年\d+月\d+日/g, ' ')
  .replace(/令和\d+年\d+月\d+日/g, ' ')
  .replace(/\d+月\d+日/g, ' ')      // 「前年9月30日」「9月30日時点」
  .replace(/\d{4}年\d+月/g, ' ')
  .replace(/令和\d+年度?/g, ' ');
const days = new Set((noDate.match(/(\d+)日/g) || []).map(s => parseInt(s, 10)));

// ★網の外: 子育て支援金の全額「736.0円」は3桁でカンマを含まないので、この網には構造上入らない。
//   （網の形を決めた時点で網の外が生まれる。第24・25便と同型）
//   → 736 は下の「注記の名指し」で見る。ここに入れると「期待したが記事に無い」で永久に赤になる。
const EXPECT_YEN = new Set([
  CAP,                                   // 320,000（上限。表・注記・式に出る）
  HEIKIN,                                // 318,100（平均標準報酬月額）
  OR_KENKO, OR_KENKO_KAIGO,              // 31,520 / 36,704（公式額表の全額）
  NINI_UNDER40, NINI_40TO64,             // 32,256 / 37,440
  GYAKUTEN,                              // 640,000（逆転点）
  C30.std, C30.self, C30.nini,           // 300,000 / 15,120 / 30,240
  C44.std, C44.self,                     // 440,000 / 22,176
  C65.std, C65.self,                     // 650,000 / 32,759
]);
const EXPECT_MAN = new Set([
  32,   // 上限32万円
  64,   // 逆転点
  30,   // 令和3年度の上限は30万円だった
  62, 65, // 等級表に64万円は無い（62万円の次が65万円）
]);
const EXPECT_PCT = new Set([
  KENKO, KAIGO, KOSODATE,                    // 9.85 / 1.62 / 0.23（東京都・令和8年度）
  Math.round((KENKO + KAIGO) * 100) / 100,   // 11.47（出典に書いた額表の列。浮動小数のまま足すと 11.469999… になる）
  30,                                        // 国保の軽減：給与所得を30％とみなす
  4,                                         // 前納の割引：年4％（複利現価法）
]);
const EXPECT_BAI = new Set([
  2,                                     // 「2倍になるとは限らない」「ちょうど2倍」「2倍未満」
  parseFloat(r2(C30.ratio)),             // 2.00
  parseFloat(r2(C44.ratio)),             // 1.45
  parseFloat(r2(C65.ratio)),             // 0.98
]);
const EXPECT_DAYS = new Set([
  20,   // 申出は20日以内（37条1項）／20日目が土日祝
  10,   // 納付期限はその月の10日（164条）
  1,    // 1日でも遅れると／翌月1日
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
cmp('倍率', bai, EXPECT_BAI);
cmp('日数', days, EXPECT_DAYS);

// ───────── 要素の名指し（集合の網に入らない主張を、載っている要素で見る） ─────────
// 網に入らないのは「条文の引用」「条文番号」「制度の向き（誰が有利か）」。
// 本文全体への一致で見ると、同じ文がFAQにもあるため素通しする（第19便・第2便で2回踏んだ）。
const quotes = [...body.matchAll(/<blockquote>[\s\S]*?<\/blockquote>/g)].map(m => m[0]);
const callouts = [...body.matchAll(/<div class="callout">[\s\S]*?<\/div>/g)].map(m => m[0]);
const rows = [...body.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(m => m[0]);
if (quotes.length !== 4) fail(`blockquote が4件でない（${quotes.length}件）。引用の検査が対象を見失っている`);
if (callouts.length < 5) fail(`callout が5件未満（${callouts.length}件）`);
if (rows.length < 12) fail(`表の行が12件未満（${rows.length}件）`);

const named = (label, el, must) => {
  if (!el) { fail(`${label}: 要素を特定できない（名指しが一意でない）`); return; }
  const miss = must.filter(s => !el.includes(s));
  if (miss.length) fail(`${label}: 「${miss.join('」「')}」が無い`);
  else ok(`${label}`);
};

// 引用①: 161条＝任意継続は全額負担（記事の出発点）
named('引用 健保法161条（全額を負担する）',
  quotes.find(q => q.includes('第百六十一条')),
  ['ただし、任意継続被保険者は、その全額を負担する', '二分の一を負担']);

// 引用②: 38条7号＝2022年に脱退できるようになった（「2年縛り」を否定する背骨）
named('引用 健保法38条7号（脱退の申出）',
  quotes.find(q => q.includes('第三十八条')),
  ['七', '任意継続被保険者でなくなることを希望する旨', 'その申出が受理された日の属する月の末日が到来したとき',
   '二年を経過したとき']);

// 引用③: 164条＝納付期限はその月の10日（在職中の「翌月末日」との差）
named('引用 健保法164条（その月の十日）',
  quotes.find(q => q.includes('第百六十四条')),
  ['翌月末日までに', 'ただし、任意継続被保険者に関する保険料については、その月の十日']);

// 引用④: 国保法施行令＝給与所得を100分の30とみなす（記事の最大の踏み込み）
named('引用 国保法施行令29条の7の2（百分の三十）',
  quotes.find(q => q.includes('百分の三十')),
  ['給与所得', '百分の三十に相当する金額による']);

// callout①: 20日のただし書（「絶対の期限ではない」という向き）
named('callout 37条1項ただし書（正当な理由）',
  callouts.find(c => c.includes('20日を過ぎたら絶対にダメ')),
  ['正当な理由があると認めるとき', 'この期間を経過した後の申出であっても、受理することができる',
   '「うっかり忘れていた」は正当な理由になりません']);

// callout②: 初回未納は遡って「なかったこと」になる（2回目以降との非対称）
named('callout 37条2項（初回未納は遡って無効）',
  callouts.find(c => c.includes('初回の未納だけは')),
  ['最初から任意継続被保険者ではなかった', '37条2項', '医療費を全額返納']);

// callout③: 会社都合退職なら国保が軽減される（記事の結論の向き）
named('callout 会社都合退職は国保を先に試算',
  callouts.find(c => c.includes('自己都合退職の話')),
  ['会社都合退職の人にはそのまま当てはまりません', '30％とみなされる',
   '任意継続を申し込む前に、必ず市区町村で国保の保険料を試算']);

// callout④: 上限は毎年度改定される（「30万円」と書く古い記事への反証）
named('callout 上限は毎年度改定される',
  callouts.find(c => c.includes('「上限は30万円」と書いてある記事は古い')),
  ['毎年度改定されます', '令和3年度は30万円', '令和8年度は32万円']);

// callout⑤: 1年目は任継・2年目は国保（38条7号が効く実務上の意味）
named('callout 1年目は任意継続・2年目は国保',
  callouts.find(c => c.includes('1年目は任意継続、2年目は国保')),
  ['退職時のもので固定', '国保は毎年度、前年の所得で計算し直します', 'わざと保険料を払わずに']);

// 表の行: 未納の結果は「初回かどうか」で非対称（主語セルで一意に特定する）
named('表の行 2回目以降の未納（38条3号・翌日に資格喪失）',
  rows.find(r => r.includes('<b>2回目以降の保険料</b>')),
  ['翌日に資格を喪失', '38条3号']);
named('表の行 初回の未納（37条2項・とならなかったものとみなす）',
  rows.find(r => r.includes('<b>初回の保険料</b>')),
  ['任意継続被保険者とならなかったものとみなす', '37条2項']);

// 表の行: 国保軽減の対象者（特定受給資格者と特定理由離職者で根拠条文が違う）
named('表の行 特定受給資格者（雇保法23条2項）',
  rows.find(r => r.includes('<b>特定受給資格者</b>')),
  ['解雇', '雇用保険法23条2項']);
named('表の行 特定理由離職者（雇保法13条3項）',
  rows.find(r => r.includes('<b>特定理由離職者</b>')),
  ['期間満了', '雇用保険法13条3項']);

// 表の行: 保険料の額（年齢で介護保険料の有無が変わる）
named('表の行 40歳未満・65歳以上の保険料',
  rows.find(r => r.includes('<b>40歳未満・65歳以上</b>')),
  [NINI_UNDER40.toLocaleString('en-US')]);
named('表の行 40歳以上65歳未満の保険料',
  rows.find(r => r.includes('<b>40歳以上65歳未満</b>')),
  [NINI_40TO64.toLocaleString('en-US')]);

// 表の行: 倍率（記事の核心。各行が正しい倍率を名乗っているか）
for (const c of CASES) {
  named(`表の行 標準報酬月額${c.std.toLocaleString('en-US')}円の倍率 ${r2(c.ratio)}倍`,
    rows.find(r => r.includes(`<td>${c.std.toLocaleString('en-US')}円`)),
    [`${r2(c.ratio)}倍`, c.self.toLocaleString('en-US')]);
}

// 加入要件の行（2か月以上・20日以内）
named('表の行 被保険者期間（前日まで継続して2か月以上）',
  rows.find(r => r.includes('<b>被保険者期間</b>')),
  ['前日まで継続して2か月以上', '健保法3条4項']);
named('表の行 申出の期限（20日以内）',
  rows.find(r => r.includes('<b>申出の期限</b>')),
  ['20日以内', '健保法37条1項']);

// ★本文の名指し: 納付期限「その月の10日」。
//   これは日数の網に入るが、**同じ "10日" が FAQ と出典にも出る**ので、本文だけを 20日 に壊しても
//   網は 10 を見つけてしまい素通しする（＝存在確認の再発。壊しテストで実際に発覚した）。
//   → 主張が載っている段落を名指しして見る。
{
  const paras = [...body.matchAll(/<p>[\s\S]*?<\/p>/g)].map(m => m[0]);
  named('本文 納付期限はその月の10日（在職中の「翌月末日」との対比）',
    paras.find(p => p.includes('実質的に<b>前払い</b>に変わります')),
    ['<b>その月の10日</b>', '「翌月末日」払い']);
}

// 注記の名指し: 公式額表の全額から任意継続の保険料を組み立てている過程（網の外の736を含む）
{
  const notes = [...body.matchAll(/<p class="note">[\s\S]*?<\/p>/g)].map(m => m[0]);
  if (notes.length < 2) fail(`note が2件未満（${notes.length}件）`);
  const yen = n => n.toLocaleString('en-US');
  named('注記 公式額表の全額から保険料を組み立てる（736を含む）',
    notes.find(n => n.includes('第23級＝320,000円')),
    [`${yen(OR_KENKO)}.0円`, `${yen(OR_KENKO_KAIGO)}.0円`, `${OR_KOSODATE}.0円`,
     `${yen(OR_KENKO)}＋${OR_KOSODATE}＝${yen(NINI_UNDER40)}円`,
     `${yen(OR_KENKO_KAIGO)}＋${OR_KOSODATE}＝${yen(NINI_40TO64)}円`]);
}

// 逆転点が「料率によらない」という主張（この記事だけの一段。式が本文にあるか）
{
  const eq = body.match(/<p style="text-align:center">[\s\S]*?<\/p>/);
  named('逆転点の式（料率が約分されて消える）', eq && eq[0],
    ['320,000円 × 料率', '640,000円']);
  if (!/両辺の料率が約分されて消えるので/.test(plain)) fail('「料率によらない」の説明が本文に無い');
  else ok('逆転点は料率・年齢・都道府県によらないと明記');
}

console.log(ng ? `\n✗ 任意継続 記事 ${ng}件の不一致` : '\n✓ 任意継続 記事: すべて一致');
process.exit(ng ? 1 : 0);
