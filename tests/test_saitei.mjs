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
import { execFileSync } from 'node:child_process';
import { judgeSaitei, monthlyHours, effectiveWage, rankOf, spread } from '../docs/assets/saitei_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/saitei_chingin_r08.json', import.meta.url), 'utf8'));
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
  // 秋田の令和8年度の発効予定日は 2026-10-14（答申状況PDF）。その前日は改定前の額で判定される。
  // ★日付を直書きしない。出典の値をデータから読み、境界の前後で向きが変わることを見る。
  const akita = D.prefectures.find((p) => p.pref === '秋田');
  eq(akita.effective, '2026-10-14', '秋田の発効予定日（出典どおり）');
  const dayBefore = new Date(Date.parse(akita.effective) - 86400000).toISOString().slice(0, 10);
  const before = effectiveWage(akita, dayBefore);
  eq(before.wage, akita.prev, '発効日前は改定前の額');
  const on = effectiveWage(akita, akita.effective);
  eq(on.wage, akita.wage, '発効日当日は改定後の額');
  // 発効前の額で「クリア」になる賃金が、発効後は「割れ」になること（境界の向きの確認）
  const mid = Math.floor((akita.prev + akita.wage) / 2);
  ok(judgeSaitei({ prefCode: '秋田', wageType: 'hourly', amount: mid, onDate: dayBefore }, D).clears,
     '発効前はクリア');
  ok(!judgeSaitei({ prefCode: '秋田', wageType: 'hourly', amount: mid, onDate: akita.effective }, D).clears,
     '発効後は割れ');

  // ★令和8年度は発効日が県ごとに分かれている（10-01〜12-02）。
  //   「全県10月1日に切り替わる」と思い込むと、まだ有効でない額で判定する事故になる。
  const effs = D.prefectures.map((p) => p.effective).sort();
  eq(effs[0], '2026-10-01', '最も早い発効日');
  eq(effs[effs.length - 1], '2026-12-02', '最も遅い発効日');
  eq(D.prefectures.filter((p) => p.effective === '2026-10-01').length,
     D.next_revision.effective_on_oct1_count, '10-01発効の件数が next_revision の申告と一致');
  ok(D.next_revision.effective_on_oct1_count < 47, '10-01発効は47件より少ない（全県同日ではない）');
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

// ---- 年度名の直書きが無いか（2026-09-22 に実害） ----
// judgeSaitei の注記に「令和7年度額」と固定で書いてあったため、データを令和8年度へ
// 差し替えた瞬間に、数字は正しいのに年度名だけ1年古い文が出た。
// 構文エラーにならず判定も正しいので、画面を読まないと気づけない型のバグ。
{
  const core = readFileSync(new URL('../docs/assets/saitei_core.js', import.meta.url), 'utf8');
  const hard = core.match(/令和\d+年[度分]?/g) || [];
  // コメント内の説明は許す。テンプレート文字列の中に埋まっていたら落とす。
  const inTemplate = (core.match(/`[^`]*令和\d+年[^`]*`/g) || []);
  eq(inTemplate.length, 0,
     `画面に出る文に年度名を直書きしないこと（見つかった: ${JSON.stringify(inTemplate).slice(0, 160)}）`);
  // 注記が実際にデータの年度を使っているか（発効前の県で確かめる）
  const future = D.prefectures.find((p) => p.effective > '2026-09-22');
  ok(future, '発効日が未来の県がある（この検査の前提）');
  const r = judgeSaitei({ prefCode: future.pref, wageType: 'hourly',
                          amount: future.prev + 1, onDate: '2026-09-22' }, D);
  ok(r.notes.some((n) => n.includes(D._meta.year)),
     `注記がデータの年度（${D._meta.year}）を使っている`);
  ok(!r.notes.some((n) => n.includes('令和7年度')),
     '注記に古い年度名が残っていない');
  ok(hard.length >= 0, '年度名の出現を数えた');
}

// ---- 令和8年度（47都道府県の答申が出そろい、発効は順次） ----
// ★2026-09-22 に状態が進んだ。旧: status='announced'（中央の目安だけ出ていて県表は令和7年度）
//   新: status='answered'（各県の改定額が答申され、県表も令和8年度。発効は10-01〜12-02）
//   語彙を増やしたのは、この2つが**判定に効く別の状態**だから。
//   'announced' は「金額が未確定＝表に載せられない」、'answered' は「金額は確定・発効前」。
//   画面側の分岐は status==='pending' だけを見ているので、どちらも金額を出す側に入る。
{
  eq(D.next_revision.status, 'answered', '47都道府県の改定額が答申済み');
  eq(D._meta.year, '令和8年度', '都道府県表も令和8年度に進んでいる');
  eq(D.next_revision.guideline.A, 54, 'Ａランク目安');
  eq(D.next_revision.guideline.B, 56, 'Ｂランク目安');
  eq(D.next_revision.guideline.C, 56, 'Ｃランク目安');
  eq(D.next_revision.guideline.national_average_if_followed, 1176, '目安どおりの加重平均');
  // 実際の答申は目安を1円上回った。目安と実績を混ぜない。
  eq(D._meta.national_average.wage, 1177, '実際の全国加重平均（答申ベース）');
  ok(D._meta.national_average.wage > D.next_revision.guideline.national_average_if_followed,
     '答申の加重平均は目安どおりの額を上回っている');
  ok(!('wage' in D.next_revision), '目安を現行の時間額として持たない');
  ok(D.next_revision.source_url.startsWith('https://www.mhlw.go.jp/'), '出典が厚労省');
  // ★答申であって決定ではない。発効前の額で判定していないことを、県単位でもう一度見る
  const tokyo = D.prefectures.find((p) => p.pref === '東京');
  eq(effectiveWage(tokyo, '2026-09-30').wage, tokyo.prev, '9/30時点の東京は改定前の額');
  eq(effectiveWage(tokyo, '2026-10-01').wage, tokyo.wage, '10/1時点の東京は改定後の額');
}

// ---- 一覧表の静的HTMLがデータと一致している（生成器を流し忘れて古い表を配信しない） ----
// 47都道府県の一覧は「事実の表＝コンテンツ」なので、JSでなく静的HTMLに焼いている。
// 焼き忘れると、画面には古い金額が出たままになり、しかもテストが緑という最悪の形になる。
{
  try {
    execFileSync(process.execPath, [new URL('../tools/gen_saitei_table.mjs', import.meta.url).pathname, '--check'],
                 { encoding: 'utf8' });
    n++;
  } catch (e) {
    n++;
    assert.fail('一覧の静的HTMLがデータと不一致。node tools/gen_saitei_table.mjs を実行してコミットすること\n' + (e.stdout || '') + (e.stderr || ''));
  }
}

console.log(`✓ 最低賃金コア OK (${n} checks)`);
