/**
 * 最低賃金判定コアの検査。
 *
 * 規則1（落ちるべきものが落ちる／通るべきものが通る）に従い、
 * 「違反を違反と言う」と「クリアをクリアと言う」の両方を見る。
 * このツールの誤答は「実際は最低賃金割れなのにクリアと出す」が最も害が大きいので、
 * 境界とデータ整合を重点的に見る。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { judgeSaitei, monthlyHours, effectiveWage, rankOf, spread } from '../docs/assets/saitei_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/saitei_chingin_r07.json', import.meta.url), 'utf8'));
let n = 0;
const ok = (cond, msg) => { n++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { n++; assert.strictEqual(a, b, msg); };

// ---- データ自体の整合（出典PDFの読み取り事故をここで落とす） ----
eq(D.prefectures.length, 47, '都道府県は47件');
{
  const names = new Set(D.prefectures.map((p) => p.pref));
  eq(names.size, 47, '都道府県名に重複がない');
  for (const p of D.prefectures) {
    ok(p.wage > 0 && p.prev > 0, `${p.pref}: 金額が正`);
    // ★出典の3つの数字が互いに整合しているか（引上げ額・引上げ率は独立に検算できる）
    eq(p.wage - p.prev, p.up, `${p.pref}: 引上げ額 = 時間額 − 改定前額`);
    const rate = Math.round((p.up / p.prev) * 1000) / 10;
    ok(Math.abs(rate - p.rate) <= 0.15, `${p.pref}: 引上げ率 ${rate} ≒ 記載 ${p.rate}`);
    ok(/^\d{4}-\d{2}-\d{2}$/.test(p.effective), `${p.pref}: 発効日の形式`);
    ok(p.full && p.region, `${p.pref}: full/region がある`);
  }
  // 全国加重平均は各県の単純平均とは違う（加重平均なので）。ただし最低〜最高の間には必ず入る。
  const avg = D._meta.national_average.wage;
  const s = spread(D);
  ok(avg > s.lo.wage && avg < s.hi.wage, '全国加重平均は最低と最高の間にある');
}

// ---- 急所1: 月給は時間額に換算してから比べる ----
{
  // 年間所定労働日数 240日 × 8時間 ÷ 12 = 160時間/月
  eq(monthlyHours(240, 8), 160, '1か月平均所定労働時間 = 年間日数×1日時間÷12');
  // 東京 1226円 × 160時間 = 196,160円。これを下回れば違反。
  const under = judgeSaitei({ prefCode: '東京', wageType: 'monthly', amount: 196000,
                              daysPerYear: 240, hoursPerDay: 8, onDate: '2026-07-29' }, D);
  ok(under.ok && !under.clears, '月給196,000円（東京・160h）は最低賃金割れ');
  const over = judgeSaitei({ prefCode: '東京', wageType: 'monthly', amount: 196160,
                             daysPerYear: 240, hoursPerDay: 8, onDate: '2026-07-29' }, D);
  ok(over.ok && over.clears, '月給196,160円はちょうどクリア');
  // ★「月の暦日数×8時間」で割る誤り（=248時間など）をすると、同じ月給が「クリア」に化ける。
  //   換算の分母が正しいことを、時間額そのもので確かめる。
  ok(Math.abs(under.hourly - 196000 / 160) < 1e-9, '時間額は月給÷1か月平均所定労働時間');
}

// ---- 急所4: 端数を切り捨てて「ちょうど」に化けさせない ----
{
  // 東京1226円 × 160h = 196,160。1円だけ足りない月給。
  const r = judgeSaitei({ prefCode: '東京', wageType: 'monthly', amount: 196159,
                          daysPerYear: 240, hoursPerDay: 8, onDate: '2026-07-29' }, D);
  ok(r.ok && !r.clears, '1円不足でも「割れ」と判定する（切り捨てて同額に化けない）');
  ok(r.shortPerHour > 0, '不足額が正');
}

// ---- 急所3: 発効日をまたぐ判定 ----
{
  // 秋田の令和7年度額の発効日は 2026-03-31。その前日は改定前の額で判定される。
  const akita = D.prefectures.find((p) => p.pref === '秋田');
  eq(akita.effective, '2026-03-31', '秋田の発効日（出典どおり）');
  const before = effectiveWage(akita, '2026-03-30');
  eq(before.wage, akita.prev, '発効日前は改定前の額');
  const on = effectiveWage(akita, '2026-03-31');
  eq(on.wage, akita.wage, '発効日当日は改定後の額');
  // 発効前の額で「クリア」になる賃金が、発効後は「割れ」になること（境界の向きの確認）
  const mid = Math.floor((akita.prev + akita.wage) / 2);
  ok(judgeSaitei({ prefCode: '秋田', wageType: 'hourly', amount: mid, onDate: '2026-03-30' }, D).clears,
     '発効前はクリア');
  ok(!judgeSaitei({ prefCode: '秋田', wageType: 'hourly', amount: mid, onDate: '2026-03-31' }, D).clears,
     '発効後は割れ');
}

// ---- 時給制の基本 ----
{
  const r = judgeSaitei({ prefCode: '沖縄', wageType: 'hourly', amount: 1000, onDate: '2026-07-29' }, D);
  ok(r.ok && !r.clears, '沖縄1,023円に対し時給1,000円は割れ');
  eq(r.shortPerHour, 23, '不足は23円');
  const j = judgeSaitei({ prefCode: '沖縄', wageType: 'hourly', amount: 1023, onDate: '2026-07-29' }, D);
  ok(j.clears, 'ちょうど最低賃金ならクリア（「以上」であって「超」ではない）');
}

// ---- 入力不備は黙って0を返さない ----
{
  ok(!judgeSaitei({ prefCode: '存在しない県', wageType: 'hourly', amount: 1000 }, D).ok, '未知の県はエラー');
  ok(!judgeSaitei({ prefCode: '東京', wageType: 'hourly', amount: 0 }, D).ok, '金額0はエラー');
  ok(!judgeSaitei({ prefCode: '東京', wageType: 'monthly', amount: 200000 }, D).ok,
     '月給制で所定労働時間が無ければエラー（勝手に仮定しない）');
  eq(monthlyHours(400, 8), null, '年間所定労働日数が366超は入力誤りとして弾く');
}

// ---- 順位 ----
{
  const tokyo = rankOf('東京', D);
  eq(tokyo.rank, 1, '東京が全国1位');
  eq(tokyo.total, 47, '母数47');
  const s = spread(D);
  eq(s.gap, s.hi.wage - s.lo.wage, '最高と最低の差');
  ok(s.gap > 0, '差は正');
}

// ---- 令和8年度は fail-closed（推測を出さない） ----
{
  eq(D.next_revision.status, 'pending', '令和8年度は未答申として持っている');
  ok(!('wage' in D.next_revision) && !('up' in D.next_revision),
     '未答申なのに金額を持っていない（推測値を持たせない）');
  ok(D.next_revision.source_url.startsWith('https://www.mhlw.go.jp/'), '出典が厚労省');
}

console.log(`✓ 最低賃金コア OK (${n} checks)`);
