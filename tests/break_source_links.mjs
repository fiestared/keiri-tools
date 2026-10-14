/** 実ページで無傷が緑→項目単位の欠落が赤。変更は一時コピー内だけで行う。 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEST = join(ROOT, 'tests/test_source_links.mjs');
const PAGE = '/nenmatsu-chosei/';
const original = readFileSync(join(ROOT, 'docs', PAGE.slice(1), 'index.html'), 'utf8');
const run = args => {
  const r = spawnSync(process.execPath, [TEST, ...args], { cwd: ROOT, encoding: 'utf8' });
  assert.ifError(r.error);
  assert.equal(r.signal, null, '検査プロセスが異常終了した');
  return { status: r.status, output: (r.stdout ?? '') + (r.stderr ?? '') };
};

// 規則2: 本物の全対象で先に緑を確認。常に赤なら、ここで中止する。
const baseline = run([]);
assert.equal(baseline.status, 0, '無傷のベースラインが赤。壊しテストを中止\n' + baseline.output);
console.log('✓ ベースライン: 本物のページ・登録簿で緑');

// 壊す位置は検査の抽出関数を使わず、実ページの h2#source と次の h2 で特定する。
const heading = '<h2 id="source">出典</h2>';
const start = original.indexOf(heading) + heading.length;
assert.equal(original.split(heading).length, 2, '実ページの出典見出しが一意でない');
const end = original.indexOf('<h2', start);
assert(end > start, '出典節の次の見出しが見つからない');
const section = original.slice(start, end);
const sourceItems = [...section.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)];
assert(sourceItems.length >= 2, '別項目のリンクが残る対照が必要');
const splice = (s, at, length, replacement) => s.slice(0, at) + replacement + s.slice(at + length);
const withoutLinks = s => s.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1');
const first = sourceItems[0];
const unlinked = splice(original, start + first.index, first[0].length, withoutLinks(first[0]));
assert.notEqual(unlinked, original, '壊し方が空振りした');

const dir = mkdtempSync(join(tmpdir(), 'keiri-source-links-'));
const docs = join(dir, 'docs');
const registry = join(dir, 'source_link_pages.json');
const pageFile = join(docs, PAGE.slice(1), 'index.html');
mkdirSync(dirname(pageFile), { recursive: true });
const args = ['--docs', docs, '--registry', registry];
let cases = 0;
function expect(label, html, status, diagnostic = '') {
  writeFileSync(pageFile, html);
  const r = run(args);
  assert.equal(r.status, status, `${label}\n${r.output}`);
  if (diagnostic) assert(r.output.includes(diagnostic), `${label}: 理由が違う\n${r.output}`);
  cases++;
  console.log('✓ ' + label);
}
const insert = (html, snippet) => splice(html, html.indexOf(heading) + heading.length, 0, snippet);
function published(html, jsonDate, metaDate, modified = '2026-10-14') {
  return html.replace(/"datePublished":\s*"[^"]+"/, `"datePublished": "${jsonDate}"`)
    .replace(/"dateModified":\s*"[^"]+"/, `"dateModified": "${modified}"`)
    .replace(/<p class="article-meta">[\s\S]*?<\/p>/,
      `<p class="article-meta">公開日: <time datetime="${metaDate}">${metaDate}</time>（更新日: ${modified}）</p>`);
}

try {
  writeFileSync(registry, JSON.stringify([PAGE]));
  expect('実ページの一時コピーも無傷で緑', original, 0);
  for (const [i, item] of sourceItems.entries()) {
    const changed = splice(original, start + item.index, item[0].length, withoutLinks(item[0]));
    assert.notEqual(changed, original, `項目${i + 1}を壊せていない`);
    expect(`実ページの li 項目${i + 1}だけリンクを外すと赤（他項目は無傷）`, changed, 1, `li項目${i + 1}: http(s)`);
  }
  const firstWithoutLink = withoutLinks(first[0]);
  const replaceFirst = replacement => splice(original, start + first.index, first[0].length, replacement);
  expect('空白の除外理由は赤', replaceFirst(firstWithoutLink.replace('<li>', '<li data-source-nolink="  ">')), 1, '理由が空');
  expect('空の除外理由はリンクがあっても赤', replaceFirst(first[0].replace('<li>', '<li data-source-nolink="">')), 1, '理由が空');
  expect('項目自身の理由付き除外は緑', replaceFirst(firstWithoutLink.replace('<li>', '<li data-source-nolink="自サイトの計算例">')), 0);
  expect('p のリンク欠落は li のリンクで隠せない', insert(original, '<p>独立した出典項目</p>'), 1, 'p項目1: http(s)');
  expect('リンク付き p は緑（単一引用符・属性順・http）', insert(original, "<p><a rel='noopener' href='http://www.nta.go.jp/'>国税庁</a></p>"), 0);
  expect('source-method も理由なしでは除外しない', insert(original, '<p class="source-method">一次資料で確認した</p>'), 1, 'p項目1: http(s)');
  expect('理由付きの自サイトの説明 p は緑', insert(original, '<p data-source-nolink="自サイトの計算手順の説明">計算例</p>'), 0);
  expect('同じ項目に1本残っていれば緑', replaceFirst(firstWithoutLink.replace('</li>', '<a href="https://www.nta.go.jp/">別の一次資料</a></li>')), 0);
  expect('親 li のリンクは子 li の代わりにならない', replaceFirst(first[0].replace('</li>', '<ul><li>子の出典</li></ul></li>')), 1, 'li項目2: http(s)');
  expect('子 li のリンクは親 li の代わりにならない', replaceFirst('<li>親の出典<ul>' + first[0] + '</ul></li>'), 1, 'li項目1: http(s)');
  expect('親の除外指定は子 li に引き継がない', replaceFirst('<li data-source-nolink="自サイトの計算">説明<ul><li>子の出典</li></ul></li>'), 1, 'li項目2: http(s)');
  expect('コメント内のリンクでは緑にしない', replaceFirst(firstWithoutLink.replace('</li>', '<!-- <a href="https://www.nta.go.jp/">隠れたリンク</a> --></li>')), 1, 'li項目1: http(s)');
  expect('script 内のリンクでは緑にしない', replaceFirst(firstWithoutLink.replace('</li>', '<script>const example = \'<a href="https://www.nta.go.jp/">例</a>\';</script></li>')), 1, 'li項目1: http(s)');
  expect('内部リンクでは緑にしない', replaceFirst(first[0].replace(/href="[^"]*"/g, 'href="/column/example/"')), 1, 'li項目1: http(s)');
  expect('http で始まるだけの不正 URL では緑にしない', replaceFirst(first[0].replace(/href="[^"]*"/g, 'href="http-not-a-url"')), 1, 'li項目1: http(s)');
  expect('h3「出典」も検査して無傷で緑', original.replace(heading, '<h3><span>出典</span></h3>'), 0);
  expect('h3「出典」のリンク欠落も赤', unlinked.replace(heading, '<h3>出典</h3>'), 1, 'li項目1: http(s)');
  expect('h2 出典節の下位 h3 の項目も検査', insert(original, '<h3>法令</h3><p>リンクなしの法令</p>'), 1, 'p項目1: http(s)');
  expect('見出し欠落は本文や目次の「出典」で隠せない', original.replace(heading, '<h2 id="source">参考資料</h2>'), 1, '見出しが無い');
  expect('空の出典節は次節のリンクで隠せない', splice(original, start, end - start, ''), 1, 'li・p が無い');
  expect('出典節が複数あれば2節目の欠落も赤', original.replace('<h2 id="related">', '<h2>出典</h2><p>2節目の出典</p><h2 id="related">'), 1, '出典節2 p項目1: http(s)');

  // 日付による自動適用は登録されていない実ページのコピーで確認する。
  const columnFile = join(docs, 'column/source-link-probe/index.html');
  mkdirSync(dirname(columnFile), { recursive: true });
  writeFileSync(pageFile, original);
  const checkDate = (label, html, status) => {
    writeFileSync(columnFile, html);
    const r = run(args);
    assert.equal(r.status, status, `${label}\n${r.output}`);
    if (status) assert(r.output.includes('/column/source-link-probe/: 出典節1 li項目1:'), r.output);
    cases++; console.log('✓ ' + label);
  };
  checkDate('未登録・10/14 公開は対象外（更新日が10/15でも対象外）', published(unlinked, '2026-10-14', '2026-10-14', '2026-10-15'), 0);
  checkDate('未登録・datePublished が10/15の境界で自動的に赤', published(unlinked, '2026-10-15', '2026-10-14'), 1);
  checkDate('未登録・article-meta の公開日が10/15でも赤', published(unlinked, '2026-10-14', '2026-10-15'), 1);
  const metaOnly = published(unlinked, '2026-10-14', '2026-10-15').replace(/"datePublished":\s*"[^"]+",?/, '');
  checkDate('JSON-LD がなくても article-meta の公開日で赤', metaOnly, 1);
  checkDate('time タグなしの日本語公開日でも赤', metaOnly.replace('<time datetime="2026-10-15">2026-10-15</time>', '2026年10月15日'), 1);
  checkDate('10/15以降の未登録ページもリンクが揃えば緑', published(original, '2026-10-16', '2026-10-16'), 0);
  // ツールの自動適用も、登録を外して日付だけで検証する。
  writeFileSync(registry, '[]');
  writeFileSync(columnFile, published(original, '2026-10-14', '2026-10-14'));
  expect('未登録ツールも10/15公開で自動的に赤', published(unlinked, '2026-10-15', '2026-10-14'), 1, `${PAGE}: 出典節1 li項目1:`);
  expect('未登録ツールの無傷は緑', published(original, '2026-10-15', '2026-10-15'), 0);
  writeFileSync(registry, JSON.stringify([PAGE, '/missing-page/']));
  expect('登録先が消えたら赤', original, 1, '/missing-page/: 登録先の index.html が存在しない');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
assert.equal(readFileSync(join(ROOT, 'docs', PAGE.slice(1), 'index.html'), 'utf8'), original, '実ページが変わった');
console.log(`✓ 出典リンクの壊しテスト: ${cases}件 / 実ページは無変更`);
