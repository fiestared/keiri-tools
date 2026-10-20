// Public upper limits: keep the course, boundary and amount in one source row.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('tools/article_data/hatarakikata-kaikaku-joseikin-2026.json',root)));
const file=new URL('docs/column/hatarakikata-kaikaku-joseikin/index.html',root);
let html=readFileSync(file,'utf8');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for(const t of data.tables){
 const table='<table data-joseikin-table="'+t.id+'"><tr>'+t.columns.map(s=>'<th scope="col">'+esc(s)+'</th>').join('')+'</tr>\n'+t.rows.map(r=>'<tr><th scope="row">'+esc(r[0])+'</th>'+r.slice(1).map(s=>'<td'+(/^\d+万円$/.test(s)?' class="num"':'')+'>'+esc(s)+'</td>').join('')+'</tr>').join('\n')+'\n</table>';
 const re=new RegExp('<table data-joseikin-table="'+t.id+'">[\\s\\S]*?</table>');
 if(!re.test(html))throw Error('missing '+t.id);
 html=html.replace(re,table);
}
writeFileSync(file,html);console.log('generated '+data.tables.length+' public limit tables');
