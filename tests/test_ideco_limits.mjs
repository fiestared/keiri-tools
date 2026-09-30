import assert from 'node:assert/strict';
import {cases} from './boundaries/setsuzei_core.mjs';
for(const c of cases.filter(c=>c.name.startsWith('iDeCo'))) assert.deepEqual(c.run(),c.expected,c.name);
console.log('iDeCo: 他制度合算の上限・最低掛金・税率跨ぎの境界は緑');
