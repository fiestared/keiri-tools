/**
 * 電帳法の記事が書く「デジタルシームレス → 青色申告特別控除」の金額が、
 * 本番の参照データ(docs/assets/setsuzei_r08.json)と一致しているかを機械で見る。
 *
 * 落とすべきもの(2026-07-23に本番から取り除いた誤り):
 *   /column/denchoho-wakariyasuku/ が「デジタルシームレスに対応すると、あわせて
 *   **青色申告特別控除65万円**の適用も受けられます」「適用は令和9年分以後の所得税から」と書いていた。
 *   適用時期は正しいが、**金額が10万円過少**だった。
 *
 * なぜ生き残ったか = **改正が二段階だったから**。
 *   令和7年度改正でデジタルシームレスが新設された時点では最高額が65万円だったので、
 *   当時の資料は効果を「65万円」と説明している。記事はそれを写した。
 *   その後の令和8年度改正(令和8年3月31日法律第12号)で、令和9年分から55万円が廃止され
 *   e-Tax要件の65万円が標準になり、この枠は**75万円**へ移った。
 *   → 記事は「書いた時点では正しく、施行を待つあいだに黙って古くなった」型。
 *
 * 条文(2027-01-01施行版 = 令和9年分に適用される版)の逐語:
 *   措法25条の2第5項「…前項第一号中『六十五万円』とあるのは、『七十五万円』として、
 *     同項の規定を適用することができる」
 *     一号 = 電帳法8条4項の要件(優良な電子帳簿)
 *     二号 = 電帳法8条5項の「特定電磁的記録」(デジタルシームレス)
 *   → **75万円は第4項の65万円を読み替える形**なので、複式簿記(4項)と
 *     期限内e-Tax送信(7項)が前提。デジタルシームレス単独では75万円にならない。
 *
 * 版の差(同じ抽出器で数えた):
 *   現行(令和8年分適用)  特定電磁的記録 0回 / 七十五万円 0回 / 五十五万円 2回
 *   2027-01-01(令和9年分) 特定電磁的記録 3回 / 七十五万円 1回 / 五十五万円 0回
 *
 * 教訓(第6便と同型): 記事の数値の主張は、**本番の参照データと機械で突き合わせる**。
 *   この記事には専用テストが1つも無く、金額はどこからも守られていなかった。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const DATA = JSON.parse(readFileSync(join(root, 'docs/assets/setsuzei_r08.json'), 'utf8'));
const HTML = readFileSync(join(root, 'docs/column/denchoho-wakariyasuku/index.html'), 'utf8');

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✅ ${msg}`);
  else { console.error(`  ❌ ${msg}`); failed++; }
};

const man = (n) => `${n / 10000}万円`;          // 750000 -> "75万円"
const visible = (s) => s.replace(/<[^>]+>/g, ' ');

// --- 主張が載っている要素を名指しする(規則3/5: 本文全体で探さない) ---
// summary-box は内側に <div class="t"> を持つ。非貪欲マッチだと手前の </div> で
// 切れて中身を取り逃すので、<div> の開閉を数えて対応する終端まで取る。
function divBlocks(html, openTag) {
  const out = [];
  let i = 0;
  while ((i = html.indexOf(openTag, i)) !== -1) {
    let depth = 0, j = i;
    const re = /<(\/?)div\b/g;
    re.lastIndex = i;
    let m;
    while ((m = re.exec(html))) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) { j = m.index + m[0].length; break; }
    }
    const end = html.indexOf('>', j) + 1;
    out.push(html.slice(i, end));
    i = end;
  }
  return out;
}
// デジタルシームレスを説明している summary-box だけを切り出す。
const boxes = divBlocks(HTML, '<div class="summary-box">');
const seamless = boxes.filter((b) => b.includes('デジタルシームレス'));
ok(seamless.length === 1, `デジタルシームレスのsummary-boxが一意に取れる（${seamless.length}件）`);
const BOX = visible(seamless[0] || '');

// --- 参照データ側の正本 ---
const nr = DATA.aoiro.next_regime;
const top = nr.amounts.top;                      // 750000
ok(top === 750000, `参照データの令和9年分・最高額 = ${man(top)}`);
ok(nr.first_year === '令和9年分', `参照データの適用開始 = ${nr.first_year}`);

// --- ① 金額: 記事の主張がデータと一致するか ---
ok(BOX.includes(`青色申告特別控除が${man(top)}`),
   `記事が「青色申告特別控除が${man(top)}」と書いている（データ ${top} と一致）`);

// --- ② 逆向きガード: 取り除いた誤りが戻っていないか ---
// 「65万円」自体は正しい文脈で出てくる（標準額・読み替え元）ので、
// 禁じるのは**デジタルシームレスの効果として65万円を名乗る**言い方だけ(規則1)。
for (const bad of ['青色申告特別控除65万円', '青色申告特別控除が65万円']) {
  ok(!BOX.includes(bad), `誤りが戻っていない: 「${bad}」が無い`);
}

// --- ③ 適用年分（第1便の教訓: 施行日と適用年分は別物） ---
ok(BOX.includes('令和9年分以後の所得税から'), '青色申告特別控除の適用が「令和9年分以後」と書いてある');

// --- ④ 前提要件: デジタルシームレス単独では75万円にならないこと ---
ok(/デジタルシームレスだけでは75万円になりません/.test(BOX),
   '「デジタルシームレスだけでは75万円にならない」と明示している');
for (const req of ['複式簿記', 'e-Tax']) {
  ok(BOX.includes(req), `前提要件が書いてある: ${req}`);
}

// --- ⑤ 5項の2つの経路が両方とも名指しされているか ---
// ★語の存在だけを見ると素通しする(規則3/5)。「優良な電子帳簿」は同じボックスの
//   別の文にも出てくるので、**どの号の経路か**という対応まで下ろして見る。
for (const r of nr.top_routes) {
  ok(BOX.includes(`${r.go}＝${r.label}`),
     `措法25条の2第5項の経路が号と対応づけて書いてある: ${r.go}＝${r.label}`);
}

// --- ⑥ 判定はツールへ渡す（導線） ---
ok(seamless[0].includes('href="/aoiro-kojo/"'), '青色申告特別控除シミュレーターへの導線がある');

console.log(failed === 0 ? '\n✅ 全項目 緑' : `\n❌ ${failed}件 失敗`);
process.exit(failed === 0 ? 0 : 1);
