/** 年収別の答えを既存 core から生成。料率固定モデルであり暦年の給与明細の再現ではない。 */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {JSDOM} from 'jsdom';
import {shakaiHokenMonthly} from '../docs/assets/tedori_core.js';
import {KENKO_GRADES} from '../docs/assets/shaho_core.js';
import {calcShotokuzei} from '../docs/assets/shotokuzei_core.js';
import {calc as resident} from '../docs/assets/juminzei_core.js';
import {buildHeader} from './gen_nav.mjs';
import {withLinks} from './gen_favicon_links.mjs';
import {siteLinks,COPY} from './gen_site_footer.mjs';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=n=>JSON.parse(readFileSync(join(ROOT,'docs/assets',n+'_r08.json'),'utf8'));
export const S=read('shaho_rates'), refs={J:read('juminzei'),S:read('setsuzei'),N:read('nencho'),H:read('hikazei_setai'),I:read('iryohi'),K:read('shotokuzei')};
export const demand=JSON.parse(readFileSync(join(ROOT,'tools/tedori_income_demand.json'),'utf8'));
export const incomes=demand.rows.filter(r=>r.google>=1000).map(r=>r.man);
const yen=n=>Math.round(n).toLocaleString('ja-JP')+'円';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function calculate(man,age=35,spouse=false){
 const gross=man*10000, monthly=gross/12;
 const social=shakaiHokenMonthly(monthly,age,S.kenko_rates['東京都'],'general',S);
 const young=shakaiHokenMonthly(monthly,35,S.kenko_rates['東京都'],'general',S);
 const annual=social.self*12;
 const tax=calcShotokuzei({kyuyo:gross,shaho:annual,haigu:{ari:spouse,gokei:0,rojin:false,shogai:'none'}},refs);
 if(!tax.ok) throw Error(tax.errors.join('\n'));
 const local=resident({kyuyoShunyu:gross,shakaiHoken:annual,zeisei:'r8',family:{haigusha:spouse?'ippan':'none'},jichitai:'hyojun'},refs.J);
 // 合算控除の端数に揃えるため、介護は健保・介護合計と健保のみとの差額で表示。
 const parts={kenko:young.kenkoKaigo.self*12,kaigo:(social.kenkoKaigo.self-young.kenkoKaigo.self)*12,kosodate:social.kosodate.self*12,kosei:social.kosei.self*12,koyou:social.koyou.self*12,tax:tax.kijun,fukko:tax.fukko,local:local.juminzeiTotal};
 const socialParts=parts.kenko+parts.kaigo+parts.kosodate+parts.kosei+parts.koyou;
 if(socialParts!==annual)throw Error('社会保険料の控除額と表示内訳が不一致');
 const net=gross-annual-tax.zeigakuGokei-local.juminzeiTotal;
 return {gross,monthly,social,annual,tax,local,parts,net,age,spouse,band:KENKO_GRADES.find(g=>g[0]===social.grade)};
}
const labels={kenko:'健康保険',kaigo:'介護保険',kosodate:'子ども・子育て支援金',kosei:'厚生年金',koyou:'雇用保険',tax:'所得税',fukko:'復興特別所得税',local:'住民税・森林環境税'};
export const sources=[['協会けんぽ「東京支部の保険料額表」','https://www.kyoukaikenpo.or.jp/assets/R8_13tokyo.pdf'],['厚生労働省「雇用保険料率」',S.koyou.url],['国税庁「所得税の税率」',refs.S._meta.sources.shotokuzei_sokusan],['国税庁「源泉所得税の改正のあらまし」',refs.N._meta.sources.kaisei_aramashi],['所得税法（改正後）',refs.K._meta.sources.shotokuzeiho_r08],['租税特別措置法（改正後）',refs.K._meta.sources.sochiho_r08],['地方税法',refs.J._meta.url],['国立市「住民税の計算方法」','https://www.city.kunitachi.tokyo.jp/kurashi/zeikin/6/2/5791.html']];
function assumptions(){return `<h2 id="conditions">計算の前提</h2><table id="income-conditions"><tbody>
<tr><th>対象</th><td>所得税上の居住者である会社員。社会保険・雇用保険に加入し、厚生年金基金は未加入。給与のみで、賞与・非課税通勤手当なし。</td></tr>
<tr><th>支給方法</th><td>額面年収を12等分。円未満を含む理論上の月給から標準報酬月額を求め、同じ等級が続くモデル。</td></tr>
<tr><th>保険料</th><td>${esc(S._meta.year)}の協会けんぽ東京。健康保険は${esc(S._meta.rate_applies_from)}、支援金は${esc(S._meta.kosodate_applies_from)}、雇用保険は${esc(S._meta.koyou_applies_from)}以後の料率を12か月に適用。暦年の途中の料率変更は反映しません。</td></tr>
<tr><th>年齢・家族</th><td>基本例は35歳・扶養なし。比較例は45歳、または所得のない同一生計の配偶者（70歳未満）あり。子・その他の扶養なし。</td></tr>
<tr><th>所得税</th><td>${esc(refs.K._meta.year)}の年税額。${esc(refs.N._meta.label)}と同じ改正後の控除。${esc(refs.K._meta.label)}の計算規則を使用。</td></tr>
<tr><th>住民税</th><td>${esc(refs.J._meta.year)}の所得を使用。翌年度の税額を差し引いた平常年の目安。標準税率・均等割・森林環境税を含み、自治体の超過課税は含めません。</td></tr>
<tr><th>控除</th><td>基礎控除・社会保険料控除と、比較例の配偶者控除。住宅ローン・生命保険・医療費・寄附などの控除なし。本人の所得制限で配偶者控除がなくなる場合も反映。</td></tr>
<tr><th>端数と月額</th><td>保険料は給与控除の50銭以下切捨て・50銭超切上げ。所得税と復興税は所得税計算機と同じ年税額を使用し、納付額の端数処理前。月額は年額の12分の1を円に四捨五入した平均です。</td></tr>
</tbody></table><p>年の途中の就職・退職・死亡・出国、他の所得、保険料免除は対象外です。住民税は前年所得で決まるため、昇給直後や新卒の給与明細とは一致しません。賞与への配分でも社会保険料が変わります。<a href="/tedori/">手取り計算機で月給・年齢・都道府県・住民税通知額を指定</a>してください。年税額は<a href="/shotokuzei/">所得税計算機</a>、住民税は<a href="/juminzei/">住民税計算機</a>で確認できます。</p>`;}
// 年収ごとの読みどころ。金額は本文の calculate() 結果からだけ描く。
const focus={
 300:['初任給と平常年の違い','新卒・就職直後は、この表の住民税をそのまま月給から差し引くとは限りません。前年所得を使うため、翌年度に負担が変わる点を見込んで家計を比較します。'],
 350:['転職時の給与比較','転職前後の年収を比べるときは、額面の増加分がそのまま使えるお金の増加分にはなりません。隣の年収との比較表では、社会保険料と税を差し引いた後の増加額を確認できます。'],
 400:['配偶者がいる世帯の比較','配偶者ありの比較は、本人の手取りの変化を示します。配偶者自身の給与や年金を加えた世帯収入ではないため、共働き世帯は夫婦それぞれの条件で計算してください。'],
 450:['介護保険が加わる場合','年齢による比較では、介護保険料の増加だけでなく、社会保険料控除を通じた所得税と住民税の変化も反映しています。保険料の増加額だけを手取りから引く比較とは差が出ます。'],
 500:['月平均と給与明細の見方','平均月額は、年収から年間の本人負担を差し引いた額を等分したものです。毎月の源泉徴収や住民税の月別徴収額を再現する表ではなく、生活費の年予算を立てる目安として使います。'],
 600:['所得税と住民税の負担','所得税と住民税は同じ課税所得で計算していません。控除額や端数処理が異なるため、内訳では別々に計算した税額を確認できます。'],
 700:['昇給と保険料の等級','社会保険料は額面に同じ割合をかけ続ける方式ではありません。報酬月額が等級の境目を越えると段階的に変わるため、下の報酬範囲と隣の年収を併せて確認します。'],
 750:['厚生年金の上限との関係','健康保険と厚生年金では標準報酬月額の上限が異なります。下の内訳に両方の標準報酬月額を示しているため、給与が増えた際に同じように増えるかを見分けられます。'],
 800:['健康保険と年金の違い','高い月給では、健康保険と厚生年金の計算に使う標準報酬月額が一致しない場合があります。内訳の両方の標準報酬月額を比較すると、額面に単純な一律負担率をかけられない理由が分かります。'],
 850:['給与と賞与の配分','同じ額面年収でも、月給と賞与への配分によって標準報酬・標準賞与の扱いが変わります。このページの賞与なしモデルを、賞与のある提示年収の手取りと同一視しないでください。'],
 1000:['配偶者控除の所得制限','配偶者の所得がなくても、本人の合計所得金額によって配偶者控除額が変わります。年齢・配偶者の比較表は本人側の所得制限も反映し、単に一定の控除額を差し引く方式にはしていません。'],
 1200:['配偶者控除が使えない場合','この給与のみのモデルでは、所得のない配偶者がいても本人の所得制限により配偶者控除はありません。家族条件を変えた行が同額になることと、介護保険の年齢差とは分けて比較できます。'],
 1500:['高年収の税と手取り増加','所得税の税率は課税所得の帯ごとに適用します。給与全体に最高の税率をかける計算ではないため、額面の増加と手取りの増加を下の比較表で確認してください。']
};
function incomeContext(man){
 const r=calculate(man), i=incomes.indexOf(man), neighbor=incomes[i?i-1:i+1], low=Math.min(man,neighbor),high=Math.max(man,neighbor),a=calculate(low),b=calculate(high);
 return `<h2 id="income-context">${focus[man][0]}</h2><p>${focus[man][1]}</p>
 <table id="income-increase"><caption>給与のみ・35歳・扶養なし・東京・料率固定モデルで隣の年収と比較</caption><thead><tr><th>比較</th><th>額面の増加</th><th>手取り年額の増加</th></tr></thead><tbody><tr><th>年収${low}万円から年収${high}万円</th><td class="num">${yen(b.gross-a.gross)}</td><td class="num">${yen(b.net-a.net)}</td></tr></tbody></table>
 <p>同じ条件でも、額面の増加と手取りの増加は一致しません。各年収の内訳で、保険料と税のどちらが変わったかを確認できます。</p>`;
}
function body(man){
 const all=man==null, r=all?null:calculate(man);
 const heading=all?'年収別の手取り早見表':`年収${man}万円の手取り｜${focus[man][0]}`;
 return `<h1>${heading}</h1><p class="article-meta">確認日: <time datetime="${demand.checked}">${demand.checked}</time> ／ 所得税: ${esc(refs.K._meta.year)}・保険料: ${esc(S._meta.year)}</p>
<p class="byline">文責: <a href="/about/">Masahiro Yasu</a>（経理実務者）</p>
${all?'<p id="income-lead">年収ごとの手取り年額と平均月額を比較できます。給与のみ・35歳・扶養なし・協会けんぽ東京の料率固定モデルです。詳しい内訳と家族・年齢による違いは各年収のページにあります。</p>':`<p id="income-lead">給与のみ・35歳・扶養なし・協会けんぽ東京の料率固定モデルでは、年収${man}万円の手取りは<b id="income-annual">年額${yen(r.net)}</b>、<b id="income-monthly">平均月額${yen(r.net/12)}</b>が目安です。所得税は${esc(refs.K._meta.year)}、保険料は${esc(S._meta.year)}、住民税は同じ年収が続く場合の翌年度額です。</p>`}
<p><a class="tool-cta" href="/tedori/">自分の条件で手取りを計算する</a> <button type="button" id="income-print" onclick="window.print()">この表を印刷</button></p>
<nav class="toc" aria-label="目次"><div class="toc-title">目次</div><ol><li><a href="#answer">${all?'早見表':'内訳と比較'}</a></li>${all?'':'<li><a href="#income-context">この年収の読み方</a></li>'}<li><a href="#conditions">前提</a></li><li><a href="#neighbors">年収を比較</a></li><li><a href="#sources">出典</a></li></ol></nav>
<h2 id="answer">${all?'額面年収と手取りの比較':'年間の控除内訳と条件別の手取り'}</h2>
${all?`<div class="scroll-wrap"><table id="income-summary"><caption>給与のみ・35歳・扶養なし・東京・料率固定モデル</caption><thead><tr><th>額面年収</th><th>手取り年額</th><th>平均月額</th></tr></thead><tbody>${incomes.map(n=>{const v=calculate(n);return `<tr><th><a href="${n}/">${n}万円</a></th><td class="num">${yen(v.net)}</td><td class="num">${yen(v.net/12)}</td></tr>`}).join('\n')}</tbody></table></div>`:
`<table id="income-breakdown"><caption>給与のみ・35歳・扶養なし・東京・料率固定モデルの本人負担年額</caption><thead><tr><th>項目</th><th>年額</th></tr></thead><tbody><tr><th>額面給与</th><td>${yen(r.gross)}</td></tr>${Object.entries(r.parts).map(([k,v])=>`<tr data-part="${k}"><th>${labels[k]}</th><td>${yen(v)}</td></tr>`).join('\n')}<tr><th>手取り</th><td>${yen(r.net)}</td></tr></tbody></table>
<p data-review-context="after-table">健康保険・介護・厚生年金・支援金の計算に使った標準報酬月額は、健康保険が${yen(r.social.standard)}、厚生年金が${yen(r.social.koseiStandard)}です。健康保険のこの等級は、報酬月額${yen(r.band[2])}以上${yen(r.band[3])}未満の範囲です。<a href="https://www.kyoukaikenpo.or.jp/assets/R8_13tokyo.pdf">協会けんぽの保険料額表</a>で境目を確認できます。雇用保険は実際の月給にかかります。内訳の介護は健康保険と介護の合算控除額から健康保険のみの控除額を引き、端数を揃えています。</p>
<div class="scroll-wrap"><table id="income-comparison"><caption>同じ年収・料率固定モデルで年齢と配偶者の条件を変えた場合</caption><thead><tr><th>条件</th><th>手取り年額</th><th>平均月額</th></tr></thead><tbody>${[[35,false],[45,false],[35,true],[45,true]].map(([age,sp])=>{const v=calculate(man,age,sp);return `<tr><th>${age}歳・${sp?'所得のない配偶者あり':'扶養なし'}</th><td class="num">${yen(v.net)}</td><td class="num">${yen(v.net/12)}</td></tr>`}).join('\n')}</tbody></table></div><p>介護保険の比較例は40歳以上65歳未満の会社員を想定しています。配偶者の社会保険の被扶養者認定と、税の配偶者控除は別の制度です。</p>`}
<figure><svg viewBox="0 0 600 110" role="img" aria-label="額面給与から社会保険と税金を引くと手取りになる"><rect x="5" y="15" width="110" height="60" rx="8" fill="#e7f0fa"/><rect x="155" y="15" width="125" height="60" rx="8" fill="#f4e8db"/><rect x="320" y="15" width="110" height="60" rx="8" fill="#f4e8db"/><rect x="470" y="15" width="120" height="60" rx="8" fill="#e3f2e7"/><g text-anchor="middle" font-size="16" fill="#202b36"><text x="60" y="52">額面給与</text><text x="135" y="52">−</text><text x="218" y="52">社会保険料</text><text x="300" y="52">−</text><text x="375" y="52">税金</text><text x="450" y="52">＝</text><text x="530" y="52">手取り</text></g></svg><figcaption>手取りは額面給与から本人負担の社会保険料と税金を引いた金額です。</figcaption></figure>
${all?'':incomeContext(man)}
${assumptions()}
<h2 id="neighbors">ほかの年収の手取りを比較する</h2><p>${(all?incomes:incomes.filter((_,i)=>Math.abs(i-incomes.indexOf(man))===1)).map(n=>`<a href="/tedori/nenshu/${n}/">年収${n}万円の手取り</a>`).join(' ／ ')}${all?'':' ／ <a href="/tedori/nenshu/">年収別の手取り早見表</a>'}</p>
<p>この系列は年収ごとの答えを調べるための表です。差し引く順序や計算方法は<a href="/column/tedori-keisan/">手取りの計算方法</a>で解説しています。</p>
<h2 id="sources">出典</h2><ul id="income-sources">${sources.map(([name,url])=>`<li><a href="${esc(url)}">${esc(name)}</a>（確認日: ${demand.checked}）</li>`).join('\n')}</ul>
<p data-source-nolink="使用したサイト内データの確認日の説明">データの確認日: 社会保険料 ${S._meta.checked}、所得税 ${refs.K._meta.checked}、住民税 ${refs.J._meta.checked}。上記の資料確認日とは区別しています。</p>
<p data-source-nolink="このサイトの一般情報と個別相談の受付方針">一般的な情報提供を目的とした概算です。個別の税務・労務相談には応じられません。実際の税額・保険料は納税通知書・給与明細、税務署・自治体・保険者で確認してください。</p>`;
}
function signature(html){const dom=new JSDOM(html),el=dom.window.document.querySelector('#income-content');if(!el)return '';const nav=el.querySelector('nav.toc'),toc=nav?{list:!!nav.querySelector(':scope > ol, :scope > ul'),heading:!!nav.querySelector('.toc-title'),links:[...nav.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.textContent.replace(/\s+/g,'')])}:null;for(const n of el.querySelectorAll('nav,aside,.x-share,.side-rail'))n.remove();const s=JSON.stringify({toc,ids:[...el.querySelectorAll('[id]')].map(e=>[e.id,e.localName]),sourceExemptions:[...el.querySelectorAll('[data-source-nolink]')].map(e=>e.getAttribute('data-source-nolink')),breadcrumbs:[...dom.window.document.querySelectorAll('script[type="application/ld+json"]')].flatMap(e=>{const j=JSON.parse(e.textContent);return (j['@graph']||[j]).filter(n=>n['@type']==='BreadcrumbList');}),styles:[...dom.window.document.querySelectorAll('link[rel="stylesheet"]')].map(e=>e.getAttribute('href')),title:dom.window.document.title,description:dom.window.document.querySelector('meta[name="description"]')?.content,text:el.textContent.replace(/\s+/g,''),links:[...el.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.textContent.replace(/\s+/g,'')]),rows:[...el.querySelectorAll('[data-part]')].map(e=>[e.getAttribute('data-part'),...[...e.querySelectorAll('th,td')].map(c=>c.textContent.replace(/\s+/g,''))])});dom.window.close();return s;}
function allDescription(n,title){return n==null?`${title}。給与のみ・東京・扶養なしの料率固定モデルで、各年収の答えから内訳のページへ進めます。`:`年収${n}万円の手取り年額・平均月額と控除内訳。${focus[n][0]}を解説し、隣の年収との手取り増加額も比較。給与のみ・東京・扶養なしの料率固定モデルです。`;}
export function generate(){
 const registered=JSON.parse(readFileSync(join(ROOT,'tools/static_pages.d/tedori_income.json'),'utf8')).pages;
 const expected=['tedori/nenshu/',...incomes.map(n=>`tedori/nenshu/${n}/`)];
 if(JSON.stringify(registered)!==JSON.stringify(expected))throw Error('需要の採否とsitemap登録が不一致');
 const dir=join(ROOT,'docs/tedori/nenshu');
 if(existsSync(dir))for(const name of readdirSync(dir))if(/^\d+$/.test(name)&&!incomes.includes(Number(name)))throw Error('需要基準外の年収ページ: '+name);
 const check=process.argv.includes('--check');for(const n of [null,...incomes]){
 const path='tedori/nenshu/'+(n==null?'':n+'/'), depth=n==null?2:3,up='../'.repeat(depth),title=n==null?'年収別の手取り早見表｜年額・月額と控除内訳':`年収${n}万円の手取り｜${focus[n][0]}`, url='https://keiri-tools.com/'+path;
 const crumbs=[['ホーム','https://keiri-tools.com/'],['手取り計算機','https://keiri-tools.com/tedori/'],['年収別早見表','https://keiri-tools.com/tedori/nenshu/'],...(n==null?[]:[['年収'+n+'万円',url]])];
 const schema={'@context':'https://schema.org','@graph':[{'@type':'WebPage',name:title,url,datePublished:demand.checked,dateModified:demand.checked,author:{'@type':'Person',name:'Masahiro Yasu',url:'https://keiri-tools.com/about/'}},{'@type':'BreadcrumbList',itemListElement:crumbs.map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))}]};
 const html=withLinks(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><meta name="description" content="${allDescription(n,title)}"><link rel="canonical" href="${url}"><link rel="stylesheet" href="${up}assets/style.css"><link rel="stylesheet" href="${up}assets/tedori_income.css"><script async src="https://www.googletagmanager.com/gtag/js?id=G-E742DSDHPD"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-E742DSDHPD');</script><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2635067516563578" crossorigin="anonymous"></script><script id="income-schema" type="application/ld+json">${JSON.stringify(schema)}</script></head><body>${buildHeader(path.replace(/\/$/,''))}<main><nav class="breadcrumb"><a href="/">ホーム</a> › <a href="/tedori/">手取り計算機</a> › <a href="/tedori/nenshu/">年収別早見表</a></nav><article id="income-content"><!--income:S-->${body(n)}<!--income:E--></article></main><footer class="site">${COPY}${siteLinks(depth)}</footer><script src="${up}assets/track.js" defer></script></body></html>\n`);
 const file=join(ROOT,'docs',path,'index.html');const old=existsSync(file)?readFileSync(file,'utf8'):'';
 if(!old || signature(old)!==signature(html)){if(check)throw Error('年収ページが古い: '+path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,old?old.replace(/<style>table\{[\s\S]*?<\/style>/,`<link rel="stylesheet" href="${up}assets/tedori_income.css">`).replace(/<script(?: id="income-schema")? type="application\/ld\+json">[\s\S]*?<\/script>/,`<script id="income-schema" type="application/ld+json">${JSON.stringify(schema)}</script>`).replace(/<!--income:S-->[\s\S]*?<!--income:E-->/,`<!--income:S-->${body(n)}<!--income:E-->`).replace(/<title>[\s\S]*?<\/title>/,`<title>${title}</title>`).replace(/<meta name="description" content="[^"]*">/,html.match(/<meta name="description" content="[^"]*">/)[0]):html);}
 }console.log(`✓ 年収別手取り ${incomes.length}ページと早見表${check?'照合':'生成'}`);}
if(process.argv[1]===fileURLToPath(import.meta.url))generate();
