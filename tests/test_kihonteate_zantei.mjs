/**
 * 雇用保険 附則4条の暫定措置（雇止め→特定受給資格者みなし）の「期限」を、
 * 参照データ(kihonteate_r07.json の fusoku4_zantei)を正本として、
 * ツールページと記事の記載に機械で結び付ける。
 *
 * 背景(2026-07-24 施行前棚卸し):
 *   附則4条・附則5条(地域延長給付)の期限は「離職日が令和9年3月31日まで」。
 *   e-Gov現行版(2026-05-13施行)と未施行版(2028-10-01・令和6年法律26号)の両方で
 *   本文md5一致を確認 = 延長も廃止もまだ立法されていない。
 *   平成21年から2〜3年刻みで延長されてきた措置なので、期限の間際に
 *   延長立法が入る可能性が高い。ここで守るもの:
 *   (1) ページ・記事の期限の記載がデータと食い違わないこと
 *   (2) coreが実際に keiyaku を特定受給資格者並みに扱っている(=注記が嘘でない)こと
 *   (3) 期限が近づいたら(recheck_after超過)このテストが赤くなり、再確認を強制すること
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prescribedDays, restrictionMonths } from '../docs/assets/kihonteate_core.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const DATA = JSON.parse(readFileSync(join(root, 'docs/assets/kihonteate_r07.json'), 'utf8'));
const Z = DATA.fusoku4_zantei;
const PAGE = readFileSync(join(root, 'docs/kihonteate/index.html'), 'utf8');
const ARTICLE = readFileSync(join(root, 'docs/column/shitsugyo-hoken-keisan/index.html'), 'utf8');

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✅ ${msg}`);
  else { console.error(`  ❌ ${msg}`); failed++; }
};
const visible = (s) => s.replace(/<[^>]+>/g, ' ');

// ---- 1. データの自己整合(西暦⇔和暦の転記ミスを落とす) ----
ok(!!Z, 'fusoku4_zantei がデータに存在する');
if (Z) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(Z.kigen);
  ok(!!m, `kigen(${Z.kigen}) が YYYY-MM-DD`);
  if (m) {
    const wareki = `令和${Number(m[1]) - 2018}年${Number(m[2])}月${Number(m[3])}日`;
    ok(wareki === Z.kigen_wareki,
      `kigen(${Z.kigen}) と kigen_wareki(${Z.kigen_wareki}) の和暦換算が一致(計算値=${wareki})`);
  }
  ok(Z.recheck_after < Z.kigen, `recheck_after(${Z.recheck_after}) は kigen(${Z.kigen}) より前`);

  // ---- 2. ページ: 注記の要素を名指し(規則3/5) ----
  const note = /<p class="hint" id="keiyaku-zantei-note">([\s\S]*?)<\/p>/.exec(PAGE);
  ok(!!note, 'ページに #keiyaku-zantei-note がある');
  if (note) {
    const t = visible(note[1]);
    ok(t.includes(`離職日が${Z.kigen_wareki}まで`),
      `注記が期限「離職日が${Z.kigen_wareki}まで」をデータどおりに書く`);
    ok(t.includes('附則4条') && t.includes('暫定措置'), '注記が根拠(附則4条・暫定措置)を名指しする');
  }
  ok(/<option value="keiyaku">契約期間が満了し、更新されなかった<\/option>/.test(PAGE),
    '注記が指す選択肢(keiyaku)が画面に存在する');

  // ---- 3. 記事: 附則4条を説明する callout と出典を名指し ----
  const callout = ARTICLE.split('<div class="callout">')
    .find(s => s.includes('雇用保険法附則4条の暫定措置'));
  ok(!!callout, '記事に附則4条の callout がある');
  if (callout) {
    ok(visible(callout.split('</div>')[0]).includes(`${Z.kigen_wareki}までの離職`),
      `記事calloutの期限「${Z.kigen_wareki}までの離職」がデータと一致`);
  }
  const srcLi = [...ARTICLE.matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map(x => visible(x[1]))
    .find(t => t.includes('附則第4条'));
  ok(!!srcLi && srcLi.includes(`${Z.kigen_wareki}までの離職`),
    `記事出典(附則第4条)の期限がデータと一致`);

  // ---- 4. coreの挙動が注記の主張と一致(keiyaku=会社都合並みの日数・給付制限なし) ----
  ok(prescribedDays(45, 'y10_20', 'keiyaku', false) === prescribedDays(45, 'y10_20', 'kaisha', false),
    'core: keiyaku の所定給付日数は kaisha と同じ(附則4条を適用している)');
  ok(prescribedDays(45, 'y10_20', 'keiyaku', false) !== prescribedDays(45, 'y10_20', 'jiko', false),
    'core: keiyaku は jiko より日数が多い(暫定措置が効いている)');
  ok(restrictionMonths('keiyaku', false, false) === 0, 'core: keiyaku に給付制限なし');

  // ---- 5. カナリア: 期限接近で赤くして再確認を強制する ----
  const today = new Date().toISOString().slice(0, 10);
  ok(today <= Z.recheck_after,
    `カナリア: 今日(${today}) <= recheck_after(${Z.recheck_after})。` +
    `赤くなったら e-Gov で雇用保険法附則4条の延長立法の有無を確認し、` +
    `データの note の手順(延長→期限更新/未定→recheck_afterのみ前進/失効→core改修)に従うこと`);
}

if (failed) { console.error(`\n${failed} 件失敗`); process.exit(1); }
console.log('\ntest_kihonteate_zantei: all green');
