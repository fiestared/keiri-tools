#!/usr/bin/env node
import { verifiedContentDate } from './verified_content_dates.mjs';
/**
 * 記事の「更新日」を git の履歴から焼き込む（JSON-LD の dateModified と、可視の更新日）。
 *
 *   node tools/gen_datemodified.mjs          生成(冪等)
 *   node tools/gen_datemodified.mjs --check  差分があれば失敗(テスト用)
 *   node tools/gen_datemodified.mjs --dry    書かずに対象だけ出す
 *
 * ★なぜ要るか（2026-08-19 実測）:
 *   dateModified は ARTICLE_SPEC に書いてあるだけで**生成器が無く、手書きだった**。
 *   結果、コラム192本のうち **176本で dateModified == datePublished**、
 *   **181本は可視の更新日すら無い**。
 *   実害が出ている: /column/gensen-zeigakuhyo-mikata/ は 08-15 に月額表231区分を
 *   足す大改稿をしたのに、Bing の検索結果には **「2026年7月14日」** と出ていた。
 *   同じ語で3〜5位にいる小規模サイトは「【令和8年8月最新】」を出している。
 *   ＝ 中身は新しいのに、SERP 上では**1か月古い記事に見えていた**。
 *
 * ★日付の決め方（これがこの道具の芯）:
 *   - 作業ツリーに未コミットの**本文**変更がある → **今日(JST)**
 *   - 無ければ → **本文が変わった最後のコミット日**
 *   こうすると「編集 → 生成 → commit → 再生成」で値が動かない（冪等）。
 *   🚫 常に最終コミット日にすると、生成器自身のコミットで日付がずれ続ける。
 *
 * ★★「本文が変わった」を見ること（ここを手抜きすると鮮度の偽装になる）:
 *   単純に最終コミット日を使うと、**140本が一律 2026-08-16 になった**。
 *   その日は「全ページ末尾にXで共有リンクを入れた」という**全ページ一括の機械的変更**で、
 *   記事の中身は1文字も変わっていない。それを「更新日」として出すのは読者への嘘だし、
 *   検索エンジンから見ても偽の鮮度信号でしかない。
 *   → 本文の定義は tools/page_body.mjs、日付の決め方は tools/body_lastmod.mjs（sitemap の lastmod と同じ・2026-10-19 から）。
 *     🚫 ここに独自の基準を作らないこと（基準を2つ持たない）。
 *
 * ★捏造しないこと: 日付は git の実履歴だけから作る。手で新しくしない。
 *   公開日と同じ日なら「更新日」は**出さない**（更新していないので）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { bodyLastmods } from './body_lastmod.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry');

// -p の出力は数十MBになる。既定の maxBuffer(1MB) では ENOBUFS で落ちる（2026-08-19 実測）
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
// 日付はすべて JST。toISOString は UTC 固定なので使わない。
const todayJST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const ja = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${y}年${m}月${d}日`; };
// 和文の日付 → ISO(YYYY-MM-DD)。ゼロ埋めする（datetime 属性は ISO でないと機械が読めない）。
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * article-meta の中の日付を <time datetime="ISO"> で包む。
 *
 * ★なぜ要るか（2026-09-09 の実測）:
 *   /column/furikomi-tesuryo-hikaku/ は dateModified 2026-09-03・title に「【2026年9月更新】」・
 *   本文にも「最終更新: 2026年9月3日」があるのに、**Bing の検索結果には「2026年7月13日」（公開日）が出ていた**。
 *   同じ画面で3位・4位の競合は 8月17日・8月19日 を出しており、**順位は上なのに日付だけ古く見える**状態だった。
 *   可視の日付は素のテキストで、公開日と更新日のどちらがどちらかを機械が区別できる形になっていない。
 *   → datetime 属性を付けて、機械可読にする。
 *
 * ★捏造しない: 日付の値は一切変えない。既にある文字列を包むだけ。
 *   更新していない記事に「更新日」を作らないという上の方針はそのまま。
 * ★冪等: 既に <time> で包まれているものは触らない。
 */
function withTimeTags(html) {
  const meta = html.match(/<p class="article-meta">([\s\S]*?)<\/p>/);
  if (!meta) return html;
  let m = meta[1];
  // 「公開日:」「更新日:」「最終更新:」の直後に来る和文日付だけを包む。
  // 本文中の他の日付（例: 「2026年8月28日に公式ページで確認」）は対象外。
  // 既存の <time> ごと article-meta 全体を素通りさせると、公開日だけが既に
  // 包まれたページへ追加した更新日が裸のまま残る。既存の time 要素だけを保護し、
  // それ以外の断片に包みを追加する。
  m = m.split(/(<time\b[^>]*>[\s\S]*?<\/time>)/gi).map((part, i) => {
    if (i % 2) return part;
    return part.replace(
      /((?:公開日|更新日|最終更新)\s*[:：]\s*)(\d{4})年(\d{1,2})月(\d{1,2})日/g,
      (_, label, y, mo, d) => `${label}<time datetime="${iso(y, mo, d)}">${y}年${mo}月${d}日</time>`
    );
  }).join('');
  return m === meta[1] ? html : html.replace(meta[0], `<p class="article-meta">${m}</p>`);
}

// 対象: docs 配下で dateModified を持つ index.html
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'assets' && e !== 'ext') walk(p); }
    else if (e === 'index.html') files.push(p);
  }
})(DOCS);

// ★2026-10-19 Masahiro「本文が変わった時だけでいいよ」: 更新日の決め方を sitemap の lastmod と同じ
//   「本文（tools/page_body.mjs の定義）が変わった最後のコミット日。未コミットで本文が HEAD と違えば今日」にそろえた。
//   旧規則（20ファイル以上のコミットは数えない・導線だけの行は数えない）は、一括コミットの中の本当の文言変更を落とし、
//   生成器だけの変更（次に読む等）の一部を本文の変更と数えていた（sitemap 側を直した時点で 43 本が食い違った）。
//   本文の定義・日付の決め方は body_lastmod.mjs に1つだけ持つ（基準を2つ持たない）。
//   この生成器が書く dateModified（head）と article-meta の日付行は本文の定義の外なので、自家中毒（自分の書いた日付で今日になる）は起きない。
const lastmods = bodyLastmods({ cwd: DOCS, files, today: todayJST() });

let changed = 0, skipped = 0, noPub = 0, tools = 0;
function isTool(rel, html) {
  if (/^docs\/(embed|hojokin)\//.test(rel)) return false;
  return /assets\/[a-z0-9_]+_core\.js/.test(html);
}
const changedList = [];
for (const fp of files) {
  const rel = relative(ROOT, fp);
  let s = readFileSync(fp, 'utf8');
  const pub = s.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
  // ★ツール（公開日を持たず、計算コア *_core.js を読むページ）も、本文が変わったら更新日を進める（2026-10-17 Masahiro「更新日変わるようにして、ツール」）。
  //   それまで datePublished 無しは丸ごと対象外で、/senpou-futan/ は 10-17 に本文を追記しても「更新日: 2026年9月29日」のままだった。
  //   公開日が無いので「公開日へ丸める」は使えない → 今の日付より戻さない（一括コミットで直した日付を古い履歴で巻き戻さない）。
  //   embed/（埋め込み用の写し）と hojokin/（一覧は1日3回の自動取り込み。可視の日付は「説明の更新日」）は対象外のまま。
  if (!pub && isTool(rel, s)) {
    const cur = s.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1]
      ?? s.match(/<p class="article-meta">\s*更新日:\s*<time datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
    if (!cur) { noPub++; continue; }
    const hist = lastmods.get(fp);
    const eff = verifiedContentDate(rel, hist && hist > cur ? hist : cur);
    let out = s.replace(/("dateModified"\s*:\s*")\d{4}-\d{2}-\d{2}(")/, `$1${eff}$2`)
      .replace(/(<p class="article-meta">\s*更新日:\s*)<time datetime="\d{4}-\d{2}-\d{2}">[^<]*<\/time>/, `$1<time datetime="${eff}">${ja(eff)}</time>`);
    if (out !== s) {
      changed++; changedList.push(`${rel.replace('docs/', '')} → ${eff}（ツール）`);
      if (!CHECK && !DRY) writeFileSync(fp, out);
    }
    tools++;
    continue;
  }
  if (!s.includes('"dateModified"')) { skipped++; continue; }
  if (!pub) { noPub++; continue; }

  const date = lastmods.get(fp) ?? pub;
  // 公開日より前になることはない（履歴の付け替えなどで起きたら公開日に丸める）
  const eff = verifiedContentDate(rel, date < pub ? pub : date);

  let out = s.replace(/("dateModified"\s*:\s*")\d{4}-\d{2}-\d{2}(")/, `$1${eff}$2`);

  // 可視の更新日。公開日と同じ日なら出さない。
  if (eff !== pub) {
    const meta = out.match(/<p class="article-meta">([\s\S]*?)<\/p>/);
    if (meta) {
      let m = meta[1];
      // 旧ジェネレータ／手書き記事の「（更新: …）」が残っていると、現行の
      // 「（更新日: …）」と二重になる。現行表記へ寄せてから日付を更新する。
      const visibleDate = '(?:<time\\b[^>]*>\\s*)?\\d{4}年\\d{1,2}月\\d{1,2}日(?:\\s*<\\/time>)?';
      m = m.replace(new RegExp(`（更新:\\s*${visibleDate}）`, 'g'), '');
      // ★著者が「最終更新: 〇月〇日 — 〈何を直したか〉」と手で書いている記事が3本ある。
      //   ここに機械の日付を上書きすると、注記（何を直したか）と日付が食い違う。
      //   注記は人にしか書けない情報なので**可視表記には触れない**。JSON-LD だけ直す。
      const finalUpdated = new RegExp(`最終更新:\\s*${visibleDate}`);
      const updateParen = new RegExp(`（更新日:\\s*${visibleDate}）`);
      const updateDate = new RegExp(`（更新日:\\s*${visibleDate}`);
      const publishedDate = new RegExp(`(公開日:\\s*${visibleDate})`);
      if (finalUpdated.test(m)) {
        m = m.replace(updateParen, '');   // 過去に二重表記を作った分を戻す
      } else if (updateDate.test(m)) {
        // いったん素の日付へ戻し、下の withTimeTags で正しい datetime を付け直す。
        m = m.replace(updateDate, `（更新日: ${ja(eff)}`);
      } else if (publishedDate.test(m)) {
        m = m.replace(publishedDate, `$1（更新日: ${ja(eff)}）`);
      }
      out = out.replace(meta[0], `<p class="article-meta">${m}</p>`);
    }
  } else {
    // 実履歴から得た更新日が公開日と同じなら、以前の生成で残った可視の更新日も消す。
    // JSON-LD だけ公開日へ戻って可視表示だけ新しいまま、という逆向きの不一致を残さない。
    const meta = out.match(/<p class="article-meta">([\s\S]*?)<\/p>/);
    if (meta) {
      const visibleDate = '(?:<time\\b[^>]*>\\s*)?\\d{4}年\\d{1,2}月\\d{1,2}日(?:\\s*<\\/time>)?';
      const generatedUpdate = new RegExp(`(公開日\\s*[:：]\\s*${visibleDate})\\s*（更新日\\s*[:：]\\s*${visibleDate}）`);
      const m = meta[1].replace(generatedUpdate, '$1');
      out = out.replace(meta[0], `<p class="article-meta">${m}</p>`);
    }
  }

  // 可視の日付を機械可読にする（値は変えない・冪等）
  out = withTimeTags(out);

  if (out !== s) {
    changed++; changedList.push(`${rel.replace('docs/', '')} → ${eff}`);
    if (!CHECK && !DRY) writeFileSync(fp, out);
  }
}

if (CHECK && changed) {
  console.error(`✗ 更新日が古い記事が ${changed}本ある。node tools/gen_datemodified.mjs を流すこと`);
  for (const l of changedList.slice(0, 10)) console.error(`   ${l}`);
  process.exit(1);
}
console.log(`${CHECK ? '✓ 更新日は最新' : DRY ? '(dry)' : '✓'} 対象${files.length - skipped}本 / ${DRY || CHECK ? '要更新' : '更新'} ${changed}本` +
  (tools ? ` / ツール${tools}本` : '') + (noPub ? ` / datePublished無し ${noPub}本` : ''));
if (DRY) for (const l of changedList) console.log(`   ${l}`);
