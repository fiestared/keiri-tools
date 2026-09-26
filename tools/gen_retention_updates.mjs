/** One fixed record drives three notices and RSS; regeneration never invents an update date. */
import {readFileSync,writeFileSync} from 'node:fs';
const docs = new URL('../docs/', import.meta.url);
const records = JSON.parse(readFileSync(new URL('assets/retention_updates.json',docs),'utf8'));
const check = process.argv.includes('--check');
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function save(path, text) { const p = new URL(path,docs); let old='';try{old=readFileSync(p,'utf8');}catch{} if(old===text)return;if(check)throw Error(`stale: ${path}`);writeFileSync(p,text); }
for (const target of [...new Set(records.flatMap(r=>r.targets))]) {
 const p = `${target}/index.html`, before=readFileSync(new URL(p,docs),'utf8');
 const entries=records.filter(r=>r.targets.includes(target));
 const body=`<div class="retention-updates">${target.startsWith('column/')?'':'<h3>制度変更の確認</h3>'}<p class="hint">適用日と変更点を記録しています。日々の更新一覧ではありません。</p><ul>${entries.map(r=>`<li id="change-${esc(r.id)}"><b>${esc(r.title)}</b><br>適用日：<time datetime="${esc(r.effectiveDate)}">${esc(r.effectiveDate)}</time><p>${esc(r.summary)}</p><a href="${esc(r.source)}" rel="nofollow">${esc(r.sourceName)}</a></li>`).join('')}</ul><p><a href="/updates.xml">制度変更のRSS</a> <span class="hint">対応するRSSリーダーで購読できます。記録追加時だけ通知対象になります。</span></p></div>`;
 const after=before.replace(/<!--retention-updates:S-->[\s\S]*?<!--retention-updates:E-->/,`<!--retention-updates:S-->${body}<!--retention-updates:E-->`);
 if(after===before&&!before.includes(body))throw Error(`Missing notice marker: ${target}`);
 save(p,after);
}
const latest=records.map(r=>r.recordedAt).sort().at(-1);
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>税金・経理・補助金ツールズ：制度変更</title><link>https://keiri-tools.com/column/keiri-nenkan-schedule/</link>
<description>経理の計算・確認に関係する制度変更。適用日と公式根拠を記録します。</description><language>ja</language>
<atom:link href="https://keiri-tools.com/updates.xml" rel="self" type="application/rss+xml"/>
<lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>
${records.map(r=>`<item><title>${esc(r.title)}</title><link>https://keiri-tools.com/${r.page}/#change-${r.id}</link><guid isPermaLink="false">keiri-tools:${r.id}</guid><pubDate>${new Date(r.recordedAt).toUTCString()}</pubDate><description>${esc(`適用日：${r.effectiveDate}。${r.summary} 公式根拠：${r.source}`)}</description></item>`).join('\n')}
</channel></rss>\n`;
save('updates.xml',xml);console.log('Retention notices and RSS are current');
