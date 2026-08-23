/**
 * `/column/yukyu-kaitori/` に「月給別の買取単価 早見表（3方式）」を生成する。
 *
 * ★なぜ足すのか（2026-08-02 のBing実測）:
 *   「有給買取」53表示・7位。記事は38KB・表5個と充実していて、3方式の比較表も既にあるが、
 *   金額は**月給30万円の1パターンだけ**。「有給買取 いくら」で来た人が知りたい
 *   「自分の月給ならいくらか」に直接は答えていない（他の記事で埋めたのと同じ穴）。
 *
 * ★計算は労基法39条9項が限定する3方式そのもの:
 *   ① 平均賃金        直前3か月の賃金総額 ÷ その期間の総日数（暦日）（労基法12条）
 *   ② 通常の賃金      月給 ÷ 月の所定労働日数
 *   ③ 標準報酬日額    標準報酬月額 ÷ 30（5円未満は切捨、5円以上10円未満は10円に切上）
 *
 * ★前提を固定して明示する（ここが一番ごまかしやすいところ）:
 *   ①は「直前3か月の暦日数」、②は「月の所定労働日数」に依存する。どちらも人によって違う。
 *   記事の既存の設例と**同じ前提（総日数91日・所定20日）**に揃え、表の見出しと注記で明記する。
 *   ⇒ 前提を書かずに「買取価格の早見表」を出すと、正確そうに見えて誰にも当たらない表になる。
 *
 * ★検算: 月給30万円の行が、記事に前からある手書きの設例（9,890円10銭 / 10,000円 / 15,000円）と
 *   一致することを tests/test_kaitori_hayamihyo.mjs が確かめる。
 *
 * usage:
 *   node tools/gen_kaitori_table.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARTICLE = join(root, 'docs/column/yukyu-kaitori/index.html');

const START = '<!-- KAITORI_TABLE:START 自動生成。手で編集しない。tools/gen_kaitori_table.mjs -->';
const END = '<!-- KAITORI_TABLE:END -->';

/** 表に載せる月給（額面）。2.5万円刻み */
export const WAGES = [200000, 225000, 250000, 275000, 300000, 325000, 350000,
  375000, 400000, 450000, 500000];

/** 前提（記事の既存の設例と揃える）。★人によって違うので必ずページに書く */
export const TOTAL_DAYS = 91;      // 直前3か月の暦日数（4〜6月）
export const WORK_DAYS = 20;       // 月の所定労働日数

/** ① 平均賃金 = 3か月の賃金総額 ÷ 総日数（暦日）。銭まで出る（労基法12条） */
export function heikinChingin(wage, totalDays = TOTAL_DAYS) {
  return (wage * 3) / totalDays;
}

/** ② 通常の賃金 = 月給 ÷ 月の所定労働日数 */
export function tsujoChingin(wage, workDays = WORK_DAYS) {
  return wage / workDays;
}

/**
 * ③ 標準報酬日額 = 標準報酬月額 ÷ 30
 * 端数処理: 5円未満は切捨、5円以上10円未満は10円に切上（健康保険法99条の考え方）
 * ★標準報酬月額は等級で決まるので月給とは厳密には一致しない。ここは記事の設例と同じく
 *   「標準報酬月額＝月給」と置いた概算であることを注記で明示する。
 */
export function hyojunHogakuDaily(wage) {
  const raw = wage / 30;
  const tens = Math.floor(raw / 10) * 10;
  const rem = raw - tens;
  if (rem < 5) return tens;
  return tens + 10;
}

/** 銭まで出る額の表示。9890.109... → 「9,890円10銭」 */
export function fmtSen(v) {
  const yen = Math.floor(v);
  const sen = Math.floor((v - yen) * 100);
  const y = yen.toLocaleString('ja-JP');
  return sen ? `${y}円${sen}銭` : `${y}円`;
}
const fmt = (n) => `${Math.round(n).toLocaleString('ja-JP')}円`;

export function rowFor(wage) {
  return {
    wage,
    heikin: heikinChingin(wage),
    tsujo: tsujoChingin(wage),
    hyojun: hyojunHogakuDaily(wage),
  };
}

export function buildTable() {
  const rows = WAGES.map(rowFor);
  const out = [START];
  out.push('  <h3 id="hayamihyo">月給別の買取単価 早見表（3方式）</h3>');
  out.push(`  <p>同じ人・同じ有給でも、どの方式で計算するかで<b>1日あたりの単価は1.5倍以上変わります</b>。月給別に並べたものが下の表です。<b>前提は上の設例と同じ</b>で、①は<b>直前3か月の暦日数を${TOTAL_DAYS}日</b>（4〜6月）、②は<b>月の所定労働日数を${WORK_DAYS}日</b>としています。</p>`);
  out.push('  <table>');
  out.push(`    <tr><th scope="col">月給（額面）</th><th scope="col">① 平均賃金<br>（暦${TOTAL_DAYS}日）</th><th scope="col">③ 標準報酬日額<br>（÷30）</th><th scope="col">② 通常の賃金<br>（所定${WORK_DAYS}日）</th></tr>`);
  for (const r of rows) {
    out.push(`    <tr><td>${r.wage.toLocaleString('ja-JP')}円</td><td>${fmtSen(r.heikin)}</td><td>${fmt(r.hyojun)}</td><td>${fmt(r.tsujo)}</td></tr>`);
  }
  out.push('  </table>');
  out.push(`  <p>★<b>この表の前提が変われば金額も変わります。</b>①の平均賃金は退職月によって暦日数が89〜92日と動き（2月を含む3か月なら短くなるので単価は上がります）、②は月の所定労働日数で割るので、所定が${WORK_DAYS}日でない会社では変わります。③は「標準報酬月額＝月給」と置いた概算です（標準報酬月額は等級で決まるため、実際には月給と一致しないことがあります）。</p>`);
  out.push('  <p>どの方式を使うかは<b>就業規則等の定め</b>によります（③は労使協定が必要）。買取そのものが法定外の取扱いなので、会社に買取の義務はありません。まず<a href="../../yukyu/">有給休暇の付与日数 計算機</a>で「何日残っているか」を確定させてください。</p>');
  out.push(END);
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const table = buildTable();
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
      const at = html.indexOf('<h2 id="zeikin">');
      if (at < 0) throw new Error('挿入位置（<h2 id="zeikin">）が見つかりません');
      next = html.slice(0, at) + table + '\n\n' + html.slice(at);
    }
    writeFileSync(ARTICLE, next);
    console.log(`買取単価の早見表を書き込みました（${WAGES.length}行）`);
  }
}
