import{spawnSync}from'node:child_process';
import{writeFileSync,appendFileSync}from'node:fs';
const log='reports/saitei-pref-2026-10-14/generators.log';writeFileSync(log,'');
const sequence=['gen_saitei_pref_pages','gen_saitei_table','gen_faq_jsonld','gen_qa_index','gen_article_next_read','gen_tool_related','gen_layout_markup','gen_presentation_markup','gen_site_footer','gen_favicon_links','gen_datemodified','gen_index_sitemap'];
for(const name of sequence){const r=spawnSync(process.execPath,[`tools/${name}.mjs`],{encoding:'utf8',maxBuffer:16*1024*1024});appendFileSync(log,`${name}: exit ${r.status}\n${r.stdout}${r.stderr}\n`);if(r.status)throw Error(name+' '+r.stderr);console.log(name,'ok');}
for(const name of ['gen_toc_related','gen_nav','gen_ogp','gen_x_share','gen_x_link','gen_trust_footer','gen_data_source_note','gen_domain_bridge','gen_datemodified','gen_index_sitemap','gen_index_sitemap']){const r=spawnSync(process.execPath,[`tools/${name}.mjs`],{encoding:'utf8',maxBuffer:16*1024*1024});appendFileSync(log,`${name}: exit ${r.status}\n${r.stdout}${r.stderr}\n`);if(r.status)throw Error(name+' '+r.stderr);console.log(name,'ok');}
