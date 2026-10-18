import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(readFileSync(root+'/tools/data/nenkan_kyujitsu_reference.json','utf8'));
const page=root+'/docs/column/nenkan-kyujitsu/index.html';
const original=readFileSync(page,'utf8');
const rows=data.rows.map(([label,company,worker])=>`<tr><th scope="row">${label}</th><td class="num">${company}日</td><td class="num">${worker}日</td></tr>`).join('\n');
const updated=original.replace(/(<table id="holiday-average">[\s\S]*?<tbody>)[\s\S]*?(<\/tbody>)/,`$1\n${rows}\n$2`);
if(!original.includes('id="holiday-average"'))throw Error('統計表が見つかりません');
const normalize=s=>s.replace(/<span class="numeric-token">([^<]*)<\/span>/g,'$1');
if(process.argv.includes('--check')){if(normalize(updated)!==normalize(original)){console.error('統計表の生成が必要');process.exitCode=1;}else console.log('✓ 年間休日の統計表は固定データと一致');}
else if(normalize(updated)!==normalize(original))writeFileSync(page,updated);
