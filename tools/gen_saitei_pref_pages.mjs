/** 県別の事実・改定境界・月給例を正本から生成する。共通制度説明は親ページへ。
 * node tools/gen_saitei_pref_pages.mjs [--check]
 * 金額・年度・確認日の出所を増やさない。routing はURL・近隣だけを持つ。
 * 後段の組版・共通ナビ生成器と共存し、表示内容とリンクが同じなら再生成しない。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { buildHeader } from './gen_nav.mjs';
import { siteLinks, COPY } from './gen_site_footer.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ROUTES = JSON.parse(readFileSync(join(ROOT, 'tools/saitei_pref_pages.json'), 'utf8')).prefectures;
const D = JSON.parse(readFileSync(join(ROOT, 'docs/assets/saitei_chingin_r08.json'), 'utf8'));
const CHECK = process.argv.includes('--check');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const yen = n => n.toLocaleString('ja-JP') + '円';
const date = s => s.split('-').map(Number).map((n,i) => n + ['年','月','日'][i]).join('');
const monthday = s => s.split('-').slice(1).map(Number).map((n,i) => n + ['月','日'][i]).join('');
const prevDay = s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10); };
const row = name => D.prefectures.find(p => p.pref === name);
const SOURCE = `<a href="${esc(D._meta.source_pdf)}">厚生労働省の全国一覧（${esc(D._meta.year)}）</a>`;
const REGULATION = 'https://laws.e-gov.go.jp/law/334M50002000016';

export function prefContent(p) {
  const m = D._meta, r = ROUTES[p.pref], before = prevDay(p.effective), current = m.checked < p.effective ? p.prev : p.wage;
  const boundary = [[`${date(before)}まで`, p.prev], [`${date(p.effective)}から`, p.wage]];
  const monthly = [160,173,180].map(h => `<tr><th scope="row">${h}時間</th><td class="num">${yen(p.prev*h)}</td><td class="num">${yen(p.wage*h)}</td><td class="num">${yen(p.up*h)}</td></tr>`).join('\n');
  const near = r.neighbors.map(name => {
    const n = row(name);
    return `<tr><th scope="row"><a href="../${ROUTES[name].slug}/">${esc(n.full)}</a></th><td class="num">${yen(n.wage)}</td><td>${esc(n.effective_wa)}</td></tr>`;
  }).join('\n');
  return `<h1>${esc(p.full)}の最低賃金｜時間額・発効日・月給換算</h1>
<p class="article-meta">確認日: <time datetime="${m.checked}">${date(m.checked)}</time>　対象: ${esc(m.year)}</p>
<p class="byline">文責: <a href="../../about/">Masahiro Yasu</a>（経理実務者）</p>
<p id="pref-lead">${esc(p.full)}の${esc(m.year)}の地域別最低賃金は、<b>${monthday(p.effective)}から時間額${yen(p.wage)}</b>です。発効日は${esc(p.effective_wa)}です。</p>
<p id="pref-current">${date(m.checked)}の確認日時点で有効な${esc(p.full)}の地域別最低賃金は、時間額<b>${yen(current)}</b>です。</p>
<p id="pref-delta">${esc(p.full)}の${esc(m.year)}の改定は、改定前の時間額${yen(p.prev)}から<b>${yen(p.up)}の引上げ（${p.rate}%）</b>です。${SOURCE}に掲載されています。</p>
<p class="saitei-actions"><a class="tool-cta" id="pref-calculator" href="../?pref=${encodeURIComponent(p.pref)}#calculator">${esc(p.full)}を選んで時給・月給を比較する</a><button type="button" id="pref-print">この県の表を印刷</button></p>
<h2 id="boundary">${esc(p.full)}の改定前・改定後の境界</h2>
<p>地域別最低賃金の時間額は発効日を境に切り替わります。${esc(p.full)}の${esc(m.year)}の改定をまたぐ期間は、次の区分で確認してください。出典: ${SOURCE}。</p>
<div class="scroll-wrap"><table id="pref-boundary"><thead><tr><th scope="col">適用する期間</th><th scope="col">地域別最低賃金の時間額</th></tr></thead><tbody>
${boundary.map(([label,wage]) => `<tr><th scope="row">${label}</th><td class="num">${yen(wage)}</td></tr>`).join('\n')}
</tbody></table></div>
<p><a href="${esc(r.bureau_url)}">${esc(p.pref)}労働局の最低賃金資料</a>で、特定（産業別）最低賃金も確認できます。地域別と特定最低賃金の両方が適用される場合は、高い方を使います。減額特例の許可を受けている場合は許可内容を確認してください。<a href="../#tool-section-3">適用範囲の説明</a>。</p>
<h2 id="monthly">${esc(p.full)}の最低賃金を月給に換算する例</h2>
<p id="monthly-assumption">${esc(p.full)}の${esc(m.year)}の地域別最低賃金を、月の所定労働時間が一定の場合の月給に換算した例です。時間が月によって違う場合は、年間の月平均所定労働時間で換算します。賞与や対象外の手当を含む総支給額とは区別してください。</p>
<p>表の月給額 ＝ 地域別最低賃金の時間額 × 月の所定労働時間。換算の根拠は<a href="${REGULATION}">最低賃金法施行規則の月給の換算規定</a>、時間額と発効日の出典は${SOURCE}です。</p>
<div class="scroll-wrap"><table id="pref-monthly"><caption>${esc(p.full)}・${esc(m.year)}の地域別最低賃金による月給換算例</caption><thead><tr><th scope="col">月の所定労働時間</th><th scope="col">${date(before)}まで</th><th scope="col">${date(p.effective)}から</th><th scope="col">引上げ額</th></tr></thead><tbody>
${monthly}
</tbody></table></div>
<p><a id="pref-monthly-calculator" href="../?pref=${encodeURIComponent(p.pref)}&amp;wage_type=monthly#calculator">年間所定労働日数・一日の所定労働時間を入力して比較する</a>。<a href="../#monthly-conversion">所定時間の換算方法</a>も親ページにあります。</p>
<h3 id="excluded">最低賃金に含めない賃金の確認</h3>
<p id="pref-exclusions">臨時に支払われる賃金、一か月を超える期間ごとの賃金、所定時間を超える労働への賃金、所定休日の労働への賃金、深夜労働の通常賃金を超える部分、精皆勤手当、通勤手当、家族手当は除きます。</p>
<p><a href="../#sannyu">対象外の賃金の詳しい列挙と固定残業代の扱い</a>は親ページで確認できます。根拠: <a href="https://laws.e-gov.go.jp/law/334AC0000000137">最低賃金法</a>・<a href="${REGULATION}">同法施行規則</a>・<a href="https://saiteichingin.mhlw.go.jp/point/page_point_targetwages.html">厚生労働省「最低賃金の対象となる賃金」</a>。</p>
<h2 id="nearby">近隣の都道府県の改定額・発効日</h2>
<p>次は${esc(m.year)}の地域別最低賃金の改定額です。発効前の県の現行額は、リンク先の県ページで確認できます。近隣には海を挟んだ県を含みます。出典: ${SOURCE}。</p>
<div class="scroll-wrap"><table id="pref-nearby"><thead><tr><th scope="col">都道府県</th><th scope="col">改定後の時間額</th><th scope="col">発効日</th></tr></thead><tbody>
${near}
</tbody></table></div>
<p><a href="../#ichiran">全国の最低賃金一覧・共通の説明へ戻る</a></p>
<h2 id="sources">出典</h2>
<ul id="pref-sources"><li>${SOURCE}：${esc(p.full)}の時間額、改定前額、前年差、引上げ率、発効日。確認日: ${date(m.checked)}。</li>
<li><a href="${esc(r.bureau_url)}">${esc(p.pref)}労働局「最低賃金」</a>：地域別・特定最低賃金の案内。確認日: ${date(r.bureau_checked)}。</li>
<li><a href="${REGULATION}">e-Gov法令検索「最低賃金法施行規則」</a>：算入しない賃金・月給の時間額換算。<a href="https://laws.e-gov.go.jp/law/334AC0000000137">最低賃金法</a>、<a href="https://saiteichingin.mhlw.go.jp/point/page_point_targetwages.html">厚生労働省「最低賃金の対象となる賃金」</a>、<a href="https://saiteichingin.mhlw.go.jp/point/page_point_class.html">厚生労働省「最低賃金の種類」</a>、<a href="https://saiteichingin.mhlw.go.jp/point/page_point_target.html">厚生労働省「最低賃金の適用される労働者の範囲」</a>。</li></ul>
<p>このページは一般的な情報提供であり、個別の労務相談への回答ではありません。実際の適用は労働局・労働基準監督署などに確認してください。</p>`;
}

function titleOf(p) { return `${p.full}の最低賃金【${D._meta.year}】時間額・発効日・月給換算`; }
function descOf(p) { return `${p.full}の${D._meta.year}の地域別最低賃金は${p.effective_wa}から時間額${yen(p.wage)}。改定前${yen(p.prev)}との境界、前年差${yen(p.up)}、所定労働時間別の月給換算例と${p.pref}労働局の一次資料を掲載。確認日${date(D._meta.checked)}。`; }
function freshHtml(p) {
  const path = `saitei-chingin/${ROUTES[p.pref].slug}`, url = `https://keiri-tools.com/${path}/`;
  const schema = {'@context':'https://schema.org','@graph':[{'@type':'WebPage',name:titleOf(p),url,dateModified:D._meta.checked,author:{'@type':'Person',name:'Masahiro Yasu',url:'https://keiri-tools.com/about/'}},{'@type':'BreadcrumbList',itemListElement:[['ホーム','https://keiri-tools.com/'],['最低賃金一覧','https://keiri-tools.com/saitei-chingin/'],[p.full,url]].map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))}]};
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titleOf(p))}</title><meta name="description" content="${esc(descOf(p))}">
<link rel="stylesheet" href="../../assets/style.css"><link rel="stylesheet" href="../../assets/saitei_pref.css"><link rel="canonical" href="${url}">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-E742DSDHPD"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-E742DSDHPD');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2635067516563578" crossorigin="anonymous"></script>
<script id="saitei-pref-schema" type="application/ld+json">${JSON.stringify(schema,null,2)}</script></head>
<body class="saitei-pref-page">${buildHeader(path)}<main><nav class="breadcrumb"><a href="../../">ホーム</a> › <a href="../">最低賃金一覧</a> › ${esc(p.full)}</nav>
<article id="pref-content" data-generated-from="../../assets/saitei_chingin_r08.json"><!--saitei-pref:S-->${prefContent(p)}<!--saitei-pref:E--></article></main>
<footer class="site">${COPY}${siteLinks(2)}</footer><script src="../../assets/saitei_pref.js" defer></script><script src="../../assets/track.js" defer></script></body></html>\n`;
}

// 組版は後段が担当する。テキストと目的地を照合し、装飾spanの有無では差分にしない。
function contentSignature(html) {
  const dom = new JSDOM(html), el = dom.window.document.querySelector('#pref-content');
  if (!el) { dom.window.close(); return null; }
  for (const n of el.querySelectorAll('nav,aside,.side-rail,.rail-next,.x-share')) n.remove();
  const value = JSON.stringify({text:el.textContent.replace(/\s+/g,''), ids:[...el.querySelectorAll('[id]')].map(e=>[e.id,e.localName]), links:[...el.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.textContent.replace(/\s+/g,'')])});
  dom.window.close(); return value;
}
function sync(p) {
  const dir = join(ROOT, 'docs/saitei-chingin', ROUTES[p.pref].slug), file = join(dir,'index.html'), wanted = freshHtml(p);
  if (!existsSync(file)) { if (CHECK) throw Error(`未生成: ${file}`); mkdirSync(dir,{recursive:true}); writeFileSync(file,wanted); return; }
  const before = readFileSync(file,'utf8');
  let after = before.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(titleOf(p))}</title>`)
    .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(descOf(p))}">`);
  after = after.replace(/<article id="pref-content"[^>]*>/, '<article id="pref-content" data-generated-from="../../assets/saitei_chingin_r08.json">');
  const schema = wanted.match(/<script id="saitei-pref-schema" type="application\/ld\+json">[\s\S]*?<\/script>/)[0];
  after = after.replace(/<script(?: id="saitei-pref-schema")? type="application\/ld\+json">[\s\S]*?<\/script>/,schema);
  if (!after.includes('<script src="../../assets/track.js"')) after = after.replace('</body>','<script src="../../assets/track.js" defer></script></body>');
  if (contentSignature(before) !== contentSignature(wanted)) after = after.replace(/<!--saitei-pref:S-->[\s\S]*?<!--saitei-pref:E-->/,`<!--saitei-pref:S-->${prefContent(p)}<!--saitei-pref:E-->`);
  if (after !== before) { if (CHECK) throw Error(`データと県ページが不一致: ${file}`); writeFileSync(file,after); }
}
export function generate() {
  if (D._meta.status !== 'confirmed' || D.prefectures.length !== 47 || Object.keys(ROUTES).length !== 47) throw Error('照合済みの47県が必要です');
  for (const p of D.prefectures) {
    const r = ROUTES[p.pref];
    if (!r || p.wage-p.prev !== p.up || !r.neighbors.length || r.neighbors.some(n=>!ROUTES[n]) || !r.bureau_url.startsWith(`https://jsite.mhlw.go.jp/${r.slug}-roudoukyoku/`)) throw Error(`データ・県名・労働局リンクが不正: ${p.pref}`);
    sync(p);
  }
  console.log(`✓ 最低賃金の県ページ47件${CHECK?'を照合':'を生成'}（${D._meta.year}・${D._meta.checked}確認）`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) generate();
