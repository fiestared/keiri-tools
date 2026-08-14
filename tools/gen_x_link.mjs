/**
 * フッターに X（@keiri_tools）への導線を1行入れる（冪等）。
 *
 * ★なぜ入れるのか（2026-08-03 fable / codex の独立リサーチが一致した点）:
 *   このサイトは**被リンクがゼロ**で、X アカウントはフォロワー0から始まる。
 *   その状態で最も現実的な経路は「**既に検索で来ている実務者**に橋を架けること」。
 *   平日27.8セッションは小さいが、**全員がど真ん中の読者**（勤務時間中に調べる経理担当者）。
 *   見積もりは月600セッション × 転換1% ＝ 月6人（★推測）。遅いが質が高い。
 *
 * ★文言は宣伝にしない:
 *   このサイトの信頼は「条文を毎回ひきなおす」「出典と確認日を持つ」で成り立っている。
 *   そこに販促の文体を混ぜると、本体の信頼まで薄まる。
 *   だから **「法改定は施行日に反映しています」というサイトの約束の"続き"** として、
 *   その通知先を示すだけにする。フォローを促す言葉は入れない。
 *
 * ★埋め込みページ（docs/embed/**）には入れない:
 *   ウィジェットは**他社サイトの中に表示される**。そこに自分の告知を混ぜるのは、
 *   埋め込んでくれた相手のページを汚すことになる。フッターを持たないので自然に除外される。
 *
 * usage:
 *   node tools/gen_x_link.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS = join(root, 'docs');

export const HANDLE = 'keiri_tools';
export const MARK = '<!-- x-link:auto -->';
export const LINE =
  `${MARK}<div style="margin-top:6px;font-size:12px;color:var(--sub)">` +
  `法改定は施行日に反映しています。更新の通知 → ` +
  `<a href="https://x.com/${HANDLE}" rel="me noopener" style="color:var(--sub)">@${HANDLE}</a></div>`;

/** フッターを持つページだけを対象にする（＝埋め込みは自然に外れる） */
export function pages(dir = DOCS, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) pages(p, acc);
    else if (f === 'index.html' && readFileSync(p, 'utf-8').includes('<footer')) acc.push(p);
  }
  return acc;
}

export function withLink(html) {
  if (html.includes(MARK)) {
    // 冪等: 既にあるものを差し替える（行を増やさない）
    const a = html.indexOf(MARK);
    const close = html.indexOf('</div>', a);
    // ★マーカーだけ置いて中身が無いページ（新規記事の手書きテンプレ）では close が -1 になる。
    //   旧実装は -1 + 6 = 5 を「終端」として扱い、html.slice(5) を後ろに繋いでいたので
    //   **文書全体が黙って2回書き込まれた**（<!DOC だけ欠けた2つ目の複製ができる）。
    //   検査は落ちるが「id が重複」としか言わないので、原因がここだと分かるまで遠い。
    //   中身が無い＝差し替える対象が無いだけなので、マーカーを LINE に置き換えれば足りる。
    if (close < 0) return html.slice(0, a) + LINE + html.slice(a + MARK.length);
    return html.slice(0, a) + LINE + html.slice(close + '</div>'.length);
  }
  const close = html.lastIndexOf('</footer>');
  if (close < 0) throw new Error('</footer> が見つかりません');
  return html.slice(0, close) + '  ' + LINE + '\n' + html.slice(close);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const list = pages();
  let changed = 0;
  for (const p of list) {
    const before = readFileSync(p, 'utf-8');
    const after = withLink(before);
    if (after !== before) {
      changed++;
      if (!process.argv.includes('--dry')) writeFileSync(p, after);
    }
  }
  const verb = process.argv.includes('--dry') ? '（--dry）変更が要るページ' : 'X への導線を入れました';
  console.log(`${verb}: ${changed} / フッターを持つ ${list.length} ページ`);
}
