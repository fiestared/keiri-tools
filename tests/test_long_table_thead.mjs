/**
 * 長い表は見出し行を <thead> に持ち、印刷では各ページの頭に見出しを繰り返す。
 *   node tests/test_long_table_thead.mjs
 *
 * ★なぜ要るか（2026-10-08 UI/UX レビュー 第2周 低L5・第3周で再確認）:
 *   標準報酬月額表（/column/hyojun-hoshu-gakuhyo/・50等級・PV2位）を印刷すると表が4枚にまたがり、3枚目から列見出しが無かった。
 *   見出し行が <thead> でなく tbody の1行目だったので、ブラウザは「繰り返す行」だと分からない。同じ形の表がほかに11あった。
 * ★見ること:
 *   ① 静的HTML: データ行（thead の外にあって td を持つ行）が15以上の表は、th の入った <thead> を持つ（全ページ。15 は見出しを追従させる CSS の閾値と同じ）
 *   ② style.css の印刷指定に thead{display:table-header-group} がある
 *   ③ 実ブラウザ: 表を JS で描くページでも、描いた後の長い表が thead を持つ／印刷時の thead が table-header-group
 *   ④ 実際の PDF: 標準報酬月額表の等級の行が載っている紙すべてに、列見出しが載っている（pdftotext があるとき）
 * ★規則1・2: 無傷で緑。壊すと赤（thead を外す）・通るべきものが通る（14行の表は thead 無しでも落とさない）を、このファイルの中で確かめる。
 *   ④だけの壊しテスト: style.css に `#grade-table thead{display:table-row-group}` を足し、THEAD_PDF_ONLY=1 で流すと④で赤（③を飛ばす）。
 * ★この網の外: データ行14以下の表（1枚に収まる前提。印刷指定の article table{break-inside:avoid} が割らない）と、
 *   ③に挙げていないページが JS で描く表。新しく JS で長い表を描くページを足したら RENDERED に足すこと。
 */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {browserTools, serve, contextFor, ready, DOCS} from './layout/browser.mjs';

const MIN_ROWS = 15;
export function longTablesWithoutThead(html) {
  const bad = [];
  const src = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
  for (const m of src.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)) {
    const body = m[1];
    const head = body.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/);
    // データ行＝thead の外にあって td を持つ行（thead に入っていない見出し行は数えない）
    const dataRows = (body.replace(/<thead\b[\s\S]*?<\/thead>/, '').match(/<tr\b[\s\S]*?<\/tr>/g) || []).filter((tr) => /<td\b/.test(tr)).length;
    if (dataRows < MIN_ROWS) continue;
    if (!head || !/<th\b/.test(head[1])) bad.push(`${m[0].slice(0, 70).replace(/\s+/g, ' ')}…（データ行${dataRows}）`);
  }
  return bad;
}
function pages(dir, out = []) {
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    if (e.isDirectory()) pages(join(dir, e.name), out);
    else if (e.name === 'index.html') out.push(join(dir, e.name));
  }
  return out;
}

// ① 静的HTML（全ページ）
const files = pages(DOCS);
const errors = [];
let longTables = 0;
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  for (const b of longTablesWithoutThead(html)) errors.push(`${f.slice(DOCS.length)}: ${b}`);
  longTables += (html.replace(/<script\b[\s\S]*?<\/script>/g, '').match(/<thead\b/g) || []).length ? 1 : 0;
}
assert.deepEqual(errors, [], `長い表（データ行${MIN_ROWS}以上）に <thead> が無い:\n` + errors.join('\n') + '\n見出し行を <thead> に、残りを <tbody> に入れる（生成物なら生成器を直す）');
assert(files.length > 300 && longTables > 20, `調べたページ ${files.length}・thead のあるページ ${longTables}。走査が空振りしていないか`);
// 規則2: 壊すと赤・通るべきものが通る
const GRADE = join(DOCS, 'column/hyojun-hoshu-gakuhyo/index.html');
const grade = readFileSync(GRADE, 'utf8');
assert.deepEqual(longTablesWithoutThead(grade), [], '無傷の標準報酬月額表が緑でない');
assert(longTablesWithoutThead(grade.replace(/<thead>([\s\S]*?)<\/thead>\s*<tbody>/, '$1').replace('</tbody>', '')).length === 1, '標準報酬月額表の thead を外しても赤にならない');
const row = '<tr><td>1</td><td>2</td></tr>';
assert.deepEqual(longTablesWithoutThead(`<table><tr><th>a</th><th>b</th></tr>${row.repeat(13)}</table>`), [], '14行の表（1枚に収まる）を落としている');
assert(longTablesWithoutThead(`<table><tr><th>a</th><th>b</th></tr>${row.repeat(15)}</table>`).length === 1, 'thead の無い16行の表を落とさない');
assert(longTablesWithoutThead(`<table><thead><tr><td>a</td></tr></thead><tbody>${row.repeat(15)}</tbody></table>`).length === 1, 'th の無い thead を見逃す');

// ② 印刷の指定
const css = readFileSync(join(DOCS, 'assets/style.css'), 'utf8');
const printBlocks = [...css.matchAll(/@media print\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => m[1]).join('\n');
assert.match(printBlocks, /(^|[\s}])thead\s*\{[^}]*display:\s*table-header-group/, 'style.css の @media print に thead{display:table-header-group} が無い');

// ③ 実ブラウザ（JS で描く表を含む）
const RENDERED = ['/column/hyojun-hoshu-gakuhyo/', '/inshi/', '/jidoshazei/', '/gensen-hyo/', '/column/juminzei-hayami/', '/nenshu/'].filter((p) => existsSync(join(DOCS, p, 'index.html')));
const {chromium} = await browserTools();
const server = await serve();
let b, pdfChecked = false, gradePages = 0;
try {
  b = await chromium.launch();
  const c = await contextFor(b, server.origin);
  const p = await c.newPage();
  for (const path of RENDERED) {
    await ready(p, server.origin + path);
    await p.waitForTimeout(300);
    await p.emulateMedia({media: 'print'});
    const r = await p.evaluate((min) => [...document.querySelectorAll('main table')].map((t) => {
      const data = [...t.rows].filter((tr) => tr.parentElement.tagName !== 'THEAD' && tr.querySelector('td')).length;
      const th = t.tHead && t.tHead.querySelector('th');
      return {id: t.id || t.className || 'table', data, thead: !!th, display: t.tHead ? getComputedStyle(t.tHead).display : ''};
    }).filter((x) => x.data >= min), MIN_ROWS);
    await p.emulateMedia({media: 'screen'});
    for (const t of r) {
      assert(t.thead, `${path} の表（${t.id}・データ行${t.data}）は描いた後も thead を持たない`);
      if (process.env.THEAD_PDF_ONLY !== '1') assert.equal(t.display, 'table-header-group', `${path} の表（${t.id}）: 印刷時の thead が ${t.display}（各ページに繰り返されない）`);
    }
    if (path === '/column/hyojun-hoshu-gakuhyo/') {
      assert(r.some((t) => t.id === 'grade-table' && t.data === 50), '標準報酬月額表（50等級）が見つからない');
      // ④ 実際の PDF
      await p.emulateMedia({media: 'print'});
      const pdf = await p.pdf({format: 'A4', printBackground: true});
      await p.emulateMedia({media: 'screen'});
      const dir = mkdtempSync(join(tmpdir(), 'thead-pdf-'));
      try {
        const f = join(dir, 'grade.pdf');
        writeFileSync(f, pdf);
        const n = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
        let ok = true;
        try { execFileSync('pdftotext', ['-v'], {stdio: 'ignore'}); } catch (e) { if (e.code === 'ENOENT') ok = false; }
        if (ok) {
          const noHead = [];
          for (let i = 1; i <= n; i++) {
            const t = execFileSync('pdftotext', ['-f', String(i), '-l', String(i), '-layout', f, '-'], {encoding: 'utf8'});
            // 等級の行: 「等級 標準報酬月額 範囲…」＝ 行頭が1〜50の数、その次が 58,000〜1,390,000 の金額
            const rows = (t.match(/^\s*\d{1,2}\s+\d{2,3},000\s/gm) || []).length + (t.match(/^\s*\d{1,2}\s+1,\d{3},000\s/gm) || []).length;
            if (rows < 3) continue;
            gradePages++;
            // ★「その紙のどこかに語が在る」で見ない（規則3）: 表の後ろの本文にも「等級」「厚生年金」が出るので、直す前の4枚目が通ってしまう。
            //   その紙の最初の等級の行の直前（8行以内）に、列見出しの語が並んでいること
            const lines = t.split('\n');
            const first = lines.findIndex((l) => /^\s*\d{1,2}\s+(\d{2,3}|1,\d{3}),000\s/.test(l));
            const above = lines.slice(Math.max(0, first - 8), first).join('\n');
            if (!(/等級/.test(above) && /厚生年金/.test(above) && /健康保険/.test(above))) noHead.push(`${i}枚目（等級の行 ${rows}）`);
          }
          assert(gradePages >= 2, `標準報酬月額表が ${gradePages} 枚にしか載っていない（複数枚にまたがる前提が崩れた。検査が空振り）`);
          assert.deepEqual(noHead, [], `標準報酬月額表の印刷で、列見出しの無い紙がある: ${noHead.join(' / ')}`);
          pdfChecked = true;
        }
      } finally { rmSync(dir, {recursive: true, force: true}); }
    }
  }
} finally { await b?.close(); server.close(); }
console.log(`✓ 長い表の thead: ${files.length}ページの静的HTML・描画後 ${RENDERED.length}ページ・印刷指定` +
  (pdfChecked ? `・標準報酬月額表のPDF（等級の載る${gradePages}枚すべてに列見出し）` : '') + '（壊しテスト3種も赤）');
if (!pdfChecked) console.log('  ★pdftotext が無いので、PDF の紙ごとの見出しは確かめていない（①〜③だけ）。poppler を入れると④も走る');
