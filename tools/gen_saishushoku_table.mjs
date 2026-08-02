/**
 * `/column/saishushoku-teate/` に「月給別の早見表」を、**2つの計算コアを繋いで生成**する。
 *
 * ★なぜ足すのか（2026-08-02 のBing実測）:
 *   「再就職手当」61表示・8位。記事は35KB・表5個と充実しているが、金額の表（表2）は
 *   **特定の1人（所定給付日数120日・基本手当日額1パターン）の例**で、
 *   「再就職手当 いくらもらえる」で来た人が最初に知りたい「**自分の月給ならいくら**」に
 *   直接は答えていない。育児休業給付金で同じ形の穴を埋めたのと同じ構図。
 *
 * ★2つのコアを繋ぐ:
 *   月給 →(kihonteate_core)→ 賃金日額 → 基本手当日額 →(saishushoku_core)→ 再就職手当用の上限適用
 *   どちらも条文照合済み・単体テストあり。記事に数字を手書きしない。
 *
 * ★総額ではなく「残1日あたり」を出す理由:
 *   再就職手当 = 日額 × **支給残日数** × 率。支給残日数は人によって全く違う。
 *   代表的な残日数を決め打ちして総額を出すと、読者ごとに外れる数字を「早見表」として
 *   公開することになる（育休の表で「1年合計」を載せなかったのと同じ判断）。
 *   ⇒ 誰にとっても正しい「残1日あたりの単価」を出し、総額は本文の設例と計算機に任せる。
 *
 * usage:
 *   node tools/gen_saishushoku_table.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { wageDaily, benefitDaily } from '../docs/assets/kihonteate_core.js';
import { saishushokuCap } from '../docs/assets/saishushoku_core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARTICLE = join(root, 'docs/column/saishushoku-teate/index.html');
export const DATA = join(root, 'docs/assets/kihonteate_r07.json');

const START = '<!-- SAISHUSHOKU_TABLE:START 自動生成。手で編集しない。tools/gen_saishushoku_table.mjs -->';
const END = '<!-- SAISHUSHOKU_TABLE:END -->';

/** 表に載せる月給（額面・賞与を除く月額）。2.5万円刻み */
export const WAGES = [150000, 175000, 200000, 225000, 250000, 275000, 300000,
  325000, 350000, 375000, 400000, 425000, 450000, 500000];

/** 年齢は「30歳以上45歳未満」で代表させる（賃金日額の上限が年齢帯で変わるため固定する） */
export const AGE = 35;

const fmt = (n) => n.toLocaleString('ja-JP');

/**
 * 支給率を掛けた額。★**必ず整数演算で出す**（率は分数で持つ）。
 * `Math.floor(x * 0.7)` は浮動小数の丸めで1円落ちることがある:
 * 1,000〜7,000円の日額 6,001通りのうち **127通り**で `floor(x*0.7)` と `floor(x*7/10)` が食い違う
 * （例: 1,290円 → 902 vs 903）。今の上限額ではたまたま当たらないが、
 * 上限は毎年8月1日に改定されるので、いずれ必ず踏む。
 * このリポジトリは同型の桁落ちを過去にも踏んでいる（tests/test_saishushoku_article.mjs の注記）。
 */
export const applyRate = (daily, tenths) => Math.floor(daily * tenths / 10);

export function rowFor(wage, D) {
  const w = wageDaily(wage * 6);
  const bd = benefitDaily(w, AGE, D);
  const cap = saishushokuCap(AGE, D);
  const used = Math.min(bd, cap);
  return {
    wage,
    benefitDaily: bd,
    cap,
    used,
    capped: bd > cap,
    per70: applyRate(used, 7),
    per60: applyRate(used, 6),
  };
}

/**
 * 上限に張り付き始める月給を**二分探索でコアから求める**。
 * ★表の行から「最初に※上限が付いた行」を読むと、刻み幅ぶん実際より高い額を言ってしまう
 *   （2.5万円刻みなら最大2.5万円ずれる）。読者はこの1行で自分が該当するか判断するので、
 *   刻みの都合で出た数字を「境目」として書かない。
 */
export function capThreshold(D, lo = 100000, hi = 1000000) {
  if (!rowFor(hi, D).capped) return null;          // 上限に当たらないなら境目は無い
  if (rowFor(lo, D).capped) return lo;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (rowFor(mid, D).capped) hi = mid; else lo = mid;
  }
  return hi;                                        // 上限に当たる最小の月給
}

export function buildTable(D) {
  const rows = WAGES.map((w) => rowFor(w, D));
  const cap = rows[0].cap;
  const firstCapped = rows.find((r) => r.capped);
  const threshold = capThreshold(D);

  const out = [START];
  out.push('  <h3 id="hayamihyo">月給別の早見表（30歳以上45歳未満の場合）</h3>');
  out.push(`  <p>再就職手当は <b>計算に使う日額 × 支給残日数 × 支給率（70%または60%）</b> で決まります。支給残日数は人によって全く違うので、ここでは<b>「残り1日あたりいくら生まれるか」</b>を出しました。自分の支給残日数を掛ければ総額になります。<b>この表は<a href="../../saishushoku/">再就職手当 計算機</a>と同じ計算で作っています</b>（別々に持っていないので食い違いません）。</p>`);
  out.push('  <table>');
  out.push('    <tr><th>月給（額面）</th><th>計算に使う日額<br>（上限適用後）</th><th>70%のとき<br>残1日あたり</th><th>60%のとき<br>残1日あたり</th></tr>');
  for (const r of rows) {
    const mark = r.capped ? ' <b>※上限</b>' : '';
    out.push(`    <tr><td>${fmt(r.wage)}円${mark}</td><td>${fmt(r.used)}円</td><td>${fmt(r.per70)}円</td><td>${fmt(r.per60)}円</td></tr>`);
  }
  out.push('  </table>');
  if (firstCapped && threshold) {
    out.push(`  <p>※ 再就職手当の計算に使う日額には<b>${fmt(cap)}円の上限</b>があります（失業保険そのものの上限とは別の、より低い上限です）。この上限に達するのは<b>月給が約${fmt(threshold)}円のとき</b>で、<b>これを超えるといくら給料が高くても再就職手当は増えません</b>（表の「※上限」の行）。上限額は<b>毎年8月1日に改定</b>されます。</p>`);
  }
  out.push('  <p>70%と60%の分かれ目は<b>支給残日数が所定給付日数の3分の2以上あるか</b>です（<a href="#gake">3分の2の崖</a>）。3分の1を下回ると1円も出ません。60歳以上は日額の上限が下がるので、<a href="../../saishushoku/">計算機</a>で年齢を入れて確認してください。</p>');
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
      const at = html.indexOf('<h2 id="joken">');
      if (at < 0) throw new Error('挿入位置（<h2 id="joken">）が見つかりません');
      next = html.slice(0, at) + table + '\n\n' + html.slice(at);
    }
    writeFileSync(ARTICLE, next);
    console.log(`月給別の早見表を書き込みました（${WAGES.length}行）`);
  }
}
