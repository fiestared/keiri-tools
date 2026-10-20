import {eligiblePages} from './gen_bank_fee_pages.mjs';
/**
 * `/column/furikomi-tesuryo-hikaku/` に「銀行別」セクションを、**fee_table.json から生成**する。
 *
 * ★なぜ生成なのか（手で書いてはいけない理由）:
 *   この記事の本体は「各行の公式ページを実際に読んで確認した30区分の実測」。
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
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const formatJapaneseDate = (s) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : s;
};

export const DATA = join(root, 'docs/assets/fee_table.json');

/** 正本(fee_table.json)から30区分を読む。返り値は [{name, kubun, under, over, boundary, source, verifiedAt}] */
export function loadBanks() {
  const D = JSON.parse(readFileSync(DATA, 'utf8'));
  const rows = (D.banks || []).map((b) => {
    if (typeof b.under30k !== 'number' || typeof b.over30k !== 'number') {
      throw new Error(`${b.name} の金額が数値ではありません（fee_table.json が壊れている）`);
    }
    return {
      id: b.id,
      name: b.name,
      kubun: b.name.includes('法人') ? '法人' : '個人',
      // Article review can withhold an unverified band without inventing a new fee.
      rawUnder: b.under30k,
      rawOver: b.article?.over_unverified ? null : b.over30k,
      under: `${b.under30k}円${b.article?.fee_note || ''}`,
      over: b.article?.over_unverified ? '未確認' : `${b.over30k}円${b.article?.fee_note || ''}`,
      // ★2026-10-08（UI/UX 回帰 所見5）: 料金の条件（fee_note）は 3万円未満・以上の両方に同じ文だったため、
      //   金額セルに入れると同じ注記が1行に2回出て表が縦に伸びた。条件は区分名のセルに1回だけ書き、
      //   金額セルは金額だけにする。under/over（照合用の文字列）は「金額＋条件」のまま変えない
      //   （tests/test_fee_article・test_furikomi_bank_sections が区分名セルの注記を足して照合する）。
      nameHTML: `${b.name}${b.article?.fee_note ? '<span class="cell-note">' + esc(b.article.fee_note) + '</span>' : ''}`,
      underHTML: `${b.under30k}円`,
      overHTML: b.article?.over_unverified ? '未確認' : `${b.over30k}円`,
      // ★2026-10-15: 逆引きの区分名は「名前【条件】」を fee_note から作る（手で2か所に書かない）
      indexName: b.article?.index_name || (b.article?.fee_note ? `${b.name}【${b.article.fee_note}】` : b.name),
      // ★2026-10-15: 公式資料で掲載額を確認できていない行。表の「区分」欄・逆引き・計算機の選択肢で未確認と分かるようにする
      unverified: Boolean(b.article?.unverified),
      // ★2026-10-15: 同じ行の別プラン（三井住友 Web21＜ライト＞）。30区分の外だが、逆引きでは金額から引けるようにする
      variants: Array.isArray(b.article?.variants) ? b.article.variants : [],
      sourceLabel: b.article?.source_label || null,
      indexFullLabel: b.article?.index_full_label || false,
      boundary: b.article?.over_unverified ? null : b.under30k !== b.over30k,
      source: b.article?.source_available === false ? null : (b.source || null),
      verifiedAt: b.verified_date || null,
      publicNote: b.article?.public_note || b.public_note || null,
      omitRatio: Boolean(b.article?.omit_ratio),
      comparisonSubject: b.article?.comparison_subject || null,
      comparisonAmounts: b.article?.comparison_amounts || null,
      scoped: Boolean(b.scope_note),
      sourceNote: b.article?.source_note || null,
    };
  });
  if (rows.length !== 30) throw new Error(`30区分のはずが ${rows.length} 行でした（fee_table.json の構造が変わった可能性）`);
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
  'フィンサーバンク': 'finswer-bank', 'ラクスルバンク': 'raksul-bank',
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
  const bankPages = eligiblePages();
  const banks = new Map();
  for (const r of rows) {
    const b = baseName(r.name);
    if (!banks.has(b)) banks.set(b, []);
    banks.get(b).push(r);
  }
  // 並び順: まず法人口座がある銀行を法人の3万円以上の安い順、次に個人のみの銀行を個人の安い順。
  // ★個人と法人は価格帯が別物（同じ三菱UFJでも220円と660円）なので、混ぜて1本のキーで並べない。
  const rank = ([, v]) => {
    const h = v.find((x) => x.kubun === '法人');
    return h ? [0, h.rawOver ?? Infinity] : [1, v[0].rawOver ?? Infinity];
  };
  const sorted = [...banks.entries()].sort((a, b) => {
    const [ga, pa] = rank(a); const [gb, pb] = rank(b);
    return ga - gb || pa - pb;
  });

  const out = [];
  out.push(START);
  out.push('  <h2 id="ginkobetsu">銀行別の振込手数料（他行宛）</h2>');
  out.push('  <p>上の一覧を銀行ごとに並べ替えたものです。<b>数字は上の一覧と同一の調査結果に基づいています</b>ので食い違いません。個人と法人の両方がある銀行は並べて示します。倍率は、掲載サービスの他行宛ネット振込の3万円以上を比較しています。無料・別料金の宛先と優遇を除く通常単価です。出典欄には参照した資料の取得日、または未確認の表示を付けています。</p>');
  for (const [base, list] of sorted) {
    const kojin = list.find((x) => x.kubun === '個人');
    const hojin = list.find((x) => x.kubun === '法人');
    out.push(`  <h3 id="${bankId(base)}">${base}の振込手数料</h3>`);
    const page = bankPages.find(b => b.name === base);
    if (page) out.push(`  <p class="bank-note"><a href="/column/${page.slug}/">${base}の同行宛て・他行宛て、境界と印刷用の表</a></p>`);
    out.push(`  <table><caption>${base}の他行宛ネット振込・通常料金（無料回数・会員優遇なし）</caption>`);
    out.push('    <tr><th scope="col">区分</th><th scope="col">3万円未満</th><th scope="col">3万円以上</th></tr>');
    for (const r of [kojin, hojin]) {
      if (!r) continue;
      out.push(`    <tr><td>${r.nameHTML}</td><td>${r.underHTML}</td><td>${r.overHTML}</td></tr>`);
    }
    out.push('  </table>');

    const notes = [];
    if (base === '福岡銀行' && !list.some(x => x.omitRatio) && kojin && hojin && kojin.rawOver !== null && hojin.rawOver !== null && kojin.rawOver !== hojin.rawOver) {
      const ratio = (hojin.rawOver / kojin.rawOver).toFixed(1).replace(/\.0$/, '');
      notes.push(`法人は個人の<b>${Number(ratio) === hojin.rawOver / kojin.rawOver ? "" : "約"}${ratio}倍</b>（${kojin.rawOver}円→${hojin.rawOver}円）。比較条件はこの節の冒頭と上表を参照`);
    }
    const withBoundary = list.filter((x) => x.boundary).map((x) => x.kubun);
    notes.push(list.every((x) => x.unverified)
      // ★2026-10-15: 未確認の額について「定額」と断定しない（3モデルレビュー #7）
      ? `${base}の掲載額は、公式資料で確認できていません。利用前に公式の料金ページをご確認ください`
      : withBoundary.length
      ? base === "みずほ銀行" ? `<b>3万円の境界あり</b>（${withBoundary.join('・')}）` : `<b>${base === "楽天銀行" ? "楽天銀行の法人の基本振込（給与・賞与・総合振込を除く）は、通常の他行宛振込に3万円の境界あり" : `${base}の上表に掲載したサービスの通常の他行宛振込は3万円の境界あり`}</b>（${withBoundary.join('・')}${base === "楽天銀行" ? "" : base === "横浜銀行" ? "。再振込を除く" : ""}）`
      // ★区分名を文に入れる: 「金額にかかわらず定額。」だけだと、どの銀行の話か文単体で読めず、照合で10銀行ぶんが同じ文になった。
      : `${base}のこの表の料金は、金額にかかわらず<b>定額</b>`);
    out.push(`  <p>${notes.join('。')}。</p>`);
    for (const note of [...new Set(list.filter((x) => x.publicNote).map((x) => x.publicNote))]) {
      out.push(`  <p class="bank-note">${esc(note).replace("かかり、スタンダードから", "かかります。スタンダードから")}。</p>`);
    }

    const presetLabels = {"mizuho-eb": "みずほ銀行の法人手数料で、先方負担の差引額を計算する", "mufg-bizstation": "BizSTATIONの手数料で、先方負担の差引額を計算する", "smbc-web21-standard": "Web21の掲載プランの手数料で、先方負担の差引額を計算する"};
    if (hojin && presetLabels[hojin.id]) {
      out.push(`  <p class="workflow-next" data-workflow-slot="bank_preset_v1"><a href="/senpou-futan/#bank=${hojin.id}">${presetLabels[hojin.id]}</a></p>`);
    }

    // ★出典は行ごとに出す。未照合の行は「未照合」と書く（黙って伏せない）
    const srcs = [...new Set(list.filter((x) => x.source).map((x) => x.source))];
    if (srcs.length) {
      // ★2026-10-15（3モデルレビュー #9）: リンクの文言が全部「公式ページ」で、どれが何の資料か読めなかった。
      //   行の source_label か、個人／法人の別から資料名を付ける（同じURLを個人・法人で共有するなら両方の料金）。
      const label = (u) => {
        const owners = list.filter((x) => x.source === u);
        const own = owners.find((x) => x.sourceLabel)?.sourceLabel;
        if (own) return own;
        const kinds = [...new Set(owners.map((x) => x.kubun))];
        return kinds.length > 1 ? '振込手数料（個人・法人）' : `${kinds[0]}の振込手数料`;
      };
      const links = srcs.map((u) => `<a href="${u}" rel="nofollow">${base}「${esc(label(u))}」</a>`).join('・');
      out.push(`  <p class="src">出典: ${links}（${esc(list.find(r => r.sourceNote)?.sourceNote || "確認範囲は調査方法と出典をご参照ください")}）</p>`);
    } else {
      // ★2026-08-14: 文言を読者向けに直した。旧文「★この行はまだ一次情報での再照合が
      //   済んでいません（表全体の確認日のみ）。」は**編集メモがそのまま公開に出ていた**もので、
      //   表示5,773のサイト看板ページで読者には工事中に見える。
      //   ★「黙って伏せない」という設計は正しいので残す。伝え方だけを変える。
      out.push('  <p class="src">現在、各行の公式ページで個別に確認できていません。取得済み資料の確認範囲は<a href="#shutten">調査方法と出典</a>をご参照ください。</p>');
    }
  }
  out.push('  <p>金額の出典と調査日は<a href="#shutten">調査方法と出典</a>に、境界の仕組みは<a href="#kyoukai">「3万円の境界」を確認できた11区分</a>に書いています。</p>');
  out.push(END);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// 冒頭の比較表（個人・法人）
// ★2026-10-15: 以前は手管理で、test_fee_article が JSON との一致を見ていた。3モデルレビューで
//   セルの条件文の書き換えが14行に及んだので、同じ正本から生成する（手で2か所を同期しない）。
// ---------------------------------------------------------------------------
export const tableMarkers = (kubun) => [
  `<!-- FEE_TABLE_${kubun === '個人' ? 'KOJIN' : 'HOJIN'}:START 自動生成。手で編集しない。tools/gen_bank_sections.mjs -->`,
  `<!-- FEE_TABLE_${kubun === '個人' ? 'KOJIN' : 'HOJIN'}:END -->`,
];
export function buildFeeTable(rows, kubun) {
  const [s, e] = tableMarkers(kubun);
  const list = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.kubun === kubun)
    .sort((a, b) => a.r.rawOver - b.r.rawOver || a.r.rawUnder - b.r.rawUnder || a.i - b.i).map(({ r }) => r);
  const out = [s];
  out.push('  <div class="fee-scroll" tabindex="0" role="region" aria-label="銀行別振込手数料の比較表"><table class="fee-table">');
  out.push('    <thead><tr><th scope="col">銀行・サービス</th><th scope="col" class="num">3万円未満</th><th scope="col" class="num">3万円以上</th><th scope="col">区分</th></tr></thead>');
  out.push('    <tbody>');
  for (const r of list) {
    const link = `<a href="#${bankId(baseName(r.name))}">${r.name}</a>`;
    const note = r.nameHTML.slice(r.name.length);
    const kind = r.unverified ? '<td class="flat">未確認</td>' : r.boundary ? '<td class="step">境界あり</td>' : '<td class="flat">定額</td>';
    out.push(`    <tr><td>${link}${note}</td><td class="num">${r.underHTML}</td><td class="num">${r.overHTML}</td>${kind}</tr>`);
  }
  out.push('    </tbody>');
  out.push('  </table></div>');
  out.push(e);
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
  const m = new Map();
  const add = (v, name, range, fullLabel = false) => {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} の金額を数値にできません（fee_table.json が壊れている）`);
    if (!m.has(v)) m.set(v, []);
    m.get(v).push({ name, range, fullLabel });
  };
  for (const r of rows) {
    // ★2026-10-15（sol 1周目 medium）: 未確認の行に「金額不問」と料金体系を断定しない
    if (r.unverified) add(r.rawUnder, r.indexName, '金額区分も未確認');
    else if (r.rawOver === null) add(r.rawUnder, r.indexName, '3万円未満');
    else if (!r.boundary) add(r.rawUnder, r.indexName, '金額不問', r.indexFullLabel);
    else { add(r.rawUnder, r.indexName, '3万円未満'); add(r.rawOver, r.indexName, '3万円以上'); }
    // 同じ行の別プラン（30区分の外）。名前に条件を付けて、どの契約の額かを読めるようにする
    for (const v of r.variants) {
      const vname = `${v.label}【${v.cond}。30区分の外】`;
      if (v.under30k === v.over30k) add(v.under30k, vname, '金額不問');
      else { add(v.under30k, vname, '3万円未満'); add(v.over30k, vname, '3万円以上'); }
    }
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
 *   「他行宛30区分」という前提を黙って踏み越える。**答えないことを画面に書く。**
 */
export function buildAmountIndex(rows) {
  const m = amountMap(rows);
  const out = [];
  out.push(AMT_START);
  out.push('  <h2 id="gyakubiki">この金額はどこの銀行？（金額から逆引き）</h2>');
  out.push('  <p>通帳や請求書で見た手数料の金額から、その金額になる銀行を引く表です。<b>上の一覧と同じ調査結果を金額の順に並べ替えています</b>ので、金額が食い違うことはありません。「3万円未満／以上で同じ額」の区分は「金額不問」と書いています。</p>');
  out.push('  <table><caption>他行宛ネット振込の通常料金。無料回数・会員優遇を適用しない比較です。ゆうちょは取引時確認済み口座の居住者間送金に限定し、法人は通常振込のみです。ドコモSMTBの個人はBaaS・提携サービスを除きます。auじぶんは三菱UFJ銀行あて、PayPayの個人は三井住友銀行の同一カナ名義の本人口座あてを除きます。フィンサーバンクは株式会社・有限会社・合同会社が対象です。</caption>');
  // 長い表は見出し行を thead に入れる（印刷で各ページに見出しを繰り返す。tests/test_long_table_thead.mjs）
  out.push('    <thead><tr><th scope="col">振込手数料</th><th scope="col">この金額になる区分</th><th scope="col">条件</th></tr></thead>');
  out.push('    <tbody>');
  for (const [amount, list] of m) {
    // 銀行ごとに行を分け、条件は独立した列に置く。
    const entries = list.map(x => { const match = x.name.match(/^(.*?)【(.*?)】(.*)$/); return {x, name: match ? match[1] + match[3] : x.name, note: match ? match[2] : ''}; });
    // 金額は行の見出し（th scope="row"）。データのセルではない
    const reviewContext = ' data-review-context="row"';
    for (const {x, name, note} of entries) out.push(`    <tr><th scope="row"${reviewContext}><b>${amount}円</b></th><td>${name}${x.fullLabel ? "" : `（${x.range}）`}</td><td>${note || "—"}</td></tr>`);
  }
  out.push('    </tbody>');
  out.push('  </table>');
  out.push('  <p class="note">この表が扱うのは<b>他行宛・30区分</b>（と三井住友銀行のWeb21＜ライト＞）だけです。<b>【掲載額は公式資料で未確認】</b>と付けた区分は、公式資料で額を確認できていません。ここに無い金額は、同行宛・ATM・窓口経由・優遇適用後の料金や、振込以外の手数料など、<b>この一覧が調べていない条件</b>の可能性があります。主要5行については<a href="#keiro">窓口・ATM・同じ銀行あての実額</a>を別に載せています。それでも合わない場合はこの表に当てはめず、通帳の摘要欄や銀行の料金ページでご確認ください。</p>');
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

    for (const k of ['個人', '法人']) {
      const [s, e] = tableMarkers(k);
      if (!html.includes(s)) throw new Error(`比較表の生成区間（${s}）が記事にありません`);
      html = put(html, s, e, buildFeeTable(rows, k), null);
    }
    // 銀行別は「法人は銀行選びで年6万円変わる」の直前（＝比較表の直後）
    html = put(html, START, END, section, '  <h2 id="gap">');
    // 逆引きは銀行別のさらに前。銀行名が分からない人向けなので、銀行別より先に置く
    html = put(html, AMT_START, AMT_END, amountIndex, START);

    writeFileSync(ARTICLE, html);
    console.log(`銀行別セクション ${(section.match(/<h3 /g) || []).length}見出し / 逆引き ${(amountIndex.match(/<tr><th scope="row"><b>/g) || []).length}金額 を書き込みました`);
  }
}
