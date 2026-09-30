import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
const base='review/r16-t3-a/sources/';
const sources=[['young-dependent','https://www.nenkin.go.jp/oshirase/taisetu/2025/202508/0819.html'],['dai3','https://www.nenkin.go.jp/service/yougo/tagyo/dai3hihokensha.html'],['dependent-premium','https://www.kyoukaikenpo.or.jp/faq/voluntary_continuation/001/']];
const manifest=[];
for(const [name,url] of sources){const raw=execFileSync('curl',['-fLsS',url],{maxBuffer:10*1024*1024});writeFileSync(base+name+'.html',raw);const dom=new JSDOM(raw.toString());for(const n of dom.window.document.querySelectorAll('script,style,nav,header,footer'))n.remove();const text=dom.window.document.body.textContent.split('\n').map(s=>s.trim()).filter(Boolean).join('\n');writeFileSync(base+name+'.txt',text+'\n');dom.window.close();manifest.push({name,url,sha256:createHash('sha256').update(raw).digest('hex'),captured:'2026-09-30',scope:'修正用の追加資料。RUN/corpusとは別、既存out_of_corpusを一括okにしない'});}
manifest.push({name:'R8_13tokyo',url:'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf',sha256:createHash('sha256').update(readFileSync(base+'R8_13tokyo.pdf')).digest('hex'),captured:'2026-09-30',scope:'等級・折半額・給与控除時の個別端数処理。画像目視とpdftotextを照合'});
writeFileSync(base+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
