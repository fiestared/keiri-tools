/**
 * jGrants 以外の2つのデータ源の検査。
 *
 *  ① hojokin_schedule.json … ミラサポplus（中小企業庁）の公募スケジュール
 *  ② koyou_joseikin.json  … 厚生労働省の雇用関係助成金の一覧
 *
 * ★どちらも**外部サイトのHTMLを解析して作る**ので、
 *   先方のHTMLが変わると黙って0件・少数件になるのが一番怖い。
 *   取得スクリプト側に件数ガードを置いているが、ここでも「痩せていないか」を見る。
 *
 * ★件数そのものは固定しない（制度は増減する）。下限だけを置く。
 */
import { readFileSync } from 'node:fs';

const S = JSON.parse(readFileSync(new URL('../docs/assets/hojokin_schedule.json', import.meta.url), 'utf8'));
const K = JSON.parse(readFileSync(new URL('../docs/assets/koyou_joseikin.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };

// ── ① 公募スケジュール（ミラサポplus）──────────────────────────
console.log('★公募スケジュール');
ok(S._meta && S._meta.captured_jst, '取得日時を持っている');
ok(S._meta.attribution && S._meta.attribution.includes('ミラサポplus'), '★出典を持っている');
ok(S._meta.source_url && S._meta.source_url.includes('mirasapo'), '出典URLを持っている');
ok(Array.isArray(S.schedule) && S.schedule.length >= 5,
  `★行がある（${S.schedule.length}行。5行未満なら先方のHTML変更を疑う）`);
ok(S.schedule.every((r) => r.name && r.start && r.period), '全行に制度名・開始・期間がある');
ok(S.schedule.every((r) => !r.url || r.url.startsWith('http')), 'URLは絶対URL');

// ★このデータを持つ理由そのもの: jGrants に載らない制度が入っていること。
//   ここが空になったら、わざわざ外部を取る意味が消えている。
{
  const names = S.schedule.map((r) => r.name).join('|');
  ok(/デジタル化|IT導入/.test(names), '★デジタル化・AI導入補助金（jGrants に載らない）が入っている');
  ok(/省力化/.test(names), '★省力化投資補助金（jGrants に載らない）が入っている');
  ok(/持続化/.test(names), '★持続化補助金（回と回の間は jGrants で0件になる）が入っている');
}
// ★日付に正規化しないこと。「第23次受付終了」「随時受付中」を潰すと情報が落ちる
ok(S.schedule.some((r) => !/^\d{4}\//.test(r.start)),
  '★日付以外の表記（受付終了・随時受付中など）を原文のまま保持している');

// ── ② 雇用関係助成金（厚労省）──────────────────────────────
console.log('★雇用関係助成金');
ok(K._meta && K._meta.captured_jst, '取得日時を持っている');
ok(K._meta.attribution && K._meta.attribution.includes('厚生労働省'), '★出典を持っている');
ok(Array.isArray(K.joseikin) && K.joseikin.length >= 30,
  `★制度がある（${K.joseikin.length}件。30件未満なら先方のHTML変更を疑う）`);
ok(K.joseikin.every((r) => r.name && r.url), '全件に制度名とURLがある');
ok(K.joseikin.every((r) => r.url.includes('mhlw.go.jp')),
  '★URLはすべて厚労省のドメイン（別サイトへ誘導しない）');
ok(K.joseikin.every((r) => !/#h2_free/.test(r.url)),
  '★ページ内の目次リンクを制度として拾っていない');
ok(new Set(K.joseikin.map((r) => r.name)).size === K.joseikin.length, '制度名の重複が無い');

// ★読者（給与・労務の担当者）が一番探すものが入っているか。
//   ここが欠けたら、このデータを持つ意味がほぼ無い。
{
  const names = K.joseikin.map((r) => r.name).join('|');
  for (const kw of ['キャリアアップ助成金', '人材開発支援助成金', '両立支援等助成金', '65歳超雇用推進助成金']) {
    ok(names.includes(kw), `★${kw} が入っている`);
  }
}

// ★★申請期限を持たないこと（持つと嘘になる）。
//   雇用関係助成金には公募型のような単一の締切が無く、雇入れの日や支給対象期で決まる。
ok(K.joseikin.every((r) => !('deadline' in r) && !('acceptance_end_datetime' in r)),
  '★★締切の項目を持っていない（単一の締切が存在しない制度なので、持つと嘘になる）');
ok(K._meta._note.includes('締切'), '★締切を持たない理由がデータに書いてある');

// ── ★別URLの初期HTMLへ焼き込まれていること ─────────────────────
console.log('★静的HTMLへの焼き込みとタブ');
const pages = [
  ['../docs/hojokin/index.html', 'https://keiri-tools.com/hojokin/'],
  ['../docs/hojokin/schedule/index.html', 'https://keiri-tools.com/hojokin/schedule/'],
  ['../docs/hojokin/koyou/index.html', 'https://keiri-tools.com/hojokin/koyou/'],
].map(([path, url]) => ({ html: readFileSync(new URL(path, import.meta.url), 'utf8'), url }));
const [searchPage, schedulePage, koyouPage] = pages;
const between = (source, start, end) => source.match(new RegExp(`${start}([\\s\\S]*?)${end}`))?.[1] || '';
const scheduleBlock = between(schedulePage.html, '<!--sched:S-->', '<!--sched:E-->');
const koyouBlock = between(koyouPage.html, '<!--koyou:S-->', '<!--koyou:E-->');
ok((schedulePage.html.match(/<!--sched:[SE]-->/g) || []).length === 2 && scheduleBlock.trim(),
  'schedule のマーカーが1組あり、間が空でない');
ok((koyouPage.html.match(/<!--koyou:[SE]-->/g) || []).length === 2 && koyouBlock.trim(),
  'koyou のマーカーが1組あり、間が空でない');
ok((scheduleBlock.match(/<tr>/g) || []).length - 1 >= 5,
  'schedule の焼き込み行数が MIN_ROWS 以上');
ok((koyouBlock.match(/rel="nofollow noopener"/g) || []).length >= 30,
  'koyou の焼き込み制度数が MIN_ITEMS 以上');
ok(!/href="#hj-(?:sched|koyou)"/.test(searchPage.html) &&
   !/id="hj-(?:sched|koyou)(?:-body)?"/.test(searchPage.html),
  '検索ページに旧ブロックや旧アンカーへのリンクが残っていない');
for (const page of pages) {
  const tabs = page.html.match(/<nav class="hj-tabs"[\s\S]*?<\/nav>/)?.[0] || '';
  const hrefs = [...tabs.matchAll(/<a href="([^"]+)"/g)].map((m) => new URL(m[1], page.url).href);
  ok(JSON.stringify(hrefs) === JSON.stringify([
    'https://keiri-tools.com/hojokin/',
    'https://keiri-tools.com/hojokin/schedule/',
    'https://keiri-tools.com/hojokin/koyou/',
  ]), `${page.url} のタブ3本が正しい相対URLへ解決する`);
}

// ── ★混ぜないこと ────────────────────────────────────────
console.log('★混ざっていないか');
{
  const H = JSON.parse(readFileSync(new URL('../docs/assets/hojokin_jgrants.json', import.meta.url), 'utf8'));
  const ids = new Set(H.subsidies.map((r) => r.id));
  ok(K.joseikin.every((r) => !ids.has(r.name)), '雇用関係助成金が補助金の一覧に混入していない');
  // ★補助金の検索（締切順）に、締切の無いものを流し込まない
  ok(H.subsidies.every((r) => 'acceptance_end_datetime' in r),
    '★補助金側は全行が締切の項目を持つ（持たないデータを混ぜていない）');
}

// ── ★生成物が最新か（流し忘れの検知）────────────────────────────
// ★2026-08-14 追加。gen_hojokin_tabs / gen_hojokin_after は cron と手作業の両方で流すが、
//   流し忘れても画面は「古いまま普通に見える」ので気づけない。--check を検査に通す。
console.log('★生成物が最新か');
{
  const { execFileSync } = await import('node:child_process');
  const root = new URL('../', import.meta.url).pathname;
  for (const g of ['gen_hojokin_tabs', 'gen_hojokin_after']) {
    let green = true;
    try { execFileSync('node', [`tools/${g}.mjs`, '--check'], { cwd: root, stdio: 'pipe' }); }
    catch { green = false; }
    ok(green, `★${g}.mjs --check が緑（赤なら node tools/${g}.mjs を流してコミットする）`);
  }
}

console.log(`\n${fail ? '✗' : '✓'} test_hojokin_sources: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
