import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../tools/teigaku_kogawase_reference.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../docs/column/teigaku-kogawase/index.html',import.meta.url),'utf8');
const plain=s=>s.replace(/<[^>]+>/g,'').replace(/\s+/g,'');
const rows=key=>[...html.match(new RegExp(`<!--teigaku:${key}:S-->([\\s\\S]*?)<!--teigaku:${key}:E-->`))[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1).map(r=>[...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c=>plain(c[1])));
const amounts=s=>[...s.matchAll(/([\d,]+)円/g)].map(m=>Number(m[1].replaceAll(',','')));
assert.deepEqual(rows('denominations').flatMap(r=>amounts(r[1])),data.denominations,'記事の金種が正本JSONと一致');
assert.deepEqual(data.denominations,[50,100,150,200,250,300,350,400,450,500,750,1000],'公式公表の金種を転記');
assert.equal(data.issue_fee_including_tax,200,'現行公式料金（税込）');
for (const [i,r] of rows('example').entries()){
 const tokens=amounts(r[0]);const count=Number(r[0].match(/（(\d+)枚）/)[1]);
 assert.equal(tokens.length,count,'券種数と証書枚数');
 assert.ok(tokens.every(n=>data.denominations.includes(n)),'実在する券種を使用');
 const face=tokens.reduce((s,n)=>s+n,0);assert.equal(face,data.example.certificate_charge,'設例の証明書代を満たす');
 assert.equal(amounts(r[1])[0],face);assert.equal(amounts(r[2])[0],count*data.issue_fee_including_tax);
 assert.equal(amounts(r[3])[0],face+count*data.issue_fee_including_tax,'窓口支払額に購入料金を加算');
}
assert.ok(/有効期間経過後、再交付請求のうえ即時払渡し・払戻しをする場合は無料/.test(plain(html)),'再交付料金の無料例外を表示');
assert.ok(/紛失（有効期間内は発行・交付なし）/.test(plain(html)),'紛失時の待機条件を表示');
const reissueTable=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)].map(m=>m[1]).find(t=>plain(t).startsWith('定額小為替の再交付手続き'));
assert.ok(reissueTable,'再交付の手続表を特定');
const reissueRows=[...reissueTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].slice(1);
assert.equal(reissueRows.length,3);
const reissueContexts=[...html.matchAll(/<p[^>]*data-review-context="before-table"[^>]*>([\s\S]*?)<\/p>/g)].map(m=>plain(m[1])).filter(t=>t.includes('定額小為替の再交付は'));
assert.equal(reissueContexts.length,1,'再交付料金の共通説明を一意に特定');
assert.equal(Number(reissueContexts[0].match(/再交付は、?証書1枚([\d,]+)円/)[1].replaceAll(',','')),data.reissue_fee_including_tax,'再交付料金を正本JSONと照合');
console.log('✓ 定額小為替の金種・購入費用・重要例外');
