/**
 * `/column/furikomi-tesuryo-hikaku/` に「銀行別」セクションを、**fee_table.json から生成**する。
 *
 * ★なぜ生成なのか（手で書いてはいけない理由）:
 *   この記事の本体は「各行の公式ページを実際に読んで確認した28区分の実測」。
 *   銀行別セクションを手書きすると同じ数字が2箇所に増え、料金改定のたびに片方だけ直る。
 *
 * ★正本は `docs/assets/fee_table.json`（2026-08-02訂正）:
 *   初版はこの生成器が「記事の比較表をパースする」作りだった。**それは誤りで**、
 *   正本は前から fee_table.json にあり、`tests/test_fee_article.mjs` が
 *   JSON→記事の一致を既に守っていた（`/senpou-futan/` のプリセットも同じJSONを読む）。
 *   記事HTMLを読むと「JSON→記事→銀行別」と鎖が1本長くなるうえ、
 *   **JSONが行ごとに持っている出典URL・照合日を使えない**。よってJSONを直読みに変更した。
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
const formatJapaneseDate = (s) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : s;
};

export const DATA = join(root, 'docs/assets/fee_table.json');

/** 正本(fee_table.json)から28区分を読む。返り値は [{name, kubun, under, over, boundary, source, verifiedAt}] */
export function loadBanks() {
  const D = JSON.parse(readFileSync(DATA, 'utf8'));
  const rows = (D.banks || []).map((b) => {
    if (typeof b.under30k !== 'number' || typeof b.over30k !== 'number') {
      throw new Error(`${b.name} の金額が数値ではありません（fee_table.json が壊れている）`);
    }
    return {
      name: b.name,
      kubun: b.name.includes('法人') ? '法人' : '個人',
      under: `${b.under30k}円`,
      over: `${b.over30k}円`,
      boundary: b.under30k !== b.over30k,
      source: b.source || null,
      verifiedAt: b.verified_date || null,
    };
  });
  if (rows.length !== 28) throw new Error(`28区分のはずが ${rows.length} 行でした（fee_table.json の構造が変わった可能性）`);
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
  'GMOあおぞらネット銀行': 'gmo-aozora', 'ドコモSMTBネット銀行': 'sbi-net', 'auじぶん銀行': 'au-jibun',
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
  out.push('  <p>上の一覧を銀行ごとに並べ替えたものです。<b>数字は上の一覧と同一の調査結果に基づいています</b>ので食い違いません。個人と法人の両方がある銀行は並べて示します。行ごとに、最後に公式ページで確認した日を付けています。</p>');
  for (const [base, list] of sorted) {
    const kojin = list.find((x) => x.kubun === '個人');
    const hojin = list.find((x) => x.kubun === '法人');
    out.push(`  <h3 id="${bankId(base)}">${base}の振込手数料</h3>`);
    out.push('  <table>');
    out.push('    <tr><th scope="col">区分</th><th scope="col">3万円未満</th><th scope="col">3万円以上</th></tr>');
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

    // ★出典は行ごとに出す。未照合の行は「未照合」と書く（黙って伏せない）
    const srcs = [...new Set(list.filter((x) => x.source).map((x) => x.source))];
    const dates = [...new Set(list.filter((x) => x.verifiedAt).map((x) => x.verifiedAt))].sort();
    if (srcs.length) {
      const links = srcs.map((u) => `<a href="${u}" rel="nofollow">公式ページ</a>`).join('・');
      out.push(`  <p class="src">出典: ${links}（${dates.map(formatJapaneseDate).join('・')}確認）</p>`);
    } else {
      // ★2026-08-14: 文言を読者向けに直した。旧文「★この行はまだ一次情報での再照合が
      //   済んでいません（表全体の確認日のみ）。」は**編集メモがそのまま公開に出ていた**もので、
      //   表示5,773のサイト看板ページで読者には工事中に見える。
      //   ★「黙って伏せない」という設計は正しいので残す。伝え方だけを変える。
      out.push('  <p class="src">出典: この行は各行の公式ページで個別に確認できていません。'
        + '金額は表全体の調査時点のものです。<b>お手続き前に各行の公式ページでご確認ください。</b></p>');
    }
  }
  out.push('  <p>金額の出典と調査日は<a href="#shutten">調査方法と出典</a>に、境界の仕組みは<a href="#kyoukai">「3万円の境界」があるのは11区分だけ</a>に書いています。</p>');
  out.push(END);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// 金額から銀行を引く「逆引き」表
// ---------------------------------------------------------------------------

export const AMT_START = '<!-- AMOUNT_INDEX:START 自動生成。手で編集しない。tools/gen_bank_sections.mjs -->';
export const AMT_END = '<!-- AMOUNT_INDEX:END -->';

/**
 * 金額(円) → その金額になる区分の一覧。**同じ fee_table.json から作る**。
 * ★3万円未満と以上が同額の区分は「金額不問」として1件にまとめる
 *   （2行に割ると、定額の銀行が同じ金額の欄に二重に出て読みにくいだけで、情報が増えない）。
 */
export function amountMap(rows) {
  const yen = (s) => Number(String(s).replace(/[^0-9]/g, ''));
  const m = new Map();
  const add = (v, name, range) => {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} の金額を数値にできません（fee_table.json が壊れている）`);
    if (!m.has(v)) m.set(v, []);
    m.get(v).push({ name, range });
  };
  for (const r of rows) {
    if (!r.boundary) add(yen(r.under), r.name, '金額不問');
    else { add(yen(r.under), r.name, '3万円未満'); add(yen(r.over), r.name, '3万円以上'); }
  }
  return new Map([...m.entries()].sort((a, b) => a[0] - b[0]));
}

/**
 * ★なぜ足すのか（2026-08-08 のBing実測）:
 *   「金額から銀行を探す」意図のクエリが**両方の観測窓に出ている**のに、受け皿が
 *   銀行名で並んだ表しか無かった（利用者は銀行が分からないから金額で引いている）:
 *     旧窓(ラベル07-31) 8クエリ63表示 …「振込手数料 605円」17表示7位 /「振込手数料 484円」14表示 ほか
 *     新窓(ラベル08-07) 4クエリ 7表示 …「振込手数料 660円 どこ」実SERP**3位** /「385 円どこの銀行」7位2クリック
 *   ★実測で観測されている9つの金額のうち **7つ（605/484/145/660/385/495/330）は正本に答えがある**。
 *   ★この型（意図ごとに分ける）は 08-02 の銀行別セクションで唯一効いた型
 *   （「三菱ufj銀行 振込手数料 一覧」8位→5位）。論点を足すだけの改稿は動かなかった。
 *
 * ★収録範囲の申告を必ず出す（fail-closed）:
 *   実測の9金額のうち 995円・395円 は**この表に無い**。無い金額に当てずっぽうで答えると
 *   「他行宛28区分」という前提を黙って踏み越える。**答えないことを画面に書く。**
 */
export function buildAmountIndex(rows) {
  const m = amountMap(rows);
  const out = [];
  out.push(AMT_START);
  out.push('  <h2 id="gyakubiki">この金額はどこの銀行？（金額から逆引き）</h2>');
  out.push('  <p>通帳や請求書で見た手数料の金額から、その金額になる銀行を引く表です。<b>上の一覧と同じ調査結果から機械的に並べ替えています</b>ので、金額が食い違うことはありません。「3万円未満／以上で同じ額」の区分は「金額不問」と書いています。</p>');
  out.push('  <table>');
  out.push('    <tr><th scope="col">振込手数料</th><th scope="col">この金額になる区分</th></tr>');
  for (const [amount, list] of m) {
    const cells = list.map((x) => `${x.name}（${x.range}）`).join('<br>');
    out.push(`    <tr><td><b>${amount}円</b></td><td>${cells}</td></tr>`);
  }
  out.push('  </table>');
  out.push('  <p class="note">この表が扱うのは<b>他行宛・28区分</b>だけです。ここに無い金額は、同行宛・ATM・窓口経由・優遇適用後・他行宛以外の手数料など、<b>この一覧が調べていない条件</b>の可能性があります。この表に当てはめず、通帳の摘要欄や銀行の料金ページでご確認ください。</p>');
  out.push(AMT_END);
  return out.join('\n');
}

// ★このファイルは tests/test_furikomi_bank_sections.mjs から import される。
//   直接実行された時だけ書き込む（import で記事が書き換わると、テストが副作用を持つ）。
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const rows = loadBanks();
  const section = buildSections(rows);
  const amountIndex = buildAmountIndex(rows);

  if (process.argv.includes('--dry')) {
    console.log(section);
    console.log(amountIndex);
  } else {
    let html = readFileSync(ARTICLE, 'utf-8');

    /** マーカー区間を差し替える。無ければ anchor の直前に新規挿入する */
    const put = (src, s, e, body, anchor) => {
      if (src.includes(s)) {
        const a = src.indexOf(s);
        const b = src.indexOf(e) + e.length;
        return src.slice(0, a) + body + src.slice(b);
      }
      const at = src.indexOf(anchor);
      if (at < 0) throw new Error(`挿入位置（${anchor.trim()}）が見つかりません`);
      return src.slice(0, at) + body + '\n\n' + src.slice(at);
    };

    // 銀行別は「法人は銀行選びで年6万円変わる」の直前（＝比較表の直後）
    html = put(html, START, END, section, '  <h2 id="gap">');
    // 逆引きは銀行別のさらに前。銀行名が分からない人向けなので、銀行別より先に置く
    html = put(html, AMT_START, AMT_END, amountIndex, START);

    writeFileSync(ARTICLE, html);
    console.log(`銀行別セクション ${(section.match(/<h3 /g) || []).length}見出し / 逆引き ${(amountIndex.match(/<tr><td><b>/g) || []).length}金額 を書き込みました`);
  }
}
