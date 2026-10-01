import {readFileSync,writeFileSync} from 'node:fs';
import {segmentClaims} from './segment-located.mjs';
import {findNumbers} from '../../tools/check_claims.mjs';
const dir='review-evidence/auto20261001-t8-q1/';
for(const slug of ['furikomi-tesuryo-hikaku','zengin-format-guide']) {
 const page=`docs/column/${slug}/index.html`;
 const units=segmentClaims(readFileSync((process.env.LEDGER_SOURCE_ROOT || '.')+'/'+page,'utf8'),page);
 writeFileSync(dir+slug+'-located-after.json',JSON.stringify(units.map(u=>({...u,numbers:[...findNumbers(u.text)]})),null,2));
}
