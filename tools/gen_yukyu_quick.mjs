/**
 * `/column/part-yukyu/` の冒頭に「まず早見表（6か月後に何日か）」を、**計算コアから生成**する。
 *
 * ★なぜ足すのか（2026-08-02 のBing実測 + codexレビュー）:
 *   「パート 有給休暇」127表示 9位 / 「アルバイト 有給」72表示 8位。どちらもこの1ページで受けている。
 *   記事は48KB・表5個とすでに網羅的だが、**読者が最初に欲しい「あるのか・何日か」に
 *   到達するまでが長い**（結論 → 2つの条件 → 8割出勤の分母分子 → ようやく比例付与の表）。
 *   このサイトで勝っている記事（振込手数料28区分・5位）は「一覧性が冒頭にある」形なので、
 *   **文字量を増やさずに一覧性だけ前に出す**。
 *
 *   ★「0クリックだからタイトルが悪い」とは判断していない: 72表示・CTR1.2%なら期待クリックは
 *     0.86件で、0件になる確率は約42%。押し上げの根拠は**順位**であって0クリックではない。
 *
 * ★なぜ手書きしないのか:
 *   付与日数は労基法39条の法定表そのもの。記事に手書きすると、記事・計算機・コアで
 *   三重管理になる。`docs/assets/yukyu_core.js`（条文照合済み・単体テストあり）を呼んで作る。
 *
 * usage:
 *   node tools/gen_yukyu_quick.mjs          生成して書き戻す
 *   node tools/gen_yukyu_quick.mjs --dry    書き戻さず標準出力に出す
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { grantDays } from '../docs/assets/yukyu_core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARTICLE = join(root, 'docs/column/part-yukyu/index.html');

const START = '<!-- YUKYU_QUICK:START 自動生成。手で編集しない。tools/gen_yukyu_quick.mjs -->';
const END = '<!-- YUKYU_QUICK:END -->';

/** 冒頭に出す働き方。weeklyHours は「週30時間未満／以上」の分岐だけに効く */
export const PATTERNS = [
  { label: '週1日', weeklyDays: 1, weeklyHours: 8 },
  { label: '週2日', weeklyDays: 2, weeklyHours: 16 },
  { label: '週3日', weeklyDays: 3, weeklyHours: 21 },
  { label: '週4日（週30時間未満）', weeklyDays: 4, weeklyHours: 28 },
  { label: '週5日以上、または週30時間以上', weeklyDays: 5, weeklyHours: 40 },
];

/** 最初の付与は勤続6か月（＝0.5年）時点 */
export const FIRST_GRANT_YEARS = 0.5;

export function rowFor(p) {
  const g = grantDays(FIRST_GRANT_YEARS, p.weeklyDays, p.weeklyHours);
  if (g.type === 'not_yet') throw new Error(`${p.label} で付与前と判定されました（想定外）`);
  return { ...p, days: g.days, type: g.type };
}

export function buildQuick() {
  const rows = PATTERNS.map(rowFor);
  const out = [START];
  out.push('  <h2 id="hayamihyo">まず早見表：6か月後に何日もらえるか</h2>');
  out.push('  <p><b>パートでもアルバイトでも、条件も日数も同じです</b>（労基法39条は雇用形態で区別していません）。週に何日働くかで決まります。</p>');
  out.push('  <table>');
  out.push('    <tr><th scope="col">働き方</th><th scope="col">6か月後にもらえる日数</th></tr>');
  for (const r of rows) {
    out.push(`    <tr><td>${r.label}</td><td><b>${r.days}日</b></td></tr>`);
  }
  out.push('  </table>');
  out.push('  <p>いずれも「6か月続けて働いた」「その間の出勤率が8割以上」の2つを満たした場合です（<a href="#joken">2つの条件</a>）。勤続1年半・2年半…と増えていく分は<a href="#hyo">比例付与の早見表</a>に、自分の入社日で次の付与日と日数を出すなら<a href="../../yukyu/">有給休暇 計算機</a>が使えます。</p>');
  out.push(END);
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const quick = buildQuick();
  if (process.argv.includes('--dry')) {
    console.log(quick);
  } else {
    const html = readFileSync(ARTICLE, 'utf-8');
    let next;
    if (html.includes(START)) {
      const a = html.indexOf(START);
      const b = html.indexOf(END) + END.length;
      next = html.slice(0, a) + quick + html.slice(b);
    } else {
      // 結論の直後・「付与される2つの条件」の直前に入れる
      const at = html.indexOf('  <h2 id="joken">');
      if (at < 0) throw new Error('挿入位置（<h2 id="joken">）が見つかりません');
      next = html.slice(0, at) + quick + '\n\n' + html.slice(at);
    }
    writeFileSync(ARTICLE, next);
    console.log(`まず早見表を書き込みました（${PATTERNS.length}行）`);
  }
}
