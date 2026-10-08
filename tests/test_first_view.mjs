/**
 * PC の最初の画面（1280×800）に「使うもの」が入っていることを、実描画で確かめる。
 *
 *   node tests/test_first_view.mjs
 *
 * ★なぜ要るか（2026-10-08 UI/UX レビュー第1〜3周で3周とも残った設計判断。Masahiro 承認。
 *   gbrain decisions/keiri-uiux-design-decisions-2026-10-08）:
 *   ① トップ: 1280×800 の最初の画面にツールへのリンクが0件だった（見出し・検索・分野カード・対象者スイッチで埋まる）。
 *   ② 計算機: 計算ボタンが最初の画面の外にあった（10本中1本だけ）。h1・リード・入力欄の長い補足が上にあるため。
 *      ②は /shakai-hoken/・/tedori/ の2本だけで試す。対照は /gensen-choshu/・/furusato/（リードと入力欄を触らない）。
 *      判定日 2026-10-30。**判定までは対照の2本に同じ型（.fv-form）を広げない** → この検査が落とす。
 *   単体も E2E も「画面のどこに在るか」を見ない。位置は描いて測るしかない。
 *
 * ★見るもの
 *   A. トップ: 1280×800・1440×900・1920×1080 で、ツールのカード（a.tool-card）が**丸ごと**画面内に4枚以上。
 *      既定（会社員・個人）と「個人事業主・フリーランス」の両方。
 *      「経理担当」は道具箱のパネル（#favorite-tools）が棚の上に開くので対象外（既知の残り。数えて表示だけする）。
 *   B. 計算機2本: 1280×800 で、畳んでいない入力欄の全部と計算ボタン（#calc）が**丸ごと**画面内。
 *   C. 移した説明が残っている: 入力欄の下から移した文を、移し先の要素（#input-help の該当 li・#lead-detail）を
 *      名指しして**全文一致**で見る（規則3・5。本文のどこかに在る、では見ない。部分一致もしない）。
 *   D. 対照の2本に .fv-form が無く、試す2本に在る。
 *
 * ★壊しテスト（規則2: 無傷が緑であることを先に確かめてから壊す。壊すのは配信の途中で、docs/ は書き換えない）
 *   - トップ: 元の形へ戻す（分野カードを棚の上へ＋差し込み位置を新着コラムの前へ）／ 片方だけ戻す（2種）
 *   - 計算機: 移したリードを hero へ戻す（手取り）／ 2列の並びを外す（社保）
 *   - 説明: 移し先の li を消す ／ li の文を1字変える
 *   - 対照: /furusato/ のカードに fv-form を付ける
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { browserTools, serve, ready, DOCS } from './layout/browser.mjs';

const MIN_CARDS = 4;
const TOP_VIEWPORTS = [[1280, 800], [1440, 900], [1920, 1080]];
const TOOLS = {
  '/shakai-hoken/': { inputs: ['#monthly', '#pref', '#age', '#gyoshu'] },
  '/tedori/': { inputs: ['#gross', '#dependents', '#pref', '#age', '#gyoshu', 'input[name="jmode"][value="estimate"]', 'input[name="jmode"][value="manual"]', 'input[name="jmode"][value="none"]'] },
};
const CONTROLS = ['/gensen-choshu/', '/furusato/'];

// 2026-10-08 に入力欄の下・リードから移した文（origin/main ee68572f の逐語）。[移し先の要素, 見出しの語, 全文]
const MOVED = {
  '/shakai-hoken/': [
    ['li', '報酬月額', '基本給・残業手当・住宅手当・役職手当・通勤手当など、報酬に該当する総額を入力してください。通勤手当は所得税で非課税の部分も含めます。'],
    ['li', '年齢', '70歳以上の厚生年金保険料は、高齢任意加入の場合を除き0円です。高齢任意加入は対象外です。'],
    ['li', '業種', 'この計算機では、協会けんぽの選択県・標準報酬・年齢等を同じにして業種を変えると、雇用保険料率が変わります'],
  ],
  '/tedori/': [
    ['lead', '', '2026年度の料率・令和8年分の月額表（甲欄）では、東京都の協会けんぽ加入・一般の事業・30歳・甲欄の扶養親族等の数0人で、非課税手当を含まない額面月給30万円なら、住民税を除く手取り月額は249,610円が目安です。この計算機は社会保険料・源泉所得税を差し引き、住民税も概算・実額入力・含めないから選べます。非課税手当がある給与は試算対象外です。'],
    ['li', '額面の月給', '基本給＋残業手当など、税引き前の総支給額。この計算機は非課税通勤手当等を含まない給与が対象です。非課税手当がある場合は、社会保険と税の対象額を分けられないため試算対象外です。'],
    ['li', '扶養親族等の数', '扶養控除等申告書に基づく扶養親族等の数を入力。令和8年分は源泉控除対象配偶者＋源泉控除対象親族（19〜22歳の特定親族のうち合計所得100万円以下も含む）が基本です。ただし、相互適用などにより扶養控除等申告書に記載がないものとされる源泉控除対象配偶者・源泉控除対象親族は除きます。本人の障害者・寡婦・ひとり親・勤労学生は、扶養控除等申告書に該当の記載があれば各1人加算。同一生計配偶者・扶養親族の障害者（16歳未満も対象）は各1人、同居特別障害者はさらに1人を加算。加算には申告書への記載が必要で、国外居住親族は親族関係書類（30歳以上70歳未満の留学者は留学を証する書類も）の添付または提示がある場合に限ります。該当なしは0。住民税はこの人数からの概算ではなく通知書の月額を確認してください。'],
    ['li', '年齢', 'この計算機の入力範囲は15〜74歳です。70歳以上の厚生年金保険料は0円として計算します（高齢任意加入は対象外）'],
    ['li', '業種', '雇用保険料率だけが業種で変わります（健康保険・厚生年金は変わりません）'],
  ],
};

const read = (path) => readFileSync(join(DOCS, path, 'index.html'), 'utf8');
const strip = (s) => s.replace(/<[^>]+>/g, '');

// ── C・D: 静的な検査（HTML を受け取って違反の一覧を返す。壊しテストから同じ関数を呼ぶ）──
export function movedErrors(path, html) {
  const errors = [];
  const list = html.match(/<h3 id="input-help">入力欄の詳しい説明<\/h3>\s*<ul class="fv-input-help">([\s\S]*?)<\/ul>/)?.[1];
  if (list === undefined) return [`${path}: 移し先（h3#input-help の直後の ul.fv-input-help）が無い`];
  const items = Object.fromEntries([...list.matchAll(/<li><b>([^<]+)<\/b>：([\s\S]*?)<\/li>/g)].map((m) => [m[1], strip(m[2])]));
  for (const [kind, key, text] of MOVED[path]) {
    const got = kind === 'lead' ? strip(html.match(/<p id="lead-detail">([\s\S]*?)<\/p>/)?.[1] ?? '') : items[key];
    const where = kind === 'lead' ? 'p#lead-detail' : `#input-help の「${key}」`;
    if (got === undefined || got === '') errors.push(`${path}: ${where} が無い（移した説明が消えた）`);
    else if (got !== text) errors.push(`${path}: ${where} の文が、移す前の文と一致しない`);
  }
  // 短くした補足から、移し先へ辿れること
  if (!/<div class="card fv-form">[\s\S]*?href="#input-help"[\s\S]*?id="calc"/.test(html)) errors.push(`${path}: 入力欄の補足から #input-help へのリンクが無い`);
  return errors;
}
export function scopeErrors(pages) {
  const errors = [];
  for (const p of Object.keys(TOOLS)) if (!/<div class="card fv-form">/.test(pages[p])) errors.push(`${p}: 試す対象なのに .fv-form が無い`);
  for (const p of CONTROLS) if (/\bfv-(form|cols-|input-help)/.test(pages[p])) errors.push(`${p}: 対照なのに fv- の型が入っている（2026-10-30 の判定までは広げない）`);
  return errors;
}

// ── A・B: 実描画 ──
const fullyIn = () => (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; };
const { chromium } = await browserTools();
const server = await serve();
const browser = await chromium.launch();
const issues = [];
let summary = [];
try {
  /** mutate: { [path]: (body) => body }。配信の途中で差し替える（docs/ は触らない） */
  async function open(width, height, path, mutate = {}) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== server.origin) return route.abort();
      const fn = mutate[url.pathname];
      if (!fn) return route.continue();
      const res = await route.fetch();
      const before = await res.text(), after = fn(before);
      assert.notEqual(after, before, `壊し方が外れた（${url.pathname} が変わっていない）`);   // 規則8
      return route.fulfill({ response: res, body: after });
    });
    const page = await context.newPage();
    await ready(page, server.origin + path);
    const vp = await page.evaluate(() => [innerWidth, innerHeight]);
    assert.deepEqual(vp, [width, height], `viewport が ${width}×${height} になっていない（測り方を疑う）`);
    return { context, page };
  }
  async function topCards(width, height, persona, mutate) {
    const { context, page } = await open(width, height, '/', mutate);
    try {
      if (persona !== 'kojin') { await page.click(`#persona-bar button[data-p="${persona}"]`); await page.evaluate(() => scrollTo(0, 0)); }
      return await page.evaluate((src) => {
        const inside = new Function('return ' + src)()();
        const cards = [...document.querySelectorAll('main section.tcat a.tool-card')];
        const order = [...document.querySelectorAll('main > *')].map((e) => e.id || '').filter(Boolean);
        return { n: cards.filter(inside).length, pressed: document.querySelector('#persona-bar button[aria-pressed="true"]')?.dataset.p, order };
      }, fullyIn.toString());
    } finally { await context.close(); }
  }
  async function toolView(path, mutate) {
    const { context, page } = await open(1280, 800, path, mutate);
    try {
      return await page.evaluate(({ src, inputs }) => {
        const inside = new Function('return ' + src)()();
        const btn = document.querySelector('.card #calc');
        return { calc: btn ? inside(btn) : null, bottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
          out: inputs.filter((s) => { const e = document.querySelector('.card ' + s); return !e || !inside(e); }) };
      }, { src: fullyIn.toString(), inputs: TOOLS[path].inputs });
    } finally { await context.close(); }
  }
  const topErrors = (r, label) => {
    const e = [];
    if (r.n < MIN_CARDS) e.push(`トップ ${label}: 最初の画面に丸ごと見えるツールのカードが ${r.n}枚（${MIN_CARDS}枚以上が要る）`);
    const i = (id) => r.order.indexOf(id);
    if (!(i('tools') >= 0 && i('tools') < i('t-kyuyo') && i('t-kyuyo') < i('domains') && i('t-keiri') < i('domains') && i('domains') < i('column-head'))) e.push(`トップ ${label}: 並びが「ツールの棚 → 分野から探す → 新着コラム」でない（${r.order.join(' ')}）`);
    return e;
  };
  const toolErrors = (r, path) => {
    const e = [];
    if (r.calc !== true) e.push(`${path}: 1280×800 の最初の画面に計算ボタンが入っていない（ボタンの下端 ${r.bottom}px）`);
    if (r.out.length) e.push(`${path}: 1280×800 の最初の画面に入っていない入力欄: ${r.out.join(', ')}`);
    return e;
  };

  // 無傷（規則2: ここが緑でなければ壊しテストへ進まない）
  for (const [w, h] of TOP_VIEWPORTS) for (const persona of ['kojin', 'jigyo']) {
    const r = await topCards(w, h, persona);
    assert.equal(r.pressed, persona, '対象者スイッチが切り替わっていない');
    issues.push(...topErrors(r, `${w}×${h}・${persona}`));
    summary.push(`${w}:${persona}=${r.n}`);
  }
  const keiri = await topCards(1280, 800, 'keiri');
  const pages = Object.fromEntries([...Object.keys(TOOLS), ...CONTROLS].map((p) => [p, read(p)]));
  for (const path of Object.keys(TOOLS)) {
    const r = await toolView(path);
    issues.push(...toolErrors(r, path), ...movedErrors(path, pages[path]));
    summary.push(`${path} ボタン下端${r.bottom}`);
  }
  issues.push(...scopeErrors(pages));
  assert.deepEqual(issues, [], '\n' + issues.join('\n'));

  // 壊しテスト（壊すと赤）
  const broken = [];
  const expectRed = (name, errors, re) => { if (!errors.some((e) => re.test(e))) broken.push(name); };
  const stripRe = /  <div class="section-head" id="domains">[\s\S]*?<\/nav>\n/;
  const stripUp = (b) => { const s = b.match(stripRe)[0]; return b.replace(s, '').replace('  <div class="section-head" id="tools">', s + '  <div class="section-head" id="tools">'); };
  const anchorBack = (b) => b.replace('document.getElementById("domains") || document.getElementById("column-head")', 'document.getElementById("column-head")');
  // 元の形（分野カードが棚の上・差し込みは新着コラムの前）に戻すと、カードが足りなくなる
  expectRed('元の形へ戻す', topErrors(await topCards(1280, 800, 'kojin', { '/': (b) => anchorBack(stripUp(b)) }), 'x'), /カードが \d枚/);
  // 片方だけ戻すと、棚と分野カードの上下が入れ替わる（差し込み位置と HTML の順番は組で動かす）
  expectRed('分野カードだけ棚の上へ戻す', topErrors(await topCards(1280, 800, 'kojin', { '/': stripUp }), 'x'), /並びが/);
  expectRed('差し込み位置だけ新着コラムの前へ戻す', topErrors(await topCards(1280, 800, 'kojin', { '/': anchorBack }), 'x'), /カードが \d枚/);
  const lead = MOVED['/tedori/'][0][2];
  expectRed('手取り: 移したリードを hero へ戻す', toolErrors(await toolView('/tedori/', { '/tedori/': (b) => b.replace(/(<section class="hero">[\s\S]*?)<\/section>/, `$1<p>${lead}</p></section>`) }), '/tedori/'), /計算ボタンが入っていない/);
  expectRed('社保: 2列の並びを外す', toolErrors(await toolView('/shakai-hoken/', { '/shakai-hoken/': (b) => b.replaceAll('class="fee-pair field-pair', 'class="x-') }), '/shakai-hoken/'), /計算ボタンが入っていない/);
  const sh = pages['/shakai-hoken/'], te = pages['/tedori/'];
  const liRe = /    <li><b>年齢<\/b>：[\s\S]*?<\/li>\n/;
  assert.ok(liRe.test(sh) && te.includes('（高齢任意加入は対象外）</li>') && te.includes('<p id="lead-detail">'), '壊し方の狙いが在る');
  expectRed('移し先の li を消す', movedErrors('/shakai-hoken/', sh.replace(liRe, '')), /「年齢」 が無い/);
  expectRed('li の文を1字変える', movedErrors('/tedori/', te.replace('（高齢任意加入は対象外）</li>', '（高齢任意加入も対象）</li>')), /「年齢」 の文が/);
  expectRed('移したリードを消す', movedErrors('/tedori/', te.replace(/  <p id="lead-detail">[\s\S]*?<\/p>\n/, '')), /lead-detail が無い/);
  expectRed('リードの金額を変える', movedErrors('/tedori/', te.replace('<p id="lead-detail">', '<p id="lead-detail">約').replace(/(<p id="lead-detail">[\s\S]*?)249,610円/, '$1249,000円')), /lead-detail の文が/);
  expectRed('対照に型を広げる', scopeErrors({ ...pages, '/furusato/': pages['/furusato/'].replace('<div class="card">', '<div class="card fv-form">') }), /対照なのに/);
  assert.deepEqual(broken, [], `壊しても赤にならない: ${broken.join(' ／ ')}`);
  console.log(`✓ 最初の画面: トップのカード ${summary.filter((s) => /^\d/.test(s)).join(' ')}（経理担当 ${keiri.n}＝道具箱が開くので対象外）／${summary.filter((s) => s.startsWith('/')).join('・')}／移した説明 ${Object.values(MOVED).flat().length}件は移し先に全文一致／対照2本は型なし（壊しテスト10種も赤）`);
} finally { await browser.close(); server.close(); }
