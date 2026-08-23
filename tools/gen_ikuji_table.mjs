/**
 * `/column/ikuji-kyugyo-kyufukin/` の「月給別 早見表」を、**計算コアから生成**する。
 *
 * ★なぜ足すのか（2026-08-02 のBing実測）:
 *   「育児休業給付金」は 326表示・9位・クリック3（CTR 0.9%）で、単独では最大の取りこぼし。
 *   着地しているのはツール `/ikuji/` ではなく**この記事**（GA4のlandingPageで確認）。
 *   記事の既存の早見表は**月給1パターン（30万円）だけ**で、
 *   「育児休業給付金」で検索する人が最初に知りたい「**自分の月給ならいくら**」に答えていない。
 *   このサイトで勝っている記事（振込手数料28区分・パート有給の比例付与）は
 *   いずれも**表・一覧**の形なので、その形に寄せる。
 *
 * ★なぜ手書きしないのか:
 *   同じ金額を記事とツールの2箇所で持つと、法改定のたびに片方だけ直る。
 *   ここは `docs/assets/ikuji_core.js`（条文照合済み・単体テストあり）を**そのまま呼んで**作る。
 *   上限額・下限額・支給単位期間の区切りは全部コアの実装がやる。記事は数字を持たない。
 *
 * ★日付を固定する理由:
 *   支給単位期間は開始日からの応当日で区切られるので、開始日で合計額が数百円動く。
 *   「今日」を使うと実行日によって記事の数字が変わり、テストも落ちる（E2Eの既存規律と同じ）。
 *
 * usage:
 *   node tools/gen_ikuji_table.mjs          生成して書き戻す
 *   node tools/gen_ikuji_table.mjs --dry    書き戻さず標準出力に出す
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { calcIkuji, UNIT_DAYS } from '../docs/assets/ikuji_core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARTICLE = join(root, 'docs/column/ikuji-kyugyo-kyufukin/index.html');
const DATA = join(root, 'docs/assets/kihonteate_r07.json');

const START = '<!-- IKUJI_TABLE:START 自動生成。手で編集しない。tools/gen_ikuji_table.mjs -->';
const END = '<!-- IKUJI_TABLE:END -->';

/** 表に載せる月給（額面・税や社会保険料を引く前）。2.5万円刻み。 */
export const WAGES = [150000, 175000, 200000, 225000, 250000, 275000, 300000,
  325000, 350000, 375000, 400000, 425000, 450000, 475000, 500000, 550000];

/** 開始日を固定する（応当日で区切るため、開始日が変わると合計が動く） */
export const START_DATE = '2026-04-01';
/** 1年間（365日）休んだ場合で示す */
export const LEAVE_DAYS = 365;

const fmt = (n) => n.toLocaleString('ja-JP');

/** 月給1点ぶんの計算。★数字はすべて calcIkuji が出したものだけを使う */
export function rowFor(wage, D) {
  const r = calcIkuji({ total6m: wage * 6, startDate: START_DATE, leaveDays: LEAVE_DAYS, shien: null }, D);
  const u67 = r.units.find((u) => u.lowDays === 0);   // 67%だけの支給単位期間
  const u50 = r.units.find((u) => u.highDays === 0);  // 50%だけの支給単位期間
  if (!u67 || !u50) throw new Error(`月給${wage}円で67%/50%の支給単位期間が取れませんでした`);
  return { wage, m67: u67.amount, m50: u50.amount, total: r.ikujiTotal, capped: r.capped, floored: r.floored };
}

export function buildTable(D) {
  const rows = WAGES.map((w) => rowFor(w, D));
  // 上限に張り付き始める月給 = 賃金日額の上限 × 30日（賃金日額 = 6か月の総額 ÷ 180 = 月給 ÷ 30）
  const capDaily = rows.find((r) => r.capped)
    ? calcIkuji({ total6m: 10 ** 9, startDate: START_DATE, leaveDays: LEAVE_DAYS, shien: null }, D).daily
    : null;
  const capWage = capDaily ? capDaily * UNIT_DAYS : null;

  const out = [START];
  out.push('  <h3 id="hayamihyo">月給別の早見表（毎月いくら）</h3>');
  out.push(`  <p>額面の月給から、<b>67%の時期の1か月（30日）あたり</b>と<b>50%の時期の1か月あたり</b>を出したものです。${D?._meta?.label ?? ''}。<b>この表の数字は、このサイトの<a href="../../ikuji/">育児休業給付金 計算機</a>と同じ計算で作っています</b>（別々に持っていないので食い違いません）。出生後休業支援給付金の13%は条件つきなので含めていません（<a href="#haigusha">13%の条件</a>を参照）。</p>`);
  out.push('  <table>');
  out.push('    <tr><th scope="col">月給（額面）</th><th scope="col">67%の時期<br>1か月あたり</th><th scope="col">50%の時期<br>1か月あたり</th></tr>');
  for (const r of rows) {
    const mark = r.capped ? '<b>※上限</b>' : r.floored ? '<b>※下限</b>' : '';
    out.push(`    <tr><td>${fmt(r.wage)}円${mark ? ' ' + mark : ''}</td><td>${fmt(r.m67)}円</td><td>${fmt(r.m50)}円</td></tr>`);
  }
  out.push('  </table>');
  if (capWage) {
    out.push(`  <p>※ 賃金日額には上限があるため、<b>月給が約${fmt(Math.floor(capWage))}円を超えると、それ以上いくら稼いでいても給付額は同じ</b>になります（表の「※上限」の行）。</p>`);
  }
  // ★合計額（1年休んだ場合など）は載せない: 支給単位期間が開始日からの応当日で区切られるため、
  //   開始日によって数百円ずれる。読者ごとに違う数字を「合計」として published にするのは誤誘導。
  //   合計が要る人は計算機に開始日を入れてもらう。
  out.push(END);
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const D = JSON.parse(readFileSync(DATA, 'utf8'));
  const table = buildTable(D);
  if (process.argv.includes('--dry')) {
    console.log(table);
  } else {
    const html = readFileSync(ARTICLE, 'utf-8');
    let next;
    if (html.includes(START)) {
      const a = html.indexOf(START);
      const b = html.indexOf(END) + END.length;
      next = html.slice(0, a) + table + html.slice(b);
    } else {
      // 「いくらもらえるか（計算式と早見表）」の節の末尾（次のh2の直前）に入れる
      const h2 = html.indexOf('<h2 id="tedori">');
      if (h2 < 0) throw new Error('挿入位置（次のh2）が見つかりません');
      next = html.slice(0, h2) + table + '\n\n  ' + html.slice(h2);
    }
    writeFileSync(ARTICLE, next);
    console.log(`月給別の早見表を書き込みました（${WAGES.length}行）`);
  }
}
