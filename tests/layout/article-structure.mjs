/** Structural presence must mean useful navigation, not an empty shell. */
export const hasBreadcrumb=html=>[...html.matchAll(/<nav\b[^>]*class="([^"]*)"[^>]*>/g)].some(m=>m[1].split(/\s+/).includes('breadcrumb'));
export const hasRelatedLinks=html=>[...html.matchAll(/<section\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/section>/g)].some(m=>m[1].split(/\s+/).some(c=>['related','next-read'].includes(c))&&[...m[2].matchAll(/<a\b[^>]*href="[^"]+"[^>]*>([\s\S]*?)<\/a>/g)].some(a=>a[1].replace(/<[^>]*>/g,'').trim()));
