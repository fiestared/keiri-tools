/**
 * `/column/furikomi-tesuryo-hikaku/` に「銀行別」セクションを、**記事内の比較表から生成**する。
 *
 * ★なぜ生成なのか（手で書いてはいけない理由）:
 *   この記事の本体は「各行の公式ページを実際に読んで確認した28区分の実測」であり、
 *   **比較表が一次情報の唯一の正本**。銀行別セクションを手書きすると同じ数字が2箇所に増え、
 *   料金改定のたびに片方だけ直る（＝表と本文が食い違う）。それは資産の毀損そのもの。
 *   → 表をパースして生成し、`tests/test_furikomi_bank_sections.mjs` が両者の一致を機械で守る。
 *
 * ★なぜ足すのか（2026-08-02 のBing実測）:
 *   銀行名を含むクエリが**個別に表示を持っている**のに、受け皿が総合ページ1本しかなかった:
 *     「ゆうちょ銀行 振込手数料 一覧」39表示 10位 クリック0
 *     「三菱ufj銀行 振込手数料 一覧」33表示  8位 クリック0
 *     「ufj 振込手数料」            67表示  7位 クリック1
 *   銀行名の見出し（h3）を作ると、この手のクエリに対する一致が上がる（順位改善は未検証・仮説）。
 *
 * usage:
 *   node tools/gen_bank_sections.mjs          生成して書き戻す
 *   node tools/gen_bank_sections.mjs --dry    書き戻さず標準出力に出す
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARTICLE = join(root, 'docs/column/furikomi-tesuryo-hikaku/index.html');

const START = '<!-- BANK_SECTIONS:START 自動生成。手で編集しない。tools/gen_bank_sections.mjs -->';
const END = '<!-- BANK_SECTIONS:END -->';

const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();

/** 記事から比較表を読む。返り値は [{name, kubun, under, over, boundary}] */
export function parseTables(htmlText) {
  const rows = [];
  // 「個人口座（15区分）」「法人口座（13区分）」の2つの表だけを対象にする
  for (const [anchor, kubun] of [['kojin', '個人'], ['hojin', '法人']]) {
    const head = htmlText.indexOf(`id="${anchor}"`);
    if (head < 0) throw new Error(`表の見出し id="${anchor}" が見つかりません`);
    const tStart = htmlText.indexOf('<table', head);
    const tEnd = htmlText.indexOf('</table>', tStart);
    if (tStart < 0 || tEnd < 0) throw new Error(`id="${anchor}" の直後に表がありません`);
    const table = htmlText.slice(tStart, tEnd);
    for (const tr of table.match(/<tr>[\s\S]*?<\/tr>/g) || []) {
      const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g) || []).map(strip);
      if (cells.length < 4 || cells[0] === '銀行・サービス') continue;
      rows.push({
        name: cells[0], kubun,
        under: cells[1], over: cells[2],
        boundary: cells[3] === '境界あり',
      });
    }
  }
  if (rows.length !== 28) throw new Error(`28区分のはずが ${rows.length} 行でした（表の構造が変わった可能性）`);
  return rows;
}

/** 「三菱UFJ銀行（法人・BizSTATION）」→「三菱UFJ銀行」 */
export const baseName = (name) => name.replace(/（.*$/, '').trim();

/**
 * 見出しの id（＝共有されるURLの一部）。**読めるローマ字を明示で持つ。**
 * ★機械生成のハッシュにしない: アンカーは人が貼るURLの一部で、意味が読めないと共有されない。
 * ★未知の銀行は fail-closed で落とす: 黙って壊れたidを吐くより、足すべき1行を教えて止まる方がよい。
 */
const BANK_SLUG = {
  'GMOあおぞらネット銀行': 'gmo-aozora', '住信SBIネット銀行': 'sbi-net', 'auじぶん銀行': 'au-jibun',
  'PayPay銀行': 'paypay', '楽天銀行': 'rakuten', 'イオン銀行': 'aeon', 'みずほ銀行': 'mizuho',
  'ゆうちょ銀行': 'yucho', 'りそな銀行': 'resona', '埼玉りそな銀行': 'saitama-resona',
  '三井住友銀行': 'smbc', '三菱UFJ銀行': 'mufg', '横浜銀行': 'yokohama',
  '千葉銀行': 'chiba', '福岡銀行': 'fukuoka',
};
export const bankId = (base) => {
  const slug = BANK_SLUG[base];
  if (!slug) throw new Error(`銀行「${base}」の id が未登録です。tools/gen_bank_sections.mjs の BANK_SLUG に1行足してください`);
  return `bank-${slug}`;
};

export function buildSections(rows) {
  const banks = new Map();
  for (const r of rows) {
    const b = baseName(r.name);
    if (!banks.has(b)) banks.set(b, []);
    banks.get(b).push(r);
  }
  // 並び順: まず法人口座がある銀行を法人の3万円以上の安い順、次に個人のみの銀行を個人の安い順。
  // ★個人と法人は価格帯が別物（同じ三菱UFJでも220円と660円）なので、混ぜて1本のキーで並べない。
  const price = (s) => Number(String(s).replace(/[^0-9]/g, '')) || 0;
  const rank = ([, v]) => {
    const h = v.find((x) => x.kubun === '法人');
    return h ? [0, price(h.over)] : [1, price(v[0].over)];
  };
  const sorted = [...banks.entries()].sort((a, b) => {
    const [ga, pa] = rank(a); const [gb, pb] = rank(b);
    return ga - gb || pa - pb;
  });

  const out = [];
  out.push(START);
  out.push('  <h2 id="ginkobetsu">銀行別の振込手数料（他行宛）</h2>');
  out.push('  <p>上の一覧を銀行ごとに並べ替えたものです。<b>同じ表の数字をそのまま出しています</b>（別々に管理していないので食い違いません）。個人と法人の両方がある銀行は並べて示します。</p>');
  for (const [base, list] of sorted) {
    const kojin = list.find((x) => x.kubun === '個人');
    const hojin = list.find((x) => x.kubun === '法人');
    out.push(`  <h3 id="${bankId(base)}">${base}の振込手数料</h3>`);
    out.push('  <table>');
    out.push('    <tr><th>区分</th><th>3万円未満</th><th>3万円以上</th></tr>');
    for (const r of [kojin, hojin]) {
      if (!r) continue;
      out.push(`    <tr><td>${r.name}</td><td>${r.under}</td><td>${r.over}</td></tr>`);
    }
    out.push('  </table>');

    const notes = [];
    if (kojin && hojin && price(kojin.over) !== price(hojin.over)) {
      const ratio = (price(hojin.over) / price(kojin.over)).toFixed(1).replace(/\.0$/, '');
      notes.push(`法人は個人の<b>${ratio}倍</b>（${kojin.over}→${hojin.over}）`);
    }
    const withBoundary = list.filter((x) => x.boundary).map((x) => x.kubun);
    notes.push(withBoundary.length
      ? `<b>3万円の境界あり</b>（${withBoundary.join('・')}）`
      : '金額にかかわらず<b>定額</b>');
    out.push(`  <p>${notes.join('。')}。</p>`);
  }
  out.push('  <p>金額の出典と調査日は<a href="#shutten">調査方法と出典</a>に、境界の仕組みは<a href="#kyoukai">「3万円の境界」があるのは10区分だけ</a>に書いています。</p>');
  out.push(END);
  return out.join('\n');
}

// ★このファイルは tests/test_furikomi_bank_sections.mjs から import される。
//   直接実行された時だけ書き込む（import で記事が書き換わると、テストが副作用を持つ）。
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const html = readFileSync(ARTICLE, 'utf-8');
  const section = buildSections(parseTables(html));

  if (process.argv.includes('--dry')) {
    console.log(section);
  } else {
    let next;
    if (html.includes(START)) {
      const a = html.indexOf(START);
      const b = html.indexOf(END) + END.length;
      next = html.slice(0, a) + section + html.slice(b);
    } else {
      // 初回は「法人は銀行選びで年6万円変わる」の直前に入れる（表の直後）
      const at = html.indexOf('  <h2 id="gap">');
      if (at < 0) throw new Error('挿入位置（<h2 id="gap">）が見つかりません');
      next = html.slice(0, at) + section + '\n\n' + html.slice(at);
    }
    writeFileSync(ARTICLE, next);
    console.log(`銀行別セクションを書き込みました（${(section.match(/<h3 /g) || []).length}行分の見出し）`);
  }
}
