/** 年収別の答えを既存 core から生成。料率固定モデルであり暦年の給与明細の再現ではない。 */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {JSDOM} from 'jsdom';
import {shakaiHokenMonthly} from '../docs/assets/tedori_core.js';
import {KENKO_GRADES} from '../docs/assets/shaho_core.js';
import {calcShotokuzei} from '../docs/assets/shotokuzei_core.js';
import {kyuyoShotokuR8,calc as resident} from '../docs/assets/juminzei_core.js';
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
const calculationCache=new Map();
export function calculate(man,age=35,spouse=false){
 const key=[man,age,spouse].join(':');if(calculationCache.has(key))return calculationCache.get(key);
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
 const result={gross,monthly,social,annual,tax,local,parts,net,age,spouse,band:KENKO_GRADES.find(g=>g[0]===social.grade)};calculationCache.set(key,result);return result;
}
const labels={kenko:'健康保険',kaigo:'介護保険',kosodate:'子ども・子育て支援金',kosei:'厚生年金',koyou:'雇用保険',tax:'所得税',fukko:'復興特別所得税',local:'住民税・森林環境税'};
function readerLaw(url){return url.replace('/api/2/law_data/','/law/').split('_')[0];}
export const sources=[['協会けんぽ「東京支部の保険料額表」','https://www.kyoukaikenpo.or.jp/assets/R8_13tokyo.pdf'],['厚生労働省「雇用保険料率」',S.koyou.url],['国税庁「所得税の税率」',refs.S._meta.sources.shotokuzei_sokusan],['国税庁「源泉所得税の改正のあらまし」',refs.N._meta.sources.kaisei_aramashi],['所得税法（令和8年12月1日施行版を参照）',readerLaw(refs.K._meta.sources.shotokuzeiho_r08)],['租税特別措置法（令和8年12月1日施行版を参照）',readerLaw(refs.K._meta.sources.sochiho_r08)],['地方税法',refs.J._meta.url],['国立市「住民税の計算方法」','https://www.city.kunitachi.tokyo.jp/kurashi/zeikin/6/2/5791.html']];
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
// 境目は既存データと給与所得計算から求める。給与は円単位で逆算する。
function salaryLimit(income){let lo=0,hi=30000000;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(kyuyoShotokuR8(mid,refs.J)<=income)lo=mid;else hi=mid-1;}return lo;}
const kisoBands=refs.J.shotokuzei_kiso_kojo_r8.brackets;
const salaryBands=refs.J.kyuyo_shotoku.kojo_brackets;
const pensionCap=S.kosei_grade_cap.current;
const pensionStart=KENKO_GRADES.find(g=>g[1]===pensionCap)[2]*12;
const spouseLimits=refs.S.haigu.honnin_tiers.map(t=>salaryLimit(t.upto));
export function boundaries(man){
 const r=calculate(man),k=kisoBands.find(b=>b.upto==null||r.tax.gokei<=b.upto),w=calculate(man,35,true);
 const rate=refs.S.shotokuzei_brackets.find(b=>b.upto==null||r.tax.kazei<=b.upto);
 const salaryBand=salaryBands.find(b=>b.upto==null||r.gross<=b.upto);
 return {salaryDeduction:r.gross-r.tax.shotoku.kyuyoShotoku,kiso:k.amount,kisoIncomeLimit:k.upto,kisoSalaryLimit:salaryLimit(k.upto),rate:Math.round(rate.rate*100),taxable:r.tax.kazei,taxableLimit:rate.upto,salaryBand,salaryFormulaConstant:salaryBand.base-salaryBand.over*salaryBand.rate_pct/100,pensionStart,pensionCap,pensionCapped:r.social.koseiStandard===pensionCap,spouseDeduction:w.tax.kojo.haigu,spouseGain:w.net-r.net,spouseLimits};
}
const focus={
 300:'給与所得の表計算と低い税率帯',350:'給与所得控除の算式が変わる手前',400:'給与所得控除の傾きが変わった帯',450:'月給と標準報酬のずれを読む帯',500:'所得税の次の税率帯までの余裕',600:'基礎控除の縮小を控える帯',700:'基礎控除の上乗せが縮む帯',750:'厚生年金の上限に届く直前',800:'年金が上限に達し健保だけが増える帯',850:'基礎控除と給与所得控除の二つの境目',1000:'配偶者控除は満額・年金は上限',1200:'配偶者控除の対象外になった帯',1500:'高い税率帯と定額の給与所得控除'
};
function observations(man,r,c){
 const amount=n=>yen(n);
 const texts={
 300:['給与所得は、給与所得控除後の金額の表を使う範囲です。速算式だけで見積もる場合と異なり、給与の端数によって控除後の金額が区切られます。','所得税は低い税率帯に収まり、配偶者控除も同じ帯の課税所得を減らします。社会保険の扶養認定とは分けて、比較表の本人の手取り差を見ます。'],
 350:['給与所得控除の算式が次の帯へ切り替わる手前です。昇給後も今の控除の増え方が続くとは限らず、境目の前後で給与所得の増え方を確認します。','まだ給与所得控除後の金額の表が適用されます。年収が表の区切りに一致しない場合は、額面から単純な割合を引いた所得と差が出ます。'],
 400:['給与所得控除の増え方が前の帯より緩やかになっています。額面が増えるとき、控除に回る割合が小さくなり、給与所得に残る割合が増えます。','算式の帯が変わっても、所得税の税率帯が同時に変わるとは限りません。控除後に社会保険料と基礎控除も引いた課税所得で税率を判定します。'],
 450:['このモデルの月給は標準報酬月額と一致しません。実際の月給に健保の料率を直接掛けず、内訳の等級に丸めた額を使います。','給与所得控除の帯は変わっていないため、隣の年収との差には保険料等級の違いも影響します。額面増加だけから同じ割合の手取り増加を見込まないよう比較します。'],
 500:['課税所得は次の所得税率帯より下にあります。税率が上がるかどうかは額面年収ではなく、下の表の課税所得の残り幅で確認できます。','次の税率帯に進んでも、その税率を給与全体に掛け直す計算にはなりません。給与所得控除と基礎控除は別々に差し引くため、両方の次の境目も併せて見ます。'],
 600:['基礎控除の大きい上乗せが残る最後の掲載年収です。次の掲載年収との比較では、昇給に加えて基礎控除の縮小が所得税を増やす方向に働きます。','給与所得控除の算式も次の帯への切替えが近づいています。こちらの切替えと基礎控除の縮小は別の境目なので、同じ年収で一度に起きるものと考えないでください。'],
 700:['掲載年収では初めて基礎控除の大きい上乗せが外れる帯に入ります。給与所得控除の算式も前の掲載年収から切り替わっており、二つの変化を区別する必要があります。','厚生年金はまだ上限に届いていません。高い税率帯に進むことに加え、昇給で年金の等級も上がり得る位置です。'],
 750:['厚生年金の上限に届く直前の掲載年収です。健康保険と厚生年金の標準報酬月額はまだ同額で、ここでは両者の上限差は発生していません。','次の掲載年収では厚生年金だけが上限に達します。現在の保険料の増え方をそのまま延長せず、下の上限までの距離を見て比較します。'],
 800:['掲載年収では初めて厚生年金の標準報酬月額が上限に達します。健康保険は上限に達していないため、二つの標準報酬月額が分かれています。','基礎控除にはまだ上乗せが残っています。年金が頭打ちになる境目と、基礎控除の上乗せがなくなる境目は別なので、次の昇給では両方を確認します。'],
 850:['基礎控除の小さい上乗せが残る給与収入の上端です。この額を超えると上乗せがなくなるため、上端まで余裕がある場合と分けて考えます。','給与所得控除も増え続ける帯の上端です。ここを超えた給与は控除額が定額になるため、基礎控除の縮小と重なって課税所得に影響します。'],
 1000:[`この給与のみのモデルでは、所得のない配偶者に対する所得税の配偶者控除は満額${amount(c.spouseDeduction)}です。本人の合計所得は${amount(r.tax.gokei)}であり、この年収で控除が減り始めるわけではありません。`,`給与のみ・所得のない配偶者の場合、${esc(refs.K._meta.year)}の配偶者控除が減り始めるのは給与${amount(c.spouseLimits[0])}超、なくなるのは${amount(c.spouseLimits[2])}超です。年金は既に上限なので、今後は本人の所得制限と税率帯が比較の要点になります。`],
 1200:['本人の所得制限を超えたため、所得のない配偶者がいても配偶者控除はありません。配偶者ありの行と扶養なしの行の手取りが同額になるのは、この制限を反映した結果です。','厚生年金と給与所得控除はいずれも上限に達しています。昇給後の負担を比べるときは、定額の部分より課税所得の税率帯と健康保険の等級を確認します。'],
 1500:['掲載年収の中でも高い所得税率帯に進んでいます。次の税率は課税所得が今の帯の上端を超えた部分にかかるため、給与全体の負担率とは異なります。','給与所得控除は定額で、配偶者控除も本人の所得制限により対象外です。低い年収の手取り率を当てはめず、増えた額面が控除で相殺されにくい条件で比較します。']
 };
 return texts[man].map((t,i)=>`<p id="income-observation-${i+1}">${t}</p>`).join('');
}
function boundaryTable(man,r,c){
 const sb=c.salaryBand, next=sb.upto;
 const formula=sb.rate_pct?`速算式: 収入×${sb.rate_pct}%＋${yen(c.salaryFormulaConstant)}（表の端数処理あり）`:'控除額は定額';
 const rows=[
 ['給与所得控除',`${yen(c.salaryDeduction)}。${formula}`,next==null?'この先も定額':`算式の上端 ${yen(next)}まで${yen(next-r.gross)}。上端を超えると次の算式へ`],
 ['所得税の基礎控除',`${yen(c.kiso)}。合計所得${yen(c.kisoIncomeLimit)}以下の帯`,`給与のみの上端 ${yen(c.kisoSalaryLimit)}まで${yen(c.kisoSalaryLimit-r.gross)}。上端超で控除縮小`],
 ['所得税の税率帯',`課税所得${yen(c.taxable)}、限界税率${c.rate}%`,`課税所得の上端 ${yen(c.taxableLimit)}まで${yen(c.taxableLimit-c.taxable)}。額面年収の差額ではありません`],
 ['厚生年金の上限',`標準報酬月額${yen(r.social.koseiStandard)}（上限${yen(c.pensionCap)}）`,c.pensionCapped?`給与年額${yen(c.pensionStart)}から上限に到達済み`:`給与年額${yen(c.pensionStart)}で上限へ。あと${yen(c.pensionStart-r.gross)}`],
 ['所得のない配偶者の控除',`所得税${yen(c.spouseDeduction)}。本人の手取り差${yen(c.spouseGain)}`,c.spouseDeduction===0?`給与のみで${yen(c.spouseLimits[2])}超のため対象外`:`給与のみで${yen(c.spouseLimits[0])}超から縮小、${yen(c.spouseLimits[2])}超で対象外`]
 ];
 return `<table id="income-boundaries"><caption>年収${man}万円・給与のみ・35歳・東京・${esc(refs.K._meta.year)}所得税と料率固定モデルの境目（配偶者の行だけ配偶者あり）</caption><thead><tr><th>制度</th><th>この年収での扱い</th><th>次の境目・到達状況</th></tr></thead><tbody>${rows.map((row,i)=>`<tr data-boundary="${i}">${row.map((v,j)=>`<${j?'td':'th'}>${v}</${j?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table><p>給与所得控除は、表を使う範囲では給与の端数処理も反映した実際の控除額です。制度の境目は<a href="${sources[3][1]}">国税庁の改正のあらまし</a>、給与所得控除は<a href="${refs.S._meta.sources.kyuyo_shotoku_kojo}">国税庁の給与所得控除表</a>、配偶者控除は<a href="${refs.S._meta.sources.haigu_shotokuzei}">国税庁の配偶者控除表</a>、税率帯は<a href="${sources[2][1]}">国税庁の税率表</a>、年金の上限は<a href="${sources[0][1]}">協会けんぽの額表</a>で確認できます（確認日: 2026-10-22）。</p>`;
}
function incomeContext(man){
 const r=calculate(man), c=boundaries(man), i=incomes.indexOf(man), neighbor=incomes[i?i-1:i+1], low=Math.min(man,neighbor),high=Math.max(man,neighbor),a=calculate(low),b=calculate(high);
 return `<h2 id="income-context">${focus[man]}</h2>${observations(man,r,c)}${boundaryTable(man,r,c)}
 <table id="income-increase"><caption>給与のみ・35歳・扶養なし・東京・料率固定モデルで隣の年収と比較</caption><thead><tr><th>比較</th><th>額面の増加</th><th>手取り年額の増加</th></tr></thead><tbody><tr><th>年収${low}万円から年収${high}万円</th><td class="num">${yen(b.gross-a.gross)}</td><td class="num">${yen(b.net-a.net)}</td></tr></tbody></table>
 <p>同じ条件でも、額面の増加と手取りの増加は一致しません。各年収の内訳で、保険料と税のどちらが変わったかを確認できます。</p>`;
}
function body(man){
 const all=man==null, r=all?null:calculate(man);
 const heading=all?'年収別の手取り早見表':incomeTitle(man);
 return `<h1>${heading}</h1><p class="article-meta">確認日: <time datetime="${demand.checked}">${demand.checked}</time> ／ 所得税: ${esc(refs.K._meta.year)}・保険料: ${esc(S._meta.year)}</p>
<p class="byline">文責: <a href="/about/">Masahiro Yasu</a>（経理実務者）</p>
${all?'<p id="income-lead">年収ごとの手取り年額と平均月額を比較できます。給与のみ・35歳・扶養なし・協会けんぽ東京の料率固定モデルです。詳しい内訳と家族・年齢による違いは各年収のページにあります。</p>':`<p id="income-lead">年収${man}万円の手取りは<b id="income-annual">年額${yen(r.net)}</b>、<b id="income-monthly">平均月額${yen(r.net/12)}</b>が目安です。給与のみ・35歳・扶養なし・協会けんぽ東京の料率固定モデルです。所得税は${esc(refs.K._meta.year)}、保険料は${esc(S._meta.year)}、住民税は同じ年収が続く場合の翌年度額です。</p>`}
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
function incomeTitle(n){
 const c=boundaries(n),money=v=>(v/10000).toLocaleString('ja-JP')+'万円';
 const detail={300:`表計算の給与所得控除${money(c.salaryDeduction)}`,350:`控除算式の切替えまで${money(c.salaryBand.upto-n*10000)}`,400:`給与所得控除は収入×${c.salaryBand.rate_pct}%の帯`,450:`健保の標準報酬${money(calculate(n).social.standard)}`,500:`所得税率${c.rate}%・次の税率帯を確認`,600:`基礎控除${money(c.kiso)}が残る帯`,700:`基礎控除が${money(c.kiso)}に縮む帯`,750:`年金上限まで年収あと${money(c.pensionStart-n*10000)}`,800:`年金の標準報酬は上限${money(c.pensionCap)}`,850:`基礎控除${money(c.kiso)}の帯の上端`,1000:`配偶者控除は満額${money(c.spouseDeduction)}`,1200:'配偶者控除なし・所得制限を超える帯',1500:`所得税率${c.rate}%・給与所得控除は定額`};
 return `年収${n}万円の手取り｜${detail[n]}`;
}
function allDescription(n,title){return n==null?`${title}。給与のみ・東京・扶養なしの料率固定モデルで、各年収の答えから内訳のページへ進めます。`:`年収${n}万円の手取りは年額${yen(calculate(n).net)}、月平均${yen(calculate(n).net/12)}。${focus[n]}を確認。基礎控除${yen(boundaries(n).kiso)}・所得税率${boundaries(n).rate}%の帯で、次の境目までの差額を比較。給与のみ・35歳・東京・扶養なしの料率固定モデルです。`;}
export function generate(){
 const registered=JSON.parse(readFileSync(join(ROOT,'tools/static_pages.d/tedori_income.json'),'utf8')).pages;
 const expected=['tedori/nenshu/',...incomes.map(n=>`tedori/nenshu/${n}/`)];
 if(JSON.stringify(registered)!==JSON.stringify(expected))throw Error('需要の採否とsitemap登録が不一致');
 const dir=join(ROOT,'docs/tedori/nenshu');
 if(existsSync(dir))for(const name of readdirSync(dir))if(/^\d+$/.test(name)&&!incomes.includes(Number(name)))throw Error('需要基準外の年収ページ: '+name);
 const check=process.argv.includes('--check');for(const n of [null,...incomes]){
 const path='tedori/nenshu/'+(n==null?'':n+'/'), depth=n==null?2:3,up='../'.repeat(depth),title=n==null?'年収別の手取り早見表｜年額・月額と控除内訳':incomeTitle(n), url='https://keiri-tools.com/'+path;
 const crumbs=[['ホーム','https://keiri-tools.com/'],['手取り計算機','https://keiri-tools.com/tedori/'],['年収別早見表','https://keiri-tools.com/tedori/nenshu/'],...(n==null?[]:[['年収'+n+'万円',url]])];
 const schema={'@context':'https://schema.org','@graph':[{'@type':'WebPage',name:title,url,datePublished:demand.checked,dateModified:demand.checked,author:{'@type':'Person',name:'Masahiro Yasu',url:'https://keiri-tools.com/about/'}},{'@type':'BreadcrumbList',itemListElement:crumbs.map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))}]};
 const html=withLinks(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><meta name="description" content="${allDescription(n,title)}"><link rel="canonical" href="${url}"><link rel="stylesheet" href="${up}assets/style.css"><link rel="stylesheet" href="${up}assets/tedori_income.css"><script async src="https://www.googletagmanager.com/gtag/js?id=G-E742DSDHPD"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-E742DSDHPD');</script><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2635067516563578" crossorigin="anonymous"></script><script id="income-schema" type="application/ld+json">${JSON.stringify(schema)}</script></head><body>${buildHeader(path.replace(/\/$/,''))}<main><nav class="breadcrumb"><a href="/">ホーム</a> › <a href="/tedori/">手取り計算機</a> › <a href="/tedori/nenshu/">年収別早見表</a></nav><article id="income-content"><!--income:S-->${body(n)}<!--income:E--></article></main><footer class="site">${COPY}${siteLinks(depth)}</footer><script src="${up}assets/track.js" defer></script></body></html>\n`);
 const file=join(ROOT,'docs',path,'index.html');const old=existsSync(file)?readFileSync(file,'utf8'):'';
 if(!old || signature(old)!==signature(html)){if(check)throw Error('年収ページが古い: '+path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,old?old.replace(/<style>table\{[\s\S]*?<\/style>/,`<link rel="stylesheet" href="${up}assets/tedori_income.css">`).replace(/<script(?: id="income-schema")? type="application\/ld\+json">[\s\S]*?<\/script>/,`<script id="income-schema" type="application/ld+json">${JSON.stringify(schema)}</script>`).replace(/<!--income:S-->[\s\S]*?<!--income:E-->/,`<!--income:S-->${body(n)}<!--income:E-->`).replace(/<title>[\s\S]*?<\/title>/,`<title>${title}</title>`).replace(/<meta name="description" content="[^"]*">/,html.match(/<meta name="description" content="[^"]*">/)[0]):html);}
 }console.log(`✓ 年収別手取り ${incomes.length}ページと早見表${check?'照合':'生成'}`);}
if(process.argv[1]===fileURLToPath(import.meta.url))generate();
