#!/usr/bin/env node
// Emit only to stdout: measured mapping and independent verification are separate.
import { readFileSync, existsSync } from 'node:fs';
import { segmentClaims, validateSegments } from './segment_claims.mjs';
import { ledgerPath } from './check_claims.mjs';
const file=process.argv[2]; if (!file) throw Error('usage: coverage_report.mjs <pages_top.txt> [limit=120]');
const pages=[...new Set(readFileSync(file,'utf8').split(/\s+/).filter(x=>/^docs\/.*index\.html$/.test(x)))].slice(0,Number(process.argv[3] || 120));
const rows=pages.map(page=>{const lp=ledgerPath(page);const c=validateSegments(segmentClaims(readFileSync(page,'utf8'),page),existsSync(lp)?JSON.parse(readFileSync(lp,'utf8')):null);return {page,total:c.total,covered:c.covered,verified:c.verified,nonclaims:c.nonclaims,unprocessed:c.unprocessed};});
const totals=Object.fromEntries(['total','covered','verified','nonclaims','unprocessed'].map(k=>[k,rows.reduce((n,r)=>n+r[k],0)]));
console.log(JSON.stringify({pages:rows.length,...totals,mapped_rate:totals.covered/totals.total,verified_rate:totals.verified/totals.total,note:'被覆100%は正確性の保証ではない。既存台帳を推測で照合済みにしない。',rows},null,2));
