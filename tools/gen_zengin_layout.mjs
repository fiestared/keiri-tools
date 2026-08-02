/**
 * `/column/zengin-format-guide/` に「レコードレイアウト（全4種・バイト位置つき）」を生成する。
 *
 * ★なぜ足すのか（2026-08-02 のBing実測 + codexレビュー）:
 *   「全銀フォーマット」133表示・8位。記事の重心は「受取人名の書き方（文字ルール・法人略語）」
 *   にあり、**バイト位置まで入った完全なレコードレイアウトが無い**。
 *   このクエリで来る人が求めているのはレイアウト仕様である可能性が高い（★推測。ただし
 *   8位まで評価されている既存ページに不足を足す方が、新規ページを作るより合理的）。
 *
 * ★なぜ「全銀共通の唯一の仕様表」として出さないのか:
 *   全銀フォーマットは**法令ではなく全国銀行協会の規定**で、e-Gov のような一次情報APIが無い。
 *   実務上の出典は各銀行が公開しているレコードフォーマット仕様書で、
 *   必須/省略可・改行・文字コード・固定値は**銀行ごとに差がある**（記事自身がそう断っている）。
 *   複数行の仕様を混ぜた「架空の標準完全表」を作ると、正確そうに見えて実際には外れる
 *   ——このサイトが最も嫌う形になる。
 *   ⇒ **特定の1行（群馬銀行）の公開仕様書を出典として明示**し、確認日を書き、
 *     項目ごとに「共通の骨格」か「銀行ごとに要確認」かを列で分ける。
 *
 * ★fail closed:
 *   各レコードの桁数合計が 120 でなければ**生成を止める**。位置は桁数の累計から導出するので、
 *   合計が合わないレイアウトを出すと、全部の位置が静かにずれた表を公開することになる。
 *
 * usage:
 *   node tools/gen_zengin_layout.mjs          生成して書き戻す
 *   node tools/gen_zengin_layout.mjs --dry    書き戻さず標準出力に出す
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARTICLE = join(root, 'docs/column/zengin-format-guide/index.html');
export const DATA = join(root, 'docs/assets/zengin_format_r08.json');

const START = '<!-- ZENGIN_LAYOUT:START 自動生成。手で編集しない。tools/gen_zengin_layout.mjs -->';
const END = '<!-- ZENGIN_LAYOUT:END -->';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 桁数の累計からバイト位置を導出する。★合計が record_length と違えば fail closed */
export function withPositions(record, recordLength) {
  let pos = 1;
  const fields = record.fields.map((f) => {
    const from = pos;
    pos += f.len;
    return { ...f, from, to: pos - 1 };
  });
  const total = pos - 1;
  if (total !== recordLength) {
    throw new Error(
      `${record.name} の桁数合計が ${total}（仕様は ${recordLength}）。` +
      'このまま出すと全項目のバイト位置が静かにずれた表を公開することになるので生成を止めます');
  }
  return fields;
}

export function buildLayout(D) {
  const L = D._meta.record_length;
  const out = [START];
  out.push('  <h2 id="layout">レコードレイアウト（全4種・バイト位置つき）</h2>');
  out.push(`  <p>4種類のレコードの全項目を、<b>ファイルの何バイト目に何が入るか</b>まで並べたものです。位置は桁数の累計から出しており、<b>各レコードの合計が${L}バイトに一致することを機械で確認</b>しています（合わなければ表を出さない作りです）。</p>`);
  out.push('  <div class="callout">');
  out.push(`    <p>★<b>出典は特定の1行の公開仕様書です。</b>${esc(D._meta.source_name)}（<a href="${esc(D._meta.source_url)}" rel="nofollow">PDF</a>・${esc(D._meta.verified_at)}確認）を基準に再構成しました。全銀協規定に準拠する一般的な構成ですが、<b>必須／省略可・改行の有無・文字コード・固定値・未使用項目の扱いは銀行ごとに差があります。実際にファイルを作るときは、必ず取引銀行の最新の仕様書を優先してください。</b></p>`);
  out.push(`    <p>表の「区分」列は、<b>共通</b>＝複数の仕様で共通している骨格、<b>要確認</b>＝銀行や契約サービスで差が出やすい項目、という意味です。</p>`);
  out.push('  </div>');
  out.push(`  <p>文字コードは${esc(D._meta.charset)}。1行${L}バイト（${esc(D._meta.newline_note)}）。${esc(D._meta.padding)}。</p>`);

  for (const rec of D.records) {
    const fields = withPositions(rec, L);
    out.push(`  <h3 id="layout-${rec.kubun}">${esc(rec.name)}（データ区分 ${esc(rec.kubun)}）</h3>`);
    out.push(`  <p>${esc(rec.role)}。</p>`);
    out.push('  <table>');
    out.push('    <tr><th>No</th><th>項目</th><th>位置<br>(バイト)</th><th>桁数・型</th><th>区分</th><th>内容</th></tr>');
    for (const f of fields) {
      const scope = f.scope === 'bank' ? '要確認' : '共通';
      const pos = f.from === f.to ? `${f.from}` : `${f.from}〜${f.to}`;
      out.push(`    <tr><td>${f.no}</td><td>${esc(f.name)}</td><td>${pos}</td><td>${f.type}(${f.len})</td><td>${scope}</td><td>${esc(f.content)}</td></tr>`);
    }
    out.push(`    <tr><td colspan="2"><b>合計</b></td><td><b>1〜${L}</b></td><td colspan="3"><b>${L}バイト</b></td></tr>`);
    out.push('  </table>');
  }
  out.push('  <p>受取人名がC(30)＝30桁と決まっているために、<a href="#moji">使用できる文字</a>と<a href="#ryakugo">法人略語</a>のルールが要ります。名義を実際に変換するなら<a href="../../zengin-kana/">振込名義カナ変換ツール</a>が使えます。</p>');
  out.push(END);
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const D = JSON.parse(readFileSync(DATA, 'utf8'));
  const layout = buildLayout(D);
  if (process.argv.includes('--dry')) {
    console.log(layout);
  } else {
    const html = readFileSync(ARTICLE, 'utf-8');
    let next;
    if (html.includes(START)) {
      const a = html.indexOf(START);
      const b = html.indexOf(END) + END.length;
      next = html.slice(0, a) + layout + html.slice(b);
    } else {
      const at = html.indexOf('  <h2 id="moji">');
      if (at < 0) throw new Error('挿入位置（<h2 id="moji">）が見つかりません');
      next = html.slice(0, at) + layout + '\n\n' + html.slice(at);
    }
    writeFileSync(ARTICLE, next);
    const n = D.records.reduce((s, r) => s + r.fields.length, 0);
    console.log(`レコードレイアウトを書き込みました（${D.records.length}レコード / ${n}項目）`);
  }
}
