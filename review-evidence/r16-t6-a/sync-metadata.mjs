import {JSDOM} from 'jsdom';import {readFileSync,writeFileSync} from 'node:fs';
for(const page of ['docs/column/kogaku-ryoyohi/index.html','docs/kogaku-ryoyohi/index.html','docs/shobyo/index.html','docs/embed/shobyo/index.html']){
 let s=readFileSync(page,'utf8');const dom=new JSDOM(s),d=dom.window.document;const desc=d.querySelector('meta[name=description]')?.content,title=d.querySelector('h1')?.textContent;
 s=s.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,a,b,c)=>{let j;try{j=JSON.parse(b)}catch{return all}let changed=false;function visit(x){if(!x||typeof x!=='object')return;if(['Article','WebApplication'].includes(x['@type'])){if(desc&&x.description&&x.description!==desc){x.description=desc;changed=true}if(title&&x.headline&&x.headline!==title){x.headline=title;changed=true}}for(const v of Object.values(x)){if(Array.isArray(v))v.forEach(visit);else if(typeof v==='object')visit(v)}}visit(j);return changed?a+'\n'+JSON.stringify(j,null,2)+'\n'+c:all;});
 s=s.replaceAll('入社1年未満の方の上限額','現保険者等の標準報酬月額が定められた直近継続月数が12か月未満の方の上限額');
 if(page==='docs/kogaku-ryoyohi/index.html')s=s.replaceAll('直近12か月で高額療養費が支給された月が3か月以上になると、','当月を含む直近12か月に同一保険者・同一被保険者の支給対象月が3か月以上ある場合（70～74歳の外来個人上限による支給月を除く）、');
 writeFileSync(page,s);dom.window.close();
}
