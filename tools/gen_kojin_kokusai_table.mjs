#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
const d=JSON.parse(readFileSync('tools/data/kojin_kokusai_rates.json','utf8'));
const file='docs/column/kojin-kokusai-kinri-table/index.html';
let html=readFileSync(file,'utf8');
const wrap=(caption,heads,rows)=>`<div class="scroll-wrap"><table><caption>${caption}</caption><thead><tr>${heads.map((x,i)=>`<th scope="col"${i?' class="num"':''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const row=(r,cells)=>`<tr><th scope="row">${r.kind}・第${r.issue_no}回</th>${cells.map(x=>`<td class="num">${/^[0-9]/.test(x)?'<span class="numeric-token">'+x+'</span>':x}</td>`).join('')}</tr>`;
const rates=wrap('2026年10月募集分の公表年率',['種類・回号','税引前年率','税引後年率','発行条件'],d.rows.map(r=>row(r,[r.rate+'%',r.after+'%',`<a href="${r.url}">財務省</a>`])));
const interest=wrap('2026年10月募集分・初回利息の比較概算',['種類・回号','税引前利息（概算）','税引後利息（概算）'],d.rows.map(r=>row(r,[r.gross.toLocaleString('en-US')+'円',r.net.toLocaleString('en-US')+'円'])));
for(const [name,table] of [['rates',rates],['interest',interest]])html=html.replace(new RegExp(`<!-- kokusai-${name}:start -->[\\s\\S]*?<!-- kokusai-${name}:end -->`),`<!-- kokusai-${name}:start -->\n${table}\n<!-- kokusai-${name}:end -->`);
if(process.argv.includes('--check')){if(html!==readFileSync(file,'utf8')){console.error('国債表が正本JSONと不一致');process.exit(1);}console.log('国債表の生成一致 OK');}else writeFileSync(file,html);
