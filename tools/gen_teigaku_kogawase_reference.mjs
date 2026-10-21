import {readFileSync,writeFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('./teigaku_kogawase_reference.json',import.meta.url),'utf8'));
const page=new URL('../docs/column/teigaku-kogawase/index.html',import.meta.url);
const yen=n=>n.toLocaleString('en-US')+'円';
const denominationRows=[];
for(let i=0;i<data.denominations.length;i+=3) denominationRows.push(`<tr><th scope="row">金種</th><td>${data.denominations.slice(i,i+3).map(yen).join('、')}</td></tr>`);
const blocks={
 denominations:`<table><caption>定額小為替の金種</caption><thead><tr><th>区分</th><th>額面</th></tr></thead><tbody>${denominationRows.join('\n')}</tbody></table>`,
 example:`<table><caption>架空の証明書取得で定額小為替を購入する設例</caption><thead><tr><th>用意する券種</th><th>額面合計</th><th>購入料金</th><th>窓口で払う合計</th></tr></thead><tbody>${data.example.combinations.map(a=>`<tr><th scope="row">${a.map(yen).join('券＋')}券（${a.length}枚）</th><td class="num">${yen(a.reduce((s,n)=>s+n,0))}</td><td class="num">${yen(a.length*data.issue_fee_including_tax)}</td><td class="num">${yen(a.reduce((s,n)=>s+n,0)+a.length*data.issue_fee_including_tax)}</td></tr>`).join('\n')}</tbody></table>`
};
let html=readFileSync(page,'utf8');
for(const [key,block] of Object.entries(blocks)){
 const re=new RegExp(`<!--teigaku:${key}:S-->[\\s\\S]*?<!--teigaku:${key}:E-->`);
 if(!re.test(html))throw new Error('missing marker: '+key);
 html=html.replace(re,`<!--teigaku:${key}:S-->\n<div class="scroll-wrap">${block}</div>\n<!--teigaku:${key}:E-->`);
}
if(process.argv.includes('--check')) {if(html.replace(/<[^>]+>/g,'').replace(/\s+/g,'')!==readFileSync(page,'utf8').replace(/<[^>]+>/g,'').replace(/\s+/g,'')){console.error('定額小為替の表が正本JSONと不一致');process.exit(1);}console.log('定額小為替の表: 正本JSONと一致');}
else writeFileSync(page,html);
