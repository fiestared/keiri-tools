// Emit review units, per-unit numbers and page absolutes for ledger assembly (read-only helper).
import { readFileSync } from 'node:fs';
import { segmentClaims } from '../../tools/segment_claims.mjs';
import { findNumbers, findAbsolutes, claimText } from '../../tools/check_claims.mjs';
const page = process.argv[2];
const html = readFileSync(page, 'utf8');
const units = segmentClaims(html, page).map(u => ({ ...u, numbers: [...findNumbers(u.text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)))] }));
const text = claimText(html);
console.log(JSON.stringify({ units, pageNumbers: [...findNumbers(text)], absolutes: findAbsolutes(text) }));
