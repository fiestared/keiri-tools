import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calcPapaIkukyu} from '../../docs/assets/ikuji_core.js';
const D=JSON.parse(fs.readFileSync('docs/assets/kihonteate_r07.json'));
const input={total6m:1800000,leaveDays:13,wage:0,spouse:{exempt:true},otherEligibleDays:1,shienPaidDays:0};
assert.equal(calcPapaIkukyu(input,D).shien.amount,16900,'13日＋通常育休1日なら今回13日分の13%');
