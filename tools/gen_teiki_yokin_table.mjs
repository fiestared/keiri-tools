/** 基準日付きの円定期預金表。公式資料確認後に data/teiki_yokin_rates.json を更新する。 */
import {readFileSync,writeFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const data=JSON.parse(readFileSync(new URL('./data/teiki_yokin_rates.json',import.meta.url),'utf8'));
const path=new URL('../docs/column/teiki-yokin-kinri-table/index.html',import.meta.url);
const yen=n=>n.toLocaleString('ja-JP')+'円';
const date=s=>s.replace(/^(\d+)-(\d+)-(\d+)$/,(_,y,m,d)=>`${y}年${+m}月${+d}日`);
// 整数比で円未満切捨て。丸め境界で浮動小数点に依存しない。
function amount(rate,days){
 const digits=rate.split('.')[1]?.length||0;
 const rn=BigInt(rate.replace('.','')),rd=10n**BigInt(digits)*100n;
 const gross=BigInt(data.principal)*rn*BigInt(days)/(rd*365n);
 const taxDigits=data.tax_rate.split('.')[1].length,td=10n**BigInt(taxDigits),tn=BigInt(data.tax_rate.replace('.',''));
 return [Number(gross),Number(gross*(td-tn)/td)];
}
const rates=`<div class="scroll-wrap"><table id="rate-table"><caption>個人通常課税・単利・満期保有の比較用概算</caption><thead><tr><th scope="col">銀行</th><th scope="col">税引前年率</th><th scope="col" data-answer>税引後利息（概算）</th><th scope="col">税引前利息</th><th scope="col">公表基準日</th></tr></thead><tbody>\n`+data.banks.map(b=>{const [gross,net]=amount(b.rate_percent,data.days);return `<tr><th scope="row"><a href="${b.source_url}">${b.name}</a></th><td class="num">${b.rate_percent}%</td><td class="num">${yen(net)}</td><td class="num">${yen(gross)}</td><td>${date(b.source_as_of)}</td></tr>`}).join('\n')+'\n</tbody></table></div>';
const periods=`<div class="scroll-wrap"><table id="period-table"><caption>元本と年率を固定した単利の比較用概算</caption><thead><tr><th scope="col">期間</th><th scope="col">設例の満期日</th><th scope="col">預入日数</th><th scope="col">税引前利息</th><th scope="col">税引後利息（概算）</th></tr></thead><tbody>\n`+data.period_examples.map(p=>{const [gross,net]=amount('0.50',p.days);return `<tr><th scope="row">${p.label}</th><td>${date(p.maturity)}</td><td class="num">${p.days}日</td><td class="num">${yen(gross)}</td><td class="num">${yen(net)}</td></tr>`}).join('\n')+'\n</tbody></table></div>';
let html=readFileSync(path,'utf8');
for(const [name,table] of [['RATES',rates],['PERIODS',periods]])html=html.replace(new RegExp(`<!--TEIKI_${name}:START-->[\\s\\S]*?<!--TEIKI_${name}:END-->`),`<!--TEIKI_${name}:START-->\n${table}\n<!--TEIKI_${name}:END-->`);
// layout が加える数値のspanや列クラスは無視し、表の意味と出典リンクを比較する。
function signature(source){
 const doc=new JSDOM(source).window.document;
 return JSON.stringify([...doc.querySelectorAll('table')].map(t=>({id:t.id,caption:t.caption?.textContent.replace(/\s+/g,''),rows:[...t.rows].map(r=>[...r.cells].map(c=>({tag:c.tagName,scope:c.getAttribute('scope'),answer:c.hasAttribute('data-answer'),text:c.textContent.replace(/\s+/g,''),links:[...c.querySelectorAll('a')].map(a=>a.getAttribute('href'))})))})));
}
if(process.argv.includes('--check')){
 if(signature(html)!==signature(readFileSync(path,'utf8'))){console.error('定期預金表の再生成が必要');process.exit(1)}
 console.log('✓ 定期預金表の金額・条件・出典は正本データと一致');
}else writeFileSync(path,html);
