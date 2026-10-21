#!/usr/bin/env node
/** Bank landing pages. Other-bank amounts/dates/scope come only from fee_table.
 * Same-bank amounts absent from fee_table live in the curl-verified companion.
 * Add another verified bank to bank_fee_page_data.json to use the same renderer.
 * Marked content belongs to this generator; shared layout/navigation belongs to
 * the existing publishing generators. --check compares both text and structure,
 * ignoring only numeric/FAQ presentation wrappers introduced by those generators.
 */
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {buildHeader} from './gen_nav.mjs';
import {siteLinks} from './gen_site_footer.mjs';
import {JSDOM} from 'jsdom';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = path => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
export const pageData = () => readJSON('tools/bank_fee_page_data.json');
export const feeData = () => readJSON('docs/assets/fee_table.json');
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const yen = n => `${n.toLocaleString('ja-JP')}円`;
const band = data => `${data.threshold / 10000}万円`;
const mark = (id, html) => `<!--bank-page:${id}:S-->\n${html}\n<!--bank-page:${id}:E-->`;
export function eligiblePages(fees = feeData(), data = pageData()) {
  if(data.threshold!==30000)throw Error('fee_tableのunder30k/over30kは3万円の区分です');
  return data.banks.filter(b => b.status === 'verified').flatMap(b => {
    if (b.direct_fee_limit && (![b.direct_fee_limit.min,b.direct_fee_limit.max].every(n=>Number.isSafeInteger(n)&&n>=0)
      || b.direct_fee_limit.min>b.direct_fee_limit.max || !b.direct_fee_limit.source)) throw Error(`${b.name}: invalid fee limit`);
    const rows = fees.banks.filter(r => r.name.replace(/（.*$/, '') === b.name && r.source && /^\d{4}-\d{2}-\d{2}$/.test(r.verified_date || '') && !r.article?.over_unverified && !/未確認/.test(r.article?.source_note || ''));
    // A page must complete both customer types, with verified same-bank data.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.supplement_checked || '')) return [];
    if (!rows.some(r => /（個人/.test(r.name)) || !rows.some(r => /（法人/.test(r.name))) return [];
    if (rows.some(r => !b.rows.find(s => s.name === r.name)?.same?.length)) return [];
    if (rows.some(r => ![r.under30k,r.over30k].every(n=>Number.isSafeInteger(n)&&n>=0)
      || b.rows.find(s=>s.name===r.name).same.some(s=>![s.under30k,s.over30k].every(n=>Number.isSafeInteger(n)&&n>=0)))) throw Error(`${b.name}: invalid fee`);
    return [{...b, rows: rows.map(r => ({...r, details: b.rows.find(s => s.name === r.name)}))}];
  });
}
function conditionParagraphs(r) {
  const note = r.public_note || r.scope_note || r.article?.fee_note;
  if (!r.details.separate_contract_conditions) return note.split(/。/).filter(Boolean).map(s=>`${r.name}：${s}。`);
  // 条件文の料金もfee_tableを正本にする。補助データへ金額を複写しない。
  const payroll = note.match(/給与振込([\d,]+)円/);
  const standard = note.match(/スタンダードプランは契約([\d,]+)円・月額([\d,]+)円/);
  const expert = note.match(/エキスパートプランは契約([\d,]+)円・月額([\d,]+)円/);
  const change = note.match(/契約料金は差額([\d,]+)円/);
  if (!payroll || !standard || !expert || !change || r.under30k !== r.over30k
    || !note.includes('総合・給与振込は依頼データ件数で課金し、不成立分も課金')
    || !note.includes('非居住者関連の送金はゆうちょBizダイレクトでは取扱なし')
    || !note.includes('契約法人ID単位')) throw Error(`${r.name}: invalid fee conditions`);
  const amounts = [payroll[1],...standard.slice(1),...expert.slice(1),change[1]].map(s=>Number(s.replaceAll(',','')));
  if (!amounts.every(n=>Number.isSafeInteger(n)&&n>=0)) throw Error(`${r.name}: invalid fee conditions`);
  const [salary,standardContract,standardMonthly,expertContract,expertMonthly,changeContract] = amounts;
  return [
    `${r.name}の他金融機関宛ては、通常振込・総合振込が${yen(r.under30k)}、給与振込が${yen(salary)}です。`,
    `${r.name}の総合振込・給与振込は依頼データ件数で課金し、不成立分も課金します。非居住者関連の送金は取り扱いません。`,
    `${r.name}の新規契約では、契約法人ID単位でスタンダードプランに契約料金${yen(standardContract)}・月額料金${yen(standardMonthly)}がかかります。`,
    `${r.name}の新規契約では、契約法人ID単位でエキスパートプランに契約料金${yen(expertContract)}・月額料金${yen(expertMonthly)}がかかります。`,
    `${r.name}のスタンダードプランからエキスパートプランへの変更では、契約料金の差額${yen(changeContract)}がかかります。`,
  ];
}
const sourceLink = (r, date = r.verified_date) => `<a href="${esc(r.source)}" target="_blank" rel="noopener">公式料金</a><br><time class="numeric-token" datetime="${date}">${date}</time>`;
const table = (id, caption, rows, data) => `<div class="scroll-wrap"><table id="${id}"><caption>${caption}</caption><thead><tr><th scope="col">対象サービス・条件</th><th scope="col" class="num">${band(data)}未満</th><th scope="col" class="num">${band(data)}以上</th><th scope="col">出典・確認日</th></tr></thead><tbody>\n${rows.join('\n')}\n</tbody></table></div>`;
export function renderPage(bank, data = pageData()) {
  const b = band(data), threshold = data.threshold;
  const title = `${bank.name}の振込手数料｜個人・法人、他行宛て・同行宛て`;
  const desc = `${bank.name}のネット振込手数料を個人と法人に分けて掲載。他行宛てと同行宛ての税込料金、振込金額の境界、優遇や別サービスの違いを公式ページと確認日つきで確認できます。表の印刷と先方負担の差引計算にも対応。`;
  const canonical = `https://keiri-tools.com/column/${bank.slug}/`;
  const qaScope=[...new Set([bank.name,...(bank.aliases || [])])].join('|');
  const rows = bank.rows;
  const other = table('other-fees', `${bank.name}の他行宛てネット振込手数料（税込・優遇適用前）`, rows.map((r,i)=>`<tr data-fee-row="${i}"><td>${esc(r.name)}<span class="cell-note">${esc(r.scope_note || r.article?.fee_note || '')}</span></td><td class="num">${yen(r.under30k)}</td><td class="num">${yen(r.over30k)}</td><td>${sourceLink(r)}</td></tr>`), data);
  const same = table('same-fees', `${bank.name}の同行宛てネット振込・振替手数料（税込）`, rows.flatMap((r,i)=>r.details.same.map((s,j)=>`<tr data-same-row="${i}-${j}"><td>${esc(s.label)}<span class="cell-note">${esc(s.note)}</span></td><td class="num">${yen(s.under30k)}</td><td class="num">${yen(s.over30k)}</td><td>${sourceLink(r, bank.supplement_checked)}</td></tr>`)), data);
  const amounts = [threshold-1, threshold, threshold+1];
  const boundary = `<div class="scroll-wrap"><table id="boundary-fees"><caption>${bank.name}の他行宛てネット振込・境界前後の税込料金（上の他行宛て表と同じ対象・優遇適用前）</caption><thead><tr><th scope="col">サービス</th>${amounts.map(a=>`<th scope="col" class="num">振込額 ${yen(a)}</th>`).join('')}<th scope="col">出典</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-boundary-row="${i}"><td>${esc(r.name)}</td>${amounts.map(a=>`<td class="num">${yen(a < threshold ? r.under30k : r.over30k)}</td>`).join('')}<td>${sourceLink(r)}</td></tr>`).join('\n')}</tbody></table></div>`;
  const directLimit = bank.direct_fee_limit;
  const directNotice = directLimit ? `<p id="direct-fee-limit">個人の${bank.name}・三菱UFJダイレクトの他行宛て振込では、「手数料を含んだ金額」方式は${yen(directLimit.min)}〜${yen(directLimit.max)}（手数料を含む金額）の帯で利用できません。「手数料を含まない金額」方式を選び、振込手数料を含まない金額を指定してください。<a href="${esc(directLimit.source)}">公式の利用条件</a></p>` : '';
  const sections = {
    intro: `${rows.map(r=>`<p>${esc(r.name)}の他行宛てネット振込の通常料金（税込・優遇適用前）は、${r.under30k===r.over30k ? `金額にかかわらず${yen(r.under30k)}` : `${b}未満が${yen(r.under30k)}、${b}以上が${yen(r.over30k)}`}です。<a href="${esc(r.source)}">公式料金</a></p>`).join('\n')}\n<p>ATMや窓口の料金とは別です。無料回数・優遇がある場合は、表の通常料金と実際に適用される料金を分けて確認してください。<a href="../furikomi-tesuryo-hikaku/">複数の銀行を横並びで比較する一覧</a>もあります。</p>\n<nav class="toc"><div class="toc-title">目次</div><ol>${[['other','他行宛て'],['same','同行宛て'],['boundary','振込金額の境界'],['conditions','サービスと優遇の違い'],['print','表の印刷・差引計算'],['faq','よくある質問'],['source','出典']].map(([id,t])=>`<li><a href="#${id}">${t}</a></li>`).join('')}</ol></nav>`,
    other: `<h2 id="other">他行宛ての振込手数料</h2>\n${other}\n<p>確認日は各サービスの料金を確認した日です。掲載したネットサービスの料金を示しています。同行宛て、無料回数、別料金の宛先は区分名の条件と次の表を参照してください。</p>`,
    same: `<h2 id="same">同行宛ての振込・振替手数料</h2>\n${same}\n<p>${esc(bank.same_note)} <a href="${esc(rows[0].source)}">個人の公式料金</a>・<a href="${esc(rows[1].source)}">法人の公式料金</a></p>`,
    boundary: `<h2 id="boundary">${bank.name}のネット振込と${b}の境界</h2>\n<p>${bank.name}の掲載したネット振込で金額による料金区分がある場合、${b}ちょうどの振込は「${b}以上」です。境界の前後を下の表に示します。</p>\n${boundary}\n<p>${rows.map(r=>`${esc(r.name)}の他行宛て通常料金は、${r.under30k === r.over30k ? 'この境界の前後で変わりません' : 'この境界で変わります'}。`).join('')} <a href="${esc(rows[0].source)}">個人の公式料金</a>・<a href="${esc(rows[1].source)}">法人の公式料金</a></p>\n${directNotice}\n<figure class="figure"><svg viewBox="0 0 360 170" role="img" aria-label="ネット振込手数料を確認する順序"><rect x="10" y="10" width="340" height="40" rx="6" fill="none" stroke="currentColor"/><text x="180" y="36" text-anchor="middle" font-size="15" fill="currentColor">個人・法人のサービスを選ぶ</text><path d="M180 50v20m-5-5 5 5 5-5" fill="none" stroke="currentColor"/><rect x="10" y="70" width="340" height="40" rx="6" fill="none" stroke="currentColor"/><text x="180" y="96" text-anchor="middle" font-size="15" fill="currentColor">同行宛て・他行宛てと優遇を確認</text><path d="M180 110v20m-5-5 5 5 5-5" fill="none" stroke="currentColor"/><text x="180" y="154" text-anchor="middle" font-size="15" fill="currentColor">振込金額の区分で料金を見る</text></svg><figcaption>サービス、宛先、優遇、振込金額の順に確認します。</figcaption></figure>`,
    conditions: `<h2 id="conditions">サービスと優遇を取り違えない</h2>\n${rows.map(r=>`<h3>${esc(r.name)}</h3>\n${conditionParagraphs(r).map(s=>`<p>${esc(s)} <a href="${esc(r.source)}">公式料金と条件を確認</a></p>`).join('\n')}`).join('\n')}\n${bank.extra_sources.map(s=>`<p>${esc(bank.name)}の他行宛て振込：${esc(s.quote)} <a href="${esc(s.url)}">${esc(s.title)}</a></p>`).join('\n')}\n${(bank.service_notes || []).map(n=>`<h3>${esc(n.heading)}</h3>\n${n.paragraphs.map(t=>`<p>${esc(t)} <a href="${esc(n.url)}">${esc(n.title)}</a></p>`).join('\n')}${n.table_rows ? `\n<p data-review-context="before-table">${esc(n.table_context)}</p>\n<div class="scroll-wrap"><table><thead><tr><th scope="col">手続き</th><th scope="col">追加手数料（税込）</th></tr></thead><tbody>${n.table_rows.map(([label,fee])=>`<tr><th scope="row">${esc(label)}</th><td>${esc(fee)}</td></tr>`).join('')}</tbody></table></div>\n<p data-review-context="after-table">${esc(n.table_note)}</p>` : ''}`).join('\n')}\n<div class="summary-box"><b>差引計算の前に確認すること</b><p>請求額から手数料を差し引くと、実際の振込額が料金区分の境界をまたぐ場合があります。差引額の決め方は取引先との取り決めで確認し、計算ツールで方式ごとの結果を見比べます。</p></div>`,
    print: `<h2 id="print">料金表を印刷・差引額を計算する</h2>\n<p>印刷すると、料金表、条件、公式ページの出典、確認日を紙やPDFに残せます。印刷前に公式の最新料金と利用するサービスを確認してください。</p>\n<button type="button" id="print-fees">料金表を印刷する</button>\n<a class="tool-cta" href="../../senpou-futan/${rows.find(r=>r.id)?.id ? '#bank='+rows.find(r=>r.id).id : ''}">先方負担の振込手数料・差引額を計算する</a>\n<p>計算ツールでは銀行・サービスを選んで他行宛ての手数料を設定します。同行宛てや優遇後の料金を使う場合は、手数料欄を適用額に合わせます。</p>`,
    faq: `<h2 id="faq">よくある質問</h2>\n<h3>Q. 個人と法人で同じ料金表を使えますか？</h3><p>A. サービスを分けて確認してください。このページでは個人向けネットサービスと法人向けネットサービスを別の行に掲載しています。</p>\n<h3>Q. 無料回数は他行宛ての表に含みますか？</h3><p>A. 他行宛ての表は優遇適用前の通常料金です。無料回数や別料金の宛先は、区分名の条件と公式ページで確認してください。</p>\n<h3>Q. ATMや窓口からの振込にも使えますか？</h3><p>A. このページの表は掲載したネットサービスの料金です。ATM・窓口・電話での取扱いは、銀行の公式料金表の該当欄で確認してください。</p>`,
    related: `<section class="related"><h2>関連記事・ツール</h2><div class="tool-grid"><a class="tool-card" href="../furikomi-tesuryo-hikaku/"><b>銀行別の振込手数料を比較</b><span>他行宛ての料金を横並びで確認</span></a><a class="tool-card" href="../../senpou-futan/"><b>先方負担の差引計算</b><span>差引方式による振込額の違いを確認</span></a><a class="tool-card" href="../senpou-futan-3hoshiki/"><b>差引方式の違い</b><span>境界をまたぐときの考え方</span></a></div></section>`,
    source: `<h2 id="source">出典</h2>\n<p class="source-method">各銀行の公式料金表で確認。料金には消費税が含まれています。</p>\n<ul>${rows.map(r=>`<li><a href="${esc(r.source)}">${esc(r.name)}の公式料金</a>。他行宛て料金の確認日: <time datetime="${r.verified_date}">${r.verified_date}</time>。同行宛て料金の確認日: <time datetime="${bank.supplement_checked}">${bank.supplement_checked}</time>。</li>`).join('\n')}${bank.extra_sources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.title)}</a>。確認日: <time datetime="${bank.supplement_checked}">${bank.supplement_checked}</time>。</li>`).join('\n')}${(bank.service_notes || []).map(n=>`<li><a href="${esc(n.url)}">${esc(n.title)}</a>。確認日: <time datetime="${n.checked}">${n.checked}</time>。</li>`).join('\n')}</ul>\n<p class="disclaimer">本記事は一般的な情報提供を目的としており、個別の相談への回答ではありません。実際の取引は銀行の最新の案内をご確認ください。</p>`
  };
  const graph = {'@context':'https://schema.org','@graph':[{'@type':'Article',headline:title,datePublished:data.published_date,dateModified:data.published_date,author:{'@type':'Person',name:'Masahiro Yasu',url:'https://keiri-tools.com/about/'},publisher:{'@type':'Organization',name:'税金・経理・補助金ツールズ'},mainEntityOfPage:canonical},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'ホーム',item:'https://keiri-tools.com/'},{'@type':'ListItem',position:2,name:'コラム',item:'https://keiri-tools.com/column/'},{'@type':'ListItem',position:3,name:title}]}]};
  const html = `<!DOCTYPE html>\n<html lang="ja"><head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n<meta name="description" content="${esc(desc)}">\n<meta name="qa-required-terms" content="${esc(qaScope)}">\n<link rel="stylesheet" href="../../assets/style.css">\n<link rel="canonical" href="${canonical}">\n<script type="application/ld+json">\n${JSON.stringify(graph,null,2)}\n</script>\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-E742DSDHPD"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-E742DSDHPD');</script>\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2635067516563578" crossorigin="anonymous"></script>\n<script src="../../assets/track.js" defer></script>\n</head><body>\n<!-- generated-by: gen_bank_fee_pages.mjs -->\n<a class="skip-link" href="#main">本文へ移動</a>\n${buildHeader('column/'+bank.slug)}\n<main id="main" tabindex="-1"><nav class="breadcrumb"><a href="../../">ホーム</a> › <a href="../">コラム</a> › ${bank.name}の振込手数料</nav><article>\n<h1>${esc(title)}</h1>\n<p class="article-meta">公開日: <time datetime="${data.published_date}">${data.published_date.replace(/(\d+)-(\d+)-(\d+)/,(_,y,m,d)=>`${y}年${+m}月${+d}日`)}</time></p>\n<p class="byline">文責: <a href="../../about/">Masahiro Yasu</a>（クリニック・EC事業の経営者／経理実務者）</p>\n${Object.entries(sections).map(([id,s])=>mark(id,s)).join('\n')}\n</article></main>\n<footer class="site">${siteLinks(2)}</footer>\n<script>document.getElementById('print-fees').addEventListener('click',()=>window.print());</script>\n</body></html>\n`;
  return {html, sections, title, desc, canonical, qaScope};
}
export function normalizeOwned(s) {
  return s.replace(/<!--next-read:S-->[\s\S]*?<!--next-read:E-->/g,'').replace(/<!--rail-next:S-->[\s\S]*?<!--rail-next:E-->/g,'').replace('<!--rail-next:wrap--><div class="side-rail" data-nav-exp="wrap">','').replace('</div><!--rail-next:wrapE-->','').replace(/<span class="(?:numeric-token|faq-existing-marker)"(?: aria-hidden="true")?>([^<]*)<\/span>/g,'$1').replace(/<(h3|p) class="faq-(?:question|answer)">/g,'<$1>').replace(/\s+/g,' ').trim();
}
export function freshnessErrors(html, rendered) {
  const errors = [];
  for (const [id,want] of Object.entries(rendered.sections)) {
    const re = new RegExp(`<!--bank-page:${id}:S-->([\\s\\S]*?)<!--bank-page:${id}:E-->`,'g');
    const hits = [...html.matchAll(re)];
    if (hits.length !== 1 || normalizeOwned(hits[0][1]) !== normalizeOwned(want)) errors.push(id);
  }
  const d = new JSDOM(html).window.document;
  if (d.title !== rendered.title) errors.push('title');
  if(d.querySelector('h1')?.textContent !== rendered.title) errors.push('h1');
  if(d.querySelector('meta[name="description"]')?.content !== rendered.desc) errors.push('description');
  if(d.querySelector('meta[name="qa-required-terms"]')?.content !== rendered.qaScope)errors.push('qa scope');
  if(d.querySelector('link[rel="canonical"]')?.href !== rendered.canonical) errors.push('canonical');
  const article = [...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>JSON.parse(s.textContent)['@graph'] || []).find(n=>n['@type']==='Article');
  if(article?.headline !== rendered.title || article?.mainEntityOfPage !== rendered.canonical) errors.push('Article');
  if(!html.includes("document.getElementById('print-fees').addEventListener('click',()=>window.print());")) errors.push('print action');
  d.defaultView.close();
  return errors;
}
export function generate({check=false, sourceAudit=null} = {}) {
  const data = pageData();
  if(sourceAudit) for(const bank of data.banks) {
    const reviews=sourceAudit.rows.filter(r=>r.name.startsWith(bank.name+'（'));
    if(!reviews.length || reviews.some(r=>r.status!=='match')) bank.status=reviews.some(r=>r.status==='mismatch')?'mismatch':'unavailable';
  }
  const pages = eligiblePages(feeData(),data), errors=[];
  for(const bank of pages) {
    const path=resolve(ROOT,'docs/column',bank.slug,'index.html'), rendered=renderPage(bank,data);
    if(check) { if(!existsSync(path)||freshnessErrors(readFileSync(path,'utf8'),rendered).length) errors.push(bank.slug); }
    else if(existsSync(path)) {
      // 2026-10-15: 既存ページは自分の印の中だけを差し替える。全体を書き直すと、gen_ogp・gen_x_share・
      //   gen_layout_markup 等が足した OGP・X 共有・レイアウトの部分が消える（pub の生成器の列に gen_ogp/gen_x_share は無い）
      let html=readFileSync(path,'utf8');
      for(const [id,want] of Object.entries(rendered.sections)) {
        const re=new RegExp(`<!--bank-page:${id}:S-->[\\s\\S]*?<!--bank-page:${id}:E-->`,'g');
        if((html.match(re)||[]).length!==1) throw Error(`${bank.slug}: section ${id} の印が1つではない`);
        html=html.replace(re,()=>mark(id,want));
      }
      writeFileSync(path,html);
    }
    else { mkdirSync(dirname(path),{recursive:true});writeFileSync(path,rendered.html); }
  }
  // Revoked/removed verification must not leave an old published page behind.
  for(const slug of readdirSync(resolve(ROOT,'docs/column'))) {
    const path=resolve(ROOT,'docs/column',slug,'index.html');
    if(existsSync(path)&&readFileSync(path,'utf8').includes('<!-- generated-by: gen_bank_fee_pages.mjs -->')&&!pages.some(b=>b.slug===slug)) {
      if(check) errors.push(`ineligible:${slug}`); else unlinkSync(path);
    }
  }
  if(errors.length) throw Error(`銀行ページが古い: ${errors.join(', ')}。node tools/gen_bank_fee_pages.mjs と公開用生成器を実行してください`);
  return pages;
}
if(import.meta.url===pathToFileURL(process.argv[1] || '').href) {
  const check=process.argv.includes('--check');
  let sourceAudit=null;
  if(!check) {
    const auditPath=resolve(ROOT,'reports/bank-pages/source-verification.json');
    if(existsSync(auditPath))unlinkSync(auditPath); // Never reuse yesterday's report after a fetch/layout failure.
    try { execFileSync(process.execPath,[resolve(ROOT,'tools/verify_bank_fee_sources.mjs')],{cwd:ROOT,stdio:'inherit'}); }
    catch(e) { if(e.status!==1)throw e; }
    sourceAudit=readJSON('reports/bank-pages/source-verification.json');
  }
  const pages=generate({check,sourceAudit});
  console.log(`gen_bank_fee_pages: ${pages.length}銀行（${pages.map(b=>b.name).join('・')}）`);
  for(const b of pageData().banks.filter(b=>b.status!=='verified'))console.log(`保留 ${b.name}: ${b.reason}`);
}
